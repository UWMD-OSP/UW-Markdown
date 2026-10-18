// Independent JS NPER candidate graph plus actual unmodified/injected boundaries.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as raw from '../pinned-fdlibm/kernel.mjs';
import { fromBits, toBits } from '../pinned-fdlibm/words.mjs';
import { BUILTINS } from '../../../packages/uwmd-verify/dist/calc/builtins.js';
import { quantizeDecimal } from '../../../packages/uwmd-verify/dist/calc/quantize.js';
import { evaluateCalc } from '../../../packages/uwmd-verify/dist/calc/index.js';
import { parseUWFile } from '../../../packages/uwmd-verify/dist/parser.js';
const inputs = JSON.parse(readFileSync(new URL('inputs.json', import.meta.url), 'utf8'));
const encoded = value => ({ kind: Number.isNaN(value) ? 'nan' : Number.isFinite(value) ? 'finite' : 'infinity', bits: toBits(value) });
function graph(item) {
  const trace = [];
  const emit = (kind, fields) => trace.push({ kind, ...fields });
  const call = (op, ...args) => {
    const value = op === 'log' ? raw.log(args[0]) : op === 'multiply' ? args[0] * args[1] : op === 'subtract' ? args[0] - args[1] : op === 'add' ? args[0] + args[1] : args[0] / args[1];
    emit('operation', { op, args: args.map(encoded), result: encoded(value) });
    return value;
  };
  const [r, payment, pv, fv] = item.args.map(fromBits);
  let result;
  let value;
  emit('guard', { name: 'zero_rate', value: r === 0 });
  if (r === 0) {
    emit('guard', { name: 'zero_payment', value: payment === 0 });
    if (payment === 0) result = { status: 'refused', code: 'CALC-TYPE-001', reason: 'zero_payment' };
    else value = call('divide', call('subtract', pv, fv), payment);
  } else {
    const num = call('subtract', payment, call('multiply', fv, r));
    const den = call('subtract', payment, call('multiply', pv, r));
    emit('guard', { name: 'zero_denominator', value: den === 0 });
    if (den === 0) result = { status: 'refused', code: 'CALC-TYPE-001', reason: 'zero_denominator' };
    else {
      const ratio = call('divide', num, den);
      emit('guard', { name: 'nonpositive_ratio', value: ratio <= 0 });
      if (ratio <= 0) result = { status: 'refused', code: 'CALC-TYPE-001', reason: 'nonpositive_ratio' };
      else {
        const numeratorLog = call('log', call('divide', num, den));
        const denominatorLog = call('log', call('add', 1, r));
        value = call('divide', numeratorLog, denominatorLog);
      }
    }
  }
  return { id: item.id, result: result ?? { status: 'returned', raw: encoded(value) }, trace };
}
function boundary(item) {
  const args = item.args.map(fromBits);
  let result;
  try {
    const value = BUILTINS.nper(args);
    result = { status: 'returned', raw: encoded(value) };
    try { result.quantized = encoded(quantizeDecimal(value, item.places)); }
    catch (error) { result.quantization_refusal = error.code ?? error.proto?.code; }
  } catch (error) { result = { status: 'refused', code: error.code ?? error.proto?.code, message: error.message }; }
  const source = `---\nuw_version: "3.0"\n${args.map((arg, i) => `a${i}: ${Object.is(arg, -0) ? '-0' : String(arg)}`).join('\n')}\n---\n`;
  const parsed = parseUWFile(source);
  assert.deepEqual(args.map((_arg, i) => toBits(parsed.frontmatter[`a${i}`])), item.args, item.id);
  const evaluated = evaluateCalc({ id: 'research_nper', label: 'Fixed NPER scalar inputs', deterministic: true, round_to: item.places,
    formula: 'nper(a0,a1,a2,a3)' }, { parsed, prior_results: {} });
  return { id: item.id, source, result, evaluated: { ok: evaluated.ok, ...(evaluated.ok ? { value: encoded(evaluated.value) } : { code: evaluated.error.code, message: evaluated.error.message }) } };
}
const destination = process.argv[2];
assert(destination && !existsSync(destination), 'New output required; never overwrite');
writeFileSync(destination, `${JSON.stringify({ mode: process.env.RESEARCH_MODE ?? 'unmodified', node: process.version, v8: process.versions.v8,
  graphs: process.env.RESEARCH_MODE === 'candidate' ? inputs.cases.map(graph) : null, boundaries: inputs.cases.map(boundary) })}\n`);
