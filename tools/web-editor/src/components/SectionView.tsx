// Section editor pane — frontmatter form, per-section numeric inputs (the
// calc-driving allow-list), block metadata, and a collapsible raw-JSON view.
// Every change dispatches an EditOperation; nothing mutates state directly.

import { useState } from 'react';
import type {
  EditOperation,
  ParsedUWFile,
  UWBlock,
  ValidationResult,
  ValidationMessage,
} from '@uwmd/core/browser';
import {
  displayName,
  fieldsForSection,
  getNumeric,
  setNumeric,
  type NumericSectionField,
} from '../catalog.js';
import { FrontmatterEditor } from './FrontmatterEditor.js';
import { PipelineLog } from './PipelineLog.js';
import { RentRollModel, derivedPaths } from './RentRollModel.js';
import {
  OperatingStatementModel,
  operatingStatementDerivedPaths,
} from './OperatingStatementModel.js';
import { DebtModel, debtDerivedPaths } from './DebtModel.js';
import { SourcesUsesModel, sourcesUsesDerivedPaths } from './SourcesUsesModel.js';
import { ValuationModel, valuationDerivedPaths } from './ValuationModel.js';
import { DcfModel, dcfDerivedPaths } from './DcfModel.js';
import { NoiLineItems } from './NoiLineItems.js';
import { AssumptionsEditor } from './AssumptionsEditor.js';
import { GenericFieldEditor } from './GenericFieldEditor.js';
import { HistoryView } from './HistoryView.js';

type SectionEntry = UWBlock | Record<string, UWBlock>;

export type Dispatch = (op: EditOperation) => void;

// Per-section "footed paths" — totals a model surface owns, locked out of the
// generic scalar editor so each has exactly one editing path.
const DERIVED_PATHS: Record<string, (block: UWBlock) => Set<string>> = {
  rent_roll: derivedPaths,
  operating_statement: operatingStatementDerivedPaths,
  debt_structure: debtDerivedPaths,
  sources_uses: sourcesUsesDerivedPaths,
  valuation: valuationDerivedPaths,
  dcf: dcfDerivedPaths,
};

export function SectionView(props: {
  parsed: ParsedUWFile;
  activeId: string | null;
  dispatch: Dispatch;
  validation: ValidationResult;
}) {
  const { parsed, activeId, dispatch, validation } = props;

  if (!activeId) {
    return <p className="text-muted">Select a section from the sidebar.</p>;
  }
  if (activeId === '__frontmatter__') {
    return <FrontmatterEditor parsed={parsed} dispatch={dispatch} />;
  }
  if (activeId === '__pipeline_log__') {
    return <PipelineLog parsed={parsed} />;
  }

  const entry = parsed.sections[activeId] as SectionEntry | undefined;
  if (!entry) {
    return <p className="text-muted">Section “{activeId}” not found.</p>;
  }

  const variants: Array<[string | undefined, UWBlock]> = isBlock(entry)
    ? [[undefined, entry]]
    : Object.entries(entry);

  // Issues the validator raised against THIS section — shown in-context here, with
  // the same BUILTIN_REMEDIATIONS copy the footer surfaces (read off the message,
  // never re-authored), so a fix is one glance from the offending field.
  const sectionIssues = validation.issues.filter((i) => i.section === activeId);

  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-xl text-accent">{displayName(activeId)}</h2>
      <ProseView prose={props.parsed.prose[activeId]} />
      <SectionIssues issues={sectionIssues} />
      {variants.map(([variant, block]) => (
        <BlockView
          key={variant ?? 'default'}
          sectionId={activeId}
          variant={variant}
          block={block}
          dispatch={dispatch}
          issues={sectionIssues}
        />
      ))}
      <HistoryView parsed={parsed} sectionId={activeId} />
    </div>
  );
}

function severityTone(severity: ValidationMessage['severity']): string {
  return severity === 'error'
    ? 'text-error border-error/40 bg-error/5'
    : severity === 'warning'
      ? 'text-warn border-warn/40 bg-warn/5'
      : 'text-muted border-rule bg-canvas';
}

/** The validator's issues for the current section, rendered inline with their
 *  remediation copy. Returns nothing when the section is clean. */
