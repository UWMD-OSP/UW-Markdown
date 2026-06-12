// .uw.json — lossless sibling serialization of a .uw.md file
//
// A `.uw.json` document is the structured, machine-first projection of a `.uw.md`
// file. Unlike the `json` render target (renderer.ts), which is a *lossy* current-
// state data view (drops prose, provenance, fence annotations, and superseded
// history), this serialization is *lossless*: every block keeps its `_meta`
// provenance, its fence annotation, the prose that preceded it, and the full
// append-only supersede history. That makes the round trip
//
//     .uw.md → parseUWFile → toUWJson → stringifyUWJson      (export)
//     .uw.json → parseUWJson → fromUWJson → ParsedUWFile     (re-hydrate)
//
// faithful at the model level, so a viewer/editor can load `.uw.json`, run the
// deterministic validator + calc packs against it, and present provenance badges —
// exactly the same surfaces it would have from the Markdown form.
//
// Scope note: this is a *library-provided* serialization, not (yet) a normative
// sibling of the `.uw.md` format. It does not change spec/, the JSON Schemas, or
// the protocol, and carries its own independent `uwjson_version`. Promoting
// `.uw.json` to a normative format with its own JSON Schema + conformance tier is
// future RFC work — see docs/wiki/03-core-library.md and docs/wiki/11.

import type {
  ParsedUWFile,
  ParsedSections,
  UWBlock,
  UWFenceAnnotation,
  UWFrontmatter,
  UWMeta,
} from './types.js';

/**
 * Version of the `.uw.json` serialization itself. Independent of the `.uw.md`
 * format version (which travels in `format_version` / `frontmatter.uw_version`).
 */
export const UWJSON_VERSION = '1.1';

export class UWJsonError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWJsonError';
    this.code = code;
  }
}

/**
 * A single block in `.uw.json` form. Carries everything needed to reconstruct
 * the equivalent `.uw.md` data block except parse artifacts (line numbers and
 * the raw JSON string), which are regenerated on re-hydration.
 */
export interface UWJsonBlock {
  annotation: UWFenceAnnotation;
  meta: UWMeta;
  content: Record<string, unknown>;
  /** Markdown prose that immediately preceded the block. Omitted when empty. */
  prose?: string;
}

type UWJsonSectionEntry = UWJsonBlock | { [variant: string]: UWJsonBlock };

export interface UWJsonDocument {
  /** Version of the .uw.json serialization. */
  uwjson_version: string;
  /** Mirrors frontmatter.uw_version — the .uw.md format version of the source. */
  format_version: string;
  /** ISO8601 timestamp of when this document was produced. */
  generated_at?: string;
  /** Tool that produced this document, e.g. "@uwmd/core". */
  generator?: string;
  frontmatter: UWFrontmatter;
  /** Section-level prose, keyed by section id (mirrors ParsedUWFile.prose). */
  prose: { [sectionId: string]: string };
  sections: { [sectionId: string]: UWJsonSectionEntry };
  pipeline_log: UWJsonBlock[];
  custom_calculations: UWJsonBlock[];
  custom_scenarios: UWJsonBlock[];
  extensions: { [extensionId: string]: UWJsonBlock };
  /** Append-only supersede history. Present (possibly empty) for lossless export. */
  superseded: { [sectionId: string]: UWJsonBlock[] };
}

export interface ToUWJsonOptions {
  /**
   * Include the append-only supersede history. Default true (lossless). Set
   * false to emit a compacted document with only current blocks — equivalent to
   * exporting a `uwmd compact`ed file.
   */
  includeSuperseded?: boolean;
  /** Value for `generated_at`. Default `new Date().toISOString()`. */
  generatedAt?: string;
  /** Value for `generator`. Default `@uwmd/core`. */
  generator?: string;
}

// ─── Export: ParsedUWFile → UWJsonDocument ────────────────────────────────────

function blockToJson(block: UWBlock): UWJsonBlock {
  const out: UWJsonBlock = {
    annotation: block.annotation,
    meta: block.meta,
    content: block.content,
  };
  if (block.prose && block.prose.length > 0) out.prose = block.prose;
  return out;
}

function isVariantMap(entry: UWJsonSectionEntry | ParsedSections[string]): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  return !('annotation' in (entry as object));
}

export function toUWJson(parsed: ParsedUWFile, opts: ToUWJsonOptions = {}): UWJsonDocument {
  const includeSuperseded = opts.includeSuperseded ?? true;

  const sections: { [sectionId: string]: UWJsonSectionEntry } = {};
  for (const [id, entry] of Object.entries(parsed.sections)) {
    if (isVariantMap(entry)) {
      sections[id] = Object.fromEntries(
        Object.entries(entry as { [v: string]: UWBlock }).map(([v, b]) => [v, blockToJson(b)]),
      );
    } else {
      sections[id] = blockToJson(entry as UWBlock);
    }
  }

  const superseded: { [sectionId: string]: UWJsonBlock[] } = {};
  if (includeSuperseded) {
    for (const [id, blocks] of Object.entries(parsed.superseded)) {
      superseded[id] = blocks.map(blockToJson);
    }
  }

  return {
    uwjson_version: UWJSON_VERSION,
    format_version: parsed.frontmatter.uw_version ?? '1.1',
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    generator: opts.generator ?? '@uwmd/core',
    frontmatter: parsed.frontmatter,
    prose: parsed.prose,
    sections,
    pipeline_log: parsed.pipeline_log.map(blockToJson),
    custom_calculations: parsed.custom_calculations.map(blockToJson),
    custom_scenarios: parsed.custom_scenarios.map(blockToJson),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([k, b]) => [k, blockToJson(b)]),
    ),
    superseded,
  };
}

