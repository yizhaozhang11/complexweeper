// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import type { Quarter } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { beginTouch, longPress } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator('[data-at="' + at + '"]');

function position(charges: [number, Quarter][], opened: number[], marks: [number, number, Quarter][] = []) {
  const puzzle = createPuzzle({ columns: 5, rows: 5, mines: charges.length });
  for (const [at, charge] of charges) puzzle.tiles[at].charge = charge;
  for (const at of opened) puzzle.tiles[at].revealed = true;
  for (const [at, basis, rotation] of marks) puzzle.tiles[at].mark = { basis, rotation };
  puzzle.stage = 'playing'; puzzle.duration = 24000;
  return puzzle;
}

test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'Touch-only interaction contract.'));

test('tap and hold follow cell state; a hold commits on release without a second click', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.touch-tools')).toBeVisible();
  await expect(page.locator('[data-tool]')).toHaveCount(0);
  await expect(page.locator('#group-card')).toBeHidden();
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('0');
  const first = await beginTouch(page, 0);
  await first.ready();
  await expect(first.cell).toHaveAttribute('data-mark', '');
  await expect(first.cell).toHaveAttribute('data-open', 'false');
  await first.choose(0);
  await first.end();
  await expect(first.cell).toHaveAttribute('data-mark', '1');
  for (const value of ['i', '−1', '−i', '1']) {
    await first.cell.tap();
    await expect(first.cell).toHaveAttribute('data-mark', value);
    await expect(first.cell).toHaveAttribute('data-open', 'false');
  }
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('1');
  await first.cell.tap();
  await expect(first.cell).toHaveAttribute('data-mark', 'a');
  await first.cell.tap();
  await expect(first.cell).toHaveAttribute('data-mark', 'ia');
  await expect(page.locator('#touch-group')).toHaveValue('1');
  await longPress(page, 1);
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'a');

  const erase = await beginTouch(page, 0);
  await erase.ready();
  await expect(erase.cell).toHaveAttribute('data-mark', 'ia');
  await erase.choose('clear');
  await erase.end();
  await erase.cell.dispatchEvent('click');
  await expect(erase.cell).toHaveAttribute('data-mark', '');
  await expect(erase.cell).toHaveAttribute('data-open', 'false');
  await erase.cell.tap();
  await expect(erase.cell).toHaveAttribute('data-open', 'true');
});

test('a different selected group reassigns only the tapped mark before cycling, with each step undoable', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 2, rotation: 3 };
  puzzle.tiles[2].mark = { basis: 2, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));

  for (const [basis, reassigned, cycled] of [['1', '−ia', 'a'], ['0', '−i', '1']]) {
    await page.locator('#touch-group').selectOption(basis);
    await cell(page, 1).tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', reassigned);
    await expect(cell(page, 2)).toHaveAttribute('data-mark', 'ib');
    await expect(page.locator('#touch-group')).toHaveValue(basis);

    await cell(page, 1).tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', cycled);
    await expect(cell(page, 1)).toHaveAttribute('data-open', 'false');
    await page.locator('#touch-undo').tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', reassigned);
    await page.locator('#touch-undo').tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
    await expect(cell(page, 0)).toHaveAttribute('data-mark', 'a');
    await expect(cell(page, 2)).toHaveAttribute('data-mark', 'ib');
    await expect(page.locator('#touch-group')).toHaveValue(basis);
  }
});

test('dragging away and back, cancellation, scrolling and multiple pointers never commit a hold', async ({ page }) => {
  await page.goto('/');
  const away = await beginTouch(page, 0);
  await away.move(24, 0);
  await away.move(0, 0);
  await away.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 0)).toHaveAttribute('data-open', 'false');

  const cancelled = await beginTouch(page, 0);
  await cancelled.ready();
  await cancelled.cancel();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');

  const scrolling = await beginTouch(page, 0);
  await scrolling.ready();
  await page.locator('#board-scroll').evaluate(element => element.dispatchEvent(new Event('scroll')));
  await scrolling.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');

  const multiple = await beginTouch(page, 0);
  await multiple.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { id: 1, x: multiple.x, y: multiple.y }, { id: 2, x: multiple.x + 34, y: multiple.y },
  ] });
  await page.waitForTimeout(520);
  await multiple.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '');
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'ready');
  await longPress(page, 0);
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
});

