// Filesystem CLI adapter for the three overrides documented by Format C.6.
// This is not an exhaustive institution schema or a new config refusal policy.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_THRESHOLDS, type FinancialThresholds } from '@uwmd/verify';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Map only documented own numeric leaves; no coercion or nested wire alias. */
export function institutionThresholds(value: unknown): Partial<FinancialThresholds> | undefined {
  if (!record(value) || !Object.hasOwn(value, 'validation_overrides')) return undefined;
  const overrides = value.validation_overrides;
  if (!record(overrides)) return undefined;
  const result: Partial<FinancialThresholds> = {};
  const numeric = (key: string): number | undefined => {
    const candidate = Object.hasOwn(overrides, key) ? overrides[key] : undefined;
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
  };
  const dscr = numeric('dscr_warning_below');
  const ltv = numeric('ltv_warning_above');
  const debtYield = numeric('debt_yield_warning_below');
  // validateUWFile merges metric bands at the root. Preserve untouched limits
  // in fresh bands rather than losing error thresholds or mutating defaults.
  if (dscr !== undefined) result.dscr = { ...DEFAULT_THRESHOLDS.dscr, warning_below: dscr };
  if (ltv !== undefined) result.ltv = { ...DEFAULT_THRESHOLDS.ltv, warning_above: ltv };
  if (debtYield !== undefined) result.debt_yield = { ...DEFAULT_THRESHOLDS.debt_yield, warning_below: debtYield };
  return Object.keys(result).length ? result : undefined;
}

/** Explicit CLI path selects one file; otherwise use the record's directory. */
export function loadInstitutionThresholds(file: string, explicitPath?: string): Partial<FinancialThresholds> | undefined {
  const path = explicitPath || resolve(dirname(resolve(file)), '.uw.institution.json');
  if (!explicitPath && !existsSync(path)) return undefined;
  try {
    return institutionThresholds(JSON.parse(readFileSync(resolve(path), 'utf-8')));
  } catch {
    // Retain existing explicit warning/fallback transport, including analogous
    // adjacent failures. Malformed config policy remains unclosed; this change
    // demonstrates only valid documented inputs, not exhaustive config admission.
    console.error(`Warning: could not load institution config: ${path}`);
    return undefined;
  }
}
