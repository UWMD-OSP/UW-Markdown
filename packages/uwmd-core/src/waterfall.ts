// Distribution waterfall — state-and-verify LP/GP allocation (RFC 0035,
// UW_FORMAT_SPEC §4.27, protocol §VIII.10).
//
// The fourth state-and-verify structure: the document states a tier ladder
// (return of capital → preferred return → catch-up → promote splits) over a
// §4.26 dated series, and this module RECOMPUTES THE ENTIRE ALLOCATION —
// period by period, tier by tier — by the normative §VIII.10 walk, so two
// conforming engines agree on the promote. The verifier never trusts the
// stated splits; a verifier that did would verify nothing a spreadsheet
// didn't.
//
// This deliberately does NOT touch the Tier-3 calc engine, and it does not
// touch `capital_stack`: the stack is the liability side at one point in
// time (RFC 0033), this is the equity side over the hold, and the §4.24
// CS-WATERFALL-UNSUPPORTED boundary stays. Structural rules (`WF-01`…`WF-03`)
// are validator errors (validator.ts); arithmetic is verification here.
// Browser-safe; performs no I/O.

import {
  type CashFlowSeries,
  datedFlowsOf,
  xirrOf,
  type DatedFlow,
} from './cash-flow-series.js';
import {
  DEFAULT_DAY_COUNT,
  isDayCountConvention,
  parseISODate,
  yearfrac,
  type CalendarDate,
} from './calc/day-count.js';

// ─── Types (§4.27) ───────────────────────────────────────────────────────────

export type WaterfallParty = 'lp' | 'gp';

export interface WaterfallTierReturnOfCapital {
  type: 'return_of_capital';
}

export interface WaterfallTierPreferredReturn {
  type: 'preferred_return';
  /** Fraction in (0, 1). */
  rate: number;
  accrual: 'simple' | 'compound_annual';
}

export interface WaterfallTierCatchUp {
  type: 'catch_up';
  /** Share of this tier's cash going to the GP. MUST exceed target_promote. */
  gp_share: number;
  /** The GP profit share the catch-up fills toward. */
  target_promote: number;
}

export interface WaterfallTierSplit {
  type: 'split';
  lp_share: number;
  gp_share: number;
  /** Caps the tier where cumulative LP distributions reach this multiple of LP contributions. */
  until_lp_em?: number | null;
}

export type WaterfallTier =
  | WaterfallTierReturnOfCapital
  | WaterfallTierPreferredReturn
  | WaterfallTierCatchUp
  | WaterfallTierSplit;

export interface WaterfallPartyOutcomes {
  contributions?: number | null;
  distributions?: number | null;
  moic?: number | null;
  xirr?: number | null;
}

export interface WaterfallStatedOutcomes {
  lp?: WaterfallPartyOutcomes | null;
  gp?: WaterfallPartyOutcomes | null;
  promote_total?: number | null;
  profit_total?: number | null;
}

export interface WaterfallScheduleCell {
  tier: number;
  lp?: number | null;
  gp?: number | null;
}

export interface WaterfallScheduleRow {
  date: string;
  by_tier: WaterfallScheduleCell[];
}

/** The `distribution_waterfall` section content (UW_FORMAT_SPEC §4.27). */
export interface DistributionWaterfall {
  cash_flow_ref: { variant: string };
  equity_split: { lp: number; gp: number };
  tiers: WaterfallTier[];
  stated_outcomes?: WaterfallStatedOutcomes | null;
  stated_schedule?: WaterfallScheduleRow[] | null;
}

// ─── Computed allocation ─────────────────────────────────────────────────────

export interface WaterfallPartyResult {
  contributions: number;
  distributions: number;
  roc_received: number;
  pref_received: number;
  /** Undefined ratio (zero contributions) reports null, never Infinity. */
  moic: number | null;
  /** The §VIII.9.3 root, or null when the procedure refuses (no sign change). */
  xirr: number | null;
}

export interface WaterfallAllocation {
  lp: WaterfallPartyResult;
  gp: WaterfallPartyResult;
  promote_total: number;
  profit_total: number;
  /** One row per distribution date; only tiers that paid appear. */
  schedule: Array<{ date: string; by_tier: Array<{ tier: number; lp: number; gp: number }> }>;
}

export type WaterfallVerdict = 'verified' | 'failed' | 'unverifiable';

export type WaterfallIssueCode =
  | 'WF-OUTCOME-DISAGREES'
  | 'WF-SCHEDULE-DISAGREES'
  | 'WF-PROCEDURE-REFUSES'
  | 'WF-UNEVALUABLE';

