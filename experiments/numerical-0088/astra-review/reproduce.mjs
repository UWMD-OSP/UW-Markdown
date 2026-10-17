// External-review claims reproduced through unchanged production APIs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILTINS } from '../../../packages/uwmd-verify/dist/calc/builtins.js';
import { evaluateCalc } from '../../../packages/uwmd-verify/dist/calc/index.js';
import { parseUWFile } from '../../../packages/uwmd-verify/dist/parser.js';
import { issueReceipt, verifyReceipt, receiptSigningPayload, computeResultsDigest } from '../../../packages/uwmd-verify/dist/receipts.js';

const ROOT = new URL('../../../', import.meta.url);
const HASH = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const bits = value => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, '0');
};
const numeric = value => ({
  class: Number.isNaN(value) ? 'nan' : value === Number.POSITIVE_INFINITY ? 'positive_infinity' : value === Number.NEGATIVE_INFINITY ? 'negative_infinity' : Object.is(value, -0) ? 'negative_zero' : 'finite',
  ...(Number.isFinite(value) ? { value, bits: bits(value) } : {}),
});
const observedCall = (name, args) => {
  try { return { ok: true, result: numeric(BUILTINS[name](args)) }; }
  catch (error) { return { ok: false, code: error.code ?? error.proto?.code, message: error.message }; }
};
const raw = '---\nuw_version: "3.0"\nasset_class: multifamily\nstage: screening\ndiscount_rate: 1e155\ntiny_flow: 1e-200\nhuge_flow: 1e308\n---\n\n```json uw:section=property_details v=1\n{"_meta":{"source":"user","updated_at":"2026-10-16T00:00:00Z","updated_by":"research"},"unit_count":1}\n```\n';
const parsed = parseUWFile(raw);
assert.equal(parsed.frontmatter.discount_rate, 1e155);
const evaluate = formula => {
  const result = evaluateCalc({ id: 'research', label: 'Research only', formula, deterministic: true, round_to: 12 }, { parsed, prior_results: {} });
  return { ok: result.ok, value: result.value, ...(result.error ? { code: result.error.code } : {}) };
};

function irrBranch(flows) {
  const at = r => flows.reduce((sum, amount, t) => sum + amount / (1 + r) ** t, 0);
  const lo = -0.999;
  const hi = 10;
  const flo = at(lo);
  const fhi = at(hi);
  const mid = (lo + hi) / 2;
  const fmid = at(mid);
  return { lo: numeric(lo), hi: numeric(hi), flo: numeric(flo), fhi: numeric(fhi), product: numeric(flo * fhi),
    product_positive: flo * fhi > 0, lower_exact_zero: flo === 0, upper_exact_zero: fhi === 0,
    first_midpoint: numeric(mid), fmid: numeric(fmid), value_tolerance_met: Math.abs(fmid) < 1e-9,
    half_interval_tolerance_met: (hi - lo) / 2 < 1e-12, actual: observedCall('irr', flows) };
}

