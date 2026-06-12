// Section editor pane — frontmatter form, per-section numeric inputs (the
// calc-driving allow-list), block metadata, and a collapsible raw-JSON view.
// Every change dispatches an EditOperation; nothing mutates state directly.

import { useState } from 'react';
import type { EditOperation, ParsedUWFile, UWBlock } from '@uwmd/core/browser';
import {
  displayName,
  fieldsForSection,
  getNumeric,
  setNumeric,
  type NumericSectionField,
} from '../catalog.js';
import { FrontmatterEditor } from './FrontmatterEditor.js';
import { PipelineLog } from './PipelineLog.js';
import { RentRollTable } from './RentRollTable.js';
import { NoiLineItems } from './NoiLineItems.js';
import { HistoryView } from './HistoryView.js';

type SectionEntry = UWBlock | Record<string, UWBlock>;

export type Dispatch = (op: EditOperation) => void;

export function SectionView(props: {
  parsed: ParsedUWFile;
  activeId: string | null;
  dispatch: Dispatch;
}) {
  const { parsed, activeId, dispatch } = props;

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

  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-xl text-accent">{displayName(activeId)}</h2>
      <ProseView prose={props.parsed.prose[activeId]} />
      {variants.map(([variant, block]) => (
        <BlockView
          key={variant ?? 'default'}
          sectionId={activeId}
          variant={variant}
          block={block}
          dispatch={dispatch}
        />
      ))}
      <HistoryView parsed={parsed} sectionId={activeId} />
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
}) {
  const { sectionId, variant, block, dispatch } = props;
  const [showJson, setShowJson] = useState(false);
  const meta = block.meta;
  const fields = fieldsForSection(sectionId);

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
        <RentRollTable sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
      )}
      {sectionId === 'noi_model' && (
        <NoiLineItems sectionId={sectionId} variant={variant} block={block} dispatch={dispatch} />
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
            />
          ))}
          <p className="text-xs text-muted sm:col-span-2">
            Edits run through <code>applyEdit()</code> as <code>section_replace</code>; the metric
            strip re-evaluates immediately.
          </p>
        </div>
      )}

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
}) {
  const { field, block, variant, dispatch } = props;
  const value = getNumeric(block.content, field.path);
  const display = formatForInput(value, field.kind);

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

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{field.label}</span>
      <input
        type="text"
        inputMode="decimal"
        className="num w-full rounded border border-rule bg-paper px-2.5 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        defaultValue={display}
        key={display} /* re-sync after external edits */
        placeholder="—"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
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
