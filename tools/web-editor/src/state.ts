// Deal state hook — the single owner of the loaded file.
//
// All mutations flow through runEdit() (edits.ts), which calls @uwmd/core's
// applyEdit() and re-parses, so the in-memory state never drifts from the
// canonical byte string. React state here is just a holder for that result.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditOperation } from '@uwmd/core/browser';
import { loadInitialState, runEdit, type EditState } from './edits.js';

export interface DealState {
  loaded: EditState | null;
  filename: string;
  dirty: boolean;
  status: string;
  loadError: string | null;
}

export interface DealActions {
  loadFile: (text: string, filename: string) => void;
  applyOp: (op: EditOperation) => void;
  download: () => void;
  setStatus: (text: string) => void;
}

export function useDeal(): [DealState, DealActions] {
  const [loaded, setLoaded] = useState<EditState | null>(null);
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
      setFilename(name);
      setLoadError(null);
      const issues = state.validation.issues.length;
      setStatus(`${name} — ${Object.keys(state.parsed.sections).length} sections, ${issues} issue${issues === 1 ? '' : 's'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(`Couldn't parse ${name}: ${msg}`);
      setStatus(`Parse failed: ${msg}`);
      console.error(err);
    }
  }, []);

  const applyOp = useCallback(
    (op: EditOperation) => {
      if (!loaded) return;
      const outcome = runEdit(loaded, op);
      if (!outcome.ok) {
        setStatus(`Edit rejected: ${outcome.message}`);
        return;
      }
      setLoaded(outcome.state);
      const issues = outcome.state.validation.issues.length;
      setStatus(`Edited — ${issues} issue${issues === 1 ? '' : 's'} (unsaved)`);
    },
    [loaded],
  );

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
    { loaded, filename, dirty, status, loadError },
    { loadFile, applyOp, download, setStatus },
  ];
}

function ensureUWMdSuffix(name: string): string {
  if (name.endsWith('.uw.md')) return name;
  if (name.endsWith('.md')) return name.replace(/\.md$/, '.uw.md');
  return `${name}.uw.md`;
}
