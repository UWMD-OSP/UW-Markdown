import { describe, it, expect } from 'vitest';
import { deriveRentRoll, rentRollVariant } from './rentroll.js';

function field(d: ReturnType<typeof deriveRentRoll>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

describe('rentRollVariant', () => {
  it('reads explicit rent_roll_type', () => {
    expect(rentRollVariant({ rent_roll_type: 'commercial' })).toBe('commercial');
    expect(rentRollVariant({ rent_roll_type: 'multifamily' })).toBe('multifamily');
  });
  it('infers commercial from a tenants array', () => {
    expect(rentRollVariant({ tenants: [] })).toBe('commercial');
  });
  it('defaults to multifamily', () => {
    expect(rentRollVariant({})).toBe('multifamily');
  });
});

describe('deriveRentRoll — multifamily from units[]', () => {
  const content = {
    rent_roll_type: 'multifamily',
    units: [
      { unit_type: '1BR', status: 'occupied', monthly_rent: 1000, market_rent: 1100, sqft: 700 },
      { unit_type: '1BR', status: 'occupied', monthly_rent: 1050, market_rent: 1100, sqft: 700 },
      { unit_type: '2BR', status: 'vacant', monthly_rent: null, market_rent: 1400, sqft: 950 },
      { unit_type: '2BR', status: 'occupied', monthly_rent: 1300, market_rent: 1400, sqft: 950 },
    ],
  };
  const d = deriveRentRoll(content);

  it('foots counts and occupancy', () => {
    expect(d.basis).toBe('units');
    expect(field(d, 'total_units')).toBe(4);
    expect(field(d, 'occupied_units')).toBe(3);
    expect(field(d, 'vacant_units')).toBe(1);
    expect(field(d, 'physical_occupancy_pct')).toBe(0.75);
  });

  it('sums GPR from market rent and in-place from paying units', () => {
    // GPR monthly = 1100+1100+1400+1400 = 5000
    expect(field(d, 'gross_potential_rent_monthly')).toBe(5000);
    expect(field(d, 'gross_potential_rent_annual')).toBe(60000);
    // In-place monthly = 1000+1050+0+1300 = 3350 (vacant pays nothing)
    expect(field(d, 'in_place_rent_monthly')).toBe(3350);
    expect(field(d, 'in_place_rent_annual')).toBe(40200);
    expect(field(d, 'loss_to_lease_monthly')).toBe(1650);
  });

  it('recomputes the unit-mix summary grouped by type', () => {
    expect(d.unit_mix_summary).toHaveLength(2);
    const oneBr = d.unit_mix_summary?.find((r) => r.unit_type === '1BR');
    expect(oneBr?.count).toBe(2);
    expect(oneBr?.avg_rent_inplace).toBe(1025);
    expect(oneBr?.occupancy_pct).toBe(1);
    const twoBr = d.unit_mix_summary?.find((r) => r.unit_type === '2BR');
    expect(twoBr?.count).toBe(2);
    expect(twoBr?.occupancy_pct).toBe(0.5);
  });
});

describe('deriveRentRoll — multifamily from unit_mix_summary[]', () => {
  const content = {
    rent_roll_type: 'multifamily',
    unit_mix_summary: [
      { unit_type: '1BR', count: 10, avg_rent_inplace: 1000, avg_rent_market: 1100, occupancy_pct: 0.9 },
      { unit_type: '2BR', count: 10, avg_rent_inplace: 1300, avg_rent_market: 1400, occupancy_pct: 1.0 },
    ],
  };
  const d = deriveRentRoll(content);

  it('falls back to footing the mix when there are no units', () => {
    expect(d.basis).toBe('unit_mix_summary');
    expect(field(d, 'total_units')).toBe(20);
    // GPR monthly = 10*1100 + 10*1400 = 25000
    expect(field(d, 'gross_potential_rent_monthly')).toBe(25000);
    // In-place monthly = 10*0.9*1000 + 10*1.0*1300 = 9000 + 13000 = 22000
    expect(field(d, 'in_place_rent_monthly')).toBe(22000);
    expect(field(d, 'physical_occupancy_pct')).toBe(0.95);
  });
});

describe('deriveRentRoll — commercial from tenants[]', () => {
  // Uses the worked-example naming (leased_sf / annual_base_rent).
  const content = {
    rent_roll_type: 'commercial',
    total_rentable_sf: 42500,
    occupied_sf: 0,
    vacant_sf: 0,
    occupancy_pct: 0,
    weighted_avg_rent_psf: 0,
    tenants: [
      { tenant_name: 'A', leased_sf: 9500, annual_base_rent: 209000, remaining_term_years: 1.3 },
      { tenant_name: 'B', leased_sf: 10000, annual_base_rent: 215000, remaining_term_years: 1.4 },
      { tenant_name: null, leased_sf: 0, vacant_sf: 11500, annual_base_rent: 0 },
    ],
  };
  const d = deriveRentRoll(content);

  it('foots leased/vacant SF and occupancy against total', () => {
    expect(d.basis).toBe('tenants');
    expect(field(d, 'occupied_sf')).toBe(19500);
    expect(field(d, 'vacant_sf')).toBe(23000); // 42500 - 19500
    expect(field(d, 'occupancy_pct')).toBeCloseTo(0.4588, 4);
  });

  it('sums in-place rent and rent PSF over leased tenants only', () => {
    expect(field(d, 'in_place_rent_annual')).toBe(424000);
    expect(field(d, 'weighted_avg_rent_psf')).toBeCloseTo(21.74, 2); // 424000 / 19500
  });

  it('computes rent-weighted WALT', () => {
    // (1.3*209000 + 1.4*215000) / 424000
    expect(field(d, 'weighted_avg_lease_term_years')).toBeCloseTo(1.3508, 3);
  });

  it('writes totals back to the spec naming when the block uses it', () => {
    const spec = deriveRentRoll({
      rent_roll_type: 'commercial',
      total_nra_sqft: 20000,
      leased_sqft: 0,
      in_place_rent_per_sqft: 0,
      tenants: [{ tenant_name: 'A', nra_sqft: 10000, base_rent_annual: 200000 }],
    });
    expect(field(spec, 'leased_sqft')).toBe(10000);
    expect(field(spec, 'in_place_rent_per_sqft')).toBe(20);
  });

  it('ranks tenant concentration by income', () => {
    expect(d.tenant_concentration?.[0]?.tenant_name).toBe('B');
    expect(d.tenant_concentration).toHaveLength(2); // vacant suite excluded
  });
});

describe('deriveRentRoll — empty', () => {
  it('returns basis "none" with no fields', () => {
    expect(deriveRentRoll({ rent_roll_type: 'multifamily' }).basis).toBe('none');
    expect(deriveRentRoll({ rent_roll_type: 'commercial', tenants: [] }).fields).toHaveLength(0);
  });
});
