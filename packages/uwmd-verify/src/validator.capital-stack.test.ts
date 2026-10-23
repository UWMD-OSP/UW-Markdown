// Capital-stack validation — CS-01 (structure), CS-02 (rate by class),
// CS-WATERFALL-UNSUPPORTED (deferred waterfall), and the generalized CC-03
// senior reconciliation. RFC 0026 / UW_FORMAT_SPEC §4.24.

import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: { section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual', agent_id: null, agent_version: null, actor: 'test', timestamp: '2026-08-20T00:00:00Z', notes: null }, quality: { confidence: 'high', human_review_required: false, flags: [] }, integrity: { input_hash: null } },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: { uw_version: '3.0', asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const codes = (parsed: ParsedUWFile): string[] => validateUWFile(parsed).issues.map((i) => i.code);

// A well-formed two-tranche stack that trips none of the rules.
const goodStack = () =>
  block('capital_stack', {
    point_in_time: 'stabilization',
    tranches: [
      { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05 },
      { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1 },
      { id: 'common', class: 'common_equity', position: 3, amount: 5_000_000 },
    ],
  });

describe('validateUWFile — capital stack (RFC 0026)', () => {
  it('a well-formed stack trips none of the capital-stack rules', () => {
    const emitted = codes(file({ capital_stack: goodStack() }));
    for (const c of ['CS-01', 'CS-02', 'CS-04', 'CS-WATERFALL-UNSUPPORTED', 'CC-03']) {
      expect(emitted, c).not.toContain(c);
    }
  });

  it('CS-01: a tranche missing required fields', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1 }, // no amount
          { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-01');
  });

  it('CS-01: a position below 1 (#430; 1 is the most senior)', () => {
    for (const position of [0, -3]) {
      const parsed = file({
        capital_stack: block('capital_stack', {
          point_in_time: 'stabilization',
          tranches: [
            { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05 },
            { id: 'common', class: 'common_equity', position, amount: 5_000_000 },
          ],
        }),
      });
      const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-01');
      expect(issue?.field, String(position)).toBe('tranches[1].position');
    }
  });

  it('CS-01: duplicate ids and duplicate positions', () => {
    const dupId = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'a', class: 'mezzanine_debt', position: 2, amount: 1, rate: 0.1 },
        ],
      }),
    });
    expect(codes(dupId)).toContain('CS-01');

    const dupPos = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'b', class: 'mezzanine_debt', position: 1, amount: 1, rate: 0.1 },
        ],
      }),
    });
    expect(codes(dupPos)).toContain('CS-01');
  });

  it('CS-01: an invalid tranche class', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'crypto_token', position: 1, amount: 1, rate: 0.05 },
          { id: 'b', class: 'common_equity', position: 2, amount: 1 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-01');
  });

  it('CS-02: a debt tranche omits its rate', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000 }, // no rate
          { id: 'common', class: 'common_equity', position: 2, amount: 5_000_000 },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-02');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('tranches[0].rate');
  });

  it('CS-02: a common-equity tranche states a rate', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05 },
          { id: 'common', class: 'common_equity', position: 2, amount: 5_000_000, rate: 0.2 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-02');
  });

  it('CS-02b: split preferred equity requires component rates that sum to rate', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'pref', class: 'preferred_equity', position: 1, amount: 4_000_000, rate: 0.13, cash_rate: 0.08, accrued_rate: 0.04, accrual: 'split' },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-02b');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('tranches[0].rate');
  });

  it('CS-02b: split component fields are forbidden on another accrual mode', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'pref', class: 'preferred_equity', position: 1, amount: 4_000_000, rate: 0.12, cash_rate: 0.08, accrual: 'cash' },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-02b');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('tranches[0].accrual');
  });

  it('CS-WATERFALL-UNSUPPORTED: a section-level distribution waterfall is refused', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'common', class: 'common_equity', position: 2, amount: 1 },
        ],
        promote: { hurdle: 0.08, split: 0.2 },
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-WATERFALL-UNSUPPORTED');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('promote');
  });

  it('CS-WATERFALL-UNSUPPORTED: a waterfall smuggled onto a tranche is refused', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'pref', class: 'preferred_equity', position: 2, amount: 1, rate: 0.09, catch_up: 1.0 },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-WATERFALL-UNSUPPORTED');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('tranches[1].catch_up');
  });

  it('CC-03: the senior tranche must reconcile with debt_structure', () => {
    const mismatch = file({
      capital_stack: goodStack(),
      debt_structure: block('debt_structure', { loan_amount: 18_000_000 }),
    });
    const issue = validateUWFile(mismatch).issues.find(
      (i) => i.code === 'CC-03' && i.section === 'capital_stack',
    );
    expect(issue).toBeDefined();

    const matched = file({
      capital_stack: goodStack(),
      debt_structure: block('debt_structure', { loan_amount: 20_000_000 }),
    });
    expect(
      validateUWFile(matched).issues.filter((i) => i.code === 'CC-03'),
    ).toHaveLength(0);
  });

  it('every new code has a BUILTIN_REMEDIATIONS entry', () => {
    for (const c of ['CS-01', 'CS-02', 'CS-WATERFALL-UNSUPPORTED']) {
      expect(BUILTIN_REMEDIATIONS.find((r) => r.code === c), c).toBeDefined();
    }
  });
});

