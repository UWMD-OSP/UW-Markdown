// Asset-class default tables — Protocol §V.7-§V.8
//
// Published normative defaults for the cascade resolver. Each entry is a
// {low, central, high} range so refinement/VOI consumers can quantify what's
// at stake before any document arrives.
//
// Bumping a default's range materially → bump table `version`.

import type { AssetClass } from './types.js';

export type DefaultUnit = 'percent' | 'currency' | 'ratio' | 'months' | 'count';

export interface DefaultRange {
  /** Lower bound of the published range. */
  low: number;
  /** Central / typical value used when a single scalar is needed. */
  central: number;
  /** Upper bound of the published range. */
  high: number;
  /** Unit of measure; informs renderer formatting and validators. */
  unit?: DefaultUnit;
  /** Always 'asset_class_default' for entries in this module. */
  source: 'asset_class_default';
  /** Format/Protocol spec reference for this default. */
  spec_ref?: string;
  /** Human-readable provenance (data vendor, publication, internal study). */
  citation?: string;
}

export interface AssetClassDefaults {
  asset_class: AssetClass | (string & {});
  /** Semver — bumps when ranges change materially. */
  version: string;
  /** Field paths use dot notation rooted at the file's section tree. */
  fields: Record<string, DefaultRange>;
}

/**
 * Multifamily asset-class defaults, v1.0.0.
 *
 * Ranges are deliberately wide enough to span most US primary/secondary markets
 * for stabilized garden / mid-rise product. They are intended for triage —
 * scope-stage VOI ranking — not for committee-grade underwriting.
 *
 * Citations name the canonical industry source; specific point values within
 * the range reflect a blend of published surveys and internal calibration.
 * Bump `version` when any low/central/high shifts beyond round-off.
 */
export const MULTIFAMILY_DEFAULTS: AssetClassDefaults = {
  asset_class: 'multifamily',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.34,
      central: 0.4,
      high: 0.46,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'NCREIF / IREM Income & Expense Survey (typical garden + mid-rise band)',
    },
    'rent_roll.vacancy_pct': {
      low: 0.04,
      central: 0.06,
      high: 0.1,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CoStar / RealPage US multifamily vacancy distribution',
    },
    'noi_model.rent_growth_pct_y1': {
      low: 0.02,
      central: 0.03,
      high: 0.05,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Yardi Matrix / CoStar trailing rent-growth bands',
    },
    'noi_model.management_fee_pct': {
      low: 0.025,
      central: 0.035,
      high: 0.045,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'IREM management fee survey (third-party fee on EGI)',
    },
    'noi_model.replacement_reserve_per_unit_y1': {
      low: 250,
      central: 300,
      high: 400,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'Agency (Fannie/Freddie) underwriting reserve floors',
    },
    'debt_structure.rate_pct': {
      low: 0.06,
      central: 0.067,
      high: 0.075,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Agency 5-7yr fixed quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard agency amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 60,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Agency IO availability range (0-5 yr)',
    },
    'debt_structure.ltv_pct': {
      low: 0.55,
      central: 0.65,
      high: 0.75,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Agency LTV envelope for stabilized multifamily',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.045,
      central: 0.055,
      high: 0.065,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / RCA US multifamily exit cap distribution',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, taxes)',
    },
  },
};

/**
 * Office asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized Class A/B suburban and CBD office. Ranges run wider
 * than multifamily — office cash flows are lumpier (lease rollover, TI/LC, longer
 * downtime) and pricing is more dispersed across markets and building class.
 * Like the multifamily table these are triage-grade (scope-stage VOI ranking),
 * not committee underwriting.
 *
 * Citations name the canonical industry source; specific point values within
 * the range reflect a blend of published surveys and internal calibration.
 * Bump `version` when any low/central/high shifts beyond round-off.
 */
