// Canonical hospitality calc pack.
//
// Single source of truth for hospitality derived metrics. Hotels size by keys
// rather than square feet, and their distinctive operating statistics — ADR,
// RevPAR, occupancy, and GOP margin — are ratios over room nights rather than
// over area. Available and occupied room nights live in `rent_roll` (the same
// place self-storage keeps occupied units); `noi_model` carries the USALI-shaped
// departmental income and the gross operating profit subtotal.

import type { ModuleManifest } from '../protocol.js';

export const HOSPITALITY_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.hospitality',
  name: 'Hospitality Starter Pack',
  version: '1.0.0',
  description:
    'Fourteen derived metrics for hospitality underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/key, loan/key, NOI/key, expense ratio, cash-on-cash, occupancy, ADR, RevPAR, and GOP margin.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['hospitality'],
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
      id: 'price_per_key',
      label: 'Price / Key',
      formula: 'valuation.purchase_price / property.keys',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_key',
      label: 'Loan / Key',
      formula: 'debt_structure.loan_amount / property.keys',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'noi_per_key',
      label: 'NOI / Key',
      formula: 'noi_model.net_operating_income / property.keys',
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
      formula: 'rent_roll.occupied_room_nights / rent_roll.available_room_nights',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'adr',
      label: 'ADR',
      formula: 'noi_model.income.rooms_revenue / rent_roll.occupied_room_nights',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'revpar',
      label: 'RevPAR',
      formula: 'noi_model.income.rooms_revenue / rent_roll.available_room_nights',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'gop_margin',
      label: 'GOP Margin',
      formula:
        'noi_model.gross_operating_profit / noi_model.income.effective_gross_income',
      unit: '%',
      deterministic: true,
    },
  ],
};
