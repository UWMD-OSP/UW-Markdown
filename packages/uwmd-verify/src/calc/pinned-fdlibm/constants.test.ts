import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { C } from './constants.js';

it('uses every independently derived exact constant word with no decimal reparse', () => {
  const expected = JSON.parse(readFileSync(resolve(__dirname,
    '../../../../../experiments/numerical-0088/pinned-fdlibm/constants.json'), 'utf8')).literals;
  expect(Object.keys(C)).toEqual(Object.keys(expected));
  const view = new DataView(new ArrayBuffer(8));
  for (const [token, word] of Object.entries(expected)) {
    view.setFloat64(0, C[token]!, false);
    expect(view.getBigUint64(0, false).toString(16).padStart(16, '0'), token).toBe(word);
  }
  expect(Object.isFrozen(C)).toBe(true);
});
