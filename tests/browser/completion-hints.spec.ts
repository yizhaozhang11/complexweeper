// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createPuzzle } from '../../src/puzzle.ts';
import { pack } from '../../src/snapshot.ts';
import { longPress } from './touch-helpers.ts';

const cell = (page: Page, at: number) => page.locator(`[data-at="${at}"]`);

function closingPosition(allSafeOpen: boolean) {
  const puzzle = createPuzzle({ columns: 5, rows: 5, mines: 3 });
  puzzle.tiles[0].charge = 0;
  puzzle.tiles[1].charge = 1;
  puzzle.tiles[24].charge = 0;
  puzzle.tiles[0].mark = { basis: 0, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 0, rotation: 0 };
  puzzle.tiles.forEach((tile, at) => tile.revealed = tile.charge === null && (allSafeOpen || at !== 23));
  puzzle.stage = 'playing'; puzzle.duration = 65000;
  return pack(puzzle);
}

test('only the final marking phase highlights unmet clues, tracking repairs, undo and completion', async ({ page, isMobile }) => {
  await page.goto('/#cw=' + closingPosition(false));
  await page.locator('#resume').click();
  const unmet = page.locator('.tile.unmet-clue');
  await expect(unmet).toHaveCount(0);
  if (isMobile) await cell(page, 23).tap(); else await cell(page, 23).click();
  await expect(page.locator('#state')).toHaveText('待满足线索');
  await expect(unmet).toHaveCount(5);
  // Two sqrt(2) clues have the wrong phase sum; three single clues lack a mark.
  for (const at of [5, 6, 18, 19, 23]) await expect(cell(page, at)).toHaveAccessibleName(/线索未满足/);
  for (const at of [0, 2, 12]) await expect(cell(page, at)).not.toHaveClass(/unmet-clue/);
  // Keep drawing attention after the old two-cycle cue would have finished.
  await expect.poll(() => cell(page, 5).evaluate(element => element.getAnimations().some(animation =>
    animation.playState === 'running' && Number(animation.currentTime) > 4000)), { timeout: 7000 }).toBe(true);
  await expect(unmet).toHaveCount(5);
  await page.screenshot({ path: `.cache/unmet-clues-${isMobile ? 'touch' : 'desktop'}.png`, fullPage: true });

  const repairPhase = async () => {
    if (isMobile) await cell(page, 1).tap(); else await cell(page, 1).click({ button: 'right' });
  };
  await repairPhase();
  await expect(cell(page, 1)).toHaveAttribute('data-mark', 'i');
  await expect(unmet).toHaveCount(3);
  await expect(cell(page, 5)).toHaveClass(/satisfied/);
  await page.locator(isMobile ? '#touch-undo' : '#undo').click();
  await expect(unmet).toHaveCount(5);
  await repairPhase();
  if (isMobile) await longPress(page, 24); else await cell(page, 24).click({ button: 'right' });
  await expect(page.locator('#state')).toHaveText('全部解开');
  await expect(unmet).toHaveCount(0);
});

test('closing hints respect pause, hint preferences and reduced motion, including without group tools', async ({ page }) => {
  await page.goto('/#cw=' + closingPosition(true));
  const unmet = page.locator('.tile.unmet-clue');
  await expect(unmet).toHaveCount(0);
  await page.locator('#resume').click();
  await expect(unmet).toHaveCount(5);
  await page.locator('#hints').uncheck();
  await expect(unmet).toHaveCount(0);
  await page.locator('#hints').check();
  await expect(unmet).toHaveCount(5);
  await page.locator('#pause').click();
  await expect(unmet).toHaveCount(0);
  await page.locator('#resume').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(unmet).toHaveCount(5);
  await expect(cell(page, 5)).toHaveCSS('animation-name', 'none');
  await page.locator('#grouping').uncheck();
  await expect(unmet).toHaveCount(5);
  await expect(page.locator('#touch-tools')).toBeHidden();
  await page.locator('#restart').click();
  await expect(unmet).toHaveCount(0);
});
