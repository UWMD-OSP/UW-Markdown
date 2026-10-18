// Separate JS candidate graphs and actual current production boundaries.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as raw from '../pinned-fdlibm/kernel.mjs';
import { fromBits, toBits } from '../pinned-fdlibm/words.mjs';
import { BUILTINS } from '../../../packages/uwmd-verify/dist/calc/builtins.js';
import { quantizeDecimal } from '../../../packages/uwmd-verify/dist/calc/quantize.js';
import { evaluateCalc } from '../../../packages/uwmd-verify/dist/calc/index.js';
import { parseUWFile } from '../../../packages/uwmd-verify/dist/parser.js';
const input = JSON.parse(readFileSync(new URL('inputs.json', import.meta.url), 'utf8'));
const encoded = value => ({ kind: Number.isNaN(value) ? 'nan' : Number.isFinite(value) ? 'finite' : 'infinity', bits: toBits(value) });
function graph(item) {
  const trace = [];
  const call = (op, a, b) => {
    const value = op === 'add' ? a + b : op === 'subtract' ? a - b : op === 'multiply' ? a * b : op === 'divide' ? a / b : raw.pow(a, b);
    trace.push({ op, args: [encoded(a), encoded(b)], result: encoded(value) });
    return value;
  };
  const r = fromBits(item.rate);
  const n = item.n;
  const amount = fromBits(item.amount);
  const other = fromBits(item.other);
  let result;
  if (r === 0) {
    result = item.op === 'pmt' ? call('divide', amount, n) : item.op === 'fv' ? call('add', other, call('multiply', amount, n)) : call('add', call('multiply', amount, n), other);
  } else if (item.op === 'pmt') {
    const numerator = call('multiply', amount, r);
    const factor = call('pow', call('add', 1, r), -n);
    result = call('divide', numerator, call('subtract', 1, factor));
  } else {
    const factor = call('pow', call('add', 1, r), item.op === 'pv' ? -n : n);
    if (item.op === 'pv') {
      const first = call('divide', call('multiply', amount, call('subtract', 1, factor)), r);
      result = call('add', first, call('multiply', other, factor));
    } else {
      const first = call('multiply', other, factor);
      const second = call('divide', call('multiply', amount, call('subtract', factor, 1)), r);
      result = call('add', first, second);
    }
  }
  return { id: item.id, raw: encoded(result), trace };
}
function boundary(item) {
  const r = fromBits(item.rate);
  const amount = fromBits(item.amount);
  const other = fromBits(item.other);
  const args = [r, item.n, amount, ...(item.op === 'pmt' ? [] : [other])];
  const value = BUILTINS[item.op](args);
  const result = { id: item.id, raw: encoded(value) };
  try { result.quantized = encoded(quantizeDecimal(value, item.places)); }
  catch (error) { result.quantization_refusal = error.code ?? error.proto?.code; }
  const source = `---\nuw_version: \"3.0\"\nr: ${Object.is(r, -0) ? '-0' : String(r)}\nn: ${item.n}\namount: ${String(amount)}\nother: ${String(other)}\n---\n`;
  const parsed = parseUWFile(source);
  assert.equal(toBits(parsed.frontmatter.r), item.rate, item.id);
  const declaration = { id: 'research_scalar', label: 'Exact synthetic scalar input', formula: `${item.op}(r,n,amount${item.op === 'pmt' ? '' : ',other'})`, deterministic: true, round_to: item.places };
  const evaluated = evaluateCalc(declaration, { parsed, prior_results: {} });
  result.evaluated = { ok: evaluated.ok, ...(evaluated.ok ? { value: encoded(evaluated.value) } : { code: evaluated.error.code }) };
  return result;
}
const destination = process.argv[2];
assert(destination && !existsSync(destination), 'New output required; no overwrite');
writeFileSync(destination, `${JSON.stringify({ mode: process.env.RESEARCH_MODE ?? 'unmodified', node: process.version, v8: process.versions.v8,
  graphs: input.cases.map(graph), boundaries: input.cases.map(boundary) })}\n`);
