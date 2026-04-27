// Tier-3 Calc Host — built-in function implementations.
// Signatures and semantics per UW_PROTOCOL_v1.md §VIII.3.

import { CalcError } from './errors.js';

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

  // round(num, dec) — half-away-from-zero.
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
    const factor = 10 ** d;
    // Half-away-from-zero (Math.round in JS is half-up for positives, half-down for negatives).
    const sign = n < 0 ? -1 : 1;
    return sign * Math.floor(Math.abs(n) * factor + 0.5) / factor;
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

  // irr(...flows) — bisection + Newton fallback. Null if no real root.
  irr(args) {
    if (args.length < 2) {
      throw new CalcError('CALC-TYPE-001', 'irr: requires at least 2 cash flows.');
    }
    const flows = args.map((a, _i) => asNumber(a!, 'irr'));

    // Newton-Raphson starting at 0.1.
    const npvAt = (r: number): number => {
      let acc = 0;
      for (let t = 0; t < flows.length; t++) acc += flows[t]! / (1 + r) ** t;
      return acc;
    };
    const dnpvAt = (r: number): number => {
      let acc = 0;
      for (let t = 1; t < flows.length; t++) acc += -t * flows[t]! / (1 + r) ** (t + 1);
      return acc;
    };

    let r = 0.1;
    const MAX_ITER = 100;
    const TOL = 1e-9;
    for (let i = 0; i < MAX_ITER; i++) {
      const f = npvAt(r);
      if (!Number.isFinite(f)) break;
      if (Math.abs(f) < TOL) return r;
      const df = dnpvAt(r);
      if (df === 0 || !Number.isFinite(df)) break;
      const next = r - f / df;
      if (!Number.isFinite(next) || next <= -1) break;
      if (Math.abs(next - r) < TOL) return next;
      r = next;
    }

    // Fallback: bisection over [-0.999, 10].
    let lo = -0.999;
    let hi = 10;
    let flo = npvAt(lo);
    let fhi = npvAt(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
      throw new CalcError('CALC-IRR-DIVERGE', 'irr: no root in [-99.9%, 1000%] bracket.');
    }
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fmid = npvAt(mid);
      if (Math.abs(fmid) < TOL || (hi - lo) / 2 < TOL) return mid;
      if (flo * fmid < 0) { hi = mid; fhi = fmid; }
      else { lo = mid; flo = fmid; }
    }
    throw new CalcError('CALC-IRR-DIVERGE', 'irr: failed to converge after 200 iterations.');
  },
});
