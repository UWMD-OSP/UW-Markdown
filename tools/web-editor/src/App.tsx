// App shell — Lite imports compile into the existing UWX editor; structured edits,
// validation, calc, reports, and provenance keep their normal workflow.

import { useCallback, useEffect, useRef, useState } from 'react';
import { FORMAT_VERSION, PROTOCOL_VERSION, projectUWEnvelopeToLite, toUWEnvelope } from '@uwmd/core/browser';
import { useDeal, type DealState } from './state.js';
import { Toolbar } from './components/Toolbar.js';
import { Sidebar } from './components/Sidebar.js';
import { CalcDashboard } from './components/CalcDashboard.js';
import { SectionView } from './components/SectionView.js';
import { ReportPreview } from './components/ReportPreview.js';
import { SourceView } from './components/SourceView.js';
import { ValidationPanel } from './components/ValidationPanel.js';
import { NewDealDialog } from './components/NewDealDialog.js';
import { Intelligence } from './components/Intelligence.js';
import { DiffView } from './components/DiffView.js';
import { EditModeBar } from './components/EditModeBar.js';
import { ReceiptPanel } from './components/ReceiptPanel.js';

export type EditorTab = 'edit' | 'intelligence' | 'report' | 'receipt' | 'diff' | 'source';

export function App() {
  const [deal, actions] = useDeal();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('edit');
  const [dragOver, setDragOver] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const sampleLoaded = useRef(false);

  const handleFile = useCallback(async (file: File) => {
    actions.setStatus(`Opening ${file.name}…`);
    actions.loadFile(await file.text(), file.name);
    setActiveSection('__frontmatter__');
    setTab('edit');
  }, [actions]);

  useEffect(() => {
    if (sampleLoaded.current) return;
    sampleLoaded.current = true;
    const sample = new URLSearchParams(window.location.search).get('sample');
    if (!sample || !/^\/viewer\/samples\/[A-Za-z0-9-]+\.uw\.md$/.test(sample)) return;
    const filename = sample.split('/').pop() ?? 'sample.uw.md';
    actions.setStatus(`Loading ${filename}…`);
    void fetch(sample).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }).then((source) => {
      actions.loadFile(source, filename);
      setActiveSection('__frontmatter__');
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      actions.setStatus(`Could not load sample: ${message}`);
    });
  }, [actions]);

  useEffect(() => {
    const over = (event: DragEvent) => { event.preventDefault(); setDragOver(true); };
    const leave = (event: DragEvent) => {
      if (event.target === document.documentElement || !event.relatedTarget) setDragOver(false);
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('dragleave', leave);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('drop', drop);
    };
  }, [handleFile]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); actions.downloadUWX(); return; }
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); actions.undo(); }
      else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); actions.redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);

  return (
    <div className={`flex h-full flex-col ${dragOver ? 'outline-4 -outline-offset-4 outline-dashed outline-accent' : ''}`}>
      <Toolbar deal={deal} tab={tab} onTab={setTab} onOpen={handleFile} onNew={() => setShowNewDialog(true)}
        onUndo={actions.undo} onRedo={actions.redo} onDownloadUWX={actions.downloadUWX} onDownloadLite={actions.downloadLite} />
      <div className="flex min-h-0 flex-1">
        {deal.loaded ? <>
          <Sidebar parsed={deal.loaded.parsed} validation={deal.loaded.validation} active={activeSection}
            onSelect={(id) => { setActiveSection(id); setTab('edit'); }} />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {tab === 'edit' && <>
              <BridgeStatus deal={deal} onDownloadLite={actions.downloadLite} />
              <CalcDashboard parsed={deal.loaded.parsed} />
              <EditModeBar settings={deal.editSettings} onChange={actions.setEditSettings} />
              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <SectionView parsed={deal.loaded.parsed} activeId={activeSection} dispatch={actions.applyOp} validation={deal.loaded.validation} />
              </div>
            </>}
            {tab === 'intelligence' && <Intelligence parsed={deal.loaded.parsed} />}
            {tab === 'report' && <ReportPreview parsed={deal.loaded.parsed} filename={deal.filename} />}
            {tab === 'receipt' && <ReceiptPanel source={deal.loaded.source} filename={deal.filename} />}
            {tab === 'diff' && <DiffView originalSource={deal.originalSource} currentSource={deal.loaded.source} />}
            {tab === 'source' && <SourceView source={deal.loaded.source} filename={deal.filename} />}
          </main>
        </> : <EmptyState error={deal.loadError} onNew={() => setShowNewDialog(true)} />}
      </div>
      {deal.loaded && <ValidationPanel validation={deal.loaded.validation} />}
      <footer className="flex items-center justify-between border-t border-rule bg-paper px-4 py-1.5 text-xs text-muted">
        <span>{deal.status}</span><span>protocol v{PROTOCOL_VERSION} · format v{FORMAT_VERSION} · @uwmd/web-editor 0.5.0</span>
      </footer>
      {showNewDialog && <NewDealDialog onCreate={(opts) => { actions.newDeal(opts); setActiveSection('__frontmatter__'); setTab('edit'); }} onClose={() => setShowNewDialog(false)} />}
    </div>
  );
}

