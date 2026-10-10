// RFC 0068: sites are the denominator; pad and home rents remain separate.
import type { SectionViewModel } from '@uwmd/core';

export const MANUFACTURED_HOUSING_VIEW_MODELS: readonly SectionViewModel[] = Object.freeze([
  {
    section_id: 'mhc_sites',
    display_name: 'Manufactured Housing Sites',
    display_order: 30,
    description: 'Stated site inventory and monthly pad/home rents as of the source date.',
    primary_fields: [
      { path: 'total_sites', label: 'Total Sites', kind: 'count', primary: true },
      { path: 'occupied_sites', label: 'Occupied Sites', kind: 'count', primary: true },
      { path: 'weighted_pad_rent_monthly', label: 'Pad Rent ($/site/month)', kind: 'currency', decimals: 2, primary: true },
    ],
    detail_fields: [
      { path: 'park_owned_homes', label: 'Park-Owned Homes', kind: 'count' },
      { path: 'poh_home_rent_monthly', label: 'Home Rent ($/home/month)', kind: 'currency', decimals: 2 },
      { path: 'as_of_date', label: 'As of Date', kind: 'date' },
    ],
  },
]);
