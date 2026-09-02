// Cash-flow series — state-and-verify dated flows (RFC 0034, UW_FORMAT_SPEC §4.26).
//
// A deal states dated, irregular flows — ISO calendar dates, signed amounts —
// and optionally the aggregates over them (total, MOIC, XNPV at a rate, XIRR).
// This module carries the §VIII.9 procedures (xnpv closed-form; xirr by the
// RFC 0024 bisection verbatim, over date-derived exponents) and recomputes
// each stated metric to a three-state verdict, the same shape as
// `verifyCapitalStack` and `verifyLeaseUpSchedule`.
//
// This deliberately does NOT touch the Tier-3 calc engine: the series is
// stated data, not formulas, and neither xnpv nor xirr is reachable from a
// §VIII.1 expression. Structural rules (date grammar, ordering, sign change)
// are validator errors (`CF-01`…`CF-03`, validator.ts), not verifier findings
// — structure is validation, arithmetic is verification. A structurally
// broken series makes every stated metric `unverifiable` here, never a guess.
// Browser-safe; performs no I/O.

import { CalcError } from './calc/errors.js';
import {
  DEFAULT_DAY_COUNT,
  type DayCountConvention,
  isDayCountConvention,
  parseISODate,
  yearfrac,
  type CalendarDate,
} from './calc/day-count.js';
import {
  IRR_BRACKET_LO,
  IRR_BRACKET_HI,
  IRR_VALUE_TOL,
  IRR_INTERVAL_TOL,
  IRR_MAX_ITER,
} from './calc/builtins.js';

// ─── Types (§4.26) ───────────────────────────────────────────────────────────

/** Advisory flow taxonomy. Closed; gates no rule (§4.26). */
export const CASH_FLOW_KINDS = Object.freeze([
  'acquisition',
  'operating',
  'capex',
  'debt_service',
  'refinance',
  'disposition',
  'other',
] as const);

export type CashFlowKind = (typeof CASH_FLOW_KINDS)[number];

/** One dated flow. Outflows are negative, by convention and by fixture. */
export interface CashFlowRow {
  /** ISO-8601 `YYYY-MM-DD`, a real calendar day (CF-01). */
  date: string;
  amount: number;
  kind?: CashFlowKind | null;
  label?: string | null;
}

export interface CashFlowStatedMetrics {
  total_net?: number | null;
  moic?: number | null;
  xnpv?: { rate: number; value: number } | null;
  xirr?: number | null;
}

/** The `cash_flow_series` section content (UW_FORMAT_SPEC §4.26). */
export interface CashFlowSeries {
  label?: string | null;
  /** Defaults to `actual/365f` when absent (§4.26). */
  day_count?: DayCountConvention | null;
  series: CashFlowRow[];
  stated_metrics?: CashFlowStatedMetrics | null;
}

export type CashFlowVerdict = 'verified' | 'failed' | 'unverifiable';

export type CashFlowIssueCode =
  /** A stated metric disagrees with its recomputation beyond the quantum. */
  | 'CF-METRIC-DISAGREES'
  /** The §VIII.9 procedure refuses the stated metric (e.g. xirr cannot bracket). */
  | 'CF-PROCEDURE-REFUSES'
  /** A stated metric cannot be recomputed from what the document states — undecided, never zero. */
  | 'CF-UNEVALUABLE';

export interface CashFlowIssue {
  code: CashFlowIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  /** The stated metric this issue anchors to. */
  metric?: 'total_net' | 'moic' | 'xnpv' | 'xirr';
  expected?: string;
  actual?: string;
}

export interface CashFlowVerification {
  verdict: CashFlowVerdict;
  issues: CashFlowIssue[];
}

// ─── Quantization ────────────────────────────────────────────────────────────

/**
 * The decimal quantum each metric family is compared at (protocol §VIII.5
 * posture: both sides quantize at the same boundary; §VIII.9.4 unit defaults:
 * `$` → 2, `%` → 6, `x` → 4). Exported so any emitting surface quantizes
 * where this verifier does rather than keeping its own copy.
 */
export const CASH_FLOW_VERIFY_DECIMALS = Object.freeze({
  currency: 2,
  rate: 6,
  ratio: 4,
} as const);

