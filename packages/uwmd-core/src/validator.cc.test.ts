import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-12T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
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
      sections: { valuation: block('valuation', { underwritten_value: 1_000 }), debt_structure: block('debt_structure', { loan_amount: 700, ltv: 0.6 }) },
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
  ];

  for (const testCase of cases) {
    it(`emits ${testCase.code} with its field and canonical remediation`, () => {
      expectRegistered(issue(file(testCase.sections), testCase.code), testCase.code, testCase.severity, testCase.field);
    });
  }
});
