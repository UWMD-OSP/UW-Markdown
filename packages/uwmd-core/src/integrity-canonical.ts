// JCS-style canonical JSON serialization for content_hash computation.
// Protocol §V.9 — "Canonical block JSON"
//
// Implements RFC 8785 (JCS) with one extension: the keys `content_hash` and
// `signature` inside any nested `_meta` object (spelled `section`/`section_id`)
// are removed before hashing.
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

/**
 * Canonicalization v2 (RFC 0009 § Canonicalization, steps 2–3), for blocks in
 * `uw_version: "2.0"` files. The caller performs step 1 (normalization to the
 * nested shape — `canonicalV2BlockContent` in `meta-shape.ts`) first; this
 * function strips the v2 exclusions and serializes:
 *
 *   - `integrity.content_hash` and `integrity.signature` inside any v2
 *     meta-shaped object (`provenance` + `lifecycle` + `section`/`section_id`,
 *     checked post-normalization);
 *   - `integrity.algorithm` when it is the defaulted `'sha256'` — so spelling
 *     the default out never moves a digest, while a future non-default
 *     algorithm IS hashed and cannot be stripped undetected;
 *   - the v1 exclusions continue to apply to any v1-shaped meta object
 *     encountered pre-normalization (defense in depth; a normalized input has
 *     none).
 *
 * The v1 rule (`canonicalize`) is frozen forever for `uw_version: "1.x"`
 * files — no stored v1 digest is ever invalidated by the v2 rule existing.
 */
export function canonicalizeV2(value: unknown): string {
  return serialize(stripExcludedKeysV2(value));
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

function stripExcludedKeysV2(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(stripExcludedKeysV2);
  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const isMetaV1 = looksLikeMeta(obj);
  const isMetaV2 = looksLikeMetaV2(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (isMetaV1 && (PRESERVE_KEYS_REMOVED as readonly string[]).includes(k)) continue;
    if (isMetaV2 && k === 'integrity' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const integrity: Record<string, unknown> = {};
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
        if ((PRESERVE_KEYS_REMOVED as readonly string[]).includes(ik)) continue;
        if (ik === 'algorithm' && iv === 'sha256') continue; // defaulted → excluded
        integrity[ik] = stripExcludedKeysV2(iv);
      }
      // An integrity object emptied by exclusion is dropped entirely, so a
      // block whose only integrity fields were the excluded ones digests the
      // same as one that never carried `integrity` at all.
      if (Object.keys(integrity).length > 0) out[k] = integrity;
      continue;
    }
    out[k] = stripExcludedKeysV2(v);
  }
  return out;
}

/**
 * The v2 meta-detection triple (RFC 0009 § Canonicalization): object-valued
 * `provenance` AND `lifecycle`, plus either `section` spelling. Checked after
 * normalization, so the primary caller always matches on the block's own
 * `_meta`; the predicate exists for nested meta-shaped values.
 */
function looksLikeMetaV2(obj: Record<string, unknown>): boolean {
  const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
  return (
    ('section' in obj || 'section_id' in obj) &&
    isObj(obj['provenance']) &&
    isObj(obj['lifecycle'])
  );
}

/**
 * Heuristic: an object is "meta-shaped" if it carries any of the canonical
 * meta fields. We strip the excluded keys from every meta-shaped sub-object,
 * not only the top-level `_meta`, so that nested provenance (e.g. inside
 * field_overrides) hashes consistently.
 *
 * `section_id` is accepted alongside `section` because it is the spelling every
 * `.uw.md` on disk actually uses (format spec §3, and the `uwmd-block` schema's
 * own example). Requiring `section` alone meant this predicate returned false
 * for every parsed block, so the two exclusions §V.9 mandates silently never
 * applied outside of hand-built test objects — stamping a `content_hash` then
 * changed the hash it was a digest of, and INT-04 fired on untouched files.
 */
function looksLikeMeta(obj: Record<string, unknown>): boolean {
  return (
    ('section' in obj || 'section_id' in obj) &&
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
