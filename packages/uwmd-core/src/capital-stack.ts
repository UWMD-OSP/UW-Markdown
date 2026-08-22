// Capital stack — state-and-verify sizing (RFC 0026, UW_FORMAT_SPEC §4.24).
//
// A deal states an ordered array of typed capital tranches and the stack-aware
// sizing figures a lender underwrites to (per-tranche and blended coverage,
// attachment-point debt yield, LTC/LTV by layer, weighted cost of capital). This
// module recomputes each stated figure over a FIXED, CLOSED function vocabulary
// and reports a three-state verdict — the same state-and-verify shape RFC 0021 §6
// uses for portfolio rollups (`verifyRollup`).
//
// This deliberately does NOT touch the Tier-3 calc engine. The sandbox has no
// iteration or array indexing (RFC 0019 §1), so a variable-length tranche array
// is not addressable by a pack formula. A deterministic TypeScript verifier is
// not so constrained: it walks the array directly, exactly as `verifyRollup`
// walks a variable member list. Browser-safe; performs no I/O.
//
// Scope (RFC 0026 v1): tranche representation, the sizing vocabulary below, and
// preferred-equity cash-vs-accrued. The multi-period distribution waterfall
// (promote, hurdles, tiers, catch-up) is out of scope and refused by the
// validator (CS-WATERFALL-UNSUPPORTED); it needs a hold-period cash-flow
// primitive the format does not yet have (RFC 0026 §E).

import type { ParsedUWFile } from './types.js';
import { getSection, deepGet } from './parser.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A tranche's type. Closed and non-extensible. */
export type TrancheClass =
  | 'senior_debt'
  | 'mezzanine_debt'
  | 'preferred_equity'
  | 'common_equity'
  | 'bridge'
  | 'seller_financing'
  | 'other_debt';

/** Cash-pay vs PIK. Accrued obligations do not enter cash coverage. */
export type Accrual = 'cash' | 'accrued';

/** One layer of the capital stack (UW_FORMAT_SPEC §4.24). */
export interface Tranche {
  id: string;
  class: TrancheClass;
  position: number;
  amount: number;
  rate?: number | null;
  accrual?: Accrual | null;
  amortization_months?: number | null;
  io_months?: number | null;
  term_months?: number | null;
}

/** The closed sizing function vocabulary. */
export type SizingFn =
  | 'coverage'
  | 'blended_coverage'
  | 'debt_yield_through'
  | 'ltc_through'
  | 'ltv_through'
  | 'weighted_cost';

/** One stated sizing figure a verifier recomputes. */
export interface SizingFigure {
  id: string;
  fn: SizingFn;
  /** Single-tranche selector: a tranche id, or `*` for the whole stack. */
  over?: string;
  /** Cumulative selector: a position; covers all tranches at or above it. */
  through?: number;
  value: number;
}

/** The `capital_stack` section content. */
export interface CapitalStack {
  tranches: Tranche[];
  sizing?: SizingFigure[];
}

/** The property-level inputs the sizing figures divide. */
export interface CapitalStackContext {
  /** `noi_model.net_operating_income`. */
  noi: number | null;
  /** Total cost / total capitalization, for `ltc_through`. */
  total_cost?: number | null;
  /** Underwritten value, for `ltv_through`. */
  total_value?: number | null;
}

export type CapitalStackVerdict = 'verified' | 'failed' | 'unverifiable';

export type CapitalStackIssueCode =
  /** A stated sizing figure disagrees with recomputation. */
  | 'CS-SIZING-DISAGREES'
  /** A sizing figure reads inputs the document does not supply — undecided, never zero. */
  | 'CS-SIZING-UNEVALUABLE';

export interface CapitalStackIssue {
  code: CapitalStackIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  expected?: string;
  actual?: string;
}

export interface SizingResult {
  id: string;
  fn: SizingFn;
  stated: number;
  recomputed: number | null;
  agrees: boolean;
}

export interface CapitalStackVerification {
  verdict: CapitalStackVerdict;
  issues: CapitalStackIssue[];
  sizing: SizingResult[];
}

