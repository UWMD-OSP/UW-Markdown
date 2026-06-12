// Read-only view of the current canonical .uw.md byte string — exactly what
// Download will write. Useful for verifying byte-preserving Tier-2 behavior.

import { useState } from 'react';

export function SourceView({ source, filename }: { source: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-paper px-4 py-2 text-sm">
        <span className="text-xs text-muted">
          {filename} — {source.length.toLocaleString('en-US')} bytes, canonical (what Download
          writes)
        </span>
        <button type="button" className="btn-secondary ml-auto" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-paper px-6 py-4 text-xs leading-relaxed whitespace-pre-wrap">
        {source}
      </pre>
    </div>
  );
}
