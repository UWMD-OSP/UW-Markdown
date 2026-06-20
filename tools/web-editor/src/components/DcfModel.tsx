// DCF MODEL surface — the last calc-bearing section to become a footed model.
// Inputs (assumptions, per-year NOI / debt service / equity, and the exit gross
// value + loan balance) are the only editable values; the relationships that
// follow unambiguously from them foot live via core's deriveDCF():
//
//   per year:  levered CF = NOI − debt service;  cash-on-cash = levered / equity
//   exit:      disposition = gross × disp%;  net = gross − disposition;
//              proceeds = net − loan balance at exit
//
// IRR / NPV / equity multiple and the exit *gross* value are NOT footed (they
// depend on a cash-flow-timing / forward-NOI convention the block doesn't store),
// so they're shown read-only as engine-provided figures. Same single write path
// as the other models: clone → mutate → re-foot → one section_replace.

import { deriveDCF, type EditOperation, type UWBlock, type UWFieldOverride } from '@uwmd/core/browser';
import { getNumeric } from '../catalog.js';
import { formatDerived } from './Footed.js';
import { FootedRow, GroupHeading, InputRow, SubHeading, useFooting } from './model-kit.js';

type Row = Record<string, unknown>;

const RATE_ASSUMPTIONS: { path: string; label: string }[] = [
  { path: 'assumptions.revenue_growth_rate', label: 'Revenue growth' },
  { path: 'assumptions.expense_growth_rate', label: 'Expense growth' },
  { path: 'assumptions.exit_cap_rate', label: 'Exit cap rate' },
  { path: 'assumptions.disposition_costs_pct', label: 'Disposition costs' },
  { path: 'assumptions.discount_rate', label: 'Discount rate' },
];

const READONLY_RETURNS: { path: string; label: string; kind: 'currency' | 'rate' }[] = [
  { path: 'returns.levered_irr', label: 'Levered IRR', kind: 'rate' },
  { path: 'returns.unlevered_irr', label: 'Unlevered IRR', kind: 'rate' },
  { path: 'returns.equity_multiple', label: 'Equity multiple', kind: 'currency' },
  { path: 'returns.npv', label: 'NPV', kind: 'currency' },
];

