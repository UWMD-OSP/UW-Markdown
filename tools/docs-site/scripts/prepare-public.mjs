#!/usr/bin/env node

import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..', '..');

const files = [
  ['docs/site-assets/og-v2.png', 'og-v2.png'],
  ['tools/web-viewer/index.html', 'viewer/app/index.html'],
  ['examples/Parkview-Apts-Glendale-AZ.uwx.md', 'viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md'],
  ['examples/Riverside-Office-Phoenix-AZ.uwx.md', 'viewer/samples/Riverside-Office-Phoenix-AZ.uwx.md'],
  ['examples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md', 'viewer/samples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md'],
  ['examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md', 'viewer/samples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md'],
  ['examples/Sonoran-Self-Storage-Peoria-AZ.uwx.md', 'viewer/samples/Sonoran-Self-Storage-Peoria-AZ.uwx.md'],
  ['examples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md', 'viewer/samples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md'],
  ['examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md', 'viewer/samples/Agave-Court-Apts-Scottsdale-AZ.uwx.md'],
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
const editorOutput = join(siteRoot, 'public', 'editor');
// The web-editor's Vite output uses content-hashed asset names. Replacing the
// complete published bundle prevents old generations from accumulating here.
await rm(editorOutput, { recursive: true, force: true });
await cp(join(repoRoot, 'tools', 'web-editor', 'dist'), editorOutput, { recursive: true });
console.log('[public] editor/');
