import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { assemblePropertyCashFlows, PropertyCashFlowAssemblyError } from './property-cash-flows.js';
import { assemblePropertyCashFlows as browserAssemble } from './browser.js';
import type { PropertyCashFlowPlan, PropertyCashFlowAssemblyIssue } from './protocol.js';
import { parseUWFile } from './parser.js';
import { periodPayload, periodSection, resolvePeriodPath } from './period-path.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';
import { evaluateCashFlowMetric } from './calc/dated-flows.js';
import { datedFlowsOf, xnpvOf, xirrOf, type CashFlowSeries } from './cash-flow-series.js';
import { quantizeDecimal } from './calc/quantize.js';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const source = read('docs/examples/property-cash-flow-synthetic.uwx.md');
const fresh = () => parseUWFile(source);
const plan = () => JSON.parse(read('docs/examples/property-cash-flow-plan.json')) as PropertyCashFlowPlan;
const payload = (d: ReturnType<typeof fresh>, section = 'cash_flow_series') =>
  periodPayload(periodSection(d, section, { sectionVariants: { [section]: 'base' } })!) as Record<string, any>;
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
ajv.addSchema(JSON.parse(read('spec/schemas/protocol-error.schema.json')));
const schema = (suffix: string) => ajv.compile(JSON.parse(read(`spec/schemas/property-cash-flow-${suffix}.schema.json`)));
const planSchema = schema('plan');
const outputSchema = schema('assembly');
const issueSchema = schema('assembly-issue');
async function refusal(d: ReturnType<typeof fresh>, p: unknown): Promise<PropertyCashFlowAssemblyIssue> {
  try { await assemblePropertyCashFlows(d, p as PropertyCashFlowPlan); }
  catch (e) {
    expect(e).toBeInstanceOf(PropertyCashFlowAssemblyError);
    const issue = (e as PropertyCashFlowAssemblyError).proto;
    expect(issueSchema(issue), JSON.stringify(issueSchema.errors)).toBe(true);
    return issue;
  }
  throw new Error('Expected a typed refusal');
}

