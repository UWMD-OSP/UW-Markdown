// Executable worked example of the RFC 0044 production adapter.
// No CLI input or document writes. All economics/dates are explicitly authored.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseUWFile, getSectionVariant, projectLeaseUpCashFlows,
  verifyLeaseUpSchedule, leaseUpContext, datedFlowsOf, xnpvOf,
  quantizeDecimal, CASH_FLOW_VERIFY_DECIMALS,
} from '../packages/uwmd-core/dist/index.js';

const exampleUrl = new URL('../docs/examples/lease-up-dated-cash-flow.json', import.meta.url);
const example = JSON.parse(readFileSync(exampleUrl, 'utf8'));
const sourceUrl = new URL(example.source_document, exampleUrl);
const source = readFileSync(sourceUrl, 'utf8');
const parsed = parseUWFile(source);
const selected = getSectionVariant(parsed, 'lease_up_schedule', example.source_variant);
assert.ok(selected, 'The explicitly selected source variant must exist.');
const sourceCheck = verifyLeaseUpSchedule(selected.content, leaseUpContext(parsed));
assert.equal(sourceCheck.verdict, 'verified', JSON.stringify(sourceCheck.issues));
const projection = await projectLeaseUpCashFlows(parsed, {
  source_variant: example.source_variant,
  day_count: example.day_count,
  cash_dates: example.bindings.map(row => ({ period: row.period, date: row.cash_date })),
});
const bindingChecks = projection.bindings.map(binding => {
  const authored = example.bindings.find(row => binding.source_path === `lease_up_schedule.schedule@${row.period}.net_cash_flow`);
  assert.ok(authored, 'Every binding must have an authored scenario row.');
  assert.equal(binding.amount, authored.stated_amount);
  assert.equal(binding.date, authored.cash_date);
  return { ...binding, source_variant: projection.source_variant, matched: true };
});
const series = projection.series;
const flows = datedFlowsOf(series);
assert.ok(flows, 'Authored dates, day count and amounts must form a valid dated series.');
const presentValue = quantizeDecimal(xnpvOf(flows, example.discount_rate), CASH_FLOW_VERIFY_DECIMALS.currency);
assert.equal(readFileSync(sourceUrl, 'utf8'), source, 'The example must not edit its source.');
console.log(JSON.stringify({
  scope: example.description,
  source_envelope_digest: projection.source_envelope_digest,
  source_verification: sourceCheck.verdict,
  binding_checks: bindingChecks,
  series,
  present_value: { anchor: example.bindings[0].cash_date, rate: example.discount_rate,
    day_count: example.day_count, value: presentValue, unit: '$', round_to: CASH_FLOW_VERIFY_DECIMALS.currency },
  investment_returns: 'Not computed: acquisition, operating expenses, debt and disposition are not supplied.',
}, null, 2));
