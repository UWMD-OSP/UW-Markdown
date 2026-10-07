import { computeReplacementCashFlowBindingDigest as browserDigest } from './browser.js';
import { sectionBlocks } from './replacement-funding-structure.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseUWFile, blockPayload } from './parser.js';
import { validateUWFile } from './validator.js';
import {
  computeReplacementCashFlowBindingDigest,
  verifyReplacementFundingBindings,
} from './replacement-funding.js';
import { createUWMCPValidationResult } from './bindings.js';
import { toUWEnvelope } from './envelope.js';
import * as integrity from './integrity.js';
import type { CashFlowRow } from './cash-flow-series.js';

function source(name: string) {
  return readFileSync(
    resolve(process.cwd(), `../../conformance/hedge/0070-${name}/deal.uwx.md`),
    'utf8'
  );
}
const codes = (name: string) =>
  validateUWFile(parseUWFile(source(name)))
    .errors.filter((i) => /^HDG-|^ESC-/.test(i.code))
    .map((i) => i.code)
    .sort();
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('RFC 0070 separate verification', () => {
  it.each([
    'outright-payment',
    'explicit-zero',
    'before-expiration',
    'on-expiration',
    'after-expiration',
    'currency-absent',
    'currency-null',
    'same-day-distinct',
    'unrelated-edit',
    'reviewed-rebind',
  ])('verifies %s without writes', async (name) => {
    const text = source(name);
    const parsed = parseUWFile(text);
    const before = structuredClone(parsed);
    expect(codes(name)).toEqual([]);
    expect(
      validateUWFile(parsed).errors.some((i) => i.code === 'HDG-09' || i.code === 'HDG-11')
    ).toBe(false);
    expect((await verifyReplacementFundingBindings(parsed)).state).toBe('verified');
    expect(parsed).toEqual(before);
    expect(parsed.raw).toBe(text);
  });
  it.each(['explicit-escrow', 'legacy-escrow'])('keeps %s legacy branch', async (name) => {
    expect(codes(name)).toEqual([]);
    expect(await verifyReplacementFundingBindings(parseUWFile(source(name)))).toEqual({
      state: 'not_checked',
      reason: 'not_applicable',
      issues: [],
    });
  });
  it.each([
    'missing-sources-uses',
    'missing-uses',
    'escrow-missing',
    'escrow-contradiction-0',
    'escrow-contradiction-100',
  ])('closes/refuses %s', async (name) => {
    expect(codes(name)).toEqual(['ESC-04']);
    expect((await verifyReplacementFundingBindings(parseUWFile(source(name)))).state).toBe(
      'unverifiable'
    );
  });
  it.each([
    'stale-currency',
    'stale-currency-removed',
    'stale-amount',
    'stale-insertion',
    'stale-variant',
    'stale-index',
    'stale-reorder',
    'stale-deletion',
    'stale-label',
  ])('separates stale %s from structural success', async (name) => {
    expect(codes(name)).toEqual([]);
    const result = await verifyReplacementFundingBindings(parseUWFile(source(name)));
    expect(result.state).toBe('failed');
    if (result.state === 'failed') {
      expect(result.reason).toBe('stale_binding');
      expect(result.stated_digest).not.toBe(result.computed_digest);
      expect(result.issues[0].code).toBe('HDG-09');
    }
  });
  it.each(['positive-payment', 'payment-on-effective'])('refuses %s with HDG-10', (name) =>
    expect(codes(name)).toEqual(['HDG-10'])
  );
  it.each([
    'nonreplacement-unhedged-outright',
    'nonreplacement-unhedged-escrow',
    'nonreplacement-loan_matures_first-outright',
    'nonreplacement-loan_matures_first-escrow',
  ])('refuses %s', (name) => expect(codes(name)).toEqual(['HDG-07']));
  it('captures the entire snapshot before first await', async () => {
    const parsed = parseUWFile(source('outright-payment'));
    const pending = verifyReplacementFundingBindings(parsed);
    const b = sectionBlocks(parsed.sections.cash_flow_series)[0];
    if (!b || !('annotation' in b)) throw new Error('fixture source missing');
    (blockPayload(b) as { series: CashFlowRow[] }).series[1]!.amount = -7;
    parsed.frontmatter.currency_code = 'CAD';
    expect((await pending).state).toBe('verified');
    expect((await verifyReplacementFundingBindings(parsed)).state).toBe('failed');
  });
  it('pins USD/null known answers and uses real Web Crypto fallback', async () => {
    const rows: CashFlowRow[] = [
      { date: '2026-01-01', amount: -400000, kind: 'debt_service', label: 'rate_cap_premium' },
      {
        date: '2028-01-01',
        amount: -360000,
        kind: 'debt_service',
        label: 'rate_cap_replacement_purchase',
      },
    ];
    const usd = 'sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa';
    const absent = 'sha256:33072bf8b331730e37176a3fb1b1f80cb3fc1c398bed4746fcffc3d5b74ea63a';
    expect(await computeReplacementCashFlowBindingDigest(rows, 'cap-cash', 1, 'USD')).toBe(usd);
    expect(await computeReplacementCashFlowBindingDigest(rows, 'cap-cash', 1, null)).toBe(absent);
    vi.stubGlobal('process', { ...process, versions: { ...process.versions, node: undefined } });
    vi.stubGlobal('crypto', webcrypto);
    expect(await browserDigest(rows, 'cap-cash', 1, 'USD')).toBe(usd);
    expect(await computeReplacementCashFlowBindingDigest(rows, 'cap-cash', 1, 'USD')).toBe(usd);
    expect(await computeReplacementCashFlowBindingDigest(rows, 'cap-cash', 1, null)).toBe(absent);
  });
  it('reports unavailable crypto without inventing validation or mismatch errors', async () => {
    vi.spyOn(integrity, 'sha256TextHex').mockRejectedValue(new Error('provider unavailable'));
    const parsed = parseUWFile(source('outright-payment'));
    expect(codes('outright-payment')).toEqual([]);
    expect(await verifyReplacementFundingBindings(parsed)).toMatchObject({
      state: 'unverifiable',
      reason: 'crypto_unavailable',
      issues: [],
      structural_issues: [],
    });
  });
  it('MCP refuses unavailable binding verification independently of structural findings', async () => {
    const parsed = parseUWFile(source('outright-payment'));
    for (const entry of Object.values(parsed.sections))
      for (const block of sectionBlocks(entry)) block.content._meta = block.meta;
    const original = integrity.sha256TextHex;
    vi.spyOn(integrity, 'sha256TextHex')
      .mockImplementationOnce(original)
      .mockRejectedValue(new Error('provider unavailable'));
    const result = await createUWMCPValidationResult(toUWEnvelope(parsed), 'HDG-CONF');
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      replacement_funding_verification: { state: 'unverifiable', reason: 'crypto_unavailable' },
    });
  });
  it('rejects malformed helper arguments with typed protocol error', async () => {
    await expect(
      computeReplacementCashFlowBindingDigest([], 'cap-cash', 0, null)
    ).rejects.toMatchObject({ category: 'validate', code: 'HDG-08' });
  });
  it('does not verify economic authenticity after a deliberate reviewed rebind', async () => {
    const parsed = parseUWFile(source('reviewed-rebind'));
    const result = await verifyReplacementFundingBindings(parsed);
    expect(result.state).toBe('verified');
    if (result.state === 'verified') expect(result.context.row_index).toBe(2);
    const b = sectionBlocks(parsed.sections.cash_flow_series)[0];
    if (!b || !('annotation' in b)) throw new Error('fixture source missing');
    expect((blockPayload(b) as { series: CashFlowRow[] }).series[2]!.label).toBe('unrelated');
    // Producer-side source economics are pinned independently of the rebound row.
    const sourcePayment = { date: '2028-01-01', amount: -360000 };
    expect((blockPayload(b) as { series: CashFlowRow[] }).series[2]).not.toMatchObject(sourcePayment);
    // The producer source-mapping assertion rejects the wrong economic row.
    expect(
      (blockPayload(b) as { series: CashFlowRow[] }).series[2]!.label ===
        'rate_cap_replacement_purchase'
    ).toBe(false);
  });
  it.each(['outright-payment', 'stale-amount'])(
    'MCP exposes separate state for %s',
    async (name) => {
      const parsed = parseUWFile(source(name));
      for (const entry of Object.values(parsed.sections))
        for (const block of sectionBlocks(entry)) block.content._meta = block.meta;
      const result = await createUWMCPValidationResult(toUWEnvelope(parsed), 'HDG-CONF');
      expect(result.structuredContent).toMatchObject({
        replacement_funding_verification: {
          state: name === 'outright-payment' ? 'verified' : 'failed',
        },
      });
      expect(result.isError).toBe(name !== 'outright-payment');
      expect(
        (result.structuredContent as { errors: Array<{ code: string }> }).errors.some(
          (i) => i.code === 'HDG-09'
        )
      ).toBe(false);
    }
  );
  it('keeps all 17 original RFC 0056 fixture bytes unchanged', async () => {
    const root = resolve(process.cwd(), '../../conformance/hedge');
    // Later RFCs' cases carry their number as a prefix (0070-, 0075-).
    const names = readdirSync(root).filter((n) => !/^\d{4}-/.test(n));
    expect(names.length).toBe(17);
    for (const name of names) {
      const file = resolve(root, name, 'deal.uwx.md');
      const text = readFileSync(file, 'utf8');
      const parsed = parseUWFile(text);
      const before = structuredClone(parsed);
      validateUWFile(parsed);
      await verifyReplacementFundingBindings(parsed);
      expect(parsed).toEqual(before);
      expect(parsed.raw).toBe(text);
      expect(readFileSync(file, 'utf8')).toBe(text);
    }
  });
});

