// Research probe only: no normative fixture or implementation changes.
// Run from the repo root: node docs/reviews/2026-10-02-outright-cap-replacement.repro.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseUWFile, validateUWFile, FORMAT_VERSION, PROTOCOL_VERSION, CORE_VERSION } from '../../packages/uwmd-core/dist/index.js';
const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const debt = {
  loan_amount: 32500000, rate_type: 'floating', rate_index: 'sofr', rate_cap_pct: 0.055,
  rate_hedge: { instrument: 'rate_cap', notional: 32500000, strike_rate: 0.055, index: 'sofr',
    effective_date: '2026-01-01', expiration_date: '2028-01-01', premium: 400000,
    post_expiration_assumption: 'replace' }
};
const uses = { rate_cap_cost: 400000 };
const flow = { label: 'Interest-rate cap cash flows', series: [
  { date: '2026-01-01', amount: -400000, kind: 'debt_service', label: 'rate_cap_premium' },
  { date: '2028-01-01', amount: -360000, kind: 'debt_service', label: 'rate_cap_replacement_purchase' }
] };
const meta = (section) => ({ section, provenance: { source: 'manual', timestamp: '2026-10-02T00:00:00Z' },
  quality: { confidence: 'high', human_review_required: false }, lifecycle: { revision: 1, superseded: false } });
function document({ debt: d = debt, uses: u = uses, flow: f, omitSU = false, omitUses = false } = {}) {
  const parts = [['debt_structure', d]];
  if (!omitSU) parts.push(['sources_uses', omitUses ? {} : { uses: u }]);
  if (f) parts.push(['cash_flow_series', f]);
  return ['---', 'uw_version: "2.0"', 'deal_id: OUTRIGHT-REPLACEMENT-RESEARCH',
    'asset_class: office', 'currency_code: USD', '---', '',
    ...parts.map(([section, content]) => ['```json uw:section=', section,
      ' variant=base source=manual ts=2026-10-02T00:00:00Z v=1\n',
      JSON.stringify({ _meta: meta(section), ...content }, null, 2), '\n```'].join('')), ''].join('\n\n');
}
const clonedDebt = (edit) => { const d = structuredClone(debt); edit(d); return d; };
const cases = [
  ['replace_no_escrow', {}, ['ESC-04']],
  ['replace_labeled_future_cash', { flow }, ['ESC-04']],
  ['replace_escrow_funded_control', { uses: { ...uses, escrows: [
    { name: 'rate_cap_replacement', upfront: 0, monthly: 15000 }] } }, []],
  ['replace_fake_future_amount_as_upfront', { uses: { ...uses, escrows: [
    { name: 'rate_cap_replacement', upfront: 360000 }] } }, []],
  ['replace_zero_escrow_loophole', { flow, uses: { ...uses, escrows: [
    { name: 'rate_cap_replacement', upfront: 0, monthly: 0 }] } }, []],
  ['replace_null_escrow_amounts', { uses: { ...uses, escrows: [
    { name: 'rate_cap_replacement', upfront: null, monthly: null }] } }, ['ESC-01']],
  ['replace_missing_escrow_amounts', { uses: { ...uses, escrows: [
    { name: 'rate_cap_replacement' }] } }, ['ESC-01']],
  ['replace_other_escrow', { uses: { ...uses, escrows: [
    { name: 'other', label: 'Future cap purchase', upfront: 360000 }] } }, ['ESC-04']],
  ['replace_initial_premium_inflated', { debt: clonedDebt(d => { d.rate_hedge.premium = 760000; }), flow }, ['ESC-04', 'HDG-05']],
  ['replace_unsupported_inline_object', { debt: clonedDebt(d => { d.rate_hedge.replacement_purchase =
    { date: '2028-01-01', amount: 360000, funding: 'outright' }; }), flow }, ['ESC-04']],
  ['replace_unsupported_purchase_kind', { flow: { ...flow, series: [
    { ...flow.series[1], kind: 'rate_cap_replacement_purchase' }] } }, ['CF-01', 'ESC-04']],
  ['cash_series_only_omits_hedge', { debt: clonedDebt(d => delete d.rate_hedge), flow }, []],
  ['falsely_unhedged_with_purchase', { debt: clonedDebt(d => { d.rate_hedge.post_expiration_assumption = 'unhedged'; }), flow }, []],
  ['falsely_matures_first_with_purchase', { debt: clonedDebt(d => { d.rate_hedge.post_expiration_assumption = 'loan_matures_first'; }), flow }, []],
  ['replace_omitted_sources_uses_bypass', { omitSU: true, flow }, []],
  ['replace_omitted_uses_bypass', { omitUses: true, flow }, []]
];
const results = cases.map(([name, args, expected]) => {
  const result = validateUWFile(parseUWFile(document(args)));
  const issues = result.issues.filter(i => /^(HDG|ESC|CF)-/.test(i.code));
  const codes = issues.map(i => i.code).sort();
  assert.deepEqual(codes, expected.slice().sort(), name);
  return { name, relevant_codes: codes, all_codes: result.issues.map(i => i.code).sort(),
    issues: issues.map(({code, severity, message}) => ({code, severity, message})) };
});
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schemas = {
  hedge: ajv.compile(JSON.parse(read('spec/schemas/debt-rate-hedge.schema.json'))),
  escrow: ajv.compile(JSON.parse(read('spec/schemas/sources-uses-escrow.schema.json'))),
  cash: ajv.compile(JSON.parse(read('spec/schemas/section-cash-flow-series.schema.json')))
};
const schemaCases = [
  ['released_hedge_shape', 'hedge', debt.rate_hedge, true],
  ['unsupported_inline_shape', 'hedge', { ...debt.rate_hedge,
    replacement_purchase: { date: '2028-01-01', amount: 360000 } }, false],
  ['zero_escrow_shape', 'escrow', { name: 'rate_cap_replacement', upfront: 0, monthly: 0 }, true],
  ['null_escrow_shape_not_semantics', 'escrow', { name: 'rate_cap_replacement', upfront: null, monthly: null }, true],
  ['cash_flow_row_shape', 'cash', flow, true]
].map(([name, schema, input, expected]) => {
  const valid = schemas[schema](input);
  assert.equal(valid, expected, name);
  return { name, valid, errors: structuredClone(schemas[schema].errors) };
});
const fixture = validateUWFile(parseUWFile(read('conformance/hedge/reject-replace-without-escrow/deal.uwx.md')));
assert.deepEqual(fixture.issues.filter(i => /^(HDG|ESC)-/.test(i.code)).map(i => i.code), ['ESC-04']);
console.log(JSON.stringify({ root: fileURLToPath(root), versions: { format: FORMAT_VERSION, protocol: PROTOCOL_VERSION, core: CORE_VERSION },
  interpretation: 'Synthetic calendar dates; original StackUW export fixture has a default forecast anchor. No full-deal validation claim.',
  attempted_document: document({ flow }), results, schema_results: schemaCases,
  existing_fixture_codes: fixture.issues.filter(i => /^(HDG|ESC)-/.test(i.code)).map(i => i.code) }, null, 2));
