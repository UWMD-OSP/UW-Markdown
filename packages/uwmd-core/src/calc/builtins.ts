// Tier-3 Calc Host — built-in function implementations.
// Signatures and semantics per UW_PROTOCOL_v1.md §VIII.3.

import { CalcError } from './errors.js';
import { quantizeDecimal } from './quantize.js';

export const MAX_NODES = 1024;
export const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

export function isForbiddenProperty(segment: string): boolean {
  return FORBIDDEN_PROPERTIES.has(segment);
}

export interface EvalState {
  nodes: number;
}

export type CalcValue = number | string | boolean | null | unknown[] | Record<string, unknown>;

export type Builtin = (args: CalcValue[], state?: EvalState) => CalcValue;

export function safeGetPath(obj: unknown, path: string): unknown {
  if (typeof path !== 'string') {
    throw new CalcError('CALC-TYPE-001', `Property path must be a string, got ${typeof path}.`);
  }
  if (path === '') return obj;

  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  for (const seg of parts) {
    if (isForbiddenProperty(seg)) {
      throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${seg}'.`);
    }
  }
  let cur = obj;
  for (const seg of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object' && typeof cur !== 'function') return undefined;
    if (Array.isArray(cur)) {
      if (/^\d+$/.test(seg)) {
        const idx = Number.parseInt(seg, 10);
        cur = cur[idx];
      } else {
        return undefined;
      }
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, seg)) {
        return undefined;
      }
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

export function extractCollection(
  collection: unknown,
  fnName: string,
  state?: EvalState,
): unknown[] {
  if (collection === null || collection === undefined) return [];
  if (Array.isArray(collection)) {
    if (state) {
      state.nodes += collection.length;
      if (state.nodes > MAX_NODES) {
        throw new CalcError('CALC-LIMIT-001', `Expression exceeds ${MAX_NODES} AST nodes.`);
      }
    }
    return collection;
  }
  if (typeof collection === 'object') {
    const keys = Object.keys(collection);
    for (const k of keys) {
      if (isForbiddenProperty(k)) {
        throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${k}'.`);
      }
    }
    if (state) {
      state.nodes += keys.length;
      if (state.nodes > MAX_NODES) {
        throw new CalcError('CALC-LIMIT-001', `Expression exceeds ${MAX_NODES} AST nodes.`);
      }
    }
    const items: unknown[] = [];
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(collection, k)) {
        items.push((collection as Record<string, unknown>)[k]);
      }
    }
    return items;
  }
  throw new CalcError(
    'CALC-TYPE-001',
    `${fnName}: first argument must be an array, object, or null, got ${typeof collection}.`,
  );
}

function isTruthy(val: unknown): boolean {
  return val === true || (val !== null && val !== undefined && val !== false && val !== 0 && val !== '');
}

