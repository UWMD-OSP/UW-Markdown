import { useState } from 'react';
import { ValidationPanel } from '../components/ValidationPanel.js';
import { GALLERY } from './examples.js';
import { runChecks, type CheckResult } from './run.js';

const STATE_TONE: Record<string, string> = { verified: 'text-ok', failed: 'text-error', unverifiable: 'text-muted' };

export function ValidatorApp() {
  const [source, setSource] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(text: string) {
    setBusy(true);
    try { setResult(await runChecks(text)); } finally { setBusy(false); }
  }

  async function onDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    setSource(text);
    await check(text);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">UW Markdown Validator</h1>
      <p className="mt-1 text-sm text-muted">
        Validate a <code>.uwx.md</code> record and recompute every metric it states, with the standard&apos;s
        reference implementation. It runs entirely in your browser: nothing is uploaded.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="example" className="text-sm text-muted">Try an example:</label>
        <select
          id="example"
          className="rounded border border-rule bg-paper px-2 py-1 text-sm"
          defaultValue=""
          onChange={(event) => {
            const example = GALLERY.find((e) => e.file === event.target.value);
            if (example) { setSource(example.source); void check(example.source); }
          }}
        >
          <option value="" disabled>Choose a class…</option>
          {GALLERY.map((e) => <option key={e.file} value={e.file}>{e.asset_class} — {e.deal_name}</option>)}
        </select>
        <span className="text-xs text-muted">Synthetic examples, one per asset class.</span>
      </div>

      <label htmlFor="source" className="mt-4 block text-sm font-semibold">Record</label>
      <textarea
        id="source"
        className="mt-1 h-64 w-full rounded border border-rule bg-paper p-2 font-mono text-xs"
        placeholder="Paste a .uwx.md record here, or drop the file."
        value={source}
        onChange={(event) => setSource(event.target.value)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void onDrop(event)}
      />
      <button
        type="button"
        className="mt-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={busy}
        onClick={() => void check(source)}
      >
        {busy ? 'Checking…' : 'Validate and verify'}
      </button>

      {result?.kind === 'refused' && (
        <p role="alert" className="mt-4 rounded border border-error bg-paper p-3 text-sm text-error">
          <strong>{result.code}</strong>: {result.message}
        </p>
      )}

      {result?.kind === 'checked' && (
        <section aria-label="Results" className="mt-4 rounded border border-rule bg-paper">
          <h2 className={`px-4 pt-3 text-lg font-semibold ${result.ok ? 'text-ok' : 'text-error'}`}>
            {result.ok ? 'Verified' : 'Not verified'}: {result.deal_name ?? 'record'} ({result.asset_class})
          </h2>
          <p className="px-4 pb-2 text-sm text-muted">
            Stated metrics: {result.metrics.counts.verified} verified, {result.metrics.counts.failed} failed,{' '}
            {result.metrics.counts.unverifiable} unverifiable. Replacement funding: {result.funding.state}
            {result.funding.reason ? ` / ${result.funding.reason}` : ''}. Signatures and the hash chain are checked
            by <code>uwmd verify</code>, which holds your key store.
          </p>
          <ValidationPanel validation={result.validation} />
          {result.metrics.evidence.length > 0 && (
            <table className="w-full border-t border-rule text-left text-sm">
              <caption className="px-4 py-2 text-left font-semibold">Stated metrics, recomputed</caption>
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-1">Where stated</th><th className="px-4 py-1">Stated</th>
                  <th className="px-4 py-1">Recomputed</th><th className="px-4 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {result.metrics.evidence.map((e) => (
                  <tr key={e.path} className="border-t border-rule">
                    <td className="px-4 py-1 font-mono text-xs">{e.path}</td>
                    <td className="px-4 py-1">{e.stated}</td>
                    <td className="px-4 py-1">{e.computed ?? '—'}</td>
                    <td className={`px-4 py-1 font-semibold ${STATE_TONE[e.state] ?? ''}`}>
                      {e.state}{e.reason ? ` (${e.reason})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
