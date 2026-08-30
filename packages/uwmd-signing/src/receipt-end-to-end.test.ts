// The end-to-end path RFC 0016 always described but could not run: issue a
// receipt over a real document, sign it, and verify it back to `verified`.
//
// Kept separate from `receipt-signing.test.ts` (which uses a literal receipt to
// isolate the crypto) because this one is about the seam: `verifyReceipt` in
// core, `signatureVerifier` from here, and the three-state verdict staying
// honest at each step.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { issueReceipt, verifyReceipt } from '@uwmd/core';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { signReceipt, stampReceiptSignature } from './sign.js';
import { createReceiptSignatureVerifier } from './verify.js';

const DEAL_PATH = resolve(
  __dirname,
  '../../../conformance/receipts/verify/01-clean/deal.uwx.md',
);
const DEAL = readFileSync(DEAL_PATH, 'utf8');

async function issued() {
  return issueReceipt(DEAL, {
    filename: DEAL_PATH,
    issued_at: '2026-08-27T00:00:00Z',
    issuer: 'conformance',
  });
}

describe('signed receipts end to end', () => {
  it('verifies a signed receipt when the backend holds the key', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(await issued(), await signReceipt(await issued(), signing));

    const result = await verifyReceipt(signed, DEAL, {
      filename: DEAL_PATH,
      signatureVerifier: createReceiptSignatureVerifier(new InMemoryKeyStore([verifying])),
    });
    expect(result.verdict).toBe('verified');
    expect(result.issues).toEqual([]);
  });

  it('still reports RCP-08 unverifiable when no backend is supplied', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(await issued(), await signReceipt(await issued(), signing));

    const result = await verifyReceipt(signed, DEAL, { filename: DEAL_PATH });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-08');
  });

  it('fails a receipt whose signature does not check out', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const impostor = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(await issued(), await signReceipt(await issued(), signing));

    const result = await verifyReceipt(signed, DEAL, {
      filename: DEAL_PATH,
      signatureVerifier: createReceiptSignatureVerifier(new InMemoryKeyStore([impostor.verifying])),
    });
    expect(result.verdict).toBe('failed');
  });

  it('an unsigned receipt is unaffected by the presence of a backend', async () => {
    const { verifying } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const result = await verifyReceipt(await issued(), DEAL, {
      filename: DEAL_PATH,
      signatureVerifier: createReceiptSignatureVerifier(new InMemoryKeyStore([verifying])),
    });
    expect(result.verdict).toBe('verified');
  });
});
