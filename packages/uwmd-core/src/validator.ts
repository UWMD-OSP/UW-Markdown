// .uw.md validator — financial validity checks (§5.2) + cross-section consistency (§5.3)
// Spec: UW_FORMAT_SPEC_v1.md Part V

import type {
  ParsedUWFile,
  ValidationMessage,
  ValidationResult,
  FinancialThresholds,
  StageReadiness,
  DealStage,
} from './types.js';
import { DEFAULT_THRESHOLDS } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import type { IssueRemediation } from './protocol.js';

// ─── BUILTIN_REMEDIATIONS lookup (UW_PROTOCOL_v1.md §III.6) ──────────────────
//
// Validator constructs inline messages with deal-specific values, but the
// registry provides canonical title/remediation/spec_ref copy keyed by code.
// `lookupRemediation` is also exported from the package index so module
// authors can extend the registry uniformly.

const REMEDIATION_INDEX: Readonly<Record<string, IssueRemediation>> = (() => {
  const idx: Record<string, IssueRemediation> = {};
  for (const r of BUILTIN_REMEDIATIONS) idx[r.code] = r;
  return Object.freeze(idx);
})();

export function lookupRemediation(code: string): IssueRemediation | undefined {
  return REMEDIATION_INDEX[code];
}

function enrichWithRemediation(msg: ValidationMessage): ValidationMessage {
  const reg = REMEDIATION_INDEX[msg.code];
  if (!reg) return msg;
  return {
    ...msg,
    title: msg.title ?? reg.title,
    remediation: msg.remediation ?? reg.remediation,
    spec_ref: msg.spec_ref ?? reg.spec_ref,
  };
}

// ─── Stage completeness requirements (spec §5.1) ──────────────────────────────

const STAGE_REQUIREMENTS: Record<DealStage, string[]> = {
  screening:        ['property', 'debt_structure', 'validation'],
  term_sheet:       ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing'],
  full_underwrite:  ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'noi_model', 'valuation', 'sources_uses', 'market_analysis'],
  credit_approval:  ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions'],
  closing:          ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions', 'due_diligence'],
  monitoring:       ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions', 'due_diligence'],
};

// ─── Main validate function ───────────────────────────────────────────────────

export function validateUWFile(
  parsed: ParsedUWFile,
  thresholdOverrides?: Partial<FinancialThresholds>,
): ValidationResult {
  const thresholds: FinancialThresholds = { ...DEFAULT_THRESHOLDS, ...thresholdOverrides };
  const issues: ValidationMessage[] = [];

  checkFinancialValidity(parsed, thresholds, issues);
  checkCrossSectionConsistency(parsed, issues);
  checkMetaIntegrity(parsed, issues);

  // Enrich every issue with BUILTIN_REMEDIATIONS title/remediation/spec_ref
  // when the code matches the registry. Keeps inline messages (which carry
  // deal-specific values) and adds canonical remediation copy.
  for (let i = 0; i < issues.length; i++) issues[i] = enrichWithRemediation(issues[i]!);

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const info = issues.filter(i => i.severity === 'info');

  const blocking = (parsed.frontmatter.blocking_flags?.length ?? 0) > 0;
  const overall_status = blocking ? 'blocking'
    : errors.length > 0 ? 'errors'
    : warnings.length > 0 ? 'warnings'
    : 'clean';

  return {
    overall_status,
    stage_readiness: computeStageReadiness(parsed),
    issues,
    errors,
    warnings,
    info,
  };
}

// ─── §5.2 Financial validity thresholds ──────────────────────────────────────

