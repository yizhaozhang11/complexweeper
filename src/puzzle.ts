// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

export type Quarter = 0 | 1 | 2 | 3;
export type Mark = { basis: number; rotation: Quarter };
export type Shape = { columns: number; rows: number; mines: number };
export type Stage = 'ready' | 'playing' | 'won' | 'lost';
export type Reading = { square: number; kind: 'empty' | 'single' | 'multiple' | 'number' };
export type Tile = { charge: Quarter | null; revealed: boolean; mark: Mark | null };
export type PublicTile = { reading: Reading | null; mark: Mark | null; revealed: boolean };
export type Puzzle = {
  shape: Shape;
  tiles: Tile[];
  adjacent: number[][];
  stage: Stage;
  duration: number;
  clock: number | null;
  impact: number | null;
  history: (Mark | null)[][];
};
export type Action =
  | { kind: 'open' | 'expand'; at: number }
  | { kind: 'cycle'; at: number; basis: number; keep?: boolean }
  | { kind: 'place'; at: number; mark: Mark | null }
  | { kind: 'turn' | 'reflect'; basis: number }
  | { kind: 'join'; from: number; into: number }
  | { kind: 'undo' | 'pause' | 'resume' };
export type Assessment = { satisfied: boolean; candidates: number[] };

const DIRECTIONS: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const wrap = (n: number) => ((n % 4 + 4) % 4) as Quarter;
export const rotate = (q: Quarter) => wrap(q + 1);
export const reflect = (q: Quarter) => wrap(-q);
export const ended = (p: Puzzle) => p.stage === 'won' || p.stage === 'lost';
export const elapsed = (p: Puzzle, now = Date.now()) => p.duration + (p.clock === null ? 0 : Math.max(0, now - p.clock));

export function validateShape(shape: Shape): void {
  const { columns, rows, mines } = shape;
  if (![columns, rows, mines].every(Number.isSafeInteger) || columns < 3 || columns > 40 ||
      rows < 3 || rows > 30 || mines < 1 || mines > columns * rows - 9) {
    throw new Error('棋盘需为 3–40 列、3–30 行，并为首次翻开留出至少 9 个安全格。');
  }
}

export function createPuzzle(shape: Shape): Puzzle {
  validateShape(shape);
  const tiles: Tile[] = [];
  const adjacent: number[][] = [];
  for (let row = 0; row < shape.rows; row++) {
    for (let column = 0; column < shape.columns; column++) {
      tiles.push({ charge: null, revealed: false, mark: null });
      const around: number[] = [];
      for (let y = Math.max(0, row - 1); y <= Math.min(shape.rows - 1, row + 1); y++) {
        for (let x = Math.max(0, column - 1); x <= Math.min(shape.columns - 1, column + 1); x++) {
          if (x !== column || y !== row) around.push(y * shape.columns + x);
        }
      }
      adjacent.push(around);
    }
  }
  return { shape: { ...shape }, tiles, adjacent, stage: 'ready', duration: 0, clock: null, impact: null, history: [] };
}

function randomBelow(limit: number): number {
  // Rejection sampling avoids bias without a saved PRNG or a seeded replay format.
  const ceiling = 2 ** 32 - (2 ** 32 % limit);
  const sample = new Uint32Array(1);
  do crypto.getRandomValues(sample); while (sample[0] >= ceiling);
  return sample[0] % limit;
}

function distribute(p: Puzzle, first: number, choose: (limit: number) => number): void {
  const excluded = new Set(p.adjacent[first]);
  excluded.add(first);
  const available = Array.from(p.tiles.keys()).filter(index => !excluded.has(index));
  for (let placed = 0; placed < p.shape.mines; placed++) {
    const offset = choose(available.length);
    const at = available[offset];
    available[offset] = available[available.length - 1];
    available.pop();
    p.tiles[at].charge = choose(4) as Quarter;
  }
}

function readAt(p: Puzzle, at: number): Reading {
  let real = 0, imaginary = 0, count = 0;
  for (const near of p.adjacent[at]) {
    const charge = p.tiles[near].charge;
    if (charge !== null) {
      real += DIRECTIONS[charge][0];
      imaginary += DIRECTIONS[charge][1];
      count++;
    }
  }
  const square = real ** 2 + imaginary ** 2;
  return { square, kind: count === 0 ? 'empty' : square !== 1 ? 'number' : count === 1 ? 'single' : 'multiple' };
}

export function observe(p: Puzzle): PublicTile[] {
  return p.tiles.map((tile, at) => ({
    revealed: tile.revealed && tile.charge === null,
    reading: tile.revealed && tile.charge === null ? readAt(p, at) : null,
    mark: tile.mark ? { ...tile.mark } : null,
  }));
}

/** This function only accepts public observations, never the hidden mine field. */
export function assess(view: readonly PublicTile[], around: readonly number[], at: number): Assessment {
  const reading = view[at]?.reading;
  if (!reading) return { satisfied: false, candidates: [] };
  const unknown = around.filter(index => !view[index].revealed && !view[index].mark);
  const marked = around.flatMap(index => view[index].mark ? [view[index].mark!] : []);
  if (reading.kind === 'empty') return { satisfied: marked.length === 0, candidates: [] };
  const coefficients = new Map<number, { real: number; imaginary: number }>();
  for (const mark of marked) {
    let sum = coefficients.get(mark.basis);
    if (!sum) { sum = { real: 0, imaginary: 0 }; coefficients.set(mark.basis, sum); }
    sum.real += DIRECTIONS[mark.rotation][0];
    sum.imaginary += DIRECTIONS[mark.rotation][1];
  }
  const surviving = [...coefficients.values()].filter(value => value.real !== 0 || value.imaginary !== 0);
  if (surviving.length > 1) return { satisfied: false, candidates: [] };
  const norm = surviving.length ? surviving[0].real ** 2 + surviving[0].imaginary ** 2 : 0;
  const cardinality = reading.kind === 'single' ? marked.length === 1
    : unknown.length <= 1 && (reading.square !== 0 || marked.length > 0) &&
      (reading.kind !== 'multiple' || marked.length >= 3);
  const satisfied = cardinality && norm === reading.square;
  return { satisfied, candidates: satisfied ? unknown : [] };
}

