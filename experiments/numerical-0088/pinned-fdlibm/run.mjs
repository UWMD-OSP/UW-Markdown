// Portable JSONL raw candidate entry. No evaluator or public wrapper is invoked.
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import * as kernel from './kernel.mjs';
import { fromBits, toBits } from './words.mjs';
export function run(record) {
  if (!record || typeof record !== 'object') throw new TypeError('Expected input record');
  const { op } = record;
  if (!['pow', 'log', 'exp', 'sqrt', 'scalbn', 'copysign', 'fabs'].includes(op)) throw new RangeError('Unknown raw operation');
  const x = fromBits(record.x);
  const y = op === 'pow' || op === 'copysign' ? fromBits(record.y) : record.n;
  const value = kernel[op](x, y);
  const kind = Number.isNaN(value) ? 'nan' : Number.isFinite(value) ? 'finite' : 'infinity';
  return { id: record.id, op, kind, bits: toBits(value) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    console.log(JSON.stringify(run(JSON.parse(line))));
  }
}
