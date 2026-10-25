// Hospitality workbook layout.
//
// Layout-only; derived-metric formulas come from HOSPITALITY_PACK in
// @uwmd/core. Hotels size by keys rather than area, and the operating statement
// is USALI-shaped: departmental revenues and expenses, then undistributed
// operating expenses, then the management fee, fixed charges, and the FF&E
// reserve that sit below gross operating profit.

import { HOSPITALITY_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Rooms Revenue', path: 'rooms_revenue', name: 'rooms_revenue' },
  { label: 'Food & Beverage Revenue', path: 'food_beverage_revenue' },
  { label: 'Other Operated Departments', path: 'other_operated_departments' },
  { label: 'Miscellaneous Income', path: 'miscellaneous_income' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Rooms Department', path: 'rooms_department' },
  { label: 'Food & Beverage Department', path: 'food_beverage_department' },
  { label: 'Other Departmental', path: 'other_departmental' },
  { label: 'Administrative & General', path: 'administrative_general' },
  { label: 'Sales & Marketing', path: 'sales_marketing' },
  { label: 'Franchise Fees', path: 'franchise_fees' },
  { label: 'Property Operations & Maintenance', path: 'property_operations_maintenance' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'Property Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'FF&E Reserve', path: 'ffe_reserve' },
];

const namedInputs: readonly NamedInput[] = [
  {"name": "hotel_metrics_adr", "label": "Adr", "source": {"section": "rent_roll", "path": "adr"}, "format": "currency"},
  {"name": "hotel_metrics_occupancy", "label": "Occupancy", "source": {"section": "rent_roll", "path": "occupancy"}, "format": "decimal"},
  {"name": "hotel_metrics_available_room_nights", "label": "Available Room Nights", "source": {"section": "rent_roll", "path": "available_room_nights"}, "format": "count"},
  {"name": "hotel_metrics_key_count", "label": "Key Count", "source": {"section": "property", "path": "keys"}, "format": "count"},
  {"name": "hotel_metrics_market_revpar", "label": "Market Revpar", "source": {"section": "hotel_metrics", "path": "market_revpar"}, "format": "currency"},
  {"name": "hotel_brand_franchise_fee_pct_of_rooms", "label": "Franchise Fee Pct Of Rooms", "source": {"section": "hotel_brand", "path": "franchise_fee_pct_of_rooms"}, "format": "decimal"},
  {"name": "hotel_brand_marketing_fund_pct", "label": "Marketing Fund Pct", "source": {"section": "hotel_brand", "path": "marketing_fund_pct"}, "format": "decimal"},
  {"name": "hotel_brand_loyalty_program_pct", "label": "Loyalty Program Pct", "source": {"section": "hotel_brand", "path": "loyalty_program_pct"}, "format": "decimal"},
  {"name": "hotel_brand_term_years", "label": "Term Years", "source": {"section": "hotel_brand", "path": "term_years"}, "format": "count"},
  {"name": "hotel_food_beverage_fb_revenue", "label": "Fb Revenue", "source": {"section": "hotel_food_beverage", "path": "fb_revenue"}, "format": "currency"},
  {"name": "hotel_food_beverage_fb_cogs", "label": "Fb Cogs", "source": {"section": "hotel_food_beverage", "path": "fb_cogs"}, "format": "currency"},
  {"name": "hotel_food_beverage_fb_labor", "label": "Fb Labor", "source": {"section": "hotel_food_beverage", "path": "fb_labor"}, "format": "currency"},
  {"name": "hotel_food_beverage_complimentary_breakfast_cost_per_occupied_room", "label": "Complimentary Breakfast Cost Per Occupied Room", "source": {"section": "hotel_food_beverage", "path": "complimentary_breakfast_cost_per_occupied_room"}, "format": "currency"},

  { name: 'purchase_price',         label: 'Purchase Price',          source: { section: 'valuation',      path: 'purchase_price' },          format: 'currency' },
  { name: 'underwritten_value', label: 'Underwritten Value', source: { section: 'valuation', path: 'underwritten_value' }, format: 'currency' },
  { name: 'ltv_basis', label: 'Declared LTV Basis', source: { section: 'debt_structure', path: 'ltv_basis' }, format: 'text' },
  { name: 'ltv_total_project_cost', label: 'LTV Total Project Cost', source: { section: 'sources_uses', path: 'total_project_cost' }, format: 'currency' },
  { name: 'loan_amount',            label: 'Loan Amount',             source: { section: 'debt_structure', path: 'loan_amount' },             format: 'currency' },
  { name: 'annual_debt_service',    label: 'Annual Debt Service',     source: { section: 'debt_structure', path: 'annual_debt_service' },     format: 'currency' },
  ...sizeNamedInputs('hospitality', { keys: 'Keys' }),
  { name: 'equity_total', label: 'Total Invested Equity', source: { section: 'sources_uses', path: 'equity_metrics.equity_total' }, format: 'currency' },
  { name: 'levered_cash_flow_y1', label: 'Year 1 Levered Cash Flow', source: { section: 'dcf', path: 'annual_cash_flows.Y1.net_cash_flow_levered' }, format: 'currency' },
  { name: 'total_uses',             label: 'Total Project Cost',      source: { section: 'sources_uses',   path: 'uses.total' },              format: 'currency' },
  { name: 'available_room_nights',  label: 'Available Room Nights',   source: { section: 'rent_roll',      path: 'available_room_nights' },   format: 'count' },
  { name: 'occupied_room_nights',   label: 'Occupied Room Nights',    source: { section: 'rent_roll',      path: 'occupied_room_nights' },    format: 'count' },
  { name: 'gross_operating_profit', label: 'Gross Operating Profit',  source: { section: 'noi_model',      path: 'gross_operating_profit' },  format: 'currency' },
];

export const HOSPITALITY_LAYOUT: WorkbookLayout = {
  assetClass: 'hospitality',
  pack: HOSPITALITY_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
