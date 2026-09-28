// Reserve accounts — state-and-verify custodial roll-forwards (RFC 0064,
// UW_FORMAT_SPEC §4.28, protocol §VIII.9.7).
//
// A document states, per property reserve account and per stated period, the
// opening balance, the dated movements (contributions in, draws out to fund a
// separately stated gross expenditure, releases out to the owner) and the
// ending balance. This module carries the one arithmetic identity the section
// has —
//
//   ending = opening + Σ contributions − Σ draws − Σ releases
//
// — and the inter-period continuity check, and recomputes each stated ending
// balance to the same three-state verdict `verifyCapitalStack`,
// `verifyLeaseUpSchedule` and `verifyCashFlowSeries` return.
//
// Two things this module deliberately does not do. It never nets a draw
// against the gross TI/LC, capex or expense the draw funded — the account
// statement is evidence about cash custody, not a second expenditure ledger —
// and it never turns a verified statement into an RFC 0045 assembly input: the
// assembler's `reserve_spending_excluded` refusal is untouched by anything
// here. Structural rules (`RSV-01`…`RSV-07`) are validator errors that reuse
// this module's arithmetic so the two surfaces cannot disagree about a sum.
// Browser-safe; performs no I/O.

import { CASH_FLOW_VERIFY_DECIMALS, quantizeAtDecimals } from './cash-flow-series.js';
import { actualDays, parseISODate } from './calc/day-count.js';

// ─── Types (§4.28) ───────────────────────────────────────────────────────────

/**
 * Account classes. `property_reserve` is the only class this contract
 * verifies; `lender_reserve` is reserved and refused (`RSV-02`) so a lender-held
 * financing escrow cannot be verified as if it were owner-restricted property
 * cash, and so a later financing contract does not collide with adopter usage.
 */
export const RESERVE_ACCOUNT_CLASSES = Object.freeze(['property_reserve'] as const);
export const RESERVED_RESERVE_ACCOUNT_CLASSES = Object.freeze(['lender_reserve'] as const);

export type ReserveAccountClass = (typeof RESERVE_ACCOUNT_CLASSES)[number];

/**
 * Movement kinds. Closed: an amount whose kind is not one of these three —
 * interest credited by the bank, a fee, a transfer between two accounts — has
 * no place in this identity and refuses (`RSV-01`) rather than being forced
 * into the nearest kind.
 */
export const RESERVE_MOVEMENT_KINDS = Object.freeze(['contribution', 'draw', 'release'] as const);

export type ReserveMovementKind = (typeof RESERVE_MOVEMENT_KINDS)[number];

/** One dated movement. Amounts are nonnegative magnitudes; the kind carries the sign. */
export interface ReserveMovement {
  kind: ReserveMovementKind;
  /** Nonnegative magnitude in the account's currency. */
  amount: number;
  /** ISO-8601 `YYYY-MM-DD`, inside the statement's period (`RSV-04`). */
  date: string;
  label?: string | null;
}

/** One stated period of one account. */
export interface ReserveStatement {
  /** ISO-8601 `YYYY-MM-DD`; the first day of the period. */
  period_start: string;
  /** ISO-8601 `YYYY-MM-DD`; the last day of the period, inclusive. */
  period_end: string;
  /** Cash held at the start of the period. Nonnegative. */
  opening_balance: number;
  /** May be empty: a quiet period is a real statement. */
  movements: ReserveMovement[];
  /** Cash held at the end of the period, as stated. Verified, never derived. */
  ending_balance: number;
}

export interface ReserveAccount {
  /** Stable author-stated identity, unique within the section (`RSV-03`). */
  account_id: string;
  class: ReserveAccountClass;
  /** What the account is for ("Replacement reserve", "TI/LC reserve"). */
  purpose: string;
  /** Optional uppercase three-letter currency identity (RFC 0046 posture). */
  currency_code?: string | null;
  /** Ordered, non-overlapping periods (`RSV-03`). */
  statements: ReserveStatement[];
}

/** The `reserve_accounts` section content (UW_FORMAT_SPEC §4.28). */
export interface ReserveAccountsSection {
  label?: string | null;
  accounts: ReserveAccount[];
}

export type ReserveAccountVerdict = 'verified' | 'failed' | 'unverifiable';

