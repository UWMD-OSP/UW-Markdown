// Canonical self-storage calc pack.
//
// Single source of truth for self-storage derived metrics. The class-specific
// fields are net rentable square feet, rentable units, and both physical and
// economic occupancy.

import type { ModuleManifest } from '../protocol.js';

export const SELF_STORAGE_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.self_storage',
  name: 'Self-Storage Starter Pack',
  version: '1.0.0',
  description:
    'Twelve derived metrics for self-storage underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/NRSF, loan/NRSF, NOI/NRSF, expense ratio, cash-on-cash, physical occupancy, and economic occupancy.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['self_storage'],
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
      id: 'price_per_nrsf',
      label: 'Price / NRSF',
      formula: 'valuation.purchase_price / property.net_rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_nrsf',
      label: 'Loan / NRSF',
      formula: 'debt_structure.loan_amount / property.net_rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'noi_per_nrsf',
      label: 'NOI / NRSF',
      formula: 'noi_model.net_operating_income / property.net_rentable_square_feet',
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
      id: 'physical_occupancy',
      label: 'Physical Occupancy',
      formula: 'rent_roll.occupied_units / property.rentable_units',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'economic_occupancy',
      label: 'Economic Occupancy',
      formula: 'noi_model.income.effective_gross_income / noi_model.income.gross_potential_rent',
      unit: '%',
      deterministic: true,
    },
  ],
};
