// Synthetic Phase 2 observations. Build first, then run from repository root.
import assert from 'node:assert/strict';
import { parseUWFile, datedFlowsOf, xnpvOf, xirrOf, verifyCashFlowSeries, evaluateCashFlowMetric, validateUWFile, evaluateCalc } from '../../packages/uwmd-verify/dist/index.js';
// Authored synthetic project cash ledger, not a generated construction schedule.
const rows = [
  { date: '2027-12-15', amount: -1000000, kind: 'acquisition' },
  { date: '2028-02-29', amount: -500000, kind: 'capex' },
  { date: '2028-06-30', amount: -250000, kind: 'capex' },
  { date: '2028-09-30', amount: -25000, kind: 'operating' },
  { date: '2028-12-15', amount: 2000000, kind: 'disposition' },
];
const first = Date.parse(`${rows[0].date}T00:00:00Z`);
const days = rows.map(r => (Date.parse(`${r.date}T00:00:00Z`) - first) / 86400000);
const oracleNpv = (r, denominator) => rows.reduce((s, row, i) => s + row.amount / (1 + r) ** (days[i] / denominator), 0);
function oracleIrr(denominator) {
  let lo = 0; let hi = 1;
  for (let i = 0; i < 150; i++) {
    const mid = (lo + hi) / 2;
    if (oracleNpv(mid, denominator) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const rounded = (v, d) => Number(v.toFixed(d)); // No tested value lies on a decimal tie.
for (const [basis, denominator] of [['actual/365f', 365], ['actual/360', 360]]) {
  const expected = {
    total_net: rows.reduce((s, r) => s + r.amount, 0),
    moic: rounded(2000000 / 1775000, 4),
    xnpv: { rate: 0.12, value: rounded(oracleNpv(0.12, denominator), 2) },
    xirr: rounded(oracleIrr(denominator), 6),
  };
  const series = { day_count: basis, series: rows, stated_metrics: expected };
  const flows = datedFlowsOf(series);
  assert.equal(rounded(xnpvOf(flows, 0.12), 2), expected.xnpv.value);
  assert.equal(rounded(xirrOf(flows), 6), expected.xirr);
  assert.equal(verifyCashFlowSeries(series).verdict, 'verified');
  const source = `---\nuw_version: "3.0"\ndeal_id: DEVELOPMENT-SYNTHETIC\nasset_class: multifamily\nscenario: ground_up_development\n---\n\n\`\`\`json uw:section=cash_flow_series variant=base source=manual ts=2026-10-15T00:00:00Z v=1\n${JSON.stringify(series)}\n\`\`\`\n`;
  const parsed = parseUWFile(source);
  assert.equal(validateUWFile(parsed).errors.filter(i => i.code.startsWith('CF-')).length, 0);
  const actual = {};
  for (const metric of ['total_net', 'moic', 'xnpv', 'xirr']) {
    const result = evaluateCashFlowMetric({ id: metric, metric, series_path: 'cash_flow_series', variant: 'base', ...(metric === 'xnpv' ? { rate: 0.12 } : {}) }, { parsed, prior_results: {}, locale: 'en-US' });
    assert.equal(result.ok, true);
    const wanted = metric === 'xnpv' ? expected.xnpv.value : expected[metric];
    assert.equal(result.value, wanted);
    actual[metric] = result.value;
  }
  const shifted = structuredClone(series);
  for (const row of shifted.series) row.date = new Date(Date.parse(`${row.date}T00:00:00Z`) + 40 * 86400000).toISOString().slice(0, 10);
  assert.equal(rounded(xnpvOf(datedFlowsOf(shifted), 0.12), 2), expected.xnpv.value);
  assert.equal(rounded(xirrOf(datedFlowsOf(shifted)), 6), expected.xirr);
  console.log(JSON.stringify({ basis, days, expected, actual, verdict: 'verified', shifted_40_calendar_days: 'same metrics' }));
}

// Design evidence only: rounded observational ADR is not necessarily an exact
// reconstructive input. This introduces no new hospitality equality rule.
const reported = 1000000;
const occupied = 6000;
const available = 10000;
const adr = Number((reported / occupied).toFixed(2));
const reconstructed = adr * (occupied / available) * available;
assert.equal(reconstructed, 1000020);
console.log(JSON.stringify({ design: 'M09 precision accumulation', reported, occupied, available, adr, reconstructed, difference: reconstructed - reported }));

// CC-06 currently reads ordinal row zero; year selectors read stated identity.
// Retain the observation without silently changing a joint-contract obligation.
for (const [firstNoi, yearOneNoi] of [[300000, 100000], [100000, 200000]]) {
  const sections = { noi_model: { net_operating_income: 100000 }, dcf: { annual_cash_flows: [
    { year: 3, net_operating_income: firstNoi }, { year: 1, net_operating_income: yearOneNoi },
  ] } };
  const blocks = Object.entries(sections).map(([id, value]) => `\n\`\`\`json uw:section=${id} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`).join('');
  const parsed = parseUWFile(`---\nuw_version: "3.0"\nasset_class: multifamily\n---\n${blocks}`);
  const result = evaluateCalc({ id: 'year_one_noi', label: 'Year one NOI', formula: 'dcf.annual_cash_flows.Y1.net_operating_income', deterministic: true, unit: '$' }, { parsed, prior_results: {}, locale: 'en-US' });
  assert.deepEqual([result.ok, result.value], [true, yearOneNoi]);
  const issues = validateUWFile(parsed).issues;
  assert.equal(issues.some(i => i.code === 'CC-06'), firstNoi !== 100000);
  console.log(JSON.stringify({ design: 'CC-06 ordinal versus year identity', firstNoi, yearOneNoi, selectedYearOne: result.value, validation: issues }));
}
