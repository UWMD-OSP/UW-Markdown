#!/usr/bin/env node
import { indexUWMDDirectory, writeUWMDCollectionIndex } from '../dist/index.js';
const [input, ...args] = process.argv.slice(2);
const out = args[0] === '--out' ? args[1] : undefined;
if (!input || !out) { console.error('Usage: uwmd-batch <input-directory> --out <output-directory>'); process.exitCode = 2; }
else { const index = await indexUWMDDirectory(input); const files = await writeUWMDCollectionIndex(index, out); console.log(JSON.stringify({ ...index, outputs: files }, null, 2)); if (index.invalid_deals > 0) process.exitCode = 1; }