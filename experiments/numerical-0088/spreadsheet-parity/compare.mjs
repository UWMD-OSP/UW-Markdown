// Research only: actual draft public primitives, accepted VIII.5/RFC0079 comparison.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pinnedPow, pinnedExp, pinnedLog } from '../../../packages/uwmd-verify/dist/calc/pinned-numerics.js';
import { quantizeDecimal } from '../../../packages/uwmd-verify/dist/calc/quantize.js';
import { compareStatedMetric, getStatedDecimals } from '../../../packages/uwmd-verify/dist/calc/stated-precision.js';

const controls = JSON.parse(fs.readFileSync(new URL('./controls.json', import.meta.url), 'utf8')).controls;
export function encode(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleBE(value);
  return { kind: Number.isFinite(value) ? 'binary64' : Number.isNaN(value) ? 'nan' : 'infinity',
    bits: bytes.toString('hex'), ...(Number.isFinite(value) ? { value } : { sign: value < 0 ? -1 : 1 }) };
}
export function references() {
  const raw = [
    pinnedPow(1.2, 31), pinnedPow(1.1, -31), pinnedPow(2, -1074),
    pinnedLog(1.345), pinnedExp(0.345), pinnedExp(1000),
    1 / pinnedPow(1 + 1e155, 2), quantizeDecimal(1.005, 2),
    ((26000000 * (0.0625 / 12)) / (1 - pinnedPow(1 + 0.0625 / 12, -360))) * 12,
    (26000000 / 360) * 12,
  ];
  return controls.map((control, index) => {
    const h = index >= 8 ? 3100000 / raw[index] : raw[index];
    const hPlaces = index >= 7 ? 2 : index === 6 ? 6 : 12;
    return { id: control[0], G: raw[index], H: h,
      reportedH: Number.isFinite(h) ? quantizeDecimal(h, hPlaces) : h,
      precision: index >= 8 ? { G: [0, 2], H: [2, 4] } :
        { G: [index === 7 ? 2 : index === 6 ? 6 : 12, index === 7 ? 2 : index === 6 ? 6 : 12],
          H: [hPlaces, hPlaces] } };
  });
}
export function compare(rows) {
  const refs = references();
  if (rows.length !== refs.length) throw new Error('Incomplete native control inventory');
  const observations = [];
  for (let index = 0; index < refs.length; index++) {
    const ref = refs[index];
    if (rows[index].id !== ref.id) throw new Error('Native control identity/order differs');
    for (const col of ['G', 'H']) {
      const native = rows[index][col];
      const expected = ref[col];
      const expectedCell = col === 'H' ? ref.reportedH : expected;
      const [minimum, ceiling] = ref.precision[col];
      let comparison;
      if (native.kind === 'binary64' && Number.isFinite(expected)) {
        comparison = compareStatedMetric(expected, native.value, getStatedDecimals(native.lexeme),
          { minimum_stated_decimals: minimum, round_to: ceiling });
      } else {
        comparison = { state: 'not_numeric_comparable',
          reason: 'spreadsheet_error_or_nonfinite_primitive_is_a_distinct_representation_boundary' };
      }
      const rawEqual = native.kind === 'binary64' && native.bits === encode(expectedCell).bits;
      const finding = !rawEqual || comparison.state !== 'verified';
      observations.push({ id: ref.id, cell: `${col}${index + 4}`, native,
        pinned_unrounded: encode(expected), pinned_cell_result: encode(expectedCell),
        minimum_stated_decimals: minimum, round_to: ceiling, comparison,
        classification: finding ? 'export-contract-finding' : 'agrees',
        raw_cell_word_equal: rawEqual,
        scope: index === 5 ? 'raw EXP Infinity; current public calc EXP refuses, not a financial Infinity' :
          index === 6 ? 'internal POWER Infinity yields finite UWMD zero; spreadsheet error is not that result' :
            index === 2 ? 'subnormal raw-word identity remains visible even when precision comparison agrees' :
              'native formula and unchanged pinned financial/quantizer graph' });
    }
  }
  return { scope: 'UNACCEPTED bounded native-formula evidence; no UWMD arithmetic activation or universal export parity',
    controls: refs.length, cells: observations.length,
    precision_agreements: observations.filter(x => x.comparison.state === 'verified').length,
    precision_disagreements: observations.filter(x => x.comparison.state === 'failed').length,
    nonnumeric_boundaries: observations.filter(x => x.comparison.state === 'not_numeric_comparable').length,
    export_contract_findings: observations.filter(x => x.classification === 'export-contract-finding').length,
    observations };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const native = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify({ node: process.version, v8: process.versions.v8, ...compare(native.controls) }, null, 2));
}
