// Valuation MODEL surface — when the block carries an income_approach, the
// indicated value (NOI / cap rate) and its delta to purchase price foot from the
// block's own inputs via core's deriveValuation(). The NOI to capitalize is the
// underwriter's stored choice (income_approach.noi_used), not pulled from another
// section, so the footing is fully self-contained.

import { deriveValuation, type EditOperation, type UWBlock } from '@uwmd/core/browser';
import { getNumeric, deepGet } from '../catalog.js';
import { FootedRow, GroupHeading, InputRow, useFooting } from './model-kit.js';

type Row = Record<string, unknown>;

export function ValuationModel(props: {
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
    deriveValuation,
  );

  const hasIncomeApproach =
    deepGet(content, 'income_approach') !== null &&
    typeof deepGet(content, 'income_approach') === 'object';

  if (!hasIncomeApproach) {
    return (
      <p className="px-4 py-4 text-sm text-muted">
        This valuation block has no <code>income_approach</code>. The income-approach value foots
        from <code>NOI / cap rate</code> only when that sub-block is present; other fields are edited
        below.
      </p>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <div>
          <GroupHeading>Income Approach — Inputs</GroupHeading>
          <InputRow
            def={{ path: 'income_approach.noi_used', label: 'NOI to capitalize' }}
            value={getNumeric(content, 'income_approach.noi_used')}
            onCommit={commitInput}
          />
          <InputRow
            def={{ path: 'income_approach.cap_rate_applied', label: 'Cap rate applied' }}
            value={getNumeric(content, 'income_approach.cap_rate_applied')}
            kind="rate"
            onCommit={commitInput}
          />
          <InputRow
            def={{ path: 'purchase_price', label: 'Purchase price' }}
            value={getNumeric(content, 'purchase_price')}
            onCommit={commitInput}
          />
        </div>

        <div>
          <GroupHeading>Indicated Value</GroupHeading>
          <FootedRow label="Indicated Value (income approach)" emphatic>
            {footed('income_approach.indicated_value')}
          </FootedRow>
          <FootedRow label="UW Value vs. Purchase Price">
            {footed('uw_value_vs_purchase_price_pct')}
          </FootedRow>
          <p className="mt-3 text-xs text-muted">
            Indicated value foots from <code>NOI / cap rate</code> and recomputes on every edit.
            Override pins a value by hand (<code>_meta.field_overrides</code>); revert returns it to
            the formula.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Footed paths — locked out of the generic scalar editor by SectionView. */
export function valuationDerivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveValuation(block.content as Row).fields.map((f) => f.path));
}
