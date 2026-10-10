// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import './touch.css';
import { assessAll, ended, groupName, markText, nextBasis } from './puzzle.ts';
import type { Action, Assessment, PublicTile, Puzzle } from './puzzle.ts';
import { groupColour, readingText } from './notation.ts';
import { createMarkMenu, describeMarkChoice } from './mark-menu.ts';
import type { MarkChoice } from './mark-menu.ts';

type Intent = 'mark' | 'expand' | 'merge' | 'background';
type InteractionContext = {
  basis: number;
  puzzle: Puzzle;
  markMenu: boolean;
  tapCycles: boolean;
};
type Gesture = InteractionContext & {
  pointer: number;
  at: number;
  x: number;
  y: number;
  position: { x: number; y: number };
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
  perform: (action: Action) => void; // Applies the action and refreshes the view, including no-op actions.
  refresh: () => void;
  focus: (at: number) => void;
  hintsEnabled: () => boolean;
  expansionEnabled: () => boolean;
  markMenuEnabled: () => boolean;
  tapCyclesEnabled: () => boolean;
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
  let keyboardMark: (InteractionContext & { at: number }) | null = null;
  let optionSignature = '';
  const markMenu = createMarkMenu(choice => {
    const current = keyboardMark;
    if (!current) return;
    const valid = available() && isCurrent(current);
    cancelGesture(false);
    if (valid) placeChoice(current.at, current.basis, choice);
    else refresh();
  }, () => cancelGesture());

  function blocked(): boolean {
    const puzzle = getPuzzle();
    return ended(puzzle) || puzzle.stage === 'playing' && puzzle.clock === null;
  }
  function available(): boolean {
    return !blocked() && !document.querySelector('dialog[open]');
  }
  function interactionContext(): InteractionContext {
    return { puzzle: getPuzzle(), basis: getSelected(), markMenu: options.markMenuEnabled(), tapCycles: options.tapCyclesEnabled() };
  }
  function isCurrent(current: InteractionContext, checkBasis = true): boolean {
    return current.puzzle === getPuzzle() && (!checkBasis || current.basis === getSelected()) &&
      current.markMenu === options.markMenuEnabled() && current.tapCycles === options.tapCyclesEnabled();
  }
  function cancelGesture(notify = true): void {
    const changed = gesture !== null || keyboardMark !== null || view.pressed !== null;
    const restoreFocus = keyboardMark && markMenu.root.contains(document.activeElement) ? keyboardMark.at : null;
    if (gesture) clearTimeout(gesture.timer);
    gesture = null; keyboardMark = null; markMenu.hide();
    view.pressed = null; view.ready = false;
    if (restoreFocus !== null) board.querySelector<HTMLElement>(`[data-at="${restoreFocus}"]`)?.focus({ preventScroll: true });
    if (changed && notify) refresh();
  }
  function placeChoice(at: number, basis: number, choice: MarkChoice): void {
    if (choice === 'cancel' || choice === 'pending') { refresh(); return; }
    perform({ kind: 'place', at, mark: choice === 'clear' ? null : { basis, rotation: choice } });
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
      if (!canMerge()) { toast('先选中已有组，再与另一组合并。'); refresh(); return; }
      view.mergeSource = getSelected(); view.mergeTarget = null;
    } else if (view.mergeTarget === null) {
      cancelMerge(false);
    } else {
      const source = view.mergeSource, target = view.mergeTarget;
      cancelMerge(false);
      select(source === 0 || target === 0 ? 0 : source);
      return perform({ kind: 'join', from: target, into: source });
    }
    refresh();
  }
  function tap(at: number): void {
    if (!available()) { refresh(); return; }
    const tile = getPuzzle().tiles[at];
    if (view.mergeSource !== null) {
      if (tile?.mark) {
        view.mergeTarget = tile.mark.basis === view.mergeSource ? null : tile.mark.basis;
      }
    } else if (!tile) {
      view.clue = null;
    } else if (tile.revealed) {
      view.clue = view.clue === at ? null : at;
    } else if (tile.mark) {
      const basis = getSelected();
      if (tile.mark.basis !== basis || !options.markMenuEnabled() || options.tapCyclesEnabled()) {
        return perform({ kind: 'cycle', at, basis, keep: true });
      }
    } else {
      return perform({ kind: 'open', at });
    }
    // Actions refresh through perform; view-only changes and ignored taps finish here.
    refresh();
  }
  function hold(at: number): void {
    if (!available()) { refresh(); return; }
    if (view.mergeSource !== null) { tap(at); return; }
    const tile = getPuzzle().tiles[at];
    if (!tile) { refresh(); return; }
    if (tile.revealed) {
      view.clue = at;
      if (!options.expansionEnabled()) toast('长按展开已关闭。');
      else if (assessAll(getPuzzle())[at]?.candidates.length) return perform({ kind: 'expand', at });
      else toast('这条线索暂时没有可展开的邻格。');
    } else if (!options.markMenuEnabled()) {
      return perform({ kind: 'place', at, mark: tile.mark ? null : { basis: getSelected(), rotation: 0 } });
    } else {
      cancelGesture(false);
      const cell = board.querySelector<HTMLElement>(`[data-at="${at}"]`);
      if (!cell) { refresh(); return; }
      const rect = cell.getBoundingClientRect();
      keyboardMark = { at, ...interactionContext() };
      view.pressed = at; view.ready = true;
      markMenu.show(at, keyboardMark.basis, rect.left + rect.width / 2, rect.top + rect.height / 2, !!tile.mark, true);
    }
    refresh();
  }
  function describe(publicTiles: PublicTile[], assessments: Assessment[]): string {
    if (view.mergeSource !== null) {
      return view.mergeTarget === null ? '点棋盘上的另一组，先预览再确认'
        : groupUnit(view.mergeSource) + ' = ' + groupUnit(view.mergeTarget) + ' · 再点确认合并';
    }
    if (gesture && view.pressed !== null) {
      if (gesture.intent === 'mark') {
        if (!gesture.markMenu) return gesture.puzzle.tiles[gesture.at].mark
          ? (view.ready ? '松手清除标记' : '按住以清除标记')
          : (view.ready ? '松手标记 ' : '按住以标记 ') + markText({ basis: gesture.basis, rotation: 0 });
        if (!view.ready) return '按住打开标记菜单';
        return describeMarkChoice(markMenu.choice, gesture.basis, 'toolbar');
      }
      if (gesture.intent === 'expand') {
        if (!options.expansionEnabled()) return '长按展开已关闭';
        const count = assessments[gesture.at]?.candidates.length || 0;
        return count ? (view.ready ? '松手展开 ' : '按住以展开 ') + count + ' 格' : '当前线索没有可展开的邻格';
      }
    }
    if (keyboardMark) return '方向键选择 · Enter 确认 · Esc 取消';
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
    if (!options.markMenuEnabled()) return '点按翻开或轮换 · 长按标记或清除';
    return options.tapCyclesEnabled() ? '点按翻开或轮换 · 长按划方向选标记' : '点按翻开或换组 · 长按选系数';
  }
  function sync(publicTiles: PublicTile[], assessments: Assessment[]): void {
    const puzzle = getPuzzle(), selected = getSelected(), disabled = blocked();
    if (gesture && !isCurrent(gesture) || keyboardMark && !isCurrent(keyboardMark) ||
        !markMenu.root.hidden && !available()) cancelGesture(false);
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
    select(nextBasis(getPuzzle()));
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
    cancelMerge(false); perform({ kind: 'undo' });
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
    if (keyboardMark && event.target instanceof Node && markMenu.root.contains(event.target)) return;
    if (event.pointerType === 'mouse') { cancelGesture(); return; }
    pointers.add(event.pointerId);
    if (pointers.size !== 1) { cancelGesture(); return; }
    cancelGesture(false);
    if (!available()) return;
    const at = indexFrom(event.target) ?? (isBackground(event.target) ? -1 : null);
    if (at === null) return;
    const puzzle = getPuzzle(), tile = puzzle.tiles[at];
    const intent: Intent = view.mergeSource !== null ? 'merge' : !tile ? 'background' : tile.revealed ? 'expand' : 'mark';
    const position = { x: event.clientX, y: event.clientY };
    gesture = { ...interactionContext(), pointer: event.pointerId, at, ...position, position, intent };
    if (at >= 0) { focus(at); view.pressed = at; }
    if (intent !== 'merge' && intent !== 'background') {
      const current = gesture;
      current.timer = setTimeout(() => {
        if (gesture !== current || !available()) return;
        if (!isCurrent(current)) { cancelGesture(); return; }
        if (current.intent === 'mark' && current.markMenu) markMenu.show(current.at, current.basis, current.position.x, current.position.y, !!tile.mark);
        view.ready = true; refresh();
      }, 200);
    }
    refresh();
  }, true);
  document.addEventListener('pointermove', event => {
    if (gesture?.pointer !== event.pointerId) return;
    // Keep the original x/y for drag cancellation; open the menu at the latest touch.
    gesture.position = { x: event.clientX, y: event.clientY };
    if (view.ready && gesture.intent === 'mark' && gesture.markMenu) {
      const before = markMenu.choice;
      markMenu.move(event.clientX, event.clientY);
      if (markMenu.choice !== before) refresh();
      return;
    }
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8 || releasedAt(event) !== gesture.at) cancelGesture();
  });
  // A non-passive first touchmove can keep the current touch from starting native
  // scrolling. Leave ordinary drags native; changing touch-action after the hold
  // would be too late for an already active pointer.
  board.addEventListener('touchmove', event => {
    if (!gesture || !view.ready || gesture.intent !== 'mark' || !gesture.markMenu) return;
    if (event.touches.length === 1 && event.cancelable) event.preventDefault();
    else cancelGesture();
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (event.pointerType === 'mouse') return;
    pointers.delete(event.pointerId);
    const current = gesture;
    if (!current || current.pointer !== event.pointerId) return;
    const held = view.ready;
    const choosing = held && current.intent === 'mark' && current.markMenu;
    // A changed lift coordinate must not silently replace the displayed choice.
    const choice = choosing ? markMenu.choice : 'cancel';
    cancelGesture(false);
    if (pointers.size || !available() || !isCurrent(current, current.intent === 'mark') || !choosing && releasedAt(event) !== current.at) {
      refresh(); return;
    }
    if (choosing) placeChoice(current.at, current.basis, choice);
    else if (held) hold(current.at); else tap(current.at);
  });
  document.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); cancelGesture(); });
  document.addEventListener('wheel', () => cancelGesture(), { passive: true, capture: true });
  document.addEventListener('scroll', () => cancelGesture(), true);
  window.addEventListener('blur', () => { cancelGesture(); pointers.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelGesture(); pointers.clear(); } });
  window.addEventListener('resize', () => cancelGesture());
  window.visualViewport?.addEventListener('resize', () => cancelGesture());

  const resize = new ResizeObserver(() => {
    const height = Math.ceil(toolbar.getBoundingClientRect().height);
    if (height) document.documentElement.style.setProperty('--touch-toolbar-height', height + 'px');
  });
  resize.observe(toolbar);
  return { view, sync, tap, hold, toggleMerge, cancelMerge, cancelGesture, reset };
}
