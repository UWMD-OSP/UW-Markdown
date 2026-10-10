// RFC 0068: source-backed site inventory, pad rent, and park-owned-home rent.
// The existing public module runtime evaluates all math and requiredness rules.
import type { ModuleManifest } from '@uwmd/core';
import { MANUFACTURED_HOUSING_VIEW_MODELS } from './view-models.js';

export { MANUFACTURED_HOUSING_VIEW_MODELS } from './view-models.js';
export const MANUFACTURED_HOUSING_MODULE_ID = 'org.uwmd.manufactured_housing_module' as const;
export const MANUFACTURED_HOUSING_MODULE_VERSION = '0.1.0';
/** Permanent class identity; any future builtin promotion needs an equivalence contract. */
export const MANUFACTURED_HOUSING_ASSET_CLASS = 'org.uwmd.manufactured_housing' as const;

const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: MANUFACTURED_HOUSING_MODULE_ID,
  name: 'Manufactured Housing Underwriting Module',
  version: MANUFACTURED_HOUSING_MODULE_VERSION,
  description: 'Sites, pad rent and park-owned-home rent; six site-based calculations and seven requiredness/range rules.',
  authors: ['UW Markdown contributors'],
  license: 'MIT',
  requires_protocol: '>=2.5.0',
  requires_format: '>=1.1',
  requires_tier: 'tier-3-calc-host',
  declares_asset_classes: [{
      id: MANUFACTURED_HOUSING_ASSET_CLASS,
      display_name: 'Manufactured Housing Community',
      fallback: 'multifamily',
      required_sections: ['mhc_sites'],
  }],
  sections: [{
      id: 'mhc_sites',
      display_name: 'Manufactured Housing Sites',
      required: true,
      // Informative to hosts; the core runtime does not enforce section schemas.
      schema: {
        type: 'object',
        required: [
          'total_sites',
          'occupied_sites',
          'park_owned_homes',
          'weighted_pad_rent_monthly',
          'as_of_date'
        ],
        properties: {
          total_sites: {
            type: 'integer',
            minimum: 1,
            description: 'Every manufactured-home site, occupied or vacant; the per-site denominator.'
          },
          occupied_sites: {
            type: 'integer',
            minimum: 0,
            description: 'Sites under in-place leases, no more than total_sites.'
          },
          park_owned_homes: {
            type: 'integer',
            minimum: 0,
            description: 'Homes owned by the community on its sites, no more than total_sites.'
          },
          weighted_pad_rent_monthly: {
            type: 'number',
            minimum: 0,
            description: 'Stated, source-backed site-count-weighted monthly pad rent across all sites, vacant at stated asking rent; excludes home rent, fees and reimbursements. Document currency.'
          },
          poh_home_rent_monthly: {
            type: [
              'number',
              'null'
            ],
            minimum: 0,
            description: 'Monthly home rent per park-owned home across all owned homes, vacant at stated asking rent; excludes pad rent. Required when homes exist; absent or null otherwise.'
          },
          as_of_date: {
            type: 'string',
            format: 'date',
            description: 'Source measurement date; runtime rule enforces presence only in this contract.'
          }
        },
        allOf: [
          {
            if: {
              properties: {
                park_owned_homes: {
                  const: 0
                }
              },
              required: [
                'park_owned_homes'
              ]
            },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword, not a thenable.
            then: {
              properties: {
                poh_home_rent_monthly: {
                  type: 'null'
                }
              }
            }
          },
          {
            if: {
              properties: {
                park_owned_homes: {
                  minimum: 1
                }
              },
              required: [
                'park_owned_homes'
              ]
            },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword, not a thenable.
            then: {
              required: [
                'poh_home_rent_monthly'
              ],
              properties: {
                poh_home_rent_monthly: {
                  type: 'number',
                  minimum: 0
                }
              }
            }
          }
        ]
      },
  }],
  calculations: [
    {
      id: 'physical_occupancy',
      label: 'Physical Occupancy',
      formula: 'mhc_sites.occupied_sites / mhc_sites.total_sites',
      unit: '%',
      round_to: 4,
      deterministic: true
    },
    {
      id: 'annual_pad_rent_potential',
      label: 'Annual Pad Rent Potential',
      formula: 'mhc_sites.weighted_pad_rent_monthly * mhc_sites.total_sites * 12',
      unit: '$',
      round_to: 2,
      deterministic: true
    },
    {
      id: 'poh_share',
      label: 'Park-Owned Home Share',
      formula: 'mhc_sites.park_owned_homes / mhc_sites.total_sites',
      unit: '%',
      round_to: 4,
      deterministic: true
    },
    {
      id: 'annual_poh_home_rent_potential',
      label: 'Annual Park-Owned Home Rent Potential',
      formula: 'mhc_sites.poh_home_rent_monthly * mhc_sites.park_owned_homes * 12',
      unit: '$',
      round_to: 2,
      deterministic: true
    },
    {
      id: 'price_per_site',
      label: 'Price per Site',
      formula: 'valuation.purchase_price / mhc_sites.total_sites',
      unit: '$',
      round_to: 2,
      deterministic: true
    },
    {
      id: 'noi_per_site',
      label: 'NOI per Site',
      formula: 'noi_model.net_operating_income / mhc_sites.total_sites',
      unit: '$',
      round_to: 2,
      deterministic: true
    }
  ],
  // False emits the rule code; numeric type errors use MOD-RULE-ERROR.
  validations: [
    {
      code: 'CC-MOD-MH-01',
      severity: 'error',
      message: 'Total sites must be a stated whole number of at least one.',
      rule: 'mhc_sites == null || (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)'
    },
    {
      code: 'CC-MOD-MH-02',
      severity: 'error',
      message: 'Occupied sites must be a stated whole number between zero and total sites.',
      rule: 'mhc_sites == null || (mhc_sites.occupied_sites != null && mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites)'
    },
    {
      code: 'CC-MOD-MH-03',
      severity: 'error',
      message: 'Park-owned homes must be a stated whole number between zero and total sites.',
      rule: 'mhc_sites == null || (mhc_sites.park_owned_homes != null && mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites)'
    },
    {
      code: 'CC-MOD-MH-04',
      severity: 'error',
      message: 'Weighted monthly pad rent must be stated and nonnegative.',
      rule: 'mhc_sites == null || (mhc_sites.weighted_pad_rent_monthly != null && mhc_sites.weighted_pad_rent_monthly >= 0)'
    },
    {
      code: 'CC-MOD-MH-05',
      severity: 'error',
      message: 'The counts and rents must state an as_of_date; first scope checks presence only.',
      rule: 'mhc_sites == null || mhc_sites.as_of_date != null'
    },
    {
      code: 'CC-MOD-MH-06',
      severity: 'error',
      message: 'Home rent must be absent or null when there are no park-owned homes.',
      rule: 'mhc_sites == null || mhc_sites.park_owned_homes != 0 || mhc_sites.poh_home_rent_monthly == null'
    },
    {
      code: 'CC-MOD-MH-07',
      severity: 'error',
      message: 'Home rent must be stated and nonnegative when park-owned homes exist.',
      rule: 'mhc_sites == null || mhc_sites.park_owned_homes == null || mhc_sites.park_owned_homes <= 0 || (mhc_sites.poh_home_rent_monthly != null && mhc_sites.poh_home_rent_monthly >= 0)'
    }
  ],
  view_models: [...MANUFACTURED_HOUSING_VIEW_MODELS],
};

export const MANUFACTURED_HOUSING_MODULE: ModuleManifest = Object.freeze(MANIFEST);
