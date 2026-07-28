#!/usr/bin/env node

import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..', '..');

const files = [
  ['docs/site-assets/og.png', 'og.png'],
  ['docs/downloads/templates/blank-screener.uw.md', 'downloads/templates/blank-screener.uw.md'],
  ['docs/downloads/templates/blank-analyst.uw.md', 'downloads/templates/blank-analyst.uw.md'],
  ['tools/web-viewer/index.html', 'downloads/programs/uwmd-viewer.html'],
  ['docs/downloads/ai/UWMD-AI-GUIDE.md', 'downloads/ai/UWMD-AI-GUIDE.md'],
  ['docs/downloads/ai/CLAUDE.md', 'downloads/ai/CLAUDE.md'],
  ['docs/downloads/ai/GEMINI.md', 'downloads/ai/GEMINI.md'],
  ['docs/downloads/ai/chatgpt-project-instructions.txt', 'downloads/ai/chatgpt-project-instructions.txt'],
  ['docs/downloads/ai/uwmd-skill/SKILL.md', 'downloads/ai/uwmd-skill/SKILL.md'],
  ['docs/downloads/llms.txt', 'llms.txt'],
  ['docs/downloads/llms-full.txt', 'llms-full.txt'],
];

for (const [source, destination] of files) {
  const output = join(siteRoot, 'public', destination);
  await mkdir(dirname(output), { recursive: true });
  await copyFile(join(repoRoot, source), output);
  console.log(`[public] ${destination}`);
}