function roundTo(value: number, decimals: number): number {
  // Half away from zero, the §VIII.5 rule — Math.round is half-up, which
  // differs for negatives, and a series' net total is routinely negative.
  const f = 10 ** decimals;
  const scaled = value * f;
  return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / f;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── The §VIII.9 procedures ──────────────────────────────────────────────────

/** A series row reduced to its exponent and amount, anchor-relative. */
export interface DatedFlow {
  /** yearfrac(anchor, date, convention) — the discount exponent. */
  t: number;
  amount: number;
}

/**
 * Reduce a structurally valid series to anchor-relative dated flows, or
 * `null` when any row is outside the CF-01/CF-02 grammar — the caller
 * decides whether that is a validator error, a verifier `unverifiable`,
 * or a `CALC-CF-SERIES` refusal; this function never throws.
 */
export function datedFlowsOf(series: CashFlowSeries): DatedFlow[] | null {
  const rows = series.series;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const convention = series.day_count ?? DEFAULT_DAY_COUNT;
  if (!isDayCountConvention(convention)) return null;

  const dates: CalendarDate[] = [];
  for (const row of rows) {
    if (!row || typeof row.date !== 'string' || !isNum(row.amount)) return null;
    const d = parseISODate(row.date);
    if (d === null) return null;
    dates.push(d);
  }
  const anchor = dates[0]!;
  const flows: DatedFlow[] = [];
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < rows.length; i++) {
    const t = yearfrac(anchor, dates[i]!, convention);
    if (t < prev) return null; // non-decreasing dates (CF-02)
    prev = t;
    flows.push({ t, amount: rows[i]!.amount });
  }
  return flows;
}

/**
 * xnpv(r) over anchor-relative flows — protocol §VIII.9.2, closed-form,
 * accumulated in series order. `r <= -1` raises CALC-TYPE-001.
 */
export function xnpvOf(flows: readonly DatedFlow[], rate: number): number {
  if (!isNum(rate) || rate <= -1) {
    throw new CalcError('CALC-TYPE-001', `xnpv: rate must be a finite fraction greater than -1, got ${String(rate)}.`);
  }
  let acc = 0;
  for (const f of flows) acc += f.amount * (1 + rate) ** -f.t;
  return acc;
}

/**
 * xirr over anchor-relative flows — protocol §VIII.9.3: the §VIII.3 `irr`
 * procedure verbatim with `npv` replaced by `xnpv`. Same bracket, same
 * tolerances, exact high-endpoint root, no Newton polish; failure raises
 * `CALC-XIRR-DIVERGE`.
 */
