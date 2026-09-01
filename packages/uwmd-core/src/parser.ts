// .uw.md parser — extracts frontmatter, section blocks, prose, and pipeline log
// Spec: UW_FORMAT_SPEC_v1.md §2.4 (annotation syntax), §2.7 (update semantics), §2.8 (multi-variant)

import type {
  UWBlock,
  UWFenceAnnotation,
  UWFrontmatter,
  UWMeta,
  ParsedUWFile,
  ParsedSections,
  ParseOptions,
  ConfidenceLevel,
} from './types.js';
import { SOURCE_TAGS } from './types.js';

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Opening fence: ```json uw:section=<id> [key=value ...]
const FENCE_OPEN_RE = /^```json\s+uw:section=(\S+)(.*)?$/;
// Closing fence: ``` (alone on line, optional trailing whitespace)
const FENCE_CLOSE_RE = /^```\s*$/;
// YAML frontmatter delimiter
const FRONTMATTER_RE = /^---\s*$/;
// Key=value pairs in fence annotation (value is any non-whitespace run)
const KV_RE = /(\w+)=([^\s]+)/g;

// ─── YAML frontmatter parser ──────────────────────────────────────────────────
// Deliberately implements a strict YAML SUBSET — see UW_FORMAT_SPEC_v1.md
// Appendix A "YAML subset" for the full grammar. The supported surface:
//
//   - Scalars: string (bare or single/double-quoted), number, boolean, null, ~
//   - Mappings: `key: value` and one-level nested `key:` + indented children
//   - Sequences: `- item` lines under a key
//   - Comments: `#` to end of line
//   - Empty inline arrays: `[]`
//
// Explicitly REJECTED with UNSUPPORTED_YAML_FEATURE so authors are not lulled
// into thinking these work:
//
//   - Anchors and aliases (`&name`, `*name`)
//   - Explicit tags (`!!str`, `!!int`, `!Custom`)
//   - Multi-line literal/folded scalars (`|`, `>`)
//   - Flow-style mappings or sequences (`{a: 1}`, `[1, 2, 3]` other than `[]`)
//   - Complex keys (`?` indicator)
//   - YAML directives (`%YAML`, `%TAG`)
//
// Detection runs as a pre-pass on the frontmatter lines so we can point at the
// exact line that broke the contract.

