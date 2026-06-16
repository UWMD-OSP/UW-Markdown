// Operating-statement MODEL surface — the income and expense lines are the
// inputs; effective gross income, total operating expenses, NOI, and the ratios
// foot from them via @uwmd/core's deriveOperatingStatement() and show as locked,
// live-recomputing cells. Same pattern and write-path as RentRollModel: edit a
// line → clone → re-foot → write back non-overridden totals → one
// section_replace through applyEdit. Overrides are recorded in
// _meta.field_overrides (reason "overridden").

import {
  deriveOperatingStatement,
  type EditOperation,
  type UWBlock,
  type UWFieldOverride,
  type DerivedField,
} from '@uwmd/core/browser';
import { deepGet, getNumeric, setNumeric } from '../catalog.js';
import { FootedValue } from './Footed.js';

type Row = Record<string, unknown>;

interface InputDef {
  path: string;
  label: string;
}

const INCOME_INPUTS: InputDef[] = [
  { path: 'income.gross_potential_rent', label: 'Gross Potential Rent' },
  { path: 'income.less_vacancy_credit_loss', label: 'Less: Vacancy / Credit Loss' },
  { path: 'income.less_concessions', label: 'Less: Concessions' },
  { path: 'income.less_loss_to_lease', label: 'Less: Loss to Lease' },
];

const EXPENSE_INPUTS: InputDef[] = [
  { path: 'expenses.real_estate_taxes', label: 'Real Estate Taxes' },
  { path: 'expenses.insurance', label: 'Insurance' },
  { path: 'expenses.management_fees', label: 'Management Fees' },
  { path: 'expenses.payroll_benefits', label: 'Payroll & Benefits' },
  { path: 'expenses.repairs_maintenance', label: 'Repairs & Maintenance' },
  { path: 'expenses.contract_services', label: 'Contract Services' },
  { path: 'expenses.marketing_advertising', label: 'Marketing & Advertising' },
  { path: 'expenses.administrative', label: 'Administrative' },
  { path: 'expenses.professional_fees', label: 'Professional Fees' },
  { path: 'expenses.other_expenses', label: 'Other Expenses' },
];

// Inputs shown but deliberately excluded from NOI (below the line).
const BELOW_LINE_INPUTS: InputDef[] = [
  { path: 'expenses.replacement_reserves', label: 'Replacement Reserves' },
  { path: 'expenses.capital_expenditures_actual', label: 'Capital Expenditures' },
];

