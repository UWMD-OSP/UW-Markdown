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
  { name: 'purchase_price',         label: 'Purchase Price',          source: { section: 'valuation',      path: 'purchase_price' },          format: 'currency' },
  { name: 'loan_amount',            label: 'Loan Amount',             source: { section: 'debt_structure', path: 'loan_amount' },             format: 'currency' },
  { name: 'annual_debt_service',    label: 'Annual Debt Service',     source: { section: 'debt_structure', path: 'annual_debt_service' },     format: 'currency' },
  ...sizeNamedInputs('hospitality', { keys: 'Keys' }),
  { name: 'sponsor_equity',         label: 'Sponsor Equity',          source: { section: 'sources_uses',   path: 'sources.sponsor_equity' },  format: 'currency' },
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
