// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import './mark-menu.css';
import type { Quarter } from './puzzle.ts';
import { groupName, markText } from './puzzle.ts';
import { groupColour, markHTML } from './notation.ts';

export type MarkChoice = Quarter | 'clear' | 'cancel' | 'pending';

const geometry = { radius: 110, optionDistance: 68, optionSize: 46, clearRadius: 22, fadeInnerRadius: 16, fadeOuterRadius: 28 };

export function describeMarkChoice(choice: MarkChoice, basis: number, surface: 'touch' | 'keyboard' | 'toolbar', hadMark = false): string {
  const toolbar = surface === 'toolbar';
  if (choice === 'pending') return toolbar ? '划向菜单选项选择 · 直接松手取消' : '划向菜单选项 · 松手取消';
  if (choice === 'cancel') return toolbar ? '松手取消 · 原标记保留' : '松手取消 · 保留原标记';
  if (choice === 'clear') {
    if (toolbar) return '划向选项选标记 · 菜单中心清除 · 外圈取消';
    return (surface === 'keyboard' ? '' : '松手') + (hadMark ? '清除标记' : '保持未标记');
  }
  return (surface === 'keyboard' ? '标记 ' : '松手标记 ') + markText({ basis, rotation: choice }) + (toolbar ? ' · 划远取消' : '');
}

