// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, assess, assessAll, createPuzzle, elapsed, groupName, nextBasis, observe, solved } from '../src/puzzle.ts';
import type { Mark, PublicTile, Quarter, Reading } from '../src/puzzle.ts';
import { pack, unpack } from '../src/snapshot.ts';
import { radical } from '../src/notation.ts';

function fixture(charges: [number, Quarter][]) {
  const puzzle = createPuzzle({ columns: 5, rows: 5, mines: charges.length });
  for (const [at, rotation] of charges) puzzle.tiles[at].charge = rotation;
  puzzle.stage = 'playing'; puzzle.clock = 1000;
  return puzzle;
}

function publicExample(reading: Reading, marks: (Mark | null)[], remaining: number) {
  const view: PublicTile[] = [{ revealed: true, reading, mark: null }];
  for (const mark of marks) view.push({ revealed: false, reading: null, mark });
  for (let i = 0; i < remaining; i++) view.push({ revealed: false, reading: null, mark: null });
  return assess(view, view.slice(1).map((_, i) => i + 1), 0);
}

test('first reveal excludes its entire neighbourhood, with exact random mine count and immutable input', () => {
  for (const first of [0, 8, 40, 80]) {
    const before = createPuzzle({ columns: 9, rows: 9, mines: 10 });
    const after = apply(before, { kind: 'open', at: first }, 1000);
    assert.equal(before.stage, 'ready');
    assert.equal(after.tiles.filter(tile => tile.charge !== null).length, 10);
    for (const safe of [first, ...after.adjacent[first]]) assert.equal(after.tiles[safe].charge, null);
    assert.equal(after.tiles[first].revealed, true);
  }
});

test('public readings distinguish empty, cancelling zero, ordinary one and multiple one', () => {
  const cases: [number[], Reading][] = [
    [[], { kind: 'empty', square: 0 }], [[0, 2], { kind: 'number', square: 0 }],
    [[0], { kind: 'single', square: 1 }], [[0, 1, 3], { kind: 'multiple', square: 1 }],
    [[0, 1], { kind: 'number', square: 2 }],
  ];
  for (const [phases, expected] of cases) {
    const puzzle = fixture(phases.length ? phases.map((rotation, i) => [6 + i, rotation as Quarter]) : [[24, 0]]);
    puzzle.tiles[12].revealed = true;
    assert.deepEqual(observe(puzzle)[12].reading, expected);
    assert.equal(observe(puzzle)[6].reading, null);
    assert.ok(!('charge' in observe(puzzle)[6]));
  }
});

test('flooding never opens flags, cancelling zeros do not start a flood', () => {
  let puzzle = fixture([[0, 0], [2, 2]]);
  puzzle.tiles[24].mark = { basis: 1, rotation: 0 };
  puzzle = apply(puzzle, { kind: 'open', at: 6 }, 1100);
  assert.equal(puzzle.tiles.filter(tile => tile.revealed).length, 1);
  puzzle = apply(puzzle, { kind: 'open', at: 23 }, 1200);
  assert.equal(puzzle.tiles[24].revealed, false);
  assert.equal(puzzle.tiles[0].revealed, false);
});

test('single-mine clues accept each unit phase and can expand several neighbours', () => {
  for (let rotation = 0; rotation < 4; rotation++) for (const basis of [0, 1, 27]) {
    const result = publicExample({ square: 1, kind: 'single' }, [{ basis, rotation: rotation as Quarter }], 7);
    assert.equal(result.satisfied, true); assert.equal(result.candidates.length, 7);
  }
});

test('cancellation across like terms is valid; unrelated nonzero variables are unresolved', () => {
  const mark = (basis: number, rotation: Quarter): Mark => ({ basis, rotation });
  assert.equal(publicExample({ square: 1, kind: 'multiple' }, [mark(1, 0), mark(1, 2), mark(2, 1)], 1).satisfied, true);
  assert.equal(publicExample({ square: 2, kind: 'number' }, [mark(1, 0), mark(1, 1)], 1).satisfied, true);
  assert.equal(publicExample({ square: 2, kind: 'number' }, [mark(1, 0), mark(2, 1)], 0).satisfied, false);
  assert.equal(publicExample({ square: 2, kind: 'number' }, [mark(0, 0), mark(1, 1)], 0).satisfied, false);
});

test('multiple clues, zero and unresolved additional pairs obey their count constraints', () => {
  const one: Mark = { basis: 1, rotation: 0 }, opposite: Mark = { basis: 1, rotation: 2 };
  assert.equal(publicExample({ square: 1, kind: 'multiple' }, [one], 0).satisfied, false);
  assert.equal(publicExample({ square: 0, kind: 'number' }, [], 0).satisfied, false);
  assert.equal(publicExample({ square: 0, kind: 'number' }, [one, opposite], 1).satisfied, true);
  assert.equal(publicExample({ square: 0, kind: 'number' }, [one, opposite], 2).satisfied, false);
  assert.equal(publicExample({ square: 0, kind: 'empty' }, [one], 0).satisfied, false);
});