function checkFinancialValidity(
  parsed: ParsedUWFile,
  t: FinancialThresholds,
  issues: ValidationMessage[],
): void {
  const qm = parsed.frontmatter.quick_metrics ?? {};

  const checks: Array<{
    metric: string;
    value: number | null | undefined;
    section?: string;
    field?: string;
    rules: Array<{ type: 'error' | 'warning'; direction: 'below' | 'above'; limit: number }>;
  }> = [
    {
      metric: 'dscr',
      value: qm.dscr,
      section: 'debt_structure',
      rules: [
        { type: 'error',   direction: 'below', limit: t.dscr.error_below },
        { type: 'warning', direction: 'below', limit: t.dscr.warning_below },
      ],
    },
    {
      metric: 'ltv',
      value: qm.ltv,
      section: 'debt_structure',
      rules: [
        { type: 'warning', direction: 'above', limit: t.ltv.warning_above },
        { type: 'error',   direction: 'above', limit: t.ltv.error_above },
      ],
    },
    {
      metric: 'debt_yield',
      value: qm.debt_yield,
      section: 'debt_structure',
      rules: [
        { type: 'warning', direction: 'below', limit: t.debt_yield.warning_below },
      ],
    },
    {
      metric: 'cap_rate',
      value: qm.cap_rate,
      section: 'valuation',
      rules: [
        { type: 'warning', direction: 'below', limit: t.cap_rate.warning_below },
        { type: 'warning', direction: 'above', limit: t.cap_rate.warning_above },
      ],
    },
    {
      metric: 'irr_projected',
      value: qm.irr_projected,
      section: 'dcf',
      rules: [
        { type: 'warning', direction: 'below', limit: t.irr.warning_below },
        { type: 'warning', direction: 'above', limit: t.irr.warning_above },
      ],
    },
  ];

  for (const check of checks) {
    if (check.value == null) continue;
    for (const rule of check.rules) {
      const hit = rule.direction === 'below'
        ? check.value < rule.limit
        : check.value > rule.limit;

      if (hit) {
        issues.push({
          code: `FV_${check.metric.toUpperCase()}_${rule.direction.toUpperCase()}_THRESHOLD`,
          severity: rule.type,
          section: check.section,
          field: check.metric,
          message: `${check.metric.toUpperCase()} ${check.value.toFixed(4)} is ${rule.direction} ${rule.type} threshold of ${rule.limit}`,
          value: check.value,
          threshold: rule.direction === 'below'
            ? { min: rule.limit }
            : { max: rule.limit },
        });
      }
    }
  }

  // Vacancy and OpEx ratio come from noi_model content, not quick_metrics
  const noiBlock = getSection(parsed, 'noi_model');
  if (noiBlock) {
    const vacancyRate = deepGet(noiBlock.content, 'vacancy_rate') as number | undefined;
    const egi = deepGet(noiBlock.content, 'effective_gross_income') as number | undefined;
    const opex = deepGet(noiBlock.content, 'total_operating_expenses') as number | undefined;

    if (vacancyRate != null) {
      if (vacancyRate < t.vacancy_rate.warning_below) {
        issues.push({ code: 'FV_VACANCY_BELOW_MIN', severity: 'warning', section: 'noi_model', field: 'vacancy_rate', message: `Vacancy rate ${(vacancyRate * 100).toFixed(1)}% is unusually low (below ${(t.vacancy_rate.warning_below * 100).toFixed(0)}%)`, value: vacancyRate, threshold: { min: t.vacancy_rate.warning_below } });
      }
      if (vacancyRate > t.vacancy_rate.warning_above) {
        issues.push({ code: 'FV_VACANCY_ABOVE_MAX', severity: 'warning', section: 'noi_model', field: 'vacancy_rate', message: `Vacancy rate ${(vacancyRate * 100).toFixed(1)}% is unusually high (above ${(t.vacancy_rate.warning_above * 100).toFixed(0)}%)`, value: vacancyRate, threshold: { max: t.vacancy_rate.warning_above } });
      }
    }

    if (egi != null && opex != null && egi > 0) {
      const opexRatio = opex / egi;
      if (opexRatio < t.opex_ratio.warning_below) {
        issues.push({ code: 'FV_OPEX_BELOW_MIN', severity: 'warning', section: 'noi_model', field: 'total_operating_expenses', message: `OpEx ratio ${(opexRatio * 100).toFixed(1)}% of EGI is suspiciously low (below ${(t.opex_ratio.warning_below * 100).toFixed(0)}%)`, value: opexRatio, threshold: { min: t.opex_ratio.warning_below } });
      }
      if (opexRatio > t.opex_ratio.warning_above) {
        issues.push({ code: 'FV_OPEX_ABOVE_MAX', severity: 'warning', section: 'noi_model', field: 'total_operating_expenses', message: `OpEx ratio ${(opexRatio * 100).toFixed(1)}% of EGI is unusually high (above ${(t.opex_ratio.warning_above * 100).toFixed(0)}%)`, value: opexRatio, threshold: { max: t.opex_ratio.warning_above } });
      }
    }
  }

  // Annual rent growth from dcf assumptions
  const dcfBlock = getSection(parsed, 'dcf');
  if (dcfBlock) {
    const rentGrowth = deepGet(dcfBlock.content, 'assumptions.annual_rent_growth') as number | undefined
      ?? deepGet(dcfBlock.content, 'rent_growth_assumption') as number | undefined;
    if (rentGrowth != null && rentGrowth > t.annual_rent_growth.warning_above) {
      issues.push({ code: 'FV_RENT_GROWTH_ABOVE_MAX', severity: 'warning', section: 'dcf', field: 'annual_rent_growth', message: `Annual rent growth assumption ${(rentGrowth * 100).toFixed(1)}% is above the ${(t.annual_rent_growth.warning_above * 100).toFixed(0)}% warning threshold`, value: rentGrowth, threshold: { max: t.annual_rent_growth.warning_above } });
    }

    const equityMultiple = deepGet(dcfBlock.content, 'levered_equity_multiple') as number | undefined
      ?? deepGet(dcfBlock.content, 'summary.equity_multiple') as number | undefined;
    if (equityMultiple != null) {
      if (equityMultiple < t.equity_multiple.warning_below) {
        issues.push({ code: 'FV_EQUITY_MULTIPLE_BELOW_MIN', severity: 'warning', section: 'dcf', field: 'equity_multiple', message: `Equity multiple ${equityMultiple.toFixed(2)}x is below ${t.equity_multiple.warning_below}x warning threshold`, value: equityMultiple, threshold: { min: t.equity_multiple.warning_below } });
      }
      if (equityMultiple > t.equity_multiple.warning_above) {
        issues.push({ code: 'FV_EQUITY_MULTIPLE_ABOVE_MAX', severity: 'warning', section: 'dcf', field: 'equity_multiple', message: `Equity multiple ${equityMultiple.toFixed(2)}x is above ${t.equity_multiple.warning_above}x warning threshold`, value: equityMultiple, threshold: { max: t.equity_multiple.warning_above } });
      }
    }
  }
}

