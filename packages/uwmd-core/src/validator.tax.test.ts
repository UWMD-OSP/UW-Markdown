// TAX-01…TAX-08 — the RFC 0053 tax abatement and reassessment checks.
//
// Every rule checks a figure the author stated. Nothing here derives a tax, and
// nothing solves the exit-value/terminal-tax circularity — the calc engine has
// no iteration and this contract adds none.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';

/** The worked basis from the corpus: 70% of 7,200,000 = 5,040,000 AV, at 1.15%. */
const BASIS = {
  trigger: 'sale',
  jurisdiction: 'Maricopa County, AZ',
  value_basis: 7200000,
  assessment_ratio: 0.7,
  assessed_value: 5040000,
  millage_rate: 0.0115,
  indicated_tax: 57960,
  round_to_decimals: -3,
};

const PHASE_IN = [
  { period: 'Y1', full_tax: 58000, abated_tax: 0 },
  { period: 'Y2', full_tax: 59160, abated_tax: 14790 },
  { period: 'Y3', full_tax: 60343, abated_tax: 30172 },
];

function doc(tax: unknown, dcf?: unknown): string {
  const dcfBlock = dcf === undefined ? '' : `
\`\`\`json uw:section=dcf variant=base source=manual ts=2026-09-15T00:00:00Z v=1
${JSON.stringify(dcf, null, 2)}
\`\`\`
`;
  return `---
uw_version: "1.1"
deal_id: TEST-TAX
asset_class: multifamily
---

\`\`\`json uw:section=noi_model variant=base source=manual ts=2026-09-15T00:00:00Z v=1
${JSON.stringify({ expenses: { real_estate_taxes: tax } }, null, 2)}
\`\`\`
${dcfBlock}`;
}

const taxCodes = (source: string): string[] =>
  validateUWFile(parseUWFile(source)).issues.filter(i => i.code.startsWith('TAX-')).map(i => i.code);

const withBasis = (over: Record<string, unknown> = {}, tax: Record<string, unknown> = {}) =>
  doc({ value: 58000, sale_triggers_reassessment: true, ...tax, reassessment: { ...BASIS, ...over } });

describe('RFC 0053 reassessment basis', () => {
  it('accepts the corpus basis once it is typed', () => {
    expect(taxCodes(withBasis())).toEqual([]);
  });

  it('leaves a document stating none of the new members untouched', () => {
    expect(taxCodes(doc({
      value: 58000,
      source: 'reassessment_estimate',
      sale_triggers_reassessment: true,
      reassessment_basis: '70% of purchase price per Maricopa County methodology',
    }))).toEqual([]);
  });

  it('keeps the prose basis alongside the typed one without complaint', () => {
    expect(taxCodes(withBasis({}, {
      reassessment_basis: '70% of purchase price = $5,040,000 AV x 1.15% = $57,960',
    }))).toEqual([]);
  });

  it('TAX-01 refuses an assessed value that is not the ratio times the basis', () => {
    expect(taxCodes(withBasis({ assessed_value: 5000000 }))).toContain('TAX-01');
  });

  it('TAX-01 refuses a ratio stated without its basis', () => {
    const source = withBasis({ value_basis: undefined });
    expect(taxCodes(source)).toContain('TAX-01');
  });

  it.each(['marriage', '', 42, null])('TAX-01 refuses the trigger %s', (trigger) => {
    expect(taxCodes(withBasis({ trigger: trigger as never }))).toContain('TAX-01');
  });

  it.each(['assessed_value', 'millage_rate', 'indicated_tax'])('TAX-01 requires a finite %s', (key) => {
    expect(taxCodes(withBasis({ [key]: 'a lot' }))).toContain('TAX-01');
  });

  it('TAX-02 refuses an indicated tax off by a single cent', () => {
    expect(taxCodes(withBasis({ indicated_tax: 57960.01 }))).toContain('TAX-02');
  });

  it('TAX-03 refuses a stated value that is not the declared rounding', () => {
    // 57,960 at -3 decimals is 58,000; 59,000 is not a rounding of it.
    expect(taxCodes(withBasis({}, { value: 59000 }))).toContain('TAX-03');
  });

  it('TAX-03 refuses the same rounded value once round_to_decimals is omitted', () => {
    expect(taxCodes(withBasis({ round_to_decimals: undefined }))).toContain('TAX-03');
  });

  it('TAX-03 accepts an exact value at the default currency quantum', () => {
    expect(taxCodes(withBasis({ round_to_decimals: undefined }, { value: 57960 }))).toEqual([]);
  });

  it('TAX-03 refuses a fractional rounding quantum', () => {
    expect(taxCodes(withBasis({ round_to_decimals: 1.5 }))).toContain('TAX-03');
  });

  it('TAX-04 refuses a boolean that disagrees with the typed trigger', () => {
    expect(taxCodes(withBasis({}, { sale_triggers_reassessment: false }))).toContain('TAX-04');
  });

  it('TAX-04 accepts the boolean agreeing with a non-sale trigger', () => {
    expect(taxCodes(doc({
      value: 58000,
      sale_triggers_reassessment: false,
      reassessment: { ...BASIS, trigger: 'statutory_cycle' },
    }))).toEqual([]);
  });
});

