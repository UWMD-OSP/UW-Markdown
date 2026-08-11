// Receipt issuance and verification for the editor (RFC 0016 /
// spec/UW_RECEIPT_v1.md). Pure logic, no DOM — the component layer renders what
// these functions return.
//
// Everything here runs client-side against @uwmd/core/browser. Unsigned
// issuance and verification need no cryptographic dependency, so the editor
// never ships a document anywhere to get a receipt.
//
// The one piece of judgment this module adds on top of core: distinguishing a
// STALE receipt from a FAILED one. Both surface as RCP-01, because both mean
// "the canonical digest no longer matches". But a receipt that stopped matching
// because the user just edited the deal in this editor is not evidence of
// tampering — it is spec §6's "editors SHOULD treat any existing receipt as
// stale once a write lands". Presenting that as a red FAILED would train users
// to ignore the state that actually matters.

import { assertUWReceipt, issueReceipt, verifyReceipt } from '@uwmd/core/browser';
import type { UWReceipt, UWReceiptVerification } from '@uwmd/core/browser';

/** A receipt plus the exact source bytes it was issued over in this session. */
export interface HeldReceipt {
  receipt: UWReceipt;
  /** Null when the receipt was loaded from a file rather than issued here. */
  issuedFromSource: string | null;
}

export type ReceiptIssueOutcome =
  | { ok: true; held: HeldReceipt }
  | { ok: false; message: string };

export type ReceiptLoadOutcome =
  | { ok: true; held: HeldReceipt }
  | { ok: false; message: string };

/**
 * The four states the panel renders. `stale` is this layer's addition; the
 * other three are core's verdicts, passed through unchanged.
 */
export type ReceiptStatus = 'verified' | 'failed' | 'unverifiable' | 'stale';

export interface ReceiptAssessment {
  status: ReceiptStatus;
  verification: UWReceiptVerification;
}

/** Issue a receipt for the deal currently open in the editor. */
export async function issueForSource(
  source: string,
  filename: string,
): Promise<ReceiptIssueOutcome> {
  try {
    const receipt = await issueReceipt(source, {
      filename,
      issuer: '@uwmd/web-editor@0.5.0',
    });
    return { ok: true, held: { receipt, issuedFromSource: source } };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/** Read a receipt someone else issued. Rejects anything that isn't one. */
export function loadReceiptJson(text: string): ReceiptLoadOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON, so it cannot be a receipt.' };
  }
  try {
    assertUWReceipt(parsed);
    return { ok: true, held: { receipt: parsed, issuedFromSource: null } };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/**
 * Verify a held receipt against the deal currently open, then classify the
 * result. A digest mismatch is reported as `stale` — not `failed` — only when
 * this session issued the receipt and the source has changed since. In every
 * other case core's verdict is passed through untouched, so `unverifiable`
 * never collapses into either neighbour.
 */
export async function assess(
  held: HeldReceipt,
  source: string,
  filename: string,
): Promise<ReceiptAssessment> {
  const verification = await verifyReceipt(held.receipt, source, { filename });

  const editedSinceIssuance =
    held.issuedFromSource !== null && held.issuedFromSource !== source;
  const digestMismatch = verification.issues.some((issue) => issue.code === 'RCP-01');

  if (verification.verdict === 'failed' && digestMismatch && editedSinceIssuance) {
    return { status: 'stale', verification };
  }
  return { status: verification.verdict, verification };
}

/** Suggested sidecar filename for a receipt, per UW_RECEIPT_v1 §2. */
export function receiptFilename(dealFilename: string): string {
  const base = dealFilename.replace(/\.(uw|uwx)\.md$/i, '').replace(/\.md$/i, '');
  return `${base || 'deal'}.receipt.json`;
}

export function serializeReceipt(receipt: UWReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