describe('RFC 0070 canonical snapshot controls', () => {
  it('canonicalizes key order and JSON numeric spelling, retaining row null versus absence', async () => {
    const a = JSON.parse('[{"date":"2028-01-01","amount":-360000}]');
    const b = JSON.parse('[{"amount":-360000.0,"date":"2028-01-01"}]');
    const digest = await computeReplacementCashFlowBindingDigest(a, 'cash', 0, null);
    expect(await computeReplacementCashFlowBindingDigest(b, 'cash', 0, null)).toBe(digest);
    expect(
      await computeReplacementCashFlowBindingDigest([{ ...a[0], label: null }], 'cash', 0, null)
    ).not.toBe(digest);
    expect(
      await computeReplacementCashFlowBindingDigest([{ ...a[0], kind: null }], 'cash', 0, null)
    ).not.toBe(digest);
  });
  it('captures helper rows before yielding', async () => {
    const rows: CashFlowRow[] = [{ date: '2028-01-01', amount: 0 }];
    const expected = await computeReplacementCashFlowBindingDigest(rows, 'cash', 0, null);
    const pending = computeReplacementCashFlowBindingDigest(rows, 'cash', 0, null);
    rows[0]!.amount = -9;
    expect(await pending).toBe(expected);
  });
  it('verifies Format 2.0 nested metadata without committing metadata', async () => {
    const original = source('outright-payment');
    const text = original
      .replace('uw_version: "1.1"', 'uw_version: "2.0"')
      .replace(
        /\{\r?\n {2}"(loan_amount|uses|series)"/g,
        '{\n  "_meta": {"section":"test","lifecycle":{"revision":1},"provenance":{"source":"manual"}},\n  "$1"'
      );
    const parsed = parseUWFile(text);
    expect(parsed.frontmatter.uw_version).toBe('2.0');
    expect((await verifyReplacementFundingBindings(parsed)).state).toBe('verified');
  });
  it('rejects an explicitly superseded source even in an externally constructed parse view', async () => {
    const parsed = parseUWFile(source('outright-payment'));
    sectionBlocks(parsed.sections.cash_flow_series)[0]!.meta.superseded = true;
    expect(await verifyReplacementFundingBindings(parsed)).toMatchObject({
      state: 'unverifiable',
      reason: 'unresolvable_source',
    });
  });
  it('preserves explicit null as the legacy escrow path', async () => {
    const parsed = parseUWFile(source('legacy-escrow'));
    const hedge = (
      blockPayload(sectionBlocks(parsed.sections.debt_structure)[0]!) as {
        rate_hedge: Record<string, unknown>;
      }
    ).rate_hedge;
    hedge.replacement_funding = null;
    expect(validateUWFile(parsed).errors.filter((i) => /^(HDG|ESC)-/.test(i.code))).toEqual([]);
    expect(await verifyReplacementFundingBindings(parsed)).toMatchObject({
      state: 'not_checked',
      reason: 'not_applicable',
    });
  });
});
