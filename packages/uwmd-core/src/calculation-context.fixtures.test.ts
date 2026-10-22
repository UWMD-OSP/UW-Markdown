// RFC 0066: the calculation fixtures, read through `parseCalculationContext`
// (the CLI's calc-context reader, a starter module), are not satisfiable by
// fence order. Moved from @uwmd/verify's section-resolution.test.ts with the
// reader (RFC 0083).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateCalc,
  parseUWFile,
  resolveSectionBlock,
  type CalcEvaluationContext,
  type CalcResult,
  type ModuleCalcDecl,
  type ParsedUWFile,
  type UWBlock,
} from '@uwmd/verify';
import { parseCalculationContext } from './calculation-context.js';

// variant-05 and variant-11 once put the block their caller context names in
// the last fence. A reader that checked the name and then kept the last fence
// passed both, in both runners, because both read these same files (StackUW's
// adopter report 021). Swapping the fences would only move the blind spot: every
// generic-order fixture also resolved to its first fence. Both context and
// successful no-context fixtures now put the selected block between two others;
// this suite preserves their distinct selection reasons and rejects both orders.
describe('RFC 0066 calculation fixtures are not satisfiable by fence order', () => {
  const TIER3 = resolve(process.cwd(), '../..', 'conformance/calc/fixtures');
  const CONTEXT_FIXTURES = readdirSync(TIER3)
    .filter((name) => name.startsWith('variant-') && existsSync(join(TIER3, name, 'calc-context.json')))
    .sort();

  function load(name: string) {
    const json = (file: string): unknown => JSON.parse(readFileSync(join(TIER3, name, file), 'utf8'));
    return {
      parsed: parseUWFile(readFileSync(join(TIER3, name, 'deal.uwx.md'), 'utf8')),
      decl: json('calc.json') as ModuleCalcDecl,
      context: existsSync(join(TIER3, name, 'calc-context.json'))
        ? parseCalculationContext(json('calc-context.json')) : {},
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


  // Discover every successful non-null no-context case, including future ones.
  const ORDER_FIXTURES = readdirSync(TIER3).filter((name) => {
    if (!name.startsWith('variant-') || existsSync(join(TIER3, name, 'calc-context.json'))) return false;
    const expected = JSON.parse(readFileSync(join(TIER3, name, 'expected-result.json'), 'utf8'));
    return expected.ok && expected.value !== null;
  }).sort();

  it('finds all four successful no-context fixtures', () => {
    expect(ORDER_FIXTURES).toEqual([
      'variant-01-primary-resolves',
      'variant-02-default-resolves',
      'variant-04-role-preference',
      'variant-10-role-unclaimed',
    ]);
  });

  for (const name of ORDER_FIXTURES) {
    it(`${name}: the §VIII.2 reader keeps the unchanged expected result`, () => {
      const { parsed, decl, expected } = load(name);
      expect(expected).toMatchObject({ ok: true, value: 0.6 });
      expect(evaluate(parsed, decl)).toEqual(expected);
    });

    it(`${name}: both first-fence and last-fence readers fail`, () => {
      const { parsed, decl, expected } = load(name);
      expect(evaluate(fence(parsed, 'debt_structure', 'first'), decl)).not.toEqual(expected);
      expect(evaluate(fence(parsed, 'debt_structure', 'last'), decl)).not.toEqual(expected);
    });

    it(`${name}: the middle fence resolves for its original reason`, () => {
      const { parsed, decl } = load(name);
      const blocks = parsed.sections['debt_structure'] as Record<string, UWBlock>;
      const selected = name === 'variant-02-default-resolves' ? 'default' : 'producer-senior';
      expect(Object.keys(blocks)).toEqual([
        'producer-b-note', selected,
        name === 'variant-02-default-resolves' ? 'mezzanine' : 'producer-mezz',
      ]);
      expect(resolveSectionBlock(parsed, 'debt_structure', { sectionRoles: decl.section_roles }))
        .toBe(blocks[selected]);
      const roles = Object.values(blocks).map((block) => block.content['_role']);
      expect(roles).toEqual(['junior', name === 'variant-02-default-resolves'
        || name === 'variant-04-role-preference' ? 'senior' : 'primary', 'junior']);
      if (name === 'variant-04-role-preference' || name === 'variant-10-role-unclaimed') {
        expect(decl.section_roles).toEqual({ debt_structure: 'senior' });
        expect(roles.filter((role) => role === 'senior')).toHaveLength(
          name === 'variant-04-role-preference' ? 1 : 0,
        );
      } else expect(decl.section_roles).toBeUndefined();
    });
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
