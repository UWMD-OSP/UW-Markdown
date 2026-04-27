// UI rendering — stage 2: read-only sidebar + section view.
//
// Stages 3-5 will swap `renderSectionView` for a typed-input editor and add
// a calc dashboard. The shape stays: pure functions of (state) → DOM, no
// framework.

import {
  evaluateCalc,
} from '@uwmd/core/browser';
import type {
  ParsedUWFile,
  ValidationResult,
  ValidationMessage,
  UWBlock,
  ParsedSections,
  EditOperation,
  ModuleCalcDecl,
  CalcResult,
} from '@uwmd/core/browser';

type SectionVariant = UWBlock | { [variant: string]: UWBlock };

export type EditDispatch = (op: EditOperation) => void;

const SECTION_DISPLAY_NAMES: Record<string, string> = {
  deal_context: 'Deal Context',
  property: 'Property',
  ownership_acquisition: 'Ownership & Acquisition',
  borrower_sponsor: 'Borrower / Sponsor',
  market_analysis: 'Market Analysis',
  rent_roll: 'Rent Roll',
  operating_statement: 'Operating Statement',
  noi_model: 'NOI Model',
  valuation: 'Valuation',
  debt_structure: 'Debt Structure',
  sources_uses: 'Sources & Uses',
  dcf: 'Discounted Cash Flow',
  stress_tests: 'Stress Tests',
  preliminary_sizing: 'Preliminary Sizing',
  loan_terms_summary: 'Loan Terms Summary',
  due_diligence: 'Due Diligence',
  third_party_reports: 'Third-Party Reports',
  insurance: 'Insurance',
  environmental: 'Environmental',
  legal: 'Legal',
  risk_assessment: 'Risk Assessment',
  compliance: 'Compliance',
  assumptions: 'Assumptions',
  closing_conditions: 'Closing Conditions',
  pipeline_log: 'Pipeline Log',
  validation: 'Validation',
  flags_and_validation: 'Flags & Validation',
  quick_metrics: 'Quick Metrics',
  custom_calculations: 'Custom Calculations',
  custom_scenarios: 'Custom Scenarios',
};

