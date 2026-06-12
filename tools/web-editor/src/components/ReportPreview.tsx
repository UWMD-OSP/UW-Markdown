// Live lender-package / credit-memo preview — the same deterministic HTML the
// CLI and @uwmd/report produce, re-rendered from the current parsed state on
// every edit. Sandbox iframe (srcDoc) keeps the report's stylesheet isolated.

import { useMemo, useRef, useState } from 'react';
import { renderReportHtml } from '@uwmd/core/browser';
import type { ParsedUWFile, RenderTier } from '@uwmd/core/browser';

export function ReportPreview({ parsed, filename }: { parsed: ParsedUWFile; filename: string }) {
  const fmTier = (parsed.frontmatter as { tier?: string }).tier === 'analyst' ? 'analyst' : 'screener';
  const [tier, setTier] = useState<RenderTier>(fmTier as RenderTier);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const result = useMemo(() => renderReportHtml(parsed, { tier }), [parsed, tier]);

  const downloadHtml = () => {
    const blob = new Blob([result.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = filename.endsWith('.uw.md') ? filename.slice(0, -'.uw.md'.length) : filename;
    a.download = `${base || 'deal'}.report.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const print = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-paper px-4 py-2 text-sm">
        <div className="flex overflow-hidden rounded border border-rule text-xs">
          <TierButton active={tier === 'screener'} onClick={() => setTier('screener')}>
            Lender Package
          </TierButton>
          <TierButton active={tier === 'analyst'} onClick={() => setTier('analyst')}>
            Credit Memo
          </TierButton>
        </div>
        <span className="text-xs text-muted">
          {result.sectionsRendered.length} sections
          {result.sectionsSkipped.length > 0 && ` · no data: ${result.sectionsSkipped.join(', ')}`}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-secondary" onClick={downloadHtml}>
            Download HTML
          </button>
          <button type="button" className="btn-secondary" onClick={print}>
            Print / PDF
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title="Report preview"
        className="min-h-0 flex-1 border-0 bg-white"
        sandbox="allow-same-origin allow-modals"
        srcDoc={result.html}
      />
    </div>
  );
}

function TierButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`px-3 py-1 transition-colors ${
        props.active ? 'bg-accent font-semibold text-white' : 'bg-paper text-ink hover:bg-canvas'
      }`}
    >
      {props.children}
    </button>
  );
}
