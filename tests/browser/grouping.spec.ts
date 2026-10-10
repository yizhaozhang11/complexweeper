// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { beginTouch } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator(`[data-at="${at}"]`);
const setGrouping = (page: Page, enabled: boolean) => page.locator('#grouping').evaluate((input: HTMLInputElement, enabled) => {
  input.checked = enabled; input.dispatchEvent(new Event('change', { bubbles: true }));
}, enabled);

test('grouping defaults on; switching off gives the board more space and preserves existing marks', async ({ page, isMobile }) => {
  const puzzle = createPuzzle({ columns: 30, rows: 16, mines: 99 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 1, rotation: 3 };
  await page.goto('/#cw=' + pack(puzzle));
  const toggle = page.getByRole('switch', { name: '启用分组', exact: true });
  await expect(toggle).toBeChecked();
  const before = await page.evaluate(() => ({
    width: document.getElementById('board-scroll')!.clientWidth,
    padding: parseFloat(getComputedStyle(document.body).paddingBottom),
  }));
  await toggle.uncheck();
  await expect(page.locator('#group-tools')).toBeHidden();
  await expect(page.locator('#touch-tools')).toBeHidden();
  await expect(page.locator('#quick-undo')).toBeVisible();
  await expect(page.locator('#quick-undo')).toBeDisabled();
  await expect(page.locator('.tile.related')).toHaveCount(0);
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ia');
  if (isMobile) {
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom)))
      .toBeLessThan(before.padding - 70);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--touch-toolbar-height').trim())).toBe('0px');
    const undo = (await page.locator('#quick-undo').boundingBox())!;
    expect(undo.width).toBeGreaterThanOrEqual(44); expect(undo.height).toBeGreaterThanOrEqual(44);
  } else {
    expect(await page.locator('#board-scroll').evaluate(el => el.clientWidth)).toBeGreaterThan(before.width + 150);
    expect(await page.locator('#board-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    expect((await page.locator('.sidebar').boundingBox())!.y).toBeGreaterThan((await page.locator('.play-space').boundingBox())!.y);
  }
  await toggle.check();
  await expect(page.locator('#quick-undo')).toBeHidden();
  await expect(page.locator(isMobile ? '#touch-tools' : '#group-tools')).toBeVisible();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ia');
});

test('disabled grouping blocks group entry points, uses numeric marks and keeps undo reversible', async ({ page, isMobile }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 2, rotation: 3 };
  await page.goto('/#cw=' + pack(puzzle));
  if (isMobile) await page.locator('#touch-group').selectOption('2');
  else await cell(page, 1).click({ button: 'middle' });
  await page.locator('#grouping').uncheck();
  await cell(page, 40).focus();
  for (const key of ['i', 'c', 'm', '0']) await page.keyboard.press(key);
  if (!isMobile) {
    await cell(page, 1).click({ button: 'middle' });
    await cell(page, 2).click({ button: 'middle' });
  }
  for (const id of ['fresh-group', 'rotate', 'conjugate', 'merge', 'touch-new-group', 'touch-rotate', 'touch-conjugate', 'touch-merge']) {
    await page.locator('#' + id).dispatchEvent('click');
  }
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
  await expect(page.locator('#quick-undo')).toBeDisabled();
  const mark = async (at: number) => {
    if (isMobile) {
      const gesture = await beginTouch(page, at);
      await gesture.ready();
      await expect(page.locator('#mark-menu')).toHaveAttribute('data-basis', await page.locator('#grouping').isChecked() ? '1' : '0');
      await gesture.choose(0); await gesture.end();
    } else await cell(page, at).click({ button: 'right' });
  };
  await mark(2);
  await expect(cell(page, 2)).toHaveAttribute('data-mark', '1');
  if (isMobile) await cell(page, 1).tap();
  else await cell(page, 1).click({ button: 'right' });
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−i');
  await page.locator('#quick-undo').click();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
  await expect(page.locator('#grouping')).not.toBeChecked();
  await expect(page.locator('#touch-tools')).toBeHidden();
  await page.locator('#quick-undo').click();
  await expect(cell(page, 2)).toHaveAttribute('data-mark', '');
  await page.locator('#grouping').check();
  await page.locator(isMobile ? '#touch-new-group' : '#fresh-group').click();
  await mark(2);
  await expect(cell(page, 2)).toHaveAttribute('data-mark', 'a');
});

