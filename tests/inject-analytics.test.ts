// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../tools/inject-analytics.mjs', import.meta.url));
const token = '0123456789abcdef0123456789abcdef';
const html = '<!doctype html><html><body><main>Game</main></body></html>';

function fixture(t: TestContext): string {
  const parent = realpathSync(tmpdir());
  const directory = mkdtempSync(join(parent, 'complexweeper-analytics-'));
  t.after(() => {
    assert.equal(dirname(realpathSync(directory)), parent);
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(join(directory, 'dist'));
  for (const name of ['index.html', 'guide.html', 'changes.html']) writeFileSync(join(directory, 'dist', name), html);
  writeFileSync(join(directory, 'index.html'), html);
  writeFileSync(join(directory, 'dist/source.tgz'), 'corresponding source');
  return directory;
}

function inject(directory: string, value: string) {
  return spawnSync(process.execPath, [script], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, CW_WEB_ANALYTICS_TOKEN: value },
  });
}

test('an unconfigured deployment leaves every page unchanged', t => {
  const directory = fixture(t);
  assert.equal(inject(directory, '').status, 0);
  for (const name of ['index.html', 'guide.html', 'changes.html']) assert.equal(readFileSync(join(directory, 'dist', name), 'utf8'), html);
});

test('analytics is injected once into deployment pages without changing source files or the archive', t => {
  const directory = fixture(t);
  assert.equal(inject(directory, token).status, 0);
  const first = readFileSync(join(directory, 'dist/index.html'), 'utf8');
  assert.equal(inject(directory, token).status, 0);
  for (const name of ['index.html', 'guide.html', 'changes.html']) {
    const output = readFileSync(join(directory, 'dist', name), 'utf8');
    assert.equal(output, first);
    assert.equal(output.match(/beacon\.min\.js/g)?.length, 1);
    assert.ok(output.includes(`data-cf-beacon='{"token":"${token}","spa":false}'`));
    assert.ok(output.indexOf('beacon.min.js') < output.indexOf('</body>'));
  }
  assert.equal(readFileSync(join(directory, 'index.html'), 'utf8'), html);
  assert.equal(readFileSync(join(directory, 'dist/source.tgz'), 'utf8'), 'corresponding source');
});

test('an invalid token stops injection before modifying deployment pages', t => {
  const directory = fixture(t);
  const result = inject(directory, 'invalid-token');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CW_WEB_ANALYTICS_TOKEN/);
  for (const name of ['index.html', 'guide.html', 'changes.html']) assert.equal(readFileSync(join(directory, 'dist', name), 'utf8'), html);
});
