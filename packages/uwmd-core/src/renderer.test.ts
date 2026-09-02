// Renderer tests - verifies public render() output contracts.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { render, UnsupportedRenderFormatError } from './renderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../conformance/tier-1-reader/fixtures/01-minimal-screening.uwx.md',
);

function loadFixture() {
  return parseUWFile(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('render', () => {
  it('renders json without superseded history by default', () => {
    const parsed = parseUWFile(`---
uw_version: "1.1"
deal_id: "uw_2026_RENDER"
deal_name: "Renderer Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-02T00:00:00Z"
property_address: "1 Render Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`
`);

    const output = JSON.parse(render(parsed, { format: 'json' }).content);

    expect(output.frontmatter.deal_id).toBe('uw_2026_RENDER');
    expect(output.sections.property.total_units).toBe(24);
    expect(output.superseded).toBeUndefined();
  });

  it('renders superseded history when requested for json', () => {
    const parsed = parseUWFile(`---
uw_version: "1.1"
deal_id: "uw_2026_RENDER"
deal_name: "Renderer Fixture"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-02T00:00:00Z"
property_address: "1 Render Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=medium
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "medium", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 12 }
\`\`\`

\`\`\`json uw:section=property source=manual ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 24 }
\`\`\`
`);

    const output = JSON.parse(render(parsed, { format: 'json', includeSuperseded: true }).content);

    expect(output.superseded.property).toHaveLength(1);
    expect(output.superseded.property[0].total_units).toBe(12);
  });

  it('renders csv with raw numeric cells and percent values scaled to display units', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'csv' });
    const [headerLine, rowLine] = result.content.split('\n');

    expect(result.format).toBe('csv');
    expect(headerLine).toContain('deal_id,deal_name,address');
    expect(rowLine).toContain('TEST-MIN-001,"Minimal Screening Fixture","100 Test Lane"');
    expect(rowLine).toContain('10000000,7500000,2500000,600000,1.25,75.0000');
  });

  it('renders a markdown summary with validation and readiness sections', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'summary' });

    expect(result.format).toBe('summary');
    expect(result.content).toContain('# Minimal Screening Fixture');
    expect(result.content).toContain('| Purchase Price | $10,000,000 |');
    expect(result.content).toContain('## Validation');
    expect(result.content).toContain('## Stage Readiness');
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('renders chat output and truncates when the token budget is exceeded', () => {
    const parsed = loadFixture();
    const result = render(parsed, { format: 'chat', maxTokens: 40 });

    expect(result.format).toBe('chat');
    expect(result.truncated).toBe(true);
    expect(result.content).toContain('[TRUNCATED');
    expect(result.estimatedTokens).toBeGreaterThan(40);
  });

  it('fails explicitly for formats that require dedicated pipelines', () => {
    const parsed = loadFixture();

    for (const format of ['pdf', 'docx'] as const) {
      expect(() => render(parsed, { format })).toThrowError(UnsupportedRenderFormatError);

      try {
        render(parsed, { format });
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNSUPPORTED_RENDER_FORMAT', format });
      }
    }
  });
});

// ─── RFC 0027 — the class's own size in every read model ─────────────────────

const officeDoc = `---
uw_version: "1.1"
deal_id: "uw_2026_OFFICE"
deal_name: "Office Size Fixture"
created: "2026-08-25T00:00:00Z"
last_modified: "2026-08-25T00:00:00Z"
property_address: "42 Camelback Rd"
city: "Phoenix"
state: "AZ"
zip: "85012"
asset_class: office
---

\`\`\`json uw:section=property source=manual ts=2026-08-25T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "property", "version": 1, "superseded": false, "source": "manual", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-08-25T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "rentable_square_feet": 42500, "year_built": 1998 }
\`\`\`
`;

describe('render — size intensives (RFC 0027)', () => {
  it('csv appends size_basis/size_quantity and keeps total_units in place', () => {
    const parsed = parseUWFile(officeDoc);
    const [headerLine, rowLine] = render(parsed, { format: 'csv' }).content.split('\n');

    expect(headerLine!.endsWith('recommendation,size_basis,size_quantity')).toBe(true);
    expect(rowLine!.endsWith(',rentable_square_feet,42500')).toBe(true);
    // total_units keeps its column, empty for a class that has none
    const headers = headerLine!.split(',');
    const cells = rowLine!.split(',');
    expect(cells[headers.indexOf('total_units')]).toBe('');
  });

  it('csv states the multifamily size as total_units, value unchanged', () => {
    const parsed = parseUWFile(officeDoc.replace('asset_class: office', 'asset_class: multifamily')
      .replace('"rentable_square_feet": 42500', '"total_units": 48'));
    const [headerLine, rowLine] = render(parsed, { format: 'csv' }).content.split('\n');
    const headers = headerLine!.split(',');
    const cells = rowLine!.split(',');
    expect(cells[headers.indexOf('size_basis')]).toBe('total_units');
    expect(cells[headers.indexOf('size_quantity')]).toBe(cells[headers.indexOf('total_units')]);
  });

  it('summary header states a non-multifamily class\'s size', () => {
    const content = render(parseUWFile(officeDoc), { format: 'summary' }).content;
    expect(content).toContain('· 42,500 RSF');
  });

  it('chat property block states a non-multifamily class\'s size', () => {
    const content = render(parseUWFile(officeDoc), { format: 'chat' }).content;
    expect(content).toContain('Size: 42,500 RSF (rentable_square_feet)');
  });

  it('no drift: multifamily summary and chat carry no separate size term', () => {
    // Multifamily's primary is total_units, which these renderings already
    // state — RFC 0027 must not change a single multifamily byte.
    const parsed = loadFixture();
    const summary = render(parsed, { format: 'summary' }).content;
    const chat = render(parsed, { format: 'chat' }).content;
    expect(summary).not.toContain('RSF');
    expect(summary).not.toMatch(/·\s+\d[\d,]*\s+Units/);
    expect(chat).not.toContain('Size:');
  });
});
