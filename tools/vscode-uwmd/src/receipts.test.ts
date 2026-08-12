// Receipt verification for the VS Code extension.
//
// `checkReceipt` takes an injectable reader, so these run without touching the
// filesystem or launching VS Code. The properties that matter: every failure
// mode is a value rather than a throw (a thrown error in a command handler
// becomes an opaque "command failed" toast), and the notification text honours
// UW_RECEIPT_v1 §1 — a verified receipt is never a bare checkmark.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { issueReceipt } from '@uwmd/core';
import type { UWReceipt } from '@uwmd/core';
import { checkReceipt, formatReport, receiptPathFor, summaryLine } from './receipts.js';

const DEAL_PATH = resolve(
  __dirname,
  '../../../conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md',
);
const deal = () => readFileSync(DEAL_PATH, 'utf8');
const edited = () => {
  const next = deal().replace('"net_operating_income": 1380000', '"net_operating_income": 1450000');
  if (next === deal()) throw new Error('fixture drift: NOI line not found');
  return next;
};

async function receipt(): Promise<UWReceipt> {
  return issueReceipt(deal(), { filename: DEAL_PATH, issued_at: '2026-08-09T00:00:00Z' });
}

/** A reader that serves one canned body regardless of path. */
const serves = (body: string) => async () => body;
const missing = async () => {
  throw new Error('ENOENT');
};

describe('receiptPathFor', () => {
  it.each([
    ['/deals/parkview.uwx.md', '/deals/parkview.receipt.json'],
    ['/deals/parkview.uw.md', '/deals/parkview.receipt.json'],
    ['/deals/notes.md', '/deals/notes.receipt.json'],
  ])('%s -> %s', (input, expected) => {
    expect(receiptPathFor(input)).toBe(expected);
  });
});

describe('checkReceipt', () => {
  it('reports a missing sidecar rather than throwing', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/nope.receipt.json', missing);
    expect(check.kind).toBe('no-receipt');
  });

  it.each([
    ['malformed JSON', 'not json {'],
    ['JSON that is not a receipt', '{"hello":"world"}'],
  ])('reports %s as unreadable rather than throwing', async (_label, body) => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(body));
    expect(check.kind).toBe('unreadable');
  });

  it('verifies a matching deal and receipt', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(JSON.stringify(await receipt())));
    expect(check.kind).toBe('checked');
    if (check.kind !== 'checked') return;
    expect(check.verdict).toBe('verified');
  });

  it('fails when the deal on disk no longer matches', async () => {
    const check = await checkReceipt(DEAL_PATH, edited(), '/r.json', serves(JSON.stringify(await receipt())));
    expect(check.kind).toBe('checked');
    if (check.kind !== 'checked') return;
    expect(check.verdict).toBe('failed');
    expect(check.verification.issues.map((i) => i.code)).toContain('RCP-01');
  });

  it('reports unverifiable — not failed — for a pack it does not hold', async () => {
    const base = await receipt();
    const foreign = { ...base, computation: { ...base.computation, pack: 'com.example.unknown' } };
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(JSON.stringify(foreign)));
    expect(check.kind).toBe('checked');
    if (check.kind !== 'checked') return;
    expect(check.verdict).toBe('unverifiable');
  });
});

describe('summaryLine', () => {
  it('never states a verified result without its boundary', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(JSON.stringify(await receipt())));
    const line = summaryLine(check);
    expect(line).toMatch(/verified/i);
    // The caveat is in the notification itself, not only in the details pane.
    expect(line).toMatch(/not a statement that the underwriting is correct/i);
    expect(line).toMatch(/does not attest that the inputs are true/i);
  });

  it('says plainly that unverifiable is not a negative result', async () => {
    const base = await receipt();
    const foreign = { ...base, computation: { ...base.computation, pack: 'com.example.unknown' } };
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(JSON.stringify(foreign)));
    expect(summaryLine(check)).toMatch(/not a negative result/i);
  });

  it('offers unsaved changes as the likely explanation for a failure', async () => {
    const check = await checkReceipt(DEAL_PATH, edited(), '/r.json', serves(JSON.stringify(await receipt())));
    expect(summaryLine(check, { dirty: true })).toMatch(/unsaved changes/i);
    expect(summaryLine(check, { dirty: false })).not.toMatch(/unsaved changes/i);
  });

  it('names the file it looked for when no receipt exists', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/deals/x.receipt.json', missing);
    expect(summaryLine(check)).toContain('x.receipt.json');
  });
});

describe('formatReport', () => {
  it('carries the full assurance boundary and the stated results', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/r.json', serves(JSON.stringify(await receipt())));
    const report = formatReport(check, DEAL_PATH);
    expect(report).toMatch(/VERDICT: VERIFIED/);
    expect(report).toMatch(/attests NOTHING about whether the inputs are true/i);
    expect(report).toMatch(/org\.uwmd\.pack\.multifamily/);
    expect(report).toMatch(/dscr/);
    expect(report).toMatch(/unsigned/);
  });

  it('tells the reader how to create one when none exists', async () => {
    const check = await checkReceipt(DEAL_PATH, deal(), '/deals/x.receipt.json', missing);
    expect(formatReport(check, DEAL_PATH)).toMatch(/uwmd receipt issue/);
  });
});
