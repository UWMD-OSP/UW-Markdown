import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CalcError } from './calc/errors.js';
import { parseUWFile } from './parser.js';
import { resolveSectionBlock } from './section-resolution.js';
import type { ParsedUWFile } from './types.js';

// Two `debt_structure` blocks: `variant=producer-senior` (`_role: senior`,
// 6,000,000) then `variant=producer-mezz` (`_role: junior`, 1,000,000).
const FIXTURE = readFileSync(
  resolve(process.cwd(), '../..', 'conformance/tier-1-reader/fixtures/10-declared-roles.uwx.md'),
  'utf8',
);
const SENIOR = '"_role": "senior"';
const JUNIOR = '"_role": "junior"';

function parse(source = FIXTURE): ParsedUWFile {
  return parseUWFile(source);
}
function loan(parsed: ParsedUWFile, options = {}): unknown {
  return resolveSectionBlock(parsed, 'debt_structure', options)?.content['loan_amount'];
}
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CalcError);
    return `${(e as CalcError).proto.code} ${(e as CalcError).proto.message}`;
  }
  throw new Error('expected a refusal');
}
/** The same two blocks with their fences swapped. */
function swapped(): string {
  const fence = (variant: string) => {
    const start = FIXTURE.indexOf(`\`\`\`json uw:section=debt_structure variant=${variant}`);
    return { start, end: FIXTURE.indexOf('\n```', FIXTURE.indexOf('\n', start)) + 4 };
  };
  const a = fence('producer-senior');
  const b = fence('producer-mezz');
  return FIXTURE.slice(0, a.start) + FIXTURE.slice(b.start, b.end) + FIXTURE.slice(a.end, b.start)
    + FIXTURE.slice(a.start, a.end) + FIXTURE.slice(b.end);
}

describe('resolveSectionBlock (Protocol §VIII.2, RFC 0066)', () => {
  it('returns null for a missing section: a missing path is not an ambiguity', () => {
    expect(resolveSectionBlock(parse(), 'capital_stack')).toBeNull();
  });

  it('returns a standalone block as stated', () => {
    expect(resolveSectionBlock(parse(), 'valuation')?.content['underwritten_value']).toBe(10_000_000);
  });

  it('refuses a senior + junior map with no declared role, naming the section and variants', () => {
    expect(refusal(() => loan(parse()))).toBe(
      'CALC-RESOLVE-002 Cannot select debt_structure: no unique role or preferred/default/base variant among eligible property-level blocks; variants found: producer-mezz, producer-senior.',
    );
  });

  it('reads the declared role, whichever fence comes first', () => {
    expect(Object.keys(parse().sections['debt_structure']!)).toEqual(['producer-senior', 'producer-mezz']);
    expect(Object.keys(parse(swapped()).sections['debt_structure']!)).toEqual(['producer-mezz', 'producer-senior']);
    for (const source of [FIXTURE, swapped()]) {
      expect(loan(parse(source), { sectionRoles: { debt_structure: 'senior' } })).toBe(6_000_000);
      expect(loan(parse(source), { sectionRoles: { debt_structure: 'junior' } })).toBe(1_000_000);
    }
  });

  it('falls through to the generic order when no eligible block carries the declared role', () => {
    const parsed = parse(FIXTURE.replace(SENIOR, '"_role": "primary"'));
    expect(loan(parsed, { sectionRoles: { debt_structure: 'senior' } })).toBe(6_000_000);
    expect(loan(parsed)).toBe(6_000_000);
  });

  it('refuses when two eligible blocks claim the declared role, without falling through', () => {
    const parsed = parse(FIXTURE.replace(JUNIOR, SENIOR));
    expect(refusal(() => loan(parsed, { sectionRoles: { debt_structure: 'senior' } }))).toContain(
      'multiple variants claim role senior: producer-mezz, producer-senior',
    );
  });

  it('refuses a primary collision', () => {
    const parsed = parse(FIXTURE.replace(SENIOR, '"_role": "primary"').replace(JUNIOR, '"_role": "primary"'));
    expect(refusal(() => loan(parsed))).toContain('multiple variants claim role primary');
  });

  it('resolves the default variant key under the generic order', () => {
    const parsed = parse(FIXTURE.replace('variant=producer-senior', 'variant=default').replace('variant=producer-mezz', 'variant=mezzanine'));
    expect(loan(parsed)).toBe(6_000_000);
  });

  it('selects exactly an explicit variant, which beats a declared role, including a component', () => {
    expect(loan(parse(), {
      sectionVariants: { debt_structure: 'producer-mezz' },
      sectionRoles: { debt_structure: 'senior' },
    })).toBe(1_000_000);
    const component = parse(FIXTURE.replace(JUNIOR, '"_role": "component"'));
    expect(loan(component, { sectionVariants: { debt_structure: 'producer-mezz' } })).toBe(1_000_000);
  });

  it('refuses an explicit variant that is absent, or that names another standalone variant', () => {
    expect(refusal(() => loan(parse(), { sectionVariants: { debt_structure: 'absent-key' } }))).toBe(
      'CALC-RESOLVE-002 Cannot select debt_structure variant=absent-key; variants found: producer-mezz, producer-senior.',
    );
    expect(refusal(() => resolveSectionBlock(parse(), 'valuation', { sectionVariants: { valuation: 'appraisal' } })))
      .toBe('CALC-RESOLVE-002 Cannot select valuation variant=appraisal; variants found: (unkeyed).');
  });

  it('refuses an explicit variant carrying an invalid role', () => {
    const parsed = parse(FIXTURE.replace(JUNIOR, '"_role": "mezzanine"'));
    expect(refusal(() => loan(parsed, { sectionVariants: { debt_structure: 'producer-mezz' } }))).toContain(
      'variant=producer-mezz',
    );
  });
});
