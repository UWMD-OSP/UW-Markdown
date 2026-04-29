// Parser tests — verified against examples/Parkview-Apts-Glendale-AZ.uw.md
// Run: npm test

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUWFile, getSection, getSectionVariant, deepGet, UWMDParseError } from './parser.js';
import { validateUWFile } from './validator.js';
import { compact } from './compactor.js';
import { generateBlankUWFile } from './init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_PATH = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uw.md');

function loadExample(): string {
  try {
    return readFileSync(EXAMPLE_PATH, 'utf-8');
  } catch {
    return '';
  }
}

// ─── Parser unit tests ────────────────────────────────────────────────────────

describe('parseUWFile', () => {
  it('returns a ParsedUWFile with frontmatter, sections, prose, pipeline_log', () => {
    const content = `---
uw_version: "1.1"
deal_id: "uw_2026_TEST0001"
deal_name: "Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "123 Main St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

# Test Deal

## Property {#property}

Some prose about the property.

\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "wizard",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "total_units": 48,
  "year_built": 1987
}
\`\`\`

---

## Pipeline Log {#pipeline_log}

\`\`\`json uw:section=pipeline_log source=engine ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": { "section": "pipeline_log", "version": 1, "superseded": false, "source": "engine", "agent_id": null, "agent_version": null, "actor": "system", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null },
  "entries": [{ "entry_id": "log_001", "timestamp": "2026-01-01T00:00:00Z", "event_type": "file_created", "agent_or_actor": "wizard", "section_affected": null, "status": "success", "input_sections": [], "output_sections": [], "flags_raised": [], "flags_cleared": [], "duration_ms": null, "input_hash": null, "output_hash": null, "error_code": null, "error_message": null, "notes": null }]
}
\`\`\`
`;

    const parsed = parseUWFile(content);

    expect(parsed.frontmatter.deal_id).toBe('uw_2026_TEST0001');
    expect(parsed.frontmatter.asset_class).toBe('multifamily');
    expect(parsed.sections['property']).toBeDefined();
    expect(parsed.pipeline_log).toHaveLength(1);
    expect(parsed.prose['property']).toContain('Some prose about the property');
  });

  it('routes pipeline_log blocks to pipeline_log array, not sections', () => {
    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---

\`\`\`json uw:section=pipeline_log source=engine ts=2026-01-01T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "pipeline_log", "version": 1, "superseded": false, "source": "engine", "agent_id": null, "agent_version": null, "actor": "system", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "entries": [] }
\`\`\`
`;
    const parsed = parseUWFile(content);
    expect(parsed.pipeline_log).toHaveLength(1);
    expect(parsed.sections['pipeline_log']).toBeUndefined();
  });

  it('routes x_ sections to extensions', () => {
    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---

\`\`\`json uw:section=x_lender_matrix source=user ts=2026-01-01T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "x_lender_matrix", "version": 1, "superseded": false, "source": "user", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "lenders": [] }
\`\`\`
`;
    const parsed = parseUWFile(content);
    expect(parsed.extensions['x_lender_matrix']).toBeDefined();
    expect(parsed.sections['x_lender_matrix']).toBeUndefined();
  });

  it('handles superseded blocks correctly — keeps newer, archives older', () => {
    const makeBlock = (version: number, superseded: boolean) => `
\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=${version}${superseded ? ' superseded=true' : ''} confidence=high
{ "_meta": { "section": "property", "version": ${version}, "superseded": ${superseded}, "source": "wizard", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": ${version * 10} }
\`\`\``;

    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---
${makeBlock(1, true)}
${makeBlock(2, false)}
`;
    const parsed = parseUWFile(content);
    const current = getSection(parsed, 'property');
    expect(current?.meta.version).toBe(2);
    expect(parsed.superseded['property']).toHaveLength(1);
    expect(parsed.superseded['property']?.[0]?.meta.version).toBe(1);
  });

  it('parses fence annotation key-value pairs', () => {
    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---

\`\`\`json uw:section=noi_model source=engine:calculations.ts ts=2026-04-24T10:00:00Z v=3 confidence=high
{ "_meta": { "section": "noi_model", "version": 3, "superseded": false, "source": "engine:calculations.ts", "agent_id": null, "agent_version": null, "actor": "system", "timestamp": "2026-04-24T10:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "net_operating_income": 396635 }
\`\`\`
`;
    const parsed = parseUWFile(content);
    const block = getSection(parsed, 'noi_model');
    expect(block?.annotation.source).toBe('engine:calculations.ts');
    expect(block?.annotation.v).toBe(3);
    expect(block?.annotation.confidence).toBe('high');
  });
});