export const OFFICE_DEFAULTS: AssetClassDefaults = {
  asset_class: 'office',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.38,
      central: 0.45,
      high: 0.52,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'BOMA / IREM Office Income & Expense (opex as share of EGI, gross basis)',
    },
    'rent_roll.vacancy_pct': {
      low: 0.08,
      central: 0.13,
      high: 0.2,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / JLL US office vacancy distribution (post-2023 structural band)',
    },
    'noi_model.rent_growth_pct_y1': {
      low: 0.0,
      central: 0.02,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE-EA / CoStar office asking-rent growth bands',
    },
    'noi_model.management_fee_pct': {
      low: 0.02,
      central: 0.03,
      high: 0.04,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'BOMA management fee survey (third-party fee on EGI)',
    },
    'noi_model.ti_allowance_psf_new': {
      low: 40,
      central: 65,
      high: 100,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'CBRE / CompStak tenant-improvement allowance, new leases ($/SF)',
    },
    'noi_model.ti_allowance_psf_renewal': {
      low: 15,
      central: 30,
      high: 50,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'CBRE / CompStak tenant-improvement allowance, renewals ($/SF)',
    },
    'noi_model.leasing_commission_pct': {
      low: 0.04,
      central: 0.06,
      high: 0.08,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Brokerage leasing-commission band (% of total lease value, new deals)',
    },
    'debt_structure.rate_pct': {
      low: 0.065,
      central: 0.075,
      high: 0.085,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CMBS / life-co office fixed quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard permanent office amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 12,
      high: 36,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Office IO availability range (0-3 yr, longer on bridge)',
    },
    'debt_structure.ltv_pct': {
      low: 0.5,
      central: 0.6,
      high: 0.68,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Office LTV envelope for stabilized assets (conservative post-2023)',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.065,
      central: 0.075,
      high: 0.09,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / RCA US office exit cap distribution',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, taxes)',
    },
  },
};

/**
 * Retail asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized grocery-anchored and neighborhood retail on a
 * predominantly NNN lease structure. The defining retail trait is expense
 * recovery: most operating expenses are reimbursed by tenants, so the *effective*
 * (unrecovered) expense ratio is low even though gross expenses are not. Triage
 * grade (scope-stage VOI ranking), not committee underwriting.
 *
 * Citations name the canonical industry source; specific point values within
 * the range reflect a blend of published surveys and internal calibration.
 * Bump `version` when any low/central/high shifts beyond round-off.
 */
export const RETAIL_DEFAULTS: AssetClassDefaults = {
  asset_class: 'retail',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.22,
      central: 0.3,
      high: 0.4,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'ICSC / NCREIF retail opex as share of EGI (net of NNN recoveries)',
    },
    'noi_model.expense_recovery_rate': {
      low: 0.7,
      central: 0.85,
      high: 0.95,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'NNN recovery rate — share of recoverable opex billed back to tenants',
    },
    'rent_roll.vacancy_pct': {
      low: 0.04,
      central: 0.07,
      high: 0.12,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CoStar / ICSC neighborhood & community center vacancy distribution',
    },
    'noi_model.rent_growth_pct_y1': {
      low: 0.01,
      central: 0.025,
      high: 0.04,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CoStar retail asking-rent growth bands (open-air centers)',
    },
    'noi_model.management_fee_pct': {
      low: 0.03,
      central: 0.04,
      high: 0.05,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'ICSC management fee survey (third-party fee on EGI)',
    },
    'noi_model.ti_allowance_psf_inline_new': {
      low: 20,
      central: 40,
      high: 70,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'CBRE / CompStak inline tenant-improvement allowance, new leases ($/SF)',
    },
    'noi_model.leasing_commission_pct': {
      low: 0.04,
      central: 0.05,
      high: 0.06,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Brokerage leasing-commission band (% of total lease value, retail)',
    },
    'debt_structure.rate_pct': {
      low: 0.06,
      central: 0.0675,
      high: 0.08,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CMBS / life-co retail fixed quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard permanent retail amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 24,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Retail IO availability range (0-2 yr on permanent debt)',
    },
    'debt_structure.ltv_pct': {
      low: 0.55,
      central: 0.62,
      high: 0.7,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Retail LTV envelope for stabilized, credit-anchored centers',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.065,
      central: 0.0725,
      high: 0.085,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / RCA US retail exit cap distribution (grocery-anchored)',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, taxes)',
    },
  },
};

