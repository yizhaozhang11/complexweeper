// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function beginTouch(page: Page, at: number) {
  await page.evaluate(() => {
    const debug = window as Window & { touchTestEvents?: unknown[] };
    if (debug.touchTestEvents) return;
    const events = debug.touchTestEvents = [] as unknown[];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'scroll']) {
      document.addEventListener(type, event => {
        const tile = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-at]') : null;
        events.push({ type, at: tile?.dataset.at, time: Math.round(event.timeStamp),
          pointer: event instanceof PointerEvent ? [event.pointerId, event.pointerType, event.isPrimary, event.clientX, event.clientY] : undefined,
          touches: event instanceof TouchEvent ? event.touches.length : undefined,
          scroll: [scrollX, scrollY, document.getElementById('board-scroll')?.scrollLeft],
          status: document.getElementById('touch-status')?.textContent,
        });
        if (events.length > 60) events.shift();
      }, { capture: true, passive: true });
    }
  });
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
    ready: async () => {
      try { await expect(cell).toHaveClass(/touch-hold-ready/); }
      catch (error) {
        console.log('Touch events before failed hold:', JSON.stringify(await page.evaluate(() =>
          (window as Window & { touchTestEvents?: unknown[] }).touchTestEvents)));
        throw error;
      }
    },
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
