// Tier-3 Calc Host — built-in function implementations.
// Signatures and semantics per UW_PROTOCOL_v1.md §VIII.3.

import { CalcError } from './errors.js';
import { quantizeDecimal } from './quantize.js';

export type CalcValue = number | string | boolean | null;

export type Builtin = (args: CalcValue[]) => CalcValue;

function asNumberOrNull(v: CalcValue, fnName: string): number | null {
  if (v === null) return null;
  if (typeof v === 'number') return v;
  throw new CalcError('CALC-TYPE-001', `${fnName}: expected number or null, got ${typeof v}.`);
}

function asNumber(v: CalcValue, fnName: string): number {
  if (typeof v === 'number') return v;
  throw new CalcError('CALC-TYPE-001', `${fnName}: expected number, got ${v === null ? 'null' : typeof v}.`);
}

// `irr` search parameters — normative, protocol §VIII.3 (RFC 0024). These are
// not tuning knobs: two engines return the same root only if both use these
// exact values in this exact order. Changing one is a protocol change.
/** Low end of the IRR search interval: -99.9%. */
export const IRR_BRACKET_LO = -0.999;
/** High end of the IRR search interval: 1000%. */
export const IRR_BRACKET_HI = 10.0;
/** Stop when the NPV at the midpoint is this close to zero. */
export const IRR_VALUE_TOL = 1e-9;
/** Stop when the remaining half-interval is this narrow. */
export const IRR_INTERVAL_TOL = 1e-12;
/** Hard iteration cap; exhausting it raises `CALC-IRR-DIVERGE`. */
export const IRR_MAX_ITER = 200;

