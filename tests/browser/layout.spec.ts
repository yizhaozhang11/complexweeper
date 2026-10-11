// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';

test.beforeEach(({ isMobile }) => test.skip(isMobile, 'Desktop sidebar layout.'));

const layout = (page: Page) => page.evaluate(() => {
  const play = document.querySelector('.play-space')!.getBoundingClientRect();
  const tools = document.querySelector('.sidebar')!.getBoundingClientRect();
  const scroll = document.getElementById('board-scroll')!;
  return {
    position: tools.top >= play.bottom ? 'below' : tools.left >= play.right ? 'right' : 'overlap',
    boardScrolls: scroll.scrollWidth > scroll.clientWidth,
    pageOverflows: document.documentElement.scrollWidth > innerWidth,
  };
});

test('wide boards move grouping tools below and use the full row while keeping group edits usable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(() => layout(page)).toEqual({ position: 'right', boardScrolls: false, pageOverflows: false });
  await page.locator('#preset').selectOption('2');
  await expect.poll(() => layout(page)).toEqual({ position: 'below', boardScrolls: false, pageOverflows: false });
  await expect(page.locator('#grouping')).toBeChecked();
  await expect(page.locator('#group-tools')).toBeVisible();
  await expect(page.locator('#quick-undo')).toBeHidden();
  await page.locator('[data-at="0"]').click({ button: 'right' });
  await page.locator('[data-at="1"]').click({ button: 'middle' });
  await page.locator('[data-at="1"]').click({ button: 'right' });
  await page.locator('#rotate').click();
  await expect(page.locator('[data-at="1"]')).toHaveAttribute('data-mark', 'ia');
  await page.locator('#undo').click();
  await expect(page.locator('[data-at="1"]')).toHaveAttribute('data-mark', 'a');
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(() => layout(page)).toEqual({ position: 'below', boardScrolls: true, pageOverflows: false });
  await page.locator('[data-at="31"]').click({ button: 'right' });
  await expect(page.locator('[data-at="31"]')).toHaveAttribute('data-mark', 'a');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => layout(page)).toEqual({ position: 'below', boardScrolls: false, pageOverflows: false });
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-mark', '1');
  await expect(page.locator('[data-at="1"]')).toHaveAttribute('data-mark', 'a');
  await page.screenshot({ path: testInfo.outputPath('wide-board-tools-below.png'), fullPage: true });
  await page.locator('#preset').selectOption('0');
  await expect.poll(() => layout(page)).toEqual({ position: 'right', boardScrolls: false, pageOverflows: false });
  expect(errors).toEqual([]);
});

test('custom shared boards and viewport width or height changes recalculate placement without losing selection or undo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const puzzle = createPuzzle({ columns: 28, rows: 8, mines: 40 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 3 };
  await page.goto('/#cw=' + pack(puzzle));
  await expect(page.locator('#preset')).toHaveValue('custom');
  await expect.poll(() => layout(page)).toEqual({ position: 'below', boardScrolls: false, pageOverflows: false });
  await page.locator('[data-at="0"]').click({ button: 'middle' });
  await page.keyboard.press('i');
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-mark', 'a');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => layout(page)).toEqual({ position: 'right', boardScrolls: false, pageOverflows: false });
  await expect(page.locator('#group-symbol')).toHaveText('𝑎');
  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-mark', '−ia');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => layout(page)).toEqual({ position: 'below', boardScrolls: false, pageOverflows: false });
  await page.locator('#preset').selectOption('1');
  for (const [width, position] of [[820, 'below'], [821, 'right'], [820, 'below'], [900, 'right']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => layout(page)).toEqual({ position, boardScrolls: false, pageOverflows: false });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect((await layout(page)).position).toBe(position);
  }
  expect(errors).toEqual([]);
});