/** Convenience: produce the pretty-printed `.uw.json` text for a parsed file. */
export function stringifyUWJson(parsed: ParsedUWFile, opts: ToUWJsonOptions = {}): string {
  return `${JSON.stringify(toUWJson(parsed, opts), null, 2)}\n`;
}

// ─── Import: text → UWJsonDocument → ParsedUWFile ─────────────────────────────

/**
 * Parse and shallow-validate `.uw.json` text. Throws UWJsonError with a
 * descriptive code on malformed input. This is a structural check, not a full
 * schema validation (financial validity lives in validateUWFile).
 */
export function parseUWJson(text: string): UWJsonDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new UWJsonError('UWJSON_INVALID_JSON', `Not valid JSON: ${String(err)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new UWJsonError('UWJSON_NOT_OBJECT', 'Document root must be a JSON object.');
  }
  const doc = raw as Partial<UWJsonDocument>;
  if (typeof doc.uwjson_version !== 'string') {
    throw new UWJsonError('UWJSON_MISSING_VERSION', 'Missing or non-string `uwjson_version`.');
  }
  if (typeof doc.frontmatter !== 'object' || doc.frontmatter === null) {
    throw new UWJsonError('UWJSON_MISSING_FRONTMATTER', 'Missing or invalid `frontmatter`.');
  }
  if (typeof doc.sections !== 'object' || doc.sections === null) {
    throw new UWJsonError('UWJSON_MISSING_SECTIONS', 'Missing or invalid `sections`.');
  }
  // Normalize optional collections so downstream consumers can assume presence.
  return {
    uwjson_version: doc.uwjson_version,
    format_version: doc.format_version ?? (doc.frontmatter as UWFrontmatter).uw_version ?? '1.1',
    generated_at: doc.generated_at,
    generator: doc.generator,
    frontmatter: doc.frontmatter as UWFrontmatter,
    prose: doc.prose ?? {},
    sections: doc.sections as { [sectionId: string]: UWJsonSectionEntry },
    pipeline_log: doc.pipeline_log ?? [],
    custom_calculations: doc.custom_calculations ?? [],
    custom_scenarios: doc.custom_scenarios ?? [],
    extensions: doc.extensions ?? {},
    superseded: doc.superseded ?? {},
  };
}

function jsonBlockToUWBlock(b: UWJsonBlock): UWBlock {
  // Line numbers are parse artifacts of the .uw.md form; they have no meaning in
  // .uw.json. Regenerate rawJson from content so calc/validation surfaces that
  // read it still work; positions are 0 (not sourced from a Markdown file).
  return {
    annotation: b.annotation,
    meta: b.meta,
    content: b.content,
    prose: b.prose ?? '',
    rawJson: JSON.stringify(b.content),
    lineStart: 0,
    lineEnd: 0,
  };
}

/**
 * Re-hydrate a UWJsonDocument into the in-memory ParsedUWFile model — the same
 * shape parseUWFile produces — so the validator, renderer, calc engine, and
 * packs can operate on a `.uw.json` source directly.
 *
 * Note: `raw` is set to '' because there is no canonical Markdown byte stream
 * backing a `.uw.json`. Tier-2 byte-preserving edits (applyEdit) require the
 * Markdown source; a viewer/validator/calc consumer does not.
 */
export function fromUWJson(doc: UWJsonDocument): ParsedUWFile {
  const sections: ParsedSections = {};
  for (const [id, entry] of Object.entries(doc.sections)) {
    if (isVariantMap(entry)) {
      sections[id] = Object.fromEntries(
        Object.entries(entry as { [v: string]: UWJsonBlock }).map(([v, b]) => [
          v,
          jsonBlockToUWBlock(b),
        ]),
      );
    } else {
      sections[id] = jsonBlockToUWBlock(entry as UWJsonBlock);
    }
  }

  return {
    frontmatter: doc.frontmatter,
    sections,
    prose: doc.prose ?? {},
    pipeline_log: (doc.pipeline_log ?? []).map(jsonBlockToUWBlock),
    custom_calculations: (doc.custom_calculations ?? []).map(jsonBlockToUWBlock),
    custom_scenarios: (doc.custom_scenarios ?? []).map(jsonBlockToUWBlock),
    extensions: Object.fromEntries(
      Object.entries(doc.extensions ?? {}).map(([k, b]) => [k, jsonBlockToUWBlock(b)]),
    ),
    superseded: Object.fromEntries(
      Object.entries(doc.superseded ?? {}).map(([k, blocks]) => [
        k,
        blocks.map(jsonBlockToUWBlock),
      ]),
    ),
    raw: '',
  };
}
