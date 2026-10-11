// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run after checks and before uploading the Pages artifact. The site token stays
// in deployment configuration; authoring files and source.tgz remain unchanged.
const token = process.env.CW_WEB_ANALYTICS_TOKEN?.trim();
if (!token) {
  console.log('Cloudflare Web Analytics is not configured; keeping the site unchanged.');
} else {
  if (!/^[a-f0-9]{32}$/i.test(token)) throw new Error('CW_WEB_ANALYTICS_TOKEN must be a 32-character hexadecimal site token.');
  const snippet = '<!-- Cloudflare Web Analytics -->\n' +
    `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token, spa: false })}'></script>\n` +
    '<!-- End Cloudflare Web Analytics -->';
  const existing = /<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->\s*/g;
  const pages = ['index.html', 'guide.html', 'changes.html'].map(name => {
    const path = resolve('dist', name);
    const html = readFileSync(path, 'utf8').replace(existing, '');
    if (!html.includes('</body>')) throw new Error(`Cannot inject analytics into ${name}: missing </body>.`);
    return { path, html: html.replace('</body>', snippet + '\n</body>') };
  });
  for (const page of pages) writeFileSync(page.path, page.html, 'utf8');
  console.log(`Added Cloudflare Web Analytics to ${pages.length} deployment pages.`);
}
