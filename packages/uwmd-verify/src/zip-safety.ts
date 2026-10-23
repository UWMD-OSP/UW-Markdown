// Shared safe-ZIP inspection.
//
// Extracted from the UW CSV Bundle implementation so the UW Deal Package can
// apply the *same* restrictions rather than a second, subtly different copy —
// RFC 0018 §3 requires exactly that. Callers map the semantic violation to
// their own error code, which is how the CSV bundle keeps its `CSV_*` codes
// byte-for-byte identical to before the extraction.
//
// Inspection reconciles central/local headers before bounded extraction.
// Neither operation writes to disk or follows paths.

import { Inflate } from 'fflate';

interface ZipEntry {
  name: string;
  crc: number;
  compressed: number;
  expanded: number;
  method: number;
  start: number;
  end: number;
}

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
  inspectEntries(input, limits, raise);
}

function inspectEntries(
  input: Uint8Array,
  limits: ZipSafetyLimits,
  raise: (violation: ZipSafetyViolation, message: string) => never,
): ZipEntry[] {
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
  const entries: ZipEntry[] = [];
  const ranges: Array<[number, number]> = [];
  const names = new Set<string>();
  const maxExpanded = limits.maxUncompressedBytes ?? ZIP_DEFAULT_MAX_UNCOMPRESSED_BYTES;
  const maxRatio = limits.maxCompressionRatio ?? ZIP_DEFAULT_MAX_COMPRESSION_RATIO;

  for (let index = 0; index < count; index++) {
    if (offset + 46 > input.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      raise('ZIP_INVALID', 'ZIP central entry is invalid.');
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressed = view.getUint32(offset + 20, true);
    const expanded = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const external = view.getUint32(offset + 38, true);
    const local = view.getUint32(offset + 42, true);
    if ((flags & 1) !== 0) raise('ZIP_ENCRYPTED', 'Encrypted ZIP entries are forbidden.');
    if (compressed === 0xffffffff || expanded === 0xffffffff) {
      raise('ZIP64_UNSUPPORTED', 'ZIP64 entries are not supported.');
    }
    if (method !== 0 && method !== 8) raise('ZIP_INVALID', 'Unsupported ZIP compression method.');
    if (view.getUint16(offset + 34, true) !== 0) raise('ZIP_MULTIDISK', 'Entry belongs to another disk.');
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const entryEnd = nameEnd + extraLength + commentLength;
    if (entryEnd > centralOffset + centralSize) raise('ZIP_INVALID', 'ZIP central entry is truncated.');
    let name: string;
    try {
      name = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input.subarray(nameStart, nameEnd));
    } catch (error) {
      raise('ZIP_FILENAME_UTF8', `ZIP filename is not UTF-8: ${String(error)}.`);
    }
    if (!isSafeZipPath(name!)) raise('PATH_UNSAFE', `Unsafe bundle path ${JSON.stringify(name!)}.`);
    if (names.has(name!)) raise('ZIP_DUPLICATE', `ZIP repeats ${name!}.`);
    names.add(name!);
    if (local + 30 > centralOffset || view.getUint32(local, true) !== 0x04034b50) {
      raise('ZIP_INVALID', 'ZIP local entry is invalid.');
    }
    const localNameLength = view.getUint16(local + 26, true);
    const start = local + 30 + localNameLength + view.getUint16(local + 28, true);
    const end = start + compressed;
    if (end > centralOffset || localNameLength !== nameLength ||
      !input.subarray(local + 30, local + 30 + localNameLength)
        .every((byte, i) => byte === input[nameStart + i]) ||
      view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) {
      raise('ZIP_INVALID', 'ZIP local/central headers disagree.');
    }
    const descriptor = (flags & 8) !== 0;
    const localValues = [view.getUint32(local + 14, true), view.getUint32(local + 18, true), view.getUint32(local + 22, true)];
    const centralValues = [crc, compressed, expanded];
    if (localValues.some((value, i) => value !== centralValues[i] && !(descriptor && value === 0))) {
      raise('ZIP_INVALID', 'ZIP local/central CRC or sizes disagree.');
    }
    let rangeEnd = end;
    if (descriptor) {
      const signed = end + 4 <= centralOffset && view.getUint32(end, true) === 0x08074b50;
      const at = end + (signed ? 4 : 0);
      if (at + 12 > centralOffset || centralValues.some((value, i) => value !== view.getUint32(at + i * 4, true))) {
        raise('ZIP_INVALID', 'ZIP data descriptor disagrees with central entry.');
      }
      rangeEnd = at + 12;
    }
    ranges.push([local, rangeEnd]);
    entries.push({ name: name!, crc, compressed, expanded, method, start, end });
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
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((range, i) => i > 0 && range[0] < ranges[i - 1]![1])) {
    raise('ZIP_INVALID', 'ZIP local entries overlap.');
  }
  return entries;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

/** Extract only inspected members; check actual output length/CRC before returning bytes. */
export function extractZipSafely(
  input: Uint8Array,
  limits: ZipSafetyLimits,
  raise: (violation: ZipSafetyViolation, message: string) => never,
): Record<string, Uint8Array> {
  const entries = inspectEntries(input, limits, raise);
  const files: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  const maxExpanded = limits.maxUncompressedBytes ?? ZIP_DEFAULT_MAX_UNCOMPRESSED_BYTES;
  for (const entry of entries) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let crc = 0xffffffff;
    const accept = (chunk: Uint8Array) => {
      size += chunk.length;
      total += chunk.length;
      if (total > maxExpanded) raise('SIZE_LIMIT', 'Actual ZIP output exceeds the expanded-byte limit.');
      if (size > entry.expanded) raise('ZIP_INVALID', 'Actual ZIP member exceeds its declared output size.');
      for (const byte of chunk) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255]!;
      chunks.push(chunk.slice());
    };
    if (entry.method === 0) {
      accept(input.subarray(entry.start, entry.end));
    } else {
      let callbackRefusal = false;
      const inflater = new Inflate((chunk) => {
        try { accept(chunk); }
        catch (error) { callbackRefusal = true; throw error; }
      });
      try {
        // Bound the expansion delivered by one inflater call as well as the cumulative output.
        for (let at = entry.start; at < entry.end; at += 1024) {
          inflater.push(input.subarray(at, Math.min(at + 1024, entry.end)), at + 1024 >= entry.end);
        }
        if (entry.start === entry.end) inflater.push(new Uint8Array(), true);
      } catch (error) {
        // Preserve caller-owned typed limit/refusal errors from the callback.
        if (callbackRefusal) throw error;
        raise('ZIP_INVALID', `Invalid DEFLATE stream: ${String(error)}`);
      }
    }
    if (size !== entry.expanded || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) {
      raise('ZIP_INVALID', 'ZIP payload size or CRC does not match its headers.');
    }
    const payload = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { payload.set(chunk, at); at += chunk.length; }
    files[entry.name] = payload;
  }
  return files;
}
