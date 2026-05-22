// Retail workbook layout.
//
// Layout-only; derived-metric formulas come from RETAIL_PACK in @uwmd/core via
// the shared engine. Retail sizes by gross leasable area. EGI nets base rent
// less vacancy plus NNN expense reimbursements, percentage rent, and other
// income (matching the retail noi_model). The expense_reimbursements line is
// named so the `expense_recovery_ratio` metric can reference it.

import { RETAIL_PACK } from '@uwmd/core';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Base Rent', path: 'base_rent' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss', sign: -1 },
  { label: 'Expense Reimbursements', path: 'expense_reimbursements', name: 'expense_reimbursements' },
  { label: 'Percentage Rent', path: 'percentage_rent' },
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
  { name: 'gross_leasable_area',  label: 'Gross Leasable Area',  source: { section: 'property',       path: 'gross_leasable_area' },    format: 'count' },
  { name: 'sponsor_equity',       label: 'Sponsor Equity',       source: { section: 'sources_uses',   path: 'sources.sponsor_equity' }, format: 'currency' },
  { name: 'total_uses',           label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },             format: 'currency' },
  { name: 'occupied_gla',         label: 'Occupied GLA',         source: { section: 'rent_roll',      path: 'occupied_gla' },           format: 'count' },
  { name: 'total_gla',            label: 'Total GLA',            source: { section: 'rent_roll',      path: 'total_gla' },              format: 'count' },
];

export const RETAIL_LAYOUT: WorkbookLayout = {
  assetClass: 'retail',
  pack: RETAIL_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
