import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { evaluate, quantize } from './cash_candidates.mjs';

const raw = readFileSync(new URL('./inputs.json', import.meta.url));
const inputs = JSON.parse(raw);
const frozen = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url)));

test('independent JS executes all new cash graphs and exact intermediate traces', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), frozen.input_sha256);
  assert.equal(inputs.cases.length, 10);
  for (let i = 0; i < inputs.cases.length; i += 1) {
    const given = inputs.cases[i];
    assert.equal(given.id, frozen.cases[i].id);
    for (const name of ['sequential-late', 'binary-late', 'binary-early']) {
      assert.deepEqual(evaluate(given, name), frozen.cases[i].graphs[name], `${given.id}/${name}`);
    }
  }
});

test('native ECMAScript decimal boundary independently matches rational frozen answers', () => {
  assert.equal(inputs.quantization_controls.length, 10);
  for (let i = 0; i < inputs.quantization_controls.length; i += 1) {
    const given = inputs.quantization_controls[i];
    assert.deepEqual(quantize(given.bits, given.places), frozen.quantization_controls[i].boundary, given.id);
  }
});
