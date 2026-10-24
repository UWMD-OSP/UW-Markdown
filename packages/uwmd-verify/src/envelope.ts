import { admitsCarrierSchema } from './carrier-schema.js';
import { hasBlockShape } from './block-kind.js';
// UW Document Envelope — format-neutral semantic model shared by machine codecs.

import { canonicalize } from './integrity-canonical.js';
import { assertJSONValue, snapshotJSONValue } from './json-admission.js';
import { mapExtensionEntry, extensionBlocks, compareExtensionIdentity } from './extension-entry.js';
import { parsedPhysicalBlocks, retainParsedPhysicalBlocks } from './parser.js';
import { sha256TextHex } from './integrity.js';
import { SUPPORTED_FORMAT_VERSIONS } from './types.js';
import type {
  ParsedSections,
  ParsedUWFile,
  UWBlock,
  UWFenceAnnotation,
  UWFrontmatter,
  UWMeta,
  UWExtensionEntry,
} from './types.js';

export const UW_ENVELOPE_VERSION = '2.0' as const;

export interface UWEnvelopeBlock {
  annotation: UWFenceAnnotation;
  /** Complete fenced JSON object. `_meta` appears here exactly once. */
  content: Record<string, unknown>;
  /** Markdown immediately preceding this exact block. */
  prose?: string;
}

export type UWEnvelopeSectionEntry =
  | UWEnvelopeBlock
  | Record<string, UWEnvelopeBlock>;

export type UWEnvelopeExtensionEntry = UWExtensionEntry<UWEnvelopeBlock>;
const retainedBlockExtras = new WeakMap<UWBlock, Record<string, unknown>>();
const retainedOuterExtras = new WeakMap<ParsedUWFile, Record<string, unknown>>();
const retainedEmptyProse = new WeakSet<UWBlock>();

export interface UWDocumentEnvelope {
  envelope_version: typeof UW_ENVELOPE_VERSION;
  format_version: string;
  generated_at?: string;
  generator?: string;
  semantic_digest?: string;
  frontmatter: UWFrontmatter;
  sections: Record<string, UWEnvelopeSectionEntry>;
  pipeline_log: UWEnvelopeBlock[];
  custom_calculations: UWEnvelopeBlock[];
  custom_scenarios: UWEnvelopeBlock[];
  extensions: Record<string, UWEnvelopeExtensionEntry>;
  superseded: Record<string, UWEnvelopeBlock[]>;
  [key: string]: unknown;
}

export interface ToEnvelopeOptions {
  generatedAt?: string;
  generator?: string;
}

export interface EnvelopeDigestVerification {
  valid: boolean;
  expected: string;
  actual?: string;
}

export class UWEnvelopeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWEnvelopeError';
    this.code = code;
  }
}

