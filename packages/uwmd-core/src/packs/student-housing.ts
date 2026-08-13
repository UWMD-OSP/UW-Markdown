// Canonical student-housing calc pack.
//
// Single source of truth for student-housing derived metrics. The class looks
// like multifamily but is not underwritten like it: leases are signed per BED,
// not per unit, so every sizing and occupancy metric is keyed off
// `property.total_beds`. The defining metric is the pre-lease rate — the share
// of beds already committed for the coming academic year. Student housing
// re-leases essentially its entire rent roll on one date, so pre-lease velocity
// is the leading indicator of next year's revenue in a way no trailing
// occupancy figure can be.

import type { ModuleManifest } from '../protocol.js';

export const STUDENT_HOUSING_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.student_housing',
  name: 'Student Housing Starter Pack',
  version: '1.0.0',
  description:
    'Fourteen derived metrics for student-housing underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/bed, loan/bed, NOI/bed, expense ratio, cash-on-cash, occupancy, pre-lease rate, revenue per bed, and monthly rent per bed.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['student_housing'],
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
      id: 'price_per_bed',
      label: 'Price / Bed',
      formula: 'valuation.purchase_price / property.total_beds',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_bed',
      label: 'Loan / Bed',
      formula: 'debt_structure.loan_amount / property.total_beds',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'noi_per_bed',
      label: 'NOI / Bed',
      formula: 'noi_model.net_operating_income / property.total_beds',
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
      label: 'Occupancy (by Bed)',
      formula: 'rent_roll.occupied_beds / property.total_beds',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'pre_lease_rate',
      label: 'Pre-Lease Rate',
      formula: 'rent_roll.preleased_beds / property.total_beds',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'revenue_per_bed',
      label: 'Revenue / Bed',
      formula: 'noi_model.income.effective_gross_income / property.total_beds',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'rent_per_bed_monthly',
      label: 'Rent / Bed (Monthly)',
      formula: 'noi_model.income.gross_potential_rent / (property.total_beds * 12)',
      unit: '$',
      deterministic: true,
    },
  ],
};
