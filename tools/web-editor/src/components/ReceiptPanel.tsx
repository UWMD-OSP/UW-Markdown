// Verification receipts (RFC 0016 / spec/UW_RECEIPT_v1.md).
//
// UW_RECEIPT_v1 §1 is a requirement on this file, not a suggestion:
// implementations MUST NOT present a `verified` receipt with language implying
// the underwriting is correct, complete, audited, or approved, and interfaces
// MUST make that distinction available rather than showing an unqualified
// checkmark. So every verdict here ships with what it actually attests, and the
// `verified` state carries the boundary text inline rather than behind a
// tooltip or a disclosure the reader can skip.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UWReceipt, UWReceiptVerification } from '@uwmd/core/browser';
import {
  assess,
  issueForSource,
  loadReceiptJson,
  receiptFilename,
  serializeReceipt,
  type HeldReceipt,
  type ReceiptStatus,
} from '../receipts.js';

export function ReceiptPanel({ source, filename }: { source: string; filename: string }) {
  const [held, setHeld] = useState<HeldReceipt | null>(null);
  const [status, setStatus] = useState<ReceiptStatus | null>(null);
  const [verification, setVerification] = useState<UWReceiptVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Re-verify whenever the held receipt or the deal changes, so the panel never
  // shows a verdict that predates the current document.
  useEffect(() => {
    if (!held) {
      setStatus(null);
      setVerification(null);
      return;
    }
    let cancelled = false;
    void assess(held, source, filename).then((result) => {
      if (cancelled) return;
      setStatus(result.status);
      setVerification(result.verification);
    });
    return () => { cancelled = true; };
  }, [held, source, filename]);

  const onIssue = useCallback(async () => {
    setBusy(true);
    setError(null);
    const outcome = await issueForSource(source, filename);
    setBusy(false);
    if (!outcome.ok) {
      setHeld(null);
      setError(outcome.message);
      return;
    }
    setHeld(outcome.held);
  }, [source, filename]);

  const onLoad = useCallback(async (file: File) => {
    setError(null);
    const outcome = loadReceiptJson(await file.text());
    if (!outcome.ok) {
      setHeld(null);
      setError(outcome.message);
      return;
    }
    setHeld(outcome.held);
  }, []);

  const onDownload = useCallback(() => {
    if (!held) return;
    downloadJson(serializeReceipt(held.receipt), receiptFilename(filename));
  }, [held, filename]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
      <section aria-labelledby="receipt-heading" className="max-w-3xl">
        <h2 id="receipt-heading" className="font-display text-xl text-accent">Verification receipt</h2>
        <p className="mt-2 text-sm text-muted">
          A receipt binds a digest of this deal's canonical financial content to the numbers
          the deterministic calc pack produced from it. Someone who did not run the calculation
          can check, offline, that those numbers follow from this record.
        </p>
        <p className="mt-2 text-sm text-muted">
          It says nothing about whether the inputs are true. A deal with a fabricated NOI can
          carry a perfectly valid receipt.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void onIssue()} disabled={busy}>
            {busy ? 'Issuing…' : 'Issue receipt for this deal'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Open a receipt file to verify"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onLoad(file);
              event.target.value = '';
            }}
          />
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            Verify an existing receipt…
          </button>
          {held && (
            <button type="button" className="btn-secondary" onClick={onDownload}>
              Download {receiptFilename(filename)}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}

        {status && verification && held && (
          <>
            <Verdict status={status} verification={verification} />
            <ReceiptDetail receipt={held.receipt} />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The four states. Each states what it means in full — no bare checkmark, and
 * `unverifiable` is never dressed up as either neighbour.
 */
function Verdict({ status, verification }: { status: ReceiptStatus; verification: UWReceiptVerification }) {
  const copy = VERDICT_COPY[status];
  return (
    <section aria-label="Receipt verification result" className={`mt-5 rounded border px-4 py-3 ${copy.tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{copy.label}</p>
      <p className="mt-1 font-semibold">{copy.headline}</p>
      <p className="mt-1 text-sm">{copy.detail}</p>
      {status === 'verified' && (
        <p className="mt-2 border-t border-current/20 pt-2 text-sm">
          <strong>This is not a statement that the underwriting is correct, complete, audited,
          or approved.</strong> It does not attest that the inputs are true, sourced from genuine
          documents, or reasonable.
        </p>
      )}
      {verification.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {verification.issues.map((issue) => (
            <li key={`${issue.code}|${issue.calc_id ?? ''}|${issue.message}`}>
              <code className="text-xs">{issue.code}</code> {issue.message}
              {(issue.expected !== undefined || issue.actual !== undefined) && (
                <span className="text-xs opacity-80"> (expected {issue.expected ?? '—'}, got {issue.actual ?? '—'})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const VERDICT_COPY: Record<ReceiptStatus, { label: string; headline: string; detail: string; tone: string }> = {
  verified: {
    label: 'Verified',
    headline: 'These numbers follow from this record.',
    detail:
      'The canonical financial content is unchanged since the receipt was issued, and recomputing the named pack reproduces every stated result.',
    tone: 'border-ok/40 bg-ok/5 text-ok',
  },
  failed: {
    label: 'Failed',
    headline: 'This receipt does not describe this record.',
    detail:
      'The digest, a stated result, or the signature disagrees. Treat the numbers in this receipt as unsupported.',
    tone: 'border-error/40 bg-error/5 text-error',
  },
  unverifiable: {
    label: 'Unverifiable',
    headline: 'This editor cannot decide.',
    detail:
      'Something needed to check the receipt is missing — an unknown pack, a pack version this build does not hold, or a signature it cannot validate. This is not a negative result, and it is not evidence of a problem.',
    tone: 'border-warn/40 bg-warn/5 text-warn',
  },
  stale: {
    label: 'Stale',
    headline: 'You have edited this deal since the receipt was issued.',
    detail:
      'The receipt still describes the earlier version of the record, so it no longer applies here. Issue a new one when you are finished editing. This is expected after an edit — it is not a sign the record was tampered with.',
    tone: 'border-warn/40 bg-warn/5 text-warn',
  },
};

function ReceiptDetail({ receipt }: { receipt: UWReceipt }) {
  const computed = receipt.computation.results.filter((r) => r.computed);
  const uncomputed = receipt.computation.results.filter((r) => !r.computed);
  return (
    <section aria-label="Receipt contents" className="mt-5 rounded border border-rule bg-paper">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule px-4 py-3 text-sm sm:grid-cols-2">
        <Row term="Pack" value={`${receipt.computation.pack} @ ${receipt.computation.pack_version}`} />
        <Row term="Engine" value={`${receipt.computation.engine} @ ${receipt.computation.engine_version}`} />
        <Row term="Policy set" value={`${receipt.policy.policy_set} @ ${receipt.policy.policy_set_version}`} />
        <Row term="Validation at issuance" value={`${receipt.policy.validation.errors} error(s), ${receipt.policy.validation.warnings} warning(s)`} />
        <Row term="Issued" value={`${receipt.issued_at} by ${receipt.issuer}`} />
        <Row term="Signature" value={receipt.signature ? `${receipt.signature.algorithm} (key ${receipt.signature.key_id})` : 'none — this receipt is unsigned'} />
      </dl>
      <p className="border-b border-rule px-4 py-2 font-mono text-xs break-all text-muted">
        {receipt.subject.canonicalization}: {receipt.subject.digest}
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">Calculated results stated by this receipt</caption>
        <thead>
          <tr className="border-b border-rule text-left text-xs uppercase text-muted">
            <th scope="col" className="px-4 py-2 font-semibold">Calculation</th>
            <th scope="col" className="px-4 py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {computed.map((result) => (
            <tr key={result.calc_id} className="border-b border-rule">
              <td className="px-4 py-1.5"><code className="text-xs">{result.calc_id}</code></td>
              <td className="px-4 py-1.5 tabular-nums">{String(result.value)}{result.unit ? ` ${result.unit}` : ''}</td>
            </tr>
          ))}
          {uncomputed.map((result) => (
            <tr key={result.calc_id} className="border-b border-rule text-muted">
              <td className="px-4 py-1.5"><code className="text-xs">{result.calc_id}</code></td>
              <td className="px-4 py-1.5 italic">not computed — this deal lacks the inputs</td>
            </tr>
          ))}
        </tbody>
      </table>
      {uncomputed.length > 0 && (
        <p className="px-4 py-2 text-xs text-muted">
          The pack declares {receipt.computation.results.length} outputs. {uncomputed.length} could
          not be computed from this deal and are recorded as uncomputed rather than as a value.
        </p>
      )}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{term}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
