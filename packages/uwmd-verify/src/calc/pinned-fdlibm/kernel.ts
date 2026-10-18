/*
 * RFC 0088 architecture-A adaptation of the exact Netlib fdlibm sources in upstream/.
 * Copyright (C) 1993, 2004 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely
 * granted, provided that this notice is preserved.
 *
 * Draft RFC 0088 implementation. Raw IEEE values, not calc refusal semantics.
 * Every floating operator is an ordered ECMAScript binary64 operation (RN-even).
 * No host transcendental, FMA, stable-form substitution or integer-power graph.
 */
import { C } from './constants.js';
import { hi, hu, lo, withHi, withLo, fromWords, u32, s32,
  add32, sub32, uadd32, usub32, shl, sar, shr, signedInt } from './words.js';

const ZERO = C['0.0'];
const ONE = C['1.0'];
const TWO = C['2.0'];
const THREE = C['3.0'];
const HALF = C['0.5'];
const QUARTER = C['0.25'];
const HUGE = C['1.0e300'];
const TINY = C['1.0e-300'];
const TWO54 = C['1.80143985094819840000e+16'];
const TWOM54 = C['5.55111512312578270212e-17'];

// s_fabs.c: sign transformation, no exceptional-value admission policy.
export function fabs(x: number): number { return withHi(x, hu(x) & 0x7fffffff); }
// s_copysign.c: high-word mask/or; all low and non-sign bits retained.
export function copysign(x: number, y: number): number {
  return withHi(x, (hu(x) & 0x7fffffff) | (hu(y) & 0x80000000));
}

// s_scalbn.c: n is the C signed32 API parameter, never an exponent magnitude cast.
export function scalbn(x: number, n: number): number {
  signedInt(n);
  let hx = hi(x);
  const lx = lo(x);
  let k = sar(hx & 0x7ff00000, 20);
  if (k === 0) {
    if ((lx | (hx & 0x7fffffff)) === 0) return x;
    x *= TWO54;
    hx = hi(x);
    k = sub32(sar(hx & 0x7ff00000, 20), 54);
    if (n < -50000) return TINY * x;
  }
  if (k === 0x7ff) return x + x;
  k = add32(k, n);
  if (k > 0x7fe) return HUGE * copysign(HUGE, x);
  if (k > 0) return withHi(x, (hx & 0x800fffff) | shl(k, 20));
  if (k <= -54) {
    if (n > 50000) return HUGE * copysign(HUGE, x);
    return TINY * copysign(TINY, x);
  }
  k = add32(k, 54);
  x = withHi(x, (hx & 0x800fffff) | shl(k, 20));
  return x * TWOM54;
}

// e_sqrt.c: the digit-by-digit body, not the alternative paper in its comment.
export function sqrt(x: number): number {
  let ix0 = hi(x);
  let ix1 = lo(x);
  const sign = 0x80000000;
  if ((ix0 & 0x7ff00000) === 0x7ff00000) return x * x + x;
  if (ix0 <= 0) {
    if (((ix0 & 0x7fffffff) | ix1) === 0) return x;
    if (ix0 < 0) return (x - x) / (x - x);
  }
  let m = sar(ix0, 20);
  let i;
  if (m === 0) {
    while (ix0 === 0) {
      m = sub32(m, 21);
      ix0 |= shr(ix1, 11);
      ix1 = u32(shl(ix1, 21));
    }
    for (i = 0; (ix0 & 0x00100000) === 0; i += 1) ix0 = shl(ix0, 1);
    m = sub32(m, i - 1);
    // The intentional candidate mapping of C's undefined count32 is zero.
    ix0 |= shr(ix1, 32 - i);
    ix1 = u32(shl(ix1, i));
  }
  m = sub32(m, 1023);
  ix0 = (ix0 & 0x000fffff) | 0x00100000;
  if (m & 1) {
    ix0 = add32(ix0, add32(ix0, shr(ix1, 31)));
    ix1 = uadd32(ix1, ix1);
  }
  m = sar(m, 1);
  ix0 = add32(ix0, add32(ix0, shr(ix1, 31)));
  ix1 = uadd32(ix1, ix1);
  let q = 0;
  let q1 = 0;
  let s0 = 0;
  let s1 = 0;
  let r = 0x00200000;
  let t;
  let t1;
  while (r !== 0) {
    t = s32(s0 + r);
    if (t <= ix0) {
      s0 = s32(t + r);
      ix0 = sub32(ix0, t);
      q = s32(q + r);
    }
    ix0 = add32(ix0, add32(ix0, shr(ix1, 31)));
    ix1 = uadd32(ix1, ix1);
    r = shr(r, 1);
  }
  r = sign;
  while (r !== 0) {
    t1 = uadd32(s1, r);
    t = s0;
    if (t < ix0 || (t === ix0 && t1 <= ix1)) {
      s1 = uadd32(t1, r);
      if (u32(t1 & sign) === sign && (s1 & sign) === 0) s0 = add32(s0, 1);
      ix0 = sub32(ix0, t);
      if (ix1 < t1) ix0 = sub32(ix0, 1);
      ix1 = usub32(ix1, t1);
      q1 = uadd32(q1, r);
    }
    ix0 = add32(ix0, add32(ix0, shr(ix1, 31)));
    ix1 = uadd32(ix1, ix1);
    r = shr(r, 1);
  }
  if ((ix0 | ix1) !== 0) {
    // Keep original probe arithmetic under the sole admitted RN-even mode.
    let z = ONE - TINY;
    if (z >= ONE) {
      z = ONE + TINY;
      if (q1 === 0xffffffff) { q1 = 0; q = add32(q, 1); }
      else if (z > ONE) {
        if (q1 === 0xfffffffe) q = add32(q, 1);
        q1 = uadd32(q1, 2);
      } else q1 = uadd32(q1, q1 & 1);
    }
  }
  ix0 = add32(sar(q, 1), 0x3fe00000);
  ix1 = shr(q1, 1);
  if ((q & 1) === 1) ix1 = u32(ix1 | sign);
  ix0 = add32(ix0, shl(m, 20));
  return fromWords(ix0, ix1);
}

