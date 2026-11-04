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

/** Foot an operating-statement content block. Pure: never mutates `content`. */
export function deriveOperatingStatement(content: Row): OperatingStatementDerivation {
  const c = collector();
  const income = asObj(content['income']);
  const expenses = asObj(content['expenses']);

  // Income side.
  const otherIncome = asObj(income['other_income']);
  const otherIncomeTotal = sumExcept(otherIncome, ['total']);
  if (Object.keys(otherIncome).length > 0) {
    const detail = Object.keys(otherIncome).some(key => key !== 'total' && num(otherIncome[key]) != null);
    if (!detail && num(otherIncome['total']) != null) c.fields.push({ path: 'income.other_income.total', label: 'Other Income (stated total)', kind: 'currency', value: otherIncomeTotal });
    else c.add('income.other_income.total', 'Other Income (total)', 'currency', otherIncomeTotal);
  }

  const gpr = num(income['gross_potential_rent']) ?? 0;
  const vacancy = num(income['less_vacancy_credit_loss']) ?? 0;
  const concessions = num(income['less_concessions']) ?? 0;
  const lossToLease = num(income['less_loss_to_lease']) ?? 0;
  const egi = gpr - vacancy - concessions - lossToLease + otherIncomeTotal;

  c.add('income.vacancy_pct', 'Vacancy %', 'rate', gpr ? vacancy / gpr : null);
  c.add('income.effective_gross_income', 'Effective Gross Income', 'currency', egi);

  // Expense side.
  const utilities = asObj(expenses['utilities']);
  const utilitiesTotal = sumExcept(utilities, ['total']);
  if (Object.keys(utilities).length > 0) {
    const detail = Object.keys(utilities).some(key => key !== 'total' && num(utilities[key]) != null);
    if (!detail && num(utilities['total']) != null) c.fields.push({ path: 'expenses.utilities.total', label: 'Utilities (stated total)', kind: 'currency', value: utilitiesTotal });
    else c.add('expenses.utilities.total', 'Utilities (total)', 'currency', utilitiesTotal);
  }

  let opex = utilitiesTotal;
  for (const key of EXPENSE_LINES) opex += num(expenses[key]) ?? 0;
  const expenseDetail = EXPENSE_LINES.some(key => num(expenses[key]) != null) ||
    Object.keys(utilities).some(key => key !== 'total' && num(utilities[key]) != null);
  const statedExpenses = num(expenses['total_operating_expenses']);
  if (!expenseDetail && statedExpenses != null) {
    opex = statedExpenses;
    c.fields.push({ path: 'expenses.total_operating_expenses', label: 'Operating Expenses (stated total)', kind: 'currency', value: opex });
  } else c.add('expenses.total_operating_expenses', 'Total Operating Expenses', 'currency', opex);

  // Bottom line.
  const noi = egi - opex;
  c.add('net_operating_income', 'Net Operating Income', 'currency', noi);
  c.add('expense_ratio', 'Expense Ratio', 'rate', egi ? opex / egi : null);
  c.add('noi_margin', 'NOI Margin', 'rate', egi ? noi / egi : null);

  return { fields: c.fields };
}