// ─── Tranche classification + debt service ───────────────────────────────────

const DEBT_CLASSES: ReadonlySet<TrancheClass> = new Set([
  'senior_debt',
  'mezzanine_debt',
  'bridge',
  'seller_financing',
  'other_debt',
]);

/** Debt-class tranches, whose balances make up "debt" for a debt-yield/LTC. */
export function isDebtTranche(t: Tranche): boolean {
  return DEBT_CLASSES.has(t.class);
}

/**
 * A tranche's annual CASH debt service — what enters coverage. An accrued/PIK
 * tranche pays nothing in cash (returns 0). Common equity has no service.
 * A debt or preferred tranche with no `rate` is uncomputable (returns null).
 *
 * Debt: the fully-amortizing constant when `amortization_months > 0`, otherwise
 * interest-only (`amount × rate`). `io_months` describes when amortization
 * begins — a multi-period schedule concern (RFC 0026 Phase 2) — and does not
 * change this stabilized annual constant. Preferred equity that is cash-pay
 * contributes its current return (`amount × rate`).
 */
export function trancheAnnualDebtService(t: Tranche): number | null {
  if (t.accrual === 'accrued') return 0;
  if (t.class === 'common_equity') return 0;
  if (t.rate === null || t.rate === undefined) return null;
  if (t.class === 'preferred_equity') return t.amount * t.rate;

  const amort = t.amortization_months ?? 0;
  if (amort <= 0) return t.amount * t.rate; // interest-only / non-amortizing
  const mr = t.rate / 12;
  const monthly = mr === 0 ? t.amount / amort : (t.amount * mr) / (1 - (1 + mr) ** -amort);
  return monthly * 12;
}

// ─── Sizing recomputation ────────────────────────────────────────────────────

/**
 * The decimal quantum each sizing figure is compared at, keyed by `fn`. Coverage
 * ratios are stated to 2 places (a DSCR reads as 1.85); rates and yields to 4.
 * An author who states a correctly-rounded value verifies and a materially wrong
 * one does not. Exported so an emitting surface (the Excel workbook's sizing
 * block) quantizes at the same boundary this verifier does, rather than keeping
 * its own copy of the table.
 */
export const CAPITAL_STACK_SIZING_DECIMALS: Readonly<Record<SizingFn, number>> = {
  coverage: 2,
  blended_coverage: 2,
  debt_yield_through: 4,
  ltc_through: 4,
  ltv_through: 4,
  weighted_cost: 4,
};

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function agrees(stated: number, recomputed: number, fn: SizingFn): boolean {
  const dp = CAPITAL_STACK_SIZING_DECIMALS[fn];
  return roundTo(stated, dp) === roundTo(recomputed, dp);
}

/** Sum a value over the tranches at or above a position; null if any is null. */
function sumThrough(
  tranches: readonly Tranche[],
  position: number,
  value: (t: Tranche) => number | null,
): number | null {
  let total = 0;
  for (const t of tranches) {
    if (t.position > position) continue;
    const v = value(t);
    if (v === null) return null;
    total += v;
  }
  return total;
}

/**
 * Recompute one sizing figure over the tranches. Returns null when the figure
 * reads an input the document does not supply (a missing NOI, an absent
 * cost/value, a division by a zero denominator, or a selector that resolves to
 * no tranche) — never a misleading zero.
 */
