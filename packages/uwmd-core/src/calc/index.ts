// Tier-3 Calc Host — public entry point.
// `evaluateCalc()` parses a calc declaration's formula, resolves variables
// against the CalcEvaluationContext, and returns a CalcResult per §VIII.

import { formatCurrency, formatPercent, formatRatio, formatValue } from '../format.js';
import type { CalcEvaluationContext, CalcResult, ModuleCalcDecl } from '../protocol.js';
import { CalcError } from './errors.js';
import { evaluate } from './evaluator.js';
import { parseExpression } from './parser.js';

export { parseExpression } from './parser.js';
export { evaluate } from './evaluator.js';
export { BUILTINS } from './builtins.js';
export type { CalcValue, Builtin } from './builtins.js';
export { CalcError, calcError } from './errors.js';
export type { CalcErrorCode } from './errors.js';

/**
 * Evaluate a single calculation declaration against a context.
 * Always returns a CalcResult — exceptions from the engine are captured
 * into the `error` field, never thrown.
 */
export function evaluateCalc(decl: ModuleCalcDecl, ctx: CalcEvaluationContext): CalcResult {
  try {
    const ast = parseExpression(decl.formula);
    const value = evaluate(ast, ctx);

    return {
      calc_id: decl.id,
      ok: true,
      value: value as number | string | boolean | null,
      ...(decl.unit ? { unit: decl.unit } : {}),
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
