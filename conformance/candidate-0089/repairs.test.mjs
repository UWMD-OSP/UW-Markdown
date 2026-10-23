import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { candidate } from './build-runtime.mjs';
import * as nativeSigning from '../../packages/uwmd-verify/dist/document-signatures.js';
import * as nativeReceipts from '../../packages/uwmd-verify/dist/receipts.js';
import { projectSource, validateModel, stamp, preimage, jcs, sha } from './model.mjs';
import { encodeXML, decodeXML } from './xml.mjs';
import { encodeCSV, decodeCSV, DOC, readCSV, writeCSV } from './csv.mjs';
import { oracle, canon, sha as independentHash } from './reviewer/review-oracle.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = resolve(root, 'node_modules/.cache/rfc0089-evidence');
mkdirSync(evidence, { recursive: true });
const packet = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const normal = packet.source_cases.find(item => item.name === 'named-default-single').source;
const empty = structuredClone(packet.source_cases[0].expected_model);
const pack = { id: 'org.example.admission', version: '1.0.0', calculations: [
  { id: 'synthetic_scalar', label: 'Synthetic stage control', formula: '1+1', deterministic: true, round_to: 12 },
] };
const options = { pack, issued_at: '2026-10-23T00:00:00Z', issuer: 'synthetic-key' };
const observations = [];
const sources = [
  ['complete', normal, true],
  ['sparse-metadata', normal.replace(/"provenance":\{[^}]+\},"quality":\{[^}]+\},/, ''), false],
  ['invalid-role', normal.replace('"marker":1', '"marker":1,"_role":"not-a-role"'), false],
  ['missing-deal-name', normal.replace(/^deal_name:.*\n/m, ''), false],
];
const pythonCases = { sources: [], xml: [], csv: [] };

test('F1 source accounting, V13 authentication and receipt issuance retain distinct admission', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  for (const [name, source, carrierAdmitted] of sources) {
    const model = projectSource(source).model;
    const expected = oracle(source).model;
    assert.equal(preimage(model), canon(expected));
    pythonCases.sources.push({ name, source, preimage: canon(expected), carrierAdmitted });
    if (carrierAdmitted) { validateModel(model); decodeXML(encodeXML(model)); }
    else {
      assert.throws(() => validateModel(model), /shape/);
      assert.throws(() => encodeXML(model), /shape/);
      assert.throws(() => encodeCSV(model), /shape/);
    }
    const nativeSubject = await nativeSigning.resolveDocumentSigningSubject(source);
    const subject = await candidate.signing.resolveDocumentSigningSubject(source);
    assert.equal(nativeSubject.canonicalization_version, '1.0');
    assert.equal(subject.canonicalization_version, '2.0');
    assert.equal(subject.digest, independentHash(canon(expected)));
    const nativeReceipt = await nativeReceipts.issueReceipt(source, options);
    const receipt = await candidate.receipts.issueReceipt(source, options);
    assert.deepEqual(receipt.policy.validation, nativeReceipt.policy.validation);
    if (!carrierAdmitted) assert.ok(receipt.policy.validation.errors + receipt.policy.validation.warnings > 0);
    receipt.signature = { algorithm: 'ed25519', key_id: 'synthetic-key', value:
      sign(null, Buffer.from(candidate.receipts.receiptSigningPayload(receipt)), privateKey).toString('base64') };
    const artifact = { kind: 'uwmd-document-signature', signature_version: '1', subject,
      alg: 'ed25519', kid: 'synthetic-key', signed_at: options.issued_at, sig: '' };
    artifact.sig = sign(null, Buffer.from(candidate.signing.documentSigningPayload(artifact)), privateKey).toString('base64url');
    let documentCalls = 0; let receiptCalls = 0;
    const docResult = await candidate.signing.verifyDocumentSignature(source, artifact, { signatureVerifier: {
      verify: async (payload, value) => { documentCalls++; return verify(null, Buffer.from(payload), publicKey, Buffer.from(value.sig, 'base64url')) ? { ok: true } : { ok: false, reason: 'bad_signature' }; },
    } });
    const receiptResult = await candidate.receipts.verifyReceipt(receipt, source, { packs: [pack], signatureVerifier: {
      verify: async (value, payload) => { receiptCalls++; return verify(null, Buffer.from(payload), publicKey, Buffer.from(value.signature.value, 'base64')); },
    } });
    assert.equal(docResult.state, 'verified'); assert.equal(documentCalls, 1); assert.deepEqual(docResult.issues, []);
    assert.equal(receiptResult.verdict, 'verified'); assert.equal(receiptCalls, 1); assert.deepEqual(receiptResult.issues, []);
    observations.push({ finding: 'F1', name, native_source: 'admitted', candidate_source: 'admitted', carrierAdmitted,
      validation: receipt.policy.validation, document: docResult.state, documentCalls, receipt: receiptResult.verdict, receiptCalls });
  }
  const peer = packet.source_cases.find(item => item.name === 'peers-base-detail').source;
  const history = packet.source_cases.find(item => item.name.includes('history-only')).source;
  const missingLifecycle = normal.replace(',"superseded":false', '');
  for (const [name, source] of [['repeated-peers', peer], ['extension-history', history], ['missing-lifecycle', missingLifecycle]]) {
    await assert.rejects(() => nativeSigning.resolveDocumentSigningSubject(source));
    await assert.rejects(() => candidate.signing.resolveDocumentSigningSubject(source));
    const artifact = { kind: 'uwmd-document-signature', signature_version: '1',
      subject: { representation: 'uwx-markdown', representation_version: '1.0', canonicalization: 'uw-envelope-semantic', canonicalization_version: '2.0', digest: independentHash(canon(oracle(source).model)) },
      alg: 'ed25519', kid: 'synthetic-key', signed_at: options.issued_at, sig: '' };
    artifact.sig = sign(null, Buffer.from(candidate.signing.documentSigningPayload(artifact)), privateKey).toString('base64url');
    let calls = 0;
    const result = await candidate.signing.verifyDocumentSignature(source, artifact, { signatureVerifier: { verify: async () => { calls++; return { ok: true }; } } });
    assert.deepEqual(result.issues.map(issue => issue.code), ['INT-15']); assert.equal(calls, 0);
    // Receipts retain ordinary issuance, including the same incomplete lifecycle.
    const receipt = await candidate.receipts.issueReceipt(source, options);
    const native = await nativeReceipts.issueReceipt(source, options);
    assert.deepEqual(receipt.policy.validation, native.policy.validation);
    observations.push({ finding: 'F1', name, document: 'INT-15', documentCalls: calls, receipt: 'issued', validation: receipt.policy.validation });
  }
});

