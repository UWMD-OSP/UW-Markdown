// Canonical industrial calc pack.
//
// Single source of truth for the industrial derived metrics. Consumed by the
// web editor (via @uwmd/core/browser), the @uwmd/excel converter (via
// emitExcelFormula), conformance tests, and any future asset-class viewer.
// Add a metric here once and every tool picks it up.
//
// Each formula is a Tier-3 safe expression evaluable by `evaluateCalc()`
// against a parsed .uw.md file. Field paths reference the canonical industrial
// schema (see UW_FORMAT_SPEC §4 and the Ironwood Logistics example).
//
// Industrial measures size in rentable building area (`property.rentable_square_feet`)
// and occupancy in SF (`rent_roll.occupied_sf` / `total_rentable_sf`), like
// office. Like retail, it carries an `expense_recovery_ratio` metric — industrial
// is predominantly NNN, so most operating expenses are recovered from tenants.

import type { ModuleManifest } from '../protocol.js';

export const INDUSTRIAL_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.industrial',
  name: 'Industrial Starter Pack',
  version: '1.0.0',
  description:
    'Twelve derived metrics for industrial underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/sqft, loan/sqft, NOI/sqft, expense ratio, expense recovery ratio, cash-on-cash, occupancy.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['industrial'],
  calculations: [
    {
      id: 'cap_rate',
      label: 'Cap Rate',
      formula: 'noi_model.net_operating_income / valuation.purchase_price',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'ltv',
      label: 'LTV',
      formula: 'debt_structure.loan_amount / valuation.purchase_price',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'ltc',
      label: 'LTC',
      formula: 'debt_structure.loan_amount / sources_uses.uses.total',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'dscr',
      label: 'DSCR',
      formula: 'noi_model.net_operating_income / debt_structure.annual_debt_service',
      unit: 'x',
      deterministic: true,
    },
    {
      id: 'debt_yield',
      label: 'Debt Yield',
      formula: 'noi_model.net_operating_income / debt_structure.loan_amount',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'price_per_sqft',
      label: 'Price / SqFt',
      formula: 'valuation.purchase_price / property.rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_sqft',
      label: 'Loan / SqFt',
      formula: 'debt_structure.loan_amount / property.rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'noi_per_sqft',
      label: 'NOI / SqFt',
      formula: 'noi_model.net_operating_income / property.rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'expense_ratio',
      label: 'Operating Expense Ratio',
      formula:
        'noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'expense_recovery_ratio',
      label: 'Expense Recovery Ratio',
      formula:
        'noi_model.income.expense_reimbursements / noi_model.expenses.total_operating_expenses',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'cash_on_cash',
      label: 'Cash-on-Cash',
      formula:
        '(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.sponsor_equity',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'occupancy',
      label: 'Occupancy',
      formula: 'rent_roll.occupied_sf / rent_roll.total_rentable_sf',
      unit: '%',
      deterministic: true,
    },
  ],
};
