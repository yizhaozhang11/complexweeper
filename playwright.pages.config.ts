// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  timeout: 20000,
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  outputDir: 'test-results/pages',
  use: {
    baseURL: 'http://127.0.0.1:4174/pages-check/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'touch', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4174 --strictPort --base=/pages-check/',
    url: 'http://127.0.0.1:4174/pages-check/',
    reuseExistingServer: false,
  },
});