export interface WaterfallIssue {
  code: WaterfallIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  /** Dotted path into stated_outcomes / stated_schedule this anchors to. */
  field?: string;
  expected?: string;
  actual?: string;
}

export interface WaterfallVerification {
  verdict: WaterfallVerdict;
  issues: WaterfallIssue[];
}

// ─── Quantization (§VIII.9.4 quanta, the sibling verifiers' posture) ─────────

export const WATERFALL_VERIFY_DECIMALS = Object.freeze({
  currency: 2,
  rate: 6,
  ratio: 4,
} as const);

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  const scaled = value * f;
  return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / f;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── The §VIII.10 walk ───────────────────────────────────────────────────────

interface PartyState {
  unreturned: number;
  accrued_pref: number;
  contributions: number;
  distributions: number;
  roc_received: number;
  pref_received: number;
  flows: DatedFlow[];
}

function newParty(): PartyState {
  return {
    unreturned: 0,
    accrued_pref: 0,
    contributions: 0,
    distributions: 0,
    roc_received: 0,
    pref_received: 0,
    flows: [],
  };
}

/**
 * Recompute the full allocation by the normative §VIII.10 walk. The caller
 * supplies a structurally valid series and a WF-01-clean waterfall (structure
 * is validation); this function still returns `null` rather than throwing
 * when either is unusable, so the verifier can report `unverifiable`.
 */
