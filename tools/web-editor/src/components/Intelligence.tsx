// Underwriting intelligence panel — the differentiated surface.
//
// Scope: every required/defaulted input for the asset class, resolved through
//   the fallback cascade (resolveValue), showing the value AND where it came
//   from — typed in the file, an asset-class default, or a bare system fallback.
//   This is the "what do we actually know, and how solid is it" view.
//
// Refine: value-of-information ranking (rankGaps) — the missing/defaulted inputs
//   whose uncertainty moves the deal's metrics the most, i.e. what to nail down
//   next. Each row shows the output ranges it widens and a suggested question.
//
// All read-only and recomputed from the live parsed file on every render.

import { useMemo, useState } from 'react';
import {
  resolveValue,
  rankGaps,
  getAssetClassDefaults,
  getPackForAssetClass,
  formatValue,
  formatCurrency,
  formatPercent,
} from '@uwmd/core/browser';
import type { ParsedUWFile, RankedGap, DefaultRange } from '@uwmd/core/browser';

type IntelTab = 'scope' | 'refine';

export function Intelligence({ parsed }: { parsed: ParsedUWFile }) {
  const [tab, setTab] = useState<IntelTab>('scope');
  const assetClass = String((parsed.frontmatter as { asset_class?: string }).asset_class ?? '');
  const defaults = getAssetClassDefaults(assetClass);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-paper px-4 py-2">
        <div className="flex overflow-hidden rounded border border-rule text-xs">
          <Tab active={tab === 'scope'} onClick={() => setTab('scope')}>
            Scope
          </Tab>
          <Tab active={tab === 'refine'} onClick={() => setTab('refine')}>
            Refine (VOI)
          </Tab>
        </div>
        <span className="text-xs text-muted">
          {assetClass || 'unknown'} · cascade resolution + value-of-information ranking
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {!defaults ? (
          <p className="text-sm text-muted">
            No published asset-class default table for “{assetClass || 'unset'}”. Set the asset class
            in Frontmatter to enable scope &amp; refine.
          </p>
        ) : tab === 'scope' ? (
          <ScopeTable parsed={parsed} fields={defaults.fields} version={defaults.version} />
        ) : (
          <RefinePanel parsed={parsed} assetClass={assetClass} />
        )}
      </div>
    </div>
  );
}

// ─── Scope ────────────────────────────────────────────────────────────────────

const IN_FILE_STEPS = new Set(['user_override', 'user_input']);

function ScopeTable(props: {
  parsed: ParsedUWFile;
  fields: Record<string, DefaultRange>;
  version: string;
}) {
  const rows = useMemo(
    () =>
      Object.entries(props.fields).map(([path, range]) => ({
        path,
        range,
        resolved: resolveValue(path, props.parsed),
      })),
    [props.fields, props.parsed],
  );

  const inFile = rows.filter((r) => IN_FILE_STEPS.has(r.resolved.step)).length;
  const defaulted = rows.length - inFile;

  return (
    <div className="max-w-4xl">
      <div className="mb-3 flex items-baseline gap-4">
        <h2 className="font-display text-xl text-accent">Scope</h2>
        <span className="text-xs text-muted">
          defaults v{props.version} · {inFile} in-file · {defaulted} from default/fallback
        </span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-accent text-left text-[0.65rem] tracking-wider text-white uppercase">
            <th className="px-2 py-1.5">Field</th>
            <th className="px-2 py-1.5 text-right">Resolved value</th>
            <th className="px-2 py-1.5">Source</th>
            <th className="px-2 py-1.5">Default range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ path, range, resolved }) => (
            <tr key={path} className="border-b border-rule odd:bg-paper even:bg-canvas">
              <td className="px-2 py-1.5">
                <code className="text-xs">{path}</code>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatResolved(resolved.value, range.unit)}
              </td>
              <td className="px-2 py-1.5">
                <StepBadge step={resolved.step} />
              </td>
              <td className="px-2 py-1.5 text-xs text-muted tabular-nums">
                {formatRange(range)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Every required input resolved through the protocol's fallback cascade. Values shown{' '}
        <StepBadge step="asset_class_default" inline /> or weaker are not in the file — they fall
        back to the published default, which is exactly what Refine ranks by impact.
      </p>
    </div>
  );
}

// ─── Refine ─────────────────────────────────────────────────────────────────

