#!/usr/bin/env node
// Regenerate conformance/expected/ outputs by running the reference CLI
// against each fixture. Run from repo root: `node scripts/regen-conformance.mjs`.
//
// If this script changes any expected output, that's a normative change to
// the protocol — call it out in the PR and bump the protocol version.

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUWFile, render } from '../packages/uwmd-core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

async function regenTier1() {
  const fixturesDir = join(repoRoot, 'conformance', 'tier-1-reader', 'fixtures');
  const expectedDir = join(repoRoot, 'conformance', 'tier-1-reader', 'expected');
  if (!existsSync(expectedDir)) {
    await mkdir(expectedDir, { recursive: true });
  }

  const entries = (await readdir(fixturesDir)).filter(f => f.endsWith('.uw.md'));
  for (const entry of entries) {
    const id = basename(entry, '.uw.md');
    const raw = await readFile(join(fixturesDir, entry), 'utf8');
    const parsed = parseUWFile(raw);

    // Canonicalized parse output — strip the `raw` field (huge, redundant).
    const canonical = JSON.parse(JSON.stringify(parsed, (k, v) => k === 'raw' ? undefined : v));
    await writeFile(
      join(expectedDir, `${id}.parsed.json`),
      `${JSON.stringify(canonical, null, 2)}\n`,
    );

    const summary = render(parsed, { format: 'summary' });
    await writeFile(join(expectedDir, `${id}.rendered-summary.md`), summary.content);

    const chat = render(parsed, { format: 'chat' });
    await writeFile(join(expectedDir, `${id}.rendered-chat.txt`), chat.content);

    console.log(`  ✓ ${entry} → expected/${id}.{parsed.json, rendered-summary.md, rendered-chat.txt}`);
  }
}

console.log('Tier-1 Reader fixtures:');
await regenTier1();
console.log('Done.');
