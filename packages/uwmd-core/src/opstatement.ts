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
  unavailable: Record<string, 'incomplete_detail'>;
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

/** Complete detail sets are declared in RFC 0131, never inferred from present leaves. */
const OTHER_INCOME_LINES = ['laundry', 'parking', 'pet_fees', 'late_fees', 'storage', 'utility_reimbursements', 'cable_internet', 'vending', 'lease_termination_fees', 'insurance_proceeds', 'other'] as const;
const UTILITY_LINES = ['electric', 'gas', 'water_sewer', 'trash'] as const;
const INCOME_LINES = ['gross_potential_rent', 'less_vacancy_credit_loss', 'less_concessions', 'less_loss_to_lease'] as const;

/** Select authored aggregates; compute only from complete, finite prerequisites. */
export function deriveOperatingStatement(content: Row): OperatingStatementDerivation {
  const c = collector();
  const diagnostics: OperatingStatementDerivation['diagnostics'] = [];
  const unavailable: Record<string, 'incomplete_detail'> = {};
  const income = asObj(content['income']);
  const expenses = asObj(content['expenses']);
  const completeSum = (row: Row, keys: readonly string[]): number | null =>
    keys.every(key => num(row[key]) != null) ? keys.reduce((sum, key) => sum + (num(row[key]) as number), 0) : null;
  const aggregate = (path: string, label: string, stated: number | null, computed: number | null): number | null => {
    if (stated == null) {
      if (computed == null || !Number.isFinite(computed)) {
        unavailable[path] = 'incomplete_detail';
        return null;
      }
      c.add(path, label, 'currency', computed);
      // Dependents use unrounded arithmetic, not the display replacement.
      return computed;
    }
    c.fields.push({ path, label: `${label} (stated)`, kind: 'currency', value: stated });
    if (computed == null) diagnostics.push({ path, reason: 'incomplete_detail', stated, computed: null });
    else if (quantizeDecimal(stated, 0) !== quantizeDecimal(computed, 0)) {
      diagnostics.push({ path, reason: 'aggregate_mismatch', stated, computed });
    }
    return stated;
  };
  const other = asObj(income['other_income']);
  const otherTotal = aggregate('income.other_income.total', 'Other Income (total)', num(other['total']), completeSum(other, OTHER_INCOME_LINES));
  const baseComplete = INCOME_LINES.every(key => num(income[key]) != null);
  const gpr = num(income['gross_potential_rent']);
  const vacancy = num(income['less_vacancy_credit_loss']);
  const egiComputed = baseComplete && otherTotal != null
    ? (gpr as number) - (vacancy as number) - (num(income['less_concessions']) as number) - (num(income['less_loss_to_lease']) as number) + otherTotal : null;
  const egi = aggregate('income.effective_gross_income', 'Effective Gross Income', num(income['effective_gross_income']), egiComputed);
  c.add('income.vacancy_pct', 'Vacancy %', 'rate', gpr && vacancy != null ? vacancy / gpr : null);
  const utilities = asObj(expenses['utilities']);
  const utilitiesTotal = aggregate('expenses.utilities.total', 'Utilities (total)', num(utilities['total']), completeSum(utilities, UTILITY_LINES));
  const expenseLines = completeSum(expenses, EXPENSE_LINES);
  const opex = aggregate('expenses.total_operating_expenses', 'Total Operating Expenses', num(expenses['total_operating_expenses']),
    expenseLines != null && utilitiesTotal != null ? expenseLines + utilitiesTotal : null);
  const noi = aggregate('net_operating_income', 'Net Operating Income', num(content['net_operating_income']),
    egi != null && opex != null ? egi - opex : null);
  c.add('expense_ratio', 'Expense Ratio', 'rate', egi && opex != null ? opex / egi : null);
  c.add('noi_margin', 'NOI Margin', 'rate', egi && noi != null ? noi / egi : null);
  return { fields: c.fields, diagnostics, unavailable };
}
