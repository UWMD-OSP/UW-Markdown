import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS, CROSS_CHECK_RULE_IDS, CROSS_CHECK_VARIANT_PREFERENCE } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(section: string, content: Record<string, unknown>, variant?: string): UWBlock {
  return {
    annotation: variant ? { section, variant } : { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-09-09T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function variants(section: string, map: Record<string, Record<string, unknown>>): Record<string, UWBlock> {
  return Object.fromEntries(Object.entries(map).map(([v, c]) => [v, block(section, c, v)]));
}

function file(sections: Record<string, UWBlock | Record<string, UWBlock>>): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections: sections as ParsedUWFile['sections'],
    prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

describe('validateUWFile — cross-check coverage (RFC 0037)', () => {
  it('reports every registered CC rule and nothing else', () => {
    const result = validateUWFile(file({}));
    expect(Object.keys(result.coverage)).toEqual([...CROSS_CHECK_RULE_IDS]);
    // An empty deal record still gets CC-14 evaluated (and fired); every other rule is skipped.
    for (const [code, entry] of Object.entries(result.coverage)) expect(entry.status, code).toBe(code === 'CC-14' ? 'evaluated' : 'skipped');
  });

  it('marks a rule evaluated when the comparison ran, even when it passed', () => {
    const result = validateUWFile(file({
      sources_uses: block('sources_uses', { total_sources: 1_000, total_uses: 1_000 }),
    }));
    expect(result.coverage['CC-04']).toEqual({ status: 'evaluated' });
    expect(result.issues.find((i) => i.code === 'CC-04')).toBeUndefined();
  });

  it('marks section_absent, field_absent and not_applicable with a detail', () => {
    const result = validateUWFile(file({
      sources_uses: block('sources_uses', { total_sources: 1_000 }),
    }));
    expect(result.coverage['CC-04']).toMatchObject({ status: 'skipped', reason: 'field_absent' });
    expect(result.coverage['CC-10']).toMatchObject({ status: 'skipped', reason: 'section_absent', detail: 'valuation' });
    expect(result.coverage['CC-11']).toMatchObject({ status: 'skipped', reason: 'not_applicable' });
  });

  it('resolves a variant map by the registered preference order', () => {
    expect(CROSS_CHECK_VARIANT_PREFERENCE).toEqual(['default', 'base']);
    const result = validateUWFile(file({
      valuation: block('valuation', { appraised_value: 10_000_000 }),
      due_diligence: variants('due_diligence', {
        environmental: { phase_one: 'clean' },
        appraisal: { appraised_value: 9_000_000 },
      }),
    }));
    expect(result.coverage['CC-08']).toEqual({ status: 'evaluated' });
    expect(result.issues.find((i) => i.code === 'CC-08')).toBeDefined();
    expect(result.issues.find((i) => i.code === 'CC-16')).toBeUndefined();
  });

  it('reads appraised_value at the variant root when the appraisal variant is the sub-document', () => {
    const result = validateUWFile(file({
      valuation: block('valuation', { appraised_value: 10_000_000 }),
      due_diligence: variants('due_diligence', { appraisal: { appraised_value: 10_000_000 } }),
    }));
    expect(result.coverage['CC-08']).toEqual({ status: 'evaluated' });
    expect(result.issues.find((i) => i.code === 'CC-08')).toBeUndefined();
  });

  it('takes default, then base, then a lone variant', () => {
    const withDefault = validateUWFile(file({
      debt_structure: variants('debt_structure', {
        mezz: { loan_amount: 2_000_000 },
        default: { loan_amount: 7_000_000 },
      }),
      sources_uses: block('sources_uses', { sources: { loan_amount: 7_000_000 } }),
    }));
    expect(withDefault.coverage['CC-03']).toEqual({ status: 'evaluated' });

    const withBase = validateUWFile(file({
      debt_structure: variants('debt_structure', {
        mezz: { loan_amount: 2_000_000 },
        base: { loan_amount: 7_500_000 },
      }),
      sources_uses: block('sources_uses', { sources: { loan_amount: 7_000_000 } }),
    }));
    expect(withBase.coverage['CC-03']).toEqual({ status: 'evaluated' });
    expect(withBase.issues.find((i) => i.code === 'CC-03')).toBeDefined();

    const lone = validateUWFile(file({
      debt_structure: variants('debt_structure', { senior: { loan_amount: 7_000_000 } }),
      sources_uses: block('sources_uses', { sources: { loan_amount: 7_000_000 } }),
    }));
    expect(lone.coverage['CC-03']).toEqual({ status: 'evaluated' });
  });

  it('declares an unresolvable map, skips every rule that reads it, and emits CC-16 once per section', () => {
    const result = validateUWFile(file({
      property: block('property', { total_units: 100 }),
      debt_structure: variants('debt_structure', {
        senior: { loan_amount: 7_000_000, annual_debt_service: 500_000, underwritten_noi: 900_000 },
        mezz: { loan_amount: 2_000_000, annual_debt_service: 200_000 },
      }),
      sources_uses: block('sources_uses', { sources: { loan_amount: 7_000_000 } }),
      valuation: block('valuation', { underwritten_value: 10_000_000 }),
      noi_model: block('noi_model', { net_operating_income: 900_000 }),
      stress_tests: block('stress_tests', { base_case: { annual_debt_service: 500_000 } }),
    }));
    for (const code of ['CC-02', 'CC-03', 'CC-05', 'CC-09']) {
      expect(result.coverage[code], code).toMatchObject({ status: 'skipped', reason: 'variant_unresolvable', detail: 'debt_structure' });
    }
    const cc16 = result.issues.filter((i) => i.code === 'CC-16');
    expect(cc16).toHaveLength(1);
    expect(cc16[0]).toMatchObject({ severity: 'info', section: 'debt_structure' });
    expect(cc16[0]!.message).toContain('mezz');
    expect(cc16[0]!.message).toContain('senior');
    expect(cc16[0]!.message).toContain('CC-03');
    const remediation = BUILTIN_REMEDIATIONS.find((r) => r.code === 'CC-16');
    expect(remediation).toBeDefined();
    expect(cc16[0]!.title).toBe(remediation!.title);
    expect(result.overall_status).toBe('clean');
  });

  it('marks CC-15 not_applicable, with no CC-16, when lease_up_schedule has no base variant (RFC 0008 exempts the others)', () => {
    const result = validateUWFile(file({
      noi_model: block('noi_model', { net_operating_income: 900_000 }),
      lease_up_schedule: variants('lease_up_schedule', {
        upside: { model_type: 'absorption', period_granularity: 'monthly', periods: [], stabilized_summary: { annualized_noi: 950_000 } },
        downside: { model_type: 'absorption', period_granularity: 'monthly', periods: [], stabilized_summary: { annualized_noi: 800_000 } },
      }),
    }));
    expect(result.coverage['CC-15']).toMatchObject({ status: 'skipped', reason: 'not_applicable', detail: 'no base variant' });
    expect(result.issues.filter((i) => i.code === 'CC-16')).toHaveLength(0);
  });

  it('never moves overall_status: coverage and CC-16 are reporting, not verdicts', () => {
    const result = validateUWFile(file({
      property: block('property', { total_units: 100 }),
      operating_statement: variants('operating_statement', {
        t3: { gross_potential_rent: 100 },
        budget: { gross_potential_rent: 110 },
      }),
      rent_roll: block('rent_roll', { gross_potential_rent: 104 }),
    }));
    expect(result.coverage['CC-01']).toMatchObject({ status: 'skipped', reason: 'variant_unresolvable' });
    expect(result.overall_status).toBe('clean');
  });
});
