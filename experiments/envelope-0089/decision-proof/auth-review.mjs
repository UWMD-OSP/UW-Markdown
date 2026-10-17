// Real Ed25519 controls over unapproved candidate signing inputs, not production acceptance.
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { jcs, sha, subject } from '../codec-study/independent.mjs';
import { extensionMinimum, historyMinimum } from './projection.mjs';
const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);
const relativeRoot = new URL('../../../', import.meta.url);
const input = path => readFileSync(new URL(path, relativeRoot));
const json = path => JSON.parse(input(path));
const HISTORICAL_BASE = 'b2ac5d8f';
const NOW = '2026-10-17T00:00:00Z';
// Public, deliberately known research seed. Never a production credential/trust anchor.
const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const privateKey = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]) });
const publicKey = createPublicKey(privateKey);
const kid = 'rfc0089-public-test-seed-only';
const subjectOf = model => ({ representation: 'uwx-markdown', representation_version: 'E_NEXT', canonicalization: 'uw-envelope-semantic', canonicalization_version: 'C_NEXT', digest: subject(model) });
const signed = payload => sign(null, Buffer.from(payload), privateKey).toString('base64url');
const checked = (payload, signature) => verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64url'));
const docInput = artifact => { const { sig: _sig, ...rest } = artifact; return jcs(rest); };
const document = namedSubject => {
  const value = { kind: 'uwmd-document-signature', signature_version: '1', subject: namedSubject, alg: 'ed25519', kid, signed_at: NOW };
  return { ...value, sig: signed(docInput(value)) };
};
const receipt = namedSubject => ({ receipt_version: '1.1', subject: namedSubject,
  computation: { pack: 'research.byte-binding-only', pack_version: 'unallocated-research', engine: 'research.byte-binding-only', engine_version: 'not-an-implementation-version', protocol_version: '4.1.0', results: [{ calc_id: 'synthetic_control', value: 1, computed: true }], results_digest: 'sha256:synthetic-result-placeholder-not-issued' },
  policy: { policy_set: 'research-not-validation', policy_set_version: 'unallocated', validation: { errors: 0, warnings: 0 } }, issued_at: NOW, issuer: 'research-not-a-financial-issuer', signature: null });
