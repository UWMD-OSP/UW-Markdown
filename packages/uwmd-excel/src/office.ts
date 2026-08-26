// Office workbook layout.
//
// Layout-only; derived-metric formulas come from OFFICE_PACK in @uwmd/core via
// the shared engine. Office sizes by rentable square feet and the operating
// statement's EGI = gross potential rent − vacancy loss (matching the office
// noi_model). Sponsor equity is `sources_uses.sources.sponsor_equity`.

import { OFFICE_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent', path: 'gross_potential_rent' },
  { label: '(Less) Vacancy Loss', path: 'vacancy_loss', sign: -1 },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Real Estate Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'Utilities', path: 'utilities' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance' },
  { label: 'Management Fee', path: 'management_fee' },
  { label: 'General & Administrative', path: 'general_admin' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',      label: 'Purchase Price',       source: { section: 'valuation',      path: 'purchase_price' },         format: 'currency' },
  { name: 'loan_amount',         label: 'Loan Amount',          source: { section: 'debt_structure', path: 'loan_amount' },            format: 'currency' },
  { name: 'annual_debt_service', label: 'Annual Debt Service',  source: { section: 'debt_structure', path: 'annual_debt_service' },    format: 'currency' },
  ...sizeNamedInputs('office', { rentable_square_feet: 'Rentable SF' }),
  { name: 'sponsor_equity',      label: 'Sponsor Equity',       source: { section: 'sources_uses',   path: 'sources.sponsor_equity' }, format: 'currency' },
  { name: 'total_uses',          label: 'Total Project Cost',   source: { section: 'sources_uses',   path: 'uses.total' },             format: 'currency' },
  { name: 'occupied_sf',         label: 'Occupied SF',          source: { section: 'rent_roll',      path: 'occupied_sf' },            format: 'count' },
  { name: 'total_rentable_sf',   label: 'Total Rentable SF',    source: { section: 'rent_roll',      path: 'total_rentable_sf' },      format: 'count' },
];

export const OFFICE_LAYOUT: WorkbookLayout = {
  assetClass: 'office',
  pack: OFFICE_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
