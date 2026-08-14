// UW Deal Package 1.0 — manifest model, validation, and link projection.
//
// RFC 0018 §3–§5. A package has one manifest and zero or more member payloads.
// The manifest is the authoritative inventory: ZIP entry order and timestamps
// are not semantic, and every member is content-addressed by digest.
//
// This module is browser-safe and performs no I/O of any kind. Resolving a
// reference handle is an explicit host action that happens elsewhere; nothing
// here may reach the network, and validation never writes to disk.

import {
  BUILTIN_EDGE_TYPES,
  type UWEdgeLayer,
  isEdgeTypeValidOnLayer,
  lookupEdgeType,
  type ProtocolError,
} from './protocol.js';

export const UW_PACKAGE_VERSION = '1.0' as const;
export const UW_PACKAGE_ZIP_CODEC = 'uw-deal-package-zip' as const;
export const UW_PACKAGE_ZIP_MEDIA_TYPE = 'application/vnd.uwmd.deal-package+zip' as const;
export const UW_PACKAGE_CONTEXT_CODEC = 'uw-deal-package-context' as const;
export const UW_PACKAGE_CONTEXT_MEDIA_TYPE =
  'application/vnd.uwmd.deal-package-context+json' as const;

/** Roles a member may play. `source_evidence` is never inlined into a context view. */
export type UWMemberRole =
  | 'underwriting'
  | 'lease_abstract'
  | 'source_note'
  | 'source_evidence'
  | 'model_encoding';

export interface UWPackageMember {
  id: string;
  path: string;
  role: UWMemberRole;
  media_type: string;
  /** Byte digest. This — not any reference handle — is the member's identity. */
  sha256: string;
  /** Present for UW documents whose representation the producer could canonicalize. */
  semantic_digest?: string;
  document_profile?: string;
  [key: string]: unknown;
}

export interface UWPackageLink {
  type: string;
  from: string;
  to: string;
  [key: string]: unknown;
}

export interface UWDealPackageManifest {
  package_version: typeof UW_PACKAGE_VERSION;
  package_id: string;
  members: UWPackageMember[];
  links: UWPackageLink[];
  [key: string]: unknown;
}

/** A typed, namespaced descriptor. A handle says where bytes *might* be found. */
export interface UWSourceReference {
  scheme: string;
  /** The namespace that minted the handle. A foreign authority is unresolvable. */
  authority?: string;
  value: string;
  [key: string]: unknown;
}

export interface UWEntityEdge {
  type: string;
  from: string;
  to: string;
  provenance: Array<{ source: string; locator?: string; note?: string }>;
}

export class UWPackageError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWPackageError';
    this.code = code;
  }
}

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

const MEMBER_ROLES: readonly UWMemberRole[] = [
  'underwriting',
  'lease_abstract',
  'source_note',
  'source_evidence',
  'model_encoding',
];

/** Roles whose bytes may be inlined into a JSON context view (RFC 0018 §4). */
export const CONTEXT_INLINABLE_ROLES: readonly UWMemberRole[] = Object.freeze([
  'underwriting',
  'lease_abstract',
  'source_note',
  'model_encoding',
]);

