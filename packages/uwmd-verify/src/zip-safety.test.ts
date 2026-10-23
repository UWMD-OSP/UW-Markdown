import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractZipSafely, inspectZipSafety } from './zip-safety.js';

const refuse = (code: string, message: string): never => { throw new Error(`${code}: ${message}`); };
const archive = (level: 0 | 6 = 0) => zipSync({ 'sample.txt': strToU8('synthetic payload '.repeat(30)) }, { level });
const headers = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let central = -1;
  let end = -1;
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (view.getUint32(i, true) === 0x02014b50) central = i;
    if (view.getUint32(i, true) === 0x06054b50) end = i;
  }
  return { view, central, end };
};

describe('actual ZIP transport integrity (#544)', () => {
  it.each([0, 6] as const)('accepts STORE/DEFLATE payloads (%s)', (level) => {
    const files = extractZipSafely(archive(level), {}, refuse);
    expect(files['sample.txt']).toEqual(strToU8('synthetic payload '.repeat(30)));
  });

  it.each([0, 6] as const)('rejects mutually consistent but false CRC fields (%s)', (level) => {
    const bytes = archive(level);
    const { view, central } = headers(bytes);
    view.setUint32(14, 0, true);
    view.setUint32(central + 16, 0, true);
    expect(() => extractZipSafely(bytes, {}, refuse)).toThrow(/ZIP_INVALID.*CRC/);
  });

  it('rejects local/central filename, flags, method, CRC and size disagreement', () => {
    for (const [offset, width] of [[30, 1], [6, 2], [8, 2], [14, 4], [18, 4], [22, 4]]) {
      const bytes = archive();
      const view = new DataView(bytes.buffer);
      if (width === 1) bytes[offset!] ^= 1;
      else if (width === 2) view.setUint16(offset!, view.getUint16(offset!, true) ^ 1, true);
      else view.setUint32(offset!, view.getUint32(offset!, true) ^ 1, true);
      expect(() => inspectZipSafety(bytes, {}, refuse)).toThrow(/ZIP_INVALID/);
    }
  });

  it.each([0, 6] as const)('checks actual output against advertised sizes (%s)', (level) => {
    const bytes = archive(level);
    const { view, central } = headers(bytes);
    view.setUint32(22, 1, true);
    view.setUint32(central + 24, 1, true);
    expect(() => extractZipSafely(bytes, {}, refuse)).toThrow(/ZIP_INVALID/);
  });

  it('accepts a valid streaming data descriptor and rejects its altered CRC', () => {
    const original = archive(6);
    const { view: old, central, end } = headers(original);
    const bytes = new Uint8Array(original.length + 16);
    bytes.set(original.subarray(0, central));
    bytes.set(original.subarray(central), central + 16);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, old.getUint16(6, true) | 8, true);
    view.setUint16(central + 16 + 8, old.getUint16(central + 8, true) | 8, true);
    view.setUint32(central, 0x08074b50, true);
    for (const [i, at] of [14, 18, 22].entries()) {
      view.setUint32(central + 4 + i * 4, old.getUint32(at, true), true);
      view.setUint32(at, 0, true);
    }
    view.setUint32(end + 16 + 16, central + 16, true);
    expect(extractZipSafely(bytes, {}, refuse)['sample.txt']).toEqual(strToU8('synthetic payload '.repeat(30)));
    view.setUint32(central + 4, 0, true);
    expect(() => extractZipSafely(bytes, {}, refuse)).toThrow(/ZIP_INVALID.*descriptor/);
  });

  it('keeps path, file, size, ratio and malformed-stream controls', () => {
    expect(() => extractZipSafely(zipSync({ '../unsafe': strToU8('x') }), {}, refuse)).toThrow(/PATH_UNSAFE/);
    expect(() => extractZipSafely(archive(), { maxFiles: 0 }, refuse)).toThrow(/FILE_LIMIT/);
    expect(() => extractZipSafely(archive(), { maxUncompressedBytes: 1 }, refuse)).toThrow(/SIZE_LIMIT/);
    const bytes = archive(6);
    const { view } = headers(bytes);
    const start = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    bytes[start] = 255;
    expect(() => extractZipSafely(bytes, {}, refuse)).toThrow(/ZIP_INVALID/);
  });
});
