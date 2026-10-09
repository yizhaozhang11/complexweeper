// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import './style.css';
import { apply, assessAll, createPuzzle, elapsed, ended, groupName, markText, nextBasis, observe } from './puzzle.ts';
import type { Action, Puzzle, Shape } from './puzzle.ts';
import { pack, unpack } from './snapshot.ts';
import { clockText, groupColour, markHTML, readingHTML, readingText } from './notation.ts';
import { endingScene } from './endings.ts';
import { initializeUpdates } from './updates.ts';
import { createTouchControls } from './touch.ts';
import type { TouchControls } from './touch.ts';

const presets: Shape[] = [
  { columns: 9, rows: 9, mines: 10 }, { columns: 16, rows: 16, mines: 40 }, { columns: 30, rows: 16, mines: 99 },
];
let puzzle = createPuzzle(presets[1]);
let selected = 0;
let merging = false;
let revealActual = false;
let focused = 0;
let pointed = -1;
let touchControls: TouchControls | undefined;
let toastTimer: ReturnType<typeof setTimeout>;
const base = import.meta.env.BASE_URL;
const touchDevice = matchMedia('(pointer: coarse)');
const narrowWindow = matchMedia('(max-width: 700px)');
const usesTouchUI = () => touchDevice.matches || narrowWindow.matches && navigator.maxTouchPoints > 0;
function readPreference(key: string): boolean {
  try { return localStorage.getItem(`complexweeper-v2-${key}`) !== 'false'; } catch { return true; }
}
const preferences = { hints: readPreference('hints'), expansion: readPreference('expansion') };
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <div class="shell">
    <header class="masthead">
      <div class="brand"><img class="brand-symbol" src="${base}brand.svg" width="34" height="34" alt="±i"><span>Complexweeper</span></div>
      <nav aria-label="页面工具"><a class="guide-link" href="${base}guide.html" target="_blank" rel="noopener noreferrer">教程</a><button id="updates">更新</button><button id="help">玩法</button><button id="about">关于</button></nav>
    </header>
    <main>
      <section class="play-space" aria-label="复扫雷">
        <div class="game-heading"><div><p class="eyebrow">复扫雷</p><div class="preset-line"><label class="sr-only" for="preset">棋盘</label><select id="preset"><option value="0">轻量 · 9 × 9</option><option value="1" selected>标准 · 16 × 16</option><option value="2">广域 · 30 × 16</option><option value="custom">自定义棋盘</option></select><span id="state" class="state">准备就绪</span></div></div><button id="restart" class="primary">新对局</button></div>
        <div class="metrics"><div><span>时间</span><strong id="time">00:00</strong></div><div><span>标记</span><strong><b id="marked">0</b><span id="quota"> / 40</span></strong></div><button id="pause" class="text-button" hidden>暂停</button><div id="review" class="segmented" hidden><button id="review-marks" aria-pressed="true">标记</button><button id="review-field" aria-pressed="false">实际分布</button></div></div>
        <div id="board-frame" class="board-frame">
          <div id="board-scroll" class="board-scroll"><div id="board" role="grid" aria-label="扫雷棋盘"></div></div>
          <div id="pause-cover" class="pause-cover" hidden><p>已暂停</p><button id="resume" class="primary">继续对局</button></div>
          <canvas id="ending-canvas" aria-hidden="true" hidden></canvas>
          <div id="outcome" class="outcome" role="status" hidden><div class="outcome-icon" aria-hidden="true"><svg class="success-icon" viewBox="0 0 28 28"><path d="m6 14 5 5L22 8"/></svg><svg class="failure-icon" viewBox="0 0 28 28"><path d="m8 8 12 12M20 8 8 20"/></svg></div><span id="outcome-title"></span><small id="outcome-detail"></small></div>
        </div>
        <div class="board-caption"><div class="legend"><span><b class="math">1</b> 单个</span><span><b class="math">1<sup>*</sup></b> 抵消组合</span></div><span id="progress">0 / 216 已翻开</span></div>
        <div class="progress-line" aria-hidden="true"><span id="progress-bar"></span></div>
        <p id="message" class="message" aria-live="polite">点击任意格子开始。首次翻开的周围没有雷。</p>
      </section>
      <aside class="sidebar" aria-label="标记工具">
        <section class="desktop-controls"><div class="side-heading"><h2>当前组</h2><button id="fresh-group" class="text-button" title="准备第一个未使用的组：数值、a、b…">新组</button></div>
          <div id="group-card" class="group-card"><span id="group-symbol"></span><span id="group-caption">待用新组</span></div>
          <p id="merge-prompt" class="merge-prompt" hidden>中键点击另一组，声明两组相等。<br>按 Esc 取消。</p>
          <div class="mouse-keys"><p><span>左键</span><strong>翻开 / 展开</strong></p><p><span>右键</span><strong>标记 / 轮换</strong></p><p><span>中键</span><strong>选组 / 新组</strong></p></div>
          <div class="group-actions"><button id="rotate"><kbd>I</kbd><span>整组 <span class="math">× i</span></span></button><button id="conjugate"><kbd>C</kbd><span>系数共轭</span></button><button id="merge" aria-pressed="false"><kbd>M</kbd><span>合并组</span></button><button id="constant"><kbd>0</kbd><span>数值组</span></button><button id="undo"><kbd>⌘ / Ctrl Z</kbd><span>撤销标记</span></button></div>
        </section>
        <section class="preferences"><label><span>标记提示</span><input id="hints" type="checkbox" role="switch"></label><label><span id="expansion-label">点击展开</span><input id="expansion" type="checkbox" role="switch"></label><button id="share" class="outline">分享棋局</button></section>
        <p class="hint-note">浅灰斜线表示线索已被当前标记满足。标记正确时，展开的邻格才安全。</p>
      </aside>
    </main>
    <footer><span>Complexweeper · Web 1.0.0</span><a id="source-link" href="${base}source.tgz" download>下载源码</a></footer>
  </div>
  <div id="touch-tools" class="touch-tools" role="group" aria-label="触屏分组工具">
    <div class="touch-context"><span id="touch-status" role="status" aria-live="polite"></span><button id="touch-cancel" hidden>取消</button></div>
    <div class="touch-row touch-selection"><label class="touch-group-picker"><span class="sr-only">当前组</span><select id="touch-group" aria-label="当前组"></select></label><button id="touch-new-group">新组</button><button id="touch-undo" aria-label="撤销标记">撤销</button></div>
    <div class="touch-row touch-operations"><button id="touch-rotate" aria-label="当前组乘 i">整组 × i</button><button id="touch-conjugate">系数共轭</button><button id="touch-merge" aria-pressed="false">合并</button></div>
  </div>
  <dialog id="custom-dialog"><form id="custom-form"><div class="dialog-title"><h2>自定义棋盘</h2><button type="button" data-close aria-label="关闭">×</button></div><div class="fields"><label>列数<input name="columns" type="number" min="3" max="40" required></label><label>行数<input name="rows" type="number" min="3" max="30" required></label><label class="wide">雷数<input name="mines" type="number" min="1" required></label></div><p id="custom-error" class="form-error" role="alert"></p><button class="primary" type="submit">开始新对局</button></form></dialog>
  <dialog id="share-dialog"><div class="dialog-title"><h2>分享棋局</h2><button data-close aria-label="关闭">×</button></div><p>对方打开后可从这个局面继续，字母分组也会保留。</p><label class="sr-only" for="share-url">棋局链接</label><textarea id="share-url" readonly spellcheck="false"></textarea><button id="copy-share" class="primary">复制链接</button><p class="dialog-note">链接包含完整棋局，可用于复盘。</p></dialog>
  <dialog id="help-dialog" class="reading-dialog"><div class="dialog-title"><h2>玩法与推理</h2><button data-close aria-label="关闭">×</button></div><p>四种雷是 <span class="math">1、i、−1、−i</span>。每个数字表示周围八格雷的复数和的模长。</p><p><b>空白</b>表示周围没有雷；<b>0</b> 表示有雷且相互抵消。<b>1</b> 表示恰有一颗雷，<b>1*</b> 表示多颗雷抵消后模长为 1。</p><p>用 <span class="math">𝑎、−𝑎、i𝑎、−i𝑎</span> 记录雷之间的相对关系。不同字母可以取相同数值。旋转或共轭只变换当前组的系数；合并表示两个组的基元相等。</p><p>标记化简后至多剩一个非零组项、模长符合线索，并排除额外抵消对后，线索才显示灰色斜线。点击展开以你的标记正确为前提。</p><p><b>完成条件：</b>翻开全部安全格，并使所有线索被当前标记满足；不要求还原雷的绝对相位。</p><p>桌面：左键翻开或展开，右键标记；中键点击标记选中该组，点击其他格子或页面空白准备新组。按 M 后，中键点击另一组完成合并，Esc 取消。</p><p>手机：未标格轻点翻开、长按落当前组标记；已标格轻点时，异组先改归当前组并保留系数，同组才轮换，长按清除；已开格轻点选中线索、长按展开。长按在松手时执行，滑动取消。底栏可选组、新组、整组变换；合并先点棋盘目标组，再点确认。</p><p>键盘：方向键移动，Enter/空格执行左键操作；I 旋转、C 共轭、M 后中键选组进行合并、0 数值组、Esc 取消，Ctrl/⌘ Z 撤销标记。</p></dialog>
  <dialog id="about-dialog" class="reading-dialog">
    <div class="dialog-title"><h2>关于 Complexweeper</h2><button data-close aria-label="关闭">×</button></div>
    <p>本项目是复数扫雷的非官方网页扩展实现。基础玩法与创意来自<a href="https://github.com/Yueqing-Chen/complexweeper-A-minesweeper-game" target="_blank" rel="noopener noreferrer">青月晓（Yueqing-Chen）的 Complexweeper</a>。</p>
    <p>本版本加入 1 / 1* 公开线索、符号分组、条件展开和线索满足胜利等规则。</p>
    <p>作者：<a href="https://github.com/yizhaozhang11" target="_blank" rel="noopener noreferrer">yizhaozhang11</a>。代码由作者本人在 OpenAI Codex 辅助下编写。版本 1.0.0 · 2026-10-08。</p>
    <p>Copyright © 2026 yizhaozhang11。项目自有代码及文档按 <a href="${base}legal/GPL-3.0.txt" target="_blank" rel="noopener noreferrer">GNU GPL 第 3 版（GPL-3.0-only）</a> 发布，可依许可复制、修改和再分发。本程序不提供任何担保，包括适销性或特定用途适用性的担保。</p>
    <p>数学字体为 Latin Modern Math 1.959，作者 B. Jackowski、P. Strzelczyk、P. Pianowski。字体及生成的字形轮廓按 <a href="${base}fonts/GUST-FONT-LICENSE.txt" target="_blank" rel="noopener noreferrer">GUST 字体许可</a> 使用。</p>
    <p><a href="${base}legal/COPYRIGHT.txt" target="_blank" rel="noopener noreferrer">版权与来源说明</a> · <a id="source-version-link" href="${base}source.tgz" download>下载本版本源码与构建说明</a></p>
  </dialog>
  <div id="toast" class="toast" role="status" hidden></div>
  <dialog id="updates-dialog" class="reading-dialog updates-dialog" aria-labelledby="updates-heading">
    <div class="dialog-title"><h2 id="updates-heading">更新说明</h2><button data-close aria-label="关闭更新说明">×</button></div>
    <div class="updates-content"><p class="updates-release" data-update-title></p><div class="updates-body" data-update-body></div></div>
    <p class="updates-caption">关闭后，本次更新不再自动提示。可随时从顶部“更新”重新查看。</p>
    <div class="updates-actions"><a href="${base}changes.html" target="_blank" rel="noopener noreferrer">完整更新记录 ↗</a><button class="primary" data-close autofocus>知道了</button></div>
  </dialog>
