// Shared workbook-layout types + helpers.
//
// A `WorkbookLayout` is the per-asset-class description of how a parsed .uw.md
// becomes an .xlsx: which operating-statement lines to show, which fields become
// workbook-scope named ranges, and which calc pack drives the derived metrics.
// The generic engine in `toWorkbook.ts` consumes a layout; it has no
// asset-class knowledge of its own.
//
// Calc-integrity rule: every named range resolves to a cell holding the same
// value `evaluateCalc()` reads, so the workbook's metrics equal the calc
// engine's to the penny. The operating statement is built so that
// `EGI = SUM(signed income lines)` and `NOI = EGI − total opex` both foot to the
// stored `effective_gross_income` / `net_operating_income`.

import { emitCalcExcelFormula, getSizeIntensive } from '@uwmd/core';
import type { ModuleManifest, ModuleCalcDecl } from '@uwmd/core';

/** An operating-statement income line. */
export interface IncomeLine {
  label: string;
  /** Dot-path inside `noi_model.income` for the value. */
  path: string;
  /** +1 for revenue, -1 for a deduction (vacancy, concessions, loss-to-lease). Default +1. */
  sign?: 1 | -1;
  /** Optional workbook-scope named range placed at this line's cell. */
  name?: string;
}

/** An operating-statement expense line. */
export interface ExpenseLine {
  label: string;
  /** Dot-path inside `noi_model.expenses` for the value. */
  path: string;
  /** Optional workbook-scope named range placed at this line's cell. */
  name?: string;
}

/** A user-editable input that surfaces as a named range on the Underwriting sheet. */
export interface NamedInput {
  /** Workbook-scope name (`purchase_price`, etc.). */
  name: string;
  label: string;
  /** Source field path on the parsed UW file. */
  source: { section: string; path: string };
  format: 'currency' | 'count';
}

/**
 * The size-intensive named inputs for one asset class, selected through the
 * Protocol §XIII registry (RFC 0027) instead of hard-coded per layout. The
 * label map is the layout's only local knowledge: a path appears in the sheet
 * exactly when the layout names it (student and senior housing each omit the
 * secondary count their pack never reads), in registry order — primary first.
 * `mixed_use` has no entry (§XIII.2) and contributes no inputs.
 */
export function sizeNamedInputs(
  assetClass: string,
  labels: Readonly<Record<string, string>>,
): NamedInput[] {
  const entry = getSizeIntensive(assetClass);
  if (!entry) return [];
  return [entry.path, ...entry.secondary]
    .filter((path) => path in labels)
    .map((path) => ({
      name: path,
      label: labels[path]!,
      source: { section: 'property', path },
      format: 'count' as const,
    }));
}

/** A derived metric, resolved from the calc pack at build time. */
export interface DerivedMetric {
  id: string;
  label: string;
  /** Excel formula, leading "=" included. */
  formula: string;
  format: 'percent' | 'ratio' | 'currency' | 'count';
}

/**
 * One use's slot in a mixed-use workbook (RFC 0019). Each present component
 * gets its own footing operating-statement block; `denom` is the intensive
 * denominator the pack divides by (units / rentable SF / beds) and `intermediate`
 * is the operating-business subtotal surfaced per component (a hotel's GOP, a
 * senior facility's labor) — never blended into one property figure (§3a).
 */
export interface MixedUseComponentSpec {
  /** Component asset class; also the `components` map key it reads. */
  componentClass: string;
  label: string;
  /** The use-level intensive denominator, if the pack defines one. */
  denom?: { field: string; label: string };
  /** The operating-business intermediate the pack passes through, if any. */
  intermediate?: { field: string; label: string };
}

/**
 * The mixed-use extension of a `WorkbookLayout`. Its presence is what tells the
 * engine to emit per-component operating statements plus a consolidation block
 * instead of the single-statement shape every other class uses.
 */
export interface MixedUseLayoutSpec {
  /** Admissible component uses, in display order. */
  components: readonly MixedUseComponentSpec[];
}

/** The full per-asset-class workbook layout. */
export interface WorkbookLayout {
  assetClass: string;
  /** The calc pack whose calculations become the derived-metrics block. */
  pack: ModuleManifest;
  incomeLines: readonly IncomeLine[];
  expenseLines: readonly ExpenseLine[];
  namedInputs: readonly NamedInput[];
  /**
   * Present only for `mixed_use`. When set, the engine builds the workbook from
   * per-component statements + a consolidation block (RFC 0019), and metrics are
   * emitted per deal (a component absent from the document contributes no rows).
   */
  mixedUse?: MixedUseLayoutSpec;
}

/** Standard named ranges for the operating-statement subtotals. */
export const SUBTOTAL_RANGES = {
  egi: 'effective_gross_income',
  opex: 'total_operating_expenses',
  noi: 'noi',
} as const;

/** Excel format keyed by a calc pack's unit string. */
export function excelFormatFor(unit: string | undefined): DerivedMetric['format'] {
  switch (unit) {
    case '%':
      return 'percent';
    case 'x':
      return 'ratio';
    case '$':
      return 'currency';
    default:
      return 'count';
  }
}

/**
 * Build the calc-path → workbook-named-range map for a layout. Derived from the
 * layout structure so the formulas emitted from it and the named ranges the
 * engine actually creates can never drift apart:
 *   - each NamedInput contributes `${section}.${path}` → name
 *   - the three operating-statement subtotals get their standard names
 *   - any income/expense line with a `name` contributes its nested path
 */
export function buildNamedRangeMap(layout: WorkbookLayout): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of layout.namedInputs) {
    m.set(`${i.source.section}.${i.source.path}`, i.name);
  }
  m.set('noi_model.income.effective_gross_income', SUBTOTAL_RANGES.egi);
  m.set('noi_model.expenses.total_operating_expenses', SUBTOTAL_RANGES.opex);
  m.set('noi_model.net_operating_income', SUBTOTAL_RANGES.noi);
  for (const l of layout.incomeLines) {
    if (l.name) m.set(`noi_model.income.${l.path}`, l.name);
  }
  for (const l of layout.expenseLines) {
    if (l.name) m.set(`noi_model.expenses.${l.path}`, l.name);
  }
  return m;
}

/**
 * Build the derived-metrics block by emitting an Excel formula for every calc in
 * the layout's pack against the layout's named-range map. Defining a metric in
 * `@uwmd/core`'s pack automatically surfaces it here.
 */
export function buildDerivedMetrics(layout: WorkbookLayout): DerivedMetric[] {
  const namedRanges = buildNamedRangeMap(layout);
  return (layout.pack.calculations ?? []).map((decl: ModuleCalcDecl) => ({
    id: decl.id,
    label: decl.label,
    // ROUND-wrapped at the declaration's effective round_to, so the cell holds
    // the same quantized number `evaluateCalc` reports (§VIII.5).
    formula: `=${emitCalcExcelFormula(decl, { namedRanges })}`,
    format: excelFormatFor(decl.unit),
  }));
}
