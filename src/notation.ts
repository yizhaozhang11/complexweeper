// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import type { Mark, Reading } from './puzzle.ts';
import { groupName } from './puzzle.ts';
import { mathOutlines } from './math-outlines.ts';

export function radical(square: number): { coefficient: number; radicand: number } {
  let coefficient = Math.floor(Math.sqrt(square));
  if (square === 0) return { coefficient: 0, radicand: 1 };
  while (square % (coefficient * coefficient) !== 0) coefficient--;
  return { coefficient, radicand: square / (coefficient * coefficient) };
}

export function readingText(reading: Reading): string {
  if (reading.kind === 'empty') return '空白';
  if (reading.kind === 'multiple') return '1*';
  const { coefficient, radicand } = radical(reading.square);
  return radicand === 1 ? String(coefficient) : `${coefficient > 1 ? coefficient : ''}√${radicand}`;
}

export function readingHTML(reading: Reading): string {
  if (reading.kind === 'empty') return '';
  if (reading.kind === 'multiple') return '<span class="math">1<sup>*</sup></span>';
  const { coefficient, radicand } = radical(reading.square);
  if (radicand === 1) return `<span class="math">${coefficient}</span>`;
  const shape = mathOutlines[reading.square];
  return `<svg class="radical-clue" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" width="${shape.width / 1000}em" height="${shape.height / 1000}em" fill="currentColor" aria-hidden="true"><path d="${shape.path}"/></svg>`;
}

export function markHTML(mark: Mark): string {
  const label = groupName(mark.basis);
  let basis = '';
  if (mark.basis > 0) {
    const ordinal = (mark.basis - 1) % 26;
    const letter = ordinal === 7 ? 'ℎ' : String.fromCodePoint(0x1d44e + ordinal);
    basis = `<span class="variable">${letter}${label.length > 1 ? `<sub>${label.slice(1)}</sub>` : ''}</span>`;
  }
  const sign = mark.rotation >= 2 ? '<span class="sign">−</span>' : '';
  return `<span class="math">${sign}${mark.rotation % 2 ? 'i' : mark.basis === 0 ? '1' : ''}${basis}</span>`;
}

export const palette = ['#ad4037', '#3268a8', '#6d4e9f', '#207555', '#8b6516', '#9e477b', '#247c88', '#795a44'];
export function groupColour(basis: number, light = false): string {
  const colors = light ? ['#ffb4a5', '#afd3ff', '#d7b8ff', '#ace5bf', '#f4d68b', '#f6b4d9', '#a0e1e8', '#dfc4ae'] : palette;
  return colors[(basis - 1) % colors.length];
}

export function clockText(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
