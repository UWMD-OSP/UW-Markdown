// Sources & Uses MODEL surface — every source and use line item is an input; the
// per-bucket totals, the nested closing-costs total, and the top-level
// project-cost mirrors foot from them via core's deriveSourcesUses(). A capital
// stack must balance, so the surface shows a live sources-vs-uses balance check
// and the gap (e.g. a missing equity plug) without ever silently writing it.

import { deriveSourcesUses, type EditOperation, type UWBlock } from '@uwmd/core/browser';
import { getNumeric, deepGet } from '../catalog.js';
import { FootedRow, GroupHeading, InputRow, SubHeading, useFooting, type InputDef } from './model-kit.js';

type Row = Record<string, unknown>;

const isObj = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);

function prettify(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Editable scalar leaves of a bucket: every numeric-or-null key except `total`
 *  and except nested objects (which are footed/expanded separately). */
function scalarInputs(content: Row, parentPath: string): InputDef[] {
  const obj = deepGet(content, parentPath);
  if (!isObj(obj)) return [];
  return Object.entries(obj)
    .filter(([k, v]) => k !== 'total' && !isObj(v))
    .map(([k]) => ({ path: `${parentPath}.${k}`, label: prettify(k) }));
}

export function SourcesUsesModel(props: {
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
    deriveSourcesUses,
  );
  const { gap, balanced } = deriveSourcesUses(content);

  const hasStack = isObj(deepGet(content, 'sources')) || isObj(deepGet(content, 'uses'));
  if (!hasStack) {
    return (
      <p className="px-4 py-4 text-sm text-muted">
        This block has no <code>sources</code> / <code>uses</code> buckets to foot.
      </p>
    );
  }

  const sourceInputs = scalarInputs(content, 'sources');
  const useInputs = scalarInputs(content, 'uses');
  const closingInputs = scalarInputs(content, 'uses.closing_costs');

  return (
    <div className="px-4 py-4">
      <BalanceBanner gap={gap} balanced={balanced} />

      <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        <div>
          <GroupHeading>Sources</GroupHeading>
          {sourceInputs.map((d) => (
            <InputRow key={d.path} def={d} value={getNumeric(content, d.path)} onCommit={commitInput} />
          ))}
          <FootedRow label="Total Sources" emphatic>
            {footed('sources.total') ?? footed('total_sources')}
          </FootedRow>
        </div>

        <div>
          <GroupHeading>Uses</GroupHeading>
          {useInputs.map((d) => (
            <InputRow key={d.path} def={d} value={getNumeric(content, d.path)} onCommit={commitInput} />
          ))}

          {closingInputs.length > 0 && (
            <>
              <SubHeading>Closing Costs</SubHeading>
              {closingInputs.map((d) => (
                <InputRow
                  key={d.path}
                  def={d}
                  value={getNumeric(content, d.path)}
                  onCommit={commitInput}
                  indent
                />
              ))}
              <FootedRow label="Closing Costs (total)" indent>
                {footed('uses.closing_costs.total')}
              </FootedRow>
            </>
          )}

          <FootedRow label="Total Uses" emphatic>
            {footed('uses.total') ?? footed('total_uses') ?? footed('total_project_cost')}
          </FootedRow>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Bucket totals and the project-cost mirror foot from the line items above and recompute on
        every edit. Override pins a value by hand (<code>_meta.field_overrides</code>); revert
        returns it to the formula.
      </p>
    </div>
  );
}

function BalanceBanner({ gap, balanced }: { gap: number; balanced: boolean }) {
  if (balanced) {
    return (
      <div className="mb-3 rounded border border-ok/40 bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok">
        ✓ Capital stack balances — sources equal uses.
      </div>
    );
  }
  const fmt = `$${Math.abs(gap).toLocaleString('en-US')}`;
  return (
    <div className="mb-3 rounded border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs font-semibold text-warn">
      ⚠ Out of balance by {fmt} — {gap > 0 ? 'sources exceed uses' : 'uses exceed sources'}.
    </div>
  );
}

/** Footed paths — locked out of the generic scalar editor by SectionView. */
export function sourcesUsesDerivedPaths(block: UWBlock): Set<string> {
  return new Set(deriveSourcesUses(block.content as Row).fields.map((f) => f.path));
}
