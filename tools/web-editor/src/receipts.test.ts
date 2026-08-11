// Receipt logic for the editor.
//
// The behavior worth pinning is the one this layer adds on top of core: a
// digest mismatch caused by the user editing the deal is `stale`, while the
// same mismatch on a receipt someone else handed us is `failed`. Getting that
// backwards either cries tampering after every keystroke or hides a real
// mismatch behind a soft word.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assess, issueForSource, loadReceiptJson, receiptFilename, serializeReceipt } from './receipts.js';
import type { HeldReceipt } from './receipts.js';

const DEAL = resolve(
  __dirname,
  '../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md',
);
const FILENAME = 'deal.uwx.md';

function source(): string {
  return readFileSync(DEAL, 'utf8');
}

/** Change a number the multifamily pack actually consumes. */
function edited(): string {
  const next = source().replace('"net_operating_income": 1380000', '"net_operating_income": 1450000');
  if (next === source()) throw new Error('fixture drift: NOI line not found');
  return next;
}

describe('issueForSource', () => {
  it('issues a receipt for the open deal', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.held.receipt.computation.pack).toBe('org.uwmd.pack.multifamily');
    expect(outcome.held.receipt.issuer).toContain('web-editor');
    expect(outcome.held.issuedFromSource).toBe(source());
  });

  it('reports a typed refusal instead of throwing', async () => {
    const outcome = await issueForSource('not a deal at all', 'mystery.uwx.md');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message.length).toBeGreaterThan(0);
  });
});

describe('assess', () => {
  it('verifies a freshly issued receipt against the unchanged deal', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    const result = await assess(outcome.held, source(), FILENAME);
    expect(result.status).toBe('verified');
    expect(result.verification.issues).toEqual([]);
  });

  it('calls a self-issued receipt STALE once the deal is edited', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    const result = await assess(outcome.held, edited(), FILENAME);
    expect(result.status).toBe('stale');
    // Core still reports the underlying failure — we reclassify, not suppress.
    expect(result.verification.verdict).toBe('failed');
    expect(result.verification.issues.map((i) => i.code)).toContain('RCP-01');
  });

  it('calls a third-party receipt FAILED on the same mismatch', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    // Round-trip through JSON, as if the receipt arrived as a file: no memory
    // of which source it was issued over.
    const loaded = loadReceiptJson(serializeReceipt(outcome.held.receipt));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.held.issuedFromSource).toBeNull();

    const result = await assess(loaded.held, edited(), FILENAME);
    expect(result.status).toBe('failed');
  });

  it('passes unverifiable through without softening or hardening it', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    const foreign: HeldReceipt = {
      receipt: { ...outcome.held.receipt, computation: { ...outcome.held.receipt.computation, pack: 'com.example.unknown' } },
      issuedFromSource: outcome.held.issuedFromSource,
    };
    const result = await assess(foreign, source(), FILENAME);
    expect(result.status).toBe('unverifiable');
    expect(result.verification.issues.map((i) => i.code)).toContain('RCP-05');
  });

  it('does not call an unedited self-issued receipt stale', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    const result = await assess(outcome.held, source(), FILENAME);
    expect(result.status).not.toBe('stale');
  });
});

describe('loadReceiptJson', () => {
  it('round-trips an issued receipt', async () => {
    const outcome = await issueForSource(source(), FILENAME);
    if (!outcome.ok) throw new Error(outcome.message);
    const loaded = loadReceiptJson(serializeReceipt(outcome.held.receipt));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.held.receipt).toEqual(outcome.held.receipt);
  });

  it.each([
    ['malformed JSON', 'not json {'],
    ['valid JSON that is not a receipt', '{"hello":"world"}'],
    ['a receipt with a bad digest', '{"receipt_version":"1.0","subject":{"digest":"nope"}}'],
  ])('rejects %s', (_label, text) => {
    const loaded = loadReceiptJson(text);
    expect(loaded.ok).toBe(false);
  });
});

describe('receiptFilename', () => {
  it.each([
    ['deal.uwx.md', 'deal.receipt.json'],
    ['deal.uw.md', 'deal.receipt.json'],
    ['notes.md', 'notes.receipt.json'],
    ['', 'deal.receipt.json'],
  ])('%s -> %s', (input, expected) => {
    expect(receiptFilename(input)).toBe(expected);
  });
});

// The editor's whole claim is that receipts are issued and verified in the
// browser with nothing sent anywhere. core's sha256TextHex prefers Node's
// crypto when `process` is present and falls back to Web Crypto otherwise — and
// under jsdom `process` leaks in, so the component tests silently exercise the
// Node path. This forces the branch a real browser actually takes.
describe('browser crypto path', () => {
  it('issues and verifies with Web Crypto when Node crypto is unavailable', async () => {
    const realProcess = globalThis.process;
    delete (globalThis as { process?: unknown }).process;
    try {
      expect(globalThis.crypto?.subtle).toBeTruthy();
      const outcome = await issueForSource(source(), FILENAME);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const result = await assess(outcome.held, source(), FILENAME);
      expect(result.status).toBe('verified');
    } finally {
      (globalThis as { process?: unknown }).process = realProcess;
    }
  });
});
