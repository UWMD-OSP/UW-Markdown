// Lease-up schedule — state-and-verify trajectory (RFC 0008, UW_FORMAT_SPEC §4.25).
//
// A deal states the period-by-period path from current to stabilized rents —
// natural turnover on a value-add, or an absorption curve on ground-up — plus
// the assumption set that drives it and a stabilized summary. This module
// recomputes each stated aggregate over a FIXED, CLOSED vocabulary and reports
// a three-state verdict, the same shape as `verifyCapitalStack` and
// `verifyRollup` (RFC 0026 pattern).
//
// This deliberately does NOT touch the Tier-3 calc engine. The schedule is
// stated data, not formulas: a variable-length period array is not addressable
// by a pack formula (no iteration, RFC 0019 §1), but a deterministic TypeScript
// verifier walks it directly. Structural rules (period grammar, monotonicity,
// empty schedules) are validator errors (`LU-01`…`LU-04`, validator.ts), not
// verifier findings — structure is validation, arithmetic is verification.
// Browser-safe; performs no I/O.

import type { ParsedUWFile } from './types.js';
import { getSection, deepGet } from './parser.js';
import { resolveDealSize } from './protocol.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** How the schedule models the trajectory. Closed and non-extensible. */
export type LeaseUpModelType = 'natural_turnover' | 'absorption_curve';

/** Period cadence, uniform per schedule (§4.25 period grammar). */
export type LeaseUpGranularity = 'monthly' | 'quarterly';

/**
 * One period of the lease-up trajectory. All rates are fractions (0.18 = 18%),
 * all dollar figures period totals. Only `period` is required; a period that
 * omits a cash-flow component makes the stated `net_cash_flow` unverifiable
 * for that row, never wrong.
 */
export interface LeaseUpPeriod {
  /** `YYYY-Qn` (quarterly) or `YYYY-MM` (monthly), per `period_granularity`. */
  period: string;
  occupied_sf?: number | null;
  leased_sf?: number | null;
  in_place_rent_psf?: number | null;
  market_rent_psf?: number | null;
  vacancy_rate?: number | null;
  rent_revenue?: number | null;
  concessions?: number | null;
  ti_lc_capex?: number | null;
  net_cash_flow?: number | null;
}

/** The assumption set driving the schedule. Deal thesis, never defaulted. */
export interface LeaseUpAssumptions {
  monthly_turnover_rate?: number | null;
  market_rent_psf_at_stabilization?: number | null;
  vacancy_during_lease_up?: number | null;
  concession_months_per_lease?: number | null;
  tenant_improvement_psf?: number | null;
  leasing_commission_rate?: number | null;
}

/** The stated endpoint the trajectory claims to reach. */
export interface LeaseUpStabilizedSummary {
  occupied_sf?: number | null;
  occupancy_rate?: number | null;
  annualized_egi?: number | null;
  annualized_noi?: number | null;
}

/** The `lease_up_schedule` section content (UW_FORMAT_SPEC §4.25). */
export interface LeaseUpSchedule {
  model_type: LeaseUpModelType;
  period_granularity: LeaseUpGranularity;
  stabilization_target?: string | null;
  assumptions?: LeaseUpAssumptions | null;
  schedule: LeaseUpPeriod[];
  stabilized_summary?: LeaseUpStabilizedSummary | null;
}

export type LeaseUpVerdict = 'verified' | 'failed' | 'unverifiable';

export type LeaseUpIssueCode =
  /** A period's stated net_cash_flow disagrees with its stated components. */
  | 'LU-NCF-DISAGREES'
  /** A stabilized_summary figure disagrees with the final period. */
  | 'LU-SUMMARY-DISAGREES'
  /** A stated figure reads an input the document does not supply — undecided, never zero. */
  | 'LU-UNEVALUABLE';

export interface LeaseUpIssue {
  code: LeaseUpIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  /** The period this issue anchors to, when row-level. */
  period?: string;
  expected?: string;
  actual?: string;
}

