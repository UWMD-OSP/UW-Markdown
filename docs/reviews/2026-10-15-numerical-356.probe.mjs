// Read-only probe of the existing compiled implementation, not a new contract.
// Usage: node this-file.mjs /absolute/built/repo < vectors.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = resolve(process.argv[2]);
const { BUILTINS } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/calc/builtins.js`));
const { quantizeDecimal } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/calc/quantize.js`));
const { xnpvOf, xirrOf } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/cash-flow-series.js`));
const { evaluateCalc } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/calc/index.js`));
const { computeResultsDigest } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/receipts.js`));
const { parseUWFile } = await import(pathToFileURL(`${base}/packages/uwmd-verify/dist/parser.js`));
function bits(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleBE(value);
  return bytes.toString('hex');
}
function integerProduct(base, exponent) {
  let value = 1;
  for (let index = 0; index < Math.abs(exponent); index++) value *= base;
  return exponent < 0 ? 1 / value : value;
}
const cases = JSON.parse(readFileSync(0, 'utf8'));
const results = cases.map(({ id, fn, args }) => {
  try {
    const value = fn === 'integer_product' ? integerProduct(...args)
      : fn === 'xnpv' ? xnpvOf(args[0], args[1])
      : fn === 'xirr' ? xirrOf(args[0]) : BUILTINS[fn](args);
    if (!Number.isFinite(value)) return { id, nonfinite: String(value) };
    return { id, value, bits: bits(value), quantized: [2, 6, 12].map(d => bits(quantizeDecimal(value, d))) };
  } catch (error) {
    return { id, error: error.proto?.code ?? error.code ?? error.name };
  }
});
const declaration = { id: 'power_boundary', formula: 'pow(1.2, 31)', round_to: 12 };
const parsed = parseUWFile(readFileSync(`${base}/conformance/documents/fixtures/01-minimal-screening.uwx.md`, 'utf8'));
const context = { parsed, prior_results: {} };
const calculated = evaluateCalc(declaration, context);
const receiptResults = [{ calc_id: calculated.calc_id, computed: calculated.ok, value: calculated.value }];
// Decimal literal syntax is intentional: safe expressions do not admit e155.
const large = `1${'0'.repeat(155)}`;
const rangeDeclaration = { id: 'negative_power_range',
  formula: `pow(${large}, -2) * ${large} * ${large}`, round_to: 6 };
console.log(JSON.stringify({ runtime: process.version, v8: process.versions.v8, arch: process.arch,
  results, receiptBoundary: { declaration, calculated, results: receiptResults,
    digest: await computeResultsDigest(receiptResults) }, negativePowerBoundary: {
    declaration: rangeDeclaration, calculated: evaluateCalc(rangeDeclaration, context),
    candidateFinal: integerProduct(1e155, -2) * 1e155 * 1e155 } }));
