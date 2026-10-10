// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import type { Quarter } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { beginTouch } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator(`[data-at="${at}"]`);
test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'Touch marking menu.'));

test('all four directions preview the selected group and commit one undoable edit to the source cell', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[1].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[2].mark = { basis: 2, rotation: 3 };
  await page.goto('/#cw=' + pack(puzzle));
  const menu = page.locator('#mark-menu');
  for (const [basis, symbols] of [['0', ['1', 'i', '−1', '−i']], ['1', ['a', 'ia', '−a', '−ia']]] as const) {
    await page.locator('#touch-group').selectOption(basis);
    for (let rotation = 0; rotation < 4; rotation++) {
      const gesture = await beginTouch(page, 2);
      await gesture.ready();
      await expect(menu).toBeVisible();
      await expect(menu).toHaveAttribute('data-source-at', '2');
      await gesture.choose(rotation as Quarter);
      await expect(menu).toHaveAttribute('data-choice', String(rotation));
      await expect(page.locator('.mark-menu-preview')).toContainText('松手标记 ' + symbols[rotation]);
      await expect(cell(page, 2)).toHaveAttribute('data-mark', '−ib');
      await gesture.end();
      await expect(menu).toBeHidden();
      await expect(cell(page, 2)).toHaveAttribute('data-mark', symbols[rotation]);
      await expect(cell(page, 2)).toHaveAttribute('data-open', 'false');
      await expect(cell(page, 1)).toHaveAttribute('data-mark', 'a');
      await page.locator('#touch-undo').tap();
      await expect(cell(page, 2)).toHaveAttribute('data-mark', '−ib');
      await expect(page.locator('#touch-undo')).toBeDisabled();
    }
  }
});

test('center clears without opening; moving far cancels, while returning to a direction can still select', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 1 };
  puzzle.tiles[40].mark = { basis: 0, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  const empty = await beginTouch(page, 1);
  await empty.ready(); await empty.end();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 1)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#touch-undo')).toBeDisabled();

  const outside = await beginTouch(page, 0);
  await outside.ready(); await outside.choose(2); await outside.moveInMenu(0, 140);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'cancel');
  await outside.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'i');
  await expect(page.locator('#touch-undo')).toBeDisabled();

  const returned = await beginTouch(page, 0);
  await returned.ready(); await returned.moveInMenu(0, 140); await returned.choose(3); await returned.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '−i');
  const clear = await beginTouch(page, 0);
  await clear.ready(); await clear.choose(2); await clear.move(0, 0);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', '2');
  await clear.choose('clear'); await clear.end();
  await cell(page, 0).dispatchEvent('click');
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 0)).toHaveAttribute('data-open', 'false');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '−i');

  const centered = await beginTouch(page, 40);
  await centered.ready();
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-shifted', 'false');
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
  await centered.end();
  await expect(cell(page, 40)).toHaveAttribute('data-mark', '');
});

test('an early drag scrolls natively, but a directional drag after the hold keeps board and page still', async ({ page }) => {
  await page.goto('/');
  const scrolling = await beginTouch(page, 8);
  const scroll = page.locator('#board-scroll');
  const before = await scroll.evaluate(el => el.scrollLeft);
  for (const dx of [-12, -35, -70]) await scrolling.move(dx, 0);
  await scrolling.end();
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(before);
  await expect(cell(page, 8)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 8)).toHaveAttribute('data-open', 'false');

  const marking = await beginTouch(page, 8);
  await marking.ready();
  const position = await page.evaluate(() => ({ x: document.getElementById('board-scroll')!.scrollLeft, y: scrollY }));
  for (const dx of [-12, -35, -60]) await marking.moveInMenu(dx, 0);
  await expect(page.locator('#mark-menu')).toBeVisible();
  expect(await page.evaluate(() => ({ x: document.getElementById('board-scroll')!.scrollLeft, y: scrollY }))).toEqual(position);
  await marking.end();
  await expect(cell(page, 8)).toHaveAttribute('data-mark', '−1');
});

