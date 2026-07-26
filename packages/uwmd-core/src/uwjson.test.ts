import { describe, expect, it } from 'vitest';
import { parseUWFile, getSection, getSectionVariant } from './parser.js';
import {
  UW_JSON_MEDIA_TYPE,
  UW_JSON_REPRESENTATION_VERSION,
  UWJsonError,
  fromUWJson,
  parseUWJson,
  parseUWJsonVerified,
  stringifyUWJson,
  stringifyUWJsonWithDigest,
  toUWJson,
  UW_JSON_CODEC,
} from './uwjson.js';
import type { UWEnvelopeBlock } from './envelope.js';

const FIXTURE = `---
uw_version: "1.1"
deal_id: "uw_2026_JSON"
deal_name: "JSON Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-03T00:00:00Z"
property_address: "1 Envelope Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
flags: []
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

Narrative prose for the current property block.

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`

\`\`\`json uw:section=operating_statement variant=t12 source=manual ts=2026-01-02T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "operating_statement", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "net_operating_income": 396635 }
\`\`\`
`;

describe('.uw.json 1.0', () => {
  it('uses the shared envelope without duplicating prose or _meta', () => {
    const document = toUWJson(parseUWFile(FIXTURE), {
      generatedAt: '2026-01-03T12:00:00Z',
    });
    const property = document.sections['property'] as UWEnvelopeBlock;

    expect(document.envelope_version).toBe('1.0');
    expect(document.format_version).toBe('1.1');
    expect(property.content['total_units']).toBe(24);
    expect((property.content['_meta'] as Record<string, unknown>)['version']).toBe(2);
    expect(property).not.toHaveProperty('meta');
    expect(document).not.toHaveProperty('prose');
    expect(property.prose).toContain('Narrative prose');
    expect(document.superseded['property']).toHaveLength(1);
    expect('t12' in document.sections['operating_statement']).toBe(true);
  });

  it('round-trips through text and the ParsedUWFile model', () => {
    const source = parseUWFile(FIXTURE);
    const document = parseUWJson(stringifyUWJson(source));
    const restored = fromUWJson(document);

    expect(getSection(restored, 'property')?.content['total_units']).toBe(24);
    expect(getSectionVariant(restored, 'operating_statement', 't12')?.content[
      'net_operating_income'
    ]).toBe(396635);
    expect(restored.superseded['property']).toHaveLength(1);
    expect(restored.prose['property']).toContain('Narrative prose');
    expect(restored.raw).toBe('');
  });

  it('stamps and verifies the semantic digest', async () => {
    const text = await stringifyUWJsonWithDigest(parseUWFile(FIXTURE), {
      generatedAt: '2026-01-03T12:00:00Z',
    });
    const document = await parseUWJsonVerified(text);
    expect(document.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('rejects malformed JSON, obsolete shapes, and digest tampering', async () => {
    expect(() => parseUWJson('not json {')).toThrow(UWJsonError);
    expect(() => parseUWJson('{"uwjson_version":"1.1"}')).toThrow(
      /ENVELOPE_UNSUPPORTED_VERSION/,
    );    expect(() =>
      parseUWJson(
        JSON.stringify({
          envelope_version: '1.0',
          format_version: '1.1',
          frontmatter: {},
          sections: { property: { annotation: { section: 'property' }, content: {} } },
          pipeline_log: [],
          custom_calculations: [],
          custom_scenarios: [],
          extensions: {},
          superseded: {},
        }),
      ),
    ).toThrow(/ENVELOPE_MISSING_META/);

    const text = await stringifyUWJsonWithDigest(parseUWFile(FIXTURE));
    const tampered = text.replace('"total_units": 24', '"total_units": 25');
    await expect(parseUWJsonVerified(tampered)).rejects.toThrow(/JSON_DIGEST_MISMATCH/);
  });

  it('publishes a discoverable model-fidelity codec', () => {
    expect(UW_JSON_REPRESENTATION_VERSION).toBe('1.0.0');
    expect(UW_JSON_MEDIA_TYPE).toBe('application/vnd.uwmd.document+json');
    expect(UW_JSON_CODEC.descriptor.fidelity).toBe('model');
    expect(UW_JSON_CODEC.descriptor.file_extensions).toContain('.uw.json');
  });
});