test('grouping preference survives reload, new games and imported letter marks', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.locator('#grouping').uncheck();
  await page.locator('#hints').uncheck();
  await page.reload();
  await expect(page.locator('#grouping')).not.toBeChecked();
  await expect(page.locator('#hints')).not.toBeChecked();
  await page.locator('#preset').selectOption('0');
  await page.locator('#restart').click();
  await expect(page.locator('#grouping')).not.toBeChecked();
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  await expect(page.locator('#grouping')).not.toBeChecked();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'ia');
  await expect(page.locator(isMobile ? '#touch-tools' : '#group-tools')).toBeHidden();
  await page.locator('#grouping').check();
  await expect(page.locator(isMobile ? '#touch-tools' : '#group-tools')).toBeVisible();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'ia');
  await expect(page.locator('#hints')).not.toBeChecked();
});

test('switching off cancels a pending merge without changing the puzzle', async ({ page, isMobile }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 2, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  if (isMobile) {
    await page.locator('#touch-group').selectOption('1');
    await page.locator('#touch-merge').click(); await cell(page, 1).tap();
    await expect(cell(page, 1)).toHaveAttribute('data-merge-preview', 'true');
  } else {
    await cell(page, 0).click({ button: 'middle' });
    await page.locator('#merge').click();
    await expect(cell(page, 1)).toHaveClass(/merge-target/);
  }
  await page.locator('#grouping').uncheck();
  await expect(page.locator('.tile.merge-target, .tile.touch-merge-preview')).toHaveCount(0);
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'a');
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'ib');
  await expect(page.locator('#quick-undo')).toBeDisabled();
  await page.locator('#grouping').check();
  await expect(page.locator(isMobile ? '#touch-merge' : '#merge')).toHaveAttribute('aria-pressed', 'false');
});

test('switching grouping cancels touch taps, open menus, direct holds and keyboard menus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch gesture cancellation.');
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 0 };
  await page.goto('/#cw=' + pack(puzzle));
  const tap = await beginTouch(page, 0);
  await setGrouping(page, false); await tap.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'a');
  await setGrouping(page, true); await page.locator('#touch-group').selectOption('1');
  const menu = await beginTouch(page, 1);
  await menu.ready(); await menu.choose(1); await setGrouping(page, false);
  await expect(page.locator('#mark-menu')).toBeHidden(); await menu.end();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '');
  await cell(page, 1).press('Shift+Enter');
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-basis', '0');
  await setGrouping(page, true);
  await expect(page.locator('#mark-menu')).toBeHidden();
  await page.locator('#touch-marking').selectOption('direct');
  const direct = await beginTouch(page, 2);
  await direct.ready(); await setGrouping(page, false); await direct.end();
  await expect(cell(page, 2)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 2)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#quick-undo')).toBeDisabled();
});

test('switching off cancels an unfinished desktop mark', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse gesture cancellation.');
  await page.goto('/');
  const target = cell(page, 0), box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await setGrouping(page, false); await page.mouse.up({ button: 'right' });
  await expect(target).toHaveAttribute('data-mark', '');
  await expect(target).toHaveAttribute('data-open', 'false');
});

test('numeric-only touch input still supports both marking modes and the tap-cycle preference', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch marking modes.');
  await page.goto('/');
  await page.locator('#grouping').uncheck();
  await page.locator('#touch-tap-cycle').uncheck();
  await page.locator('#touch-marking').selectOption('direct');
  const direct = await beginTouch(page, 0);
  await direct.ready(); await direct.end();
  await expect(direct.cell).toHaveAttribute('data-mark', '1');
  await direct.cell.tap();
  await expect(direct.cell).toHaveAttribute('data-mark', 'i');
  await page.locator('#quick-undo').tap();
  await expect(direct.cell).toHaveAttribute('data-mark', '1');
  await page.locator('#touch-marking').selectOption('menu');
  await expect(page.locator('#touch-tap-cycle')).not.toBeChecked();
  await direct.cell.tap();
  await expect(direct.cell).toHaveAttribute('data-mark', '1');
  const menu = await beginTouch(page, 0);
  await menu.ready(); await menu.choose(3); await menu.end();
  await expect(menu.cell).toHaveAttribute('data-mark', '−i');
  const clear = await beginTouch(page, 0);
  await clear.ready(); await clear.choose('clear'); await clear.end();
  await expect(clear.cell).toHaveAttribute('data-mark', '');
  await expect(clear.cell).toHaveAttribute('data-open', 'false');
});

test('grouping can still be switched when local storage is unavailable', async ({ page, isMobile }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#grouping')).toBeChecked();
  await page.locator('#grouping').uncheck();
  await expect(page.locator(isMobile ? '#touch-tools' : '#group-tools')).toBeHidden();
  await page.locator('#grouping').check();
  await expect(page.locator(isMobile ? '#touch-tools' : '#group-tools')).toBeVisible();
  expect(errors).toEqual([]);
});
