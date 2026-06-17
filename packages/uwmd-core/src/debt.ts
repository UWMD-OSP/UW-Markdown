// Deterministic debt-service footing — the loan terms (amount, rate, amortization,
// IO) are the inputs; monthly and annual debt service foot from them. Same role
// for the debt_structure section that deriveRentRoll / deriveOperatingStatement
// play for their sections: one source of truth so the editor, CLI, and Excel
// converter never disagree (invariant #4).
//
// This is plain deterministic arithmetic — the standard mortgage payment formula,
// not AI math (invariant #1). The pmt() here is byte-identical to the calc
// engine's `pmt` builtin (calc/builtins.ts) so a footed annual_debt_service equals
// what `evaluateCalc` would produce from the same inputs.
//
// Conventions:
//  - Amortizing loan: monthly_debt_service = pmt(rate/12, amort_years*12, loan);
//    annual_debt_service = monthly * 12. This is the *fully-amortizing* payment —
//    the conservative figure DSCR/debt-yield are sized against — even when the
//    loan carries an initial interest-only period.
//  - Interest-only loan: annual_debt_service = loan * rate; monthly = annual / 12.
//  - Field-name tolerance: the rate is read from the first present of several
//    conventions (interest_rate, all_in_rate_at_close, note_rate_at_close, …);
//    IO is detected from amortization === "interest_only" or a missing/zero
//    amortization term.

import { collector, numOrNull, type DerivedField } from './derived.js';

type Row = Record<string, unknown>;

const num = numOrNull;

export interface DebtDerivation {
  fields: DerivedField[];
  /** True when the loan is interest-only (no amortizing payment). */
  interestOnly: boolean;
}

const RATE_KEYS = [
  'interest_rate',
  'all_in_rate_at_close',
  'note_rate_at_close',
  'interest_rate_at_close',
];
const AMORT_KEYS = ['amortization_years', 'amortization_period_years'];

function firstNum(row: Row, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

/** Standard mortgage payment — positive periodic payment for present value `pv`
 *  at periodic `rate` over `n` periods. Identical to calc/builtins.ts `pmt`. */
function pmt(rate: number, n: number, pv: number): number {
  if (n === 0) return 0;
  if (rate === 0) return pv / n;
  return (pv * rate) / (1 - (1 + rate) ** -n);
}

/** Is this an interest-only loan (no amortizing payment)? */
function isInterestOnly(content: Row): boolean {
  const amortStr = content['amortization'];
  if (typeof amortStr === 'string' && amortStr.toLowerCase().replace(/[\s-]/g, '_') === 'interest_only') {
    return true;
  }
  const amortYears = firstNum(content, AMORT_KEYS);
  return amortYears == null || amortYears <= 0;
}

/** Foot a debt_structure content block. Pure: never mutates `content`. */
export function deriveDebt(content: Row): DebtDerivation {
  const c = collector();
  const loan = num(content['loan_amount']);
  const rate = firstNum(content, RATE_KEYS);
  const interestOnly = isInterestOnly(content);

  if (loan == null || rate == null) {
    return { fields: c.fields, interestOnly };
  }

  let monthly: number;
  let annual: number;
  if (interestOnly) {
    // Interest-only: annual = loan × rate is the authoritative figure; monthly
    // is just annual / 12 (rounded for whole-dollar display).
    annual = loan * rate;
    monthly = annual / 12;
  } else {
    // Amortizing: files store a whole-dollar monthly payment with annual = 12 ×
    // that, so the two always foot together; round monthly first.
    const amortYears = firstNum(content, AMORT_KEYS) ?? 0;
    monthly = Math.round(pmt(rate / 12, amortYears * 12, loan));
    annual = monthly * 12;
  }

  c.add('monthly_debt_service', 'Monthly Debt Service', 'currency', monthly);
  c.add('annual_debt_service', 'Annual Debt Service', 'currency', annual);

  return { fields: c.fields, interestOnly };
}
