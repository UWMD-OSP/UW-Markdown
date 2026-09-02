// Portfolio & relationship profiles — RFC 0015 (protocol §XV).
//
// The portable carrier for the ENTITY layer of the RFC 0018 edge registry: a
// `.uwportfolio.json` sidecar holding typed entities and provenance-backed
// edges that span deals. Core can already *produce* entity-layer edges
// (`projectPackageLinksToEntityEdges`) — this module gives them a home, a
// validator, and a projection bridge.
//
// Deliberately read-only and descriptive: no storage contract, no query
// semantics, no aggregate math (stated fund-level numbers belong to RFC 0021
// composites + rollup receipts). Edge types resolve through the canonical
// `BUILTIN_EDGE_TYPES` registry — this module adds no rows, and a *known*
// type used on the wrong layer refuses while an *unknown* type is preserved
// and merely reportable (`uninterpretedPortfolioTypes`). Provenance `source`
// here is a document/source identifier (the lease-abstract SourceRef
// posture), NOT the `_meta.source` actor grammar RFC 0031 defined.
// Browser-safe; performs no I/O.

import type { ProtocolError } from './protocol.js';
import { lookupEdgeType } from './protocol.js';
import type { UWEntityEdge } from './deal-package.js';

// ─── Types (RFC 0015) ────────────────────────────────────────────────────────

/** The sidecar's own semver line, independent of format and protocol. */
export const PORTFOLIO_PROFILE_VERSION = '1.0' as const;

/** Initial entity types. Extension types are preserved, never refused. */
export const PORTFOLIO_ENTITY_TYPES = Object.freeze([
  'property',
  'deal',
  'borrower',
  'loan',
  'document',
] as const);

export type PortfolioEntityType = (typeof PORTFOLIO_ENTITY_TYPES)[number];

/**
 * One provenance entry: which artifact says so, and where. `source` is a
 * stable document/source identifier — deliberately NOT the RFC 0031
 * `_meta.source` actor grammar; the two vocabularies stay apart.
 */
export interface PortfolioProvenance {
  source: string;
  locator?: string;
  note?: string;
  retrieved_at?: string;
  [key: string]: unknown;
}

export interface PortfolioEntity {
  /** Opaque, case-sensitive, unique within the profile. */
  id: string;
  /** A registered type, or an extension type (preserved, reportable). */
  type: string;
  display_name?: string;
  /** MUST equal the referenced deal's frontmatter `deal_id` when available. */
  deal_id?: string;
  [key: string]: unknown;
}

/** Exactly the RFC 0018 `UWEntityEdge` shape plus a profile-unique `id`. */
export interface PortfolioEdge extends UWEntityEdge {
  id: string;
  provenance: PortfolioProvenance[];
  [key: string]: unknown;
}

