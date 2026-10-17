import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyReplay } from './reproduce.mjs';

const frozenUrl = new URL('observations.json', import.meta.url);
const frozen = readFileSync(frozenUrl);
const identities = JSON.parse(readFileSync(new URL('integration-identities-afcc.json', import.meta.url), 'utf8'));
const historical = JSON.parse(frozen.toString('utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const current = () => ({ ...clone(historical), production_hashes: clone(identities.approved_current.production_hashes) });

test('reviewed source identity transition preserves every frozen behavioral field', () => {
  verifyReplay(current(), frozen, identities);
  assert.notDeepStrictEqual(identities.historical.production_hashes, identities.approved_current.production_hashes);
});

test('a changed or omitted current source identity is refused', () => {
  const changed = current();
  changed.production_hashes['packages/uwmd-verify/src/receipts.ts'] = '0'.repeat(64);
  assert.throws(() => verifyReplay(changed, frozen, identities), /approved current source identities/);
  delete changed.production_hashes['packages/uwmd-verify/src/receipts.ts'];
  assert.throws(() => verifyReplay(changed, frozen, identities), /approved current source identities/);
});

test('frozen byte tampering is refused even when parsed observations are unchanged', () => {
  assert.throws(() => verifyReplay(current(), Buffer.concat([frozen, Buffer.from(' ')]), identities), /frozen observations SHA-256/);
});

test('historical source metadata is checked separately from the frozen file hash', () => {
  const changed = clone(identities);
  changed.historical.production_hashes['packages/uwmd-verify/src/receipts.ts'] = '0'.repeat(64);
  assert.throws(() => verifyReplay(current(), frozen, changed), /historical source identities/);
});

test('numeric words, receipt outcomes, backend calls and extra behavioral fields are refused', () => {
  const mutations = [
    value => { value.irr_zero.actual.result.value = 0; },
    value => { value.irr_zero.actual.result.bits = '0000000000000000'; },
    value => { value.receipts.cases[0].verdict = 'failed'; },
    value => { value.receipts.cases[0].backend_calls++; },
    value => { value.extra_behavior = true; },
  ];
  for (const mutate of mutations) {
    const changed = current();
    mutate(changed);
    assert.throws(() => verifyReplay(changed, frozen, identities), /all frozen behavioral observations/);
  }
});

test('former write option is refused without overwriting frozen evidence', () => {
  const before = createHash('sha256').update(readFileSync(frozenUrl)).digest('hex');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('reproduce.mjs', import.meta.url)), '--write'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /read-only replay accepts no arguments/);
  assert.equal(createHash('sha256').update(readFileSync(frozenUrl)).digest('hex'), before);
});

test('the previous reviewed identity map cannot be silently replaced', () => {
  const changed = clone(identities);
  changed.predecessor.sha256 = '0'.repeat(64);
  assert.throws(() => verifyReplay(current(), frozen, changed), /preserved predecessor identity manifest/);
});
