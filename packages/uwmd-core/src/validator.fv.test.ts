import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import { DEFAULT_THRESHOLDS, type ParsedUWFile, type UWBlock, type ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section }, content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-12T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(
  quickMetrics: Record<string, number> = {},
  sections: Record<string, UWBlock> = {},
): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily', quick_metrics: quickMetrics } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

function issues(parsed: ParsedUWFile, code: string): ValidationMessage[] {
  return validateUWFile(parsed).issues.filter((issue) => issue.code === code);
}

function expectRegistered(issue: ValidationMessage, code: string, severity: ValidationMessage['severity'], field: string): void {
  const remediation = BUILTIN_REMEDIATIONS.find((candidate) => candidate.code === code);
  expect(remediation, code).toBeDefined();
  expect(issue).toMatchObject({ code, severity, field });
  expect(issue.title).toBe(remediation!.title);
  expect(issue.remediation).toBe(remediation!.remediation);
  expect(issue.spec_ref).toBe(remediation!.spec_ref);
}

describe('validateUWFile — FV financial validity', () => {
  const cases: Array<{
    code: string;
    severity: ValidationMessage['severity'];
    field: string;
    trigger: () => ParsedUWFile;
    boundary: () => ParsedUWFile;
  }> = [
    { code: 'FV-01', severity: 'warning', field: 'cap_rate', trigger: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below - 0.001 }), boundary: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below }) },
    { code: 'FV-02', severity: 'warning', field: 'cap_rate', trigger: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_above + 0.001 }), boundary: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_above }) },
    { code: 'FV-03', severity: 'warning', field: 'debt_yield', trigger: () => file({ debt_yield: DEFAULT_THRESHOLDS.debt_yield.warning_below - 0.001 }), boundary: () => file({ debt_yield: DEFAULT_THRESHOLDS.debt_yield.warning_below }) },
    { code: 'FV-04', severity: 'warning', field: 'dscr', trigger: () => file({ dscr: DEFAULT_THRESHOLDS.dscr.warning_below - 0.001 }), boundary: () => file({ dscr: DEFAULT_THRESHOLDS.dscr.warning_below }) },
    { code: 'FV-05', severity: 'warning', field: 'equity_multiple', trigger: () => file({}, { dcf: block('dcf', { levered_equity_multiple: DEFAULT_THRESHOLDS.equity_multiple.warning_below - 0.01 }) }), boundary: () => file({}, { dcf: block('dcf', { levered_equity_multiple: DEFAULT_THRESHOLDS.equity_multiple.warning_below }) }) },
    { code: 'FV-06', severity: 'warning', field: 'equity_multiple', trigger: () => file({}, { dcf: block('dcf', { levered_equity_multiple: DEFAULT_THRESHOLDS.equity_multiple.warning_above + 0.01 }) }), boundary: () => file({}, { dcf: block('dcf', { levered_equity_multiple: DEFAULT_THRESHOLDS.equity_multiple.warning_above }) }) },
    { code: 'FV-07', severity: 'warning', field: 'irr_projected', trigger: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_below - 0.001 }), boundary: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_below }) },
    { code: 'FV-08', severity: 'warning', field: 'irr_projected', trigger: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_above + 0.001 }), boundary: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_above }) },
    { code: 'FV-09', severity: 'warning', field: 'ltv', trigger: () => file({ ltv: DEFAULT_THRESHOLDS.ltv.warning_above + 0.001 }), boundary: () => file({ ltv: DEFAULT_THRESHOLDS.ltv.warning_above }) },
    { code: 'FV-10', severity: 'warning', field: 'total_operating_expenses', trigger: () => file({}, { noi_model: block('noi_model', { effective_gross_income: 100, total_operating_expenses: DEFAULT_THRESHOLDS.opex_ratio.warning_below * 100 - 1 }) }), boundary: () => file({}, { noi_model: block('noi_model', { effective_gross_income: 100, total_operating_expenses: DEFAULT_THRESHOLDS.opex_ratio.warning_below * 100 }) }) },
    { code: 'FV-11', severity: 'warning', field: 'total_operating_expenses', trigger: () => file({}, { noi_model: block('noi_model', { effective_gross_income: 100, total_operating_expenses: DEFAULT_THRESHOLDS.opex_ratio.warning_above * 100 + 1 }) }), boundary: () => file({}, { noi_model: block('noi_model', { effective_gross_income: 100, total_operating_expenses: DEFAULT_THRESHOLDS.opex_ratio.warning_above * 100 }) }) },
    { code: 'FV-12', severity: 'warning', field: 'annual_rent_growth', trigger: () => file({}, { dcf: block('dcf', { assumptions: { annual_rent_growth: DEFAULT_THRESHOLDS.annual_rent_growth.warning_above + 0.001 } }) }), boundary: () => file({}, { dcf: block('dcf', { assumptions: { annual_rent_growth: DEFAULT_THRESHOLDS.annual_rent_growth.warning_above } }) }) },
    { code: 'FV-13', severity: 'warning', field: 'vacancy_rate', trigger: () => file({}, { noi_model: block('noi_model', { vacancy_rate: DEFAULT_THRESHOLDS.vacancy_rate.warning_below - 0.001 }) }), boundary: () => file({}, { noi_model: block('noi_model', { vacancy_rate: DEFAULT_THRESHOLDS.vacancy_rate.warning_below }) }) },
    { code: 'FV-14', severity: 'warning', field: 'vacancy_rate', trigger: () => file({}, { noi_model: block('noi_model', { vacancy_rate: DEFAULT_THRESHOLDS.vacancy_rate.warning_above + 0.001 }) }), boundary: () => file({}, { noi_model: block('noi_model', { vacancy_rate: DEFAULT_THRESHOLDS.vacancy_rate.warning_above }) }) },
  ];

  for (const testCase of cases) {
    it(`emits ${testCase.code} above its configured boundary with canonical remediation`, () => {
      const found = issues(testCase.trigger(), testCase.code).find((issue) => issue.severity === testCase.severity);
      expect(found, testCase.code).toBeDefined();
      expectRegistered(found!, testCase.code, testCase.severity, testCase.field);
    });

    it(`does not emit ${testCase.code} exactly at its configured boundary`, () => {
      expect(issues(testCase.boundary(), testCase.code)).toEqual([]);
    });
  }

  it('escalates DSCR and LTV after their error thresholds', () => {
    const dscr = issues(file({ dscr: DEFAULT_THRESHOLDS.dscr.error_below - 0.001 }), 'FV-04');
    const ltv = issues(file({ ltv: DEFAULT_THRESHOLDS.ltv.error_above + 0.001 }), 'FV-09');

    expect(dscr.some((issue) => issue.severity === 'error')).toBe(true);
    expect(ltv.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('does not escalate DSCR or LTV exactly at their error thresholds', () => {
    const dscr = issues(file({ dscr: DEFAULT_THRESHOLDS.dscr.error_below }), 'FV-04');
    const ltv = issues(file({ ltv: DEFAULT_THRESHOLDS.ltv.error_above }), 'FV-09');

    expect(dscr.some((issue) => issue.severity === 'error')).toBe(false);
    expect(ltv.some((issue) => issue.severity === 'error')).toBe(false);
  });
});
