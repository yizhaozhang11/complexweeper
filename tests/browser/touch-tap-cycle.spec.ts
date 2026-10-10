// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { beginTouch } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator(`[data-at="${at}"]`);
test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'Touch menu tap behavior.'));

test('disabled cycling only reassigns groups on tap; the menu replaces group and coefficient in one edit', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 2, rotation: 3 };
  puzzle.tiles[2].mark = { basis: 2, rotation: 1 };
  await page.goto('/#cw=' + pack(puzzle));
  await page.locator('#touch-tap-cycle').uncheck();
  for (const [basis, mark] of [['1', '−ia'], ['0', '−i']]) {
    await page.locator('#touch-group').selectOption(basis);
    await cell(page, 1).tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', mark);
    await cell(page, 1).tap(); await cell(page, 1).press('Enter');
    await expect(cell(page, 1)).toHaveAttribute('data-mark', mark);
    await expect(cell(page, 2)).toHaveAttribute('data-mark', 'ib');
    await expect(page.locator('#touch-group')).toHaveValue(basis);
    await page.locator('#touch-undo').tap();
    await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
    await expect(page.locator('#touch-undo')).toBeDisabled();
  }

  await page.locator('#touch-group').selectOption('1');
  await cell(page, 0).tap();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'a');
  await expect(page.locator('#touch-undo')).toBeDisabled();
  const menu = await beginTouch(page, 1);
  await menu.ready(); await menu.choose(1);
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
  await menu.end();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'ia');
  await page.locator('#touch-undo').tap();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
  await expect(page.locator('#touch-undo')).toBeDisabled();

  const cancelled = await beginTouch(page, 1);
  await cancelled.ready(); await cancelled.choose(2); await cancelled.moveInMenu(0, 140); await cancelled.end();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', '−ib');
  await expect(cell(page, 1)).toHaveAttribute('data-open', 'false');
  await expect(page.locator('#touch-undo')).toBeDisabled();
});

test('the menu-only switch persists, does not alter direct marking, and can restore tap cycling', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  await page.goto('/#cw=' + pack(puzzle));
  const toggle = page.getByRole('switch', { name: '点按轮换标记', exact: true });
  await expect(toggle).toBeChecked(); await toggle.uncheck();
  await page.reload(); await expect(toggle).not.toBeChecked();
  await page.locator('#touch-marking').selectOption('direct');
  await expect(page.locator('#touch-tap-cycle-preference')).toBeHidden();
  await cell(page, 0).tap();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'i');
  await page.locator('#touch-undo').tap();
  await page.locator('#touch-marking').selectOption('menu');
  await expect(toggle).toBeVisible(); await expect(toggle).not.toBeChecked();
  await cell(page, 0).tap();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  await expect(page.locator('#touch-undo')).toBeDisabled();
  await toggle.check(); await cell(page, 0).tap();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', 'i');
  await page.reload(); await expect(toggle).toBeChecked();
});

test('changing tap cycling cancels an in-flight tap and an open menu without committing', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 9, rows: 9, mines: 10 });
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  await page.goto('/#cw=' + pack(puzzle));
  const setCycling = (checked: boolean) => page.locator('#touch-tap-cycle').evaluate((input: HTMLInputElement, checked) => {
    input.checked = checked; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked);
  await setCycling(false);
  const tap = await beginTouch(page, 0);
  await setCycling(true); await tap.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  const menu = await beginTouch(page, 0);
  await menu.ready(); await menu.choose(3); await setCycling(false);
  await expect(page.locator('#mark-menu')).toBeHidden(); await menu.end();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
  await expect(page.locator('#touch-undo')).toBeDisabled();
  await cell(page, 0).press('Shift+Enter');
  await expect(page.locator('#mark-menu')).toBeVisible();
  await setCycling(true);
  await expect(page.locator('#mark-menu')).toBeHidden();
  await expect(cell(page, 0)).toHaveAttribute('data-mark', '1');
});
