// @uwmd/module-data-center — the first product module on a module-declared
// asset class (RFC 0039).
//
// RFC 0003 opened the asset-class enum to modules and RFC 0006 shipped the
// first module, but hospitality is a BUILTIN class, so the two halves of the
// module system had never run together on a real vertical. This package is
// where they do: it declares `org.uwmd.data_center` (fallback `industrial`),
// supplies the three sections that make a document a data center, and
// computes the kilowatt-denominated figures a buyer actually asks about.
//
// Two rules that hold everywhere in this file:
//
//   - Every power figure is in kW. The market quotes MW for capacity and
//     $/kW/month for rent; one unit throughout is what stops a x1000 mistake
//     that no rule could catch after the fact (RFC 0039 alternative 3).
//   - Every rate is a fraction, per the format-wide rule. PUE is a ratio >= 1
//     by construction, and `CC-MOD-DC-01` says so.
//
// Like the hospitality module, this is built against the published surface of
// `@uwmd/core` and nothing else. A product module that reached inside the
// library would prove nothing about what an external author can do.

import type { ModuleManifest } from '@uwmd/core';
import { DATA_CENTER_VIEW_MODELS } from './view-models.js';

export { DATA_CENTER_VIEW_MODELS } from './view-models.js';

export const DATA_CENTER_MODULE_ID = 'org.uwmd.datacenters' as const;
export const DATA_CENTER_MODULE_VERSION = '0.1.0';
/** The asset class this module declares (format §2.2a, protocol §X.2). */
export const DATA_CENTER_ASSET_CLASS = 'org.uwmd.data_center' as const;

/**
 * The manifest, as a typed object.
 *
 * TypeScript is the source of truth and `dist/manifest.json` is generated from
 * it at build time — the RFC 0006 implementation-note 2 decision, adopted
 * as-is. Hosts without a TypeScript toolchain read the emitted JSON, which is
 * what the `./manifest.json` export is for.
 */
