// SPDX-FileCopyrightText: 2026 yizhaozhang11
// SPDX-License-Identifier: GPL-3.0-only

import { mkdirSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const project = process.cwd();
const cache = resolve(project, '.cache');
const manifest = JSON.parse(readFileSync(resolve(project, 'package.json'), 'utf8'));
const entries = ['package.json', ...manifest.files];
const missing = entries.filter(path => !existsSync(resolve(project, path)));
if (missing.length) throw new Error('Source archive inputs are missing: ' + missing.join(', '));

mkdirSync(cache, { recursive: true });
copyFileSync(resolve(project, 'LICENSE'), resolve(project, 'public/legal/GPL-3.0.txt'));
copyFileSync(resolve(project, 'COPYRIGHT'), resolve(project, 'public/legal/COPYRIGHT.txt'));
const archive = resolve(cache, 'complexweeper-source.tgz');
execFileSync('tar', ['-czf', archive, ...entries], { cwd: project, stdio: 'pipe' });
copyFileSync(archive, resolve(project, 'public/source.tgz'));
console.log('Updated corresponding source archive.');