export function computeWaterfall(
  waterfall: DistributionWaterfall,
  series: CashFlowSeries,
): WaterfallAllocation | null {
  const rows = series.series;
  const flows = datedFlowsOf(series);
  if (flows === null) return null;
  const convention = series.day_count ?? DEFAULT_DAY_COUNT;
  if (!isDayCountConvention(convention)) return null;

  const split = waterfall.equity_split;
  if (!split || !isNum(split.lp) || !isNum(split.gp)) return null;
  const tiers = waterfall.tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const pref = tiers.find((t): t is WaterfallTierPreferredReturn => t?.type === 'preferred_return');

  const lp = newParty();
  const gp = newParty();
  const parties: Array<[WaterfallParty, PartyState, number]> = [
    ['lp', lp, split.lp],
    ['gp', gp, split.gp],
  ];
  const schedule: WaterfallAllocation['schedule'] = [];

  let prevDate: CalendarDate | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseISODate(row.date);
    if (date === null) return null;

    // 1. Accrue first — pairwise yearfrac per §VIII.10, never differences of
    // anchor fractions (30/360us is not additive).
    if (pref && prevDate !== null) {
      const dt = yearfrac(prevDate, date, convention);
      for (const [, p] of parties.map(([n, s]) => [n, s] as const)) {
        if (dt > 0) {
          if (pref.accrual === 'simple') {
            p.accrued_pref += p.unreturned * pref.rate * dt;
          } else {
            p.accrued_pref += (p.accrued_pref + p.unreturned) * ((1 + pref.rate) ** dt - 1);
          }
        }
      }
    }
    prevDate = date;

    const t = flows[i]!.t;
    const amount = row.amount;

    // 2. Contributions.
    if (amount < 0) {
      for (const [, p, share] of parties) {
        const portion = -amount * share;
        if (portion === 0) continue;
        p.unreturned += portion;
        p.contributions += portion;
        p.flows.push({ t, amount: -portion });
      }
      continue;
    }
    if (amount === 0) continue;

    // 3. Distributions fill the ladder.
    let remaining = amount;
    const byTier: Array<{ tier: number; lp: number; gp: number }> = [];
    // Profit = distributions above returned capital. Pref receipts COUNT as
    // profit — excluding them makes a catch-up that follows the pref tier
    // have capacity zero forever (the RFC's original wording had exactly
    // that bug; recorded as an erratum). `promote_total` still excludes the
    // GP's own pref: the promote is what the GP earns beyond its co-invest
    // return.
    const profitSoFar = () =>
      lp.distributions - lp.roc_received +
      gp.distributions - gp.roc_received;
    const gpProfit = () => gp.distributions - gp.roc_received;

    for (let ti = 0; ti < tiers.length && remaining > 0; ti++) {
      const tier = tiers[ti]!;
      let lpPay = 0;
      let gpPay = 0;

      switch (tier.type) {
        case 'return_of_capital': {
          const cap = lp.unreturned + gp.unreturned;
          const pay = Math.min(remaining, cap);
          if (pay <= 0 || cap <= 0) break;
          lpPay = pay * (lp.unreturned / cap);
          gpPay = pay - lpPay;
          lp.unreturned -= lpPay;
          gp.unreturned -= gpPay;
          lp.roc_received += lpPay;
          gp.roc_received += gpPay;
          break;
        }
        case 'preferred_return': {
          const cap = lp.accrued_pref + gp.accrued_pref;
          const pay = Math.min(remaining, cap);
          if (pay <= 0 || cap <= 0) break;
          lpPay = pay * (lp.accrued_pref / cap);
          gpPay = pay - lpPay;
          lp.accrued_pref -= lpPay;
          gp.accrued_pref -= gpPay;
          lp.pref_received += lpPay;
          gp.pref_received += gpPay;
          break;
        }
        case 'catch_up': {
          const denom = tier.gp_share - tier.target_promote;
          if (!(denom > 0)) return null; // WF-01 grammar; unreachable when validated
          const cap = Math.max(0, (tier.target_promote * profitSoFar() - gpProfit()) / denom);
          const pay = Math.min(remaining, cap);
          if (pay <= 0) break;
          gpPay = pay * tier.gp_share;
          lpPay = pay - gpPay;
          break;
        }
        case 'split': {
          let cap = Number.POSITIVE_INFINITY;
          if (tier.until_lp_em != null) {
            if (!(tier.lp_share > 0)) break; // capped tier paying LP nothing: cap 0
            cap = Math.max(0, tier.until_lp_em * lp.contributions - lp.distributions) / tier.lp_share;
          }
          const pay = Math.min(remaining, cap);
          if (pay <= 0) break;
          lpPay = pay * tier.lp_share;
          gpPay = pay - lpPay;
          break;
        }
        default:
          return null;
      }

      const pay = lpPay + gpPay;
      if (pay <= 0) continue;
      lp.distributions += lpPay;
      gp.distributions += gpPay;
      if (lpPay !== 0) lp.flows.push({ t, amount: lpPay });
      if (gpPay !== 0) gp.flows.push({ t, amount: gpPay });
      byTier.push({ tier: ti, lp: lpPay, gp: gpPay });
      remaining -= pay;
    }

    if (remaining > 1e-9 * amount) {
      // No uncapped terminal split absorbed the residue — WF-01 grammar;
      // unreachable when validated, refused rather than silently dropped.
      return null;
    }
    if (byTier.length > 0) schedule.push({ date: row.date, by_tier: byTier });
  }

  const partyResult = (p: PartyState): WaterfallPartyResult => {
    let xirr: number | null = null;
    try {
      xirr = p.flows.length >= 2 ? xirrOf(p.flows) : null;
    } catch {
      xirr = null; // §VIII.9.3 refusal — reported as null; the verifier decides severity
    }
    return {
      contributions: p.contributions,
      distributions: p.distributions,
      roc_received: p.roc_received,
      pref_received: p.pref_received,
      moic: p.contributions > 0 ? p.distributions / p.contributions : null,
      xirr,
    };
  };

  return {
    lp: partyResult(lp),
    gp: partyResult(gp),
    promote_total: gp.distributions - gp.roc_received - gp.pref_received,
    profit_total:
      lp.distributions + gp.distributions - lp.contributions - gp.contributions,
    schedule,
  };
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Recompute the allocation and compare every stated figure, three-state:
 *   - a stated outcome or schedule cell disagrees beyond its quantum, or a
 *     stated xirr the §VIII.9.3 procedure refuses → `failed`
 *   - the referenced series is missing/invalid, or a stated ratio is
 *     undefined (zero contributions) → `unverifiable`
 *   - otherwise → `verified`
 *
 * `series` is the resolved §4.26 variant the waterfall's `cash_flow_ref`
 * names; pass `null` when it does not resolve (the WF-02 situation reaching
 * a verifier rather than the validator).
 */
