// Deal state hook — the single owner of the loaded file.
//
// All mutations flow through runEdit() (edits.ts), which calls @uwmd/core's
// applyEdit() and re-parses, so the in-memory state never drifts from the
// canonical byte string. React state here is just a holder for that result.
//
// Undo/redo is snapshot-based: every applied edit pushes the previous
// EditState onto `past`. Undo restores a prior canonical source verbatim —
// it never tries to "reverse" an operation, so it can't desync. (This is an
// in-memory, pre-save convenience; the saved file's pipeline log still
// records whatever was applied at save time.)

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateBlankUWFile } from '@uwmd/core/browser';
import type { EditOperation, InitOptions } from '@uwmd/core/browser';
import { loadInitialState, runEdit, type EditState } from './edits.js';

export interface DealState {
  loaded: EditState | null;
  filename: string;
  dirty: boolean;
  status: string;
  loadError: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export interface DealActions {
  loadFile: (text: string, filename: string) => void;
  newDeal: (opts: InitOptions) => void;
  applyOp: (op: EditOperation) => void;
  undo: () => void;
  redo: () => void;
  download: () => void;
  setStatus: (text: string) => void;
}

export function useDeal(): [DealState, DealActions] {
  const [loaded, setLoaded] = useState<EditState | null>(null);
  const [past, setPast] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const [filename, setFilename] = useState('');
  const [status, setStatus] = useState('Ready — drop a .uw.md file to begin');
  const [loadError, setLoadError] = useState<string | null>(null);
  const originalSource = useRef('');

  const dirty = !!loaded && loaded.source !== originalSource.current;

  const loadFile = useCallback((text: string, name: string) => {
    try {
      const state = loadInitialState(text);
      originalSource.current = text;
      setLoaded(state);
      setPast([]);
      setFuture([]);
      setFilename(name);
      setLoadError(null);
      setStatus(`${name} — ${Object.keys(state.parsed.sections).length} sections, ${issueSummary(state)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(`Couldn't parse ${name}: ${msg}`);
      setStatus(`Parse failed: ${msg}`);
      console.error(err);
    }
  }, []);

  const newDeal = useCallback(
    (opts: InitOptions) => {
      const text = generateBlankUWFile(opts);
      const slug = (opts.dealName ?? 'new-deal')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      loadFile(text, `${slug || 'new-deal'}.uw.md`);
      // A brand-new file is unsaved by definition.
      originalSource.current = '';
      setStatus('New deal created — fill in the frontmatter, then add data');
    },
    [loadFile],
  );

  const applyOp = useCallback(
    (op: EditOperation) => {
      if (!loaded) return;
      const outcome = runEdit(loaded, op);
      if (!outcome.ok) {
        setStatus(`Edit rejected: ${outcome.message}`);
        return;
      }
      setPast((p) => [...p.slice(-49), loaded]); // cap the stack at 50
      setFuture([]);
      setLoaded(outcome.state);
      setStatus(`Edited — ${issueSummary(outcome.state)} (unsaved)`);
    },
    [loaded],
  );

  const undo = useCallback(() => {
    if (past.length === 0 || !loaded) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [loaded, ...f]);
    setLoaded(prev);
    setStatus(`Undid edit — ${issueSummary(prev)}`);
  }, [past, loaded]);

  const redo = useCallback(() => {
    if (future.length === 0 || !loaded) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, loaded]);
    setLoaded(next);
    setStatus(`Redid edit — ${issueSummary(next)}`);
  }, [future, loaded]);

  const download = useCallback(() => {
    if (!loaded) return;
    const blob = new Blob([loaded.source], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ensureUWMdSuffix(filename || 'deal.uw.md');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    originalSource.current = loaded.source;
    setStatus(`Saved ${a.download}`);
  }, [loaded, filename]);

  // Warn before navigating away with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return [
    {
      loaded,
      filename,
      dirty,
      status,
      loadError,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    },
    { loadFile, newDeal, applyOp, undo, redo, download, setStatus },
  ];
}

function issueSummary(state: EditState): string {
  const n = state.validation.issues.length;
  return `${n} issue${n === 1 ? '' : 's'}`;
}

function ensureUWMdSuffix(name: string): string {
  if (name.endsWith('.uw.md')) return name;
  if (name.endsWith('.md')) return name.replace(/\.md$/, '.uw.md');
  return `${name}.uw.md`;
}
