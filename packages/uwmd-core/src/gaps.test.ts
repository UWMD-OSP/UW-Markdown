import { describe, expect, it } from 'vitest';
import { inferGaps, readGapsContent, summarizeGaps } from './gaps.js';
import { readGapsContent as readGapsContentStandard } from './gaps-content.js';
import type { ParsedUWFile, UWBlock, UWFieldOverride, UWQuality } from './types.js';

/** A test block; `quality` members override the defaults, `_overrides` sits beside the payload. */
function makeBlock(
  sectionId: string,
  content: unknown,
  quality: Partial<UWQuality> = {},
  overrides?: UWFieldOverride[],
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: { ...(content as Record<string, unknown>), ...(overrides ? { _overrides: overrides } : {}) },
    meta: {
      section: sectionId,
      provenance: { source: 'manual', actor: 'test', agent_id: null, agent_version: null, timestamp: '2026-04-27T00:00:00Z', notes: null },
      quality: { confidence: 'medium', human_review_required: false, flags: [], ...quality },
      lifecycle: { revision: 1, superseded: false },
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function makeFile(opts: {
  deal_stage?: ParsedUWFile['frontmatter']['deal_stage'];
  asset_class?: string;
  sections?: Record<string, UWBlock | { [variant: string]: UWBlock }>;
} = {}): ParsedUWFile {
  return {
    frontmatter: {
      asset_class: opts.asset_class ?? 'multifamily',
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

const NOW = '2026-04-27T12:00:00Z';

describe('inferGaps — stage-required sections', () => {
  it('an empty file at scope reports the property section as missing', () => {
    const items = inferGaps(makeFile({ deal_stage: 'scope' }), { now: NOW });
    const propertyItem = items.find((i) => i.section === 'property' && !i.field_path);
    expect(propertyItem).toBeDefined();
    expect(propertyItem?.reason).toBe('missing');
    expect(propertyItem?.blocks_stage).toBe('scope');
  });

  it('reports required field paths missing from a present section', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: { property: makeBlock('property', { /* address absent */ asset_class: 'multifamily' }) },
    });
    const items = inferGaps(file, { now: NOW });
    const addr = items.find((i) => i.section === 'property' && i.field_path === 'address');
    expect(addr).toBeDefined();
    expect(addr?.reason).toBe('missing');
  });

  it('required_one_of: missing all triggers a single gap', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        property: makeBlock('property', { address: '1 Main St', asset_class: 'multifamily' }),
      },
    });
    const items = inferGaps(file, { now: NOW });
    const oneOf = items.filter((i) => i.field_path === 'asking_price' || i.field_path === 'units');
    expect(oneOf.length).toBe(1);
  });

  it('required_one_of: present satisfies and emits no gap', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        property: makeBlock('property', { address: '1 Main', asset_class: 'multifamily', units: 100 }),
      },
    });
    const items = inferGaps(file, { now: NOW });
    expect(items.find((i) => i.field_path === 'asking_price')).toBeUndefined();
    expect(items.find((i) => i.field_path === 'units')).toBeUndefined();
  });
});

describe('inferGaps — provisional and partial flags', () => {
  it('a provisional block is recorded as deferred', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        property: makeBlock('property', { address: '1 Main', asset_class: 'multifamily', units: 100 }),
        noi_model: makeBlock('noi_model', { expense_ratio: 0.4 }, { provisional: true }),
      },
    });
    const items = inferGaps(file, { now: NOW });
    const noi = items.find((i) => i.section === 'noi_model' && !i.field_path);
    expect(noi?.reason).toBe('deferred');
  });

  it('partial without overrides is recorded at the section level', () => {
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        property: makeBlock('property', { address: '1 Main', asset_class: 'multifamily', units: 100 }),
        rent_roll: makeBlock('rent_roll', { units: [] }, { partial: true }),
      },
    });
    const items = inferGaps(file, { now: NOW });
    expect(items.find((i) => i.section === 'rent_roll' && !i.field_path)).toBeDefined();
  });

  it('_overrides with reason=missing/illegible produce one item per override', () => {
    const overrides: UWFieldOverride[] = [
      { path: 'units[7].current_rent', reason: 'illegible', note: 'smudged' },
      { path: 'units[8].current_rent', reason: 'missing' },
    ];
    const file = makeFile({
      deal_stage: 'scope',
      sections: {
        property: makeBlock('property', { address: '1 Main', asset_class: 'multifamily', units: 100 }),
        rent_roll: makeBlock('rent_roll', { units: [] }, { partial: true }, overrides),
      },
    });
    const items = inferGaps(file, { now: NOW });
    const ill = items.find((i) => i.field_path === 'units[7].current_rent');
    const miss = items.find((i) => i.field_path === 'units[8].current_rent');
    expect(ill?.reason).toBe('illegible');
    expect(ill?.note).toBe('smudged');
    expect(miss?.reason).toBe('missing');
    // Section-level partial gap is suppressed because overrides enumerate
    expect(items.find((i) => i.section === 'rent_roll' && !i.field_path)).toBeUndefined();
  });
});

describe('inferGaps — merge with existing gaps section', () => {
  it('preserves first_seen and owner from existing entries; refreshes last_checked', () => {
    const existing = makeBlock(
      'gaps',
      {
        items: [
          {
            section: 'property',
            reason: 'missing',
            blocks_stage: 'scope',
            first_seen: '2026-04-20T00:00:00Z',
            last_checked: '2026-04-20T00:00:00Z',
            owner: 'agent/L0a',
            note: 'awaiting OM',
          },
        ],
      },
    );
    const file = makeFile({ deal_stage: 'scope', sections: { gaps: existing } });
    const items = inferGaps(file, { mergeWithExisting: true, now: NOW });
    const property = items.find((i) => i.section === 'property');
    expect(property?.first_seen).toBe('2026-04-20T00:00:00Z');
    expect(property?.owner).toBe('agent/L0a');
    expect(property?.last_checked).toBe(NOW);
    expect(property?.note).toBe('awaiting OM');
  });
});

describe('summarizeGaps', () => {
  it('counts blocking_current_stage and blocking_next_stage correctly', () => {
    const items = [
      { section: 'property', reason: 'missing' as const, blocks_stage: 'scope' as const },
      { section: 'rent_roll', reason: 'missing' as const, blocks_stage: 'screening' as const },
      { section: 'noi_model', reason: 'deferred' as const, blocks_stage: 'full_underwrite' as const },
      { section: 'random', reason: 'deferred' as const },
    ];
    const summary = summarizeGaps(items, 'scope');
    expect(summary.total_open).toBe(4);
    expect(summary.blocking_current_stage).toBe(1);
    expect(summary.blocking_next_stage).toBe(1);
  });
});

describe('readGapsContent re-export', () => {
  it('is the standard-side reader from gaps-content.ts', () => {
    expect(readGapsContent).toBe(readGapsContentStandard);
  });
});