function packageError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'package', code, message, ...(pointer ? { pointer } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Paths MUST be relative POSIX paths with no traversal components and MUST
 * resolve to exactly one non-symlink entry. Rejected here as well as at
 * extraction time, so a malformed manifest fails before any archive is opened.
 */
export function isSafeMemberPath(path: string): boolean {
  if (!path || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  return !path.split('/').some((part) => part === '' || part === '.' || part === '..');
}

export function validateUWDealPackageManifest(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(candidate)) {
    return [packageError('PKG-001', 'Package manifest must be an object.')];
  }
  const manifest = candidate as UWDealPackageManifest;

  if (manifest.package_version !== UW_PACKAGE_VERSION) {
    errors.push(packageError('PKG-002', `Unsupported package_version; expected ${UW_PACKAGE_VERSION}.`, 'package_version'));
  }
  if (typeof manifest.package_id !== 'string' || manifest.package_id.length === 0) {
    errors.push(packageError('PKG-003', 'package_id is required.', 'package_id'));
  }
  if (!Array.isArray(manifest.members)) {
    errors.push(packageError('PKG-004', 'members must be an array.', 'members'));
    return errors;
  }
  if (manifest.links !== undefined && !Array.isArray(manifest.links)) {
    errors.push(packageError('PKG-005', 'links must be an array.', 'links'));
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const [idx, member] of manifest.members.entries()) {
    const at = `members[${idx}]`;
    if (!isRecord(member)) {
      errors.push(packageError('PKG-006', 'Member must be an object.', at));
      continue;
    }
    for (const key of ['id', 'path', 'media_type'] as const) {
      if (typeof member[key] !== 'string' || (member[key] as string).length === 0) {
        errors.push(packageError('PKG-007', `Member ${key} is required.`, `${at}.${key}`));
      }
    }
    if (typeof member.id === 'string') {
      if (seenIds.has(member.id)) {
        errors.push(packageError('PKG-008', `Duplicate member id: ${member.id}`, `${at}.id`));
      }
      seenIds.add(member.id);
    }
    if (typeof member.path === 'string') {
      if (!isSafeMemberPath(member.path)) {
        errors.push(packageError('PKG-009', `Unsafe member path: ${member.path}`, `${at}.path`));
      }
      if (seenPaths.has(member.path)) {
        errors.push(packageError('PKG-010', `Duplicate member path: ${member.path}`, `${at}.path`));
      }
      seenPaths.add(member.path);
    }
    if (!MEMBER_ROLES.includes(member.role as UWMemberRole)) {
      errors.push(packageError('PKG-011', `Unknown member role: ${String(member.role)}`, `${at}.role`));
    }
    if (typeof member.sha256 !== 'string' || !SHA256_PATTERN.test(member.sha256)) {
      errors.push(packageError('PKG-012', 'Member sha256 must be `sha256:<64 lowercase hex>`.', `${at}.sha256`));
    }
    if (member.semantic_digest !== undefined && !SHA256_PATTERN.test(String(member.semantic_digest))) {
      errors.push(packageError('PKG-013', 'semantic_digest must be `sha256:<64 lowercase hex>`.', `${at}.semantic_digest`));
    }
  }

  for (const [idx, link] of (manifest.links ?? []).entries()) {
    const at = `links[${idx}]`;
    if (!isRecord(link)) {
      errors.push(packageError('PKG-014', 'Link must be an object.', at));
      continue;
    }
    for (const key of ['type', 'from', 'to'] as const) {
      if (typeof link[key] !== 'string' || (link[key] as string).length === 0) {
        errors.push(packageError('PKG-015', `Link ${key} is required.`, `${at}.${key}`));
      }
    }
    // Dangling endpoints are the failure that makes a link graph lie, so they
    // are rejected rather than dropped.
    for (const end of ['from', 'to'] as const) {
      const id = link[end];
      if (typeof id === 'string' && !seenIds.has(id)) {
        errors.push(packageError('PKG-016', `Link ${end} does not resolve to a member: ${id}`, `${at}.${end}`));
      }
    }
    // An unknown type is preserved; a *known* type used on the wrong layer is
    // an error, because that is a claim the registry says cannot be true.
    if (typeof link.type === 'string' && !isEdgeTypeValidOnLayer(link.type, 'member')) {
      errors.push(packageError(
        'PKG-017',
        `Edge type ${link.type} is not valid on the member layer.`,
        `${at}.type`,
      ));
    }
  }

  return errors;
}

export function assertUWDealPackageManifest(candidate: unknown): UWDealPackageManifest {
  const errors = validateUWDealPackageManifest(candidate);
  if (errors.length > 0) {
    throw new UWPackageError(errors[0]!.code, errors.map((e) => e.message).join('; '));
  }
  return candidate as UWDealPackageManifest;
}

/**
 * Project member-layer links into entity-layer edges (RFC 0018 §5).
 *
 * Projection is **one-directional and explicit**. Within a package the manifest
 * *is* the provenance, because every member is content-addressed — so on the
 * way up we synthesize a provenance entry naming the package and the member ids
 * it came from. No edge reaches the entity layer without attributable
 * provenance, and no package is forced to duplicate what its digests prove.
 *
 * There is deliberately no inverse. An entity edge must never be projected down
 * into a package, or a package would stop being a self-contained artifact and
 * become a partial view of somebody's portfolio graph.
 */
export function projectPackageLinksToEntityEdges(
  manifest: UWDealPackageManifest,
): UWEntityEdge[] {
  const edges: UWEntityEdge[] = [];
  for (const link of manifest.links ?? []) {
    const def = lookupEdgeType(link.type);
    // Only types the registry declares valid on the entity layer project up.
    // Member-only types (`abstracts`, `contributes_to`) describe documents and
    // have no entity-layer meaning.
    if (!def || !def.layers.includes('entity')) continue;
    edges.push({
      type: link.type,
      from: link.from,
      to: link.to,
      provenance: [
        {
          source: manifest.package_id,
          locator: `${link.from} → ${link.to}`,
          note: `Projected from UW Deal Package member link (${link.type}).`,
        },
      ],
    });
  }
  return edges;
}

/** Types valid on a given layer — used by hosts building UI or validators. */
export function edgeTypesForLayer(layer: UWEdgeLayer): string[] {
  return BUILTIN_EDGE_TYPES.filter((d) => d.layers.includes(layer)).map((d) => d.type);
}
