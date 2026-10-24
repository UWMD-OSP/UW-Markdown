// Adapted from accepted candidate 2f23cd27 authentication controls: actual module imports, tagged public parsed entries, await native stamping. Expectations unchanged.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { production as candidate } from './runtime.mjs';
import { projectSource, digest, stamp, jcs } from './test-oracle.mjs';
import { computeReplacementCashFlowBindingDigest } from '../../packages/uwmd-verify/dist/replacement-funding.js';
import { toUWEnvelope as nativeEnvelope } from '../../packages/uwmd-verify/dist/envelope.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packet = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const singleSource = packet.source_cases.find(item => item.name === 'named-default-single').source;
const peerSource = packet.source_cases.find(item => item.name === 'peers-base-detail').source;
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const observations = [];
const clone = structuredClone;
const codes = value => value.issues.map(issue => issue.code);
const pack = { id: 'org.example.candidate', version: '1.0.0', calculations: [
  { id: 'synthetic_scalar', label: 'Synthetic stage control', formula: '1+1', deterministic: true, round_to: 12 },
] };
const options = { pack, issued_at: '2026-10-23T00:00:00Z', issuer: 'synthetic-key' };

async function documentSignature(source) {
  const artifact = { kind: 'uwmd-document-signature', signature_version: '1',
    subject: await candidate.signing.resolveDocumentSigningSubject(source),
    alg: 'ed25519', kid: 'synthetic-key', signed_at: '2026-10-23T00:00:00Z', sig: '' };
  artifact.sig = sign(null, Buffer.from(candidate.signing.documentSigningPayload(artifact)), privateKey).toString('base64url');
  return artifact;
}
function signedReceipt(value) {
  value.signature = { algorithm: 'ed25519', key_id: 'synthetic-key',
    value: sign(null, Buffer.from(candidate.receipts.receiptSigningPayload(value)), privateKey).toString('base64') };
  return value;
}
async function receiptObservation(name, receipt, source = singleSource, held = [pack], extra = {}) {
  let calls = 0;
  const backend = { verify: async (artifact, payload) => {
    calls++; return verify(null, Buffer.from(payload), publicKey, Buffer.from(artifact.signature.value, 'base64'));
  } };
  const result = await candidate.receipts.verifyReceipt(receipt, source, { packs: held, signatureVerifier: backend, ...extra });
  observations.push({ name, verdict: result.verdict, codes: codes(result), backend_calls: calls, recomputed: result.recomputed?.length ?? null });
  return { result, calls };
}

test('D5 actual supported new-subject document signatures and exact admission precedence', async () => {
  const original = await documentSignature(singleSource);
  assert.equal(original.subject.canonicalization_version, '2.0');
  assert.equal(original.subject.digest, digest(projectSource(singleSource).model));
  let calls = 0;
  const backend = { verify: async (payload, artifact) => {
    calls++;
    return verify(null, Buffer.from(payload), publicKey, Buffer.from(artifact.sig, 'base64url'))
      ? { ok: true } : { ok: false, reason: 'bad_signature' };
  } };
  const valid = await candidate.signing.verifyDocumentSignature(singleSource, original, { signatureVerifier: backend });
  assert.equal(valid.state, 'verified'); assert.equal(calls, 1);
  const variants = [
    ['malformed-before-unsupported', value => { value.subject.canonicalization_version = 'unsupported'; value.subject.digest = 'bad'; }, singleSource, 'INT-09'],
    ['unencodable-before-unsupported', value => { value.subject.canonicalization_version = 'unsupported'; value.kid = '\ud800'; }, singleSource, 'INT-09'],
    ['unsupported-before-source', value => { value.subject.canonicalization_version = 'unsupported'; }, peerSource, 'INT-14'],
    ['guarded-source-before-digest', value => { value.subject.digest = `sha256:${'0'.repeat(64)}`; }, peerSource, 'INT-15'],
    ['same-regime-digest-before-crypto', value => { value.subject.digest = `sha256:${'0'.repeat(64)}`; }, singleSource, 'INT-11'],
  ];
  for (const [name, mutate, source, expected] of variants) {
    const value = clone(original); mutate(value); calls = 0;
    const result = await candidate.signing.verifyDocumentSignature(source, value, { signatureVerifier: backend });
    assert.deepEqual(codes(result), [expected], name); assert.equal(calls, 0, name);
    observations.push({ name, codes: codes(result), backend_calls: calls, state: result.state });
  }
  const missing = await candidate.signing.verifyDocumentSignature(singleSource, original);
  assert.deepEqual(codes(missing), ['INT-13']);
  const invalid = clone(original); const bytes = Buffer.from(invalid.sig, 'base64url'); bytes[0] ^= 1; invalid.sig = bytes.toString('base64url');
  calls = 0; assert.deepEqual(codes(await candidate.signing.verifyDocumentSignature(singleSource, invalid, { signatureVerifier: backend })), ['INT-10']); assert.equal(calls, 1);
  const thrown = await candidate.signing.verifyDocumentSignature(singleSource, original, { signatureVerifier: { verify: async () => { throw new TypeError('backend'); } } });
  assert.deepEqual(codes(thrown), ['INT-13']);
});

