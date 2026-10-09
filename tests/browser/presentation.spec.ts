// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import type { Quarter } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { longPress } from './touch-helpers.ts';

const roots = [2, 5, 8, 10, 13, 17, 18, 20, 26, 29, 32, 34, 37, 40, 50];

async function endingPosition(page: Page, won: boolean) {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 1 });
  puzzle.stage = 'playing'; puzzle.duration = 65000;
  puzzle.tiles[0].charge = 0;
  puzzle.tiles.forEach((tile, index) => tile.revealed = won ? index !== 0 : index === 10);
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.locator('#resume').click();
}

async function finishWin(page: Page, mobile: boolean) {
  if (mobile) await longPress(page, 0);
  else await page.locator('[data-at="0"]').click({ button: 'right' });
}

async function canvasHasPaint(page: Page) {
  return page.locator('#ending-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) return true;
    return false;
  });
}

test('all fifteen roots keep stable proportions and fit desktop and touch tiles', async ({ page, request, isMobile }) => {
  const charges: [number, Quarter][] = [], centers: number[] = [];
  const model = createPuzzle({ columns: 20, rows: 12, mines: 1 });
  roots.forEach((square, index) => {
    const center = (Math.floor(index / 5) * 4 + 2) * 20 + index % 5 * 4 + 2;
    centers.push(center);
    let real = 0, imaginary = 0;
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8 - a; b++) if (a * a + b * b === square) { real = a; imaginary = b; }
    model.adjacent[center].slice(0, real + imaginary).forEach((at, ordinal) => charges.push([at, ordinal < real ? 0 : 1]));
  });
  const puzzle = createPuzzle({ columns: 20, rows: 12, mines: charges.length });
  puzzle.stage = 'playing';
  charges.forEach(([at, charge]) => puzzle.tiles[at].charge = charge);
  centers.forEach(at => puzzle.tiles[at].revealed = true);
  puzzle.tiles[0].revealed = true;
  await page.goto(`/#cw=${pack(puzzle)}`);
  await page.locator('#resume').click();
  await expect(page.locator('.radical-clue')).toHaveCount(15);
  await expect(page.locator('.tile math')).toHaveCount(0);
  const sizes = await page.locator('.radical-clue').evaluateAll(elements => elements.map(svg => {
    const box = svg.getBoundingClientRect(), cell = svg.closest('.tile')!.getBoundingClientRect();
    return { width: box.width, height: box.height, fits: box.width <= cell.width - 3 && box.height < cell.height - 8 };
  }));
  expect(sizes.every(size => size.fits && size.height > 9 && size.height < 17)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await page.locator('.brand-symbol').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  expect(await (await request.get('/brand.svg')).text()).toBe(await (await request.get('/favicon.svg')).text());
  await page.screenshot({ path: `.cache/roots-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
});

test('win scene draws confetti and halo, then a new game removes every effect', async ({ page, isMobile }) => {
  await endingPosition(page, true);
  await finishWin(page, isMobile);
  await expect(page.locator('#outcome')).toHaveAttribute('data-result', 'win');
  await expect(page.locator('.success-icon')).toBeVisible();
  await expect(page.locator('.failure-icon')).toBeHidden();
  await expect.poll(() => canvasHasPaint(page)).toBeTruthy();
  await page.waitForTimeout(380);
  await page.screenshot({ path: `.cache/win-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
  await page.locator('#restart').click();
  await expect(page.locator('#outcome')).toBeHidden();
  await expect(page.locator('#ending-canvas')).toBeHidden();
  await expect(page.locator('#board-frame')).not.toHaveClass(/finish-/);
});

test('loss wave is temporary, leaves a neutral impact marker and does not replay on review', async ({ page, isMobile }) => {
  await endingPosition(page, false);
  await page.locator('[data-at="0"]').click();
  await expect(page.locator('#outcome')).toHaveAttribute('data-result', 'loss');
  await expect(page.locator('.failure-icon')).toBeVisible();
  await expect.poll(() => canvasHasPaint(page)).toBeTruthy();
  await page.waitForTimeout(280);
  await page.screenshot({ path: `.cache/loss-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
  await expect(page.locator('#outcome')).toBeHidden();
  await expect(page.locator('#ending-canvas')).toBeHidden();
  await expect(page.locator('[data-at="0"]')).toHaveCSS('background-color', 'rgb(211, 211, 211)');
  await page.locator('#review-field').click();
  await expect(page.locator('#outcome')).toBeHidden();
});

test('reduced motion keeps both result badges but omits moving effects', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const won of [true, false]) {
    await endingPosition(page, won);
    if (won) await finishWin(page, isMobile); else await page.locator('[data-at="0"]').click();
    await expect(page.locator('#outcome')).toBeVisible();
    await expect(page.locator('#ending-canvas')).toBeHidden();
    await expect(page.locator('#outcome')).toHaveCSS('animation-name', 'none');
  }
});
