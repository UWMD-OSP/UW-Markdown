// Cash-flow metric declarations (protocol §VIII.9.4, RFC 0034) — the
// declaration evaluator: section/variant resolution, override shadowing,
// quantization, and the two refusal codes.

import { describe, expect, it } from 'vitest';
import { evaluateCashFlowMetric, evaluateCashFlowMetrics } from './dated-flows.js';
import type { CashFlowMetricDecl } from './dated-flows.js';
import type { CalcEvaluationContext } from '../protocol.js';
import { parseUWFile } from '../parser.js';

const DOC = `---
uw_version: "1.1"
deal_id: TEST-CF-DECL
asset_class: multifamily
---

\`\`\`json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "actual/365f",
  "series": [
    { "date": "2026-03-17", "amount": -14250000, "kind": "acquisition" },
    { "date": "2026-09-30", "amount": 412000, "kind": "operating" },
    { "date": "2027-03-31", "amount": 431000, "kind": "operating" },
    { "date": "2027-06-15", "amount": -350000, "kind": "capex" },
    { "date": "2031-03-17", "amount": 19800000, "kind": "disposition" }
  ]
}
\`\`\`

\`\`\`json uw:section=cash_flow_series variant=downside source=manual ts=2026-09-02T00:00:00Z v=1
{
  "series": [
    { "date": "2026-03-17", "amount": -14250000 },
    { "date": "2031-03-17", "amount": 15000000 }
  ]
}
\`\`\`
`;

function ctx(overrides?: Record<string, number | string | boolean | null>): CalcEvaluationContext {
  return {
    parsed: parseUWFile(DOC),
    prior_results: {},
    ...(overrides ? { overrides } : {}),
    locale: 'en-US',
  };
}

const XIRR_DECL: CashFlowMetricDecl = {
  id: 'levered_xirr',
  series_path: 'cash_flow_series',
  metric: 'xirr',
};

describe('evaluateCashFlowMetric', () => {
  it('computes xirr on the base variant, quantized at the % default (6dp)', () => {
    const r = evaluateCashFlowMetric(XIRR_DECL, ctx());
    expect(r).toMatchObject({ ok: true, value: 0.075239, unit: '%', round_to: 6 });
  });
  it('computes total_net ($, 2dp), moic (x, 4dp), and xnpv at a declared rate', () => {
    const c = ctx();
    expect(evaluateCashFlowMetric({ id: 't', series_path: 'cash_flow_series', metric: 'total_net' }, c))
      .toMatchObject({ ok: true, value: 6_043_000, unit: '$', round_to: 2 });
    expect(evaluateCashFlowMetric({ id: 'm', series_path: 'cash_flow_series', metric: 'moic' }, c))
      .toMatchObject({ ok: true, value: 1.4139, unit: 'x', round_to: 4 });
    expect(evaluateCashFlowMetric({ id: 'n', series_path: 'cash_flow_series', metric: 'xnpv', rate: 0.06 }, c))
      .toMatchObject({ ok: true, value: 1_022_812.04, unit: '$', round_to: 2 });
  });
  it('reads a named variant', () => {
    const r = evaluateCashFlowMetric({ ...XIRR_DECL, variant: 'downside' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.value).toBeLessThan(0.075239);
  });
  it('an explicit variant does NOT fall back to default', () => {
    const r = evaluateCashFlowMetric({ ...XIRR_DECL, variant: 'upside' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('CALC-CF-SERIES');
  });
  it('overrides shadow a row without mutating the document', () => {
    const c = ctx({ 'cash_flow_series.series[4].amount': 18_800_000 });
    const r = evaluateCashFlowMetric(XIRR_DECL, c);
    expect(r.ok).toBe(true);
    expect(r.value).toBeLessThan(0.075239);
    // The parsed document still carries the original amount.
    const again = evaluateCashFlowMetric(XIRR_DECL, { ...c, overrides: undefined } as CalcEvaluationContext);
    expect(again.value).toBe(0.075239);
  });
  it('overrides outside the series path are ignored here', () => {
    const r = evaluateCashFlowMetric(XIRR_DECL, ctx({ 'noi_model.net_operating_income': 1 }));
    expect(r.value).toBe(0.075239);
  });
  it('refuses a missing section, an unknown metric, and xnpv without a rate', () => {
    const c = ctx();
    expect(evaluateCashFlowMetric({ ...XIRR_DECL, series_path: 'nope' }, c).error?.code).toBe('CALC-CF-SERIES');
    expect(
      evaluateCashFlowMetric({ id: 'x', series_path: 'cash_flow_series', metric: 'irr' as never }, c).error?.code,
    ).toBe('CALC-CF-SERIES');
    expect(
      evaluateCashFlowMetric({ id: 'x', series_path: 'cash_flow_series', metric: 'xnpv' }, c).error?.code,
    ).toBe('CALC-CF-SERIES');
  });
  it('an override that breaks the series structurally refuses with CALC-CF-SERIES', () => {
    const r = evaluateCashFlowMetric(XIRR_DECL, ctx({ 'cash_flow_series.series[0].date': '2026-02-30' }));
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('CALC-CF-SERIES');
  });
  it('a procedure refusal is carried in the result, typed', () => {
    // Shadow the sole outflow positive: no sign change → CALC-XIRR-DIVERGE.
    const r = evaluateCashFlowMetric(XIRR_DECL, ctx({
      'cash_flow_series.series[0].amount': 14_250_000,
      'cash_flow_series.series[3].amount': 350_000,
    }));
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('CALC-XIRR-DIVERGE');
  });
  it('moic with no outflows refuses rather than dividing by zero', () => {
    const r = evaluateCashFlowMetric({ id: 'm', series_path: 'cash_flow_series', metric: 'moic' }, ctx({
      'cash_flow_series.series[0].amount': 14_250_000,
      'cash_flow_series.series[3].amount': 350_000,
    }));
    expect(r.error?.code).toBe('CALC-CF-SERIES');
  });
  it('round_to on the declaration wins over the unit default, within bounds', () => {
    const r = evaluateCashFlowMetric({ ...XIRR_DECL, round_to: 4 }, ctx());
    expect(r).toMatchObject({ ok: true, value: 0.0752, round_to: 4 });
    expect(evaluateCashFlowMetric({ ...XIRR_DECL, round_to: 99 }, ctx()).error?.code).toBe('CALC-CF-SERIES');
  });
});

describe('evaluateCashFlowMetrics', () => {
  it('evaluates a batch in declaration order, one result each', () => {
    const rs = evaluateCashFlowMetrics(
      [XIRR_DECL, { id: 't', series_path: 'cash_flow_series', metric: 'total_net' }],
      ctx(),
    );
    expect(rs.map((r) => r.calc_id)).toEqual(['levered_xirr', 't']);
    expect(rs.every((r) => r.ok)).toBe(true);
  });
});