test('F3 declared-empty slots cannot overlap populated descendants before digest comparison', () => {
  const property = structuredClone(packet.direct_models[0].expected_model.sections.property);
  property.annotation.variant = 'base';
  for (const location of ['sections', 'superseded']) {
    const model = structuredClone(empty);
    if (location === 'sections') model.sections.property = { base: property };
    else model.superseded.property = [property];
    const files = encodeCSV(model); const originalDigest = JSON.parse(files['manifest.json']).semantic_digest;
    const rows = readCSV(files['document.csv'], DOC);
    rows[0][8] = JSON.stringify([{ path: `/${location}/property`, kind: location === 'sections' ? 'object' : 'array' }]);
    files['document.csv'] = writeCSV([DOC, ...rows]);
    const manifest = JSON.parse(files['manifest.json']); const entry = manifest.files.find(item => item.path === 'document.csv');
    entry.bytes = Buffer.byteLength(files['document.csv']); entry.sha256 = sha(Buffer.from(files['document.csv']));
    assert.equal(manifest.semantic_digest, originalDigest);
    files['manifest.json'] = JSON.stringify(manifest);
    assert.throws(() => decodeCSV(files), /empty\/nonempty overlap/);
    pythonCases.csv.push({ name: location, files });
    // A stale digest must not mask the grammar failure either.
    const badDigest = structuredClone(files); const doc = readCSV(badDigest['document.csv'], DOC);
    doc[0][4] = `sha256:${'0'.repeat(64)}`; badDigest['document.csv'] = writeCSV([DOC, ...doc]);
    const m = JSON.parse(badDigest['manifest.json']); const e = m.files.find(item => item.path === 'document.csv');
    e.bytes = Buffer.byteLength(badDigest['document.csv']); e.sha256 = sha(Buffer.from(badDigest['document.csv'])); badDigest['manifest.json'] = JSON.stringify(m);
    assert.throws(() => decodeCSV(badDigest), /empty\/nonempty overlap/);
    pythonCases.csv.push({ name: `${location}-bad-stamp`, files: badDigest });
    observations.push({ finding: 'F3', location, byte_inventory: 'refreshed', semantic_digest: 'unchanged', refusal: 'empty/nonempty overlap' });
  }
});