function SectionIssues({ issues }: { issues: ValidationMessage[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {issues.map((i) => (
        <div
          key={`${i.code}|${i.field ?? ''}|${i.message}`}
          className={`rounded border px-3 py-2 text-sm ${severityTone(i.severity)}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[0.6rem] font-bold uppercase">{i.severity}</span>
            <code className="text-xs text-muted">{i.code}</code>
            {i.field && (
              <span className="rounded bg-accent-soft px-1.5 text-xs text-accent">{i.field}</span>
            )}
            {i.title && <strong>{i.title}</strong>}
          </div>
          <div className="mt-0.5 text-muted">{i.message}</div>
          {i.remediation && <div className="mt-0.5 text-xs">→ {i.remediation}</div>}
        </div>
      ))}
    </div>
  );
}

function isBlock(entry: SectionEntry): entry is UWBlock {
  return 'annotation' in entry;
}

function ProseView({ prose }: { prose: string | undefined }) {
  if (!prose?.trim()) return null;
  // Strip markdown scaffolding the structured views already render: headings,
  // dividers, pipe tables, blockquote callouts (same filter as core report.ts).
  const paragraphs = prose
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return (
        !/^#{1,6}\s/.test(t) &&
        !/^(-{3,}|\*{3,}|_{3,})$/.test(t) &&
        !/^\|.*\|$/.test(t) &&
        !/^>\s?/.test(t)
      );
    })
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim());
  if (paragraphs.length === 0) return null;
  return (
    <div className="mt-3 border-l-2 border-rule pl-4 text-sm text-muted">
      {paragraphs.map((p) => (
        <p key={p.slice(0, 80)} className="my-1.5">
          {p.replace(/\s*\n\s*/g, ' ')}
        </p>
      ))}
    </div>
  );
}

function BlockView(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: Dispatch;
  issues: ValidationMessage[];
}) {
  const { sectionId, variant, block, dispatch, issues } = props;
  const [showJson, setShowJson] = useState(false);
  const meta = block.meta;
  const fields = fieldsForSection(sectionId);
  // Paths a section model foots automatically — lock them out of the generic
  // scalar editor so each total has exactly one editing path.
  const lockedPaths = DERIVED_PATHS[sectionId]?.(block);

  return (
    <section className="mt-5 rounded border border-rule bg-paper">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule bg-accent-soft px-4 py-2 text-xs text-muted">
        {variant && <Chip>variant: {variant}</Chip>}
        <Chip>v{meta?.version ?? '?'}</Chip>
        <Chip>{meta?.source ?? 'unknown'}</Chip>
        <ConfidenceChip confidence={meta?.confidence} />
        {meta?.human_review_required && <Chip tone="warn">review required</Chip>}
        <span className="ml-auto">{meta?.timestamp?.slice(0, 19).replace('T', ' ')}</span>
      </header>

      {sectionId === 'rent_roll' && (
        <RentRollModel sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'operating_statement' && (
        <OperatingStatementModel
          sectionId={sectionId}
          variant={variant}
          block={block}
          dispatch={dispatch}
        />
      )}
      {sectionId === 'debt_structure' && (
        <DebtModel sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'sources_uses' && (
        <SourcesUsesModel sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'valuation' && (
        <ValuationModel sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'dcf' && (
        <DcfModel sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'noi_model' && (
        <NoiLineItems sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'assumptions' && (
        <AssumptionsEditor sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}

      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule px-4 py-4 sm:grid-cols-2">
          {fields.map((f) => (
            <NumericField
              key={f.path}
              field={f}
              block={block}
              variant={variant}
              dispatch={dispatch}
              issues={issues.filter((i) => i.field === f.path)}
            />
          ))}
          <p className="text-xs text-muted sm:col-span-2">
            Edits run through <code>applyEdit()</code> as <code>section_replace</code>; the metric
            strip re-evaluates immediately.
          </p>
        </div>
      )}

      <GenericFieldEditor
        sectionId={sectionId}
        variant={variant}
        block={block}
        dispatch={dispatch}
        lockedPaths={lockedPaths}
      />

      <div className="border-t border-rule px-4 py-2">
        <button
          type="button"
          className="text-xs font-semibold text-accent hover:underline"
          onClick={() => setShowJson((s) => !s)}
        >
          {showJson ? '▾ Hide' : '▸ Show'} raw data block
        </button>
        {showJson && (
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-canvas p-3 text-xs leading-relaxed">
            {JSON.stringify(block.content, null, 2)}
          </pre>
        )}
      </div>
    </section>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'warn' }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 ${
        tone === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-rule bg-paper'
      }`}
    >
      {children}
    </span>
  );
}

function ConfidenceChip({ confidence }: { confidence: string | null | undefined }) {
  if (!confidence) return null;
  const tone =
    confidence === 'high' ? 'text-ok border-ok/40 bg-ok/10'
    : confidence === 'low' ? 'text-error border-error/40 bg-error/10'
    : 'text-warn border-warn/40 bg-warn/10';
  return <span className={`rounded-full border px-2 py-0.5 ${tone}`}>{confidence} confidence</span>;
}

function NumericField(props: {
  field: NumericSectionField;
  block: UWBlock;
  variant: string | undefined;
  dispatch: Dispatch;
  issues: ValidationMessage[];
}) {
  const { field, block, variant, dispatch, issues } = props;
  const value = getNumeric(block.content, field.path);
  const display = formatForInput(value, field.kind);

  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarning = !hasError && issues.some((i) => i.severity === 'warning');
  const borderClass = hasError
    ? 'border-error/60 focus:border-error focus:ring-error'
    : hasWarning
      ? 'border-warn/60 focus:border-warn focus:ring-warn'
      : 'border-rule focus:border-accent focus:ring-accent';

  const commit = (raw: string) => {
    const next = parseInput(raw, field.kind);
    if (next === null || next === value) return;

    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    setNumeric(newContent, field.path, next);

    dispatch({
      kind: 'section_replace',
      section_id: field.section_id,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  const fieldId = `nf-${field.section_id}-${field.path}`;
  const msgId = `${fieldId}-msg`;

  return (
    <div className="block">
      <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold text-muted">
        {field.label}
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        className={`num w-full rounded border bg-paper px-2.5 py-1.5 text-sm focus:ring-1 focus:outline-none ${borderClass}`}
        defaultValue={display}
        key={display} /* re-sync after external edits */
        placeholder="—"
        aria-invalid={hasError || hasWarning}
        aria-describedby={issues.length > 0 ? msgId : undefined}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {issues.length > 0 && (
        <div id={msgId}>
          {issues.map((i) => (
            <span
              key={i.code}
              className={`mt-1 block text-xs ${i.severity === 'error' ? 'text-error' : 'text-warn'}`}
            >
              {i.message}
              {i.remediation ? ` → ${i.remediation}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatForInput(value: unknown, kind: NumericSectionField['kind']): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (kind === 'currency' || kind === 'count') return String(Math.round(value));
  return String(value);
}

function parseInput(raw: string, kind: NumericSectionField['kind']): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === 'count') return Math.round(n);
  return n;
}