// e_log.c constants are separately pinned even where pow uses similar values.
const LOG = Object.freeze({
  ln2_hi: C['6.93147180369123816490e-01'], ln2_lo: C['1.90821492927058770002e-10'],
  Lg1: C['6.666666666666735130e-01'], Lg2: C['3.999999999940941908e-01'],
  Lg3: C['2.857142874366239149e-01'], Lg4: C['2.222219843214978396e-01'],
  Lg5: C['1.818357216161805012e-01'], Lg6: C['1.531383769920937332e-01'],
  Lg7: C['1.479819860511658591e-01'], third: C['0.33333333333333333'],
});
export function log(x: number): number {
  const { ln2_hi, ln2_lo, Lg1, Lg2, Lg3, Lg4, Lg5, Lg6, Lg7 } = LOG;
  let hx = hi(x);
  const lx = lo(x);
  let k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -TWO54 / ZERO;
    if (hx < 0) return (x - x) / ZERO;
    k = sub32(k, 54);
    x *= TWO54;
    hx = hi(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k = add32(k, sub32(sar(hx, 20), 1023));
  hx &= 0x000fffff;
  let i = add32(hx, 0x95f64) & 0x100000;
  x = withHi(x, hx | (i ^ 0x3ff00000));
  k = add32(k, sar(i, 20));
  const f = x - ONE;
  let R;
  if ((0x000fffff & add32(2, hx)) < 3) {
    if (f === ZERO) {
      if (k === 0) return ZERO;
      return k * ln2_hi + k * ln2_lo;
    }
    R = f * f * (HALF - LOG.third * f);
    if (k === 0) return f - R;
    return k * ln2_hi - ((R - k * ln2_lo) - f);
  }
  const s = f / (TWO + f);
  const dk = k;
  const z = s * s;
  i = sub32(hx, 0x6147a);
  const w = z * z;
  const j = sub32(0x6b851, hx);
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  R = t2 + t1;
  if (i > 0) {
    const hfsq = HALF * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * ln2_hi - ((hfsq - (s * (hfsq + R) + dk * ln2_lo)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * ln2_hi - ((s * (f - R) - dk * ln2_lo) - f);
}

const EXP = Object.freeze({
  twom1000: C['9.33263618503218878990e-302'], o_threshold: C['7.09782712893383973096e+02'],
  u_threshold: -C['7.45133219101941108420e+02'],
  ln2HI: [C['6.93147180369123816490e-01'], -C['6.93147180369123816490e-01']],
  ln2LO: [C['1.90821492927058770002e-10'], -C['1.90821492927058770002e-10']],
  invln2: C['1.44269504088896338700e+00'],
  P1: C['1.66666666666666019037e-01'], P2: -C['2.77777777770155933842e-03'],
  P3: C['6.61375632143793436117e-05'], P4: -C['1.65339022054652515390e-06'],
  P5: C['4.13813679705723846039e-08'],
});
export function exp(x: number): number {
  const { ln2HI, ln2LO, invln2, P1, P2, P3, P4, P5, twom1000 } = EXP;
  let hx = hu(x);
  const xsb = shr(hx, 31) & 1;
  hx &= 0x7fffffff;
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | lo(x)) !== 0) return x + x;
      return xsb === 0 ? x : ZERO;
    }
    if (x > EXP.o_threshold) return HUGE * HUGE;
    if (x < EXP.u_threshold) return twom1000 * twom1000;
  }
  let hiPart!: number;
  let loPart!: number;
  let k!: number;
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      hiPart = x - ln2HI[xsb]; loPart = ln2LO[xsb]; k = 1 - xsb - xsb;
    } else {
      // C truncation toward zero. Range tests bound this result near +/-1075.
      k = s32(invln2 * x + (xsb === 0 ? HALF : -HALF));
      const t = k;
      hiPart = x - t * ln2HI[0];
      loPart = t * ln2LO[0];
    }
    x = hiPart - loPart;
  } else if (hx < 0x3e300000) {
    if (HUGE + x > ONE) return ONE + x;
  } else k = 0;
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return ONE - ((x * c) / (c - TWO) - x);
  let y = ONE - ((loPart - (x * c) / (TWO - c)) - hiPart);
  if (k >= -1021) return withHi(y, add32(hi(y), shl(k, 20)));
  y = withHi(y, add32(hi(y), shl(add32(k, 1000), 20)));
  return y * twom1000;
}

