import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classify, graph } from './candidates.mjs';

const raw = readFileSync(new URL('./inputs.json', import.meta.url));
const inputs = JSON.parse(raw).cases;
const frozen = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url)));

test('frozen exact input bytes and classifications, including huge parity', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), frozen.input_sha256);
  assert.equal(inputs.length, 40);
  for (let i = 0; i < inputs.length; i += 1) {
    const given = inputs[i];
    assert.equal(given.id, frozen.cases[i].id);
    assert.deepEqual(classify(given.x, given.y), frozen.cases[i].classification, given.id);
  }
});

test('independent JS binary64 graphs match exact-rational steps and trace hashes', () => {
  for (let i = 0; i < inputs.length; i += 1) {
    const given = inputs[i];
    for (const name of ['sequential-late', 'binary-late', 'binary-early']) {
      assert.deepEqual(graph(given.x, given.y, name), frozen.cases[i].graphs[name], `${given.id}/${name}`);
    }
  }
});
