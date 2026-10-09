// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { randomUUID } from 'node:crypto';
import { Marked } from 'marked';

export type ChangeEntry = { title: string; html: string };

export function parseChangeNotes(markdown: string): { introduction: string; entries: ChangeEntry[] } {
  const parser = new Marked({ gfm: true });
  const tokens = parser.lexer(markdown);
  parser.walkTokens(tokens, token => {
    if (token.type === 'link' && /^GUIDE\.md(?:#|$)/.test(token.href)) {
      token.href = token.href.replace(/^GUIDE\.md/, './guide.html');
    }
  });
  const starts = tokens.flatMap((token, index) => token.type === 'heading' && token.depth === 2 ? [index] : []);
  if (!starts.length) throw new Error('CHANGELOG.md must contain a dated update under a level-two heading.');
  const render = (from: number, to: number): string =>
    parser.parser(Object.assign(tokens.slice(from, to), { links: tokens.links }));
  const entries = starts.map((start, index) => {
    const heading = tokens[start];
    if (heading.type !== 'heading' || !heading.text.trim()) throw new Error('Update headings must have a title.');
    const html = render(start + 1, starts[index + 1] ?? tokens.length);
    if (!html.trim()) throw new Error('Every update in CHANGELOG.md must include a description.');
    return { title: heading.text, html };
  });
  return { introduction: render(0, starts[0]), entries };
}

export function deploymentId(production: boolean, supplied?: string): string {
  if (!production) return 'development';
  return supplied?.trim() || 'local-' + randomUUID();
}