export interface LeaseUpVerification {
  verdict: LeaseUpVerdict;
  issues: LeaseUpIssue[];
}

/** The document-level inputs the summary figures divide. */
export interface LeaseUpContext {
  /**
   * The occupancy denominator in square feet, resolved through the Protocol
   * §XIII size-intensive registry. `null` when the deal's class has no
   * sqft-basis primary size or the document does not state it — which makes
   * `occupancy_rate` `unverifiable`, never a guess.
   */
  total_sf: number | null;
}

// ─── Quantization ────────────────────────────────────────────────────────────

/**
 * The decimal quantum each figure family is compared at (protocol §VIII.5
 * posture: both sides quantize at the same boundary). Currency to cents; rates
 * to 4 places, like the capital-stack sizing table. Exported so an emitting
 * surface quantizes where this verifier does rather than keeping its own copy.
 */
export const LEASE_UP_VERIFY_DECIMALS = Object.freeze({
  currency: 2,
  rate: 4,
  sf: 2,
} as const);

/**
 * The relative tolerance CC-15 allows between the schedule's final period /
 * stabilized summary and `noi_model`'s stabilized figures (2%). Deliberate,
 * not softness: unlike CC-01 (one number restated in two places, exact), the
 * trajectory endpoint and the stabilized-year projection are two different
 * models of stabilization, and demanding exact agreement would force
 * producers to hand-tune one to echo the other — destroying the
 * independent-model signal the check exists to read (RFC 0008).
 */
export const LEASE_UP_STABILIZED_TOLERANCE = 0.02;

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Recompute every stated aggregate and report a three-state verdict:
 *   - a figure disagrees beyond its quantum → `failed`
 *   - a figure reads an input the document does not supply → `unverifiable`
 *   - otherwise → `verified`
 *
 * The closed recompute vocabulary (§4.25):
 *   - per period: `net_cash_flow` = `rent_revenue + concessions + ti_lc_capex`
 *     (all stated; a missing component is `unverifiable` for that row)
 *   - `stabilized_summary.occupied_sf` against the final period's
 *   - `stabilized_summary.occupancy_rate` = final `occupied_sf` ÷ `ctx.total_sf`
 *
 * A `verified` schedule means the stated figures follow deterministically from
 * the stated rows. It does not mean the trajectory is achievable.
 */
