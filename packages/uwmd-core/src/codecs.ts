import { CodecRegistry } from './codec.js';
import type { UWDocumentEnvelope } from './envelope.js';
import { UW_JSON_CODEC } from './uwjson.js';
import { UW_XML_CODEC } from './uwxml.js';

export const CORE_CODEC_REGISTRY = new CodecRegistry([UW_JSON_CODEC, UW_XML_CODEC]);

export async function encodeUWDocument(
  representationId: string,
  envelope: UWDocumentEnvelope,
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): Promise<unknown> {
  return registry.encode(representationId, envelope);
}

export async function decodeUWDocument(
  representationId: string,
  input: unknown,
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): Promise<UWDocumentEnvelope> {
  return registry.decode(representationId, input);
}
