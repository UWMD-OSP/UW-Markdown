import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import {
  checkReplacementFundingStructure,
  validBindingSeries,
} from './replacement-funding-structure.js';
const parsed = (name: string) =>
  parseUWFile(
    readFileSync(resolve(process.cwd(), `../../conformance/hedge/0070-${name}/deal.uwx.md`), 'utf8')
  );
describe('RFC 0070 synchronous structure', () => {
  it.each([
    'missing-row',
    'empty-series',
    'bad-index--1',
    'bad-index-0_5',
    'bad-index-9007199254740992',
    'digest-syntax',
    'bad-date',
    'bad-amount',
    'bad-kind',
    'bad-order',
    'bad-row-label',
    'bad-row-member',
  ])('HDG-08 for %s', (name) => {
    expect(checkReplacementFundingStructure(parsed(name)).issues.map((i) => i.code)).toEqual([
      'HDG-08',
    ]);
  });
  it.each([
    'unknown-mode',
    'unknown-member',
    'escrow-reference',
    'missing-reference',
    'digest-member-missing',
  ])('HDG-07 for %s', (name) => {
    expect(checkReplacementFundingStructure(parsed(name)).issues.map((i) => i.code)).toEqual([
      'HDG-07',
    ]);
  });
  it.each([
    'missing-source',
    'variant-fallback-forbidden',
    'superseded-source',
    'ambiguous-debt',
    'ambiguous-sources',
  ])('unresolvable exact source for %s', (name) => {
    const result = checkReplacementFundingStructure(parsed(name));
    expect(result.unresolvable).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(['HDG-08']);
  });
  it('refuses nonfinite, arrays and hidden/unknown row members', () => {
    for (const row of [
      { date: '2028-01-01', amount: Number.NaN },
      { date: '2028-01-01', amount: Number.POSITIVE_INFINITY },
      { date: '2028-01-01', amount: 0, extra: true },
      [],
    ]) {
      expect(validBindingSeries([row])).toBe(false);
    }
  });
  it('does not pretend to have recomputed the commitment', () => {
    const result = checkReplacementFundingStructure(parsed('stale-amount'));
    expect(result.issues).toEqual([]);
    expect(result.ref?.binding_digest).toMatch(/^sha256:/);
  });
});

describe('RFC 0075 senior selection', () => {
  const tranche = (name: string) =>
    parseUWFile(
      readFileSync(resolve(process.cwd(), `../../conformance/hedge/0075-${name}/deal.uwx.md`), 'utf8')
    );
  it.each([
    ['senior-junior-outright', 'outright'],
    ['junior-keyed-base', 'outright'],
    ['senior-junior-escrow', 'escrow'],
    ['junior-only-hedge', 'absent'],
  ])('%s reads the senior block (%s)', (name, funding) => {
    const result = checkReplacementFundingStructure(tranche(name));
    expect(result).toMatchObject({ issues: [], funding, unresolvable: false });
  });
  it('still refuses two seniors', () => {
    const result = checkReplacementFundingStructure(tranche('two-seniors'));
    expect(result.unresolvable).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(['HDG-08']);
  });
});

describe('RFC 0076 refused selections', () => {
  const refused = (name: string) =>
    parseUWFile(
      readFileSync(resolve(process.cwd(), `../../conformance/hedge/0076-${name}/deal.uwx.md`), 'utf8')
    );
  it.each([
    'two-seniors-hedge-unfunded',
    'two-seniors-hedge-malformed',
    'two-seniors-replace-escrow',
    'components-only-hedge',
    'sources-refused-replace',
    'sources-refused-escrow-mode',
    'sources-refused-malformed-hedge',
  ])('%s is a refused selection', (name) => {
    const result = checkReplacementFundingStructure(refused(name));
    expect(result).toMatchObject({ unresolvable: true, selectionRefused: true });
    expect(result.issues.map((i) => [i.code, i.field])).toEqual([['HDG-08', 'rate_hedge']]);
  });
  it('leaves a hedge-free refused document to ESC-04', () => {
    const result = checkReplacementFundingStructure(refused('two-seniors-no-hedge-escrow'));
    expect(result).toMatchObject({ issues: [], unresolvable: false, selectionRefused: false });
  });
  it.each(['missing-source', 'superseded-source', 'variant-fallback-forbidden'])(
    'keeps %s unresolvable without refusing the selection',
    (name) => {
      expect(checkReplacementFundingStructure(parsed(name))).toMatchObject({
        unresolvable: true,
        selectionRefused: false,
      });
    }
  );
});

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { blockPayload } from './parser.js';
import { sectionBlocks } from './replacement-funding-structure.js';

describe('RFC 0070 schema closure', () => {
  const ajv = new Ajv2020({ strict: false });
  addFormats.default(ajv);
  const check = ajv.compile(
    JSON.parse(
      readFileSync(resolve(process.cwd(), '../../spec/schemas/debt-rate-hedge.schema.json'), 'utf8')
    )
  );
  const hedge = (name: string) =>
    (
      blockPayload(sectionBlocks(parsed(name).sections.debt_structure)[0]!) as {
        rate_hedge: unknown;
      }
    ).rate_hedge;
  it.each(['legacy-escrow', 'explicit-escrow', 'outright-payment', 'explicit-zero'])(
    'admits %s shape',
    (name) => expect(check(hedge(name))).toBe(true)
  );
  it.each([
    'unknown-mode',
    'unknown-member',
    'escrow-reference',
    'missing-reference',
    'digest-member-missing',
    'digest-syntax',
    'bad-index--1',
    'bad-index-0_5',
    'bad-index-9007199254740992',
    'nonreplacement-unhedged-outright',
  ])('refuses %s shape', (name) => expect(check(hedge(name))).toBe(false));
});
