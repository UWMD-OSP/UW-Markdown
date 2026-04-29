import { describe, expect, it } from 'vitest';
import { checkDataQuality } from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

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
      timestamp: '2026-04-27T00:00:00Z',
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

function makeFile(opts: {
  deal_stage?: ParsedUWFile['frontmatter']['deal_stage'];
  sections?: Record<string, UWBlock>;
} = {}): ParsedUWFile {
  return {
    frontmatter: {
      asset_class: 'multifamily',
      deal_stage: opts.deal_stage,
    } as ParsedUWFile['frontmatter'],
    sections: opts.sections ?? {},
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: '',
  };
}

describe('checkDataQuality — DQ-01: provisional without gap', () => {
  it('emits DQ-01 for a provisional block with no gaps section', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: { noi_model: makeBlock('noi_model', { expense_ratio: 0.4 }, { provisional: true }) },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-01' && i.section === 'noi_model')).toBeDefined();
  });

  it('does NOT emit DQ-01 when the gaps section references the block', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        noi_model: makeBlock('noi_model', { expense_ratio: 0.4 }, { provisional: true }),
        gaps: makeBlock('gaps', { items: [{ section: 'noi_model', reason: 'deferred' }] }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-01')).toBeUndefined();
  });
});

describe('checkDataQuality — DQ-02: provisional consumed at halt stage', () => {
  it('emits DQ-02 for provisional rent_roll at full_underwrite', () => {
    const file = makeFile({
      deal_stage: 'full_underwrite',
      sections: {
        rent_roll: makeBlock('rent_roll', { units: [] }, { provisional: true }),
        gaps: makeBlock('gaps', { items: [{ section: 'rent_roll', reason: 'deferred' }] }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-02')).toBeDefined();
  });

  it('does NOT emit DQ-02 when stage allows substitution', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        rent_roll: makeBlock('rent_roll', { units: [] }, { provisional: true }),
        gaps: makeBlock('gaps', { items: [{ section: 'rent_roll', reason: 'deferred' }] }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-02')).toBeUndefined();
  });
});

describe('checkDataQuality — DQ-03: partial without overrides', () => {
  it('emits DQ-03 for partial=true with empty field_overrides', () => {
    const file = makeFile({
      sections: {
        rent_roll: makeBlock('rent_roll', { units: [] }, { partial: true }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-03')).toBeDefined();
  });

  it('does NOT emit DQ-03 when field_overrides are present', () => {
    const file = makeFile({
      sections: {
        rent_roll: makeBlock(
          'rent_roll',
          { units: [] },
          { partial: true, field_overrides: [{ path: 'units[0]', reason: 'illegible' }] },
        ),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues);
    expect(issues.find((i) => i.code === 'DQ-03')).toBeUndefined();
  });
});

describe('checkDataQuality — DQ-05: stale gaps', () => {
  it('emits DQ-05 when a gap last_checked is older than threshold', () => {
    const file = makeFile({
      sections: {
        gaps: makeBlock('gaps', {
          items: [
            { section: 'rent_roll', reason: 'missing', last_checked: '2026-01-01T00:00:00Z' },
          ],
        }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues, { now: '2026-04-27T00:00:00Z', gap_staleness_days: 14 });
    expect(issues.find((i) => i.code === 'DQ-05')).toBeDefined();
  });

  it('does NOT emit DQ-05 when last_checked is recent', () => {
    const file = makeFile({
      sections: {
        gaps: makeBlock('gaps', {
          items: [
            { section: 'rent_roll', reason: 'missing', last_checked: '2026-04-26T00:00:00Z' },
          ],
        }),
      },
    });
    const issues: ValidationMessage[] = [];
    checkDataQuality(file, issues, { now: '2026-04-27T00:00:00Z', gap_staleness_days: 14 });
    expect(issues.find((i) => i.code === 'DQ-05')).toBeUndefined();
  });
});
