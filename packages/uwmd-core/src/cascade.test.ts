import { describe, expect, it } from 'vitest';
import { resolveValue, type CascadeContext } from './cascade.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function makeBlock(sectionId: string, content: unknown, source: UWBlock['meta']['source'] = 'manual'): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: content as Record<string, unknown>,
    meta: {
      section: sectionId,
      version: 1,
      superseded: false,
      source,
      agent_id: null,
      agent_version: null,
      actor: 'test',
      timestamp: '2026-04-27T00:00:00Z',
      confidence: 'medium',
      human_review_required: false,
      flags: [],
      input_hash: null,
      notes: null,
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function makeFile(opts: {
  asset_class?: string;
  sections?: Record<string, UWBlock | { [variant: string]: UWBlock }>;
} = {}): ParsedUWFile {
  return {
    frontmatter: { asset_class: opts.asset_class ?? 'multifamily' } as ParsedUWFile['frontmatter'],
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

describe('cascade — empty file falls through to asset-class defaults', () => {
  it('returns multifamily default for expense_ratio', () => {
    const result = resolveValue('noi_model.expense_ratio', makeFile());
    expect(result.step).toBe('asset_class_default');
    expect(result.source).toBe('asset_class_default');
    expect(result.value).toBe(0.4);
    expect(result.range).toEqual({ low: 0.34, central: 0.4, high: 0.46 });
  });

  it('returns range for vacancy_pct', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile());
    expect(result.range?.low).toBe(0.04);
    expect(result.range?.high).toBe(0.1);
  });

  it('falls all the way through to system_default sentinel for unknown path', () => {
    const result = resolveValue('not.a.real.field', makeFile());
    expect(result.step).toBe('system_default');
    expect(result.value).toBeUndefined();
  });
});

describe('cascade — user_override wins over everything', () => {
  it('user_override beats asset_class_default', () => {
    const file = makeFile({
      sections: {
        noi_model: makeBlock('noi_model', { expense_ratio: 0.42 }, 'user_override'),
      },
    });
    const result = resolveValue('noi_model.expense_ratio', file);
    expect(result.step).toBe('user_override');
    expect(result.value).toBe(0.42);
  });

  it('user_override beats market_data', () => {
    const file = makeFile({
      sections: {
        noi_model: makeBlock('noi_model', { expense_ratio: 0.41 }, 'user_override'),
      },
    });
    const ctx: CascadeContext = {
      market: {
        resolve: () => ({ value: 0.39 }),
        staleness_seconds: 86400,
      },
    };
    const result = resolveValue('noi_model.expense_ratio', file, ctx);
    expect(result.step).toBe('user_override');
    expect(result.value).toBe(0.41);
  });

  it('respects field_overrides for a finer-grained source tag', () => {
    const block = makeBlock('noi_model', { expense_ratio: 0.43 }, 'asset_class_default');
    block.meta.field_overrides = [
      { path: 'expense_ratio', source: 'user_override', reason: 'overridden' },
    ];
    const file = makeFile({ sections: { noi_model: block } });
    const result = resolveValue('noi_model.expense_ratio', file);
    expect(result.step).toBe('user_override');
    expect(result.value).toBe(0.43);
  });
});

describe('cascade — user_input is step 2', () => {
  it('user_input wins over asset_class_default', () => {
    const file = makeFile({
      sections: {
        noi_model: makeBlock('noi_model', { expense_ratio: 0.38 }, 'user_input'),
      },
    });
    const result = resolveValue('noi_model.expense_ratio', file);
    expect(result.step).toBe('user_input');
  });

  it('manual is treated as user_input synonym', () => {
    const file = makeFile({
      sections: {
        noi_model: makeBlock('noi_model', { expense_ratio: 0.37 }, 'manual'),
      },
    });
    const result = resolveValue('noi_model.expense_ratio', file);
    expect(result.step).toBe('user_input');
    expect(result.value).toBe(0.37);
  });
});

describe('cascade — investor_profile is step 3', () => {
  it('investor_profile wins over market_data', () => {
    const ctx: CascadeContext = {
      profile: { values: { 'debt_structure.rate_pct': 0.058 }, source_id: 'fund-A:v1' },
      market: { resolve: () => ({ value: 0.07 }), staleness_seconds: 86400 },
    };
    const result = resolveValue('debt_structure.rate_pct', makeFile(), ctx);
    expect(result.step).toBe('investor_profile');
    expect(result.value).toBe(0.058);
    expect(result.resolved_from).toBe('fund-A:v1');
  });
});

describe('cascade — market_data is step 4', () => {
  it('market_data wins over asset_class_default', () => {
    const ctx: CascadeContext = {
      market: {
        resolve: () => ({ value: 0.072, range: { low: 0.07, central: 0.072, high: 0.074 } }),
        staleness_seconds: 86400,
      },
    };
    const result = resolveValue('debt_structure.rate_pct', makeFile(), ctx);
    expect(result.step).toBe('market_data');
    expect(result.value).toBe(0.072);
    expect(result.range?.central).toBe(0.072);
  });

  it('market_data null falls through to asset_class_default', () => {
    const ctx: CascadeContext = {
      market: { resolve: () => null, staleness_seconds: 86400 },
    };
    const result = resolveValue('debt_structure.rate_pct', makeFile(), ctx);
    expect(result.step).toBe('asset_class_default');
  });
});

describe('cascade — global_default and system_default are last resorts', () => {
  it('global_default fires when asset_class table has no entry', () => {
    const ctx: CascadeContext = {
      global: { values: { 'custom.thing': 99 } },
    };
    const result = resolveValue('custom.thing', makeFile(), ctx);
    expect(result.step).toBe('global_default');
    expect(result.value).toBe(99);
  });

  it('system_default is consulted only after global_default', () => {
    const ctx: CascadeContext = {
      system: { values: { 'custom.thing': 1 } },
    };
    const result = resolveValue('custom.thing', makeFile(), ctx);
    expect(result.step).toBe('system_default');
    expect(result.value).toBe(1);
  });
});

describe('cascade — asset class selection', () => {
  it('uses frontmatter.asset_class when ctx.asset_class omitted', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile({ asset_class: 'multifamily' }));
    expect(result.step).toBe('asset_class_default');
    expect(result.value).toBe(0.06);
  });

  it('uses self_storage defaults when registered', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile({ asset_class: 'self_storage' }));
    expect(result.step).toBe('asset_class_default');
    expect(result.value).toBe(0.12);
  });

  it('resolves an asset_class_default for hospitality', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile({ asset_class: 'hospitality' }));
    expect(result.step).toBe('asset_class_default');
    expect(result.value).toBe(0.28);
  });

  it('returns no asset_class_default for unregistered class (senior_housing)', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile({ asset_class: 'senior_housing' }));
    expect(result.step).toBe('system_default');
    expect(result.value).toBeUndefined();
  });

  it('explicit ctx.asset_class overrides frontmatter', () => {
    const result = resolveValue('rent_roll.vacancy_pct', makeFile({ asset_class: 'office' }), {
      asset_class: 'multifamily',
    });
    expect(result.step).toBe('asset_class_default');
  });
});