// ─── Component-level stacks (§4.23 relaxation, RFC 0026 compatibility) ────────
//
// A mixed-use component MAY carry its own capital_stack, validated by the same
// CS-* rules with fields prefixed `<key>.capital_stack.`. A bare component
// debt_structure stays refused (MU-06), and the generalized CC-03 stays
// top-level-only: a component stack has no property-level counterpart.

function mixedUseFile(components: Record<string, unknown>, propertyNoi: number): ParsedUWFile {
  return {
    frontmatter: { uw_version: '3.0', asset_class: 'mixed_use' } as ParsedUWFile['frontmatter'],
    sections: {
      components: block('components', components),
      noi_model: block('noi_model', { net_operating_income: propertyNoi }),
    },
    prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const componentStack = (extra: Record<string, unknown> = {}) => ({
  tranches: [
    { id: 'condo_senior', class: 'senior_debt', position: 1, amount: 8_000_000, rate: 0.07 },
    { id: 'condo_common', class: 'common_equity', position: 2, amount: 2_000_000 },
  ],
  ...extra,
});

describe('validateUWFile — component-level capital stacks (§4.23)', () => {
  it('a component carrying a well-formed capital_stack trips neither MU-06 nor any CS rule', () => {
    const parsed = mixedUseFile({
      multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
      retail: { component_class: 'retail', net_operating_income: 372_000, capital_stack: componentStack() },
    }, 1_672_000);
    const emitted = codes(parsed);
    for (const c of ['MU-06', 'CS-01', 'CS-02', 'CS-WATERFALL-UNSUPPORTED', 'CC-03']) {
      expect(emitted, c).not.toContain(c);
    }
  });

  it('a malformed component stack fires CS-01 with the component-prefixed field', () => {
    const parsed = mixedUseFile({
      multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
      retail: {
        component_class: 'retail', net_operating_income: 372_000,
        capital_stack: {
          tranches: [
            { id: 'a', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
            { id: 'b', class: 'mezzanine_debt', position: 1, amount: 1, rate: 0.1 }, // dup position
          ],
        },
      },
    }, 1_672_000);
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-01');
    expect(issue).toBeDefined();
    expect(issue!.section).toBe('components');
    expect(issue!.field).toBe('retail.capital_stack.tranches[1].position');
  });

  it('a waterfall in a component stack is refused like a top-level one', () => {
    const parsed = mixedUseFile({
      multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
      retail: {
        component_class: 'retail', net_operating_income: 372_000,
        capital_stack: componentStack({ waterfall: { tiers: [] } }),
      },
    }, 1_672_000);
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-WATERFALL-UNSUPPORTED');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('retail.capital_stack.waterfall');
  });

  it('a bare component debt_structure is still MU-06, and its remediation points at the stack', () => {
    const parsed = mixedUseFile({
      multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
      retail: { component_class: 'retail', net_operating_income: 372_000, debt_structure: { loan_amount: 9 } },
    }, 1_672_000);
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'MU-06');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('capital_stack');
  });

  it('a component stack does not trigger the top-level CC-03 senior reconciliation', () => {
    // The component senior (8M) deliberately disagrees with the property loan
    // (20M): CC-03 must not compare across that boundary.
    const parsed: ParsedUWFile = {
      frontmatter: { uw_version: '3.0', asset_class: 'mixed_use' } as ParsedUWFile['frontmatter'],
      sections: {
        components: block('components', {
          multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
          retail: { component_class: 'retail', net_operating_income: 372_000, capital_stack: componentStack() },
        }),
        noi_model: block('noi_model', { net_operating_income: 1_672_000 }),
        debt_structure: block('debt_structure', { loan_amount: 20_000_000 }),
      },
      prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
      extensions: {}, superseded: {}, raw: '',
    };
    expect(codes(parsed)).not.toContain('CC-03');
  });
});

// RFC 0098: points in time of the capital stack and senior loans, and CC-03 per point.
describe('validateUWFile — capital point in time (RFC 0098)', () => {
  const stack = (point: unknown, senior = 18_000_000) => block('capital_stack', {
    ...(point === undefined ? {} : { point_in_time: point }),
    tranches: [
      { id: 'senior', class: 'senior_debt', position: 1, amount: senior, rate: 0.06 },
      { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 2_000_000, rate: 0.11 },
    ],
  });
  const debt = (content: Record<string, unknown>) => block('debt_structure', content);
  // #403's construction-to-permanent record: a closing construction facility with
  // no loan_amount, a stabilization takeout, and a closing statement whose
  // takeout line is 0.
  const constructionToPerm = (takeout = 18_000_000, stackPoint: unknown = 'stabilization') => file({
    capital_stack: stack(stackPoint),
    debt_structure: {
      construction: debt({ _role: 'senior', point_in_time: 'closing' }),
      takeout: debt({ _role: 'senior', point_in_time: 'stabilization', loan_amount: takeout }),
    } as unknown as UWBlock,
    sources_uses: block('sources_uses', { sources: { loan_amount: 0, construction_loan: 17_000_000 } }),
  });
  const cc03 = (parsed: ParsedUWFile) => validateUWFile(parsed).issues.filter((i) => i.code === 'CC-03');

  it('reconciles a construction-to-permanent record per point (#403)', () => {
    const result = validateUWFile(constructionToPerm());
    expect(result.issues.filter((i) => ['CC-03', 'CS-04', 'DS-01'].includes(i.code))).toEqual([]);
    // Other senior-preferring checks keep their single selection (RFC 0098
    // Unresolved questions), so CC-16 may name them, but never CC-03.
    expect(result.issues.filter((i) => i.code === 'CC-16').some((i) => i.message.includes('CC-03'))).toBe(false);
    expect(result.coverage['CC-03']).toMatchObject({
      status: 'evaluated',
      resolutions: {
        'debt_structure@closing': { variant: 'construction', via: 'role' },
        'debt_structure@stabilization': { variant: 'takeout', via: 'role' },
      },
    });
  });

  it('compares the stack with the senior at its own point', () => {
    const issues = cc03(constructionToPerm(18_500_000));
    expect(issues.map((i) => [i.section, i.field])).toEqual([['capital_stack', 'tranches[0].amount']]);
  });

  it('compares the closing statement with the closing senior only', () => {
    const parsed = file({
      debt_structure: {
        construction: debt({ _role: 'senior', point_in_time: 'closing', loan_amount: 17_000_000 }),
        takeout: debt({ _role: 'senior', point_in_time: 'stabilization', loan_amount: 18_000_000 }),
      } as unknown as UWBlock,
      sources_uses: block('sources_uses', { sources: { loan_amount: 16_000_000 } }),
    });
    expect(cc03(parsed).map((i) => i.field)).toEqual(['sources.loan_amount']);
  });

  it('treats a loan with no point as outstanding at both points', () => {
    const one = (amount: number) => file({
      capital_stack: stack('stabilization'),
      debt_structure: debt({ loan_amount: amount }),
      sources_uses: block('sources_uses', { sources: { loan_amount: amount } }),
    });
    expect(cc03(one(18_000_000))).toEqual([]);
    expect(cc03(one(19_000_000)).map((i) => i.section)).toEqual(['capital_stack']);
  });

  it('still refuses two seniors at the same point', () => {
    const parsed = file({
      capital_stack: stack('stabilization'),
      debt_structure: {
        a: debt({ _role: 'senior', point_in_time: 'stabilization', loan_amount: 18_000_000 }),
        b: debt({ _role: 'senior', point_in_time: 'stabilization', loan_amount: 18_000_000 }),
      } as unknown as UWBlock,
      sources_uses: block('sources_uses', { sources: { loan_amount: 18_000_000 } }),
    });
    const result = validateUWFile(parsed);
    expect(result.coverage['CC-03']).toMatchObject({ status: 'skipped', reason: 'variant_unresolvable', detail: 'debt_structure' });
    expect(result.issues.some((i) => i.code === 'CC-16')).toBe(true);
  });

  it('never falls back to the closing statement for a stabilization stack', () => {
    const parsed = file({
      capital_stack: stack('stabilization'),
      debt_structure: { construction: debt({ _role: 'senior', point_in_time: 'closing' }) } as unknown as UWBlock,
      sources_uses: block('sources_uses', { sources: { loan_amount: 0 } }),
    });
    const result = validateUWFile(parsed);
    expect(result.issues.filter((i) => i.code === 'CC-03')).toEqual([]);
    expect(result.coverage['CC-03']).toMatchObject({ status: 'skipped', reason: 'not_applicable', detail: 'no stabilization senior debt_structure' });
    // A closing stack does fall back, because sources_uses is a closing figure.
    expect(cc03(constructionToPerm(18_000_000, 'closing')).map((i) => i.section)).toEqual(['capital_stack']);
  });

  it.each([[undefined], ['permanent'], [null], [['closing']]])('CS-04 refuses a stack point_in_time of %j', (point) => {
    const issues = validateUWFile(file({ capital_stack: stack(point) })).issues.filter((i) => i.code === 'CS-04');
    expect(issues.map((i) => [i.section, i.field, i.severity])).toEqual([['capital_stack', 'point_in_time', 'error']]);
  });

  it('CS-04 applies to a mixed-use component stack too', () => {
    const parsed = file({ components: block('components', { retail: { component_class: 'retail', capital_stack: { tranches: [] } } }) });
    expect(validateUWFile(parsed).issues.filter((i) => i.code === 'CS-04').map((i) => [i.section, i.field]))
      .toEqual([['components', 'retail.capital_stack.point_in_time']]);
  });

  it.each([['permanent'], [null], [''], [1]])('DS-01 refuses a debt_structure point_in_time of %j', (point) => {
    const issues = validateUWFile(file({ debt_structure: debt({ loan_amount: 1, point_in_time: point }) })).issues;
    expect(issues.filter((i) => i.code === 'DS-01').map((i) => [i.section, i.field, i.severity])).toEqual([['debt_structure', 'point_in_time', 'error']]);
  });

  it('registers CS-04 and DS-01', () => {
    for (const code of ['CS-04', 'DS-01']) {
      expect(BUILTIN_REMEDIATIONS.find((r) => r.code === code)?.severity, code).toBe('error');
    }
  });
});

// #406: "same amount, same rate" (§4.24). The rate leg is exact (owner ruling).
describe('validateUWFile — CC-03 senior rate (#406)', () => {
  const withRate = (trancheRate: number, loanRate: number | undefined) => file({
    capital_stack: block('capital_stack', {
      point_in_time: 'stabilization',
      tranches: [{ id: 'senior', class: 'senior_debt', position: 1, amount: 18_000_000, rate: trancheRate }],
    }),
    debt_structure: block('debt_structure', { loan_amount: 18_000_000, ...(loanRate === undefined ? {} : { interest_rate: loanRate }) }),
  });
  const rateIssues = (parsed: ParsedUWFile) => validateUWFile(parsed).issues
    .filter((i) => i.code === 'CC-03').map((i) => i.field);

  it('passes equal rates', () => {
    expect(rateIssues(withRate(0.0625, 0.0625))).toEqual([]);
  });
  it('fails unequal rates at the tranche rate', () => {
    expect(rateIssues(withRate(0.0999, 0.0625))).toEqual(['tranches[0].rate']);
  });
  it('has no tolerance', () => {
    expect(rateIssues(withRate(0.0625 + 1e-9, 0.0625))).toEqual(['tranches[0].rate']);
  });
  it('does not compare when the loan states no rate', () => {
    expect(rateIssues(withRate(0.0999, undefined))).toEqual([]);
  });
});

describe('RFC 0121 bounded CS-01 ownership', () => {
  it.each(['id', 'class', 'position', 'amount'])('requires own %s without broad schema ownership', field => {
    const b = goodStack(); const rows = b.content.tranches as Array<Record<string, unknown>>;
    rows[0] = Object.assign(Object.create({ [field]: rows[0]![field] }), rows[0]);
    delete rows[0]![field];
    const issues = validateUWFile(file({ capital_stack: b })).issues.filter(i => i.code === 'CS-01');
    expect(issues.map(i => i.field)).toEqual([`tranches[0].${field}`]);
  });
  it('keeps unrelated schema fields outside CS-01', () => {
    const b = goodStack(); const rows = b.content.tranches as Array<Record<string, unknown>>;
    rows[0]!.accrual = 'unknown'; rows[0]!.amortization_months = 'invalid';
    expect(codes(file({ capital_stack: b }))).not.toContain('CS-01');
  });
});
