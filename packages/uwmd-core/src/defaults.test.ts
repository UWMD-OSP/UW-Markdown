import { describe, expect, it } from 'vitest';
import {
  MULTIFAMILY_DEFAULTS,
  OFFICE_DEFAULTS,
  RETAIL_DEFAULTS,
  INDUSTRIAL_DEFAULTS,
  SELF_STORAGE_DEFAULTS,
  HOSPITALITY_DEFAULTS,
  SENIOR_HOUSING_DEFAULTS,
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

describe('defaults — OFFICE_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(OFFICE_DEFAULTS.asset_class).toBe('office');
    expect(OFFICE_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(OFFICE_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(OFFICE_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 office input set', () => {
    const expected = [
      'noi_model.expense_ratio',
      'rent_roll.vacancy_pct',
      'noi_model.rent_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.ti_allowance_psf_new',
      'noi_model.ti_allowance_psf_renewal',
      'noi_model.leasing_commission_pct',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(OFFICE_DEFAULTS.fields[path], path).toBeDefined();
    }
  });
});

describe('defaults — RETAIL_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(RETAIL_DEFAULTS.asset_class).toBe('retail');
    expect(RETAIL_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(RETAIL_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(RETAIL_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 retail input set incl. NNN recovery rate', () => {
    const expected = [
      'noi_model.expense_ratio',
      'noi_model.expense_recovery_rate',
      'rent_roll.vacancy_pct',
      'noi_model.rent_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.ti_allowance_psf_inline_new',
      'noi_model.leasing_commission_pct',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(RETAIL_DEFAULTS.fields[path], path).toBeDefined();
    }
  });
});

describe('defaults — INDUSTRIAL_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(INDUSTRIAL_DEFAULTS.asset_class).toBe('industrial');
    expect(INDUSTRIAL_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(INDUSTRIAL_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(INDUSTRIAL_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 industrial input set incl. NNN recovery rate', () => {
    const expected = [
      'noi_model.expense_ratio',
      'noi_model.expense_recovery_rate',
      'rent_roll.vacancy_pct',
      'noi_model.rent_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.ti_allowance_psf_new',
      'noi_model.leasing_commission_pct',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(INDUSTRIAL_DEFAULTS.fields[path], path).toBeDefined();
    }
  });
});

describe('defaults — SELF_STORAGE_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(SELF_STORAGE_DEFAULTS.asset_class).toBe('self_storage');
    expect(SELF_STORAGE_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(SELF_STORAGE_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(SELF_STORAGE_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 self-storage input set', () => {
    const expected = [
      'noi_model.expense_ratio',
      'rent_roll.vacancy_pct',
      'rent_roll.economic_vacancy_pct',
      'noi_model.rent_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.revenue_per_nrsf',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(SELF_STORAGE_DEFAULTS.fields[path], path).toBeDefined();
    }
  });
});

describe('defaults — HOSPITALITY_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(HOSPITALITY_DEFAULTS.asset_class).toBe('hospitality');
    expect(HOSPITALITY_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(HOSPITALITY_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(HOSPITALITY_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 hospitality input set', () => {
    const expected = [
      'noi_model.expense_ratio',
      'noi_model.gop_margin',
      'rent_roll.occupancy',
      'rent_roll.vacancy_pct',
      'noi_model.adr_growth_pct_y1',
      'noi_model.management_fee_pct',
      'noi_model.franchise_fee_pct',
      'noi_model.ffe_reserve_pct',
      'debt_structure.rate_pct',
      'debt_structure.amortization_months',
      'debt_structure.io_months',
      'debt_structure.ltv_pct',
      'valuation.exit_cap_rate_pct',
      'sources_uses.closing_costs_pct',
    ];
    for (const path of expected) {
      expect(HOSPITALITY_DEFAULTS.fields[path], path).toBeDefined();
    }
  });

  it('occupancy and vacancy bands are complementary', () => {
    const occ = HOSPITALITY_DEFAULTS.fields['rent_roll.occupancy']!;
    const vac = HOSPITALITY_DEFAULTS.fields['rent_roll.vacancy_pct']!;
    expect(occ.central + vac.central).toBeCloseTo(1, 6);
  });
});

describe('defaults — SENIOR_HOUSING_DEFAULTS', () => {
  it('declares asset_class and version', () => {
    expect(SENIOR_HOUSING_DEFAULTS.asset_class).toBe('senior_housing');
    expect(SENIOR_HOUSING_DEFAULTS.version).toBe('1.0.0');
  });

  it('every entry satisfies low <= central <= high', () => {
    for (const [path, range] of Object.entries(SENIOR_HOUSING_DEFAULTS.fields)) {
      expect(range.low, `${path}.low`).toBeLessThanOrEqual(range.central);
      expect(range.central, `${path}.central`).toBeLessThanOrEqual(range.high);
    }
  });

  it('every entry stamps source = asset_class_default with a citation and unit', () => {
    for (const [path, range] of Object.entries(SENIOR_HOUSING_DEFAULTS.fields)) {
      expect(range.source, `${path}.source`).toBe('asset_class_default');
      expect(range.citation, `${path}.citation`).toBeTruthy();
      expect(range.unit, `${path}.unit`).toBeDefined();
    }
  });

  it('covers the v1.0 senior-housing input set', () => {
    const expected = [
      'noi_model.expense_ratio',
      'noi_model.labor_ratio',
      'noi_model.care_revenue_ratio',
      'rent_roll.occupancy',
      'rent_roll.vacancy_pct',
      'noi_model.rate_growth_pct_y1',
      'noi_model.wage_growth_pct_y1',
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
      expect(SENIOR_HOUSING_DEFAULTS.fields[path], path).toBeDefined();
    }
  });

  it('occupancy and vacancy bands are complementary', () => {
    const occ = SENIOR_HOUSING_DEFAULTS.fields['rent_roll.occupancy']!;
    const vac = SENIOR_HOUSING_DEFAULTS.fields['rent_roll.vacancy_pct']!;
    expect(occ.central + vac.central).toBeCloseTo(1, 6);
  });

  it('labor is the dominant expense — the labor band sits inside the expense band', () => {
    const labor = SENIOR_HOUSING_DEFAULTS.fields['noi_model.labor_ratio']!;
    const opex = SENIOR_HOUSING_DEFAULTS.fields['noi_model.expense_ratio']!;
    expect(labor.central).toBeLessThan(opex.central);
    expect(labor.high).toBeLessThanOrEqual(opex.high);
  });
});

describe('defaults — registry helpers', () => {
  it('getAssetClassDefaults returns the multifamily table', () => {
    const t = getAssetClassDefaults('multifamily');
    expect(t).toBe(MULTIFAMILY_DEFAULTS);
  });

  it('getAssetClassDefaults returns the office table', () => {
    const t = getAssetClassDefaults('office');
    expect(t).toBe(OFFICE_DEFAULTS);
  });

  it('getAssetClassDefaults returns the retail table', () => {
    const t = getAssetClassDefaults('retail');
    expect(t).toBe(RETAIL_DEFAULTS);
  });

  it('getAssetClassDefaults returns the industrial table', () => {
    const t = getAssetClassDefaults('industrial');
    expect(t).toBe(INDUSTRIAL_DEFAULTS);
  });

  it('getAssetClassDefaults returns the self-storage table', () => {
    const t = getAssetClassDefaults('self_storage');
    expect(t).toBe(SELF_STORAGE_DEFAULTS);
  });

  it('getAssetClassDefaults returns the hospitality table', () => {
    const t = getAssetClassDefaults('hospitality');
    expect(t).toBe(HOSPITALITY_DEFAULTS);
  });

  it('getAssetClassDefaults returns the senior-housing table', () => {
    const t = getAssetClassDefaults('senior_housing');
    expect(t).toBe(SENIOR_HOUSING_DEFAULTS);
  });

  it('getAssetClassDefaults returns null for unregistered classes', () => {
    expect(getAssetClassDefaults('student_housing')).toBeNull();
    expect(getAssetClassDefaults('not-a-real-class')).toBeNull();
  });

  it('getDefaultRange returns the field range', () => {
    const r = getDefaultRange('multifamily', 'noi_model.expense_ratio');
    expect(r?.central).toBe(0.4);
    expect(r?.unit).toBe('ratio');

    const o = getDefaultRange('office', 'debt_structure.ltv_pct');
    expect(o?.central).toBe(0.6);
    expect(o?.unit).toBe('percent');

    const re = getDefaultRange('retail', 'noi_model.expense_recovery_rate');
    expect(re?.central).toBe(0.85);
    expect(re?.unit).toBe('percent');

    const ind = getDefaultRange('industrial', 'valuation.exit_cap_rate_pct');
    expect(ind?.central).toBe(0.065);
    expect(ind?.unit).toBe('percent');

    const ss = getDefaultRange('self_storage', 'rent_roll.economic_vacancy_pct');
    expect(ss?.central).toBe(0.15);
    expect(ss?.unit).toBe('percent');

    const hosp = getDefaultRange('hospitality', 'noi_model.gop_margin');
    expect(hosp?.central).toBe(0.4);
    expect(hosp?.unit).toBe('ratio');

    const sh = getDefaultRange('senior_housing', 'noi_model.labor_ratio');
    expect(sh?.central).toBe(0.42);
    expect(sh?.unit).toBe('ratio');
  });

  it('getDefaultRange returns null for unknown field', () => {
    expect(getDefaultRange('multifamily', 'no.such.field')).toBeNull();
    expect(getDefaultRange('student_housing', 'noi_model.expense_ratio')).toBeNull();
  });

  it('listDefaultedFields enumerates the table keys', () => {
    const paths = listDefaultedFields('multifamily');
    expect(paths.length).toBe(Object.keys(MULTIFAMILY_DEFAULTS.fields).length);
    expect(paths).toContain('debt_structure.ltv_pct');

    const officePaths = listDefaultedFields('office');
    expect(officePaths.length).toBe(Object.keys(OFFICE_DEFAULTS.fields).length);
    expect(officePaths).toContain('noi_model.ti_allowance_psf_new');

    const retailPaths = listDefaultedFields('retail');
    expect(retailPaths.length).toBe(Object.keys(RETAIL_DEFAULTS.fields).length);
    expect(retailPaths).toContain('noi_model.expense_recovery_rate');

    const industrialPaths = listDefaultedFields('industrial');
    expect(industrialPaths.length).toBe(Object.keys(INDUSTRIAL_DEFAULTS.fields).length);
    expect(industrialPaths).toContain('noi_model.expense_recovery_rate');

    const selfStoragePaths = listDefaultedFields('self_storage');
    expect(selfStoragePaths.length).toBe(Object.keys(SELF_STORAGE_DEFAULTS.fields).length);
    expect(selfStoragePaths).toContain('rent_roll.economic_vacancy_pct');

    const hospitalityPaths = listDefaultedFields('hospitality');
    expect(hospitalityPaths.length).toBe(Object.keys(HOSPITALITY_DEFAULTS.fields).length);
    expect(hospitalityPaths).toContain('noi_model.gop_margin');

    const seniorHousingPaths = listDefaultedFields('senior_housing');
    expect(seniorHousingPaths.length).toBe(Object.keys(SENIOR_HOUSING_DEFAULTS.fields).length);
    expect(seniorHousingPaths).toContain('noi_model.labor_ratio');

    expect(listDefaultedFields('student_housing')).toEqual([]);
  });
});
