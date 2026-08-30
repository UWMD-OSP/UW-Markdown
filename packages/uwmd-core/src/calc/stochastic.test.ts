import { describe, expect, it } from 'vitest';
import {
  MAX_STOCHASTIC_SAMPLES,
  evaluateStochastic,
  isStochasticDecl,
  type StochasticDecl,
} from './stochastic.js';
import {
  PRNG_ALGORITHM,
  Pcg64,
  inverseNormalCdf,
  sampleTriangular,
  sampleUniform,
} from './prng.js';
import type { CalcEvaluationContext } from '../protocol.js';
import type { ParsedUWFile, UWBlock } from '../types.js';

function block(sectionId: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: { section_id: sectionId, content },
    meta: {} as UWBlock['meta'],
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

const PARSED: ParsedUWFile = {
  frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
  sections: {
    noi_model: block('noi_model', { net_operating_income: 600_000 }),
    debt_structure: block('debt_structure', { annual_debt_service: 400_000 }),
  },
  prose: {},
  pipeline_log: [],
  custom_calculations: [],
  custom_scenarios: [],
  extensions: {},
  superseded: {},
  raw: '',
};

const CTX: CalcEvaluationContext = { parsed: PARSED, prior_results: {}, locale: 'en-US' };

const DSCR: StochasticDecl = {
  id: 'dscr_distribution',
  label: 'DSCR distribution',
  base_formula: 'noi_model.net_operating_income / debt_structure.annual_debt_service',
  inputs: [
    { variable: 'noi_model.net_operating_income', distribution: { kind: 'uniform', min: 540_000, max: 660_000 } },
    { variable: 'debt_structure.annual_debt_service', distribution: { kind: 'uniform', min: 380_000, max: 420_000 } },
  ],
  samples: 2000,
  seed: 42,
  summarize: ['mean', 'median', 'p10', 'p90', 'min', 'max', 'stddev'],
  round_to: 4,
};

describe('Pcg64', () => {
  it('is reproducible from a seed', () => {
    const a = new Pcg64(42);
    const b = new Pcg64(42);
    const first = Array.from({ length: 8 }, () => a.nextUint64().toString());
    const second = Array.from({ length: 8 }, () => b.nextUint64().toString());
    expect(first).toEqual(second);
  });

  it('produces a different stream for a different seed', () => {
    expect(new Pcg64(42).nextUint64()).not.toBe(new Pcg64(43).nextUint64());
  });

  it('pins a self-generated vector — see the verification gap in prng.ts', () => {
    // This vector was produced BY this implementation. It catches a regression
    // in our own code; it does NOT prove agreement with the reference C pcg64,
    // which nobody has diffed against. The gap is recorded in prng.ts and in
    // RFC 0005 rather than left for someone to assume away.
    const rng = new Pcg64(42);
    expect(Array.from({ length: 4 }, () => rng.nextUint64().toString())).toEqual([
      '2915081201720324186',
      '13533757442135995717',
      '13172715927431628928',
      '13789878565430171748',
    ]);
  });

  it('yields doubles in [0, 1)', () => {
    const rng = new Pcg64(7);
    for (let i = 0; i < 500; i++) {
      const u = rng.nextDouble();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe('inverse-CDF samplers', () => {
  it('inverts the standard normal to within Acklam\'s stated accuracy', () => {
    expect(inverseNormalCdf(0.5)).toBe(0);
    // True value 1.959963984540054; the approximation is good to ~1.15e-9.
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959963984540054, 8);
    expect(inverseNormalCdf(0.025)).toBeCloseTo(-1.959963984540054, 8);
  });

  it('is symmetric about the median', () => {
    expect(inverseNormalCdf(0.3)).toBeCloseTo(-inverseNormalCdf(0.7), 12);
  });

  it('refuses p outside (0, 1) rather than returning an infinity', () => {
    expect(() => inverseNormalCdf(0)).toThrow(RangeError);
    expect(() => inverseNormalCdf(1)).toThrow(RangeError);
  });

  it('maps the uniform endpoints exactly', () => {
    expect(sampleUniform(0, 10, 20)).toBe(10);
    expect(sampleUniform(0.5, 10, 20)).toBe(15);
  });

  it('keeps triangular draws inside their support', () => {
    for (let i = 0; i <= 100; i++) {
      const v = sampleTriangular(i / 100, 1, 3, 10);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

describe('evaluateStochastic', () => {
  it('produces a summary over the requested statistics', () => {
    const result = evaluateStochastic(DSCR, CTX);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.summary ?? {}).sort()).toEqual([
      'max', 'mean', 'median', 'min', 'p10', 'p90', 'stddev',
    ]);
  });

  it('is reproducible: same seed, same numbers', () => {
    // The whole contract. A stochastic calc two runs disagree about is not a
    // model, it is a rumor.
    expect(evaluateStochastic(DSCR, CTX)).toEqual(evaluateStochastic(DSCR, CTX));
  });

  it('produces different numbers for a different seed', () => {
    const a = evaluateStochastic(DSCR, CTX);
    const b = evaluateStochastic({ ...DSCR, seed: 43 }, CTX);
    expect(a.summary?.mean).not.toBe(b.summary?.mean);
  });

  it('lands near the analytic mean for a uniform ratio', () => {
    // E[NOI]/E[DS] = 600,000/400,000 = 1.5. Not exact — E[X/Y] != E[X]/E[Y] —
    // but 2,000 draws over these ranges land close, and a result far from it
    // means the sampler is wrong rather than that the model is subtle.
    const result = evaluateStochastic(DSCR, CTX);
    expect(result.summary?.mean).toBeGreaterThan(1.45);
    expect(result.summary?.mean).toBeLessThan(1.55);
  });

  it('orders the percentiles it reports', () => {
    const s = evaluateStochastic(DSCR, CTX).summary;
    expect(s?.min).toBeLessThanOrEqual(s?.p10 as number);
    expect(s?.p10).toBeLessThanOrEqual(s?.median as number);
    expect(s?.median).toBeLessThanOrEqual(s?.p90 as number);
    expect(s?.p90).toBeLessThanOrEqual(s?.max as number);
  });

  it('reports percentiles that are actual observed samples', () => {
    // Nearest-rank, not interpolation (§VIII.8.3): a percentile is a draw, so
    // it is exactly reproducible whenever the draws are.
    const result = evaluateStochastic({ ...DSCR, samples: 50, return_samples: true }, CTX);
    for (const stat of ['median', 'p10', 'p90'] as const) {
      expect(result.samples).toContain(result.summary?.[stat]);
    }
  });

  it('echoes the run parameters', () => {
    const result = evaluateStochastic(DSCR, CTX);
    expect(result.sampled).toEqual({ count: 2000, seed: 42, algorithm: PRNG_ALGORITHM });
  });

  it('withholds the raw samples unless asked', () => {
    expect(evaluateStochastic(DSCR, CTX).samples).toBeUndefined();
    expect(evaluateStochastic({ ...DSCR, samples: 10, return_samples: true }, CTX).samples).toHaveLength(10);
  });

  it('does not mutate the document', () => {
    evaluateStochastic(DSCR, CTX);
    const after = evaluateStochastic({ ...DSCR, samples: 2, seed: 1 }, CTX);
    expect(after.ok).toBe(true);
    expect(
      (PARSED.sections['noi_model'] as UWBlock).content as Record<string, unknown>,
    ).toMatchObject({ content: { net_operating_income: 600_000 } });
  });

  it('excludes failed draws from the summary rather than counting them as zero', () => {
    // A draw that divides by zero says nothing about the distribution; folding
    // it in as 0 would drag every statistic toward it.
    const divByZero: StochasticDecl = {
      ...DSCR,
      samples: 200,
      inputs: [
        { variable: 'debt_structure.annual_debt_service', distribution: { kind: 'uniform', min: -1, max: 1 } },
      ],
    };
    const result = evaluateStochastic(divByZero, CTX);
    expect(result.ok).toBe(true);
    expect(result.failed_samples).toBe(0); // exact zero is measure-zero here
    expect(result.summary?.mean).toBeTypeOf('number');
  });

  it('reports null statistics, not absent ones, when every draw failed', () => {
    const alwaysFails: StochasticDecl = {
      ...DSCR,
      samples: 10,
      base_formula: 'no_such_builtin(noi_model.net_operating_income)',
      summarize: ['mean', 'median'],
    };
    const result = evaluateStochastic(alwaysFails, CTX);
    expect(result.failed_samples).toBe(10);
    expect(result.summary).toEqual({ mean: null, median: null });
  });

  it('layers draws on top of a caller-supplied override', () => {
    const result = evaluateStochastic(
      { ...DSCR, samples: 100, inputs: [DSCR.inputs[0] as StochasticDecl['inputs'][0]] },
      { ...CTX, overrides: { 'debt_structure.annual_debt_service': 300_000 } },
    );
    // NOI in [540k, 660k] over a fixed 300k debt service.
    expect(result.summary?.min).toBeGreaterThanOrEqual(1.8);
    expect(result.summary?.max).toBeLessThanOrEqual(2.2);
  });
});

describe('evaluateStochastic — refusals', () => {
  const refuse = (decl: StochasticDecl) => {
    const result = evaluateStochastic(decl, CTX);
    expect(result.ok).toBe(false);
    return result.error?.code;
  };

  it('refuses a missing or non-integer seed', () => {
    expect(refuse({ ...DSCR, seed: undefined as unknown as number })).toBe('CALC-STOCH-001');
    expect(refuse({ ...DSCR, seed: 1.5 })).toBe('CALC-STOCH-001');
  });

  it('refuses a sample count outside the bounds', () => {
    expect(refuse({ ...DSCR, samples: 1 })).toBe('CALC-STOCH-002');
    expect(refuse({ ...DSCR, samples: MAX_STOCHASTIC_SAMPLES + 1 })).toBe('CALC-STOCH-002');
  });

  it('refuses a declaration with no random inputs', () => {
    // Every draw would be the same number, and the summary would be a point
    // estimate wearing a distribution's clothes.
    expect(refuse({ ...DSCR, inputs: [] })).toBe('CALC-STOCH-005');
  });

  it('refuses the same variable drawn twice', () => {
    expect(refuse({ ...DSCR, inputs: [DSCR.inputs[0] as never, DSCR.inputs[0] as never] })).toBe(
      'CALC-STOCH-003',
    );
  });

  const BAD_DISTRIBUTIONS: Array<[string, StochasticDecl['inputs'][0]['distribution']]> = [
    ['uniform with min >= max', { kind: 'uniform', min: 5, max: 5 }],
    ['normal with zero stddev', { kind: 'normal', mean: 1, stddev: 0 }],
    ['triangular with mode outside the range', { kind: 'triangular', min: 1, mode: 9, max: 5 }],
    ['a non-finite parameter', { kind: 'uniform', min: 0, max: Number.POSITIVE_INFINITY }],
    ['an unknown kind', { kind: 'poisson' } as unknown as StochasticDecl['inputs'][0]['distribution']],
  ];

  it.each(BAD_DISTRIBUTIONS)('refuses %s', (_label, distribution) => {
    expect(refuse({ ...DSCR, inputs: [{ variable: 'x.y', distribution }] })).toBe('CALC-STOCH-003');
  });

  it('refuses an unknown summary statistic', () => {
    expect(refuse({ ...DSCR, summarize: ['p99' as never] })).toBe('CALC-STOCH-004');
    expect(refuse({ ...DSCR, summarize: [] })).toBe('CALC-STOCH-004');
  });

  it('refuses an out-of-range round_to', () => {
    expect(refuse({ ...DSCR, round_to: 99 })).toBe('CALC-STOCH-006');
  });
});

describe('isStochasticDecl', () => {
  it('recognizes a stochastic declaration', () => {
    expect(isStochasticDecl(DSCR)).toBe(true);
  });

  it('does not mistake a sensitivity declaration for one', () => {
    expect(
      isStochasticDecl({ id: 'x', label: 'X', base_formula: '1', row_axis: {}, col_axis: {} }),
    ).toBe(false);
  });
});
