// Industrial workbook layout.
//
// Layout-only; derived-metric formulas come from INDUSTRIAL_PACK in @uwmd/core
// via the shared engine. Industrial sizes by rentable building area. EGI nets
// base rent less vacancy plus NNN expense reimbursements and other income
// (matching the industrial noi_model). The expense_reimbursements line is named
// so the `expense_recovery_ratio` metric can reference it.

import { INDUSTRIAL_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Base Rent', path: 'base_rent' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss', sign: -1 },
  { label: 'Expense Reimbursements', path: 'expense_reimbursements', name: 'expense_reimbursements' },
  { label: 'Other Income', path: 'other_income' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Real Estate Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'CAM', path: 'cam' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'General & Administrative', path: 'general_admin' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',       label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },         format: 'currency' },
  { name: 'loan_amount',          label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },            format: 'currency' },
  { name: 'annual_debt_service',  label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },    format: 'currency' },
  ...sizeNamedInputs('industrial', { rentable_square_feet: 'Rentable SF' }),
  { name: 'sponsor_equity',       label: 'Sponsor Equity',       source: { section: 'sources_uses',   path: 'sources.sponsor_equity' }, format: 'currency' },
  { name: 'total_uses',           label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },             format: 'currency' },
  { name: 'occupied_sf',          label: 'Occupied SF',          source: { section: 'rent_roll',      path: 'occupied_sf' },            format: 'count' },
  { name: 'total_rentable_sf',    label: 'Total Rentable SF',    source: { section: 'rent_roll',      path: 'total_rentable_sf' },      format: 'count' },
];

export const INDUSTRIAL_LAYOUT: WorkbookLayout = {
  assetClass: 'industrial',
  pack: INDUSTRIAL_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
