// Multifamily workbook layout.
//
// Layout-only: which sections become which sheet rows, which inputs become
// workbook-scope named ranges. The derived-metric formulas themselves are
// NOT defined here — they come from MULTIFAMILY_PACK in @uwmd/core and are
// emitted as Excel syntax via `emitExcelFormula` at write time, so adding a
// metric only happens in one place.
//
// Layout shape:
//   - Sheet "Underwriting" — executive summary. Header (deal name / address)
//     + inputs block (named-range cells the user can edit) + derived metrics
//     block (formulas referencing those named ranges).
//   - Sheet "Operating Statement" — income/expense breakdown. Sub-totals are
//     formulas (=SUM of line items) so editing any line ripples through to
//     NOI, which the Underwriting sheet references via named range.
//   - Sheet "Pipeline Log" — flat audit table of every pipeline_log entry.
//
// Named ranges defined here are the workbook's *contract*: as long as a
// downstream sheet references `=cap_rate` or `=noi`, it can be reorganized
// without breaking the formulas.

import { MULTIFAMILY_PACK, emitExcelFormula } from '@uwmd/core';
import type { ModuleCalcDecl } from '@uwmd/core';

export interface IncomeLine {
  label: string;
  path: string;             // dot-path inside noi_model.income for the value
}

export interface ExpenseLine {
  label: string;
  path: string;             // dot-path inside noi_model.expenses for the value
}

export const INCOME_LINES: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent',   path: 'gross_potential_rent.value' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss.value' },
  { label: '(Less) Concessions',     path: 'concessions.value' },
  { label: '(Less) Loss to Lease',   path: 'loss_to_lease.value' },
  { label: 'Other Income',           path: 'other_income.value' },
];

export const EXPENSE_LINES: readonly ExpenseLine[] = [
  { label: 'Real Estate Taxes',      path: 'real_estate_taxes.value' },
  { label: 'Insurance',              path: 'insurance.value' },
  { label: 'Management Fees',        path: 'management_fees.value' },
  { label: 'Payroll & Benefits',     path: 'payroll_benefits.value' },
  { label: 'Utilities',              path: 'utilities.value' },
  { label: 'Repairs & Maintenance',  path: 'repairs_maintenance.value' },
  { label: 'Contract Services',      path: 'contract_services.value' },
  { label: 'Marketing & Advertising', path: 'marketing_advertising.value' },
  { label: 'Administrative',         path: 'administrative.value' },
  { label: 'Professional Fees',      path: 'professional_fees.value' },
  { label: 'Replacement Reserves',   path: 'replacement_reserves.value' },
];

/** Inputs the user can edit; each surfaces as a named range. */
export interface NamedInput {
  name: string;             // workbook-scope name (`purchase_price`, etc.)
  label: string;
  /** Source field path on the parsed UW file. */
  source: { section: string; path: string };
  format: 'currency' | 'count';
}

export const NAMED_INPUTS: readonly NamedInput[] = [
  { name: 'purchase_price',       label: 'Purchase Price',         source: { section: 'valuation',      path: 'purchase_price' },              format: 'currency' },
  { name: 'loan_amount',          label: 'Loan Amount',            source: { section: 'debt_structure', path: 'loan_amount' },                 format: 'currency' },
  { name: 'annual_debt_service',  label: 'Annual Debt Service',    source: { section: 'debt_structure', path: 'annual_debt_service' },         format: 'currency' },
  { name: 'total_units',          label: 'Total Units',            source: { section: 'property',       path: 'total_units' },                 format: 'count' },
  { name: 'total_nra_sqft',       label: 'Total NRA (sqft)',       source: { section: 'property',       path: 'total_nra_sqft' },              format: 'count' },
  { name: 'equity_sponsor',       label: 'Sponsor Equity',         source: { section: 'sources_uses',   path: 'sources.equity_sponsor' },      format: 'currency' },
];

/**
 * Map from calc-engine identifier path to workbook-scope named range. Built
 * from NAMED_INPUTS plus the implicit `noi` range that the Operating Statement
 * sheet creates. Consumed by emitExcelFormula() to translate a canonical
 * ModuleCalcDecl formula into Excel syntax.
 */
export const NAMED_RANGE_MAP: ReadonlyMap<string, string> = new Map<string, string>([
  ...NAMED_INPUTS.map((i): [string, string] => [`${i.source.section}.${i.source.path}`, i.name]),
  // Operating Statement sheet creates `noi` as the named range for the NOI cell.
  ['noi_model.net_operating_income', 'noi'],
]);

/** Excel format keyed by the canonical pack's unit. */
function excelFormatFor(unit: string | undefined): 'percent' | 'ratio' | 'currency' | 'count' {
  switch (unit) {
    case '%': return 'percent';
    case 'x': return 'ratio';
    case '$': return 'currency';
    default:  return 'count';
  }
}

/** A derived metric, resolved from the canonical pack at build time. */
export interface DerivedMetric {
  id: string;
  label: string;
  formula: string;          // Excel formula, leading "=" included
  format: 'percent' | 'ratio' | 'currency' | 'count';
}

/**
 * Derived metrics for the multifamily workbook. Built by emitting Excel
 * formulas for every calc in MULTIFAMILY_PACK — defining a new metric in
 * @uwmd/core's pack automatically surfaces it here.
 */
export const DERIVED_METRICS: readonly DerivedMetric[] =
  (MULTIFAMILY_PACK.calculations ?? []).map((decl: ModuleCalcDecl) => ({
    id: decl.id,
    label: decl.label,
    formula: `=${emitExcelFormula(decl.formula, { namedRanges: NAMED_RANGE_MAP })}`,
    format: excelFormatFor(decl.unit),
  }));
