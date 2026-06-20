import { useRef } from 'react';
import type { DealState } from '../state.js';
import type { EditorTab } from '../App.js';

export function Toolbar(props: {
  deal: DealState;
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  onOpen: (file: File) => void;
  onNew: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
}) {
  const { deal, tab, onTab, onOpen, onNew, onUndo, onRedo, onDownload } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const dealName = (deal.loaded?.parsed.frontmatter as { deal_name?: string } | undefined)?.deal_name;

  return (
    <header className="flex items-center gap-4 border-b border-rule bg-accent px-4 py-2 text-white">
      <h1 className="font-display text-base font-semibold tracking-wide">
        UW<span className="opacity-60">/</span>MD
      </h1>

      {deal.loaded && (
        <>
          <span className="max-w-64 truncate text-sm opacity-90" title={deal.filename}>
            {dealName ?? deal.filename}
            {deal.dirty && <span className="ml-1.5 text-amber-300">●</span>}
          </span>

          <nav aria-label="Editor views" className="ml-2 flex overflow-hidden rounded border border-white/25 text-xs">
            <TabButton active={tab === 'edit'} onClick={() => onTab('edit')}>
              Editor
            </TabButton>
            <TabButton active={tab === 'intelligence'} onClick={() => onTab('intelligence')}>
              Intelligence
            </TabButton>
            <TabButton active={tab === 'report'} onClick={() => onTab('report')}>
              Report
            </TabButton>
            <TabButton active={tab === 'diff'} onClick={() => onTab('diff')}>
              Diff
            </TabButton>
            <TabButton active={tab === 'source'} onClick={() => onTab('source')}>
              Source
            </TabButton>
          </nav>

          <div className="flex gap-1">
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              className="btn-toolbar disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!deal.canUndo}
              onClick={onUndo}
            >
              ↶ Undo
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Y)"
              className="btn-toolbar disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!deal.canRedo}
              onClick={onRedo}
            >
              ↷ Redo
            </button>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".uw.md,.md,text/markdown"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpen(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn-toolbar" onClick={onNew}>
          New
        </button>
        <button type="button" className="btn-toolbar" onClick={() => fileInput.current?.click()}>
          Open .uw.md
        </button>
        <button
          type="button"
          title="Download (Ctrl+S)"
          className="btn-toolbar disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!deal.loaded}
          onClick={onDownload}
        >
          Download{deal.dirty ? ' *' : ''}
        </button>
      </div>
    </header>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-current={props.active ? 'page' : undefined}
      className={`px-3 py-1 transition-colors ${
        props.active ? 'bg-white font-semibold text-accent' : 'text-white/85 hover:bg-white/10'
      }`}
    >
      {props.children}
    </button>
  );
}
