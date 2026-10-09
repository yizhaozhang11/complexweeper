// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import type { Puzzle, Quarter } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';

function savedPosition(charges: [number, Quarter][], opened: number[], marks: [number, number, Quarter][] = []): Puzzle {
  const puzzle = createPuzzle({ columns: 5, rows: 5, mines: charges.length });
  charges.forEach(([at, charge]) => puzzle.tiles[at].charge = charge);
  opened.forEach(at => puzzle.tiles[at].revealed = true);
  marks.forEach(([at, basis, rotation]) => puzzle.tiles[at].mark = { basis, rotation });
  puzzle.stage = 'playing'; puzzle.duration = 24000;
  return puzzle;
}

test('initial board, local font, legal sources and source download work', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(256);
  await expect(page.locator('#hints')).toBeChecked();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('20px "LM Math"'))).toBeTruthy();
  await page.getByRole('button', { name: '关于', exact: true }).click();
  await expect(page.locator('#about-dialog')).toContainText('青月晓');
  await expect(page.locator('#about-dialog')).toContainText('GNU GPL');
  expect((await request.get('/source.tgz')).ok()).toBeTruthy();
  expect((await request.get('/legal/GPL-3.0.txt')).ok()).toBeTruthy();
  expect(errors).toEqual([]);
});