/** Layout and hit testing share the displayed center; the source cell stays fixed. */
export function createMarkMenu(onChoose: (choice: MarkChoice) => void, onCancel: () => void) {
  const { radius, optionDistance, optionSize, clearRadius, fadeInnerRadius, fadeOuterRadius } = geometry;
  const size = radius * 2;
  const symbolCenters = [[1, 0], [0, -1], [-1, 0], [0, 1]].map(([x, y]) => [radius + x * optionDistance, radius + y * optionDistance]);
  const axisStart = 12, axisEnd = size - axisStart;
  const root = document.createElement('div');
  root.id = 'mark-menu'; root.className = 'mark-menu'; root.hidden = true;
  for (const [name, value] of Object.entries({ size, 'option-distance': optionDistance, 'option-size': optionSize, 'clear-size': clearRadius * 2 })) {
    root.style.setProperty(`--menu-${name}`, `${value}px`);
  }
  root.innerHTML = `
    <svg class="mark-menu-tether" aria-hidden="true"><line/><circle r="3"/></svg>
    <div class="mark-menu-disc" role="group" aria-label="标记菜单">
      <svg class="mark-menu-plane" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <defs>
          <radialGradient id="mark-menu-line-fade">
            <stop offset="0" stop-color="black"/>
            <stop offset="${fadeInnerRadius / fadeOuterRadius}" stop-color="black"/>
            <stop offset="1" stop-color="white"/>
          </radialGradient>
          <mask id="mark-menu-line-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">
            <rect width="${size}" height="${size}" fill="white"/>
            ${[...symbolCenters, [radius, radius]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${fadeOuterRadius}" fill="url(#mark-menu-line-fade)"/>`).join('')}
          </mask>
        </defs>
        <g class="mark-menu-axes" mask="url(#mark-menu-line-mask)">
          <circle cx="${radius}" cy="${radius}" r="${optionDistance}"/>
          <path d="M${axisStart} ${radius}H${axisEnd}M${radius} ${axisEnd}V${axisStart}M${axisEnd - 5} ${radius - 4}L${axisEnd} ${radius}L${axisEnd - 5} ${radius + 4}M${radius - 4} ${axisStart + 5}L${radius} ${axisStart}L${radius + 4} ${axisStart + 5}"/>
        </g>
        <text class="mark-menu-axis-label" data-axis="real" x="${axisEnd - 1}" y="${radius - 14}" text-anchor="middle">ℜ</text>
        <text class="mark-menu-axis-label" data-axis="imaginary" x="${radius + 17}" y="${axisStart + 10}">ℑ</text>
      </svg>
      ${[0, 1, 2, 3].map(rotation => `<button type="button" class="mark-menu-option" data-choice="${rotation}"></button>`).join('')}
      <button type="button" class="mark-menu-option mark-menu-clear" data-choice="clear" aria-label="清除标记">
        <svg class="mark-menu-empty" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7.5"/><path d="M5 19L19 5"/>
        </svg>
      </button>
    </div>
    <div class="mark-menu-preview" role="status" aria-live="polite"></div>`;
  document.body.append(root);
  const disc = root.querySelector<HTMLElement>('.mark-menu-disc')!;
  const preview = root.querySelector<HTMLElement>('.mark-menu-preview')!;
  const tether = root.querySelector<SVGElement>('.mark-menu-tether')!;
  const line = tether.querySelector('line')!, dot = tether.querySelector('circle')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-choice]')];
  let basis = 0, choice: MarkChoice = 'clear', center = { x: 0, y: 0 };
  let start: { x: number; y: number } | null = null;
  let keyboard = false, hadMark = false;

  function update(next: MarkChoice): void {
    choice = next; root.dataset.choice = String(next);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.choice === String(next))));
    preview.textContent = describeMarkChoice(next, basis, keyboard ? 'keyboard' : 'touch', hadMark);
  }
  function show(at: number, selected: number, x: number, y: number, marked: boolean, useKeyboard = false): void {
    basis = selected; keyboard = useKeyboard; hadMark = marked;
    start = keyboard ? null : { x, y };
    root.dataset.sourceAt = String(at); root.dataset.basis = String(basis); root.dataset.mode = keyboard ? 'keyboard' : 'touch';
    root.style.setProperty('--menu-group', basis ? groupColour(basis) : '#333');
    root.style.setProperty('--menu-group-light', basis ? groupColour(basis, true) : '#fff');
    disc.setAttribute('aria-label', basis ? `选择 ${groupName(basis)} 组的系数，中心清除` : '选择数值标记，中心清除');
    for (let rotation = 0; rotation < 4; rotation++) {
      const mark = { basis, rotation: rotation as Quarter };
      buttons[rotation].innerHTML = markHTML(mark);
      buttons[rotation].setAttribute('aria-label', '标记 ' + markText(mark));
    }
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
    const margin = 8;
    const bottom = top + height;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
    const cx = clamp(x, left + radius + margin, left + width - radius - margin);
    const cy = clamp(y, top + radius + 38, bottom - radius - margin);
    center = { x: cx, y: cy };
    disc.style.left = `${cx - radius}px`; disc.style.top = `${cy - radius}px`;
    preview.style.left = `${cx}px`; preview.style.top = `${cy - radius - 32}px`;
    const shifted = cx !== x || cy !== y;
    root.dataset.shifted = String(shifted);
    tether.style.display = shifted ? '' : 'none';
    line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(cx)); line.setAttribute('y2', String(cy));
    dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y));
    update(keyboard || Math.hypot(cx - x, cy - y) < clearRadius ? 'clear' : 'pending'); root.hidden = false;
    for (const button of buttons.slice(0, 4)) {
      const content = button.querySelector<HTMLElement>('.math')!;
      const width = content.getBoundingClientRect().width;
      const available = optionSize - 6;
      if (width > available) content.style.fontSize = `${parseFloat(getComputedStyle(content).fontSize) * available / width}px`;
    }
    if (keyboard) buttons[4].focus({ preventScroll: true });
  }
  function move(x: number, y: number): MarkChoice {
    // Preserve the opening choice through small finger drift, including a clear
    // preselection near its edge. Once moved deliberately, follow the menu regions.
    if (start) {
      if (Math.hypot(x - start.x, y - start.y) <= 8) return choice;
      start = null;
    }
    const dx = x - center.x, dy = y - center.y, distance = Math.hypot(dx, dy);
    const horizontal: Quarter = dx >= 0 ? 0 : 2, vertical: Quarter = dy < 0 ? 1 : 3;
    let next: MarkChoice = distance > radius ? 'cancel' : distance < clearRadius ? 'clear'
      : Math.abs(dx) >= Math.abs(dy) ? horizontal : vertical;
    // Keep the current direction near a diagonal instead of flickering between two choices.
    if (typeof next === 'number' && (choice === horizontal || choice === vertical) && Math.abs(Math.abs(dx) - Math.abs(dy)) < 6) next = choice;
    if (next !== choice) update(next);
    return next;
  }
  root.addEventListener('keydown', event => {
    const directions: Record<string, Quarter> = { ArrowRight: 0, ArrowUp: 1, ArrowLeft: 2, ArrowDown: 3 };
    if (event.key in directions) { event.preventDefault(); buttons[directions[event.key]].focus(); }
    else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) onChoose(choice); }
    event.stopPropagation();
  });
  buttons.forEach(button => {
    const value = button.dataset.choice === 'clear' ? 'clear' : Number(button.dataset.choice) as Quarter;
    button.addEventListener('focus', () => { if (keyboard) update(value); });
    button.addEventListener('click', () => { if (keyboard) onChoose(value); });
  });
  root.addEventListener('focusout', event => {
    if (keyboard && !root.hidden && event.relatedTarget instanceof Node && !root.contains(event.relatedTarget)) onCancel();
  });
  return { root, show, move, get choice() { return choice; }, hide: () => { root.hidden = true; } };
}
