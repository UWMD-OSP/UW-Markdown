// Validated transport for the existing CalcEvaluationContext input options.
// This helper performs no lookup, defaulting, canonicalization or financial math.
import type { CalcEvaluationContext } from './protocol.js';
import { PERIOD_SERIES } from './protocol.js';
import { CalcError } from './calc/errors.js';

type ContextInputs = Pick<CalcEvaluationContext, 'sectionVariants' | 'overrides'>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new CalcError('CALC-TYPE-001', `${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

/** Validate a decoded context file; exact keys and null/zero values survive. */
export function parseCalculationContext(value: unknown): ContextInputs {
  const input = object(value, 'Calculation context');
  for (const key of Object.keys(input)) {
    if (key !== 'sectionVariants' && key !== 'overrides') {
      throw new CalcError('CALC-TYPE-001', `Unknown calculation context option '${key}'. Expected sectionVariants or overrides.`);
    }
  }
  const result: ContextInputs = {};
  if (Object.hasOwn(input, 'sectionVariants')) {
    const entries = object(input['sectionVariants'], 'sectionVariants');
    const variants: Record<string, string> = Object.create(null);
    for (const [section, variant] of Object.entries(entries)) {
      if (!PERIOD_SERIES.some(series => series.path.split('.')[0] === section)) {
        throw new CalcError('CALC-TYPE-001', `sectionVariants contains unregistered period section '${section}'.`);
      }
      if (typeof variant !== 'string' || !variant.trim()) {
        throw new CalcError('CALC-TYPE-001', `sectionVariants.${section} must be a nonempty string.`);
      }
      variants[section] = variant;
    }
    result.sectionVariants = variants;
  }
  if (Object.hasOwn(input, 'overrides')) {
    const entries = object(input['overrides'], 'overrides');
    const overrides: Record<string, number | string | boolean | null> = Object.create(null);
    for (const [path, replacement] of Object.entries(entries)) {
      if (!path.trim() || !(replacement === null || typeof replacement === 'string'
        || typeof replacement === 'boolean' || (typeof replacement === 'number' && Number.isFinite(replacement)))) {
        throw new CalcError('CALC-TYPE-001', `Override '${path}' requires a nonempty exact path and a finite JSON scalar or null.`);
      }
      overrides[path] = replacement as number | string | boolean | null;
    }
    result.overrides = overrides;
  }
  return result;
}
