import { describe, it, expect } from 'vitest';
import { deriveDCF } from './dcf.js';

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

describe('deriveDCF — out of scope / empty', () => {
  it('foots nothing for an empty block', () => {
    expect(deriveDCF({}).fields).toHaveLength(0);
  });

  it('skips rows missing NOI or debt service', () => {
    const d = deriveDCF({ annual_cash_flows: [{ year: 1, net_operating_income: 100 }] });
    expect(d.fields).toHaveLength(0);
  });
});
