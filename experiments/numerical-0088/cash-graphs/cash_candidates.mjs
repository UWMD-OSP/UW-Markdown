// Isolated cash/endpoint research only. No production evaluator or solver imports.
import { createHash } from 'node:crypto';
import { graph as powerGraph, number } from '../power-procedures/candidates.mjs';

const buffer = new ArrayBuffer(8);
const data = new DataView(buffer);
function bits(value) {
  data.setFloat64(0, value, false);
  return data.getBigUint64(0, false).toString(16).padStart(16, '0');
}
export function quantize(input, places) {
  const n = number(input);
  const [raw, e] = (n < 0 ? -n : n).toExponential().split('e');
  const coefficient = raw.replace('.', '');
  const exponent = Number(e) - (raw.includes('.') ? raw.length - raw.indexOf('.') - 1 : 0);
  const shifted = Number(`${coefficient}e${exponent + places}`);
  let result = n;
  let integer = null;
  if (Number.isFinite(shifted) && shifted <= Number.MAX_SAFE_INTEGER) {
    integer = Number.isInteger(shifted) ? shifted : Math.floor(shifted + 0.5);
    result = (n < 0 ? -1 : 1) * Number(`${integer}e${-places}`);
  }
  if (result === 0) result = 0;
  return { places, coefficient, exponent, shifted: bits(shifted), rounded_integer: integer === null ? null : String(integer),
    bits: bits(result), number_token: JSON.stringify(result) };
}
function reporting(id, value, places) {
  const boundary = quantize(value, places);
  const preimage = JSON.stringify([{ calc_id: id, computed: true, value: number(boundary.bits) }]);
  return { quantization: boundary, results_preimage: preimage,
    results_digest: `sha256:${createHash('sha256').update(preimage).digest('hex')}` };
}
function sign(value) {
  return value === 0 ? 'zero' : value < 0 ? 'negative' : 'positive';
}
export function cashValue(rate, flows, graph, exponents = null) {
  const trace = [];
  function basic(op, left, right) {
    if (op === 'divide' && right === 0) {
      trace.push([op, bits(left), bits(right), 'zero_denominator']);
      throw new RangeError('zero_denominator');
    }
    const value = op === 'add' ? left + right : op === 'multiply' ? left * right : left / right;
    trace.push([op, bits(left), bits(right), bits(value)]);
    if (!Number.isFinite(value)) throw new RangeError('nonfinite_basic');
    return value;
  }
  try {
    const base = basic('add', 1, number(rate));
    let total = 0;
    for (let i = 0; i < flows.length; i += 1) {
      const exponent = exponents === null ? bits(i) : bits(-number(exponents[i]));
      const power = powerGraph(bits(base), exponent, graph);
      trace.push(['power', bits(base), exponent, power]);
      if (power.status !== 'finite') throw new RangeError(power.status);
      const term = basic(exponents === null ? 'divide' : 'multiply', number(flows[i]), number(power.bits));
      total = basic('add', total, term);
    }
    return { status: 'finite', bits: bits(total), sign: sign(total), trace };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { status: 'candidate_refusal', reason: error.message, trace };
  }
}
function endpoints(flows, graph) {
  const low = cashValue('bfeff7ced916872b', flows, graph);
  const high = cashValue('4024000000000000', flows, graph);
  const result = { low, high, comparison_trace: [] };
  if (low.status !== 'finite' || high.status !== 'finite') return { ...result, status: 'candidate_refusal', reason: 'endpoint_unavailable' };
  const a = number(low.bits);
  const b = number(high.bits);
  const product = a * b;
  result.comparison_trace.push(['multiply', bits(a), bits(b), bits(product)]);
  if (product > 0) return { ...result, status: 'no_bracket', prospective_error: 'CALC-IRR-DIVERGE' };
  if (a === 0) return { ...result, status: 'endpoint_root', bits: 'bfeff7ced916872b', endpoint: 'lo' };
  if (b === 0) return { ...result, status: 'endpoint_root', bits: '4024000000000000', endpoint: 'hi' };
  return { ...result, status: 'bisection_required' };
}
export function evaluate(given, graph) {
  const value = given.kind === 'irr-endpoints' ? endpoints(given.flows, graph)
    : cashValue(given.rate, given.flows, graph, given.kind === 'dated-prederived' ? given.year_fractions : null);
  if (value.status === 'finite' || value.status === 'endpoint_root') value.reporting = reporting(given.calc_id, value.bits, given.places);
  return value;
}
