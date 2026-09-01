// .uw.md validator — financial validity checks (§5.2) + cross-section consistency (§5.3)
// Spec: UW_FORMAT_SPEC_v1.md Part V

import type {
  ParsedUWFile,
  ValidationMessage,
  ValidationResult,
  FinancialThresholds,
  StageReadiness,
  AssetClass,
  DealStage,
} from './types.js';
import { DEFAULT_THRESHOLDS, SOURCE_TAGS } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { BUILTIN_REMEDIATIONS, BUILTIN_INCOMPLETE_DATA_POLICIES, lookupIncompleteDataPolicy, getSizeIntensive, DEAL_UNDERWRITING_PROFILE, parseActorSource, isSupportedLocale } from './protocol.js';
import { EXTERNAL_ANNOTATION_KEY } from './composition.js';
import { UW_LITE_SOURCE_EXTENSION } from './lite-bridge.js';
import type { IssueRemediation, IncompleteDataPolicy } from './protocol.js';
import { readGapsContent } from './gaps.js';
import { leaseUpPeriodOrdinal, LEASE_UP_STABILIZED_TOLERANCE } from './lease-up.js';
import type { LeaseUpGranularity } from './lease-up.js';
import { parseAssetClass, declaredModuleDependencies } from './asset-class.js';

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

// ─── Financial-validity code mapping (Phase 1.4) ─────────────────────────────
//
// Legacy `FV_*` string codes are renamed to `FV-NN` numeric form. The legacy
// code travels alongside the new code as `legacy_code` for one release; v1.2
// drops `legacy_code` entirely. See protocol §III.6a.

const FV_CODE_MAP: Readonly<Record<string, string>> = Object.freeze({
  FV_CAP_RATE_BELOW_THRESHOLD:        'FV-01',
  FV_CAP_RATE_ABOVE_THRESHOLD:        'FV-02',
  FV_DEBT_YIELD_BELOW_THRESHOLD:      'FV-03',
  FV_DSCR_BELOW_THRESHOLD:            'FV-04',
  FV_EQUITY_MULTIPLE_BELOW_MIN:       'FV-05',
  FV_EQUITY_MULTIPLE_ABOVE_MAX:       'FV-06',
  FV_IRR_PROJECTED_BELOW_THRESHOLD:   'FV-07',
  FV_IRR_PROJECTED_ABOVE_THRESHOLD:   'FV-08',
  FV_LTV_ABOVE_THRESHOLD:             'FV-09',
  FV_OPEX_BELOW_MIN:                  'FV-10',
  FV_OPEX_ABOVE_MAX:                  'FV-11',
  FV_RENT_GROWTH_ABOVE_MAX:           'FV-12',
  FV_VACANCY_BELOW_MIN:               'FV-13',
  FV_VACANCY_ABOVE_MAX:               'FV-14',
});

/** Resolve a legacy `FV_*` string to its `FV-NN` form. Returns the input if no mapping exists. */
function fvCode(legacy: string): { code: string; legacy_code: string } {
  const mapped = FV_CODE_MAP[legacy];
  return mapped ? { code: mapped, legacy_code: legacy } : { code: legacy, legacy_code: legacy };
}

// ─── Stage completeness requirements (spec §5.1) ──────────────────────────────

/**
 * A stage's readiness contract. `required_sections` is the legacy section
 * list; `required_field_paths` enforces field-level presence (used by the
 * `scope` stage); `required_one_of` enforces "at least one of these paths
 * must resolve" (also `scope`-only today).
 *
 * Paths are dot-notated relative to a section's content root, prefixed with
 * the section ID (e.g. `property.asking_price`, `property.units`).
 */
export interface StageRequirement {
  required_sections: string[];
  required_field_paths?: string[];
  required_one_of?: string[][];
}

