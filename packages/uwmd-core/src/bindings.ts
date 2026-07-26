import type { CodecRegistry } from './codec.js';
import { CORE_CODEC_REGISTRY } from './codecs.js';
import {
  assertUWEnvelope,
  fromUWEnvelope,
  stampEnvelopeDigest,
  toUWEnvelope,
  type UWDocumentEnvelope,
} from './envelope.js';
import { applyEditAsync, type EditContext, type EditOptions } from './editor.js';
import {
  negotiateRepresentation,
  RepresentationNegotiationError,
  resolveInputRepresentation,
} from './negotiation.js';
import { parseUWFile } from './parser.js';
import type { EditOperation, RepresentationCapability } from './protocol.js';
import { encodeUWCSVBundle } from './uwcsv.js';
import { UW_JSON_MEDIA_TYPE } from './uwjson.js';
import { validateUWFile } from './validator.js';

export const UWMD_PUBLIC_ORIGIN = 'https://uwmd.org' as const;
export const UWMD_DEAL_RESOURCE_TEMPLATE = 'https://uwmd.org/deals/{deal_id}{?representation,view}' as const;

export type UWHTTPBody = string | Uint8Array;

export interface UWHTTPResponse {
  status: 200 | 304;
  headers: Record<string, string>;
  body?: UWHTTPBody;
  representation_id: string;
}

export interface UWHTTPResponseOptions {
  accept?: string;
  ifNoneMatch?: string;
  minimumFidelity?: 'source' | 'model' | 'view';
  registry?: CodecRegistry;
}

export class UWBindingError extends Error {
  readonly code: string;
  readonly status: 400 | 406 | 409 | 412 | 415 | 428;

  constructor(code: string, status: UWBindingError['status'], message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWBindingError';
    this.code = code;
    this.status = status;
  }
}

export function uwmdDealResourceURI(
  dealId: string,
  options: { representation?: string; view?: UWCSVView } = {},
): string {
  if (dealId.length === 0) throw new UWBindingError('BINDING_DEAL_ID_REQUIRED', 400, 'deal_id is required.');
  const url = new URL(`/deals/${encodeURIComponent(dealId)}`, UWMD_PUBLIC_ORIGIN);
  if (options.representation && options.representation !== 'uw-json') {
    url.searchParams.set('representation', options.representation);
  }
  if (options.view) url.searchParams.set('view', options.view);
  return url.href;
}

export function uwmdETag(envelope: UWDocumentEnvelope): string {
  if (!envelope.semantic_digest) {
    throw new UWBindingError('BINDING_DIGEST_REQUIRED', 400, 'A stamped semantic_digest is required.');
  }
  return `"${envelope.semantic_digest}"`;
}

export async function createUWHTTPResponse(
  envelope: UWDocumentEnvelope,
  options: UWHTTPResponseOptions = {},
): Promise<UWHTTPResponse> {
  assertUWEnvelope(envelope);
  const registry = options.registry ?? CORE_CODEC_REGISTRY;
  const stamped = await stampEnvelopeDigest(envelope);
  const selected = negotiateRepresentation(
    options.accept ?? UW_JSON_MEDIA_TYPE,
    preferredDescriptors(registry),
    { direction: 'write', minimum_fidelity: options.minimumFidelity ?? 'model' },
  );
  const etag = uwmdETag(stamped);
  const headers: Record<string, string> = {
    'Content-Type': selected.media_type,
    ETag: etag,
    Vary: 'Accept',
    'UWMD-Semantic-Digest': stamped.semantic_digest ?? '',
  };
  if (etagListMatches(options.ifNoneMatch, etag, true)) {
    return { status: 304, headers, representation_id: selected.descriptor.id };
  }
  const encoded = await registry.encode<unknown>(selected.descriptor.id, stamped);
  if (typeof encoded !== 'string' && !(encoded instanceof Uint8Array)) {
    throw new UWBindingError('BINDING_BODY_UNSUPPORTED', 400, `${selected.descriptor.id} returned an unsupported body type.`);
  }
  headers['Content-Length'] = String(typeof encoded === 'string' ? new TextEncoder().encode(encoded).byteLength : encoded.byteLength);
  if (encoded instanceof Uint8Array) {
    const dealId = String(stamped.frontmatter.deal_id ?? 'document').replaceAll(/[^A-Za-z0-9._-]/g, '_');
    headers['Content-Disposition'] = `attachment; filename="${dealId}.uw.csv.zip"`;
  }
  return { status: 200, headers, body: encoded, representation_id: selected.descriptor.id };
}