test('F2 XML 1.0 characters, declarations and exactly-once attribute/namespace references', () => {
  const model = structuredClone(empty);
  model.outer = { '': ['\0', '\ufffe', '\uffff', 'literal &quot; and &#0;', 'A & B'] };
  const xml = encodeXML(model); const expected = preimage(model);
  const positives = [
    ['original', xml],
    ['type-decimal-reference', xml.replace('type="object"', 'type="&#111;bject"')],
    ['type-hex-reference', xml.replace('type="object"', 'type="&#x6f;bject"')],
    ['namespace-reference', xml.replace('https://uwmd.org', 'https:&#47;&#47;uwmd.org')],
    ['attribute-reference', xml.replace('&quot;', '&#34;')],
    ['declaration', `<?xml version="1.0" encoding="UTF-8"?>${xml}`],
    ['declaration-equality-spaces', `<?xml version = '1.0' encoding = 'utf-8' standalone = 'yes' ?>${xml}`],
    ['declaration-bom-crlf', `\ufeff<?xml\r\nversion='1.0'?>\r\n${xml}\r\n`],
  ];
  const token = `"${model.frontmatter.deal_id}"`;
  const negatives = [
    ...['&#0;', '&#x0;', '&#xD800;', '&#xFFFE;', '&#xFFFF;', '&#x110000;', '&#X41;', '&unknown;', '&amp'].map(reference =>
      [`illegal-reference-${reference}`, xml.replace(token, `"${model.frontmatter.deal_id}${reference}"`)]),
    ['uppercase-VERSION', `<?xml VERSION="1.0"?>${xml}`],
    ['uppercase-XML', `<?XML version="1.0"?>${xml}`],
    ['unsupported-XML-version', `<?xml version="1.1"?>${xml}`],
    ['declaration-quote-mismatch', `<?xml version="1.0'?>${xml}`],
    ['declaration-missing-space', `<?xml version="1.0"encoding="UTF-8"?>${xml}`],
    ['declaration-invalid-standalone', `<?xml version="1.0" standalone="true"?>${xml}`],
    ['declaration-after-space', ` <?xml version="1.0"?>${xml}`],
    ['literal-NUL', xml.replace('type="object"', 'type="object\0"')],
    ['literal-noncharacter', xml.replace(token, `"${model.frontmatter.deal_id}\ufffe"`)],
    ['hidden-unknown-attribute', xml.replace('type="object"', 'type="object" __proto__="hidden"')],
  ];
  for (const [name, text] of positives) {
    assert.equal(preimage(decodeXML(text)), expected, name);
    pythonCases.xml.push({ name, text, accepted: true, preimage: expected });
    observations.push({ finding: 'F2', name, accepted: true });
  }
  for (const [name, text] of negatives) {
    assert.notEqual(text, xml, name);
    assert.throws(() => decodeXML(text), error => /XML/.test(error.message) && !/semantic digest/.test(error.message), name);
    pythonCases.xml.push({ name, text, accepted: false });
    observations.push({ finding: 'F2', name, accepted: false, layer: 'XML syntax/mapping before semantic digest' });
  }
});

test('F5 all own descriptors are inspected without invoking getters or erasing hidden properties', () => {
  for (const onArray of [false, true]) for (const kind of ['undefined', 'function', 'accessor', 'json-data']) {
    const model = structuredClone(empty); let calls = 0;
    const parent = onArray ? (model.outer = []) : model;
    const descriptor = kind === 'accessor' ? { get() { calls++; throw new TypeError('getter must never execute'); } }
      : { value: kind === 'undefined' ? undefined : kind === 'function' ? () => 1 : null };
    Object.defineProperty(parent, 'hidden', descriptor);
    assert.throws(() => validateModel(model), /non-JSON/); assert.equal(calls, 0);
    observations.push({ finding: 'F5', onArray, kind, refusal: true, getter_calls: calls });
  }
  const model = structuredClone(empty); model.outer = Object.freeze([null, {}, []]);
  validateModel(model); assert.equal(jcs(stamp(model)), jcs(stamp(structuredClone(model))));
});

test('repair evidence and independent Python source/carrier boundaries', () => {
  writeFileSync(resolve(evidence, 'repair-cases.json'), `${JSON.stringify(pythonCases)}\n`);
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', fileURLToPath(new URL('./repairs.py', import.meta.url)), evidence], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  writeFileSync(resolve(evidence, 'repair-results.json'), `${JSON.stringify({ platform: process.platform, node: process.version, observations, closure: 'Builder repair execution; independent re-review still required' }, null, 2)}\n`);
});
