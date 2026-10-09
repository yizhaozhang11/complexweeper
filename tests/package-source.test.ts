// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../tools/package-source.mjs', import.meta.url));

function fixture(t: TestContext): string {
  const parent = realpathSync(tmpdir());
  const directory = mkdtempSync(join(parent, 'complexweeper-package-'));
  t.after(() => {
    assert.equal(dirname(realpathSync(directory)), parent);
    rmSync(directory, { recursive: true, force: true });
  });
  for (const folder of ['src', 'public/legal', '.cache']) mkdirSync(join(directory, folder), { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ files: ['src', 'public/legal', 'LICENSE', 'COPYRIGHT'] }));
  writeFileSync(join(directory, 'src/entry.ts'), 'export const example = 1;');
  writeFileSync(join(directory, 'LICENSE'), 'Example license text');
  writeFileSync(join(directory, 'COPYRIGHT'), 'Example copyright text');
  writeFileSync(join(directory, '.cache/local-notes.txt'), 'Local working notes');
  return directory;
}

test('source archive carries authoring files and matching legal notices without local caches', t => {
  const directory = fixture(t);
  execFileSync(process.execPath, [script], { cwd: directory, stdio: 'pipe' });
  const archive = join(directory, 'public/source.tgz');
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split(/\r?\n/);
  for (const required of ['package.json', 'src/entry.ts', 'LICENSE', 'COPYRIGHT', 'public/legal/GPL-3.0.txt', 'public/legal/COPYRIGHT.txt']) {
    assert.ok(entries.includes(required), required);
  }
  assert.equal(entries.some(entry => entry.startsWith('.cache/')), false);
  assert.equal(execFileSync('tar', ['-xOf', archive, 'public/legal/COPYRIGHT.txt'], { encoding: 'utf8' }), readFileSync(join(directory, 'COPYRIGHT'), 'utf8'));
  assert.equal(execFileSync('tar', ['-xOf', archive, 'public/legal/GPL-3.0.txt'], { encoding: 'utf8' }), readFileSync(join(directory, 'LICENSE'), 'utf8'));
});

test('missing required source stops packaging without replacing the previous archive', t => {
  const directory = fixture(t);
  unlinkSync(join(directory, 'COPYRIGHT'));
  const archive = join(directory, 'public/source.tgz');
  writeFileSync(archive, 'previous archive');
  const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source archive inputs are missing: COPYRIGHT/);
  assert.equal(readFileSync(archive, 'utf8'), 'previous archive');
});
