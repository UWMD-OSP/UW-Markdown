// Parser tests — verified against examples/Parkview-Apts-Glendale-AZ.uwx.md
// Run: npm test

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUWFile, getSection, getSectionVariant, deepGet, blockPayload, UWMDParseError } from './parser.js';
import { validateUWFile } from './validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_PATH = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');

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
uw_version: "3.0"
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

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null,
  "total_units": 48,
  "year_built": 1987
}
\`\`\`

---

## Pipeline Log {#pipeline_log}

\`\`\`json uw:section=pipeline_log source=system/engine ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "provenance": {
      "source": "system/engine",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-01-01T00:00:00Z",
      "event_type": "file_created",
      "agent_or_actor": "wizard",
      "section_affected": null,
      "status": "success",
      "input_sections": [],
      "output_sections": [],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": null
    }
  ]
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
uw_version: "3.0"
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

\`\`\`json uw:section=pipeline_log source=system/engine ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "provenance": {
      "source": "system/engine",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "entries": []
}
\`\`\`
`;
    const parsed = parseUWFile(content);
    expect(parsed.pipeline_log).toHaveLength(1);
    expect(parsed.sections['pipeline_log']).toBeUndefined();
  });

  it('routes x_ sections to extensions', () => {
    const content = `---
uw_version: "3.0"
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

\`\`\`json uw:section=x_lender_matrix source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "x_lender_matrix",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "lenders": []
}
\`\`\`
`;
    const parsed = parseUWFile(content);
    expect(parsed.extensions['x_lender_matrix']).toBeDefined();
    expect(parsed.sections['x_lender_matrix']).toBeUndefined();
  });

  it('handles superseded blocks correctly — keeps newer, archives older', () => {
    const makeBlock = (version: number, superseded: boolean) => `
\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=${version}${superseded ? ' superseded=true' : ''} confidence=high
{ "_meta": { "section": "property", "provenance": { "source": "manual", "actor": "user", "agent_id": null, "agent_version": null, "timestamp": "2026-01-01T00:00:00Z", "notes": null }, "quality": { "confidence": "high", "human_review_required": false, "flags": [] }, "lifecycle": { "revision": ${version}, "superseded": ${superseded} } }, "total_units": ${version * 10} }
\`\`\``;

    const content = `---
uw_version: "3.0"
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
    expect(current?.meta.lifecycle?.revision).toBe(2);
    expect(parsed.superseded['property']).toHaveLength(1);
    expect(parsed.superseded['property']?.[0]?.meta.lifecycle?.revision).toBe(1);
  });

  // Format §2.7: the canonical block is the last non-superseded one, not the
  // highest revision (#404). The block it overwrites stays retained.
  it.each([
    ['a revision tie', 1, 1],
    ['a later lower revision', 2, 1],
  ])('makes the last non-superseded block canonical on %s', (_label, first, second) => {
    const block = (revision: number, units: number) => `
\`\`\`json uw:section=property
{ "_meta": { "section": "property", "provenance": { "source": "manual", "actor": "user", "timestamp": "2026-01-01T00:00:00Z" }, "quality": { "confidence": "high", "human_review_required": false }, "lifecycle": { "revision": ${revision}, "superseded": false } }, "total_units": ${units} }
\`\`\``;
    const parsed = parseUWFile(`---\nuw_version: "3.0"\ndeal_id: "x"\nasset_class: multifamily\n---\n${block(first, 10)}\n${block(second, 20)}\n`);
    expect(getSection(parsed, 'property')?.content.total_units).toBe(20);
    expect(parsed.superseded['property']?.map(b => b.content.total_units)).toEqual([10]);
  });

  it('parses fence annotation key-value pairs', () => {
    const content = `---
uw_version: "3.0"
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

\`\`\`json uw:section=noi_model source=system/calculations.ts ts=2026-04-24T10:00:00Z v=3 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "system/calculations.ts",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-04-24T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 3,
      "superseded": false
    }
  },
  "net_operating_income": 396635
}
\`\`\`
`;
    const parsed = parseUWFile(content);
    const block = getSection(parsed, 'noi_model');
    expect(block?.annotation.source).toBe('system/calculations.ts');
    expect(block?.annotation.v).toBe(3);
    expect(block?.annotation.confidence).toBe('high');
  });
});