`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
for (const [id, url, label] of [
  ['source-link', __SOURCE_LINKS__.repository, 'GitHub'],
  ['source-version-link', __SOURCE_LINKS__.version, 'GitHub（本版本）'],
] as const) {
  if (!url) continue;
  const link = el<HTMLAnchorElement>(id);
  link.href = url;
  link.textContent = label;
  link.removeAttribute('download');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}
const board = el('board');
const finale = endingScene(el('board-frame'), el<HTMLCanvasElement>('ending-canvas'), el('outcome'));
const hintToggle = el<HTMLInputElement>('hints');
const expandToggle = el<HTMLInputElement>('expansion');
hintToggle.checked = preferences.hints;
expandToggle.checked = preferences.expansion;
let buttons: HTMLButtonElement[] = [];
let lastShape = '';

function toast(message: string): void {
  clearTimeout(toastTimer); el('toast').textContent = message; el('toast').hidden = false;
  toastTimer = setTimeout(() => el('toast').hidden = true, 3500);
}

function render(): void {
  const shapeKey = `${puzzle.shape.columns}:${puzzle.shape.rows}`;
  if (shapeKey !== lastShape) {
    lastShape = shapeKey; board.replaceChildren(); buttons = [];
    board.style.setProperty('--columns', String(puzzle.shape.columns));
    board.setAttribute('aria-rowcount', String(puzzle.shape.rows)); board.setAttribute('aria-colcount', String(puzzle.shape.columns));
    board.dataset.columns = String(puzzle.shape.columns);
    for (let row = 0; row < puzzle.shape.rows; row++) {
      const line = document.createElement('div'); line.className = 'grid-row'; line.setAttribute('role', 'row');
      for (let column = 0; column < puzzle.shape.columns; column++) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'tile'; button.setAttribute('role', 'gridcell');
        button.dataset.at = String(buttons.length); line.append(button); buttons.push(button);
      }
      board.append(line);
    }
  }
  const view = observe(puzzle), assessments = assessAll(puzzle);
  touchControls?.sync(view, assessments);
  const touchUI = usesTouchUI(), touchView = touchControls?.view;
  const touchMerging = touchUI && touchView?.mergeSource != null;
  const held = touchUI ? touchView?.pressed ?? -1 : -1;
  const inspected = touchUI ? touchMerging ? -1 : held >= 0 && view[held]?.revealed ? held : touchView?.clue ?? -1 : pointed;
  const explicitPreview = held >= 0 && view[held]?.revealed && touchView?.ready && preferences.expansion;
  const highlighted = new Set((preferences.hints || explicitPreview) && inspected >= 0 ? assessments[inspected]?.candidates : []);
  const pointedBasis = !touchUI && pointed >= 0 ? puzzle.tiles[pointed]?.mark?.basis : undefined;
  let opened = 0, marks = 0;
  buttons.forEach((button, at) => {
    const tile = puzzle.tiles[at], publicTile = view[at], reading = publicTile.reading;
    if (tile.revealed && tile.charge === null) opened++;
    if (tile.mark) marks++;
    const actual = revealActual && ended(puzzle) && tile.charge !== null;
    const shownMark = actual ? { basis: 0, rotation: tile.charge! } : tile.mark;
    const wasHit = puzzle.impact === at;
    let content = '', description = '未翻开';
    if (actual || wasHit) { content = markHTML({ basis: 0, rotation: tile.charge! }); description = `实际雷 ${markText({ basis: 0, rotation: tile.charge! })}`; }
    else if (reading) { content = readingHTML(reading); description = readingText(reading); }
    else if (shownMark) { content = markHTML(shownMark); description = `标记 ${markText(shownMark)}`; }
    const misplaced = ended(puzzle) && tile.mark && tile.charge === null;
    if (misplaced) content += '<span class="wrong" aria-hidden="true">×</span>';
    const classes = ['tile', tile.revealed || actual ? 'uncovered' : 'covered'];
    if (shownMark && !actual && !wasHit) classes.push('marked');
    if (reading && reading.kind !== 'empty' && assessments[at].satisfied && preferences.hints) classes.push('satisfied');
    if (highlighted.has(at)) classes.push('candidate');
    if (tile.mark && (tile.mark.basis === selected || tile.mark.basis === pointedBasis) && !actual) classes.push('related');
    if (merging && tile.mark && tile.mark.basis !== selected) classes.push('merge-target');
    const mergePreview = !!touchMerging && !!tile.mark && tile.mark.basis === touchView?.mergeTarget;
    if (mergePreview) classes.push('touch-merge-preview');
    if (touchUI && at === inspected) classes.push('inspected');
    if (at === held && !touchMerging) classes.push(touchView?.ready ? 'touch-hold-ready' : 'touch-hold');
    if (wasHit) classes.push('impact');
    if (button.className !== classes.join(' ')) button.className = classes.join(' ');
    if (button.innerHTML !== content) button.innerHTML = content;
    button.style.setProperty('--group', shownMark?.basis ? groupColour(shownMark.basis, true) : '#fff');
    button.setAttribute('aria-label', `${Math.floor(at / puzzle.shape.columns) + 1}行${at % puzzle.shape.columns + 1}列，${description}${misplaced ? '，标记位置错误' : ''}`);
    button.dataset.open = String(tile.revealed); button.dataset.mark = tile.mark ? markText(tile.mark) : '';
    button.dataset.satisfied = String(!!reading && reading.kind !== 'empty' && assessments[at].satisfied);
    button.dataset.inspected = String(touchUI && at === inspected);
    button.dataset.mergePreview = String(mergePreview);
    button.tabIndex = at === focused ? 0 : -1;
  });
  for (const button of buttons) {
    const content = button.firstElementChild as HTMLElement | null;
    if (!content || !(content.classList.contains('math') || content.tagName.toLowerCase() === 'math')) continue;
    content.style.fontSize = '';
    const available = button.clientWidth - 2, width = content.getBoundingClientRect().width;
    if (width > available) content.style.fontSize = `${Math.max(10, parseFloat(getComputedStyle(content).fontSize) * available / width)}px`;
  }
  const safe = puzzle.tiles.length - puzzle.shape.mines;
  const waiting = opened === safe && puzzle.stage === 'playing';
  const paused = puzzle.stage === 'playing' && puzzle.clock === null;
  el('state').textContent = paused ? '已暂停' : waiting ? '待满足线索' : { ready: '准备就绪', playing: '进行中', won: '全部解开', lost: '本局结束' }[puzzle.stage];
  el('state').dataset.stage = puzzle.stage;
  el('expansion-label').textContent = touchUI ? '长按展开' : '点击展开';
  el('marked').textContent = String(marks); el('quota').textContent = ` / ${puzzle.shape.mines}`;
  el('time').textContent = clockText(elapsed(puzzle));
  el('progress').textContent = `${opened} / ${safe} 已翻开`; el('progress-bar').style.width = `${100 * opened / safe}%`;
  el('pause-cover').hidden = !paused;
  el('pause').hidden = puzzle.stage !== 'playing' || paused;
  el('board-scroll').inert = paused;
  el('review').hidden = !ended(puzzle);
  el('review-marks').setAttribute('aria-pressed', String(!revealActual)); el('review-field').setAttribute('aria-pressed', String(revealActual));
  el('group-symbol').innerHTML = markHTML({ basis: selected, rotation: 0 }) + (merging ? '<span class="math equation"> = …</span>' : '');
  el('group-symbol').style.setProperty('--group', selected ? groupColour(selected) : '#333');
  el('group-caption').textContent = puzzle.tiles.some(tile => tile.mark?.basis === selected)
    ? selected === 0 ? '数值组' : `${groupName(selected)} 组`
    : '待用新组';
  el('group-card').classList.toggle('merging', merging); el('merge-prompt').hidden = !merging;
  el('merge').setAttribute('aria-pressed', String(merging));
  el<HTMLButtonElement>('undo').disabled = !puzzle.history.length || ended(puzzle) || paused;
  for (const id of ['rotate', 'conjugate', 'fresh-group', 'constant', 'merge']) el<HTMLButtonElement>(id).disabled = ended(puzzle) || paused;
  el('message').textContent = paused ? '继续后，计时与操作将恢复。' : merging ? '请中键点击另一组完成合并；Esc 取消。' : waiting ? '安全格已全部翻开。继续整理标记，使每条线索都满足。' :
    { ready: '点击任意格子开始。首次翻开的周围没有雷。', playing: '记录关系，再翻开你确定安全的格子。', won: '所有安全格已翻开，全部线索已满足。', lost: '踩到雷了。可以切换实际分布，检查刚才的推理。' }[puzzle.stage];
}

function celebrate(): void {
  finale.play(puzzle.stage === 'won', clockText(elapsed(puzzle)),
    puzzle.impact === null ? undefined : buttons[puzzle.impact]);
}

function perform(action: Action): void {
  touchControls?.cancelGesture(false);
  const before = puzzle;
  puzzle = apply(puzzle, action);
  if (before === puzzle) { render(); return; }
  render();
  if (!ended(before) && ended(puzzle)) { merging = false; render(); celebrate(); }
}

function left(at: number): void {
  if (touchControls?.view.mergeSource != null) { touchControls.tap(at); return; }
  if (ended(puzzle) || merging || puzzle.stage === 'playing' && puzzle.clock === null) return;
  const tile = puzzle.tiles[at];
  if (tile.mark) return;
  if (!tile.revealed) perform({ kind: 'open', at });
  else if (preferences.expansion) perform({ kind: 'expand', at });
}

function middle(at: number): void {
  if (touchControls?.view.mergeSource != null) { touchControls.tap(at); return; }
  if (ended(puzzle) || puzzle.stage === 'playing' && puzzle.clock === null) return;
  const mark = puzzle.tiles[at]?.mark;
  if (merging) {
    if (!mark) return;
    const target = mark.basis;
    perform({ kind: 'join', from: target, into: selected });
    if (target === 0) selected = 0;
    merging = false; render(); return;
  }
  if (mark) { selected = mark.basis; render(); }
  else newGroup();
}

function newGroup(): void {
  if (ended(puzzle) || puzzle.stage === 'playing' && puzzle.clock === null) return;
  touchControls?.cancelMerge(false);
  merging = false; selected = nextBasis(puzzle); render();
}

function toggleMerge(): void {
  if (usesTouchUI()) { touchControls?.toggleMerge(); return; }
  if (ended(puzzle) || puzzle.stage === 'playing' && puzzle.clock === null) return;
  if (merging) { merging = false; render(); return; }
  const groups = new Set(puzzle.tiles.flatMap(tile => tile.mark ? [tile.mark.basis] : []));
  if (selected !== 0 && !groups.has(selected) || ![...groups].some(basis => basis !== selected)) { toast('先选中已有组，再与另一组合并。'); return; }
  merging = true; render();
}

function reset(shape: Shape): void {
  puzzle = createPuzzle(shape); selected = 0; merging = false; revealActual = false; pointed = -1; focused = 0;
  finale.clear();
  cancelPress(); touchControls?.reset(); render(); el('board-scroll').scrollLeft = 0;
  const preset = presets.findIndex(item => item.columns === shape.columns && item.rows === shape.rows && item.mines === shape.mines);
  el<HTMLSelectElement>('preset').value = preset < 0 ? 'custom' : String(preset);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

for (const name of ['help', 'about']) el(name).addEventListener('click', () => { touchControls?.cancelGesture(); el<HTMLDialogElement>(`${name}-dialog`).showModal(); });
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog')!.close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
el('restart').addEventListener('click', () => reset(puzzle.shape));
el('fresh-group').addEventListener('click', newGroup);
el('constant').addEventListener('click', () => { selected = 0; merging = false; render(); });
el('rotate').addEventListener('click', () => { if (!merging) perform({ kind: 'turn', basis: selected }); });
el('conjugate').addEventListener('click', () => { if (!merging) perform({ kind: 'reflect', basis: selected }); });
el('merge').addEventListener('click', toggleMerge);
el('undo').addEventListener('click', () => { merging = false; perform({ kind: 'undo' }); render(); });
el('pause').addEventListener('click', () => { cancelPress(); perform({ kind: 'pause' }); });
el('resume').addEventListener('click', () => perform({ kind: 'resume' }));
el('review-marks').addEventListener('click', () => { revealActual = false; render(); });
el('review-field').addEventListener('click', () => { revealActual = true; render(); });
for (const [name, input] of [['hints', hintToggle], ['expansion', expandToggle]] as const) input.addEventListener('change', () => {
  preferences[name] = input.checked;
  try { localStorage.setItem(`complexweeper-v2-${name}`, String(input.checked)); } catch { /* The preference still works for this visit. */ }
  render();
});
el<HTMLSelectElement>('preset').addEventListener('change', event => {
  const value = (event.target as HTMLSelectElement).value;
  if (value !== 'custom') { reset(presets[Number(value)]); return; }
  const form = el<HTMLFormElement>('custom-form');
  for (const name of ['columns', 'rows', 'mines'] as const) (form.elements.namedItem(name) as HTMLInputElement).value = String(puzzle.shape[name]);
  el('custom-error').textContent = ''; el<HTMLDialogElement>('custom-dialog').showModal();
});
el<HTMLFormElement>('custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget as HTMLFormElement);
  try { reset({ columns: Number(data.get('columns')), rows: Number(data.get('rows')), mines: Number(data.get('mines')) }); el<HTMLDialogElement>('custom-dialog').close(); }
  catch (error) { el('custom-error').textContent = (error as Error).message; }
});
el('share').addEventListener('click', () => {
  const url = new URL(location.href); url.hash = `cw=${pack(puzzle)}`;
  el<HTMLTextAreaElement>('share-url').value = url.href; el<HTMLDialogElement>('share-dialog').showModal();
});
el('copy-share').addEventListener('click', async () => {
  const input = el<HTMLTextAreaElement>('share-url');
  try { await navigator.clipboard.writeText(input.value); toast('棋局链接已复制。'); }
  catch { input.select(); toast('已选中链接，请复制。'); }
});

type Press = { pointer: number; at: number; x: number; y: number; button: number; cancelled: boolean };
let press: Press | null = null;
const activePointers = new Set<number>();
function cancelPress(): void { if (press) press.cancelled = true; }
function indexFrom(target: EventTarget | null): number {
  const cell = target instanceof Element ? target.closest<HTMLElement>('[data-at]') : null;
  return cell && board.contains(cell) ? Number(cell.dataset.at) : -1;
}
/** -1 is an eligible background; null leaves an ordinary browser control alone. */
function middleTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element) || document.querySelector('dialog[open]')) return null;
  const at = indexFrom(target);
  if (at >= 0) return at;
  if (target.closest('a,button,input,select,textarea,label,dialog,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="switch"],[role="textbox"]')) return null;
  return -1;
}
function beginPress(event: PointerEvent, at: number): void {
  event.preventDefault();
  if (activePointers.size > 1 || ![1, 2, 4].includes(event.buttons)) { cancelPress(); return; }
  cancelPress();
  press = { pointer: event.pointerId, at, x: event.clientX, y: event.clientY, button: event.button, cancelled: false };
  if (at >= 0) {
    focused = at;
    buttons[at].focus({ preventScroll: true });
  }
}
board.addEventListener('contextmenu', event => event.preventDefault());
board.addEventListener('auxclick', event => event.preventDefault());
board.addEventListener('pointerdown', event => {
  // Middle presses are handled at document level, including page background.
  if (event.pointerType !== 'mouse' || event.button !== 0 && event.button !== 2) return;
  const at = indexFrom(event.target);
  if (at >= 0) beginPress(event, at);
});
document.addEventListener('pointerdown', event => { activePointers.add(event.pointerId); if (activePointers.size > 1) cancelPress(); }, true);
document.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 1) return;
  const at = middleTarget(event.target);
  if (at !== null) beginPress(event, at);
});
document.addEventListener('mousedown', event => {
  if (![1, 2, 4].includes(event.buttons)) cancelPress();
  if (event.button === 1 && middleTarget(event.target) !== null) event.preventDefault();
});
document.addEventListener('auxclick', event => {
  if (event.button === 1 && middleTarget(event.target) !== null) event.preventDefault();
});
document.addEventListener('pointermove', event => {
  if (press?.pointer !== event.pointerId) return;
  const mixedButtons = event.buttons !== [1, 4, 2][press.button];
  if (mixedButtons || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) cancelPress();
});
document.addEventListener('pointerup', event => {
  activePointers.delete(event.pointerId);
  const current = press;
  if (!current || current.pointer !== event.pointerId) return;
  press = null;
  if (current.cancelled || event.button !== current.button) return;
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const releasedAt = current.button === 1 ? middleTarget(target) : indexFrom(target);
  if (releasedAt !== current.at) return;
  if (current.button === 0) left(current.at);
  else if (current.button === 2 && !merging && touchControls?.view.mergeSource == null) perform({ kind: 'cycle', at: current.at, basis: selected });
  else if (current.button === 1) middle(current.at);
});
document.addEventListener('pointercancel', event => { activePointers.delete(event.pointerId); cancelPress(); });
document.addEventListener('wheel', cancelPress, { passive: true, capture: true });
document.addEventListener('scroll', cancelPress, true);
window.addEventListener('blur', () => { cancelPress(); activePointers.clear(); });
board.addEventListener('pointerover', event => { if (event.pointerType !== 'mouse') return; const at = indexFrom(event.target); if (at !== pointed) { pointed = at; render(); } });
board.addEventListener('pointerleave', () => { pointed = -1; render(); });
board.addEventListener('focusin', event => { const at = indexFrom(event.target); if (at >= 0) { focused = at; pointed = at; render(); } });
board.addEventListener('keydown', event => {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.shape.columns, ArrowDown: puzzle.shape.columns };
  if (event.key in offsets) {
    event.preventDefault();
    const target = focused + offsets[event.key];
    if (target >= 0 && target < buttons.length && (!(event.key === 'ArrowLeft' || event.key === 'ArrowRight') || Math.floor(target / puzzle.shape.columns) === Math.floor(focused / puzzle.shape.columns))) {
      focused = target; buttons[target].focus(); render();
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (usesTouchUI()) { if (!event.repeat) event.shiftKey ? touchControls?.hold(focused) : touchControls?.tap(focused); }
    else left(focused);
  }
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); merging = false; touchControls?.cancelMerge(false); perform({ kind: 'undo' }); render(); return; }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Escape') { merging = false; touchControls?.cancelMerge(false); render(); }
  else if (key === 'i' && !merging && touchControls?.view.mergeSource == null) perform({ kind: 'turn', basis: selected });
  else if (key === 'c' && !merging && touchControls?.view.mergeSource == null) perform({ kind: 'reflect', basis: selected });
  else if (key === 'm') toggleMerge();
  else if (key === '0') { selected = 0; merging = false; touchControls?.cancelMerge(false); render(); }
});

function loadHash(): void {
  if (!location.hash) return;
  if (!location.hash.startsWith('#cw=')) { toast('无法读取棋局链接，请复制完整的分享链接。'); return; }
  try {
    const restored = unpack(location.hash.slice(4));
    cancelPress(); puzzle = restored; selected = 0; merging = false; revealActual = false; focused = 0; pointed = -1;
    touchControls?.reset();
    finale.clear();
    const preset = presets.findIndex(item => item.columns === puzzle.shape.columns && item.rows === puzzle.shape.rows && item.mines === puzzle.shape.mines);
    el<HTMLSelectElement>('preset').value = preset < 0 ? 'custom' : String(preset); render();
  } catch (error) { toast((error as Error).message); }
}
function updateInputLayout(): void {
  cancelPress(); touchControls?.cancelMerge(false); merging = false;
  document.documentElement.classList.toggle('touch', usesTouchUI());
  render();
}

touchControls = createTouchControls({
  board,
  toolbar: el('touch-tools'),
  getPuzzle: () => puzzle,
  getSelected: () => selected,
  select: basis => { selected = basis; merging = false; },
  perform,
  refresh: render,
  focus: at => { focused = at; },
  hintsEnabled: () => preferences.hints,
  expansionEnabled: () => preferences.expansion,
  toast,
});
touchDevice.addEventListener('change', updateInputLayout);
narrowWindow.addEventListener('change', updateInputLayout);
updateInputLayout();
window.addEventListener('hashchange', loadHash);
render(); loadHash();

initializeUpdates({
  notes: __CHANGE_NOTES__,
  dialog: el<HTMLDialogElement>('updates-dialog'),
  button: el<HTMLButtonElement>('updates'),
  baseURL: base,
  automatic: import.meta.env.PROD,
  beforeOpen: () => { cancelPress(); perform({ kind: 'pause' }); },
});

document.fonts.ready.then(render);
setInterval(() => el('time').textContent = clockText(elapsed(puzzle)), 250);
