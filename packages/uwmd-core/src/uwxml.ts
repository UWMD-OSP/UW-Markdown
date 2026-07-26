import { XMLParser } from 'fast-xml-parser';
import type { UWCodec } from './codec.js';
import {
  assertUWEnvelope,
  stampEnvelopeDigest,
  verifyEnvelopeDigest,
  type UWDocumentEnvelope,
} from './envelope.js';

export const UW_XML_REPRESENTATION_VERSION = '1.0.0' as const;
export const UW_XML_MEDIA_TYPE = 'application/vnd.uwmd.document+xml' as const;
export const UW_XML_NAMESPACE = 'https://uwmd.org/ns/document/1' as const;

export interface UWXmlOptions {
  maxBytes?: number;
  maxDepth?: number;
}

export class UWXmlError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWXmlError';
    this.code = code;
  }
}

const TOP_LEVEL_ORDER = [
  'generated_at',
  'generator',
  'semantic_digest',
  'frontmatter',
  'sections',
  'pipeline_log',
  'custom_calculations',
  'custom_scenarios',
  'extensions',
  'superseded',
] as const;

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 64;
const SAFE_ELEMENT_NAME = /^[A-Za-z_][A-Za-z0-9._-]*$/;

export async function stringifyUWXml(envelope: UWDocumentEnvelope): Promise<string> {
  const stamped = await stampEnvelopeDigest(envelope);
  const keys = new Set(Object.keys(stamped));
  keys.delete('envelope_version');
  keys.delete('format_version');
  for (const key of TOP_LEVEL_ORDER) keys.delete(key);
  const orderedKeys = [
    ...TOP_LEVEL_ORDER.filter((key) => key in stamped),
    ...[...keys].sort(),
  ];

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<uw:document xmlns:uw="${UW_XML_NAMESPACE}" envelope-version="${escapeAttribute(stamped.envelope_version)}" format-version="${escapeAttribute(stamped.format_version)}">`,
  ];
  for (const key of orderedKeys) {
    lines.push(...encodeMember(key, stamped[key], 1));
  }
  lines.push('</uw:document>');
  return `${lines.join('\n')}\n`;
}

export async function parseUWXml(
  text: string,
  options: UWXmlOptions = {},
): Promise<UWDocumentEnvelope> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) {
    throw new UWXmlError('XML_SIZE_LIMIT', `Input is ${bytes} bytes; limit is ${maxBytes}.`);
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new UWXmlError('XML_DTD_FORBIDDEN', 'DTD and entity declarations are forbidden.');
  }

  let parsed: unknown;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: false,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
      processEntities: true,
      maxNestedTags: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      strictReservedNames: true,
      isArray: (tagName) => tagName === 'uw:item' || tagName === 'uw:member',
    }).parse(text);
  } catch (error) {
    throw new UWXmlError('XML_INVALID', `Could not parse XML: ${String(error)}`);
  }
  if (!isRecord(parsed) || !isRecord(parsed['uw:document'])) {
    throw new UWXmlError('XML_ROOT_INVALID', 'Root element must be uw:document.');
  }
  const root = parsed['uw:document'];
  assertOnlyKeys(
    root,
    'document',
    new Set(['@_xmlns:uw', '@_envelope-version', '@_format-version', '#text', ...Object.keys(root).filter((key) => key.startsWith('uw:'))]),
  );
  assertStructuralWhitespace(root, 'document');
  if (root['@_xmlns:uw'] !== UW_XML_NAMESPACE) {
    throw new UWXmlError('XML_NAMESPACE_INVALID', `Root namespace must be ${UW_XML_NAMESPACE}.`);
  }
  const envelope: Record<string, unknown> = {
    envelope_version: requiredAttribute(root, 'envelope-version'),
    format_version: requiredAttribute(root, 'format-version'),
  };
  for (const [key, value] of decodeObjectMembers(root, 'document', 0, options.maxDepth ?? DEFAULT_MAX_DEPTH)) {
    if (key in envelope) {
      throw new UWXmlError('XML_DUPLICATE_MEMBER', `Duplicate document member "${key}".`);
    }
    envelope[key] = value;
  }
  assertUWEnvelope(envelope);
  if (envelope.semantic_digest) {
    const verification = await verifyEnvelopeDigest(envelope);
    if (!verification.valid) {
      throw new UWXmlError(
        'XML_DIGEST_MISMATCH',
        `semantic_digest is ${verification.actual}; expected ${verification.expected}.`,
      );
    }
  }
  return envelope;
}

export async function parseUWXmlVerified(
  text: string,
  options: UWXmlOptions = {},
): Promise<UWDocumentEnvelope> {
  const envelope = await parseUWXml(text, options);
  if (!envelope.semantic_digest) {
    throw new UWXmlError('XML_DIGEST_MISSING', 'semantic_digest is required.');
  }
  return envelope;
}
export const UW_XML_CODEC: UWCodec<string> = {
  descriptor: {
    id: 'uw-xml',
    media_types: [UW_XML_MEDIA_TYPE],
    file_extensions: ['.uw.xml'],
    directions: ['read', 'write'],
    fidelity: 'model',
    representation_version: UW_XML_REPRESENTATION_VERSION,
  },
  encode: stringifyUWXml,
  decode: parseUWXmlVerified,
};

function encodeMember(key: string, value: unknown, depth: number): string[] {
  const safe = SAFE_ELEMENT_NAME.test(key) && key !== 'item' && key !== 'member';
  const tag = safe ? key : 'member';
  const name = safe ? '' : ` name="${escapeAttribute(key)}"`;
  return encodeValue(tag, value, depth, name);
}

function encodeValue(tag: string, value: unknown, depth: number, attributes = ''): string[] {
  const indent = '  '.repeat(depth);
  if (value === null) return [`${indent}<uw:${tag} uw:type="null"${attributes}/>`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${indent}<uw:${tag} uw:type="array"${attributes}/>`];
    return [
      `${indent}<uw:${tag} uw:type="array"${attributes}>`,
      ...value.flatMap((item) => encodeValue('item', item, depth + 1)),
      `${indent}</uw:${tag}>`,
    ];
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    if (keys.length === 0) return [`${indent}<uw:${tag} uw:type="object"${attributes}/>`];
    return [
      `${indent}<uw:${tag} uw:type="object"${attributes}>`,
      ...keys.flatMap((key) => encodeMember(key, value[key], depth + 1)),
      `${indent}</uw:${tag}>`,
    ];
  }
  if (typeof value === 'string') {
    return [`${indent}<uw:${tag} uw:type="string"${attributes}>${escapeText(value)}</uw:${tag}>`];
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new UWXmlError('XML_NUMBER_INVALID', 'Cannot encode a non-finite number.');
    return [`${indent}<uw:${tag} uw:type="number"${attributes}>${Object.is(value, -0) ? '0' : String(value)}</uw:${tag}>`];
  }
  if (typeof value === 'boolean') {
    return [`${indent}<uw:${tag} uw:type="boolean"${attributes}>${String(value)}</uw:${tag}>`];
  }
  throw new UWXmlError('XML_VALUE_UNSUPPORTED', `Cannot encode value of type ${typeof value}.`);
}

