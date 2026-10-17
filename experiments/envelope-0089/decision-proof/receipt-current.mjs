// Accepted Receipt 5.5 metadata-only control; no candidate regime is implemented.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const root = new URL('../../../', import.meta.url);
const here = new URL('./', import.meta.url);
const args = process.argv.slice(2);
const index = args.indexOf('--verify-root');
assert(index >= 0 && args[index + 1], 'explicit --verify-root PATH required');
const create = args.includes('--create');
assert(args.length === (create || args.includes('--check') ? 3 : 2), 'only --verify-root PATH and --create/--check accepted');
const verifyRoot = resolve(args[index + 1]);
const baseBytes = readFileSync(new URL('frozen/current-main-afcc.json', here));
const base = JSON.parse(baseBytes);
const helperPaths = ['experiments/envelope-0089/decision-proof/receipt-current.mjs', 'spec/UW_RECEIPT.md'];
const identities = {
  current_auth_observations_sha256: sha(baseBytes),
  helper_and_contract_hashes: Object.fromEntries(helperPaths.map(path => [path, sha(readFileSync(new URL(path, root)))])),
  production_hash_maps: 'frozen/current-main-afcc.json#/material/production (all entries checked, no omissions)',
  production_source_equivalent_to: base.material.production.source_equivalent_to,
};
for (const kind of ['source', 'compiled']) {
  for (const [path, expected] of Object.entries(base.material.production[kind])) {
    assert.equal(sha(readFileSync(resolve(verifyRoot, path))), expected, `production ${kind}: ${path}`);
  }
}
const destination = new URL('frozen/current-receipt-afcc.json', here);
const expected = create ? undefined : JSON.parse(readFileSync(destination));
if (expected) assert.deepEqual(identities, expected.identities);
const api = await import(pathToFileURL(resolve(verifyRoot, 'packages/uwmd-verify/dist/index.js')).href);
// Deliberately public test seed: disposable controls, never an issuer credential.
const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const privateKey = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]) });
const publicKey = createPublicKey(privateKey);
assert.equal(publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), base.material.test_key.public_key_spki_der_base64);
const pack = { id: 'research.current-receipt-control', version: 'research-only', calculations: [{ id: 'synthetic_control', label: 'Nonfinancial constant control', formula: '1', deterministic: true }] };
const cases = [];
for (const row of base.material.cases.filter(row => row.source.admission?.allowed)) {
  const sourceBytes = readFileSync(new URL(`experiments/envelope-0089/codec-examples/${row.case}/original.uwx.md`, root));
  assert.equal(sha(sourceBytes), row.source.raw_sha256);
  const original = row.source.current_receipt_control.receipt;
  for (const resign of [false, true]) {
    const receipt = clone(original);
    receipt.subject.canonicalization_version = 'C_UNSUPPORTED';
    assert.equal(receipt.subject.digest, original.subject.digest, 'metadata control keeps original subject digest');
    const payload = api.receiptSigningPayload(receipt);
    if (resign) receipt.signature.value = sign(null, Buffer.from(payload), privateKey).toString('base64url');
    let calls = 0;
    const result = await api.verifyReceipt(receipt, sourceBytes.toString('utf8'), { filename: 'research.uwx.md', packs: [pack], signatureVerifier: { verify: async (named, bytes) => {
      calls++;
      return verify(null, Buffer.from(bytes), publicKey, Buffer.from(named.signature.value, 'base64url'));
    } } });
    assert.equal(calls, 1, 'matching digests proceed normally to actual crypto');
    assert.equal(result.verdict, resign ? 'verified' : 'failed');
    assert.deepEqual(result.issues.map(issue => issue.code), resign ? [] : ['RCP-01']);
    cases.push({ case: row.case, changed_field: 'subject.canonicalization_version only', original_subject: original.subject, source_sha256: sha(sourceBytes), test_signature: resign ? 'new disposable test signature' : 'original signature retained', artifact: receipt, signing_payload: payload, signing_payload_sha256: sha(payload), result, backend_calls: calls });
  }
}
assert.equal(cases.length, 4);
const material = { status: 'ACCEPTED RECEIPT 5.5 OBSERVATION; NOT A NEW REGIME OR HISTORICAL ARTIFACT MIGRATION', cases, conclusion: 'Equal digests plus differing canonicalization-version metadata proceed normally. Signature mutation fails with RCP-01; a valid disposable research signature verifies. No C_UNSUPPORTED canonicalizer is implemented or exercised.' };
const historical = JSON.parse(readFileSync(new URL('frozen/receipt-version.json', here)));
assert.deepEqual(material, historical.material, 'ALL receipt artifacts, payloads, results and backend calls still match actual historical observations');
if (create) {
  assert(!existsSync(destination), 'refusing frozen evidence overwrite');
  writeFileSync(destination, `${JSON.stringify({ identities, source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), runtime: { node: process.version, openssl: process.versions.openssl, platform: process.platform, arch: process.arch }, material }, null, 2)}\n`, { flag: 'wx' });
} else assert.deepEqual(material, expected.material, 'all receipt artifacts, payloads, verdicts and backend calls');
console.log('PASS fresh afcc 4 real-backend Receipt 5.5 controls; all behavior matches original; no new canonicalizer or receipt rules');
