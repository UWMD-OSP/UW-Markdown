// @uwmd/module-hospitality — the reference consumer of the protocol §X module
// system (RFC 0006).
//
// Two jobs, and the first is the reason the second exists:
//
//   1. Prove the module contract works for an EXTERNAL module. `ModuleManifest`
//      and its friends were specified and never loaded by anything that ships,
//      so every assumption in the types was unverified. This package is built
//      against the published surface of `@uwmd/core` — no privileged access, no
//      internal imports — because a reference module that reached inside the
//      library would demonstrate nothing.
//
//   2. Make hospitality first-class. The `hospitality` asset class is in the v1
//      enum, but the standard sections have nowhere to put ADR, occupancy,
//      brand fees, or F&B. Today a hotel deal stuffs them into
//      `noi_model.other_income` and loses the structure — which is exactly the
//      loss the module system exists to prevent.
//
// Why a module and not new standard sections: the same argument would then
// apply to gas stations, life sciences, and data centers, and the standard
// would grow a section per vertical for the benefit of whoever asked most
// recently.

import type { ModuleManifest } from '@uwmd/core';
import { HOSPITALITY_VIEW_MODELS } from './view-models.js';

export { HOSPITALITY_VIEW_MODELS } from './view-models.js';

export const HOSPITALITY_MODULE_ID = 'org.uwmd.hospitality' as const;
export const HOSPITALITY_MODULE_VERSION = '0.1.0';

/**
 * The manifest, as a typed object.
 *
 * TypeScript is the source of truth and `dist/manifest.json` is generated from
 * it at build time. RFC 0006 floated YAML for readability; the trade was a
 * parser dependency and a hand-authored file nothing type-checks, against a
 * definition where a typo in a `kind` or a `severity` is a compile error. Hosts
 * that want the manifest without a TypeScript toolchain read the emitted JSON,
 * which is what the `./manifest.json` export is for.
 */
const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: HOSPITALITY_MODULE_ID,
  name: 'Hospitality Underwriting Module',
  version: HOSPITALITY_MODULE_VERSION,
  description:
    'Adds hotel operating, brand, and F&B sections; RevPAR/ADR/occupancy calculations; and STR-comp validations.',
  authors: ['UW Markdown contributors'],
  license: 'MIT',
  requires_protocol: '>=1.0.0',
  requires_format: '>=1.1',
  // Tier 3, because the module's whole contribution beyond structure is its
  // calculations. A Tier-1 reader can render a hotel file without this module;
  // it just sees the hotel sections as generic blocks.
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['hospitality'],

  sections: [
    {
      id: 'hotel_metrics',
      display_name: 'Hotel Operating Metrics',
      required: true,
      schema: {
        type: 'object',
        required: ['adr', 'occupancy', 'available_room_nights', 'key_count'],
        properties: {
          adr: { type: 'number', minimum: 0, description: 'Average daily rate, in dollars.' },
          occupancy: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'A FRACTION, not a percent: 0.72, never 72. Format-wide rule.',
          },
          available_room_nights: {
            type: 'integer',
            minimum: 0,
            description: 'Keys x days in the period. Not occupied room nights.',
          },
          key_count: { type: 'integer', minimum: 0 },
          market_revpar: {
            type: ['number', 'null'],
            description:
              'Comp-set RevPAR for the same period. Null means no comp set was obtained — which is different from a comp set showing zero.',
          },
        },
      },
    },
    {
      id: 'hotel_brand',
      display_name: 'Brand & Franchise',
      schema: {
        type: 'object',
        properties: {
          flag: { type: ['string', 'null'], description: 'Brand, or null for independent.' },
          franchise_fee_pct_of_rooms: { type: 'number', minimum: 0, maximum: 0.2 },
          marketing_fund_pct: { type: 'number', minimum: 0, maximum: 0.1 },
          loyalty_program_pct: { type: 'number', minimum: 0, maximum: 0.1 },
          term_years: { type: ['integer', 'null'], minimum: 0 },
        },
      },
    },
    {
      id: 'hotel_food_beverage',
      display_name: 'Food & Beverage',
      schema: {
        type: 'object',
        properties: {
          fb_revenue: { type: 'number', minimum: 0 },
          fb_cogs: { type: 'number', minimum: 0 },
          fb_labor: { type: 'number', minimum: 0 },
          complimentary_breakfast_cost_per_occupied_room: { type: 'number', minimum: 0 },
        },
      },
    },
  ],

  // Declaration ORDER is load-bearing: the runtime threads each result into the
  // next as `prior_results`, so `revpar` must precede `revpar_index`, and
  // `total_room_revenue` must precede `room_revenue_per_key`.
  calculations: [
    {
      id: 'revpar',
      label: 'RevPAR',
      formula: 'hotel_metrics.adr * hotel_metrics.occupancy',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'total_room_revenue',
      label: 'Total Room Revenue',
      formula: 'hotel_metrics.adr * hotel_metrics.occupancy * hotel_metrics.available_room_nights',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'room_revenue_per_key',
      label: 'Room Revenue / Key',
      formula: 'total_room_revenue / hotel_metrics.key_count',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'revpar_index',
      label: 'RevPAR Index vs Market',
      formula: 'revpar / hotel_metrics.market_revpar',
      unit: 'x',
      round_to: 4,
      deterministic: true,
    },
    {
      id: 'fb_gross_margin',
      label: 'F&B Gross Margin',
      // A fraction, like every other rate in the format. Displayed as a percent.
      formula:
        '(hotel_food_beverage.fb_revenue - hotel_food_beverage.fb_cogs - hotel_food_beverage.fb_labor) / hotel_food_beverage.fb_revenue',
      unit: '%',
      round_to: 4,
      deterministic: true,
    },
  ],

  // Each rule asserts what must be TRUE. It fires when it evaluates to `false`,
  // and stays silent on `null` — a document that carries no `hotel_brand` has
  // not violated a franchise-fee rule, it has said nothing about franchise fees.
  validations: [
    {
      code: 'CC-MOD-HOSP-01',
      severity: 'warning',
      message:
        'RevPAR is more than 15% below market RevPAR — verify pricing strategy or comp set.',
      // The null guard is not decoration. Without it, every hotel file with no
      // comp set would carry a permanent underperformance warning.
      rule: 'hotel_metrics.market_revpar == null || revpar >= hotel_metrics.market_revpar * 0.85',
    },
    {
      code: 'CC-MOD-HOSP-02',
      severity: 'error',
      message: 'Occupancy must be between 0 and 1 (use a fraction, not a percentage).',
      rule: 'hotel_metrics.occupancy >= 0 && hotel_metrics.occupancy <= 1',
    },
    {
      code: 'CC-MOD-HOSP-03',
      severity: 'warning',
      message:
        'Total franchise fee burden exceeds 13% of room revenue — confirm flag economics.',
      rule: 'hotel_brand.franchise_fee_pct_of_rooms + hotel_brand.marketing_fund_pct + hotel_brand.loyalty_program_pct <= 0.13',
    },
  ],

  view_models: [...HOSPITALITY_VIEW_MODELS],
};

// Frozen at the boundary rather than inline: `Object.freeze` on an object
// literal widens every field to its readonly form BEFORE the annotation is
// checked, so `asset_classes` arrives as `string[]` and the manifest stops
// type-checking against `ModuleManifest`. Annotate, then freeze.
export const HOSPITALITY_MODULE: ModuleManifest = Object.freeze(MANIFEST);
