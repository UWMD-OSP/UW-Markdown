// Separate post-capture binding audit. Frozen helpers and artifacts stay intact.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalize } from '../../../packages/uwmd-verify/dist/integrity-canonical.js';
const ROOT = new URL('../../../', import.meta.url);
const LAB = new URL('../', import.meta.url);
const HERE = new URL('./', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// Exact executed accepted-afcc closure. No receiptSigningPayload call is used:
// independently reconstruct the accepted {...receipt, signature:null} projection.
const pins = {
  "packages/uwmd-verify/src/receipts.ts": "330888cf68e5e3b76ceefd2b798cfd40b244fc6d71ea528bacf945682152b54a",
  "packages/uwmd-verify/src/integrity-canonical.ts": "4f6532ea34ecb1e98ab919d26683b1638297c11cec70534538c0395ccbdb4b66",
  "packages/uwmd-verify/dist/receipts.js": "f4236fce7deae96207ab49f934e7a024363bfdc7146e3106b39a013411bd7cba",
  "packages/uwmd-verify/dist/integrity-canonical.js": "3b4ea8f34e83ce31c207e0329001eed97ff50283c912e3314b493a649601ac97"
};
for (const [path, expected] of Object.entries(pins)) assert.equal(sha(readFileSync(new URL(path, ROOT))), expected, path);
const input = JSON.parse(readFileSync(new URL('inputs.json', HERE), 'utf8'));
for (const [path, expected] of Object.entries(input.references)) assert.equal(sha(readFileSync(new URL(path, LAB))), expected, path);
const candidate = JSON.parse(gunzipSync(readFileSync(new URL('evidence/candidate.json.gz', HERE))));
const prior = JSON.parse(readFileSync(new URL('impact/financial-evidence/baseline.financial.json', LAB), 'utf8'));
const old = prior.receipts.find(row => row.id === input.prior_refusal_receipt);
assert(old?.issued_receipt);
assert.equal(sha(candidate.source), candidate.source_sha256);
assert.equal(sha(prior.source), prior.source_sha256);
const key = createPublicKey({ key: Buffer.from(candidate.public_test_key.public_spki_hex, 'hex'), type: 'spki', format: 'der' });
function payloadBound(row) {
  const payload = canonicalize({ ...row.receipt, signature: null });
  assert.equal(payload, row.signing_payload, `${row.id}: receipt-to-signing-payload binding`);
  assert.equal(sha(payload), row.signing_payload_sha256, row.id);
  assert.equal(sha(JSON.stringify(row.receipt)), row.receipt_json_sha256, row.id);
  return payload;
}
let signatures = 0;
for (const row of candidate.rows) {
  const source = row.id.startsWith('finite-') ? candidate.source : prior.source;
  assert.equal(sha(source), row.source_sha256, row.id);
  const payload = payloadBound(row);
  if (row.receipt.signature) {
    assert.equal(verify(null, Buffer.from(payload), key, Buffer.from(row.receipt.signature.value, 'base64')), row.external_crypto_valid, row.id);
    signatures++;
  }
  for (const call of row.backend_calls) {
    assert.equal(call.receipt_sha256, row.receipt_json_sha256, row.id);
    assert.equal(call.payload_sha256, sha(payload), row.id);
  }
}
const refusal = candidate.rows.find(row => row.id === 'refusal-valid-research-signature');
const { signature: _researchSignature, ...cloned } = refusal.receipt;
const { signature: _oldSignature, ...original } = old.issued_receipt;
assert.deepEqual(cloned, original, 'refusal receipt is the original frozen receipt plus a new synthetic signature');
// A valid signature for a detached recorded payload must never prove binding to
// a different recorded receipt. These controls mutate memory only.
for (const mutate of [
  row => { row.receipt.computation.results[0].value = 0; },
  row => { row.receipt.computation.engine_version = 'unrecorded-change'; },
  row => { row.signing_payload += ' '; },
]) {
  const row = structuredClone(candidate.rows[0]);
  mutate(row);
  assert.throws(() => payloadBound(row), /receipt-to-signing-payload binding/);
}
console.log(JSON.stringify({ receipt_payload_bindings: candidate.rows.length, real_signature_checks: signatures, source_bindings: candidate.rows.length,
  frozen_endpoint_clone_binding: true, negative_binding_controls: 3, scope: 'offline binding to accepted pinned canonicalizer; no issuer trust or receipt API replay' }));
