import { describe, expect, it } from 'vitest';
import {
  MULTIFAMILY_DEFAULTS,
  getAssetClassDefaults,
  getDefaultRange,
  listDefaultedFields,
} from './defaults.js';

describe('defaults — MULTIFAMILY_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(MULTIFAMILY_DEFAULTS.asset_class).toBe('multifamily');
    expect(MULTIFAMILY_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(MULTIFAMILY_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default', () => {
    for (const [path, range] of Object.entries(MULTIFAMILY_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
    }
  });

  it('every entry has a citation (provenance is auditable)', () => {
    for (const [path, range] of Object.entries(MULTIFAMILY_DEFAULTS.fields)) {
      expect(range.citation, `${path}.citation`).toBeTruthy();
    }
  });

  it('every entry declares a unit', () => {
    for (const [path, range] of Object.entries(MULTIFAMILY_DEFAULTS.fields)) {
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 multifamily input set', () => {
    const expected = [
      'noi_model.expense_ratio',
      'rent_roll.vacancy_pct',
      'noi_model.rent_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.replacement_reserve_per_unit_y1',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(MULTIFAMILY_DEFAULTS.fields[path], path).toBeDefined();
    }
  });
});

describe('defaults — registry helpers', () => {
  it('getAssetClassDefaults returns the multifamily table', () => {
    const t = getAssetClassDefaults('multifamily');
    expect(t).toBe(MULTIFAMILY_DEFAULTS);
  });

  it('getAssetClassDefaults returns null for unregistered classes', () => {
    expect(getAssetClassDefaults('office')).toBeNull();
    expect(getAssetClassDefaults('not-a-real-class')).toBeNull();
  });

  it('getDefaultRange returns the field range', () => {
    const r = getDefaultRange('multifamily', 'noi_model.expense_ratio');
    expect(r?.central).toBe(0.4);
    expect(r?.unit).toBe('ratio');
  });

  it('getDefaultRange returns null for unknown field', () => {
    expect(getDefaultRange('multifamily', 'no.such.field')).toBeNull();
    expect(getDefaultRange('office', 'noi_model.expense_ratio')).toBeNull();
  });

  it('listDefaultedFields enumerates the table keys', () => {
    const paths = listDefaultedFields('multifamily');
    expect(paths.length).toBe(Object.keys(MULTIFAMILY_DEFAULTS.fields).length);
    expect(paths).toContain('debt_structure.ltv_pct');
    expect(listDefaultedFields('office')).toEqual([]);
  });
});
