// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { deploymentId, parseChangeNotes } from './tools/change-notes.ts';

export default defineConfig(({ command }) => {
  const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const notes = parseChangeNotes(readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8'));
  const repository = process.env.CW_REPOSITORY_URL?.trim().replace(/\/+$/, '') || (process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}` : null);
  if (repository && new URL(repository).protocol !== 'https:') throw new Error('The source repository must use an HTTPS URL.');
  const revision = process.env.CW_SOURCE_REVISION?.trim() || process.env.GITHUB_SHA;
  return {
    define: {
      __SOURCE_LINKS__: JSON.stringify({
        repository,
        version: repository && revision ? `${repository}/tree/${encodeURIComponent(revision)}` : null,
      }),
      __CHANGE_NOTES__: JSON.stringify({
        deploymentId: deploymentId(command === 'build', process.env.CW_DEPLOYMENT_ID),
        version: manifest.version,
        ...notes.entries[0],
      }),
    },
  };
});
