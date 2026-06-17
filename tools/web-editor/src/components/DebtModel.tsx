// Debt-structure MODEL surface — the loan terms (amount, rate, amortization, IO)
// are the inputs; monthly and annual debt service foot from them via core's
// deriveDebt() (the same mortgage-payment math as the calc engine's pmt builtin)
// and render as locked, live-recomputing cells. Editing a term re-foots debt
// service immediately, which the metric strip (DSCR, debt yield) reacts to.

import { deriveDebt, type EditOperation, type UWBlock } from '@uwmd/core/browser';
import { getNumeric } from '../catalog.js';
import { FootedRow, GroupHeading, InputRow, useFooting, type InputDef } from './model-kit.js';

type Row = Record<string, unknown>;

const RATE_KEYS = [
  'interest_rate',
  'all_in_rate_at_close',
  'note_rate_at_close',
  'interest_rate_at_close',
];

const TERM_INPUTS: InputDef[] = [
  { path: 'amortization_years', label: 'Amortization (years)' },
  { path: 'loan_term_years', label: 'Loan term (years)' },
  { path: 'io_period_months', label: 'Interest-only period (months)' },
];

/** The rate key actually present on the block (defaults to interest_rate). */
function rateKey(content: Row): string {
  for (const k of RATE_KEYS) if (getNumeric(content, k) !== undefined) return k;
  return 'interest_rate';
}

export function DebtModel(props: {
  sectionId: string;
  variant: string | undefined;
  block: UWBlock;
  dispatch: (op: EditOperation) => void;
}) {
  const { sectionId, variant, block, dispatch } = props;
  const { content, commitInput, footed } = useFooting(
    sectionId,
    variant,
    block,
    dispatch,
    deriveDebt,
  );
  const interestOnly = deriveDebt(content).interestOnly;
  const rk = rateKey(content);

  const present = (defs: InputDef[]) =>
    defs.filter((d) => getNumeric(content, d.path) !== undefined);

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <div>
          <GroupHeading>Loan Terms</GroupHeading>
          <InputRow
            def={{ path: 'loan_amount', label: 'Loan amount' }}
            value={getNumeric(content, 'loan_amount')}
            onCommit={commitInput}
          />
          <InputRow
            def={{ path: rk, label: 'Interest rate' }}
            value={getNumeric(content, rk)}
            kind="rate"
            onCommit={commitInput}
          />
          {present(TERM_INPUTS).map((d) => (
            <InputRow
              key={d.path}
              def={d}
              value={getNumeric(content, d.path)}
              onCommit={commitInput}
            />
          ))}
        </div>

        <div>
          <GroupHeading>Debt Service</GroupHeading>
          <FootedRow label="Monthly Debt Service">{footed('monthly_debt_service')}</FootedRow>
          <FootedRow label="Annual Debt Service" emphatic>
            {footed('annual_debt_service')}
          </FootedRow>
          <p className="mt-3 text-xs text-muted">
            {interestOnly ? (
              <>
                Interest-only: annual debt service is <code>loan × rate</code>.
              </>
            ) : (
              <>
                Fully-amortizing payment from the loan amount, rate, and amortization term (the
                figure DSCR and debt yield are sized against). It foots even when the loan carries an
                initial IO period.
              </>
            )}{' '}
            Override pins a value by hand (<code>_meta.field_overrides</code>); revert returns it to
            the formula.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Footed paths — locked out of the generic scalar editor by SectionView. */
export function debtDerivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveDebt(block.content as Row).fields.map((f) => f.path));
}
