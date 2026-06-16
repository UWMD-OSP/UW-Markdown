import { describe, it, expect } from 'vitest';
import { deriveOperatingStatement } from './opstatement.js';

function field(d: ReturnType<typeof deriveOperatingStatement>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

// Mirrors the Parkview worked example's operating_statement income/expense lines.
const parkview = {
  income: {
    gross_potential_rent: 655200,
    less_vacancy_credit_loss: 32760,
    less_concessions: 0,
    less_loss_to_lease: 0,
    other_income: {
      laundry: 12000,
      pet_fees: 3600,
      late_fees: 2400,
      other: 0,
      total: 18000,
    },
    effective_gross_income: 640440,
  },
  expenses: {
    real_estate_taxes: 52000,
    insurance: 24500,
    management_fees: 64044,
    management_fee_pct_egi: 0.1,
    payroll_benefits: 26400,
    utilities: { electric: 8400, gas: 4800, water_sewer: 7200, trash: 1200, total: 21600 },
    repairs_maintenance: 21600,
    contract_services: 8400,
    marketing_advertising: 0,
    administrative: 6000,
    professional_fees: 4800,
    capital_expenditures_actual: 0,
    replacement_reserves: 14400,
    other_expenses: 0,
    total_operating_expenses: 228344,
  },
  net_operating_income: 412096,
};

describe('deriveOperatingStatement', () => {
  const d = deriveOperatingStatement(parkview);

  it('foots other-income sub-total from the breakdown', () => {
    expect(field(d, 'income.other_income.total')).toBe(18000);
  });

  it('foots EGI = GPR − vacancy − concessions − LTL + other income', () => {
    expect(field(d, 'income.effective_gross_income')).toBe(640440);
  });

  it('derives vacancy %', () => {
    expect(field(d, 'income.vacancy_pct')).toBeCloseTo(0.05, 4); // 32760 / 655200
  });

  it('foots utilities sub-total from the breakdown', () => {
    expect(field(d, 'expenses.utilities.total')).toBe(21600);
  });

  it('foots OpEx excluding capex and replacement reserves', () => {
    // 52000+24500+64044+26400+21600(util)+21600+8400+0+6000+4800+0 = 229344
    // (replacement_reserves 14400 and capex 0 are below the line)
    expect(field(d, 'expenses.total_operating_expenses')).toBe(229344);
  });

  it('foots NOI and the ratios', () => {
    expect(field(d, 'net_operating_income')).toBe(411096); // 640440 − 229344
    expect(field(d, 'expense_ratio')).toBeCloseTo(0.3581, 4);
    expect(field(d, 'noi_margin')).toBeCloseTo(0.6419, 4);
  });
});

describe('deriveOperatingStatement — partial / empty', () => {
  it('handles a bare block without crashing', () => {
    const d = deriveOperatingStatement({});
    // No income/expenses objects → no other-income/utilities sub-totals, but EGI
    // and OpEx still foot to zero.
    expect(field(d, 'income.effective_gross_income')).toBe(0);
    expect(field(d, 'net_operating_income')).toBe(0);
    expect(field(d, 'income.other_income.total')).toBeUndefined();
  });

  it('ignores the management-fee ratio when summing OpEx', () => {
    const d = deriveOperatingStatement({
      income: { gross_potential_rent: 100000, effective_gross_income: 0 },
      expenses: { management_fees: 10000, management_fee_pct_egi: 0.1 },
    });
    expect(field(d, 'expenses.total_operating_expenses')).toBe(10000);
  });
});
