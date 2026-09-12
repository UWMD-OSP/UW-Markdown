import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { projectLeaseUpCashFlows, LeaseUpCashFlowProjectionError } from './lease-up-cash-flows.js';
import type { LeaseUpCashFlowPlan } from './protocol.js';
import { parseUWFile } from './parser.js';
import type { UWBlock } from './types.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';
import { periodPayload, resolvePeriodPath } from './period-path.js';
import { evaluateCashFlowMetric } from './calc/dated-flows.js';
import { projectLeaseUpCashFlows as browserProject } from './browser.js';

const fixture = readFileSync(
  new URL('../../../conformance/lease-up/valid-value-add-turnover/deal.uwx.md', import.meta.url),
  'utf8'
);
function document() {
  return parseUWFile(fixture);
}
function block(parsed = document()): UWBlock {
  return (parsed.sections['lease_up_schedule'] as Record<string, UWBlock>)['base']!;
}
function plan(): LeaseUpCashFlowPlan {
  return {
    source_variant: 'base',
    day_count: 'actual/365f',
    cash_dates: [
      { period: '2026-Q3', date: '2026-09-30' },
      { period: '2026-Q4', date: '2026-12-31' },
    ],
  };
}
function rows(parsed: ReturnType<typeof document>) {
  return (periodPayload(block(parsed)) as { schedule: Array<Record<string, unknown>> }).schedule;
}
async function refusal(parsed: ReturnType<typeof document>, input: unknown) {
  try {
    await projectLeaseUpCashFlows(parsed, input as LeaseUpCashFlowPlan);
  } catch (error) {
    expect(error).toBeInstanceOf(LeaseUpCashFlowProjectionError);
    return (error as LeaseUpCashFlowProjectionError).proto;
  }
  throw new Error('Expected projection refusal');
}