test('D3/D5 changed parsed models cannot borrow a source signature verdict', async () => {
  const artifact = await documentSignature(singleSource);
  const verifier = { verify: async (payload, value) => verify(null, Buffer.from(payload), publicKey, Buffer.from(value.sig, 'base64url')) ? { ok: true } : { ok: false, reason: 'bad_signature' } };
  for (const mutate of [value => { value.frontmatter.deal_name = 'Changed'; },
    value => { value.outer = null; }, value => { candidate.parser.parsedPhysicalBlocks(value)[0].extra = null; },
    value => { value.extensions.x_probe = clone(value.extensions.x_probe); value.extensions.x_probe.block.content.marker = 999; }]) {
    const parsed = candidate.parser.parseUWFile(singleSource); mutate(parsed);
    const result = await candidate.integrity.verifyChain(parsed, { documentSignature: artifact, documentSignatureVerifier: verifier });
    assert.equal(result.document_signature.state, 'failed'); assert.deepEqual(codes(result.document_signature), ['INT-15']);
  }
});

test('D5 actual new-subject receipt issuance, source identity and current Receipt 5.5', async () => {
  const issued = await candidate.receipts.issueReceipt(singleSource, options);
  assert.equal(issued.subject.canonicalization_version, '2.0');
  assert.equal(issued.subject.digest, digest(projectSource(singleSource).model));
  const original = signedReceipt(clone(issued));
  let rejectedCalls = 0;
  const mustNotRun = { verify: async () => { rejectedCalls++; return true; } };
  const malformed = clone(original); malformed.subject.digest = 'bad'; malformed.computation.rule_set = '3.1';
  await assert.rejects(() => candidate.receipts.verifyReceipt(malformed, 'invalid source', { signatureVerifier: mustNotRun }), error => error.code === 'RCP_MALFORMED');
  assert.equal(rejectedCalls, 0);
  observations.push({ name: 'receipt-malformed-before-source', code: 'RCP_MALFORMED', backend_calls: rejectedCalls });
  const unreadable = await candidate.receipts.verifyReceipt(original, 'invalid source', { signatureVerifier: mustNotRun });
  assert.deepEqual(codes(unreadable), ['RCP-09']); assert.equal(rejectedCalls, 0);
  observations.push({ name: 'receipt-source-before-authentication', codes: codes(unreadable), backend_calls: rejectedCalls });
  let observed = await receiptObservation('candidate-receipt-valid', original);
  assert.equal(observed.result.verdict, 'verified'); assert.equal(observed.calls, 1);
  const version = clone(original); version.subject.canonicalization_version = 'different';
  observed = await receiptObservation('equal-digest-changed-version-old-signature', version);
  assert.deepEqual(codes(observed.result), ['RCP-01']); assert.equal(observed.calls, 1); assert.equal(observed.result.recomputed, undefined);
  observed = await receiptObservation('equal-digest-changed-version-resigned', signedReceipt(version));
  assert.equal(observed.result.verdict, 'verified'); assert.equal(observed.calls, 1);
  const mismatch = clone(original); mismatch.subject.canonicalization_version = 'different'; mismatch.subject.digest = `sha256:${'0'.repeat(64)}`;
  observed = await receiptObservation('different-digest-and-version', mismatch);
  assert.deepEqual(codes(observed.result), ['RCP-10']); assert.equal(observed.calls, 0);
  const rule = clone(original); rule.computation.rule_set = '3.1';
  observed = await receiptObservation('rule-set-preflight', rule);
  assert.deepEqual(codes(observed.result), ['RCP-13']); assert.equal(observed.calls, 0);
  const missing = await candidate.receipts.verifyReceipt(original, singleSource, { packs: [pack] });
  assert.deepEqual(codes(missing), ['RCP-08']); assert.equal(missing.recomputed, undefined);
  const reference = clone(original); reference.inputs_provenance = [{ source: 'market_data', document_id: 'synthetic:ref', digest: `sha256:${'1'.repeat(64)}` }]; signedReceipt(reference);
  observed = await receiptObservation('held-ref-input-mismatch', reference, singleSource, [pack], { inputs: { 'synthetic:ref': `sha256:${'2'.repeat(64)}` } });
  assert.deepEqual(codes(observed.result), ['RCP-12']); assert.equal(observed.calls, 0);
  observed = await receiptObservation('missing-ref-input', reference);
  assert.deepEqual(codes(observed.result), ['RCP-11']); assert.equal(observed.calls, 0);
  const peers = signedReceipt(await candidate.receipts.issueReceipt(peerSource, options));
  observed = await receiptObservation('receipt-ordinary-peer-projection', peers, peerSource);
  assert.equal(observed.result.verdict, 'verified'); assert.equal(observed.calls, 1);
  const changed = peerSource.replace('"marker":1', '"marker":999');
  observed = await receiptObservation('receipt-omitted-peer-source-mutation', peers, changed);
  assert.deepEqual(codes(observed.result), ['RCP-01']); assert.equal(observed.calls, 0);
});