test('all visible options work after edge placement, with the displayed center fixed until release', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
  puzzle.tiles[1].mark = { basis: 27, rotation: 0 };
  await page.goto('/#cw=' + pack(puzzle));
  await page.locator('#touch-group').selectOption('27');
  const cases: { at: number; rotation: Quarter; block?: ScrollLogicalPosition; shifted?: boolean }[] = [
    { at: 0, rotation: 0 }, { at: 0, rotation: 1 }, { at: 0, rotation: 2 }, { at: 0, rotation: 3 },
    { at: 15, rotation: 2 }, { at: 8, rotation: 3, block: 'start' }, { at: 248, rotation: 1, block: 'end', shifted: false },
  ];
  for (const { at, rotation, block, shifted = true } of cases) {
    const gesture = await beginTouch(page, at, block);
    await gesture.ready();
    const menu = page.locator('#mark-menu'), disc = page.locator('.mark-menu-disc');
    await expect(menu).toHaveAttribute('data-shifted', String(shifted));
    await expect(menu).toHaveAttribute('data-choice', shifted ? 'pending' : 'clear');
    const position = await disc.evaluate(el => ({ left: el.style.left, top: el.style.top }));
    await gesture.choose(rotation);
    await expect(menu).toHaveAttribute('data-choice', String(rotation));
    expect(await disc.evaluate(el => ({ left: el.style.left, top: el.style.top }))).toEqual(position);
    const bounds = (await disc.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(312);
    expect(bounds.y).toBeGreaterThanOrEqual(8);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
    if (shifted) await expect(page.locator('.mark-menu-tether')).toBeVisible();
    else await expect(page.locator('.mark-menu-tether')).toBeHidden();
    await expect(disc).toHaveCSS('animation-name', 'none');
    expect(await page.locator('.mark-menu-option').evaluateAll(buttons => buttons.every(button => {
      const rect = button.getBoundingClientRect(); return rect.width >= 44 && rect.height >= 44;
    }))).toBeTruthy();
    expect(await page.locator('.mark-menu-option .math').evaluateAll(symbols => symbols.every(symbol => symbol.getBoundingClientRect().width <= 41))).toBeTruthy();
    if (at === 0 && rotation === 0) await page.screenshot({ path: testInfo.outputPath('mark-menu-edge.png'), fullPage: false });
    await gesture.end();
    await expect(cell(page, at)).toHaveAttribute('data-mark', ['a1', 'ia1', '−a1', '−ia1'][rotation]);
    await expect(cell(page, 1)).toHaveAttribute('data-mark', 'a1');
    await page.locator('#touch-undo').tap();
    await expect(cell(page, at)).toHaveAttribute('data-mark', '');
  }
});

test('a shifted menu does not select a non-clear option under a stationary or slightly moving finger', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  for (const at of [0, 15]) {
    const gesture = await beginTouch(page, at);
    await gesture.ready();
    await expect(page.locator('#mark-menu')).toHaveAttribute('data-shifted', 'true');
    await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'pending');
    await expect(page.locator('#mark-menu [aria-pressed="true"]')).toHaveCount(0);
    await gesture.move(3, 2);
    await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'pending');
    await gesture.end();
    await expect(cell(page, at)).toHaveAttribute('data-mark', at === 0 ? 'i' : '');
    await expect(cell(page, at)).toHaveAttribute('data-open', 'false');
    await expect(page.locator('#touch-undo')).toBeDisabled();
  }
});

test('a shifted menu can clear on stationary release when the initial touch is inside the center', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
  puzzle.tiles[2].mark = { basis: 0, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  const gesture = await beginTouch(page, 2);
  await gesture.ready();
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-shifted', 'true');
  const center = (await page.locator('.mark-menu-clear').boundingBox())!;
  const distance = Math.hypot(gesture.x - center.x - center.width / 2, gesture.y - center.y - center.height / 2);
  expect(distance).toBeGreaterThan(0);
  expect(distance).toBeLessThan(center.width / 2);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
  await expect(page.locator('.mark-menu-preview')).toHaveText('松手清除标记');
  await expect(cell(page, 2)).toHaveAttribute('data-mark', 'i');
  await gesture.end();
  await expect(cell(page, 2)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 2)).toHaveAttribute('data-open', 'false');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 2)).toHaveAttribute('data-mark', 'i');
});

