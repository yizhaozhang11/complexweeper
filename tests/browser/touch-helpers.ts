// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function beginTouch(page: Page, at: number) {
  const cell = page.locator('[data-at="' + at + '"]');
  await cell.evaluate(async element => {
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
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await settled();
  });
  const box = (await cell.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  expect(await page.evaluate(({ x, y }) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-at]')?.dataset.at, { x, y })).toBe(String(at));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
  const finish = async (type: 'touchEnd' | 'touchCancel') => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [] });
    await cdp.detach();
  };
  return {
    cell, cdp, x, y,
    ready: () => expect(cell).toHaveClass(/touch-hold-ready/),
    move: (dx: number, dy: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x + dx, y: y + dy }] }),
    end: () => finish('touchEnd'),
    cancel: () => finish('touchCancel'),
  };
}

export async function longPress(page: Page, at: number): Promise<void> {
  const gesture = await beginTouch(page, at);
  await gesture.ready();
  await gesture.end();
}
