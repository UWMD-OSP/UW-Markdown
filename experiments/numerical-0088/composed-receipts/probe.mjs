// Isolated actual receipt APIs with real PUBLIC disposable Ed25519 test keys.
// No original receipt/source is rewritten and no production kernel is activated.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromBits, toBits } from '../pinned-fdlibm/words.mjs';
import * as api from '../../../packages/uwmd-verify/dist/index.js';
const HERE = new URL('./', import.meta.url);
const LAB = new URL('../', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const input = JSON.parse(readFileSync(new URL('inputs.json', HERE), 'utf8'));
for (const [path, expected] of Object.entries(input.references)) assert.equal(sha(readFileSync(new URL(path, LAB))), expected, path);
const mode = process.env.RESEARCH_MODE ?? 'unmodified';
const candidate = mode === 'candidate';
const eventOffset = () => process.env.RESEARCH_EVENTS ? statSync(process.env.RESEARCH_EVENTS).size : null;
const fixturePath = 'conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md';
const fixture = readFileSync(new URL(fixturePath, ROOT), 'utf8');
const trajectoryInputs = JSON.parse(readFileSync(new URL('financial-trajectories/inputs.json', LAB), 'utf8'));
const frozenPython = JSON.parse(gunzipSync(readFileSync(new URL('financial-trajectories/evidence/python.json.gz', LAB))));
const selected = trajectoryInputs.cases.find(row => row.id === input.finite_case);
const independent = frozenPython.cases.find(row => row.id === input.finite_case);
assert(selected && independent);
const flows = selected.flows.map(fromBits);
const additions = flows.map((value, i) => `research_flow_${i}: ${JSON.stringify(value)}`).join('\n');
const source = fixture.replace(/\r?\n---\r?\n/, `\n${additions}\n---\n`);
assert.notEqual(source, fixture);
const parsed = api.parseUWFile(source);
assert.deepEqual(flows.map((_v, i) => toBits(parsed.frontmatter[`research_flow_${i}`])), selected.flows);
const formula = `irr(${flows.map((_v, i) => `research_flow_${i}`).join(',')})`;
const pack = { ...api.getPackForAssetClass('multifamily'), id: 'research.rfc0088.composed-receipt', version: '0.0.0-unaccepted',
  calculations: [{ id: 'research_irr', label: 'Synthetic frozen IRR input', formula, deterministic: true, round_to: selected.places }] };
const engine = api.VERIFY_PACKAGE_NAME;
const engine_version = input.synthetic_issuer_engine_version;
const issuer = { pack, filename: 'research.uwx.md', issued_at: input.issued_at, issuer: 'public-research-key-no-trust', engine, engine_version };
const issued = await api.issueReceipt(source, issuer);
assert.equal(issued.computation.results.length, 1);
assert.equal(toBits(issued.computation.results[0].value), independent.result.reporting.bits);
assert.equal(issued.computation.engine, engine);
assert.equal(issued.computation.engine_version, engine_version);
const seed = Buffer.from(input.public_test_seed_hex, 'hex');
assert.equal(seed.length, 32);
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(privateKey);
const publicDer = publicKey.export({ type: 'spki', format: 'der' });
function signed(receipt) {
  const result = clone(receipt);
  const payload = api.receiptSigningPayload(result);
  result.signature = { algorithm: 'ed25519', key_id: input.signature_key_id, value: sign(null, Buffer.from(payload), privateKey).toString('base64') };
  assert.equal(cryptoValid(result), true);
  return result;
}
function cryptoValid(receipt) {
  return receipt.signature?.algorithm === 'ed25519' && receipt.signature.key_id === input.signature_key_id
    && verify(null, Buffer.from(api.receiptSigningPayload(receipt)), publicKey, Buffer.from(receipt.signature.value, 'base64'));
}
function corruptSignature(receipt) {
  const result = clone(receipt);
  const bytes = Buffer.from(result.signature.value, 'base64');
  bytes[0] ^= 1;
  result.signature.value = bytes.toString('base64');
  assert.equal(cryptoValid(result), false);
  return result;
}
const signedIssued = signed(issued);
const rows = [];
async function check(id, receipt, recordSource, options, expected) {
  const before = JSON.stringify(receipt);
  const payload = api.receiptSigningPayload(receipt);
  const calls = [];
  const start = eventOffset();
  const backend = { verify: async (received, receivedPayload) => {
    calls.push({ receipt_sha256: sha(JSON.stringify(received)), payload_sha256: sha(receivedPayload), payload_equal_to_preflight: receivedPayload === payload,
      signature_valid: cryptoValid(received), primitive_bytes_at_call: eventOffset() });
    return received.signature?.algorithm === 'ed25519' && received.signature.key_id === input.signature_key_id
      && verify(null, Buffer.from(receivedPayload), publicKey, Buffer.from(received.signature.value, 'base64'));
  } };
  const { no_backend, ...supplied } = options;
  const result = await api.verifyReceipt(receipt, recordSource, { filename: 'research.uwx.md', packs: [pack], engine, engine_version,
    ...(!no_backend ? { signatureVerifier: backend } : {}), ...supplied });
  assert.equal(JSON.stringify(receipt), before, `${id}: receipt mutation`);
  assert.deepEqual([result.verdict, result.issues.map(issue => issue.code), calls.length], expected, id);
  for (const call of calls) assert.equal(call.payload_equal_to_preflight, true, id);
  rows.push({ id, synthetic_control: true, receipt, receipt_json_sha256: sha(before), source_sha256: sha(recordSource),
    signing_payload: payload, signing_payload_sha256: sha(payload), external_crypto_valid: receipt.signature ? cryptoValid(receipt) : null,
    options: { ...supplied, no_backend: no_backend === true }, expected, result, backend_calls: calls,
    primitive_event_byte_range: { start, end: eventOffset() }, receipt_unchanged: true });
}
await check('finite-signed-agreement', signedIssued, source, {}, ['verified', [], 1]);
await check('finite-version-difference-agreement', signedIssued, source, { engine_version: input.synthetic_other_engine_version }, ['verified', [], 1]);
if (candidate) {
  await check('finite-unsigned-agreement', issued, source, {}, ['verified', [], 0]);
  await check('finite-no-backend', signedIssued, source, { no_backend: true }, ['unverifiable', ['RCP-08'], 0]);
  const wrong = clone(signedIssued);
  assert.notEqual(wrong.computation.results[0].value, 0);
  wrong.computation.results[0].value = 0; // Explicit false reported-value control; no financial formula is changed.
  wrong.computation.results_digest = await api.computeResultsDigest(wrong.computation.results);
  assert.equal(cryptoValid(wrong), false);
  await check('finite-wrong-value-retained-signature', wrong, source, {}, ['failed', ['RCP-01'], 1]);
  const resignedWrong = signed(wrong);
  await check('finite-wrong-value-resigned-same-engine', resignedWrong, source, {}, ['failed', ['RCP-03'], 1]);
  await check('finite-wrong-value-resigned-other-version', resignedWrong, source, { engine_version: input.synthetic_other_engine_version }, ['unverifiable', ['RCP-07', 'RCP-03'], 1]);
  await check('finite-wrong-value-no-backend', resignedWrong, source, { no_backend: true }, ['unverifiable', ['RCP-08'], 0]);
  const wrongDigest = clone(signedIssued); wrongDigest.computation.results_digest = `sha256:${'0'.repeat(64)}`;
  await check('finite-stale-results-digest-resigned', signed(wrongDigest), source, {}, ['failed', ['RCP-04'], 1]);
  const uncovered = clone(signedIssued); uncovered.computation.results = [];
  uncovered.computation.results_digest = await api.computeResultsDigest([]);
  await check('finite-missing-output-resigned', signed(uncovered), source, {}, ['failed', ['RCP-02'], 1]);
  await check('finite-invalid-signature', corruptSignature(signedIssued), source, {}, ['failed', ['RCP-01'], 1]);
  const prior = JSON.parse(readFileSync(new URL('impact/financial-evidence/baseline.financial.json', LAB), 'utf8'));
  const old = prior.receipts.find(row => row.id === input.prior_refusal_receipt);
  assert(old?.issued_receipt);
  const originalReceipt = old.issued_receipt;
  const signedOldClone = signed(originalReceipt);
  const priorOptions = { packs: [old.pack] };
  await check('refusal-valid-research-signature', signedOldClone, prior.source, priorOptions, ['failed', ['RCP-03'], 0]);
  await check('refusal-invalid-research-signature', corruptSignature(signedOldClone), prior.source, priorOptions, ['failed', ['RCP-03'], 0]);
  await check('refusal-no-backend', signedOldClone, prior.source, { ...priorOptions, no_backend: true }, ['unverifiable', ['RCP-08'], 0]);
  await check('refusal-same-historical-labels', signedOldClone, prior.source,
    { ...priorOptions, engine: originalReceipt.computation.engine, engine_version: originalReceipt.computation.engine_version }, ['failed', ['RCP-03'], 0]);
  const subject = clone(signedOldClone); subject.subject.digest = `sha256:${'0'.repeat(64)}`;
  await check('refusal-subject-mismatch-before-recompute', subject, prior.source, priorOptions, ['failed', ['RCP-01'], 0]);
  const referenced = clone(signedOldClone);
  referenced.inputs_provenance = [{ source: 'market_data', document_id: 'synthetic-input', digest: `sha256:${'1'.repeat(64)}` }];
  const signedReferenced = signed(referenced);
  await check('refusal-held-reference-mismatch', signedReferenced, prior.source,
    { ...priorOptions, inputs: { 'synthetic-input': `sha256:${'2'.repeat(64)}` } }, ['failed', ['RCP-12'], 0]);
  await check('refusal-unavailable-reference', signedReferenced, prior.source, priorOptions, ['unverifiable', ['RCP-11'], 0]);
  await check('refusal-unavailable-pack', signedOldClone, prior.source, { packs: [] }, ['unverifiable', ['RCP-05'], 0]);
  const oldBefore = JSON.stringify(originalReceipt);
  assert.equal(JSON.stringify(prior.receipts.find(row => row.id === input.prior_refusal_receipt).issued_receipt), oldBefore);
}
const result = { status: 'UNACCEPTED composed research receipts, real public-test-key signatures, no trust/production/conformance claim', mode,
  runtime: { node: process.version, v8: process.versions.v8, openssl: process.versions.openssl, platform: process.platform, architecture: process.arch },
  source, source_sha256: sha(source), source_fixture: fixturePath, source_fixture_sha256: sha(fixture), pack, issued_receipt: issued,
  independent_reference: { case: selected.id, exact_flow_words: selected.flows, frozen_python_result: independent.result, candidate_reported_word: toBits(issued.computation.results[0].value),
    note: 'Frozen independent Python full graph/reporting reference reused; it is not newly executed or accepted as normative.' },
  public_test_key: { seed_hex: input.public_test_seed_hex, public_spki_hex: publicDer.toString('hex'), key_id: input.signature_key_id, warning: 'Deliberately public synthetic test key. Never a trust principal or credential.' },
  rows, limits: ['All signed/re-signed/metadata-edited controls are newly created synthetic artifacts, never authenticated originals.', 'Existing receipt schema, signing-payload domain and refusal/signature/engine precedence are unchanged.', 'No new financial reference answer, numerical procedure, package version, normative activation or historical compatibility regime is selected.'] };
writeFileSync(process.env.RECEIPT_AUTH_OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ mode, cases: rows.length, output: process.env.RECEIPT_AUTH_OUTPUT }));
