// Generic field editor — edits any scalar field in a section's data block, not
// just the curated allow-list. Walks the content tree, surfaces every
// string/number/boolean leaf as a typed input (long strings → textareas, so
// narrative fields like investment_thesis / risk_narrative are editable here),
// and commits via section_replace. Arrays of objects (rent roll, assumptions,
// cash flows) are handled by their dedicated editors and skipped here.
//
// Collapsed by default — this is the "everything else" escape hatch beneath the
// curated quick-edit fields.

import { useState } from 'react';
import type { EditOperation, UWBlock } from '@uwmd/core/browser';
import { deepSet } from '../catalog.js';

interface Leaf {
  path: string;
  value: string | number | boolean;
}

export function GenericFieldEditor(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
  /** Paths that are footed/derived elsewhere (e.g. rent-roll totals) and must
   *  not be hand-edited here — they have exactly one editing path. */
  lockedPaths?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const all = collectLeaves(props.block.content);
  const leaves = props.lockedPaths ? all.filter((l) => !props.lockedPaths?.has(l.path)) : all;
  if (leaves.length === 0) return null;

  return (
    <div className="border-t border-rule px-4 py-3">
      <button
        type="button"
        className="text-xs font-semibold text-accent hover:underline"
        onClick={() => setOpen((s) => !s)}
      >
        {open ? '▾ Hide' : '▸ Show'} all fields ({leaves.length})
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {leaves.map((leaf) => (
            <LeafField key={leaf.path} leaf={leaf} {...props} />
          ))}
          <p className="text-xs text-muted sm:col-span-2">
            Every scalar in the block. Arrays of records (rent roll, assumptions, cash flows) are
            edited in their dedicated tables above. Edits go through <code>applyEdit()</code>.
          </p>
        </div>
      )}
    </div>
  );
}

function LeafField(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
  leaf: Leaf;
}) {
  const { sectionId, variant, block, dispatch, leaf } = props;

  const commit = (next: string | number | boolean) => {
    if (next === leaf.value) return;
    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    deepSet(newContent, leaf.path, next);
    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  const isLongText = typeof leaf.value === 'string' && leaf.value.length > 48;
  const id = `gf-${leaf.path.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <label htmlFor={id} className={`block ${isLongText ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-semibold text-muted" title={leaf.path}>
        {leaf.path}
      </span>
      {typeof leaf.value === 'boolean' ? (
        <select
          id={id}
          className="input"
          defaultValue={String(leaf.value)}
          onChange={(e) => commit(e.target.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : isLongText ? (
        <textarea
          id={id}
          className="input"
          rows={3}
          defaultValue={String(leaf.value)}
          onBlur={(e) => commit(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          className={`input ${typeof leaf.value === 'number' ? 'num' : ''}`}
          key={String(leaf.value)}
          defaultValue={String(leaf.value)}
          onBlur={(e) => commit(coerce(e.target.value, typeof leaf.value === 'number'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </label>
  );
}

function coerce(raw: string, wasNumber: boolean): string | number {
  if (!wasNumber) return raw;
  const n = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : raw;
}

/** Walk content into flat dotted paths for scalar leaves. Skips `_meta`,
 *  arrays (handled by dedicated editors), and null/undefined. */
function collectLeaves(content: unknown, prefix = ''): Leaf[] {
  if (content === null || typeof content !== 'object') return [];
  const out: Leaf[] = [];
  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    if (key === '_meta' || key === '_notes') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) continue;
    if (typeof value === 'object') {
      out.push(...collectLeaves(value, path));
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out.push({ path, value });
    }
  }
  return out;
}