export const STAGE_REQUIREMENTS: Record<DealStage, StageRequirement> = {
  scope: {
    required_sections: ['property'],
    required_field_paths: ['property.address', 'property.asset_class'],
    required_one_of: [['property.asking_price', 'property.units']],
  },
  screening:        { required_sections: ['property', 'debt_structure', 'validation'] },
  term_sheet:       { required_sections: ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing'] },
  // `operating_statement` re-joined full_underwrite and above with RFC 0028
  // (spec §5.1 always listed it; the variant-aware `hasSection` case below
  // was built for it but no stage list reached it — decision (a) in the RFC).
  full_underwrite:  { required_sections: ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'operating_statement', 'noi_model', 'valuation', 'sources_uses', 'market_analysis'] },
  credit_approval:  { required_sections: ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'operating_statement', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions'] },
  closing:          { required_sections: ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'operating_statement', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions', 'due_diligence'] },
  monitoring:       { required_sections: ['property', 'debt_structure', 'validation', 'rent_roll', 'borrower_sponsor', 'preliminary_sizing', 'operating_statement', 'noi_model', 'valuation', 'sources_uses', 'market_analysis', 'dcf', 'stress_tests', 'risk_assessment', 'compliance', 'assumptions', 'due_diligence'] },
};

/**
 * Legacy helper that returns just the section-list portion of a stage's
 * requirements. Preserved for callers that pre-date the widened
 * `StageRequirement` shape; new code SHOULD consult `STAGE_REQUIREMENTS`
 * directly (or `requiredSectionsFor` when the asset class is known).
 */
export function getRequiredSections(stage: DealStage): readonly string[] {
  return STAGE_REQUIREMENTS[stage].required_sections;
}

/**
 * Per-class adjustments to the base stage lists (format spec §5.1 class
 * overlays, RFC 0029). Exhaustive by design: only `land` and `mixed_use`
 * diverge structurally — every other class reuses the base sections with
 * class-appropriate payloads (hospitality's `rent_roll` carries
 * keys/ADR/segmentation), so reuse needs no entry here.
 *
 * `exempt` removes a requirement outright; `substitute` replaces it with
 * another section that is then *required* in its place.
 */
export const STAGE_SECTION_OVERLAYS: Partial<Record<AssetClass, {
  exempt?: readonly string[];
  substitute?: Readonly<Record<string, string>>;
}>> = {
  land:      { exempt: ['rent_roll', 'operating_statement'] },
  mixed_use: { substitute: { rent_roll: 'components', operating_statement: 'components' } },
};

/**
 * The sections a declared stage requires of a document of the given asset
 * class: the base list with the class overlay applied. A substitute that
 * replaces more than one section appears once. An unrecognized class — or
 * none — takes the base list verbatim. Both consumers of stage completeness
 * (`stage_readiness` and `DQ-06`) resolve through this one function, so the
 * booleans and the issues stream can never disagree about what a stage
 * requires.
 */
export function requiredSectionsFor(stage: DealStage, assetClass?: string): readonly string[] {
  const base = STAGE_REQUIREMENTS[stage].required_sections;
  const overlay = assetClass ? STAGE_SECTION_OVERLAYS[assetClass as AssetClass] : undefined;
  if (!overlay) return base;
  const out: string[] = [];
  for (const section of base) {
    if (overlay.exempt?.includes(section)) continue;
    const replacement = overlay.substitute?.[section] ?? section;
    if (!out.includes(replacement)) out.push(replacement);
  }
  return out;
}

/**
 * Resolve a dot-notated path of the form `<section>.<field>...` against
 * the parsed file's content blocks. Returns `undefined` when any segment
 * is missing. Variant maps are not traversed; multi-variant sections must
 * use a section-only check.
 */
function resolveSectionFieldPath(parsed: ParsedUWFile, path: string): unknown {
  const dot = path.indexOf('.');
  const sectionId = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);
  const block = parsed.sections[sectionId];
  if (!block || isVariantMap(block)) return undefined;
  const content = (block as UWBlock).content;
  if (rest === '') return content;
  return deepGet(content, rest);
}

// ─── Main validate function ───────────────────────────────────────────────────

export function validateUWFile(
  parsed: ParsedUWFile,
  thresholdOverrides?: Partial<FinancialThresholds>,
): ValidationResult {
  const thresholds: FinancialThresholds = { ...DEFAULT_THRESHOLDS, ...thresholdOverrides };
  const issues: ValidationMessage[] = [];

  checkFinancialValidity(parsed, thresholds, issues);
  checkCrossSectionConsistency(parsed, issues);
  checkComponents(parsed, issues);
  checkCapitalStack(parsed, issues);
  checkLeaseUpSchedule(parsed, issues);
  checkSizeIntensive(parsed, issues);
  checkSectionReadiness(parsed, issues);
  checkLocale(parsed, issues);
  checkAssetClassIdentifier(parsed, issues);
  checkMetaIntegrity(parsed, issues);
  checkSourceVocabulary(parsed, issues);
  checkScopeReadiness(parsed, issues);
  checkDataQuality(parsed, issues);

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
        const legacy = `FV_${check.metric.toUpperCase()}_${rule.direction.toUpperCase()}_THRESHOLD`;
        issues.push({
          ...fvCode(legacy),
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
        issues.push({ ...fvCode('FV_VACANCY_BELOW_MIN'), severity: 'warning', section: 'noi_model', field: 'vacancy_rate', message: `Vacancy rate ${(vacancyRate * 100).toFixed(1)}% is unusually low (below ${(t.vacancy_rate.warning_below * 100).toFixed(0)}%)`, value: vacancyRate, threshold: { min: t.vacancy_rate.warning_below } });
      }
      if (vacancyRate > t.vacancy_rate.warning_above) {
        issues.push({ ...fvCode('FV_VACANCY_ABOVE_MAX'), severity: 'warning', section: 'noi_model', field: 'vacancy_rate', message: `Vacancy rate ${(vacancyRate * 100).toFixed(1)}% is unusually high (above ${(t.vacancy_rate.warning_above * 100).toFixed(0)}%)`, value: vacancyRate, threshold: { max: t.vacancy_rate.warning_above } });
      }
    }

    if (egi != null && opex != null && egi > 0) {
      const opexRatio = opex / egi;
      if (opexRatio < t.opex_ratio.warning_below) {
        issues.push({ ...fvCode('FV_OPEX_BELOW_MIN'), severity: 'warning', section: 'noi_model', field: 'total_operating_expenses', message: `OpEx ratio ${(opexRatio * 100).toFixed(1)}% of EGI is suspiciously low (below ${(t.opex_ratio.warning_below * 100).toFixed(0)}%)`, value: opexRatio, threshold: { min: t.opex_ratio.warning_below } });
      }
      if (opexRatio > t.opex_ratio.warning_above) {
        issues.push({ ...fvCode('FV_OPEX_ABOVE_MAX'), severity: 'warning', section: 'noi_model', field: 'total_operating_expenses', message: `OpEx ratio ${(opexRatio * 100).toFixed(1)}% of EGI is unusually high (above ${(t.opex_ratio.warning_above * 100).toFixed(0)}%)`, value: opexRatio, threshold: { max: t.opex_ratio.warning_above } });
      }
    }
  }

  // Annual rent growth from dcf assumptions
  const dcfBlock = getSection(parsed, 'dcf');
  if (dcfBlock) {
    const rentGrowth = deepGet(dcfBlock.content, 'assumptions.annual_rent_growth') as number | undefined
      ?? deepGet(dcfBlock.content, 'rent_growth_assumption') as number | undefined;
    if (rentGrowth != null && rentGrowth > t.annual_rent_growth.warning_above) {
      issues.push({ ...fvCode('FV_RENT_GROWTH_ABOVE_MAX'), severity: 'warning', section: 'dcf', field: 'annual_rent_growth', message: `Annual rent growth assumption ${(rentGrowth * 100).toFixed(1)}% is above the ${(t.annual_rent_growth.warning_above * 100).toFixed(0)}% warning threshold`, value: rentGrowth, threshold: { max: t.annual_rent_growth.warning_above } });
    }

    const equityMultiple = deepGet(dcfBlock.content, 'levered_equity_multiple') as number | undefined
      ?? deepGet(dcfBlock.content, 'summary.equity_multiple') as number | undefined;
    if (equityMultiple != null) {
      if (equityMultiple < t.equity_multiple.warning_below) {
        issues.push({ ...fvCode('FV_EQUITY_MULTIPLE_BELOW_MIN'), severity: 'warning', section: 'dcf', field: 'equity_multiple', message: `Equity multiple ${equityMultiple.toFixed(2)}x is below ${t.equity_multiple.warning_below}x warning threshold`, value: equityMultiple, threshold: { min: t.equity_multiple.warning_below } });
      }
      if (equityMultiple > t.equity_multiple.warning_above) {
        issues.push({ ...fvCode('FV_EQUITY_MULTIPLE_ABOVE_MAX'), severity: 'warning', section: 'dcf', field: 'equity_multiple', message: `Equity multiple ${equityMultiple.toFixed(2)}x is above ${t.equity_multiple.warning_above}x warning threshold`, value: equityMultiple, threshold: { max: t.equity_multiple.warning_above } });
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
        issues.push({ code: 'CC-01', severity: 'warning', section: 'rent_roll', field: 'gross_potential_rent', message: `CC-01: Rent roll GPR ($${rrGPR.toLocaleString()}) differs from Operating Statement GPR ($${osGPR.toLocaleString()}) by ${(pctDiff * 100).toFixed(1)}% (threshold: 3%)`, value: pctDiff });
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
        issues.push({ code: 'CC-02', severity: 'warning', section: 'debt_structure', field: 'ltv', message: `CC-02: Implied LTV (${(impliedLTV * 100).toFixed(2)}%) from loan/value does not match stated LTV (${(ltvInDebt * 100).toFixed(2)}%) — check valuation.underwritten_value vs debt_structure.ltv`, value: diff });
      }
    }
  }

  // CC-03: the senior loan reconciles across sources_uses, debt_structure, and
  // (when present) the capital_stack senior_debt tranche — one senior view stated
  // once and agreeing everywhere (RFC 0026 §4.24).
  {
    const suLoan = (deepGet(sourcesUses?.content ?? {}, 'sources.loan_amount') as number | undefined)
      ?? (deepGet(sourcesUses?.content ?? {}, 'sources.debt_proceeds') as number | undefined);
    const dsLoan = deepGet(debtStructure?.content ?? {}, 'loan_amount') as number | undefined;
    if (sourcesUses && debtStructure && suLoan != null && dsLoan != null && Math.abs(suLoan - dsLoan) > 100) {
      issues.push({ code: 'CC-03', severity: 'error', section: 'sources_uses', field: 'sources.loan_amount', message: `CC-03: Loan amount in Sources & Uses ($${suLoan.toLocaleString()}) does not match Debt Structure loan amount ($${dsLoan.toLocaleString()})`, value: Math.abs(suLoan - dsLoan) });
    }

    const senior = seniorDebtTranche(parsed);
    if (senior) {
      const seniorAmount = typeof senior['amount'] === 'number' ? senior['amount'] : undefined;
      const reference = dsLoan ?? suLoan;
      if (seniorAmount != null && reference != null && Math.abs(seniorAmount - reference) > 100) {
        issues.push({ code: 'CC-03', severity: 'error', section: 'capital_stack', field: 'tranches.senior_debt.amount', message: `CC-03: the capital_stack senior_debt tranche ($${seniorAmount.toLocaleString()}) does not match the senior loan amount ($${reference.toLocaleString()})`, value: Math.abs(seniorAmount - reference) });
      }
    }
  }

  // CC-04: Sources must equal uses in sources_uses (within $1)
  if (sourcesUses) {
    const totalSources = deepGet(sourcesUses.content, 'total_sources') as number | undefined;
    const totalUses = deepGet(sourcesUses.content, 'total_uses') as number | undefined;
    if (totalSources != null && totalUses != null && Math.abs(totalSources - totalUses) > 1) {
      issues.push({ code: 'CC-04', severity: 'error', section: 'sources_uses', field: 'total_sources', message: `CC-04: Sources ($${totalSources.toLocaleString()}) do not equal Uses ($${totalUses.toLocaleString()}) — difference: $${Math.abs(totalSources - totalUses).toLocaleString()}`, value: Math.abs(totalSources - totalUses) });
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
        issues.push({ code: 'CC-05', severity: 'warning', section: 'debt_structure', field: 'underwritten_noi', message: `CC-05: NOI used for DSCR ($${debtNOI.toLocaleString()}) differs from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}% (threshold: 1%)`, value: pctDiff });
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
        issues.push({ code: 'CC-06', severity: 'warning', section: 'dcf', field: 'annual_cash_flows[0].noi', message: `CC-06: DCF Year 1 NOI ($${dcfY1NOI.toLocaleString()}) deviates from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}%`, value: pctDiff });
      }
    }
  }

  // CC-07: Exit cap rate in dcf must be consistent with stress test cap rate scenarios
  if (dcf && stressTests) {
    const dcfExitCap = deepGet(dcf.content, 'assumptions.exit_cap_rate') as number | undefined
      ?? deepGet(dcf.content, 'exit_cap_rate') as number | undefined;
    const stressExitCap = deepGet(stressTests.content, 'base_case.exit_cap_rate') as number | undefined;
    if (dcfExitCap != null && stressExitCap != null && Math.abs(dcfExitCap - stressExitCap) > 0.005) {
      issues.push({ code: 'CC-07', severity: 'warning', section: 'stress_tests', field: 'base_case.exit_cap_rate', message: `CC-07: Exit cap rate in DCF (${(dcfExitCap * 100).toFixed(2)}%) differs from stress test base case (${(stressExitCap * 100).toFixed(2)}%)`, value: Math.abs(dcfExitCap - stressExitCap) });
    }
  }

  // CC-08: Appraised value in due_diligence must match valuation.appraised_value
  if (dueDiligence && valuation) {
    const ddAppraisedVal = deepGet(dueDiligence.content, 'appraisal.appraised_value') as number | undefined;
    const valAppraisedVal = deepGet(valuation.content, 'appraised_value') as number | undefined;
    if (ddAppraisedVal != null && valAppraisedVal != null && Math.abs(ddAppraisedVal - valAppraisedVal) > 1000) {
      issues.push({ code: 'CC-08', severity: 'warning', section: 'due_diligence', field: 'appraisal.appraised_value', message: `CC-08: Appraised value in due_diligence ($${ddAppraisedVal.toLocaleString()}) does not match valuation.appraised_value ($${valAppraisedVal.toLocaleString()})`, value: Math.abs(ddAppraisedVal - valAppraisedVal) });
    }
  }

  // CC-09: Annual debt service in stress_tests base case must match debt_structure.annual_debt_service
  if (stressTests && debtStructure) {
    const stressADS = deepGet(stressTests.content, 'base_case.annual_debt_service') as number | undefined;
    const debtADS = deepGet(debtStructure.content, 'annual_debt_service') as number | undefined;
    if (stressADS != null && debtADS != null && Math.abs(stressADS - debtADS) > 500) {
      issues.push({ code: 'CC-09', severity: 'warning', section: 'stress_tests', field: 'base_case.annual_debt_service', message: `CC-09: Annual debt service in stress test base case ($${stressADS.toLocaleString()}) differs from debt_structure ($${debtADS.toLocaleString()}) by $${Math.abs(stressADS - debtADS).toLocaleString()}`, value: Math.abs(stressADS - debtADS) });
    }
  }

  // CC-10: Purchase price in sources_uses.uses must match valuation.purchase_price
  if (sourcesUses && valuation) {
    const suPP = deepGet(sourcesUses.content, 'uses.purchase_price') as number | undefined;
    const valPP = deepGet(valuation.content, 'purchase_price') as number | undefined;
    if (suPP != null && valPP != null && Math.abs(suPP - valPP) > 100) {
      issues.push({ code: 'CC-10', severity: 'error', section: 'sources_uses', field: 'uses.purchase_price', message: `CC-10: Purchase price in Sources & Uses ($${suPP.toLocaleString()}) does not match valuation.purchase_price ($${valPP.toLocaleString()})`, value: Math.abs(suPP - valPP) });
    }
  }
}