export type ReserveAccountIssueCode =
  /** A stated ending balance disagrees with the roll-forward beyond the currency quantum. */
  | 'RSV-BALANCE-DISAGREES'
  /** A consecutive statement opens at a balance other than its predecessor's stated ending. */
  | 'RSV-CONTINUITY-DISAGREES'
  /** A statement cannot be rolled forward from what the document states — undecided, never zero. */
  | 'RSV-UNEVALUABLE';

export interface ReserveAccountIssue {
  code: ReserveAccountIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  account_id?: string;
  /** Zero-based index into the account's `statements`. */
  statement_index?: number;
  expected?: string;
  actual?: string;
}

/** The roll-forward of one statement, reported beside the stated figure. */
export interface ReserveStatementRollForward {
  period_start: string;
  period_end: string;
  opening_balance: number;
  contributions: number;
  draws: number;
  releases: number;
  /** `opening + contributions − draws − releases`, quantized at the currency quantum. */
  computed_ending_balance: number;
  stated_ending_balance: number;
  /**
   * `true` when this statement begins the day after the previous one ends, so
   * `RSV-06` continuity applies. `false` on the first statement and across a gap
   * — a gap makes no claim and is never filled.
   */
  consecutive: boolean;
  verdict: ReserveAccountVerdict;
}

export interface ReserveAccountRollForward {
  account_id: string;
  statements: ReserveStatementRollForward[];
  verdict: ReserveAccountVerdict;
}

