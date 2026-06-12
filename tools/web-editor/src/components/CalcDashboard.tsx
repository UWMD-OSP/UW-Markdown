// Pinned metric strip — re-evaluates every calc in the asset class's pack
// against the current parsed file on every render (i.e. after every edit).
// That's the calc-integrity contract: derived values cannot lag behind inputs
// because there is no caching layer between the file and these cards.

import { evaluateCalc, getPackForAssetClass } from '@uwmd/core/browser';
import type { ParsedUWFile } from '@uwmd/core/browser';

export function CalcDashboard({ parsed }: { parsed: ParsedUWFile }) {
  const assetClass = (parsed.frontmatter as { asset_class?: string }).asset_class ?? '';
  const pack = getPackForAssetClass(assetClass);
  const calcs = pack?.calculations ?? [];
  if (calcs.length === 0) return null;

  const ctx = {
    parsed,
    prior_results: {} as Readonly<Record<string, number | string | boolean | null>>,
    locale: 'en-US' as const,
  };

  return (
    <div className="flex gap-px overflow-x-auto border-b border-rule bg-rule">
      {calcs.map((decl) => {
        const result = evaluateCalc(decl, ctx);
        const ok = result.ok && result.value !== null && result.value !== undefined;
        const display = ok ? (result.display ?? String(result.value)) : '—';
        const errTitle = !ok && result.error ? `${result.error.code}: ${result.error.message}` : undefined;
        return (
          <div
            key={decl.id ?? decl.label}
            title={errTitle}
            className={`min-w-28 flex-1 bg-paper px-3 py-2 ${ok ? '' : 'opacity-50'}`}
          >
            <div className="truncate text-[0.62rem] font-semibold tracking-wider text-muted uppercase">
              {decl.label}
            </div>
            <div className="text-base font-semibold text-accent tabular-nums">{display}</div>
          </div>
        );
      })}
    </div>
  );
}
