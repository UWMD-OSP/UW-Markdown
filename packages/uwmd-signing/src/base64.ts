// Base64url (RFC 4648 §5, unpadded) and base64 helpers.
//
// Hand-rolled rather than reaching for Node's Buffer: this package is
// browser-usable, and `_meta.signature.sig` must round-trip identically on both
// sides or every signature written by a browser fails in Node.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const B64 = `${ALPHABET}+/`;
const B64URL = `${ALPHABET}-_`;

function encodeWith(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triple = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += b1 === undefined ? (pad ? '=' : '') : alphabet[(triple >> 6) & 63];
    out += b2 === undefined ? (pad ? '=' : '') : alphabet[triple & 63];
  }
  return out;
}

function decodeWith(text: string, alphabet: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = alphabet.indexOf(ch);
    if (value < 0) throw new Error(`invalid base64 character '${ch}'`);
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

export function toBase64Url(bytes: Uint8Array): string {
  return encodeWith(bytes, B64URL, false);
}

export function fromBase64Url(text: string): Uint8Array {
  return decodeWith(text, B64URL);
}

/**
 * Decode either base64 or base64url. Key material arrives from openssl (base64,
 * padded) far more often than from a JS encoder, and refusing the common form
 * on a purely cosmetic difference would be a bad trade for zero safety.
 */
export function fromBase64Any(text: string): Uint8Array {
  const normalized = text.trim().replace(/\s+/g, '');
  return /[-_]/.test(normalized)
    ? decodeWith(normalized, B64URL)
    : decodeWith(normalized, B64);
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
