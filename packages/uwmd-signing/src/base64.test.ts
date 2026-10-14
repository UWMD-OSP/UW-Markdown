import { describe, expect, it } from 'vitest';
import { fromBase64Any, fromBase64Url, toBase64Url } from './base64.js';

describe('canonical signature base64url', () => {
  it('round-trips every single byte and every pair of bytes', () => {
    for (let value = 0; value < 65536; value++) {
      const bytes = value < 256 ? Uint8Array.of(value) : Uint8Array.of(value >> 8, value & 255);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
    expect(fromBase64Url('')).toEqual(new Uint8Array());
  });

  it.each(['Zg=', 'Zg==', 'Zg===', 'Zh', 'Zm9', 'A', 'AAAAA', '+w', '/w', ' Zg', 'Zg\n', 'Z=g'])
    ('refuses non-canonical encoding %j', (text) => {
      expect(() => fromBase64Url(text)).toThrow(expect.objectContaining({ code: 'SIG_MALFORMED_ENCODING' }));
    });

  it('keeps padded and whitespace-tolerant key import separate', () => {
    expect(fromBase64Any(' /w==\n')).toEqual(Uint8Array.of(255));
    expect(fromBase64Any('_w==')).toEqual(Uint8Array.of(255));
  });
});
