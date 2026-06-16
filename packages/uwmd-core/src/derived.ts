// Shared plumbing for deterministic "footing" of a section's stored totals from
// its line-item inputs. Used by rentroll.ts and opstatement.ts (and any future
// section model). A DerivedField is one footed total: where it is stored, how to
// label/format it, and its computed value.
//
// This is plain arithmetic over inputs — the same deterministic spirit as the
// calc packs, never AI math.

export type DerivedKind = 'currency' | 'count' | 'rate' | 'psf';

export interface DerivedField {
  /** Dot-path inside the block content where this total is stored. */
  path: string;
  label: string;
  kind: DerivedKind;
  value: number;
}

export function roundByKind(value: number, kind: DerivedKind): number {
  if (kind === 'rate') return Math.round(value * 1e4) / 1e4;
  if (kind === 'psf') return Math.round(value * 100) / 100;
  return Math.round(value); // currency, count
}

/** Accumulates DerivedFields, silently dropping any non-finite result so partial
 *  data never writes NaN into the file. */
export function collector() {
  const fields: DerivedField[] = [];
  return {
    fields,
    add(path: string, label: string, kind: DerivedKind, value: number | null) {
      if (value == null || !Number.isFinite(value)) return;
      fields.push({ path, label, kind, value: roundByKind(value, kind) });
    },
  };
}

export const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
