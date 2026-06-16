// Rent-roll MODEL surface — the line items are the only inputs; the section
// totals (GPR, in-place rent, occupancy, leased SF, WALT, PSF) are FOOTED from
// them by @uwmd/core's deriveRentRoll() and shown as locked, live-recomputing
// cells. This is the "be an underwriting model, not a markdown form" pattern:
// you type units/tenants, everything above rolls up, and the metric strip +
// report react immediately.
//
// Every mutation (cell edit, add/remove row, override, revert) clones the block,
// mutates one array, re-foots via deriveRentRoll, writes the non-overridden
// totals back, and dispatches a single section_replace through the applyEdit
// chokepoint — so the file can never be left internally inconsistent.
//
// Overrides: a derived total can be pinned by hand. The pin is recorded in the
// format's own _meta.field_overrides (reason:"overridden"); a pinned field is
// skipped by the footing and badged "manual" until reverted to formula.

import {
  deriveRentRoll,
  rentRollVariant,
  type EditOperation,
  type UWBlock,
  type UWFieldOverride,
  type DerivedField,
} from '@uwmd/core/browser';
import { deepSet, getNumeric } from '../catalog.js';
import { FootedValue } from './Footed.js';

type Row = Record<string, unknown>;

interface ColumnDef {
  key: string;
  label: string;
  kind: 'text' | 'currency' | 'count' | 'rate';
}

const UNIT_COLUMNS: ColumnDef[] = [
  { key: 'unit_id', label: 'Unit', kind: 'text' },
  { key: 'unit_type', label: 'Type', kind: 'text' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'sqft', label: 'SF', kind: 'count' },
  { key: 'monthly_rent', label: 'In-Place Rent', kind: 'currency' },
  { key: 'market_rent', label: 'Market Rent', kind: 'currency' },
];

const UNIT_MIX_COLUMNS: ColumnDef[] = [
  { key: 'unit_type', label: 'Unit Type', kind: 'text' },
  { key: 'count', label: 'Count', kind: 'count' },
  { key: 'avg_sqft', label: 'Avg SF', kind: 'count' },
  { key: 'avg_rent_inplace', label: 'In-Place Rent', kind: 'currency' },
  { key: 'avg_rent_market', label: 'Market Rent', kind: 'currency' },
  { key: 'occupancy_pct', label: 'Occupancy', kind: 'rate' },
];

const TENANT_COLUMNS: ColumnDef[] = [
  { key: 'tenant_name', label: 'Tenant', kind: 'text' },
  { key: 'suite', label: 'Suite', kind: 'text' },
  { key: 'leased_sf', label: 'SF', kind: 'count' },
  { key: 'annual_base_rent', label: 'Annual Rent', kind: 'currency' },
  { key: 'lease_expiration', label: 'Expires', kind: 'text' },
];

/** Pick the editable line-item array (the model's inputs) for this block. */
function tableConfig(content: Row): { arrayKey: string; columns: ColumnDef[]; title: string } {
  if (rentRollVariant(content) === 'commercial') {
    return { arrayKey: 'tenants', columns: TENANT_COLUMNS, title: 'Tenants' };
  }
  if (Array.isArray(content['units']) && (content['units'] as Row[]).length > 0) {
    return { arrayKey: 'units', columns: UNIT_COLUMNS, title: 'Unit Schedule' };
  }
  if (Array.isArray(content['unit_mix_summary'])) {
    return { arrayKey: 'unit_mix_summary', columns: UNIT_MIX_COLUMNS, title: 'Unit Mix' };
  }
  return { arrayKey: 'units', columns: UNIT_COLUMNS, title: 'Unit Schedule' };
}

export function RentRollModel(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { sectionId, variant, block, dispatch } = props;
  const content = block.content as Row;
  const cfg = tableConfig(content);
  const rows = (Array.isArray(content[cfg.arrayKey]) ? content[cfg.arrayKey] : []) as Row[];

  const overrides = ((block.meta?.field_overrides ?? []) as UWFieldOverride[]).filter(
    (o) => o.reason === 'overridden',
  );
  const overriddenPaths = new Set(overrides.map((o) => o.path));

  const derivation = deriveRentRoll(content);

  // The single write path: clone, mutate the inputs, re-foot, write back every
  // total that isn't hand-pinned, then dispatch one section_replace.
  const commit = (mutate: (c: Row) => void, nextOverrides: UWFieldOverride[]) => {
    const c = JSON.parse(JSON.stringify(content)) as Row;
    delete c['_meta'];
    mutate(c);
    const d = deriveRentRoll(c);
    const skip = new Set(nextOverrides.filter((o) => o.reason === 'overridden').map((o) => o.path));
    for (const f of d.fields) if (!skip.has(f.path)) deepSet(c, f.path, f.value);
    if (d.unit_mix_summary) c['unit_mix_summary'] = d.unit_mix_summary;
    if (d.tenant_concentration) c['tenant_concentration'] = d.tenant_concentration;
    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: c,
      // Always pass the full intended list so reverts (empty) actually clear.
      meta: { field_overrides: nextOverrides },
    });
  };

  const mutateArray = (fn: (arr: Row[]) => void) => {
    commit((c) => {
      const arr = (Array.isArray(c[cfg.arrayKey]) ? c[cfg.arrayKey] : []) as Row[];
      fn(arr);
      c[cfg.arrayKey] = arr;
    }, overrides);
  };

  const commitCell = (i: number, col: ColumnDef, raw: string) => {
    const next = parseCell(raw, col.kind);
    if (next === rows[i]?.[col.key]) return;
    mutateArray((arr) => {
      arr[i] = { ...arr[i], [col.key]: next };
    });
  };

  const addRow = () => {
    const blank: Row = {};
    for (const col of cfg.columns) blank[col.key] = col.kind === 'text' ? '' : 0;
    mutateArray((arr) => arr.push(blank));
  };

  const removeRow = (i: number) =>
    mutateArray((arr) => {
      arr.splice(i, 1);
    });

  const overrideField = (f: DerivedField, value: number, note: string) => {
    const entry: UWFieldOverride = {
      path: f.path,
      reason: 'overridden',
      source: 'manual',
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const next = [...overrides.filter((o) => o.path !== f.path), entry];
    commit((c) => deepSet(c, f.path, value), next);
  };

  const revertField = (f: DerivedField) => {
    commit(() => {}, overrides.filter((o) => o.path !== f.path));
  };

  return (
    <div className="px-4 py-4">
      <LineItemTable
        title={cfg.title}
        columns={cfg.columns}
        rows={rows}
        onCell={commitCell}
        onAdd={addRow}
        onRemove={removeRow}
      />

      <DerivedTotals
        fields={derivation.fields}
        basis={derivation.basis}
        content={content}
        overriddenPaths={overriddenPaths}
        onOverride={overrideField}
        onRevert={revertField}
      />
    </div>
  );
}

