// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { createPuzzle, elapsed, observe, solved } from './puzzle.ts';
import type { Puzzle, Quarter, Stage } from './puzzle.ts';

type Snapshot = {
  format: 'complexweeper-web'; version: 2;
  columns: number; rows: number; mines: number;
  field: string | null; uncovered: number[];
  marks: { at: number; basis: number; rotation: Quarter }[];
  stage: Stage; milliseconds: number; impact: number | null;
};

export function pack(puzzle: Puzzle, now = Date.now()): string {
  const data: Snapshot = {
    format: 'complexweeper-web', version: 2,
    ...puzzle.shape,
    field: puzzle.stage === 'ready' ? null : puzzle.tiles.map(tile => tile.charge ?? '.').join(''),
    uncovered: puzzle.tiles.flatMap((tile, at) => tile.revealed ? [at] : []),
    marks: puzzle.tiles.flatMap((tile, at) => tile.mark ? [{ at, ...tile.mark }] : []),
    stage: puzzle.stage, milliseconds: Math.floor(elapsed(puzzle, now)), impact: puzzle.impact,
  };
  return btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unpack(text: string): Puzzle {
  const reject = (): never => { throw new Error('这不是有效的棋局链接，或棋局数据已损坏。'); };
  if (text.length > 120000 || !/^[\w-]+$/.test(text)) return reject();
  let data: Snapshot;
  try { data = JSON.parse(atob(text.replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return reject(); }
  if (!data || data.format !== 'complexweeper-web' || data.version !== 2) return reject();
  const integer = (value: unknown, high: number) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= high;
  let puzzle: Puzzle;
  try { puzzle = createPuzzle({ columns: data.columns, rows: data.rows, mines: data.mines }); }
  catch { return reject(); }
  const size = puzzle.tiles.length;
  if (!['ready', 'playing', 'lost', 'won'].includes(data.stage) || !integer(data.milliseconds, 1e12) ||
    !Array.isArray(data.uncovered) || data.uncovered.length > size || !Array.isArray(data.marks) || data.marks.length > size) return reject();
  if (data.stage === 'ready') {
    if (data.field !== null || data.uncovered.length || data.milliseconds !== 0 || data.impact !== null) return reject();
  } else {
    if (typeof data.field !== 'string' || data.field.length !== size || !/^[.0-3]+$/.test(data.field)) return reject();
    if (data.field.replace(/\./g, '').length !== data.mines) return reject();
    for (let at = 0; at < size; at++) puzzle.tiles[at].charge = data.field[at] === '.' ? null : Number(data.field[at]) as Quarter;
  }
  const opened = new Set<number>();
  for (const at of data.uncovered) {
    if (!integer(at, size - 1) || opened.has(at)) return reject();
    opened.add(at); puzzle.tiles[at].revealed = true;
  }
  const marked = new Set<number>();
  for (const mark of data.marks) {
    if (!mark || !integer(mark.at, size - 1) || !integer(mark.basis, size + 1) || !integer(mark.rotation, 3) || opened.has(mark.at) || marked.has(mark.at)) return reject();
    marked.add(mark.at); puzzle.tiles[mark.at].mark = { basis: mark.basis, rotation: mark.rotation };
  }
  puzzle.stage = data.stage; puzzle.duration = data.milliseconds; puzzle.impact = data.impact;
  const exposedMines = puzzle.tiles.flatMap((tile, at) => tile.revealed && tile.charge !== null ? [at] : []);
  if (data.stage === 'lost') {
    if (!integer(data.impact, size - 1) || exposedMines.length !== 1 || exposedMines[0] !== data.impact) return reject();
  } else if (exposedMines.length || data.impact !== null) return reject();
  if (data.stage !== 'ready' && !observe(puzzle).some(tile => tile.revealed)) return reject();
  if (data.stage === 'won' && !solved(puzzle) || data.stage === 'playing' && solved(puzzle)) return reject();
  return puzzle;
}
