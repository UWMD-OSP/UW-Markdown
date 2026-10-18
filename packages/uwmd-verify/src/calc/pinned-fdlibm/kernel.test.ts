import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as K from './kernel.js';
import { fromBits, toBits } from './words.js';

const root = resolve(__dirname, '../../../../..');
const lab = resolve(root, 'experiments/numerical-0088');
type Operand = { id: string; op: keyof typeof K; x: string; y?: string; n?: number };
type Native = { id: string; op: string; native_bits: string; native_class: string };
const inputs = JSON.parse(readFileSync(resolve(lab, 'native-reference/inputs.json'), 'utf8')).cases as Operand[];
const archive = unzipSync(readFileSync(resolve(lab, 'native-reference/evidence/run-38993665625/native-research-ubuntu-latest-gcc-false.zip')));
const native = JSON.parse(strFromU8(archive['results.json']!)) as Native[];

describe('selected fdlibm procedure port', () => {
  it('retains the exact ordered research graph after type erasure', () => {
    const erase = (text: string) => ts.transpileModule(text, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true,
      newLine: ts.NewLineKind.LineFeed,
    } }).outputText;
    const original = readFileSync(resolve(lab, 'pinned-fdlibm/kernel.mjs'), 'utf8').replaceAll('.mjs', '.js');
    expect(erase(readFileSync(resolve(__dirname, 'kernel.ts'), 'utf8'))).toBe(erase(original));
  });

  it.each(['pow', 'exp', 'log', 'sqrt', 'scalbn', 'copysign', 'fabs'] as const)(
    'matches independent native procedure words for %s (NaNs by class)', op => {
      expect(inputs).toHaveLength(4204);
      expect(native).toHaveLength(inputs.length);
      let checked = 0;
      inputs.forEach((row, index) => {
        if (row.op !== op) return;
        const expected = native[index]!;
        expect(expected.id).toBe(row.id);
        expect(expected.op).toBe(op);
        const x = fromBits(row.x);
        const y = row.y === undefined ? 0 : fromBits(row.y);
        const value = op === 'pow' || op === 'copysign' ? K[op](x, y)
          : op === 'scalbn' ? K.scalbn(x, row.n!) : K[op](x);
        if (expected.native_class === 'nan') expect(Number.isNaN(value), row.id).toBe(true);
        else expect(toBits(value), row.id).toBe(expected.native_bits);
        checked++;
      });
      expect(checked).toBeGreaterThan(0);
    });
});
