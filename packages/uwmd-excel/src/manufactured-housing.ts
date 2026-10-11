// Self-storage workbook layout.
//
// Layout-only; derived-metric formulas come from MANUFACTURED_HOUSING_PACK in
// @uwmd/core. Self-storage sizes by net rentable square feet (NRSF) and rentable
// units; the operating statement includes facility-specific income lines such as
// admin fees, tenant insurance, and truck/retail income.

import { MANUFACTURED_HOUSING_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent', path: 'gross_potential_rent.value', name: 'gross_potential_rent' },
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
  {"name": "mhc_sites_total_sites", "label": "Total Sites", "source": {"section": "mhc_sites", "path": "total_sites"}, "format": "count"},
  {"name": "mhc_sites_occupied_sites", "label": "Occupied Sites", "source": {"section": "mhc_sites", "path": "occupied_sites"}, "format": "count"},
  {"name": "mhc_sites_park_owned_homes", "label": "Park Owned Homes", "source": {"section": "mhc_sites", "path": "park_owned_homes"}, "format": "count"},
  {"name": "mhc_sites_weighted_pad_rent_monthly", "label": "Weighted Pad Rent Monthly", "source": {"section": "mhc_sites", "path": "weighted_pad_rent_monthly"}, "format": "count"},
  {"name": "mhc_sites_poh_home_rent_monthly", "label": "Poh Home Rent Monthly", "source": {"section": "mhc_sites", "path": "poh_home_rent_monthly"}, "format": "count"},

  { name: 'purchase_price',              label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },              format: 'currency' },
  { name: 'underwritten_value', label: 'Underwritten Value', source: { section: 'valuation', path: 'underwritten_value' }, format: 'currency' },
  { name: 'loan_amount',                 label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },                 format: 'currency' },
  { name: 'annual_debt_service',         label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },         format: 'currency' },
  ...sizeNamedInputs('manufactured_housing', { total_sites: 'Total Sites' }),
  { name: 'equity_total', label: 'Total Invested Equity', source: { section: 'sources_uses', path: 'equity_metrics.equity_total' }, format: 'currency' },
  { name: 'levered_cash_flow_y1', label: 'Year 1 Levered Cash Flow', source: { section: 'dcf', path: 'annual_cash_flows.Y1.net_cash_flow_levered' }, format: 'currency' },
  { name: 'total_uses',                  label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },                  format: 'currency' },
];

export const MANUFACTURED_HOUSING_LAYOUT: WorkbookLayout = {
  assetClass: 'manufactured_housing',
  pack: MANUFACTURED_HOUSING_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