export function verifyWaterfall(
  waterfall: DistributionWaterfall,
  series: CashFlowSeries | null,
): WaterfallVerification {
  const issues: WaterfallIssue[] = [];
  const stated = waterfall.stated_outcomes;
  const statedSchedule = waterfall.stated_schedule;
  const hasClaims =
    (stated != null && Object.keys(stated).length > 0) ||
    (statedSchedule != null && statedSchedule.length > 0);
  if (!hasClaims) return { verdict: 'verified', issues };

  const allocation = series ? computeWaterfall(waterfall, series) : null;
  if (allocation === null) {
    issues.push({
      code: 'WF-UNEVALUABLE',
      severity: 'indeterminate',
      message: series
        ? 'The waterfall or its referenced series is structurally unusable (WF-01/CF-01/CF-02), so stated figures cannot be verified.'
        : 'cash_flow_ref does not resolve to a series (WF-02), so stated figures cannot be verified.',
    });
    return { verdict: 'unverifiable', issues };
  }

  const dp = WATERFALL_VERIFY_DECIMALS;
  const checkCurrency = (field: string, claim: unknown, actual: number) => {
    if (!isNum(claim)) return;
    const want = roundTo(claim, dp.currency);
    const got = roundTo(actual, dp.currency);
    if (want !== got) {
      issues.push({
        code: 'WF-OUTCOME-DISAGREES',
        severity: 'failure',
        field,
        message: `${field} states ${claim} but §VIII.10 recomputes to ${got}.`,
        expected: String(want),
        actual: String(got),
      });
    }
  };

  for (const party of ['lp', 'gp'] as const) {
    const claim = stated?.[party];
    if (!claim) continue;
    const actual = allocation[party];
    checkCurrency(`stated_outcomes.${party}.contributions`, claim.contributions, actual.contributions);
    checkCurrency(`stated_outcomes.${party}.distributions`, claim.distributions, actual.distributions);
    if (isNum(claim.moic)) {
      if (actual.moic === null) {
        issues.push({
          code: 'WF-UNEVALUABLE',
          severity: 'indeterminate',
          field: `stated_outcomes.${party}.moic`,
          message: `stated_outcomes.${party}.moic is stated but ${party} has no contributions, so the multiple is undefined and cannot be verified.`,
        });
      } else {
        const want = roundTo(claim.moic, dp.ratio);
        const got = roundTo(actual.moic, dp.ratio);
        if (want !== got) {
          issues.push({
            code: 'WF-OUTCOME-DISAGREES',
            severity: 'failure',
            field: `stated_outcomes.${party}.moic`,
            message: `stated_outcomes.${party}.moic states ${claim.moic} but recomputes to ${got}.`,
            expected: String(want),
            actual: String(got),
          });
        }
      }
    }
    if (isNum(claim.xirr)) {
      if (actual.xirr === null) {
        issues.push({
          code: 'WF-PROCEDURE-REFUSES',
          severity: 'failure',
          field: `stated_outcomes.${party}.xirr`,
          message: `stated_outcomes.${party}.xirr states a value but the §VIII.9.3 procedure refuses ${party}'s recomputed flows (no sign change or no bracketed root) — the document asserts a number the procedure cannot produce.`,
        });
      } else {
        const want = roundTo(claim.xirr, dp.rate);
        const got = roundTo(actual.xirr, dp.rate);
        if (want !== got) {
          issues.push({
            code: 'WF-OUTCOME-DISAGREES',
            severity: 'failure',
            field: `stated_outcomes.${party}.xirr`,
            message: `stated_outcomes.${party}.xirr states ${claim.xirr} but §VIII.9.3 recomputes to ${got}.`,
            expected: String(want),
            actual: String(got),
          });
        }
      }
    }
  }
  checkCurrency('stated_outcomes.promote_total', stated?.promote_total, allocation.promote_total);
  checkCurrency('stated_outcomes.profit_total', stated?.profit_total, allocation.profit_total);

  // Schedule cells: an absent cell reads 0, both directions (§VIII.10.5).
  if (statedSchedule != null && statedSchedule.length > 0) {
    const recomputedByDate = new Map<string, Map<number, { lp: number; gp: number }>>();
    for (const row of allocation.schedule) {
      const m = new Map<number, { lp: number; gp: number }>();
      for (const c of row.by_tier) m.set(c.tier, { lp: c.lp, gp: c.gp });
      recomputedByDate.set(row.date, m);
    }
    const tierCount = waterfall.tiers.length;
    const dates = new Set<string>([
      ...statedSchedule.map((r) => r.date),
      ...allocation.schedule.map((r) => r.date),
    ]);
    for (const date of [...dates].sort()) {
      const statedRow = statedSchedule.find((r) => r.date === date);
      const statedCells = new Map<number, { lp: number; gp: number }>();
      for (const c of statedRow?.by_tier ?? []) {
        statedCells.set(c.tier, { lp: isNum(c.lp) ? c.lp : 0, gp: isNum(c.gp) ? c.gp : 0 });
      }
      const actualCells = recomputedByDate.get(date) ?? new Map();
      for (let ti = 0; ti < tierCount; ti++) {
        const want = statedCells.get(ti) ?? { lp: 0, gp: 0 };
        const got = actualCells.get(ti) ?? { lp: 0, gp: 0 };
        for (const party of ['lp', 'gp'] as const) {
          const w = roundTo(want[party], dp.currency);
          const g = roundTo(got[party], dp.currency);
          if (w !== g) {
            issues.push({
              code: 'WF-SCHEDULE-DISAGREES',
              severity: 'failure',
              field: `stated_schedule[${date}].tier[${ti}].${party}`,
              message: `Schedule ${date} tier ${ti} ${party} states ${w} but §VIII.10 recomputes to ${g}.`,
              expected: String(w),
              actual: String(g),
            });
          }
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
