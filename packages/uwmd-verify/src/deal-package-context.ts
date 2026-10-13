// UW Deal Package JSON context view (RFC 0018 §4).
//
// Projects a package into JSON with the full manifest, typed links, and inline
// UTF-8 content **only** for UW documents and source notes. A connector can
// therefore pass the actionable underwriting context as ordinary JSON rather
// than as an opaque archive.
//
// This is a *view*, not a second archival encoding. The central rule:
//
//   Source evidence is represented by identity and digest only. Its bytes are
//   NEVER inlined — not as UTF-8, not as base64, not "just this once".
//
// Naming a source does not make it available to the recipient, and a context
// view must never be mistaken for proof that a source was read.

import {
  CONTEXT_INLINABLE_ROLES,
  UWPackageError,
  UW_PACKAGE_VERSION,
  type UWDealPackageManifest,
  type UWPackageMember,
  type UWSourceReference,
  validateUWDealPackageManifest,
} from './deal-package.js';
import type { ProtocolError } from './protocol.js';

export interface UWContextContent {
  kind: 'utf8';
  text: string;
}

export type UWSourceEvidenceDescriptor =
  | { status: 'not_transferred' }
  | { status: 'reference'; reference: UWSourceReference[] };

export interface UWDealPackageContext {
  package_version: typeof UW_PACKAGE_VERSION;
  package_id: string;
  members: UWPackageMember[];
  links: UWDealPackageManifest['links'];
  contents: Record<string, UWContextContent>;
  source_evidence: Record<string, UWSourceEvidenceDescriptor>;
  /** Present and true so a consumer cannot mistake a view for an archive. */
  incomplete_evidence_context: true;
}

export interface ProjectContextOptions {
  /**
   * Member id → exact UTF-8 bytes. Supplied by the caller because this module
   * performs no I/O. A member with inlinable role and no supplied text is
   * omitted from `contents` rather than guessed at.
   */
  contents?: Record<string, string>;
  /** Member id → typed reference handles for source evidence. */
  references?: Record<string, UWSourceReference[]>;
}

function contextError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'package', code, message, ...(pointer ? { pointer } : {}) };
}

export function projectUWDealPackageContext(
  manifest: UWDealPackageManifest,
  options: ProjectContextOptions = {},
): UWDealPackageContext {
  const manifestErrors = validateUWDealPackageManifest(manifest);
  if (manifestErrors.length > 0) {
    throw new UWPackageError('PKGCTX-000', `Manifest is invalid: ${manifestErrors[0]!.message}`);
  }

  const contents: Record<string, UWContextContent> = {};
  const sourceEvidence: Record<string, UWSourceEvidenceDescriptor> = {};

  for (const member of manifest.members) {
    if (member.role === 'source_evidence') {
      // Every source-evidence member MUST appear, so the recipient can see what
      // exists and was withheld rather than silently not knowing about it.
      const refs = options.references?.[member.id];
      sourceEvidence[member.id] = refs && refs.length > 0
        ? { status: 'reference', reference: refs }
        : { status: 'not_transferred' };
      continue;
    }
    if (!CONTEXT_INLINABLE_ROLES.includes(member.role)) continue;
    const text = options.contents?.[member.id];
    if (typeof text === 'string') {
      contents[member.id] = { kind: 'utf8', text };
    }
  }

  return {
    package_version: UW_PACKAGE_VERSION,
    package_id: manifest.package_id,
    members: manifest.members,
    links: manifest.links ?? [],
    contents,
    source_evidence: sourceEvidence,
    incomplete_evidence_context: true,
  };
}

/**
 * Validate a context view. Beyond shape, this enforces the §4 rules that make
 * the view safe to hand to a model:
 *
 *   - every `contents` key references a manifest member with an inlinable role;
 *   - no `contents` key references source evidence or an unlisted member; and
 *   - every source-evidence member is described, never embedded.
 */
export function validateUWDealPackageContext(candidate: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return [contextError('PKGCTX-001', 'Context must be an object.')];
  }
  const ctx = candidate as UWDealPackageContext;

  if (ctx.package_version !== UW_PACKAGE_VERSION) {
    errors.push(contextError('PKGCTX-002', 'Unsupported package_version.', 'package_version'));
  }
  if (!Array.isArray(ctx.members)) {
    errors.push(contextError('PKGCTX-003', 'members must be an array.', 'members'));
    return errors;
  }
  if (ctx.incomplete_evidence_context !== true) {
    errors.push(contextError(
      'PKGCTX-004',
      'Context must declare incomplete_evidence_context: true — it is not an archival package.',
      'incomplete_evidence_context',
    ));
  }

  const byId = new Map(ctx.members.map((m) => [m.id, m]));

  for (const [id, entry] of Object.entries(ctx.contents ?? {})) {
    const member = byId.get(id);
    if (!member) {
      errors.push(contextError('PKGCTX-005', `contents references an unlisted member: ${id}`, `contents.${id}`));
      continue;
    }
    if (member.role === 'source_evidence') {
      errors.push(contextError(
        'PKGCTX-006',
        `contents must never inline source evidence: ${id}`,
        `contents.${id}`,
      ));
      continue;
    }
    if (!CONTEXT_INLINABLE_ROLES.includes(member.role)) {
      errors.push(contextError('PKGCTX-007', `Member role ${member.role} is not inlinable.`, `contents.${id}`));
    }
    if (!entry || entry.kind !== 'utf8' || typeof entry.text !== 'string') {
      errors.push(contextError('PKGCTX-008', 'Content entry must be { kind: "utf8", text }.', `contents.${id}`));
    }
  }

  for (const member of ctx.members) {
    if (member.role !== 'source_evidence') continue;
    const descriptor = ctx.source_evidence?.[member.id];
    if (!descriptor) {
      errors.push(contextError(
        'PKGCTX-009',
        `Source evidence member is not described: ${member.id}`,
        `source_evidence.${member.id}`,
      ));
      continue;
    }
    if (descriptor.status !== 'not_transferred' && descriptor.status !== 'reference') {
      errors.push(contextError(
        'PKGCTX-010',
        'Source evidence status must be "not_transferred" or "reference".',
        `source_evidence.${member.id}.status`,
      ));
    }
  }

  return errors;
}

/**
 * Verify inline payloads against their declared byte digests.
 *
 * Kept separate from `validateUWDealPackageContext` because it needs a digest
 * function the caller supplies — core does not import a hashing implementation
 * here, and the browser and Node paths differ. A context whose inline bytes do
 * not match the manifest is a verification failure, not a shape error.
 */
export async function verifyContextContentDigests(
  ctx: UWDealPackageContext,
  sha256Hex: (bytes: Uint8Array) => Promise<string>,
): Promise<ProtocolError[]> {
  const errors: ProtocolError[] = [];
  const byId = new Map(ctx.members.map((m) => [m.id, m]));
  const encoder = new TextEncoder();
  for (const [id, entry] of Object.entries(ctx.contents ?? {})) {
    const member = byId.get(id);
    if (!member) continue; // already reported by shape validation
    const actual = `sha256:${await sha256Hex(encoder.encode(entry.text))}`;
    if (actual !== member.sha256) {
      errors.push(contextError(
        'PKGCTX-011',
        `Inline content digest does not match the manifest for ${id}.`,
        `contents.${id}`,
      ));
    }
  }
  return errors;
}
