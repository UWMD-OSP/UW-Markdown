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