// ─── §5.3 Cross-section consistency checks ───────────────────────────────────

function checkCrossSectionConsistency(
  parsed: ParsedUWFile,
  issues: ValidationMessage[],
): void {
  const rentRoll = getSection(parsed, 'rent_roll');
  const os = getSectionVariant(parsed, 'operating_statement', 't12')
    ?? getSectionVariant(parsed, 'operating_statement', 'default')
    ?? getSection(parsed, 'operating_statement');
  const debtStructure = getSection(parsed, 'debt_structure');
  const sourcesUses = getSection(parsed, 'sources_uses');
  const valuation = getSection(parsed, 'valuation');
  const noiModel = getSection(parsed, 'noi_model');
  const dcf = getSection(parsed, 'dcf');
  const stressTests = getSection(parsed, 'stress_tests')
    ?? getSectionVariant(parsed, 'stress_tests', 'default');
  const dueDiligence = getSection(parsed, 'due_diligence');

  // CC-01: Rent roll GPR must match OS GPR within 3%
  if (rentRoll && os) {
    const rrGPR = deepGet(rentRoll.content, 'gross_potential_rent') as number | undefined
      ?? deepGet(rentRoll.content, 'totals.gross_potential_rent') as number | undefined;
    const osGPR = deepGet(os.content, 'gross_potential_rent') as number | undefined
      ?? deepGet(os.content, 'income.gross_potential_rent') as number | undefined;
    if (rrGPR != null && osGPR != null && osGPR !== 0) {
      const pctDiff = Math.abs(rrGPR - osGPR) / osGPR;
      if (pctDiff > 0.03) {
        issues.push({ code: 'CC-01', severity: 'warning', section: 'rent_roll', message: `CC-01: Rent roll GPR ($${rrGPR.toLocaleString()}) differs from Operating Statement GPR ($${osGPR.toLocaleString()}) by ${(pctDiff * 100).toFixed(1)}% (threshold: 3%)`, value: pctDiff });
      }
    }
  }

  // CC-02: UW value in valuation must match LTV denominator in debt_structure
  if (valuation && debtStructure) {
    const uwValue = deepGet(valuation.content, 'underwritten_value') as number | undefined
      ?? deepGet(valuation.content, 'purchase_price') as number | undefined;
    const loanAmt = deepGet(debtStructure.content, 'loan_amount') as number | undefined;
    const ltvInDebt = deepGet(debtStructure.content, 'ltv') as number | undefined;
    if (uwValue != null && loanAmt != null && ltvInDebt != null && uwValue > 0) {
      const impliedLTV = loanAmt / uwValue;
      const diff = Math.abs(impliedLTV - ltvInDebt);
      if (diff > 0.005) {
        issues.push({ code: 'CC-02', severity: 'warning', section: 'debt_structure', message: `CC-02: Implied LTV (${(impliedLTV * 100).toFixed(2)}%) from loan/value does not match stated LTV (${(ltvInDebt * 100).toFixed(2)}%) — check valuation.underwritten_value vs debt_structure.ltv`, value: diff });
      }
    }
  }

  // CC-03: Loan amount in sources_uses must match debt_structure.loan_amount
  if (sourcesUses && debtStructure) {
    const suLoan = deepGet(sourcesUses.content, 'sources.loan_amount') as number | undefined
      ?? deepGet(sourcesUses.content, 'sources.debt_proceeds') as number | undefined;
    const dsLoan = deepGet(debtStructure.content, 'loan_amount') as number | undefined;
    if (suLoan != null && dsLoan != null && Math.abs(suLoan - dsLoan) > 100) {
      issues.push({ code: 'CC-03', severity: 'error', section: 'sources_uses', message: `CC-03: Loan amount in Sources & Uses ($${suLoan.toLocaleString()}) does not match Debt Structure loan amount ($${dsLoan.toLocaleString()})`, value: Math.abs(suLoan - dsLoan) });
    }
  }

  // CC-04: Sources must equal uses in sources_uses (within $1)
  if (sourcesUses) {
    const totalSources = deepGet(sourcesUses.content, 'total_sources') as number | undefined;
    const totalUses = deepGet(sourcesUses.content, 'total_uses') as number | undefined;
    if (totalSources != null && totalUses != null && Math.abs(totalSources - totalUses) > 1) {
      issues.push({ code: 'CC-04', severity: 'error', section: 'sources_uses', message: `CC-04: Sources ($${totalSources.toLocaleString()}) do not equal Uses ($${totalUses.toLocaleString()}) — difference: $${Math.abs(totalSources - totalUses).toLocaleString()}`, value: Math.abs(totalSources - totalUses) });
    }
  }

  // CC-05: NOI used for DSCR must match noi_model.net_operating_income within 1%
  if (noiModel && debtStructure) {
    const modelNOI = deepGet(noiModel.content, 'net_operating_income') as number | undefined;
    const debtNOI = deepGet(debtStructure.content, 'underwritten_noi') as number | undefined
      ?? deepGet(debtStructure.content, 'noi_used_for_dscr') as number | undefined;
    if (modelNOI != null && debtNOI != null && modelNOI > 0) {
      const pctDiff = Math.abs(modelNOI - debtNOI) / modelNOI;
      if (pctDiff > 0.01) {
        issues.push({ code: 'CC-05', severity: 'warning', section: 'debt_structure', message: `CC-05: NOI used for DSCR ($${debtNOI.toLocaleString()}) differs from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}% (threshold: 1%)`, value: pctDiff });
      }
    }
  }

  // CC-06: DCF Year 1 NOI must be consistent with noi_model projections
  if (noiModel && dcf) {
    const modelNOI = deepGet(noiModel.content, 'net_operating_income') as number | undefined;
    const dcfY1NOI = deepGet(dcf.content, 'annual_cash_flows[0].noi') as number | undefined
      ?? deepGet(dcf.content, 'annual_cash_flows[0].net_operating_income') as number | undefined;
    if (modelNOI != null && dcfY1NOI != null && modelNOI > 0) {
      const pctDiff = Math.abs(modelNOI - dcfY1NOI) / modelNOI;
      if (pctDiff > 0.02) {
        issues.push({ code: 'CC-06', severity: 'warning', section: 'dcf', message: `CC-06: DCF Year 1 NOI ($${dcfY1NOI.toLocaleString()}) deviates from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}%`, value: pctDiff });
      }
    }
  }

  // CC-07: Exit cap rate in dcf must be consistent with stress test cap rate scenarios
  if (dcf && stressTests) {
    const dcfExitCap = deepGet(dcf.content, 'assumptions.exit_cap_rate') as number | undefined
      ?? deepGet(dcf.content, 'exit_cap_rate') as number | undefined;
    const stressExitCap = deepGet(stressTests.content, 'base_case.exit_cap_rate') as number | undefined;
    if (dcfExitCap != null && stressExitCap != null && Math.abs(dcfExitCap - stressExitCap) > 0.005) {
      issues.push({ code: 'CC-07', severity: 'warning', section: 'stress_tests', message: `CC-07: Exit cap rate in DCF (${(dcfExitCap * 100).toFixed(2)}%) differs from stress test base case (${(stressExitCap * 100).toFixed(2)}%)`, value: Math.abs(dcfExitCap - stressExitCap) });
    }
  }

  // CC-08: Appraised value in due_diligence must match valuation.appraised_value
  if (dueDiligence && valuation) {
    const ddAppraisedVal = deepGet(dueDiligence.content, 'appraisal.appraised_value') as number | undefined;
    const valAppraisedVal = deepGet(valuation.content, 'appraised_value') as number | undefined;
    if (ddAppraisedVal != null && valAppraisedVal != null && Math.abs(ddAppraisedVal - valAppraisedVal) > 1000) {
      issues.push({ code: 'CC-08', severity: 'warning', section: 'due_diligence', message: `CC-08: Appraised value in due_diligence ($${ddAppraisedVal.toLocaleString()}) does not match valuation.appraised_value ($${valAppraisedVal.toLocaleString()})`, value: Math.abs(ddAppraisedVal - valAppraisedVal) });
    }
  }

  // CC-09: Annual debt service in stress_tests base case must match debt_structure.annual_debt_service
  if (stressTests && debtStructure) {
    const stressADS = deepGet(stressTests.content, 'base_case.annual_debt_service') as number | undefined;
    const debtADS = deepGet(debtStructure.content, 'annual_debt_service') as number | undefined;
    if (stressADS != null && debtADS != null && Math.abs(stressADS - debtADS) > 500) {
      issues.push({ code: 'CC-09', severity: 'warning', section: 'stress_tests', message: `CC-09: Annual debt service in stress test base case ($${stressADS.toLocaleString()}) differs from debt_structure ($${debtADS.toLocaleString()}) by $${Math.abs(stressADS - debtADS).toLocaleString()}`, value: Math.abs(stressADS - debtADS) });
    }
  }

  // CC-10: Purchase price in sources_uses.uses must match valuation.purchase_price
  if (sourcesUses && valuation) {
    const suPP = deepGet(sourcesUses.content, 'uses.purchase_price') as number | undefined;
    const valPP = deepGet(valuation.content, 'purchase_price') as number | undefined;
    if (suPP != null && valPP != null && Math.abs(suPP - valPP) > 100) {
      issues.push({ code: 'CC-10', severity: 'error', section: 'sources_uses', message: `CC-10: Purchase price in Sources & Uses ($${suPP.toLocaleString()}) does not match valuation.purchase_price ($${valPP.toLocaleString()})`, value: Math.abs(suPP - valPP) });
    }
  }
}

