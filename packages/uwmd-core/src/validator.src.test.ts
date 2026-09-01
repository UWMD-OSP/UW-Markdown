// SRC-01 / SRC-02 — the RFC 0031 source-vocabulary checks.
//
// `_meta.source` is actor-only (`manual` or `<namespace>/<id>`); the canonical
// SOURCE_TAGS vocabulary belongs in `_meta.resolution`. Both codes are
// warnings for all of format 1.x: a legacy source still parses and still
// edits (through the conservative catch-all policy) — the warning is producer
// guidance, not a refusal.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { SOURCE_TAGS } from './types.js';

function makeBlock(
  sectionId: string,
  content: unknown,
  meta: Partial<UWBlock['meta']> = {},
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: content as Record<string, unknown>,
    meta: {
      section: sectionId,
      version: 1,
      superseded: false,
      source: 'manual',
      agent_id: null,
      agent_version: null,
      actor: 'test',
      timestamp: '2026-08-31T00:00:00Z',
      confidence: 'medium',
      human_review_required: false,
      flags: [],
      input_hash: null,
      notes: null,
      ...meta,
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function makeFile(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
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
  it('warns on the retired colon form and on bare words', () => {
    for (const source of ['agent:L0-01', 'engine:calculations.ts', 'user', 'wizard', 'alien/xyz']) {
      const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { source }) });
      const issues = srcIssues(file);
      expect(issues, source).toHaveLength(1);
      expect(issues[0]!.code, source).toBe('SRC-01');
      expect(issues[0]!.severity, source).toBe('warning');
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
  it('warns on every canonical tag except manual', () => {
    for (const tag of SOURCE_TAGS) {
      if (tag === 'manual') continue;
      const file = makeFile({ property: makeBlock('property', { total_units: 10 }, { source: tag }) });
      const issues = srcIssues(file);
      expect(issues, tag).toHaveLength(1);
      expect(issues[0]!.code, tag).toBe('SRC-02');
      expect(issues[0]!.severity, tag).toBe('warning');
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
