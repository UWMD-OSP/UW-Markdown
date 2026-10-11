// Deterministic sources-&-uses footing — the individual source and use line
// items are the inputs; the sources total, uses total, nested closing-costs
// total, and the top-level project-cost mirrors foot from them. One source of
// truth so the editor, CLI, and Excel converter never disagree (invariant #4);
// plain arithmetic over line items, not AI math (invariant #1).
//
// A capital stack must balance: total sources == total uses. deriveSourcesUses
// reports `balanced` and the gap so the editor can surface an imbalance (e.g. a
// missing equity plug) without silently writing a value.
//
// Field-name tolerance: deals use both a flat top-level mirror (`total_sources`/
// `total_uses`, office worked example) and a single `total_project_cost`
// (multifamily worked example), plus per-bucket `sources.total` / `uses.total`.
// Whichever total keys already exist in the block are written back.

import { blockPayload } from './parser.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { collector, numOrNull, type DerivedField } from './derived.js';

type Row = Record<string, unknown>;

const num = numOrNull;
const isObj = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);

export interface SourcesUsesDerivation {
  fields: DerivedField[];
  sourcesTotal: number;
  usesTotal: number;
  /** sourcesTotal − usesTotal, rounded. Zero (±$1) when the stack balances. */
  gap: number;
  balanced: boolean;
}

/** Sum the "line items" of a bucket: every numeric leaf plus the footed sum of
 *  any nested object (e.g. uses.closing_costs), always skipping `total` keys. */
function sumLines(obj: Row): number {
  let total = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'total') continue;
    if (isObj(v)) total += sumLines(v);
    else total += num(v) ?? 0;
  }
  return total;
}

/** Foot a sources_uses content block. Pure: never mutates `content`. */
export function deriveSourcesUses(content: Row, parsed?: ParsedUWFile): SourcesUsesDerivation {
  const c = collector();
  const sources = isObj(content['sources']) ? content['sources'] : {};
  const uses = isObj(content['uses']) ? content['uses'] : {};

  // Nested closing-costs sub-rollup (only when it is an itemized object).
  const closing = uses['closing_costs'];
  if (isObj(closing)) {
    c.add('uses.closing_costs.total', 'Closing Costs (total)', 'currency', sumLines(closing));
  }

  const sourcesTotal = sumLines(sources);
  let usesTotal = sumLines(uses);
  // RFC 0081 Phase 4: delete the old-format footing branch.
  if (isObj(content['uses']) && (!parsed || parsed.frontmatter.uw_version === '3.0')) {
    if (Array.isArray(uses['escrows'])) for (const escrow of uses['escrows']) {
      if (isObj(escrow) && ['interest', 'operating'].includes(String(escrow['name']))) usesTotal += num(escrow['upfront']) ?? 0;
    }
    const debt = parsed?.sections.debt_structure;
    const blocks = !debt ? [] : 'annotation' in debt ? [debt as UWBlock] : Object.values(debt as Record<string, UWBlock>);
    for (const block of blocks) {
      const hedge = (blockPayload(block) as Row)['rate_hedge'];
      if (isObj(hedge)) usesTotal += num(hedge['premium']) ?? 0;
    }
  }

  if (Object.keys(sources).length > 0) {
    c.add('sources.total', 'Total Sources', 'currency', sourcesTotal);
  }
  if (Object.keys(uses).length > 0) {
    c.add('uses.total', 'Total Uses', 'currency', usesTotal);
  }

  // Top-level mirrors — write back only the keys the block already carries.
  if ('total_sources' in content) {
    c.add('total_sources', 'Total Sources', 'currency', sourcesTotal);
  }
  if ('total_uses' in content) {
    c.add('total_uses', 'Total Uses', 'currency', usesTotal);
  }
  if ('total_project_cost' in content) {
    c.add('total_project_cost', 'Total Project Cost', 'currency', usesTotal);
  }

  const gap = Math.round(sourcesTotal - usesTotal);
  return { fields: c.fields, sourcesTotal, usesTotal, gap, balanced: Math.abs(gap) <= 1 };
}