// ─── §4.23 Mixed-use components (RFC 0019) ───────────────────────────────────

// The eight income classes admissible as a mixed-use component. `land` is
// excluded (its NOI model nets negative) and `mixed_use` cannot nest in itself.
const ADMISSIBLE_COMPONENT_CLASSES: ReadonlySet<string> = new Set([
  'multifamily', 'retail', 'office', 'industrial', 'self_storage',
  'hospitality', 'senior_housing', 'student_housing',
]);

// Validates the `components` section: the CC-11 asset-class gate, the CC-12
// footing check (property NOI == Σ component NOI), and the section-internal
// MU-* rules. A no-op for any document without a components section.
function checkComponents(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const components = getSection(parsed, 'components');
  if (!components) return;

  const assetClass = parsed.frontmatter.asset_class;

  // CC-11: a components section is only valid under asset_class mixed_use.
  if (assetClass !== 'mixed_use') {
    issues.push({
      code: 'CC-11', severity: 'error', section: 'components', field: 'asset_class',
      message: `CC-11: a components section is only valid when asset_class is mixed_use (found "${String(assetClass)}")`,
      value: assetClass,
    });
    return; // the mixed-use-specific rules below do not apply to a mis-typed doc
  }

  // Present components are every key that is not the _meta / _notes envelope.
  const entries = Object.entries(components.content).filter(([k]) => !k.startsWith('_'));
  const admissible = entries.filter(([k]) => ADMISSIBLE_COMPONENT_CLASSES.has(k));

  // MU-01: at least two admissible components.
  if (admissible.length < 2) {
    issues.push({
      code: 'MU-01', severity: 'error', section: 'components', field: 'components',
      message: `MU-01: a mixed-use property must declare at least two components (found ${admissible.length})`,
      value: admissible.length,
    });
  }

  const allocations: number[] = [];
  for (const [key, raw] of entries) {
    // MU-02: only the eight income classes are admissible; land and unknowns are not.
    if (!ADMISSIBLE_COMPONENT_CLASSES.has(key)) {
      issues.push({
        code: 'MU-02', severity: 'error', section: 'components', field: key,
        message: `MU-02: "${key}" is not an admissible component class (land and unknown classes are excluded)`,
        value: key,
      });
      continue;
    }
    const comp = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    // MU-03: the key must equal the entry's component_class.
    if (comp['component_class'] !== key) {
      issues.push({
        code: 'MU-03', severity: 'error', section: 'components', field: `${key}.component_class`,
        message: `MU-03: component "${key}" must declare component_class "${key}" (found "${String(comp['component_class'])}")`,
        value: comp['component_class'],
      });
    }

    // MU-04: a present component must state net_operating_income, never zero-by-omission.
    const noi = comp['net_operating_income'];
    if (noi === undefined || noi === null) {
      issues.push({
        code: 'MU-04', severity: 'error', section: 'components', field: `${key}.net_operating_income`,
        message: `MU-04: present component "${key}" omits net_operating_income; a present use with no NOI is an incomplete document, not zero income`,
      });
    }

    // MU-06: a component must not carry its own debt_structure. Component
    // financing is a component-level capital_stack (§4.24, RFC 0026), which
    // checkCapitalStack accepts and validates with the CS-* rules.
    if (comp['debt_structure'] !== undefined) {
      issues.push({
        code: 'MU-06', severity: 'error', section: 'components', field: `${key}.debt_structure`,
        message: `MU-06: component "${key}" carries its own debt_structure; express component-level financing as a component capital_stack (§4.24, RFC 0026) instead`,
      });
    }

    const alloc = comp['allocation_pct'];
    if (typeof alloc === 'number') allocations.push(alloc);
  }

  // MU-05: when allocation is used at all, it must sum to 1.0 across present components.
  if (allocations.length > 0) {
    const sum = allocations.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.0001) {
      issues.push({
        code: 'MU-05', severity: 'error', section: 'components', field: 'allocation_pct',
        message: `MU-05: allocation_pct across components must sum to 1.0 within 0.0001 (found ${sum})`,
        value: sum,
      });
    }
  }

  // CC-12: property NOI must equal the sum of component NOIs. Only assert footing
  // when every admissible component states a numeric NOI — a missing one is
  // MU-04's job, not a footing mismatch.
  const noiModel = getSection(parsed, 'noi_model');
  if (noiModel) {
    const propNOI = deepGet(noiModel.content, 'net_operating_income') as number | undefined;
    const compNOIs = admissible
      .map(([, raw]) =>
        raw && typeof raw === 'object'
          ? (raw as Record<string, unknown>)['net_operating_income']
          : undefined,
      )
      .filter((v): v is number => typeof v === 'number');
    if (propNOI != null && admissible.length > 0 && compNOIs.length === admissible.length) {
      const sum = compNOIs.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - propNOI) > 1) {
        issues.push({
          code: 'CC-12', severity: 'error', section: 'noi_model', field: 'net_operating_income',
          message: `CC-12: property NOI ($${propNOI.toLocaleString()}) must equal the sum of component NOIs ($${sum.toLocaleString()})`,
          value: Math.abs(sum - propNOI),
        });
      }
    }
  }
}