export function DcfModel(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { sectionId, variant, block, dispatch } = props;
  const { content, commit, commitInput, footed } = useFooting(
    sectionId,
    variant,
    block,
    dispatch,
    deriveDCF,
  );

  // The current hand-overrides, threaded through structural (add/remove) commits.
  const overrides = ((block.meta?.field_overrides ?? []) as UWFieldOverride[]).filter(
    (o) => o.reason === 'overridden',
  );

  const flows = Array.isArray(content['annual_cash_flows'])
    ? (content['annual_cash_flows'] as Row[])
    : [];

  const addYear = () =>
    commit((c) => {
      const arr = (Array.isArray(c['annual_cash_flows']) ? c['annual_cash_flows'] : []) as Row[];
      const prev = arr[arr.length - 1];
      arr.push({
        year: arr.length + 1,
        net_operating_income: 0,
        annual_debt_service: 0,
        cumulative_equity_invested: prev ? (prev['cumulative_equity_invested'] ?? 0) : 0,
      });
      c['annual_cash_flows'] = arr;
    }, overrides);

  const removeYear = (i: number) =>
    commit((c) => {
      const arr = (c['annual_cash_flows'] as Row[]) ?? [];
      arr.splice(i, 1);
      c['annual_cash_flows'] = arr;
    }, overrides);

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <div>
          <GroupHeading>Assumptions</GroupHeading>
          <InputRow
            def={{ path: 'hold_period_years', label: 'Hold period (years)' }}
            value={getNumeric(content, 'hold_period_years')}
            onCommit={commitInput}
          />
          {RATE_ASSUMPTIONS.map((a) => (
            <InputRow
              key={a.path}
              def={a}
              value={getNumeric(content, a.path)}
              kind="rate"
              onCommit={commitInput}
            />
          ))}
        </div>

        <div>
          <GroupHeading>Exit Waterfall</GroupHeading>
          <InputRow
            def={{ path: 'exit_analysis.exit_value_gross', label: 'Exit value (gross)' }}
            value={getNumeric(content, 'exit_analysis.exit_value_gross')}
            onCommit={commitInput}
          />
          <InputRow
            def={{ path: 'exit_analysis.loan_balance_at_exit', label: 'Loan balance at exit' }}
            value={getNumeric(content, 'exit_analysis.loan_balance_at_exit')}
            onCommit={commitInput}
          />
          <FootedRow label="Disposition costs">{footed('exit_analysis.disposition_costs')}</FootedRow>
          <FootedRow label="Exit value (net of costs)">{footed('exit_analysis.exit_value_net')}</FootedRow>
          <FootedRow label="Net proceeds to equity" emphatic>
            {footed('exit_analysis.net_proceeds_to_equity')}
          </FootedRow>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <GroupHeading>Annual Cash Flows</GroupHeading>
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:underline"
            onClick={addYear}
          >
            + Add year
          </button>
        </div>
        {flows.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            No projection years yet. Add a year, or load a deal whose DCF was generated upstream.
          </p>
        ) : (
          flows.map((_, i) => (
            <div key={i} className="mt-3 border-t border-rule pt-2 first:mt-1 first:border-t-0">
              <div className="flex items-center justify-between">
                <SubHeading>Year {String(getNumeric(content, `annual_cash_flows.${i}.year`) ?? i + 1)}</SubHeading>
                <button
                  type="button"
                  className="text-[0.65rem] text-muted hover:text-error hover:underline"
                  onClick={() => removeYear(i)}
                >
                  remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                <div>
                  <InputRow
                    def={{ path: `annual_cash_flows.${i}.net_operating_income`, label: 'NOI' }}
                    value={getNumeric(content, `annual_cash_flows.${i}.net_operating_income`)}
                    onCommit={commitInput}
                  />
                  <InputRow
                    def={{ path: `annual_cash_flows.${i}.annual_debt_service`, label: 'Debt service' }}
                    value={getNumeric(content, `annual_cash_flows.${i}.annual_debt_service`)}
                    onCommit={commitInput}
                  />
                  <InputRow
                    def={{ path: `annual_cash_flows.${i}.cumulative_equity_invested`, label: 'Equity invested' }}
                    value={getNumeric(content, `annual_cash_flows.${i}.cumulative_equity_invested`)}
                    onCommit={commitInput}
                  />
                </div>
                <div>
                  <FootedRow label="Levered cash flow" emphatic>
                    {footed(`annual_cash_flows.${i}.net_cash_flow_levered`)}
                  </FootedRow>
                  <FootedRow label="Cash-on-cash">
                    {footed(`annual_cash_flows.${i}.cash_on_cash_return`)}
                  </FootedRow>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5">
        <GroupHeading>Returns (engine-provided)</GroupHeading>
        <div className="grid grid-cols-2 gap-x-10 sm:grid-cols-4">
          {READONLY_RETURNS.map((r) => {
            const v = getNumeric(content, r.path);
            return (
              <div key={r.path} className="border-b border-rule py-0.5">
                <div className="text-[0.6rem] tracking-widest text-muted uppercase">{r.label}</div>
                <div className="tabular-nums text-sm">
                  {v === undefined ? '—' : r.kind === 'currency' && r.path.endsWith('equity_multiple')
                    ? `${v.toFixed(2)}×`
                    : formatDerived(v, r.kind)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          IRR, NPV, and equity multiple depend on a cash-flow-timing convention and are not footed
          here — they remain as written by the upstream DCF engine. Everything labelled{' '}
          <span className="text-accent">ƒ derived</span> recomputes on every edit.
        </p>
      </div>
    </div>
  );
}

/** Footed paths — locked out of the generic scalar editor by SectionView. */
export function dcfDerivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveDCF(block.content as Row).fields.map((f) => f.path));
}
