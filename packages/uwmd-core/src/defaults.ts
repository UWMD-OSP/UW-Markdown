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

const REGISTRY: Readonly<Record<string, AssetClassDefaults>> = Object.freeze({
  multifamily: MULTIFAMILY_DEFAULTS,
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