function decodeValue(
  node: unknown,
  pointer: string,
  depth: number,
  maxDepth: number,
  allowName = false,
): unknown {
  if (depth > maxDepth) throw new UWXmlError('XML_DEPTH_LIMIT', `${pointer} exceeds depth ${maxDepth}.`);
  if (!isRecord(node)) throw new UWXmlError('XML_VALUE_INVALID', `${pointer} must be an element.`);
  const type = node['@_uw:type'];
  if (typeof type !== 'string') throw new UWXmlError('XML_TYPE_MISSING', `${pointer} is missing uw:type.`);
  const allowedAttributes = new Set(allowName ? ['@_uw:type', '@_name'] : ['@_uw:type']);
  const invalidAttribute = Object.keys(node).find(
    (key) => key.startsWith('@_') && !allowedAttributes.has(key),
  );
  if (invalidAttribute) {
    throw new UWXmlError('XML_UNEXPECTED_ATTRIBUTE', `${pointer} contains unexpected ${invalidAttribute}.`);
  }
  const text = typeof node['#text'] === 'string' ? node['#text'] : '';
  switch (type) {
    case 'null':
      assertNoValueChildren(node, pointer);
      return null;
    case 'string':
      assertNoValueChildren(node, pointer);
      return text;
    case 'number': {
      assertNoValueChildren(node, pointer);
      if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) {
        throw new UWXmlError('XML_NUMBER_INVALID', `${pointer} is not a JSON number.`);
      }
      const value = Number(text);
      if (!Number.isFinite(value)) throw new UWXmlError('XML_NUMBER_INVALID', `${pointer} is not finite.`);
      return value;
    }
    case 'boolean':
      assertNoValueChildren(node, pointer);
      if (text !== 'true' && text !== 'false') {
        throw new UWXmlError('XML_BOOLEAN_INVALID', `${pointer} must be true or false.`);
      }
      return text === 'true';
    case 'array': {
      assertStructuralWhitespace(node, pointer);
      assertOnlyKeys(node, pointer, new Set([...allowedAttributes, '#text', 'uw:item']));
      const items = node['uw:item'];
      if (items === undefined) return [];
      if (!Array.isArray(items)) throw new UWXmlError('XML_ARRAY_INVALID', `${pointer}.item must repeat.`);
      return items.map((item, index) => decodeValue(item, `${pointer}[${index}]`, depth + 1, maxDepth));
    }
    case 'object':
      assertStructuralWhitespace(node, pointer);
      return Object.fromEntries(decodeObjectMembers(node, pointer, depth + 1, maxDepth));
    default:
      throw new UWXmlError('XML_TYPE_INVALID', `${pointer} has unsupported uw:type "${type}".`);
  }
}