// ─── Meta integrity checks ────────────────────────────────────────────────────

function checkMetaIntegrity(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const REQUIRED_META_FIELDS = ['section', 'version', 'source', 'timestamp', 'confidence'];

  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const blocks = isVariantMap(entry)
      ? Object.values(entry as Record<string, UWBlock>)
      : [entry as UWBlock];

    for (const block of blocks) {
      if (!block.meta || Object.keys(block.meta).length === 0) {
        issues.push({ code: 'META_MISSING', severity: 'warning', section: sectionId, message: `Section ${sectionId} is missing _meta object` });
        continue;
      }

      for (const field of REQUIRED_META_FIELDS) {
        if ((block.meta as unknown as Record<string, unknown>)[field] == null) {
          issues.push({ code: `META_FIELD_MISSING_${field.toUpperCase()}`, severity: 'warning', section: sectionId, field, message: `Section ${sectionId} _meta is missing required field: ${field}` });
        }
      }

      if (block.meta.confidence === 'low' && !block.meta.human_review_required) {
        issues.push({ code: 'META_LOW_CONFIDENCE_NO_REVIEW_FLAG', severity: 'info', section: sectionId, message: `Section ${sectionId} has low confidence but human_review_required is not set to true` });
      }
    }
  }
}

// ─── Stage readiness ──────────────────────────────────────────────────────────

function computeStageReadiness(parsed: ParsedUWFile): StageReadiness {
  const hasSection = (id: string): boolean => {
    if (id === 'operating_statement') {
      return !!(parsed.sections[id] || getSectionVariant(parsed, id, 't12') || getSectionVariant(parsed, id, 'default'));
    }
    if (id === 'stress_tests' || id === 'due_diligence') {
      return !!(parsed.sections[id]);
    }
    return !!parsed.sections[id];
  };

  const stageReady = (stage: DealStage): boolean =>
    STAGE_REQUIREMENTS[stage].every(s => hasSection(s));

  return {
    screening:       stageReady('screening'),
    term_sheet:      stageReady('term_sheet'),
    full_underwrite: stageReady('full_underwrite'),
    credit_approval: stageReady('credit_approval'),
    closing:         stageReady('closing'),
    monitoring:      stageReady('monitoring'),
  };
}

function isVariantMap(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  return !('annotation' in (val as object));
}

// Re-export UWBlock for use in validator callers
type UWBlock = import('./types.js').UWBlock;