export interface ReserveAccountsVerification {
  verdict: ReserveAccountVerdict;
  accounts: ReserveAccountRollForward[];
  issues: ReserveAccountIssue[];
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

const CURRENCY_DECIMALS = CASH_FLOW_VERIFY_DECIMALS.currency;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Sum of the movements of one kind. Every stated movement is added exactly once. */
export function sumMovements(movements: readonly ReserveMovement[], kind: ReserveMovementKind): number {
  let total = 0;
  for (const m of movements) if (m.kind === kind) total += m.amount;
  return total;
}

/**
 * The §VIII.9.7 identity, quantized at the currency quantum with the §VIII.5
 * half-away-from-zero rule. This is the one place the sum is written; the
 * validator's `RSV-05` and the verifier both call it.
 */
export function rollForwardEndingBalance(statement: {
  opening_balance: number;
  movements: readonly ReserveMovement[];
}): number {
  const { movements } = statement;
  const ending = statement.opening_balance
    + sumMovements(movements, 'contribution')
    - sumMovements(movements, 'draw')
    - sumMovements(movements, 'release');
  return quantizeAtDecimals(ending, CURRENCY_DECIMALS);
}

/**
 * `true` when `next` begins the calendar day after `prev` ends. `null` when
 * either date is outside the grammar — the caller reports that as structure,
 * not as a continuity finding.
 */
export function statementsConsecutive(prevEnd: string, nextStart: string): boolean | null {
  const a = parseISODate(prevEnd);
  const b = parseISODate(nextStart);
  if (!a || !b) return null;
  return actualDays(a, b) === 1;
}

/** Two currency amounts agree when they quantize to the same value. */
function agrees(a: number, b: number): boolean {
  return quantizeAtDecimals(a, CURRENCY_DECIMALS) === quantizeAtDecimals(b, CURRENCY_DECIMALS);
}

// ─── Verifier ────────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * A statement is evaluable when its balances are finite and every movement has
 * a registered kind and a finite amount. Anything less is `RSV-UNEVALUABLE`
 * here and an `RSV-01` error in the validator; the verifier never guesses at a
 * missing figure.
 */
function evaluable(s: unknown): s is ReserveStatement {
  if (!isObj(s)) return false;
  if (!isNum(s['opening_balance']) || !isNum(s['ending_balance'])) return false;
  if (!Array.isArray(s['movements'])) return false;
  return (s['movements'] as unknown[]).every((m) =>
    isObj(m)
    && (RESERVE_MOVEMENT_KINDS as readonly unknown[]).includes(m['kind'])
    && isNum(m['amount']));
}

function worst(verdicts: readonly ReserveAccountVerdict[]): ReserveAccountVerdict {
  if (verdicts.includes('failed')) return 'failed';
  if (verdicts.includes('unverifiable')) return 'unverifiable';
  return 'verified';
}

/**
 * Recompute every stated ending balance and every consecutive opening balance
 * in a `reserve_accounts` section. Three-state per statement, per account and
 * overall: `failed` when a stated figure disagrees with the identity at the
 * currency quantum, `unverifiable` when a statement cannot be rolled forward
 * from what is stated, `verified` otherwise. Never mutates its input, never
 * fills a gap, never invents a period.
 */
export function verifyReserveAccounts(section: ReserveAccountsSection): ReserveAccountsVerification {
  const issues: ReserveAccountIssue[] = [];
  const accounts: ReserveAccountRollForward[] = [];
  const raw = (section as unknown as Record<string, unknown>)['accounts'];
  if (!Array.isArray(raw)) {
    issues.push({ code: 'RSV-UNEVALUABLE', severity: 'indeterminate',
      message: 'accounts is not an array; nothing can be rolled forward' });
    return { verdict: 'unverifiable', accounts, issues };
  }

  for (const acct of raw as unknown[]) {
    const account_id = isObj(acct) && typeof acct['account_id'] === 'string' ? acct['account_id'] : '';
    const stmts = isObj(acct) && Array.isArray(acct['statements']) ? (acct['statements'] as unknown[]) : null;
    if (stmts === null) {
      issues.push({ code: 'RSV-UNEVALUABLE', severity: 'indeterminate', account_id,
        message: `account ${JSON.stringify(account_id)} has no statements array` });
      accounts.push({ account_id, statements: [], verdict: 'unverifiable' });
      continue;
    }

    const rolled: ReserveStatementRollForward[] = [];
    let prev: ReserveStatement | null = null;
    for (const [i, s] of stmts.entries()) {
      if (!evaluable(s)) {
        issues.push({ code: 'RSV-UNEVALUABLE', severity: 'indeterminate', account_id, statement_index: i,
          message: `account ${JSON.stringify(account_id)} statement ${i} cannot be rolled forward from what is stated` });
        rolled.push({
          period_start: isObj(s) && typeof s['period_start'] === 'string' ? s['period_start'] : '',
          period_end: isObj(s) && typeof s['period_end'] === 'string' ? s['period_end'] : '',
          opening_balance: Number.NaN, contributions: Number.NaN, draws: Number.NaN, releases: Number.NaN,
          computed_ending_balance: Number.NaN, stated_ending_balance: Number.NaN,
          consecutive: false, verdict: 'unverifiable',
        });
        prev = null;
        continue;
      }
      const computed = rollForwardEndingBalance(s);
      const consecutive = prev !== null && statementsConsecutive(prev.period_end, s.period_start) === true;
      let verdict: ReserveAccountVerdict = 'verified';
      if (!agrees(computed, s.ending_balance)) {
        verdict = 'failed';
        issues.push({
          code: 'RSV-BALANCE-DISAGREES', severity: 'failure', account_id, statement_index: i,
          message: `account ${JSON.stringify(account_id)} statement ${i} (${s.period_start}…${s.period_end}) states ending_balance ${s.ending_balance}; the roll-forward gives ${computed}`,
          expected: String(computed),
          actual: String(quantizeAtDecimals(s.ending_balance, CURRENCY_DECIMALS)),
        });
      }
      if (consecutive && prev !== null && !agrees(prev.ending_balance, s.opening_balance)) {
        verdict = 'failed';
        issues.push({
          code: 'RSV-CONTINUITY-DISAGREES', severity: 'failure', account_id, statement_index: i,
          message: `account ${JSON.stringify(account_id)} statement ${i} opens at ${s.opening_balance} but the consecutive prior statement ended at ${prev.ending_balance}`,
          expected: String(quantizeAtDecimals(prev.ending_balance, CURRENCY_DECIMALS)),
          actual: String(quantizeAtDecimals(s.opening_balance, CURRENCY_DECIMALS)),
        });
      }
      rolled.push({
        period_start: s.period_start,
        period_end: s.period_end,
        opening_balance: s.opening_balance,
        contributions: sumMovements(s.movements, 'contribution'),
        draws: sumMovements(s.movements, 'draw'),
        releases: sumMovements(s.movements, 'release'),
        computed_ending_balance: computed,
        stated_ending_balance: s.ending_balance,
        consecutive,
        verdict,
      });
      prev = s;
    }
    accounts.push({ account_id, statements: rolled, verdict: worst(rolled.map((r) => r.verdict)) });
  }

  return { verdict: worst(accounts.map((a) => a.verdict)), accounts, issues };
}