// ─── Capital stack checks (RFC 0026 §4.24) ────────────────────────────────────

const TRANCHE_CLASSES: ReadonlySet<string> = new Set([
  'senior_debt', 'mezzanine_debt', 'preferred_equity', 'common_equity',
  'bridge', 'seller_financing', 'other_debt',
]);
// Classes that MUST state a rate (a debt coupon or the preferred return).
const RATE_BEARING_CLASSES: ReadonlySet<string> = new Set([
  'senior_debt', 'mezzanine_debt', 'preferred_equity', 'bridge', 'seller_financing', 'other_debt',
]);
// Section- or tranche-level keys that would encode a distribution waterfall,
// which is out of scope for this version (RFC 0026 §E).
const WATERFALL_MARKERS = [
  'waterfall', 'distribution_waterfall', 'distributions', 'distribution_tiers',
  'tiers', 'promote', 'hurdle', 'hurdles', 'catch_up', 'carried_interest',
];

/** The capital_stack `senior_debt` tranche, if the section and tranche exist. */
function seniorDebtTranche(parsed: ParsedUWFile): Record<string, unknown> | null {
  const cs = getSection(parsed, 'capital_stack');
  if (!cs) return null;
  const tranches = (cs.content as Record<string, unknown>)['tranches'];
  if (!Array.isArray(tranches)) return null;
  const senior = tranches.find(
    (t) => t && typeof t === 'object' && (t as Record<string, unknown>)['class'] === 'senior_debt',
  );
  return senior && typeof senior === 'object' ? (senior as Record<string, unknown>) : null;
}

