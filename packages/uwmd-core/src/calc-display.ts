// Calc results with a display string — a starter product (RFC 0078 D11).
//
// The standard evaluator (`@uwmd/verify`'s `evaluateCalc`) returns a `CalcResult` with
// no `display`: the field is optional in `calc-result.schema.json`, and how a
// number is shown is a display convention, not part of verification. The
// `evaluateCalc` and `evaluateModuleCalculations` that `@uwmd/core` exports are
// the wrappers below, which add `display` exactly as core always has, so their
// callers see no change (RFC 0083 §3).

import {
  evaluateCalc as evaluateCalcStandard,
  evaluateModuleCalculations as evaluateModuleCalculationsStandard,
  type ModuleCalcOutcome,
  type ModuleRuntimeOptions,
  type ModuleRegistry,
  type CalcEvaluationContext,
  type CalcResult,
  type ModuleCalcDecl,
  type ParsedUWFile,
} from '@uwmd/verify';
import { formatCurrency, formatPercent, formatRatio, formatValue } from './format.js';

/**
 * Evaluate a single calculation declaration against a context, with the
 * result's `display` string. Always returns a CalcResult — exceptions are
 * captured into the `error` field, never thrown. The value is the standard
 * evaluator's, quantized at the §VIII.5 boundary.
 */
export function evaluateCalc(decl: ModuleCalcDecl, ctx: CalcEvaluationContext): CalcResult {
  return withDisplay(evaluateCalcStandard(decl, ctx), ctx.parsed?.frontmatter?.currency_code);
}

/**
 * `evaluateModuleCalculations` with each successful result's `display` string,
 * as `@uwmd/core` has always returned it. Evaluation, order and threading are
 * the standard module runtime's.
 */
export function evaluateModuleCalculations(
  parsed: ParsedUWFile,
  registry: ModuleRegistry,
  options: ModuleRuntimeOptions = {},
): ModuleCalcOutcome[] {
  const currencyCode = parsed.frontmatter?.currency_code;
  return evaluateModuleCalculationsStandard(parsed, registry, options).map(({ module_id, result }) => ({
    module_id,
    result: withDisplay(result, currencyCode),
  }));
}

/**
 * Add `display` as the last member of a successful result. A formatting
 * failure becomes the same error result the evaluator itself returns for an
 * unexpected exception, as it did when formatting ran inside the evaluator.
 */
function withDisplay(result: CalcResult, currencyCode?: string): CalcResult {
  if (!result.ok) return result;
  try {
    return { ...result, display: formatForDisplay(result.value, result.unit, currencyCode) };
  } catch (e) {
    return {
      calc_id: result.calc_id,
      ok: false,
      value: null,
      ...(result.unit ? { unit: result.unit } : {}),
      round_to: result.round_to,
      error: { category: 'calc', code: 'CALC-PARSE-001', message: e instanceof Error ? e.message : String(e) },
    };
  }
}

function formatForDisplay(value: unknown, unit?: string, currencyCode?: string): string {
  if (value === null || value === undefined) return formatValue(null);
  if (typeof value !== 'number') return String(value);
  switch (unit) {
    case '%': return formatPercent(value);
    case '$': return formatCurrency(value, { currencyCode });
    case 'x': return formatRatio(value);
    default:
      // Fall back to a fixed-decimal display.
      return Number.isInteger(value) ? value.toString() : value.toFixed(4);
  }
}
