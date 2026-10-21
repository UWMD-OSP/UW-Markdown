import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import { DEFAULT_THRESHOLDS, type ParsedUWFile, type UWBlock, type ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section }, content,
    meta: { section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual', agent_id: null, agent_version: null, actor: 'test', timestamp: '2026-08-12T00:00:00Z', notes: null }, quality: { confidence: 'high', human_review_required: false, flags: [] }, integrity: { input_hash: null } },
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
  const sec = (section: string, content: Record<string, unknown>) => () => file({}, { [section]: block(section, content) });
  const at = (path: string, value: number): Record<string, unknown> => {
    const keys = path.split('.');
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (const key of keys.slice(0, -1)) {
      const child: Record<string, unknown> = {};
      cursor[key] = child;
      cursor = child;
    }
    cursor[keys.at(-1)!] = value;
    return root;
  };
  // Every Format-defined home (Format §5.2, RFC 0105): frontmatter quick_metrics
  // and the section field, each checked on its own.
  const cases: Array<{
    code: string;
    severity: ValidationMessage['severity'];
    section?: string;
    field: string;
    trigger: () => ParsedUWFile;
    boundary: () => ParsedUWFile;
  }> = [
    { code: 'FV-01', severity: 'warning', field: 'quick_metrics.cap_rate', trigger: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below - 0.001 }), boundary: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below }) },
    { code: 'FV-01', severity: 'warning', section: 'valuation', field: 'going_in_cap_rate', trigger: sec('valuation', { going_in_cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below - 0.001 }), boundary: sec('valuation', { going_in_cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_below }) },
    { code: 'FV-02', severity: 'warning', field: 'quick_metrics.cap_rate', trigger: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_above + 0.001 }), boundary: () => file({ cap_rate: DEFAULT_THRESHOLDS.cap_rate.warning_above }) },
    { code: 'FV-03', severity: 'warning', field: 'quick_metrics.debt_yield', trigger: () => file({ debt_yield: DEFAULT_THRESHOLDS.debt_yield.warning_below - 0.001 }), boundary: () => file({ debt_yield: DEFAULT_THRESHOLDS.debt_yield.warning_below }) },
    { code: 'FV-03', severity: 'warning', section: 'debt_structure', field: 'sizing_metrics.debt_yield', trigger: sec('debt_structure', at('sizing_metrics.debt_yield', DEFAULT_THRESHOLDS.debt_yield.warning_below - 0.001)), boundary: sec('debt_structure', at('sizing_metrics.debt_yield', DEFAULT_THRESHOLDS.debt_yield.warning_below)) },
    { code: 'FV-04', severity: 'warning', field: 'quick_metrics.dscr', trigger: () => file({ dscr: DEFAULT_THRESHOLDS.dscr.warning_below - 0.001 }), boundary: () => file({ dscr: DEFAULT_THRESHOLDS.dscr.warning_below }) },
    { code: 'FV-04', severity: 'warning', section: 'debt_structure', field: 'sizing_metrics.dscr_underwritten', trigger: sec('debt_structure', at('sizing_metrics.dscr_underwritten', DEFAULT_THRESHOLDS.dscr.warning_below - 0.001)), boundary: sec('debt_structure', at('sizing_metrics.dscr_underwritten', DEFAULT_THRESHOLDS.dscr.warning_below)) },
    { code: 'FV-05', severity: 'warning', section: 'dcf', field: 'returns.equity_multiple', trigger: sec('dcf', at('returns.equity_multiple', DEFAULT_THRESHOLDS.equity_multiple.warning_below - 0.01)), boundary: sec('dcf', at('returns.equity_multiple', DEFAULT_THRESHOLDS.equity_multiple.warning_below)) },
    { code: 'FV-06', severity: 'warning', section: 'dcf', field: 'returns.equity_multiple', trigger: sec('dcf', at('returns.equity_multiple', DEFAULT_THRESHOLDS.equity_multiple.warning_above + 0.01)), boundary: sec('dcf', at('returns.equity_multiple', DEFAULT_THRESHOLDS.equity_multiple.warning_above)) },
    { code: 'FV-07', severity: 'warning', field: 'quick_metrics.irr_projected', trigger: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_below - 0.001 }), boundary: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_below }) },
    { code: 'FV-07', severity: 'warning', section: 'dcf', field: 'returns.levered_irr', trigger: sec('dcf', at('returns.levered_irr', DEFAULT_THRESHOLDS.irr.warning_below - 0.001)), boundary: sec('dcf', at('returns.levered_irr', DEFAULT_THRESHOLDS.irr.warning_below)) },
    { code: 'FV-08', severity: 'warning', field: 'quick_metrics.irr_projected', trigger: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_above + 0.001 }), boundary: () => file({ irr_projected: DEFAULT_THRESHOLDS.irr.warning_above }) },
    { code: 'FV-09', severity: 'warning', field: 'quick_metrics.ltv', trigger: () => file({ ltv: DEFAULT_THRESHOLDS.ltv.warning_above + 0.001 }), boundary: () => file({ ltv: DEFAULT_THRESHOLDS.ltv.warning_above }) },
    { code: 'FV-09', severity: 'warning', section: 'debt_structure', field: 'sizing_metrics.ltv', trigger: sec('debt_structure', at('sizing_metrics.ltv', DEFAULT_THRESHOLDS.ltv.warning_above + 0.001)), boundary: sec('debt_structure', at('sizing_metrics.ltv', DEFAULT_THRESHOLDS.ltv.warning_above)) },
    { code: 'FV-10', severity: 'warning', section: 'noi_model', field: 'expenses.expense_ratio', trigger: sec('noi_model', at('expenses.expense_ratio', DEFAULT_THRESHOLDS.opex_ratio.warning_below - 0.001)), boundary: sec('noi_model', at('expenses.expense_ratio', DEFAULT_THRESHOLDS.opex_ratio.warning_below)) },
    { code: 'FV-11', severity: 'warning', section: 'noi_model', field: 'expenses.expense_ratio', trigger: sec('noi_model', at('expenses.expense_ratio', DEFAULT_THRESHOLDS.opex_ratio.warning_above + 0.001)), boundary: sec('noi_model', at('expenses.expense_ratio', DEFAULT_THRESHOLDS.opex_ratio.warning_above)) },
    { code: 'FV-12', severity: 'warning', section: 'dcf', field: 'assumptions.revenue_growth_rate', trigger: sec('dcf', at('assumptions.revenue_growth_rate', DEFAULT_THRESHOLDS.annual_rent_growth.warning_above + 0.001)), boundary: sec('dcf', at('assumptions.revenue_growth_rate', DEFAULT_THRESHOLDS.annual_rent_growth.warning_above)) },
    { code: 'FV-13', severity: 'warning', section: 'noi_model', field: 'income.vacancy_credit_loss.rate_applied', trigger: sec('noi_model', at('income.vacancy_credit_loss.rate_applied', DEFAULT_THRESHOLDS.vacancy_rate.warning_below - 0.001)), boundary: sec('noi_model', at('income.vacancy_credit_loss.rate_applied', DEFAULT_THRESHOLDS.vacancy_rate.warning_below)) },
    { code: 'FV-14', severity: 'warning', section: 'noi_model', field: 'income.vacancy_credit_loss.rate_applied', trigger: sec('noi_model', at('income.vacancy_credit_loss.rate_applied', DEFAULT_THRESHOLDS.vacancy_rate.warning_above + 0.001)), boundary: sec('noi_model', at('income.vacancy_credit_loss.rate_applied', DEFAULT_THRESHOLDS.vacancy_rate.warning_above)) },
  ];

  for (const testCase of cases) {
    it(`emits ${testCase.code} at ${testCase.field} past its configured boundary with canonical remediation`, () => {
      const found = issues(testCase.trigger(), testCase.code);
      expect(found, testCase.code).toHaveLength(1);
      expectRegistered(found[0]!, testCase.code, testCase.severity, testCase.field);
      expect(found[0]!.section).toBe(testCase.section ?? 'frontmatter');
    });

    it(`does not emit ${testCase.code} at ${testCase.field} exactly at its configured boundary`, () => {
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

  it('reports only the most severe band crossed, once per home (D2)', () => {
    const dscr = issues(file({ dscr: 0.95 }), 'FV-04');
    expect(dscr.map((issue) => issue.severity)).toEqual(['error']);
    const ltv = issues(file({ ltv: 0.9 }), 'FV-09');
    expect(ltv.map((issue) => issue.severity)).toEqual(['error']);
  });

  it('checks each stated home on its own (D1)', () => {
    const parsed = file({ dscr: 0.95 }, { debt_structure: block('debt_structure', at('sizing_metrics.dscr_underwritten', 1.1)) });
    expect(issues(parsed, 'FV-04').map((issue) => [issue.section, issue.field, issue.severity])).toEqual([
      ['frontmatter', 'quick_metrics.dscr', 'error'],
      ['debt_structure', 'sizing_metrics.dscr_underwritten', 'warning'],
    ]);
  });

  it('reads no field the Format does not define (D4)', () => {
    const parsed = file({}, {
      noi_model: block('noi_model', { vacancy_rate: 0.5, effective_gross_income: 100, total_operating_expenses: 90 }),
      dcf: block('dcf', { levered_equity_multiple: 9, assumptions: { annual_rent_growth: 0.5 } }),
    });
    const codes = validateUWFile(parsed).issues.map((issue) => issue.code).filter((code) => code.startsWith('FV-'));
    expect(codes).toEqual([]);
  });

  it('skips an absent, null or non-numeric home', () => {
    const parsed = file({}, { debt_structure: block('debt_structure', { sizing_metrics: { dscr_underwritten: null, ltv: '0.95' } }) });
    expect(validateUWFile(parsed).issues.filter((issue) => issue.code.startsWith('FV-'))).toEqual([]);
  });

  it('reads the senior debt_structure among role-bearing variants', () => {
    const senior = block('debt_structure', { _role: 'senior', sizing_metrics: { dscr_underwritten: 0.9 } });
    const mezz = block('debt_structure', { _role: 'mezzanine', sizing_metrics: { dscr_underwritten: 2 } });
    const parsed = file({}, { debt_structure: { senior, mezz } as unknown as UWBlock });
    expect(issues(parsed, 'FV-04').map((issue) => issue.severity)).toEqual(['error']);
  });
});