function displayName(id: string): string {
  return SECTION_DISPLAY_NAMES[id] ?? id;
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

function issuesBySection(issues: ValidationMessage[]): Map<string, { errors: number; warnings: number }> {
  const map = new Map<string, { errors: number; warnings: number }>();
  for (const issue of issues) {
    const key = issue.section ?? '_root';
    const entry = map.get(key) ?? { errors: 0, warnings: 0 };
    if (issue.severity === 'error') entry.errors += 1;
    else if (issue.severity === 'warning') entry.warnings += 1;
    map.set(key, entry);
  }
  return map;
}

function badgeFor(counts: { errors: number; warnings: number } | undefined): string {
  if (!counts) return '';
  if (counts.errors > 0) {
    return `<span class="section-badge error" title="${counts.errors} error(s)">${counts.errors}</span>`;
  }
  if (counts.warnings > 0) {
    return `<span class="section-badge warn" title="${counts.warnings} warning(s)">${counts.warnings}</span>`;
  }
  return '';
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function renderSectionList(
  host: HTMLElement,
  file: ParsedUWFile,
  validation: ValidationResult | null,
  activeSection: string | null,
  onSelect: (id: string) => void
): void {
  const issues = validation ? issuesBySection(validation.issues) : new Map();
  const sectionIds = Object.keys(file.sections);

  host.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'section-list';

  // Frontmatter pseudo-section so the user can navigate to it.
  list.appendChild(makeNavRow('__frontmatter__', 'Frontmatter', activeSection, undefined, onSelect));

  // Group label
  list.appendChild(makeGroupLabel('Sections'));

  for (const id of sectionIds) {
    list.appendChild(makeNavRow(id, displayName(id), activeSection, badgeFor(issues.get(id)), onSelect));
  }

  // Pipeline log lives outside `sections` in the parsed shape — surface it explicitly.
  if (file.pipeline_log.length > 0) {
    list.appendChild(makeGroupLabel('History'));
    list.appendChild(
      makeNavRow(
        '__pipeline_log__',
        `Pipeline Log (${file.pipeline_log.length})`,
        activeSection,
        undefined,
        onSelect
      )
    );
  }

  host.appendChild(list);
}

function makeGroupLabel(text: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'section-group-label';
  li.textContent = text;
  return li;
}

function makeNavRow(
  id: string,
  label: string,
  activeId: string | null,
  badge: string | undefined,
  onSelect: (id: string) => void
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `section-item${activeId === id ? ' active' : ''}`;
  li.innerHTML = `<span>${escapeHtml(label)}</span>${badge ?? ''}`;
  li.addEventListener('click', () => onSelect(id));
  return li;
}

// ─── Validation panel ────────────────────────────────────────────────────────
//
// Footer-strip listing every ValidationMessage from validateUWFile(). Each row
// shows severity, code, section, message, and remediation copy (when the code
// is registered in BUILTIN_REMEDIATIONS — the validator already populates
// .title and .remediation for those).

export function renderValidationPanel(
  host: HTMLElement,
  validation: ValidationResult | null,
  expanded: boolean,
  onToggle: () => void
): void {
  if (!validation) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;

  const counts = validation.issues.reduce(
    (acc, i) => {
      if (i.severity === 'error') acc.errors += 1;
      else if (i.severity === 'warning') acc.warnings += 1;
      else acc.infos += 1;
      return acc;
    },
    { errors: 0, warnings: 0, infos: 0 }
  );

  const overall = validation.overall_status;
  const overallLabel =
    overall === 'blocking' ? 'Blocking' :
    overall === 'errors'   ? 'Errors'   :
    overall === 'warnings' ? 'Warnings' :
                             'Clean';

  const header = `
    <div class="validation-panel-header" id="validation-toggle" role="button" tabindex="0">
      <span class="chevron">${expanded ? '▾' : '▸'}</span>
      <span>Validation</span>
      <div class="validation-counts">
        <span class="validation-count errors">${counts.errors} error${counts.errors === 1 ? '' : 's'}</span>
        <span class="validation-count warnings">${counts.warnings} warning${counts.warnings === 1 ? '' : 's'}</span>
        ${counts.infos > 0 ? `<span class="validation-count">${counts.infos} info</span>` : ''}
      </div>
      <span class="validation-overall ${overall}">${escapeHtml(overallLabel)}</span>
    </div>
  `;

  let body = '';
  if (expanded) {
    if (validation.issues.length === 0) {
      body = `<div class="validation-empty">No issues. The file conforms to the format spec.</div>`;
    } else {
      const rows = validation.issues
        .map((issue) => validationRowHtml(issue))
        .join('');
      body = `<ul class="validation-list">${rows}</ul>`;
    }
  }

  host.innerHTML = `${header}${body}`;

  const toggle = host.querySelector<HTMLElement>('#validation-toggle');
  if (toggle) {
    toggle.addEventListener('click', onToggle);
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    });
  }
}

function validationRowHtml(issue: ValidationMessage): string {
  const sectionRef = issue.section
    ? `<span class="section-ref">${escapeHtml(issue.section)}${issue.field ? `.${escapeHtml(issue.field)}` : ''}</span>`
    : '';
  const remediation = issue.remediation
    ? `<div class="remediation">→ ${escapeHtml(issue.remediation)}</div>`
    : '';
  const title = issue.title ? `<strong>${escapeHtml(issue.title)}.</strong> ` : '';

  return `
    <li class="validation-row">
      <span class="sev ${issue.severity}">${escapeHtml(issue.severity)}</span>
      <span class="code">${escapeHtml(issue.code)}</span>
      <div class="msg">
        ${sectionRef}${title}${escapeHtml(issue.message)}
        ${remediation}
      </div>
    </li>
  `;
}

