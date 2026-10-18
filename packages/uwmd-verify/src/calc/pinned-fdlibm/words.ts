// Explicit pinned word model; accepts IEEE exceptions as well as finite values.
const view = new DataView(new ArrayBuffer(8));
export function fromBits(word: string): number {
  if (typeof word !== 'string' || !/^[0-9a-f]{16}$/.test(word)) throw new RangeError('Expected 16 lowercase hexadecimal digits');
  view.setBigUint64(0, BigInt(`0x${word}`), false);
  return view.getFloat64(0, false);
}
export function toBits(x: number): string {
  if (typeof x !== 'number') throw new TypeError('Expected binary64 Number');
  view.setFloat64(0, x, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, '0');
}
export function hi(x: number): number { view.setFloat64(0, x, false); return view.getInt32(0, false); }
export function hu(x: number): number { view.setFloat64(0, x, false); return view.getUint32(0, false); }
export function lo(x: number): number { view.setFloat64(0, x, false); return view.getUint32(4, false); }
export function withHi(x: number, high: number): number { view.setFloat64(0, x, false); view.setUint32(0, u32(high), false); return view.getFloat64(0, false); }
export function withLo(x: number, low: number): number { view.setFloat64(0, x, false); view.setUint32(4, u32(low), false); return view.getFloat64(0, false); }
export function fromWords(high: number, low: number): number { view.setUint32(0, u32(high), false); view.setUint32(4, u32(low), false); return view.getFloat64(0, false); }
export function u32(x: number): number { return x >>> 0; }
export function s32(x: number): number { return x | 0; }
export function add32(a: number, b: number): number { return (a + b) | 0; }
export function sub32(a: number, b: number): number { return (a - b) | 0; }
export function uadd32(a: number, b: number): number { return (a + b) >>> 0; }
export function usub32(a: number, b: number): number { return (a - b) >>> 0; }
function count(n: number): void { if (!Number.isInteger(n) || n < 0 || n > 32) throw new RangeError('Expected shift count 0..32'); }
export function shl(a: number, n: number): number { count(n); return n === 32 ? 0 : a << n; }
export function sar(a: number, n: number): number { count(n); return n === 32 ? (s32(a) < 0 ? -1 : 0) : a >> n; }
export function shr(a: number, n: number): number { count(n); return n === 32 ? 0 : a >>> n; }
export function signedInt(n: number): number {
  if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new RangeError('scalbn requires signed32 n');
  return n;
}
