/**
 * Exact pinned fdlibm primitives selected by the owner for RFC 0088.
 *
 * These raw binary64 functions do not quantize or apply calc-builtin policy.
 * They preserve IEEE infinities, signed zero and NaN classes; NaN payloads and
 * exception flags are not a portable contract. Financial consumers retain their
 * existing associations, null/domain/final-result checks and quantizer.
 * Accepted RFC 0088: these same bindings are used by the financial evaluator.
 * No correctly-rounded or whole-financial-formula guarantee is implied.
 */
import { CalcError } from './errors.js';
import { pow, exp, log } from './pinned-fdlibm/kernel.js';

function number(value: number, name: string): void {
  if (typeof value !== 'number') {
    throw new CalcError('CALC-TYPE-001', `${name}: expected a primitive binary64 number.`);
  }
}

/** Pinned raw power for all exponent classes, including fractional and negative. */
export function pinnedPow(base: number, exponent: number): number {
  number(base, 'pinnedPow');
  number(exponent, 'pinnedPow');
  return pow(base, exponent);
}

/** Pinned raw exponential. Overflow/underflow remain IEEE results. */
export function pinnedExp(value: number): number {
  number(value, 'pinnedExp');
  return exp(value);
}

/** Pinned raw natural logarithm. Nonpositive inputs remain IEEE results. */
export function pinnedLog(value: number): number {
  number(value, 'pinnedLog');
  return log(value);
}
