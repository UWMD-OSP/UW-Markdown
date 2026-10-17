// Raw candidate JSON/CSV-manifest observations only; no public API verification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { jcs, sha, subject, validate, decodeCsv } from '../codec-study/independent.mjs';
import { parseUniqueJson } from './strict.mjs';
const inputs = JSON.parse(readFileSync(0, 'utf8'));
// Public, deliberately known research seed; never a credential/trust anchor.
const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const privateKey = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]) });
const publicKey = createPublicKey(privateKey);
const artifacts = {};
const rows = [];
for (const row of inputs) {
  const key = row.case;
  if (row.model && !artifacts[key]) {
    const artifact = { kind: 'uwmd-document-signature', signature_version: '1',
      subject: { representation: 'uwx-markdown', representation_version: 'E_NEXT', canonicalization: 'uw-envelope-semantic', canonicalization_version: 'C_NEXT', digest: subject(row.model) },
      alg: 'ed25519', kid: 'rfc0089-public-test-seed-only', signed_at: '2026-10-17T00:00:00Z' };
    const payload = jcs(artifact);
    artifacts[key] = { ...artifact, sig: sign(null, Buffer.from(payload), privateKey).toString('base64url'), signing_payload_sha256: sha(Buffer.from(payload)) };
  }
  const observe = strict => {
    let calls = 0;
    try {
      const decoded = strict ? parseUniqueJson(row.text) : JSON.parse(row.text);
      let model;
      if (row.carrier === 'model-json') model = validate(decoded);
      if (row.carrier === 'csv-manifest') model = decodeCsv({ ...row.files, 'manifest.json': row.text });
      if (!model) return { accepted: true, canonical_value: jcs(decoded), raw_crypto_verify_calls: calls };
      assert.equal(jcs(model), jcs(row.model), 'complete model disagreement');
      const original = artifacts[key];
      const { sig, signing_payload_sha256: _hash, ...unsigned } = original;
      const payload = jcs({ ...unsigned, subject: { ...unsigned.subject, digest: subject(model) } });
      calls++;
      const valid = verify(null, Buffer.from(payload), publicKey, Buffer.from(sig, 'base64url'));
      assert.equal(valid, true, 'original raw research signature');
      return { accepted: true, complete_model_jcs_sha256: sha(Buffer.from(jcs(model))), semantic_digest: subject(model), raw_crypto_verify_calls: calls, original_raw_signature_valid: valid };
    } catch (error) {
      return { accepted: false, error_name: error.name, error_message: error.message, raw_crypto_verify_calls: calls };
    }
  };
  const historical = observe(false);
  const strict = observe(true);
  assert.equal(strict.accepted, row.expected_strict, `${row.case}/${row.carrier}/${row.vector}`);
  if (!strict.accepted) assert.equal(strict.raw_crypto_verify_calls, 0);
  rows.push({ case: row.case, carrier: row.carrier, vector: row.vector, input_sha256: sha(Buffer.from(row.text)), historical, strict });
}
const require = createRequire(import.meta.url);
const dependencies = Object.fromEntries(Object.keys(require.cache).sort().map(path => [path.replaceAll('\\', '/').split('/node_modules/').at(-1), sha(readFileSync(path))]));
console.log(JSON.stringify({ rows, artifacts, public_key_spki_der_base64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), dependencies }));
