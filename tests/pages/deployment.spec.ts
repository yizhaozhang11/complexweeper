// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('production assets and shared games work from a repository subdirectory', async ({ page, request, isMobile }, testInfo) => {
  const errors: string[] = [];
  const watch = (target: Page) => {
    target.on('pageerror', error => errors.push(error.message));
    target.on('requestfailed', req => errors.push(req.url() + ': ' + req.failure()?.errorText));
    target.on('response', response => { if (response.status() >= 400) errors.push(response.url() + ': ' + response.status()); });
  };
  watch(page);
  await page.goto('./');
  await expect(page.locator('#updates-dialog')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(page.getByRole('gridcell')).toHaveCount(256);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('20px "LM Math"'))).toBeTruthy();
  expect(await page.locator('.brand-symbol').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  const prefix = new URL(testInfo.project.use.baseURL!).pathname;
  for (const asset of ['favicon.svg', 'brand.svg', 'guide.html', 'guide.css', 'changes.html', 'fonts/latinmodern-math.otf', 'fonts/NOTICE.md', 'fonts/GUST-FONT-LICENSE.txt', 'legal/GPL-3.0.txt', 'legal/COPYRIGHT.txt', 'source.tgz']) {
    const response = await request.get('./' + asset);
    expect(response.status(), asset).toBe(200);
    expect(new URL(response.url()).pathname).toBe(prefix + asset);
    expect(await response.body(), asset).toEqual(readFileSync(new URL('../../dist/' + asset, import.meta.url)));
  }

  const guidePromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: '教程', exact: true }).click();
  const guide = await guidePromise;
  watch(guide);
  await guide.waitForLoadState('load');
  expect(new URL(guide.url()).pathname).toBe(prefix + 'guide.html');
  await expect(guide.locator('article h1')).toBeVisible();
  expect(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await guide.locator('.contents a').evaluateAll(links => links.length > 0 && links.every(link => {
    const fragment = link.getAttribute('href')!.slice(1);
    return document.getElementById(decodeURIComponent(fragment)) !== null;
  }))).toBeTruthy();
  expect(new URL(await guide.locator('.play-link').evaluate((link: HTMLAnchorElement) => link.href)).pathname).toBe(prefix);
  await guide.screenshot({ path: testInfo.outputPath('guide.png'), fullPage: false });
  await guide.locator('.contents a').first().click();
  expect(new URL(guide.url()).hash).not.toBe('');
  await guide.close();

  await page.getByRole('button', { name: '关于', exact: true }).click();
  const legalLink = page.locator('#about-dialog a[href$="COPYRIGHT.txt"]');
  expect(new URL(await legalLink.evaluate((link: HTMLAnchorElement) => link.href)).pathname).toBe(prefix + 'legal/COPYRIGHT.txt');
  await page.screenshot({ path: testInfo.outputPath('about.png'), fullPage: true });
  await page.locator('#about-dialog [data-close]').click();

  if (isMobile) await page.locator('[data-at="0"]').tap();
  else await page.locator('[data-at="0"]').click();
  await expect(page.locator('[data-at="0"]')).toHaveAttribute('data-open', 'true');
  await page.locator('#share').click();
  const url = await page.locator('#share-url').inputValue();
  expect(new URL(url).pathname).toBe(prefix);
  expect(new URL(url).hash).toMatch(/^#cw=/);

  const receiver = await page.context().newPage();
  watch(receiver);
  await receiver.goto(url);
  await expect(receiver.locator('#resume')).toBeVisible();
  await receiver.locator('#resume').click();
  await expect(receiver.locator('[data-at="0"]')).toHaveAttribute('data-open', 'true');
  expect(errors).toEqual([]);
});