// ─── Line items (the inputs) ─────────────────────────────────────────────────

function LineItemTable(props: {
  title: string;
  columns: ColumnDef[];
  rows: Row[];
  onCell: (i: number, col: ColumnDef, raw: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const { title, columns, rows, onCell, onAdd, onRemove } = props;
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">{title}</h3>
        <button type="button" className="btn-secondary" onClick={onAdd}>
          + Add row
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-rule px-3 py-4 text-center text-sm text-muted">
          No line items yet. Add a row — every total below foots from these inputs.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-accent text-left text-[0.65rem] tracking-wider text-white uppercase">
              {columns.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 ${c.kind === 'text' ? '' : 'text-right'}`}>
                  {c.label}
                </th>
              ))}
              <th className="w-8 px-1 py-1.5" aria-label="remove" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${String(row[columns[0].key] ?? '')}-${i}`}
                className="border-b border-rule odd:bg-paper even:bg-canvas"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-1 py-0.5 ${col.kind === 'text' ? '' : 'text-right'}`}>
                    <input
                      type="text"
                      inputMode={col.kind === 'text' ? 'text' : 'decimal'}
                      className={`w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rule focus:border-accent focus:bg-paper focus:ring-1 focus:ring-accent focus:outline-none ${col.kind === 'text' ? '' : 'num'}`}
                      key={formatCell(row[col.key])}
                      defaultValue={formatCell(row[col.key])}
                      onBlur={(e) => onCell(i, col, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </td>
                ))}
                <td className="px-1 py-0.5 text-center">
                  <button
                    type="button"
                    aria-label={`Remove row ${i + 1}`}
                    className="text-muted hover:text-error"
                    onClick={() => onRemove(i)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

// ─── Derived totals (footed outputs) ─────────────────────────────────────────

function DerivedTotals(props: {
  fields: DerivedField[];
  basis: string;
  content: Row;
  overriddenPaths: Set<string>;
  onOverride: (f: DerivedField, value: number, note: string) => void;
  onRevert: (f: DerivedField) => void;
}) {
  const { fields, basis, content, overriddenPaths, onOverride, onRevert } = props;

  if (fields.length === 0) {
    return (
      <p className="mt-4 border-t-2 border-accent pt-3 text-xs text-muted">
        Add line items above and the section totals (GPR, in-place rent, occupancy…) will foot here
        automatically.
      </p>
    );
  }

  const basisLabel =
    basis === 'units'
      ? 'unit schedule'
      : basis === 'unit_mix_summary'
        ? 'unit mix'
        : basis === 'tenants'
          ? 'tenant schedule'
          : 'line items';

  return (
    <div className="mt-4 border-t-2 border-accent pt-3">
      <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">
        Footed Totals
      </h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {fields.map((f) => (
          <div
            key={f.path}
            className="flex items-center justify-between gap-2 border-b border-rule/60 py-1"
          >
            <span className="text-sm">{f.label}</span>
            <FootedValue
              field={f}
              pinned={overriddenPaths.has(f.path)}
              storedValue={getNumeric(content, f.path)}
              onOverride={(value, note) => onOverride(f, value, note)}
              onRevert={() => onRevert(f)}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Totals foot from the {basisLabel} above and recompute on every edit. Override pins a value by
        hand (stored as <code>_meta.field_overrides</code>, reason <code>overridden</code>); revert
        returns it to the formula.
      </p>
    </div>
  );
}

// ─── Cell formatting / parsing ────────────────────────────────────────────────

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseCell(raw: string, kind: ColumnDef['kind']): unknown {
  if (kind === 'text') return raw;
  const cleaned = raw.replace(/[$,\s%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === 'count') return Math.round(n);
  return n;
}

// Exposed so SectionView can lock these footed paths out of the generic editor.
export function derivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveRentRoll(block.content as Row).fields.map((f) => f.path));
}
