// Receipts issued through @uwmd/core (RFC 0083). The receipt API is
// @uwmd/verify's (receipts.test.ts there). These cases pin the identities:
// the engine is always @uwmd/verify, the code that computes, and the issuer
// through core is @uwmd/core.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VERIFY_PACKAGE_NAME,
  VERIFY_VERSION,
  issueReceipt as issueReceiptStandard,
  verifyReceipt,
  type UWReceipt,
} from '@uwmd/verify';
import * as coreIndex from './index.js';
import { issueReceipt } from './receipt-engine.js';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

const PARKVIEW = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');
const ISSUED_AT = '2026-08-09T00:00:00Z';
const parkview = () => readFile(PARKVIEW, 'utf8');

/** The same receipt with one stated result moved, so recomputation disagrees. */
function tampered(receipt: UWReceipt): UWReceipt {
  const copy = JSON.parse(JSON.stringify(receipt)) as UWReceipt;
  const ltv = copy.computation.results.find((r) => r.calc_id === 'dscr');
  if (!ltv) throw new Error('fixture drift: no ltv result');
  ltv.value = 0.42;
  return copy;
}

describe('issueReceipt through @uwmd/core', () => {
  it('names @uwmd/verify as the engine and @uwmd/core as the issuer', async () => {
    const receipt = await issueReceipt(await parkview(), { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect(receipt.computation.engine).toBe(VERIFY_PACKAGE_NAME);
    expect(receipt.computation.engine_version).toBe(VERIFY_VERSION);
    expect(receipt.issuer).toBe(`${CORE_PACKAGE_NAME}@${CORE_VERSION}`);
  });

  it('differs from a receipt @uwmd/verify issues directly only in the issuer', async () => {
    const raw = await parkview();
    const options = { filename: PARKVIEW, issued_at: ISSUED_AT };
    const direct = await issueReceiptStandard(raw, options);
    expect(direct.issuer).toBe(`${VERIFY_PACKAGE_NAME}@${VERIFY_VERSION}`);
    const core = await issueReceipt(raw, options);
    expect(JSON.stringify({ ...core, issuer: null })).toBe(JSON.stringify({ ...direct, issuer: null }));
  });

  it('keeps an explicit issuer, engine and engine version', async () => {
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
});

describe('verifying a core-issued receipt', () => {
  it('core exports verify’s verifyReceipt unchanged', () => {
    expect(coreIndex.verifyReceipt).toBe(verifyReceipt);
  });

  it('verifies an untouched receipt', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect((await verifyReceipt(receipt, raw, { filename: PARKVIEW })).verdict).toBe('verified');
  });

  it('a verifier holding only @uwmd/verify blames the record for a tampered one (failed, not RCP-07)', async () => {
    // The RFC 0078 boundary test: the engine matches, so the disagreement is
    // attributable to the record.
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const result = await verifyReceipt(tampered(receipt), raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).not.toContain('RCP-07');
  });

  it('still attributes a disagreement to the engine when the receipt names another (RCP-07)', async () => {
    const raw = await parkview();
    const other = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT, engine: 'other-engine' });
    const result = await verifyReceipt(tampered(other), raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-07');
  });
});