const UNSUPPORTED_YAML_PATTERNS: { pattern: RegExp; feature: string }[] = [
  // Anchor / alias indicators: `key: &name value` or `key: *name`. Must follow
  // the colon (or appear at line start as a sequence-item alias).
  { pattern: /:\s*&\w/, feature: 'YAML anchor (&name)' },
  { pattern: /:\s*\*\w/, feature: 'YAML alias (*name)' },
  { pattern: /^\s*-\s*&\w/, feature: 'YAML anchor (&name) on sequence item' },
  { pattern: /^\s*-\s*\*\w/, feature: 'YAML alias (*name) on sequence item' },
  // Explicit tags: `!!str`, `!!int`, `!Custom`. `!=` and `!==` are valid in
  // strings, so require the next char to be a letter or another `!`.
  { pattern: /:\s*!!?[A-Za-z]/, feature: 'YAML explicit tag (!! / !)' },
  // Multi-line literal/folded block scalars at end of a `key:` line.
  { pattern: /:\s*[|>][+-]?\s*(#.*)?$/, feature: 'YAML block scalar (| or >)' },
  // Complex key indicator at start of a line.
  { pattern: /^\s*\?\s/, feature: 'YAML complex key (?)' },
  // YAML directives.
  { pattern: /^%(YAML|TAG)\b/, feature: 'YAML directive (%YAML / %TAG)' },
];

export class UWMDParseError extends Error {
  readonly code: string;
  readonly line?: number;
  readonly feature?: string;
  constructor(code: string, message: string, opts: { line?: number; feature?: string } = {}) {
    super(`[${code}] ${message}`);
    this.name = 'UWMDParseError';
    this.code = code;
    this.line = opts.line;
    this.feature = opts.feature;
  }
}

function rejectUnsupportedYaml(lines: string[]): void {
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    // Strip trailing comment so `# anchor` text doesn't false-positive.
    const codePart = stripYamlComment(line);
    for (const { pattern, feature } of UNSUPPORTED_YAML_PATTERNS) {
      if (pattern.test(codePart)) {
        throw new UWMDParseError(
          'UNSUPPORTED_YAML_FEATURE',
          `Frontmatter line ${n + 1} uses ${feature}, which is not part of the .uw.md YAML subset (see UW_FORMAT_SPEC_v1.md Appendix A).`,
          { line: n + 1, feature },
        );
      }
    }
  }
}

function stripYamlComment(line: string): string {
  // Conservative: only strip `#` that follows whitespace AND is not inside
  // a quoted string. Good enough for a frontmatter-rejection pre-pass.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]!))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseYamlFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!key || key.startsWith('#')) { i++; continue; }

    // A blocked key is still parsed like any other — including the indented
    // lines beneath it — and only dropped at assignment. Skipping it outright
    // would leave its nested lines to be read as top-level keys.
    const keep = !isBlockedSegment(key);

    // Array: next lines are "  - value" items (check BEFORE nested object)
    if (rawVal === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
      const arr: unknown[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        arr.push(parseScalar(lines[i].trim().slice(2)));
        i++;
      }
      if (keep) result[key] = arr;
    } else if (rawVal === '' && i + 1 < lines.length && lines[i + 1].startsWith('  ') && !lines[i + 1].trim().startsWith('- ')) {
      // Nested object: next lines are indented key: value pairs (not array items)
      const nested: Record<string, unknown> = {};
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        const nLine = lines[i];
        if (nLine.trim() === '' || nLine.trim().startsWith('#')) { i++; continue; }
        if (nLine.trim().startsWith('- ')) { i++; continue; } // skip list items in nested context
        const nColon = nLine.indexOf(':');
        if (nColon === -1) { i++; continue; }
        const nKey = nLine.slice(0, nColon).trim();
        const nRaw = nLine.slice(nColon + 1).trim();
        if (!isBlockedSegment(nKey)) nested[nKey] = parseScalar(nRaw);
        i++;
      }
      if (keep) result[key] = nested;
    } else {
      if (keep) result[key] = parseScalar(rawVal);
      i++;
    }
  }

  return result;
}

function parseScalar(raw: string): unknown {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === '[]') return [];
  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  // Number
  const num = Number(raw);
  if (!Number.isNaN(num) && raw !== '') return num;
  return raw;
}

// ─── Fence annotation parser ──────────────────────────────────────────────────

function parseFenceAnnotation(sectionId: string, rest: string): UWFenceAnnotation {
  const annotation: UWFenceAnnotation = { section: sectionId };
  KV_RE.lastIndex = 0;
  let match = KV_RE.exec(rest);

  while (match !== null) {
    const key = match[1];
    const value = match[2];

    switch (key) {
      case 'v':
        annotation.v = Number.parseInt(value, 10);
        break;
      case 'superseded':
        annotation.superseded = value === 'true';
        break;
      case 'confidence':
        annotation.confidence = value as ConfidenceLevel;
        break;
      default:
        if (!isBlockedSegment(key)) annotation[key] = value;
    }
    match = KV_RE.exec(rest);
  }

  return annotation;
}

// ─── Multi-variant section IDs ────────────────────────────────────────────────
// These sections store parallel variants (not superseded — genuinely concurrent).

const MULTI_VARIANT_SECTIONS = new Set([
  'operating_statement',
  'stress_tests',
  'due_diligence',
]);

