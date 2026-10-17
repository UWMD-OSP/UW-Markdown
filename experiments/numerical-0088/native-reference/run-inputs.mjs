// Complete frozen raw-operand stream, with NaN payloads explicitly unclaimed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../pinned-fdlibm/run.mjs';
const inputs = JSON.parse(readFileSync(new URL('./inputs.json', import.meta.url), 'utf8')).cases;
const rows = inputs.map(input => {
  const row = run(input);
  return row.kind === 'nan' ? { id: row.id, op: row.op, kind: 'nan', bits: null } : row;
});
assert.equal(new Set(rows.map(row => row.id)).size, inputs.length);
const counts = Object.fromEntries(['pow','log','exp','sqrt','scalbn','fabs','copysign'].map(op => [op, rows.filter(row => row.op === op).length]));
assert(Object.values(counts).every(count => count > 0));
const text = `${JSON.stringify(rows, null, 2)}\n`;
const index = process.argv.indexOf('--output');
if (index >= 0) {
  const output = resolve(process.argv[index + 1]);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, text);
}
console.log(JSON.stringify({ scope: 'raw candidate observations, not oracle answers', cases: rows.length, counts,
  sha256: createHash('sha256').update(text).digest('hex') }));