describe('parseUWFile portability and structural integrity', () => {
  it('parses CRLF documents without dropping structured sections', () => {
    const content = `---
uw_version: "3.0"
deal_id: "uw_2026_CRLF"
deal_name: "CRLF Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "123 Main St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "total_units": 48
}
\`\`\`
`.replace(/\n/g, '\r\n');

    const parsed = parseUWFile(content);

    expect(parsed.raw).toBe(content);
    expect(getSection(parsed, 'property')?.content['total_units']).toBe(48);
  });

  it('rejects an unterminated UW section fence even outside strict mode', () => {
    const content = `---
uw_version: "3.0"
deal_id: "uw_2026_UNCLOSED"
deal_name: "Unclosed Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "123 Main St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

\`\`\`json uw:section=property source=wizard ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "agent_id": null,
      "agent_version": null,
      "notes": null
    },
    "quality": {
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {}
  },
  "total_units": 48
}`;

    expect(() => parseUWFile(content)).toThrowError(
      expect.objectContaining({ code: 'UNCLOSED_SECTION_FENCE', line: 14 }),
    );
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

  it('does not navigate onto the prototype chain', () => {
    expect(deepGet({}, '__proto__')).toBeUndefined();
    expect(deepGet({}, 'constructor')).toBeUndefined();
    expect(deepGet({ a: {} }, 'a.constructor.prototype')).toBeUndefined();
    expect(deepGet({ a: {} }, 'a.__proto__.polluted')).toBeUndefined();
  });

  it('does not resolve inherited properties', () => {
    // A `toString` the author did not write is not theirs to read.
    expect(deepGet({}, 'toString')).toBeUndefined();
    expect(deepGet({ items: [1, 2] }, 'items.map')).toBeUndefined();
    // Own properties still resolve, including an array's own `length`.
    expect(deepGet({ toString: 'mine' }, 'toString')).toBe('mine');
    expect(deepGet({ items: [1, 2] }, 'items.length')).toBe(2);
  });
});

// ─── Prototype-pollution hardening ───────────────────────────────────────────

describe('document-authored keys never reach the prototype', () => {
  const wrap = (frontmatter: string) => `---
uw_version: "3.0"
deal_id: "d"
deal_name: "d"
created: "2026-01-01"
last_modified: "2026-01-01"
asset_class: "multifamily"
${frontmatter}
---

# Deal
`;

  it('drops a __proto__ frontmatter key instead of setting a prototype', () => {
    const parsed = parseUWFile(wrap('__proto__:\n  polluted: "yes"'));
    expect(Object.hasOwn(parsed.frontmatter, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((parsed.frontmatter as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops a constructor frontmatter key', () => {
    const parsed = parseUWFile(wrap('constructor: "hijacked"'));
    expect((parsed.frontmatter as Record<string, unknown>).constructor).toBe(Object);
  });

  it('drops blocked keys nested under a frontmatter object', () => {
    const parsed = parseUWFile(wrap('meta:\n  __proto__: "x"\n  kept: "y"'));
    const meta = (parsed.frontmatter as Record<string, unknown>).meta as Record<string, unknown>;
    expect(meta).toEqual({ kept: 'y' });
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
    const dscrIssues = result.issues.filter(i => i.code === 'FV-04');
    expect(dscrIssues.length).toBeGreaterThan(0);
  });
});

// ─── YAML subset enforcement (UW_FORMAT_SPEC.md Appendix D) ────────────────

describe('parseUWFile — YAML subset rejection', () => {
  const HEADER = `---
uw_version: "3.0"
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
    const content = `---
%YAML 1.2
uw_version: "3.0"
deal_id: "x"
deal_name: "x"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 a"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---
`;
    expect(() => parseUWFile(content)).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('accepts the supported subset (scalars, nested mappings, sequences, []) without throwing', () => {
    const content = `---
uw_version: "3.0"
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

// ─── §2.6 read-time source interpretation (RFC 0031) ─────────────────────────

describe('no read-time interpretation of _meta.provenance.source (RFC 0081 §3)', () => {
  const fileWithSource = (source: string): string => `---
uw_version: "3.0"
deal_id: "test-interp"
asset_class: multifamily
---

# Interp

\`\`\`json uw:section=property source=manual ts=2026-08-31T00:00:00Z v=1
{
  "_meta": {
    "section": "property",
    "provenance": { "source": "${source}", "actor": "test", "timestamp": "2026-08-31T00:00:00Z" },
    "quality": { "confidence": "high", "human_review_required": false },
    "lifecycle": { "revision": 1, "superseded": false }
  },
  "total_units": 10
}
\`\`\`
`;

  it('keeps a resolution tag in the actor field where it was written, and it is SRC-02', () => {
    const parsed = parseUWFile(fileWithSource('market_data'));
    const block = parsed.sections['property'] as import('./types.js').UWBlock;
    expect(block.meta.provenance.resolution).toBeUndefined();
    expect(block.meta.provenance.source).toBe('market_data');
    expect(validateUWFile(parsed).issues.some((i) => i.code === 'SRC-02' && i.severity === 'error')).toBe(true);
  });

  it('reads _meta as stated: block.meta is the document object itself', () => {
    for (const source of ['manual', 'agent/L6-01', 'system/init', 'asset_class_default']) {
      const parsed = parseUWFile(fileWithSource(source));
      const block = parsed.sections['property'] as import('./types.js').UWBlock;
      expect(block.meta, source).toBe(block.content['_meta']);
    }
  });
});

describe('blockPayload (Protocol §VIII.2 payload)', () => {
  const block = (content: unknown) => ({ content }) as unknown as Parameters<typeof blockPayload>[0];

  it('is the block minus its reserved members; a member named content is payload', () => {
    const reserved = { _meta: {}, _role: 'primary', _overrides: [], _notes: 'n' };
    expect(blockPayload(block({ ...reserved, total_units: 48 }))).toEqual({ total_units: 48 });
    expect(blockPayload(block({ ...reserved, content: { total_units: 48 } }))).toEqual({ content: { total_units: 48 } });
  });

  it('leaves a non-object body alone and reads own members only', () => {
    expect(blockPayload(block(null))).toBeNull();
    expect(blockPayload(block([1, 2]))).toEqual([1, 2]);
    const inherited = Object.create({ content: { x: 1 } }) as Record<string, unknown>;
    expect(blockPayload(block(inherited))).toEqual({});
  });
});

describe('one format (RFC 0081 D1): UNSUPPORTED_FORMAT_VERSION', () => {
  const body = '\n```json uw:section=property v=1\n{ "total_units": 10 }\n```\n';
  const doc = (versionLine: string) => `---\n${versionLine}deal_id: "x"\n---\n${body}`;

  it.each(['uw_version: "1.1"\n', 'uw_version: "2.0"\n', 'uw_version: "2.1"\n', 'uw_version: "4.0"\n', 'uw_version: 3\n', ''])(
    'refuses %j at parse stage, naming the declared and supported values',
    (versionLine) => {
      try {
        parseUWFile(doc(versionLine));
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UWMDParseError);
        expect((e as UWMDParseError).code).toBe('UNSUPPORTED_FORMAT_VERSION');
        expect((e as Error).message).toContain('"3.0"');
      }
    },
  );

  it('tells the author to quote an unquoted 3.0, which YAML reads as the number 3', () => {
    expect(() => parseUWFile(doc('uw_version: 3.0\n'))).toThrow(/the number 3; the format version is a string\. Quote it: uw_version: "3\.0"/);
  });

  it('reads uw_version "3.0"', () => {
    expect(parseUWFile(doc('uw_version: "3.0"\n')).frontmatter.uw_version).toBe('3.0');
  });
});

// Appendix D: simple quoted mapping keys retain their YAML string meaning.
describe('quoted frontmatter mapping keys', () => {
  const doc = (rows: string) => `---\nuw_version: "3.0"\n${rows}\n---\n`;

  it('decodes quoted keys and finds the separator outside their content', () => {
    const parsed = parseUWFile(doc('"custom_label": kept\n\'single_label\': also\n"a:b": colon\n"a: &anchor # []": literal\n\'O\'\'Brien\': person\n"\\u0063afé": unicode'));
    expect(parsed.frontmatter).toMatchObject({ custom_label: 'kept', single_label: 'also',
      'a:b': 'colon', 'a: &anchor # []': 'literal', "O'Brien": 'person', café: 'unicode' });
  });

  it('finds the separator after a colon inside a plain string key', () => {
    const parsed = parseUWFile(doc('a:b: kept\nnested:\n  a:b: "value: &literal"'));
    expect(parsed.frontmatter).toMatchObject({ 'a:b': 'kept', nested: { 'a:b': 'value: &literal' } });
  });

  it('keeps quoted sequence indicators as content during the feature pre-pass', () => {
    const source = doc('flags:\n  - "a: &anchor"\n  - "a: *alias"\n  - "a: !!str literal"\n  - "a: [x] # literal"\n  - \'a: &single\'\n# "unterminated: comment');
    expect(parseUWFile(source).frontmatter.flags).toEqual([
      'a: &anchor', 'a: *alias', 'a: !!str literal', 'a: [x] # literal', 'a: &single',
    ]);
  });

  it.each(['&anchor', '*alias', '[1, 2]', '{a: 1}'])('still refuses unsupported sequence syntax: %s', item => {
    expect(() => parseUWFile(doc(`flags:\n  - ${item}`))).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it.each(['"key":value', "'key':value", 'nested:\n  "key":value'])('refuses adjacent block mapping values: %s', rows => {
    expect(() => parseUWFile(doc(rows))).toThrow(/UNSUPPORTED_YAML_FEATURE/);
  });

  it('preserves hash-leading and empty quoted string keys as data', () => {
    const parsed = parseUWFile(doc('"#literal": kept\n"": empty-key\n# ignored: comment'));
    expect(parsed.frontmatter).toMatchObject({ '#literal': 'kept', '': 'empty-key' });
    expect(Object.hasOwn(parsed.frontmatter, '# ignored')).toBe(false);
  });

  it('decodes nested keys and reports decoded member paths without changing source', () => {
    const source = doc('"pipeline_state":\n  "L0": complete\n  \'x:y\': pending').replaceAll('\n', '\r\n');
    const paths: string[][] = [];
    const parsed = parseUWFile(source, { onFrontmatterMember: path => paths.push([...path]) });
    expect(parsed.frontmatter.pipeline_state).toEqual({ L0: 'complete', 'x:y': 'pending' });
    expect(paths).toEqual([['uw_version'], ['pipeline_state'], ['pipeline_state', 'L0'], ['pipeline_state', 'x:y']]);
    expect(parsed.raw).toBe(source);
  });

  it('keeps quoted numeric-looking keys as strings and unquoted key behavior', () => {
    expect(parseUWFile(doc('"12": number-key\n"true": boolean-key\n"null": null-key\na.b: dotted')).frontmatter)
      .toMatchObject({ '12': 'number-key', true: 'boolean-key', null: 'null-key', 'a.b': 'dotted' });
  });

  it('applies blocked-segment guards after decoding quoted keys', () => {
    const parsed = parseUWFile(doc('"\\u005f_proto__":\n  hidden: value\n"constructor": blocked\n"nested":\n  "prototype": blocked\n  "kept": value\nafter: retained'));
    expect(Object.hasOwn(parsed.frontmatter, '__proto__')).toBe(false);
    expect(Object.hasOwn(parsed.frontmatter, 'constructor')).toBe(false);
    expect((parsed.frontmatter as Record<string, unknown>).nested).toEqual({ kept: 'value' });
    expect((parsed.frontmatter as Record<string, unknown>).after).toBe('retained');
  });

  it.each(['"broken: value', '"\\q": value', '"closed" junk: value', 'nested:\n  \'broken: value'])('refuses malformed quoted mapping keys: %s', rows => {
    expect(() => parseUWFile(doc(rows))).toThrow(UWMDParseError);
    try { parseUWFile(doc(rows)); } catch (error) {
      expect((error as UWMDParseError).code).toBe('UNSUPPORTED_YAML_FEATURE');
    }
  });
});
