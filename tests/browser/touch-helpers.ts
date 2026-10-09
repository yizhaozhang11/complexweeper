// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function beginTouch(page: Page, at: number) {
  const cell = page.locator('[data-at="' + at + '"]');
  await cell.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center' }));
  // A preceding drag can leave native scrolling in flight and legitimately cancel
  // the next hold. Start each independent gesture only once scrolling has settled.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => {
      let timer = 0;
      const finish = () => { document.removeEventListener('scroll', settle, true); resolve(); };
      const settle = () => { clearTimeout(timer); timer = window.setTimeout(finish, 150); };
      document.addEventListener('scroll', settle, true);
      requestAnimationFrame(() => requestAnimationFrame(settle));
    });
  });
  const box = (await cell.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
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