export async function decodeUWHTTPRequest(
  contentType: string,
  body: UWHTTPBody,
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): Promise<UWDocumentEnvelope> {
  let selected: ReturnType<typeof resolveInputRepresentation>;
  try {
    selected = resolveInputRepresentation(contentType, preferredDescriptors(registry));
  } catch (error) {
    if (error instanceof RepresentationNegotiationError) {
      throw new UWBindingError(error.code, error.status, error.message);
    }
    throw error;
  }
  let input: string | Uint8Array = body;
  if (selected.descriptor.id === 'uw-csv-bundle') {
    if (!(body instanceof Uint8Array)) {
      throw new UWBindingError('BINDING_BINARY_BODY_REQUIRED', 400, 'UW CSV bundle requests require binary bytes.');
    }
  } else if (body instanceof Uint8Array) {
    try {
      input = new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch (error) {
      throw new UWBindingError('BINDING_UTF8_INVALID', 400, `Text representation is not valid UTF-8: ${String(error)}`);
    }
  }
  return registry.decode(selected.descriptor.id, input);
}

export async function assertUWIfMatch(
  ifMatch: string | undefined,
  envelope: UWDocumentEnvelope,
  options: { required?: boolean } = {},
): Promise<string> {
  assertUWEnvelope(envelope);
  const stamped = await stampEnvelopeDigest(envelope);
  const etag = uwmdETag(stamped);
  if (!ifMatch) {
    if (options.required ?? true) {
      throw new UWBindingError('BINDING_PRECONDITION_REQUIRED', 428, 'If-Match is required for this write.');
    }
    return etag;
  }
  if (!etagListMatches(ifMatch, etag, false)) {
    throw new UWBindingError('BINDING_PRECONDITION_FAILED', 412, 'If-Match does not match the current semantic digest.');
  }
  return etag;
}

export type UWCSVView =
  | 'deal_summary'
  | 'rent_roll'
  | 'operating_statement'
  | 'debt'
  | 'valuation'
  | 'sources_uses';

export interface UWMCPTextResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export interface UWMCPBlobResourceContent {
  uri: string;
  mimeType: string;
  blob: string;
}

export type UWMCPResourceContent = UWMCPTextResourceContent | UWMCPBlobResourceContent;

export interface UWMCPResourceLink {
  type: 'resource_link';
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export interface UWMCPTextContent {
  type: 'text';
  text: string;
}

export interface UWMCPToolResult {
  content: Array<UWMCPTextContent | UWMCPResourceLink>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface UWMCPDocumentOptions {
  representation?: string;
  view?: UWCSVView;
  registry?: CodecRegistry;
}

export async function createUWMCPResource(
  envelope: UWDocumentEnvelope,
  dealId: string,
  options: UWMCPDocumentOptions = {},
): Promise<UWMCPResourceContent> {
  assertUWEnvelope(envelope);
  const stamped = await stampEnvelopeDigest(envelope);
  assertDealIdentity(stamped, dealId);
  if (options.view && options.representation && options.representation !== 'uw-json') {
    throw new UWBindingError('BINDING_SELECTION_CONFLICT', 400, 'view and a non-default representation are mutually exclusive.');
  }
  if (options.view) {
    const bundle = await encodeUWCSVBundle(stamped);
    const path = `views/${options.view}.csv`;
    const text = bundle.files[path];
    if (text === undefined) {
      throw new UWBindingError('BINDING_VIEW_UNAVAILABLE', 406, `${options.view} is unavailable because its source section is absent.`);
    }
    return {
      uri: uwmdDealResourceURI(dealId, { view: options.view }),
      mimeType: 'text/csv; charset=utf-8',
      text,
    };
  }
  const registry = options.registry ?? CORE_CODEC_REGISTRY;
  const representation = options.representation ?? 'uw-json';
  const descriptor = registry.get(representation).descriptor;
  const encoded = await registry.encode<unknown>(representation, stamped);
  const uri = uwmdDealResourceURI(dealId, { representation });
  const mimeType = descriptor.media_types[0] ?? 'application/octet-stream';
  if (typeof encoded === 'string') return { uri, mimeType, text: encoded };
  if (encoded instanceof Uint8Array) return { uri, mimeType, blob: bytesToBase64(encoded) };
  throw new UWBindingError('BINDING_BODY_UNSUPPORTED', 400, `${representation} returned an unsupported resource type.`);
}

export async function createUWMCPGetDocumentResult(
  envelope: UWDocumentEnvelope,
  dealId: string,
  options: UWMCPDocumentOptions = {},
): Promise<UWMCPToolResult> {
  assertUWEnvelope(envelope);
  const stamped = await stampEnvelopeDigest(envelope);
  assertDealIdentity(stamped, dealId);
  const representation = options.view ? undefined : options.representation ?? 'uw-json';
  let resourceURI: string;
  let mediaType: string;
  if (options.view) {
    const viewResource = await createUWMCPResource(stamped, dealId, options);
    resourceURI = viewResource.uri;
    mediaType = viewResource.mimeType;
  } else {
    const registry = options.registry ?? CORE_CODEC_REGISTRY;
    const descriptor = registry.get(representation ?? 'uw-json').descriptor;
    resourceURI = uwmdDealResourceURI(dealId, { representation });
    mediaType = descriptor.media_types[0] ?? 'application/octet-stream';
  }
  const profile = options.view ?? representation ?? 'uw-json';
  const summary = {
    deal_id: dealId,
    resource_uri: resourceURI,
    ...(representation ? { representation_id: representation } : {}),
    ...(options.view ? { view: options.view } : {}),
    fidelity: options.view ? 'view' : 'model',
    media_type: mediaType,
    semantic_digest: stamped.semantic_digest,
  };
  return dualMCPResult(summary, {
    type: 'resource_link',
    uri: resourceURI,
    name: `${dealId}-${profile}`,
    title: `${dealId} (${profile})`,
    description: options.view ? 'Lossy UW Markdown view.' : 'Complete model-fidelity UW Markdown representation.',
    mimeType: mediaType,
  });
}

export async function createUWMCPValidationResult(
  envelope: UWDocumentEnvelope,
  dealId: string,
): Promise<UWMCPToolResult> {
  assertUWEnvelope(envelope);
  const stamped = await stampEnvelopeDigest(envelope);
  assertDealIdentity(stamped, dealId);
  const validation = validateUWFile(fromUWEnvelope(stamped));
  return dualMCPResult({
    deal_id: dealId,
    resource_uri: uwmdDealResourceURI(dealId),
    semantic_digest: stamped.semantic_digest,
    ...validation,
  });
}

export function createUWMCPListRepresentationsResult(
  registry: CodecRegistry = CORE_CODEC_REGISTRY,
): UWMCPToolResult {
  return dualMCPResult({
    resource_template: UWMD_DEAL_RESOURCE_TEMPLATE,
    representations: preferredDescriptors(registry),
    views: ['deal_summary', 'rent_roll', 'operating_statement', 'debt', 'valuation', 'sources_uses'],
  });
}

export interface UWSourceEditResult {
  source: string;
  envelope: UWDocumentEnvelope;
  etag: string;
  newVersion?: number;
  supersededPriorBlock?: boolean;
}

export async function applyUWMDSourceEdit(
  source: string,
  operation: EditOperation,
  context: EditContext,
  ifMatch: string | undefined,
  options: EditOptions = { integrity: true, maintainGaps: true },
): Promise<UWSourceEditResult> {
  const parsed = parseUWFile(source);
  const current = await stampEnvelopeDigest(toUWEnvelope(parsed));
  await assertUWIfMatch(ifMatch, current);
  const edited = await applyEditAsync(source, parsed, operation, context, undefined, options);
  if (!edited.ok || !edited.content) {
    throw new UWBindingError(
      edited.error?.code ?? 'BINDING_EDIT_REJECTED',
      409,
      edited.error?.message ?? 'The protocol edit was rejected.',
    );
  }
  const envelope = await stampEnvelopeDigest(toUWEnvelope(parseUWFile(edited.content)));
  return {
    source: edited.content,
    envelope,
    etag: uwmdETag(envelope),
    newVersion: edited.newVersion,
    supersededPriorBlock: edited.supersededPriorBlock,
  };
}

export async function createUWMCPApplyEditResult(
  source: string,
  operation: EditOperation,
  context: EditContext,
  ifMatch: string | undefined,
): Promise<{ edit: UWSourceEditResult; result: UWMCPToolResult }> {
  const edit = await applyUWMDSourceEdit(source, operation, context, ifMatch);
  const dealId = String(edit.envelope.frontmatter.deal_id ?? 'document');
  const summary = {
    ok: true,
    deal_id: dealId,
    resource_uri: uwmdDealResourceURI(dealId),
    semantic_digest: edit.envelope.semantic_digest,
    etag: edit.etag,
    new_version: edit.newVersion,
    superseded_prior_block: edit.supersededPriorBlock ?? false,
  };
  return {
    edit,
    result: dualMCPResult(summary, {
      type: 'resource_link',
      uri: summary.resource_uri,
      name: `${dealId}-uw-json`,
      title: `${dealId} (updated UW JSON)`,
      mimeType: UW_JSON_MEDIA_TYPE,
    }),
  };
}

function assertDealIdentity(envelope: UWDocumentEnvelope, dealId: string): void {
  const actual = envelope.frontmatter.deal_id;
  if (typeof actual !== 'string' || actual !== dealId) {
    throw new UWBindingError('BINDING_DEAL_ID_MISMATCH', 409, `Requested deal_id ${JSON.stringify(dealId)} does not match the envelope.`);
  }
}

function preferredDescriptors(registry: CodecRegistry): RepresentationCapability[] {
  const preferred = ['uw-json', 'uw-xml', 'uw-csv-bundle'];
  const descriptors: RepresentationCapability[] = [];
  for (const id of preferred) {
    try { descriptors.push(registry.get(id).descriptor); } catch { /* optional codec */ }
  }
  for (const descriptor of registry.list()) {
    if (!descriptors.some((item) => item.id === descriptor.id)) descriptors.push(descriptor);
  }
  return descriptors;
}

function etagListMatches(value: string | undefined, current: string, weakAllowed: boolean): boolean {
  if (!value) return false;
  for (const raw of value.split(',')) {
    const tag = raw.trim();
    if (tag === '*') return true;
    if (weakAllowed && tag.startsWith('W/') && tag.slice(2) === current) return true;
    if (!tag.startsWith('W/') && tag === current) return true;
  }
  return false;
}

function dualMCPResult(
  structuredContent: Record<string, unknown>,
  link?: UWMCPResourceLink,
): UWMCPToolResult {
  return {
    structuredContent,
    content: [
      { type: 'text', text: JSON.stringify(structuredContent) },
      ...(link ? [link] : []),
    ],
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    output += alphabet[(value >>> 18) & 63] ?? '';
    output += alphabet[(value >>> 12) & 63] ?? '';
    output += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] ?? '' : '=';
    output += index + 2 < bytes.length ? alphabet[value & 63] ?? '' : '=';
  }
  return output;
}