describe('RFC 0045 property cash-flow assembly', () => {
  it('copies the ledger with a real anchor, explicit zeros and coverage ownership', async () => {
    const d = fresh();
    const p = plan();
    const before = JSON.stringify([d, p]);
    const result = await assemblePropertyCashFlows(d, p);
    expect(planSchema(p), JSON.stringify(planSchema.errors)).toBe(true);
    expect(outputSchema(result), JSON.stringify(outputSchema.errors)).toBe(true);
    expect(result.series.series.map(r => r.amount)).toEqual([
      -1000000, -10000, -20000, 109000, 0, -40000, 125000, -45000, -10000, 1150000, -20000, 5000,
    ]);
    expect(result.series.series[0]!.date).toBe('2026-07-01');
    expect(result.cells).toHaveLength(20);
    expect(result.cells.filter(c => 'zero' in c)).toHaveLength(4);
    expect(result.bindings.filter(b => b.source_section === 'lease_up_schedule').map(b => b.cells.length)).toEqual([3, 3]);
    expect(result.source_envelope_digest).toBe(await computeEnvelopeDigest(toUWEnvelope(d)));
    expect(result.source_verification).toEqual({ lease_up: 'verified', supplemental_metrics: 'not_stated' });
    expect(result.coverage).toBe('declared_complete');
    expect(JSON.stringify([d, p])).toBe(before);
    expect(browserAssemble).toBe(assemblePropertyCashFlows);
    expect(result.series).not.toHaveProperty('stated_metrics');
  });
  it('preserves a coherent source and plan snapshot across asynchronous hashing', async () => {
    const d = fresh();
    const p = plan();
    const expected = await assemblePropertyCashFlows(d, p);
    const pending = assemblePropertyCashFlows(d, p);
    payload(d).series[0].amount = -1;
    payload(d, 'lease_up_schedule').schedule[0].net_cash_flow = 999;
    p.coverage[0]!.slot = 'changed';
    expect(await pending).toEqual(expected);
    expected.plan.lease_up.cash_dates[0]!.date = 'changed';
    expected.cells[3]!.slot = 'changed';
    expect(expected.bindings[3]!.cells[0]!.slot).toBe('2026-Q3');
  });
  it('ignores coverage/map ordering while retaining same-date source identities', async () => {
    const p = plan();
    const baseline = await assemblePropertyCashFlows(fresh(), p);
    p.coverage.reverse(); p.lease_up.cash_dates.reverse();
    const result = await assemblePropertyCashFlows(fresh(), p);
    expect(result.bindings).toEqual(baseline.bindings);
    expect(result.cells).toEqual(baseline.cells);
    expect(result.plan).toEqual(p);
    const d = fresh();
    const b = periodSection(d, 'cash_flow_series', { sectionVariants: { cash_flow_series: 'base' } })!;
    b.content = result.series as unknown as Record<string, unknown>;
    expect(() => resolvePeriodPath(d, 'cash_flow_series.series@2026-12-31.amount', { sectionVariants: { cash_flow_series: 'base' } })).toThrow();
  });
  it('uses existing dated metric evaluation and its quantization', async () => {
    const d = fresh();
    const result = await assemblePropertyCashFlows(d, plan());
    periodSection(d, 'cash_flow_series', { sectionVariants: { cash_flow_series: 'base' } })!.content = { ...result.series };
    const flows = datedFlowsOf(result.series)!;
    const npv = evaluateCashFlowMetric({ id: 'pv', series_path: 'cash_flow_series', variant: 'base', metric: 'xnpv', rate: 0.08, round_to: 2 }, { parsed: d, prior_results: {}, locale: 'en-US' });
    expect(npv).toMatchObject({ ok: true, value: quantizeDecimal(xnpvOf(flows, 0.08), 2) });
    const irr = evaluateCashFlowMetric({ id: 'irr', series_path: 'cash_flow_series', variant: 'base', metric: 'xirr', round_to: 6 }, { parsed: d, prior_results: {}, locale: 'en-US' });
    expect(irr).toMatchObject({ ok: true, value: quantizeDecimal(xirrOf(flows), 6) });
  });
  it('keeps multiple cash rows for one cell in source order, independent of row-list order', async () => {
    const d = fresh();
    const p = plan();
    payload(d).series.push({ date: '2026-12-31', amount: -7.125 });
    p.coverage.find(c => c.slot === '2026-Q4' && c.category === 'operating_expenses')!.rows = [10, 5];
    const result = await assemblePropertyCashFlows(d, p);
    expect(result.series.series.at(-1)!.amount).toBe(-7.125);
    expect(result.cells.find(c => c.slot === '2026-Q4' && c.category === 'operating_expenses')).toMatchObject({ output_rows: [7, 12] });
  });
  it('returns typed errors for sparse coverage arrays and noncanonical envelope values', async () => {
    const p = plan();
    delete p.coverage[0];
    expect((await refusal(fresh(), p)).reason).toBe('plan');
    const d = fresh();
    (d.frontmatter as Record<string, unknown>).synthetic_invalid = Number.POSITIVE_INFINITY;
    expect((await refusal(d, plan())).reason).toBe('structure');
  });
  it('retains existing xirr refusal when the declared stream has no positive cash', async () => {
    const d = fresh();
    for (const row of payload(d, 'lease_up_schedule').schedule) {
      row.rent_revenue = 0; row.concessions = 0; row.ti_lc_capex = 0; row.net_cash_flow = 0;
    }
    payload(d).series[7].amount = 0;
    payload(d).series[9].amount = 0;
    const result = await assemblePropertyCashFlows(d, plan());
    periodSection(d, 'cash_flow_series', { sectionVariants: { cash_flow_series: 'base' } })!.content = { ...result.series };
    expect(evaluateCashFlowMetric({ id: 'irr', series_path: 'cash_flow_series', variant: 'base', metric: 'xirr' },
      { parsed: d, prior_results: {}, locale: 'en-US' })).toMatchObject({ ok: false });
  });
  it('copies fractional source amounts without early quantization', async () => {
    const d = fresh(); payload(d).series[4].amount = -40000.123456;
    const result = await assemblePropertyCashFlows(d, plan());
    expect(result.series.series[5]!.amount).toBe(-40000.123456);
  });
  it('checks stated supplemental metrics separately from declared completeness', async () => {
    const d = fresh(); const s = payload(d) as CashFlowSeries;
    s.stated_metrics = { xnpv: { rate: 0.08, value: quantizeDecimal(xnpvOf(datedFlowsOf(s)!, 0.08), 2) } };
    expect((await assemblePropertyCashFlows(d, plan())).source_verification.supplemental_metrics).toBe('verified');
    s.stated_metrics.xnpv!.value += 1;
    expect((await refusal(d, plan())).evidence?.verification?.verdict).toBe('failed');
  });
  it.each([null, {}, { total_net: null, xirr: null }])('does not claim verification of absent metrics %j', async metrics => {
    const d = fresh(); payload(d).stated_metrics = metrics;
    expect((await assemblePropertyCashFlows(d, plan())).source_verification.supplemental_metrics).toBe('not_stated');
  });
  it.each([
    ['extra plan key', (p: any) => { p.extra = 1; }, 'plan'],
    ['missing assertions', (p: any) => { delete p.assertions; }, 'plan'],
    ['false reserve assertion', (p: any) => { p.assertions.reserve_spending_excluded = false; }, 'coverage'],
    ['currency mismatch', (p: any) => { p.supplemental.currency_code = 'CAD'; }, 'basis_currency'],
    ['lowercase currency', (p: any) => { p.currency_code = 'usd'; }, 'basis_currency'],
    ['levered basis', (p: any) => { p.basis = 'levered'; }, 'basis_currency'],
    ['after tax', (p: any) => { p.tax_basis = 'after_tax'; }, 'basis_currency'],
    ['bad day count', (p: any) => { p.day_count = 'actual/365'; }, 'basis_currency'],
    ['wrong variant', (p: any) => { p.supplemental.source_variant = 'missing'; }, 'selection'],
    ['missing cell', (p: any) => { p.coverage.pop(); }, 'coverage'],
    ['duplicate cell', (p: any) => { p.coverage.push(p.coverage[0]); }, 'coverage'],
    ['duplicate row', (p: any) => { p.coverage[1].rows = [0]; }, 'coverage'],
    ['out of bounds row', (p: any) => { p.coverage[1].rows = [100]; }, 'coverage'],
    ['fractional index', (p: any) => { p.coverage[1].rows = [1.5]; }, 'plan'],
    ['unsafe index', (p: any) => { p.coverage[1].rows = [1e20]; }, 'plan'],
    ['rows plus zero', (p: any) => { p.coverage[0].zero = 'no'; }, 'plan'],
    ['blank zero', (p: any) => { p.coverage[5].zero = '  '; }, 'plan'],
    ['lease-up overlap', (p: any) => { p.coverage[3].category = 'rent'; }, 'coverage'],
    ['invalid acquisition date', (p: any) => { p.acquisition_date = '2026-02-30'; }, 'date_horizon'],
    ['early acquisition period', (p: any) => { p.acquisition_date = '2026-06-30'; }, 'date_horizon'],
    ['late exit period', (p: any) => { p.disposition_date = '2027-01-01'; }, 'date_horizon'],
    ['missing cash mapping', (p: any) => { p.lease_up.cash_dates.pop(); }, 'verification'],
  ])('refuses %s', async (_name, mutate, reason) => {
    const p = plan(); (mutate as (p: PropertyCashFlowPlan) => void)(p);
    expect((await refusal(fresh(), p)).reason).toBe(reason);
  });
  it.each([
    ['null amount', (s: any) => { s.series[4].amount = null; }, 'structure'],
    ['NaN amount', (s: any) => { s.series[4].amount = Number.NaN; }, 'structure'],
    ['infinite amount', (s: any) => { s.series[4].amount = Number.POSITIVE_INFINITY; }, 'structure'],
    ['positive expense', (s: any) => { s.series[4].amount = 1; }, 'amount_sign'],
    ['zero purchase', (s: any) => { s.series[0].amount = 0; }, 'amount_sign'],
    ['negative sale', (s: any) => { s.series[7].amount = -1; }, 'amount_sign'],
    ['day-count mismatch', (s: any) => { s.day_count = 'actual/360'; }, 'basis_currency'],
    ['omitted day count', (s: any) => { delete s.day_count; }, 'structure'],
    ['nonnumeric metric', (s: any) => { s.stated_metrics = { total_net: 'unknown' }; }, 'structure'],
    ['incomplete xnpv', (s: any) => { s.stated_metrics = { xnpv: { value: 2 } }; }, 'structure'],
    ['bad kind', (s: any) => { s.series[0].kind = 'NOI'; }, 'structure'],
    ['reversed dates', (s: any) => { s.series[2].date = '2026-06-30'; }, 'structure'],
    ['out of hold', (s: any) => { s.series[9].date = '2027-01-01'; }, 'date_horizon'],
  ])('refuses supplemental %s', async (_name, mutate, reason) => {
    const d = fresh(); (mutate as (s: any) => void)(payload(d));
    expect((await refusal(d, plan())).reason).toBe(reason);
  });
  it('preserves failed versus unverifiable lease-up evidence', async () => {
    const d = fresh();
    payload(d, 'lease_up_schedule').schedule[0].net_cash_flow = 1;
    expect((await refusal(d, plan())).evidence?.lease_up?.evidence?.verification?.verdict).toBe('failed');
    const missing = fresh();
    payload(missing, 'lease_up_schedule').schedule[0].rent_revenue = null;
    expect((await refusal(missing, plan())).evidence?.lease_up?.evidence?.verification?.verdict).toBe('unverifiable');
  });
  it('rejects reversed actual dates even when 30/360 assigns equal exponents', async () => {
    const d = fresh();
    const p = plan();
    p.day_count = '30/360us'; payload(d).day_count = '30/360us';
    payload(d).series[3].date = '2026-08-31'; payload(d).series[4].date = '2026-08-30';
    expect((await refusal(d, p)).reason).toBe('structure');
  });
  it('supports exact component variants without default-role fallback', async () => {
    const d = fresh();
    periodSection(d, 'lease_up_schedule', { sectionVariants: { lease_up_schedule: 'base' } })!.content._role = 'component';
    expect((await assemblePropertyCashFlows(d, plan())).coverage).toBe('declared_complete');
  });
  it('supports monthly periods and leap-day cash', async () => {
    const d = fresh();
    const p = plan();
    const lease = payload(d, 'lease_up_schedule'); lease.period_granularity = 'monthly';
    lease.schedule[0].period = '2028-02'; lease.schedule[1].period = '2028-03';
    p.acquisition_date = '2028-02-01'; p.disposition_date = '2028-03-31';
    p.lease_up.cash_dates = [{ period: '2028-02', date: '2028-02-29' }, { period: '2028-03', date: '2028-03-31' }];
    for (const c of p.coverage) { if (c.slot === '2026-Q3') c.slot = '2028-02'; if (c.slot === '2026-Q4') c.slot = '2028-03'; }
    for (const row of payload(d).series) row.date = row.date === '2026-07-01' ? p.acquisition_date : row.date === '2026-09-30' ? '2028-02-29' : p.disposition_date;
    expect((await assemblePropertyCashFlows(d, p)).series.series[3]!.date).toBe('2028-02-29');
  });
});