test('desktop mouse groups, keyboard transforms, merge cancellation and undo', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto('/');
  const cell = (at: number) => page.locator(`[data-at="${at}"]`);
  await cell(0).click({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('待用新组');
  await expect(page.locator('#group-symbol')).toHaveText('1');
  await cell(4).click({ button: 'right' });
  await expect(cell(4)).toHaveAttribute('data-mark', '1');
  await cell(0).click({ button: 'middle' });
  await cell(1).click({ button: 'right' });
  await expect(cell(1)).toHaveAttribute('data-mark', 'a');
  const numericFill = await cell(4).evaluate(element => getComputedStyle(element).backgroundColor);
  await expect(cell(1)).toHaveCSS('background-color', numericFill);
  expect(await cell(0).evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(numericFill);
  await page.keyboard.press('i');
  await expect(cell(1)).toHaveAttribute('data-mark', 'ia');
  await page.keyboard.press('c');
  await expect(cell(1)).toHaveAttribute('data-mark', '−ia');
  await cell(0).click({ button: 'middle' });
  await cell(2).click({ button: 'right' });
  await expect(cell(2)).toHaveAttribute('data-mark', 'b');
  await cell(1).click();
  await expect(page.locator('#group-caption')).toHaveText('b 组');
  await cell(1).click({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('a 组');
  await expect(cell(1)).toHaveAttribute('data-mark', '−ia');
  await page.keyboard.press('m');
  await cell(3).click();
  await expect(cell(3)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#merge')).toHaveAttribute('aria-pressed', 'true');
  await cell(2).click();
  await expect(cell(2)).toHaveAttribute('data-mark', 'b');
  await page.locator('#board-frame').click({ button: 'middle', position: { x: 8, y: 8 } });
  await cell(3).click({ button: 'middle' });
  await expect(page.locator('#merge')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#group-caption')).toHaveText('a 组');
  await cell(2).click({ button: 'middle' });
  await expect(cell(2)).toHaveAttribute('data-mark', 'a');
  await page.keyboard.press('Control+z');
  await expect(cell(2)).toHaveAttribute('data-mark', 'b');
  const bounds = await cell(0).boundingBox();
  await page.mouse.move(bounds!.x + 5, bounds!.y + 5);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(bounds!.x + 25, bounds!.y + 5);
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('a 组');
  await cell(4).click({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('数值组');
  for (let phase = 0; phase < 4; phase++) await cell(4).click({ button: 'right' });
  await expect(cell(4)).toHaveAttribute('data-mark', '');
  await cell(1).click({ button: 'middle' });
  await cell(0).click({ button: 'middle' });
  await expect(page.locator('#group-symbol')).toHaveText('1');
  await expect(page.locator('#group-caption')).toHaveText('待用新组');
  await page.locator('#fresh-group').click();
  await expect(page.locator('#group-symbol')).toHaveText('1');
  await cell(5).click({ button: 'right' });
  await expect(cell(5)).toHaveAttribute('data-mark', '1');
  await expect(cell(5)).toHaveCSS('background-color', numericFill);
});

test('middle click prepares groups in gaps and page background without hijacking controls', async ({ page, isMobile }) => {
  test.skip(isMobile);
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 1, rotation: 3 };
  puzzle.tiles[2].mark = { basis: 2, rotation: 0 };
  await page.goto(`/#cw=${pack(puzzle)}`);
  const chooseA = () => page.locator('[data-at="1"]').click({ button: 'middle' });

  await chooseA();
  await page.locator('#board-frame').click({ button: 'middle', position: { x: 8, y: 8 } });
  await expect(page.locator('#group-symbol')).toHaveText('𝑐');
  await expect(page.locator('#group-caption')).toHaveText('待用新组');

  await chooseA();
  const bounds = await page.locator('[data-at="3"]').boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width + 1, bounds!.y + bounds!.height / 2, { button: 'middle' });
  await expect(page.locator('#group-symbol')).toHaveText('𝑐');

  await chooseA();
  await page.locator('#message').click({ button: 'middle' });
  await expect(page.locator('#group-symbol')).toHaveText('𝑐');

  await chooseA();
  await page.mouse.click(3, 120, { button: 'middle' });
  await expect(page.locator('#group-symbol')).toHaveText('𝑐');

  await chooseA();
  await page.locator('#fresh-group').click({ button: 'middle' });
  await page.locator('#hints').click({ button: 'middle' });
  await expect(page.locator('#hints')).toBeChecked();
  await expect(page.locator('#group-caption')).toHaveText('a 组');
  const preventedLinkDefault = await page.locator('footer a').evaluate(element => {
    const event = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(preventedLinkDefault).toBe(false);
  await page.locator('#help').click();
  await page.locator('#help-dialog h2').click({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('a 组');
  await page.locator('#help-dialog [data-close]').click();
  await expect(page.locator('[data-at="1"]')).toHaveAttribute('data-mark', '−ia');
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'ready');
});

test('middle background gestures cancel on drag, wheel and mixed mouse buttons', async ({ page, isMobile }) => {
  test.skip(isMobile);
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 1, rotation: 0 };
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.locator('[data-at="1"]').click({ button: 'middle' });
  const frame = await page.locator('#board-frame').boundingBox();
  const x = frame!.x + 8, y = frame!.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 20, y);
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('a 组');

  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.wheel(0, 40);
  await page.mouse.up({ button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('a 组');

  const marked = await page.locator('[data-at="0"]').boundingBox();
  await page.mouse.move(marked!.x + 12, marked!.y + 12);
  for (const first of ['middle', 'left'] as const) {
    const second = first === 'middle' ? 'left' : 'middle';
    await page.mouse.down({ button: first });
    await page.mouse.down({ button: second });
    await page.mouse.up({ button: second });
    await page.mouse.up({ button: first });
    await expect(page.locator('#group-caption')).toHaveText('a 组');
  }
  await page.mouse.click(marked!.x + 12, marked!.y + 12, { button: 'middle' });
  await expect(page.locator('#group-caption')).toHaveText('数值组');
});

test('hints and click expansion are independent, conditional errors can lose, review is available', async ({ page, isMobile }) => {
  test.skip(isMobile);
  const puzzle = savedPosition([[6, 0]], [12], [[7, 1, 0]]);
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.getByRole('button', { name: '继续对局' }).click();
  const clue = page.locator('[data-at="12"]');
  await expect(clue).toHaveClass(/satisfied/);
  await page.locator('#expansion').uncheck();
  await clue.click();
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'playing');
  await page.locator('#hints').uncheck();
  await expect(clue).not.toHaveClass(/satisfied/);
  await page.locator('#expansion').check();
  await clue.click();
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'lost');
  await expect(page.locator('[data-at="6"]')).toHaveClass(/impact/);
  await page.locator('#review-field').click();
  await expect(page.locator('[data-at="6"]')).toHaveAttribute('aria-label', /实际雷 1/);
  await page.locator('#restart').click();
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'ready');
  await expect(page.locator('#outcome')).toBeHidden();
});

test('symbolic completion, celebration and imported completed games do not replay animation', async ({ page, isMobile }) => {
  test.skip(isMobile);
  const puzzle = savedPosition([[0, 0], [24, 1]], Array.from({ length: 23 }, (_, i) => i + 1), [[0, 0, 0]]);
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.getByRole('button', { name: '继续对局' }).click();
  await expect(page.locator('#state')).toHaveText('待满足线索');
  await page.locator('#fresh-group').click();
  await page.locator('[data-at="24"]').click({ button: 'right' });
  await expect(page.locator('[data-at="24"]')).toHaveAttribute('data-mark', 'a');
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'won');
  await expect(page.locator('#outcome')).toBeVisible();
  await page.locator('#share').click();
  const url = await page.locator('#share-url').inputValue();
  await page.goto(url);
  await expect(page.locator('#state')).toHaveAttribute('data-stage', 'won');
  await expect(page.locator('#outcome')).toBeHidden();
});

test('sharing preserves group phase and pause, and preferences survive reload', async ({ page, isMobile }) => {
  test.skip(isMobile);
  const puzzle = savedPosition([[0, 0], [1, 1]], [12], [[0, 8, 3]]);
  await page.goto(`/#cw=${pack(puzzle)}`);
  await expect(page.locator('#pause-cover')).toBeVisible();
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-mark', '−ih');
  await page.locator('#hints').uncheck();
  await page.locator('#share').click();
  const url = await page.locator('#share-url').inputValue();
  await page.goto(url);
  await page.reload();
  await expect(page.locator('#hints')).not.toBeChecked();
  await expect(page.locator('#pause-cover')).toBeVisible();
  await page.locator('#resume').click();
  await page.locator('#pause').click();
  await expect(page.locator('#pause-cover')).toBeVisible();
});

test('responsive board confines horizontal scrolling and every radical is readable', async ({ page, isMobile }, testInfo) => {
  const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
  puzzle.stage = 'playing'; puzzle.duration = 90000;
  for (let at = 0; at < 40; at++) puzzle.tiles[(at * 29 + 9) % 256].charge = (at % 4) as Quarter;
  for (let at = 0; at < 115; at++) if (puzzle.tiles[at].charge === null) puzzle.tiles[at].revealed = true;
  puzzle.tiles.forEach((tile, at) => { if (tile.charge !== null && at < 100) tile.mark = { basis: at % 3 + 1, rotation: tile.charge }; });
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.locator('#resume').click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const overflowing = await page.locator('.tile .radical-clue,.tile .math').evaluateAll(elements => elements.filter(element => {
    const owner = element.closest('.tile')!.getBoundingClientRect(), content = element.getBoundingClientRect();
    return content.width > owner.width - 2;
  }).length);
  expect(overflowing).toBe(0);
  await page.screenshot({ path: `.cache/${isMobile ? 'mobile' : 'desktop'}-preview.png`, fullPage: true });
  await testInfo.attach('game-preview', { path: `.cache/${isMobile ? 'mobile' : 'desktop'}-preview.png`, contentType: 'image/png' });
});
