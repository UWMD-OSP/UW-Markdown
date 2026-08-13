// Canonical land calc pack.
//
// Land is the one asset class here that is NOT an income property, and the pack
// is shaped by that fact.
//
// The seven income classes all derive from a positive NOI: cap rate, DSCR, and
// debt yield are the core of every one of their packs. Land has no stabilized
// income. Its `noi_model` carries carry costs (taxes, assessments, insurance,
// site security) against at most incidental interim income (grazing, billboard,
// laydown), so its net operating income is normally NEGATIVE.
//
// This pack therefore DELIBERATELY OMITS `cap_rate`, `dscr`, and `debt_yield`.
// Dividing a negative NOI by a purchase price yields a number that is
// arithmetically valid and financially meaningless — a "-1.6% cap rate" reads as
// a yield when it is really a carry burden, and a DSCR below zero reads as
// distress when the loan is an interest-only entitlement facility being carried
// out of an equity reserve by design. Emitting those metrics would produce
// confidently wrong output, which is worse than producing none.
//
// Land is instead underwritten on basis and density: what the dirt costs per
// acre and per buildable unit, how much of it is actually usable, what it costs
// to carry, and what share of the eventual sellout the land basis represents.
// `land.test.ts` pins the omission so a future contributor cannot add cap_rate
// back by pattern-matching the other packs.

import type { ModuleManifest } from '../protocol.js';

export const LAND_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.land',
  name: 'Land Starter Pack',
  version: '1.0.0',
  description:
    'Twelve derived metrics for land underwriting: $/acre, $/usable acre, $/buildable unit, usable-land ratio, density, LTV, LTC, loan/acre, basis per buildable unit, carry ratio, carry cost per acre, and land-to-sellout ratio. Deliberately omits cap rate, DSCR, and debt yield — land has no stabilized income.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['land'],
  calculations: [
    {
      id: 'price_per_acre',
      label: 'Price / Gross Acre',
      formula: 'valuation.purchase_price / property.gross_acres',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'price_per_usable_acre',
      label: 'Price / Usable Acre',
      formula: 'valuation.purchase_price / property.usable_acres',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'price_per_buildable_unit',
      label: 'Price / Buildable Unit',
      formula: 'valuation.purchase_price / property.entitled_units',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'usable_land_ratio',
      label: 'Usable Land Ratio',
      formula: 'property.usable_acres / property.gross_acres',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'density_per_usable_acre',
      label: 'Density / Usable Acre',
      formula: 'property.entitled_units / property.usable_acres',
      unit: 'x',
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
      id: 'loan_per_acre',
      label: 'Loan / Gross Acre',
      formula: 'debt_structure.loan_amount / property.gross_acres',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'basis_per_buildable_unit',
      label: 'All-In Basis / Buildable Unit',
      formula: 'sources_uses.uses.total / property.entitled_units',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'carry_ratio',
      label: 'Annual Carry Ratio',
      formula:
        'noi_model.expenses.total_operating_expenses / valuation.purchase_price',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'carry_cost_per_acre',
      label: 'Annual Carry Cost / Gross Acre',
      formula: 'noi_model.expenses.total_operating_expenses / property.gross_acres',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'land_to_sellout_ratio',
      label: 'Land Basis / Projected Sellout',
      formula: 'valuation.purchase_price / valuation.projected_gross_sellout',
      unit: '%',
      deterministic: true,
    },
  ],
};
