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

it('keeps the public support claim gated on independent implementation and CLI proof', async () => {
  const { REFERENCE_IMPLEMENTATION_MANIFEST } = await import('./reference-implementation.js');
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.profiles).not.toContain('pro-forma');
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).not.toContain('pro-forma-verify');
});
