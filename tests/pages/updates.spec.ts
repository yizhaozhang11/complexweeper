// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';

test('a new deployment is acknowledged once and manual viewing preserves a paused game', async ({ page, isMobile }, testInfo) => {
  await page.goto('./');
  const dialog = page.locator('#updates-dialog');
  await expect(dialog).toBeVisible();
  const deployment = await dialog.getAttribute('data-deployment-id');
  expect(deployment).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('update-notice.png'), fullPage: false });

  const recordsPromise = page.waitForEvent('popup');
  await dialog.getByRole('link', { name: '完整更新记录 ↗', exact: true }).click();
  const records = await recordsPromise;
  await records.waitForLoadState('load');
  expect(new URL(records.url()).pathname).toBe(new URL(testInfo.project.use.baseURL!).pathname + 'changes.html');
  await expect(records.locator('article h1')).toBeVisible();
  expect(await records.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await records.locator('.contents a').evaluateAll(links => links.every(link =>
    document.getElementById(link.getAttribute('href')!.slice(1)) !== null))).toBeTruthy();
  await records.screenshot({ path: testInfo.outputPath('change-notes.png'), fullPage: false });
  await records.close();

  await dialog.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('gridcell')).toHaveCount(256);
  await expect(dialog).toBeHidden();

  const secondTab = await page.context().newPage();
  await secondTab.goto(page.url());
  await expect(secondTab.getByRole('gridcell')).toHaveCount(256);
  await expect(secondTab.locator('#updates-dialog')).toBeHidden();
  await secondTab.close();

  if (isMobile) await page.locator('[data-at="0"]').tap();
  else await page.locator('[data-at="0"]').click();
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-open', 'true');
  await page.getByRole('button', { name: '更新', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#state')).toHaveText('已暂停');
  await dialog.getByRole('button', { name: '关闭更新说明', exact: true }).click();
  await page.locator('#resume').click();
  await expect(page.locator('#state')).toHaveText('进行中');
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-open', 'true');
});

test('the first update notice preserves an imported game and its paused clock', async ({ page }) => {
  const puzzle = createPuzzle({ columns: 5, rows: 5, mines: 1 });
  puzzle.tiles[0].charge = 0;
  puzzle.tiles[0].mark = { basis: 2, rotation: 1 };
  puzzle.tiles[6].revealed = true;
  puzzle.stage = 'playing';
  puzzle.duration = 42000;
  await page.goto('./#cw=' + pack(puzzle));
  await expect(page.locator('#updates-dialog')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  // Pausing intentionally hides the board from interaction and the accessibility tree.
  await expect(page.locator('#board [role="gridcell"]')).toHaveCount(25);
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-mark', 'ib');
  await expect(page.locator('[data-at="6"]')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#time')).toHaveText('00:42');
  await expect(page.locator('#resume')).toBeVisible();
  await page.locator('#resume').click();
  await expect(page.locator('#state')).toHaveText('进行中');
  await expect(page.getByRole('gridcell')).toHaveCount(25);
});

test('reading an older deployment or another repository does not hide the current update', async ({ page }, testInfo) => {
  await page.goto('./');
  const dialog = page.locator('#updates-dialog');
  await expect(dialog).toBeVisible();
  const deployment = (await dialog.getAttribute('data-deployment-id'))!;
  const version = await dialog.getAttribute('data-version');
  await dialog.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(dialog).toBeHidden();
  const key = await page.evaluate(id => Object.keys(localStorage).find(key => key.endsWith(':' + id))!, deployment);
  expect(key).toBeTruthy();

  await page.evaluate(({ key, deployment }) => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(key);
      storage.setItem(key.slice(0, -deployment.length) + 'previous-deployment', 'read');
    }
  }, { key, deployment });
  await page.reload();
  await expect(dialog).toBeVisible();
  expect(await dialog.getAttribute('data-version')).toBe(version);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const prefix = new URL(testInfo.project.use.baseURL!).pathname;
  expect(key).toContain(prefix);
  await page.evaluate(({ key, prefix }) => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(key);
      storage.setItem(key.replace(prefix, '/another-repository/'), 'read');
    }
  }, { key, prefix });
  await page.reload();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '知道了', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('gridcell')).toHaveCount(256);
  await expect(dialog).toBeHidden();
});

test('session storage remembers acknowledgement when persistent storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Blocked for this test', 'SecurityError'); },
    });
  });
  await page.goto('./');
  const dialog = page.locator('#updates-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '知道了', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('gridcell')).toHaveCount(256);
  await expect(dialog).toBeHidden();
});

test('blocked storage never prevents dismissing the notice or playing', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => { throw new DOMException('Blocked for this test', 'SecurityError'); },
      });
    }
  });
  await page.goto('./');
  const dialog = page.locator('#updates-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(dialog).toBeHidden();
  if (isMobile) await page.locator('[data-at="0"]').tap();
  else await page.locator('[data-at="0"]').click();
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-open', 'true');
  expect(errors).toEqual([]);
});
