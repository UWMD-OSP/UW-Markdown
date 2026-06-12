// Superseded-block history for a section — the append-only provenance trail
// made visible. Read-only by design: history is never edited, only appended.

import { useState } from 'react';
import type { ParsedUWFile, UWBlock } from '@uwmd/core/browser';

export function HistoryView({ parsed, sectionId }: { parsed: ParsedUWFile; sectionId: string }) {
  const history = parsed.superseded[sectionId];
  if (!history || history.length === 0) return null;

  return (
    <section className="mt-4 rounded border border-dashed border-rule">
      <div className="px-4 py-2 text-xs font-semibold tracking-widest text-muted uppercase">
        History — {history.length} superseded version{history.length === 1 ? '' : 's'}
      </div>
      {history.map((block) => (
        <HistoryRow key={`${block.meta?.version}-${block.meta?.timestamp}`} block={block} />
      ))}
    </section>
  );
}

function HistoryRow({ block }: { block: UWBlock }) {
  const [open, setOpen] = useState(false);
  const meta = block.meta;
  return (
    <div className="border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-xs text-muted hover:bg-canvas"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span className="font-semibold">v{meta?.version ?? '?'}</span>
        <span>{meta?.source ?? 'unknown'}</span>
        <span>{meta?.actor ?? ''}</span>
        <span className="ml-auto tabular-nums">
          {meta?.timestamp?.slice(0, 19).replace('T', ' ') ?? ''}
        </span>
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto border-t border-rule bg-canvas px-4 py-3 text-xs leading-relaxed">
          {JSON.stringify(block.content, null, 2)}
        </pre>
      )}
    </div>
  );
}