function prettify(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Dynamic breakdown sub-inputs (other_income / utilities) — every numeric key
 *  except the footed `total`. */
function breakdownInputs(content: Row, parentPath: string): InputDef[] {
  const obj = deepGet(content, parentPath);
  if (obj === null || typeof obj !== 'object') return [];
  return Object.keys(obj as Row)
    .filter((k) => k !== 'total')
    .map((k) => ({ path: `${parentPath}.${k}`, label: prettify(k) }));
}

export function OperatingStatementModel(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { sectionId, variant, block, dispatch } = props;
  const content = block.content as Row;

  const overrides = ((block.meta?.field_overrides ?? []) as UWFieldOverride[]).filter(
    (o) => o.reason === 'overridden',
  );
  const overriddenPaths = new Set(overrides.map((o) => o.path));

  const derivation = deriveOperatingStatement(content);
  const derivedByPath = new Map(derivation.fields.map((f) => [f.path, f]));

  // Single write path: clone, mutate inputs, re-foot, write back non-pinned
  // totals, dispatch one section_replace.
  const commit = (mutate: (c: Row) => void, nextOverrides: UWFieldOverride[]) => {
    const c = JSON.parse(JSON.stringify(content)) as Row;
    delete c['_meta'];
    mutate(c);
    const d = deriveOperatingStatement(c);
    const skip = new Set(nextOverrides.filter((o) => o.reason === 'overridden').map((o) => o.path));
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

  const presentInputs = (defs: InputDef[]) =>
    defs.filter((d) => getNumeric(content, d.path) !== undefined);

  const otherIncome = breakdownInputs(content, 'income.other_income');
  const utilities = breakdownInputs(content, 'expenses.utilities');

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {/* Income */}
        <div>
          <GroupHeading>Income</GroupHeading>
          {presentInputs(INCOME_INPUTS).map((d) => (
            <InputRow
              key={d.path}
              def={d}
              value={getNumeric(content, d.path)}
              onCommit={commitInput}
            />
          ))}

          {otherIncome.length > 0 && (
            <>
              <SubHeading>Other Income</SubHeading>
              {otherIncome.map((d) => (
                <InputRow
                  key={d.path}
                  def={d}
                  value={getNumeric(content, d.path)}
                  onCommit={commitInput}
                  indent
                />
              ))}
              <FootedRow label="Other Income (total)">{footed('income.other_income.total')}</FootedRow>
            </>
          )}

          <FootedRow label="Vacancy %">{footed('income.vacancy_pct')}</FootedRow>
          <FootedRow label="Effective Gross Income" emphatic>
            {footed('income.effective_gross_income')}
          </FootedRow>
        </div>

        {/* Expenses */}
        <div>
          <GroupHeading>Operating Expenses</GroupHeading>
          {presentInputs(EXPENSE_INPUTS).map((d) => (
            <InputRow
              key={d.path}
              def={d}
              value={getNumeric(content, d.path)}
              onCommit={commitInput}
            />
          ))}

          {utilities.length > 0 && (
            <>
              <SubHeading>Utilities</SubHeading>
              {utilities.map((d) => (
                <InputRow
                  key={d.path}
                  def={d}
                  value={getNumeric(content, d.path)}
                  onCommit={commitInput}
                  indent
                />
              ))}
              <FootedRow label="Utilities (total)">{footed('expenses.utilities.total')}</FootedRow>
            </>
          )}

          <FootedRow label="Total Operating Expenses" emphatic>
            {footed('expenses.total_operating_expenses')}
          </FootedRow>

          {presentInputs(BELOW_LINE_INPUTS).length > 0 && (
            <>
              <SubHeading>Below the line — excluded from NOI</SubHeading>
              {presentInputs(BELOW_LINE_INPUTS).map((d) => (
                <InputRow
                  key={d.path}
                  def={d}
                  value={getNumeric(content, d.path)}
                  onCommit={commitInput}
                  indent
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Bottom line */}
      <div className="mt-4 border-t-2 border-accent pt-2">
        <div className="flex items-center justify-between py-1 text-base font-semibold">
          <span>Net Operating Income</span>
          {footed('net_operating_income') ?? <span className="text-muted">—</span>}
        </div>
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          <FootedRow label="Expense Ratio">{footed('expense_ratio')}</FootedRow>
          <FootedRow label="NOI Margin">{footed('noi_margin')}</FootedRow>
        </div>
        <p className="mt-2 text-xs text-muted">
          EGI, total OpEx, NOI and the ratios foot from the line items above and recompute on every
          edit. OpEx excludes capital expenditures and replacement reserves (below the line).
          Override pins a value by hand (<code>_meta.field_overrides</code>); revert returns it to the
          formula.
        </p>
      </div>
    </div>
  );
}

// ─── Small presentational helpers ─────────────────────────────────────────────

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-xs font-semibold tracking-widest text-muted uppercase">{children}</h3>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-3 mb-0.5 text-[0.65rem] font-semibold tracking-widest text-muted uppercase">
      {children}
    </h4>
  );
}

function InputRow(props: {
  def: InputDef;
  value: number | undefined;
  onCommit: (path: string, value: number) => void;
  indent?: boolean;
}) {
  const { def, value, onCommit, indent } = props;
  const commit = (raw: string) => {
    const cleaned = raw.replace(/[$,\s]/g, '');
    if (cleaned === '') return;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n === value) return;
    onCommit(def.path, n);
  };
  return (
    <label className={`flex items-center justify-between gap-4 border-b border-rule py-0.5 ${indent ? 'pl-3' : ''}`}>
      <span className={`text-sm ${indent ? 'text-muted' : ''}`}>{def.label}</span>
      <input
        type="text"
        inputMode="decimal"
        className="num w-36 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-rule focus:border-accent focus:bg-paper focus:ring-1 focus:ring-accent focus:outline-none"
        key={String(value)}
        defaultValue={value === undefined ? '' : String(value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function FootedRow(props: { label: string; emphatic?: boolean; children: React.ReactNode }) {
  if (!props.children) return null;
  return (
    <div
      className={`flex items-center justify-between gap-4 py-0.5 ${
        props.emphatic ? 'mt-1 border-t border-accent pt-1 text-sm font-semibold' : 'text-sm'
      }`}
    >
      <span>{props.label}</span>
      {props.children}
    </div>
  );
}

/** Footed paths — locked out of the generic scalar editor by SectionView. */
export function operatingStatementDerivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveOperatingStatement(block.content as Row).fields.map((f) => f.path));
}
