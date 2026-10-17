// Direct invocation works on Node18.0; no node:test/--test floor assumption.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { classify, graph } from './hybrid.mjs';
const raw = readFileSync(new URL('./inputs.json', import.meta.url));
const inputs = JSON.parse(raw).cases;
const evidence = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url)));
assert.equal(createHash('sha256').update(raw).digest('hex'), evidence.input_sha256);
assert.equal(inputs.length, evidence.cases.length);
for (let i = 0; i < inputs.length; i += 1) {
  const input = inputs[i];
  const expected = evidence.cases[i];
  assert.equal(input.id, expected.id);
  assert.deepEqual(classify(input.x, input.y), expected.classification, `${input.id}/classification`);
  assert.deepEqual(graph(input.x, input.y), expected.graph, `${input.id}/result-trace`);
}
for (const text of ['bad', '3FF0000000000000', '0'.repeat(17)]) {
  assert.throws(() => classify(text, '0000000000000000'), RangeError);
}
console.log(`PASS ${inputs.length} independent JS classifications and result/trace records`);
