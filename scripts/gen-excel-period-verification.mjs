// Generate synthetic native-Excel verification files after npm run build.
// Usage: node scripts/gen-excel-period-verification.mjs <output-directory>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUWFile, evaluateCalc } from '../packages/uwmd-core/dist/index.js';
import { toWorkbook } from '../packages/uwmd-excel/dist/index.js';
if (!process.argv[2]) throw new TypeError('Supply an output directory for disposable verification files.');
const directory = resolve(process.argv[2]);
await mkdir(directory, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(join(root, 'conformance/tier-3-calc-host/fixtures/period-01-year-order/deal.uwx.md'), 'utf8');
const formulas = [
  'dcf.annual_cash_flows@Y3.noi * 0.0551',
  'dcf.annual_cash_flows@Y1.noi',
  'noi_model.projections@Y3.projected_noi',
  'lease_up_schedule.schedule@2028-Q1.noi',
  'cash_flow_series.series@2028-02-29.amount',
  'distribution_waterfall.stated_schedule@2028-02-29.lp_distribution',
  'dcf.annual_cash_flows@Y3.noi / property.total_units',
  "dcf.annual_cash_flows@Y3['tax.rate'] + dcf.annual_cash_flows@Y3.tax.rate",
  'dcf.annual_cash_flows@Y99.noi + 1',
  '-dcf.annual_cash_flows@Y3.half',
  'dcf.annual_cash_flows@Y3.capital * dcf.annual_cash_flows@Y3.spread',
];
const parsed = parseUWFile(source);
const rows = parsed.sections.dcf.content.annual_cash_flows;
Object.assign(rows[0], { 'tax.rate': 0.03, tax: { rate: 0.04 }, half: 1.005, capital: 100_000_000, spread: 0.0551 });
const decls = formulas.map((formula, i) => ({ id: `native_${i}`, label: `Native case ${i}`, formula, round_to: i === 9 ? 2 : 6, deterministic: true }));
parsed.custom_calculations = decls.map(decl => ({ ...parsed.sections.dcf, annotation: { section: 'custom_calculations' }, content: decl }));
const workbook = await toWorkbook(parsed, { calculations: decls.map(decl => decl.id) });
await workbook.xlsx.writeFile(join(directory, 'period-native.xlsx'));
const baseline = decls.map((decl, i) => {
  const result = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' });
  if (!result.ok) throw new TypeError(`Invalid verification calculation ${decl.id}`);
  return { sheet: 'Custom Calculations', cell: `C${i + 6}`, ...(result.value === null ? { error: '#N/A' } : { value: result.value }) };
});
const target = (index, value) => ({ sheet: 'Custom Calculations', cell: `C${index + 6}`, value });
const error = (index, code) => ({ sheet: 'Custom Calculations', cell: `C${index + 6}`, error: code });
const cases = [
  { name: 'baseline-all-series-and-rounding', file: 'period-native.xlsx', expect: baseline },
  { name: 'native-sort-by-identity', file: 'period-native.xlsx', sort: { sheet: 'Periods DCF', range: 'A6:G7' }, expect: baseline },
  { name: 'edited-selected-value', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'B6', value: 600 }], expect: [target(0, 33.06), target(6, 6)] },
  { name: 'zero-remains-zero', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'B6', value: 0 }], expect: [target(0, 0), target(6, 0)] },
  { name: 'blank-never-becomes-zero', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'B6', value: null }], expect: [error(0, '#N/A'), error(6, '#N/A')] },
  { name: 'nonnumeric-value-refuses', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'B6', value: 'unknown' }], expect: [error(0, '#VALUE!')] },
  { name: 'duplicate-anywhere-refuses', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'A7', value: 'year:3' }], expect: [error(0, '#VALUE!'), error(1, '#VALUE!')] },
  { name: 'changed-period-set-refuses', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'A7', value: 'year:2' }], expect: [error(0, '#VALUE!')] },
  { name: 'case-changed-identity-refuses', file: 'period-native.xlsx', edits: [{ sheet: 'Periods DCF', cell: 'A7', value: 'YEAR:1' }], expect: [error(0, '#VALUE!')] },
  { name: 'blank-ordinary-input-propagates', file: 'period-native.xlsx', edits: [{ sheet: 'Calculation Inputs', cell: 'B6', value: null }], expect: [error(6, '#N/A')] },
];
for (const [label, override] of [['zero', 0], ['null', null]]) {
  const wb = await toWorkbook(parsed, { calculations: ['native_0'], calculationContext: { overrides: { 'dcf.annual_cash_flows@Y3.noi': override } } });
  const file = `override-${label}.xlsx`;
  await wb.xlsx.writeFile(join(directory, file));
  cases.push({ name: `explicit-${label}-override`, file, expect: [override === null ? error(0, '#N/A') : target(0, 0)] });
}
const monthly = parseUWFile(source);
monthly.sections.lease_up_schedule.base.content = { period_granularity: 'monthly', schedule: [{ period: '2028-02', noi: 200 }, { period: '2028-01', noi: 100 }] };
monthly.custom_calculations = [{ ...parsed.custom_calculations[0], content: { ...decls[0], formula: 'lease_up_schedule.schedule@2028-01.noi' } }];
await (await toWorkbook(monthly, { calculations: ['native_0'] })).xlsx.writeFile(join(directory, 'monthly.xlsx'));
cases.push({ name: 'absolute-month-lookup', file: 'monthly.xlsx', expect: [target(0, 100)] });
await writeFile(join(directory, 'manifest.json'), JSON.stringify({ cases, preview_file: 'period-native.xlsx', preview_sheets: ['Custom Calculations', 'Calculation Inputs', 'Periods DCF', 'Periods NOI', 'Periods Lease Up', 'Periods Cash Flow', 'Periods Waterfall'] }, null, 2));
console.log(`Generated ${cases.length} native verification cases in ${directory}`);
