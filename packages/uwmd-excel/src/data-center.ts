// Self-storage workbook layout.
//
// Layout-only; derived-metric formulas come from DATA_CENTER_PACK in
// @uwmd/core. Self-storage sizes by net rentable square feet (NRSF) and rentable
// units; the operating statement includes facility-specific income lines such as
// admin fees, tenant insurance, and truck/retail income.

import { DATA_CENTER_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Base Rent', path: 'base_rent' },
  { label: '(Less) Vacancy / Credit Loss', path: 'vacancy_credit_loss', sign: -1 },
  { label: 'Expense Reimbursements', path: 'expense_reimbursements' },
  { label: 'Other Income', path: 'other_income' },
];
const expenseLines: readonly ExpenseLine[] = [
  { label: 'Property Taxes', path: 'property_taxes' }, { label: 'Insurance', path: 'insurance' },
  { label: 'CAM', path: 'cam' }, { label: 'Utilities', path: 'utilities' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Management Fee', path: 'management_fee' }, { label: 'General & Administrative', path: 'general_admin' },
];

const namedInputs: readonly NamedInput[] = [
  {"name": "dc_capacity_critical_it_load_kw", "label": "Critical It Load Kw", "source": {"section": "dc_capacity", "path": "critical_it_load_kw"}, "format": "decimal"},
  {"name": "dc_capacity_planned_it_load_kw", "label": "Planned It Load Kw", "source": {"section": "dc_capacity", "path": "planned_it_load_kw"}, "format": "decimal"},
  {"name": "dc_capacity_contracted_it_load_kw", "label": "Contracted It Load Kw", "source": {"section": "dc_capacity", "path": "contracted_it_load_kw"}, "format": "decimal"},
  {"name": "dc_capacity_utility_feed_kw", "label": "Utility Feed Kw", "source": {"section": "dc_capacity", "path": "utility_feed_kw"}, "format": "decimal"},
  {"name": "dc_capacity_design_pue", "label": "Design Pue", "source": {"section": "dc_capacity", "path": "design_pue"}, "format": "decimal"},
  {"name": "dc_capacity_measured_pue", "label": "Measured Pue", "source": {"section": "dc_capacity", "path": "measured_pue"}, "format": "decimal"},
  {"name": "dc_capacity_raised_floor_sf", "label": "Raised Floor Sf", "source": {"section": "dc_capacity", "path": "raised_floor_sf"}, "format": "count"},
  {"name": "dc_capacity_design_density_kw_per_rack", "label": "Design Density Kw Per Rack", "source": {"section": "dc_capacity", "path": "design_density_kw_per_rack"}, "format": "decimal"},
  {"name": "dc_power_utility_rate_per_kwh", "label": "Utility Rate Per Kwh", "source": {"section": "dc_power", "path": "utility_rate_per_kwh"}, "format": "decimal"},
  {"name": "dc_power_power_margin", "label": "Power Margin", "source": {"section": "dc_power", "path": "power_margin"}, "format": "decimal"},
  {"name": "dc_power_stated_annual_power_cost", "label": "Stated Annual Power Cost", "source": {"section": "dc_power", "path": "stated_annual_power_cost"}, "format": "currency"},
  {"name": "dc_revenue_rent_per_kw_month", "label": "Rent Per Kw Month", "source": {"section": "dc_revenue", "path": "rent_per_kw_month"}, "format": "currency"},
  {"name": "dc_revenue_interconnection_revenue_annual", "label": "Interconnection Revenue Annual", "source": {"section": "dc_revenue", "path": "interconnection_revenue_annual"}, "format": "currency"},
  {"name": "dc_revenue_services_revenue_annual", "label": "Services Revenue Annual", "source": {"section": "dc_revenue", "path": "services_revenue_annual"}, "format": "currency"},
  {"name": "dc_revenue_market_rent_per_kw_month", "label": "Market Rent Per Kw Month", "source": {"section": "dc_revenue", "path": "market_rent_per_kw_month"}, "format": "currency"},
  {"name": "quick_purchase_price", "label": "Stated Purchase Price", "source": {"section": "quick_metrics", "path": "purchase_price"}, "format": "count"},

  { name: 'purchase_price',              label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },              format: 'currency' },
  { name: 'underwritten_value', label: 'Underwritten Value', source: { section: 'valuation', path: 'underwritten_value' }, format: 'currency' },
  { name: 'loan_amount',                 label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },                 format: 'currency' },
  { name: 'annual_debt_service',         label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },         format: 'currency' },
  ...sizeNamedInputs('data_center', { critical_it_load_kw: 'Critical It Load Kw' }),
  { name: 'equity_total', label: 'Total Invested Equity', source: { section: 'sources_uses', path: 'equity_metrics.equity_total' }, format: 'currency' },
  { name: 'levered_cash_flow_y1', label: 'Year 1 Levered Cash Flow', source: { section: 'dcf', path: 'annual_cash_flows.Y1.net_cash_flow_levered' }, format: 'currency' },
  { name: 'total_uses',                  label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },                  format: 'currency' },
];

export const DATA_CENTER_LAYOUT: WorkbookLayout = {
  assetClass: 'data_center',
  pack: DATA_CENTER_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