test('initial selection uses the touch position when the menu opens, including small movement during the hold', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const marked of [false, true]) {
    const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
    if (marked) puzzle.tiles[1].mark = { basis: 0, rotation: 2 };
    await page.goto('/#cw=' + pack(puzzle));
    const gesture = await beginTouch(page, 1, 'center', { x: 0.8, y: 0.5 });
    await gesture.move(6, 0);
    await gesture.ready();
    const center = (await page.locator('.mark-menu-clear').boundingBox())!;
    const cx = center.x + center.width / 2, cy = center.y + center.height / 2;
    expect(Math.hypot(gesture.x - cx, gesture.y - cy)).toBeGreaterThan(center.width / 2);
    expect(Math.hypot(gesture.x + 6 - cx, gesture.y - cy)).toBeLessThan(center.width / 2);
    await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
    await expect(page.locator('.mark-menu-preview')).toHaveText(marked ? '松手清除标记' : '松手保持未标记');
    await gesture.end();
    await expect(page.locator('#mark-menu')).toBeHidden();
    await expect(gesture.cell).toHaveAttribute('data-mark', '');
    await expect(gesture.cell).toHaveAttribute('data-open', 'false');
    if (marked) {
      await page.locator('#touch-undo').tap();
      await expect(gesture.cell).toHaveAttribute('data-mark', '−1');
    }
    await expect(page.locator('#touch-undo')).toBeDisabled();
  }
});

test('an initial center selection survives small drift across its edge, for empty and marked cells', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const marked of [false, true]) {
    const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
    if (marked) puzzle.tiles[2].mark = { basis: 2, rotation: 3 };
    await page.goto('/#cw=' + pack(puzzle));
    const gesture = await beginTouch(page, 2, 'center', { x: 0.05, y: 0.5 });
    await gesture.ready();
    const center = (await page.locator('.mark-menu-clear').boundingBox())!;
    const cx = center.x + center.width / 2, cy = center.y + center.height / 2;
    expect(Math.hypot(gesture.x - cx, gesture.y - cy)).toBeLessThan(center.width / 2);
    expect(Math.hypot(gesture.x - 6 - cx, gesture.y - cy)).toBeGreaterThan(center.width / 2);
    const message = marked ? '松手清除标记' : '松手保持未标记';
    await expect(page.locator('.mark-menu-preview')).toHaveText(message);
    await gesture.move(-6, 0);
    await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
    await expect(page.locator('.mark-menu-preview')).toHaveText(message);
    await gesture.end();
    await expect(page.locator('#mark-menu')).toBeHidden();
    await expect(gesture.cell).toHaveAttribute('data-mark', '');
    await expect(gesture.cell).toHaveAttribute('data-open', 'false');
    if (marked) {
      await page.locator('#touch-undo').tap();
      await expect(gesture.cell).toHaveAttribute('data-mark', '−ib');
    }
    await expect(page.locator('#touch-undo')).toBeDisabled();
  }
});

