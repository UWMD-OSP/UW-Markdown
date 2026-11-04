import { quantizeDecimal } from '@uwmd/verify';
// Deterministic operating-statement footing — the income/expense line items are
// the inputs; effective gross income, total operating expenses, NOI, and the
// ratios foot from them. Same role for the operating_statement section that
// deriveRentRoll plays for rent_roll: one source of truth so the editor, CLI,
// and Excel converter never disagree.
//
// Conventions (standard CRE underwriting):
//  - EGI   = GPR − vacancy/credit loss − concessions − loss to lease + other income
//  - OpEx  = sum of operating expense lines, EXCLUDING capital expenditures and
//            replacement reserves (both are below-the-line for NOI purposes)
//  - NOI   = EGI − OpEx
//  - sub-rollups: other_income.total and utilities.total foot from their breakdowns
//
// Per-unit / per-sqft figures depend on the property section and are left as
// inputs here (this function sees only the operating_statement block).

import { collector, numOrNull, type DerivedField } from './derived.js';

type Row = Record<string, unknown>;

const num = numOrNull;
const asObj = (v: unknown): Row => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});

export interface OperatingStatementDerivation {
  fields: DerivedField[];
  /** Starter evidence only; these are not registered validation diagnostics. */
  diagnostics: Array<{ path: string; reason: 'aggregate_mismatch' | 'incomplete_detail'; stated: number; computed: number | null }>;
}

// Operating-expense lines that sum into total_operating_expenses. Excludes
// capital_expenditures_actual and replacement_reserves (below the line), the
// management_fee_pct_egi ratio, and the nested utilities object (added via its
// own footed total).
const EXPENSE_LINES = [
  'real_estate_taxes',
  'insurance',
  'management_fees',
  'payroll_benefits',
  'repairs_maintenance',
  'contract_services',
  'marketing_advertising',
  'administrative',
  'professional_fees',
  'other_expenses',
] as const;

/** Sum the numeric values of an object, skipping the listed keys. */
function sumExcept(obj: Row, skip: string[]): number {
  const entries = Object.entries(obj).filter(([key]) => !skip.includes(key));
  // An authored subtotal with no numeric breakdown is a source input, not an
  // empty sum. Preserve its exact value while the broader completeness contract
  // remains a proposed RFC.
  if (!entries.some(([, value]) => num(value) != null)) return num(obj['total']) ?? 0;
  let total = 0;
  for (const [k, v] of entries) {
    if (skip.includes(k)) continue;
    total += num(v) ?? 0;
  }
  return total;
}

/** Foot a statement without replacing authored aggregates. Pure: never mutates content. */
export function deriveOperatingStatement(content: Row): OperatingStatementDerivation {
  const c = collector();
  const diagnostics: OperatingStatementDerivation['diagnostics'] = [];
  const income = asObj(content['income']);
  const expenses = asObj(content['expenses']);
  const complete = (row: Row, keys: readonly string[]) => keys.every(key => num(row[key]) != null);
  const aggregate = (path: string, label: string, stated: number | null, computed: number, detailComplete: boolean): number => {
    if (stated == null) {
      c.add(path, label, 'currency', computed);
      return computed;
    }
    // Source inputs retain exact authored values. Only computed replacements
    // pass through the reporting collector.
    c.fields.push({ path, label: `${label} (stated)`, kind: 'currency', value: stated });
    if (!detailComplete) diagnostics.push({ path, reason: 'incomplete_detail', stated, computed: null });
    else if (quantizeDecimal(stated, 0) !== quantizeDecimal(computed, 0)) {
      diagnostics.push({ path, reason: 'aggregate_mismatch', stated, computed });
    }
    return stated;
  };

  const otherIncome = asObj(income['other_income']);
  const otherComplete = complete(otherIncome, ['laundry', 'pet_fees', 'late_fees', 'other']);
  const otherComputed = sumExcept(otherIncome, ['total']);
  const otherIncomeTotal = Object.keys(otherIncome).length
    ? aggregate('income.other_income.total', 'Other Income (total)', num(otherIncome['total']), otherComputed, otherComplete)
    : 0;
  const gpr = num(income['gross_potential_rent']) ?? 0;
  const vacancy = num(income['less_vacancy_credit_loss']) ?? 0;
  const concessions = num(income['less_concessions']) ?? 0;
  const lossToLease = num(income['less_loss_to_lease']) ?? 0;
  const incomeComplete = complete(income, ['gross_potential_rent', 'less_vacancy_credit_loss', 'less_concessions', 'less_loss_to_lease']) &&
    (num(otherIncome['total']) != null || otherComplete);
  const egi = aggregate('income.effective_gross_income', 'Effective Gross Income', num(income['effective_gross_income']),
    gpr - vacancy - concessions - lossToLease + otherIncomeTotal, incomeComplete);
  c.add('income.vacancy_pct', 'Vacancy %', 'rate', gpr ? vacancy / gpr : null);

  const utilities = asObj(expenses['utilities']);
  const utilitiesComplete = complete(utilities, ['electric', 'gas', 'water_sewer', 'trash']);
  const utilitiesTotal = Object.keys(utilities).length
    ? aggregate('expenses.utilities.total', 'Utilities (total)', num(utilities['total']), sumExcept(utilities, ['total']), utilitiesComplete)
    : 0;
  let expenseComputed = utilitiesTotal;
  for (const key of EXPENSE_LINES) expenseComputed += num(expenses[key]) ?? 0;
  const expenseComplete = complete(expenses, EXPENSE_LINES) && (num(utilities['total']) != null || utilitiesComplete);
  const opex = aggregate('expenses.total_operating_expenses', 'Total Operating Expenses', num(expenses['total_operating_expenses']), expenseComputed, expenseComplete);
  const noiComplete = (num(income['effective_gross_income']) != null || incomeComplete) &&
    (num(expenses['total_operating_expenses']) != null || expenseComplete);
  const noi = aggregate('net_operating_income', 'Net Operating Income', num(content['net_operating_income']), egi - opex, noiComplete);
  c.add('expense_ratio', 'Expense Ratio', 'rate', egi ? opex / egi : null);
  c.add('noi_margin', 'NOI Margin', 'rate', egi ? noi / egi : null);
  return { fields: c.fields, diagnostics };
}
