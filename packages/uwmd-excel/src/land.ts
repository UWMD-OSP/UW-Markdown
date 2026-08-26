// Land workbook layout.
//
// Layout-only; derived-metric formulas come from LAND_PACK in @uwmd/core.
//
// The "Operating Statement" sheet is a CARRY model for this class: the expense
// rows are the annual cost of holding the dirt and the income row is incidental
// interim revenue, so the NOI cell is normally negative. That is correct and
// intended — see the header comment in packs/land.ts for why the pack emits no
// cap rate, DSCR, or debt yield to go with it.

import { LAND_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Grazing / Interim Lease Income', path: 'grazing_lease' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Property Taxes', path: 'property_taxes' },
  { label: 'Insurance', path: 'insurance' },
  { label: 'CFD / Special Assessments', path: 'cfd_assessments' },
  { label: 'Site Maintenance & Security', path: 'site_maintenance_security' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',          label: 'Purchase Price',          source: { section: 'valuation',      path: 'purchase_price' },          format: 'currency' },
  { name: 'projected_gross_sellout', label: 'Projected Gross Sellout', source: { section: 'valuation',      path: 'projected_gross_sellout' }, format: 'currency' },
  { name: 'loan_amount',             label: 'Loan Amount',             source: { section: 'debt_structure', path: 'loan_amount' },             format: 'currency' },
  ...sizeNamedInputs('land', { gross_acres: 'Gross Acres', usable_acres: 'Usable Acres', entitled_units: 'Entitled Units (Lots)' }),
  { name: 'total_uses',              label: 'Total Project Cost',      source: { section: 'sources_uses',   path: 'uses.total' },              format: 'currency' },
];

export const LAND_LAYOUT: WorkbookLayout = {
  assetClass: 'land',
  pack: LAND_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
