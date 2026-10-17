// Independent offline payload/results/source binding of actual frozen API output.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalize } from '../../../packages/uwmd-verify/dist/integrity-canonical.js';
const HERE = new URL('./', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const LAB = new URL('../', import.meta.url);
const directory = new URL('evidence/', HERE);
const sha = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
for (const [path, expected] of Object.entries(manifest.sources)) assert.equal(sha(readFileSync(new URL(path, ROOT))), expected, path);
for (const path of ['packages/uwmd-verify/dist/integrity-canonical.js', 'packages/uwmd-verify/dist/receipts.js']) {
  assert.equal(sha(readFileSync(new URL(path, ROOT))), manifest.dist_before_and_after[path], path);
}
for (const item of manifest.artifacts) {
  const packed = readFileSync(new URL(item.path, directory));
  assert.equal(sha(packed), item.sha256);
  const raw = gunzipSync(packed);
  assert.equal(raw.length, item.raw_bytes);
  assert.equal(sha(raw), item.raw_sha256);
}
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`${name}.json.gz`, directory))));
const host = read('host');
const candidate = read('candidate');
const reverse = read('reverse');
const inputs = JSON.parse(readFileSync(new URL('inputs.json', HERE), 'utf8'));
for (const [path, expected] of Object.entries(inputs.references)) assert.equal(sha(readFileSync(new URL(path, LAB))), expected, path);
assert.equal(sha(readFileSync(new URL(inputs.fixture, ROOT))), inputs.fixture_sha256);
const originalInputs = JSON.parse(readFileSync(new URL('cancellation-accuracy/inputs.json', LAB), 'utf8'));
const originalReference = JSON.parse(gunzipSync(readFileSync(new URL('cancellation-accuracy/evidence/python.json.gz', LAB))));
const key = createPublicKey({ key: Buffer.from(candidate.public_test_key.spki_hex, 'hex'), type: 'spki', format: 'der' });
function bound(receipt, payload) {
  assert.equal(canonicalize({ ...receipt, signature: null }), payload, 'receipt-to-payload binding');
  assert.equal(receipt.computation.results_digest, `sha256:${sha(canonicalize(receipt.computation.results))}`, 'results-digest binding');
  return verify(null, Buffer.from(payload), key, Buffer.from(receipt.signature.value, 'base64'));
}
let payloads = 0;
let valid = 0;
let invalid = 0;
let backends = 0;
for (const record of [host, candidate, reverse]) {
  assert.equal(record.input_sha256, sha(readFileSync(new URL('inputs.json', HERE))));
  for (const item of record.cases) {
    assert.equal(sha(item.source), item.source_sha256);
    assert.deepEqual(item.exact_inputs, originalInputs.cases.find(row => row.id === item.id));
    assert.deepEqual(item.frozen_reference.mathematical_reporting, originalReference.references.find(row => row.id === item.id).whole_formula_reporting);
    if (item.issuance?.status === 'issued') {
      assert.equal(bound(item.issuance.signed, canonicalize({ ...item.issuance.signed, signature: null })), true);
      const { signature: _signature, ...signed } = item.issuance.signed;
      const { signature: _nullSignature, ...unsigned } = item.issuance.unsigned;
      assert.deepEqual(signed, unsigned);
    } else if (item.issuance?.status === 'refused') {
      assert.equal(item.issuance.error.code, 'RCP_COMPUTATION_FAILED');
      assert.equal(Object.hasOwn(item.issuance, 'signed'), false);
      assert.equal(Object.hasOwn(item.issuance, 'unsigned'), false);
    }
  }
  for (const row of record.rows) {
    const item = candidate.cases.find(item => item.id === row.case_id);
    assert.equal(sha(item.source), row.source_sha256, row.id);
    assert.equal(sha(JSON.stringify(row.receipt)), row.receipt_sha256, row.id);
    assert.equal(sha(row.signing_payload), row.signing_payload_sha256, row.id);
    const answer = bound(row.receipt, row.signing_payload);
    assert.equal(answer, row.external_signature_valid, row.id);
    answer ? valid++ : invalid++;
    payloads++;
    assert.deepEqual([row.result.verdict, row.result.issues.map(item => item.code), row.backend_calls.length], row.expected, row.id);
    assert.equal(row.receipt_unchanged, true);
    for (const call of row.backend_calls) {
      assert.equal(call.receipt_sha256, row.receipt_sha256);
      assert.equal(call.payload_sha256, row.signing_payload_sha256);
      assert.equal(call.signature_valid, answer);
      backends++;
    }
  }
}
assert.deepEqual([host.rows.length, candidate.rows.length, reverse.rows.length], [1, 6, 5]);
assert.equal(payloads, 12);
assert.equal(valid, 10);
assert.equal(invalid, 2);
assert.equal(backends, manifest.primary_backend_calls);
assert.deepEqual(candidate.host_snapshot, host, 'candidate consumed exact newly observed host artifacts');
assert.deepEqual(reverse.host_snapshot, host, 'reverse consumed the same host facts');
const hostPv = host.cases[1].issuance;
const candidatePv = candidate.cases[1].issuance;
assert.deepEqual(hostPv.unsigned.subject, candidatePv.unsigned.subject, 'same exact source semantic subject');
function withoutResults(receipt) {
  const clone = structuredClone(receipt);
  delete clone.computation.results;
  delete clone.computation.results_digest;
  return clone;
}
assert.deepEqual(withoutResults(hostPv.unsigned), withoutResults(candidatePv.unsigned), 'only natural results/digest can distinguish the two PV issuances');
const same = hostPv.reported_word === candidatePv.reported_word;
assert.equal(hostPv.unsigned.computation.results_digest === candidatePv.unsigned.computation.results_digest, same);
for (const item of candidate.cases) {
  assert.notEqual(item.issuance.reported_word, item.frozen_reference.mathematical_reporting.bits, 'verified does not imply whole-real formula accuracy');
  assert.equal(candidate.rows.find(row => row.id === `candidate-${item.op}-own-valid`).result.verdict, 'verified');
}
for (const mutate of [
  row => { row.receipt.computation.results[0].value += 1; },
  row => { row.receipt.computation.engine_version = 'detached-metadata'; },
  row => { row.signing_payload += ' '; },
]) {
  const row = structuredClone(candidate.rows[0]);
  mutate(row);
  assert.throws(() => bound(row.receipt, row.signing_payload), /receipt-to-payload binding/);
}
console.log(JSON.stringify({ primary_controls: payloads, signature_outcomes: { valid, invalid }, backend_calls: backends,
  independent_negative_bindings: 3, natural_pv_results_differ: !same, host_pmt_issuance: host.cases[0].issuance.status,
  scope: 'frozen actual receipt/result/source/payload bindings; no API replay, new financial answer or issuer trust' }));
