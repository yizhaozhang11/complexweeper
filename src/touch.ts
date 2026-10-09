// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import './touch.css';
import { assessAll, ended, groupName, markText, nextBasis } from './puzzle.ts';
import type { Action, Assessment, PublicTile, Puzzle } from './puzzle.ts';
import { groupColour, readingText } from './notation.ts';

type Intent = 'mark' | 'erase' | 'expand' | 'merge' | 'background';
type Gesture = {
  pointer: number;
  at: number;
  x: number;
  y: number;
  basis: number;
  puzzle: Puzzle;
  intent: Intent;
  timer?: ReturnType<typeof setTimeout>;
};
export type TouchView = {
  clue: number | null;
  pressed: number | null;
  ready: boolean;
  mergeSource: number | null;
  mergeTarget: number | null;
};
export type TouchControls = {
  readonly view: Readonly<TouchView>;
  sync(publicTiles: PublicTile[], assessments: Assessment[]): void;
  tap(at: number): void;
  hold(at: number): void;
  toggleMerge(): void;
  cancelMerge(notify?: boolean): void;
  cancelGesture(notify?: boolean): void;
  reset(): void;
};

export function createTouchControls(options: {
  board: HTMLElement;
  toolbar: HTMLElement;
  getPuzzle: () => Puzzle;
  getSelected: () => number;
  select: (basis: number) => void;
  perform: (action: Action) => void;
  refresh: () => void;
  focus: (at: number) => void;
  hintsEnabled: () => boolean;
  expansionEnabled: () => boolean;
  toast: (message: string) => void;
}): TouchControls {
  const { board, toolbar, getPuzzle, getSelected, select, perform, refresh, focus, toast } = options;
  const element = <T extends HTMLElement>(id: string) => toolbar.querySelector<T>('#' + id)!;
  const picker = element<HTMLSelectElement>('touch-group');
  const fresh = element<HTMLButtonElement>('touch-new-group');
  const undo = element<HTMLButtonElement>('touch-undo');
  const rotate = element<HTMLButtonElement>('touch-rotate');
  const reflect = element<HTMLButtonElement>('touch-conjugate');
  const merge = element<HTMLButtonElement>('touch-merge');
  const cancel = element<HTMLButtonElement>('touch-cancel');
  const status = element<HTMLElement>('touch-status');
  const view: TouchView = { clue: null, pressed: null, ready: false, mergeSource: null, mergeTarget: null };
  const pointers = new Set<number>();
  let gesture: Gesture | null = null;
  let optionSignature = '';

  function blocked(): boolean {
    const puzzle = getPuzzle();
    return ended(puzzle) || puzzle.stage === 'playing' && puzzle.clock === null;
  }
  function available(): boolean {
    return !blocked() && !document.querySelector('dialog[open]');
  }
  function cancelGesture(notify = true): void {
    const changed = gesture !== null || view.pressed !== null;
    if (gesture) clearTimeout(gesture.timer);
    gesture = null;
    view.pressed = null; view.ready = false;
    if (changed && notify) refresh();
  }
  function cancelMerge(notify = true): void {
    cancelGesture(false);
    view.mergeSource = null; view.mergeTarget = null;
    if (notify) refresh();
  }
  function reset(): void {
    cancelMerge(false);
    view.clue = null;
  }
  function knownGroups(): Set<number> {
    return new Set(getPuzzle().tiles.flatMap(tile => tile.mark ? [tile.mark.basis] : []));
  }
  function canMerge(): boolean {
    const source = getSelected(), groups = knownGroups();
    return (source === 0 || groups.has(source)) && [...groups].some(group => group !== source);
  }
  function groupUnit(basis: number): string {
    return basis === 0 ? '1' : groupName(basis);
  }
  function toggleMerge(): void {
    if (!available()) return;
    cancelGesture(false);
    if (view.mergeSource === null) {
      if (!canMerge()) { toast('先选中已有组，再与另一组合并。'); return; }
      view.mergeSource = getSelected(); view.mergeTarget = null;
    } else if (view.mergeTarget === null) {
      cancelMerge(false);
    } else {
      const source = view.mergeSource, target = view.mergeTarget;
      cancelMerge(false);
      select(source === 0 || target === 0 ? 0 : source);
      perform({ kind: 'join', from: target, into: source });
    }
    refresh();
  }
  function tap(at: number): void {
    if (!available()) return;
    const tile = getPuzzle().tiles[at];
    if (view.mergeSource !== null) {
      if (tile?.mark) {
        view.mergeTarget = tile.mark.basis === view.mergeSource ? null : tile.mark.basis;
        refresh();
      }
      return;
    }
    if (!tile) { view.clue = null; refresh(); return; }
    if (tile.revealed) {
      view.clue = view.clue === at ? null : at;
      refresh();
    } else if (tile.mark) {
      perform({ kind: 'cycle', at, basis: getSelected(), keep: true });
    } else {
      perform({ kind: 'open', at });
    }
  }
  function hold(at: number): void {
    if (!available()) return;
    if (view.mergeSource !== null) { tap(at); return; }
    const tile = getPuzzle().tiles[at];
    if (!tile) return;
    if (tile.revealed) {
      view.clue = at;
      if (!options.expansionEnabled()) toast('长按展开已关闭。');
      else if (assessAll(getPuzzle())[at]?.candidates.length) perform({ kind: 'expand', at });
      else toast('这条线索暂时没有可展开的邻格。');
      refresh();
    } else {
      perform({ kind: 'place', at, mark: tile.mark ? null : { basis: getSelected(), rotation: 0 } });
    }
  }
  function describe(publicTiles: PublicTile[], assessments: Assessment[]): string {
    if (view.mergeSource !== null) {
      return view.mergeTarget === null ? '点棋盘上的另一组，先预览再确认'
        : groupUnit(view.mergeSource) + ' = ' + groupUnit(view.mergeTarget) + ' · 再点确认合并';
    }
    if (gesture && view.pressed !== null) {
      if (gesture.intent === 'mark') return (view.ready ? '松手标记 ' : '按住以标记 ') + markText({ basis: gesture.basis, rotation: 0 });
      if (gesture.intent === 'erase') return view.ready ? '松手清除标记' : '按住以清除标记';
      if (gesture.intent === 'expand') {
        if (!options.expansionEnabled()) return '长按展开已关闭';
        const count = assessments[gesture.at]?.candidates.length || 0;
        return count ? (view.ready ? '松手展开 ' : '按住以展开 ') + count + ' 格' : '当前线索没有可展开的邻格';
      }
    }
    if (view.clue !== null) {
      const reading = publicTiles[view.clue]?.reading;
      if (reading) {
        const label = readingText(reading);
        if (reading.kind === 'empty') return '空白 · 周围没有雷';
        if (!options.expansionEnabled()) return label + ' · 长按展开已关闭';
        if (options.hintsEnabled()) {
          const count = assessments[view.clue]?.candidates.length || 0;
          return label + (count ? ' · 长按可展开 ' + count + ' 格' : ' · 暂无可展开的邻格');
        }
        return label + ' · 已选中线索';
      }
    }
    return '点按翻开或轮换 · 长按标记或清除';
  }
  function sync(publicTiles: PublicTile[], assessments: Assessment[]): void {
    const puzzle = getPuzzle(), selected = getSelected(), disabled = blocked();
    if (disabled) cancelMerge(false);
    if (view.clue !== null && !publicTiles[view.clue]?.revealed) view.clue = null;
    if (view.mergeSource !== null && view.mergeSource !== selected) cancelMerge(false);
    const counts = new Map<number, number>();
    for (const tile of puzzle.tiles) if (tile.mark) counts.set(tile.mark.basis, (counts.get(tile.mark.basis) || 0) + 1);
    if (view.mergeTarget !== null && !counts.has(view.mergeTarget)) view.mergeTarget = null;
    const groups = [...new Set([0, selected, ...counts.keys()])].sort((a, b) => a - b);
    const signature = groups.map(basis => basis + ':' + (counts.get(basis) || 0)).join('|');
    if (signature !== optionSignature) {
      optionSignature = signature;
      picker.replaceChildren(...groups.map(basis => {
        const count = counts.get(basis) || 0;
        const label = (basis === 0 ? '数值组' : groupName(basis) + ' 组') + ' · ' + (count ? count + ' 格' : '待用');
        return new Option(label, String(basis));
      }));
    }
    picker.value = String(selected);
    toolbar.style.setProperty('--selected-group', selected ? groupColour(selected) : '#444');
    const merging = view.mergeSource !== null;
    picker.disabled = fresh.disabled = disabled || merging;
    rotate.disabled = reflect.disabled = disabled || merging || !counts.get(selected);
    undo.disabled = disabled || !puzzle.history.length;
    merge.disabled = disabled || !merging && !canMerge();
    merge.setAttribute('aria-pressed', String(merging));
    merge.textContent = !merging ? '合并' : view.mergeTarget === null ? '取消合并'
      : '确认 ' + groupUnit(view.mergeSource!) + '=' + groupUnit(view.mergeTarget);
    cancel.hidden = !merging || view.mergeTarget === null;
    const message = disabled ? (ended(puzzle) ? '对局已结束' : '已暂停 · 继续后恢复操作') : describe(publicTiles, assessments);
    if (status.textContent !== message) status.textContent = message;
  }

  picker.addEventListener('change', () => {
    if (!available() || view.mergeSource !== null) return;
    cancelGesture(false);
    const basis = Number(picker.value);
    if (!Number.isInteger(basis) || basis < 0) return;
    select(basis); refresh();
  });
  fresh.addEventListener('click', () => {
    if (!available() || view.mergeSource !== null) return;
    cancelGesture(false);
    select(nextBasis(getPuzzle(), 1));
    refresh();
  });
  rotate.addEventListener('click', () => {
    if (available() && view.mergeSource === null) { cancelGesture(false); perform({ kind: 'turn', basis: getSelected() }); }
  });
  reflect.addEventListener('click', () => {
    if (available() && view.mergeSource === null) { cancelGesture(false); perform({ kind: 'reflect', basis: getSelected() }); }
  });
  undo.addEventListener('click', () => {
    if (!available()) return;
    cancelMerge(false); perform({ kind: 'undo' }); refresh();
  });
  merge.addEventListener('click', toggleMerge);
  cancel.addEventListener('click', () => cancelMerge());

  function indexFrom(target: EventTarget | null): number | null {
    const cell = target instanceof Element ? target.closest<HTMLElement>('[data-at]') : null;
    return cell && board.contains(cell) ? Number(cell.dataset.at) : null;
  }
  function isBackground(target: EventTarget | null): boolean {
    return target instanceof Element && !target.closest('a,button,input,select,textarea,label,dialog,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="switch"],[role="textbox"]');
  }
  function releasedAt(event: PointerEvent): number | null {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    return indexFrom(target) ?? (isBackground(target) ? -1 : null);
  }
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') { cancelGesture(); return; }
    pointers.add(event.pointerId);
    if (pointers.size !== 1) { cancelGesture(); return; }
    cancelGesture(false);
    if (!available()) return;
    const at = indexFrom(event.target) ?? (isBackground(event.target) ? -1 : null);
    if (at === null) return;
    const puzzle = getPuzzle(), tile = puzzle.tiles[at];
    const intent: Intent = view.mergeSource !== null ? 'merge' : !tile ? 'background' : tile.revealed ? 'expand' : tile.mark ? 'erase' : 'mark';
    gesture = { pointer: event.pointerId, at, x: event.clientX, y: event.clientY, basis: getSelected(), puzzle, intent };
    if (at >= 0) { focus(at); view.pressed = at; }
    if (intent !== 'merge' && intent !== 'background') {
      const current = gesture;
      current.timer = setTimeout(() => {
        if (gesture !== current || !available()) return;
        view.ready = true; refresh();
      }, 450);
    }
    refresh();
  }, true);
  document.addEventListener('pointermove', event => {
    if (gesture?.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8 || releasedAt(event) !== gesture.at) cancelGesture();
  });
  document.addEventListener('pointerup', event => {
    if (event.pointerType === 'mouse') return;
    pointers.delete(event.pointerId);
    const current = gesture;
    if (!current || current.pointer !== event.pointerId) return;
    const held = view.ready;
    cancelGesture(false);
    if (pointers.size || !available() || releasedAt(event) !== current.at || getPuzzle() !== current.puzzle ||
        current.intent === 'mark' && current.basis !== getSelected()) {
      refresh(); return;
    }
    if (held) hold(current.at); else tap(current.at);
    refresh();
  });
  document.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); cancelGesture(); });
  document.addEventListener('wheel', () => cancelGesture(), { passive: true, capture: true });
  document.addEventListener('scroll', () => cancelGesture(), true);
  window.addEventListener('blur', () => { cancelGesture(); pointers.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelGesture(); pointers.clear(); } });

  const resize = new ResizeObserver(() => {
    const height = Math.ceil(toolbar.getBoundingClientRect().height);
    if (height) document.documentElement.style.setProperty('--touch-toolbar-height', height + 'px');
  });
  resize.observe(toolbar);
  return { view, sync, tap, hold, toggleMerge, cancelMerge, cancelGesture, reset };
}
