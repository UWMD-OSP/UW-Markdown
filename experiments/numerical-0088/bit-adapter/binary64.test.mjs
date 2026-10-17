import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as bits from './binary64.mjs';

const vectors = JSON.parse(readFileSync(new URL('./vectors.json', import.meta.url), 'utf8'));
const hex = value => Number.parseInt(value, 16);

test('finite word known answers, signed zero and unchanged word insertion', () => {
  for (const row of vectors.finite) {
    const words = { hi: hex(row.hi), lo: hex(row.lo) };
    assert.deepEqual(bits.split(Number(row.decimal)), words, row.decimal);
    assert.deepEqual(bits.split(bits.join(words.hi, words.lo)), words);
  }
  assert.deepEqual(bits.split(bits.replaceHigh(bits.join(0x3ff00000, 1), 0xbff00000)),
    { hi: 0xbff00000, lo: 1 });
  assert.deepEqual(bits.split(bits.replaceLow(bits.join(0x3ff00000, 1), 0)),
    { hi: 0x3ff00000, lo: 0 });
  assert.deepEqual(bits.split(bits.replaceHigh(-0, 0)), { hi: 0, lo: 0 });
});

test('normalization and signed interpretation use specified integer answers', () => {
  for (const row of vectors.normalize) assert.equal(bits.u32(row.input), hex(row.word));
  for (const row of vectors.signed) assert.equal(bits.i32(hex(row.word)), row.value);
  assert.equal(Object.is(bits.u32(-0), -0), false);
});

test('mask operations preserve unsigned words including the sign bit', () => {
  for (const row of vectors.bitwise) {
    assert.equal(bits.and32(hex(row.left), hex(row.right)), hex(row.and));
    assert.equal(bits.or32(hex(row.left), hex(row.right)), hex(row.or));
    assert.equal(bits.xor32(hex(row.left), hex(row.right)), hex(row.xor));
    assert.equal(bits.not32(hex(row.left)), hex(row.not_left));
  }
});

test('shifts include explicit count zero, sign extension and whole-word count 32', () => {
  for (const row of vectors.shifts) {
    assert.equal(bits.shl32(hex(row.word), row.count), hex(row.left));
    assert.equal(bits.shr32(hex(row.word), row.count), hex(row.right));
    assert.equal(bits.sar32(hex(row.word), row.count), hex(row.arithmetic));
  }
  // The normalization expression low >> (32-i) must not mask 32 to zero.
  assert.equal(bits.shr32(0x80000001, 32 - 0), 0);
});

test('wrapping addition/subtraction expose carry and borrow independently of sign', () => {
  for (const row of vectors.add) assert.deepEqual(bits.add32(hex(row.left), hex(row.right)),
    { word: hex(row.word), carry: row.carry });
  for (const row of vectors.sub) assert.deepEqual(bits.sub32(hex(row.left), hex(row.right)),
    { word: hex(row.word), borrow: row.borrow });
  const low = bits.add32(0xffffffff, 1);
  assert.deepEqual(bits.add32(0x12345678, low.carry), { word: 0x12345679, carry: 0 });
  const borrowed = bits.sub32(0, 1);
  assert.deepEqual(bits.sub32(0x12345678, borrowed.borrow), { word: 0x12345677, borrow: 0 });
});

test('invalid word/shift domains and nonfinite encodings are refused', () => {
  for (const value of [-1, 0x100000000, 0.5, true, null, Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const fn of [bits.i32, bits.and32, bits.or32, bits.xor32, bits.not32, bits.shl32, bits.shr32, bits.sar32, bits.add32, bits.sub32]) {
      assert.throws(() => fn(value, 0));
    }
    assert.throws(() => bits.join(0, value));
    assert.throws(() => bits.join(value, 0));
  }
  for (const count of [-1, 33, 0.5, true, null]) {
    for (const fn of [bits.shl32, bits.shr32, bits.sar32]) assert.throws(() => fn(1, count));
  }
  for (const value of [true, null, '1', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) assert.throws(() => bits.split(value));
  for (const value of [0.5, true, null, 9007199254740992]) assert.throws(() => bits.u32(value));
  for (const hi of [0x7ff00000, 0xfff00000, 0x7ff80000]) assert.throws(() => bits.join(hi, 0));
});
