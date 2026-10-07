import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { deriveDCF } from './dcf.js';
import { parseUWFile } from './parser.js';

function field(d: ReturnType<typeof deriveDCF>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

// Numbers are lifted from the Parkview multifamily worked example's dcf block so
// the footing is verified against a real, hand-checked deal.
const PARKVIEW_DCF = {
  hold_period_years: 5,
  assumptions: { disposition_costs_pct: 0.02, exit_cap_rate: 0.06 },
  annual_cash_flows: [
    { year: 1, net_operating_income: 396_635, annual_debt_service: 296_100, cumulative_equity_invested: 2_400_000 },
    { year: 2, net_operating_income: 409_705, annual_debt_service: 357_612, cumulative_equity_invested: 2_400_000 },
    { year: 5, net_operating_income: 451_499, annual_debt_service: 357_612, cumulative_equity_invested: 2_400_000 },
  ],
  exit_analysis: {
    exit_noi: 451_499,
    exit_value_gross: 7_750_733,
    loan_balance_at_exit: 4_800_000,
  },
};

describe('deriveDCF — per-year cash flow', () => {
  it('foots levered cash flow as NOI − debt service', () => {
    const d = deriveDCF(PARKVIEW_DCF);
    expect(field(d, 'annual_cash_flows.0.net_cash_flow_levered')).toBe(100_535);
    expect(field(d, 'annual_cash_flows.1.net_cash_flow_levered')).toBe(52_093);
    expect(field(d, 'annual_cash_flows.2.net_cash_flow_levered')).toBe(93_887);
  });

  it('foots cash-on-cash as levered CF / cumulative equity (4dp)', () => {
    const d = deriveDCF(PARKVIEW_DCF);
    expect(field(d, 'annual_cash_flows.0.cash_on_cash_return')).toBe(0.0419);
    expect(field(d, 'annual_cash_flows.1.cash_on_cash_return')).toBe(0.0217);
    expect(field(d, 'annual_cash_flows.2.cash_on_cash_return')).toBe(0.0391);
  });

  it('omits cash-on-cash when equity is missing or zero', () => {
    const d = deriveDCF({
      annual_cash_flows: [{ year: 1, net_operating_income: 100, annual_debt_service: 40 }],
    });
    expect(field(d, 'annual_cash_flows.0.net_cash_flow_levered')).toBe(60);
    expect(field(d, 'annual_cash_flows.0.cash_on_cash_return')).toBeUndefined();
  });
});

describe('deriveDCF — exit waterfall', () => {
  it('foots disposition costs, net value, and proceeds to equity', () => {
    const d = deriveDCF(PARKVIEW_DCF);
    expect(field(d, 'exit_analysis.disposition_costs')).toBe(155_015);
    expect(field(d, 'exit_analysis.exit_value_net')).toBe(7_595_718);
    expect(field(d, 'exit_analysis.net_proceeds_to_equity')).toBe(2_795_718);
  });

  it('does NOT foot exit_value_gross (forward-NOI convention is not stored)', () => {
    const d = deriveDCF(PARKVIEW_DCF);
    expect(field(d, 'exit_analysis.exit_value_gross')).toBeUndefined();
  });

  it('falls back to the stored disposition_costs when the % is absent', () => {
    const d = deriveDCF({
      exit_analysis: { exit_value_gross: 1_000_000, disposition_costs: 25_000, loan_balance_at_exit: 600_000 },
    });
    // No assumptions.disposition_costs_pct → disposition_costs stays an input,
    // but net + proceeds still foot off it.
    expect(field(d, 'exit_analysis.disposition_costs')).toBeUndefined();
    expect(field(d, 'exit_analysis.exit_value_net')).toBe(975_000);
    expect(field(d, 'exit_analysis.net_proceeds_to_equity')).toBe(375_000);
  });
});

describe('deriveDCF — proceeds to common equity (RFC 0077)', () => {
  // Issue #278's synthetic exit: 10,000,000 gross, 2% costs, 6,000,000 of debt,
  // and a preferred tranche retired at sale for 1,500,000.
  const exit = (over: Record<string, unknown>) => ({
    assumptions: { disposition_costs_pct: 0.02 },
    exit_analysis: { exit_value_gross: 10_000_000, loan_balance_at_exit: 6_000_000, ...over },
  });

  it('keeps proceeds to equity as the whole stack and foots common after the pref', () => {
    const d = deriveDCF(exit({ preferred_equity_redemption_at_exit: 1_500_000 }));
    expect(field(d, 'exit_analysis.net_proceeds_to_equity')).toBe(3_800_000);
    expect(field(d, 'exit_analysis.net_proceeds_to_common_equity')).toBe(2_300_000);
  });

  it('does not foot common without a stated redemption, and never derives one', () => {
    const d = deriveDCF(exit({ net_proceeds_to_common_equity: 2_300_000 }));
    expect(field(d, 'exit_analysis.net_proceeds_to_common_equity')).toBeUndefined();
    expect(field(d, 'exit_analysis.preferred_equity_redemption_at_exit')).toBeUndefined();
  });

  it('foots common equal to the whole stack under a zero redemption', () => {
    const d = deriveDCF(exit({ preferred_equity_redemption_at_exit: 0 }));
    expect(field(d, 'exit_analysis.net_proceeds_to_common_equity')).toBe(3_800_000);
  });

  it('foots common from a stated proceeds-to-equity when the loan balance is absent', () => {
    const d = deriveDCF({
      exit_analysis: { net_proceeds_to_equity: 3_800_000, preferred_equity_redemption_at_exit: 1_500_000 },
    });
    expect(field(d, 'exit_analysis.net_proceeds_to_equity')).toBeUndefined();
    expect(field(d, 'exit_analysis.net_proceeds_to_common_equity')).toBe(2_300_000);
  });

  it('foots exactly what the tier-1 fixture 17 states', () => {
    const parsed = parseUWFile(readFileSync(resolve(process.cwd(),
      '../../conformance/tier-1-reader/fixtures/17-exit-proceeds-junior-capital.uwx.md'), 'utf8'));
    const content = (parsed.sections['dcf'] as { content: Record<string, unknown> }).content;
    const stated = content['exit_analysis'] as Record<string, unknown>;
    const d = deriveDCF(content);
    expect(d.fields.map((f) => f.path)).toContain('exit_analysis.net_proceeds_to_common_equity');
    for (const f of d.fields) expect([f.path, f.value]).toEqual([f.path, stated[f.path.replace('exit_analysis.', '')]]);
  });

  it('re-foots a stated common figure that disagrees with its inputs', () => {
    const d = deriveDCF(exit({
      preferred_equity_redemption_at_exit: 1_500_000,
      net_proceeds_to_common_equity: 9_999,
    }));
    expect(field(d, 'exit_analysis.net_proceeds_to_common_equity')).toBe(2_300_000);
  });
});

describe('deriveDCF — out of scope / empty', () => {
  it('foots nothing for an empty block', () => {
    expect(deriveDCF({}).fields).toHaveLength(0);
  });

  it('skips rows missing NOI or debt service', () => {
    const d = deriveDCF({ annual_cash_flows: [{ year: 1, net_operating_income: 100 }] });
    expect(d.fields).toHaveLength(0);
  });
});