function BridgeStatus({ deal, onDownloadLite }: { deal: DealState; onDownloadLite: () => unknown }) {
  if (!deal.loaded) return null;
  const projection = projectUWEnvelopeToLite(toUWEnvelope(deal.loaded.parsed)).report;
  const isLiteImport = deal.liteCompilation !== null;
  return (
    <section className="border-b border-rule bg-accent-soft px-5 py-3" aria-label="Format bridge status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-accent">
            {isLiteImport ? 'UW Lite compiled into this structured UWX deal' : 'Structured UWX deal'}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {isLiteImport
              ? `${deal.liteCompilation?.mappings.length ?? 0} anchored Lite fields mapped; the full Lite source is preserved in the UWX extension.`
              : 'Use UWX for complete structured editing, provenance, and deterministic calculations.'}
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => onDownloadLite()}>
          Export Lite{projection.lossy ? ` (${projection.omitted_paths.length} omitted)` : ''}
        </button>
      </div>
      {deal.liteCompilation && deal.liteCompilation.defaults.length > 0 && (
        <p className="mt-2 text-xs text-muted">Compiler defaults: {deal.liteCompilation.defaults.map((item) => item.path).join(', ')}.</p>
      )}
      {projection.lossy ? (
        <details className="mt-2 rounded border border-warn/30 bg-paper px-3 py-2 text-xs text-warn">
          <summary className="cursor-pointer font-semibold">Lite export is lossy: {projection.omitted_paths.length} UWX path(s) are outside the Lite deal-summary profile.</summary>
          <p className="mt-1 text-muted">The Lite file remains a readable summary. Keep the .uwx.md file as the complete structured record.</p>
          <p className="mt-1 break-words text-muted">{projection.omitted_paths.join(', ')}</p>
        </details>
      ) : <p className="mt-2 text-xs text-ok">This deal fits the current Lite projection profile without omitted data.</p>}
    </section>
  );
}

function EmptyState({ error, onNew }: { error: string | null; onNew: () => void }) {
  return <div className="flex flex-1 items-center justify-center"><div className="max-w-md text-center">
    <div className="mx-auto mb-5 h-1 w-16 bg-accent" />
    <h1 className="font-display text-2xl text-accent">UW Markdown Editor</h1>
    <p className="mt-3 text-muted">Open a <code className="rounded bg-accent-soft px-1.5 py-0.5">.uw.md</code> Lite file or a <code className="rounded bg-accent-soft px-1.5 py-0.5">.uwx.md</code> structured deal. Lite files compile into the full editor; every numeric edit re-runs dependent calculations.</p>
    <button type="button" className="mt-3 font-semibold text-accent underline" onClick={onNew}>Start a new structured deal</button>
    {error && <p className="mt-4 rounded border border-error/30 bg-error/5 px-4 py-3 text-left text-sm text-error">{error}</p>}
  </div></div>;
}