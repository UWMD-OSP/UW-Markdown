// Canonical mixed-use calc pack.
//
// A mixed-use property is two or more uses under one purchase price and one
// loan — apartments over ground-floor retail, an office podium under a hotel.
// No single income model or denominator describes it, so this pack does NOT try
// to treat the property as one homogeneous building. It reads the per-use
// subtotals stated in the `components` section (UW_FORMAT_SPEC §4.23, RFC 0019)
// and computes:
//
//   1. Property-level metrics that are legitimately single-figure — cap rate,
//      LTV, DSCR, debt yield, cash-on-cash. One NOI, one price, one loan.
//   2. A NOI share per component. Pure, allocation-free, always meaningful.
//   3. Use-level intensive metrics (price per unit / psf / bed) that require
//      splitting the single purchase price across uses. That split is
//      `allocation_pct`, a user-supplied input. When allocation is absent the
//      formula multiplies by a null and the metric evaluates to null — never a
//      silent area- or income-share guess (RFC 0019 §4).
//   4. Operating-business intermediates surfaced per component — a hotel's
//      `gross_operating_profit`, a senior facility's `total_labor_expense`.
//      These sit at different points in their respective waterfalls, so they are
//      passed through per use, never blended into one property number (§3a).
//
// DELIBERATE OMISSIONS, in the spirit of the land pack. There is NO property
// `price_per_unit` or `loan_per_unit`: units are a residential denominator and a
// mixed-use property is not all residential — dividing the whole price by the
// apartment count is the exact "number that looks like a metric" this design
// exists to eliminate. There is NO blended market cap rate: a weighted average
// of component market caps reads as an observable rate and is not one. The going-
// in `cap_rate` here is the property's own NOI over its own price — an arithmetic
// fact about this deal, not a market-implied blend. `mixed-use.test.ts` pins
// these omissions so a future contributor cannot add them back by pattern-
// matching the other packs.
//
// Component fields are addressed by static path (`components.retail.net_operating_income`),
// which is all the Tier-3 calc engine can express — see RFC 0019 §1. Every
// admissible component class (all nine income classes except land) gets its own
// NOI-share metric; a class simply not present in a given deal evaluates to null.

import type { ModuleManifest } from '../protocol.js';

export const MIXED_USE_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.mixed_use',
  name: 'Mixed-Use Starter Pack',
  version: '1.0.0',
  description:
    'Derived metrics for mixed-use underwriting: property-level cap rate, LTV, DSCR, debt yield, and cash-on-cash; a NOI share per component use; allocation-gated price per unit / psf / bed; and per-component operating-business intermediates (GOP, labor). Deliberately omits property price/unit, loan/unit, and any blended market cap rate.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['mixed_use'],
  calculations: [
    // ── Property-level (one NOI, one price, one loan) ──────────────────────
    {
      id: 'cap_rate',
      label: 'Cap Rate (going-in)',
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
      id: 'cash_on_cash',
      label: 'Cash-on-Cash',
      formula:
        '(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.equity_sponsor',
      unit: '%',
      deterministic: true,
    },

    // ── NOI share per component use (allocation-free; null when absent) ─────
    {
      id: 'multifamily_noi_share',
      label: 'Multifamily NOI Share',
      formula: 'components.multifamily.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'retail_noi_share',
      label: 'Retail NOI Share',
      formula: 'components.retail.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'office_noi_share',
      label: 'Office NOI Share',
      formula: 'components.office.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'industrial_noi_share',
      label: 'Industrial NOI Share',
      formula: 'components.industrial.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'self_storage_noi_share',
      label: 'Self-Storage NOI Share',
      formula: 'components.self_storage.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'hospitality_noi_share',
      label: 'Hospitality NOI Share',
      formula: 'components.hospitality.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'senior_housing_noi_share',
      label: 'Senior Housing NOI Share',
      formula: 'components.senior_housing.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'student_housing_noi_share',
      label: 'Student Housing NOI Share',
      formula: 'components.student_housing.net_operating_income / noi_model.net_operating_income',
      unit: '%',
      deterministic: true,
    },

    // ── Use-level intensive metrics (null without allocation_pct) ──────────
    {
      id: 'multifamily_price_per_unit',
      label: 'Multifamily Price / Unit',
      formula:
        '(valuation.purchase_price * components.multifamily.allocation_pct) / components.multifamily.total_units',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'retail_price_psf',
      label: 'Retail Price / SqFt',
      formula:
        '(valuation.purchase_price * components.retail.allocation_pct) / components.retail.nra_sqft',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'office_price_psf',
      label: 'Office Price / SqFt',
      formula:
        '(valuation.purchase_price * components.office.allocation_pct) / components.office.nra_sqft',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'industrial_price_psf',
      label: 'Industrial Price / SqFt',
      formula:
        '(valuation.purchase_price * components.industrial.allocation_pct) / components.industrial.nra_sqft',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'self_storage_price_psf',
      label: 'Self-Storage Price / SqFt',
      formula:
        '(valuation.purchase_price * components.self_storage.allocation_pct) / components.self_storage.nra_sqft',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'student_housing_price_per_bed',
      label: 'Student Housing Price / Bed',
      formula:
        '(valuation.purchase_price * components.student_housing.allocation_pct) / components.student_housing.total_beds',
      unit: '$',
      deterministic: true,
    },

    // ── Operating-business intermediates, surfaced per component ───────────
    {
      id: 'hospitality_gross_operating_profit',
      label: 'Hospitality Gross Operating Profit',
      formula: 'components.hospitality.gross_operating_profit',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'senior_housing_total_labor_expense',
      label: 'Senior Housing Total Labor Expense',
      formula: 'components.senior_housing.total_labor_expense',
      unit: '$',
      deterministic: true,
    },
  ],
};
