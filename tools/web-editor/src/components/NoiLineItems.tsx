// NOI model line-item editor. Income and expense entries in noi_model are
// usually wrapped objects ({ value, source, rationale, ... }); setNumeric
// updates `.value` in place so provenance fields survive the edit. Stored
// totals (EGI, total OpEx, NOI) are shown read-only — they are engine
// outputs, and the validator's CC checks flag them if an edit makes them
// stale.

import type { EditOperation, UWBlock } from '@uwmd/core/browser';
import { getNumeric, setNumeric } from '../catalog.js';

interface LineDef {
  path: string;
  label: string;
  group: 'income' | 'expense';
}

const LINES: LineDef[] = [
  { path: 'income.gross_potential_rent', label: 'Gross Potential Rent', group: 'income' },
  { path: 'income.vacancy_credit_loss', label: 'Vacancy / Credit Loss', group: 'income' },
  { path: 'income.concessions', label: 'Concessions', group: 'income' },
  { path: 'income.loss_to_lease', label: 'Loss to Lease', group: 'income' },
  { path: 'income.other_income', label: 'Other Income', group: 'income' },
  { path: 'expenses.real_estate_taxes', label: 'Real Estate Taxes', group: 'expense' },
  { path: 'expenses.insurance', label: 'Insurance', group: 'expense' },
  { path: 'expenses.management_fees', label: 'Management Fees', group: 'expense' },
  { path: 'expenses.payroll_benefits', label: 'Payroll & Benefits', group: 'expense' },
  { path: 'expenses.utilities', label: 'Utilities', group: 'expense' },
  { path: 'expenses.repairs_maintenance', label: 'Repairs & Maintenance', group: 'expense' },
  { path: 'expenses.contract_services', label: 'Contract Services', group: 'expense' },
  { path: 'expenses.marketing_advertising', label: 'Marketing & Advertising', group: 'expense' },
  { path: 'expenses.administrative', label: 'Administrative', group: 'expense' },
  { path: 'expenses.professional_fees', label: 'Professional Fees', group: 'expense' },
  { path: 'expenses.cam_expenses', label: 'CAM Expenses', group: 'expense' },
  { path: 'expenses.replacement_reserves', label: 'Replacement Reserves', group: 'expense' },
];

const TOTALS: Array<{ path: string; label: string }> = [
  { path: 'income.effective_gross_income', label: 'Effective Gross Income' },
  { path: 'expenses.total_operating_expenses', label: 'Total Operating Expenses' },
  { path: 'net_operating_income', label: 'Net Operating Income' },
];

export function NoiLineItems(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { sectionId, variant, block, dispatch } = props;

  const present = LINES.filter((l) => getNumeric(block.content, l.path) !== undefined);
  if (present.length === 0) return null;

  const commit = (line: LineDef, raw: string) => {
    const cleaned = raw.replace(/[$,\s]/g, '');
    if (cleaned === '') return;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n === getNumeric(block.content, line.path)) return;

    const newContent = JSON.parse(JSON.stringify(block.content)) as Record<string, unknown>;
    delete newContent['_meta'];
    setNumeric(newContent, line.path, n);

    dispatch({
      kind: 'section_replace',
      section_id: sectionId,
      ...(variant ? { variant } : {}),
      content: newContent,
      meta: {},
    });
  };

  const renderGroup = (group: 'income' | 'expense', title: string) => {
    const lines = present.filter((l) => l.group === group);
    if (lines.length === 0) return null;
    return (
      <div>
        <h4 className="mt-3 mb-1 text-[0.65rem] font-semibold tracking-widest text-muted uppercase">
          {title}
        </h4>
        {lines.map((line) => (
          <label key={line.path} className="flex items-center justify-between gap-4 border-b border-rule py-0.5">
            <span className="text-sm">{line.label}</span>
            <input
              type="text"
              inputMode="decimal"
              className="num w-36 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-rule focus:border-accent focus:bg-paper focus:ring-1 focus:ring-accent focus:outline-none"
              key={String(getNumeric(block.content, line.path))}
              defaultValue={String(getNumeric(block.content, line.path) ?? '')}
              onBlur={(e) => commit(line, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="px-4 py-4">
      <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">Line Items</h3>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {renderGroup('income', 'Income')}
        {renderGroup('expense', 'Expenses')}
      </div>
      <div className="mt-4 border-t-2 border-accent pt-2">
        {TOTALS.map(({ path, label }) => {
          const v = getNumeric(block.content, path);
          if (v === undefined) return null;
          return (
            <div key={path} className="flex items-center justify-between py-0.5 text-sm font-semibold">
              <span>{label}</span>
              <span className="tabular-nums">
                ${v.toLocaleString('en-US')}
              </span>
            </div>
          );
        })}
        <p className="mt-1.5 text-xs text-muted">
          Totals are stored engine outputs and are not recomputed here — if a line-item edit makes
          them stale, the validator's CC checks flag it immediately below.
        </p>
      </div>
    </div>
  );
}
