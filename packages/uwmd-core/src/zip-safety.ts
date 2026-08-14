// Shared safe-ZIP inspection.
//
// Extracted from the UW CSV Bundle implementation so the UW Deal Package can
// apply the *same* restrictions rather than a second, subtly different copy —
// RFC 0018 §3 requires exactly that. Callers map the semantic violation to
// their own error code, which is how the CSV bundle keeps its `CSV_*` codes
// byte-for-byte identical to before the extraction.
//
// Inspection reads the archive's central directory only. It never inflates,
// never writes to disk, and never follows anything.

export type ZipSafetyViolation =
  | 'ZIP_SIZE_LIMIT'
  | 'ZIP_INVALID'
  | 'ZIP_MULTIDISK'
  | 'FILE_LIMIT'
  | 'ZIP_ENCRYPTED'
  | 'ZIP64_UNSUPPORTED'
  | 'ZIP_FILENAME_UTF8'
  | 'PATH_UNSAFE'
  | 'ZIP_DUPLICATE'
  | 'ZIP_SYMLINK'
  | 'SIZE_LIMIT'
  | 'ZIP_RATIO_LIMIT';

export interface ZipSafetyLimits {
  maxCompressedBytes?: number;
  maxFiles?: number;
  maxUncompressedBytes?: number;
  maxCompressionRatio?: number;
}

export const ZIP_DEFAULT_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;
export const ZIP_DEFAULT_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const ZIP_DEFAULT_MAX_FILES = 100;
export const ZIP_DEFAULT_MAX_COMPRESSION_RATIO = 100;

/** A relative POSIX path with no traversal, drive letter, or empty component. */
export function isSafeZipPath(path: string): boolean {
  if (!path || path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  return !path.split('/').some((part) => part === '' || part === '.' || part === '..');
}

export function inspectZipSafety(
  input: Uint8Array,
  limits: ZipSafetyLimits,
  raise: (violation: ZipSafetyViolation, message: string) => never,
): void {
  const maxCompressed = limits.maxCompressedBytes ?? ZIP_DEFAULT_MAX_COMPRESSED_BYTES;
  if (input.byteLength > maxCompressed) {
    raise('ZIP_SIZE_LIMIT', `ZIP is ${input.byteLength} bytes; limit is ${maxCompressed}.`);
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let eocd = -1;
  for (let index = input.byteLength - 22; index >= Math.max(0, input.byteLength - 65_557); index--) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) raise('ZIP_INVALID', 'ZIP end record is missing.');
  const archiveCommentLength = view.getUint16(eocd + 20, true);
  if (eocd + 22 + archiveCommentLength !== input.byteLength) {
    raise('ZIP_INVALID', 'ZIP end record has an invalid comment length or trailing data.');
  }
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskCount = view.getUint16(eocd + 8, true);
  const count = view.getUint16(eocd + 10, true);
  if (disk !== 0 || centralDisk !== 0 || diskCount !== count) {
    raise('ZIP_MULTIDISK', 'Multi-disk ZIP archives are forbidden.');
  }
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const maxFiles = limits.maxFiles ?? ZIP_DEFAULT_MAX_FILES;
  if (count > maxFiles) raise('FILE_LIMIT', `ZIP contains ${count} files; limit is ${maxFiles}.`);
  if (centralOffset + centralSize > eocd) raise('ZIP_INVALID', 'ZIP central directory is outside the archive.');

  let offset = centralOffset;
  let total = 0;
  const names = new Set<string>();
  const maxExpanded = limits.maxUncompressedBytes ?? ZIP_DEFAULT_MAX_UNCOMPRESSED_BYTES;
  const maxRatio = limits.maxCompressionRatio ?? ZIP_DEFAULT_MAX_COMPRESSION_RATIO;

  for (let index = 0; index < count; index++) {
    if (offset + 46 > input.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      raise('ZIP_INVALID', 'ZIP central entry is invalid.');
    }
    const flags = view.getUint16(offset + 8, true);
    const compressed = view.getUint32(offset + 20, true);
    const expanded = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const external = view.getUint32(offset + 38, true);
    if ((flags & 1) !== 0) raise('ZIP_ENCRYPTED', 'Encrypted ZIP entries are forbidden.');
    if (compressed === 0xffffffff || expanded === 0xffffffff) {
      raise('ZIP64_UNSUPPORTED', 'ZIP64 entries are not supported.');
    }
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const entryEnd = nameEnd + extraLength + commentLength;
    if (entryEnd > centralOffset + centralSize) raise('ZIP_INVALID', 'ZIP central entry is truncated.');
    let name: string;
    try {
      name = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(nameStart, nameEnd));
    } catch (error) {
      raise('ZIP_FILENAME_UTF8', `ZIP filename is not UTF-8: ${String(error)}.`);
    }
    if (!isSafeZipPath(name!)) raise('PATH_UNSAFE', `Unsafe bundle path ${JSON.stringify(name!)}.`);
    if (names.has(name!)) raise('ZIP_DUPLICATE', `ZIP repeats ${name!}.`);
    names.add(name!);
    const unixMode = external >>> 16;
    if ((unixMode & 0xf000) === 0xa000) raise('ZIP_SYMLINK', 'ZIP symlinks are forbidden.');
    total += expanded;
    if (total > maxExpanded) raise('SIZE_LIMIT', `ZIP expands beyond ${maxExpanded} bytes.`);
    if (expanded > compressed * maxRatio + 1_048_576) {
      raise('ZIP_RATIO_LIMIT', `${name!} exceeds compression ratio ${maxRatio}.`);
    }
    offset = entryEnd;
  }
  if (offset !== centralOffset + centralSize) {
    raise('ZIP_INVALID', 'ZIP central directory size is inconsistent.');
  }
}