test('all accepted symbolic sums have the advertised norm for every variable assignment', () => {
  const axes = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let left = 0; left < 12; left++) for (let right = 0; right < 12; right++) {
    const marks: Mark[] = [left, right].map(code => ({ basis: Math.floor(code / 4), rotation: code % 4 as Quarter }));
    for (const square of [0, 2, 4]) {
      if (!publicExample({ square, kind: 'number' }, marks, 0).satisfied) continue;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const sum = marks.reduce(([x, y], mark) => {
          const phase = (mark.rotation + [0, a, b][mark.basis]) % 4;
          return [x + axes[phase][0], y + axes[phase][1]];
        }, [0, 0]);
        assert.equal(sum[0] ** 2 + sum[1] ** 2, square);
      }
    }
  }
});

test('wrong flags still permit conditional expansion and can detonate', () => {
  let puzzle = fixture([[6, 0]]);
  puzzle.tiles[12].revealed = true;
  puzzle.tiles[7].mark = { basis: 2, rotation: 0 };
  assert.equal(assessAll(puzzle)[12].satisfied, true);
  puzzle = apply(puzzle, { kind: 'expand', at: 12 }, 1800);
  assert.equal(puzzle.stage, 'lost'); assert.equal(puzzle.impact, 6);
  assert.equal(elapsed(puzzle, 9000), 800);
  assert.equal(observe(puzzle)[6].revealed, false);
});

test('revealing a new single clue does not implicitly expand it in the same action', () => {
  let puzzle = fixture([[6, 0]]);
  puzzle.tiles[6].mark = { basis: 0, rotation: 0 };
  puzzle = apply(puzzle, { kind: 'open', at: 12 }, 1500);
  assert.equal(puzzle.tiles.filter(tile => tile.revealed).length, 1);
  puzzle = apply(puzzle, { kind: 'expand', at: 12 }, 1700);
  assert.ok(puzzle.tiles.filter(tile => tile.revealed).length > 1);
});

test('marks cycle, moving groups preserves phase, undo records whole edits', () => {
  let puzzle = createPuzzle({ columns: 5, rows: 5, mines: 1 });
  for (let rotation = 0; rotation < 4; rotation++) {
    puzzle = apply(puzzle, { kind: 'cycle', at: 6, basis: 1 });
    assert.deepEqual(puzzle.tiles[6].mark, { basis: 1, rotation });
  }
  puzzle = apply(puzzle, { kind: 'cycle', at: 6, basis: 2 });
  assert.deepEqual(puzzle.tiles[6].mark, { basis: 2, rotation: 3 });
  puzzle = apply(puzzle, { kind: 'cycle', at: 6, basis: 2, keep: true });
  assert.deepEqual(puzzle.tiles[6].mark, { basis: 2, rotation: 0 });
  puzzle = apply(puzzle, { kind: 'undo' });
  assert.deepEqual(puzzle.tiles[6].mark, { basis: 2, rotation: 3 });
  puzzle = apply(puzzle, { kind: 'cycle', at: 6, basis: 2 });
  assert.equal(puzzle.tiles[6].mark, null);
});

test('group rotation, coefficient conjugation and equality merge are atomic and reversible', () => {
  let puzzle = fixture([[0, 0], [1, 0]]);
  puzzle.tiles[0].mark = { basis: 1, rotation: 0 };
  puzzle.tiles[1].mark = { basis: 1, rotation: 1 };
  puzzle.tiles[2].mark = { basis: 2, rotation: 2 };
  puzzle = apply(puzzle, { kind: 'turn', basis: 1 });
  assert.deepEqual(puzzle.tiles.slice(0, 3).map(tile => tile.mark?.rotation), [1, 2, 2]);
  puzzle = apply(puzzle, { kind: 'reflect', basis: 1 });
  assert.deepEqual(puzzle.tiles.slice(0, 3).map(tile => tile.mark?.rotation), [3, 2, 2]);
  puzzle = apply(puzzle, { kind: 'join', from: 2, into: 1 });
  assert.equal(puzzle.tiles[2].mark?.basis, 1);
  puzzle = apply(puzzle, { kind: 'undo' });
  assert.equal(puzzle.tiles[2].mark?.basis, 2);
  puzzle = apply(puzzle, { kind: 'join', from: 0, into: 1 });
  assert.equal(puzzle.tiles[0].mark?.basis, 0); assert.equal(puzzle.tiles[1].mark?.basis, 0);
});

