// Composable UWX documents (RFC 0021) — fragments and section externalization.
//
// One invariant carries the whole design:
//
//   I-1 (Digest invariance). A record with externalized parts, resolved, has
//   the same semantic digest as the byte-identical inline record in which every
//   part has been substituted in place.
//
// Composition is therefore a *packaging* decision, not a modelling one:
// externalizing a section does not change what the record means, does not
// invalidate a receipt over the resolved form, and is not a Tier-2 edit.
//
// Everything here exists to make I-1 hold, and two things about it are less
// obvious than the RFC's statement of the rule suggests:
//
//   1. The semantic value includes the block's `annotation` and `prose`, not
//      just its content (see `toEnvelopeBlock` in `envelope.ts`). A resolved
//      block that kept `external=true` in its fence annotation would digest
//      differently from its inline twin and I-1 would fail on every fixture.
//      Resolution therefore normalizes the annotation.
//   2. Merge order cannot come from `parts` order or archive order, or the same
//      forty rows would canonicalize two ways. Rows are sorted by the declared
//      collection key under a byte-wise total order.
//
// Browser-safe: no I/O. Resolution reads parts a caller has already supplied,
// and never performs network or filesystem access — a reference pointing
// outside the package is unresolvable, not fetched.

import { isStandardSectionId, type ProtocolError } from './protocol.js';
import type { ParsedUWFile, UWBlock, UWFenceAnnotation } from './types.js';

// ─── Representation ──────────────────────────────────────────────────────────

export const UWPART_EXTENSION = '.uwpart.md' as const;
export const UWPART_MEDIA_TYPE = 'text/vnd.uwmd.part+markdown' as const;
export const UWPART_REPRESENTATION_ID = 'uwx-part-markdown' as const;
export const UWPART_VERSION = '1.0' as const;

/**
 * The annotation key marking a section block as externalized. Stripped during
 * resolution — see the note on I-1 above.
 */
export const EXTERNAL_ANNOTATION_KEY = 'external' as const;

// ─── Errors ──────────────────────────────────────────────────────────────────

export type CompositionErrorCode =
  | 'COMP-DUP-KEY'
  | 'COMP-UNRESOLVED'
  | 'COMP-COUNT-MISMATCH'
  | 'COMP-CYCLE'
  | 'COMP-DEPTH'
  | 'COMP-SECTION-MISMATCH'
  | 'COMP-AMBIGUOUS-INHERIT'
  | 'COMP-ROLLUP-DISAGREES'
  | 'COMP-PART-MALFORMED'
  | 'COMP-DIRECTIVE-MALFORMED';

export class CompositionError extends Error {
  readonly code: CompositionErrorCode;
  constructor(code: CompositionErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'CompositionError';
    this.code = code;
  }
}

