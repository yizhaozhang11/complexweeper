// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

export type ChangeNotes = { deploymentId: string; version: string; title: string; html: string };

export function initializeUpdates(options: {
  notes: ChangeNotes;
  dialog: HTMLDialogElement;
  button: HTMLButtonElement;
  baseURL: string;
  automatic: boolean;
  beforeOpen: () => void;
}): void {
  const { notes, dialog, button, baseURL, automatic, beforeOpen } = options;
  // Origin storage is shared by GitHub Pages repositories, so include the base path.
  // One key per deployment also prevents an older open tab from overwriting a newer acknowledgement.
  const scope = new URL(baseURL, location.href).pathname;
  const key = 'complexweeper:updates:' + scope + ':' + notes.deploymentId;
  const stores = ['localStorage', 'sessionStorage'] as const;

  const remembered = (): boolean => stores.some(name => {
    try { return window[name].getItem(key) === 'read'; }
    catch { return false; }
  });
  const remember = (): void => {
    for (const name of stores) {
      try { window[name].setItem(key, 'read'); }
      catch { /* A blocked or full store must never prevent closing the dialog. */ }
    }
  };
  const show = (): void => {
    if (dialog.open) return;
    beforeOpen();
    dialog.showModal();
  };

  dialog.dataset.deploymentId = notes.deploymentId;
  dialog.dataset.version = notes.version;
  dialog.querySelector<HTMLElement>('[data-update-title]')!.textContent = notes.title;
  // This HTML is rendered at build time from the repository's authored CHANGELOG.md.
  const body = dialog.querySelector<HTMLElement>('[data-update-body]')!;
  body.innerHTML = notes.html;
  for (const link of body.querySelectorAll<HTMLAnchorElement>('a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  dialog.addEventListener('close', remember);
  button.addEventListener('click', show);
  if (automatic && !remembered()) show();
}