test('new groups reuse free names and revealing clears undo history', () => {
  let puzzle = fixture([[0, 0]]);
  assert.equal(nextBasis(puzzle), 0);
  puzzle = apply(puzzle, { kind: 'place', at: 0, mark: { basis: 2, rotation: 0 } });
  assert.equal(nextBasis(puzzle), 0);
  puzzle = apply(puzzle, { kind: 'place', at: 1, mark: { basis: 0, rotation: 0 } });
  assert.equal(nextBasis(puzzle), 1); assert.equal(groupName(27), 'a1');
  puzzle = apply(puzzle, { kind: 'place', at: 2, mark: { basis: 1, rotation: 0 } });
  assert.equal(nextBasis(puzzle), 3);
  puzzle = apply(puzzle, { kind: 'place', at: 1, mark: null });
  assert.equal(nextBasis(puzzle), 0);
  puzzle = apply(puzzle, { kind: 'undo' });
  assert.equal(nextBasis(puzzle), 3);
  puzzle = apply(puzzle, { kind: 'open', at: 6 });
  assert.equal(puzzle.history.length, 0);
});

test('completion accepts symbolic phase ambiguity but requires correct positions and all clues', () => {
  let puzzle = fixture([[0, 0]]);
  puzzle.tiles.forEach(tile => tile.revealed = tile.charge === null);
  assert.equal(solved(puzzle), false);
  puzzle = apply(puzzle, { kind: 'place', at: 0, mark: { basis: 1, rotation: 3 } }, 2000);
  assert.equal(puzzle.stage, 'won'); assert.equal(solved(puzzle), true);
  assert.equal(apply(puzzle, { kind: 'turn', basis: 1 }), puzzle);
});

test('pauses freeze time and block edits; resuming continues the same duration', () => {
  const initial = fixture([[0, 0]]);
  const paused = apply(initial, { kind: 'pause' }, 3000);
  assert.equal(elapsed(paused, 7000), 2000);
  assert.equal(apply(paused, { kind: 'open', at: 6 }, 8000), paused);
  const resumed = apply(paused, { kind: 'resume' }, 9000);
  assert.equal(elapsed(resumed, 10000), 3000);
});

test('snapshots preserve symbols and exact fields; resumed clock starts paused', () => {
  const original = fixture([[0, 0], [1, 3]]);
  original.tiles[12].revealed = true;
  original.tiles[0].mark = { basis: 27, rotation: 1 };
  // The format bounds names by board capacity; choose a valid name for this board.
  original.tiles[0].mark.basis = 24;
  const restored = unpack(pack(original, 4500));
  assert.deepEqual(restored.tiles, original.tiles);
  assert.equal(restored.duration, 3500); assert.equal(restored.clock, null);
  assert.deepEqual(restored.history, []);
});

test('unstarted marks, lost games and won games round-trip', () => {
  let ready = createPuzzle({ columns: 5, rows: 5, mines: 1 });
  ready = apply(ready, { kind: 'place', at: 0, mark: { basis: 1, rotation: 1 } });
  assert.equal(unpack(pack(ready)).stage, 'ready');
  let lost = fixture([[0, 0]]); lost.tiles[6].revealed = true;
  lost = apply(lost, { kind: 'open', at: 0 }, 2000);
  assert.equal(unpack(pack(lost)).impact, 0);
  let won = fixture([[0, 0]]); won.tiles.forEach(tile => tile.revealed = tile.charge === null);
  won = apply(won, { kind: 'place', at: 0, mark: { basis: 1, rotation: 1 } }, 2000);
  assert.equal(unpack(pack(won)).stage, 'won');
});

test('reassigning one of a completely marked board to the next unused group remains shareable', () => {
  let puzzle = createPuzzle({ columns: 5, rows: 5, mines: 1 });
  puzzle.tiles.forEach((tile, at) => tile.mark = { basis: at + 1, rotation: 0 });
  assert.equal(nextBasis(puzzle), 0);
  puzzle = apply(puzzle, { kind: 'cycle', at: 0, basis: nextBasis(puzzle) });
  assert.deepEqual(unpack(pack(puzzle)).tiles, puzzle.tiles);
});

test('snapshot validation rejects malformed, conflicting and contradictory data', () => {
  const source = fixture([[0, 0]]); source.tiles[6].revealed = true;
  const json = JSON.parse(atob(pack(source, 2000).replace(/-/g, '+').replace(/_/g, '/')));
  const changes = [
    { version: 3 }, { columns: 100000 }, { field: '.' }, { field: '9'.repeat(25) },
    { uncovered: [6, 6] }, { uncovered: [0, 6] }, { marks: [{ at: 6, basis: 1, rotation: 0 }] },
    { marks: [{ at: 0, basis: 1, rotation: 4 }] }, { stage: 'won' }, { impact: 0 }, { milliseconds: -1 },
  ];
  for (const change of changes) assert.throws(() => unpack(btoa(JSON.stringify({ ...json, ...change })).replace(/=+$/, '')));
  for (const input of ['', '{}', '<script>', 'a'.repeat(120001)]) assert.throws(() => unpack(input));
});

test('radical reduction is exact across all possible squared neighbour sums', () => {
  for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    if (Math.abs(x) + Math.abs(y) > 8) continue;
    const square = x * x + y * y, result = radical(square);
    assert.equal(result.coefficient ** 2 * result.radicand, square);
    for (let factor = 2; factor * factor <= result.radicand; factor++) assert.notEqual(result.radicand % (factor * factor), 0);
  }
});
