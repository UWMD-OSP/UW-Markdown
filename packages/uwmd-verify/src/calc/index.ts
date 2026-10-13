// Tier-3 Calc Host — entry point.
// `evaluateCalc()` parses a calc declaration's formula, resolves variables
// against the CalcEvaluationContext, and returns a CalcResult per §VIII.
//
// Standard side (RFC 0083): the result carries no `display` string, which is
// optional in `calc-result.schema.json` and a starter display convention
// (RFC 0078 D11). The `evaluateCalc` that `@uwmd/core` exports is the starter
// wrapper in `../calc-display.ts`, which adds `display` to this result.

import type { CalcEvaluationContext, CalcResult, ModuleCalcDecl } from '../protocol.js';
import { CalcError } from './errors.js';
import { evaluateDeclared } from './evaluator.js';
import { parseExpression } from './parser.js';
import { quantizeDecimal, resolveRoundTo } from './quantize.js';

export { parseExpression } from './parser.js';
export { evaluate } from './evaluator.js';
export {
  BUILTINS,
  IRR_BRACKET_LO,
  IRR_BRACKET_HI,
  IRR_MAX_ITER,
  IRR_VALUE_TOL,
  IRR_INTERVAL_TOL,
} from './builtins.js';
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
 * Excel converter — reaches results through this function (directly, or through
 * the starter wrapper that adds `display`), which is what makes one boundary
 * sufficient.
 */
export function evaluateCalc(decl: ModuleCalcDecl, ctx: CalcEvaluationContext): CalcResult {
  const roundTo = resolveRoundTo(decl);
  try {
    const ast = parseExpression(decl.formula);
    // A declaration's `section_roles` reaches resolution here and nowhere else.
    const raw = evaluateDeclared(ast, ctx, decl.section_roles);
    const value = typeof raw === 'number' ? quantizeDecimal(raw, roundTo) : raw;

    // `spec/schemas/calc-result.schema.json` — the normative schema declared at
    // the head of Part VIII — types `value` as
    // `["number", "string", "boolean", "null"]`. Receipts digest it and the CLI
    // renders it, so a non-scalar must be refused here rather than cast
    // through: an array once reached this line and surfaced as the display
    // string "[object Object]".
    if (
      value !== null &&
      typeof value !== 'number' &&
      typeof value !== 'string' &&
      typeof value !== 'boolean'
    ) {
      throw new CalcError(
        'CALC-TYPE-001',
        `Calculation '${decl.id}' produced ${Array.isArray(value) ? 'an array' : `a ${typeof value}`}; CalcResult.value must be number, string, boolean or null (calc-result.schema.json).`,
      );
    }

    return {
      calc_id: decl.id,
      ok: true,
      value,
      ...(decl.unit ? { unit: decl.unit } : {}),
      round_to: roundTo,
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
