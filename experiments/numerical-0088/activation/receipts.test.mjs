// Actual production verifyReceipt; no source loader or proposal implementation.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import * as api from '../../../packages/uwmd-verify/dist/index.js';
const source = readFileSync(new URL('../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md', import.meta.url), 'utf8');
// Public test-only key. No production identity or trust assertion.
const privateKey = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${'11'.repeat(32)}`, 'hex'), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(privateKey);
const identity = { engine: api.VERIFY_PACKAGE_NAME, engine_version: 'rfc0088-production-test' };
const pack = { ...api.getPackForAssetClass('multifamily'), id: 'test.rfc0088.activation', version: '1.0.0', calculations: [{ id: 'scalar', label: 'Fixed scalar control', formula: 'pow(1.2,31)', deterministic: true, round_to: 12 }] };
// Same test descriptor, deliberately altered declaration: refusal-context control,
// not two lawful definitions of one published pack version.
const refusingPack = { ...pack, calculations: [{ ...pack.calculations[0], formula: 'irr(1,1)' }] };
const rows = [];
let issued;
function signed(receipt, invalid = false) {
  const copy = structuredClone(receipt);
  const bytes = sign(null, Buffer.from(api.receiptSigningPayload(copy)), privateKey);
  if (invalid) bytes[0] ^= 1;
  copy.signature = { algorithm: 'ed25519', key_id: 'public-test-only', value: bytes.toString('base64') };
  return copy;
}
function projected(result) { return { verdict: result.verdict, codes: result.issues.map(issue => issue.code), recomputed: Object.hasOwn(result, 'recomputed') }; }
async function check(id, expected, { receipt = signed(issued), content = source, packs = [pack], inputs, backend = 'crypto', calls = 1 } = {}) {
  const snapshot = JSON.stringify(receipt);
  let actualCalls = 0;
  const options = { ...identity, packs, ...(inputs ? { inputs } : {}) };
  if (backend !== 'missing') options.signatureVerifier = { async verify(actual, payload) {
    actualCalls++;
    assert.equal(payload, api.canonicalize({ ...actual, signature: null }));
    if (backend === 'throws') throw new Error('test-backend-transport');
    return verify(null, Buffer.from(payload), publicKey, Buffer.from(actual.signature.value, 'base64'));
  } };
  let result;
  let thrown;
  try { result = await api.verifyReceipt(receipt, content, options); }
  catch (error) { thrown = { name: error.name, message: error.message, code: error.code }; }
  const row = { id, receipt, signing_payload: api.receiptSigningPayload(receipt), result: result ?? null, thrown: thrown ?? null, backend_calls: actualCalls };
  rows.push(row);
  assert.equal(JSON.stringify(receipt), snapshot, id);
  assert.equal(actualCalls, calls, id);
  if (expected === 'throws') assert.equal(thrown?.message, 'test-backend-transport', id);
  else { assert.equal(thrown, undefined, id); assert.deepEqual(projected(result), expected, id);
    if (packs[0] === refusingPack && expected.recomputed) assert.deepEqual(result.recomputed, [], id);
  }
}
const expected = (verdict, codes, recomputed) => ({ verdict, codes, recomputed });
before(async () => {
  issued = await api.issueReceipt(source, { ...identity, pack, filename: 'control.uwx.md', issued_at: '2026-10-18T00:00:00.000Z', issuer: 'RFC0088 production activation test' });
  assert.equal(issued.computation.results[0].value, 284.851576559723);
});
after(() => {
  if (process.env.ACTIVATION_RECEIPT_OUTPUT) {
    assert(!existsSync(process.env.ACTIVATION_RECEIPT_OUTPUT));
    writeFileSync(process.env.ACTIVATION_RECEIPT_OUTPUT, `${JSON.stringify({ node: process.version, v8: process.versions.v8, openssl: process.versions.openssl, public_key_spki_base64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), issued, rows }, null, 2)}\n`);
  }
});
test('authentication precedes actual financial refusal and retains unsigned refusal', async () => {
  await check('invalid-refusal', expected('failed', ['RCP-01'], false), { receipt: signed(issued, true), packs: [refusingPack] });
  await check('valid-refusal', expected('failed', ['RCP-03'], true), { packs: [refusingPack] });
  await check('unsigned-refusal', expected('failed', ['RCP-03'], true), { receipt: issued, packs: [refusingPack], calls: 0 });
  await check('missing-backend-refusal', expected('unverifiable', ['RCP-08'], false), { backend: 'missing', packs: [refusingPack], calls: 0 });
  await check('backend-throws-refusal', 'throws', { backend: 'throws', packs: [refusingPack] });
  const other = signed({ ...issued, computation: { ...issued.computation, engine_version: 'other-test-engine' } });
  await check('other-engine-refusal', expected('failed', ['RCP-03'], true), { receipt: other, packs: [refusingPack] });
});
test('finite agreement and signature/backend failure have exact public boundaries', async () => {
  await check('signed-agreement', expected('verified', [], true));
  await check('unsigned-agreement', expected('verified', [], true), { receipt: issued, calls: 0 });
  await check('invalid-finite', expected('failed', ['RCP-01'], false), { receipt: signed(issued, true) });
  await check('missing-backend-finite', expected('unverifiable', ['RCP-08'], false), { backend: 'missing', calls: 0 });
});
test('subject and held inputs stay early; RFC 0123 pack admission follows authentication', async () => {
  await check('bad-source', expected('unverifiable', ['RCP-09'], false), { content: 'not an admitted record', receipt: signed(issued, true), calls: 0 });
  const different = structuredClone(issued); different.subject.digest = `sha256:${'0'.repeat(64)}`;
  await check('subject-mismatch', expected('failed', ['RCP-01'], false), { receipt: signed(different, true), calls: 0 });
  different.subject.canonicalization_version = 'different-test-regime';
  await check('noncomparable-subject', expected('unverifiable', ['RCP-10'], false), { receipt: signed(different, true), calls: 0 });
  const referenced = structuredClone(issued); referenced.inputs_provenance = [{ source: 'market_data', document_id: 'test-input', digest: `sha256:${'1'.repeat(64)}` }];
  await check('held-input-mismatch', expected('failed', ['RCP-12'], false), { receipt: signed(referenced, true), inputs: { 'test-input': `sha256:${'2'.repeat(64)}` }, packs: [], calls: 0 });
  await check('missing-input', expected('unverifiable', ['RCP-11'], false), { receipt: signed(referenced, true), calls: 0 });
  await check('unknown-pack-invalid-signature', expected('failed', ['RCP-01'], false), { receipt: signed(issued, true), packs: [] });
  await check('unknown-pack-authenticated', expected('unverifiable', ['RCP-05'], true), { packs: [] });
  await check('wrong-pack-version-invalid-signature', expected('failed', ['RCP-01'], false), { receipt: signed(issued, true), packs: [{ ...pack, version: '2.0.0' }] });
  await check('wrong-pack-version-authenticated', expected('unverifiable', ['RCP-06'], true), { packs: [{ ...pack, version: '2.0.0' }] });
});
test('authenticated finite coverage/value/engine comparison precedes results digest', async () => {
  const changed = structuredClone(issued); changed.computation.results[0].value = 3; changed.computation.results_digest = `sha256:${'0'.repeat(64)}`;
  await check('same-engine-value', expected('failed', ['RCP-03'], true), { receipt: signed(changed) });
  changed.computation.engine_version = 'other-test-engine';
  await check('other-engine-value', expected('unverifiable', ['RCP-07', 'RCP-03'], true), { receipt: signed(changed) });
  const missing = structuredClone(issued); missing.computation.results = [];
  await check('coverage-before-digest', expected('failed', ['RCP-02'], true), { receipt: signed(missing) });
  const digest = structuredClone(issued); digest.computation.results_digest = `sha256:${'0'.repeat(64)}`;
  await check('results-digest', expected('failed', ['RCP-04'], true), { receipt: signed(digest) });
  await check('bad-signature-before-digest', expected('failed', ['RCP-01'], false), { receipt: signed(digest, true) });
});
