// JCS-style canonical JSON serialization for content_hash computation.
// Protocol §V.9 — "Canonical block JSON"
//
// Implements RFC 8785 (JCS) with one extension: the keys `content_hash` and
// `signature` inside any nested `_meta` object are removed before hashing.
// This keeps hash computation idempotent across multiple round trips through
// the cascade.
//
// Pure, dependency-free, deterministic across Node and modern browsers.

const PRESERVE_KEYS_REMOVED = ['content_hash', 'signature'] as const;

/**
 * Produce a canonical JSON serialization of `value` per RFC 8785 with the
 * uw-md exclusions described above.
 *
 * Behavior:
 *   - Object keys sorted by code-unit comparison.
 *   - Strings JSON-escaped per RFC 8785 §3.2.2.
 *   - Numbers serialized per RFC 8785 §3.2.2.3 (ECMAScript ToString) with
 *     special-cases: integers render without decimals; non-finite numbers
 *     throw (JSON cannot represent them).
 *   - `undefined` values inside objects are dropped (mirrors JSON.stringify).
 *   - `_meta.content_hash` and `_meta.signature` are stripped before hashing.
 */
export function canonicalize(value: unknown): string {
  return serialize(stripExcludedKeys(value));
}

/** RFC 8785 serialization without block-integrity field exclusions. */
export function canonicalizeExact(value: unknown): string {
  return serialize(value);
}

function stripExcludedKeys(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(stripExcludedKeys);
  const out: Record<string, unknown> = {};
  const isMeta = looksLikeMeta(input as Record<string, unknown>);
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isMeta && (PRESERVE_KEYS_REMOVED as readonly string[]).includes(k)) continue;
    out[k] = stripExcludedKeys(v);
  }
  return out;
}

/**
 * Heuristic: an object is "meta-shaped" if it carries any of the canonical
 * meta fields. We strip the excluded keys from every meta-shaped sub-object,
 * not only the top-level `_meta`, so that nested provenance (e.g. inside
 * field_overrides) hashes consistently.
 */
function looksLikeMeta(obj: Record<string, unknown>): boolean {
  return (
    'section' in obj &&
    'version' in obj &&
    'source' in obj
  );
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null'; // JSON has no undefined; treat as null
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return serializeNumber(value);
    case 'string':
      return serializeString(value);
    case 'object':
      if (Array.isArray(value)) {
        return `[${value.map(serialize).join(',')}]`;
      }
      return serializeObject(value as Record<string, unknown>);
    default:
      throw new Error(`canonicalize: cannot serialize value of type ${typeof value}`);
  }
}

function serializeObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    parts.push(`${serializeString(k)}:${serialize(v)}`);
  }
  return `{${parts.join(',')}}`;
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`canonicalize: cannot serialize non-finite number ${n}`);
  }
  // ECMAScript ToString already produces RFC 8785-compatible output for
  // finite numbers, except that we want -0 to render as "0".
  if (Object.is(n, -0)) return '0';
  return String(n);
}

const ESCAPE_MAP: Record<number, string> = {
  8: '\\b',
  9: '\\t',
  10: '\\n',
  12: '\\f',
  13: '\\r',
  34: '\\"',
  92: '\\\\',
};

function serializeString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const escaped = ESCAPE_MAP[code];
    if (escaped !== undefined) {
      out += escaped;
      continue;
    }
    if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
      continue;
    }
    out += s[i];
  }
  return `${out}"`;
}
