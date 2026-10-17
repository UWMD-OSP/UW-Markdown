// Offline independent cryptographic verification of preserved actual API evidence.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const sha = value => createHash('sha256').update(value).digest('hex');
const directory = new URL('./evidence/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
for (const item of manifest.raw_artifacts) {
  const packed = readFileSync(new URL(item.path, directory));
  assert.equal(sha(packed), item.sha256);
  const raw = gunzipSync(packed);
  assert.equal(raw.length, item.raw_bytes);
  assert.equal(sha(raw), item.raw_sha256);
}
const candidate = JSON.parse(gunzipSync(readFileSync(new URL('candidate.json.gz', directory))));
const key = createPublicKey({ key: Buffer.from(candidate.public_test_key.public_spki_hex, 'hex'), type: 'spki', format: 'der' });
assert.equal(candidate.rows.length, 19);
for (const row of candidate.rows) {
  assert.equal(sha(row.signing_payload), row.signing_payload_sha256, row.id);
  assert.equal(sha(JSON.stringify(row.receipt)), row.receipt_json_sha256, row.id);
  const crypto = row.receipt.signature ? verify(null, Buffer.from(row.signing_payload), key, Buffer.from(row.receipt.signature.value, 'base64')) : null;
  assert.equal(crypto, row.external_crypto_valid, row.id);
  assert.deepEqual([row.result.verdict, row.result.issues.map(issue => issue.code), row.backend_calls.length], row.expected, row.id);
  assert.equal(row.receipt_unchanged, true, row.id);
  for (const call of row.backend_calls) assert.equal(call.payload_sha256, row.signing_payload_sha256, row.id);
}
const row = name => candidate.rows.find(item => item.id === name);
assert.equal(row('finite-signed-agreement').external_crypto_valid, true);
assert.equal(row('finite-wrong-value-retained-signature').external_crypto_valid, false);
assert.equal(row('finite-wrong-value-resigned-same-engine').external_crypto_valid, true);
assert.deepEqual(row('finite-wrong-value-resigned-other-version').result.issues.map(issue => issue.code), ['RCP-07', 'RCP-03']);
assert.equal(row('refusal-valid-research-signature').external_crypto_valid, true);
assert.equal(row('refusal-invalid-research-signature').external_crypto_valid, false);
for (const name of ['refusal-valid-research-signature', 'refusal-invalid-research-signature', 'refusal-same-historical-labels']) {
  assert.equal(row(name).backend_calls.length, 0);
  assert.deepEqual(row(name).result.issues.map(issue => issue.code), ['RCP-03']);
}
assert.equal(candidate.independent_reference.candidate_reported_word, candidate.independent_reference.frozen_python_result.reporting.bits);
console.log(JSON.stringify({ controls: 19, raw_artifacts: manifest.raw_artifacts.length, real_signature_checks: candidate.rows.filter(item => item.receipt.signature).length,
  scope: 'offline verification of frozen actual receipt/signature evidence only; no production replay or normative acceptance' }));
