// Senior-housing workbook layout.
//
// Layout-only; derived-metric formulas come from SENIOR_HOUSING_PACK in
// @uwmd/core. Senior housing sizes per unit and runs a labor-heavy operating
// statement: the three labor lines stay inside `expenses` so the statement
// foots, while `total_labor_expense` is a model-level subtotal exposed as its
// own named range for the labor-ratio metric.

import { SENIOR_HOUSING_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Revenue', path: 'gross_potential_revenue', name: 'gross_potential_revenue' },
  { label: '(Less) Vacancy Loss', path: 'vacancy_loss', sign: -1 },
  { label: 'Care Revenue', path: 'care_revenue', name: 'care_revenue' },
  { label: 'Community Fees', path: 'community_fees' },
  { label: 'Other Income', path: 'other_income' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Salaries & Wages', path: 'salaries_wages' },
  { label: 'Employee Benefits', path: 'employee_benefits' },
  { label: 'Contract Labor', path: 'contract_labor' },
  { label: 'Dietary & Food', path: 'dietary_food' },
  { label: 'Housekeeping & Laundry', path: 'housekeeping_laundry' },
  { label: 'Activities & Transportation', path: 'activities_transportation' },
  { label: 'Marketing', path: 'marketing' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'Property Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'General & Administrative', path: 'general_admin' },
  { label: 'Replacement Reserve', path: 'replacement_reserve' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',      label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },         format: 'currency' },
  { name: 'loan_amount',         label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },            format: 'currency' },
  { name: 'annual_debt_service', label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },    format: 'currency' },
  ...sizeNamedInputs('senior_housing', { total_units: 'Total Units' }),
  { name: 'sponsor_equity',      label: 'Sponsor Equity',       source: { section: 'sources_uses',   path: 'sources.sponsor_equity' }, format: 'currency' },
  { name: 'total_uses',          label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },             format: 'currency' },
  { name: 'occupied_units',      label: 'Occupied Units',       source: { section: 'rent_roll',      path: 'occupied_units' },         format: 'count' },
  { name: 'total_labor_expense', label: 'Total Labor Expense',  source: { section: 'noi_model',      path: 'total_labor_expense' },    format: 'currency' },
];

export const SENIOR_HOUSING_LAYOUT: WorkbookLayout = {
  assetClass: 'senior_housing',
  pack: SENIOR_HOUSING_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