/**
 * Industrial asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized Class A/B bulk-distribution and logistics product on
 * NNN leases. Industrial has the lowest effective expense ratio of the major
 * classes (cheap to operate, near-total expense recovery) and the tightest cap
 * rates. Triage grade (scope-stage VOI ranking), not committee underwriting.
 *
 * Citations name the canonical industry source; specific point values within
 * the range reflect a blend of published surveys and internal calibration.
 * Bump `version` when any low/central/high shifts beyond round-off.
 */
export const INDUSTRIAL_DEFAULTS: AssetClassDefaults = {
  asset_class: 'industrial',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.15,
      central: 0.22,
      high: 0.3,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'NAIOP / NCREIF industrial opex as share of EGI (net of NNN recoveries)',
    },
    'noi_model.expense_recovery_rate': {
      low: 0.85,
      central: 0.92,
      high: 0.98,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'NNN recovery rate — industrial leases recover near-all recoverable opex',
    },
    'rent_roll.vacancy_pct': {
      low: 0.03,
      central: 0.05,
      high: 0.09,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / Cushman US industrial vacancy distribution (big-box logistics)',
    },
    'noi_model.rent_growth_pct_y1': {
      low: 0.02,
      central: 0.035,
      high: 0.05,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE-EA / CoStar industrial asking-rent growth bands',
    },
    'noi_model.management_fee_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'NAIOP management fee survey (third-party fee on EGI, NNN)',
    },
    'noi_model.ti_allowance_psf_new': {
      low: 2,
      central: 5,
      high: 12,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'CBRE / CompStak warehouse tenant-improvement allowance, new leases ($/SF)',
    },
    'noi_model.leasing_commission_pct': {
      low: 0.04,
      central: 0.05,
      high: 0.06,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Brokerage leasing-commission band (% of total lease value, industrial)',
    },
    'debt_structure.rate_pct': {
      low: 0.058,
      central: 0.065,
      high: 0.075,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CMBS / life-co industrial fixed quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard permanent industrial amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 24,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Industrial IO availability range (0-2 yr on permanent debt)',
    },
    'debt_structure.ltv_pct': {
      low: 0.55,
      central: 0.62,
      high: 0.7,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Industrial LTV envelope for stabilized logistics assets',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.055,
      central: 0.065,
      high: 0.075,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CBRE / RCA US industrial exit cap distribution',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, taxes)',
    },
  },
};

/**
 * Self-storage asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized drive-up and climate-controlled storage facilities.
 * The key class-specific inputs are physical occupancy, economic occupancy,
 * and revenue per net rentable square foot. Triage grade (scope-stage VOI
 * ranking), not committee underwriting.
 */
export const SELF_STORAGE_DEFAULTS: AssetClassDefaults = {
  asset_class: 'self_storage',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.28,
      central: 0.34,
      high: 0.42,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'SSA / NAREIT self-storage operating expense bands',
    },
    'rent_roll.vacancy_pct': {
      low: 0.08,
      central: 0.12,
      high: 0.2,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Yardi Matrix / Radius+ self-storage physical vacancy distribution',
    },
    'rent_roll.economic_vacancy_pct': {
      low: 0.1,
      central: 0.15,
      high: 0.24,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Self-storage economic vacancy band including concessions and loss-to-lease',
    },
    'noi_model.rent_growth_pct_y1': {
      low: 0.01,
      central: 0.025,
      high: 0.045,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Yardi Matrix self-storage rent-growth bands',
    },
    'noi_model.management_fee_pct': {
      low: 0.04,
      central: 0.05,
      high: 0.06,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Third-party self-storage management fee band',
    },
    'noi_model.revenue_per_nrsf': {
      low: 10,
      central: 15,
      high: 22,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'Radius+ / Yardi Matrix annual revenue per occupied NRSF bands',
    },
    'debt_structure.rate_pct': {
      low: 0.0625,
      central: 0.07,
      high: 0.08,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CMBS / life-co self-storage fixed quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard permanent self-storage amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 24,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Self-storage IO availability range (0-2 yr on permanent debt)',
    },
    'debt_structure.ltv_pct': {
      low: 0.55,
      central: 0.65,
      high: 0.72,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Self-storage LTV envelope for stabilized assets',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.055,
      central: 0.065,
      high: 0.0775,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'RCA / Green Street self-storage cap-rate distribution',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.015,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, taxes)',
    },
  },
};