function dictionarySource() {
  // Author a fresh synthetic test record from current stated financial inputs.
  // No prior integrity/signature or historical artifact is copied or repaired.
  const inputs = nativeEnvelope(candidate.parser.parseUWFile(readFileSync(resolve(root, 'examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8')));
  const lines = ['---', 'uw_version: "3.0"', 'asset_class: multifamily', 'deal_id: synthetic-candidate-receipt',
    'deal_name: "Synthetic candidate receipt"', 'currency_code: USD', '---', ''];
  for (const section of ['property', 'valuation', 'debt_structure', 'noi_model', 'sources_uses', 'dcf']) {
    const entry = inputs.sections[section];
    const blocks = entry.annotation ? [entry] : Object.values(entry);
    for (const block of blocks) {
      const { _meta: _old, ...facts } = block.content;
      const content = { _meta: { section, provenance: { source: 'manual', actor: 'synthetic', timestamp: options.issued_at },
        quality: { confidence: 'high', human_review_required: false }, lifecycle: { revision: 1, superseded: false } }, ...facts };
      lines.push(`\`\`\`json uw:section=${section}${block.annotation.variant === undefined ? '' : ` variant=${block.annotation.variant}`}`,
        JSON.stringify(content), '\`\`\`', '');
    }
  }
  return lines.join('\n');
}

test('D5 signed pack-less dictionary recomputation is decisive after real authentication', async () => {
  const source = dictionarySource();
  const receipt = signedReceipt(await candidate.receipts.issueReceipt(source, { issued_at: options.issued_at, issuer: 'synthetic-key' }));
  let result = await receiptObservation('pack-less-dictionary', receipt, source, []);
  assert.equal(result.calls, 1); assert.equal(result.result.recomputed.length, 8); assert.deepEqual(codes(result.result), ['RCP-05']);
  const changed = clone(receipt); changed.computation.results.find(value => value.calc_id === 'cap_rate').value = 123;
  changed.computation.results_digest = await candidate.receipts.computeResultsDigest(changed.computation.results); signedReceipt(changed);
  result = await receiptObservation('pack-less-decisive-dictionary-disagreement', changed, source, []);
  assert.equal(result.calls, 1); assert.equal(result.result.recomputed.length, 8); assert.ok(codes(result.result).includes('RCP-03')); assert.equal(result.result.verdict, 'failed');
});

test('D5 authentication precedes typed financial refusal across engine identities', async () => {
  const issued = await candidate.receipts.issueReceipt(singleSource, options);
  const refusing = { ...pack, calculations: [{ ...pack.calculations[0], formula: 'irr(1,1)' }] };
  for (const otherEngine of [false, true]) for (const invalid of [false, true]) {
    const receipt = clone(issued); if (otherEngine) receipt.computation.engine = 'different-engine'; signedReceipt(receipt);
    if (invalid) { const bytes = Buffer.from(receipt.signature.value, 'base64'); bytes[0] ^= 1; receipt.signature.value = bytes.toString('base64'); }
    const observed = await receiptObservation(`authenticate-before-refusal-${otherEngine}-${invalid}`, receipt, singleSource, [refusing]);
    assert.equal(observed.calls, 1); assert.deepEqual(codes(observed.result), [invalid ? 'RCP-01' : 'RCP-03']);
    assert.equal(observed.result.verdict, 'failed'); assert.equal(observed.result.recomputed?.length, invalid ? undefined : 0);
  }
});

function candidateReserveSource() {
  const original = readFileSync(resolve(root, 'conformance/reserve-draw-bindings/many-to-many-partial/deal.uwx.md'), 'utf8');
  const parsed = candidate.parser.parseUWFile(original);
  const lines = original.split('\n');
  for (const block of [...candidate.parser.parsedPhysicalBlocks(parsed)].reverse()) {
    const content = clone(block.content);
    content._meta.provenance.actor = 'synthetic';
    content._meta.quality.confidence = 'high'; content._meta.quality.human_review_required = false;
    content._meta.lifecycle.superseded ??= false;
    lines.splice(block.lineStart, block.lineEnd - block.lineStart - 1, ...JSON.stringify(content, null, 2).split('\n'));
  }
  const base = lines.join('\n').replace('deal_id: SYNTHETIC-DRAW-BINDING', 'deal_id: SYNTHETIC-DRAW-BINDING\ndeal_name: "Synthetic reserve-plan candidate"');
  const ext = packet.source_cases.find(item => item.name === 'peers-base-detail').source;
  return base + ext.slice(ext.indexOf('```json'));
}

test('subject consumers: once-bound reserve plan fails on changed peer and fresh stamp', async () => {
  const source = candidateReserveSource();
  const original = candidate.parser.parseUWFile(source);
  const changed = candidate.parser.parseUWFile(source.replace('"marker":1', '"marker":999'));
  const plan = JSON.parse(readFileSync(resolve(root, 'conformance/reserve-draw-bindings/many-to-many-partial/plan.json'), 'utf8'));
  plan.source_digest = await candidate.envelope.computeEnvelopeDigest(candidate.envelope.toUWEnvelope(original));
  const frozen = jcs(plan);
  assert.equal((await candidate.reserves.verifyReserveDrawBindings(original, plan)).state, 'verified');
  const freshEnvelope = await stamp(candidate.envelope.toUWEnvelope(changed));
  assert.notEqual(freshEnvelope.semantic_digest, plan.source_digest);
  for (const input of [changed, structuredClone(changed)]) {
    const result = await candidate.reserves.verifyReserveDrawBindings(input, plan);
    assert.equal(result.state, 'failed'); assert.deepEqual(codes(result), ['RDB-02']);
    assert.equal(result.source_digest, freshEnvelope.semantic_digest); assert.equal(jcs(plan), frozen);
  }
  const reviewedNewPlan = clone(plan); reviewedNewPlan.source_digest = freshEnvelope.semantic_digest;
  assert.equal((await candidate.reserves.verifyReserveDrawBindings(changed, reviewedNewPlan)).state, 'verified');
  observations.push({ name: 'once-bound-reserve-plan', original: 'verified', changed_peer: 'RDB-02', fresh_stamp: 'RDB-02', automatic_rebind: false });
});

test('subject consumers: block/six-field/payment-vector inputs do not inherit whole-source scope', async () => {
  const source = candidateReserveSource(); const before = candidate.parser.parseUWFile(source);
  const after = candidate.parser.parseUWFile(source.replace('# Synthetic reserve and gross invoices', '# Changed source prose only'));
  assert.notEqual(digest(candidate.envelope.toUWEnvelope(before)), digest(candidate.envelope.toUWEnvelope(after)));
  const b = before.sections.cash_flow_series.gross; const a = after.sections.cash_flow_series.gross;
  assert.equal(await candidate.integrity.computeBlockHash(b), await candidate.integrity.computeBlockHash(a));
  const hash = await candidate.integrity.computeBlockHash(b);
  for (const block of [b, a]) block.meta.integrity = { content_hash: hash, parent_hash: null, signature: { alg: 'ed25519', kid: 'synthetic-key', signed_at: options.issued_at, sig: 'AAAA' } };
  const signedFields = candidate.integrity.blockSigningPayload(b);
  assert.equal(typeof signedFields, 'string');
  assert.deepEqual(Object.keys(JSON.parse(signedFields)).sort(), ['actor', 'content_hash', 'kid', 'section', 'signed_at', 'timestamp']);
  assert.equal(signedFields, candidate.integrity.blockSigningPayload(a));
  assert.equal(await computeReplacementCashFlowBindingDigest(b.content.series, 'gross', 0, 'USD'),
    await computeReplacementCashFlowBindingDigest(a.content.series, 'gross', 0, 'USD'));
});

test('actual new-subject evidence records native/candidate code identities and results', () => {
  const folder = resolve(root, 'node_modules/.cache/rfc0089-production-evidence'); mkdirSync(folder, { recursive: true });
  const manifest = {scope:'actual production module imports; no forks'};
  writeFileSync(resolve(folder, 'authentication-results.json'), `${JSON.stringify({ platform: process.platform, node: process.version,
    native_forks: manifest, observations, keys: 'ephemeral in memory; no private key persisted',
    status: 'production integration regression; independent implementation review and final CI remain separate' }, null, 2)}\n`);
});
