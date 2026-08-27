// Display layout for the three sections this module contributes.
//
// Defined in TypeScript rather than inline in the manifest so that
// `SectionViewModel` actually type-checks. RFC 0006 left the shape of
// `view_models` as an open question; a free-form object in a hand-authored
// manifest is exactly where a typo in `kind` survives to production and renders
// a currency as a ratio.

import type { SectionViewModel } from '@uwmd/core';

export const HOSPITALITY_VIEW_MODELS: readonly SectionViewModel[] = Object.freeze([
  {
    section_id: 'hotel_metrics',
    display_name: 'Hotel Operating Metrics',
    display_order: 30,
    description: 'The four numbers every hotel underwrite starts from, plus the market comp.',
    primary_fields: [
      { path: 'adr', label: 'ADR', kind: 'currency', primary: true, decimals: 2 },
      // Occupancy is a fraction on the wire (0.72), a percent on screen. The
      // format-wide rule, restated here only because hotel operators say "72"
      // and a module that stored 72 would silently break every rate calc.
      { path: 'occupancy', label: 'Occupancy', kind: 'percent', primary: true, decimals: 1 },
      { path: 'key_count', label: 'Keys', kind: 'count', primary: true },
    ],
    detail_fields: [
      { path: 'available_room_nights', label: 'Available Room Nights', kind: 'count' },
      { path: 'market_revpar', label: 'Market RevPAR', kind: 'currency', decimals: 2 },
    ],
  },
  {
    section_id: 'hotel_brand',
    display_name: 'Brand & Franchise',
    display_order: 31,
    description: 'Flag economics — the fees that come off room revenue before anything else does.',
    primary_fields: [
      { path: 'flag', label: 'Flag', kind: 'string', primary: true },
      {
        path: 'franchise_fee_pct_of_rooms',
        label: 'Franchise Fee',
        kind: 'percent',
        primary: true,
        decimals: 2,
      },
    ],
    detail_fields: [
      { path: 'marketing_fund_pct', label: 'Marketing Fund', kind: 'percent', decimals: 2 },
      { path: 'loyalty_program_pct', label: 'Loyalty Program', kind: 'percent', decimals: 2 },
      { path: 'term_years', label: 'Franchise Term', kind: 'count' },
    ],
  },
  {
    section_id: 'hotel_food_beverage',
    display_name: 'Food & Beverage',
    display_order: 32,
    description:
      'The department most likely to be underwritten optimistically. Labor is broken out because it is the line that moves.',
    primary_fields: [
      { path: 'fb_revenue', label: 'F&B Revenue', kind: 'currency', primary: true },
      { path: 'fb_cogs', label: 'F&B COGS', kind: 'currency', primary: true },
    ],
    detail_fields: [
      { path: 'fb_labor', label: 'F&B Labor', kind: 'currency' },
      {
        path: 'complimentary_breakfast_cost_per_occupied_room',
        label: 'Comp Breakfast / Occ. Room',
        kind: 'currency',
        decimals: 2,
      },
    ],
  },
]);