export interface PortfolioProfile {
  portfolio_version: string;
  portfolio_id?: string;
  entities: PortfolioEntity[];
  edges: PortfolioEdge[];
  [key: string]: unknown;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function portfolioError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'portfolio', code, message, ...(pointer ? { pointer } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate a candidate profile. Returns structural refusals only — unknown
 * entity fields, unknown entity types, and unknown edge types are NOT errors
 * (they are preserved, and reportable via `uninterpretedPortfolioTypes`).
 * A *known* edge type not valid on the entity layer IS an error: that is the
 * registry's one-table-two-layers rule, enforced from the sidecar side.
 */
export function validatePortfolioProfile(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(candidate)) {
    return [portfolioError('PORT-001', 'Portfolio profile must be an object.')];
  }
  const profile = candidate as PortfolioProfile;

  if (profile.portfolio_version !== PORTFOLIO_PROFILE_VERSION) {
    errors.push(portfolioError(
      'PORT-002',
      `Unsupported portfolio_version ${JSON.stringify(profile.portfolio_version)}; expected ${PORTFOLIO_PROFILE_VERSION}.`,
      'portfolio_version',
    ));
  }

  const entities = Array.isArray(profile.entities) ? profile.entities : null;
  if (!entities) {
    errors.push(portfolioError('PORT-003', 'entities must be an array.', 'entities'));
  }
  const edges = Array.isArray(profile.edges) ? profile.edges : null;
  if (!edges) {
    errors.push(portfolioError('PORT-004', 'edges must be an array.', 'edges'));
  }
  if (!entities || !edges) return errors;

  const entityTypeById = new Map<string, string>();
  const seenIds = new Set<string>();

  entities.forEach((entity, i) => {
    if (!isRecord(entity) || typeof entity.id !== 'string' || entity.id.length === 0
      || typeof entity.type !== 'string' || entity.type.length === 0) {
      errors.push(portfolioError('PORT-005', `Entity ${i} must state a non-empty id and type.`, `entities[${i}]`));
      return;
    }
    if (seenIds.has(entity.id)) {
      errors.push(portfolioError('PORT-006', `Duplicate id ${JSON.stringify(entity.id)}; ids are unique within a profile.`, `entities[${i}].id`));
      return;
    }
    seenIds.add(entity.id);
    entityTypeById.set(entity.id, entity.type);
  });

  edges.forEach((edge, i) => {
    if (!isRecord(edge) || typeof edge.id !== 'string' || edge.id.length === 0
      || typeof edge.type !== 'string' || edge.type.length === 0
      || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      errors.push(portfolioError('PORT-007', `Edge ${i} must state a non-empty id, type, from, and to.`, `edges[${i}]`));
      return;
    }
    if (seenIds.has(edge.id)) {
      errors.push(portfolioError('PORT-006', `Duplicate id ${JSON.stringify(edge.id)}; ids are unique within a profile.`, `edges[${i}].id`));
    } else {
      seenIds.add(edge.id);
    }

    for (const [end, label] of [[edge.from, 'from'], [edge.to, 'to']] as const) {
      if (!entityTypeById.has(end)) {
        errors.push(portfolioError('PORT-008', `Edge ${JSON.stringify(edge.id)} ${label} ${JSON.stringify(end)} does not resolve to an entity in this profile.`, `edges[${i}].${label}`));
      }
    }

    const provenance = edge.provenance;
    if (!Array.isArray(provenance) || provenance.length === 0) {
      errors.push(portfolioError('PORT-009', `Edge ${JSON.stringify(edge.id)} must carry a non-empty provenance array.`, `edges[${i}].provenance`));
    } else {
      provenance.forEach((entry, j) => {
        if (!isRecord(entry) || typeof entry.source !== 'string' || entry.source.length === 0) {
          errors.push(portfolioError('PORT-009', `Edge ${JSON.stringify(edge.id)} provenance entry ${j} must state a source identifier.`, `edges[${i}].provenance[${j}]`));
        }
      });
    }

    // Registry resolution: unknown → preserved; known-but-member-layer → refused.
    const def = lookupEdgeType(edge.type);
    if (def) {
      if (!def.layers.includes('entity')) {
        errors.push(portfolioError('PORT-010', `Edge type ${JSON.stringify(edge.type)} is registered on the member layer only and cannot relate entities (RFC 0018 §5).`, `edges[${i}].type`));
      } else {
        // Builtin from/to entity-kind constraints, checked only when the
        // endpoint's type is itself a registered entity type — an extension
        // entity type is outside the constraint's vocabulary, not in
        // violation of it.
        const checks = [[edge.from, def.from, 'from'], [edge.to, def.to, 'to']] as const;
        for (const [end, allowed, label] of checks) {
          const endType = entityTypeById.get(end);
          if (!endType) continue;
          if (!(PORTFOLIO_ENTITY_TYPES as readonly string[]).includes(endType)) continue;
          if (allowed.includes('any')) continue;
          if (!(allowed as readonly string[]).includes(endType)) {
            errors.push(portfolioError('PORT-011', `Edge ${JSON.stringify(edge.id)} (${edge.type}) ${label} must be one of [${allowed.join(', ')}], not ${endType}.`, `edges[${i}].${label}`));
          }
        }
      }
    }
  });

  return errors;
}

/**
 * The types this implementation cannot interpret — extension entity and edge
 * types that validation preserved. Reportable, never refusable (RFC 0015).
 */
export function uninterpretedPortfolioTypes(profile: PortfolioProfile): {
  entity_types: string[];
  edge_types: string[];
} {
  const entity_types = new Set<string>();
  for (const e of profile.entities ?? []) {
    if (typeof e?.type === 'string' && !(PORTFOLIO_ENTITY_TYPES as readonly string[]).includes(e.type)) {
      entity_types.add(e.type);
    }
  }
  const edge_types = new Set<string>();
  for (const e of profile.edges ?? []) {
    if (typeof e?.type === 'string' && !lookupEdgeType(e.type)) edge_types.add(e.type);
  }
  return { entity_types: [...entity_types].sort(), edge_types: [...edge_types].sort() };
}

// ─── Queries and projection ──────────────────────────────────────────────────

/**
 * The edges touching `entityId` (either endpoint), or every edge when no id
 * is given. A convenience over the array, not a query language — traversal
 * semantics stay out of scope by design.
 */
export function getPortfolioRelationships(
  profile: PortfolioProfile,
  entityId?: string,
): PortfolioEdge[] {
  const edges = profile.edges ?? [];
  if (entityId === undefined) return [...edges];
  return edges.filter((e) => e.from === entityId || e.to === entityId);
}

/**
 * Bridge from the RFC 0018 producer: wrap `projectPackageLinksToEntityEdges`
 * output (or any `UWEntityEdge[]`) as profile edges with generated ids.
 * Deterministic: `<prefix>:<1-based index>` in input order.
 */
export function entityEdgesToPortfolioEdges(
  edges: readonly UWEntityEdge[],
  idPrefix = 'edge',
): PortfolioEdge[] {
  return edges.map((e, i) => ({ ...e, id: `${idPrefix}:${i + 1}` }));
}
