// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseChangeNotes } from './change-notes.ts';

const project = new URL('../', import.meta.url);
const notes = parseChangeNotes(readFileSync(new URL('CHANGELOG.md', project), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('package.json', project), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const contents = notes.entries.map((entry, index) => '<li><a href="#change-' + index + '">' + escape(entry.title) + '</a></li>').join('\n');
const entries = notes.entries.map((entry, index) => '<section><h2 id="change-' + index + '">' + escape(entry.title) + '</h2>' + entry.html + '</section>').join('\n');
const html = [
  '<!doctype html>',
  '<!-- Generated from CHANGELOG.md by tools/build-notes.mjs. -->',
  '<!-- SPDX-FileCopyrightText: 2026 yizhaozhang11; SPDX-License-Identifier: GPL-3.0-only -->',
  '<html lang="zh-CN"><head>',
  '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="description" content="Complexweeper 试玩更新说明、操作变化与使用提醒。">',
  '<title>更新说明 · Complexweeper</title>',
  '<link rel="icon" href="./favicon.svg" type="image/svg+xml">',
  '<link rel="stylesheet" href="./guide.css">',
  '</head><body>',
  '<a class="skip-link" href="#changes-content">跳到更新正文</a>',
  '<header class="site-header"><a class="brand" href="./" target="_blank" rel="noopener noreferrer"><img src="./brand.svg" width="32" height="32" alt="">Complexweeper</a><a class="play-link" href="./guide.html">操作教程 ↗</a></header>',
  '<main class="layout"><nav class="contents" aria-label="更新记录目录"><p>更新记录</p><ol>' + contents + '</ol><p class="version">Web ' + escape(manifest.version) + '</p></nav>',
  '<article id="changes-content">' + notes.introduction + entries + '</article></main>',
  '<footer class="site-footer"><a href="./" target="_blank" rel="noopener noreferrer">打开游戏 ↗</a><a href="./legal/COPYRIGHT.txt">版权与来源</a></footer>',
  '</body></html>',
].join('\n');
mkdirSync(new URL('public/', project), { recursive: true });
writeFileSync(new URL('public/changes.html', project), html, 'utf8');
console.log('Updated change notes page.');
