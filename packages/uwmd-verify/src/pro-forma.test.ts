import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyProForma } from './pro-forma.js';
import { parseUWFile } from './parser.js';
import type { UWBlock } from './types.js';
const base = new URL('../../../conformance/pro-forma/', import.meta.url);
const dirs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
it.each(dirs)('satisfies the authored %s control without changing source bytes', name => {
  const source = readFileSync(new URL(name + '/deal.uwx.md', base), 'utf8');
  const expected = JSON.parse(readFileSync(new URL(name + '/expected.json', base), 'utf8'));
  const before = source;
  const report = verifyProForma(source);
  expect(report).toMatchObject(expected);
  expect(source).toBe(before);
  expect(report.coverage.total).toBe(report.assertions.length);
  expect(report.coverage.total).toBe(Object.values(report.coverage.by_verdict).reduce((a,b) => a+b,0));
});
it('separates current-model state from stale source and leaves the model unchanged', () => {
  const source = readFileSync(new URL('verified-moic/deal.uwx.md', base), 'utf8');
  const model = parseUWFile(source);
  (model.sections.dcf as UWBlock).content.result = 9;
  const before = JSON.stringify(model);
  const report = verifyProForma(model);
  expect(report.selection.operation).toBe('model');
  expect(report.assertions[0]).toMatchObject({ stated: 9, state: 'failed', target: { block_address_kind: 'model' } });
  expect(JSON.stringify(model)).toBe(before);
  expect(verifyProForma(source).assertions[0]!.state).toBe('verified');
});
it('refuses absent claims with the bounded typed request code', () => {
  expect(() => verifyProForma('---\nuw_version: "3.0"\nasset_class: multifamily\n---\n')).toThrow(/CALC-PRO-FORMA/);
});
it('does not invoke accessors in an untrusted current model', () => {
  const source = readFileSync(new URL('empty/deal.uwx.md', base), 'utf8');
  const model = parseUWFile(source); let invoked = false;
  Object.defineProperty(model.frontmatter, 'trap', { enumerable: true, get() { invoked = true; return 1; } });
  expect(() => verifyProForma(model)).toThrow(); expect(invoked).toBe(false);
});
