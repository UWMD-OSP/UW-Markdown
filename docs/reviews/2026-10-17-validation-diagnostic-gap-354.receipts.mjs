// Read-only RFC0091 candidate boundary probe. Test-only public Ed25519 seed.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const [baselineRoot, candidateRoot, output] = process.argv.slice(2).map(x => resolve(x));
assert(baselineRoot && candidateRoot && output && !existsSync(output));
const sha = x => createHash('sha256').update(x).digest('hex');
const name = 'examples/Parkview-Apts-Glendale-AZ.uwx.md';
const raw = readFileSync(join(candidateRoot, name));
assert.deepEqual(raw, readFileSync(join(baselineRoot, name)));
const original = raw.toString('utf8');
const remove = (source, field) => {
  const pattern = new RegExp(`^[ \t]*"${field}": (?:true|false),?\r?\n`, 'm');
  const match = source.match(pattern);
  assert(match, field);
  const prefix = source.slice(0, match.index);
  const lastMember = !match[0].trimEnd().endsWith(',');
  const adjustedPrefix = lastMember ? prefix.replace(/,(\r?\n)$/, '$1') : prefix;
  assert.equal(prefix.length - adjustedPrefix.length, lastMember ? 1 : 0);
  return { source: adjustedPrefix + source.slice(match.index + match[0].length), removed: match[0], offset: match.index, removed_preceding_comma: lastMember }; 
};
const r = remove(original, 'human_review_required');
const l = remove(original, 'superseded');
const both = remove(r.source, 'superseded');
// This is a published test seed, never an identity or production credential.
const privateKey = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${'11'.repeat(32)}`, 'hex'), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(privateKey);
const apis = {};
const identities = {};
for (const [label, root] of [['baseline', baselineRoot], ['candidate', candidateRoot]]) {
  apis[label] = await import(pathToFileURL(join(root, 'packages/uwmd-verify/dist/index.js')).href);
  identities[label] = {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    files: ['packages/uwmd-verify/src/validator.ts', 'packages/uwmd-verify/src/receipts.ts', 'packages/uwmd-verify/src/integrity.ts', 'packages/uwmd-verify/dist/validator.js', 'packages/uwmd-verify/dist/receipts.js', 'packages/uwmd-verify/dist/integrity.js'].map(path => ({ path, sha256: sha(readFileSync(join(root, path))) })),
  };
}
const options = { filename: name, issued_at: '2026-10-17T00:00:00.000Z', issuer: 'RFC0091-unaccepted-candidate-research' };
const rows = [];
for (const [label, source, delta] of [['authored', original, 0], ['review_absent', r.source, 1], ['superseded_absent', l.source, 1], ['both_absent', both.source, 2]]) {
  for (const match of source.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)) JSON.parse(match[1]);
  const issued = {};
  const payloads = {};
  for (const engine of ['baseline', 'candidate']) {
    issued[engine] = await apis[engine].issueReceipt(source, options);
    payloads[engine] = apis[engine].receiptSigningPayload(issued[engine]);
  }
  const adjusted = structuredClone(issued.baseline);
  adjusted.policy.validation.errors += delta;
  assert.deepEqual(adjusted, issued.candidate);
  assert.equal(payloads.baseline === payloads.candidate, delta === 0);
  const results = [];
  const signedReceipts = {};
  for (const issuer of ['baseline', 'candidate']) {
    const signed = { ...issued[issuer], signature: { algorithm: 'ed25519', key_id: 'public-test-only-0091', value: sign(null, Buffer.from(payloads[issuer]), privateKey).toString('base64url') } };
    signedReceipts[issuer] = signed;
    for (const verifier of ['baseline', 'candidate']) {
      let calls = 0;
      const backend = { async verify(receipt, payload) { calls++; return verify(null, Buffer.from(payload), publicKey, Buffer.from(receipt.signature.value, 'base64url')); } };
      const unsigned = await apis[verifier].verifyReceipt(issued[issuer], source, { filename: name });
      const valid = await apis[verifier].verifyReceipt(signed, source, { filename: name, signatureVerifier: backend });
      assert.equal(unsigned.verdict, 'verified'); assert.equal(valid.verdict, 'verified'); assert.equal(calls, 1);
      const noBackend = await apis[verifier].verifyReceipt(signed, source, { filename: name });
      assert.equal(noBackend.verdict, 'unverifiable');
      const tampered = structuredClone(signed); tampered.policy.validation.errors++;
      const invalid = await apis[verifier].verifyReceipt(tampered, source, { filename: name, signatureVerifier: backend });
      assert.equal(invalid.verdict, 'failed'); assert.deepEqual(invalid.issues.map(x => x.code), ['RCP-01']);
      results.push({ issuer, verifier, unsigned, valid, noBackend, invalid, backend_calls: calls });
    }
  }
  rows.push({ label, source_sha256: sha(source), expected_error_delta: delta, issued, signed_receipts: signedReceipts, signing_payloads: payloads, results });
}
assert.deepEqual(raw, readFileSync(join(candidateRoot, name)));
writeFileSync(output, `${JSON.stringify({ kind: 'actual-RFC0091-same-byte-issuance-and-public-test-crypto', identities, source: { path: name, sha256: sha(raw) }, transformations: { review: r, lifecycle: l, both }, test_public_key_spki_base64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), options, rows, limits: 'Disposable in-memory field omissions only; original artifacts remain unchanged. Policy counts change issuance signing input, not subject/results or receipt verification rules. Does not authenticate historical artifacts under a new regime.' }, null, 2)}\n`);
console.log(JSON.stringify({ output, sha256: sha(readFileSync(output)), rows: rows.length, actual_cross_runtime_claim: false }));
