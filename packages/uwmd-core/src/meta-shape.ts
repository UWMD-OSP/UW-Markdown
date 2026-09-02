// RFC 0009 — the v2 nested `_meta` shape and the structural reshape ("shim").
//
// Format 2.0 reorganizes the flat ~18-field `_meta` into four named
// sub-objects (`provenance`, `quality`, `lifecycle`, `integrity`) and lifts
// `field_overrides` out of `_meta` into a top-level `_overrides` block
// annotation. v1.x keeps the flat shape; a file's `uw_version` frontmatter is
// global and decides the shape for every block in it (no mixing — the
// validator enforces `META-V2-IN-V1` / `META-V1-IN-V2`).
//
// Everything here is purely structural: no vocabulary value is ever
// rewritten. Vocabulary repair (legacy tags, `resolution: "manual"`) is
// `uwmd migrate`'s job, at the operator's explicit request.
//
// Two distinct products come out of this module, and conflating them is the
// classic mistake:
//
//   1. The **flat parse view** (`reshapeMetaV2toV1`) — lets every existing
//      consumer (`routeBlock`, cascade, editor guards, integrity walk) keep
//      reading `block.meta.version` / `.superseded` / `.source` unchanged
//      while the on-disk shape is nested. Lossless, no defaulting.
//   2. The **canonical v2 form** (`canonicalV2BlockContent`) — the
//      normalize-then-hash input for v2 digests (RFC 0009
//      § Canonicalization). It applies the same defaulting to BOTH shapes
//      (`flags ?? []`, `partial ?? false`, `agent_id ?? null`, …) so that a
//      flat block and its nested reshape digest identically. A digest path
//      that skipped defaulting for already-nested input would fork block
//      identity on exactly the fields producers most often omit.

import type {
  ConfidenceLevel,
  InheritedFrom,
  MarketDataRef,
  SourceTag,
  UWBlockSignature,
  UWFieldOverride,
  UWFrontmatter,
  UWMeta,
} from './types.js';
import { SOURCE_TAGS } from './types.js';

// ─── The v2 shape (RFC 0009 §"v2 `_meta` shape") ─────────────────────────────

export interface UWMetaV2Provenance {
  /** The actor (RFC 0031 grammar): `manual | agent/<id> | document/<id> |
   *  system/<id> | institution/<id>`. Absent only for legacy-tag blocks the
   *  shim refused to invent an actor for. */
  source?: SourceTag;
  /** How the value was resolved — one canonical SOURCE_TAGS member. */
  resolution?: SourceTag;
  actor?: string;
  agent_id?: string | null;
  agent_version?: string | null;
  timestamp?: string;
  notes?: string | null;
  market_data_ref?: MarketDataRef;
  inherited_from?: InheritedFrom;
}

export interface UWMetaV2Quality {
  confidence?: ConfidenceLevel;
  human_review_required?: boolean;
  flags?: string[];
  partial?: boolean;
  provisional?: boolean;
}

export interface UWMetaV2Lifecycle {
  /** 1-based supersede-chain position. Renamed from v1 `version` to avoid
   *  colliding with frontmatter `uw_version` (RFC 0009 resolved question 1). */
  revision: number;
  superseded: boolean;
}

export interface UWMetaV2Integrity {
  /** Defaults to 'sha256' when absent; 'sha256' is the only admitted value at
   *  2.0 (RFC 0009 resolved question 2). A defaulted value is excluded from
   *  the digest; a non-default one is hashed. */
  algorithm?: 'sha256';
  input_hash?: string | null;
  content_hash?: string;
  parent_hash?: string | null;
  signature?: UWBlockSignature;
}

export interface UWMetaV2 {
  section?: string;
  provenance: UWMetaV2Provenance;
  quality: UWMetaV2Quality;
  lifecycle: UWMetaV2Lifecycle;
  integrity?: UWMetaV2Integrity;
  [key: string]: unknown;
}

export type MetaShape = 'v1' | 'v2';

// ─── Shape detection ─────────────────────────────────────────────────────────

/**
 * A raw `_meta` object is v2-shaped iff it carries object-valued `provenance`
 * AND `lifecycle` (the v2 triple minus the section key, which both shapes
 * carry under one spelling or another). Anything else — including the empty
 * object a block without `_meta` degrades to — reads as v1: the flat shape is
 * the permissive default for the whole of 1.x.
 */
