// Tier-3 Calc Host — the quantization boundary.
// Normative model: UW_PROTOCOL_v1.md §VIII.5 ("Numeric model").
//
// The engine evaluates in IEEE-754 binary64 and does *not* round intermediate
// values. A calculation's **reported** value is quantized here, at exactly one
// place, on its way out of `evaluateCalc()`.
//
// Why this file has to exist. Before RFC 0023 there was no quantization step at
// all, and two mechanisms disagreed about the same numbers: `receipts.ts`
// compared a stated result against recomputation with a 1e-6 tolerance, while
// `results_digest` hashed those same raw doubles bit-exactly. A last-ULP
// difference therefore passed the tolerant check and failed the exact one, and
// the failure was reported as *corruption*. Quantizing before either check runs
// removes the disagreement by construction rather than by loosening the digest.
//
// The other consumer is Excel. `packs/excel-emit.ts` wraps each emitted formula
// in `ROUND(expr, round_to)` using the same decimal places, which is why the
// Excel↔evaluator invariant can now be asserted as *exact* equality instead of
// agreement to six decimals.

import { CalcError } from './errors.js';

/**
 * Largest `round_to` a declaration may state. Beyond ~15 significant decimal
 * digits a binary64 has no fractional information left to quantize, so a larger
 * value would describe a precision the representation cannot carry.
 */
export const MAX_ROUND_TO = 12;

/**
 * Normative default decimal places by declared `unit`, applied when a
 * calculation omits `round_to`. Table per UW_PROTOCOL_v1.md §VIII.5.
 *
 * The values follow from what the unit means rather than from taste. Money is
 * quantized to cents. A ratio (`x`, e.g. DSCR) is quoted to four places by
 * every lender term sheet the format targets. Rates are *fractions* everywhere
 * in this repo (`0.0551`, not `5.51`), so six places on a fraction is four
 * places on the percentage a human reads — the same precision, one unit shift.
 */
export const DEFAULT_ROUND_TO_BY_UNIT: Readonly<Record<string, number>> = Object.freeze({
  $: 2,
  '%': 6,
  x: 4,
});

/**
 * Default for a calculation whose `unit` is absent or not in the table. Six
 * places is the residual case, chosen to match the rate default rather than to
 * invent a second convention.
 */
export const DEFAULT_ROUND_TO = 6;

/**
 * The effective decimal places for a calculation declaration: its own
 * `round_to` when stated, otherwise the unit default, otherwise
 * {@link DEFAULT_ROUND_TO}. Total by construction — §VIII.5 deliberately has no
 * "unspecified precision" mode, because two implementers reading an
 * unspecified spec do not produce the same receipt digest.
 */
export function resolveRoundTo(decl: { unit?: string; round_to?: number }): number {
  if (decl.round_to !== undefined) return decl.round_to;
  if (decl.unit !== undefined) {
    const byUnit = DEFAULT_ROUND_TO_BY_UNIT[decl.unit];
    if (byUnit !== undefined) return byUnit;
  }
  return DEFAULT_ROUND_TO;
}

/**
 * Quantize `n` to `decimals` decimal places, half away from zero.
 *
 * Half-away-from-zero is the rule Excel's `ROUND` implements, which is the
 * whole reason parity is achievable: `-2.5` quantizes to `-3`, not to `-2` the
 * way JavaScript's `Math.round` would give.
 *
 * The scaling goes through a decimal string rather than a multiply by `10**d`,
 * and that detail is load-bearing. Multiplying reintroduces exactly the binary
 * artifact the caller asked to remove: `1.005 * 100` is `100.49999999999999`,
 * so the naive form quantizes `1.005` to `1.00` while Excel gives `1.01` — a
 * silent, off-by-a-cent divergence in the one direction the format promises
 * agreement. `Number('1.005e2')` is correctly rounded from the decimal literal
 * and yields `100.5` exactly, so both engines land on `1.01`.
 *
 * Non-finite input is a programmer error at this layer: the evaluator rejects
 * division by zero (`CALC-DIV-ZERO`) and the canonicalizer refuses to serialize
 * a non-finite number, so an Infinity reaching here means an upstream guard was
 * removed.
 */
export function quantizeDecimal(n: number, decimals: number): number {
  // Negative `decimals` quantizes to tens/hundreds, matching Excel's
  // `ROUND(1234, -2) = 1200`. A declaration's `round_to` is separately
  // constrained to be non-negative by the manifest schema, so the wider domain
  // here exists only for the `round()` builtin, which has always accepted it.
  if (!Number.isInteger(decimals) || decimals < -MAX_ROUND_TO || decimals > MAX_ROUND_TO) {
    throw new CalcError(
      'CALC-TYPE-001',
      `quantize: decimals must be an integer in [${-MAX_ROUND_TO}, ${MAX_ROUND_TO}], got ${decimals}.`,
    );
  }
  if (!Number.isFinite(n)) {
    throw new CalcError('CALC-TYPE-001', `quantize: cannot quantize non-finite number ${n}.`);
  }
  const sign = n < 0 ? -1 : 1;
  const magnitude = Math.abs(n);

  const shifted = Number(`${magnitude}e${decimals}`);

  // An integral shifted value has no fractional part to round, so `n` is
  // already quantized and is returned unchanged. This is the correct answer
  // rather than a fallback, and it subsumes the large-magnitude cases: past
  // 2^53 every double is integral, which is also the range where
  // `${magnitude}` renders exponentially ("1e+21") and the string shift could
  // not reassemble it. Guarding on integrality rather than on a magnitude
  // threshold also avoids `MAX_SAFE_INTEGER + 0.5` rounding *up* to
  // `MAX_SAFE_INTEGER + 1` before `Math.floor` ever sees it.
  const result = !Number.isFinite(shifted) || Number.isInteger(shifted)
    ? n
    : sign * Number(`${Math.floor(shifted + 0.5)}e${-decimals}`);

  // `-0` would otherwise survive two ways: as input, and from a small negative
  // that quantizes to zero. The exact canonicalizer already renders it as "0",
  // but returning it makes `Object.is(result, 0)` false for callers doing their
  // own comparisons, so the sign is dropped once here rather than at each one.
  return result === 0 ? 0 : result;
}