// Validates one capital-stack payload's structure: CS-01 (well-formed, unique
// tranches), CS-02 (a rate where the class requires one and none where it does
// not), and CS-WATERFALL-UNSUPPORTED (the deferred distribution waterfall is
// refused). The senior-loan reconciliation is CC-03 and applies only to the
// top-level section (a component stack has no property-level debt_structure to
// reconcile with). The stated sizing figures are recomputed by
// `verifyCapitalStack` (capital-stack.ts), not here. `section` and `prefix`
// aim the issue fields: '' for the top-level section, `<key>.capital_stack.`
// for a mixed-use component's own stack (§4.23, RFC 0026 compatibility).
function checkStackContent(
  content: Record<string, unknown>,
  section: string,
  prefix: string,
  issues: ValidationMessage[],
): void {
  // CS-WATERFALL-UNSUPPORTED: a distribution waterfall at the stack level.
  for (const key of Object.keys(content)) {
    if (WATERFALL_MARKERS.includes(key)) {
      issues.push({
        code: 'CS-WATERFALL-UNSUPPORTED', severity: 'error', section, field: `${prefix}${key}`,
        message: `CS-WATERFALL-UNSUPPORTED: the distribution waterfall ("${key}") is out of scope for this version; model it in x_partnership_structure until a later phase adds it (RFC 0026 §E)`,
      });
    }
  }

  const tranches = Array.isArray(content['tranches']) ? content['tranches'] : [];
  const seenIds = new Set<string>();
  const seenPositions = new Set<number>();

  for (let i = 0; i < tranches.length; i++) {
    const raw = tranches[i];
    const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const id = t['id'];
    const cls = t['class'];
    const position = t['position'];
    const amount = t['amount'];
    const label = typeof id === 'string' && id ? id : `tranches[${i}]`;

    // CS-01: structural — id, class, position, amount present and well-typed; id and position unique.
    if (typeof id !== 'string' || id.length === 0) {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.id`, message: `CS-01: tranche ${label} must state a non-empty string id` });
    } else if (seenIds.has(id)) {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.id`, message: `CS-01: duplicate tranche id "${id}"; ids must be unique within the stack` });
    } else {
      seenIds.add(id);
    }
    if (typeof cls !== 'string' || !TRANCHE_CLASSES.has(cls)) {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.class`, message: `CS-01: tranche ${label} has an invalid class "${String(cls)}"` });
    }
    if (typeof position !== 'number' || !Number.isInteger(position)) {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.position`, message: `CS-01: tranche ${label} must state an integer position` });
    } else if (seenPositions.has(position)) {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.position`, message: `CS-01: duplicate position ${position}; positions must be unique within the stack` });
    } else {
      seenPositions.add(position);
    }
    if (typeof amount !== 'number') {
      issues.push({ code: 'CS-01', severity: 'error', section, field: `${prefix}${label}.amount`, message: `CS-01: tranche ${label} must state a numeric amount` });
    }

    // CS-02: a rate where the class requires one, and none on common equity.
    const hasRate = t['rate'] !== undefined && t['rate'] !== null;
    if (typeof cls === 'string') {
      if (RATE_BEARING_CLASSES.has(cls) && !hasRate) {
        issues.push({ code: 'CS-02', severity: 'error', section, field: `${prefix}${label}.rate`, message: `CS-02: tranche ${label} (${cls}) must state a rate` });
      }
      if (cls === 'common_equity' && hasRate) {
        issues.push({ code: 'CS-02', severity: 'error', section, field: `${prefix}${label}.rate`, message: `CS-02: common_equity tranche ${label} must not state a rate` });
      }
    }

    // A waterfall smuggled in at the tranche level (promote/hurdle/catch-up).
    for (const key of Object.keys(t)) {
      if (WATERFALL_MARKERS.includes(key)) {
        issues.push({ code: 'CS-WATERFALL-UNSUPPORTED', severity: 'error', section, field: `${prefix}${label}.${key}`, message: `CS-WATERFALL-UNSUPPORTED: tranche ${label} carries waterfall field "${key}"; distributions are out of scope for this version (RFC 0026 §E)` });
      }
    }
  }
}

// The top-level capital_stack section, plus any mixed-use component's own
// stack (§4.23: a component MAY carry a capital_stack; its bare debt_structure
// stays refused as MU-06). A no-op for documents carrying neither.
// ─── §5.3 CC-13 — the primary size field (RFC 0027) ──────────────────────────

// CC-13 warns when the property section omits the class's primary size field
// (Protocol §XIII.1) — always a warning, never an error: a screening-stage
// deal legitimately does not know its RSF yet, and an institution wanting a
// hard gate has INCOMPLETE_DATA_POLICIES. The five applicability
// preconditions are normative (§5.3): each guards against the rule judging a
// document whose missing size is some *other* rule's diagnosis.
function checkSizeIntensive(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  // 1. UWX record, not a compiled UW Lite summary — Lite states size in its
  //    own grammar, and its compiled envelope carries the x_uw_lite_source
  //    extension (surfaced under `extensions` by fromUWEnvelope, under
  //    `sections` by a re-parse of the serialized UWX).
  if (parsed.sections[UW_LITE_SOURCE_EXTENSION] || parsed.extensions?.[UW_LITE_SOURCE_EXTENSION]) return;

  // 2. Deal-record profile only. An absent profile is the plain underwriting
  //    record; any other declared profile has no property section by design.
  const profile = (parsed.frontmatter as Record<string, unknown>)['document_profile'];
  if (profile != null && profile !== DEAL_UNDERWRITING_PROFILE) return;

  // 3. Recognized class with a primary size field (not mixed_use, §XIII.2;
  //    not an unrecognized class, §XIII.3).
  const assetClass = parsed.frontmatter.asset_class;
  if (typeof assetClass !== 'string') return;
  const intensive = getSizeIntensive(assetClass);
  if (!intensive) return;

  // 4. A property section exists — a missing section is a different defect
  //    with a different remedy (RFC 0027, unresolved question 5).
  const property =
    getSection(parsed, 'property') ?? getSectionVariant(parsed, 'property', 'default');
  if (!property) return;

  // 5. Not externalized (RFC 0021) — the directive is not the section.
  //    Presence of the key is the whole test, as in the Lite projection.
  if (
    EXTERNAL_ANNOTATION_KEY in (property.annotation as Record<string, unknown>) ||
    EXTERNAL_ANNOTATION_KEY in property.content
  ) return;

  // §VIII.2's unwrap rule, exactly as the calc evaluator applies it: a block
  // storing the envelope shape keeps its payload one level down at `content`.
  // CC-13 judges the payload the pack divides by — never the wrapper.
  const payload =
    'content' in property.content
      ? (property.content as Record<string, unknown>)['content']
      : property.content;
  const value = deepGet(payload, intensive.path);
  if (typeof value === 'number' && Number.isFinite(value)) return;

  issues.push({
    code: 'CC-13', severity: 'warning', section: 'property', field: intensive.path,
    message: `CC-13: the property section does not state ${assetClass}'s primary size field "${intensive.path}" (Protocol §XIII.1)`,
    value: value ?? null,
  });
}

// ─── §5.3 CC-14 / §III.6a DQ-06 — section-level readiness (RFC 0028) ─────────

