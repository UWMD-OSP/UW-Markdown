// HDG-01…HDG-06 and ESC-01…ESC-04 — the RFC 0056 rate-hedge and escrow checks.
//
// Every rule here reads a figure the author stated. Nothing prices a cap,
// projects a strike crossing or rolls an escrow balance forward.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

const HEDGE = {
  instrument: 'rate_cap',
  notional: 30_000_000,
  strike_rate: 0.035,
  index: 'sofr',
  effective_date: '2026-01-01',
  expiration_date: '2029-01-01',
  premium: 410_000,
  post_expiration_assumption: 'unhedged',
};

function doc(debt: Record<string, unknown> | null, uses?: Record<string, unknown>): string {
  const blocks: string[] = [];
  if (debt) {
    blocks.push(`\`\`\`json uw:section=debt_structure variant=base source=manual ts=2026-09-15T00:00:00Z v=1
${JSON.stringify(debt, null, 2)}
\`\`\``);
  }
  if (uses) {
    blocks.push(`\`\`\`json uw:section=sources_uses variant=base source=manual ts=2026-09-15T00:00:00Z v=1
${JSON.stringify({ uses }, null, 2)}
\`\`\``);
  }
  return `---
uw_version: "1.1"
deal_id: TEST-HDG
asset_class: office
---

${blocks.join('\n\n')}
`;
}

const codes = (debt: Record<string, unknown> | null, uses?: Record<string, unknown>): string[] =>
  validateUWFile(parseUWFile(doc(debt, uses))).issues
    .filter(i => i.code.startsWith('HDG-') || i.code.startsWith('ESC-'))
    .map(i => i.code);

/** A floating loan carrying a hedge, with the members under test overridden. */
const debt = (over: Record<string, unknown> = {}, hedge: Record<string, unknown> = {}) => ({
  rate_type: 'floating',
  ...over,
  rate_hedge: { ...HEDGE, ...hedge },
});

describe('RFC 0056 — the quiet path', () => {
  it('accepts a floating loan with a full hedge and matching escrows', () => {
    expect(codes(
      debt({ rate_cap_pct: 0.035 }, { post_expiration_assumption: 'replace' }),
      {
        rate_cap_cost: 410_000,
        interest_reserve: 750_000,
        escrows: [
          { name: 'tax', upfront: 120_000, monthly: 30_000, lender_required: true },
          { name: 'insurance', monthly: 8_000 },
          { name: 'interest', upfront: 750_000 },
          { name: 'rate_cap_replacement', upfront: 0, monthly: 12_500 },
          { name: 'other', label: 'Seismic retrofit holdback', upfront: 250_000 },
        ],
      },
    )).toEqual([]);
  });

  it('leaves a document stating neither member untouched', () => {
    expect(codes({ rate_type: 'fixed', interest_rate: 0.0551 }, { purchase_price: 1 })).toEqual([]);
  });

  it('leaves a legacy rate_cap_pct with no typed hedge alone', () => {
    expect(codes({ rate_type: 'floating', rate_cap_pct: 0.035 })).toEqual([]);
  });

  it('says nothing about escrows when sources_uses is absent', () => {
    expect(codes(debt({}, { post_expiration_assumption: 'replace' }))).toEqual([]);
  });
});

describe('RFC 0056 rate hedge', () => {
  it('HDG-01 refuses a non-object hedge', () => {
    expect(codes({ rate_type: 'floating', rate_hedge: 'a cap' })).toEqual(['HDG-01']);
  });

  it.each([
    ['an unknown instrument', { instrument: 'weather_derivative' }],
    ['a negative notional', { notional: -1 }],
    ['a non-numeric notional', { notional: 'thirty million' }],
    ['a strike at 0', { strike_rate: 0 }],
    ['a strike at 1', { strike_rate: 1 }],
    ['a percent rather than a fraction', { strike_rate: 3.5 }],
    ['an unknown index', { index: 'libor' }],
    ['a fixed index — a cap is not struck against fixed', { index: 'fixed' }],
    ['an impossible effective date', { effective_date: '2026-02-30' }],
    ['a missing expiration', { expiration_date: undefined }],
    ['an expiration equal to the effective date', { expiration_date: '2026-01-01' }],
    ['an expiration before the effective date', { expiration_date: '2025-01-01' }],
    ['a negative premium', { premium: -5 }],
  ])('HDG-01 refuses %s', (_n, over) => {
    expect(codes(debt({}, over))).toContain('HDG-01');
  });

  it('accepts a null premium as genuinely none', () => {
    expect(codes(debt({}, { premium: null }))).toEqual([]);
  });

  it.each([['rate_swap'], ['rate_collar']])('HDG-02 reserves and refuses %s', (instrument) => {
    const got = codes(debt({}, { instrument }));
    expect(got).toContain('HDG-02');
    // The reserved name gets its own message, not "unknown instrument".
    expect(got).not.toContain('HDG-01');
  });

  it.each([['fixed'], [undefined]])('HDG-03 refuses a hedge on a %s-rate loan', (rate_type) => {
    expect(codes(debt({ rate_type }))).toContain('HDG-03');
  });

  it('HDG-03 accepts a hybrid loan', () => {
    expect(codes(debt({ rate_type: 'hybrid' }))).toEqual([]);
  });

  it('HDG-04 refuses a legacy rate_cap_pct that disagrees with the strike', () => {
    expect(codes(debt({ rate_cap_pct: 0.04 }))).toEqual(['HDG-04']);
  });

  it('HDG-05 refuses a premium that disagrees with the use that funds it', () => {
    expect(codes(debt(), { rate_cap_cost: 500_000 })).toEqual(['HDG-05']);
  });

  it('HDG-05 compares at the currency quantum, not by identity', () => {
    expect(codes(debt({}, { premium: 410_000.001 }), { rate_cap_cost: 410_000 })).toEqual([]);
  });

  it.each([
    ['nothing', undefined],
    ['an unknown assumption', 'refinance_out'],
  ])('HDG-06 refuses %s for post_expiration_assumption', (_n, post_expiration_assumption) => {
    expect(codes(debt({}, { post_expiration_assumption }))).toEqual(['HDG-06']);
  });
});

