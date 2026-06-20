// App shell — toolbar, sidebar, editor / report-preview / source tabs,
// validation strip, new-deal dialog, global keyboard shortcuts.

import { useCallback, useEffect, useState } from 'react';
import { PROTOCOL_VERSION, FORMAT_VERSION } from '@uwmd/core/browser';
import { useDeal } from './state.js';
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

export type EditorTab = 'edit' | 'intelligence' | 'report' | 'diff' | 'source';

export function App() {
  const [deal, actions] = useDeal();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('edit');
  const [dragOver, setDragOver] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      actions.setStatus(`Loading ${file.name}…`);
      const text = await file.text();
      actions.loadFile(text, file.name);
      setActiveSection('__frontmatter__');
      setTab('edit');
    },
    [actions],
  );

  // Whole-window drag & drop.
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };
    const leave = (e: DragEvent) => {
      if (e.target === document.documentElement || !e.relatedTarget) setDragOver(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void handleFile(f);
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

  // Global shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Ctrl+S download.
  // Undo/redo are suppressed while a form control has focus so native text
  // editing keeps its own undo.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        actions.download();
        return;
      }
      const t = e.target as HTMLElement;
      const inField = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
      if (inField) return;
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        actions.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);

  return (
    <div className={`flex h-full flex-col ${dragOver ? 'outline-4 -outline-offset-4 outline-dashed outline-accent' : ''}`}>
      <Toolbar
        deal={deal}
        tab={tab}
        onTab={setTab}
        onOpen={handleFile}
        onNew={() => setShowNewDialog(true)}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onDownload={actions.download}
      />

      <div className="flex min-h-0 flex-1">
        {deal.loaded ? (
          <>
            <Sidebar
              parsed={deal.loaded.parsed}
              validation={deal.loaded.validation}
              active={activeSection}
              onSelect={(id) => {
                setActiveSection(id);
                setTab('edit');
              }}
            />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {tab === 'edit' && (
                <>
                  <CalcDashboard parsed={deal.loaded.parsed} />
                  <EditModeBar settings={deal.editSettings} onChange={actions.setEditSettings} />
                  <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                    <SectionView
                      parsed={deal.loaded.parsed}
                      activeId={activeSection}
                      dispatch={actions.applyOp}
                      validation={deal.loaded.validation}
                    />
                  </div>
                </>
              )}
              {tab === 'intelligence' && <Intelligence parsed={deal.loaded.parsed} />}
              {tab === 'report' && (
                <ReportPreview parsed={deal.loaded.parsed} filename={deal.filename} />
              )}
              {tab === 'diff' && (
                <DiffView originalSource={deal.originalSource} currentSource={deal.loaded.source} />
              )}
              {tab === 'source' && (
                <SourceView source={deal.loaded.source} filename={deal.filename} />
              )}
            </main>
          </>
        ) : (
          <EmptyState error={deal.loadError} onNew={() => setShowNewDialog(true)} />
        )}
      </div>

      {deal.loaded && <ValidationPanel validation={deal.loaded.validation} />}

      <footer className="flex items-center justify-between border-t border-rule bg-paper px-4 py-1.5 text-xs text-muted">
        <span>{deal.status}</span>
        <span>
          protocol v{PROTOCOL_VERSION} · format v{FORMAT_VERSION} · @uwmd/web-editor 0.5.0
        </span>
      </footer>

      {showNewDialog && (
        <NewDealDialog
          onCreate={(opts) => {
            actions.newDeal(opts);
            setActiveSection('__frontmatter__');
            setTab('edit');
          }}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}

function EmptyState({ error, onNew }: { error: string | null; onNew: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 h-1 w-16 bg-accent" />
        <h1 className="font-display text-2xl text-accent">UW Markdown Editor</h1>
        <p className="mt-3 text-muted">
          Drop a <code className="rounded bg-accent-soft px-1.5 py-0.5">.uw.md</code> deal file
          anywhere, use <strong>Open</strong>, or{' '}
          <button type="button" className="font-semibold text-accent underline" onClick={onNew}>
            start a new deal
          </button>
          . Every numeric edit re-runs every dependent calc immediately, and the lender package
          preview is one tab away.
        </p>
        {error && (
          <p className="mt-4 rounded border border-error/30 bg-error/5 px-4 py-3 text-left text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
