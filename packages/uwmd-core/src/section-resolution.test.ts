import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CalcError } from './calc/errors.js';
import { evaluateCalc } from './calc/index.js';
import { parseCalculationContext } from './calculation-context.js';
import { parseUWFile } from './parser.js';
import type { CalcEvaluationContext, CalcResult, ModuleCalcDecl } from './protocol.js';
import { resolveSectionBlock } from './section-resolution.js';
import type { ParsedUWFile, UWBlock } from './types.js';

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

// variant-05 and variant-11 once put the block their caller context names in
// the last fence. A reader that checked the name and then kept the last fence
// passed both, in both runners, because both read these same files (StackUW's
// UPSTREAM-021). Swapping the fences would only move the blind spot: every
// generic-order fixture already resolves to its first fence. So each context
// fixture now puts the named block between two others, and this suite keeps it
// there.
describe('RFC 0066 tier-3 context fixtures are not satisfiable by fence order', () => {
  const TIER3 = resolve(process.cwd(), '../..', 'conformance/tier-3-calc-host/fixtures');
  const CONTEXT_FIXTURES = readdirSync(TIER3)
    .filter((name) => name.startsWith('variant-') && existsSync(join(TIER3, name, 'calc-context.json')))
    .sort();

  function load(name: string) {
    const json = (file: string): unknown => JSON.parse(readFileSync(join(TIER3, name, file), 'utf8'));
    return {
      parsed: parseUWFile(readFileSync(join(TIER3, name, 'deal.uwx.md'), 'utf8')),
      decl: json('calc.json') as ModuleCalcDecl,
      context: parseCalculationContext(json('calc-context.json')),
      expected: json('expected-result.json'),
    };
  }
  /** The projection both runners compare (`runTier3`, and the CLI's `--json` subset). */
  function project(result: CalcResult) {
    return {
      calc_id: result.calc_id,
      ok: result.ok,
      value: result.value,
      ...(result.unit ? { unit: result.unit } : {}),
      ...(result.error ? { error: { code: result.error.code, category: result.error.category } } : {}),
    };
  }
  function evaluate(parsed: ParsedUWFile, decl: ModuleCalcDecl, context: Partial<CalcEvaluationContext> = {}) {
    return project(evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US', ...context }));
  }
  /** What a fence-order reader sees: the map collapsed to its first or last fence. */
  function fence(parsed: ParsedUWFile, section: string, pick: 'first' | 'last'): ParsedUWFile {
    const blocks = Object.values(parsed.sections[section] as Record<string, UWBlock>);
    const block = pick === 'first' ? blocks[0]! : blocks[blocks.length - 1]!;
    return { ...parsed, sections: { ...parsed.sections, [section]: block } };
  }

  it('finds every context fixture, so the checks below cannot pass over an empty set', () => {
    expect(CONTEXT_FIXTURES).toEqual([
      'variant-05-explicit-variant',
      'variant-07-explicit-missing',
      'variant-11-explicit-beats-role',
    ]);
  });

  for (const name of CONTEXT_FIXTURES) {
    it(`${name}: the §VIII.2 reader returns the expected result`, () => {
      const { parsed, decl, context, expected } = load(name);
      expect(evaluate(parsed, decl, context)).toEqual(expected);
    });

    it(`${name}: a first-fence or a last-fence reader does not`, () => {
      const { parsed, decl, context, expected } = load(name);
      for (const section of Object.keys(context.sectionVariants ?? {})) {
        expect(evaluate(fence(parsed, section, 'first'), decl)).not.toEqual(expected);
        expect(evaluate(fence(parsed, section, 'last'), decl)).not.toEqual(expected);
      }
    });
  }

  for (const name of ['variant-05-explicit-variant', 'variant-11-explicit-beats-role']) {
    it(`${name}: the named block is neither the first nor the last fence, and the name decides`, () => {
      const { parsed, decl, context, expected } = load(name);
      const keys = Object.keys(parsed.sections['debt_structure']!);
      expect(keys).toEqual(['producer-senior', 'producer-mezz', 'producer-b-note']);
      expect(context.sectionVariants).toEqual({ debt_structure: 'producer-mezz' });
      expect(expected).toMatchObject({ ok: true, value: 0.1 });
      // Without the name, variant-05 refuses and variant-11 reads its declared senior.
      expect(evaluate(parsed, decl)).not.toEqual(expected);
    });
  }
});