describe('RFC 0056 escrows', () => {
  const su = (escrows: unknown, rest: Record<string, unknown> = {}) => ({ escrows, ...rest });

  it.each([
    ['a non-array', { name: 'tax', upfront: 1 }],
    ['an empty array', []],
  ])('ESC-01 refuses %s', (_n, escrows) => {
    expect(codes(null, su(escrows))).toEqual(['ESC-01']);
  });

  it.each([
    ['an unknown name', { name: 'sinking_fund', upfront: 1 }],
    ['a missing name', { upfront: 1 }],
    ['a negative upfront', { name: 'tax', upfront: -1 }],
    ['a negative monthly', { name: 'tax', monthly: -1 }],
    ['a non-numeric amount', { name: 'tax', upfront: 'some' }],
    ['neither amount stated', { name: 'tax', lender_required: true }],
    ['a null on both amounts', { name: 'tax', upfront: null, monthly: null }],
    ['a non-object entry', 'tax'],
  ])('ESC-01 refuses %s', (_n, entry) => {
    expect(codes(null, su([entry]))).toContain('ESC-01');
  });

  it('accepts an escrow funding monthly only', () => {
    expect(codes(null, su([{ name: 'insurance', monthly: 8_000 }]))).toEqual([]);
  });

  it('accepts a zero upfront — a lender-required escrow can start empty', () => {
    expect(codes(null, su([{ name: 'ti_lc', upfront: 0 }]))).toEqual([]);
  });

  it.each([
    ['an "other" with no label', [{ name: 'other', upfront: 1 }]],
    ['an "other" with a blank label', [{ name: 'other', label: '   ', upfront: 1 }]],
    ['a named escrow carrying a label', [{ name: 'tax', label: 'County', upfront: 1 }]],
    ['a duplicated name', [{ name: 'tax', upfront: 1 }, { name: 'tax', upfront: 2 }]],
    ['two "other" escrows sharing a label', [
      { name: 'other', label: 'Holdback', upfront: 1 },
      { name: 'other', label: 'Holdback', upfront: 2 },
    ]],
  ])('ESC-02 refuses %s', (_n, escrows) => {
    expect(codes(null, su(escrows))).toContain('ESC-02');
  });

  it('ESC-02 accepts two "other" escrows with distinct labels', () => {
    expect(codes(null, su([
      { name: 'other', label: 'Seismic holdback', upfront: 1 },
      { name: 'other', label: 'Environmental holdback', upfront: 2 },
    ]))).toEqual([]);
  });

  it.each([
    ['interest_reserve', 'interest'],
    ['operating_reserves', 'operating'],
  ])('ESC-03 refuses a %s disagreeing with the %s escrow', (legacy, name) => {
    expect(codes(null, su([{ name, upfront: 500_000 }], { [legacy]: 750_000 })))
      .toEqual(['ESC-03']);
  });

  it('ESC-03 stays quiet when only the legacy scalar is stated', () => {
    expect(codes(null, su([{ name: 'tax', upfront: 1 }], { interest_reserve: 750_000 }))).toEqual([]);
  });

  it('ESC-03 stays quiet when the escrow states only a monthly deposit', () => {
    expect(codes(null, su([{ name: 'interest', monthly: 50_000 }], { interest_reserve: 750_000 })))
      .toEqual([]);
  });
});

describe('RFC 0056 — the replacement tie (ESC-04)', () => {
  it('refuses "replace" with no replacement escrow', () => {
    expect(codes(
      debt({}, { post_expiration_assumption: 'replace' }),
      { escrows: [{ name: 'tax', upfront: 1 }] },
    )).toEqual(['ESC-04']);
  });

  it('refuses "replace" with no escrows array at all', () => {
    expect(codes(debt({}, { post_expiration_assumption: 'replace' }), { purchase_price: 1 }))
      .toEqual(['ESC-04']);
  });

  it.each([['unhedged'], ['loan_matures_first']])(
    'refuses a replacement escrow under "%s"', (post_expiration_assumption) => {
      expect(codes(
        debt({}, { post_expiration_assumption }),
        { escrows: [{ name: 'rate_cap_replacement', upfront: 300_000 }] },
      )).toEqual(['ESC-04']);
    },
  );

  it('refuses a replacement escrow with no hedge stated at all', () => {
    expect(codes(null, { escrows: [{ name: 'rate_cap_replacement', upfront: 300_000 }] }))
      .toEqual(['ESC-04']);
  });

  it('accepts the pair', () => {
    expect(codes(
      debt({}, { post_expiration_assumption: 'replace' }),
      { escrows: [{ name: 'rate_cap_replacement', upfront: 300_000 }] },
    )).toEqual([]);
  });
});
