import { readFileSync, readdirSync } from 'node:fs';
import { runProcess } from '../../../test/cli.mjs';
import { fileURLToPath } from 'node:url';
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

it('declares the bounded profile after independent implementation and CLI proof', async () => {
  const { REFERENCE_IMPLEMENTATION_MANIFEST } = await import('./reference-implementation.js');
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.profiles).toContain('pro-forma');
  expect(REFERENCE_IMPLEMENTATION_MANIFEST.capabilities).toContain('pro-forma-verify');
});

const regressions = new URL('../../../conformance/pro-forma/', import.meta.url);
const defects = readdirSync(regressions).filter(name => name.startsWith('d1-') || name.startsWith('d2-') || name.startsWith('rfc0128-'));
it.each(defects)('reports the reference regression exit and JSON without rewriting %s', async name => {
  const file = new URL(`${name}/deal.uwx.md`, regressions);
  const expected = JSON.parse(readFileSync(new URL(`${name}/expected.json`, regressions), 'utf8'));
  const before = readFileSync(file);
  const child = await runProcess(process.execPath, [fileURLToPath(new URL('../../uwmd-cli/bin/uwmd.mjs', import.meta.url)), 'verify-pro-forma', fileURLToPath(file), '--json'], { encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(expected.exit_code);
  expect(JSON.parse(child.stdout)).toMatchObject(expected);
  expect(readFileSync(file)).toEqual(before);
});