/**
 * Hospitality asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized, branded select-service and upscale hotels. The
 * key class-specific inputs are occupancy, ADR, RevPAR, the GOP margin, and the
 * franchise/management/FF&E load that sits between GOP and NOI. Hotels are
 * operating businesses, so the expense-ratio and cap-rate bands run materially
 * wider than for the lease-based classes. Triage grade (scope-stage VOI
 * ranking), not committee underwriting.
 */
export const HOSPITALITY_DEFAULTS: AssetClassDefaults = {
  asset_class: 'hospitality',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.64,
      central: 0.72,
      high: 0.8,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'STR / HOST full-year operating expense ratio bands, select-service hotels',
    },
    'noi_model.gop_margin': {
      low: 0.32,
      central: 0.4,
      high: 0.47,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'USALI gross operating profit margin band, branded select-service',
    },
    'rent_roll.occupancy': {
      low: 0.62,
      central: 0.72,
      high: 0.8,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'STR trailing-twelve occupancy distribution, US select-service',
    },
    'rent_roll.vacancy_pct': {
      low: 0.2,
      central: 0.28,
      high: 0.38,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Complement of the STR occupancy band',
    },
    'noi_model.adr_growth_pct_y1': {
      low: 0.0,
      central: 0.025,
      high: 0.05,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'STR / Tourism Economics ADR growth forecast bands',
    },
    'noi_model.management_fee_pct': {
      low: 0.025,
      central: 0.03,
      high: 0.04,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Third-party hotel management fee band (% of total revenue)',
    },
    'noi_model.franchise_fee_pct': {
      low: 0.06,
      central: 0.08,
      high: 0.11,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Brand royalty plus marketing/reservation fees (% of rooms revenue)',
    },
    'noi_model.ffe_reserve_pct': {
      low: 0.03,
      central: 0.04,
      high: 0.05,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Franchise-mandated FF&E reserve band (% of total revenue)',
    },
    'debt_structure.rate_pct': {
      low: 0.07,
      central: 0.0775,
      high: 0.0875,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'CMBS / debt-fund hospitality quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 240,
      central: 300,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Hospitality permanent amortization (20-30 yr; 25 yr most common)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 12,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Limited IO availability on stabilized hospitality permanent debt',
    },
    'debt_structure.ltv_pct': {
      low: 0.5,
      central: 0.6,
      high: 0.68,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Hospitality LTV envelope; lenders size tighter than lease-based classes',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.075,
      central: 0.0875,
      high: 0.1,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'RCA / HVS hospitality cap-rate distribution',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.02,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, franchise application)',
    },
  },
};

/**
 * Senior-housing asset-class defaults, v1.0.0.
 *
 * Calibrated for stabilized assisted-living and memory-care communities under
 * third-party management. Senior housing is an operating business with a heavy
 * labor load, so the expense-ratio band runs the widest of any class here and
 * the labor ratio is itself a defaulted input. Independent living sits toward
 * the low end of the expense and care bands; memory care toward the high end.
 * Triage grade (scope-stage VOI ranking), not committee underwriting.
 */