const POW = Object.freeze({
  bp: [ONE, C['1.5']], dp_h: [ZERO, C['5.84962487220764160156e-01']],
  dp_l: [ZERO, C['1.35003920212974897128e-08']], two53: C['9007199254740992.0'],
  L1: C['5.99999999999994648725e-01'], L2: C['4.28571428578550184252e-01'],
  L3: C['3.33333329818377432918e-01'], L4: C['2.72728123808534006489e-01'],
  L5: C['2.30660745775561754067e-01'], L6: C['2.06975017800338417784e-01'],
  P1: EXP.P1, P2: EXP.P2, P3: EXP.P3, P4: EXP.P4, P5: EXP.P5,
  lg2: C['6.93147180559945286227e-01'], lg2_h: C['6.93147182464599609375e-01'],
  lg2_l: -C['1.90465429995776804525e-09'], ovt: C['8.0085662595372944372e-0017'],
  cp: C['9.61796693925975554329e-01'], cp_h: C['9.61796700954437255859e-01'],
  cp_l: -C['7.02846165095275826516e-09'], ivln2: C['1.44269504088896338700e+00'],
  ivln2_h: C['1.44269502162933349609e+00'], ivln2_l: C['1.92596299112661746887e-08'],
  third: C['0.3333333333333333333333'],
});
export function pow(x: number, y: number): number {
  const { bp, dp_h, dp_l, two53, L1, L2, L3, L4, L5, L6, P1, P2, P3, P4, P5,
    lg2, lg2_h, lg2_l, ovt, cp, cp_h, cp_l, ivln2, ivln2_h, ivln2_l } = POW;
  const hx = hi(x);
  const lx = lo(x);
  const hy = hi(y);
  const ly = lo(y);
  let ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;
  if ((iy | ly) === 0) return ONE;
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0)
    || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) return x + y;
  let yisint = 0;
  let k!: number;
  let j;
  let i;
  let n;
  if (hx < 0) {
    if (iy >= 0x43400000) yisint = 2;
    else if (iy >= 0x3ff00000) {
      k = sub32(sar(iy, 20), 0x3ff);
      if (k > 20) {
        j = s32(shr(ly, 52 - k));
        // C comparison promotes j << ... to unsigned because ly is unsigned.
        if (u32(shl(j, 52 - k)) === ly) yisint = 2 - (j & 1);
      } else if (ly === 0) {
        j = sar(iy, 20 - k);
        if (shl(j, 20 - k) === iy) yisint = 2 - (j & 1);
      }
    }
  }
  if (ly === 0) {
    if (iy === 0x7ff00000) {
      if ((sub32(ix, 0x3ff00000) | lx) === 0) return y - y;
      if (ix >= 0x3ff00000) return hy >= 0 ? y : ZERO;
      return hy < 0 ? -y : ZERO;
    }
    if (iy === 0x3ff00000) return hy < 0 ? ONE / x : x;
    if (hy === 0x40000000) return x * x;
    if (hy === 0x3fe00000 && hx >= 0) return sqrt(x);
  }
  let ax = fabs(x);
  let z;
  if (lx === 0) {
    if (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000) {
      z = ax;
      if (hy < 0) z = ONE / z;
      if (hx < 0) {
        if ((sub32(ix, 0x3ff00000) | yisint) === 0) z = (z - z) / (z - z);
        else if (yisint === 1) z = -z;
      }
      return z;
    }
  }
  n = add32(sar(hx, 31), 1);
  if ((n | yisint) === 0) return (x - x) / (x - x);
  let s = ONE;
  if ((n | sub32(yisint, 1)) === 0) s = -ONE;
  let t;
  let w;
  let u;
  let v;
  let t1;
  let t2;
  if (iy > 0x41e00000) {
    if (iy > 0x43f00000) {
      if (ix <= 0x3fefffff) return hy < 0 ? HUGE * HUGE : TINY * TINY;
      if (ix >= 0x3ff00000) return hy > 0 ? HUGE * HUGE : TINY * TINY;
    }
    if (ix < 0x3fefffff) return hy < 0 ? s * HUGE * HUGE : s * TINY * TINY;
    if (ix > 0x3ff00000) return hy > 0 ? s * HUGE * HUGE : s * TINY * TINY;
    t = ax - ONE;
    w = (t * t) * (HALF - t * (POW.third - t * QUARTER));
    u = ivln2_h * t;
    v = t * ivln2_l - w * ivln2;
    t1 = u + v;
    t1 = withLo(t1, 0);
    t2 = v - (t1 - u);
  } else {
    n = 0;
    if (ix < 0x00100000) { ax *= two53; n = sub32(n, 53); ix = hi(ax); }
    n = add32(n, sub32(sar(ix, 20), 0x3ff));
    j = ix & 0x000fffff;
    ix = j | 0x3ff00000;
    if (j <= 0x3988e) k = 0;
    else if (j < 0xbb67a) k = 1;
    else { k = 0; n = add32(n, 1); ix = sub32(ix, 0x00100000); }
    ax = withHi(ax, ix);
    u = ax - bp[k];
    v = ONE / (ax + bp[k]);
    const ss = u * v;
    const s_h = withLo(ss, 0);
    let t_h = withHi(ZERO, add32(add32(sar(ix, 1) | 0x20000000, 0x00080000), shl(k, 18)));
    let t_l = ax - (t_h - bp[k]);
    const s_l = v * ((u - s_h * t_h) - s_h * t_l);
    let s2 = ss * ss;
    let r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += s_l * (s_h + ss);
    s2 = s_h * s_h;
    t_h = THREE + s2 + r;
    t_h = withLo(t_h, 0);
    t_l = r - ((t_h - THREE) - s2);
    u = s_h * t_h;
    v = s_l * t_h + t_l * ss;
    const p_h = withLo(u + v, 0);
    const p_l = v - (p_h - u);
    const z_h = cp_h * p_h;
    const z_l = cp_l * p_h + p_l * cp + dp_l[k];
    t = n;
    t1 = (((z_h + z_l) + dp_h[k]) + t);
    t1 = withLo(t1, 0);
    t2 = z_l - (((t1 - t) - dp_h[k]) - z_h);
  }
  const y1 = withLo(y, 0);
  const p_l = (y - y1) * t1 + y * t2;
  let p_h = y1 * t1;
  z = p_l + p_h;
  j = hi(z);
  i = s32(lo(z));
  if (j >= 0x40900000) {
    if ((sub32(j, 0x40900000) | i) !== 0) return s * HUGE * HUGE;
    if (p_l + ovt > z - p_h) return s * HUGE * HUGE;
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    if ((sub32(j, 0xc090cc00) | i) !== 0) return s * TINY * TINY;
    if (p_l <= z - p_h) return s * TINY * TINY;
  }
  i = j & 0x7fffffff;
  k = sub32(sar(i, 20), 0x3ff);
  n = 0;
  if (i > 0x3fe00000) {
    n = add32(j, sar(0x00100000, k + 1));
    k = sub32(sar(n & 0x7fffffff, 20), 0x3ff);
    t = withHi(ZERO, n & ~sar(0x000fffff, k));
    n = sar((n & 0x000fffff) | 0x00100000, 20 - k);
    if (j < 0) n = -n;
    p_h -= t;
  }
  t = p_l + p_h;
  t = withLo(t, 0);
  u = t * lg2_h;
  v = (p_l - (t - p_h)) * lg2 + t * lg2_l;
  z = u + v;
  w = v - (z - u);
  t = z * z;
  t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  const r = (z * t1) / (t1 - TWO) - (w + z * w);
  z = ONE - (r - z);
  j = add32(hi(z), shl(n, 20));
  if (sar(j, 20) <= 0) z = scalbn(z, n);
  else z = withHi(z, add32(hi(z), shl(n, 20)));
  return s * z;
}
