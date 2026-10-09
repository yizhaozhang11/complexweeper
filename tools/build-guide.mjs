// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const project = new URL('../', import.meta.url);
const markdown = readFileSync(new URL('GUIDE.md', project), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('package.json', project), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const chapters = [];
const usedIds = new Map();
const parser = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const stem = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
      const count = usedIds.get(stem) || 0;
      usedIds.set(stem, count + 1);
      const id = stem + (count ? '-' + count : '');
      if (depth === 2) chapters.push({ id, text });
      return '<h' + depth + ' id="' + escape(id) + '">' + this.parser.parseInline(tokens) + '</h' + depth + '>\n';
    },
  },
});
// The input is the repository's authored guide, not player-provided content.
const article = parser.parse(markdown).replaceAll('<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="可横向滚动的表格"><table>').replaceAll('</table>', '</table></div>');
const contents = chapters.map(chapter => '<li><a href="#' + escape(chapter.id) + '">' + escape(chapter.text) + '</a></li>').join('\n');
const html = [
  '<!doctype html>',
  '<!-- Generated from GUIDE.md by tools/build-guide.mjs. -->',
  '<!-- SPDX-FileCopyrightText: 2026 yizhaozhang11; SPDX-License-Identifier: GPL-3.0-only -->',
  '<html lang="zh-CN"><head>',
  '<meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="description" content="Complexweeper 入门教程：读懂复数线索、学习鼠标和触屏操作、使用字母分组推理。">',
  '<title>入门教程与操作指南 · Complexweeper</title>',
  '<link rel="icon" href="./favicon.svg" type="image/svg+xml">',
  '<link rel="stylesheet" href="./guide.css">',
  '</head><body>',
  '<a class="skip-link" href="#guide-content">跳到教程正文</a>',
  '<header class="site-header"><a class="brand" href="./" target="_blank" rel="noopener noreferrer"><img src="./brand.svg" width="32" height="32" alt="">Complexweeper</a><a class="play-link" href="./" target="_blank" rel="noopener noreferrer">打开游戏 ↗</a></header>',
  '<main class="layout">',
  '<nav class="contents" aria-label="教程目录"><p>入门与操作</p><ol>' + contents + '</ol><p class="version">Web ' + escape(manifest.version) + '</p></nav>',
  '<article id="guide-content">' + article + '</article>',
  '</main>',
  '<footer class="site-footer"><span>已有对局请回到原游戏标签页继续。</span><a href="./legal/COPYRIGHT.txt">版权与来源</a></footer>',
  '</body></html>',
].join('\n');
mkdirSync(new URL('public/', project), { recursive: true });
writeFileSync(new URL('public/guide.html', project), html, 'utf8');
console.log('Updated tutorial: ' + fileURLToPath(new URL('public/guide.html', project)));
