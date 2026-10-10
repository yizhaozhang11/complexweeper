// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { beginTouch } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator(`[data-at="${at}"]`);

test('the marking preference is touch-only and defaults to the sliding menu', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await expect(page.locator('#touch-marking-preference')).toBeVisible();
    await expect(page.getByLabel('标记方式', { exact: true })).toHaveValue('menu');
    await expect(page.getByRole('switch', { name: '点按轮换标记', exact: true })).toBeChecked();
  } else {
    await expect(page.locator('#touch-marking-preference')).toBeHidden();
    await expect(page.locator('#touch-tap-cycle-preference')).toBeHidden();
  }
});

test.describe('touch marking preferences', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'Touch marking preference.'));

  test('direct marking places the selected group and clears on release, with cycling, cancellation and undo', async ({ page }) => {
    const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
    puzzle.tiles[1].mark = { basis: 1, rotation: 0 };
    puzzle.tiles[2].mark = { basis: 2, rotation: 3 };
    await page.goto('/#cw=' + pack(puzzle));
    await page.locator('#touch-marking').selectOption('direct');
    await page.locator('#touch-group').selectOption('1');

    const place = await beginTouch(page, 0);
    await place.ready();
    await expect(page.locator('#mark-menu')).toBeHidden();
    await expect(page.locator('#touch-status')).toHaveText('松手标记 a');
    await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
    await place.end();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', 'a');
    await cell(page, 0).tap();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', 'ia');

    const clear = await beginTouch(page, 0);
    await clear.ready();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', 'ia');
    await expect(page.locator('#touch-status')).toHaveText('松手清除标记');
    await clear.end(); await cell(page, 0).dispatchEvent('click');
    await expect(cell(page, 0)).toHaveAttribute('data-mark', '');
    await expect(cell(page, 0)).toHaveAttribute('data-open', 'false');
    await page.locator('#touch-undo').tap();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', 'ia');

    await cell(page, 2).tap();
    await expect(cell(page, 2)).toHaveAttribute('data-mark', '−ia');
    await page.locator('#touch-undo').tap();
    const otherGroup = await beginTouch(page, 2);
    await otherGroup.ready(); await otherGroup.end();
    await expect(cell(page, 2)).toHaveAttribute('data-mark', '');
    await page.locator('#touch-undo').tap();
    await expect(cell(page, 2)).toHaveAttribute('data-mark', '−ib');

    await cell(page, 3).press('Shift+Enter');
    await expect(cell(page, 3)).toHaveAttribute('data-mark', 'a');
    await expect(page.locator('#mark-menu')).toBeHidden();
    await cell(page, 3).press('Shift+Space');
    await expect(cell(page, 3)).toHaveAttribute('data-mark', '');
    const drag = await beginTouch(page, 3);
    await drag.ready();
    const before = await page.evaluate(() => scrollY);
    await drag.move(0, -12); await drag.move(0, -50); await drag.end();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await expect(cell(page, 3)).toHaveAttribute('data-mark', '');
    await expect(cell(page, 3)).toHaveAttribute('data-open', 'false');

    await page.locator('#touch-marking').selectOption('menu');
    await expect(page.locator('#touch-group')).toHaveValue('1');
    const menu = await beginTouch(page, 3);
    await menu.ready(); await menu.choose(3); await menu.end();
    await expect(cell(page, 3)).toHaveAttribute('data-mark', '−ia');
  });

  test('the choice survives reloads independently of hints and expansion', async ({ page }) => {
    await page.goto('/');
    await page.locator('#touch-marking').selectOption('direct');
    await page.locator('#hints').uncheck(); await page.locator('#expansion').uncheck();
    await page.reload();
    await expect(page.locator('#touch-marking')).toHaveValue('direct');
    await expect(page.locator('#hints')).not.toBeChecked();
    await expect(page.locator('#expansion')).not.toBeChecked();
    await expect(page.locator('#touch-marking-note')).toContainText('已有标记则清除');
    await page.locator('#touch-marking').selectOption('menu');
    await page.reload();
    await expect(page.locator('#touch-marking')).toHaveValue('menu');
    await expect(page.locator('#hints')).not.toBeChecked();
  });

  test('changing the mode cancels open menus and direct holds without editing the board', async ({ page }) => {
    const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
    puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
    await page.goto('/#cw=' + pack(puzzle));
    const changeMode = (mode: string) => page.locator('#touch-marking').evaluate((select: HTMLSelectElement, mode) => {
      select.value = mode; select.dispatchEvent(new Event('change', { bubbles: true }));
    }, mode);

    for (const next of ['direct', 'menu']) {
      const gesture = await beginTouch(page, 0);
      await gesture.ready();
      if (next === 'direct') await gesture.choose(3);
      await changeMode(next);
      await expect(page.locator('#mark-menu')).toBeHidden();
      await gesture.end();
      await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
      await expect(cell(page, 0)).toHaveAttribute('data-open', 'false');
      await expect(page.locator('#touch-undo')).toBeDisabled();
    }
    const pending = await beginTouch(page, 0);
    await changeMode('direct'); await pending.end();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
    await changeMode('menu');
    await cell(page, 0).press('Shift+Enter');
    await expect(page.locator('#mark-menu')).toBeVisible();
    await changeMode('direct');
    await expect(page.locator('#mark-menu')).toBeHidden();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  });

  test('blocked storage still allows switching and using direct marking', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
    }));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#touch-marking')).toHaveValue('menu');
    await page.locator('#touch-tap-cycle').uncheck();
    await page.locator('#touch-marking').selectOption('direct');
    const gesture = await beginTouch(page, 0);
    await gesture.ready(); await gesture.end();
    await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
    await expect(page.locator('#mark-menu')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
