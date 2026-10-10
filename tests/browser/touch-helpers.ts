// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function beginTouch(page: Page, at: number, block: ScrollLogicalPosition = 'center', point = { x: 0.5, y: 0.5 }) {
  const cell = page.locator('[data-at="' + at + '"]');
  await cell.evaluate(async (element, block) => {
    await document.fonts.ready;
    const settled = () => new Promise<void>(resolve => {
      let timer = 0;
      const finish = () => { document.removeEventListener('scroll', settle, true); resolve(); };
      const settle = () => { clearTimeout(timer); timer = window.setTimeout(finish, 150); };
      document.addEventListener('scroll', settle, true);
      requestAnimationFrame(() => requestAnimationFrame(settle));
    });
    // Finish the previous drag's momentum before repositioning the target;
    // otherwise the browser can scroll it out of view again before touchStart.
    await settled();
    element.scrollIntoView({ block, inline: 'center', behavior: 'instant' });
    await settled();
  }, block);
  const box = (await cell.boundingBox())!;
  const x = box.x + box.width * point.x, y = box.y + box.height * point.y;
  expect(await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-at]')?.dataset.at, { x, y })).toBe(String(at));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
  const finish = async (type: 'touchEnd' | 'touchCancel') => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [] });
    await cdp.detach();
  };
  const moveTo = (nextX: number, nextY: number) => cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ id: 1, x: nextX, y: nextY }],
  });
  return {
    cell, cdp, x, y,
    ready: () => expect(cell).toHaveClass(/touch-hold-ready/),
    move: (dx: number, dy: number) => moveTo(x + dx, y + dy),
    moveInMenu: async (dx: number, dy: number) => {
      const bounds = (await page.locator('.mark-menu-disc').boundingBox())!;
      await moveTo(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy);
    },
    choose: async (choice: 0 | 1 | 2 | 3 | 'clear') => {
      const bounds = (await page.locator(`#mark-menu [data-choice="${choice}"]`).boundingBox())!;
      const nextX = bounds.x + bounds.width / 2, nextY = bounds.y + bounds.height / 2;
      // When an option appeared under the finger, deliberately move within it
      // before returning to its center rather than simulating a stationary release.
      if (await page.locator('#mark-menu').getAttribute('data-choice') === 'pending' && Math.hypot(nextX - x, nextY - y) <= 8) {
        await moveTo(nextX, nextY + 12);
      }
      await moveTo(nextX, nextY);
    },
    end: () => finish('touchEnd'),
    cancel: () => finish('touchCancel'),
  };
}

export async function longPress(page: Page, at: number): Promise<void> {
  const gesture = await beginTouch(page, at);
  await gesture.ready();
  if (await gesture.cell.getAttribute('data-open') === 'false') {
    await gesture.choose(await gesture.cell.getAttribute('data-mark') === '' ? 0 : 'clear');
  }
  await gesture.end();
}