// CC-14 warns when a deal-record UWX document has no property section at all
// — §4.1 requires it at every stage, and before this rule the only trace of
// the gap was a stage_readiness boolean nothing downstream reads. Always a
// warning, never an error: the RFC 0028 Appendix A scan found 28 corpus
// documents a refusal would invalidate retroactively, and an institution
// wanting a hard gate has INCOMPLETE_DATA_POLICIES.
//
// DQ-06 then names, at info severity, each section the declared deal_stage
// requires but the file lacks — the sectional sibling of the field-level
// DQ-04, and the issues-stream mirror of stage_readiness. Info because the
// same scan shows deal_stage declarations state where a deal is going, not
// what the file contains (all twelve worked examples fail their declared
// stage's list); info reports the gap without refusing or nagging.
function checkSectionReadiness(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  // CC-14 preconditions mirror CC-13's 1 and 2 (RFC 0028 §1). Precondition 3
  // (not externalized) is satisfied structurally: an externalized-but-
  // unresolved section still parses as a block, so it is present here.
  const isCompiledLite =
    !!(parsed.sections[UW_LITE_SOURCE_EXTENSION] || parsed.extensions?.[UW_LITE_SOURCE_EXTENSION]);
  const profile = (parsed.frontmatter as Record<string, unknown>)['document_profile'];
  const isDealRecord = profile == null || profile === DEAL_UNDERWRITING_PROFILE;

  const hasProperty = hasStageSection(parsed, 'property');
  let cc14Fired = false;
  if (!isCompiledLite && isDealRecord && !hasProperty) {
    cc14Fired = true;
    issues.push({
      code: 'CC-14', severity: 'warning', section: 'property',
      message: 'CC-14: this deal record has no property section; §4.1 requires it at every stage',
    });
  }

  // DQ-06: one issue per missing required section of the declared stage.
  // No stage declared → no claim to check (same posture as DQ-04). The
  // property entry is suppressed when CC-14 fired: one defect, one diagnostic.
  const stage = parsed.frontmatter.deal_stage;
  if (!stage || !(stage in STAGE_REQUIREMENTS)) return;
  for (const sectionId of requiredSectionsFor(stage, parsed.frontmatter.asset_class)) {
    if (sectionId === 'property' && cc14Fired) continue;
    if (hasStageSection(parsed, sectionId)) continue;
    issues.push({
      code: 'DQ-06', severity: 'info', section: sectionId,
      message: `DQ-06: ${stage} requires ${sectionId}; section is missing.`,
    });
  }
}

function checkCapitalStack(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const cs = getSection(parsed, 'capital_stack');
  if (cs) checkStackContent(cs.content as Record<string, unknown>, 'capital_stack', '', issues);

  const comps = getSection(parsed, 'components');
  if (!comps) return;
  for (const [key, raw] of Object.entries(comps.content as Record<string, unknown>)) {
    if (key.startsWith('_') || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const stack = (raw as Record<string, unknown>)['capital_stack'];
    if (stack && typeof stack === 'object' && !Array.isArray(stack)) {
      checkStackContent(stack as Record<string, unknown>, 'components', `${key}.capital_stack.`, issues);
    }
  }
}

// ─── Lease-up schedule (RFC 0008, §4.25) ─────────────────────────────────────
//
// Structural rules only: the period grammar, monotonicity, and presence checks
// are validation; the arithmetic over stated figures belongs to
// `verifyLeaseUpSchedule` (lease-up.ts). The section is multi-variant, so every
// variant is checked structurally — a downside scenario with a gapped schedule
// is just as malformed as a base one. CC-15 reads only the base variant: a
// downside scenario is *supposed* to disagree with stabilized NOI.

function checkLeaseUpContent(
  content: Record<string, unknown>,
  variant: string,
  issues: ValidationMessage[],
): void {
  const section = 'lease_up_schedule';
  const label = variant === 'default' ? '' : ` (variant "${variant}")`;
  const granRaw = content['period_granularity'];
  const granularity: LeaseUpGranularity =
    granRaw === 'monthly' || granRaw === 'quarterly' ? granRaw : 'quarterly';
  if (granRaw !== 'monthly' && granRaw !== 'quarterly') {
    issues.push({
      code: 'LU-01', severity: 'error', section, field: 'period_granularity',
      message: `LU-01: period_granularity${label} must be "monthly" or "quarterly", not ${JSON.stringify(granRaw)}`,
    });
  }

  const schedule = content['schedule'];
  const rows = Array.isArray(schedule) ? schedule : [];
  if (!Array.isArray(schedule) || rows.length === 0) {
    issues.push({
      code: 'LU-03', severity: 'error', section, field: 'schedule',
      message: `LU-03: schedule${label} must be a non-empty array of periods`,
    });
    return;
  }

  // LU-01 (grammar) / LU-02 (strictly increasing, gap-free). One diagnostic
  // per defect: a row outside the grammar is not also reported as a gap.
  let prev: number | null = null;
  let grammarBroken = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const period = row && typeof row === 'object' ? (row as Record<string, unknown>)['period'] : undefined;
    const ordinal = typeof period === 'string' ? leaseUpPeriodOrdinal(period, granularity) : null;
    if (ordinal === null) {
      grammarBroken = true;
      issues.push({
        code: 'LU-01', severity: 'error', section, field: `schedule[${i}].period`,
        message: `LU-01: period ${JSON.stringify(period)}${label} is outside the ${granularity} grammar (${granularity === 'quarterly' ? 'YYYY-Qn' : 'YYYY-MM'})`,
      });
      prev = null;
      continue;
    }
    if (prev !== null && ordinal !== prev + 1) {
      issues.push({
        code: 'LU-02', severity: 'error', section, field: `schedule[${i}].period`,
        message: `LU-02: periods${label} must be strictly increasing and gap-free; ${String(period)} does not immediately follow the prior period`,
      });
    }
    prev = ordinal;
  }

  // LU-03 (second arm): a stabilization_target earlier than the first period.
  const target = content['stabilization_target'];
  if (!grammarBroken && typeof target === 'string') {
    const first = (rows[0] as Record<string, unknown>)['period'];
    const targetOrd = leaseUpPeriodOrdinal(target, granularity);
    const firstOrd = typeof first === 'string' ? leaseUpPeriodOrdinal(first, granularity) : null;
    if (targetOrd !== null && firstOrd !== null && targetOrd < firstOrd) {
      issues.push({
        code: 'LU-03', severity: 'error', section, field: 'stabilization_target',
        message: `LU-03: stabilization_target ${target}${label} is earlier than the first schedule period ${String(first)}`,
      });
    }
  }
}

function checkLeaseUpSchedule(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const entry = parsed.sections['lease_up_schedule'];
  if (!entry) return;
  const variants: Array<[string, UWBlock]> = isVariantMap(entry)
    ? Object.entries(entry as Record<string, UWBlock>)
    : [['default', entry as UWBlock]];

  let turnoverPresent = false;
  for (const [variant, block] of variants) {
    const content = block.content as Record<string, unknown>;
    checkLeaseUpContent(content, variant, issues);
    if (content['model_type'] === 'natural_turnover') turnoverPresent = true;
  }

  // LU-04: natural turnover with no rent_roll — a warning, not a refusal,
  // because a compose-time fragment may carry the schedule without the roll.
  if (turnoverPresent && !parsed.sections['rent_roll']) {
    issues.push({
      code: 'LU-04', severity: 'warning', section: 'lease_up_schedule', field: 'model_type',
      message: 'LU-04: model_type natural_turnover with no rent_roll in the document; the turnover trajectory has no stated starting point',
    });
  }

  // CC-15: the base variant's stated stabilized NOI agrees with noi_model
  // within LEASE_UP_STABILIZED_TOLERANCE. Tolerance-checked, not exact: the
  // trajectory endpoint and the stabilized-year projection are two different
  // models of stabilization (RFC 0008).
  const base = isVariantMap(entry)
    ? ((entry as Record<string, UWBlock>)['base'] ?? (entry as Record<string, UWBlock>)['default'])
    : (entry as UWBlock);
  const stabilizedNoi = base
    ? deepGet(base.content as Record<string, unknown>, 'stabilized_summary.annualized_noi')
    : undefined;
  const modelNoi = deepGet(getSection(parsed, 'noi_model')?.content, 'net_operating_income');
  if (
    typeof stabilizedNoi === 'number' && Number.isFinite(stabilizedNoi) &&
    typeof modelNoi === 'number' && Number.isFinite(modelNoi) && modelNoi !== 0
  ) {
    const drift = Math.abs(stabilizedNoi - modelNoi) / Math.abs(modelNoi);
    if (drift > LEASE_UP_STABILIZED_TOLERANCE) {
      issues.push({
        code: 'CC-15', severity: 'warning', section: 'lease_up_schedule', field: 'stabilized_summary.annualized_noi',
        message: `CC-15: the lease-up stabilized NOI ($${stabilizedNoi.toLocaleString()}) is ${(drift * 100).toFixed(1)}% away from noi_model.net_operating_income ($${modelNoi.toLocaleString()}), beyond the ${LEASE_UP_STABILIZED_TOLERANCE * 100}% tolerance`,
        value: drift,
      });
    }
  }
}