export function toUWEnvelope(
  parsed: ParsedUWFile,
  options: ToEnvelopeOptions = {},
): UWDocumentEnvelope {
  if (Object.hasOwn(options, 'includeSuperseded')) {
    throw new UWEnvelopeError('ENVELOPE_UNSUPPORTED_OPTION', 'Record exports always retain supplied history (RFC 0085).');
  }
  const sections: Record<string, UWEnvelopeSectionEntry> = {};
  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    if (isVariantMap(entry)) {
      sections[sectionId] = Object.fromEntries(
        Object.entries(entry as Record<string, UWBlock>).map(([variant, block]) => [
          variant,
          toEnvelopeBlock(block),
        ]),
      );
    } else {
      sections[sectionId] = toEnvelopeBlock(entry as UWBlock);
    }
  }

  const superseded: Record<string, UWEnvelopeBlock[]> = {};
  for (const [sectionId, blocks] of Object.entries(parsed.superseded)) {
    superseded[sectionId] = blocks.map(toEnvelopeBlock);
  }

  const envelope: UWDocumentEnvelope = {
    ...retainedOuterExtras.get(parsed),
    envelope_version: UW_ENVELOPE_VERSION,
    format_version: parsed.frontmatter.uw_version,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    // The default generator label stayed `@uwmd/core` through the RFC 0083
    // split, so envelopes, UW JSON and every downstream output (batch, lake)
    // are byte-identical whichever package produced them. Changing it is its
    // own decision, not a side effect of the split.
    generator: options.generator ?? '@uwmd/core',
    frontmatter: parsed.frontmatter,
    sections,
    pipeline_log: parsed.pipeline_log.map(toEnvelopeBlock),
    custom_calculations: parsed.custom_calculations.map(toEnvelopeBlock),
    custom_scenarios: parsed.custom_scenarios.map(toEnvelopeBlock),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([id, entry]) => [id, mapExtensionEntry(entry, toEnvelopeBlock)]),
    ),
    superseded,
  };
  const physical = parsedPhysicalBlocks(parsed);
  if (physical.length) {
    const accounted = [
      ...Object.values(parsed.sections).flatMap(entry => hasBlockShape(entry) ? [entry as UWBlock] : Object.values(entry)),
      ...parsed.pipeline_log, ...parsed.custom_calculations, ...parsed.custom_scenarios,
      ...Object.values(parsed.extensions).flatMap(extensionBlocks), ...Object.values(parsed.superseded).flat(),
    ];
    if (accounted.length !== physical.length || physical.some(block => accounted.filter(current => current === block).length !== 1)) {
      throw new UWEnvelopeError('ENVELOPE_SOURCE_ACCOUNTING', 'Every retained physical block must occur exactly once in the complete projection.');
    }
  }
  assertJSONValue(envelope);
  return envelope;
}

export function fromUWEnvelope(envelope: UWDocumentEnvelope): ParsedUWFile {
  assertUWEnvelope(envelope);

  const sections: ParsedSections = {};
  const prose: Record<string, string> = {};
  for (const [sectionId, entry] of Object.entries(envelope.sections)) {
    if (isVariantMap(entry)) {
      const variants = Object.fromEntries(
        Object.entries(entry as Record<string, UWEnvelopeBlock>).map(([variant, block]) => [
          variant,
          fromEnvelopeBlock(block, `${sectionId}.${variant}`),
        ]),
      );
      sections[sectionId] = variants;
      const firstProse = Object.values(variants).find((block) => block.prose.length > 0)?.prose;
      if (firstProse) prose[sectionId] = firstProse;
    } else {
      const block = fromEnvelopeBlock(entry as UWEnvelopeBlock, sectionId);
      sections[sectionId] = block;
      if (block.prose.length > 0) prose[sectionId] = block.prose;
    }
  }

  const parsed: ParsedUWFile = {
    frontmatter: envelope.frontmatter,
    sections,
    prose,
    pipeline_log: envelope.pipeline_log.map((block, index) =>
      fromEnvelopeBlock(block, `pipeline_log[${index}]`),
    ),
    custom_calculations: envelope.custom_calculations.map((block, index) =>
      fromEnvelopeBlock(block, `custom_calculations[${index}]`),
    ),
    custom_scenarios: envelope.custom_scenarios.map((block, index) =>
      fromEnvelopeBlock(block, `custom_scenarios[${index}]`),
    ),
    extensions: Object.fromEntries(
      Object.entries(envelope.extensions).map(([id, entry]) => [
        id,
        mapExtensionEntry(entry, block => fromEnvelopeBlock(block, `extensions.${id}`)),
      ]),
    ),
    superseded: Object.fromEntries(
      Object.entries(envelope.superseded).map(([sectionId, blocks]) => [
        sectionId,
        blocks.map((block, index) =>
          fromEnvelopeBlock(block, `superseded.${sectionId}[${index}]`),
        ),
      ]),
    ),
    raw: '',
  };
  const standard = new Set(['envelope_version', 'format_version', 'generated_at', 'generator', 'semantic_digest', 'frontmatter', 'sections', 'pipeline_log', 'custom_calculations', 'custom_scenarios', 'extensions', 'superseded']);
  retainedOuterExtras.set(parsed, Object.fromEntries(Object.entries(envelope).filter(([key]) => !standard.has(key))));
  // This inventory represents model occurrences only, never attributable Markdown.
  retainParsedPhysicalBlocks(parsed, [
    ...Object.values(parsed.sections).flatMap(entry => hasBlockShape(entry) ? [entry as UWBlock] : Object.values(entry)),
    ...parsed.pipeline_log, ...parsed.custom_calculations, ...parsed.custom_scenarios,
    ...Object.values(parsed.extensions).flatMap(extensionBlocks), ...Object.values(parsed.superseded).flat(),
  ]);
  return parsed;
}

