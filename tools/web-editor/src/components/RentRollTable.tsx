// Editable rent-roll tables — unit-mix rows (multifamily/self-storage style)
// and tenant rows (office/retail/industrial style). Each cell commit clones
// the block content, updates one array entry, and dispatches section_replace
// through the applyEdit chokepoint like every other edit.

import type { EditOperation, UWBlock } from '@uwmd/core/browser';

type Row = Record<string, unknown>;

interface ColumnDef {
  key: string;
  label: string;
  kind: 'text' | 'currency' | 'count' | 'rate';
  editable?: boolean;
}

const UNIT_MIX_COLUMNS: ColumnDef[] = [
  { key: 'unit_type', label: 'Unit Type', kind: 'text' },
  { key: 'count', label: 'Count', kind: 'count', editable: true },
  { key: 'avg_sqft', label: 'Avg SF', kind: 'count', editable: true },
  { key: 'avg_rent_inplace', label: 'In-Place Rent', kind: 'currency', editable: true },
  { key: 'avg_rent_market', label: 'Market Rent', kind: 'currency', editable: true },
  { key: 'occupancy_pct', label: 'Occupancy', kind: 'rate', editable: true },
];

const TENANT_COLUMNS: ColumnDef[] = [
  { key: 'tenant_name', label: 'Tenant', kind: 'text' },
  { key: 'suite', label: 'Suite', kind: 'text' },
  { key: 'leased_sf', label: 'SF', kind: 'count', editable: true },
  { key: 'annual_base_rent', label: 'Annual Rent', kind: 'currency', editable: true },
  { key: 'rent_psf', label: 'Rent PSF', kind: 'rate', editable: true },
  { key: 'lease_expiration', label: 'Expires', kind: 'text' },
];

export function RentRollTable(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { block } = props;
  const content = block.content as Row;

  const unitMix = content['unit_mix_summary'];
  if (Array.isArray(unitMix) && unitMix.length > 0) {
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
  if (Array.isArray(tenants) && tenants.length > 0) {
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

  const commitCell = (rowIndex: number, col: ColumnDef, raw: string) => {
    const next = parseCell(raw, col.kind);
    if (next === null) return;
    const current = rows[rowIndex]?.[col.key];
    if (next === current) return;

    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    const arr = newContent[arrayKey] as Row[];
    arr[rowIndex] = { ...arr[rowIndex], [col.key]: next };

    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  return (
    <div className="px-4 py-4">
      <h3 className="mb-2 text-xs font-semibold tracking-widest text-muted uppercase">{title}</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-accent text-left text-[0.65rem] tracking-wider text-white uppercase">
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-1.5 ${c.kind === 'text' ? '' : 'text-right'}`}>
                {c.label}
              </th>
            ))}
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
                  {col.editable ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      className="num w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm hover:border-rule focus:border-accent focus:bg-paper focus:ring-1 focus:ring-accent focus:outline-none"
                      key={formatCell(row[col.key], col.kind)}
                      defaultValue={formatCell(row[col.key], col.kind)}
                      onBlur={(e) => commitCell(i, col, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <span className="block px-1 py-1">{formatCell(row[col.key], col.kind)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-xs text-muted">
        Cell edits replace the whole row through <code>applyEdit()</code>. Stored roll-up totals
        (GPR, in-place rent) are not recomputed — the validator flags any drift.
      </p>
    </div>
  );
}

function formatCell(value: unknown, kind: ColumnDef['kind']): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  if (kind === 'currency' || kind === 'count') return String(Math.round(value) === value ? value : value);
  return String(value);
}

function parseCell(raw: string, kind: ColumnDef['kind']): unknown {
  if (kind === 'text') return raw.trim() === '' ? null : raw.trim();
  const cleaned = raw.replace(/[$,\s%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === 'count') return Math.round(n);
  return n;
}
