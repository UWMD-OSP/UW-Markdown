import type { UWCodec } from './codec.js';
import { encodeXML, decodeXML } from './xml-mapping.js';
import type { UWDocumentEnvelope } from './envelope.js';
export const UW_XML_REPRESENTATION_VERSION = '2.0.0' as const;
export const UW_XML_MEDIA_TYPE = 'application/vnd.uwmd.document+xml' as const;
export const UW_XML_NAMESPACE = 'https://uwmd.org/ns/document/2' as const;
export interface UWXmlOptions { maxBytes?: number; maxDepth?: number; }
export class UWXmlError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'UWXmlError'; this.code = code; }
}
export async function stringifyUWXml(envelope: UWDocumentEnvelope): Promise<string> {
  try { return await encodeXML(envelope); } catch (error) { throw new UWXmlError('XML_INVALID', String(error)); }
}
export async function parseUWXml(text: string, options: UWXmlOptions = {}): Promise<UWDocumentEnvelope> {
  try { return await decodeXML(text, options); } catch (error) { throw new UWXmlError('XML_INVALID', String(error)); }
}
export async function parseUWXmlVerified(text: string, options: UWXmlOptions = {}): Promise<UWDocumentEnvelope> {
  return parseUWXml(text, options);
}
export const UW_XML_CODEC: UWCodec<string> = {
  descriptor: { id: 'uw-xml', media_types: [UW_XML_MEDIA_TYPE], file_extensions: ['.uw.xml'], directions: ['read', 'write'], fidelity: 'model', representation_version: UW_XML_REPRESENTATION_VERSION, max_bytes: 50 * 1024 * 1024 },
  encode: stringifyUWXml, decode: parseUWXml,
};
