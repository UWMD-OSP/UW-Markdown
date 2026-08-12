// Receipt verification logic for the VS Code extension.
//
// Deliberately free of any `vscode` import so it can be unit-tested in plain
// Node. `extension.ts` owns every piece of UI.
//
// The extension verifies but never issues. Issuing mid-authoring would produce
// a receipt that is stale the moment the next keystroke lands, which teaches
// people that receipts are noise. Verification is the operation that fits an
// editor: "someone sent me this deal and this receipt — do they agree?"
//
// UW_RECEIPT_v1 §1 applies to every consumer, this one included: a verified
// receipt must never be surfaced as a bare checkmark, so `summaryLine` always
// carries what the verdict does and does not mean.

import { readFile } from 'node:fs/promises';
import { assertUWReceipt, verifyReceipt } from '@uwmd/core';
import type { UWReceipt, UWReceiptVerdict, UWReceiptVerification } from '@uwmd/core';

/** Conventional sidecar location (UW_RECEIPT_v1 §2). */
export function receiptPathFor(dealPath: string): string {
  return `${dealPath.replace(/\.(uw|uwx)\.md$/i, '').replace(/\.md$/i, '')}.receipt.json`;
}

export type ReceiptCheck =
  | { kind: 'no-receipt'; expectedPath: string }
  | { kind: 'unreadable'; path: string; message: string }
  | {
      kind: 'checked';
      path: string;
      verdict: UWReceiptVerdict;
      verification: UWReceiptVerification;
      receipt: UWReceipt;
    };

export type ReadTextFile = (path: string) => Promise<string>;

const defaultReader: ReadTextFile = (path) => readFile(path, 'utf-8');

/**
 * Verify the receipt beside a deal. Never throws — every failure mode is a
 * value the caller can render, because a thrown error in a command handler
 * becomes an opaque "command failed" toast.
 */
export async function checkReceipt(
  dealPath: string,
  dealText: string,
  receiptPath: string = receiptPathFor(dealPath),
  read: ReadTextFile = defaultReader,
): Promise<ReceiptCheck> {
  let raw: string;
  try {
    raw = await read(receiptPath);
  } catch {
    return { kind: 'no-receipt', expectedPath: receiptPath };
  }

  let receipt: UWReceipt;
  try {
    const parsed: unknown = JSON.parse(raw);
    assertUWReceipt(parsed);
    receipt = parsed;
  } catch (error) {
    return { kind: 'unreadable', path: receiptPath, message: describe(error) };
  }

  try {
    const verification = await verifyReceipt(receipt, dealText, { filename: dealPath });
    return { kind: 'checked', path: receiptPath, verdict: verification.verdict, verification, receipt };
  } catch (error) {
    return { kind: 'unreadable', path: receiptPath, message: describe(error) };
  }
}

export interface SummaryOptions {
  /** True when the editor holds unsaved changes, which can explain a mismatch. */
  dirty?: boolean;
}

/**
 * One line for a notification. Never a bare checkmark — a `verified` summary
 * always states the boundary in the same breath as the good news.
 */
export function summaryLine(check: ReceiptCheck, options: SummaryOptions = {}): string {
  switch (check.kind) {
    case 'no-receipt':
      return `No receipt found beside this deal (looked for ${basename(check.expectedPath)}).`;
    case 'unreadable':
      return `${basename(check.path)} could not be read as a receipt: ${check.message}`;
    case 'checked':
      break;
  }

  const dirtyNote = options.dirty
    ? ' This editor has unsaved changes, which is the likeliest explanation.'
    : '';

  switch (check.verdict) {
    case 'verified':
      return (
        'Receipt verified: this record is unchanged since issuance and its stated outputs ' +
        'follow from its contents. This is not a statement that the underwriting is correct, ' +
        'complete, audited, or approved, and it does not attest that the inputs are true.'
      );
    case 'failed':
      return `Receipt FAILED: it does not describe this record.${dirtyNote}`;
    case 'unverifiable':
      return (
        'Receipt unverifiable: this build cannot decide — it is missing the pack, pack version, ' +
        'or signature backend the receipt names. This is not a negative result.'
      );
  }
}

/** Full breakdown for the output channel. */
export function formatReport(check: ReceiptCheck, dealPath: string): string {
  const lines: string[] = [`Deal:    ${dealPath}`];

  if (check.kind === 'no-receipt') {
    lines.push(
      'Receipt: none found',
      '',
      `Expected a sidecar at ${check.expectedPath}.`,
      `Issue one with:  uwmd receipt issue ${basename(dealPath)}`,
    );
    return lines.join('\n');
  }

  if (check.kind === 'unreadable') {
    lines.push(`Receipt: ${check.path}`, '', `Not a readable receipt: ${check.message}`);
    return lines.join('\n');
  }

  const { receipt, verification, verdict } = check;
  lines.push(
    `Receipt: ${check.path}`,
    '',
    `VERDICT: ${verdict.toUpperCase()}`,
    '',
    `Pack:       ${receipt.computation.pack} @ ${receipt.computation.pack_version}`,
    `Engine:     ${receipt.computation.engine} @ ${receipt.computation.engine_version}`,
    `Policy set: ${receipt.policy.policy_set} @ ${receipt.policy.policy_set_version}`,
    `            ${receipt.policy.validation.errors} error(s), ${receipt.policy.validation.warnings} warning(s) at issuance`,
    `Issued:     ${receipt.issued_at} by ${receipt.issuer}`,
    `Signature:  ${receipt.signature ? `${receipt.signature.algorithm}, key ${receipt.signature.key_id}` : 'none (unsigned)'}`,
    `Digest:     ${receipt.subject.digest}`,
    `            over ${receipt.subject.canonicalization} ${receipt.subject.canonicalization_version}`,
  );

  if (verification.issues.length > 0) {
    lines.push('', 'Issues:');
    for (const issue of verification.issues) {
      const detail =
        issue.expected !== undefined || issue.actual !== undefined
          ? ` (expected ${issue.expected ?? '—'}, got ${issue.actual ?? '—'})`
          : '';
      lines.push(`  [${issue.code}] ${issue.message}${detail}`);
    }
  }

  lines.push('', 'Stated results:');
  for (const result of receipt.computation.results) {
    lines.push(
      result.computed
        ? `  ${result.calc_id.padEnd(20)} ${String(result.value)}${result.unit ? ` ${result.unit}` : ''}`
        : `  ${result.calc_id.padEnd(20)} not computed — the deal lacks the inputs`,
    );
  }

  lines.push(
    '',
    'What a verified receipt means',
    `  1. The record's canonical financial content is unchanged since issuance.`,
    '  2. The stated outputs follow deterministically from that content under the',
    '     named pack and policy set.',
    'It attests NOTHING about whether the inputs are true, complete, sourced from',
    'genuine documents, or reasonable. See spec/UW_RECEIPT_v1.md §1.',
  );

  return lines.join('\n');
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