test('a pinned clue survives mark edits and expansion runs only on a permitted long release', async ({ page }) => {
  await page.goto('/#cw=' + pack(position([[6, 0]], [11, 12], [[6, 1, 0]])));
  await page.locator('#resume').tap();
  await cell(page, 12).tap();
  await expect(cell(page, 12)).toHaveAttribute('data-inspected', 'true');
  await expect(cell(page, 7)).toHaveClass(/candidate/);
  await expect(cell(page, 7)).toHaveAttribute('data-open', 'false');
  await cell(page, 6).tap();
  await expect(cell(page, 6)).toHaveAttribute('data-mark', '1');
  await expect(cell(page, 12)).toHaveAttribute('data-inspected', 'true');
  await expect(page.locator('#touch-group')).toHaveValue('0');
  await cell(page, 11).tap();
  await expect(cell(page, 12)).toHaveAttribute('data-inspected', 'false');
  await expect(cell(page, 11)).toHaveAttribute('data-inspected', 'true');
  await cell(page, 11).tap();
  await expect(cell(page, 11)).toHaveAttribute('data-inspected', 'false');
  await cell(page, 11).tap();
  await page.locator('#message').tap();
  await expect(cell(page, 11)).toHaveAttribute('data-inspected', 'false');

  await cell(page, 12).tap();
  await page.locator('#hints').uncheck();
  await expect(page.locator('.tile.candidate')).toHaveCount(0);
  await page.locator('#expansion').uncheck();
  await longPress(page, 12);
  await expect(cell(page, 7)).toHaveAttribute('data-open', 'false');
  await page.locator('#expansion').check();
  const expand = await beginTouch(page, 12);
  await expand.ready();
  await expect(cell(page, 7)).toHaveClass(/candidate/);
  await expect(cell(page, 7)).toHaveAttribute('data-open', 'false');
  await expand.end();
  await expect(cell(page, 7)).toHaveAttribute('data-open', 'true');
});

test('unmatched clues do not expand and wrong marks can still detonate a conditional expansion', async ({ page }) => {
  await page.goto('/#cw=' + pack(position([[6, 0]], [12])));
  await page.locator('#resume').tap();
  await longPress(page, 12);
  await expect(cell(page, 7)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'playing');

  await page.goto('/#cw=' + pack(position([[6, 0]], [12], [[7, 1, 0]])));
  await page.locator('#resume').tap();
  await longPress(page, 12);
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'lost');
  await expect(cell(page, 6)).toHaveClass(/impact/);
  await expect(page.locator('#touch-undo')).toBeDisabled();
});

test('group selection, transforms, new letters and undo use the shared algebra', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[2].mark = { basis: 1, rotation: 1 };
  puzzle.tiles[3].mark = { basis: 2, rotation: 2 };
  await page.goto('/#cw=' + pack(puzzle));
  await page.locator('#touch-group').selectOption('1');
  await page.locator('#touch-rotate').tap();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'ia');
  await expect(cell(page, 2)).toHaveAttribute('data-mark', '−a');
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');
  await page.locator('#touch-conjugate').tap();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ia');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'ia');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'a');

  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('3');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('3');
  await longPress(page, 4);
  await expect(cell(page, 4)).toHaveAttribute('data-mark', 'c');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('4');
  await longPress(page, 4);
  await expect(cell(page, 4)).toHaveAttribute('data-mark', '');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('3');

  await longPress(page, 0);
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('0');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('0');
  await longPress(page, 4);
  await expect(cell(page, 4)).toHaveAttribute('data-mark', '1');
  await page.locator('#touch-new-group').tap();
  await expect(page.locator('#touch-group')).toHaveValue('3');
});

