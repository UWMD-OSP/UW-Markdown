// Canonical multifamily calc pack.
//
// Single source of truth for the eight multifamily derived metrics. Consumed
// by the web editor (via @uwmd/core/browser), the @uwmd/excel converter (via
// emitExcelFormula), conformance tests, and any future asset-class viewer.
// Add a metric here once and every tool picks it up.
//
// Each formula is a Tier-3 safe expression evaluable by `evaluateCalc()`
// against a parsed .uw.md file. Field paths reference the canonical
// multifamily schema (see UW_FORMAT_SPEC §4 and the Parkview example).

import type { ModuleManifest } from '../protocol.js';

export const MULTIFAMILY_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.multifamily',
  name: 'Multifamily Starter Pack',
  version: '1.0.0',
  description:
    'Eight derived metrics for multifamily underwriting: cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['multifamily'],
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
      id: 'price_per_unit',
      label: 'Price / Unit',
      formula: 'valuation.purchase_price / property.total_units',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_unit',
      label: 'Loan / Unit',
      formula: 'debt_structure.loan_amount / property.total_units',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_sqft',
      label: 'Loan / SqFt',
      formula: 'debt_structure.loan_amount / property.total_nra_sqft',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'cash_on_cash',
      label: 'Cash-on-Cash',
      formula:
        '(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.equity_sponsor',
      unit: '%',
      deterministic: true,
    },
  ],
};