export function recomputeSizing(
  fig: SizingFigure,
  tranches: readonly Tranche[],
  ctx: CapitalStackContext,
): number | null {
  const noi = ctx.noi;
  switch (fig.fn) {
    case 'coverage': {
      const t = tranches.find((x) => x.id === fig.over);
      if (!t || noi === null) return null;
      const ds = trancheAnnualDebtService(t);
      if (ds === null || ds === 0) return null;
      return noi / ds;
    }
    case 'blended_coverage': {
      if (fig.through === undefined || noi === null) return null;
      const ds = sumThrough(tranches, fig.through, trancheAnnualDebtService);
      if (ds === null || ds === 0) return null;
      return noi / ds;
    }
    case 'debt_yield_through': {
      if (fig.through === undefined || noi === null) return null;
      const bal = sumThrough(tranches, fig.through, (t) => (isDebtTranche(t) ? t.amount : 0));
      if (bal === null || bal === 0) return null;
      return noi / bal;
    }
    case 'ltc_through':
    case 'ltv_through': {
      if (fig.through === undefined) return null;
      const denom = fig.fn === 'ltc_through' ? ctx.total_cost : ctx.total_value;
      if (denom === null || denom === undefined || denom === 0) return null;
      const bal = sumThrough(tranches, fig.through, (t) => (isDebtTranche(t) ? t.amount : 0));
      if (bal === null) return null;
      return bal / denom;
    }
    case 'weighted_cost': {
      let weighted = 0;
      let base = 0;
      for (const t of tranches) {
        if (t.rate === null || t.rate === undefined) continue;
        weighted += t.amount * t.rate;
        base += t.amount;
      }
      if (base === 0) return null;
      return weighted / base;
    }
    default:
      return null;
  }
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Recompute every stated sizing figure and report a three-state verdict:
 *   - a figure disagrees beyond its quantum → `failed` (CS-SIZING-DISAGREES)
 *   - a figure reads an input the document does not supply → `unverifiable`
 *   - otherwise → `verified`
 *
 * A `verified` stack means the stated sizing follows deterministically from the
 * tranche terms as they stand. It does not mean the terms are the right terms.
 */
export function verifyCapitalStack(
  stack: CapitalStack,
  ctx: CapitalStackContext,
): CapitalStackVerification {
  const issues: CapitalStackIssue[] = [];
  const results: SizingResult[] = [];
  const tranches = stack.tranches ?? [];

  for (const fig of stack.sizing ?? []) {
    const recomputed = recomputeSizing(fig, tranches, ctx);
    if (recomputed === null) {
      results.push({ id: fig.id, fn: fig.fn, stated: fig.value, recomputed: null, agrees: false });
      issues.push({
        code: 'CS-SIZING-UNEVALUABLE',
        severity: 'indeterminate',
        message: `Sizing figure '${fig.id}' (${fig.fn}) reads an input the document does not supply, so it cannot be verified.`,
      });
      continue;
    }
    const ok = agrees(fig.value, recomputed, fig.fn);
    results.push({ id: fig.id, fn: fig.fn, stated: fig.value, recomputed, agrees: ok });
    if (!ok) {
      issues.push({
        code: 'CS-SIZING-DISAGREES',
        severity: 'failure',
        message: `Sizing figure '${fig.id}' states ${fig.value} but ${fig.fn} recomputes to ${recomputed}.`,
        expected: String(fig.value),
        actual: String(recomputed),
      });
    }
  }

  if (issues.some((i) => i.severity === 'failure')) {
    return { verdict: 'failed', issues, sizing: results };
  }
  if (issues.some((i) => i.severity === 'indeterminate')) {
    return { verdict: 'unverifiable', issues, sizing: results };
  }
  return { verdict: 'verified', issues, sizing: results };
}

/**
 * Pull the property-level sizing inputs from a parsed document: NOI from
 * `noi_model`, total cost from `sources_uses` (uses total), and underwritten
 * value from `valuation`. Any absent input becomes `null`, which makes the
 * figures that need it `unverifiable` rather than wrong.
 */
export function capitalStackContext(parsed: ParsedUWFile): CapitalStackContext {
  const num = (section: string, path: string): number | null => {
    const block = getSection(parsed, section);
    if (!block) return null;
    const v = deepGet(block.content as Record<string, unknown>, path);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  return {
    noi: num('noi_model', 'net_operating_income'),
    total_cost: num('sources_uses', 'uses.total') ?? num('sources_uses', 'total_uses'),
    total_value: num('valuation', 'underwritten_value') ?? num('valuation', 'purchase_price'),
  };
}