export function xirrOf(flows: readonly DatedFlow[]): number {
  const f = (r: number) => {
    let acc = 0;
    for (const fl of flows) acc += fl.amount * (1 + r) ** -fl.t;
    return acc;
  };

  let lo = IRR_BRACKET_LO;
  let hi = IRR_BRACKET_HI;
  let flo = f(lo);
  const fhi = f(hi);

  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
    throw new CalcError(
      'CALC-XIRR-DIVERGE',
      `xirr: no sign change over the [${IRR_BRACKET_LO}, ${IRR_BRACKET_HI}] bracket (-99.9% to 1000%), so no root is reported.`,
    );
  }
  // Exact endpoint root — reachable at `hi`; see §VIII.3's low-endpoint note.
  if (flo === 0) return lo;
  if (fhi === 0) return hi;

  for (let i = 0; i < IRR_MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < IRR_VALUE_TOL || (hi - lo) / 2 < IRR_INTERVAL_TOL) return mid;
    if (flo * fmid < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  throw new CalcError(
    'CALC-XIRR-DIVERGE',
    `xirr: bisection did not meet a stopping condition within ${IRR_MAX_ITER} iterations.`,
  );
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Recompute every stated metric and report a three-state verdict:
 *   - a metric disagrees beyond its quantum, or the procedure refuses a
 *     stated value outright → `failed`
 *   - a metric cannot be recomputed from what is stated (structurally broken
 *     series, MOIC with no outflows) → `unverifiable`
 *   - otherwise → `verified`
 *
 * The closed recompute vocabulary (§4.26 / §VIII.9.4):
 *   - `total_net` = Σ amount (currency quantum)
 *   - `moic` = Σ inflows ÷ |Σ outflows| (ratio quantum; no outflows → unverifiable)
 *   - `xnpv.value` = §VIII.9.2 at the stated rate (currency quantum)
 *   - `xirr` = §VIII.9.3 (rate quantum; a procedure refusal is `failed` —
 *     the document asserts a number the procedure cannot produce)
 *
 * A `verified` series means the stated metrics follow deterministically from
 * the stated rows. It does not mean the projection is achievable.
 */
export function verifyCashFlowSeries(series: CashFlowSeries): CashFlowVerification {
  const issues: CashFlowIssue[] = [];
  const stated = series.stated_metrics;
  if (!stated) return { verdict: 'verified', issues };

  const statedMetrics = (['total_net', 'moic', 'xnpv', 'xirr'] as const).filter((m) => {
    const v = stated[m];
    return v !== undefined && v !== null;
  });
  if (statedMetrics.length === 0) return { verdict: 'verified', issues };

  const flows = datedFlowsOf(series);
  if (flows === null) {
    for (const metric of statedMetrics) {
      issues.push({
        code: 'CF-UNEVALUABLE',
        severity: 'indeterminate',
        metric,
        message: `stated_metrics.${metric} is stated but the series is structurally invalid (CF-01/CF-02), so it cannot be verified.`,
      });
    }
    return { verdict: 'unverifiable', issues };
  }

  if (isNum(stated.total_net)) {
    const dp = CASH_FLOW_VERIFY_DECIMALS.currency;
    const recomputed = roundTo(flows.reduce((acc, f) => acc + f.amount, 0), dp);
    const claim = roundTo(stated.total_net, dp);
    if (claim !== recomputed) {
      issues.push({
        code: 'CF-METRIC-DISAGREES',
        severity: 'failure',
        metric: 'total_net',
        message: `stated_metrics.total_net states ${stated.total_net} but the series sums to ${recomputed}.`,
        expected: String(claim),
        actual: String(recomputed),
      });
    }
  }

  if (isNum(stated.moic)) {
    let inflows = 0;
    let outflows = 0;
    for (const f of flows) {
      if (f.amount >= 0) inflows += f.amount;
      else outflows += -f.amount;
    }
    if (outflows === 0) {
      issues.push({
        code: 'CF-UNEVALUABLE',
        severity: 'indeterminate',
        metric: 'moic',
        message: 'stated_metrics.moic is stated but the series has no outflows, so the multiple is undefined and cannot be verified.',
      });
    } else {
      const dp = CASH_FLOW_VERIFY_DECIMALS.ratio;
      const recomputed = roundTo(inflows / outflows, dp);
      const claim = roundTo(stated.moic, dp);
      if (claim !== recomputed) {
        issues.push({
          code: 'CF-METRIC-DISAGREES',
          severity: 'failure',
          metric: 'moic',
          message: `stated_metrics.moic states ${stated.moic} but the series recomputes to ${recomputed}.`,
          expected: String(claim),
          actual: String(recomputed),
        });
      }
    }
  }

  const xnpvClaim = stated.xnpv;
  if (xnpvClaim && isNum(xnpvClaim.rate) && isNum(xnpvClaim.value)) {
    try {
      const dp = CASH_FLOW_VERIFY_DECIMALS.currency;
      const recomputed = roundTo(xnpvOf(flows, xnpvClaim.rate), dp);
      const claim = roundTo(xnpvClaim.value, dp);
      if (claim !== recomputed) {
        issues.push({
          code: 'CF-METRIC-DISAGREES',
          severity: 'failure',
          metric: 'xnpv',
          message: `stated_metrics.xnpv.value states ${xnpvClaim.value} at rate ${xnpvClaim.rate} but §VIII.9.2 recomputes to ${recomputed}.`,
          expected: String(claim),
          actual: String(recomputed),
        });
      }
    } catch (e) {
      issues.push({
        code: 'CF-PROCEDURE-REFUSES',
        severity: 'failure',
        metric: 'xnpv',
        message: `stated_metrics.xnpv states a value the §VIII.9.2 procedure refuses: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  } else if (xnpvClaim) {
    issues.push({
      code: 'CF-UNEVALUABLE',
      severity: 'indeterminate',
      metric: 'xnpv',
      message: 'stated_metrics.xnpv must state both a finite rate and value to be verifiable.',
    });
  }

  if (isNum(stated.xirr)) {
    try {
      const dp = CASH_FLOW_VERIFY_DECIMALS.rate;
      const recomputed = roundTo(xirrOf(flows), dp);
      const claim = roundTo(stated.xirr, dp);
      if (claim !== recomputed) {
        issues.push({
          code: 'CF-METRIC-DISAGREES',
          severity: 'failure',
          metric: 'xirr',
          message: `stated_metrics.xirr states ${stated.xirr} but §VIII.9.3 recomputes to ${recomputed}.`,
          expected: String(claim),
          actual: String(recomputed),
        });
      }
    } catch (e) {
      // The document asserts a number the procedure cannot produce (§4.26).
      issues.push({
        code: 'CF-PROCEDURE-REFUSES',
        severity: 'failure',
        metric: 'xirr',
        message: `stated_metrics.xirr states a value the §VIII.9.3 procedure refuses: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  if (issues.some((i) => i.severity === 'failure')) {
    return { verdict: 'failed', issues };
  }
  if (issues.some((i) => i.severity === 'indeterminate')) {
    return { verdict: 'unverifiable', issues };
  }
  return { verdict: 'verified', issues };
}
