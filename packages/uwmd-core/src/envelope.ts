// UW Document Envelope — format-neutral semantic model shared by machine codecs.

import { canonicalizeExact } from './integrity-canonical.js';
import { sha256TextHex } from './integrity.js';
import type {
  ParsedSections,
  ParsedUWFile,
  UWBlock,
  UWFenceAnnotation,
  UWFrontmatter,
  UWMeta,
} from './types.js';

export const UW_ENVELOPE_VERSION = '1.0' as const;

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
  extensions: Record<string, UWEnvelopeBlock>;
  superseded: Record<string, UWEnvelopeBlock[]>;
  [key: string]: unknown;
}

export interface ToEnvelopeOptions {
  /** Default true. False intentionally emits a compacted, model-lossy archive. */
  includeSuperseded?: boolean;
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
  if (options.includeSuperseded ?? true) {
    for (const [sectionId, blocks] of Object.entries(parsed.superseded)) {
      superseded[sectionId] = blocks.map(toEnvelopeBlock);
    }
  }

  return {
    envelope_version: UW_ENVELOPE_VERSION,
    format_version: parsed.frontmatter.uw_version ?? '1.1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    generator: options.generator ?? '@uwmd/core',
    frontmatter: parsed.frontmatter,
    sections,
    pipeline_log: parsed.pipeline_log.map(toEnvelopeBlock),
    custom_calculations: parsed.custom_calculations.map(toEnvelopeBlock),
    custom_scenarios: parsed.custom_scenarios.map(toEnvelopeBlock),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([id, block]) => [id, toEnvelopeBlock(block)]),
    ),
    superseded,
  };
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

  return {
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
      Object.entries(envelope.extensions).map(([id, block]) => [
        id,
        fromEnvelopeBlock(block, `extensions.${id}`),
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
}

/** Canonical semantic input. Volatile serialization fields are excluded. */
export function envelopeSemanticValue(
  envelope: UWDocumentEnvelope,
): Omit<UWDocumentEnvelope, 'generated_at' | 'generator' | 'semantic_digest'> {
  const { generated_at: _generatedAt, generator: _generator, semantic_digest: _digest, ...semantic } =
    envelope;
  return semantic;
}

export function canonicalizeUWEnvelope(envelope: UWDocumentEnvelope): string {
  return canonicalizeExact(envelopeSemanticValue(envelope));
}

export async function computeEnvelopeDigest(envelope: UWDocumentEnvelope): Promise<string> {
  return `sha256:${await sha256TextHex(canonicalizeUWEnvelope(envelope))}`;
}

export async function stampEnvelopeDigest(
  envelope: UWDocumentEnvelope,
): Promise<UWDocumentEnvelope> {
  return { ...envelope, semantic_digest: await computeEnvelopeDigest(envelope) };
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
  if (!isRecord(value['sections'])) {
    throw new UWEnvelopeError('ENVELOPE_MISSING_SECTIONS', 'sections must be an object.');
  }
  for (const [sectionId, entry] of Object.entries(value['sections'])) {
    if (isRecord(entry) && 'annotation' in entry) {
      assertEnvelopeBlock(entry, `sections.${sectionId}`);
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
  for (const [id, block] of Object.entries(value['extensions'])) {
    assertEnvelopeBlock(block, `extensions.${id}`);
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
    blocks.forEach((block, index) =>
      assertEnvelopeBlock(block, `superseded.${sectionId}[${index}]`),
    );
  }
  const digest = value['semantic_digest'];
  if (digest !== undefined && (typeof digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(digest))) {
    throw new UWEnvelopeError(
      'ENVELOPE_INVALID_DIGEST',
      'semantic_digest must be sha256 followed by 64 lowercase hex characters.',
    );
  }
}

function assertEnvelopeBlock(value: unknown, pointer: string): asserts value is UWEnvelopeBlock {
  if (!isRecord(value) || !isRecord(value['annotation']) || !isRecord(value['content'])) {
    throw new UWEnvelopeError('ENVELOPE_INVALID_BLOCK', `${pointer} is not a valid block.`);
  }
  if (typeof value['annotation']['section'] !== 'string') {
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
  if (value['prose'] !== undefined && typeof value['prose'] !== 'string') {
    throw new UWEnvelopeError('ENVELOPE_INVALID_PROSE', `${pointer}.prose must be a string.`);
  }
}
function toEnvelopeBlock(block: UWBlock): UWEnvelopeBlock {
  const output: UWEnvelopeBlock = {
    annotation: block.annotation,
    content: block.content,
  };
  if (block.prose.length > 0) output.prose = block.prose;
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
  return {
    annotation: block.annotation as UWFenceAnnotation,
    meta: meta as unknown as UWMeta,
    content: block.content,
    prose: typeof block.prose === 'string' ? block.prose : '',
    rawJson: JSON.stringify(block.content),
    lineStart: 0,
    lineEnd: 0,
  };
}

function isVariantMap(entry: UWEnvelopeSectionEntry | ParsedSections[string]): boolean {
  return isRecord(entry) && !('annotation' in entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