function matchesCondition(val: unknown, expected?: unknown): boolean {
  if (expected !== undefined) {
    if (val === undefined) val = null;
    return val === expected;
  }
  return isTruthy(val);
}

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
/** Hard iteration cap; exhausting it raises `CALC-IRR-DIVERGE`. */
export const IRR_MAX_ITER = 200;
/** Stop when the NPV at the midpoint is this close to zero. */
export const IRR_VALUE_TOL = 1e-9;
/** Stop when the remaining half-interval is this narrow. */
export const IRR_INTERVAL_TOL = 1e-12;

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

  // sum_by(collection, key_path) — sums numeric property across objects in array or object.
  sum_by(args, state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `sum_by: expected 2 arguments (collection, key_path), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'sum_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `sum_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    let acc = 0;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (val === null || val === undefined) continue;
      if (typeof val === 'number') {
        acc += val;
      } else {
        throw new CalcError('CALC-TYPE-001', `sum_by: property '${keyPath}' must be a number or null, got ${typeof val}.`);
      }
    }
    return acc;
  },

  // avg_by(collection, key_path) — averages numeric property across objects.
  avg_by(args, state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `avg_by: expected 2 arguments (collection, key_path), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'avg_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `avg_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    let acc = 0;
    let count = 0;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (val === null || val === undefined) continue;
      if (typeof val === 'number') {
        acc += val;
        count++;
      } else {
        throw new CalcError('CALC-TYPE-001', `avg_by: property '${keyPath}' must be a number or null, got ${typeof val}.`);
      }
    }
    return count === 0 ? null : acc / count;
  },

  // min_by(collection, key_path) — minimum numeric property across objects.
  min_by(args, state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `min_by: expected 2 arguments (collection, key_path), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'min_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `min_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    let best: number | null = null;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (val === null || val === undefined) continue;
      if (typeof val === 'number') {
        best = best === null || val < best ? val : best;
      } else {
        throw new CalcError('CALC-TYPE-001', `min_by: property '${keyPath}' must be a number or null, got ${typeof val}.`);
      }
    }
    return best;
  },

  // max_by(collection, key_path) — maximum numeric property across objects.
  max_by(args, state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `max_by: expected 2 arguments (collection, key_path), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'max_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `max_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    let best: number | null = null;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (val === null || val === undefined) continue;
      if (typeof val === 'number') {
        best = best === null || val > best ? val : best;
      } else {
        throw new CalcError('CALC-TYPE-001', `max_by: property '${keyPath}' must be a number or null, got ${typeof val}.`);
      }
    }
    return best;
  },

  // count_where(collection, condition_path[, expected_value]) — counts matching elements.
  count_where(args, state) {
    if (args.length < 2 || args.length > 3) {
      throw new CalcError('CALC-TYPE-001', `count_where: expected 2 or 3 arguments (collection, condition_path[, expected_value]), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'count_where', state);
    const condPath = args[1];
    if (typeof condPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `count_where: second argument must be a string property path, got ${typeof condPath}.`);
    }
    const expected = args.length >= 3 ? args[2] : undefined;
    let count = 0;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, condPath);
      if (matchesCondition(val, expected)) {
        count++;
      }
    }
    return count;
  },

  count_by(args, state) {
    return BUILTINS.count_where(args, state);
  },

  // filter(collection, key_path[, expected_value]) — filters elements matching condition.
  filter(args, state) {
    if (args.length < 2 || args.length > 3) {
      throw new CalcError('CALC-TYPE-001', `filter: expected 2 or 3 arguments (collection, key_path[, expected_value]), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'filter', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `filter: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    const expected = args.length >= 3 ? args[2] : undefined;
    const result: unknown[] = [];
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (matchesCondition(val, expected)) {
        result.push(item);
      }
    }
    return result as unknown as CalcValue;
  },

  filter_by(args, state) {
    return BUILTINS.filter(args, state);
  },

  // find_by(collection, key_path[, expected_value]) — returns first matching element or null.
  find_by(args, state) {
    if (args.length < 2 || args.length > 3) {
      throw new CalcError('CALC-TYPE-001', `find_by: expected 2 or 3 arguments (collection, key_path[, expected_value]), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'find_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `find_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    const expected = args.length >= 3 ? args[2] : undefined;
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') continue;
      const val = safeGetPath(item, keyPath);
      if (matchesCondition(val, expected)) {
        return item as unknown as CalcValue;
      }
    }
    return null;
  },

  find(args, state) {
    return BUILTINS.find_by(args, state);
  },

  // map_by(collection, key_path) — extracts property from each item into an array.
  map_by(args, state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `map_by: expected 2 arguments (collection, key_path), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'map_by', state);
    const keyPath = args[1];
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `map_by: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    const result: unknown[] = [];
    for (const item of items) {
      if (item === null || item === undefined || typeof item !== 'object') {
        result.push(null);
      } else {
        const val = safeGetPath(item, keyPath);
        result.push(val === undefined ? null : val);
      }
    }
    return result as unknown as CalcValue;
  },

  pluck(args, state) {
    return BUILTINS.map_by(args, state);
  },

  // values(collection) — converts object/record to array of its values.
  values(args, state) {
    if (args.length !== 1) {
      throw new CalcError('CALC-TYPE-001', `values: expected 1 argument (collection), got ${args.length}.`);
    }
    const items = extractCollection(args[0], 'values', state);
    return items as unknown as CalcValue;
  },

  to_array(args, state) {
    return BUILTINS.values(args, state);
  },

  // get(object, key_path) — extracts property path from a single object.
  get(args, _state) {
    if (args.length !== 2) {
      throw new CalcError('CALC-TYPE-001', `get: expected 2 arguments (object, key_path), got ${args.length}.`);
    }
    const obj = args[0];
    const keyPath = args[1];
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') {
      throw new CalcError('CALC-TYPE-001', `get: first argument must be an object or null, got ${typeof obj}.`);
    }
    if (typeof keyPath !== 'string') {
      throw new CalcError('CALC-TYPE-001', `get: second argument must be a string property path, got ${typeof keyPath}.`);
    }
    const val = safeGetPath(obj, keyPath);
    return val === undefined ? null : (val as CalcValue);
  },

  prop(args, state) {
    return BUILTINS.get(args, state);
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
