// UW Deal Package ZIP codec (RFC 0018 §3).
//
// The ZIP is the archival encoding; the JSON context is a view of it. A
// canonical encoder emits entries in lexicographic path order with fixed
// timestamps, so the same package always produces the same bytes — ZIP entry
// order and mtimes are not semantic and must not leak into a digest.
//
// Decoding inspects the archive before inflating anything, using the same
// shared safe-ZIP rules as the CSV bundle. Extraction to disk is not this
// module's business and never happens here.

import { unzipSync, zipSync } from 'fflate';
import {
  UWPackageError,
  UW_PACKAGE_VERSION,
  assertUWDealPackageManifest,
  validateUWDealPackageManifest,
  type UWDealPackageManifest,
} from './deal-package.js';
import { sha256BytesHex } from './integrity.js';
import type { ProtocolError } from './protocol.js';
import { inspectZipSafety, type ZipSafetyLimits } from './zip-safety.js';

export const PACKAGE_MANIFEST_PATH = 'manifest.json' as const;

// Same constant the CSV bundle uses. One day past the DOS epoch on purpose:
// fflate converts to *local* time, so 1980-01-01T00:00Z underflows the
// 1980-2099 range in any negative-offset timezone.
//
// Caveat inherited from that choice: because the conversion is local, the
// encoded DOS timestamp — and therefore the archive bytes — can differ between
// machines in different timezones. Encoding is deterministic on a given host,
// which is what the ordering guarantee needs; cross-timezone byte identity
// would require a UTC-fixed field fflate does not expose.
const FIXED_MTIME = new Date('1980-01-02T00:00:00.000Z');

export interface UWDealPackageInput {
  manifest: UWDealPackageManifest;
  /** Member path → exact bytes. Every declared member must be present. */
  payloads: Record<string, Uint8Array>;
}

export interface UWDealPackageDecoded {
  manifest: UWDealPackageManifest;
  payloads: Record<string, Uint8Array>;
}

export type UWPackageDecodeOptions = ZipSafetyLimits;

export type PackageVerificationStatus = 'verified' | 'failed' | 'unverifiable';

export interface PackageVerification {
  status: PackageVerificationStatus;
  errors: ProtocolError[];
  /** Members whose semantic digest could not be checked by this implementation. */
  unverifiable_members: string[];
}

function pkgError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'package', code, message, ...(pointer ? { pointer } : {}) };
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export async function encodeUWDealPackageZip(input: UWDealPackageInput): Promise<Uint8Array> {
  const manifest = assertUWDealPackageManifest(input.manifest);

  const files: Record<string, [Uint8Array, { mtime: Date; level: 9 }]> = {};
  for (const member of manifest.members) {
    const payload = input.payloads[member.path];
    if (!payload) {
      throw new UWPackageError('PKGZIP-001', `Declared member has no payload: ${member.path}`);
    }
    const actual = `sha256:${await sha256BytesHex(payload)}`;
    if (actual !== member.sha256) {
      // Encoding a package whose manifest already disagrees with its bytes
      // would mint a broken artifact, so this fails at write time.
      throw new UWPackageError(
        'PKGZIP-002',
        `Member ${member.id} digest does not match its payload (manifest ${member.sha256}, actual ${actual}).`,
      );
    }
    files[member.path] = [payload, { mtime: FIXED_MTIME, level: 9 }];
  }
  files[PACKAGE_MANIFEST_PATH] = [
    encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`),
    { mtime: FIXED_MTIME, level: 9 },
  ];

  // Lexicographic order makes the archive byte-deterministic.
  const ordered: typeof files = {};
  for (const path of Object.keys(files).sort()) ordered[path] = files[path]!;
  return zipSync(ordered as never);
}

export function decodeUWDealPackageZip(
  input: Uint8Array,
  options: UWPackageDecodeOptions = {},
): UWDealPackageDecoded {
  inspectZipSafety(input, options, (violation, message) => {
    throw new UWPackageError(`PKG_${violation}`, message);
  });

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(input);
  } catch (error) {
    throw new UWPackageError('PKGZIP-003', `ZIP could not be read: ${String(error)}`);
  }

  const manifestBytes = entries[PACKAGE_MANIFEST_PATH];
  if (!manifestBytes) {
    throw new UWPackageError('PKGZIP-004', `Package is missing ${PACKAGE_MANIFEST_PATH}.`);
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(decoder.decode(manifestBytes));
  } catch (error) {
    throw new UWPackageError('PKGZIP-005', `${PACKAGE_MANIFEST_PATH} is invalid: ${String(error)}`);
  }
  const errors = validateUWDealPackageManifest(manifest);
  if (errors.length > 0) {
    throw new UWPackageError(errors[0]!.code, errors.map((e) => e.message).join('; '));
  }
  const typed = manifest as UWDealPackageManifest;

  const payloads: Record<string, Uint8Array> = {};
  for (const member of typed.members) {
    const bytes = entries[member.path];
    if (!bytes) {
      throw new UWPackageError('PKGZIP-006', `Declared member is absent from the archive: ${member.path}`);
    }
    payloads[member.path] = bytes;
  }

  return { manifest: typed, payloads };
}

/**
 * Verify a decoded package.
 *
 * Three-state on purpose, matching the receipt verifier. A member whose
 * representation this implementation cannot canonicalize is **unverifiable**,
 * not failed — an unsupported representation is not evidence of tampering, and
 * collapsing the two would teach users to ignore the distinction.
 */
export async function verifyUWDealPackage(
  decoded: UWDealPackageDecoded,
  options: { semanticDigestOf?: (member: string, bytes: Uint8Array) => Promise<string | null> } = {},
): Promise<PackageVerification> {
  const errors: ProtocolError[] = [];
  const unverifiable: string[] = [];

  for (const member of decoded.manifest.members) {
    const bytes = decoded.payloads[member.path];
    if (!bytes) {
      errors.push(pkgError('PKGVER-001', `Member payload missing: ${member.path}`, member.id));
      continue;
    }
    const actual = `sha256:${await sha256BytesHex(bytes)}`;
    if (actual !== member.sha256) {
      errors.push(pkgError('PKGVER-002', `Member ${member.id} byte digest does not match the manifest.`, member.id));
      continue;
    }
    if (member.semantic_digest) {
      const computed = options.semanticDigestOf
        ? await options.semanticDigestOf(member.id, bytes)
        : null;
      if (computed === null) {
        unverifiable.push(member.id);
      } else if (computed !== member.semantic_digest) {
        errors.push(pkgError('PKGVER-003', `Member ${member.id} semantic digest does not match.`, member.id));
      }
    }
  }

  const status: PackageVerificationStatus =
    errors.length > 0 ? 'failed' : unverifiable.length > 0 ? 'unverifiable' : 'verified';
  return { status, errors, unverifiable_members: unverifiable };
}

export { UW_PACKAGE_VERSION };
