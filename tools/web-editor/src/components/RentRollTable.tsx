// Editable rent-roll tables — unit-mix rows (multifamily/self-storage style)
// and tenant rows (office/retail/industrial style). Cell edits, add-row, and
// remove-row all clone the block content, mutate one array, and dispatch
// section_replace through the applyEdit chokepoint like every other edit.

import type { EditOperation, UWBlock } from '@uwmd/core/browser';

type Row = Record<string, unknown>;

interface ColumnDef {
  key: string;
  label: string;
  kind: 'text' | 'currency' | 'count' | 'rate';
}

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
  { key: 'rent_psf', label: 'Rent PSF', kind: 'rate' },
  { key: 'lease_expiration', label: 'Expires', kind: 'text' },
];

export function RentRollTable(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const content = props.block.content as Row;

  const unitMix = content['unit_mix_summary'];
  if (Array.isArray(unitMix)) {
    return (
      <EditableArrayTable
        {...props}
        title="Unit Mix"
        arrayKey="unit_mix_summary"
        columns={UNIT_MIX_COLUMNS}
        rows={unitMix as Row[]}
      />
    );
  }

  const tenants = content['tenants'];
  if (Array.isArray(tenants)) {
    return (
      <EditableArrayTable
        {...props}
        title="Tenants"
        arrayKey="tenants"
        columns={TENANT_COLUMNS}
        rows={tenants as Row[]}
      />
    );
  }

  return null;
}

function EditableArrayTable(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
  title: string;
  arrayKey: string;
  columns: ColumnDef[];
  rows: Row[];
}) {
  const { sectionId, variant, block, dispatch, title, arrayKey, columns, rows } = props;

  const dispatchArray = (mutate: (arr: Row[]) => void) => {
    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    const arr = (newContent[arrayKey] as Row[]) ?? [];
    mutate(arr);
    newContent[arrayKey] = arr;
    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  const commitCell = (rowIndex: number, col: ColumnDef, raw: string) => {
    const next = parseCell(raw, col.kind);
    if (next === rows[rowIndex]?.[col.key]) return;
    dispatchArray((arr) => {
      arr[rowIndex] = { ...arr[rowIndex], [col.key]: next };
    });
  };

  const addRow = () => {
    const blank: Row = {};
    for (const c of columns) blank[c.key] = c.kind === 'text' ? '' : 0;
    dispatchArray((arr) => {
      arr.push(blank);
    });
  };

  const removeRow = (rowIndex: number) => {
    dispatchArray((arr) => {
      arr.splice(rowIndex, 1);
    });
  };

  return (
    <div className="px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">{title}</h3>
        <button type="button" className="btn-secondary" onClick={addRow}>
          + Add row
        </button>
      </div>
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
                    onBlur={(e) => commitCell(i, col, e.target.value)}
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
                  onClick={() => removeRow(i)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-xs text-muted">
        Row edits replace the array through <code>applyEdit()</code>. Stored roll-up totals (GPR,
        in-place rent) are not recomputed — the validator flags any drift below.
      </p>
    </div>
  );
}

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
