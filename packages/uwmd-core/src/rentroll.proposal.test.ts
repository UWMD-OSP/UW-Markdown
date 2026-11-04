// RFC 0132 remains a proposal. These expected-failure gates are deliberately
// separate from current conformance and do not claim an economic formula.
import { describe, expect, it } from 'vitest';
import { deriveRentRoll } from './rentroll.js';

describe('RFC 0132 proposed occupancy acceptance gates', () => {
  it.fails('keeps unknown physical occupancy unavailable instead of defaulting it to full occupancy', () => {
    const result = deriveRentRoll({ unit_mix_summary: [{ unit_type: '1BR', count: 10,
      avg_rent_inplace: 1000, avg_rent_market: 1100, occupancy_pct: null }] });
    expect(result.fields.find(field => field.path === 'physical_occupancy_pct')).toBeUndefined();
    expect(result).toHaveProperty('unavailable.physical_occupancy_pct');
  });

  it.fails('keeps an explicitly occupied zero-rent suite physically occupied', () => {
    const result = deriveRentRoll({ rent_roll_type: 'commercial', total_rentable_sf: 1000,
      tenants: [{ tenant_name: 'Zero rent', leased_sf: 1000, annual_base_rent: 0, status: 'occupied' }] });
    expect(result.fields.find(field => field.path === 'occupied_sf')?.value).toBe(1000);
  });

  it('retains explicit zero physical occupancy as zero', () => {
    const result = deriveRentRoll({ unit_mix_summary: [{ unit_type: '1BR', count: 10,
      avg_rent_inplace: 1000, avg_rent_market: 1100, occupancy_pct: 0 }] });
    expect(result.fields.find(field => field.path === 'physical_occupancy_pct')?.value).toBe(0);
  });
});
