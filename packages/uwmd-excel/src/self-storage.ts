// Self-storage workbook layout.
//
// Layout-only; derived-metric formulas come from SELF_STORAGE_PACK in
// @uwmd/core. Self-storage sizes by net rentable square feet (NRSF) and rentable
// units; the operating statement includes facility-specific income lines such as
// admin fees, tenant insurance, and truck/retail income.

import { SELF_STORAGE_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent', path: 'gross_potential_rent', name: 'gross_potential_rent' },
  { label: '(Less) Economic Vacancy / Concessions', path: 'economic_vacancy_loss', sign: -1 },
  { label: 'Admin Fees', path: 'admin_fees' },
  { label: 'Tenant Insurance Income', path: 'tenant_insurance_income' },
  { label: 'Truck / Retail / Other Income', path: 'other_income' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Payroll', path: 'payroll' },
  { label: 'Property Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Marketing', path: 'marketing' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'General & Administrative', path: 'general_admin' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',              label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },              format: 'currency' },
  { name: 'loan_amount',                 label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },                 format: 'currency' },
  { name: 'annual_debt_service',         label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },         format: 'currency' },
  ...sizeNamedInputs('self_storage', { net_rentable_square_feet: 'Net Rentable SF', rentable_units: 'Rentable Units' }),
  { name: 'sponsor_equity',              label: 'Sponsor Equity',       source: { section: 'sources_uses',   path: 'sources.sponsor_equity' },      format: 'currency' },
  { name: 'total_uses',                  label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },                  format: 'currency' },
  { name: 'occupied_units',              label: 'Occupied Units',       source: { section: 'rent_roll',      path: 'occupied_units' },              format: 'count' },
];

export const SELF_STORAGE_LAYOUT: WorkbookLayout = {
  assetClass: 'self_storage',
  pack: SELF_STORAGE_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
