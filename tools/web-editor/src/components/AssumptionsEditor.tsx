// Assumptions editor — assumptions are the heart of an underwrite, and every
// override needs a rationale. Editing a value flips is_overridden=true, records
// the original_value, and prompts for override_rationale; the report's
// assumptions table surfaces all of it with source badges.
//
// The block content is `{ assumptions: [{ key, label, value, unit, source,
// is_overridden, original_value, override_rationale, ... }], summary? }`.

import { useState } from 'react';
import type { EditOperation, UWBlock } from '@uwmd/core/browser';

interface Assumption {
  key?: string;
  label?: string;
  value?: unknown;
  unit?: string;
  source?: string;
  is_overridden?: boolean;
  original_value?: unknown;
  override_rationale?: string | null;
  [k: string]: unknown;
}

export function AssumptionsEditor(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const list = (props.block.content as { assumptions?: Assumption[] }).assumptions;
  if (!Array.isArray(list) || list.length === 0) return null;

  return (
    <div className="px-4 py-4">
      <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">Assumptions</h3>
      <div className="space-y-2">
        {list.map((a, i) => (
          <AssumptionRow key={a.key ?? String(i)} index={i} assumption={a} {...props} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Changing a value records the original and flips <code>is_overridden</code>; add a rationale so
        the credit memo can show why. Edits go through <code>applyEdit()</code>.
      </p>
    </div>
  );
}

function AssumptionRow(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
  index: number;
  assumption: Assumption;
}) {
  const { sectionId, variant, block, dispatch, index, assumption } = props;
  const [rationaleOpen, setRationaleOpen] = useState(false);

  const commit = (patch: Partial<Assumption>) => {
    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    const arr = newContent['assumptions'] as Assumption[];
    arr[index] = { ...arr[index], ...patch };
    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  const commitValue = (raw: string) => {
    const next = parseAssumptionValue(raw, assumption.value);
    if (next === assumption.value) return;
    const wasOverridden = assumption.is_overridden === true;
    commit({
      value: next,
      is_overridden: true,
      // Capture the pre-edit value the first time it's overridden.
      original_value: wasOverridden ? assumption.original_value : assumption.value,
    });
    setRationaleOpen(true);
  };

  return (
    <div className="rounded border border-rule bg-paper px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{assumption.label ?? assumption.key}</div>
          <div className="text-[0.65rem] text-muted">
            <code>{assumption.key}</code>
            {assumption.source ? ` · ${assumption.source}` : ''}
            {assumption.unit ? ` · ${assumption.unit}` : ''}
          </div>
        </div>
        {assumption.is_overridden && (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[0.62rem] font-semibold text-warn">
            overridden
            {assumption.original_value !== undefined && assumption.original_value !== null
              ? ` (was ${String(assumption.original_value)})`
              : ''}
          </span>
        )}
        <input
          type="text"
          className="num w-32 rounded border border-rule bg-paper px-2 py-1 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          key={String(assumption.value)}
          defaultValue={assumption.value === null || assumption.value === undefined ? '' : String(assumption.value)}
          onBlur={(e) => commitValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() => setRationaleOpen((s) => !s)}
        >
          {rationaleOpen ? 'hide' : 'rationale'}
        </button>
      </div>
      {rationaleOpen && (
        <textarea
          className="mt-2 w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          rows={2}
          placeholder="Why is this value overridden? (→ override_rationale, shown in the credit memo)"
          defaultValue={assumption.override_rationale ?? ''}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (assumption.override_rationale ?? '')) commit({ override_rationale: v || null });
          }}
        />
      )}
    </div>
  );
}

function parseAssumptionValue(raw: string, prior: unknown): unknown {
  const t = raw.trim();
  if (t === '') return null;
  // Keep the type of the prior value where possible.
  if (typeof prior === 'number' || /^-?\d*\.?\d+$/.test(t.replace(/[$,%\s]/g, ''))) {
    const n = Number(t.replace(/[$,%\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  return t;
}
