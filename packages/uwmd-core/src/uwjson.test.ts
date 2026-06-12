// uwjson tests — verifies the .uw.json sibling serialization is lossless and
// round-trips through the in-memory ParsedUWFile model.

import { describe, expect, it } from 'vitest';
import { parseUWFile, getSection, getSectionVariant } from './parser.js';
import { validateUWFile } from './validator.js';
import {
  UWJSON_VERSION,
  UWJsonError,
  toUWJson,
  stringifyUWJson,
  parseUWJson,
  fromUWJson,
} from './uwjson.js';
import type { UWJsonBlock } from './uwjson.js';

const FIXTURE = `---
uw_version: "1.1"
deal_id: "uw_2026_UWJSON"
deal_name: "UWJSON Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-03T00:00:00Z"
property_address: "1 Sibling Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
quick_metrics:
  purchase_price: 7200000
  loan_amount: 5040000
flags: []
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

Narrative prose for the property section.

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`

\`\`\`json uw:section=operating_statement variant=t12 source=manual ts=2026-01-02T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "operating_statement", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "net_operating_income": 396635 }
\`\`\`
`;

describe('toUWJson', () => {
  it('preserves provenance, annotation, prose, and supersede history (lossless)', () => {
    const parsed = parseUWFile(FIXTURE);
    const doc = toUWJson(parsed, { generatedAt: '2026-01-03T12:00:00Z' });

    expect(doc.uwjson_version).toBe(UWJSON_VERSION);
    expect(doc.format_version).toBe('1.1');
    expect(doc.generated_at).toBe('2026-01-03T12:00:00Z');
    expect(doc.generator).toBe('@uwmd/core');

    // Current block carries full _meta provenance (the json render target drops this).
    const property = doc.sections['property'] as UWJsonBlock;
    expect(property.content['total_units']).toBe(24);
    expect(property.meta.version).toBe(2);
    expect(property.meta.confidence).toBe('high');
    expect(property.annotation.v).toBe(2);
    expect(property.prose).toContain('Narrative prose');

    // Supersede history retained.
    expect(doc.superseded['property']).toHaveLength(1);
    expect(doc.superseded['property'][0].content['total_units']).toBe(12);
    expect(doc.superseded['property'][0].meta.superseded).toBe(true);

    // Multi-variant section keyed by variant.
    const os = doc.sections['operating_statement'];
    expect('t12' in os).toBe(true);
  });

  it('omits supersede history when includeSuperseded is false', () => {
    const parsed = parseUWFile(FIXTURE);
    const doc = toUWJson(parsed, { includeSuperseded: false });
    expect(Object.keys(doc.superseded)).toHaveLength(0);
  });
});

describe('stringifyUWJson', () => {
  it('emits pretty-printed JSON with a trailing newline', () => {
    const parsed = parseUWFile(FIXTURE);
    const text = stringifyUWJson(parsed, { generatedAt: '2026-01-03T12:00:00Z' });
    expect(text.endsWith('\n')).toBe(true);
    const reparsed = JSON.parse(text);
    expect(reparsed.frontmatter.deal_id).toBe('uw_2026_UWJSON');
  });
});

describe('parseUWJson', () => {
  it('round-trips through text', () => {
    const parsed = parseUWFile(FIXTURE);
    const text = stringifyUWJson(parsed);
    const doc = parseUWJson(text);
    expect(doc.frontmatter.deal_id).toBe('uw_2026_UWJSON');
    expect(doc.uwjson_version).toBe(UWJSON_VERSION);
  });

  it('throws UWJsonError on non-JSON', () => {
    expect(() => parseUWJson('not json {')).toThrow(UWJsonError);
  });

  it('throws UWJsonError when uwjson_version is missing', () => {
    expect(() => parseUWJson('{"frontmatter":{},"sections":{}}')).toThrow(/UWJSON_MISSING_VERSION/);
  });

  it('throws UWJsonError when sections is missing', () => {
    expect(() => parseUWJson('{"uwjson_version":"1.1","frontmatter":{}}')).toThrow(
      /UWJSON_MISSING_SECTIONS/,
    );
  });
});

describe('fromUWJson', () => {
  it('re-hydrates a ParsedUWFile the validator and getters can consume', () => {
    const parsed = parseUWFile(FIXTURE);
    const doc = toUWJson(parsed);
    const rehydrated = fromUWJson(doc);

    // Section getters work against the re-hydrated model.
    expect(getSection(rehydrated, 'property')?.content['total_units']).toBe(24);
    expect(getSectionVariant(rehydrated, 'operating_statement', 't12')?.content[
      'net_operating_income'
    ]).toBe(396635);

    // Provenance + history preserved through the full round trip.
    expect(getSection(rehydrated, 'property')?.meta.confidence).toBe('high');
    expect(rehydrated.superseded['property']).toHaveLength(1);
    expect(rehydrated.prose['property']).toContain('Narrative prose');

    // Validator runs against the re-hydrated model without throwing.
    const original = validateUWFile(parsed);
    const fromJson = validateUWFile(rehydrated);
    expect(fromJson.overall_status).toBe(original.overall_status);
  });

  it('rawJson is regenerated and raw is empty (no Markdown byte stream)', () => {
    const parsed = parseUWFile(FIXTURE);
    const rehydrated = fromUWJson(toUWJson(parsed));
    expect(rehydrated.raw).toBe('');
    const prop = getSection(rehydrated, 'property');
    expect(JSON.parse(prop?.rawJson ?? '{}')['total_units']).toBe(24);
  });
});