export function verifyLeaseUpSchedule(
  schedule: LeaseUpSchedule,
  ctx: LeaseUpContext,
): LeaseUpVerification {
  const issues: LeaseUpIssue[] = [];
  const rows = schedule.schedule ?? [];

  for (const row of rows) {
    if (!isNum(row.net_cash_flow)) continue; // nothing stated, nothing to verify
    if (!isNum(row.rent_revenue) || !isNum(row.concessions) || !isNum(row.ti_lc_capex)) {
      issues.push({
        code: 'LU-UNEVALUABLE',
        severity: 'indeterminate',
        period: row.period,
        message: `Period ${row.period} states net_cash_flow but omits a component (rent_revenue, concessions, ti_lc_capex), so it cannot be verified.`,
      });
      continue;
    }
    const dp = LEASE_UP_VERIFY_DECIMALS.currency;
    const recomputed = roundTo(row.rent_revenue + row.concessions + row.ti_lc_capex, dp);
    const stated = roundTo(row.net_cash_flow, dp);
    if (stated !== recomputed) {
      issues.push({
        code: 'LU-NCF-DISAGREES',
        severity: 'failure',
        period: row.period,
        message: `Period ${row.period} states net_cash_flow ${row.net_cash_flow} but the components sum to ${recomputed}.`,
        expected: String(stated),
        actual: String(recomputed),
      });
    }
  }

  const summary = schedule.stabilized_summary;
  const final = rows.length > 0 ? rows[rows.length - 1] : undefined;
  if (summary && final) {
    if (isNum(summary.occupied_sf)) {
      if (!isNum(final.occupied_sf)) {
        issues.push({
          code: 'LU-UNEVALUABLE',
          severity: 'indeterminate',
          message: `stabilized_summary states occupied_sf but the final period (${final.period}) does not, so it cannot be verified.`,
        });
      } else {
        const dp = LEASE_UP_VERIFY_DECIMALS.sf;
        const stated = roundTo(summary.occupied_sf, dp);
        const recomputed = roundTo(final.occupied_sf, dp);
        if (stated !== recomputed) {
          issues.push({
            code: 'LU-SUMMARY-DISAGREES',
            severity: 'failure',
            message: `stabilized_summary.occupied_sf states ${summary.occupied_sf} but the final period (${final.period}) states ${final.occupied_sf}.`,
            expected: String(stated),
            actual: String(recomputed),
          });
        }
      }
    }
    if (isNum(summary.occupancy_rate)) {
      const sf = isNum(final.occupied_sf) ? final.occupied_sf : summary.occupied_sf;
      if (!isNum(sf) || ctx.total_sf === null || ctx.total_sf === 0) {
        issues.push({
          code: 'LU-UNEVALUABLE',
          severity: 'indeterminate',
          message: 'stabilized_summary states occupancy_rate but no square-foot denominator resolves through the size-intensive registry (Protocol §XIII), so it cannot be verified.',
        });
      } else {
        const dp = LEASE_UP_VERIFY_DECIMALS.rate;
        const stated = roundTo(summary.occupancy_rate, dp);
        const recomputed = roundTo(sf / ctx.total_sf, dp);
        if (stated !== recomputed) {
          issues.push({
            code: 'LU-SUMMARY-DISAGREES',
            severity: 'failure',
            message: `stabilized_summary.occupancy_rate states ${summary.occupancy_rate} but ${sf} ÷ ${ctx.total_sf} recomputes to ${recomputed}.`,
            expected: String(stated),
            actual: String(recomputed),
          });
        }
      }
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

/**
 * Pull the occupancy denominator from a parsed document through the Protocol
 * §XIII size-intensive registry — which is what the registry exists for. Only
 * a `sqft`-unit primary size is a valid denominator for `occupied_sf`; a
 * keys/units/beds class resolves to `null`, which makes `occupancy_rate`
 * `unverifiable` rather than dimensionally wrong. A multifamily document that
 * states its secondary `total_nra_sqft` supplies the denominator that way.
 */
export function leaseUpContext(parsed: ParsedUWFile): LeaseUpContext {
  const size = resolveDealSize(parsed);
  if (size && size.unit === 'sqft') return { total_sf: size.quantity };

  // Secondary sqft fields (Protocol §XIII secondary lists) still denominate.
  const property = getSection(parsed, 'property');
  if (property) {
    for (const path of ['total_nra_sqft', 'rentable_square_feet', 'net_rentable_square_feet']) {
      const v = deepGet(property.content as Record<string, unknown>, path);
      if (isNum(v) && v > 0) return { total_sf: v };
    }
  }
  return { total_sf: null };
}

// ─── Period grammar (shared with the validator) ──────────────────────────────

const QUARTER_RE = /^(\d{4})-Q([1-4])$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * A period's ordinal on its granularity's axis, or `null` when the string is
 * outside the grammar for that granularity. Consecutive periods differ by
 * exactly 1, which is what makes the validator's gap-free check (`LU-02`) a
 * subtraction rather than a calendar library.
 */
export function leaseUpPeriodOrdinal(
  period: string,
  granularity: LeaseUpGranularity,
): number | null {
  if (granularity === 'quarterly') {
    const m = QUARTER_RE.exec(period);
    if (!m) return null;
    return Number(m[1]) * 4 + (Number(m[2]) - 1);
  }
  const m = MONTH_RE.exec(period);
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}
