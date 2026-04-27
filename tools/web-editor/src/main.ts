// UW Markdown calc-aware editor — entry point.
//
// Stage 3: frontmatter editing wired through applyEdit(). Every input change
// produces a frontmatter_set EditOperation, gets routed through runEdit(),
// and reparses the file so in-memory state never drifts from canonical.

import { PROTOCOL_VERSION, FORMAT_VERSION, MULTIFAMILY_PACK } from '@uwmd/core/browser';
import type { EditOperation } from '@uwmd/core/browser';
import { loadInitialState, runEdit, type EditState } from './edits.js';
import { renderSectionList, renderSectionView, renderCalcDashboard, renderValidationPanel } from './ui.js';

interface AppState {
  loaded: EditState | null;
  originalSource: string;
  filename: string;
  activeSection: string | null;
  validationExpanded: boolean;
}

const state: AppState = {
  loaded: null,
  originalSource: '',
  filename: '',
  activeSection: null,
  validationExpanded: false,
};

const els = {
  app: document.getElementById('app')!,
  fileInput: document.getElementById('file-input') as HTMLInputElement,
  openBtn: document.getElementById('open-btn') as HTMLButtonElement,
  saveBtn: document.getElementById('save-btn') as HTMLButtonElement,
  sidebar: document.getElementById('sidebar')!,
  content: document.getElementById('content')!,
  calcDashboard: document.getElementById('calc-dashboard')!,
  validationPanel: document.getElementById('validation-panel')!,
  status: document.getElementById('status')!,
  bundleStatus: document.getElementById('bundle-status'),
};

function setStatus(text: string): void {
  els.status.textContent = text;
}

function isDirty(): boolean {
  return !!state.loaded && state.loaded.source !== state.originalSource;
}

function summarize(loaded: EditState, filename: string): string {
  const sectionCount = Object.keys(loaded.parsed.sections).length;
  const issueCount = loaded.validation.issues.length;
  const dirtyTag = isDirty() ? ' (unsaved)' : '';
  return `${filename} — ${sectionCount} sections, ${issueCount} issue${issueCount === 1 ? '' : 's'}${dirtyTag}`;
}

function loadFile(text: string, filename: string): void {
  try {
    const loaded = loadInitialState(text);
    state.loaded = loaded;
    state.originalSource = text;
    state.filename = filename;
    state.activeSection = pickInitialSection(loaded);
    state.validationExpanded = loaded.validation.issues.some((i) => i.severity === 'error');
    els.saveBtn.disabled = false;
    setStatus(summarize(loaded, filename));
    rerender();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Parse failed: ${msg}`);
    els.content.innerHTML = `
      <div class="placeholder">
        <h2>Couldn't parse <code>${escapeHtml(filename)}</code></h2>
        <p>${escapeHtml(msg)}</p>
        <p class="placeholder-status">Open the browser console for the full stack trace.</p>
      </div>
    `;
    console.error(err);
  }
}

function pickInitialSection(_loaded: EditState): string {
  // Always start on Frontmatter for stage 3 — that's where editing lives.
  return '__frontmatter__';
}

function applyOp(op: EditOperation): void {
  if (!state.loaded) return;
  const outcome = runEdit(state.loaded, op);
  if (!outcome.ok) {
    setStatus(`Edit rejected: ${outcome.message}`);
    return;
  }
  state.loaded = outcome.state;
  setStatus(summarize(outcome.state, state.filename));
  rerender();
}

function rerender(): void {
  if (!state.loaded) return;
  renderSectionList(els.sidebar, state.loaded.parsed, state.loaded.validation, state.activeSection, (id) => {
    state.activeSection = id;
    rerender();
  });
  renderCalcDashboard(els.calcDashboard, state.loaded.parsed, calcPackFor(state.loaded.parsed));
  renderSectionView(els.content, state.loaded.parsed, state.activeSection, applyOp);
  renderValidationPanel(els.validationPanel, state.loaded.validation, state.validationExpanded, () => {
    state.validationExpanded = !state.validationExpanded;
    rerender();
  });
}

function calcPackFor(parsed: EditState['parsed']) {
  // For now, multifamily-only. Other asset classes get an empty pack until
  // their starter packs ship.
  const assetClass = (parsed.frontmatter as { asset_class?: string }).asset_class;
  if (assetClass === 'multifamily') return MULTIFAMILY_PACK.calculations ?? [];
  return [];
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsText(file);
  });
}

async function handleFile(file: File): Promise<void> {
  setStatus(`Loading ${file.name}…`);
  const text = await readFileAsText(file);
  loadFile(text, file.name);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    } as Record<string, string>)[c];
  });
}

// ─── Wire UI ─────────────────────────────────────────────────────────────────

els.openBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', () => {
  const f = els.fileInput.files?.[0];
  if (f) void handleFile(f);
  els.fileInput.value = '';
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  els.app.classList.add('drag-over');
});
document.addEventListener('dragleave', (e) => {
  if ((e.target as HTMLElement).id === 'app' || e.target === document) {
    els.app.classList.remove('drag-over');
  }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  els.app.classList.remove('drag-over');
  const f = e.dataTransfer?.files?.[0];
  if (f) void handleFile(f);
});

els.saveBtn.addEventListener('click', () => {
  if (!state.loaded) return;
  const blob = new Blob([state.loaded.source], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename(state.loaded, state.filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.originalSource = state.loaded.source;
  setStatus(summarize(state.loaded, state.filename));
});

function downloadFilename(loaded: EditState, original: string): string {
  // Prefer the original filename verbatim — that's what the user dropped in,
  // and round-tripping through the same name is the least-surprise default.
  if (original) return ensureUWMdSuffix(original);

  const fm = loaded.parsed.frontmatter as { deal_id?: string; deal_name?: string };
  const slug = (fm.deal_id ?? fm.deal_name ?? 'deal')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'deal'}.uw.md`;
}

function ensureUWMdSuffix(name: string): string {
  if (name.endsWith('.uw.md')) return name;
  if (name.endsWith('.md')) return name.replace(/\.md$/, '.uw.md');
  return `${name}.uw.md`;
}

window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

if (els.bundleStatus) {
  els.bundleStatus.textContent = `Engine ready — protocol v${PROTOCOL_VERSION}, format v${FORMAT_VERSION}`;
}
setStatus('Ready');