export function detectMetaShape(raw: Record<string, unknown> | undefined): MetaShape {
  if (!raw) return 'v1';
  return isObject(raw['provenance']) && isObject(raw['lifecycle']) ? 'v2' : 'v1';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Major component of a `uw_version` frontmatter string; unparseable or
 *  absent means 1 (mirrors `envelope.ts`'s `?? '1.1'` default). */
export function uwVersionMajor(uwVersion: string | undefined): number {
  if (typeof uwVersion !== 'string') return 1;
  const m = /^(\d+)/.exec(uwVersion.trim());
  return m ? Number.parseInt(m[1] as string, 10) : 1;
}

/** True when the file's frontmatter declares format 2.0 or later. */
export function isV2File(frontmatter: Pick<UWFrontmatter, 'uw_version'> | undefined): boolean {
  return uwVersionMajor(frontmatter?.uw_version) >= 2;
}

// ─── v1 → v2 (the shim, forward direction) ───────────────────────────────────

/** The canonical resolution tags (RFC 0031, mirrored from parser.ts).
 *  `manual` left SOURCE_TAGS at format 2.0, so no exemption filter remains —
 *  it stays a legal actor and is never reinterpreted. */
const LEGACY_RESOLUTION_TAGS: ReadonlySet<string> = new Set(SOURCE_TAGS);

/**
 * Structural reshape of a flat v1 `_meta` into the canonical v2 nested form
 * (RFC 0009 §"Migration story"). Deterministic; applies RFC 0031's read-time
 * interpretation first — a canonical tag in flat `source` becomes
 * `provenance.resolution`, and `provenance.source` is left **absent, not
 * invented**. `field_overrides` is NOT carried (it lifts to the block-level
 * `_overrides` annotation — see `canonicalV2BlockContent`).
 *
 * Output is fully defaulted (explicit nulls / empty arrays per the RFC
 * pseudocode) because this is also the digest normalization target.
 */
export function reshapeMetaV1toV2(flat: UWMeta): UWMetaV2 {
  const rawSource = flat.source as string | undefined;
  const legacyTag = typeof rawSource === 'string' && LEGACY_RESOLUTION_TAGS.has(rawSource);
  const flatRec = flat as unknown as Record<string, unknown>;
  const section = flatRec['section'] ?? flatRec['section_id'];

  const v2: UWMetaV2 = {
    ...(typeof section === 'string' ? { section } : {}),
    provenance: {
      ...(legacyTag || rawSource === undefined ? {} : { source: rawSource }),
      ...(flat.resolution !== undefined
        ? { resolution: flat.resolution }
        : legacyTag
          ? { resolution: rawSource as SourceTag }
          : {}),
      actor: flat.actor,
      agent_id: flat.agent_id ?? null,
      agent_version: flat.agent_version ?? null,
      timestamp: flat.timestamp,
      notes: flat.notes ?? null,
      ...(flat.market_data_ref !== undefined ? { market_data_ref: flat.market_data_ref } : {}),
      ...(flat.inherited_from !== undefined ? { inherited_from: flat.inherited_from } : {}),
    },
    quality: {
      confidence: flat.confidence,
      human_review_required: flat.human_review_required,
      flags: flat.flags ?? [],
      partial: flat.partial ?? false,
      provisional: flat.provisional ?? false,
    },
    lifecycle: {
      revision: flat.version,
      superseded: flat.superseded,
    },
  };

  if (
    flat.input_hash != null ||
    flat.content_hash !== undefined ||
    flat.parent_hash !== undefined ||
    flat.signature !== undefined
  ) {
    v2.integrity = {
      input_hash: flat.input_hash ?? null,
      ...(flat.content_hash !== undefined ? { content_hash: flat.content_hash } : {}),
      parent_hash: flat.parent_hash ?? null,
      ...(flat.signature !== undefined ? { signature: flat.signature } : {}),
    };
  }

  return v2;
}

// ─── v2 → v1 (the flat parse view) ───────────────────────────────────────────

/**
 * Flatten a nested v2 `_meta` (plus the block's `_overrides`, if any) into
 * the in-memory `UWMeta` every existing consumer reads. Lossless view over
 * the nested data: `lifecycle.revision` surfaces as `version`,
 * `integrity.*` flattens, `_overrides` surfaces as `field_overrides`.
 */
export function reshapeMetaV2toV1(nested: UWMetaV2, overrides?: UWFieldOverride[]): UWMeta {
  const p = nested.provenance ?? {};
  const q = nested.quality ?? {};
  const l = nested.lifecycle ?? ({} as UWMetaV2Lifecycle);
  const integ = nested.integrity;

  const flat: UWMeta = {
    section: (nested.section ?? '') as string,
    version: l.revision as number,
    superseded: (l.superseded ?? false) as boolean,
    source: p.source as SourceTag,
    ...(p.resolution !== undefined ? { resolution: p.resolution } : {}),
    agent_id: p.agent_id ?? null,
    agent_version: p.agent_version ?? null,
    actor: p.actor as string,
    timestamp: p.timestamp as string,
    confidence: q.confidence as ConfidenceLevel,
    human_review_required: (q.human_review_required ?? false) as boolean,
    flags: q.flags ?? [],
    input_hash: integ?.input_hash ?? null,
    notes: p.notes ?? null,
  };

  if (q.partial !== undefined) flat.partial = q.partial;
  if (q.provisional !== undefined) flat.provisional = q.provisional;
  if (overrides !== undefined) flat.field_overrides = overrides;
  if (integ?.content_hash !== undefined) flat.content_hash = integ.content_hash;
  if (integ?.parent_hash !== undefined) flat.parent_hash = integ.parent_hash;
  if (integ?.signature !== undefined) flat.signature = integ.signature;
  if (p.market_data_ref !== undefined) flat.market_data_ref = p.market_data_ref;
  if (p.inherited_from !== undefined) flat.inherited_from = p.inherited_from;

  return flat;
}

// ─── Writer helpers (format 2.0 — nested by default) ─────────────────────────

/**
 * Stamp a freshly built flat `_meta` into a block content object in the shape
 * the target file's `uw_version` demands. The single seam every writer
 * (editor, runner, init) goes through, so no writer can produce
 * META-V1-IN-V2 by forgetting the reshape.
 *
 * For a v2 target: `_meta` is reshaped nested and `field_overrides` lifts to
 * the block-level `_overrides` annotation (absent when empty).
 */
export function stampMetaIntoBlockContent(
  content: Record<string, unknown>,
  flatMeta: UWMeta,
  v2: boolean,
): void {
  if (!v2) {
    content['_meta'] = flatMeta;
    return;
  }
  const { field_overrides, ...rest } = flatMeta;
  content['_meta'] = reshapeMetaV1toV2(rest as UWMeta) as unknown;
  delete content['_overrides'];
  if (field_overrides !== undefined && field_overrides.length > 0) {
    content['_overrides'] = field_overrides;
  }
}

/**
 * Bump a pipeline-log block's raw `_meta` in place — version + timestamp —
 * whichever shape it is on disk. Returns the new chain position for the
 * fence `v=` mirror.
 */
export function bumpRawMetaVersion(rawMeta: Record<string, unknown>, now: string): number {
  if (detectMetaShape(rawMeta) === 'v2') {
    const lifecycle = (rawMeta['lifecycle'] ?? {}) as Record<string, unknown>;
    const next = ((lifecycle['revision'] as number) ?? 1) + 1;
    lifecycle['revision'] = next;
    rawMeta['lifecycle'] = lifecycle;
    const provenance = (rawMeta['provenance'] ?? {}) as Record<string, unknown>;
    provenance['timestamp'] = now;
    rawMeta['provenance'] = provenance;
    return next;
  }
  const next = ((rawMeta['version'] as number) ?? 1) + 1;
  rawMeta['version'] = next;
  rawMeta['timestamp'] = now;
  return next;
}

// ─── Digest normalization (RFC 0009 § Canonicalization, step 1) ──────────────

/**
 * Produce the canonical v2 form of a block's content object — the input to
 * v2 canonicalization. Accepts either shape and returns a NEW object:
 *
 * - flat `_meta`   → reshaped nested, `field_overrides` lifted to `_overrides`
 * - nested `_meta` → re-normalized through the same flat round-trip, so both
 *   shapes land on the identical defaulted form (a nested block omitting
 *   `quality.partial` digests the same as a flat block omitting `partial`)
 *
 * Exclusion of `integrity.content_hash` / `integrity.signature` / defaulted
 * `integrity.algorithm` is canonicalization step 2 and lives in
 * `integrity-canonical.ts` — this function deliberately keeps them so the
 * stripping stays in one place.
 */
export function canonicalV2BlockContent(content: Record<string, unknown>): Record<string, unknown> {
  const rawMeta = content['_meta'] as Record<string, unknown> | undefined;
  const shape = detectMetaShape(rawMeta);

  let flat: UWMeta;
  let overrides: UWFieldOverride[] | undefined;
  if (shape === 'v2') {
    const nested = rawMeta as unknown as UWMetaV2;
    // Lift a stray v1-style quality.field_overrides too — normalization owns
    // structure, and _overrides is the only v2 home for per-field exceptions.
    const strayOverrides = (nested.quality as Record<string, unknown> | undefined)?.[
      'field_overrides'
    ] as UWFieldOverride[] | undefined;
    overrides = (content['_overrides'] as UWFieldOverride[] | undefined) ?? strayOverrides;
    flat = reshapeMetaV2toV1(nested);
  } else {
    const flatMeta = (rawMeta ?? {}) as unknown as UWMeta;
    overrides = flatMeta.field_overrides ?? (content['_overrides'] as UWFieldOverride[] | undefined);
    flat = flatMeta;
  }

  const nestedMeta = reshapeMetaV1toV2(flat);
  // Preserve a non-default algorithm through normalization (step 2 decides
  // whether it is excluded from the digest).
  const rawAlg =
    shape === 'v2' ? ((rawMeta as UWMetaV2 | undefined)?.integrity?.algorithm as unknown) : undefined;
  if (rawAlg !== undefined) {
    nestedMeta.integrity = { ...(nestedMeta.integrity ?? {}), algorithm: rawAlg as 'sha256' };
  }

  const out: Record<string, unknown> = { ...content, _meta: nestedMeta as unknown };
  delete out['_overrides'];
  if (overrides !== undefined && overrides.length > 0) out['_overrides'] = overrides;
  return out;
}