function RefinePanel({ parsed, assetClass }: { parsed: ParsedUWFile; assetClass: string }) {
  const result = useMemo(() => {
    const pack = getPackForAssetClass(assetClass);
    try {
      return rankGaps(parsed, { ...(pack ? { packs: [pack] } : {}), top: 15 });
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) } as const;
    }
  }, [parsed, assetClass]);

  if ('error' in result) {
    return <p className="text-sm text-error">Refinement failed: {result.error}</p>;
  }

  const maxVoi = Math.max(...result.by_voi.map((g) => g.total_voi), 1e-9);

  return (
    <div className="max-w-4xl">
      <div className="mb-3 flex items-baseline gap-4">
        <h2 className="font-display text-xl text-accent">Refine — what to nail down next</h2>
        <span className="text-xs text-muted">
          {result.diagnostics.resolved}/{result.diagnostics.graph_size} inputs resolved ·{' '}
          {result.diagnostics.perturbations} perturbations
        </span>
      </div>

      {result.by_voi.length === 0 ? (
        <p className="text-sm text-muted">
          No value-of-information gaps — every input the calc graph depends on is pinned in the file.
        </p>
      ) : (
        <ol className="space-y-2">
          {result.by_voi.map((gap, i) => (
            <GapRow key={gap.field_path} rank={i + 1} gap={gap} maxVoi={maxVoi} />
          ))}
        </ol>
      )}

      {result.diagnostics.non_monotonic.length > 0 && (
        <p className="mt-4 rounded border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
          Non-monotonic outputs (VOI is approximate for these):{' '}
          {result.diagnostics.non_monotonic.map((n) => n.output_id).join(', ')}
        </p>
      )}
    </div>
  );
}

function GapRow({ rank, gap, maxVoi }: { rank: number; gap: RankedGap; maxVoi: number }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((gap.total_voi / maxVoi) * 100);

  return (
    <li className="rounded border border-rule bg-paper">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas"
      >
        <span className="w-5 text-right text-xs font-bold text-muted">{rank}</span>
        <code className="text-xs">{gap.field_path}</code>
        <div className="ml-auto flex w-40 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-rule">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-10 text-right text-xs tabular-nums text-muted">{gap.total_voi.toFixed(3)}</span>
        </div>
        <span className="text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-rule px-3 py-2 text-xs">
          {gap.question_template && (
            <p className="mb-2 rounded bg-accent-soft px-2 py-1.5 text-accent">
              Ask: “{gap.question_template}”
            </p>
          )}
          <p className="mb-1 text-muted">
            Current: <span className="tabular-nums">{formatValue(gap.current_value.value)}</span> ·
            prior range [{gap.prior_range.low} … {gap.prior_range.central} … {gap.prior_range.high}]
          </p>
          {gap.affected_outputs.length > 0 && (
            <table className="mt-1 w-full border-collapse">
              <thead>
                <tr className="text-left text-[0.6rem] tracking-wider text-muted uppercase">
                  <th className="py-0.5">Affected output</th>
                  <th className="py-0.5 text-right">Range today</th>
                  <th className="py-0.5 text-right">If known</th>
                  <th className="py-0.5 text-right">VOI</th>
                </tr>
              </thead>
              <tbody>
                {gap.affected_outputs.map((o) => (
                  <tr key={o.output_id} className="border-t border-rule/60">
                    <td className="py-0.5">{o.output_id}</td>
                    <td className="py-0.5 text-right tabular-nums">
                      {o.range_today.low.toFixed(3)}–{o.range_today.high.toFixed(3)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">
                      {o.range_if_known.low.toFixed(3)}–{o.range_if_known.high.toFixed(3)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{o.voi.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatResolved(value: unknown, unit: DefaultRange['unit']): string {
  if (typeof value !== 'number') return formatValue(value);
  if (unit === 'percent') return formatPercent(value);
  if (unit === 'currency') return formatCurrency(value);
  if (unit === 'ratio') return `${value.toFixed(3)}x`;
  return formatValue(value);
}

function formatRange(range: DefaultRange): string {
  const f = (n: number) =>
    range.unit === 'percent' ? formatPercent(n) : range.unit === 'currency' ? formatCurrency(n) : String(n);
  return `${f(range.low)} – ${f(range.central)} – ${f(range.high)}`;
}

const STEP_LABEL: Record<string, { label: string; tone: string }> = {
  user_override: { label: 'override', tone: 'bg-ok/15 text-ok' },
  user_input: { label: 'in file', tone: 'bg-ok/15 text-ok' },
  investor_profile: { label: 'investor profile', tone: 'bg-accent-soft text-accent' },
  market_data: { label: 'market data', tone: 'bg-accent-soft text-accent' },
  asset_class_default: { label: 'class default', tone: 'bg-warn/15 text-warn' },
  global_default: { label: 'global default', tone: 'bg-warn/15 text-warn' },
  system_default: { label: 'fallback', tone: 'bg-error/15 text-error' },
};

function StepBadge({ step, inline }: { step: string; inline?: boolean }) {
  const s = STEP_LABEL[step] ?? { label: step, tone: 'bg-rule text-muted' };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${s.tone} ${inline ? 'align-middle' : ''}`}
    >
      {s.label}
    </span>
  );
}

function Tab(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`px-3 py-1 transition-colors ${
        props.active ? 'bg-accent font-semibold text-white' : 'bg-paper text-ink hover:bg-canvas'
      }`}
    >
      {props.children}
    </button>
  );
}
