import { expect, it } from 'vitest';
import { parseProFormaArgs } from './cli-pro-forma.js';
it('accepts exactly one file and the JSON flag in either order', () => {
  expect(parseProFormaArgs(['deal.uwx.md'])).toEqual({ file: 'deal.uwx.md', json: false });
  expect(parseProFormaArgs(['--json', 'deal.uwx.md'])).toEqual({ file: 'deal.uwx.md', json: true });
  expect(parseProFormaArgs(['deal.uwx.md', '--json'])).toEqual({ file: 'deal.uwx.md', json: true });
});
it.each([[], ['--unknown'], ['a', 'b'], ['a', '--json', '--json']])('refuses malformed requests with the typed code: %j', (...args) => {
  expect(() => parseProFormaArgs(args as string[])).toThrow(/CALC-PRO-FORMA/);
});
