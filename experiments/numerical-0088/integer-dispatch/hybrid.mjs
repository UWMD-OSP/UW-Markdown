// UNACCEPTED reciprocal-first integer graph. No UWMD/host pow/log/exp.
import { createHash } from 'node:crypto';
const SIGN = 1n << 63n;
const INF = 0x7ff0000000000000n;
const ONE = 0x3ff0000000000000n;
const data = new DataView(new ArrayBuffer(8));
function word(text) {
  if (typeof text !== 'string' || !/^[0-9a-f]{16}$/.test(text)) throw new RangeError('Expected canonical binary64 word');
  return BigInt(`0x${text}`);
}
function number(value) { data.setBigUint64(0, value, false); return data.getFloat64(0, false); }
function bits(value) { data.setFloat64(0, value, false); return data.getBigUint64(0, false).toString(16).padStart(16, '0'); }
function finite(value) { return (value & INF) !== INF; }
function integerMagnitude(value) {
  const field = Number((value >> 52n) & 0x7ffn);
  const tail = value & ((1n << 52n) - 1n);
  const significand = field === 0 ? tail : (1n << 52n) | tail;
  const shift = field === 0 ? -1074 : field - 1075;
  if (shift >= 0) return significand << BigInt(shift);
  const divisor = 1n << BigInt(-shift);
  return significand % divisor === 0n ? significand / divisor : null;
}
export function classify(xBits, yBits) {
  const x = word(xBits);
  const y = word(yBits);
  if (!finite(x) || !finite(y)) return { kind: 'nonfinite_input' };
  if ((y & ~SIGN) === 0n) return { kind: 'zero_exponent' };
  const negative = (y & SIGN) !== 0n;
  const n = integerMagnitude(y);
  if (n === null) return { kind: 'fractional', negative };
  const text = n.toString(2);
  const popcount = [...text].filter((c) => c === '1').length;
  return { kind: 'integer', negative, odd: (n & 1n) !== 0n, bit_length: text.length,
    popcount, basic_operation_bound: text.length - 1 + popcount + Number(negative) };
}
export function graph(xBits, yBits) {
  const xb = word(xBits);
  const yb = word(yBits);
  const x = number(xb);
  const y = number(yb);
  const category = classify(xBits, yBits);
  const trace = [];
  const finish = (value) => ({ ...value, operations: trace.length,
    trace_sha256: createHash('sha256').update(JSON.stringify(trace)).digest('hex') });
  if (category.kind === 'nonfinite_input') return finish({ status: 'nonfinite_input' });
  if (category.kind === 'zero_exponent') return finish({ status: 'finite', bits: bits(1) });
  if ((xb & ~SIGN) === 0n) {
    if (y < 0) return finish({ status: 'zero_negative_exponent' });
    const negative = (xb & SIGN) !== 0n && category.kind === 'integer' && category.odd;
    return finish({ status: 'finite', bits: negative ? '8000000000000000' : '0000000000000000' });
  }
  if (x < 0 && category.kind === 'fractional') return finish({ status: 'negative_fractional_domain' });
  if ((xb & ~SIGN) === ONE) return finish({ status: 'finite', bits: bits(x < 0 && category.odd ? -1 : 1) });
  if (category.kind === 'fractional') return finish({ status: 'fdlibm_fractional_required' });
  let n = integerMagnitude(yb);
  let factor = x;
  let accumulator = 1;
  let refused = false;
  const operation = (name, left, right) => {
    const answer = name === 'multiply' ? left * right : left / right;
    trace.push([name, bits(left), bits(right), bits(answer)]);
    if (!Number.isFinite(answer)) refused = true;
    return answer;
  };
  if (category.negative) factor = operation('divide', 1, factor);
  while (n > 0n && !refused) {
    if ((n & 1n) !== 0n) accumulator = operation('multiply', accumulator, factor);
    if (refused) break;
    n >>= 1n;
    if (n > 0n) factor = operation('multiply', factor, factor);
  }
  return finish(refused ? { status: 'intermediate_nonfinite' } : { status: 'finite', bits: bits(accumulator) });
}