export const SENIOR_HOUSING_DEFAULTS: AssetClassDefaults = {
  asset_class: 'senior_housing',
  version: '1.0.0',
  fields: {
    'noi_model.expense_ratio': {
      low: 0.66,
      central: 0.75,
      high: 0.84,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'NIC MAP / state-of-seniors-housing operating expense ratio bands (AL/MC)',
    },
    'noi_model.labor_ratio': {
      low: 0.34,
      central: 0.42,
      high: 0.5,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'Labor (wages, benefits, contract) as a share of revenue, NIC MAP AL/MC',
    },
    'noi_model.care_revenue_ratio': {
      low: 0.12,
      central: 0.2,
      high: 0.3,
      unit: 'ratio',
      source: 'asset_class_default',
      citation: 'Level-of-care fees as a share of total revenue; higher for memory care',
    },
    'rent_roll.occupancy': {
      low: 0.8,
      central: 0.87,
      high: 0.93,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'NIC MAP stabilized seniors-housing occupancy distribution',
    },
    'rent_roll.vacancy_pct': {
      low: 0.07,
      central: 0.13,
      high: 0.2,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Complement of the NIC MAP occupancy band',
    },
    'noi_model.rate_growth_pct_y1': {
      low: 0.025,
      central: 0.04,
      high: 0.06,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'NIC MAP asking-rate growth; senior housing reprices annually at renewal',
    },
    'noi_model.wage_growth_pct_y1': {
      low: 0.03,
      central: 0.04,
      high: 0.055,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'BLS healthcare-support wage growth; the dominant expense driver',
    },
    'noi_model.management_fee_pct': {
      low: 0.04,
      central: 0.05,
      high: 0.06,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Third-party seniors-housing management fee band (% of total revenue)',
    },
    'noi_model.replacement_reserve_per_unit_y1': {
      low: 350,
      central: 500,
      high: 750,
      unit: 'currency',
      source: 'asset_class_default',
      citation: 'Agency / HUD seniors-housing reserve floors ($/unit/yr)',
    },
    'debt_structure.rate_pct': {
      low: 0.068,
      central: 0.0745,
      high: 0.085,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Agency (Fannie/Freddie seniors) and bank quote band, mid-2026 rate environment',
    },
    'debt_structure.amortization_months': {
      low: 300,
      central: 360,
      high: 360,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Standard seniors-housing amortization (25-30 yr)',
    },
    'debt_structure.io_months': {
      low: 0,
      central: 0,
      high: 24,
      unit: 'months',
      source: 'asset_class_default',
      citation: 'Seniors-housing IO availability range on stabilized permanent debt',
    },
    'debt_structure.ltv_pct': {
      low: 0.55,
      central: 0.62,
      high: 0.7,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Seniors-housing LTV envelope; agency sizes to DSCR and debt yield first',
    },
    'valuation.exit_cap_rate_pct': {
      low: 0.07,
      central: 0.08,
      high: 0.092,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'RCA / NIC seniors-housing cap-rate distribution (AL/MC)',
    },
    'sources_uses.closing_costs_pct': {
      low: 0.02,
      central: 0.025,
      high: 0.035,
      unit: 'percent',
      source: 'asset_class_default',
      citation: 'Acquisition closing cost band (title, legal, debt fees, licensure transfer)',
    },
  },
};

const REGISTRY: Readonly<Record<string, AssetClassDefaults>> = Object.freeze({
  multifamily: MULTIFAMILY_DEFAULTS,
  office: OFFICE_DEFAULTS,
  retail: RETAIL_DEFAULTS,
  industrial: INDUSTRIAL_DEFAULTS,
  self_storage: SELF_STORAGE_DEFAULTS,
  hospitality: HOSPITALITY_DEFAULTS,
  senior_housing: SENIOR_HOUSING_DEFAULTS,
});

/**
 * Look up the published defaults for an asset class. Returns null when no
 * table is registered (callers should fall through to `global_default` /
 * `system_default` per the cascade in protocol §V.7).
 */
export function getAssetClassDefaults(asset_class: string): AssetClassDefaults | null {
  return REGISTRY[asset_class] ?? null;
}

/**
 * Look up a single default range by `(asset_class, field_path)`. Returns null
 * if the asset class has no table or the field has no published default.
 */
export function getDefaultRange(asset_class: string, field_path: string): DefaultRange | null {
  const table = getAssetClassDefaults(asset_class);
  return table?.fields[field_path] ?? null;
}

/**
 * List the field paths for which an asset class publishes defaults. Useful for
 * the refinement engine to enumerate candidate inputs.
 */
export function listDefaultedFields(asset_class: string): string[] {
  const table = getAssetClassDefaults(asset_class);
  return table ? Object.keys(table.fields) : [];
}
