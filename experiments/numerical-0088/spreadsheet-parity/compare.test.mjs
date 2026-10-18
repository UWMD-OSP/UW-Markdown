import assert from 'node:assert/strict';
import test from 'node:test';
import { compare, encode, references } from './compare.mjs';

function rows() {
  return references().map(ref => ({ id: ref.id, G: { ...encode(ref.G), lexeme: String(ref.G) },
    H: { ...encode(ref.reportedH), lexeme: String(ref.reportedH) } }));
}
test('raw primitive Infinity is distinct from a spreadsheet error and internal finite zero', () => {
  const native = rows();
  native[5].G = native[5].H = { kind: 'spreadsheet_error', lexeme: '#NUM!' };
  native[6].G = native[6].H = { kind: 'spreadsheet_error', lexeme: '#NUM!' };
  const result = compare(native);
  assert.equal(result.nonnumeric_boundaries, 4);
  assert.equal(result.observations[12].pinned_unrounded.value, 0);
  assert.equal(result.observations[10].pinned_unrounded.kind, 'infinity');
  assert.equal(result.observations[12].classification, 'export-contract-finding');
});
test('a raw subnormal mismatch is retained even when decimal comparison agrees', () => {
  const native = rows();
  native[2].G = { ...encode(0), lexeme: '0' };
  const observation = compare(native).observations[4];
  assert.equal(observation.comparison.state, 'verified');
  assert.equal(observation.raw_cell_word_equal, false);
  assert.equal(observation.classification, 'export-contract-finding');
});
test('ratio uses actual saved source precision and never double rounds the result', () => {
  const native = rows();
  native[8].H = { ...encode(1.5), lexeme: '1.50' };
  const observation = compare(native).observations[17];
  assert.equal(observation.comparison.comparison_decimals, 2);
  assert.equal(observation.comparison.state, 'failed');
});
test('missing or reordered native cases are refused', () => {
  assert.throws(() => compare(rows().slice(1)), /Incomplete native/);
  const native = rows();
  native.reverse();
  assert.throws(() => compare(native), /identity/);
});