// ─── Display locale (RFC 0001) ───────────────────────────────────────────────
//
// LOC-01 gates DISPLAY renders only: a file declaring a locale this
// implementation does not support still parses, validates, edits, and calcs
// — the content is canonical and locale-free. The reference implementation
// supports the whole first wave, so its own LOC-01 fires only on
// unregistered tags; a narrower implementation checks against its manifest's
// `supported_locales`.

function checkLocale(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const declared = parsed.frontmatter.locale;
  if (declared == null) return; // absent = en-US
  if (isSupportedLocale(declared)) return;
  issues.push({
    code: 'LOC-01', severity: 'error', field: 'locale',
    message: `LOC-01: locale ${JSON.stringify(declared)} is not a registered display locale; display renders are refused rather than silently produced in a different locale`,
    value: String(declared),
  });
}

// ─── Asset-class identifier (RFC 0003) ───────────────────────────────────────

/**
 * The identifier itself, independent of whether any module is loaded.
 *
 * Deliberately separate from *resolution*: whether a custom class can be read
 * depends on the host's loaded modules, and a validator that conflated the two
 * would report the same file as valid or invalid depending on who ran it.
 * What is checked here is the part that is true everywhere — the syntax, and
 * the obligation a namespaced class carries to name its modules.
 */
function checkAssetClassIdentifier(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const raw = parsed.frontmatter?.asset_class;
  if (typeof raw !== 'string' || raw.length === 0) return;

  const identity = parseAssetClass(raw);
  if (!identity.ok) {
    issues.push({
      code: identity.error.code,
      severity: 'error',
      field: 'asset_class',
      message: identity.error.message,
      value: raw,
      ...(identity.error.remediation ? { remediation: identity.error.remediation } : {}),
    });
    return;
  }
  if (identity.kind === 'builtin') return;

  // A namespaced class with no `modules` list is unreadable by anyone who does
  // not already happen to hold the right module: the file states a dependency
  // it never names. Reported as a warning rather than an error because the
  // document is still well-formed and a host that does hold the module reads
  // it correctly — the cost falls on everyone else.
  if (declaredModuleDependencies(parsed.frontmatter as Record<string, unknown>).length === 0) {
    issues.push({
      code: 'MOD-DEPENDENCY-UNDECLARED',
      severity: 'warning',
      field: 'modules',
      message: `asset_class '${raw}' is module-declared, but frontmatter names no 'modules' to load.`,
      value: raw,
      remediation: `Add a 'modules' list naming the module that declares '${raw}', so a reader without it can say what to load rather than only that something is missing.`,
    });
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

      // `confidence` and `human_review_required` are orthogonal (spec §3.5):
      // confidence is a quality estimate; human_review_required is a workflow
      // gate. The combination "low confidence + no review flag" is a common
      // smell — drafts often forget to flag — but it is not normatively wrong.
      // This emission is therefore informational only; do not promote it to a
      // warning without changing the spec.
      if (block.meta.confidence === 'low' && !block.meta.human_review_required) {
        issues.push({ code: 'META_LOW_CONFIDENCE_NO_REVIEW_FLAG', severity: 'info', section: sectionId, message: `Section ${sectionId} has low confidence but human_review_required is not set to true` });
      }
    }
  }
}

// ─── SRC-01 / SRC-02: source vocabulary (RFC 0031) ───────────────────────────
//
// `_meta.source` is actor-only: `manual` or `<namespace>/<id>` with a
// registered namespace. SRC-02 fires when the field holds a canonical
// SOURCE_TAGS value — a resolution method in the actor field, the pre-split
// spelling, read-time-interpreted as `resolution` (warning through format
// 1.x, error at 2.0). SRC-01 fires on everything else outside the grammar
// (colon forms, bare words). Both are warnings: every such block still
// parses, and edits against it resolve the conservative catch-all policy.

const NON_MANUAL_SOURCE_TAGS: ReadonlySet<string> = new Set(
  SOURCE_TAGS.filter((t) => t !== 'manual'),
);

function checkSourceVocabulary(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const blocks = isVariantMap(entry)
      ? Object.values(entry as Record<string, UWBlock>)
      : [entry as UWBlock];

    for (const block of blocks) {
      const src = block.meta?.source;
      if (typeof src !== 'string' || src.length === 0) continue; // absence is META/DQ territory

      if (NON_MANUAL_SOURCE_TAGS.has(src)) {
        issues.push({
          code: 'SRC-02',
          severity: 'warning',
          section: sectionId,
          message: `Section ${sectionId} _meta.source is '${src}', a resolution tag in the actor field. Move it to _meta.resolution; readers treat the actor as absent.`,
        });
        continue;
      }

      if (parseActorSource(src).kind === 'invalid') {
        issues.push({
          code: 'SRC-01',
          severity: 'warning',
          section: sectionId,
          message: `Section ${sectionId} _meta.source '${src}' is not 'manual' or '<namespace>/<id>' with a registered actor namespace (${['agent', 'document', 'system', 'institution'].join(', ')}).`,
        });
      }
    }
  }
}

// ─── Stage readiness ──────────────────────────────────────────────────────────

/**
 * Variant-aware section presence, as stage readiness defines it: a
 * multi-variant `operating_statement` counts through its `t12` or `default`
 * variant. Shared by `computeStageReadiness` and the RFC 0028 checks
 * (`CC-14`, `DQ-06`) so "present" means one thing.
 */
function hasStageSection(parsed: ParsedUWFile, id: string): boolean {
  if (id === 'operating_statement') {
    return !!(parsed.sections[id] || getSectionVariant(parsed, id, 't12') || getSectionVariant(parsed, id, 'default'));
  }
  return !!parsed.sections[id];
}

