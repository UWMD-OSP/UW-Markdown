// SRC-01 / SRC-02 / SRC-03 — the source-vocabulary checks (RFC 0031, Format §2.6).
//
// `_meta.provenance.source` is actor-only (`manual` or `<namespace>/<id>`); the
// canonical SOURCE_TAGS vocabulary belongs in `_meta.provenance.resolution`.
// All three codes are errors in Format 3.0, and no reader reinterprets a
// resolution tag found in the actor field (RFC 0081 §3).

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';
import type { ParsedUWFile, UWBlock, UWProvenance } from './types.js';
import { SOURCE_TAGS } from './types.js';

function makeBlock(
  sectionId: string,
  content: unknown,
  provenance: Partial<UWProvenance> = {},
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: content as Record<string, unknown>,
    meta: {
      section: sectionId,
      provenance: { source: 'manual', actor: 'test', agent_id: null, agent_version: null, timestamp: '2026-08-31T00:00:00Z', notes: null, ...provenance },
      quality: { confidence: 'medium', human_review_required: false, flags: [] },
      lifecycle: { revision: 1, superseded: false },
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function makeFile(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: { uw_version: '3.0', asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections,
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: '',
  };
}

function srcIssues(file: ParsedUWFile) {
  return validateUWFile(file).issues.filter((i) => i.code.startsWith('SRC-'));
}

describe('SRC-01 — unrecognized actor source', () => {
  it('refuses the retired colon form and bare words as errors', () => {
    for (const source of ['agent:L0-01', 'engine:calculations.ts', 'user', 'wizard', 'alien/xyz']) {
      const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { source }) });
      const issues = srcIssues(file);
      expect(issues, source).toHaveLength(1);
      expect(issues[0]!.code, source).toBe('SRC-01');
      expect(issues[0]!.severity, source).toBe('error');
    }
  });

  it('stays silent for manual and every registered namespace', () => {
    for (const source of [
      'manual', 'agent/L6-01', 'document/rent_roll', 'system/init',
      'institution/threshold-override', 'system/calculations.ts',
    ]) {
      const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { source }) });
      expect(srcIssues(file), source).toHaveLength(0);
    }
  });

  it('does not fire when source is absent — that is META/DQ territory', () => {
    const file = makeFile({
      property: makeBlock('property', { total_units: 10 }, { source: undefined as unknown as string }),
    });
    expect(srcIssues(file)).toHaveLength(0);
  });
});

describe('SRC-02 — resolution tag in the actor field', () => {
  it('refuses every canonical tag as an error (manual is an actor, not a tag)', () => {
    for (const tag of SOURCE_TAGS) {
      const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { source: tag }) });
      const issues = srcIssues(file);
      expect(issues, tag).toHaveLength(1);
      expect(issues[0]!.code, tag).toBe('SRC-02');
      expect(issues[0]!.severity, tag).toBe('error');
    }
  });

  it('never double-fires SRC-01 for a tag — the two triggers are disjoint', () => {
    const file = makeFile({
      property: makeBlock('property', { total_units: 10 }, { source: 'market_data' }),
    });
    expect(srcIssues(file).map((i) => i.code)).toEqual(['SRC-02']);
  });

  it('stays silent when the split is done properly — actor in source, tag in resolution', () => {
    const file = makeFile({
      property: makeBlock('property', { total_units: 10 }, {
        source: 'agent/L6-01',
        resolution: 'asset_class_default',
      }),
    });
    expect(srcIssues(file)).toHaveLength(0);
  });
});

describe('SRC-03 — resolution outside the closed vocabulary', () => {
  it.each(['manual', 'wizard', 'agent/L6-01', 'User_Input'])('refuses resolution %s as an error', (resolution) => {
    const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { resolution }) });
    const issues = srcIssues(file);
    expect(issues.map((i) => i.code)).toEqual(['SRC-03']);
    expect(issues[0]!.severity).toBe('error');
  });

  it.each([...SOURCE_TAGS])('accepts resolution %s', (resolution) => {
    const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { resolution }) });
    expect(srcIssues(file)).toHaveLength(0);
  });
});

// RFC 0101 (#413): every present value outside the §2.6 grammar is SRC-01.
describe('SRC-01 — present non-string or empty source (RFC 0101)', () => {
  const doc = (source: unknown) => parseUWFile(`---
uw_version: "3.0"
deal_id: src-0101
asset_class: multifamily
---

\`\`\`json uw:section=property
${JSON.stringify({
    _meta: {
      section: 'property',
      provenance: { source, actor: 'test', timestamp: '2026-10-19T00:00:00Z' },
      quality: { confidence: 'high', human_review_required: false },
      lifecycle: { revision: 1, superseded: false },
    },
    total_units: 10,
  })}
\`\`\`
`);
  const codes = (source: unknown) => validateUWFile(doc(source)).issues
    .filter((i) => i.code.startsWith('SRC-') || i.code === 'META_FIELD_MISSING_SOURCE')
    .map((i) => [i.code, i.field ?? null]);

  it.each([[''], [0], [false], [[]], [{}], [['manual']]])('refuses %j', (source) => {
    expect(codes(source)).toEqual([['SRC-01', '_meta.provenance.source']]);
  });

  it('refuses null and keeps the existing completeness warning', () => {
    const found = codes(null);
    expect(found).toContainEqual(['SRC-01', '_meta.provenance.source']);
    expect(found.map(([code]) => code)).toContain('META_FIELD_MISSING_SOURCE');
  });

  it('leaves an absent source to the completeness warning alone', () => {
    const parsed = parseUWFile(doc('manual').raw.replace('"source":"manual",', ''));
    const found = validateUWFile(parsed).issues.map((i) => i.code);
    expect(found).toContain('META_FIELD_MISSING_SOURCE');
    expect(found.filter((c) => c.startsWith('SRC-'))).toEqual([]);
  });
});