/** Canonical semantic input. Volatile serialization fields are excluded. */
export function envelopeSemanticValue(
  envelope: UWDocumentEnvelope,
): Omit<UWDocumentEnvelope, 'generated_at' | 'generator' | 'semantic_digest'> {
  assertJSONValue(envelope);
  const { generated_at: _generatedAt, generator: _generator, semantic_digest: _digest, ...semantic } =
    envelope;
  return semantic;
}

export function canonicalizeUWEnvelope(envelope: UWDocumentEnvelope): string {
  return canonicalize(envelopeSemanticValue(envelope));
}

export async function computeEnvelopeDigest(envelope: UWDocumentEnvelope): Promise<string> {
  return `sha256:${await sha256TextHex(canonicalizeUWEnvelope(envelope))}`;
}

export async function stampEnvelopeDigest(
  envelope: UWDocumentEnvelope,
): Promise<UWDocumentEnvelope> {
  const snapshot = snapshotJSONValue(envelope);
  const semantic_digest = await computeEnvelopeDigest(snapshot);
  return { ...snapshot, semantic_digest };
}

export async function verifyEnvelopeDigest(
  envelope: UWDocumentEnvelope,
): Promise<EnvelopeDigestVerification> {
  const expected = await computeEnvelopeDigest(envelope);
  return {
    valid: envelope.semantic_digest === expected,
    expected,
    actual: envelope.semantic_digest,
  };
}

export function areEnvelopesEquivalent(
  left: UWDocumentEnvelope,
  right: UWDocumentEnvelope,
): boolean {
  return canonicalizeUWEnvelope(left) === canonicalizeUWEnvelope(right);
}