function decodeObjectMembers(
  node: Record<string, unknown>,
  pointer: string,
  depth: number,
  maxDepth: number,
): Array<[string, unknown]> {
  if (depth > maxDepth) throw new UWXmlError('XML_DEPTH_LIMIT', `${pointer} exceeds depth ${maxDepth}.`);
  const output: Array<[string, unknown]> = [];
  const seen = new Set<string>();
  for (const [tag, raw] of Object.entries(node)) {
    if (tag.startsWith('@_') || tag === '#text') continue;
    if (!tag.startsWith('uw:')) {
      throw new UWXmlError('XML_UNEXPECTED_MEMBER', `${pointer} contains unexpected ${tag}.`);
    }
    const localTag = tag.slice(3);
    if (localTag === 'item') {
      throw new UWXmlError('XML_MEMBER_NAME_INVALID', `${pointer} must encode the reserved key item with uw:member.`);
    }
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (!isRecord(value)) throw new UWXmlError('XML_VALUE_INVALID', `${pointer}.${tag} is invalid.`);
      const key = localTag === 'member' ? value['@_name'] : localTag;
      if (typeof key !== 'string' || key.length === 0) {
        throw new UWXmlError('XML_MEMBER_NAME_INVALID', `${pointer}.member requires name.`);
      }
      if (seen.has(key)) throw new UWXmlError('XML_DUPLICATE_MEMBER', `${pointer} repeats "${key}".`);
      seen.add(key);
      output.push([key, decodeValue(value, `${pointer}.${key}`, depth, maxDepth, localTag === 'member')]);
    }
  }
  return output;
}

function assertStructuralWhitespace(node: Record<string, unknown>, pointer: string): void {
  const text = node['#text'];
  if (typeof text === 'string' && text.trim().length > 0) {
    throw new UWXmlError('XML_STRUCTURAL_TEXT', `${pointer} cannot contain text outside value elements.`);
  }
}
function assertNoValueChildren(node: Record<string, unknown>, pointer: string): void {
  assertOnlyKeys(node, pointer, new Set(['@_uw:type', '@_name', '#text']));
}

function assertOnlyKeys(node: Record<string, unknown>, pointer: string, allowed: Set<string>): void {
  const invalid = Object.keys(node).find((key) => !allowed.has(key));
  if (invalid) throw new UWXmlError('XML_UNEXPECTED_MEMBER', `${pointer} contains unexpected ${invalid}.`);
}

function requiredAttribute(node: Record<string, unknown>, name: string): string {
  const value = node[`@_${name}`];
  if (typeof value !== 'string') throw new UWXmlError('XML_ATTRIBUTE_MISSING', `document requires ${name}.`);
  return value;
}

function escapeText(value: string): string {
  assertXmlCharacters(value);
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function assertXmlCharacters(value: string): void {
  for (let index = 0; index < value.length; index++) {
    const code = value.codePointAt(index) ?? 0;
    if (code > 0xffff) index++;
    const valid =
      code === 0x9 ||
      code === 0xa ||
      code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
    if (!valid) {
      throw new UWXmlError('XML_CHARACTER_INVALID', `U+${code.toString(16)} is not valid XML 1.0.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
