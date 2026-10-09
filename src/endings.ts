// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import './endings.css';

/** Presentation only: this scene receives an already-decided game outcome. */
export function endingScene(frame: HTMLElement, canvas: HTMLCanvasElement, badge: HTMLElement) {
  const ink = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let tick = 0;
  let dismiss: ReturnType<typeof setTimeout> | undefined;

  function clear() {
    cancelAnimationFrame(tick);
    clearTimeout(dismiss);
    canvas.hidden = true;
    badge.hidden = true;
    frame.classList.remove('finish-win', 'finish-loss');
    if (ink) ink.clearRect(0, 0, canvas.width, canvas.height);
  }

  function play(won: boolean, description: string, hit?: HTMLElement) {
    clear();
    const duration = won ? 3000 : 2100;
    badge.dataset.result = won ? 'win' : 'loss';
    badge.querySelector('#outcome-title')!.textContent = won ? '全部解开' : '本局结束';
    badge.querySelector('#outcome-detail')!.textContent = description;
    badge.hidden = false;
    frame.classList.add(won ? 'finish-win' : 'finish-loss');
    dismiss = setTimeout(clear, duration);
    if (reduced.matches || !ink) return;

    const bounds = frame.getBoundingClientRect();
    const width = frame.clientWidth, height = frame.clientHeight;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    canvas.hidden = false;
    const impact = hit?.getBoundingClientRect();
    const origin = won || !impact ? [width / 2, height / 2]
      : [Math.max(10, Math.min(width - 10, impact.left + impact.width / 2 - bounds.left)),
        Math.max(10, Math.min(height - 10, impact.top + impact.height / 2 - bounds.top))];
    const shades = ['#66ab96', '#65a3c6', '#aa86c9', '#dfb257', '#d78c9e'];
    const pieces = Array.from({ length: 26 }, (_, index) => ({
      angle: index / 26 * Math.PI * 2,
      speed: 155 + (index * 37 % 120),
      delay: index % 4 * .018,
      colour: shades[index % shades.length],
      long: 5 + index % 4,
      spin: index % 2 ? 5 : -4,
    }));
    const started = performance.now();

    const draw = (now: number) => {
      if (reduced.matches) { canvas.hidden = true; return; }
      const seconds = (now - started) / 1000;
      ink.setTransform(density, 0, 0, density, 0, 0);
      ink.clearRect(0, 0, width, height);
      ink.save();
      const waveProgress = Math.min(seconds / (won ? 1.05 : .85), 1);
      const radius = 12 + (1 - (1 - waveProgress) ** 3) * (won ? Math.min(width, height) * .53 : 100);
      ink.globalAlpha = (1 - waveProgress) * (won ? .52 : .62);
      ink.lineWidth = won ? 2.2 : 2;
      const gradient = ink.createLinearGradient(origin[0] - radius, origin[1], origin[0] + radius, origin[1]);
      gradient.addColorStop(0, won ? '#67b498' : '#c98866');
      gradient.addColorStop(.5, won ? '#74b6ce' : '#b97b66');
      gradient.addColorStop(1, won ? '#b998d5' : '#e8b096');
      ink.strokeStyle = gradient;
      ink.beginPath(); ink.arc(origin[0], origin[1], radius, 0, Math.PI * 2); ink.stroke();
      ink.restore();

      if (won) for (const piece of pieces) {
        const age = seconds - piece.delay;
        if (age < 0 || age > 2.6) continue;
        const travel = piece.speed * (1 - Math.exp(-age * 2));
        const x = origin[0] + Math.cos(piece.angle) * travel;
        const y = origin[1] - 38 + Math.sin(piece.angle) * travel * .7 - age * 50 + age * age * 55;
        ink.save();
        ink.globalAlpha = Math.min(age * 12, 1) * Math.max(0, 1 - Math.max(0, age - 1.35) / 1.25);
        ink.translate(x, y); ink.rotate(piece.angle + age * piece.spin);
        ink.fillStyle = piece.colour;
        ink.fillRect(-piece.long / 2, -2, piece.long, 3.5);
        ink.restore();
      }
      if (seconds < (won ? 2.8 : 1)) tick = requestAnimationFrame(draw);
    };
    tick = requestAnimationFrame(draw);
  }
  return { play, clear };
}
