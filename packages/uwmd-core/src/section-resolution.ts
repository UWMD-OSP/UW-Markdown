// Section selection for section-rooted reads — Protocol §VIII.2 (RFC 0066).
//
// One block per read, chosen the way §VIII.2a's "Section context" already
// chooses for period references: the caller's exact variant, then the role the
// consuming calculation declares, then RFC 0040's generic order, otherwise a
// refusal. A missing section stays null; an ambiguous one never does. The calc
// evaluator, the cascade, refinement and the Excel converter all select through
// here, so none of them can pick by fence order, amount or label.

import { hasBlockRole, isBlockRole, resolveRoleBlock } from './block-roles.js';
import { CalcError } from './calc/errors.js';
import { getPathSegment } from './parser.js';
import type { BlockRole, ParsedUWFile, UWBlock } from './types.js';

export interface SectionSelectionOptions {
  /** Exact variant per section id, with no fallback (§VIII.2a). */
  sectionVariants?: Readonly<Record<string, string>>;
  /** Role preference per section id, as a calculation declares it (`section_roles`). */
  sectionRoles?: Readonly<Record<string, BlockRole>>;
}

type SectionEntry = UWBlock | Record<string, UWBlock>;

function isStandalone(entry: SectionEntry): entry is UWBlock {
  return 'annotation' in entry;
}

/**
 * The block an explicit `sectionVariants` entry names, or null when no such
 * variant is present or it carries an invalid role. A standalone block matches
 * only its own variant key. An explicitly named component is allowed.
 */
export function explicitVariantBlock(entry: SectionEntry, variant: string): UWBlock | null {
  const block = isStandalone(entry)
    ? (entry.annotation.variant === variant ? entry : null)
    : (getPathSegment(entry, variant) as UWBlock | undefined) ?? null;
  if (!block || (hasBlockRole(block) && !isBlockRole(block.content['_role']))) return null;
  return block;
}

function variantKeys(entry: SectionEntry): string {
  return isStandalone(entry)
    ? (entry.annotation.variant ?? '(unkeyed)')
    : Object.keys(entry).sort().join(', ');
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * Select the one block an ordinary identifier reads from `sections.<section>`.
 *
 * Returns null for a missing section. A standalone block is returned as stated
 * unless an explicit variant names another one. A variant map resolves by the
 * declared role, then RFC 0040's primary/default/base/sole order, over blocks
 * that are not components and carry no invalid role. Anything else refuses
 * with `CALC-RESOLVE-002`, naming the section and the variants found.
 */
export function resolveSectionBlock(
  parsed: ParsedUWFile,
  section: string,
  options: SectionSelectionOptions = {},
): UWBlock | null {
  const entry = getPathSegment(parsed.sections, section) as SectionEntry | undefined;
  if (!entry) return null;
  const variant = own(options.sectionVariants, section);
  if (variant !== undefined) {
    const block = explicitVariantBlock(entry, variant);
    if (!block) {
      throw new CalcError(
        'CALC-RESOLVE-002',
        `Cannot select ${section} variant=${variant}; variants found: ${variantKeys(entry)}.`,
      );
    }
    return block;
  }
  if (isStandalone(entry)) return entry;
  const resolved = resolveRoleBlock(entry, section, [], undefined, own(options.sectionRoles, section));
  if (resolved.state === 'resolved') return resolved.block;
  if (resolved.state === 'absent') return null;
  throw new CalcError(
    'CALC-RESOLVE-002',
    `Cannot select ${section}: ${resolved.detail ?? 'no unique primary, default, base or sole variant'}; variants found: ${resolved.variants.join(', ')}.`,
  );
}

