// Display layout for the three sections this module contributes.
//
// Typed `SectionViewModel[]` rather than free-form objects in the manifest, for
// the RFC 0006 reason: a typo in `kind` in a hand-authored manifest survives to
// production and renders a currency as a ratio. Here it is a compile error.
//
// Units on screen follow the wire: every power figure is kW. The market quotes
// capacity in MW and rent in $/kW/month; a host that wants MW divides, but the
// module never stores a mixed unit (RFC 0039 alternative 3).

import type { SectionViewModel } from '@uwmd/core';

export const DATA_CENTER_VIEW_MODELS: readonly SectionViewModel[] = Object.freeze([
  {
    section_id: 'dc_capacity',
    display_name: 'Capacity & Topology',
    display_order: 30,
    description:
      'The kilowatts — commissioned, planned, contracted, and available at the meter — plus the efficiency and redundancy facts that price them.',
    primary_fields: [
      { path: 'critical_it_load_kw', label: 'Critical IT Load (kW)', kind: 'count', primary: true },
      { path: 'contracted_it_load_kw', label: 'Contracted Load (kW)', kind: 'count', primary: true },
      { path: 'design_pue', label: 'Design PUE', kind: 'ratio', primary: true, decimals: 2 },
      { path: 'redundancy', label: 'Redundancy', kind: 'enum', primary: true },
    ],
    detail_fields: [
      { path: 'planned_it_load_kw', label: 'Planned Load (kW)', kind: 'count' },
      { path: 'utility_feed_kw', label: 'Utility Feed (kW)', kind: 'count' },
      { path: 'measured_pue', label: 'Measured PUE', kind: 'ratio', decimals: 2 },
      { path: 'raised_floor_sf', label: 'Raised Floor (SF)', kind: 'count' },
      { path: 'design_density_kw_per_rack', label: 'Design Density (kW/rack)', kind: 'ratio', decimals: 1 },
    ],
  },
  {
    section_id: 'dc_power',
    display_name: 'Power Economics',
    display_order: 31,
    description:
      'What power costs and how it is billed to tenants — the terms that decide whether the operating margin is 60% or 20%.',
    primary_fields: [
      { path: 'utility_rate_per_kwh', label: 'Utility Rate ($/kWh)', kind: 'currency', primary: true, decimals: 4 },
      { path: 'billing', label: 'Power Billing', kind: 'enum', primary: true },
    ],
    detail_fields: [
      { path: 'power_margin', label: 'Landlord Power Margin', kind: 'percent', decimals: 2 },
      { path: 'stated_annual_power_cost', label: 'Stated Annual Power Cost', kind: 'currency', decimals: 0 },
    ],
  },
  {
    section_id: 'dc_revenue',
    display_name: 'Revenue',
    display_order: 32,
    description:
      'Rent per kW-month on the contracted load, the ancillary lines, and the comp rent the contract is measured against.',
    primary_fields: [
      { path: 'rent_per_kw_month', label: 'Rent ($/kW/mo)', kind: 'currency', primary: true, decimals: 2 },
      { path: 'lease_type', label: 'Lease Type', kind: 'enum', primary: true },
    ],
    detail_fields: [
      { path: 'market_rent_per_kw_month', label: 'Market Rent ($/kW/mo)', kind: 'currency', decimals: 2 },
      { path: 'interconnection_revenue_annual', label: 'Interconnection Revenue', kind: 'currency', decimals: 0 },
      { path: 'services_revenue_annual', label: 'Services Revenue', kind: 'currency', decimals: 0 },
    ],
  },
]);
