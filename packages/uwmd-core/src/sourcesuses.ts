import { hasBlockShape } from './block-kind.js';
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

import { blockPayload, type ParsedUWFile, type UWBlock } from '@uwmd/verify';
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

/** The use a typed `uses.renovation` contributes: its `budget` plus its
 *  `contingency` (RFC 0081 §7, Format §4.8). The draw group and
 *  `contingency_remaining` are as-of facts about how much of that amount has
 *  been disbursed (RFC 0057, `CAPX-02`–`CAPX-04`), not further uses.
 *  `expense_targeted`, an array, never entered the sum and still does not. */
function renovationUse(renovation: Row): number {
  return (num(renovation['budget']) ?? 0) + (num(renovation['contingency']) ?? 0);
}

/**
 * Foot a sources_uses content block. Pure: never mutates `content` or `parsed`.
 *
 * `parsed` is the document the block belongs to and is required: the uses
 * total includes each stated `rate_hedge.premium` from its `debt_structure`
 * (RFC 0081 §7), so a footing without the document would understate it.
 */
export function deriveSourcesUses(content: Row, parsed: ParsedUWFile): SourcesUsesDerivation {
  const c = collector();
  const sources = isObj(content['sources']) ? content['sources'] : {};
  const uses = isObj(content['uses']) ? content['uses'] : {};

  // Nested closing-costs sub-rollup (only when it is an itemized object).
  const closing = uses['closing_costs'];
  if (isObj(closing)) {
    c.add('uses.closing_costs.total', 'Closing Costs (total)', 'currency', sumLines(closing));
  }

  const sourcesTotal = sumLines(sources);
  const renovation = uses['renovation'];
  let usesTotal = isObj(renovation)
    ? sumLines({ ...uses, renovation: null }) + renovationUse(renovation)
    : sumLines(uses);
  // Footing rule (RFC 0081 §7): interest and operating escrows' upfront and
  // each stated hedge premium count once in the uses total.
  if (isObj(content['uses'])) {
    if (Array.isArray(uses['escrows'])) for (const escrow of uses['escrows']) {
      if (isObj(escrow) && ['interest', 'operating'].includes(String(escrow['name']))) usesTotal += num(escrow['upfront']) ?? 0;
    }
    const debt = parsed.sections.debt_structure;
    const blocks = !debt ? [] : hasBlockShape(debt) ? [debt as UWBlock] : Object.values(debt as Record<string, UWBlock>);
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
