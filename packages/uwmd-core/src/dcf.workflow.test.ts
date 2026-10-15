// Phase 2 synthetic acquisition: connect existing footing, dictionary metrics,
// stated verification and authored hold-period cash flows without forecasting.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  evaluateCalc, parseUWFile, quantizeDecimal,
  verifyStatedMetrics, verifyCashFlowSeries, datedFlowsOf, xnpvOf, xirrOf,
  type CashFlowSeries, type MetricDictionary, type ParsedUWFile, type UWBlock,
} from '@uwmd/verify';
import { deriveRentRoll } from './rentroll.js';
import { deriveOperatingStatement } from './opstatement.js';
import { deriveDebt } from './debt.js';
import { deriveSourcesUses } from './sourcesuses.js';
import { deriveDCF } from './dcf.js';
import type { DerivedField } from './derived.js';

const fields = (list: DerivedField[]) => Object.fromEntries(list.map(f => [f.path, f.value]));
const document = (sections: Record<string, unknown>) => parseUWFile(`---\nuw_version: "3.0"\nasset_class: multifamily\n---\n${Object.entries(sections).map(([id, content]) => `\n\`\`\`json uw:section=${id} source=manual\n${JSON.stringify(content)}\n\`\`\`\n`).join('')}`);
const dictionary = JSON.parse(readFileSync(new URL('../../../spec/metrics/builtin.json', import.meta.url), 'utf8')) as MetricDictionary;
const metric = (id: string) => dictionary.calculations.find(m => m.id === id && m.asset_classes.includes('multifamily'))!;
const run = (id: string, sections: Record<string, unknown>) => evaluateCalc(metric(id), { parsed: document(sections), prior_results: {}, locale: 'en-US' });
function stated(id: string, parsed: ParsedUWFile, value: number, decimals: number) {
  parsed.frontmatter.quick_metrics = { [id]: value };
  return verifyStatedMetrics(parsed, { statedDecimals: new Map([[`quick_metrics.${id}`, decimals]]) })
    .evidence.find(e => e.path === `quick_metrics.${id}`)!;
}

// Independent payment oracle: discounted unit annuity sum, rather than the
// production closed-form PMT. The existing starter helper reports whole dollars.
function monthlyPayment(principal: number, annualRate: number, months: number): number {
  let annuity = 0;
  for (let k = 1; k <= months; k++) annuity += (1 + annualRate / 12) ** -k;
  return Math.round(principal / annuity);
}

function acquisition(interestOnly: boolean, expenseShock = 0) {
  const units = Array.from({ length: 10 }, (_, i) => ({
    status: i === 9 ? 'vacant' : 'occupied', market_rent: 1200,
    monthly_rent: i === 9 ? null : 1100, concession_monthly_equiv: i === 9 ? 0 : 10,
  }));
  const roll = fields(deriveRentRoll({ units }).fields);
  const gpr = units.reduce((sum, u) => sum + u.market_rent * 12, 0);
  const vacancy = units.filter(u => u.status === 'vacant').reduce((sum, u) => sum + u.market_rent * 12, 0);
  // Explicit scenario mapping separates vacant market rent from the occupied
  // units' market/contract difference. The roll's total gap includes both.
  const discount = units.filter(u => u.status === 'occupied').reduce((sum, u) => sum + (u.market_rent - u.monthly_rent!) * 12, 0);
  const concessions = units.reduce((sum, u) => sum + u.concession_monthly_equiv * 12, 0);
  const income = { gross_potential_rent: gpr, less_vacancy_credit_loss: vacancy, less_loss_to_lease: discount, less_concessions: concessions, other_income: { parking: 6000 } };
  const expenses = { real_estate_taxes: 10000, insurance: 5000, management_fees: 6000, payroll_benefits: 10000 + expenseShock, utilities: { electric: 3000, water_sewer: 2000 }, repairs_maintenance: 4000, replacement_reserves: 2000, capital_expenditures_actual: 5000 };
  const operating = fields(deriveOperatingStatement({ income, expenses }).fields);
  const egi = gpr - vacancy - discount - concessions + income.other_income.parking;
  const opex = expenses.real_estate_taxes + expenses.insurance + expenses.management_fees + expenses.payroll_benefits + expenses.utilities.electric + expenses.utilities.water_sewer + expenses.repairs_maintenance;
  const noi = egi - opex;
  const loan = 600000;
  const rate = 0.06;
  const debtInput = { loan_amount: loan, interest_rate: rate, ...(interestOnly ? { amortization: 'interest_only' } : { amortization_years: 30, interest_only_months: 12 }) };
  const debt = fields(deriveDebt(debtInput).fields);
  const service = interestOnly ? loan * rate : monthlyPayment(loan, rate, 360) * 12;
  const uses = { purchase_price: 900000, closing_costs: { legal: 5000, transfer: 5000 }, renovation: { budget: 20000, contingency: 2000 } };
  const totalUses = uses.purchase_price + uses.closing_costs.legal + uses.closing_costs.transfer + uses.renovation.budget + uses.renovation.contingency;
  // The scenario explicitly states aggregate equity and its sole source. No
  // runtime equity plug or sponsor-to-total inference is being tested/added.
  const equity = totalUses - loan;
  const sources = { senior_loan: loan, sponsor_equity: equity };
  const sourceContent = { sources, uses, equity_metrics: { equity_total: equity } };
  const sections = {
    property: { total_units: units.length, total_nra_sqft: 8000 },
    rent_roll: { ...roll },
    noi_model: { income: { effective_gross_income: egi }, expenses: { total_operating_expenses: opex }, net_operating_income: operating.net_operating_income },
    valuation: { purchase_price: uses.purchase_price },
    debt_structure: { ...debtInput, annual_debt_service: debt.annual_debt_service },
    sources_uses: sourceContent,
    dcf: { annual_cash_flows: [{ year: 2, net_cash_flow_levered: 99999 }, { year: 1, net_cash_flow_levered: noi - service, cumulative_equity_invested: equity }] },
  };
  return { units, roll, operating, debt, sections, sourceContent, egi, opex, noi, service, equity, totalUses, vacancy, discount };
}

describe('multifamily acquisition workflow with explicit source assumptions', () => {
  for (const interestOnly of [true, false]) for (const shock of [0, 150000]) {
    it(`connects revenue, NOI, ${interestOnly ? 'IO' : 'amortizing'} debt and ${shock ? 'negative' : 'positive'} cash flow`, () => {
      const s = acquisition(interestOnly, shock);
      expect(s.roll.gross_potential_rent_annual).toBe(s.units.reduce((sum, u) => sum + u.market_rent * 12, 0));
      expect(s.roll.in_place_rent_annual).toBe(s.units.reduce((sum, u) => sum + (u.monthly_rent ?? 0) * 12, 0));
      expect(s.roll.loss_to_lease_monthly! * 12).toBe(s.vacancy + s.discount);
      expect(s.operating['income.effective_gross_income']).toBe(s.egi);
      expect(s.operating['expenses.total_operating_expenses']).toBe(s.opex);
      expect(s.operating.net_operating_income).toBe(s.noi);
      expect(s.debt.annual_debt_service).toBe(s.service);
      const funding = deriveSourcesUses(s.sourceContent, document(s.sections));
      expect(funding.sourcesTotal).toBe(s.totalUses);
      expect(funding.usesTotal).toBe(s.totalUses);
      expect(funding.balanced).toBe(true);
      const expected = {
        cap_rate: quantizeDecimal(s.noi / 900000, 6),
        dscr: quantizeDecimal(s.noi / s.service, 4),
        cash_on_cash: quantizeDecimal((s.noi - s.service) / s.equity, 6),
      };
      for (const [id, value] of Object.entries(expected)) {
        expect(run(id, s.sections)).toMatchObject({ ok: true, value });
        expect(stated(id, document(s.sections), value, id === 'dscr' ? 4 : 6).state).toBe('verified');
        expect(stated(id, document(s.sections), value + 0.1, id === 'dscr' ? 4 : 6).state).toBe('failed');
      }
      const annual = deriveDCF({ annual_cash_flows: [{ year: 1, net_operating_income: s.noi, annual_debt_service: s.service, cumulative_equity_invested: s.equity }] });
      expect(fields(annual.fields)['annual_cash_flows.0.net_cash_flow_levered']).toBe(s.noi - s.service);
      expect(annual.fields.some(f => f.path.includes('unlevered') || f.path.includes('returns'))).toBe(false);
    });
  }

  it('keeps all-equity cash flow computable without reporting finite zero-debt coverage', () => {
    const s = acquisition(true);
    s.sections.debt_structure = { loan_amount: 0, interest_rate: 0.06, amortization: 'interest_only', annual_debt_service: 0 };
    s.sections.sources_uses.sources.senior_loan = 0;
    s.sections.sources_uses.sources.sponsor_equity = s.totalUses;
    s.sections.sources_uses.equity_metrics.equity_total = s.totalUses;
    s.sections.dcf.annual_cash_flows[1]!.cumulative_equity_invested = s.totalUses;
    expect(deriveSourcesUses(s.sections.sources_uses, document(s.sections)).balanced).toBe(true);
    s.sections.dcf.annual_cash_flows[1]!.net_cash_flow_levered = s.noi;
    expect(run('cash_on_cash', s.sections)).toMatchObject({ ok: true, value: quantizeDecimal(s.noi / s.totalUses, 6) });
    expect(run('dscr', s.sections)).toMatchObject({ ok: false, error: { code: 'CALC-DIV-ZERO' } });
    expect(stated('dscr', document(s.sections), 1, 2).state).toBe('unverifiable');
  });

  it('requires total equity and exposes incomplete funding without making an equity plug', () => {
    const s = acquisition(true);
    const incomplete = { ...s.sourceContent, sources: { senior_loan: 600000 }, equity_metrics: {} };
    const funding = deriveSourcesUses(incomplete, document(s.sections));
    expect(funding.balanced).toBe(false);
    expect(funding.gap).toBe(600000 - s.totalUses);
    expect(funding.fields.some(f => f.path.includes('equity'))).toBe(false);
    expect(run('cash_on_cash', { ...s.sections, sources_uses: incomplete })).toMatchObject({ ok: true, value: null });
  });

  it('selects senior coverage but refuses role-free multi-tranche cash-flow fallback', () => {
    const s = acquisition(true);
    const p = document(s.sections);
    const base = p.sections.debt_structure as UWBlock;
    p.sections.debt_structure = {
      senior: { ...base, annotation: { ...base.annotation, variant: 'senior' }, content: { ...base.content, _role: 'senior' } },
      mezz: { ...base, annotation: { ...base.annotation, variant: 'mezz' }, content: { _role: 'junior', loan_amount: 100000, annual_debt_service: 10000 } },
    };
    expect(evaluateCalc(metric('dscr'), { parsed: p, prior_results: {}, locale: 'en-US' })).toMatchObject({ ok: true, value: quantizeDecimal(s.noi / s.service, 4) });
    expect(evaluateCalc(metric('cash_on_cash'), { parsed: p, prior_results: {}, locale: 'en-US' })).toMatchObject({ ok: true });
    delete p.sections.dcf;
    expect(evaluateCalc(metric('cash_on_cash'), { parsed: p, prior_results: {}, locale: 'en-US' })).toMatchObject({ ok: false, error: { code: 'CALC-RESOLVE-002' } });
  });
});

// This explicit ledger is authored input. deriveDCF does not decide forward
// NOI, amortized exit balance, capex treatment or a terminal timing convention.
describe('authored hold-period ledger and preferred-equity sale', () => {
  it('connects sale deductions and stated preferred redemption to common proceeds', () => {
    const exit = fields(deriveDCF({ assumptions: { disposition_costs_pct: 0.02 }, exit_analysis: {
      exit_value_gross: 1200000, loan_balance_at_exit: 550000,
      preferred_equity_redemption_at_exit: 100000,
    } }).fields);
    const costs = 1200000 * 0.02;
    expect(exit['exit_analysis.net_proceeds_to_equity']).toBe(1200000 - costs - 550000);
    expect(exit['exit_analysis.net_proceeds_to_common_equity']).toBe(1200000 - costs - 550000 - 100000);
  });

  it('checks date-aware returns with an independent discount/bisection oracle', () => {
    const series: CashFlowSeries = { day_count: 'actual/365f', series: [
      { date: '2027-03-15', amount: -332000, kind: 'acquisition' },
      { date: '2028-02-29', amount: -25000, kind: 'capex' },
      { date: '2028-03-15', amount: 36000, kind: 'operating' },
      { date: '2029-09-30', amount: 750000, kind: 'disposition' },
    ] };
    const anchor = Date.parse(`${series.series[0]!.date}T00:00:00Z`);
    const exponents = series.series.map(r => (Date.parse(`${r.date}T00:00:00Z`) - anchor) / 86400000 / 365);
    const oracle = (rate: number) => series.series.reduce((sum, r, i) => sum + r.amount * (1 + rate) ** -exponents[i]!, 0);
    let lo = 0; let hi = 1;
    for (let i = 0; i < 150; i++) {
      const mid = (lo + hi) / 2;
      if (oracle(mid) > 0) lo = mid; else hi = mid;
    }
    const expectedIrr = quantizeDecimal((lo + hi) / 2, 6);
    const expectedNpv = quantizeDecimal(oracle(0.1), 2);
    const flows = datedFlowsOf(series)!;
    expect(quantizeDecimal(xnpvOf(flows, 0.1), 2)).toBe(expectedNpv);
    expect(quantizeDecimal(xirrOf(flows), 6)).toBe(expectedIrr);
    series.stated_metrics = { xirr: expectedIrr, xnpv: { rate: 0.1, value: expectedNpv } };
    expect(verifyCashFlowSeries(series).verdict).toBe('verified');
    series.stated_metrics.xirr = expectedIrr + 0.01;
    expect(verifyCashFlowSeries(series).verdict).toBe('failed');
  });
});
