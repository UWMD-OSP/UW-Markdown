// CAPX-01…CAPX-08 — the RFC 0057 renovation draw and expense-targeted capex.
//
// Nothing here applies a saving. `annual_savings` is stated; CAPX-07 makes the
// author say whether they already put it in the NOI model, which is the thing
// that keeps a reader from counting it twice.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

const DRAW = {
  budget: 4_000_000,
  contingency: 500_000,
  contingency_used: 120_000,
  drawn_to_date: 1_850_000,
  as_of_date: '2026-09-01',
};

const RETROFIT = {
  label: 'LED and controls retrofit',
  amount: 600_000,
  targets: 'utilities',
  annual_savings: 95_000,
  savings_begin: 'Y2',
  in_noi_model: false,
};

function doc(renovation: unknown, uses: Record<string, unknown> = {}, noi?: unknown): string {
  const hdr = 'source=manual ts=2026-09-16T00:00:00Z v=1';
  const blocks = [
    `\`\`\`json uw:section=sources_uses variant=base ${hdr}
${JSON.stringify({ uses: { ...uses, ...(renovation === undefined ? {} : { renovation }) } }, null, 2)}
\`\`\``,
  ];
  if (noi !== undefined) {
    blocks.push(`\`\`\`json uw:section=noi_model variant=base ${hdr}
${JSON.stringify(noi, null, 2)}
\`\`\``);
  }
  return `---
uw_version: "1.1"
deal_id: TEST-CAPX
asset_class: multifamily
---

${blocks.join('\n\n')}
`;
}

const codes = (renovation: unknown, uses: Record<string, unknown> = {}, noi?: unknown): string[] =>
  validateUWFile(parseUWFile(doc(renovation, uses, noi))).issues
    .filter(i => i.code.startsWith('CAPX-')).map(i => i.code);

const draw = (over: Record<string, unknown> = {}) => ({ ...DRAW, ...over });

/** An noi_model whose expenses carry the keys a target can name. */
const NOI = { expenses: { utilities: { value: 310_000 }, insurance: { value: 88_000 } } };

describe('RFC 0057 — the quiet path', () => {
  it('accepts a full draw with a verified remaining and a retrofit', () => {
    expect(codes(
      draw({ contingency_remaining: 380_000, expense_targeted: [{ ...RETROFIT, simple_payback_years: 6.3158 }] }),
      { renovation_budget: 4_000_000, renovation_contingency: 500_000 },
      NOI,
    )).toEqual([]);
  });

  it('leaves a document stating no renovation untouched', () => {
    expect(codes(undefined, { renovation_budget: 4_000_000, purchase_price: 20_000_000 })).toEqual([]);
  });

  it('accepts a draw with nothing spent yet', () => {
    expect(codes(draw({ contingency_used: 0, drawn_to_date: 0, contingency_remaining: 500_000 })))
      .toEqual([]);
  });
});

describe('RFC 0057 the draw', () => {
  it('CAPX-01 refuses a non-object renovation', () => {
    expect(codes('four million')).toEqual(['CAPX-01']);
  });

  it.each([
    ['a negative budget', { budget: -1 }],
    ['a non-numeric contingency', { contingency: 'some' }],
    ['a missing drawn_to_date', { drawn_to_date: undefined }],
    ['an impossible as_of_date', { as_of_date: '2026-02-30' }],
    ['a missing as_of_date', { as_of_date: undefined }],
  ])('CAPX-01 refuses %s', (_n, over) => {
    expect(codes(draw(over))).toContain('CAPX-01');
  });

  it('CAPX-02 refuses a contingency drawn past its size', () => {
    expect(codes(draw({ contingency_used: 600_000 }))).toEqual(['CAPX-02']);
  });

  it('CAPX-02 accepts a fully drawn contingency at exactly its size', () => {
    expect(codes(draw({ contingency_used: 500_000, contingency_remaining: 0 }))).toEqual([]);
  });

  it('CAPX-03 refuses a total above budget plus contingency', () => {
    expect(codes(draw({ drawn_to_date: 4_600_000 }))).toEqual(['CAPX-03']);
  });

  it('CAPX-03 refuses a total below the contingency already drawn', () => {
    expect(codes(draw({ contingency_used: 300_000, drawn_to_date: 100_000 }))).toEqual(['CAPX-03']);
  });

  it('CAPX-03 accepts a total at exactly budget plus contingency', () => {
    expect(codes(draw({ contingency_used: 500_000, drawn_to_date: 4_500_000 }))).toEqual([]);
  });

  it.each([
    ['a remaining that does not subtract', 400_000],
    ['a non-numeric remaining', 'most of it'],
  ])('CAPX-04 refuses %s', (_n, contingency_remaining) => {
    expect(codes(draw({ contingency_remaining }))).toContain('CAPX-04');
  });

  it('CAPX-04 compares at the currency quantum', () => {
    expect(codes(draw({ contingency_remaining: 380_000.002 }))).toEqual([]);
  });

  it.each([
    ['renovation_budget', 'budget'],
    ['renovation_contingency', 'contingency'],
  ])('CAPX-05 refuses a legacy %s disagreeing with %s', (legacy) => {
    expect(codes(draw(), { [legacy]: 999 })).toEqual(['CAPX-05']);
  });

  it('CAPX-05 stays quiet when only the legacy scalar is stated', () => {
    expect(codes(undefined, { renovation_budget: 999 })).toEqual([]);
  });
});