function compError(code: CompositionErrorCode, message: string, pointer?: string): ProtocolError {
  return { category: 'validate', code, message, ...(pointer ? { pointer } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

// ─── Fragments ───────────────────────────────────────────────────────────────

export interface UWPart {
  part_id: string;
  /** The single section every block in this fragment targets. */
  section: string;
  /** True when this fragment is one row of a collection section. */
  collection_member: boolean;
  blocks: UWBlock[];
}

export interface ParseUWPartOptions {
  filename?: string;
}

/**
 * Read a fragment from an already-parsed file.
 *
 * A fragment must parse standalone — that is a hard requirement, not a nicety.
 * A fragment only understandable in the context of its parent is not
 * independently reviewable and cannot be usefully content-addressed.
 */
export function parseUWPart(parsed: ParsedUWFile, opts: ParseUWPartOptions = {}): UWPart {
  const fm = parsed.frontmatter as Record<string, unknown>;
  const where = opts.filename ? ` (${opts.filename})` : '';

  if (!nonEmptyString(fm['uwpart_version'])) {
    throw new CompositionError('COMP-PART-MALFORMED', `Fragment requires uwpart_version${where}.`);
  }
  if (!nonEmptyString(fm['part_id'])) {
    throw new CompositionError('COMP-PART-MALFORMED', `Fragment requires part_id${where}.`);
  }
  if (!nonEmptyString(fm['section'])) {
    throw new CompositionError('COMP-PART-MALFORMED', `Fragment requires section${where}.`);
  }
  // A fragment is not an underwriting record and must never be presented as
  // one; carrying a deal_id is the cheapest way for that to happen.
  if ('deal_id' in fm) {
    throw new CompositionError(
      'COMP-PART-MALFORMED',
      `A fragment MUST NOT carry deal_id${where} — it is not an underwriting record.`,
    );
  }

  const section = fm['section'] as string;
  if (!isStandardSectionId(section) && !section.startsWith('x_')) {
    throw new CompositionError(
      'COMP-PART-MALFORMED',
      `Fragment declares section '${section}', which the format does not register${where}.`,
    );
  }

  const blocks: UWBlock[] = [];
  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const found = isRecord(entry) && 'annotation' in entry
      ? [entry as unknown as UWBlock]
      : Object.values(entry as Record<string, UWBlock>);
    // A fragment must not contribute to two sections — that is what two
    // fragments are for.
    if (sectionId !== section) {
      throw new CompositionError(
        'COMP-SECTION-MISMATCH',
        `Fragment '${fm['part_id'] as string}' declares section '${section}' but carries a block for '${sectionId}'${where}.`,
      );
    }
    blocks.push(...found);
  }

  if (blocks.length === 0) {
    throw new CompositionError(
      'COMP-PART-MALFORMED',
      `Fragment '${fm['part_id'] as string}' carries no block for section '${section}'${where}.`,
    );
  }

  return {
    part_id: fm['part_id'] as string,
    section,
    collection_member: fm['collection_member'] === true,
    blocks,
  };
}

// ─── Externalization directive ───────────────────────────────────────────────

export interface ExternalSectionDirective {
  parts: string[];
  /** Field uniquely identifying a row. Required for collection sections. */
  collection_key?: string;
  /**
   * Where merged rows land in the section's content, e.g. `units` for
   * `rent_roll`.
   *
   * **Not in RFC 0021 as accepted** — recorded as erratum. The RFC declares
   * `collection_key` (which field identifies a row) but never says which field
   * the rows themselves occupy, and I-1 cannot hold without knowing: the
   * resolved content has to equal the inline content exactly. The alternative
   * was a section→collection-field table in the library, which is precisely the
   * hand-maintained mirror that has already drifted three ways for section ids.
   * Declaring it in the directive keeps the answer in the document.
   */
  collection_path?: string;
  part_count: number;
}

export function validateExternalDirective(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(candidate)) {
    return [compError('COMP-DIRECTIVE-MALFORMED', 'external must be an object.')];
  }
  const d = candidate as Partial<ExternalSectionDirective> & Record<string, unknown>;

  if (!Array.isArray(d.parts) || d.parts.some((p) => !nonEmptyString(p))) {
    errors.push(compError('COMP-DIRECTIVE-MALFORMED', 'external.parts must be an array of part ids.', 'external.parts'));
  } else if (d.parts.length === 0) {
    errors.push(compError('COMP-DIRECTIVE-MALFORMED', 'external.parts must not be empty.', 'external.parts'));
  } else {
    const seen = new Set<string>();
    for (const p of d.parts) {
      if (seen.has(p)) {
        errors.push(compError('COMP-DUP-KEY', `external.parts names '${p}' more than once.`, 'external.parts'));
      }
      seen.add(p);
    }
  }

  // Redundant on purpose. A truncated `parts` array is then a detectable error
  // rather than a silently smaller rent roll — which still totals, still
  // validates, and still produces a confident DSCR.
  if (typeof d.part_count !== 'number' || !Number.isInteger(d.part_count)) {
    errors.push(compError('COMP-DIRECTIVE-MALFORMED', 'external.part_count must be an integer.', 'external.part_count'));
  } else if (Array.isArray(d.parts) && d.part_count !== d.parts.length) {
    errors.push(compError(
      'COMP-COUNT-MISMATCH',
      `external.part_count is ${d.part_count} but parts lists ${d.parts.length}.`,
      'external.part_count',
    ));
  }

  if (d.collection_key !== undefined && !nonEmptyString(d.collection_key)) {
    errors.push(compError('COMP-DIRECTIVE-MALFORMED', 'external.collection_key must be a non-empty string.', 'external.collection_key'));
  }
  if (d.collection_path !== undefined && !nonEmptyString(d.collection_path)) {
    errors.push(compError('COMP-DIRECTIVE-MALFORMED', 'external.collection_path must be a non-empty string.', 'external.collection_path'));
  }

  return errors;
}

/** Read the directive off a section block, or null when the section is inline. */
export function readExternalDirective(block: UWBlock): ExternalSectionDirective | null {
  const external = (block.content as Record<string, unknown>)['external'];
  if (external === undefined) return null;
  const errors = validateExternalDirective(external);
  if (errors.length > 0) {
    throw new CompositionError(
      errors[0]!.code as CompositionErrorCode,
      errors.map((e) => e.message).join('; '),
    );
  }
  return external as ExternalSectionDirective;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export type CompositionStatus = 'resolved' | 'unresolved';

export interface CompositionResolution {
  /**
   * `unresolved` when any part is missing. Deliberately not a partial success:
   * silent under-resolution is the most dangerous failure mode in this design.
   */
  status: CompositionStatus;
  document: ParsedUWFile;
  issues: ProtocolError[];
  /** Sections that were externalized, in declaration order. */
  externalized: string[];
}

export interface ResolveCompositionOptions {
  /** Fragments available, keyed by `part_id`. Resolution never fetches. */
  parts: ReadonlyMap<string, UWPart>;
}

/**
 * Byte-wise total order on the UTF-8 key. `localeCompare` would be
 * locale-dependent and so would make the canonical form — and therefore the
 * digest — vary by machine, which is exactly what I-1 forbids.
 */
function byteCompare(a: string, b: string): number {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  return left.length - right.length;
}

/**
 * Strip the externalization marker from a fence annotation, so a resolved block
 * carries the annotation its inline equivalent would. Without this I-1 fails:
 * the envelope's semantic value includes `annotation`, not only `content`.
 */
function inlineAnnotation(annotation: UWFenceAnnotation): UWFenceAnnotation {
  const { [EXTERNAL_ANNOTATION_KEY]: _external, ...rest } = annotation as Record<string, unknown>;
  return rest as UWFenceAnnotation;
}

function sectionBlocks(entry: unknown): UWBlock[] {
  return isRecord(entry) && 'annotation' in entry
    ? [entry as unknown as UWBlock]
    : Object.values(entry as Record<string, UWBlock>);
}

/**
 * Resolve every externalized section into its inline equivalent.
 *
 * Returns `unresolved` rather than throwing when a part is missing, because a
 * record referencing a fragment the caller does not hold is *undecidable*, not
 * wrong — the same distinction the receipt verifier draws with `unverifiable`.
 * A missing part never yields a smaller collection.
 */
export function resolveComposition(
  parsed: ParsedUWFile,
  opts: ResolveCompositionOptions,
): CompositionResolution {
  const issues: ProtocolError[] = [];
  const externalized: string[] = [];
  const sections: Record<string, unknown> = { ...parsed.sections };

  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const blocks = sectionBlocks(entry);
    if (blocks.length !== 1) continue;
    const block = blocks[0]!;

    let directive: ExternalSectionDirective | null;
    try {
      directive = readExternalDirective(block);
    } catch (e) {
      issues.push(compError(
        (e as CompositionError).code,
        (e as CompositionError).message,
        sectionId,
      ));
      continue;
    }
    if (!directive) continue;
    externalized.push(sectionId);

    const resolvedParts: UWPart[] = [];
    let missing = false;
    for (const partId of directive.parts) {
      const part = opts.parts.get(partId);
      if (!part) {
        issues.push(compError('COMP-UNRESOLVED', `Part '${partId}' does not resolve within this package.`, `${sectionId}.external.parts`));
        missing = true;
        continue;
      }
      if (part.section !== sectionId) {
        issues.push(compError(
          'COMP-SECTION-MISMATCH',
          `Part '${partId}' declares section '${part.section}' but is referenced from '${sectionId}'.`,
          `${sectionId}.external.parts`,
        ));
        missing = true;
        continue;
      }
      resolvedParts.push(part);
    }
    if (missing) continue;

    const collectionParts = resolvedParts.filter((p) => p.collection_member);
    const wholeParts = resolvedParts.filter((p) => !p.collection_member);

    if (collectionParts.length > 0 && wholeParts.length > 0) {
      issues.push(compError(
        'COMP-DIRECTIVE-MALFORMED',
        `Section '${sectionId}' mixes collection-member fragments with whole-section fragments.`,
        sectionId,
      ));
      continue;
    }

    // Whole-section: exactly one fragment supplies the section.
    if (wholeParts.length > 0) {
      if (wholeParts.length !== 1) {
        issues.push(compError(
          'COMP-DIRECTIVE-MALFORMED',
          `Section '${sectionId}' names ${wholeParts.length} whole-section fragments; exactly one supplies a section.`,
          sectionId,
        ));
        continue;
      }
      const source = wholeParts[0]!.blocks[0]!;
      sections[sectionId] = {
        ...block,
        annotation: inlineAnnotation(block.annotation),
        content: source.content,
      } satisfies UWBlock;
      continue;
    }

    // Collection: merge rows, keyed and totally ordered.
    if (!directive.collection_key) {
      issues.push(compError('COMP-DIRECTIVE-MALFORMED', `Section '${sectionId}' composes collection fragments but declares no collection_key.`, `${sectionId}.external.collection_key`));
      continue;
    }
    if (!directive.collection_path) {
      issues.push(compError('COMP-DIRECTIVE-MALFORMED', `Section '${sectionId}' composes collection fragments but declares no collection_path naming where rows land.`, `${sectionId}.external.collection_path`));
      continue;
    }

    const rows: Record<string, unknown>[] = [];
    const seenKeys = new Map<string, string>();
    let conflicted = false;
    for (const part of collectionParts) {
      for (const b of part.blocks) {
        const { _meta: _dropped, ...row } = b.content as Record<string, unknown>;
        const key = row[directive.collection_key];
        if (!nonEmptyString(key)) {
          issues.push(compError(
            'COMP-DIRECTIVE-MALFORMED',
            `Part '${part.part_id}' has no usable '${directive.collection_key}' value.`,
            `${sectionId}.external.collection_key`,
          ));
          conflicted = true;
          continue;
        }
        const prior = seenKeys.get(key);
        if (prior !== undefined) {
          // Never last-one-wins: two fragments claiming suite 210 is a conflict
          // a human resolves, not an ordering question.
          issues.push(compError(
            'COMP-DUP-KEY',
            `Parts '${prior}' and '${part.part_id}' both claim ${directive.collection_key} '${key}'.`,
            sectionId,
          ));
          conflicted = true;
          continue;
        }
        seenKeys.set(key, part.part_id);
        rows.push(row);
      }
    }
    if (conflicted) continue;

    rows.sort((a, b) =>
      byteCompare(String(a[directive.collection_key!]), String(b[directive.collection_key!])),
    );

    const { external: _external, ...rest } = block.content as Record<string, unknown>;
    sections[sectionId] = {
      ...block,
      annotation: inlineAnnotation(block.annotation),
      content: { ...rest, [directive.collection_path]: rows },
    } satisfies UWBlock;
  }

  return {
    status: issues.length > 0 ? 'unresolved' : 'resolved',
    document: { ...parsed, sections: sections as ParsedUWFile['sections'] },
    issues,
    externalized,
  };
}

// ─── Composites and recursion (RFC 0021 §4) ──────────────────────────────────

/**
 * Depth and member bounds. These mirror the safe-ZIP limits and exist for the
 * same reason: a nested-package expansion is a decompression bomb wearing a
 * different hat.
 */
export const DEFAULT_MAX_COMPOSITION_DEPTH = 8;
export const DEFAULT_MAX_COMPOSITION_MEMBERS = 4096;

/**
 * `stale` is a third state, deliberately distinct from `failed`.
 *
 * Because a parent's resolved digest is a function of its children's digests,
 * correcting a leaf changes every ancestor. An ancestor whose recorded child
 * digest no longer matches is not evidence of tampering — it is evidence that a
 * correction has not been adopted yet. Collapsing "out of date" into "wrong"
 * trains people to ignore the alarm, which is the same reasoning the receipt
 * verifier already applies to `unverifiable`.
 */
export type CompositeStatus = 'resolved' | 'stale' | 'unresolved';

export interface StaleMember {
  /** The parent holding an out-of-date record of the child's digest. */
  parent: string;
  child: string;
  recorded: string;
  actual: string;
}

export interface CompositeResolution {
  status: CompositeStatus;
  /** Members in dependency order, leaves first. Empty when unresolved. */
  order: string[];
  /** Deepest path length walked, 1 for a graph of leaves alone. */
  depth: number;
  member_count: number;
  stale: StaleMember[];
  issues: ProtocolError[];
}

export interface CompositeLink {
  /** Child member id. */
  from: string;
  /** Parent member id. */
  to: string;
}

export interface ResolveCompositeOptions {
  /** `contributes_to` links, child → parent. */
  links: readonly CompositeLink[];
  /** Every member id in the package, so a dangling reference is detectable. */
  members: readonly string[];
  /**
   * Each member's digest as recorded by its parent, keyed `parent::child`.
   * A recorded digest that disagrees with `actualDigests` makes the parent
   * `stale`.
   */
  recordedDigests?: ReadonlyMap<string, string>;
  /** Each member's digest as it stands now, keyed by member id. */
  actualDigests?: ReadonlyMap<string, string>;
  maxDepth?: number;
  maxMembers?: number;
}

/**
 * Walk the composition DAG, enforcing the normative bounds.
 *
 * Resolution performs no network or filesystem access: members resolve from
 * what the caller already holds. A reference pointing outside the package is
 * unresolvable, never fetched — that is what keeps a package offline-verifiable
 * and keeps validation from writing untrusted bytes anywhere.
 */
export function resolveComposite(opts: ResolveCompositeOptions): CompositeResolution {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_COMPOSITION_DEPTH;
  const maxMembers = opts.maxMembers ?? DEFAULT_MAX_COMPOSITION_MEMBERS;
  const issues: ProtocolError[] = [];
  const known = new Set(opts.members);

  const childrenOf = new Map<string, string[]>();
  for (const link of opts.links) {
    if (!known.has(link.from)) {
      issues.push(compError('COMP-UNRESOLVED', `Link names child '${link.from}', which is not a member of this package.`));
      continue;
    }
    if (!known.has(link.to)) {
      issues.push(compError('COMP-UNRESOLVED', `Link names parent '${link.to}', which is not a member of this package.`));
      continue;
    }
    const list = childrenOf.get(link.to) ?? [];
    list.push(link.from);
    childrenOf.set(link.to, list);
  }
  if (issues.length > 0) {
    return { status: 'unresolved', order: [], depth: 0, member_count: 0, stale: [], issues };
  }

  if (known.size > maxMembers) {
    return {
      status: 'unresolved',
      order: [],
      depth: 0,
      member_count: known.size,
      stale: [],
      issues: [compError('COMP-DEPTH', `Package holds ${known.size} members, above the bound of ${maxMembers}.`)],
    };
  }

  // Roots are members nothing contributes to.
  const isChild = new Set(opts.links.map((l) => l.from));
  const roots = [...known].filter((id) => !isChild.has(id)).sort();

  const order: string[] = [];
  const finished = new Set<string>();
  const onPath = new Set<string>();
  let deepest = 0;
  const stale: StaleMember[] = [];

  // Iterative DFS: a recursive walk would blow the JS stack before hitting the
  // depth bound on a hostile graph, turning a clean COMP-DEPTH into a crash.
  const walk = (root: string): boolean => {
    const stack: Array<{ id: string; depth: number; expanded: boolean }> = [
      { id: root, depth: 1, expanded: false },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.expanded) {
        stack.pop();
        onPath.delete(frame.id);
        if (!finished.has(frame.id)) {
          finished.add(frame.id);
          order.push(frame.id);
        }
        continue;
      }
      frame.expanded = true;
      deepest = Math.max(deepest, frame.depth);

      if (frame.depth > maxDepth) {
        issues.push(compError('COMP-DEPTH', `Composition depth ${frame.depth} at '${frame.id}' exceeds the bound of ${maxDepth}.`));
        return false;
      }
      if (onPath.has(frame.id)) {
        issues.push(compError('COMP-CYCLE', `Composition cycle reaches '${frame.id}' again.`));
        return false;
      }
      onPath.add(frame.id);

      for (const child of (childrenOf.get(frame.id) ?? []).slice().sort()) {
        if (onPath.has(child)) {
          issues.push(compError('COMP-CYCLE', `Composition cycle: '${frame.id}' and '${child}' are mutually reachable.`));
          return false;
        }
        // Staleness is checked on the edge, because the recorded digest belongs
        // to the parent's view of the child, not to the child.
        const recorded = opts.recordedDigests?.get(`${frame.id}::${child}`);
        const actual = opts.actualDigests?.get(child);
        if (recorded !== undefined && actual !== undefined && recorded !== actual) {
          stale.push({ parent: frame.id, child, recorded, actual });
        }
        if (!finished.has(child)) {
          stack.push({ id: child, depth: frame.depth + 1, expanded: false });
        }
      }
    }
    return true;
  };

  for (const root of roots) {
    if (!walk(root)) {
      return { status: 'unresolved', order: [], depth: deepest, member_count: known.size, stale, issues };
    }
  }

  // Any member never reached from a root sits in a cycle: it has a parent, but
  // no root leads to it.
  if (finished.size !== known.size) {
    const unreached = [...known].filter((id) => !finished.has(id)).sort();
    issues.push(compError('COMP-CYCLE', `Members unreachable from any root, indicating a cycle: ${unreached.join(', ')}.`));
    return { status: 'unresolved', order: [], depth: deepest, member_count: known.size, stale, issues };
  }

  return {
    status: stale.length > 0 ? 'stale' : 'resolved',
    order,
    depth: deepest,
    member_count: known.size,
    stale,
    issues,
  };
}
