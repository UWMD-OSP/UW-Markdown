// Sensitivity tables (protocol §VIII.7, RFC 0007).
//
// A two-axis grid: one base formula, evaluated once per (row, column) pair
// with the two axis variables overridden. The thing every underwriter builds
// by hand in Excel, and the single most-requested calc capability after the
// basic ratios.
//
// **Declared, not a builtin.** RFC 0007 proposed
// `sensitivity_table(base_expr, {variable, values}, {variable, values})` as a
// function inside the §VIII.1 grammar. That grammar has no object literals and
// no array literals, and its `string` production is a value, not a program — so
// the proposal needs three grammar extensions, one of which makes a string
// argument executable. Widening a deliberately tiny sandbox that far, to reach
// data that is already sitting in JSON one level up, is the wrong trade.
//
// So the axes are a JSON *declaration* — which is where every other calc
// declaration already lives — and `base_formula` is an ordinary safe
// expression. The sandbox does not change at all. The grid is computed by
// `evaluateSensitivity`, which the Excel emitter and a calc-aware editor can
// both consume without re-deriving structure from calc-id naming conventions.
//
// **The result is its own type.** It never travels through `CalcResult.value`,
// which stays `number | string | boolean | null`. Receipts pin that union, the
// CLI renders it, and Excel emits from it; smuggling a grid through it would
// break all three for a feature none of them asked to carry.

import { evaluateCalc } from './index.js';
import { CalcError, type CalcErrorCode } from './errors.js';
import { MAX_ROUND_TO, resolveRoundTo } from './quantize.js';
import type { CalcEvaluationContext, CalcResult, ProtocolError } from '../protocol.js';

/** Hard ceiling on grid cells. RFC 0007's suggested bound. */
export const MAX_SENSITIVITY_CELLS = 256;
/** Hard ceiling per axis, so a 1x256 strip is refused as readily as 16x16. */
export const MAX_SENSITIVITY_AXIS = 64;

export interface SensitivityAxis {
  /**
   * The dotted path this axis varies, written exactly as an expression writes
   * it: `dcf.exit_cap_rate`, not `exit_cap_rate`.
   */
  variable: string;
  /** The values to sweep. At least two — a one-value axis is not an axis. */
  values: number[];
  /** Optional display label; defaults to `variable`. */
  label?: string;
}

export interface SensitivityDecl {
  id: string;
  label: string;
  /** An ordinary §VIII.1 safe expression. */
  base_formula: string;
  row_axis: SensitivityAxis;
  col_axis: SensitivityAxis;
  unit?: string;
  /** Decimal places each cell is quantized to (§VIII.5). */
  round_to?: number;
}

/** One cell: a value, or the error that stopped it. Never both. */
export type SensitivityCell =
  | { ok: true; value: number | string | boolean | null }
  | { ok: false; error: { code: string; message: string } };

export interface SensitivityResult {
  calc_id: string;
  ok: boolean;
  /** Present only when the declaration itself was unusable. */
  error?: ProtocolError;
  row_axis?: SensitivityAxis;
  col_axis?: SensitivityAxis;
  /** `grid[rowIndex][colIndex]`, matching the axes' declared order. */
  grid?: SensitivityCell[][];
  unit?: string;
  round_to?: number;
  /**
   * How many cells failed. A grid is `ok: true` with failed cells in it — a
   * table where one combination divides by zero is still a useful table, and
   * failing the whole thing would hide the 35 cells that worked.
   */
  failed_cells?: number;
}

function declError(id: string, code: CalcErrorCode, message: string, pointer: string): SensitivityResult {
  return {
    calc_id: id,
    ok: false,
    error: { category: 'calc', code, message, pointer },
  };
}

/**
 * Evaluate a sensitivity declaration into a grid.
 *
 * Total: a malformed declaration returns `ok: false` with a typed error rather
 * than throwing, matching `evaluateCalc`. A cell that fails is recorded in
 * place and does not stop the sweep.
 */
