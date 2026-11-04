import { describe, expect, it } from 'vitest';
import { deriveRentRoll } from './rentroll.js';

describe('RFC 0132 accepted occupancy rules', () => {
  it('keeps unknown physical occupancy unavailable instead of defaulting it to full occupancy', () => {
    const result = deriveRentRoll({ unit_mix_summary: [{ unit_type: '1BR', count: 10,
      avg_rent_inplace: 1000, avg_rent_market: 1100, occupancy_pct: null }] });
    expect(result.fields.find(field => field.path === 'physical_occupancy_pct')).toBeUndefined();
    expect(result).toHaveProperty('unavailable.physical_occupancy_pct');
  });

  it('keeps an explicitly occupied zero-rent suite physically occupied', () => {
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

it('uses collected rent and potential rent in one declared-period input group, independently of physical use', () => {
  const input = { rent_roll_type: 'commercial', total_rentable_sf: 1000, tenants: [{ status: 'occupied', leased_sf: 1000, annual_base_rent: 0 }], economic_occupancy_inputs: { rent_collected: 75, gross_potential_rent: 100 } };
  const before = structuredClone(input);
  const result = deriveRentRoll(input);
  expect(result.fields.find(f => f.path === 'physical_occupancy_pct')?.value).toBe(1);
  expect(result.fields.find(f => f.path === 'economic_occupancy_pct')?.value).toBe(0.75);
  expect(input).toEqual(before);
});
it('preserves zero collected rent and refuses unknown or nonpositive potential instead of substituting physical occupancy', () => {
  for (const [collected, potential, expected, reason] of [[0, 100, 0, undefined], [null, 100, undefined, 'missing_rent_collected'], [1, null, undefined, 'missing_gross_potential_rent'], [1, 0, undefined, 'nonpositive_gross_potential_rent'], [1, -10, undefined, 'nonpositive_gross_potential_rent'], ['1', 100, undefined, 'missing_rent_collected']] as const) {
    const result = deriveRentRoll({ economic_occupancy_inputs: { rent_collected: collected, gross_potential_rent: potential } });
    expect(result.fields.find(f => f.path === 'economic_occupancy_pct')?.value).toBe(expected);
    expect(result.unavailable?.economic_occupancy_pct).toBe(reason);
  }
});
it('does not infer physical use from positive rent when status is unknown', () => {
  const result = deriveRentRoll({ rent_roll_type: 'commercial', total_rentable_sf: 1000, tenants: [{ leased_sf: 1000, annual_base_rent: 12000 }] });
  expect(result.fields.find(f => f.path === 'physical_occupancy_pct')).toBeUndefined();
  expect(result.unavailable?.physical_occupancy_pct).toBe('unknown_tenant_status_or_area');
});