// Sections routed to dedicated collections rather than the main sections map
const _RESERVED_SECTION_IDS = new Set([
  'pipeline_log',
  'custom_calculations',
  'custom_scenarios',
]);

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseUWFile(content: string, options: ParseOptions = {}): ParsedUWFile {
  const { strict = false } = options;
  // `.uw.md` is a portable text format. Strip the CR component of Windows
  // CRLF endings while parsing, but retain `result.raw` byte-for-byte so Tier-2
  // editors can still preserve untouched regions of the source document.
  const lines = content.split(/\r?\n/);

  const result: ParsedUWFile = {
    frontmatter: {} as UWFrontmatter,
    sections: {},
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: content,
  };

  let i = 0;

  // ── 1. YAML Frontmatter ──────────────────────────────────────────────────────
  if (lines[0]?.trim() === '---') {
    i = 1;
    const yamlLines: string[] = [];
    while (i < lines.length && !FRONTMATTER_RE.test(lines[i])) {
      yamlLines.push(lines[i]);
      i++;
    }
    i++; // move past closing ---
    try {
      // Hard reject unsupported YAML features (anchors, tags, block scalars,
      // etc.) regardless of strict mode — these silently produced wrong data
      // before, which is worse than a clean error.
      rejectUnsupportedYaml(yamlLines);
      result.frontmatter = parseYamlFrontmatter(yamlLines.join('\n')) as UWFrontmatter;
    } catch (err) {
      if (err instanceof UWMDParseError) throw err;
      if (strict) throw new Error(`Frontmatter parse error: ${err}`);
      (result.frontmatter as Record<string, unknown>)._parse_error = String(err);
    }
  }

  // ── 2. Body scan ─────────────────────────────────────────────────────────────
  // Collect prose lines between blocks; route each block to the right collection.

  let proseLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = FENCE_OPEN_RE.exec(line);

    if (!fenceMatch) {
      proseLines.push(line);
      i++;
      continue;
    }

    // ── We hit a section block ─────────────────────────────────────────────────
    const sectionId = fenceMatch[1];
    const restAnnotation = fenceMatch[2] ?? '';
    const annotation = parseFenceAnnotation(sectionId, restAnnotation);
    const lineStart = i + 1; // 1-indexed

    const capturedProse = proseLines.join('\n').trim();
    proseLines = [];

    // Collect JSON lines until closing ```
    i++;
    const jsonLines: string[] = [];
    while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
      jsonLines.push(lines[i]);
      i++;
    }

    // A recognized UW section fence must be closed. Treating the remainder of
    // the document as malformed JSON in non-strict mode can silently swallow
    // every following section, which is unsafe for an underwriting record.
    if (i >= lines.length) {
      throw new UWMDParseError(
        'UNCLOSED_SECTION_FENCE',
        `Section '${sectionId}' opened at line ${lineStart} has no closing fence.`,
        { line: lineStart },
      );
    }

    const lineEnd = i + 1; // 1-indexed, closing ```
    i++; // move past closing ```

    const rawJson = jsonLines.join('\n');
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch (err) {
      if (strict) {
        throw new Error(`JSON parse error in section ${sectionId} at line ${lineStart}: ${err}`);
      }
      parsed = { _parse_error: String(err), _raw: rawJson };
    }

    const meta = interpretMetaSource((parsed['_meta'] as UWMeta | undefined) ?? ({} as UWMeta));

    const block: UWBlock = {
      annotation,
      meta,
      content: parsed,
      prose: capturedProse,
      rawJson,
      lineStart,
      lineEnd,
    };

    routeBlock(result, block, sectionId, annotation, capturedProse);
  }

  return result;
}

// ─── §2.6 read-time source interpretation (RFC 0031) ─────────────────────────

/** Every canonical tag except `manual`, which is a legal actor in its own
 *  right and never reinterpreted. */
const LEGACY_RESOLUTION_TAGS: ReadonlySet<string> = new Set(
  SOURCE_TAGS.filter((t) => t !== 'manual'),
);

/**
 * A canonical `SOURCE_TAGS` value found in `_meta.source` is a resolution
 * method in the actor field (the pre-RFC-0031 spelling). Readers MUST
 * interpret it as `resolution` and MUST NOT invent an actor from it — so the
 * parsed view gains `resolution` while `source` keeps the raw spelling for
 * diagnostics (`SRC-02` warns on it, and authority classification treats it
 * as no actor class at all).
 *
 * Returns a **clone** when it rewrites: `content._meta` is bytes-derived and
 * feeds canonicalization/digests, so the interpreted view must never mutate
 * it. A producer that already stamped its own `resolution` wins — the legacy
 * spelling is then merely wrong, not information.
 */
function interpretMetaSource(meta: UWMeta): UWMeta {
  const src = meta.source;
  if (typeof src !== 'string' || !LEGACY_RESOLUTION_TAGS.has(src)) return meta;
  if (meta.resolution !== undefined) return meta;
  return { ...meta, resolution: src };
}

// ─── Block routing ────────────────────────────────────────────────────────────