export function assertUWEnvelope(value: unknown): asserts value is UWDocumentEnvelope {
  assertJSONValue(value);
  if (!isRecord(value)) {
    throw new UWEnvelopeError('ENVELOPE_NOT_OBJECT', 'Document root must be an object.');
  }
  if (value['envelope_version'] !== UW_ENVELOPE_VERSION) {
    throw new UWEnvelopeError(
      'ENVELOPE_UNSUPPORTED_VERSION',
      `Expected envelope_version "${UW_ENVELOPE_VERSION}".`,
    );
  }
  if (typeof value['format_version'] !== 'string') {
    throw new UWEnvelopeError('ENVELOPE_MISSING_FORMAT_VERSION', 'format_version must be a string.');
  }
  if (!isRecord(value['frontmatter'])) {
    throw new UWEnvelopeError('ENVELOPE_MISSING_FRONTMATTER', 'frontmatter must be an object.');
  }
  // One format (RFC 0081 D1): both version statements must name it.
  for (const [where, declared] of [
    ['format_version', value['format_version']],
    ['frontmatter.uw_version', value['frontmatter']['uw_version']],
  ] as const) {
    if (!(SUPPORTED_FORMAT_VERSIONS as readonly unknown[]).includes(declared)) {
      throw new UWEnvelopeError(
        'UNSUPPORTED_FORMAT_VERSION',
        `Declared ${where} ${JSON.stringify(declared) ?? 'absent'} is unsupported; supported value is "${SUPPORTED_FORMAT_VERSIONS[0]}".`,
      );
    }
  }
  if (!admitsCarrierSchema(value)) throw new UWEnvelopeError('ENVELOPE_INVALID_SCHEMA', 'Model does not satisfy the current full carrier schema.');
  if (!isRecord(value['sections'])) {
    throw new UWEnvelopeError('ENVELOPE_MISSING_SECTIONS', 'sections must be an object.');
  }
  for (const [sectionId, entry] of Object.entries(value['sections'])) {
    if (hasBlockShape(entry)) {
      assertEnvelopeBlock(entry, `sections.${sectionId}`);
      assertBlockIdentity(entry, sectionId);
      continue;
    }
    if (!isRecord(entry) || Object.keys(entry).length === 0) {
      throw new UWEnvelopeError(
        'ENVELOPE_INVALID_VARIANTS',
        `sections.${sectionId} must be a block or non-empty variant map.`,
      );
    }
    for (const [variant, block] of Object.entries(entry)) {
      assertEnvelopeBlock(block, `sections.${sectionId}.${variant}`);
      assertBlockIdentity(block, sectionId);
    }
  }
  for (const key of ['pipeline_log', 'custom_calculations', 'custom_scenarios'] as const) {
    const collection = value[key];
    if (!Array.isArray(collection)) {
      throw new UWEnvelopeError('ENVELOPE_MISSING_COLLECTION', `${key} must be an array.`);
    }
    collection.forEach((block, index) => assertEnvelopeBlock(block, `${key}[${index}]`));
  }
  if (!isRecord(value['extensions'])) {
    throw new UWEnvelopeError('ENVELOPE_MISSING_COLLECTION', 'extensions must be an object.');
  }
  for (const [id, raw] of Object.entries(value['extensions'])) {
    if (!isRecord(raw) || (raw.mode !== 'single' && raw.mode !== 'variants')) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} requires a declared mode.`);
    const expected = raw.mode === 'single' ? ['mode', 'block'] : ['mode', 'blocks'];
    if (Object.keys(raw).sort().join('\0') !== expected.sort().join('\0')) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} wrapper is closed.`);
    if (!id.startsWith('x_')) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', 'Extension identifiers require x_.');
    const entry = raw as unknown as UWEnvelopeExtensionEntry;
    if (entry.mode === 'variants') {
      if (!Array.isArray(entry.blocks) || !entry.blocks.length) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} needs nonempty records.`);
      let previous: string | null = null;
      for (const [index, record] of entry.blocks.entries()) {
        if (!isRecord(record) || Object.keys(record).sort().join('\0') !== 'block\0variant' ||
          (record.variant !== null && typeof record.variant !== 'string') ||
          (index > 0 && compareExtensionIdentity(previous, record.variant) >= 0)) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} has invalid/duplicate/noncanonical identity records.`);
        assertEnvelopeBlock(record.block, `extensions.${id}`);
        if (record.variant !== (record.block.annotation.variant ?? null)) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} identity disagrees with annotation.`);
        previous = record.variant;
      }
    }
    for (const block of extensionBlocks(entry)) {
      assertEnvelopeBlock(block, `extensions.${id}`);
      if (block.annotation.section !== id || block.content._meta && (block.content._meta as UWMeta).section !== id ||
        block.annotation.superseded === true || (block.content._meta as UWMeta).lifecycle?.superseded === true) throw new UWEnvelopeError('ENVELOPE_INVALID_EXTENSION', `extensions.${id} active identity/history mismatch.`);
    }
  }
  if (!isRecord(value['superseded'])) {
    throw new UWEnvelopeError('ENVELOPE_MISSING_COLLECTION', 'superseded must be an object.');
  }
  for (const [sectionId, blocks] of Object.entries(value['superseded'])) {
    if (!Array.isArray(blocks)) {
      throw new UWEnvelopeError(
        'ENVELOPE_INVALID_SUPERSEDED',
        `superseded.${sectionId} must be an array.`,
      );
    }
    blocks.forEach((block, index) => {
      assertEnvelopeBlock(block, `superseded.${sectionId}[${index}]`);
      assertBlockIdentity(block, sectionId);
    });
  }
  const digest = value['semantic_digest'];
  if (digest !== undefined && (typeof digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(digest))) {
    throw new UWEnvelopeError(
      'ENVELOPE_INVALID_DIGEST',
      'semantic_digest must be sha256 followed by 64 lowercase hex characters.',
    );
  }
}

function assertBlockIdentity(block: UWEnvelopeBlock, section: string): void {
  if (block.annotation.section !== section || (block.content['_meta'] as UWMeta).section !== section) throw new UWEnvelopeError('ENVELOPE_INVALID_IDENTITY', 'Collection, annotation and metadata section identities must agree.');
}
function assertEnvelopeBlock(value: unknown, pointer: string): asserts value is UWEnvelopeBlock {
  if (!isRecord(value) || !isRecord(value['annotation']) || !isRecord(value['content'])) {
    throw new UWEnvelopeError('ENVELOPE_INVALID_BLOCK', `${pointer} is not a valid block.`);
  }
  if (typeof value['annotation']['section'] !== 'string' || (Object.hasOwn(value['annotation'], 'variant') && typeof value['annotation']['variant'] !== 'string')) {
    throw new UWEnvelopeError(
      'ENVELOPE_INVALID_ANNOTATION',
      `${pointer}.annotation.section must be a string.`,
    );
  }
  if (!isRecord(value['content']['_meta'])) {
    throw new UWEnvelopeError(
      'ENVELOPE_MISSING_META',
      `${pointer}.content._meta must be an object.`,
    );
  }
  if (value['annotation']['section'] !== value['content']['_meta']['section']) throw new UWEnvelopeError('ENVELOPE_INVALID_IDENTITY', `${pointer} annotation and metadata section identities must agree.`);
  if (value['prose'] !== undefined && typeof value['prose'] !== 'string') {
    throw new UWEnvelopeError('ENVELOPE_INVALID_PROSE', `${pointer}.prose must be a string.`);
  }
}
function toEnvelopeBlock(block: UWBlock): UWEnvelopeBlock {
  const output: UWEnvelopeBlock = {
    ...retainedBlockExtras.get(block),
    annotation: block.annotation,
    content: block.content,
  };
  if (block.prose.length > 0 || retainedEmptyProse.has(block)) output.prose = block.prose;
  return output;
}

function fromEnvelopeBlock(block: UWEnvelopeBlock, pointer: string): UWBlock {
  if (!isRecord(block) || !isRecord(block.annotation) || !isRecord(block.content)) {
    throw new UWEnvelopeError('ENVELOPE_INVALID_BLOCK', `${pointer} is not a valid block.`);
  }
  const meta = block.content['_meta'];
  if (!isRecord(meta)) {
    throw new UWEnvelopeError(
      'ENVELOPE_MISSING_META',
      `${pointer}.content._meta must be an object.`,
    );
  }
  const parsed: UWBlock = {
    annotation: block.annotation as UWFenceAnnotation,
    meta: meta as unknown as UWMeta,
    content: block.content,
    prose: typeof block.prose === 'string' ? block.prose : '',
    rawJson: JSON.stringify(block.content),
    lineStart: 0,
    lineEnd: 0,
  };
  if (Object.hasOwn(block, 'prose') && block.prose === '') retainedEmptyProse.add(parsed);
  retainedBlockExtras.set(parsed, Object.fromEntries(Object.entries(block).filter(([key]) => !['annotation', 'content', 'prose'].includes(key))));
  return parsed;
}

function isVariantMap(entry: UWEnvelopeSectionEntry | ParsedSections[string]): boolean {
  return isRecord(entry) && !hasBlockShape(entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
