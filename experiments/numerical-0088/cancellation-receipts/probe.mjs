// Two real financial cancellation inputs through unchanged actual receipt APIs.
// Every issued/signed artifact is synthetic research, never a production identity.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as api from '../../../packages/uwmd-verify/dist/index.js';
import { fromBits, toBits } from '../pinned-fdlibm/words.mjs';
const HERE = new URL('./', import.meta.url);
const LAB = new URL('../', import.meta.url);
const ROOT = new URL('../../../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const input = JSON.parse(readFileSync(new URL('inputs.json', HERE), 'utf8'));
for (const [path, expected] of Object.entries(input.references)) assert.equal(sha(readFileSync(new URL(path, LAB))), expected, path);
const load = path => JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path, 'utf8'));
const unpack = path => JSON.parse(gunzipSync(readFileSync(new URL(path, LAB))));
const priorInputs = JSON.parse(readFileSync(new URL('cancellation-accuracy/inputs.json', LAB), 'utf8'));
const priorPython = unpack('cancellation-accuracy/evidence/python.json.gz');
const priorHost = unpack('cancellation-accuracy/evidence/unmodified.json.gz');
const priorCandidate = unpack('cancellation-accuracy/evidence/candidate.json.gz');
const keyInput = JSON.parse(readFileSync(new URL('composed-receipts/inputs.json', LAB), 'utf8'));
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(keyInput.public_test_seed_hex, 'hex')]), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(key);
const publicSpki = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
const fixture = readFileSync(new URL(input.fixture, ROOT), 'utf8');
assert.equal(sha(readFileSync(new URL(input.fixture, ROOT))), input.fixture_sha256);
const engine = api.VERIFY_PACKAGE_NAME;
const version = input.synthetic_version;
const mode = process.env.RESEARCH_MODE ?? 'unmodified';
const eventOffset = () => process.env.RESEARCH_EVENTS ? statSync(process.env.RESEARCH_EVENTS).size : null;
const cases = input.case_ids.map(id => {
  const item = priorInputs.cases.find(row => row.id === id);
  const reference = priorPython.references.find(row => row.id === id);
  const python = priorPython.candidate.find(row => row.id === id);
  const candidate = priorCandidate.boundaries.find(row => row.id === id);
  const host = priorHost.boundaries.find(row => row.id === id);
  assert(item && reference && python && candidate && host);
  assert.equal(item.n, 1);
  assert.equal(item.rate, 'bc90000000000001');
  assert.equal(reference.whole_formula_reporting.token, '1');
  assert.equal(python.reporting.bits, candidate.quantized.bits);
  const values = { research_rate: fromBits(item.rate), research_n: item.n, research_amount: fromBits(item.amount), research_other: fromBits(item.other) };
  const fields = Object.entries(values).map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join('\n');
  const source = fixture.replace(/\r?\n---\r?\n/, `\n${fields}\n---\n`);
  assert.notEqual(source, fixture);
  const parsed = api.parseUWFile(source);
  assert.equal(toBits(parsed.frontmatter.research_rate), item.rate);
  assert.equal(toBits(parsed.frontmatter.research_amount), item.amount);
  assert.equal(toBits(parsed.frontmatter.research_other), item.other);
  assert.equal(parsed.frontmatter.research_n, item.n);
  const pack = { ...api.getPackForAssetClass('multifamily'), id: `research.rfc0088.cancellation.${item.op}`, version: '0.0.0-unaccepted',
    calculations: [{ id: 'research_scalar', label: 'Two frozen cancellation scalars', deterministic: true, round_to: item.places,
      formula: `${item.op}(research_rate,research_n,research_amount${item.op === 'pmt' ? '' : ',research_other'})` }] };
  return { id, op: item.op, source, source_sha256: sha(source), pack, exact_inputs: item,
    frozen_reference: { mathematical_reporting: reference.whole_formula_reporting, candidate_reporting: python.reporting, candidate_raw: python.raw, original_windows_host_boundary: host } };
});
function signatureValid(receipt) {
  return receipt.signature?.algorithm === 'ed25519' && receipt.signature.key_id === keyInput.signature_key_id
    && verify(null, Buffer.from(api.receiptSigningPayload(receipt)), publicKey, Buffer.from(receipt.signature.value, 'base64'));
}
function signed(receipt) {
  const result = structuredClone(receipt);
  result.signature = { algorithm: 'ed25519', key_id: keyInput.signature_key_id,
    value: sign(null, Buffer.from(api.receiptSigningPayload(result)), key).toString('base64') };
  assert.equal(signatureValid(result), true);
  return result;
}
function invalidSignature(receipt) {
  const result = structuredClone(receipt);
  const bytes = Buffer.from(result.signature.value, 'base64');
  bytes[0] ^= 1;
  result.signature.value = bytes.toString('base64');
  assert.equal(signatureValid(result), false);
  return result;
}
const rows = [];
async function check(id, receipt, item, { other_version = false, no_backend = false } = {}, expected) {
  const before = JSON.stringify(receipt);
  const payload = api.receiptSigningPayload(receipt);
  const calls = [];
  const start = eventOffset();
  const verifier = { verify: async (received, bytes) => {
    const valid = verify(null, Buffer.from(bytes), publicKey, Buffer.from(received.signature.value, 'base64'));
    calls.push({ receipt_sha256: sha(JSON.stringify(received)), payload_sha256: sha(bytes), signature_valid: valid,
      primitive_bytes_at_call: eventOffset() });
    assert.equal(bytes, payload);
    return received.signature.algorithm === 'ed25519' && received.signature.key_id === keyInput.signature_key_id && valid;
  } };
  const result = await api.verifyReceipt(receipt, item.source, { filename: 'research.uwx.md', packs: [item.pack], engine,
    engine_version: other_version ? input.synthetic_other_version : version, ...(!no_backend ? { signatureVerifier: verifier } : {}) });
  assert.equal(JSON.stringify(receipt), before);
  assert.deepEqual([result.verdict, result.issues.map(issue => issue.code), calls.length], expected, id);
  rows.push({ id, case_id: item.id, synthetic_artifact: true, receipt, receipt_sha256: sha(before), source_sha256: item.source_sha256,
    signing_payload: payload, signing_payload_sha256: sha(payload), external_signature_valid: signatureValid(receipt),
    options: { engine, engine_version: other_version ? input.synthetic_other_version : version, no_backend },
    result, expected, backend_calls: calls, primitive_range: { start, end: eventOffset() }, receipt_unchanged: true });
}
async function issue(item) {
  const start = eventOffset();
  try {
    const unsigned = await api.issueReceipt(item.source, { filename: 'research.uwx.md', pack: item.pack, engine, engine_version: version,
      issuer: 'public-research-key-no-trust', issued_at: input.issued_at });
    assert.equal(unsigned.computation.results.length, 1);
    return { status: 'issued', unsigned, signed: signed(unsigned), reported_word: toBits(unsigned.computation.results[0].value),
      primitive_range: { start, end: eventOffset() } };
  } catch (error) {
    assert.equal(error.code, 'RCP_COMPUTATION_FAILED', item.id);
    return { status: 'refused', error: { code: error.code, name: error.name, message: error.message }, primitive_range: { start, end: eventOffset() } };
  }
}
function finiteExpected(same, other = false, invalid = false, noBackend = false) {
  return noBackend ? ['unverifiable', ['RCP-08'], 0] : invalid ? ['failed', ['RCP-01'], 1] : same ? ['verified', [], 1]
    : other ? ['unverifiable', ['RCP-07', 'RCP-03'], 1] : ['failed', ['RCP-03'], 1];
}
function bindPrior(record) {
  assert.equal(record.input_sha256, sha(readFileSync(new URL('inputs.json', HERE))));
  assert.deepEqual(record.cases.map(({ issuance: _issuance, ...item }) => item), cases);
}
const [stage, predecessorPath, destination] = process.argv.slice(2);
assert(['host', 'candidate', 'reverse'].includes(stage));
assert(destination && !existsSync(destination), 'New output required; never overwrite');
let outputs;
let hostSnapshot = null;
if (stage === 'host') {
  assert.notEqual(mode, 'candidate');
  outputs = [];
  for (const item of cases) outputs.push({ ...item, issuance: await issue(item) });
  const pmt = outputs[0].issuance;
  const pv = outputs[1].issuance;
  assert.equal(pv.status, 'issued');
  assert([cases[1].frozen_reference.candidate_reporting.bits, cases[1].frozen_reference.original_windows_host_boundary.quantized.bits].includes(pv.reported_word), 'Unexpected host PV outcome requires investigation');
  assert(pmt.status === 'refused' || pmt.reported_word === cases[0].frozen_reference.candidate_reporting.bits, 'Unexpected host PMT outcome requires investigation');
  await check('host-pv-own-valid', pv.signed, cases[1], {}, ['verified', [], 1]);
} else if (stage === 'candidate') {
  assert.equal(mode, 'candidate');
  hostSnapshot = load(predecessorPath);
  bindPrior(hostSnapshot);
  outputs = [];
  for (const item of cases) {
    const issuance = await issue(item);
    assert.equal(issuance.status, 'issued');
    assert.equal(issuance.reported_word, item.frozen_reference.candidate_reporting.bits);
    outputs.push({ ...item, issuance });
    await check(`candidate-${item.op}-own-valid`, issuance.signed, item, {}, ['verified', [], 1]);
  }
  const received = hostSnapshot.cases[1].issuance;
  const same = received.reported_word === outputs[1].issuance.reported_word;
  await check('host-pv-to-candidate-same-version', received.signed, cases[1], {}, finiteExpected(same));
  await check('host-pv-to-candidate-other-version', received.signed, cases[1], { other_version: true }, finiteExpected(same, true));
  await check('host-pv-to-candidate-invalid-signature', invalidSignature(received.signed), cases[1], {}, finiteExpected(same, false, true));
  await check('host-pv-to-candidate-no-backend', received.signed, cases[1], { no_backend: true }, finiteExpected(same, false, false, true));
} else {
  assert.equal(mode, 'unmodified');
  const candidate = load(predecessorPath);
  bindPrior(candidate);
  hostSnapshot = candidate.host_snapshot;
  bindPrior(hostSnapshot);
  outputs = cases;
  const pmt = candidate.cases[0].issuance.signed;
  const refused = hostSnapshot.cases[0].issuance.status === 'refused';
  await check('candidate-pmt-to-host-same-version', pmt, cases[0], {}, refused ? ['failed', ['RCP-03'], 0] : finiteExpected(true));
  await check('candidate-pmt-to-host-other-version', pmt, cases[0], { other_version: true }, refused ? ['failed', ['RCP-03'], 0] : finiteExpected(true, true));
  await check('candidate-pmt-to-host-invalid-signature', invalidSignature(pmt), cases[0], {}, refused ? ['failed', ['RCP-03'], 0] : finiteExpected(true, false, true));
  await check('candidate-pmt-to-host-no-backend', pmt, cases[0], { no_backend: true }, ['unverifiable', ['RCP-08'], 0]);
  const same = hostSnapshot.cases[1].issuance.reported_word === candidate.cases[1].issuance.reported_word;
  await check('candidate-pv-to-host-valid', candidate.cases[1].issuance.signed, cases[1], {}, finiteExpected(same));
}
writeFileSync(destination, `${JSON.stringify({ status: 'UNACCEPTED newly synthetic two-case actual receipt/signature observations', stage, mode,
  input_sha256: sha(readFileSync(new URL('inputs.json', HERE))), runtime: { node: process.version, v8: process.versions.v8, openssl: process.versions.openssl, platform: process.platform, architecture: process.arch },
  public_test_key: { seed_hex: keyInput.public_test_seed_hex, spki_hex: publicSpki, key_id: keyInput.signature_key_id, warning: 'Public disposable research bytes; no trust principal' },
  cases: outputs, host_snapshot: hostSnapshot, rows,
  limits: ['Source, packs and generated signed receipts are synthetic research artifacts, not authenticated original conformance receipts.',
    'Only two prior exact scalar inputs are exercised, no global accuracy/financial/receipt completeness or normative acceptance.',
    'Engine name is existing; versions are explicit synthetic metadata. Labels do not select the injected graph.',
    'Host agreement/refusal classifications are actual runtime observations, never forced to match the old Windows host.'] })}\n`);
