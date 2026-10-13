// Receipts through @uwmd/core name @uwmd/core (RFC 0083). The receipt API is
// @uwmd/verify's (receipts.test.ts there); these cases pin the engine identity
// core supplies and that every other option passes through unchanged.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VERIFY_PACKAGE_NAME,
  VERIFY_VERSION,
  issueReceipt as issueReceiptStandard,
  verifyReceipt as verifyReceiptStandard,
  type UWReceipt,
} from '@uwmd/verify';
import { issueReceipt, verifyReceipt } from './receipt-engine.js';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

const PARKVIEW = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');
const ISSUED_AT = '2026-08-09T00:00:00Z';
const parkview = () => readFile(PARKVIEW, 'utf8');

/** The same receipt with one stated result moved, so recomputation disagrees. */
function tampered(receipt: UWReceipt): UWReceipt {
  const copy = JSON.parse(JSON.stringify(receipt)) as UWReceipt;
  const ltv = copy.computation.results.find((r) => r.calc_id === 'ltv');
  if (!ltv) throw new Error('fixture drift: no ltv result');
  ltv.value = 0.42;
  return copy;
}

describe('issueReceipt through @uwmd/core', () => {
  it('records @uwmd/core and CORE_VERSION as the engine and issuer', async () => {
    const receipt = await issueReceipt(await parkview(), { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect(receipt.computation.engine).toBe(CORE_PACKAGE_NAME);
    expect(receipt.computation.engine_version).toBe(CORE_VERSION);
    expect(receipt.issuer).toBe(`${CORE_PACKAGE_NAME}@${CORE_VERSION}`);
  });

  it('is the standard receipt with only the identity defaulted', async () => {
    const raw = await parkview();
    const options = { filename: PARKVIEW, issued_at: ISSUED_AT };
    const core = await issueReceipt(raw, options);
    const standard = await issueReceiptStandard(raw, {
      ...options,
      engine: CORE_PACKAGE_NAME,
      engine_version: CORE_VERSION,
      issuer: `${CORE_PACKAGE_NAME}@${CORE_VERSION}`,
    });
    expect(JSON.stringify(core)).toBe(JSON.stringify(standard));
  });

  it('keeps an explicit engine, engine version and issuer', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
      engine: 'other-engine',
      engine_version: '9.9.9',
      issuer: 'uwmd-cli@9.9.9',
    });
    expect(receipt.computation.engine).toBe('other-engine');
    expect(receipt.computation.engine_version).toBe('9.9.9');
    expect(receipt.issuer).toBe('uwmd-cli@9.9.9');
  });

  it('differs from a receipt @uwmd/verify issues directly only in the identity', async () => {
    const raw = await parkview();
    const options = { filename: PARKVIEW, issued_at: ISSUED_AT };
    const direct = await issueReceiptStandard(raw, options);
    expect(direct.computation.engine).toBe(VERIFY_PACKAGE_NAME);
    expect(direct.computation.engine_version).toBe(VERIFY_VERSION);
    const core = await issueReceipt(raw, options);
    expect({ ...core, issuer: null, computation: { ...core.computation, engine: null, engine_version: null } })
      .toEqual({ ...direct, issuer: null, computation: { ...direct.computation, engine: null, engine_version: null } });
  });
});

describe('verifyReceipt through @uwmd/core', () => {
  it('verifies a receipt core issued', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect((await verifyReceipt(receipt, raw, { filename: PARKVIEW })).verdict).toBe('verified');
  });

  it('attributes a disagreement to the record when the engine is core (RCP-03 failed)', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect((await verifyReceipt(tampered(receipt), raw, { filename: PARKVIEW })).verdict).toBe('failed');
  });

  it('attributes it to the engine when the receipt names another (RCP-07 unverifiable)', async () => {
    const raw = await parkview();
    const direct = await issueReceiptStandard(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const result = await verifyReceipt(tampered(direct), raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-07');
    // The standard verifier, under its own identity, blames the record instead.
    expect((await verifyReceiptStandard(tampered(direct), raw, { filename: PARKVIEW })).verdict).toBe('failed');
  });

  it('keeps an explicit verifier identity', async () => {
    const raw = await parkview();
    const direct = await issueReceiptStandard(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const result = await verifyReceipt(tampered(direct), raw, {
      filename: PARKVIEW,
      engine: VERIFY_PACKAGE_NAME,
      engine_version: VERIFY_VERSION,
    });
    expect(result.verdict).toBe('failed');
  });
});
