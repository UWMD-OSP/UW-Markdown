import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyUWMDSourceEdit,
  createUWMCPApplyEditResult,
  assertUWIfMatch,
  createUWHTTPResponse,
  createUWMCPGetDocumentResult,
  createUWMCPListRepresentationsResult,
  createUWMCPResource,
  createUWMCPValidationResult,
  decodeUWHTTPRequest,
  uwmdDealResourceURI,
  uwmdETag,
  UWBindingError,
} from './bindings.js';
import { areEnvelopesEquivalent, stampEnvelopeDigest, toUWEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import { decodeUWCSVZip, UW_CSV_BUNDLE_MEDIA_TYPE } from './uwcsv.js';
import { UW_XML_MEDIA_TYPE } from './uwxml.js';

const source = readFileSync(
  resolve(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
  'utf8',
);
const envelope = toUWEnvelope(parseUWFile(source), {
  generatedAt: '2026-07-26T00:00:00.000Z',
  generator: '@uwmd/core-test',
});
const dealId = String(envelope.frontmatter.deal_id);

describe('HTTP binding profile', () => {
  it('defaults to UW JSON with digest cache headers and supports 304', async () => {
    const response = await createUWHTTPResponse(envelope);
    expect(response.status).toBe(200);
    expect(response.representation_id).toBe('uw-json');
    expect(response.headers['Content-Type']).toBe('application/vnd.uwmd.document+json');
    expect(response.headers.Vary).toBe('Accept');
    expect(response.headers.ETag).toMatch(/^"sha256:[0-9a-f]{64}"$/);
    expect(typeof response.body).toBe('string');

    const cached = await createUWHTTPResponse(envelope, { ifNoneMatch: response.headers.ETag });
    expect(cached.status).toBe(304);
    expect(cached.body).toBeUndefined();
  });

  it('negotiates XML and binary CSV, then decodes both through the registry', async () => {
    const xml = await createUWHTTPResponse(envelope, { accept: UW_XML_MEDIA_TYPE });
    expect(xml.representation_id).toBe('uw-xml');
    expect(typeof xml.body).toBe('string');
    const xmlDecoded = await decodeUWHTTPRequest(UW_XML_MEDIA_TYPE, xml.body as string);
    expect(areEnvelopesEquivalent(xmlDecoded, envelope)).toBe(true);

    const csv = await createUWHTTPResponse(envelope, { accept: UW_CSV_BUNDLE_MEDIA_TYPE });
    expect(csv.representation_id).toBe('uw-csv-bundle');
    expect(csv.body).toBeInstanceOf(Uint8Array);
    expect(csv.headers['Content-Disposition']).toMatch(/\.uw\.csv\.zip"$/);
    const csvDecoded = await decodeUWHTTPRequest(UW_CSV_BUNDLE_MEDIA_TYPE, csv.body as Uint8Array);
    expect(areEnvelopesEquivalent(csvDecoded, envelope)).toBe(true);
  });

  it('maps negotiation and optimistic-concurrency failures to HTTP statuses', async () => {
    await expect(createUWHTTPResponse(envelope, { accept: 'application/pdf' })).rejects.toMatchObject({ status: 406 });
    await expect(createUWHTTPResponse({} as Parameters<typeof createUWHTTPResponse>[0])).rejects.toThrow(/ENVELOPE_UNSUPPORTED_VERSION/);
    await expect(decodeUWHTTPRequest('application/pdf', '{}')).rejects.toMatchObject({ status: 415 });
    await expect(assertUWIfMatch(undefined, envelope)).rejects.toMatchObject({ status: 428 });
    await expect(assertUWIfMatch('"sha256:deadbeef"', envelope)).rejects.toMatchObject({ status: 412 });
    const stamped = await stampEnvelopeDigest(envelope);
    await expect(assertUWIfMatch(uwmdETag(stamped), stamped)).resolves.toBe(uwmdETag(stamped));
  });

  it('publishes a parseable OpenAPI 3.1 reference contract', () => {
    const contract = JSON.parse(readFileSync(
      resolve(process.cwd(), '..', '..', 'spec', 'bindings', 'UW_HTTP_API_v1.openapi.json'),
      'utf8',
    )) as { openapi: string; paths: Record<string, unknown> };
    expect(contract.openapi).toBe('3.1.0');
    expect(Object.keys(contract.paths)).toEqual(['/v1/deals/{deal_id}', '/v1/representations']);
  });
});

describe('MCP binding profile', () => {
  it('uses stable uwmd.org resource identities with explicit variants', async () => {
    expect(uwmdDealResourceURI('deal / 1')).toBe('https://uwmd.org/deals/deal%20%2F%201');
    expect(uwmdDealResourceURI('abc', { representation: 'uw-xml' })).toBe(
      'https://uwmd.org/deals/abc?representation=uw-xml',
    );
    expect(() => uwmdDealResourceURI('')).toThrow(UWBindingError);
    await expect(createUWMCPResource(envelope, 'wrong-deal')).rejects.toMatchObject({ status: 409 });
  });

  it('returns text resources, view resources, and base64 binary resources', async () => {
    const xml = await createUWMCPResource(envelope, dealId, { representation: 'uw-xml' });
    expect('text' in xml && xml.text).toContain('<uw:document');

    const view = await createUWMCPResource(envelope, dealId, { view: 'rent_roll' });
    expect(view.mimeType).toBe('text/csv; charset=utf-8');
    expect('text' in view && view.text).toContain('total_units');

    const csv = await createUWMCPResource(envelope, dealId, { representation: 'uw-csv-bundle' });
    expect('blob' in csv && csv.blob.startsWith('UEs')).toBe(true);
    if ('blob' in csv) {
      const decoded = await decodeUWCSVZip(Uint8Array.from(Buffer.from(csv.blob, 'base64')));
      expect(areEnvelopesEquivalent(decoded, envelope)).toBe(true);
    }
    await expect(createUWMCPResource(envelope, dealId, {
      representation: 'uw-xml',
      view: 'rent_roll',
    })).rejects.toMatchObject({ status: 400 });
  });

  it('returns compact structured tool results with JSON fallback and resource links', async () => {
    const document = await createUWMCPGetDocumentResult(envelope, dealId, { representation: 'uw-json' });
    expect(document.structuredContent).toMatchObject({
      deal_id: dealId,
      representation_id: 'uw-json',
      fidelity: 'model',
    });
    expect(document.content.map((item) => item.type)).toEqual(['text', 'resource_link']);
    expect(JSON.parse((document.content[0] as { text: string }).text)).toEqual(document.structuredContent);

    const validation = await createUWMCPValidationResult(envelope, dealId);
    expect(validation.structuredContent).toMatchObject({ deal_id: dealId });
    expect(validation.structuredContent?.issues).toBeInstanceOf(Array);

    const formats = createUWMCPListRepresentationsResult();
    expect((formats.structuredContent?.representations as Array<{ id: string }>).map((item) => item.id)).toEqual([
      'uw-json',
      'uw-xml',
      'uw-csv-bundle',
    ]);
  });

  it('reuses Tier-2 source editing with semantic If-Match protection', async () => {
    const current = await stampEnvelopeDigest(toUWEnvelope(parseUWFile(source)));
    const edited = await applyUWMDSourceEdit(
      source,
      { kind: 'frontmatter_set', path: 'deal_name', value: 'Parkview Updated' },
      { actor: 'API test', source: 'manual', confidence: 'high' },
      uwmdETag(current),
      { integrity: false, maintainGaps: false },
    );
    expect(edited.envelope.frontmatter.deal_name).toBe('Parkview Updated');
    expect(edited.etag).not.toBe(uwmdETag(current));

    const applied = await createUWMCPApplyEditResult(
      source,
      { kind: 'frontmatter_set', path: 'deal_name', value: 'Parkview MCP Updated' },
      { actor: 'MCP test', source: 'manual', confidence: 'high' },
      uwmdETag(current),
    );
    expect(applied.edit.envelope.frontmatter.deal_name).toBe('Parkview MCP Updated');
    expect(applied.result.structuredContent).toMatchObject({ ok: true, deal_id: dealId });
    expect(applied.result.content.at(-1)?.type).toBe('resource_link');
  });
});