// ─── Calc dashboard ──────────────────────────────────────────────────────────
//
// Pinned above the section view. Re-evaluates every calc in the active pack
// against the current parsed file on every rerender — i.e. after every edit.
// That's the calc-integrity contract: derived values cannot lag behind inputs
// because there is no caching layer between the file and these cards.

export function renderCalcDashboard(
  host: HTMLElement,
  file: ParsedUWFile,
  pack: readonly ModuleCalcDecl[]
): void {
  if (pack.length === 0) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }
  host.hidden = false;

  const ctx = {
    parsed: file,
    prior_results: {} as Readonly<Record<string, number | string | boolean | null>>,
    locale: 'en-US' as const,
  };

  const cards = pack.map((decl) => {
    const result = evaluateCalc(decl, ctx);
    return calcCardHtml(decl, result);
  });

  host.innerHTML = `
    <div class="calc-dashboard-inner">
      ${cards.join('')}
    </div>
  `;
}

function calcCardHtml(decl: ModuleCalcDecl, result: CalcResult): string {
  const ok = result.ok && result.value !== null && result.value !== undefined;
  const display = ok ? (result.display ?? String(result.value)) : '—';
  const errTitle = !ok && result.error
    ? `${result.error.code}: ${result.error.message}`
    : '';
  return `
    <div class="calc-card${ok ? '' : ' calc-card-empty'}"${errTitle ? ` title="${escapeHtml(errTitle)}"` : ''}>
      <div class="calc-label">${escapeHtml(decl.label)}</div>
      <div class="calc-value">${escapeHtml(display)}</div>
    </div>
  `;
}

// ─── Section view ────────────────────────────────────────────────────────────

export function renderSectionView(
  host: HTMLElement,
  file: ParsedUWFile,
  activeId: string | null,
  dispatch: EditDispatch
): void {
  if (!activeId) {
    host.innerHTML = '<div class="placeholder"><h2>Select a section from the sidebar.</h2></div>';
    return;
  }

  if (activeId === '__frontmatter__') {
    renderFrontmatterEditor(host, file, dispatch);
    return;
  }

  if (activeId === '__pipeline_log__') {
    renderPipelineLog(host, file);
    return;
  }

  renderSection(host, activeId, file.sections, dispatch);
}

// ─── Frontmatter editor ──────────────────────────────────────────────────────

const ASSET_CLASSES = [
  'multifamily',
  'office',
  'retail',
  'industrial',
  'hospitality',
  'mixed_use',
  'healthcare',
  'storage',
  'land',
] as const;

const DEAL_STAGES = [
  'screening',
  'term_sheet',
  'full_underwrite',
  'credit_approval',
  'closing',
  'monitoring',
] as const;

const TIERS = ['screener', 'analyst'] as const;

type FrontmatterFieldDef =
  | { kind: 'text'; path: string; label: string; nullable?: boolean }
  | { kind: 'enum'; path: string; label: string; options: readonly string[]; nullable?: boolean }
  | { kind: 'list'; path: string; label: string };

const EDITABLE_FRONTMATTER_FIELDS: readonly FrontmatterFieldDef[] = [
  { kind: 'text',  path: 'deal_name',         label: 'Deal name' },
  { kind: 'text',  path: 'property_address',  label: 'Property address' },
  { kind: 'text',  path: 'city',              label: 'City' },
  { kind: 'text',  path: 'state',             label: 'State' },
  { kind: 'text',  path: 'zip',               label: 'ZIP' },
  { kind: 'enum',  path: 'asset_class',       label: 'Asset class', options: ASSET_CLASSES },
  { kind: 'text',  path: 'asset_subtype',     label: 'Subtype', nullable: true },
  { kind: 'text',  path: 'loan_type',         label: 'Loan type', nullable: true },
  { kind: 'text',  path: 'scenario',          label: 'Scenario', nullable: true },
  { kind: 'text',  path: 'status',            label: 'Status' },
  { kind: 'enum',  path: 'deal_stage',        label: 'Deal stage', options: DEAL_STAGES },
  { kind: 'enum',  path: 'tier',              label: 'Tier', options: TIERS, nullable: true },
  { kind: 'text',  path: 'recommendation',    label: 'Recommendation', nullable: true },
  { kind: 'list',  path: 'flags',             label: 'Flags' },
  { kind: 'list',  path: 'blocking_flags',    label: 'Blocking flags' },
  { kind: 'text',  path: 'created_by',        label: 'Created by' },
];