describe('RFC 0057 expense-targeted capex', () => {
  const targeted = (over: Record<string, unknown> = {}) =>
    draw({ expense_targeted: [{ ...RETROFIT, ...over }] });

  it.each([
    ['a non-array', 'a retrofit'],
    ['an empty array', []],
  ])('CAPX-06 refuses %s', (_n, expense_targeted) => {
    expect(codes(draw({ expense_targeted }))).toContain('CAPX-06');
  });

  it.each([
    ['an empty label', { label: '  ' }],
    ['a negative amount', { amount: -1 }],
    ['a negative saving', { annual_savings: -1 }],
    ['a non-numeric amount', { amount: 'lots' }],
    ['a malformed savings_begin', { savings_begin: 'year two' }],
    ['a Y0 selector', { savings_begin: 'Y0' }],
    ['a missing targets', { targets: undefined }],
    ['a non-object entry', undefined],
  ])('CAPX-06 refuses %s', (_n, over) => {
    const d = over === undefined
      ? draw({ expense_targeted: ['a retrofit'] })
      : targeted(over);
    expect(codes(d, {}, NOI)).toContain('CAPX-06');
  });

  it.each([['Y2'], ['2027-Q1'], ['2027-03'], ['2027-03-15']])(
    'CAPX-06 accepts the RFC 0041 selector %s', (savings_begin) => {
      expect(codes(targeted({ savings_begin }), {}, NOI)).toEqual([]);
    });

  it('CAPX-06 refuses a target naming no expense key', () => {
    expect(codes(targeted({ targets: 'parking_revenue' }), {}, NOI)).toEqual(['CAPX-06']);
  });

  it('CAPX-06 checks the keys present, not a hardcoded list', () => {
    const custom = { expenses: { org_uwmd_chiller_service: { value: 40_000 } } };
    expect(codes(targeted({ targets: 'org_uwmd_chiller_service' }), {}, custom)).toEqual([]);
  });

  it('CAPX-06 does not check the target when noi_model is absent', () => {
    expect(codes(targeted({ targets: 'anything_at_all' }))).toEqual([]);
  });

  it.each([
    ['a missing flag', undefined],
    ['a string standing in for a boolean', 'no'],
  ])('CAPX-07 refuses %s for in_noi_model', (_n, in_noi_model) => {
    expect(codes(targeted({ in_noi_model }), {}, NOI)).toEqual(['CAPX-07']);
  });

  it('CAPX-07 accepts a saving declared already inside the NOI', () => {
    expect(codes(targeted({ in_noi_model: true }), {}, NOI)).toEqual([]);
  });

  it.each([
    ['a payback that does not divide', 4],
    ['a negative payback', -1],
    ['a non-numeric payback', 'six years'],
  ])('CAPX-08 refuses %s', (_n, simple_payback_years) => {
    expect(codes(targeted({ simple_payback_years }), {}, NOI)).toContain('CAPX-08');
  });

  it('CAPX-08 refuses a payback stated against zero savings', () => {
    expect(codes(targeted({ annual_savings: 0, simple_payback_years: 10 }), {}, NOI))
      .toEqual(['CAPX-08']);
  });

  it('CAPX-08 allows zero savings when no payback is claimed', () => {
    expect(codes(targeted({ annual_savings: 0 }), {}, NOI)).toEqual([]);
  });

  it('checks every entry, not just the first', () => {
    expect(codes(draw({
      expense_targeted: [RETROFIT, { ...RETROFIT, label: 'Boiler', in_noi_model: undefined }],
    }), {}, NOI)).toEqual(['CAPX-07']);
  });
});