const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: DATA_CENTER_MODULE_ID,
  name: 'Data Center Underwriting Module',
  version: DATA_CENTER_MODULE_VERSION,
  description:
    'Declares the org.uwmd.data_center asset class; adds capacity, power-economics and revenue sections; kW-denominated calculations; PUE, utility-feed and utilization validations.',
  authors: ['UW Markdown contributors'],
  license: 'MIT',
  // 2.5.0 because the module's findings are read alongside the RFC 0037
  // coverage channel and the RFC 0038 return basis, both of which entered at
  // 2.5.0. Nothing here needs 2.5.0 mechanically, but a module pinned below
  // the protocol its own host runs is a lie the loader cannot catch.
  requires_protocol: '>=2.5.0',
  requires_format: '>=1.1',
  // Tier 3: the module's contribution beyond structure is its calculations.
  requires_tier: 'tier-3-calc-host',

  // No `asset_classes`: that field names BUILTIN classes a module enhances,
  // and this module enhances none. The class it applies to is the one it
  // declares below — the runtime scopes a declaring module to its declared
  // class the same way it scopes an enhancing module to `asset_classes`.
  declares_asset_classes: [
    {
      id: DATA_CENTER_ASSET_CLASS,
      display_name: 'Data Center',
      // Stated rather than omitted, because an honest approximation exists:
      // the STANDARD sections of a data-center deal are ordinary industrial
      // real estate (a building, a lease, an NOI). What a fallback reader
      // loses is every kW figure — see the RFC's compatibility analysis.
      fallback: 'industrial',
      required_sections: ['dc_capacity'],
      optional_sections: ['dc_power', 'dc_revenue'],
    },
  ],

  sections: [
    {
      id: 'dc_capacity',
      display_name: 'Capacity & Topology',
      // Required because it is what makes the document a data center.
      required: true,
      schema: {
        type: 'object',
        required: [
          'critical_it_load_kw',
          'planned_it_load_kw',
          'contracted_it_load_kw',
          'utility_feed_kw',
          'design_pue',
          'redundancy',
        ],
        properties: {
          critical_it_load_kw: {
            type: 'number',
            minimum: 0,
            description: 'Commissioned critical IT load, in kW — the capacity that can be sold today.',
          },
          planned_it_load_kw: {
            type: 'number',
            minimum: 0,
            description:
              'Full build-out critical load, in kW. Equals critical_it_load_kw when no further phases exist.',
          },
          contracted_it_load_kw: {
            type: 'number',
            minimum: 0,
            description:
              'Load under signed contract (leased or committed), in kW, including pre-leased future phases.',
          },
          utility_feed_kw: {
            type: 'number',
            minimum: 0,
            description: 'Utility power available at the meter today, in kW.',
          },
          design_pue: {
            type: 'number',
            minimum: 1,
            description: 'Design power usage effectiveness: total facility power / IT power. Never below 1.',
          },
          measured_pue: {
            type: ['number', 'null'],
            minimum: 1,
            description: 'Trailing measured PUE. Null when the facility is not yet operating.',
          },
          redundancy: {
            type: 'string',
            enum: ['n', 'n_plus_1', 'n_plus_2', '2n', '2n_plus_1'],
            description:
              'Electrical/mechanical topology. The fact, not the Uptime tier — the tier is a claim about it.',
          },
          raised_floor_sf: {
            type: ['integer', 'null'],
            minimum: 0,
            description: 'White space, in SF. Null for powered shells.',
          },
          design_density_kw_per_rack: {
            type: ['number', 'null'],
            minimum: 0,
            description: 'Average design density, kW per rack.',
          },
        },
      },
    },
    {
      id: 'dc_power',
      display_name: 'Power Economics',
      schema: {
        type: 'object',
        required: ['utility_rate_per_kwh', 'billing'],
        properties: {
          utility_rate_per_kwh: {
            type: 'number',
            minimum: 0,
            description: 'Blended $/kWh, all charges.',
          },
          billing: {
            type: 'string',
            enum: ['metered_pass_through', 'all_in', 'breakered'],
            description: 'How power is billed to tenants.',
          },
          power_margin: {
            type: ['number', 'null'],
            minimum: 0,
            description:
              'Landlord margin on power as a FRACTION of cost; meaningful only under all_in / breakered billing.',
          },
          stated_annual_power_cost: {
            type: ['number', 'null'],
            minimum: 0,
            description: "The operator's stated annual utility bill, when known. Takes precedence over the computed figure.",
          },
        },
      },
    },
    {
      id: 'dc_revenue',
      display_name: 'Revenue',
      schema: {
        type: 'object',
        required: ['lease_type', 'rent_per_kw_month'],
        properties: {
          lease_type: {
            type: 'string',
            enum: ['powered_shell', 'wholesale_turnkey', 'retail_colocation', 'hyperscale_build_to_suit'],
            description: 'Predominant lease structure.',
          },
          rent_per_kw_month: {
            type: 'number',
            minimum: 0,
            description: 'Weighted-average contracted rent, $/kW/month, on contracted_it_load_kw.',
          },
          interconnection_revenue_annual: {
            type: 'number',
            minimum: 0,
            description: 'Cross-connects and meet-me-room revenue, annual.',
          },
          services_revenue_annual: {
            type: 'number',
            minimum: 0,
            description: 'Remote hands and other services revenue, annual.',
          },
          market_rent_per_kw_month: {
            type: ['number', 'null'],
            minimum: 0,
            description:
              'Comp rent, $/kW/month. Null means no comp set was obtained — which is different from a comp set showing zero.',
          },
        },
      },
    },
  ],

  // Declaration ORDER is load-bearing: the runtime threads each result into the
  // next as `prior_results`, so each row may read only the rows above it.
  // `annual_power_cost` reads `annual_facility_kwh_at_contract`;
  // `power_cost_per_kw_month` reads `annual_power_cost`;
  // `blended_revenue_per_kw_month` reads `annual_rent_revenue`; and
  // `rent_index` is read by `CC-MOD-DC-07`.
  calculations: [
    {
      id: 'utilization',
      label: 'Utilization',
      // A fraction. Above 1.0 is not an error — it is a pre-leased phase, and
      // CC-MOD-DC-04 says so.
      formula: 'dc_capacity.contracted_it_load_kw / dc_capacity.critical_it_load_kw',
      unit: '%',
      round_to: 4,
      deterministic: true,
    },
    {
      id: 'commissioned_share',
      label: 'Commissioned Share of Build-Out',
      formula: 'dc_capacity.critical_it_load_kw / dc_capacity.planned_it_load_kw',
      unit: '%',
      round_to: 4,
      deterministic: true,
    },
    {
      id: 'facility_load_kw',
      label: 'Facility Load at Design PUE',
      formula: 'dc_capacity.critical_it_load_kw * dc_capacity.design_pue',
      unit: 'kW',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'annual_facility_kwh_at_contract',
      label: 'Annual Facility kWh at Contracted Load',
      formula: 'dc_capacity.contracted_it_load_kw * dc_capacity.design_pue * 8760',
      unit: 'kWh',
      round_to: 0,
      deterministic: true,
    },
    {
      id: 'annual_power_cost',
      label: 'Annual Power Cost',
      // The operator's stated bill wins when it exists; otherwise the design
      // figure at the blended rate.
      formula:
        'dc_power.stated_annual_power_cost != null ? dc_power.stated_annual_power_cost : annual_facility_kwh_at_contract * dc_power.utility_rate_per_kwh',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'power_cost_per_kw_month',
      label: 'Power Cost per kW-Month',
      formula: 'annual_power_cost / (dc_capacity.contracted_it_load_kw * 12)',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'annual_rent_revenue',
      label: 'Annual Rent Revenue',
      formula: 'dc_revenue.rent_per_kw_month * dc_capacity.contracted_it_load_kw * 12',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'blended_revenue_per_kw_month',
      label: 'Blended Revenue per kW-Month',
      formula:
        '(annual_rent_revenue + dc_revenue.interconnection_revenue_annual + dc_revenue.services_revenue_annual) / (dc_capacity.contracted_it_load_kw * 12)',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'rent_index',
      label: 'Rent Index vs Market',
      formula: 'dc_revenue.rent_per_kw_month / dc_revenue.market_rent_per_kw_month',
      unit: 'x',
      round_to: 4,
      deterministic: true,
    },
    // The two per-unit metrics the §XIII size-intensive registry withholds
    // from a custom class (§X.2.4), supplied by the module from the STANDARD
    // sections instead. `quick_metrics` is frontmatter and `noi_model` is a
    // standard section; the §VIII.2 resolver reaches both from a module
    // formula (RFC 0039 implementation note 1).
    {
      id: 'price_per_commissioned_kw',
      label: 'Price per Commissioned kW',
      formula: 'quick_metrics.purchase_price / dc_capacity.critical_it_load_kw',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
    {
      id: 'noi_per_commissioned_kw',
      label: 'NOI per Commissioned kW',
      // `net_operating_income` is the field the format spec names (§4, the
      // `noi_model` section); the RFC wrote `noi_model.noi`, which nothing
      // carries.
      formula: 'noi_model.net_operating_income / dc_capacity.critical_it_load_kw',
      unit: '$',
      round_to: 2,
      deterministic: true,
    },
  ],

  // Each rule asserts what must be TRUE. It fires when it evaluates to `false`,
  // and stays silent on `null` — a document carrying no `dc_revenue` has not
  // violated a rule about market rent, it has said nothing about market rent.
  validations: [
    {
      code: 'CC-MOD-DC-01',
      severity: 'error',
      message: 'PUE cannot be below 1.0 — total facility power includes the IT load.',
      rule: 'dc_capacity.design_pue >= 1',
    },
    {
      code: 'CC-MOD-DC-02',
      severity: 'warning',
      message:
        'Design PUE above 1.6 — legacy-grade efficiency; confirm cooling topology and the power pass-through terms.',
      rule: 'dc_capacity.design_pue <= 1.6',
    },
    {
      code: 'CC-MOD-DC-03',
      severity: 'error',
      message: 'Commissioned load exceeds the planned build-out.',
      rule: 'dc_capacity.critical_it_load_kw <= dc_capacity.planned_it_load_kw',
    },
    {
      // A warning, not an error: pre-leasing future phases is the normal
      // hyperscale shape. The number is not wrong; it is a schedule question.
      code: 'CC-MOD-DC-04',
      severity: 'warning',
      message:
        'Contracted load exceeds commissioned load — pre-leased phases; confirm the delivery schedule and any rent-commencement gaps.',
      rule: 'dc_capacity.contracted_it_load_kw <= dc_capacity.critical_it_load_kw',
    },
    {
      // Likewise: a pending utility upgrade is a cost line, not a defect.
      code: 'CC-MOD-DC-05',
      severity: 'warning',
      message:
        'Utility feed is below the facility load at design PUE — confirm the utility upgrade, its cost, and its date.',
      rule: 'facility_load_kw <= dc_capacity.utility_feed_kw',
    },
    {
      code: 'CC-MOD-DC-06',
      severity: 'warning',
      message:
        'Measured PUE more than 15% above design — the power pass-through economics are not what the design assumed.',
      rule: 'dc_capacity.measured_pue == null || dc_capacity.measured_pue <= dc_capacity.design_pue * 1.15',
    },
    {
      code: 'CC-MOD-DC-07',
      severity: 'warning',
      message: 'Contracted rent more than 15% below market — verify the comp set or the lease vintage.',
      // The null guard is not decoration: without it every data center
      // without a comp set would carry a permanent below-market warning.
      rule: 'dc_revenue.market_rent_per_kw_month == null || rent_index >= 0.85',
    },
  ],

  view_models: [...DATA_CENTER_VIEW_MODELS],
};

// Frozen at the boundary rather than inline: `Object.freeze` on an object
// literal widens every field to its readonly form BEFORE the annotation is
// checked, and the manifest stops type-checking against `ModuleManifest`.
// Annotate, then freeze.
export const DATA_CENTER_MODULE: ModuleManifest = Object.freeze(MANIFEST);