export const BUILTINS: Readonly<Record<string, Builtin>> = Object.freeze({
  // sum(...nums) — nulls treated as 0.
  sum(args) {
    let acc = 0;
    for (const a of args) {
      const n = asNumberOrNull(a, 'sum');
      acc += n ?? 0;
    }
    return acc;
  },

  // avg(...nums) — null if no non-null inputs.
  avg(args) {
    let acc = 0;
    let count = 0;
    for (const a of args) {
      const n = asNumberOrNull(a, 'avg');
      if (n !== null) { acc += n; count++; }
    }
    return count === 0 ? null : acc / count;
  },

  min(args) {
    let best: number | null = null;
    for (const a of args) {
      const n = asNumberOrNull(a, 'min');
      if (n === null) continue;
      best = best === null || n < best ? n : best;
    }
    return best;
  },

  max(args) {
    let best: number | null = null;
    for (const a of args) {
      const n = asNumberOrNull(a, 'max');
      if (n === null) continue;
      best = best === null || n > best ? n : best;
    }
    return best;
  },

  // coalesce(...args) — first non-null.
  coalesce(args) {
    for (const a of args) if (a !== null) return a;
    return null;
  },

  // if(cond, then, else)
  if(args) {
    if (args.length !== 3) {
      throw new CalcError('CALC-TYPE-001', `if: expected 3 arguments, got ${args.length}.`);
    }
    const cond = args[0];
    if (typeof cond !== 'boolean') {
      throw new CalcError('CALC-TYPE-001', `if: condition must be boolean, got ${cond === null ? 'null' : typeof cond}.`);
    }
    return cond ? args[1]! : args[2]!;
  },

  // round(num, dec) — half-away-from-zero, delegated to the single quantization
  // rule in quantize.ts so the builtin, the reported-value boundary, and the
  // Excel emitter cannot drift apart. This previously scaled by `10 ** d`, which
  // reintroduced the binary artifact it was meant to remove: `round(1.005, 2)`
  // returned 1.00 while Excel's ROUND gives 1.01. See RFC 0023.
  round(args) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `round: expected 2 arguments, got ${args.length}.`);
    }
    const num = args[0];
    const dec = args[1];
    if (num === null) return null;
    const n = asNumber(num, 'round');
    const d = asNumber(dec!, 'round');
    if (!Number.isInteger(d)) {
      throw new CalcError('CALC-TYPE-001', `round: decimals must be integer, got ${d}.`);
    }
    return quantizeDecimal(n, d);
  },

  // pmt(rate, n, pv) — standard mortgage payment formula.
  // Returns the *positive* periodic payment for a present value pv at periodic rate.
  pmt(args) {
    if (args.length !== 3) {
      throw new CalcError('CALC-TYPE-001', `pmt: expected 3 arguments (rate, n, pv), got ${args.length}.`);
    }
    const rate = asNumber(args[0]!, 'pmt');
    const n = asNumber(args[1]!, 'pmt');
    const pv = asNumber(args[2]!, 'pmt');
    if (n === 0) {
      throw new CalcError('CALC-TYPE-001', 'pmt: n must be > 0.');
    }
    if (rate === 0) return pv / n;
    return (pv * rate) / (1 - (1 + rate) ** -n);
  },

  // npv(rate, ...flows) — flow at index 0 is at t=0 (undiscounted).
  npv(args) {
    if (args.length < 2) {
      throw new CalcError('CALC-TYPE-001', `npv: expected (rate, ...flows), got ${args.length} args.`);
    }
    const rate = asNumber(args[0]!, 'npv');
    let acc = 0;
    for (let t = 0; t < args.length - 1; t++) {
      const flow = asNumber(args[t + 1]!, 'npv');
      acc += flow / (1 + rate) ** t;
    }
    return acc;
  },

  // ─── Math builtins ──────────────────────────────────────────────────────────

  // abs(num) — null propagates.
  abs(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `abs: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'abs');
    return n === null ? null : Math.abs(n);
  },

  // floor(num) — null propagates.
  floor(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `floor: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'floor');
    return n === null ? null : Math.floor(n);
  },

  // ceil(num) — null propagates.
  ceil(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `ceil: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'ceil');
    return n === null ? null : Math.ceil(n);
  },

  // sqrt(num) — null propagates; negative input → CALC-TYPE-001.
  sqrt(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `sqrt: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'sqrt');
    if (n === null) return null;
    if (n < 0) {
      throw new CalcError('CALC-TYPE-001', `sqrt: negative input ${n} produces non-real result.`);
    }
    return Math.sqrt(n);
  },

  // pow(base, exp) — null propagates.
  pow(args) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `pow: expected 2 arguments, got ${args.length}.`);
    }
    const base = asNumberOrNull(args[0]!, 'pow');
    const exp = asNumberOrNull(args[1]!, 'pow');
    if (base === null || exp === null) return null;
    const r = base ** exp;
    if (!Number.isFinite(r)) {
      throw new CalcError('CALC-TYPE-001', `pow: result is not finite (${base}^${exp}).`);
    }
    return r;
  },

  // log(num) — natural log; null propagates; non-positive → CALC-TYPE-001.
  log(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `log: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'log');
    if (n === null) return null;
    if (n <= 0) {
      throw new CalcError('CALC-TYPE-001', `log: input must be positive, got ${n}.`);
    }
    return Math.log(n);
  },

  // exp(num) — null propagates.
  exp(args) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `exp: expected 1 argument, got ${args.length}.`);
    }
    const n = asNumberOrNull(args[0]!, 'exp');
    if (n === null) return null;
    const r = Math.exp(n);
    if (!Number.isFinite(r)) {
      throw new CalcError('CALC-TYPE-001', `exp: result is not finite (exp(${n})).`);
    }
    return r;
  },

  // ─── Financial builtins ─────────────────────────────────────────────────────

  // fv(rate, n, pmt, pv?) — future value of a series of equal payments + initial pv.
  // Sign convention: returns the *positive* future value of pv invested at `rate`
  // with `pmt` deposits per period. Mirrors Excel's FV with type=0 (end of period)
  // but without Excel's signed convention.
  fv(args) {
    if (args.length < 3 || args.length > 4) {
      throw new CalcError('CALC-TYPE-001', `fv: expected (rate, n, pmt[, pv]), got ${args.length} args.`);
    }
    const rate = asNumber(args[0]!, 'fv');
    const n = asNumber(args[1]!, 'fv');
    const pmt = asNumber(args[2]!, 'fv');
    const pv = args[3] === undefined ? 0 : asNumber(args[3]!, 'fv');
    if (rate === 0) return pv + pmt * n;
    const growth = (1 + rate) ** n;
    return pv * growth + pmt * (growth - 1) / rate;
  },

  // pv(rate, n, pmt, fv?) — present value of a series of equal payments + future value.
  // Inverse of fv: returns the lump-sum today equivalent to receiving `pmt` per
  // period for `n` periods at `rate`, plus a final `fv` payoff.
  pv(args) {
    if (args.length < 3 || args.length > 4) {
      throw new CalcError('CALC-TYPE-001', `pv: expected (rate, n, pmt[, fv]), got ${args.length} args.`);
    }
    const rate = asNumber(args[0]!, 'pv');
    const n = asNumber(args[1]!, 'pv');
    const pmt = asNumber(args[2]!, 'pv');
    const fv = args[3] === undefined ? 0 : asNumber(args[3]!, 'pv');
    if (rate === 0) return pmt * n + fv;
    const discount = (1 + rate) ** -n;
    return pmt * (1 - discount) / rate + fv * discount;
  },

  // nper(rate, pmt, pv, fv?) — number of periods to pay down pv with pmt payments.
  // Unsigned convention matching pmt(): pv > 0 is the loan balance, pmt > 0 is
  // the periodic payment, fv (default 0) is the residual balloon.
  // Closed-form: pv*(1+r)^n - pmt*((1+r)^n - 1)/r = fv  →
  //              n = log((pmt - fv*r) / (pmt - pv*r)) / log(1+r).
  // Throws CALC-TYPE-001 if the equation has no real solution.
  nper(args) {
    if (args.length < 3 || args.length > 4) {
      throw new CalcError('CALC-TYPE-001', `nper: expected (rate, pmt, pv[, fv]), got ${args.length} args.`);
    }
    const rate = asNumber(args[0]!, 'nper');
    const pmt = asNumber(args[1]!, 'nper');
    const pv = asNumber(args[2]!, 'nper');
    const fv = args[3] === undefined ? 0 : asNumber(args[3]!, 'nper');
    if (rate === 0) {
      if (pmt === 0) {
        throw new CalcError('CALC-TYPE-001', 'nper: pmt must be non-zero when rate is zero.');
      }
      return (pv - fv) / pmt;
    }
    const num = pmt - fv * rate;
    const den = pmt - pv * rate;
    if (den === 0 || num / den <= 0) {
      throw new CalcError('CALC-TYPE-001', 'nper: no real solution for the given inputs.');
    }
    return Math.log(num / den) / Math.log(1 + rate);
  },

  // irr(...flows) — bracket, then bisect. Protocol §VIII.3 (RFC 0024).
  //
  // Bisection only, deliberately. The procedure is normative because two
  // conforming engines must return the *same* root, and bisection is the part
  // of this that is bit-reproducible: every step is `(lo + hi) / 2` and a
  // comparison of products, operations IEEE 754 requires to be correctly
  // rounded, in an order the spec fixes. Newton is not — its iterates depend on
  // the association order of a derivative sum that no document pins, and each
  // iterate feeds the next, so a last-ULP difference moves the returned root by
  // more than the tolerance.
  //
  // The Newton pass this replaced also searched outside the bracket it claimed:
  // `irr(-1, 20)` returned ~19.0, a 1900% return from a search documented as
  // reaching 1000%. That is now CALC-IRR-DIVERGE, per step 5.
  irr(args) {
    if (args.length < 2) {
      throw new CalcError('CALC-TYPE-001', 'irr: requires at least 2 cash flows.');
    }
    const flows = args.map((a, _i) => asNumber(a!, 'irr'));

    const npvAt = (r: number): number => {
      let acc = 0;
      for (let t = 0; t < flows.length; t++) acc += flows[t]! / (1 + r) ** t;
      return acc;
    };

    // 1. Domain. A root outside this interval is not reported.
    let lo = IRR_BRACKET_LO;
    let hi = IRR_BRACKET_HI;
    let flo = npvAt(lo);
    const fhi = npvAt(hi);

    // 2. Bracket.
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
      throw new CalcError(
        'CALC-IRR-DIVERGE',
        `irr: no sign change over the [${IRR_BRACKET_LO}, ${IRR_BRACKET_HI}] bracket (-99.9% to 1000%), so no root is reported.`,
      );
    }

    // 2a. A root sitting exactly on an endpoint is the answer, and must be
    // returned before bisecting. Bisection cannot get there: the retention test
    // is `flo * fmid < 0`, and a `flo` of exactly zero makes that product zero
    // for every `mid`, so the loop would walk the endpoint away from the very
    // root it brackets and then diverge. This is the one step §VIII.3's
    // procedure leaves implicit; see the note there.
    //
    // Reachable at `hi` — `1 + 10` is exact, so `npv(10)` can be exactly zero.
    // Effectively unreachable at `lo`: `1 + (-0.999)` is `0.001000000000000001`
    // in binary64, so `npv(lo)` for a cash flow whose true root is -99.9% lands
    // a few ULP either side of zero rather than on it, and its sign decides
    // whether the bracket holds at all. That is a property of the interval, not
    // of this code — a root "exactly at -0.999" is not a well-defined binary64
    // quantity.
    if (flo === 0) return lo;
    if (fhi === 0) return hi;

    // 3. Bisection. 4. No polish — the bisection result is the answer.
    for (let i = 0; i < IRR_MAX_ITER; i++) {
      const mid = (lo + hi) / 2;
      const fmid = npvAt(mid);
      if (Math.abs(fmid) < IRR_VALUE_TOL || (hi - lo) / 2 < IRR_INTERVAL_TOL) return mid;
      if (flo * fmid < 0) {
        hi = mid;
      } else {
        lo = mid;
        flo = fmid;
      }
    }

    // 5. Failure.
    throw new CalcError(
      'CALC-IRR-DIVERGE',
      `irr: bisection did not meet a stopping condition within ${IRR_MAX_ITER} iterations.`,
    );
  },
});