const READONLY_FRONTMATTER_FIELDS: readonly { path: string; label: string }[] = [
  { path: 'uw_version',    label: 'Format version' },
  { path: 'deal_id',       label: 'Deal ID' },
  { path: 'created',       label: 'Created' },
  { path: 'last_modified', label: 'Last modified' },
];

function renderFrontmatterEditor(host: HTMLElement, file: ParsedUWFile, dispatch: EditDispatch): void {
  const fm = file.frontmatter as Record<string, unknown>;

  host.innerHTML = `
    <div class="section-view">
      <header>
        <h2>Frontmatter</h2>
        <span class="section-id">YAML frontmatter — file-scoped metadata</span>
      </header>

      <form class="edit-form" id="frontmatter-form" autocomplete="off">
        <div class="form-grid">
          ${EDITABLE_FRONTMATTER_FIELDS.map((field) => fieldRow(field, fm[field.path])).join('')}
        </div>

        <fieldset class="form-readonly">
          <legend>Immutable / system-stamped</legend>
          ${READONLY_FRONTMATTER_FIELDS.map(
            (f) => `
              <div class="form-field-readonly">
                <label>${escapeHtml(f.label)}</label>
                <code>${escapeHtml(String(fm[f.path] ?? '—'))}</code>
              </div>
            `
          ).join('')}
        </fieldset>
      </form>
    </div>
  `;

  const form = host.querySelector<HTMLFormElement>('#frontmatter-form');
  if (!form) return;

  for (const field of EDITABLE_FRONTMATTER_FIELDS) {
    const input = form.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-path="${field.path}"]`
    );
    if (!input) continue;

    input.addEventListener('change', () => {
      const value = readFieldValue(field, input);
      dispatch({ kind: 'frontmatter_set', path: field.path, value });
    });

    // For free-text inputs, also commit on blur to catch typed edits.
    if (input instanceof HTMLInputElement && input.type === 'text') {
      input.addEventListener('blur', () => {
        const value = readFieldValue(field, input);
        const current = fm[field.path];
        if (!sameValue(value, current)) {
          dispatch({ kind: 'frontmatter_set', path: field.path, value });
        }
      });
    }
  }
}

function readFieldValue(field: FrontmatterFieldDef, input: HTMLInputElement | HTMLSelectElement): unknown {
  const raw = input.value;
  if (field.kind === 'list') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (raw === '' && field.kind !== 'enum' && (field as { nullable?: boolean }).nullable) {
    return null;
  }
  if (field.kind === 'enum' && raw === '' && field.nullable) {
    return null;
  }
  return raw;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

function fieldRow(field: FrontmatterFieldDef, current: unknown): string {
  const label = `<label for="fm-${field.path}">${escapeHtml(field.label)}</label>`;

  if (field.kind === 'enum') {
    const options = ['', ...field.options]
      .map((opt) => {
        const selected = (current ?? '') === opt ? ' selected' : '';
        return `<option value="${escapeHtml(opt)}"${selected}>${escapeHtml(opt || '— none —')}</option>`;
      })
      .join('');
    return `
      <div class="form-field">
        ${label}
        <select id="fm-${field.path}" data-path="${field.path}">${options}</select>
      </div>
    `;
  }

  if (field.kind === 'list') {
    const value = Array.isArray(current) ? (current as unknown[]).join(', ') : '';
    return `
      <div class="form-field form-field-wide">
        ${label}
        <input type="text" id="fm-${field.path}" data-path="${field.path}"
               value="${escapeHtml(value)}" placeholder="comma-separated"
               autocomplete="off" spellcheck="false" />
      </div>
    `;
  }

  const text = current == null ? '' : String(current);
  return `
    <div class="form-field${field.path === 'recommendation' || field.path === 'deal_name' ? ' form-field-wide' : ''}">
      ${label}
      <input type="text" id="fm-${field.path}" data-path="${field.path}"
             value="${escapeHtml(text)}"
             autocomplete="off" spellcheck="false" />
    </div>
  `;
}


function renderPipelineLog(host: HTMLElement, file: ParsedUWFile): void {
  const entries = file.pipeline_log
    .map((block, i) => {
      const ts = block.meta?.timestamp ?? '—';
      const actor = block.meta?.actor ?? '—';
      return `
        <div class="section-view" style="margin-bottom:24px;">
          <header>
            <h2>Entry #${i + 1}</h2>
            <span class="section-id">${escapeHtml(String(ts))} — ${escapeHtml(String(actor))}</span>
          </header>
          <pre class="json-readonly">${syntaxHighlight(block.content)}</pre>
        </div>
      `;
    })
    .join('');
  host.innerHTML = entries || '<div class="placeholder"><h2>No pipeline-log entries.</h2></div>';
}

function isUWBlock(value: SectionVariant): value is UWBlock {
  return value !== null && typeof value === 'object' && 'meta' in value && 'content' in value;
}

function renderSection(
  host: HTMLElement,
  id: string,
  sections: ParsedSections,
  dispatch: EditDispatch
): void {
  const entry = sections[id] as SectionVariant | undefined;
  if (!entry) {
    host.innerHTML = `<div class="placeholder"><h2>Section <code>${escapeHtml(id)}</code> not present in this file.</h2></div>`;
    return;
  }

  if (isUWBlock(entry)) {
    host.innerHTML = sectionBlockHtml(id, entry);
    wireNumericFields(host, id, entry, undefined, dispatch);
    return;
  }

  // Multi-variant section: render each variant.
  const variants = entry as { [variant: string]: UWBlock };
  const html = Object.entries(variants)
    .map(([variantId, block]) => sectionBlockHtml(id, block, variantId))
    .join('');
  host.innerHTML = html;
  for (const [variantId, block] of Object.entries(variants)) {
    wireNumericFields(host, id, block, variantId, dispatch);
  }
}

// ─── Numeric section-field editing ───────────────────────────────────────────
//
// Hand-curated catalog of editable scalar fields per section. These are the
// inputs that drive the calc starter pack. Editing any of them emits a
// section_replace op with the full (deep-cloned + updated) block content.
//
// Why hand-curated rather than reflecting on the JSON: not every leaf number
// is safe to edit (some are sub-totals, some are derived intermediates, some
// are reference data). The protocol's eventual answer is module-declared field
// hints (FieldViewHint); until that surface exists for arbitrary fields, an
// allow-list is the safe default.

type NumericFieldKind = 'currency' | 'count' | 'number';

interface NumericSectionField {
  section_id: string;
  path: string;                 // dot-path inside block.content
  label: string;
  kind: NumericFieldKind;
}

const NUMERIC_SECTION_FIELDS: readonly NumericSectionField[] = [
  { section_id: 'property',       path: 'total_units',                 label: 'Total units',          kind: 'count' },
  { section_id: 'property',       path: 'total_nra_sqft',              label: 'Total NRA (sqft)',     kind: 'count' },
  { section_id: 'valuation',      path: 'purchase_price',              label: 'Purchase price',       kind: 'currency' },
  { section_id: 'noi_model',      path: 'net_operating_income',        label: 'NOI',                  kind: 'currency' },
  { section_id: 'debt_structure', path: 'loan_amount',                 label: 'Loan amount',          kind: 'currency' },
  { section_id: 'debt_structure', path: 'annual_debt_service',         label: 'Annual debt service',  kind: 'currency' },
  { section_id: 'sources_uses',   path: 'sources.equity_sponsor',      label: 'Sponsor equity',       kind: 'currency' },
];

function fieldsForSection(id: string): readonly NumericSectionField[] {
  return NUMERIC_SECTION_FIELDS.filter((f) => f.section_id === id);
}

function deepGet(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (next === null || next === undefined || typeof next !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function formatNumericInput(value: unknown, kind: NumericFieldKind): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (kind === 'currency' || kind === 'count') return String(Math.round(value));
  return String(value);
}

function numericFieldsHtml(id: string, block: UWBlock, variant: string | undefined): string {
  const fields = fieldsForSection(id);
  if (fields.length === 0) return '';

  const rows = fields
    .map((f) => {
      const value = deepGet(block.content, f.path);
      const inputValue = formatNumericInput(value, f.kind);
      const present = value !== undefined && value !== null;
      return `
        <div class="form-field">
          <label for="num-${id}-${f.path}">${escapeHtml(f.label)}</label>
          <input
            type="number"
            inputmode="decimal"
            id="num-${id}-${f.path}"
            data-section="${escapeHtml(id)}"
            data-path="${escapeHtml(f.path)}"
            data-kind="${f.kind}"
            ${variant ? `data-variant="${escapeHtml(variant)}"` : ''}
            value="${escapeHtml(inputValue)}"
            ${present ? '' : 'placeholder="—"'}
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      `;
    })
    .join('');

  return `
    <fieldset class="form-numeric">
      <legend>Inputs</legend>
      <div class="form-grid">${rows}</div>
      <p class="form-numeric-hint">Edits run through <code>applyEdit()</code> as <code>section_replace</code>; calc dashboard re-evaluates immediately.</p>
    </fieldset>
  `;
}

function wireNumericFields(
  host: HTMLElement,
  id: string,
  block: UWBlock,
  variant: string | undefined,
  dispatch: EditDispatch
): void {
  const inputs = host.querySelectorAll<HTMLInputElement>(
    `input[data-section="${id}"]${variant ? `[data-variant="${variant}"]` : ':not([data-variant])'}`
  );

  for (const input of inputs) {
    const path = input.dataset.path!;
    const commit = () => {
      const raw = input.value.trim();
      const current = deepGet(block.content, path);
      const next = raw === '' ? null : Number(raw);
      if (raw !== '' && !Number.isFinite(next)) return;
      if (next === current) return;

      const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
      delete newContent['_meta'];
      deepSet(newContent, path, next);

      dispatch({
        kind: 'section_replace',
        section_id: id,
        ...(variant ? { variant } : {}),
        content: newContent,
        meta: {},
      });
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
  }
}

function sectionBlockHtml(id: string, block: UWBlock, variant?: string): string {
  const meta = block.meta;
  const source = meta?.source ?? 'unknown';
  const ts = meta?.timestamp ?? '—';
  const conf = meta?.confidence ?? '—';
  const actor = meta?.actor ?? '—';

  return `
    <div class="section-view">
      <header>
        <h2>${escapeHtml(displayName(id))}${variant ? ` <code style="font-size:14px;color:var(--color-text-faint)">${escapeHtml(variant)}</code>` : ''}</h2>
        <span class="section-id">${escapeHtml(id)}</span>
        <div class="meta-row">
          <span>source: <strong>${escapeHtml(String(source))}</strong></span>
          <span>actor: <strong>${escapeHtml(String(actor))}</strong></span>
          <span>ts: <strong>${escapeHtml(String(ts))}</strong></span>
          <span>confidence: <strong>${escapeHtml(String(conf))}</strong></span>
        </div>
      </header>
      ${numericFieldsHtml(id, block, variant)}
      <pre class="json-readonly">${syntaxHighlight(block.content)}</pre>
    </div>
  `;
}

// ─── JSON syntax highlighter ─────────────────────────────────────────────────

function syntaxHighlight(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  return escapeHtml(json).replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('&quot;') || match.startsWith('"')) {
        cls = match.endsWith(':') ? 'json-key' : 'json-string';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-bool';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
