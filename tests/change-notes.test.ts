// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentId, parseChangeNotes } from '../tools/change-notes.ts';

test('the popup takes only the newest update while the page retains history and working guide links', () => {
  const notes = parseChangeNotes([
    '# 更新说明', '', '[guide]: GUIDE.md#1-先玩一局', '',
    '## 2026-10-08 · New controls', '', '### 操作变化', '',
    '- New controls are described in the [guide][guide].', '',
    '## 2026-10-07 · Previous controls', '', '- Old controls.',
  ].join('\n'));
  assert.equal(notes.entries.length, 2);
  assert.match(notes.introduction, /<h1>更新说明<\/h1>/);
  assert.equal(notes.entries[0].title, '2026-10-08 · New controls');
  assert.match(notes.entries[0].html, /href="\.\/guide\.html#1-/);
  assert.doesNotMatch(notes.entries[0].html, /Old controls/);
  assert.match(notes.entries[1].html, /Old controls/);
});

test('missing or empty updates stop the build instead of publishing an empty notice', () => {
  assert.throws(() => parseChangeNotes('# 更新说明\nNothing dated yet.'), /level-two heading/);
  assert.throws(() => parseChangeNotes('# 更新说明\n\n## New\n\n## Old\nA previous change.'), /include a description/);
});

test('deployment identities distinguish repeated builds even when the app version has not changed', () => {
  assert.equal(deploymentId(true, ' 12345-1 '), '12345-1');
  assert.notEqual(deploymentId(true, '12345-1'), deploymentId(true, '12345-2'));
  assert.notEqual(deploymentId(true), deploymentId(true));
  assert.equal(deploymentId(false), deploymentId(false, '12345-2'));
});