function routeBlock(
  result: ParsedUWFile,
  block: UWBlock,
  sectionId: string,
  annotation: UWFenceAnnotation,
  prose: string,
): void {
  // Pipeline log — always append
  if (sectionId === 'pipeline_log') {
    result.pipeline_log.push(block);
    return;
  }

  // Custom sections — always append (order matters; last is newest)
  if (sectionId === 'custom_calculations') {
    result.custom_calculations.push(block);
    return;
  }
  if (sectionId === 'custom_scenarios') {
    result.custom_scenarios.push(block);
    return;
  }

  // Extension sections (x_ prefix)
  if (sectionId.startsWith('x_')) {
    result.extensions[sectionId] = block;
    return;
  }

  // Explicitly superseded block — goes to superseded archive, not current sections
  if (annotation.superseded === true || block.meta?.superseded === true) {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(block);
    return;
  }

  // Multi-variant sections — keyed by variant, multiple concurrent instances allowed
  if (MULTI_VARIANT_SECTIONS.has(sectionId)) {
    const variant = annotation.variant ?? 'default';
    const existing = result.sections[sectionId];

    if (!existing || !isMultiVariantMap(existing)) {
      result.sections[sectionId] = { [variant]: block };
    } else {
      const variantMap = existing as { [v: string]: UWBlock };
      const current = variantMap[variant];

      if (!current) {
        variantMap[variant] = block;
      } else {
        // Replace if newer version
        const currentV = current.annotation.v ?? current.meta?.version ?? 1;
        const newV = annotation.v ?? block.meta?.version ?? 1;
        if (newV > currentV) {
          if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
          result.superseded[sectionId].push(current);
          variantMap[variant] = block;
        } else {
          if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
          result.superseded[sectionId].push(block);
        }
      }
    }
    if (!result.prose[sectionId]) result.prose[sectionId] = prose;
    return;
  }

  // Standard single-variant section
  const existing = result.sections[sectionId] as UWBlock | undefined;

  if (!existing) {
    result.sections[sectionId] = block;
    result.prose[sectionId] = prose;
    return;
  }

  // Resolve version conflict: keep higher version as current
  const existingBlock = existing as UWBlock;
  const existingV = existingBlock.annotation.v ?? existingBlock.meta?.version ?? 1;
  const newV = annotation.v ?? block.meta?.version ?? 1;

  if (newV > existingV) {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(existingBlock);
    result.sections[sectionId] = block;
    result.prose[sectionId] = prose;
  } else {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(block);
  }
}

function isMultiVariantMap(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  // A UWBlock has annotation, meta, content — a variant map has string keys pointing to blocks
  return !('annotation' in (val as object));
}

// ─── Convenience: get current block for a section ─────────────────────────────

export function getSection(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if (isMultiVariantMap(entry)) return null; // use getSectionVariant for multi-variant
  return entry as UWBlock;
}

export function getSectionVariant(
  parsed: ParsedUWFile,
  sectionId: string,
  variant: string,
): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry || !isMultiVariantMap(entry)) return null;
  return (entry as { [v: string]: UWBlock })[variant] ?? null;
}

// ─── Path segment safety ─────────────────────────────────────────────────────
// Paths and keys in a `.uw.md` file are document-authored: a path can name any
// segment the author types. These three are the doors from a plain property
// lookup back onto JS internals, so navigation never follows them and key
// writes never create them.

const BLOCKED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** True if `segment` must not be read from or written to a document object. */
export function isBlockedSegment(segment: string): boolean {
  return BLOCKED_SEGMENTS.has(segment);
}

/**
 * One step of path navigation, own-properties only. A blocked segment or an
 * inherited member resolves to `undefined` — the same answer a missing path
 * gives, which callers already handle (protocol §VIII.2: a missing path
 * resolves to null, not an error).
 */
export function getPathSegment(current: unknown, segment: string): unknown {
  if (current === null || current === undefined) return undefined;
  if (isBlockedSegment(segment)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
  return (current as Record<string, unknown>)[segment];
}

// ─── Deep get utility (for cross-section checks) ─────────────────────────────
// Resolves dot-path notation: "noi_model.net_operating_income"
// Array indices: "dcf.annual_cash_flows[0].net_cash_flow_levered"

export function deepGet(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = getPathSegment(current, part);
  }
  return current;
}