async function receipts() {
  // Controlled synthetic pack swap forces a recomputation exception. This probes
  // control flow; it is NOT evidence that candidate fdlibm changes this pack.
  const declaration = formula => ({ id: 'research_value', label: 'Synthetic control', formula, deterministic: true, round_to: 6 });
  const basePack = { id: 'research.rfc0088', version: '0.0.0-research', calculations: [declaration('8')] };
  const failingPack = { ...basePack, calculations: [declaration('1 / 0')] };
  const issued = await issueReceipt(raw, { filename: 'research.uwx.md', pack: basePack, issued_at: '2026-10-16T00:00:00Z', engine: 'research.issuer', engine_version: 'old' });
  const signed = clone(issued);
  signed.signature = { algorithm: 'research-only', key_id: 'research-key', value: 'not-a-real-signature' };
  const cases = [];
  async function run(id, { receipt = signed, pack = basePack, engine_version = 'old', backend = true, valid = true, inputs } = {}) {
    let backend_calls = 0;
    const result = await verifyReceipt(receipt, raw, { filename: 'research.uwx.md', packs: [pack], engine: 'research.issuer', engine_version,
      ...(inputs ? { inputs } : {}),
      ...(backend ? { signatureVerifier: { verify: async () => { backend_calls++; return valid; } } } : {}),
    });
    const row = { id, verdict: result.verdict, codes: result.issues.map(issue => issue.code), backend_calls,
      recomputed: result.recomputed ?? null };
    cases.push(row);
    return row;
  }
  await run('same-engine-agreement');
  await run('different-engine-agreement', { engine_version: 'new' });
  const disagreement = clone(signed);
  disagreement.computation.results[0].value = 9;
  disagreement.computation.results_digest = await computeResultsDigest(disagreement.computation.results);
  await run('same-engine-finite-disagreement', { receipt: disagreement });
  await run('different-engine-finite-disagreement', { receipt: disagreement, engine_version: 'new' });
  await run('different-engine-finite-disagreement-invalid-signature', { receipt: disagreement, engine_version: 'new', valid: false });
  await run('same-engine-forced-refusal', { pack: failingPack });
  await run('different-engine-forced-refusal', { pack: failingPack, engine_version: 'new' });
  await run('different-engine-forced-refusal-invalid-backend-result', { pack: failingPack, engine_version: 'new', valid: false });
  await run('different-engine-forced-refusal-no-backend', { pack: failingPack, engine_version: 'new', backend: false });
  const wrongSubject = clone(signed);
  wrongSubject.subject.digest = `sha256:${'0'.repeat(64)}`;
  await run('subject-mismatch-before-refusal', { receipt: wrongSubject, pack: failingPack, engine_version: 'new' });
  const referenced = clone(signed);
  referenced.inputs_provenance = [{ source: 'market_data', document_id: 'synthetic-input', digest: `sha256:${'1'.repeat(64)}` }];
  await run('held-input-mismatch-before-refusal', { receipt: referenced, pack: failingPack, engine_version: 'new', inputs: { 'synthetic-input': `sha256:${'2'.repeat(64)}` } });
  await run('missing-input-before-refusal', { receipt: referenced, pack: failingPack, engine_version: 'new' });
  const wrongResultsDigest = clone(signed);
  wrongResultsDigest.computation.results_digest = `sha256:${'0'.repeat(64)}`;
  await run('results-digest-after-agreement', { receipt: wrongResultsDigest });
  await run('results-digest-not-reached-on-refusal', { receipt: wrongResultsDigest, pack: failingPack, engine_version: 'new' });
  const newIssued = await issueReceipt(raw, { filename: 'research.uwx.md', pack: basePack, issued_at: '2026-10-16T00:00:00Z', engine: 'research.issuer', engine_version: 'new' });
  assert.equal(newIssued.subject.digest, issued.subject.digest);
  assert.equal(newIssued.computation.results_digest, issued.computation.results_digest);
  assert.notEqual(receiptSigningPayload(newIssued), receiptSigningPayload(issued));
  const find = id => cases.find(row => row.id === id);
  assert.deepEqual([find('different-engine-forced-refusal').verdict, find('different-engine-forced-refusal').codes, find('different-engine-forced-refusal').backend_calls], ['failed', ['RCP-03'], 0]);
  assert.deepEqual(find('different-engine-finite-disagreement').codes, ['RCP-07', 'RCP-03']);
  assert.equal(find('different-engine-finite-disagreement').backend_calls, 1);
  assert.deepEqual(find('different-engine-forced-refusal-no-backend').codes, ['RCP-08']);
  return { scope: 'synthetic pack-swap control-flow harness; stub signature backend, no cryptographic validity or actual candidate transition claim',
    source_sha256: HASH(raw), cases, identity: {
      subject_equal: true, results_digest_equal: true, engine_version_equal: false,
      old_signing_payload_sha256: HASH(receiptSigningPayload(issued)), new_signing_payload_sha256: HASH(receiptSigningPayload(newIssued)),
    } };
}

