import { describe, expect, it } from 'vitest';
import { parseUWFile } from '../parser.js';
import { evaluateCalc } from '../calc/index.js';
import { quantizeDecimal } from '../calc/quantize.js';
import { MULTIFAMILY_PACK } from './multifamily.js';

const cashOnCash = MULTIFAMILY_PACK.calculations!.find((c) => c.id === 'cash_on_cash')!;

// Synthetic GD05-style shape: total equity and annual leveraged cash flow,
// without an inferred sponsor/LP split. These are not private deal amounts.
function deal(equity: unknown = 3_000_000, allocation?: Record<string, unknown>, flows?: unknown[]) {
  const sections = {
    sources_uses: { equity_metrics: { equity_total: equity }, ...(allocation ? { sources: allocation } : {}) },
    dcf: { annual_cash_flows: flows ?? [
      { year: 2, net_cash_flow_levered: 900_000 },
      { year: 1, net_cash_flow_levered: 600_000 },
    ] },
    // Deliberately different from the projection: the stated year-1 flow wins.
    noi_model: { net_operating_income: 1_000_000 },
    debt_structure: { annual_debt_service: 700_000 },
  };
  const blocks = Object.entries(sections).map(([id, value]) =>
    `\n\`\`\`json uw:section=${id} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`,
  ).join('');
  return parseUWFile(`---\nuw_version: "2.0"\nasset_class: multifamily\n---\n${blocks}`);
}

const result = (parsed: ReturnType<typeof deal>) => evaluateCalc(cashOnCash, {
  parsed, prior_results: {}, locale: 'en-US',
});

describe('multifamily deal-level cash_on_cash', () => {
  it.each([undefined, { equity_sponsor: null, equity_lp: null },
    { equity_sponsor: 300_000, equity_lp: 2_700_000 },
    { equity_sponsor: 2_700_000, equity_lp: 300_000 },
  ])('uses total equity independently of sponsor/LP allocation: %j', (allocation) => {
    expect(result(deal(3_000_000, allocation))).toMatchObject({
      ok: true, value: quantizeDecimal(600_000 / 3_000_000, 6), unit: '%',
    });
  });

  it('computes with only aggregate equity and year-1 leveraged cash flow', () => {
    const parsed = deal();
    delete parsed.sections['noi_model'];
    delete parsed.sections['debt_structure'];
    expect(result(parsed)).toMatchObject({ ok: true, value: quantizeDecimal(600_000 / 3_000_000, 6) });
  });

  it.each([null, undefined])('does not substitute sponsor-only contributions for absent total equity: %s', (equity) => {
    // undefined is omitted by JSON serialization, rather than defaulting deal().
    const parsed = deal(null, { equity_sponsor: 3_000_000 });
    const content = parsed.sections['sources_uses'] as { content: Record<string, unknown> };
    content.content['equity_metrics'] = { equity_total: equity };
    expect(result(parsed)).toMatchObject({ ok: true, value: null });
  });

  it('reports the existing typed division-by-zero refusal', () => {
    expect(result(deal(0))).toMatchObject({ ok: false, error: { code: 'CALC-DIV-ZERO' } });
  });

  it.each([0, -600_000])('preserves zero and negative stated year-1 flows: %s', (flow) => {
    expect(result(deal(3_000_000, undefined, [{ year: 1, net_cash_flow_levered: flow }]))).toMatchObject({
      ok: true, value: quantizeDecimal(flow / 3_000_000, 6),
    });
  });

  it.each([[], [{ year: 2, net_cash_flow_levered: 900_000 }], [{ year: 1, net_cash_flow_levered: null }]].map((flows) => [flows] as const))(
    'falls back to NOI minus debt service when year-1 flow is not stated: %j', (flows) => {
      expect(result(deal(3_000_000, undefined, flows))).toMatchObject({
        ok: true, value: quantizeDecimal((1_000_000 - 700_000) / 3_000_000, 6),
      });
    },
  );

  it('leaves incomplete fallback inputs uncomputed', () => {
    const parsed = deal(3_000_000, undefined, []);
    delete parsed.sections['debt_structure'];
    expect(result(parsed)).toMatchObject({ ok: true, value: null });
  });

  it('does not publish sponsor/LP-specific metrics without a separate input contract', () => {
    const ids = MULTIFAMILY_PACK.calculations!.map((c) => c.id);
    expect(ids).not.toContain('sponsor_cash_on_cash');
    expect(ids).not.toContain('lp_cash_on_cash');
  });
});
