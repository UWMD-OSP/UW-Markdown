import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { controls } from './controls.mjs';
import { verifyExamples } from './verifier.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
for (const [name, run] of controls(root)) test(name, run);
test('every builtin example matches its recorded evidence, including findings', () => {
  const expected = JSON.parse(readFileSync(resolve(root, 'conformance/metrics/expected.json'), 'utf8'));
  assert.deepEqual(verifyExamples(root), expected);
});