export async function observe() {
  const productionPaths = ['packages/uwmd-verify/src/calc/builtins.ts', 'packages/uwmd-verify/src/calc/quantize.ts',
    'packages/uwmd-verify/src/receipts.ts', 'spec/UW_PROTOCOL.md', 'spec/UW_RECEIPT.md', 'conformance/corpus-index.json'];
  const hashes = Object.fromEntries(productionPaths.map(path => [path, HASH(readFileSync(new URL(path, ROOT)))]));
  const result = { scope: 'RFC0088 external review reproduction; current production behavior, not normative changes',
    production_hashes: hashes, source_sha256: HASH(raw), irr_zero: irrBranch([0, 0]), irr_tiny_positive: irrBranch([1e-200, 1e-200]),
    exceptional: { internal_denominator: numeric((1 + 1e155) ** 2), raw_npv: observedCall('npv', [1e155, 0, 0, 1]),
      public_pow: observedCall('pow', [1e155, 2]), financial_npv: evaluate('npv(discount_rate, 0, 0, 1)'),
      scientific_literal_grammar: evaluate('npv(1e155, 0, 0, 1)'),
      raw_nonfinite_sum: observedCall('npv', [0, 1e308, 1e308]), final_nonfinite_sum: evaluate('npv(0, huge_flow, huge_flow)'),
      finite_result_from_internal_infinity: evaluate('pow(huge_flow * huge_flow, 0)'),
      finite_exp_from_negative_infinity: evaluate('exp(0 - huge_flow * huge_flow)'),
    }, receipts: await receipts() };
  assert.equal(result.irr_zero.actual.result.value, -0.999);
  assert.equal(result.irr_tiny_positive.actual.result.value, 4.5005);
  assert.equal(result.irr_tiny_positive.product.value, 0);
  assert.deepEqual(result.exceptional.financial_npv, { ok: true, value: 0 });
  assert.equal(result.exceptional.public_pow.code, 'CALC-TYPE-001');
  assert.deepEqual(Object.fromEntries(productionPaths.map(path => [path, HASH(readFileSync(new URL(path, ROOT)))])), hashes);
  return result;
}

// Reviewed source identity changes are separate from frozen behavioral evidence.
// Never derive an approved hash from the current checkout or rewrite observations.
export function verifyReplay(current, frozenBytes, identities) {
  assert.equal(identities.format, 'rfc0088-astra-replay-identities-v1');
  assert.equal(HASH(frozenBytes), identities.historical.observations_sha256, 'frozen observations SHA-256');
  const historical = JSON.parse(frozenBytes.toString('utf8'));
  assert.deepStrictEqual(historical.production_hashes, identities.historical.production_hashes, 'historical source identities');
  assert.deepStrictEqual(current.production_hashes, identities.approved_current.production_hashes, 'approved current source identities');
  const { production_hashes: historicalHashes, ...historicalBehavior } = historical;
  const { production_hashes: currentHashes, ...currentBehavior } = current;
  assert.deepStrictEqual(currentBehavior, historicalBehavior, 'all frozen behavioral observations');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'read-only replay accepts no arguments; frozen observations cannot be overwritten');
  const destination = new URL('observations.json', import.meta.url);
  const frozenBytes = readFileSync(destination);
  const identities = JSON.parse(readFileSync(new URL('integration-identities.json', import.meta.url), 'utf8'));
  // Refuse tampered evidence before invoking production APIs.
  assert.equal(HASH(frozenBytes), identities.historical.observations_sha256, 'frozen observations SHA-256');
  const result = await observe();
  verifyReplay(result, frozenBytes, identities);
  assert.deepStrictEqual(readFileSync(destination), frozenBytes, 'frozen evidence remains immutable during replay');
  console.log(`PASS approved current identities and frozen behavior: 2 IRR branch traces, 9 exceptional-value controls, ${result.receipts.cases.length} receipt precedence controls and identity evidence`);
}
