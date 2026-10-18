// Isolated RFC 0088 experiment. No production numerical contract or kernel.
const MOD = 0x100000000;

function integer(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError('Expected a safe integer.');
  return value;
}

function word(value) {
  integer(value);
  if (value < 0 || value >= MOD) throw new RangeError('Expected an unsigned 32-bit word.');
  return value;
}

function shift(count) {
  integer(count);
  if (count < 0 || count > 32) throw new RangeError('Expected a shift in [0, 32].');
  return count;
}

export function u32(value) {
  const result = integer(value) % MOD;
  return result < 0 ? result + MOD : result === 0 ? 0 : result;
}

export function i32(value) {
  return word(value) < 0x80000000 ? value : value - MOD;
}

export function and32(left, right) {
  return (word(left) & word(right)) >>> 0;
}

export function or32(left, right) {
  return (word(left) | word(right)) >>> 0;
}

export function xor32(left, right) {
  return (word(left) ^ word(right)) >>> 0;
}

export function not32(value) {
  return (~word(value)) >>> 0;
}

export function shl32(value, count) {
  word(value); shift(count);
  return count === 32 ? 0 : (value << count) >>> 0;
}

export function shr32(value, count) {
  word(value); shift(count);
  return count === 32 ? 0 : value >>> count;
}

// Returns the resulting unsigned word, not its signed interpretation.
export function sar32(value, count) {
  word(value); shift(count);
  if (count === 32) return value < 0x80000000 ? 0 : 0xffffffff;
  return (value >> count) >>> 0;
}

export function add32(left, right) {
  const total = word(left) + word(right);
  return { word: u32(total), carry: total >= MOD ? 1 : 0 };
}

export function sub32(left, right) {
  word(left); word(right);
  return { word: u32(left - right), borrow: left < right ? 1 : 0 };
}

export function split(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Expected a finite binary64 number.');
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return { hi: view.getUint32(0, false), lo: view.getUint32(4, false) };
}

export function join(hi, lo) {
  word(hi); word(lo);
  if ((hi & 0x7ff00000) === 0x7ff00000) {
    throw new RangeError('Nonfinite encodings are outside this experiment.');
  }
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, hi, false);
  view.setUint32(4, lo, false);
  return view.getFloat64(0, false);
}

export function replaceHigh(value, hi) {
  return join(hi, split(value).lo);
}

export function replaceLow(value, lo) {
  return join(split(value).hi, lo);
}