export function assessAll(p: Puzzle): Assessment[] {
  const view = observe(p);
  return p.adjacent.map((around, at) => assess(view, around, at));
}

export function solved(p: Puzzle): boolean {
  if (p.stage === 'ready' || p.tiles.some(tile => tile.charge === null && !tile.revealed)) return false;
  const view = observe(p);
  return view.every((tile, at) => !tile.revealed || assess(view, p.adjacent[at], at).satisfied);
}

export function nextBasis(p: Puzzle, minimum = 0): number {
  const used = new Set(p.tiles.flatMap(tile => tile.mark ? [tile.mark.basis] : []));
  let candidate = minimum;
  while (used.has(candidate)) candidate++;
  return candidate;
}

export function groupName(basis: number): string {
  if (basis === 0) return '数值';
  return String.fromCharCode(97 + (basis - 1) % 26) + (basis > 26 ? String(Math.floor((basis - 1) / 26)) : '');
}

export function markText(mark: Mark): string {
  const base = mark.basis === 0 ? '' : groupName(mark.basis);
  return ['' + (base || '1'), 'i' + base, '−' + (base || '1'), '−i' + base][mark.rotation];
}

function freeze(p: Puzzle, now: number): void {
  p.duration = elapsed(p, now);
  p.clock = null;
}

function revealRegion(p: Puzzle, target: number): void {
  const queue = [target];
  const scheduled = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const at = queue[cursor];
    const tile = p.tiles[at];
    if (tile.mark || tile.revealed) continue;
    tile.revealed = true;
    if (readAt(p, at).kind !== 'empty') continue;
    for (const near of p.adjacent[at]) {
      if (!scheduled.has(near)) { scheduled.add(near); queue.push(near); }
    }
  }
}

function equalMarks(a: Mark | null, b: Mark | null): boolean {
  return a === b || !!a && !!b && a.basis === b.basis && a.rotation === b.rotation;
}

export function apply(p: Puzzle, action: Action, now = Date.now(), choose = randomBelow): Puzzle {
  if (ended(p)) return p;
  if ('at' in action && (!Number.isInteger(action.at) || !p.tiles[action.at])) return p;
  if (action.kind === 'pause' || action.kind === 'resume') {
    if (p.stage !== 'playing' || (action.kind === 'pause') === (p.clock === null)) return p;
    const result = { ...p };
    if (action.kind === 'pause') freeze(result, now); else result.clock = now;
    return result;
  }
  if (p.stage === 'playing' && p.clock === null) return p;
  const result: Puzzle = {
    ...p, tiles: p.tiles.map(tile => ({ ...tile, mark: tile.mark ? { ...tile.mark } : null })), history: [...p.history],
  };
  if (action.kind === 'open' || action.kind === 'expand') {
    const target = result.tiles[action.at];
    let requests: number[];
    if (action.kind === 'open') {
      if (target.revealed || target.mark) return p;
      if (result.stage === 'ready') { distribute(result, action.at, choose); result.stage = 'playing'; result.clock = now; }
      requests = [action.at];
    } else {
      requests = assessAll(p)[action.at].candidates;
      if (!requests.length) return p;
    }
    result.history = [];
    for (const at of requests) {
      if (result.tiles[at].revealed || result.tiles[at].mark) continue;
      if (result.tiles[at].charge !== null) {
        result.tiles[at].revealed = true;
        result.impact = at;
        result.stage = 'lost';
        freeze(result, now);
        break;
      }
      revealRegion(result, at);
    }
  } else if (action.kind === 'undo') {
    const previous = result.history.pop();
    if (!previous) return p;
    result.tiles.forEach((tile, at) => tile.mark = previous[at] ? { ...previous[at]! } : null);
  } else {
    if (action.kind === 'place' || action.kind === 'cycle') {
      const tile = result.tiles[action.at];
      if (tile.revealed) return p;
      if (action.kind === 'place') tile.mark = action.mark ? { ...action.mark } : null;
      else if (!tile.mark) tile.mark = { basis: action.basis, rotation: 0 };
      else if (tile.mark.basis !== action.basis) tile.mark.basis = action.basis;
      else tile.mark = tile.mark.rotation === 3 && !action.keep ? null : { ...tile.mark, rotation: rotate(tile.mark.rotation) };
    } else if (action.kind === 'join') {
      if (action.from === action.into) return p;
      const destination = action.from === 0 || action.into === 0 ? 0 : action.into;
      const origin = destination === action.into ? action.from : action.into;
      result.tiles.forEach(tile => { if (tile.mark?.basis === origin) tile.mark.basis = destination; });
    } else if (action.kind === 'turn' || action.kind === 'reflect') {
      result.tiles.forEach(tile => {
        if (tile.mark && tile.mark.basis === action.basis) tile.mark.rotation = action.kind === 'turn' ? rotate(tile.mark.rotation) : reflect(tile.mark.rotation);
      });
    }
    if (result.tiles.every((tile, at) => equalMarks(tile.mark, p.tiles[at].mark))) return p;
    result.history.push(p.tiles.map(tile => tile.mark ? { ...tile.mark } : null));
    if (result.history.length > 100) result.history.shift();
  }
  if (result.stage !== 'lost' && solved(result)) { result.stage = 'won'; freeze(result, now); }
  return result;
}