const currentPack = { id: 'research.current-receipt-control', version: 'research-only', calculations: [{ id: 'synthetic_control', label: 'Nonfinancial constant control', formula: '1', deterministic: true }] };
const firstBlock = model => { const entry = Object.values(model.extensions)[0]; return entry.mode === 'single' ? entry.block : entry.blocks[0].block; };
const semantic = model => Object.fromEntries(Object.entries(model).filter(([key]) => !['generated_at', 'generator', 'semantic_digest'].includes(key)));
function currentSourceProjection(api, source) {
  // Subject resolution guards run first. No candidate model can replace supplied source.
  const value = clone(api.toUWEnvelope(api.parseUWFile(source)));
  value.envelope_version = 'E_NEXT';
  value.extensions = Object.fromEntries(Object.entries(value.extensions).map(([section, block]) => {
    const opted = own(block.content, '_role') && typeof block.annotation.variant === 'string';
    return [section, opted ? { mode: 'variants', blocks: [{ variant: block.annotation.variant, block }] } : { mode: 'single', block }];
  }));
  return semantic(value);
}
function pinnedBuild(verifyRoot) {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', HISTORICAL_BASE, '--', 'packages/uwmd-verify/src'], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' }).trim().split('\n');
  const source = {};
  for (const path of paths) {
    const expected = execFileSync('git', ['show', `${HISTORICAL_BASE}:${path}`], { cwd: relativeRoot });
    const actual = readFileSync(resolve(verifyRoot, path));
    assert.equal(sha(actual), sha(expected), `production source ${path}`);
    source[path] = sha(actual);
  }
  const compiled = {};
  const directory = resolve(verifyRoot, 'packages/uwmd-verify/dist');
  function walk(folder, prefix = '') {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(path, `${relative}/`);
      else if (entry.name.endsWith('.js')) compiled[`packages/uwmd-verify/dist/${relative}`] = sha(readFileSync(path));
    }
  }
  walk(directory);
  return { source_equivalent_to: execFileSync('git', ['rev-parse', HISTORICAL_BASE], { cwd: relativeRoot, encoding: 'utf8' }).trim(), source, compiled };
}
export async function observe(verifyRoot) {
  const production = pinnedBuild(verifyRoot);
  const api = await import(pathToFileURL(resolve(verifyRoot, 'packages/uwmd-verify/dist/index.js')).href);
  const cases = [];
  const paths = ['single', 'one-peer', 'mixed-null-default', 'ordered-history', 'direct-model-unknown'].map(name => ({ name, base: `experiments/envelope-0089/codec-examples/${name}`, file: 'document.uw.json', source: name !== 'direct-model-unknown' }));
  paths.push(...['all-block-extras', 'xml-lexical-domain'].map(name => ({ name, base: `experiments/envelope-0089/codec-study/fixtures/${name}`, file: 'model.json', source: false })));
  for (const entry of paths) {
    const model = json(`${entry.base}/${entry.file}`);
    assert.equal(subject(model), model.semantic_digest);
    const artifact = document(subjectOf(model));
    assert(checked(docInput(artifact), artifact.sig));
    const receiptInput = receipt(subjectOf(model));
    receiptInput.computation.results_digest = await api.computeResultsDigest(receiptInput.computation.results);
    const payload = api.receiptSigningPayload(receiptInput);
    receiptInput.signature = { algorithm: 'ed25519', key_id: kid, value: signed(payload) };
    assert(checked(api.receiptSigningPayload(receiptInput), receiptInput.signature.value));
    const minimum = { extensions: extensionMinimum(model.extensions), superseded: historyMinimum(model.superseded) };
    const mutations = [];
    for (const name of ['payload', 'prose', 'notes', 'metadata', 'volatile', 'key-order']) {
      const changed = clone(model);
      const block = firstBlock(changed);
      if (name === 'payload') block.content.research_changed = true;
      if (name === 'prose') block.prose = `${block.prose ?? ''} changed`;
      if (name === 'notes') block.content._notes = 'changed annotation excluded from portable minimum';
      if (name === 'metadata') block.content._meta.research_changed = true;
      if (name === 'volatile') { changed.generated_at = NOW; changed.generator = 'research volatile'; }
      const reordered = name === 'key-order' ? Object.fromEntries(Object.entries(changed).reverse()) : changed;
      const newSubject = subjectOf(reordered);
      const changedDoc = { ...artifact, subject: newSubject };
      const changedReceipt = { ...receiptInput, subject: newSubject };
      const expected = name === 'volatile' || name === 'key-order';
      const docValid = checked(docInput(changedDoc), artifact.sig);
      const receiptValid = checked(api.receiptSigningPayload(changedReceipt), receiptInput.signature.value);
      assert.equal(docValid, expected); assert.equal(receiptValid, expected);
      const sameMinimum = jcs({ extensions: extensionMinimum(reordered.extensions), superseded: historyMinimum(reordered.superseded) }) === jcs(minimum);
      if (name === 'notes' || name === 'prose') assert(sameMinimum);
      mutations.push({ kind: name, subject_digest: newSubject.digest, portable_minimum_unchanged: sameMinimum, document_signature_valid: docValid, receipt_signature_valid: receiptValid });
    }
    const labelMutations = [];
    for (const change of [{ representation_version: '1.0', canonicalization_version: '1.0' }, { representation_version: 'E_UNSUPPORTED', canonicalization_version: 'C_UNSUPPORTED' }]) {
      const changedDoc = { ...artifact, subject: { ...artifact.subject, ...change } };
      const changedReceipt = { ...receiptInput, subject: { ...receiptInput.subject, ...change } };
      assert.equal(checked(docInput(changedDoc), artifact.sig), false);
      assert.equal(checked(api.receiptSigningPayload(changedReceipt), receiptInput.signature.value), false);
      labelMutations.push({ change, document_signature_valid: false, receipt_signature_valid: false });
    }
    let source = { supplied: false, research_document_issuance: 'refused-no-attributable-source', candidate_receipt_issuance: 'not-implemented-or-approved' };
    if (entry.source) {
      const raw = input(`${entry.base}/original.uwx.md`);
      const text = raw.toString('utf8');
      const plan = json(`${entry.base}/reissuance-plan.json`);
      assert.equal(sha(raw), plan.original_sha256);
      source = { supplied: true, raw_sha256: sha(raw), candidate_receipt_issuance: 'not-implemented-or-approved' };
      try {
        const currentSubject = await api.resolveDocumentSigningSubject(text);
        const projected = currentSourceProjection(api, text);
        assert.equal(jcs(projected), jcs(semantic(model)), 'complete candidate model matches supplied source after unchanged V13 guard');
        source.admission = { allowed: true, current_subject: currentSubject, exact_candidate_projection_equal: true };
        source.research_document_issuance = 'signed-test-artifact-only-current-guard-and-complete-model-agree';
        const currentDocument = document(currentSubject);
        let calls = 0;
        const result = await api.verifyDocumentSignature(text, currentDocument, { signatureVerifier: { verify: async (bytes, named) => { calls++; return { ok: checked(bytes, named.sig) }; } } });
        assert.equal(result.state, 'verified'); assert.equal(calls, 1);
        source.current_document_control = { artifact: currentDocument, result, backend_calls: calls };
        const currentReceipt = await api.issueReceipt(text, { filename: 'research.uwx.md', pack: currentPack, issued_at: NOW });
        currentReceipt.signature = { algorithm: 'ed25519', key_id: kid, value: signed(api.receiptSigningPayload(currentReceipt)) };
        calls = 0;
        const receiptResult = await api.verifyReceipt(currentReceipt, text, { filename: 'research.uwx.md', packs: [currentPack], signatureVerifier: { verify: async (named, bytes) => { calls++; return checked(bytes, named.signature.value); } } });
        assert.equal(receiptResult.verdict, 'verified'); assert.equal(calls, 1);
        source.current_receipt_control = { receipt: currentReceipt, result: receiptResult, backend_calls: calls };
      } catch (error) {
        if (error.name !== 'DocumentSigningError') throw error;
        source.admission = { allowed: false, code: error.code, error: error.message };
        source.research_document_issuance = 'refused-existing-V13-source-guard-before-signing';
      }
      let calls = 0;
      const rejectedDocument = await api.verifyDocumentSignature(text, artifact, { signatureVerifier: { verify: async (bytes, named) => { calls++; return { ok: checked(bytes, named.sig) }; } } });
      assert.deepEqual(rejectedDocument.issues.map(issue => issue.code), ['INT-14']); assert.equal(calls, 0);
      source.current_verifier_candidate_document = { result: rejectedDocument, backend_calls: calls };
      calls = 0;
      const rejectedReceipt = await api.verifyReceipt(receiptInput, text, { filename: 'research.uwx.md', packs: [currentPack], signatureVerifier: { verify: async (named, bytes) => { calls++; return checked(bytes, named.signature.value); } } });
      assert.deepEqual(rejectedReceipt.issues.map(issue => issue.code), ['RCP-10']); assert.equal(calls, 0);
      source.current_verifier_candidate_receipt = { result: rejectedReceipt, backend_calls: calls };
    }
    cases.push({ case: entry.name, complete_model_sha256: sha(input(`${entry.base}/${entry.file}`)), semantic_digest: model.semantic_digest, extension_minimum: minimum, extension_minimum_sha256: sha(jcs(minimum)), research_document: { artifact, signing_payload: docInput(artifact), signing_payload_sha256: sha(docInput(artifact)), cryptographic_validity: true }, research_receipt_signing_control: { artifact: receiptInput, signing_payload: payload, signing_payload_sha256: sha(payload), cryptographic_validity: true, scope: 'scratch-built receipt-shaped byte-binding input, never issued as a candidate financial receipt' }, mutations, label_mutations: labelMutations, source });
  }
  const mixed = cases.find(row => row.case === 'mixed-null-default');
  assert.deepEqual(mixed.extension_minimum.extensions.x_review.blocks.map(record => record.variant), [null, 'default']);
  const duplicate = clone(json('experiments/envelope-0089/codec-examples/mixed-null-default/document.uw.json').extensions);
  duplicate.x_review.blocks[1] = clone(duplicate.x_review.blocks[0]);
  assert.throws(() => extensionMinimum(duplicate), /duplicate/);
  return { status: 'UNAPPROVED RESEARCH; REAL ED25519 BYTE BINDING IS NOT SOURCE AUTHENTICATION OR FINANCIAL VERIFICATION', production, test_key: { status: 'public known research seed, never a credential or trust anchor', algorithm: 'Ed25519', public_key_spki_der_base64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }, cases, duplicate_identity_projection: 'refused', candidate_receipt_verification: 'not implemented; current API refusal observations only', normative_scope: 'no V13 admission expansion, no RFC0085 history authority, no production labels allocated' };
}
