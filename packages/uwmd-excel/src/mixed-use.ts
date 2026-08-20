// Mixed-use workbook layout (RFC 0019, §4.23).
//
// A mixed-use property is two or more uses under one purchase price and one
// loan, so it does not fit the single-operating-statement shape every other
// class uses. The `components` section states each use's own subtotals (EGI,
// operating expenses, NOI) and — where the use defines one — an intensive
// denominator (units / rentable SF / beds) and an operating-business
// intermediate (a hotel's gross operating profit, a senior facility's labor).
//
// This module is layout-only. The derived-metric formulas are MIXED_USE_PACK's,
// emitted by the engine against the named ranges this layout implies. Because a
// mixed-use document carries only the components its property actually has, the
// engine emits a metric row only when that metric evaluates non-null for the
// deal (an absent use, or an un-allocated intensive, contributes no row) — so
// the workbook's rows track exactly what the calc engine reports, by
// construction. See `toWorkbook.ts` for the per-component-statement writer.

import { MIXED_USE_PACK } from '@uwmd/core';
import type { WorkbookLayout, MixedUseComponentSpec } from './layout.js';

/**
 * The admissible component uses, in display order. Every income class whose NOI
 * is directly additive on the standard `EGI − total_operating_expenses` basis
 * (RFC 0019 §2/§3a) — all nine except `land`. `denom` mirrors the pack's
 * use-level intensive (`multifamily_price_per_unit` → `total_units`,
 * `<class>_price_psf` → `nra_sqft`, `student_housing_price_per_bed` →
 * `total_beds`); `intermediate` mirrors the per-component pass-through
 * (`hospitality_gross_operating_profit`, `senior_housing_total_labor_expense`).
 */
export const MIXED_USE_COMPONENT_SPECS: readonly MixedUseComponentSpec[] = [
  {
    componentClass: 'multifamily',
    label: 'Multifamily',
    denom: { field: 'total_units', label: 'Units' },
  },
  {
    componentClass: 'retail',
    label: 'Retail',
    denom: { field: 'nra_sqft', label: 'Rentable SF' },
  },
  {
    componentClass: 'office',
    label: 'Office',
    denom: { field: 'nra_sqft', label: 'Rentable SF' },
  },
  {
    componentClass: 'industrial',
    label: 'Industrial',
    denom: { field: 'nra_sqft', label: 'Rentable SF' },
  },
  {
    componentClass: 'self_storage',
    label: 'Self-Storage',
    denom: { field: 'nra_sqft', label: 'Rentable SF' },
  },
  {
    componentClass: 'hospitality',
    label: 'Hospitality',
    intermediate: { field: 'gross_operating_profit', label: 'Gross Operating Profit' },
  },
  {
    componentClass: 'senior_housing',
    label: 'Senior Housing',
    intermediate: { field: 'total_labor_expense', label: 'Total Labor Expense' },
  },
  {
    componentClass: 'student_housing',
    label: 'Student Housing',
    denom: { field: 'total_beds', label: 'Beds' },
  },
];

/** Property-level named ranges the pack's non-component metrics read. */
export const MIXED_USE_PROPERTY_PATHS: readonly string[] = [
  'noi_model.net_operating_income',
  'valuation.purchase_price',
  'debt_structure.loan_amount',
  'debt_structure.annual_debt_service',
  'sources_uses.sources.equity_sponsor',
];

/**
 * Sanitize a dotted field path into an Excel-safe workbook-scope name
 * (`components.retail.net_operating_income` → `components_retail_net_operating_income`).
 * The engine names every cell it writes this way and emits the pack's formulas
 * against the same map, so the named ranges and the formulas cannot drift.
 */
export function mixedUseName(path: string): string {
  return path.replace(/\./g, '_');
}

/**
 * Every field path the pack could reference, mapped to its workbook-scope name.
 * Passed to `emitCalcExcelFormula`; a formula for an absent use simply never
 * gets emitted, so the extra keys for absent uses are harmless.
 */
export function buildMixedUseNamedRangeMap(): Map<string, string> {
  const paths: string[] = [...MIXED_USE_PROPERTY_PATHS];
  for (const spec of MIXED_USE_COMPONENT_SPECS) {
    paths.push(`components.${spec.componentClass}.net_operating_income`);
    paths.push(`components.${spec.componentClass}.allocation_pct`);
    if (spec.denom) paths.push(`components.${spec.componentClass}.${spec.denom.field}`);
    if (spec.intermediate) {
      paths.push(`components.${spec.componentClass}.${spec.intermediate.field}`);
    }
  }
  return new Map(paths.map((p) => [p, mixedUseName(p)]));
}

export const MIXED_USE_LAYOUT: WorkbookLayout = {
  assetClass: 'mixed_use',
  pack: MIXED_USE_PACK,
  // Mixed-use has no single operating statement — each component carries its own
  // (see `mixedUse` below). The generic income/expense lists stay empty.
  incomeLines: [],
  expenseLines: [],
  namedInputs: [],
  mixedUse: { components: MIXED_USE_COMPONENT_SPECS },
};
