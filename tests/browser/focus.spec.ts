// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import { beginTouch } from './touch-helpers.ts';

test('arrow navigation keeps one board tab stop and respects row boundaries', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-at="0"]').focus();
  for (const [key, at] of [['ArrowRight', 1], ['ArrowDown', 17], ['ArrowLeft', 16], ['ArrowLeft', 16], ['ArrowUp', 0], ['ArrowUp', 0]] as const) {
    await page.keyboard.press(key);
    const target = page.locator(`[data-at="${at}"]`);
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#board [tabindex="0"]')).toHaveCount(1);
  }
});

test('a cancelled mouse press still updates the board tab stop without editing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse focus.');
  await page.goto('/');
  await page.locator('[data-at="0"]').focus();
  const target = page.locator('[data-at="1"]');
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down({ button: 'right' });
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute('tabindex', '0');
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('tabindex', '-1');
  await page.mouse.move(x + 24, y); await page.mouse.move(x, y);
  await page.mouse.up({ button: 'right' });
  await expect(target).toHaveAttribute('data-mark', '');
  await expect(target).toHaveAttribute('data-open', 'false');
});

test('keyboard navigation can return to the already focused cell after a touch drag', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch and keyboard focus.');
  await page.goto('/');
  const origin = page.locator('[data-at="0"]');
  await origin.focus();
  const marking = await beginTouch(page, 1);
  await marking.ready(); await marking.choose(0); await marking.end();
  await expect(marking.cell).toHaveAttribute('data-mark', '1');
  await expect(marking.cell).toHaveAttribute('tabindex', '0');
  await expect(origin).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(origin).toBeFocused();
  await expect(origin).toHaveAttribute('tabindex', '0');
  await expect(marking.cell).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('#board [tabindex="0"]')).toHaveCount(1);
});