export function evaluateSensitivity(
  decl: SensitivityDecl,
  ctx: CalcEvaluationContext,
): SensitivityResult {
  const axisProblem =
    checkAxis(decl.id, decl.row_axis, 'row_axis') ?? checkAxis(decl.id, decl.col_axis, 'col_axis');
  if (axisProblem) return axisProblem;

  if (decl.row_axis.variable === decl.col_axis.variable) {
    // Both axes overriding one path means the second silently wins for every
    // cell, producing a grid whose rows are identical and whose reader has no
    // way to see why.
    return declError(
      decl.id,
      'CALC-SENS-004',
      `Both axes vary '${decl.row_axis.variable}'; a grid needs two different variables.`,
      'col_axis.variable',
    );
  }

  const cells = decl.row_axis.values.length * decl.col_axis.values.length;
  if (cells > MAX_SENSITIVITY_CELLS) {
    return declError(
      decl.id,
      'CALC-SENS-003',
      `Grid is ${decl.row_axis.values.length}x${decl.col_axis.values.length} = ${cells} cells; the limit is ${MAX_SENSITIVITY_CELLS}.`,
      'row_axis.values',
    );
  }

  if (decl.round_to !== undefined && (!Number.isInteger(decl.round_to) || decl.round_to < 0 || decl.round_to > MAX_ROUND_TO)) {
    return declError(
      decl.id,
      'CALC-SENS-005',
      `round_to must be an integer in [0, ${MAX_ROUND_TO}].`,
      'round_to',
    );
  }

  const roundTo = resolveRoundTo({
    ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
    ...(decl.round_to !== undefined ? { round_to: decl.round_to } : {}),
  });

  const grid: SensitivityCell[][] = [];
  let failed = 0;

  for (const rowValue of decl.row_axis.values) {
    const row: SensitivityCell[] = [];
    for (const colValue of decl.col_axis.values) {
      // Each cell is an independent `evaluateCalc` with two overrides layered
      // on the same context. Nothing is mutated: the document the caller passed
      // in is the document every cell reads, minus exactly two paths.
      const result: CalcResult = evaluateCalc(
        {
          id: decl.id,
          label: decl.label,
          formula: decl.base_formula,
          deterministic: true,
          ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
          round_to: roundTo,
        },
        {
          ...ctx,
          overrides: {
            ...ctx.overrides,
            [decl.row_axis.variable]: rowValue,
            [decl.col_axis.variable]: colValue,
          },
        },
      );

      if (result.ok) {
        row.push({ ok: true, value: result.value });
      } else {
        failed++;
        row.push({
          ok: false,
          error: {
            code: result.error?.code ?? 'CALC-UNKNOWN',
            message: result.error?.message ?? 'Cell evaluation failed.',
          },
        });
      }
    }
    grid.push(row);
  }

  return {
    calc_id: decl.id,
    ok: true,
    row_axis: decl.row_axis,
    col_axis: decl.col_axis,
    grid,
    ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
    round_to: roundTo,
    failed_cells: failed,
  };
}

function checkAxis(
  id: string,
  axis: SensitivityAxis | undefined,
  pointer: string,
): SensitivityResult | null {
  if (!axis || typeof axis !== 'object') {
    return declError(id, 'CALC-SENS-001', `${pointer} is missing.`, pointer);
  }
  if (typeof axis.variable !== 'string' || axis.variable.length === 0) {
    return declError(id, 'CALC-SENS-001', `${pointer}.variable must be a non-empty path.`, `${pointer}.variable`);
  }
  if (!Array.isArray(axis.values) || axis.values.length < 2) {
    // One value is not a sweep, and zero is not a table. Refusing here beats
    // returning a degenerate 1xN grid that every consumer then has to
    // special-case.
    return declError(id, 'CALC-SENS-002', `${pointer}.values must list at least two numbers.`, `${pointer}.values`);
  }
  if (axis.values.length > MAX_SENSITIVITY_AXIS) {
    return declError(
      id,
      'CALC-SENS-003',
      `${pointer}.values has ${axis.values.length} entries; the per-axis limit is ${MAX_SENSITIVITY_AXIS}.`,
      `${pointer}.values`,
    );
  }
  if (!axis.values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return declError(id, 'CALC-SENS-002', `${pointer}.values must be finite numbers.`, `${pointer}.values`);
  }
  return null;
}

/**
 * Narrow an unknown declaration, for hosts reading `custom_calculations`.
 *
 * A block that carries `row_axis` and `col_axis` is a sensitivity declaration;
 * one that carries `formula` is a scalar calc. The discriminator is structural
 * rather than a `type` field, because every existing calc block would have to
 * grow one otherwise.
 */
export function isSensitivityDecl(value: unknown): value is SensitivityDecl {
  return (
    typeof value === 'object' &&
    value !== null &&
    'base_formula' in value &&
    'row_axis' in value &&
    'col_axis' in value
  );
}

/** Rethrown as a typed error by callers that prefer exceptions. */
export function assertSensitivityOk(result: SensitivityResult): void {
  if (!result.ok) {
    throw new CalcError(
      (result.error?.code ?? 'CALC-SENS-001') as CalcErrorCode,
      result.error?.message ?? 'Sensitivity declaration is unusable.',
    );
  }
}
