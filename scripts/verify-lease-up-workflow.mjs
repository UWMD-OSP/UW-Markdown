// Executable worked example, not the proposed RFC 0044 production adapter.
// No CLI input or document writes. All economics/dates are explicitly authored.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseUWFile, getSectionVariant, resolvePeriodColumn, resolvePeriodPath,
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
const context = { sectionVariants: { lease_up_schedule: example.source_variant } };
const reference = period => `lease_up_schedule.schedule@${period}.net_cash_flow`;
const column = resolvePeriodColumn(parsed, reference(example.bindings[0].period), context);
assert.equal(new Set(example.bindings.map(row => row.period)).size, column.rows.length,
  'The worked example must map every source period once.');
assert.equal(example.bindings.length, column.rows.length);
const bindingChecks = example.bindings.map(row => {
  const path = reference(row.period);
  const amount = resolvePeriodPath(parsed, path, context);
  assert.equal(typeof amount, 'number', `Missing numeric source amount: ${path}`);
  assert.equal(row.stated_amount, amount, `Authored cash-flow amount disagrees: ${path}`);
  return { source_path: path, source_variant: example.source_variant,
    date: row.cash_date, amount, matched: true };
});
const series = {
  label: 'Synthetic lease-up receipts and TI/LC only',
  day_count: example.day_count,
  series: bindingChecks.map(row => ({ date: row.date, amount: row.amount, kind: 'other', label: row.source_path })),
};
const flows = datedFlowsOf(series);
assert.ok(flows, 'Authored dates, day count and amounts must form a valid dated series.');
const presentValue = quantizeDecimal(xnpvOf(flows, example.discount_rate), CASH_FLOW_VERIFY_DECIMALS.currency);
assert.equal(readFileSync(sourceUrl, 'utf8'), source, 'The example must not edit its source.');
console.log(JSON.stringify({
  scope: example.description,
  source_verification: sourceCheck.verdict,
  binding_checks: bindingChecks,
  series,
  present_value: { anchor: example.bindings[0].cash_date, rate: example.discount_rate,
    day_count: example.day_count, value: presentValue, unit: '$', round_to: CASH_FLOW_VERIFY_DECIMALS.currency },
  investment_returns: 'Not computed: acquisition, operating expenses, debt and disposition are not supplied.',
}, null, 2));
