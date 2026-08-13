// Student-housing workbook layout.
//
// Layout-only; derived-metric formulas come from STUDENT_HOUSING_PACK in
// @uwmd/core. Student housing sizes per bed rather than per unit, so the named
// input is `total_beds`. Turnover/make-ready gets its own expense row because
// the property turns nearly its entire rent roll on one August date.

import { STUDENT_HOUSING_PACK } from '@uwmd/core';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent', path: 'gross_potential_rent', name: 'gross_potential_rent' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss', sign: -1 },
  { label: 'Utility Reimbursements', path: 'utility_reimbursements' },
  { label: 'Parking Income', path: 'parking_income' },
  { label: 'Admin & Application Fees', path: 'admin_application_fees' },
  { label: 'Other Income', path: 'other_income' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Payroll', path: 'payroll' },
  { label: 'Property Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Turnover & Make-Ready', path: 'turnover_make_ready' },
  { label: 'Marketing & Leasing', path: 'marketing_leasing' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'General & Administrative', path: 'general_admin' },
  { label: 'Security', path: 'security' },
  { label: 'Replacement Reserve', path: 'replacement_reserve' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',      label: 'Purchase Price',      source: { section: 'valuation',      path: 'purchase_price' },         format: 'currency' },
  { name: 'loan_amount',         label: 'Loan Amount',         source: { section: 'debt_structure', path: 'loan_amount' },            format: 'currency' },
  { name: 'annual_debt_service', label: 'Annual Debt Service', source: { section: 'debt_structure', path: 'annual_debt_service' },    format: 'currency' },
  { name: 'total_beds',          label: 'Total Beds',          source: { section: 'property',       path: 'total_beds' },             format: 'count' },
  { name: 'sponsor_equity',      label: 'Sponsor Equity',      source: { section: 'sources_uses',   path: 'sources.sponsor_equity' }, format: 'currency' },
  { name: 'total_uses',          label: 'Total Project Cost',  source: { section: 'sources_uses',   path: 'uses.total' },             format: 'currency' },
  { name: 'occupied_beds',       label: 'Occupied Beds',       source: { section: 'rent_roll',      path: 'occupied_beds' },          format: 'count' },
  { name: 'preleased_beds',      label: 'Pre-Leased Beds',     source: { section: 'rent_roll',      path: 'preleased_beds' },         format: 'count' },
];

export const STUDENT_HOUSING_LAYOUT: WorkbookLayout = {
  assetClass: 'student_housing',
  pack: STUDENT_HOUSING_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
