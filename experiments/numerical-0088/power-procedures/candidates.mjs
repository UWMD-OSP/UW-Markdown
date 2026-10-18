// UNACCEPTED research graphs. No UWMD/host power/log/exp imports.
import { createHash } from 'node:crypto';

const buffer = new ArrayBuffer(8);
const data = new DataView(buffer);
export function number(bits) {
  data.setBigUint64(0, BigInt(`0x${bits}`), false);
  return data.getFloat64(0, false);
}
function bits(value) {
  data.setFloat64(0, value, false);
  return data.getBigUint64(0, false).toString(16).padStart(16, '0');
}
export function classify(xBits, yBits) {
  const x = number(xBits);
  const y = number(yBits);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { kind: 'nonfinite_input' };
  if (y === 0) return { kind: 'zero_exponent' };
  if (!Number.isInteger(y)) return { kind: 'fractional', negative: y < 0 };
  const n = y < 0 ? -y : y;
  return { kind: 'integer', negative: y < 0, odd: n % 2 === 1, within_lab_budget: n <= 256 };
}
export function graph(xBits, yBits, name) {
  if (!['sequential-late', 'binary-late', 'binary-early'].includes(name)) throw new RangeError('Unknown research graph');
  const trace = [];
  const finish = (value) => ({ ...value, operations: trace.length,
    trace_sha256: createHash('sha256').update(JSON.stringify(trace)).digest('hex') });
  const x = number(xBits);
  const y = number(yBits);
  const category = classify(xBits, yBits);
  if (category.kind === 'nonfinite_input') return finish({ status: 'nonfinite_input' });
  if (category.kind === 'zero_exponent') return finish({ status: 'finite', bits: bits(1) });
  if (x === 0) {
    if (y < 0) return finish({ status: 'zero_negative_exponent' });
    const negative = xBits[0] >= '8' && category.kind === 'integer' && category.odd;
    return finish({ status: 'finite', bits: negative ? '8000000000000000' : '0000000000000000' });
  }
  if (x < 0 && category.kind === 'fractional') return finish({ status: 'negative_fractional_domain' });
  if (x === 1 || x === -1) return finish({ status: 'finite', bits: bits(x < 0 && category.odd ? -1 : 1) });
  if (category.kind === 'fractional') return finish({ status: 'fractional_kernel_required' });
  if (!category.within_lab_budget) return finish({ status: 'lab_budget_refusal' });
  let refused = false;
  function operation(op, left, right) {
    const result = op === 'multiply' ? left * right : left / right;
    trace.push([op, bits(left), bits(right), bits(result)]);
    if (!Number.isFinite(result)) refused = true;
    return result;
  }
  let n = y < 0 ? -y : y;
  let factor = x;
  let accumulator = 1;
  if (name === 'binary-early' && y < 0) factor = operation('divide', 1, factor);
  if (name === 'sequential-late') {
    for (let i = 0; i < n && !refused; i += 1) accumulator = operation('multiply', accumulator, factor);
  } else {
    while (n > 0 && !refused) {
      if (n % 2 === 1) accumulator = operation('multiply', accumulator, factor);
      if (refused) break;
      n = (n - n % 2) / 2;
      if (n > 0) factor = operation('multiply', factor, factor);
    }
  }
  if (!refused && name !== 'binary-early' && y < 0) accumulator = operation('divide', 1, accumulator);
  return finish(refused ? { status: 'intermediate_nonfinite' } : { status: 'finite', bits: bits(accumulator) });
}
