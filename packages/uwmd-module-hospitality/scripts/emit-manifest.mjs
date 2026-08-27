#!/usr/bin/env node
// Emit dist/manifest.json from the typed manifest.
//
// The JSON is what a host without a TypeScript toolchain fetches — RFC 0006's
// "bundling" question, answered as both: the npm package for TS consumers, a
// standalone JSON artifact for everyone else. Generated rather than
// hand-maintained so the two cannot disagree.

import { writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// pathToFileURL, not a bare path: a Windows absolute path is `C:\...`, and
// ESM `import()` reads that leading drive letter as an unsupported URL scheme.
const { HOSPITALITY_MODULE } = await import(pathToFileURL(join(root, 'dist', 'index.js')).href);

writeFileSync(
  join(root, 'dist', 'manifest.json'),
  `${JSON.stringify(HOSPITALITY_MODULE, null, 2)}\n`,
  'utf8',
);
console.log(`@uwmd/module-hospitality: emitted dist/manifest.json (${HOSPITALITY_MODULE.id}@${HOSPITALITY_MODULE.version})`);
