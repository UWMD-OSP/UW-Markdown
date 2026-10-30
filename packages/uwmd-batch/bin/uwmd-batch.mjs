#!/usr/bin/env node
import { buildUWMDFactTable, indexUWMDDirectory, writeUWMDCollectionIndex, writeUWMDFactTable } from '../dist/index.js';
const argv = process.argv.slice(2);
const facts = argv.includes('--facts');
const args = argv.filter((arg) => arg !== '--facts');
const [input, ...rest] = args;
const out = rest[0] === '--out' ? rest[1] : undefined;
if (!input || !out) {
  console.error('Usage: uwmd-batch <input-directory> --out <output-directory> [--facts]');
  process.exitCode = 2;
} else {
  const index = await indexUWMDDirectory(input);
  const files = await writeUWMDCollectionIndex(index, out);
  const outputs = { ...files };
  if (facts) {
    const table = await buildUWMDFactTable(input);
    const factFiles = await writeUWMDFactTable(table, out);
    outputs.facts_jsonl = factFiles.jsonl;
    outputs.facts_manifest = factFiles.manifest;
  }
  console.log(JSON.stringify({ ...index, outputs }, null, 2));
  if (index.invalid_deals > 0) process.exitCode = 1;
}
