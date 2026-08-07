// Deal state hook — canonical UWX editing plus the UW Lite bridge.
// Lite input is compiled once into the existing structured edit pipeline; all
// subsequent mutations still pass through runEdit() and preserve provenance.

import { useCallback, useEffect, useState } from 'react';
import {
  compileUWLite,
  detectUWSourceRepresentation,
  generateBlankUWFile,
  parseUWLite,
  projectUWEnvelopeToLite,
  stringifyUWX,
  toUWEnvelope,
  UWX_REPRESENTATION_ID,
} from '@uwmd/core/browser';
import type {
  EditOperation,
  InitOptions,
  UWLiteCompilationReport,
  UWLiteProjectionReport,
  UWSourceRepresentation,
} from '@uwmd/core/browser';
import {
  loadInitialState,
  runEdit,
  DEFAULT_EDIT_SETTINGS,
  type EditState,
  type EditSettings,
} from './edits.js';

export interface DealState {
  loaded: EditState | null;
  /** The canonical UWX bytes as loaded/last-saved — basis for the diff view. */
  originalSource: string;
  filename: string;
  sourceRepresentation: UWSourceRepresentation | null;
  liteCompilation: UWLiteCompilationReport | null;
  dirty: boolean;
  status: string;
  loadError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  editSettings: EditSettings;
}

export interface DealActions {
  loadFile: (text: string, filename: string) => void;
  newDeal: (opts: InitOptions) => void;
  applyOp: (op: EditOperation) => void;
  undo: () => void;
  redo: () => void;
  downloadUWX: () => void;
  downloadLite: () => UWLiteProjectionReport | null;
  setStatus: (text: string) => void;
  setEditSettings: (patch: Partial<EditSettings>) => void;
}

export function useDeal(): [DealState, DealActions] {
  const [loaded, setLoaded] = useState<EditState | null>(null);
  const [past, setPast] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const [filename, setFilename] = useState('');
  const [sourceRepresentation, setSourceRepresentation] = useState<UWSourceRepresentation | null>(null);
  const [liteCompilation, setLiteCompilation] = useState<UWLiteCompilationReport | null>(null);
  const [status, setStatus] = useState('Ready — open a .uw.md Lite or .uwx.md structured deal');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editSettings, setEditSettingsState] = useState<EditSettings>(DEFAULT_EDIT_SETTINGS);
  const [originalSource, setOriginalSource] = useState('');

  const dirty = !!loaded && loaded.source !== originalSource;

  const setEditSettings = useCallback((patch: Partial<EditSettings>) => {
    setEditSettingsState((current) => ({ ...current, ...patch }));
  }, []);

  const loadFile = useCallback((text: string, name: string) => {
    try {
      const detection = detectUWSourceRepresentation(text, name);
      const isLite = detection.representation !== UWX_REPRESENTATION_ID;
      const compilation = isLite ? compileUWLite(parseUWLite(text)) : null;
      if (compilation && !compilation.ok) {
        const messages = compilation.report.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join(' ');
        throw new Error(`Lite compilation needs attention. ${messages}`);
      }
      const source = compilation ? stringifyUWX(compilation.envelope) : text;
      const state = loadInitialState(source);
      const workingName = ensureUWXFilename(name);
      setOriginalSource(source);
      setLoaded(state);
      setPast([]);
      setFuture([]);
      setFilename(workingName);
      setSourceRepresentation(detection.representation);
      setLiteCompilation(compilation?.report ?? null);
      setLoadError(null);
      const prefix = compilation
        ? `Compiled Lite → UWX (${compilation.report.mappings.length} mapped field${compilation.report.mappings.length === 1 ? '' : 's'})`
        : detection.legacy_extension
          ? 'Loaded legacy structured source; ready to migrate to .uwx.md'
          : 'Loaded UWX';
      setStatus(`${prefix} — ${Object.keys(state.parsed.sections).length} sections, ${issueSummary(state)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(`Couldn't open ${name}: ${message}`);
      setStatus(`Open failed: ${message}`);
      console.error(error);
    }
  }, []);

  const newDeal = useCallback((opts: InitOptions) => {
    const source = generateBlankUWFile(opts);
    const slug = (opts.dealName ?? 'new-deal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    loadFile(source, `${slug || 'new-deal'}.uwx.md`);
    setOriginalSource('');
    setStatus('New UWX deal created — fill in the frontmatter, then add data');
  }, [loadFile]);

  const applyOp = useCallback((op: EditOperation) => {
    if (!loaded) return;
    const outcome = runEdit(loaded, op, editSettings);
    if (!outcome.ok) {
      setStatus(`Edit rejected: ${outcome.message}`);
      return;
    }
    setPast((items) => [...items.slice(-49), loaded]);
    setFuture([]);
    setLoaded(outcome.state);
    setStatus(`Edited UWX — ${issueSummary(outcome.state)} (unsaved)`);
  }, [loaded, editSettings]);

  const undo = useCallback(() => {
    if (past.length === 0 || !loaded) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [loaded, ...items]);
    setLoaded(previous);
    setStatus(`Undid edit — ${issueSummary(previous)}`);
  }, [past, loaded]);

  const redo = useCallback(() => {
    if (future.length === 0 || !loaded) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, loaded]);
    setLoaded(next);
    setStatus(`Redid edit — ${issueSummary(next)}`);
  }, [future, loaded]);

  const downloadUWX = useCallback(() => {
    if (!loaded) return;
    downloadText(loaded.source, ensureUWXFilename(filename || 'deal.uwx.md'));
    setOriginalSource(loaded.source);
    setStatus(`Saved ${ensureUWXFilename(filename || 'deal.uwx.md')}`);
  }, [loaded, filename]);

  const downloadLite = useCallback((): UWLiteProjectionReport | null => {
    if (!loaded) return null;
    const projection = projectUWEnvelopeToLite(toUWEnvelope(loaded.parsed));
    const liteName = ensureLiteFilename(filename || 'deal.uwx.md');
    downloadText(projection.content, liteName);
    const qualifier = projection.report.lossy
      ? `; ${projection.report.omitted_paths.length} advanced path(s) omitted — review the loss report`
      : '; lossless for this profile';
    setStatus(`Exported ${liteName}${qualifier}`);
    return projection.report;
  }, [loaded, filename]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return [{ loaded, originalSource, filename, sourceRepresentation, liteCompilation, dirty, status, loadError,
    canUndo: past.length > 0, canRedo: future.length > 0, editSettings },
  { loadFile, newDeal, applyOp, undo, redo, downloadUWX, downloadLite, setStatus, setEditSettings }];
}

function issueSummary(state: EditState): string {
  const count = state.validation.issues.length;
  return `${count} issue${count === 1 ? '' : 's'}`;
}

function ensureUWXFilename(name: string): string {
  if (name.toLowerCase().endsWith('.uwx.md')) return name;
  if (name.toLowerCase().endsWith('.uw.md')) return `${name.slice(0, -'.uw.md'.length)}.uwx.md`;
  return `${name.replace(/\.md$/i, '')}.uwx.md`;
}

function ensureLiteFilename(name: string): string {
  if (name.toLowerCase().endsWith('.uwx.md')) return `${name.slice(0, -'.uwx.md'.length)}.uw.md`;
  if (name.toLowerCase().endsWith('.uw.md')) return name;
  return `${name.replace(/\.md$/i, '')}.uw.md`;
}

function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}