test('merge previews a whole target group, blocks edits, confirms explicitly and is reversible', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  for (const [at, basis, rotation] of [[0, 0, 0], [1, 1, 0], [2, 1, 1], [3, 2, 2], [4, 2, 3]]) {
    puzzle.tiles[at].mark = { basis, rotation: rotation as Quarter };
  }
  await page.goto('/#cw=' + pack(puzzle));
  await page.locator('#touch-group').selectOption('1');
  await page.locator('#touch-merge').tap();
  await expect(page.locator('#touch-group')).toBeDisabled();
  await expect(page.locator('#touch-new-group')).toBeDisabled();
  await expect(page.locator('#touch-rotate')).toBeDisabled();
  await cell(page, 3).tap();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');
  await expect(cell(page, 3)).toHaveAttribute('data-merge-preview', 'true');
  await expect(cell(page, 4)).toHaveAttribute('data-merge-preview', 'true');
  await cell(page, 3).tap();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');
  await cell(page, 0).tap();
  await expect(cell(page, 0)).toHaveAttribute('data-merge-preview', 'true');
  await expect(cell(page, 3)).toHaveAttribute('data-merge-preview', 'false');
  await cell(page, 3).tap();
  await cell(page, 5).tap();
  await expect(cell(page, 5)).toHaveAttribute('data-open', 'false');
  const heldTarget = await beginTouch(page, 3);
  await page.waitForTimeout(520);
  await heldTarget.end();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');
  await page.locator('#touch-cancel').tap();
  await expect(page.locator('#touch-merge')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#touch-merge').tap();
  await cell(page, 3).tap();
  await page.locator('#touch-merge').tap();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−a');
  await expect(cell(page, 4)).toHaveAttribute('data-mark', '−ia');
  await expect(page.locator('#touch-group')).toHaveValue('1');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');

  await page.locator('#touch-group').selectOption('2');
  await page.locator('#touch-merge').tap();
  await cell(page, 0).tap();
  await page.locator('#touch-merge').tap();
  await expect(page.locator('#touch-group')).toHaveValue('0');
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−1');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 3)).toHaveAttribute('data-mark', '−b');
});

test('an external keyboard can use tap and hold equivalents without repeating a held key', async ({ page }) => {
  await page.goto('/');
  await page.locator('#touch-new-group').tap();
  const target = cell(page, 0);
  await target.press('Shift+Enter');
  await expect(page.locator('#mark-menu')).toBeVisible();
  await expect(target).toHaveAttribute('data-mark', '');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('data-mark', '1');
  await target.dispatchEvent('keydown', { key: 'Enter', shiftKey: true, repeat: true, bubbles: true });
  await expect(target).toHaveAttribute('data-mark', '1');
  await target.press('Enter');
  await expect(target).toHaveAttribute('data-mark', 'i');
  await target.press('Shift+Space');
  await expect(page.locator('#mark-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(target).toHaveAttribute('data-mark', '');
  await expect(target).toHaveAttribute('data-open', 'false');
  await target.press('Space');
  await expect(target).toHaveAttribute('data-open', 'true');
});

test('phone controls fit a narrow screen and leave room below the page', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const puzzle = position([[0, 0], [4, 1], [20, 2]], [6, 7, 8, 11, 12, 13], [[0, 1, 0], [4, 1, 1], [20, 2, 0]]);
  await page.goto('/#cw=' + pack(puzzle));
  await page.locator('#resume').tap();
  await page.locator('#touch-group').selectOption('1');
  await cell(page, 6).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const layout = await page.locator('.touch-tools').evaluate(toolbar => ({
    height: toolbar.getBoundingClientRect().height,
    padding: parseFloat(getComputedStyle(document.body).paddingBottom),
    small: [...toolbar.querySelectorAll('button:not([hidden]),select')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    }).length,
  }));
  expect(layout.padding).toBeGreaterThan(layout.height);
  expect(layout.small).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('touch-controls.png'), fullPage: false });
});