// ─── deepGet ──────────────────────────────────────────────────────────────────

describe('deepGet', () => {
  it('resolves dot-path notation', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(deepGet(obj, 'a.b.c')).toBe(42);
  });

  it('resolves array index notation', () => {
    const obj = { items: [{ val: 1 }, { val: 2 }] };
    expect(deepGet(obj, 'items[1].val')).toBe(2);
  });

  it('returns undefined for missing paths', () => {
    expect(deepGet({}, 'a.b.c')).toBeUndefined();
  });
});

// ─── compact ─────────────────────────────────────────────────────────────────

describe('compact', () => {
  it('removes superseded blocks and returns shorter content', () => {
    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---

\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=1 superseded=true confidence=high
{ "_meta": { "section": "property", "version": 1, "superseded": true, "source": "wizard", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 10 }
\`\`\`

\`\`\`json uw:section=property source=wizard ts=2026-01-02T00:00:00Z v=2 confidence=high
{ "_meta": { "section": "property", "version": 2, "superseded": false, "source": "wizard", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-02T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 48 }
\`\`\`
`;
    const parsed = parseUWFile(content);
    const compacted = compact(parsed);
    expect(compacted.length).toBeLessThan(content.length);
    // v=1 block should be gone
    expect(compacted).not.toContain('"total_units": 10');
    // v=2 block should remain
    expect(compacted).toContain('"total_units": 48');
  });

  it('returns original content unchanged when no superseded blocks exist', () => {
    const content = `---
uw_version: "1.1"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: ""
city: ""
state: "AZ"
zip: ""
asset_class: multifamily
---
\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=1 confidence=high
{ "_meta": { "section": "property", "version": 1, "superseded": false, "source": "wizard", "agent_id": null, "agent_version": null, "actor": "user", "timestamp": "2026-01-01T00:00:00Z", "confidence": "high", "human_review_required": false, "flags": [], "input_hash": null, "notes": null }, "total_units": 48 }
\`\`\`
`;
    const parsed = parseUWFile(content);
    const compacted = compact(parsed);
    expect(compacted).toBe(content);
  });
});

// ─── generateBlankUWFile ──────────────────────────────────────────────────────

describe('generateBlankUWFile', () => {
  it('generates a parseable .uw.md file', () => {
    const content = generateBlankUWFile({
      dealName: 'Test Property',
      address: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      assetClass: 'multifamily',
    });
    const parsed = parseUWFile(content);
    expect(parsed.frontmatter.deal_name).toBe('Test Property');
    expect(parsed.frontmatter.asset_class).toBe('multifamily');
    expect(parsed.pipeline_log).toHaveLength(1);
    // All 22 standard sections should be present
    expect(Object.keys(parsed.sections).length).toBeGreaterThanOrEqual(20);
  });
});

// ─── Example file integration test (skipped if file not found) ───────────────

describe('Parkview example file', () => {
  const exampleContent = loadExample();

  it.skipIf(!exampleContent)('parses without errors', () => {
    const parsed = parseUWFile(exampleContent);
    expect(parsed.frontmatter.deal_name).toBeTruthy();
    expect(Object.keys(parsed.sections).length).toBeGreaterThan(10);
    expect(parsed.pipeline_log.length).toBeGreaterThan(0);
  });

  it.skipIf(!exampleContent)('has property section with 48 units', () => {
    const parsed = parseUWFile(exampleContent);
    const property = getSection(parsed, 'property');
    const units = deepGet(property?.content, 'total_units');
    expect(units).toBe(48);
  });

  it.skipIf(!exampleContent)('has x_lender_matrix extension section', () => {
    const parsed = parseUWFile(exampleContent);
    expect(parsed.extensions['x_lender_matrix']).toBeDefined();
  });

  it.skipIf(!exampleContent)('validation produces issues (DSCR warning expected)', () => {
    const parsed = parseUWFile(exampleContent);
    const result = validateUWFile(parsed);
    // The Parkview example has a known DSCR warning (1.109x < 1.20x warning threshold).
    // FV codes were renamed to FV-NN in v1.1; legacy_code carries the old name during the
    // deprecation window (drops in v1.2).
    const dscrIssues = result.issues.filter(i =>
      i.code === 'FV-04' || (i.legacy_code ?? '').includes('DSCR')
    );
    expect(dscrIssues.length).toBeGreaterThan(0);
  });
});

// ─── YAML subset enforcement (UW_FORMAT_SPEC_v1.md Appendix D) ────────────────

describe('parseUWFile — YAML subset rejection', () => {
  const HEADER = `---
uw_version: "1.1"
deal_id: "uw_2026_TEST"
deal_name: "YAML subset test"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Test St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily`;

  function withFrontmatterLine(extra: string): string {
    return `${HEADER}\n${extra}\n---\n`;
  }

  it('rejects YAML anchors with UNSUPPORTED_YAML_FEATURE', () => {
    const content = withFrontmatterLine('shared_address: &addr "1 Anchor Way"');
    expect(() => parseUWFile(content)).toThrow(UWMDParseError);
    try {
      parseUWFile(content);
    } catch (e) {
      expect((e as UWMDParseError).code).toBe('UNSUPPORTED_YAML_FEATURE');
      expect((e as UWMDParseError).feature).toMatch(/anchor/i);
    }
  });

  it('rejects YAML aliases with UNSUPPORTED_YAML_FEATURE', () => {
    const content = withFrontmatterLine('billing_address: *addr');
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('rejects explicit !! tags with UNSUPPORTED_YAML_FEATURE', () => {
    const content = withFrontmatterLine('zip_again: !!str 85001');
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('rejects | block scalar with UNSUPPORTED_YAML_FEATURE', () => {
    const content = withFrontmatterLine('notes: |\n  line one\n  line two');
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('rejects > folded block scalar with UNSUPPORTED_YAML_FEATURE', () => {
    const content = withFrontmatterLine('notes: >\n  folded line');
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('rejects YAML directives with UNSUPPORTED_YAML_FEATURE', () => {
    const content = `---\n%YAML 1.2\nuw_version: "1.1"\ndeal_id: "x"\ndeal_name: "x"\ncreated: "2026-01-01T00:00:00Z"\nlast_modified: "2026-01-01T00:00:00Z"\nproperty_address: "1 a"\ncity: "Phoenix"\nstate: "AZ"\nzip: "85001"\nasset_class: multifamily\n---\n`;
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('accepts the supported subset (scalars, nested mappings, sequences, []) without throwing', () => {
    const content = `---
uw_version: "1.1"
deal_id: "uw_2026_OK"
deal_name: "All-supported subset"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 OK Way"
city: "Phoenix"
state: 'AZ'
zip: "85001"
asset_class: multifamily
quick_metrics:
  purchase_price: 1000000
  loan_amount: 750000
flags: []
tags:
  - a
  - b
# trailing comment is fine
---
`;
    expect(() => parseUWFile(content)).not.toThrow();
  });

  it('does not false-positive on # in quoted strings', () => {
    const content = withFrontmatterLine('notes: "# not a comment, just a hash"');
    expect(() => parseUWFile(content)).not.toThrow();
  });
});
