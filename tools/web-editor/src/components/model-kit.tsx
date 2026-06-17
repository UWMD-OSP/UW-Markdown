// Shared plumbing for "model" section surfaces — the line/scalar inputs are the
// only editable values; the section totals foot from them via a core derive*
// function and render as locked, live-recomputing FootedValue cells. Used by the
// operating-statement, debt, sources-&-uses, and valuation models so every footed
// surface shares one write path and one set of row primitives.
//
// The write path is the same as RentRollModel/OperatingStatementModel: clone the
// block, mutate inputs, re-foot, write back every non-pinned total, dispatch a
// single section_replace through applyEdit(). Hand overrides are recorded in the
// format's own _meta.field_overrides (reason "overridden").

import type {
  DerivedField,
  EditOperation,
  UWBlock,
  UWFieldOverride,
} from '@uwmd/core/browser';
import { getNumeric, setNumeric } from '../catalog.js';
import { FootedValue } from './Footed.js';

type Row = Record<string, unknown>;

export interface Footing {
  content: Row;
  overriddenPaths: Set<string>;
  /** Mutate the cloned content however you like, then re-foot + dispatch. */
  commit: (mutate: (c: Row) => void, nextOverrides: UWFieldOverride[]) => void;
  /** Set one numeric input and re-foot. */
  commitInput: (path: string, value: number) => void;
  /** Render the FootedValue cell for `path`, or null if that total isn't footed. */
  footed: (path: string) => JSX.Element | null;
}

/** Wire a block to a core derive* function. Returns the write path + a `footed`
 *  renderer; the caller lays out the input rows. */
export function useFooting(
  sectionId: string,
  variant: string | undefined,
  block: UWBlock,
  dispatch: (op: EditOperation) => void,
  derive: (content: Row) => { fields: DerivedField[] },
): Footing {
  const content = block.content as Row;
  const overrides = ((block.meta?.field_overrides ?? []) as UWFieldOverride[]).filter(
    (o) => o.reason === 'overridden',
  );
  const overriddenPaths = new Set(overrides.map((o) => o.path));
  const derivedByPath = new Map(derive(content).fields.map((f) => [f.path, f]));

  const commit = (mutate: (c: Row) => void, nextOverrides: UWFieldOverride[]) => {
    const c = JSON.parse(JSON.stringify(content)) as Row;
    delete c['_meta'];
    mutate(c);
    const d = derive(c);
    const skip = new Set(
      nextOverrides.filter((o) => o.reason === 'overridden').map((o) => o.path),
    );
    for (const f of d.fields) if (!skip.has(f.path)) setNumeric(c, f.path, f.value);
    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: c,
      meta: { field_overrides: nextOverrides },
    });
  };

  const commitInput = (path: string, value: number) =>
    commit((c) => setNumeric(c, path, value), overrides);

  const overrideField = (f: DerivedField, value: number, note: string) => {
    const entry: UWFieldOverride = {
      path: f.path,
      reason: 'overridden',
      source: 'manual',
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    commit((c) => setNumeric(c, f.path, value), [
      ...overrides.filter((o) => o.path !== f.path),
      entry,
    ]);
  };

  const revertField = (f: DerivedField) =>
    commit(() => {}, overrides.filter((o) => o.path !== f.path));

  const footed = (path: string) => {
    const f = derivedByPath.get(path);
    if (!f) return null;
    return (
      <FootedValue
        field={f}
        pinned={overriddenPaths.has(path)}
        storedValue={getNumeric(content, path)}
        onOverride={(value, note) => overrideField(f, value, note)}
        onRevert={() => revertField(f)}
      />
    );
  };

  return { content, overriddenPaths, commit, commitInput, footed };
}

// ─── Row primitives ───────────────────────────────────────────────────────────

export interface InputDef {
  path: string;
  label: string;
}

export function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted uppercase">{children}</h3>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-3 mb-0.5 text-[0.65rem] font-semibold tracking-widest text-muted uppercase">
      {children}
    </h4>
  );
}

/** A single editable numeric input bound to a content path. Currency-style by
 *  default; `kind: 'rate'` edits a fraction as a percent. */
export function InputRow(props: {
  def: InputDef;
  value: number | undefined;
  kind?: 'currency' | 'rate';
  onCommit: (path: string, value: number) => void;
  indent?: boolean;
}) {
  const { def, value, kind = 'currency', onCommit, indent } = props;
  const display =
    value === undefined ? '' : kind === 'rate' ? String(Math.round(value * 1e6) / 1e4) : String(value);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[$,\s%]/g, '');
    if (cleaned === '') return;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    const next = kind === 'rate' ? n / 100 : n;
    if (next === value) return;
    onCommit(def.path, next);
  };

  return (
    <label
      className={`flex items-center justify-between gap-4 border-b border-rule py-0.5 ${indent ? 'pl-3' : ''}`}
    >
      <span className={`text-sm ${indent ? 'text-muted' : ''}`}>
        {def.label}
        {kind === 'rate' && <span className="ml-1 text-[0.6rem] text-muted">(%)</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        className="num w-36 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-rule focus:border-accent focus:bg-paper focus:ring-1 focus:ring-accent focus:outline-none"
        key={display}
        defaultValue={display}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** A footed (read-only/override) row. Renders nothing when the total isn't footed. */
export function FootedRow(props: {
  label: string;
  emphatic?: boolean;
  indent?: boolean;
  children: React.ReactNode;
}) {
  if (!props.children) return null;
  return (
    <div
      className={`flex items-center justify-between gap-4 py-0.5 ${props.indent ? 'pl-3' : ''} ${
        props.emphatic ? 'mt-1 border-t border-accent pt-1 text-sm font-semibold' : 'text-sm'
      }`}
    >
      <span>{props.label}</span>
      {props.children}
    </div>
  );
}