describe('RFC 0044 explicit projection', () => {
  it('binds the complete verified source with a semantic digest and no mutations', async () => {
    const parsed = document();
    const input = plan();
    const before = JSON.stringify(parsed);
    const beforePlan = JSON.stringify(input);
    const result = await projectLeaseUpCashFlows(parsed, input);
    expect(result.source_envelope_digest).toBe(await computeEnvelopeDigest(toUWEnvelope(parsed)));
    expect(result.source_variant).toBe('base');
    expect(result.bindings).toEqual([
      {
        source_path: 'lease_up_schedule.schedule@2026-Q3.net_cash_flow',
        date: '2026-09-30',
        amount: 118475,
      },
      {
        source_path: 'lease_up_schedule.schedule@2026-Q4.net_cash_flow',
        date: '2026-12-31',
        amount: 123425,
      },
    ]);
    expect(result.series).toMatchObject({
      label: 'Lease-up receipts and TI/LC only',
      day_count: 'actual/365f',
      series: [{ kind: 'other' }, { kind: 'other' }],
    });
    expect(result.series).not.toHaveProperty('stated_metrics');
    expect(JSON.stringify(parsed)).toBe(before);
    expect(JSON.stringify(input)).toBe(beforePlan);
    expect(browserProject).toBe(projectLeaseUpCashFlows);
    result.series.series[0]!.amount = -1;
    expect(result.bindings[0]!.amount).toBe(118475);
    expect(JSON.stringify(parsed)).toBe(before);
  });
  it('passes its candidate through the existing dated metric contract', async () => {
    const parsed = document();
    const result = await projectLeaseUpCashFlows(parsed, plan());
    parsed.sections['cash_flow_series'] = {
      projected: {
        ...block(parsed),
        annotation: { section: 'cash_flow_series', variant: 'projected' },
        content: { ...result.series },
      },
    };
    expect(
      evaluateCashFlowMetric(
        {
          id: 'pv',
          series_path: 'cash_flow_series',
          variant: 'projected',
          metric: 'xnpv',
          rate: 0.08,
          round_to: 2,
        },
        { parsed, prior_results: {}, locale: 'en-US' }
      )
    ).toMatchObject({ ok: true, value: 239528.83 });
  });
  it('selects an explicit wrapped component independently of unrelated bad variants', async () => {
    const parsed = document();
    const selected = block(parsed);
    parsed.sections['lease_up_schedule'] = {
      retail: {
        ...selected,
        annotation: { section: 'lease_up_schedule', variant: 'retail' },
        content: { _role: 'component', content: selected.content },
      },
      bad: { ...selected, content: {} },
    };
    const input = plan();
    input.source_variant = 'retail';
    expect((await projectLeaseUpCashFlows(parsed, input)).source_variant).toBe('retail');
  });
  it('accepts a matching singleton but never a default role fallback', async () => {
    const parsed = document();
    parsed.sections['lease_up_schedule'] = block(parsed);
    expect((await projectLeaseUpCashFlows(parsed, plan())).bindings).toHaveLength(2);
    const input = plan();
    input.source_variant = 'default';
    expect((await refusal(parsed, input)).evidence?.selection?.code).toBe('CALC-PERIOD-003');
  });
  it('preserves zero and fractional stated amounts without quantizing them', async () => {
    const parsed = document();
    const schedule = rows(parsed);
    Object.assign(schedule[0]!, {
      net_cash_flow: 0,
      rent_revenue: 0,
      concessions: 0,
      ti_lc_capex: 0,
    });
    Object.assign(schedule[1]!, {
      net_cash_flow: 1.234567890123,
      rent_revenue: 1.234567890123,
      concessions: 0,
      ti_lc_capex: 0,
    });
    expect(
      (await projectLeaseUpCashFlows(parsed, plan())).bindings.map((row) => row.amount)
    ).toEqual([0, 1.234567890123]);
  });
  it.each(['actual/365f', 'actual/360', '30/360us'] as const)(
    'accepts monthly leap dates with %s',
    async (day_count) => {
      const parsed = document();
      block(parsed).content['period_granularity'] = 'monthly';
      block(parsed).content['stabilization_target'] = '2028-03';
      rows(parsed)[0]!['period'] = '2028-02';
      rows(parsed)[1]!['period'] = '2028-03';
      const input: LeaseUpCashFlowPlan = {
        source_variant: 'base',
        day_count,
        cash_dates: [
          { period: '2028-03', date: '2028-03-31' },
          { period: '2028-02', date: '2028-02-29' },
        ],
      };
      expect(
        (await projectLeaseUpCashFlows(parsed, input)).series.series.map((row) => row.date)
      ).toEqual(['2028-02-29', '2028-03-31']);
    }
  );
  it('preserves same-day rows and existing duplicate date ambiguity', async () => {
    const parsed = document();
    const input = plan();
    input.cash_dates[1]!.date = input.cash_dates[0]!.date;
    const result = await projectLeaseUpCashFlows(parsed, input);
    expect(result.series.series).toHaveLength(2);
    parsed.sections['cash_flow_series'] = {
      base: {
        ...block(parsed),
        annotation: { section: 'cash_flow_series', variant: 'base' },
        content: { ...result.series },
      },
    };
    expect(() => resolvePeriodPath(parsed, 'cash_flow_series.series@2026-09-30.amount')).toThrow(
      'CALC-PERIOD-002'
    );
  });
  it('copies a coherent snapshot before asynchronous digest completion', async () => {
    const parsed = document();
    const input = plan();
    const envelope = toUWEnvelope(document());
    const pending = projectLeaseUpCashFlows(parsed, input);
    rows(parsed)[0]!['net_cash_flow'] = 99;
    input.source_variant = 'changed';
    input.cash_dates[0]!.date = '2000-01-01';
    const result = await pending;
    expect(result.source_envelope_digest).toBe(await computeEnvelopeDigest(envelope));
    expect(result.bindings[0]).toMatchObject({ amount: 118475, date: '2026-09-30' });
    expect(result.source_variant).toBe('base');
  });
  it.each([
    null,
    [],
    {},
    { ...plan(), source_variant: '' },
    { ...plan(), source_variant: 'missing' },
    { ...plan(), day_count: undefined },
    { ...plan(), day_count: 'actual/actual' },
    { ...plan(), cash_dates: [] },
    { ...plan(), cash_dates: null },
    { ...plan(), override: 1 },
  ])('refuses malformed or unresolved plans %#', async (input) => {
    expect((await refusal(document(), input)).code).toBe('CALC-LU-PROJECTION');
  });
  it.each([undefined, null, '0', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuses non-finite or absent source amounts %#',
    async (value) => {
      const parsed = document();
      rows(parsed)[0]!['net_cash_flow'] = value;
      expect((await refusal(parsed, plan())).pointer).toContain('schedule[0].net_cash_flow');
    }
  );
  it.each([
    '2027-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-9-30',
    '2026-09-30T00:00:00Z',
    '',
    null,
  ])('refuses invalid dates %#', async (date) => {
    const input = plan();
    input.cash_dates[0]!.date = date as string;
    expect((await refusal(document(), input)).pointer).toBe('plan.cash_dates[0].date');
  });
  it.each(['missing', 'extra', 'duplicate', 'decreasing', 'null', 'extra-field'])(
    'refuses %s mappings',
    async (defect) => {
      const input = plan();
      if (defect === 'missing') input.cash_dates.pop();
      if (defect === 'extra') input.cash_dates.push({ period: '2027-Q1', date: '2027-03-31' });
      if (defect === 'duplicate') input.cash_dates.push(input.cash_dates[0]!);
      if (defect === 'decreasing') input.cash_dates[1]!.date = '2000-01-01';
      if (defect === 'null') (input.cash_dates as unknown[])[0] = null;
      if (defect === 'extra-field') Object.assign(input.cash_dates[0]!, { amount: 1 });
      expect((await refusal(document(), input)).pointer).toContain('plan.cash_dates');
    }
  );
  it.each(['gap', 'duplicate', 'bad-period', 'null-row', 'empty', 'granularity', 'target'])(
    'preserves structural evidence for %s',
    async (defect) => {
      const parsed = document();
      const content = block(parsed).content;
      if (defect === 'gap') rows(parsed)[1]!['period'] = '2027-Q1';
      if (defect === 'duplicate') rows(parsed)[1]!['period'] = '2026-Q3';
      if (defect === 'bad-period') rows(parsed)[0]!['period'] = 'garbage';
      if (defect === 'null-row') (rows(parsed) as unknown[])[0] = null;
      if (defect === 'empty') content['schedule'] = [];
      if (defect === 'granularity') content['period_granularity'] = 'yearly';
      if (defect === 'target') content['stabilization_target'] = '2020-Q1';
      expect((await refusal(parsed, plan())).evidence?.structure?.[0]?.code).toMatch(/^LU-0[123]$/);
    }
  );
  it.each(['failed', 'unverifiable'] as const)(
    'preserves %s verifier evidence',
    async (verdict) => {
      const parsed = document();
      rows(parsed)[0]!['rent_revenue'] = verdict === 'failed' ? 1 : null;
      const error = await refusal(parsed, plan());
      expect(error.evidence?.verification?.verdict).toBe(verdict);
      expect(error.evidence?.verification?.issues[0]?.code).toBe(
        verdict === 'failed' ? 'LU-NCF-DISAGREES' : 'LU-UNEVALUABLE'
      );
    }
  );
  it('refuses a summary with an unresolved denominator', async () => {
    const parsed = document();
    delete parsed.sections['property'];
    parsed.frontmatter = {} as typeof parsed.frontmatter;
    block(parsed).content['stabilized_summary'] = { occupancy_rate: 0.9 };
    expect((await refusal(parsed, plan())).evidence?.verification?.verdict).toBe('unverifiable');
  });
  it('validates actual results and refusals against their normative schemas', async () => {
    const ajv = new Ajv2020({ strict: false });
    addFormats.default(ajv);
    const schema = (name: string) =>
      JSON.parse(
        readFileSync(new URL(`../../../spec/schemas/${name}.schema.json`, import.meta.url), 'utf8')
      );
    ajv.addSchema(schema('protocol-error'));
    const validPlan = ajv.compile(schema('lease-up-cash-flow-plan'));
    const validResult = ajv.compile(schema('lease-up-cash-flow-projection'));
    const validError = ajv.compile(schema('lease-up-cash-flow-projection-issue'));
    expect(validPlan(plan())).toBe(true);
    expect(validPlan({ ...plan(), day_count: null })).toBe(false);
    expect(validResult(await projectLeaseUpCashFlows(document(), plan()))).toBe(true);
    for (const defect of ['plan', 'selection', 'structure', 'verification']) {
      const parsed = document();
      const input = plan();
      if (defect === 'plan') input.cash_dates = [];
      if (defect === 'selection') input.source_variant = 'absent';
      if (defect === 'structure') block(parsed).content['schedule'] = [];
      if (defect === 'verification') rows(parsed)[0]!['rent_revenue'] = null;
      expect(validError(await refusal(parsed, input)), JSON.stringify(validError.errors)).toBe(
        true
      );
    }
  });
});