describe('RFC 0053 abatement schedule', () => {
  const withAbatement = (over: Record<string, unknown>, value = 58000) =>
    doc({ value, abatement: { kind: 'phase_in', schedule: PHASE_IN, ...over } });

  it('accepts a phase-in schedule', () => {
    expect(taxCodes(withAbatement({}))).toEqual([]);
  });

  it('TAX-05 refuses a schedule of mixed granularity', () => {
    expect(taxCodes(withAbatement({
      schedule: [{ period: 'Y1', full_tax: 1, abated_tax: 0 }, { period: '2027-Q1', full_tax: 2, abated_tax: 0 }],
    }))).toContain('TAX-05');
  });

  it.each([
    ['out of order', [{ period: 'Y2', full_tax: 1, abated_tax: 0 }, { period: 'Y1', full_tax: 2, abated_tax: 0 }]],
    ['duplicated', [{ period: 'Y1', full_tax: 1, abated_tax: 0 }, { period: 'Y1', full_tax: 2, abated_tax: 0 }]],
  ])('TAX-05 refuses periods that are %s', (_name, schedule) => {
    expect(taxCodes(withAbatement({ schedule }))).toContain('TAX-05');
  });

  it('TAX-05 sorts holding years numerically, not lexically', () => {
    // A naive string compare puts Y10 before Y9 and would refuse this.
    expect(taxCodes(withAbatement({
      schedule: [{ period: 'Y9', full_tax: 1, abated_tax: 0 }, { period: 'Y10', full_tax: 2, abated_tax: 0 }],
    }))).toEqual([]);
  });

  it.each(['Y0', '2027-Q5', '2027-13', 'next year', '2027-02-30'])(
    'TAX-05 refuses the selector %s', (period) => {
      expect(taxCodes(withAbatement({ schedule: [{ period, full_tax: 1, abated_tax: 0 }] }))).toContain('TAX-05');
    });

  it('TAX-06 refuses an abated tax above the full tax', () => {
    expect(taxCodes(withAbatement({
      schedule: [{ period: 'Y1', full_tax: 100, abated_tax: 200 }],
    }))).toContain('TAX-06');
  });

  it('TAX-06 refuses a negative tax', () => {
    expect(taxCodes(withAbatement({
      schedule: [{ period: 'Y1', full_tax: 100, abated_tax: -1 }],
    }))).toContain('TAX-06');
  });

  it('TAX-06 refuses a freeze whose unabated tax decreases', () => {
    expect(taxCodes(withAbatement({
      kind: 'freeze',
      schedule: [{ period: 'Y1', full_tax: 100, abated_tax: 50 }, { period: 'Y2', full_tax: 90, abated_tax: 50 }],
    }))).toContain('TAX-06');
  });

  it('TAX-06 allows a phase-in whose unabated tax decreases', () => {
    expect(taxCodes(withAbatement({
      schedule: [{ period: 'Y1', full_tax: 100, abated_tax: 50 }, { period: 'Y2', full_tax: 90, abated_tax: 50 }],
    }))).toEqual([]);
  });

  it('TAX-06 refuses an unknown abatement kind', () => {
    expect(taxCodes(withAbatement({ kind: 'tax_holiday' }))).toContain('TAX-06');
  });

  it('TAX-07 ties the stabilized value to the named period', () => {
    expect(taxCodes(withAbatement({ stabilized_period: 'Y2' }, 14790))).toEqual([]);
  });

  it('TAX-07 refuses a stabilized value disagreeing with its period', () => {
    expect(taxCodes(withAbatement({ stabilized_period: 'Y2' }, 58000))).toContain('TAX-07');
  });

  it('TAX-07 refuses a stabilized period absent from the schedule', () => {
    expect(taxCodes(withAbatement({ stabilized_period: 'Y9' }))).toContain('TAX-07');
  });

  it('omitting stabilized_period leaves the snapshot unconnected and valid', () => {
    expect(taxCodes(withAbatement({}, 12345))).toEqual([]);
  });
});

describe('RFC 0053 terminal tax', () => {
  const EXIT_VALUE = 7750733;
  const dcfWith = (terminal: unknown) => ({
    exit_analysis: { exit_year: 5, exit_value_gross: EXIT_VALUE, terminal_tax: terminal },
  });
  const terminal = (over: Record<string, unknown> = {}) => ({
    trigger: 'sale',
    value_basis: EXIT_VALUE,
    assessment_ratio: 0.7,
    assessed_value: 5425513.1,
    millage_rate: 0.0115,
    indicated_tax: 62393.4,
    in_exit_noi: true,
    ...over,
  });

  it('accepts a terminal tax whose basis is the exit value', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal())))).toEqual([]);
  });

  it('TAX-08 refuses a going-in basis carried into terminal NOI', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal({
      value_basis: 7200000, assessed_value: 5040000, indicated_tax: 57960,
    }))))).toContain('TAX-08');
  });

  it('TAX-08 accepts a differing basis once the author says why', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal({
      value_basis: 7200000,
      assessed_value: 5040000,
      indicated_tax: 57960,
      value_basis_differs_because: 'A statutory cap limits the reassessment increase.',
    }))))).toEqual([]);
  });

  it.each([undefined, '', '   '])('TAX-08 refuses the reason %s', (why) => {
    const over: Record<string, unknown> = {
      value_basis: 7200000, assessed_value: 5040000, indicated_tax: 57960,
    };
    if (why !== undefined) over['value_basis_differs_because'] = why;
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal(over))))).toContain('TAX-08');
  });

  it('TAX-08 requires in_exit_noi to be stated', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal({ in_exit_noi: undefined })))))
      .toContain('TAX-08');
  });

  it('does not tie the basis to exit value for a non-sale trigger', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal({
      trigger: 'statutory_cycle', value_basis: 7200000, assessed_value: 5040000, indicated_tax: 57960,
    }))))).toEqual([]);
  });

  it('still checks the terminal arithmetic itself', () => {
    expect(taxCodes(doc({ value: 58000 }, dcfWith(terminal({ indicated_tax: 1 }))))).toContain('TAX-02');
  });

  it('a dcf without a terminal tax is unchanged', () => {
    expect(taxCodes(doc({ value: 58000 }, { exit_analysis: { exit_value_gross: EXIT_VALUE } }))).toEqual([]);
  });
});