test('release commits the displayed center choice even when lift coordinates cross its edge', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const marked of [false, true]) {
    const puzzle = createPuzzle({ columns: 16, rows: 16, mines: 40 });
    if (marked) puzzle.tiles[2].mark = { basis: 0, rotation: 1 };
    await page.goto('/#cw=' + pack(puzzle));
    await cell(page, 2).evaluate(element => element.addEventListener('pointerdown', event => {
      (element as HTMLElement).dataset.testPointer = String((event as PointerEvent).pointerId);
    }, { once: true }));
    const gesture = await beginTouch(page, 2, 'center', { x: 0.05, y: 0.5 });
    await gesture.ready();
    await expect(page.locator('.mark-menu-preview')).toHaveText(marked ? '松手清除标记' : '松手保持未标记');
    // Model a changed final coordinate with no intervening move/preview update.
    await gesture.cell.dispatchEvent('pointerup', {
      pointerType: 'touch', pointerId: Number(await gesture.cell.getAttribute('data-test-pointer')),
      clientX: gesture.x - 10, clientY: gesture.y,
    });
    await gesture.end();
    await expect(page.locator('#mark-menu')).toBeHidden();
    await expect(gesture.cell).toHaveAttribute('data-mark', '');
    await expect(gesture.cell).toHaveAttribute('data-open', 'false');
    if (marked) {
      await page.locator('#touch-undo').tap();
      await expect(gesture.cell).toHaveAttribute('data-mark', 'i');
    }
    await expect(page.locator('#touch-undo')).toBeDisabled();
  }
});

test('after deliberate movement, returning near the start still follows the visible menu regions', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const gesture = await beginTouch(page, 2, 'center', { x: 0.05, y: 0.5 });
  await gesture.ready();
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
  await gesture.choose(2);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', '2');
  await gesture.move(0, 0);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', 'clear');
  await gesture.move(-6, 0);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', '2');
  await gesture.end();
  await expect(gesture.cell).toHaveAttribute('data-mark', '−1');
});

test('a low menu overlays the group toolbar without moving up or activating controls behind it', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#touch-tools').evaluate(el => el.addEventListener('click', () => { el.dataset.clicked = 'true'; }, true));
  const gesture = await beginTouch(page, 248, 'end');
  await gesture.ready();
  const disc = (await page.locator('.mark-menu-disc').boundingBox())!;
  const toolbar = (await page.locator('#touch-tools').boundingBox())!;
  expect(Math.abs(disc.y + disc.height / 2 - gesture.y)).toBeLessThan(1);
  expect(disc.y + disc.height).toBeGreaterThan(toolbar.y + 30);
  expect(disc.y + disc.height).toBeLessThanOrEqual(844);
  expect(await page.locator('#mark-menu').evaluate(el => Number(getComputedStyle(el).zIndex)))
    .toBeGreaterThan(await page.locator('#touch-tools').evaluate(el => Number(getComputedStyle(el).zIndex)));
  const option = (await page.locator('#mark-menu [data-choice="3"]').boundingBox())!;
  expect(option.y + option.height / 2).toBeGreaterThan(toolbar.y);
  await gesture.choose(3);
  await expect(page.locator('#mark-menu')).toHaveAttribute('data-choice', '3');
  await page.screenshot({ path: testInfo.outputPath('mark-menu-over-toolbar.png'), fullPage: false });
  await gesture.end();
  await expect(cell(page, 248)).toHaveAttribute('data-mark', '−i');
  await expect(cell(page, 248)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#touch-group')).toHaveValue('0');
  await expect(page.locator('#touch-merge')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#touch-new-group')).toBeEnabled();
  await expect(page.locator('#touch-tools')).not.toHaveAttribute('data-clicked', 'true');
  await expect(page.locator('#touch-group')).not.toBeFocused();
});

test('a second finger or changed group cancels an open menu without committing a stale choice', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[1].mark = { basis: 1, rotation: 0 };
  await page.goto('/#cw=' + pack(puzzle));
  const multiple = await beginTouch(page, 0);
  await multiple.ready(); await multiple.choose(3);
  await multiple.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { id: 1, x: multiple.x, y: multiple.y + 36 }, { id: 2, x: multiple.x + 50, y: multiple.y },
  ] });
  await expect(page.locator('#mark-menu')).toBeHidden(); await multiple.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');

  const changed = await beginTouch(page, 0);
  await changed.ready(); await changed.choose(1);
  await page.locator('#touch-group').selectOption('1');
  await expect(page.locator('#mark-menu')).toBeHidden(); await changed.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
  await expect(cell(page, 0)).toHaveAttribute('data-open', 'false');
});
