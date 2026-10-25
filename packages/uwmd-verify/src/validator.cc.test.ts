import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: { section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual', agent_id: null, agent_version: null, actor: 'test', timestamp: '2026-08-12T00:00:00Z', notes: null }, quality: { confidence: 'high', human_review_required: false, flags: [] }, integrity: { input_hash: null } },
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

function issue(parsed: ParsedUWFile, code: string): ValidationMessage {
  const found = validateUWFile(parsed).issues.find((candidate) => candidate.code === code);
  expect(found, code).toBeDefined();
  return found!;
}

function expectRegistered(issue: ValidationMessage, code: string, severity: ValidationMessage['severity'], field: string): void {
  const remediation = BUILTIN_REMEDIATIONS.find((candidate) => candidate.code === code);
  expect(remediation, code).toBeDefined();
  expect(issue).toMatchObject({ code, severity, field });
  expect(issue.title).toBe(remediation!.title);
  expect(issue.remediation).toBe(remediation!.remediation);
  expect(issue.spec_ref).toBe(remediation!.spec_ref);
}

describe('validateUWFile — CC cross-section consistency', () => {
  const cases: Array<{
    code: string;
    severity: ValidationMessage['severity'];
    field: string;
    sections: Record<string, UWBlock>;
  }> = [
    {
      code: 'CC-01', severity: 'warning', field: 'gross_potential_rent',
      sections: { rent_roll: block('rent_roll', { gross_potential_rent: 104 }), operating_statement: block('operating_statement', { gross_potential_rent: 100 }) },
    },
    {
      code: 'CC-02', severity: 'warning', field: 'ltv',
      sections: { valuation: block('valuation', { underwritten_value: 1_000 }), debt_structure: block('debt_structure', { loan_amount: 700, ltv_basis: 'underwritten-value', ltv: 0.6 }) },
    },
    {
      code: 'CC-03', severity: 'error', field: 'sources.loan_amount',
      sections: { sources_uses: block('sources_uses', { sources: { loan_amount: 1_000 } }), debt_structure: block('debt_structure', { loan_amount: 1_200 }) },
    },
    {
      code: 'CC-04', severity: 'error', field: 'total_sources',
      sections: { sources_uses: block('sources_uses', { total_sources: 1_000, total_uses: 1_002 }) },
    },
    {
      code: 'CC-05', severity: 'warning', field: 'underwritten_noi',
      sections: { noi_model: block('noi_model', { net_operating_income: 100 }), debt_structure: block('debt_structure', { underwritten_noi: 102 }) },
    },
    {
      code: 'CC-06', severity: 'warning', field: 'annual_cash_flows[0].noi',
      sections: { noi_model: block('noi_model', { net_operating_income: 100 }), dcf: block('dcf', { annual_cash_flows: [{ noi: 103 }] }) },
    },
    {
      code: 'CC-07', severity: 'warning', field: 'base_case.exit_cap_rate',
      sections: { dcf: block('dcf', { assumptions: { exit_cap_rate: 0.06 } }), stress_tests: block('stress_tests', { base_case: { exit_cap_rate: 0.05 } }) },
    },
    {
      code: 'CC-08', severity: 'warning', field: 'appraisal.appraised_value',
      sections: { valuation: block('valuation', { appraised_value: 1_000 }), due_diligence: block('due_diligence', { appraisal: { appraised_value: 2_100 } }) },
    },
    {
      code: 'CC-09', severity: 'warning', field: 'base_case.annual_debt_service',
      sections: { debt_structure: block('debt_structure', { annual_debt_service: 1_000 }), stress_tests: block('stress_tests', { base_case: { annual_debt_service: 1_501 } }) },
    },
    {
      code: 'CC-10', severity: 'error', field: 'uses.purchase_price',
      sections: { sources_uses: block('sources_uses', { uses: { purchase_price: 1_000 } }), valuation: block('valuation', { purchase_price: 1_200 }) },
    },
    {
      // A components section under the default multifamily frontmatter is a
      // mis-typed document — CC-11 fires (the asset-class gate).
      code: 'CC-11', severity: 'error', field: 'asset_class',
      sections: { components: block('components', { multifamily: { component_class: 'multifamily', net_operating_income: 1 }, retail: { component_class: 'retail', net_operating_income: 1 } }) },
    },
  ];

  for (const testCase of cases) {
    it(`emits ${testCase.code} with its field and canonical remediation`, () => {
      expectRegistered(issue(file(testCase.sections), testCase.code), testCase.code, testCase.severity, testCase.field);
    });
  }
});

// RFC 0086: the frontmatter summary's purchase price is checked against
// valuation.purchase_price with CC-10's $100 / error rule, in every class.
describe('validateUWFile — CC-17 frontmatter purchase price (RFC 0086)', () => {
  function withFrontmatter(
    quickPrice: number | undefined,
    sections: Record<string, UWBlock | Record<string, UWBlock>>,
    assetClass = 'data_center',
  ): ParsedUWFile {
    return {
      frontmatter: {
        uw_version: '3.0', asset_class: assetClass,
        ...(quickPrice === undefined ? {} : { quick_metrics: { purchase_price: quickPrice } }),
      } as ParsedUWFile['frontmatter'],
      sections: sections as ParsedUWFile['sections'], prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
      extensions: {}, superseded: {}, raw: '',
    };
  }
  const valuation = (price?: number): UWBlock => block('valuation', price === undefined ? { underwritten_value: 1 } : { purchase_price: price });
  const cc17 = (parsed: ParsedUWFile) => {
    const result = validateUWFile(parsed);
    return { coverage: result.coverage['CC-17'], issues: result.issues.filter((i) => i.code === 'CC-17'), all: result.issues };
  };

  it('is evaluated and clean when the prices agree', () => {
    const r = cc17(withFrontmatter(10_000_000, { valuation: valuation(10_000_000) }));
    expect(r.coverage).toEqual({ status: 'evaluated' });
    expect(r.issues).toEqual([]);
  });

  it('is an error when the frontmatter is $101 off, with its field and canonical remediation', () => {
    const r = cc17(withFrontmatter(10_000_101, { valuation: valuation(10_000_000) }));
    expect(r.coverage).toEqual({ status: 'evaluated' });
    expect(r.issues).toHaveLength(1);
    expectRegistered(r.issues[0]!, 'CC-17', 'error', 'quick_metrics.purchase_price');
    expect(r.issues[0]).toMatchObject({ section: 'frontmatter', value: 101 });
  });

  it('is clean at exactly $100 (the boundary is CC-10\'s: over $100 is an error)', () => {
    for (const price of [10_000_100, 9_999_900]) {
      const r = cc17(withFrontmatter(price, { valuation: valuation(10_000_000) }));
      expect(r.coverage, String(price)).toEqual({ status: 'evaluated' });
      expect(r.issues, String(price)).toEqual([]);
    }
  });

  it('applies to every asset class', () => {
    for (const assetClass of ['multifamily', 'office', 'hospitality']) {
      const r = cc17(withFrontmatter(12_000_000, { valuation: valuation(10_000_000) }, assetClass));
      expect(r.issues, assetClass).toHaveLength(1);
    }
  });

  it('is skipped field_absent when either price is absent, section_absent without a valuation', () => {
    expect(cc17(withFrontmatter(undefined, { valuation: valuation(10_000_000) })).coverage)
      .toEqual({ status: 'skipped', reason: 'field_absent', detail: 'quick_metrics.purchase_price' });
    expect(cc17(withFrontmatter(10_000_000, { valuation: valuation() })).coverage)
      .toEqual({ status: 'skipped', reason: 'field_absent', detail: 'valuation.purchase_price' });
    expect(cc17(withFrontmatter(10_000_000, {})).coverage)
      .toEqual({ status: 'skipped', reason: 'section_absent', detail: 'valuation' });
  });

  it('is skipped variant_unresolvable, named by CC-16, when two valuation variants do not resolve', () => {
    const r = cc17(withFrontmatter(12_000_000, {
      valuation: {
        bank: { ...valuation(10_000_000), annotation: { section: 'valuation', variant: 'bank' } },
        sponsor: { ...valuation(12_000_000), annotation: { section: 'valuation', variant: 'sponsor' } },
      },
    }));
    expect(r.coverage).toEqual({ status: 'skipped', reason: 'variant_unresolvable', detail: 'valuation' });
    expect(r.issues).toEqual([]);
    const cc16 = r.all.filter((i) => i.code === 'CC-16');
    expect(cc16).toHaveLength(1);
    expect(cc16[0]!.message).toContain('CC-17');
  });

  it('reads the default variant when one is named', () => {
    const r = cc17(withFrontmatter(12_000_000, {
      valuation: {
        default: { ...valuation(10_000_000), annotation: { section: 'valuation', variant: 'default' } },
        sponsor: { ...valuation(12_000_000), annotation: { section: 'valuation', variant: 'sponsor' } },
      },
    }));
    expect(r.coverage).toEqual({ status: 'evaluated' });
    expect(r.issues).toHaveLength(1);
  });
});
