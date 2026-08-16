// Tier-3 Calc Host — public entry point.
// `evaluateCalc()` parses a calc declaration's formula, resolves variables
// against the CalcEvaluationContext, and returns a CalcResult per §VIII.

import { formatCurrency, formatPercent, formatRatio, formatValue } from '../format.js';
import type { CalcEvaluationContext, CalcResult, ModuleCalcDecl } from '../protocol.js';
import { CalcError } from './errors.js';
import { evaluate } from './evaluator.js';
import { parseExpression } from './parser.js';
import { quantizeDecimal, resolveRoundTo } from './quantize.js';

export { parseExpression } from './parser.js';
export { evaluate } from './evaluator.js';
export { BUILTINS } from './builtins.js';
export type { CalcValue, Builtin } from './builtins.js';
export { CalcError, calcError } from './errors.js';
export type { CalcErrorCode } from './errors.js';
export {
  quantizeDecimal,
  resolveRoundTo,
  DEFAULT_ROUND_TO,
  DEFAULT_ROUND_TO_BY_UNIT,
  MAX_ROUND_TO,
} from './quantize.js';

/**
 * Evaluate a single calculation declaration against a context.
 * Always returns a CalcResult — exceptions from the engine are captured
 * into the `error` field, never thrown.
 *
 * This is the **quantization boundary** (§VIII.5). Evaluation itself runs in
 * unrounded binary64; the value leaving here is quantized to the declaration's
 * effective `round_to`. Every consumer — receipts, the web editor, the CLI, the
 * Excel converter — reaches results through this function, which is what makes
 * one boundary sufficient.
 */
export function evaluateCalc(decl: ModuleCalcDecl, ctx: CalcEvaluationContext): CalcResult {
  const roundTo = resolveRoundTo(decl);
  try {
    const ast = parseExpression(decl.formula);
    const raw = evaluate(ast, ctx);
    const value = typeof raw === 'number' ? quantizeDecimal(raw, roundTo) : raw;

    return {
      calc_id: decl.id,
      ok: true,
      value: value as number | string | boolean | null,
      ...(decl.unit ? { unit: decl.unit } : {}),
      round_to: roundTo,
      display: formatForDisplay(value, decl.unit),
    };
  } catch (e) {
    const proto = e instanceof CalcError
      ? e.proto
      : { category: 'calc' as const, code: 'CALC-PARSE-001', message: e instanceof Error ? e.message : String(e) };
    return {
      calc_id: decl.id,
      ok: false,
      value: null,
      ...(decl.unit ? { unit: decl.unit } : {}),
      round_to: roundTo,
      error: proto,
    };
  }
}

function formatForDisplay(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return formatValue(null);
  if (typeof value !== 'number') return String(value);
  switch (unit) {
    case '%': return formatPercent(value);
    case '$': return formatCurrency(value);
    case 'x': return formatRatio(value);
    default:
      // Fall back to a fixed-decimal display.
      return Number.isInteger(value) ? value.toString() : value.toFixed(4);
  }
}
