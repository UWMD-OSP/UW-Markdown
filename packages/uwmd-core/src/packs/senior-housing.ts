// Canonical senior-housing calc pack.
//
// Single source of truth for senior-housing derived metrics. Like hospitality,
// senior housing is an operating business rather than a lease: a large share of
// revenue is care fees rather than rent, and labor is the dominant expense. The
// class-distinctive metrics are therefore RevPOR (revenue per occupied unit per
// month), the labor ratio, and the care-revenue share — the three numbers that
// tell an underwriter whether the operator, not the real estate, is carrying the
// deal. Sizing is per unit, as in multifamily.

import type { ModuleManifest } from '../protocol.js';

export const SENIOR_HOUSING_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.senior_housing',
  name: 'Senior Housing Starter Pack',
  version: '1.0.0',
  description:
    'Fourteen derived metrics for senior-housing underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/unit, loan/unit, NOI/unit, expense ratio, cash-on-cash, occupancy, RevPOR, labor ratio, and care-revenue ratio.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['senior_housing'],
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
      id: 'noi_per_unit',
      label: 'NOI / Unit',
      formula: 'noi_model.net_operating_income / property.total_units',
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
      formula: 'rent_roll.occupied_units / property.total_units',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'revpor',
      label: 'RevPOR (Monthly)',
      formula: 'noi_model.income.effective_gross_income / (rent_roll.occupied_units * 12)',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'labor_ratio',
      label: 'Labor Ratio',
      formula:
        'noi_model.total_labor_expense / noi_model.income.effective_gross_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'care_revenue_ratio',
      label: 'Care Revenue Ratio',
      formula: 'noi_model.income.care_revenue / noi_model.income.effective_gross_income',
      unit: '%',
      deterministic: true,
    },
  ],
};