function computeStageReadiness(parsed: ParsedUWFile): StageReadiness {
  const hasSection = (id: string): boolean => hasStageSection(parsed, id);

  const hasFieldPath = (path: string): boolean => {
    const v = resolveSectionFieldPath(parsed, path);
    return v !== undefined && v !== null && v !== '';
  };

  const stageReady = (stage: DealStage): boolean => {
    const req = STAGE_REQUIREMENTS[stage];
    // Class overlays (RFC 0029): resolve through the same function DQ-06
    // uses, so readiness and the issues stream cannot disagree.
    const requiredSections = requiredSectionsFor(stage, parsed.frontmatter.asset_class);
    if (!requiredSections.every(s => hasSection(s))) return false;
    if (req.required_field_paths && !req.required_field_paths.every(hasFieldPath)) return false;
    if (req.required_one_of && !req.required_one_of.every(group => group.some(hasFieldPath))) return false;
    return true;
  };

  return {
    scope:           stageReady('scope'),
    screening:       stageReady('screening'),
    term_sheet:      stageReady('term_sheet'),
    full_underwrite: stageReady('full_underwrite'),
    credit_approval: stageReady('credit_approval'),
    closing:         stageReady('closing'),
    monitoring:      stageReady('monitoring'),
  };
}

// ─── DQ-04: scope-stage readiness ────────────────────────────────────────────
//
// Emitted when a file declares `deal_stage: scope` (or has no stage and is
// being checked against scope-readiness) and one of the scope-required
// fields is missing. Field-level rather than section-level so the message
// can name the exact path. Sectional gaps are still reported via
// stage_readiness.

function checkScopeReadiness(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  if (parsed.frontmatter.deal_stage !== 'scope') return;
  const req = STAGE_REQUIREMENTS.scope;
  const missing = (path: string): boolean => {
    const v = resolveSectionFieldPath(parsed, path);
    return v === undefined || v === null || v === '';
  };
  for (const path of req.required_field_paths ?? []) {
    if (missing(path)) {
      issues.push({
        code: 'DQ-04',
        severity: 'error',
        field: path,
        message: `Scope-stage readiness requires ${path}; field is missing.`,
      });
    }
  }
  for (const group of req.required_one_of ?? []) {
    if (group.every(missing)) {
      issues.push({
        code: 'DQ-04',
        severity: 'error',
        field: group.join('|'),
        message: `Scope-stage readiness requires at least one of: ${group.join(', ')}.`,
      });
    }
  }
}

function isVariantMap(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  return !('annotation' in (val as object));
}

// ─── DQ-01..03 / DQ-05: data quality checks ──────────────────────────────────
//
// DQ-01: provisional block not referenced from the gaps section
// DQ-02: provisional value consumed at a stage whose policy is `halt`
// DQ-03: partial block without field-level enumeration
// DQ-05: stale `gaps` item (last_checked older than threshold)

const DEFAULT_GAP_STALENESS_DAYS = 14;

interface DataQualityOptions {
  policies?: readonly IncompleteDataPolicy[];
  gap_staleness_days?: number;
  /** Override "now" for deterministic tests. */
  now?: string;
}

export function checkDataQuality(
  parsed: ParsedUWFile,
  issues: ValidationMessage[],
  opts: DataQualityOptions = {},
): void {
  const policies = opts.policies ?? BUILTIN_INCOMPLETE_DATA_POLICIES;
  const stage: DealStage = parsed.frontmatter.deal_stage ?? 'scope';
  const gaps = readGapsContent(parsed);
  const gapKeys = new Set<string>();
  if (gaps) {
    for (const item of gaps.items) {
      gapKeys.add(`${item.section}::`);
      if (item.field_path) gapKeys.add(`${item.section}::${item.field_path}`);
    }
  }

  // Walk every present section's _meta for provisional/partial flags
  for (const sectionId of Object.keys(parsed.sections)) {
    const entry = parsed.sections[sectionId];
    if (!entry) continue;
    const blocks: UWBlock[] = isVariantMap(entry)
      ? Object.values(entry as Record<string, UWBlock>)
      : [entry as UWBlock];

    for (const block of blocks) {
      const m = block.meta;

      // DQ-01: provisional block not in gaps
      if (m.provisional) {
        const referenced = gapKeys.has(`${sectionId}::`) ||
          // Any field-level gap counts as referencing the section
          [...gapKeys].some((k) => k.startsWith(`${sectionId}::`) && k !== `${sectionId}::`);
        if (!referenced) {
          issues.push({
            code: 'DQ-01',
            severity: 'warning',
            section: sectionId,
            message: `Block ${sectionId} is provisional but no gaps entry references it.`,
          });
        }

        // DQ-02: provisional value consumed at a `halt` stage
        const policy = lookupIncompleteDataPolicy(sectionId, undefined, stage, policies);
        if (policy?.action.kind === 'halt') {
          issues.push({
            code: 'DQ-02',
            severity: 'error',
            section: sectionId,
            message: `Provisional ${sectionId} cannot be consumed at stage '${stage}' (policy: halt).`,
          });
        }
      }

      // DQ-03: partial without enumeration
      if (m.partial && (!m.field_overrides || m.field_overrides.length === 0)) {
        issues.push({
          code: 'DQ-03',
          severity: 'warning',
          section: sectionId,
          message: `Block ${sectionId} is marked partial but has no field_overrides[] enumeration.`,
        });
      }

      // DQ-06: a promoted market observation that cannot be traced back to the
      // observation set it came from (RFC 0022 §4). An error, not a warning:
      // without the reference the `market_data_accepted` tag is an
      // unfalsifiable claim, and a reviewer can see that *something* was
      // accepted but never recover which observations, of which vintage. That
      // is precisely the gap the profile exists to close, so a block asserting
      // the tag without the reference is worse than one tagged plainly.
      const promotedTag = (o: { source?: string; resolution?: string }): boolean =>
        o.resolution === 'market_data_accepted' || o.source === 'market_data_accepted';
      const promoted = promotedTag(m) || m.field_overrides?.some(promotedTag);
      if (promoted && !m.market_data_ref) {
        issues.push({
          code: 'DQ-06',
          severity: 'error',
          section: sectionId,
          message: `Block ${sectionId} carries a market_data_accepted value but no _meta.market_data_ref naming the observation set, vintage, and digest it was promoted from.`,
        });
      }
    }
  }

  // DQ-05: stale gaps
  if (gaps) {
    const now = opts.now ? Date.parse(opts.now) : Date.now();
    const thresholdMs = (opts.gap_staleness_days ?? DEFAULT_GAP_STALENESS_DAYS) * 86_400_000;
    for (const item of gaps.items) {
      if (!item.last_checked) continue;
      const last = Date.parse(item.last_checked);
      if (Number.isNaN(last)) continue;
      if (now - last > thresholdMs) {
        issues.push({
          code: 'DQ-05',
          severity: 'info',
          section: item.section,
          field: item.field_path,
          message: `Gap last checked ${item.last_checked}; exceeds staleness threshold (${opts.gap_staleness_days ?? DEFAULT_GAP_STALENESS_DAYS}d).`,
        });
      }
    }
  }
}

// Re-export UWBlock for use in validator callers
type UWBlock = import('./types.js').UWBlock;
