import { zipSync } from 'fflate';
import type { UWCodec } from './codec.js';
import { extractZipSafely } from './zip-safety.js';
import { encodeCSV, decodeCSV, flatten } from './csv-mapping.js';
import { descriptors } from './carrier-values.js';
import { assertUWEnvelope, toUWEnvelope, type UWDocumentEnvelope } from './envelope.js';
import type { ParsedUWFile } from './types.js';
export const UW_CSV_BUNDLE_VERSION = '2.0.0' as const;
export const UW_CSV_BUNDLE_MEDIA_TYPE = 'application/vnd.uwmd.csv-bundle+zip' as const;
export interface UWCSVBundle { files: Record<string, string>; }
export interface UWCSVDecodeOptions { maxCompressedBytes?: number; maxUncompressedBytes?: number; maxFiles?: number; maxCompressionRatio?: number; }
export type UWJSONValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
export interface UWBlockValueRow { block_ref: string; scope: 'annotation' | 'meta' | 'content' | 'block-extra'; pointer: string; json_type: UWJSONValueType; value_json: string; }
export class UWCSVError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'UWCSVError'; this.code = code; }
}
export async function encodeUWCSVBundle(envelope: UWDocumentEnvelope): Promise<UWCSVBundle> {
  try { return { files: await encodeCSV(envelope) }; } catch (error) { throw carrierError(error); }
}
function carrierError(error: unknown): UWCSVError {
  const reason = String(error);
  return new UWCSVError(reason.includes('CSV raw byte count') ? 'CSV_SIZE_MISMATCH' : reason.includes('CSV raw byte hash') ? 'CSV_HASH_MISMATCH' : 'CSV_INVALID', reason);
}
export async function decodeUWCSVBundle(bundle: UWCSVBundle, options: UWCSVDecodeOptions = {}): Promise<UWDocumentEnvelope> {
  try { return await decodeCSV(bundle.files, options); } catch (error) { throw carrierError(error); }
}
export async function encodeUWCSVZip(envelope: UWDocumentEnvelope): Promise<Uint8Array> {
  const { files } = await encodeUWCSVBundle(envelope);
  const input: Record<string, [Uint8Array, {level: 6; mtime: Date}]> = {};
  for (const path of Object.keys(files).sort()) input[path] = [new TextEncoder().encode(files[path]), {level: 6, mtime: new Date('1980-01-02T00:00:00Z')}];
  return zipSync(input);
}
export async function decodeUWCSVZip(input: Uint8Array, options: UWCSVDecodeOptions = {}): Promise<UWDocumentEnvelope> {
  const files = extractZipSafely(input, options, (violation, message) => { throw new UWCSVError(`CSV_${violation}`, message); });
  // Keep bytes untouched until the manifest inventory has been checked.
  try { return await decodeCSV(files, options); } catch (error) { throw carrierError(error); }
}
export const UW_CSV_BUNDLE_CODEC: UWCodec<Uint8Array> = {
  descriptor: { id: 'uw-csv-bundle', media_types: [UW_CSV_BUNDLE_MEDIA_TYPE], file_extensions: ['.uw.csv.zip'], directions: ['read', 'write'], fidelity: 'model', representation_version: UW_CSV_BUNDLE_VERSION, max_bytes: 50 * 1024 * 1024 },
  encode: encodeUWCSVZip, decode: decodeUWCSVZip,
};
/** Complete fact rows. Stored identity remains the caller's explicitly supplied subject. */
export function flattenEnvelopeBlockValues(envelope: UWDocumentEnvelope): UWBlockValueRow[] {
  assertUWEnvelope(envelope);
  return projectBlockValues(envelope);
}
/** Source fact projection records findings without claiming full carrier admission. */
export function flattenUWSourceBlockValues(parsed: ParsedUWFile): UWBlockValueRow[] {
  return projectBlockValues(toUWEnvelope(parsed));
}
function projectBlockValues(envelope: UWDocumentEnvelope): UWBlockValueRow[] {
  const rows: UWBlockValueRow[] = [];
  for (const row of descriptors(envelope)) {
    const { _meta, ...content } = row.block.content;
    const extra = Object.fromEntries(Object.entries(row.block).filter(([key]) => !['annotation', 'content', 'prose'].includes(key)));
    const scopes = {annotation: row.block.annotation, meta: _meta, content, 'block-extra': extra};
    for (const scope of ['annotation', 'meta', 'content', 'block-extra'] as const) for (const [pointer, json_type, value_json] of flatten(scopes[scope])) rows.push({block_ref: row.ref, scope, pointer, json_type: json_type as UWJSONValueType, value_json});
  }
  return rows;
}
