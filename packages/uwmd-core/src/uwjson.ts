import { CodecRegistry, type UWCodec } from './codec.js';
import {
  assertUWEnvelope,
  fromUWEnvelope,
  stampEnvelopeDigest,
  toUWEnvelope,
  verifyEnvelopeDigest,
  type ToEnvelopeOptions,
  type UWDocumentEnvelope,
} from './envelope.js';
import type { ParsedUWFile } from './types.js';

export const UW_JSON_REPRESENTATION_VERSION = '1.0.0' as const;
export const UW_JSON_MEDIA_TYPE = 'application/vnd.uwmd.document+json' as const;

export class UWJsonError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWJsonError';
    this.code = code;
  }
}

export type ToUWJsonOptions = ToEnvelopeOptions;

export function toUWJson(
  parsed: ParsedUWFile,
  options: ToUWJsonOptions = {},
): UWDocumentEnvelope {
  return toUWEnvelope(parsed, options);
}

export function stringifyUWEnvelope(envelope: UWDocumentEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function stringifyUWJson(
  parsed: ParsedUWFile,
  options: ToUWJsonOptions = {},
): string {
  return stringifyUWEnvelope(toUWJson(parsed, options));
}

export async function stringifyUWJsonWithDigest(
  parsed: ParsedUWFile,
  options: ToUWJsonOptions = {},
): Promise<string> {
  return stringifyUWEnvelope(await stampEnvelopeDigest(toUWJson(parsed, options)));
}

export function parseUWJson(text: string): UWDocumentEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new UWJsonError('JSON_INVALID', `Not valid JSON: ${String(error)}`);
  }
  assertUWEnvelope(value);
  return value;
}

export async function parseUWJsonVerified(text: string): Promise<UWDocumentEnvelope> {
  const envelope = parseUWJson(text);
  const verification = await verifyEnvelopeDigest(envelope);
  if (!verification.actual) {
    throw new UWJsonError('JSON_DIGEST_MISSING', 'semantic_digest is required.');
  }
  if (!verification.valid) {
    throw new UWJsonError(
      'JSON_DIGEST_MISMATCH',
      `semantic_digest is ${verification.actual}; expected ${verification.expected}.`,
    );
  }
  return envelope;
}

export function fromUWJson(envelope: UWDocumentEnvelope): ParsedUWFile {
  return fromUWEnvelope(envelope);
}

export const UW_JSON_CODEC: UWCodec<string> = {
  descriptor: {
    id: 'uw-json',
    media_types: [UW_JSON_MEDIA_TYPE],
    file_extensions: ['.uw.json'],
    directions: ['read', 'write'],
    fidelity: 'model',
    representation_version: UW_JSON_REPRESENTATION_VERSION,
  },
  encode: async (envelope) => stringifyUWEnvelope(await stampEnvelopeDigest(envelope)),
  decode: parseUWJsonVerified,
};

export const CORE_CODEC_REGISTRY = new CodecRegistry([UW_JSON_CODEC]);

export function encodeUWDocument(
  representationId: string,
  envelope: UWDocumentEnvelope,
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): Promise<unknown> {
  return registry.encode(representationId, envelope);
}

export function decodeUWDocument(
  representationId: string,
  input: unknown,
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): Promise<UWDocumentEnvelope> {
  return registry.decode(representationId, input);
}
