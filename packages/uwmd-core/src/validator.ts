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
  CrossCheckCoverage, CrossCheckResolutionEvidence, CrossCheckSkipReason, ReturnTaxBasis,
} from './types.js';
import { DEFAULT_THRESHOLDS, SOURCE_TAGS } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { BUILTIN_REMEDIATIONS, BUILTIN_INCOMPLETE_DATA_POLICIES, lookupIncompleteDataPolicy, getSizeIntensive, DEAL_UNDERWRITING_PROFILE, parseActorSource, isSupportedLocale, isCurrencyCode, STAGE_REQUIREMENTS, requiredSectionsFor,
  CROSS_CHECK_RULE_IDS, RETURN_TAX_BASES, DEFAULT_RETURN_TAX_BASIS,
} from './protocol.js';
import { EXTERNAL_ANNOTATION_KEY } from './composition.js';
import { UW_LITE_SOURCE_EXTENSION } from './lite-bridge.js';
import type { IssueRemediation, IncompleteDataPolicy } from './protocol.js';
import { readGapsContent } from './gaps.js';
import { LEASE_UP_STABILIZED_TOLERANCE } from './lease-up.js';
import { checkLeaseUpContent } from './lease-up-structure.js';
import { CASH_FLOW_KINDS, CASH_FLOW_VERIFY_DECIMALS, quantizeAtDecimals } from './cash-flow-series.js';
import { isDayCountConvention, parseISODate } from './calc/day-count.js';
import type { WaterfallTier } from './waterfall.js';
import { parseAssetClass, declaredModuleDependencies } from './asset-class.js';
import { isV2File } from './meta-shape.js';
import { checkPeriodSeries } from './period-validation.js';
import { hasBlockRole, isBlockRole, resolveRoleBlock } from './block-roles.js';
import type { RoleResolution } from './block-roles.js';

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
// The tables moved to protocol.ts with the RFC 0009 STAGE_CONTRACT merge —
// requirements, class overlays, and incomplete-data policies are one contract
// now, derived into a single registry validators consult. Re-exported here so
// existing import sites (gaps.ts, tests) keep working.

export {
  STAGE_REQUIREMENTS,
  STAGE_SECTION_OVERLAYS,
  getRequiredSections,
  requiredSectionsFor,
} from './protocol.js';
export type { StageRequirement } from './protocol.js';

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

  const ledger = newCoverageLedger();

  checkFinancialValidity(parsed, thresholds, issues);
  checkCrossSectionConsistency(parsed, issues, ledger);
  checkComponents(parsed, issues, ledger);
  checkCapitalStack(parsed, issues);
  checkLeaseUpSchedule(parsed, issues, ledger);
  checkCashFlowSeries(parsed, issues);
  checkWaterfall(parsed, issues);
  checkSizeIntensive(parsed, issues, ledger);
  checkSectionReadiness(parsed, issues, ledger);
  checkReturnsTaxBasis(parsed, issues);
  checkTaxBasis(parsed, issues);
  checkLeaseClauses(parsed, issues);
  checkHedgesAndEscrows(parsed, issues);
  checkRenovationDraw(parsed, issues);
  checkLocale(parsed, issues);
  checkCurrencyIdentity(parsed, issues);
  checkAssetClassIdentifier(parsed, issues);
  checkMetaIntegrity(parsed, issues);
  checkMetaShape(parsed, issues);
  checkBlockRoles(parsed, issues);
  checkPeriodSeries(parsed, issues);
  checkSourceVocabulary(parsed, issues);
  checkScopeReadiness(parsed, issues);
  checkDataQuality(parsed, issues);

  // CC-16: one info issue per section that was present as a variant map no
  // cross-check could resolve (§5.3, RFC 0037). Emitted after every check has
  // run so the message can name every rule the map silenced.
  for (const [sectionId, entry] of ledger.unresolvable) {
    const codes = [...entry.codes].sort();
    issues.push({
      code: 'CC-16', severity: 'info', section: sectionId,
      ...(entry.detail ? { remediation: 'Resolve the reported role collision or declare an eligible property-level block; component blocks cannot serve as the property total.' } : {}),
      message: entry.detail ? `CC-16: ${sectionId}: ${entry.detail}; could not resolve for ${codes.join(', ')} (§5.3, RFC 0040)` : `CC-16: ${sectionId} is present as ${entry.variants.length} variants (${entry.variants.join(', ')}) and none is named default or base; ${codes.join(', ')} ${codes.length === 1 ? 'was' : 'were'} skipped — name a default variant or state the section once (§5.3, RFC 0037)`,
      value: entry.variants,
    });
  }
  // Every registered rule owes a coverage entry; a rule no check reached is
  // reported rather than silently missing.
  for (const code of CROSS_CHECK_RULE_IDS) {
    if (!ledger.coverage[code]) markSkipped(ledger, code, 'not_applicable', 'not reached');
  }

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
    coverage: orderedCoverage(ledger),
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

// ─── §5.3 cross-check resolution + coverage (RFC 0037) ───────────────────────
//
// A cross-check reads each section it names as ONE block. When the section is
// a variant map (§2.8, or any envelope section carrying several blocks), it is
// resolved by: the check's own preference → its role → primary → default
// → base → the sole eligible variant (RFC 0040). Anything else is UNRESOLVABLE: the check is skipped, the skip is
// recorded in coverage, and CC-16 names the section once. Never pick an
// arbitrary variant — two senior facilities have not said which reconciles.

type CrossCheckResolution = RoleResolution;

interface CoverageLedger {
  coverage: Record<string, CrossCheckCoverage>;
  unresolvable: Map<string, { variants: string[]; codes: Set<string>; detail?: string }>;
  resolutions: Record<string, Record<string, CrossCheckResolutionEvidence>>;
}

function newCoverageLedger(): CoverageLedger {
  return { coverage: {}, unresolvable: new Map(), resolutions: {} };
}

function markEvaluated(ledger: CoverageLedger, code: string): void {
  ledger.coverage[code] = { status: 'evaluated' };
}

function markSkipped(ledger: CoverageLedger, code: string, reason: CrossCheckSkipReason, detail?: string): void {
  if (ledger.coverage[code]?.status === 'evaluated') return;
  ledger.coverage[code] = { status: 'skipped', reason, ...(detail ? { detail } : {}) };
}

function noteUnresolvable(ledger: CoverageLedger, sectionId: string, variants: string[], code: string, detail?: string): void {
  const entry = ledger.unresolvable.get(sectionId) ?? { variants, codes: new Set<string>(), ...(detail ? { detail } : {}) };
  entry.codes.add(code);
  ledger.unresolvable.set(sectionId, entry);
}

/** Coverage in registered-rule order, so `--json` output is stable. */
function orderedCoverage(ledger: CoverageLedger): Record<string, CrossCheckCoverage> {
  const out: Record<string, CrossCheckCoverage> = {};
  for (const code of CROSS_CHECK_RULE_IDS) {
    const entry = ledger.coverage[code];
    if (entry) out[code] = { ...entry, ...(ledger.resolutions[code] ? { resolutions: ledger.resolutions[code] } : {}) };
  }
  return out;
}

function resolveCrossCheckSection(
  parsed: ParsedUWFile,
  sectionId: string,
  preferred: readonly string[] = [],
  code?: string,
  ledger?: CoverageLedger,
): CrossCheckResolution {
  const r = resolveRoleBlock(parsed.sections[sectionId], sectionId, preferred, code);
  if (r.state === 'resolved' && r.evidence && code && ledger) {
    ledger.resolutions[code] ??= {};
    ledger.resolutions[code]![sectionId] = r.evidence;
  }
  return r;
}

/** Preserve legacy direct-read behavior unless the section opts into roles. */
function roleAwareDirectRead(parsed: ParsedUWFile, sectionId: string, code?: string, ledger?: CoverageLedger): UWBlock | null {
  const entry = parsed.sections[sectionId];
  const blocks = !entry ? [] : isVariantMap(entry) ? Object.values(entry) : [entry];
  if (!blocks.some(hasBlockRole)) return getSection(parsed, sectionId);
  const r = resolveCrossCheckSection(parsed, sectionId, [], code, ledger);
  if (r.state === 'unresolvable' && code && ledger) {
    noteUnresolvable(ledger, sectionId, r.variants, code, r.detail);
    markSkipped(ledger, code, 'variant_unresolvable', sectionId);
  }
  return r.block;
}

function checkBlockRoles(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const check = (section: string, block: UWBlock): void => {
    if (hasBlockRole(block) && !isBlockRole(block.content['_role'])) issues.push({
      code: 'ROLE-01', severity: 'error', section, field: '_role',
      message: `ROLE-01: ${section}${block.annotation.variant ? ` variant=${block.annotation.variant}` : ''} must declare one valid scalar _role`,
      value: block.content['_role'],
    });
  };
  for (const [section, entry] of Object.entries(parsed.sections)) {
    for (const block of isVariantMap(entry) ? Object.values(entry) : [entry]) check(section, block);
  }
  for (const [section, block] of Object.entries(parsed.extensions)) check(section, block);
  for (const section of ['pipeline_log', 'custom_calculations', 'custom_scenarios'] as const) {
    for (const block of parsed[section]) check(section, block);
  }
}

/**
 * Resolve every section a rule reads. On any failure the rule's skip is
 * recorded (the first failure's reason wins; every unresolvable section is
 * noted for CC-16) and `null` is returned.
 */
function requireSections(
  ledger: CoverageLedger,
  parsed: ParsedUWFile,
  code: string,
  needs: ReadonlyArray<readonly [string] | readonly [string, readonly string[]]>,
): Record<string, { block: UWBlock; variant?: string }> | null {
  const out: Record<string, { block: UWBlock; variant?: string }> = {};
  let skip: { reason: CrossCheckSkipReason; detail: string } | null = null;
  for (const need of needs) {
    const sectionId = need[0];
    const preferred = need.length > 1 ? need[1] : [];
    const r = resolveCrossCheckSection(parsed, sectionId, preferred, code, ledger);
    if (r.state === 'resolved') {
      out[sectionId] = { block: r.block, ...(r.variant ? { variant: r.variant } : {}) };
      continue;
    }
    if (r.state === 'unresolvable') noteUnresolvable(ledger, sectionId, r.variants, code, r.detail);
    skip ??= { reason: r.state === 'absent' ? 'section_absent' : 'variant_unresolvable', detail: sectionId };
  }
  if (skip) {
    markSkipped(ledger, code, skip.reason, skip.detail);
    return null;
  }
  return out;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function checkCrossSectionConsistency(
  parsed: ParsedUWFile,
  issues: ValidationMessage[],
  ledger: CoverageLedger,
): void {
  // CC-01: Rent roll GPR must match OS GPR within 3%
  {
    const got = requireSections(ledger, parsed, 'CC-01', [['rent_roll'], ['operating_statement', ['t12']]]);
    if (got) {
      const rentRoll = got['rent_roll']!.block;
      const os = got['operating_statement']!.block;
      const rrGPR = num(deepGet(rentRoll.content, 'gross_potential_rent')) ?? num(deepGet(rentRoll.content, 'totals.gross_potential_rent'));
      const osGPR = num(deepGet(os.content, 'gross_potential_rent')) ?? num(deepGet(os.content, 'income.gross_potential_rent'));
      if (rrGPR == null) markSkipped(ledger, 'CC-01', 'field_absent', 'rent_roll.gross_potential_rent');
      else if (osGPR == null || osGPR === 0) markSkipped(ledger, 'CC-01', 'field_absent', 'operating_statement.gross_potential_rent');
      else {
        markEvaluated(ledger, 'CC-01');
        const pctDiff = Math.abs(rrGPR - osGPR) / osGPR;
        if (pctDiff > 0.03) {
          issues.push({ code: 'CC-01', severity: 'warning', section: 'rent_roll', field: 'gross_potential_rent', message: `CC-01: Rent roll GPR ($${rrGPR.toLocaleString()}) differs from Operating Statement GPR ($${osGPR.toLocaleString()}) by ${(pctDiff * 100).toFixed(1)}% (threshold: 3%)`, value: pctDiff });
        }
      }
    }
  }

  // CC-02: UW value in valuation must match LTV denominator in debt_structure
  {
    const got = requireSections(ledger, parsed, 'CC-02', [['valuation'], ['debt_structure']]);
    if (got) {
      const valuation = got['valuation']!.block;
      const debtStructure = got['debt_structure']!.block;
      const uwValue = num(deepGet(valuation.content, 'underwritten_value')) ?? num(deepGet(valuation.content, 'purchase_price'));
      const loanAmt = num(deepGet(debtStructure.content, 'loan_amount'));
      const ltvInDebt = num(deepGet(debtStructure.content, 'ltv'));
      if (uwValue == null || uwValue <= 0) markSkipped(ledger, 'CC-02', 'field_absent', 'valuation.underwritten_value');
      else if (loanAmt == null) markSkipped(ledger, 'CC-02', 'field_absent', 'debt_structure.loan_amount');
      else if (ltvInDebt == null) markSkipped(ledger, 'CC-02', 'field_absent', 'debt_structure.ltv');
      else {
        markEvaluated(ledger, 'CC-02');
        const impliedLTV = loanAmt / uwValue;
        const diff = Math.abs(impliedLTV - ltvInDebt);
        if (diff > 0.005) {
          issues.push({ code: 'CC-02', severity: 'warning', section: 'debt_structure', field: 'ltv', message: `CC-02: Implied LTV (${(impliedLTV * 100).toFixed(2)}%) from loan/value does not match stated LTV (${(ltvInDebt * 100).toFixed(2)}%) — check valuation.underwritten_value vs debt_structure.ltv`, value: diff });
        }
      }
    }
  }

  // CC-03: the senior loan reconciles across sources_uses, debt_structure, and
  // (when present) the capital_stack senior_debt tranche — one senior view stated
  // once and agreeing everywhere (RFC 0026 §4.24). Two legs; the rule is
  // evaluated when either leg compared.
  {
    const su = resolveCrossCheckSection(parsed, 'sources_uses', [], 'CC-03', ledger);
    const ds = resolveCrossCheckSection(parsed, 'debt_structure', [], 'CC-03', ledger);
    if (su.state === 'unresolvable') noteUnresolvable(ledger, 'sources_uses', su.variants, 'CC-03', su.detail);
    if (ds.state === 'unresolvable') noteUnresolvable(ledger, 'debt_structure', ds.variants, 'CC-03', ds.detail);
    const suLoan = su.block ? (num(deepGet(su.block.content, 'sources.loan_amount')) ?? num(deepGet(su.block.content, 'sources.debt_proceeds'))) : undefined;
    const dsLoan = ds.block ? num(deepGet(ds.block.content, 'loan_amount')) : undefined;
    let evaluated = false;
    if (suLoan != null && dsLoan != null) {
      evaluated = true;
      if (Math.abs(suLoan - dsLoan) > 100) {
        issues.push({ code: 'CC-03', severity: 'error', section: 'sources_uses', field: 'sources.loan_amount', message: `CC-03: Loan amount in Sources & Uses ($${suLoan.toLocaleString()}) does not match Debt Structure loan amount ($${dsLoan.toLocaleString()})`, value: Math.abs(suLoan - dsLoan) });
      }
    }

    const senior = seniorDebtTranche(parsed, ledger);
    if (senior) {
      const seniorAmount = num(senior['amount']);
      const reference = dsLoan ?? suLoan;
      if (seniorAmount != null && reference != null) {
        evaluated = true;
        if (Math.abs(seniorAmount - reference) > 100) {
          issues.push({ code: 'CC-03', severity: 'error', section: 'capital_stack', field: 'tranches.senior_debt.amount', message: `CC-03: the capital_stack senior_debt tranche ($${seniorAmount.toLocaleString()}) does not match the senior loan amount ($${reference.toLocaleString()})`, value: Math.abs(seniorAmount - reference) });
        }
      }
    }

    if (evaluated) markEvaluated(ledger, 'CC-03');
    else if (su.state === 'unresolvable') markSkipped(ledger, 'CC-03', 'variant_unresolvable', 'sources_uses');
    else if (ds.state === 'unresolvable') markSkipped(ledger, 'CC-03', 'variant_unresolvable', 'debt_structure');
    else if (ledger.coverage['CC-03']?.reason === 'variant_unresolvable') { /* A role-bearing capital stack could not resolve. */ }
    else if (su.state === 'absent') markSkipped(ledger, 'CC-03', 'section_absent', 'sources_uses');
    else if (ds.state === 'absent') markSkipped(ledger, 'CC-03', 'section_absent', 'debt_structure');
    else markSkipped(ledger, 'CC-03', 'field_absent', suLoan == null ? 'sources_uses.sources.loan_amount' : 'debt_structure.loan_amount');
  }

  // CC-04: Sources must equal uses in sources_uses (within $1)
  {
    const got = requireSections(ledger, parsed, 'CC-04', [['sources_uses']]);
    if (got) {
      const sourcesUses = got['sources_uses']!.block;
      const totalSources = num(deepGet(sourcesUses.content, 'total_sources'));
      const totalUses = num(deepGet(sourcesUses.content, 'total_uses'));
      if (totalSources == null) markSkipped(ledger, 'CC-04', 'field_absent', 'sources_uses.total_sources');
      else if (totalUses == null) markSkipped(ledger, 'CC-04', 'field_absent', 'sources_uses.total_uses');
      else {
        markEvaluated(ledger, 'CC-04');
        if (Math.abs(totalSources - totalUses) > 1) {
          issues.push({ code: 'CC-04', severity: 'error', section: 'sources_uses', field: 'total_sources', message: `CC-04: Sources ($${totalSources.toLocaleString()}) do not equal Uses ($${totalUses.toLocaleString()}) — difference: $${Math.abs(totalSources - totalUses).toLocaleString()}`, value: Math.abs(totalSources - totalUses) });
        }
      }
    }
  }

  // CC-05: NOI used for DSCR must match noi_model.net_operating_income within 1%
  {
    const got = requireSections(ledger, parsed, 'CC-05', [['noi_model'], ['debt_structure']]);
    if (got) {
      const noiModel = got['noi_model']!.block;
      const debtStructure = got['debt_structure']!.block;
      const modelNOI = num(deepGet(noiModel.content, 'net_operating_income'));
      const debtNOI = num(deepGet(debtStructure.content, 'underwritten_noi')) ?? num(deepGet(debtStructure.content, 'noi_used_for_dscr'));
      if (modelNOI == null || modelNOI <= 0) markSkipped(ledger, 'CC-05', 'field_absent', 'noi_model.net_operating_income');
      else if (debtNOI == null) markSkipped(ledger, 'CC-05', 'field_absent', 'debt_structure.underwritten_noi');
      else {
        markEvaluated(ledger, 'CC-05');
        const pctDiff = Math.abs(modelNOI - debtNOI) / modelNOI;
        if (pctDiff > 0.01) {
          issues.push({ code: 'CC-05', severity: 'warning', section: 'debt_structure', field: 'underwritten_noi', message: `CC-05: NOI used for DSCR ($${debtNOI.toLocaleString()}) differs from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}% (threshold: 1%)`, value: pctDiff });
        }
      }
    }
  }

  // CC-06: DCF Year 1 NOI must be consistent with noi_model projections
  {
    const got = requireSections(ledger, parsed, 'CC-06', [['noi_model'], ['dcf']]);
    if (got) {
      const noiModel = got['noi_model']!.block;
      const dcf = got['dcf']!.block;
      const modelNOI = num(deepGet(noiModel.content, 'net_operating_income'));
      const dcfY1NOI = num(deepGet(dcf.content, 'annual_cash_flows[0].noi')) ?? num(deepGet(dcf.content, 'annual_cash_flows[0].net_operating_income'));
      if (modelNOI == null || modelNOI <= 0) markSkipped(ledger, 'CC-06', 'field_absent', 'noi_model.net_operating_income');
      else if (dcfY1NOI == null) markSkipped(ledger, 'CC-06', 'field_absent', 'dcf.annual_cash_flows[0].net_operating_income');
      else {
        markEvaluated(ledger, 'CC-06');
        const pctDiff = Math.abs(modelNOI - dcfY1NOI) / modelNOI;
        if (pctDiff > 0.02) {
          issues.push({ code: 'CC-06', severity: 'warning', section: 'dcf', field: 'annual_cash_flows[0].noi', message: `CC-06: DCF Year 1 NOI ($${dcfY1NOI.toLocaleString()}) deviates from noi_model NOI ($${modelNOI.toLocaleString()}) by ${(pctDiff * 100).toFixed(2)}%`, value: pctDiff });
        }
      }
    }
  }

  // CC-07: Exit cap rate in dcf must be consistent with stress test cap rate scenarios
  {
    const got = requireSections(ledger, parsed, 'CC-07', [['dcf'], ['stress_tests']]);
    if (got) {
      const dcf = got['dcf']!.block;
      const stressTests = got['stress_tests']!.block;
      const dcfExitCap = num(deepGet(dcf.content, 'assumptions.exit_cap_rate')) ?? num(deepGet(dcf.content, 'exit_cap_rate'));
      const stressExitCap = num(deepGet(stressTests.content, 'base_case.exit_cap_rate'));
      if (dcfExitCap == null) markSkipped(ledger, 'CC-07', 'field_absent', 'dcf.assumptions.exit_cap_rate');
      else if (stressExitCap == null) markSkipped(ledger, 'CC-07', 'field_absent', 'stress_tests.base_case.exit_cap_rate');
      else {
        markEvaluated(ledger, 'CC-07');
        if (Math.abs(dcfExitCap - stressExitCap) > 0.005) {
          issues.push({ code: 'CC-07', severity: 'warning', section: 'stress_tests', field: 'base_case.exit_cap_rate', message: `CC-07: Exit cap rate in DCF (${(dcfExitCap * 100).toFixed(2)}%) differs from stress test base case (${(stressExitCap * 100).toFixed(2)}%)`, value: Math.abs(dcfExitCap - stressExitCap) });
        }
      }
    }
  }

  // CC-08: Appraised value in due_diligence must match valuation.appraised_value.
  // due_diligence's variants are sub-documents (§2.8), so the `appraisal`
  // variant is preferred and, when it is the resolved block, the value may
  // sit at its root rather than under an `appraisal` key.
  {
    const got = requireSections(ledger, parsed, 'CC-08', [['due_diligence', ['appraisal']], ['valuation']]);
    if (got) {
      const dd = got['due_diligence']!;
      const valuation = got['valuation']!.block;
      const ddAppraisedVal = num(deepGet(dd.block.content, 'appraisal.appraised_value'))
        ?? (dd.variant === 'appraisal' ? num(deepGet(dd.block.content, 'appraised_value')) : undefined);
      const valAppraisedVal = num(deepGet(valuation.content, 'appraised_value'));
      if (ddAppraisedVal == null) markSkipped(ledger, 'CC-08', 'field_absent', 'due_diligence.appraisal.appraised_value');
      else if (valAppraisedVal == null) markSkipped(ledger, 'CC-08', 'field_absent', 'valuation.appraised_value');
      else {
        markEvaluated(ledger, 'CC-08');
        if (Math.abs(ddAppraisedVal - valAppraisedVal) > 1000) {
          issues.push({ code: 'CC-08', severity: 'warning', section: 'due_diligence', field: 'appraisal.appraised_value', message: `CC-08: Appraised value in due_diligence ($${ddAppraisedVal.toLocaleString()}) does not match valuation.appraised_value ($${valAppraisedVal.toLocaleString()})`, value: Math.abs(ddAppraisedVal - valAppraisedVal) });
        }
      }
    }
  }

  // CC-09: Annual debt service in stress_tests base case must match debt_structure.annual_debt_service
  {
    const got = requireSections(ledger, parsed, 'CC-09', [['stress_tests'], ['debt_structure']]);
    if (got) {
      const stressTests = got['stress_tests']!.block;
      const debtStructure = got['debt_structure']!.block;
      const stressADS = num(deepGet(stressTests.content, 'base_case.annual_debt_service'));
      const debtADS = num(deepGet(debtStructure.content, 'annual_debt_service'));
      if (stressADS == null) markSkipped(ledger, 'CC-09', 'field_absent', 'stress_tests.base_case.annual_debt_service');
      else if (debtADS == null) markSkipped(ledger, 'CC-09', 'field_absent', 'debt_structure.annual_debt_service');
      else {
        markEvaluated(ledger, 'CC-09');
        if (Math.abs(stressADS - debtADS) > 500) {
          issues.push({ code: 'CC-09', severity: 'warning', section: 'stress_tests', field: 'base_case.annual_debt_service', message: `CC-09: Annual debt service in stress test base case ($${stressADS.toLocaleString()}) differs from debt_structure ($${debtADS.toLocaleString()}) by $${Math.abs(stressADS - debtADS).toLocaleString()}`, value: Math.abs(stressADS - debtADS) });
        }
      }
    }
  }

  // CC-10: Purchase price in sources_uses.uses must match valuation.purchase_price
  {
    const got = requireSections(ledger, parsed, 'CC-10', [['sources_uses'], ['valuation']]);
    if (got) {
      const sourcesUses = got['sources_uses']!.block;
      const valuation = got['valuation']!.block;
      const suPP = num(deepGet(sourcesUses.content, 'uses.purchase_price'));
      const valPP = num(deepGet(valuation.content, 'purchase_price'));
      if (suPP == null) markSkipped(ledger, 'CC-10', 'field_absent', 'sources_uses.uses.purchase_price');
      else if (valPP == null) markSkipped(ledger, 'CC-10', 'field_absent', 'valuation.purchase_price');
      else {
        markEvaluated(ledger, 'CC-10');
        if (Math.abs(suPP - valPP) > 100) {
          issues.push({ code: 'CC-10', severity: 'error', section: 'sources_uses', field: 'uses.purchase_price', message: `CC-10: Purchase price in Sources & Uses ($${suPP.toLocaleString()}) does not match valuation.purchase_price ($${valPP.toLocaleString()})`, value: Math.abs(suPP - valPP) });
        }
      }
    }
  }
}

// ─── §4.9 dcf.returns.tax_basis (RFC 0038) ───────────────────────────────────

/**
 * The tax basis every metric in `dcf.returns` is stated on: the declared
 * `returns.tax_basis` when it is a registered value, else the spec default
 * (`pre_tax`). Consumers comparing return metrics across documents call this
 * rather than re-deriving the default.
 */
export function getReturnTaxBasis(parsed: ParsedUWFile): ReturnTaxBasis {
  const dcf = resolveCrossCheckSection(parsed, 'dcf').block;
  const v = dcf ? deepGet(dcf.content, 'returns.tax_basis') : undefined;
  return typeof v === 'string' && (RETURN_TAX_BASES as readonly string[]).includes(v)
    ? (v as ReturnTaxBasis)
    : DEFAULT_RETURN_TAX_BASIS;
}

// RT-01: a stated tax_basis outside the closed set. Absent (or null) means
// the default and is not an issue.
function checkReturnsTaxBasis(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const dcf = resolveCrossCheckSection(parsed, 'dcf').block;
  if (!dcf) return;
  const v = deepGet(dcf.content, 'returns.tax_basis');
  if (v === undefined || v === null) return;
  if (typeof v === 'string' && (RETURN_TAX_BASES as readonly string[]).includes(v)) return;
  issues.push({
    code: 'RT-01', severity: 'error', section: 'dcf', field: 'returns.tax_basis',
    message: `RT-01: dcf.returns.tax_basis must be one of ${RETURN_TAX_BASES.join(', ')} (found ${JSON.stringify(v)}); omit it to mean ${DEFAULT_RETURN_TAX_BASIS} (format §4.9, RFC 0038)`,
    value: v,
  });
}

// ─── §4.5 / §4.9 Tax abatements and reassessment basis (RFC 0053) ────────────
//
// Every rule here checks a figure the author stated. Nothing is derived, no
// jurisdiction rules are inferred, and the exit-value/terminal-tax circularity
// is left to the author — the calc engine has no iteration and this adds none.
// Quantize with the §VIII.5 helper the cash-flow verifier exports rather than
// keeping a second copy of the rounding rule.

/** What caused the reassessment; `none` means none applies. */
export const REASSESSMENT_TRIGGERS = Object.freeze([
  'sale', 'construction_completion', 'statutory_cycle', 'none',
] as const);

export const TAX_ABATEMENT_KINDS = Object.freeze([
  'exemption', 'freeze', 'pilot', 'phase_in', 'credit',
] as const);

const TAX_PATH = 'expenses.real_estate_taxes';
const CURRENCY_DP = CASH_FLOW_VERIFY_DECIMALS.currency;

function taxIssue(
  issues: ValidationMessage[], code: string, section: string, field: string, message: string, value?: unknown,
): void {
  issues.push({ code, severity: 'error', section, field, message, ...(value !== undefined ? { value } : {}) });
}

const finiteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sameMoney = (a: number, b: number) =>
  quantizeAtDecimals(a, CURRENCY_DP) === quantizeAtDecimals(b, CURRENCY_DP);

/**
 * The shape shared by the `noi_model` reassessment and the `dcf` terminal tax.
 * Returns the quantum the stated expense must be rounded at, or null when the
 * object is too malformed to check any further.
 */
function checkReassessment(
  r: Record<string, unknown>, issues: ValidationMessage[], section: string, base: string,
): number | null {
  const trigger = r['trigger'];
  if (typeof trigger !== 'string' || !(REASSESSMENT_TRIGGERS as readonly string[]).includes(trigger)) {
    taxIssue(issues, 'TAX-01', section, `${base}.trigger`,
      `TAX-01: reassessment.trigger must be one of ${REASSESSMENT_TRIGGERS.join(', ')}`, trigger);
    return null;
  }
  const assessed = r['assessed_value'];
  const millage = r['millage_rate'];
  const indicated = r['indicated_tax'];
  let ok = true;
  for (const [key, v] of [['assessed_value', assessed], ['millage_rate', millage], ['indicated_tax', indicated]] as const) {
    if (!finiteNum(v)) {
      taxIssue(issues, 'TAX-01', section, `${base}.${key}`, `TAX-01: reassessment.${key} must be a finite number`, v);
      ok = false;
    }
  }
  if (!ok) return null;

  // TAX-01: the assessed value follows from the basis and ratio when both are stated.
  const basis = r['value_basis'];
  const ratio = r['assessment_ratio'];
  if (basis !== undefined || ratio !== undefined) {
    if (!finiteNum(basis) || !finiteNum(ratio)) {
      taxIssue(issues, 'TAX-01', section, `${base}.assessment_ratio`,
        'TAX-01: value_basis and assessment_ratio are stated together or not at all');
    } else if (!sameMoney(basis * ratio, assessed as number)) {
      taxIssue(issues, 'TAX-01', section, `${base}.assessed_value`,
        `TAX-01: assessed_value ${assessed} must equal value_basis x assessment_ratio (${quantizeAtDecimals(basis * ratio, CURRENCY_DP)})`,
        assessed);
    }
  }

  // TAX-02: the indicated tax follows from the assessed value and the millage.
  if (!sameMoney(indicated as number, (assessed as number) * (millage as number))) {
    taxIssue(issues, 'TAX-02', section, `${base}.indicated_tax`,
      `TAX-02: indicated_tax ${indicated} must equal assessed_value x millage_rate (${quantizeAtDecimals((assessed as number) * (millage as number), CURRENCY_DP)})`,
      indicated);
  }

  const round = r['round_to_decimals'];
  if (round !== undefined && !Number.isSafeInteger(round)) {
    taxIssue(issues, 'TAX-03', section, `${base}.round_to_decimals`,
      'TAX-03: round_to_decimals must be an integer; it may be negative to round to a magnitude', round);
    return null;
  }
  return round === undefined ? CURRENCY_DP : (round as number);
}

function checkAbatement(
  a: Record<string, unknown>, issues: ValidationMessage[], section: string, base: string, stated: unknown,
): void {
  const kind = a['kind'];
  if (typeof kind !== 'string' || !(TAX_ABATEMENT_KINDS as readonly string[]).includes(kind)) {
    taxIssue(issues, 'TAX-06', section, `${base}.kind`,
      `TAX-06: abatement.kind must be one of ${TAX_ABATEMENT_KINDS.join(', ')}`, kind);
    return;
  }
  const schedule = a['schedule'];
  if (!Array.isArray(schedule) || schedule.length === 0) {
    taxIssue(issues, 'TAX-05', section, `${base}.schedule`, 'TAX-05: abatement.schedule must be a nonempty array');
    return;
  }
  const periods: string[] = [];
  let shapeOk = true;
  for (const [i, row] of schedule.entries()) {
    const at = `${base}.schedule[${i}]`;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      taxIssue(issues, 'TAX-05', section, at, 'TAX-05: each schedule entry must be an object');
      shapeOk = false;
      continue;
    }
    const e = row as Record<string, unknown>;
    const period = e['period'];
    if (typeof period !== 'string' || taxPeriodKind(period) === null) {
      taxIssue(issues, 'TAX-05', section, `${at}.period`,
        'TAX-05: period must be an RFC 0041 selector (Y1+, YYYY-Qn, YYYY-MM, or YYYY-MM-DD)', period);
      shapeOk = false;
      continue;
    }
    periods.push(period);
    const full = e['full_tax'];
    const abated = e['abated_tax'];
    if (!finiteNum(full) || !finiteNum(abated)) {
      taxIssue(issues, 'TAX-06', section, at, 'TAX-06: full_tax and abated_tax must both be finite numbers');
      shapeOk = false;
      continue;
    }
    if (abated < 0 || full < 0) {
      taxIssue(issues, 'TAX-06', section, at, 'TAX-06: full_tax and abated_tax must be nonnegative', abated);
    } else if (abated > full) {
      taxIssue(issues, 'TAX-06', section, `${at}.abated_tax`,
        `TAX-06: abated_tax ${abated} cannot exceed full_tax ${full}`, abated);
    }
  }
  if (!shapeOk) return;

  // TAX-05: one granularity, strictly increasing, no duplicates.
  const kinds = new Set(periods.map(p => taxPeriodKind(p)!));
  if (kinds.size > 1) {
    taxIssue(issues, 'TAX-05', section, `${base}.schedule`,
      `TAX-05: an abatement schedule uses one period granularity (found ${[...kinds].sort().join(', ')})`);
    return;
  }
  for (let i = 1; i < periods.length; i++) {
    if (periods[i - 1]!.localeCompare(periods[i]!, 'en', { numeric: true }) >= 0) {
      taxIssue(issues, 'TAX-05', section, `${base}.schedule[${i}].period`,
        `TAX-05: schedule periods must strictly increase (${periods[i - 1]} then ${periods[i]})`, periods[i]);
      return;
    }
  }

  // TAX-06: a freeze holds the unabated tax nondecreasing across the schedule.
  if (kind === 'freeze') {
    for (let i = 1; i < schedule.length; i++) {
      const prev = (schedule[i - 1] as Record<string, unknown>)['full_tax'] as number;
      const cur = (schedule[i] as Record<string, unknown>)['full_tax'] as number;
      if (cur < prev) {
        taxIssue(issues, 'TAX-06', section, `${base}.schedule[${i}].full_tax`,
          `TAX-06: a freeze holds full_tax nondecreasing (${prev} then ${cur})`, cur);
        return;
      }
    }
  }

  // TAX-07: the stabilized snapshot ties to one named period of the schedule.
  const stabilized = a['stabilized_period'];
  if (stabilized === undefined) return;
  if (typeof stabilized !== 'string') {
    taxIssue(issues, 'TAX-07', section, `${base}.stabilized_period`,
      'TAX-07: stabilized_period must be a period selector naming a schedule entry', stabilized);
    return;
  }
  const at = periods.indexOf(stabilized);
  if (at === -1) {
    taxIssue(issues, 'TAX-07', section, `${base}.stabilized_period`,
      `TAX-07: stabilized_period ${stabilized} does not name a period in the schedule`, stabilized);
    return;
  }
  if (!finiteNum(stated)) return;
  const abated = (schedule[at] as Record<string, unknown>)['abated_tax'] as number;
  if (!sameMoney(stated, abated)) {
    taxIssue(issues, 'TAX-07', section, `${TAX_PATH}.value`,
      `TAX-07: the stated tax ${stated} must equal the abated tax ${abated} for stabilized_period ${stabilized}`, stated);
  }
}

/** The RFC 0041 selector families, or null when the string is not one. */
function taxPeriodKind(p: string): 'holding_year' | 'quarter' | 'month' | 'date' | null {
  if (/^Y[1-9]\d*$/.test(p)) return 'holding_year';
  if (/^\d{4}-Q[1-4]$/.test(p)) return 'quarter';
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return 'month';
  if (/^\d{4}-\d{2}-\d{2}$/.test(p) && parseISODate(p)) return 'date';
  return null;
}

function checkTaxBasis(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const noi = resolveCrossCheckSection(parsed, 'noi_model').block;
  if (noi) {
    const tax = deepGet(noi.content, TAX_PATH);
    if (tax !== null && typeof tax === 'object' && !Array.isArray(tax)) {
      const t = tax as Record<string, unknown>;
      const stated = t['value'];
      const r = t['reassessment'];
      if (r !== undefined) {
        if (r === null || typeof r !== 'object' || Array.isArray(r)) {
          taxIssue(issues, 'TAX-01', 'noi_model', `${TAX_PATH}.reassessment`,
            'TAX-01: reassessment must be an object when stated', r);
        } else {
          const rr = r as Record<string, unknown>;
          const dp = checkReassessment(rr, issues, 'noi_model', `${TAX_PATH}.reassessment`);
          // TAX-03: the stated expense is the indicated tax at the declared quantum.
          if (dp !== null && finiteNum(stated) && finiteNum(rr['indicated_tax'])) {
            const rounded = quantizeAtDecimals(rr['indicated_tax'] as number, dp);
            if (!sameMoney(stated, rounded)) {
              taxIssue(issues, 'TAX-03', 'noi_model', `${TAX_PATH}.value`,
                `TAX-03: the stated tax ${stated} must equal indicated_tax rounded at ${dp} decimals (${rounded})`, stated);
            }
          }
          // TAX-04: the legacy boolean has to agree with the typed trigger.
          const flag = t['sale_triggers_reassessment'];
          if (typeof flag === 'boolean' && flag !== (rr['trigger'] === 'sale')) {
            taxIssue(issues, 'TAX-04', 'noi_model', `${TAX_PATH}.sale_triggers_reassessment`,
              `TAX-04: sale_triggers_reassessment ${flag} disagrees with reassessment.trigger ${JSON.stringify(rr['trigger'])}`, flag);
          }
        }
      }
      const a = t['abatement'];
      if (a !== undefined) {
        if (a === null || typeof a !== 'object' || Array.isArray(a)) {
          taxIssue(issues, 'TAX-06', 'noi_model', `${TAX_PATH}.abatement`,
            'TAX-06: abatement must be an object when stated', a);
        } else {
          checkAbatement(a as Record<string, unknown>, issues, 'noi_model', `${TAX_PATH}.abatement`, stated);
        }
      }
    }
  }

  // The terminal tax: the next buyer's, after this sale reassesses at the exit
  // price. No arithmetic is asserted over exit_noi — deriveDCF leaves
  // exit_value_gross an input because it capitalizes an unstored forward NOI.
  const dcf = resolveCrossCheckSection(parsed, 'dcf').block;
  if (!dcf) return;
  const tt = deepGet(dcf.content, 'exit_analysis.terminal_tax');
  if (tt === undefined) return;
  const base = 'exit_analysis.terminal_tax';
  if (tt === null || typeof tt !== 'object' || Array.isArray(tt)) {
    taxIssue(issues, 'TAX-01', 'dcf', base, 'TAX-01: terminal_tax must be an object when stated', tt);
    return;
  }
  const t = tt as Record<string, unknown>;
  checkReassessment(t, issues, 'dcf', base);
  if (typeof t['in_exit_noi'] !== 'boolean') {
    taxIssue(issues, 'TAX-08', 'dcf', `${base}.in_exit_noi`,
      'TAX-08: terminal_tax.in_exit_noi must state whether this tax is already inside exit_noi', t['in_exit_noi']);
  }
  // TAX-08: the next buyer is reassessed at what they pay, so the basis is the
  // exit value — unless the author says in words why it is not.
  if (t['trigger'] !== 'sale') return;
  const why = t['value_basis_differs_because'];
  if (typeof why === 'string' && why.trim().length > 0) return;
  const gross = deepGet(dcf.content, 'exit_analysis.exit_value_gross');
  const basis = t['value_basis'];
  if (!finiteNum(gross) || !finiteNum(basis)) return;
  if (!sameMoney(basis, gross)) {
    taxIssue(issues, 'TAX-08', 'dcf', `${base}.value_basis`,
      `TAX-08: terminal_tax.value_basis ${basis} must equal exit_value_gross ${gross} for a sale trigger, or state value_basis_differs_because`,
      basis);
  }
}

// ─── §4.3 Commercial lease clauses (RFC 0055) ────────────────────────────────
//
// RFC 0054 placed lease clauses on the lease record because they are attributes
// of a lease, not of a period. These rules check stated terms: nothing escalates
// a rent, exercises a break, applies a remedy or amortizes a balance.

/** What a stated termination penalty is composed of. Closed. */
export const TERMINATION_PENALTY_COMPONENTS = Object.freeze([
  'unamortized_ti', 'unamortized_lc', 'free_rent', 'fee',
] as const);

export const CO_TENANCY_TRIGGERS = Object.freeze([
  'named_tenant_departure', 'occupancy_threshold', 'both',
] as const);

export const CO_TENANCY_REMEDIES = Object.freeze([
  'rent_reduction', 'alternate_rent', 'termination_right',
] as const);

const leaseNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && parseISODate(v) !== null;

function leaseIssue(
  issues: ValidationMessage[], code: string, field: string, message: string, value?: unknown,
): void {
  issues.push({
    code, severity: 'error', section: 'rent_roll', field, message,
    ...(value !== undefined ? { value } : {}),
  });
}

function checkEscalationSchedule(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
): void {
  const steps = t['escalation_schedule'];
  if (steps === undefined || steps === null) return;
  if (!Array.isArray(steps) || steps.length === 0) {
    leaseIssue(issues, 'LSE-01', `${at}.escalation_schedule`,
      'LSE-01: escalation_schedule must be a nonempty array when stated');
    return;
  }
  // LSE-03: a flat lease does not carry a step schedule.
  const type = t['escalation_type'];
  if (type === undefined || type === null || type === 'none') {
    leaseIssue(issues, 'LSE-03', `${at}.escalation_type`,
      'LSE-03: a stated escalation_schedule requires an escalation_type other than "none"', type);
  }
  const dates: string[] = [];
  for (const [i, raw] of steps.entries()) {
    const p = `${at}.escalation_schedule[${i}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      leaseIssue(issues, 'LSE-01', p, 'LSE-01: each escalation step must be an object');
      return;
    }
    const step = raw as Record<string, unknown>;
    if (!isDate(step['effective_date'])) {
      leaseIssue(issues, 'LSE-01', `${p}.effective_date`,
        'LSE-01: effective_date must be a real YYYY-MM-DD date', step['effective_date']);
      return;
    }
    const rent = step['base_rent_annual'];
    if (!leaseNum(rent) || rent < 0) {
      leaseIssue(issues, 'LSE-01', `${p}.base_rent_annual`,
        'LSE-01: base_rent_annual must be a finite nonnegative number', rent);
      return;
    }
    dates.push(step['effective_date'] as string);
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i - 1]! >= dates[i]!) {
      leaseIssue(issues, 'LSE-01', `${at}.escalation_schedule[${i}].effective_date`,
        `LSE-01: escalation steps must strictly increase by date (${dates[i - 1]} then ${dates[i]})`, dates[i]);
      return;
    }
  }
  // LSE-02: steps live inside the lease term when the term is stated.
  const start = t['lease_commencement'];
  const end = t['lease_expiration'];
  if (!isDate(start) || !isDate(end)) return;
  for (const [i, d] of dates.entries()) {
    if (d < start || d > end) {
      leaseIssue(issues, 'LSE-02', `${at}.escalation_schedule[${i}].effective_date`,
        `LSE-02: escalation step ${d} lies outside the lease term ${start}..${end}`, d);
      return;
    }
  }
}

function checkTerminationOption(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
): void {
  const raw = t['termination_option'];
  if (raw === undefined || raw === null) return;
  const p = `${at}.termination_option`;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    leaseIssue(issues, 'LSE-04', p, 'LSE-04: termination_option must be an object when stated', raw);
    return;
  }
  const opt = raw as Record<string, unknown>;
  if (!isDate(opt['earliest_date'])) {
    leaseIssue(issues, 'LSE-04', `${p}.earliest_date`,
      'LSE-04: earliest_date must be a real YYYY-MM-DD date', opt['earliest_date']);
    return;
  }
  const notice = opt['notice_months'];
  if (!Number.isSafeInteger(notice) || (notice as number) < 0) {
    leaseIssue(issues, 'LSE-04', `${p}.notice_months`,
      'LSE-04: notice_months must be a nonnegative whole number of months', notice);
  }
  const penalty = opt['penalty'];
  if (penalty !== undefined && penalty !== null && (!leaseNum(penalty) || penalty < 0)) {
    leaseIssue(issues, 'LSE-04', `${p}.penalty`,
      'LSE-04: a stated penalty must be a finite nonnegative amount; null means genuinely none', penalty);
  }
  const start = t['lease_commencement'];
  const end = t['lease_expiration'];
  if (isDate(start) && isDate(end)) {
    const d = opt['earliest_date'] as string;
    if (d < start || d > end) {
      leaseIssue(issues, 'LSE-04', `${p}.earliest_date`,
        `LSE-04: the break date ${d} lies outside the lease term ${start}..${end}`, d);
    }
  }
  // LSE-05: what the penalty is composed of, from a closed list, without repeats.
  const parts = opt['penalty_includes'];
  if (parts === undefined || parts === null) return;
  if (!Array.isArray(parts) || parts.length === 0) {
    leaseIssue(issues, 'LSE-05', `${p}.penalty_includes`,
      'LSE-05: penalty_includes must be a nonempty array when stated');
    return;
  }
  const seen = new Set<unknown>();
  for (const [i, part] of parts.entries()) {
    if (typeof part !== 'string' || !(TERMINATION_PENALTY_COMPONENTS as readonly string[]).includes(part)) {
      leaseIssue(issues, 'LSE-05', `${p}.penalty_includes[${i}]`,
        `LSE-05: penalty component must be one of ${TERMINATION_PENALTY_COMPONENTS.join(', ')}`, part);
      return;
    }
    if (seen.has(part)) {
      leaseIssue(issues, 'LSE-05', `${p}.penalty_includes[${i}]`,
        `LSE-05: penalty component ${part} is listed more than once`, part);
      return;
    }
    seen.add(part);
  }
}

function checkCoTenancy(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
): void {
  const raw = t['co_tenancy_details'];
  const flag = t['co_tenancy_clause'];
  const stated = raw !== undefined && raw !== null;

  // LSE-06: the boolean and the body agree, or neither is stated. Same move
  // TAX-04 made for sale_triggers_reassessment: a flag that asserts nothing
  // until something has to agree with it.
  if (stated && flag !== true) {
    leaseIssue(issues, 'LSE-06', `${at}.co_tenancy_clause`,
      'LSE-06: co_tenancy_details requires co_tenancy_clause: true', flag);
    return;
  }
  if (!stated) {
    if (flag === true) {
      leaseIssue(issues, 'LSE-06', `${at}.co_tenancy_details`,
        'LSE-06: co_tenancy_clause: true requires co_tenancy_details saying what triggers it and what the remedy is');
    }
    return;
  }
  const p = `${at}.co_tenancy_details`;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    leaseIssue(issues, 'LSE-06', p, 'LSE-06: co_tenancy_details must be an object when stated', raw);
    return;
  }
  const d = raw as Record<string, unknown>;
  const trigger = d['trigger'];
  if (typeof trigger !== 'string' || !(CO_TENANCY_TRIGGERS as readonly string[]).includes(trigger)) {
    leaseIssue(issues, 'LSE-07', `${p}.trigger`,
      `LSE-07: trigger must be one of ${CO_TENANCY_TRIGGERS.join(', ')}`, trigger);
    return;
  }
  // LSE-07: the trigger carries what it needs.
  if (trigger === 'named_tenant_departure' || trigger === 'both') {
    const named = d['named_cotenants'];
    if (!Array.isArray(named) || named.length === 0 || named.some(n => typeof n !== 'string' || n.length === 0)) {
      leaseIssue(issues, 'LSE-07', `${p}.named_cotenants`,
        `LSE-07: trigger "${trigger}" requires a nonempty list of named co-tenants`, named);
    }
  }
  if (trigger === 'occupancy_threshold' || trigger === 'both') {
    const th = d['occupancy_threshold'];
    if (!leaseNum(th) || th <= 0 || th >= 1) {
      leaseIssue(issues, 'LSE-07', `${p}.occupancy_threshold`,
        `LSE-07: trigger "${trigger}" requires an occupancy_threshold fraction between 0 and 1, exclusive`, th);
    }
  }
  const remedy = d['remedy'];
  if (typeof remedy !== 'string' || !(CO_TENANCY_REMEDIES as readonly string[]).includes(remedy)) {
    leaseIssue(issues, 'LSE-08', `${p}.remedy`,
      `LSE-08: remedy must be one of ${CO_TENANCY_REMEDIES.join(', ')}`, remedy);
    return;
  }
  // LSE-08: a remedy that changes rent states by how much; a termination right does not.
  const value = d['remedy_value'];
  const hasValue = value !== undefined && value !== null;
  if (remedy === 'termination_right') {
    if (hasValue) {
      leaseIssue(issues, 'LSE-08', `${p}.remedy_value`,
        'LSE-08: a termination_right has no remedy_value; the remedy is the right itself', value);
    }
  } else if (!hasValue) {
    leaseIssue(issues, 'LSE-08', `${p}.remedy_value`,
      `LSE-08: remedy "${remedy}" requires a remedy_value`);
  } else if (remedy === 'rent_reduction' && (!leaseNum(value) || value <= 0 || value > 1)) {
    leaseIssue(issues, 'LSE-08', `${p}.remedy_value`,
      'LSE-08: a rent_reduction remedy_value is a fraction in (0, 1]', value);
  } else if (remedy === 'alternate_rent' && (!leaseNum(value) || value < 0)) {
    leaseIssue(issues, 'LSE-08', `${p}.remedy_value`,
      'LSE-08: an alternate_rent remedy_value is a nonnegative amount', value);
  }
  const cure = d['cure_period_months'];
  if (cure !== undefined && cure !== null && (!Number.isSafeInteger(cure) || (cure as number) < 0)) {
    leaseIssue(issues, 'LSE-07', `${p}.cure_period_months`,
      'LSE-07: cure_period_months must be a nonnegative whole number of months', cure);
  }
}

function checkLeasingCapital(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
): void {
  // LSE-09: state the balances. Amortization is periodic and RFC 0054 deferred it.
  for (const [original, outstanding, label] of [
    ['ti_allowance_original', 'ti_outstanding_balance', 'tenant improvement'],
    ['lc_original', 'lc_outstanding_balance', 'leasing commission'],
  ] as const) {
    for (const key of [original, outstanding]) {
      const v = t[key];
      if (v === undefined || v === null) continue;
      if (!leaseNum(v) || v < 0) {
        leaseIssue(issues, 'LSE-09', `${at}.${key}`,
          `LSE-09: ${key} must be a finite nonnegative amount`, v);
      }
    }
    const o = t[original];
    const b = t[outstanding];
    if (leaseNum(o) && leaseNum(b) && o >= 0 && b >= 0 && b > o) {
      leaseIssue(issues, 'LSE-09', `${at}.${outstanding}`,
        `LSE-09: the outstanding ${label} balance ${b} cannot exceed the original ${o}`, b);
    }
  }
}

// ─── §4.3 Expense recoveries and the CAM true-up (RFC 0058) ──────────────────
//
// Recovery income is the second-largest line in most commercial deals, and the
// tenant record carried a lease type and one orphan `cam_cap_pct`. These rules
// type the terms and check the one piece of arithmetic genuinely knowable from
// a single document: a closed period's reconciliation.
//
// Two things are deliberately NOT recomputed. The cap amount, because a
// cumulative or compounding cap depends on a base-year history no single
// document carries — REC-07 checks the direction instead, which is the honest
// half. And the pool allocation across tenants, because that is a modeling
// decision with a policy for vacant space, not a recorded fact; each tenant
// states its own share.

/** Recovery methods. Closed — a producer meaning something else states `none`. */
export const RECOVERY_METHODS = Object.freeze([
  'net', 'base_year_stop', 'fixed_stop', 'fixed_amount', 'none',
] as const);

/**
 * The §4.4 `operating_statement.expenses` keys a pool may draw from.
 *
 * Deliberately excludes `management_fee_pct_egi` (a ratio, not an expense),
 * `capital_expenditures_actual` and `replacement_reserves` (capital, not
 * operating), and `total_operating_expenses` (a total — naming it would double
 * every member beside it).
 */
export const RECOVERABLE_EXPENSE_KEYS = Object.freeze([
  'real_estate_taxes', 'insurance', 'management_fees', 'payroll_benefits',
  'utilities', 'repairs_maintenance', 'contract_services',
  'marketing_advertising', 'administrative', 'professional_fees',
  'other_expenses',
] as const);

export const RECOVERY_CAP_ACCUMULATIONS = Object.freeze([
  'cumulative', 'non_cumulative', 'compounding',
] as const);

export const RECOVERY_SETTLEMENTS = Object.freeze([
  'billed', 'credited', 'disputed', 'unsettled',
] as const);

/** Currency quantum, matching every sibling verifier's reporting boundary. */
const RECOVERY_DP = 2;

function recIssue(
  issues: ValidationMessage[], code: string, field: string, message: string,
  value?: unknown, severity: 'error' | 'warning' = 'error',
): void {
  issues.push({
    code, severity, section: 'rent_roll', field, message,
    ...(value !== undefined ? { value } : {}),
  });
}

function roundRec(value: number): number {
  const f = 10 ** RECOVERY_DP;
  const scaled = value * f;
  return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / f;
}

function checkRecoveryTerms(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
): number | null {
  const raw = t['recovery_terms'];
  if (raw == null) return null;
  const p = `${at}.recovery_terms`;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    recIssue(issues, 'REC-02', p, 'REC-02: recovery_terms must be an object stating a method', raw);
    return null;
  }
  const terms = raw as Record<string, unknown>;

  // REC-01: the share is a fraction, not a percent. 4.12 instead of 0.0412 is
  // the single most consequential typo available here — it multiplies every
  // recovery by a hundred.
  const share = terms['pro_rata_share'];
  let shareValue: number | null = null;
  if (share != null) {
    if (!(leaseNum(share) && share > 0 && share <= 1)) {
      recIssue(issues, 'REC-01', `${p}.pro_rata_share`,
        'REC-01: pro_rata_share must be a fraction in (0,1] — 0.0412 is 4.12%, not 4.12', share);
    } else {
      shareValue = share;
    }
  }

  // REC-02: a method without the input it needs.
  const method = terms['method'];
  if (typeof method !== 'string' || !(RECOVERY_METHODS as readonly string[]).includes(method)) {
    recIssue(issues, 'REC-02', `${p}.method`,
      `REC-02: method must be one of ${RECOVERY_METHODS.join(', ')} — the vocabulary is closed`, method);
  } else {
    const REQUIRED: Record<string, string> = {
      base_year_stop: 'base_year',
      fixed_stop: 'expense_stop_per_sqft',
      fixed_amount: 'fixed_recovery_annual',
    };
    const needs = REQUIRED[method];
    if (needs && terms[needs] == null) {
      recIssue(issues, 'REC-02', `${p}.${needs}`,
        `REC-02: method "${method}" requires ${needs}; without it the method states nothing`);
    }
  }

  // REC-03: a pool entry that names nothing recovers nothing, silently.
  const pool = terms['recoverable_pool'];
  if (pool != null) {
    if (!Array.isArray(pool) || pool.length === 0) {
      recIssue(issues, 'REC-03', `${p}.recoverable_pool`,
        'REC-03: recoverable_pool must be a nonempty array of operating-statement expense keys', pool);
    } else {
      for (const [j, entry] of pool.entries()) {
        if (typeof entry !== 'string' || !(RECOVERABLE_EXPENSE_KEYS as readonly string[]).includes(entry)) {
          recIssue(issues, 'REC-03', `${p}.recoverable_pool[${j}]`,
            `REC-03: ${JSON.stringify(entry)} is not a recoverable operating_statement.expenses key — a pool naming a nonexistent expense recovers zero without saying so`, entry);
        }
      }
    }
  }

  // The cap. Accumulation has no default: the three treatments diverge
  // materially within three years, so a silent choice is a wrong number.
  const cap = terms['cap'];
  if (cap != null) {
    const cp = `${p}.cap`;
    if (typeof cap !== 'object' || Array.isArray(cap)) {
      recIssue(issues, 'REC-02', cp, 'REC-02: cap must be an object', cap);
    } else {
      const c = cap as Record<string, unknown>;
      const pct = c['pct'];
      if (pct != null && !(leaseNum(pct) && pct > 0 && pct < 1)) {
        recIssue(issues, 'REC-01', `${cp}.pct`,
          'REC-01: cap.pct must be a fraction in (0,1) — 0.05 is 5%, not 5', pct);
      }
      if (pct != null) {
        const acc = c['accumulation'];
        if (typeof acc !== 'string' || !(RECOVERY_CAP_ACCUMULATIONS as readonly string[]).includes(acc)) {
          recIssue(issues, 'REC-02', `${cp}.accumulation`,
            `REC-02: a stated cap.pct requires cap.accumulation (${RECOVERY_CAP_ACCUMULATIONS.join(' | ')}) — there is no default, because the three disagree`, acc);
        }
      }
    }
  }

  // REC-10: the legacy field and the typed cap can contradict each other.
  if (t['cam_cap_pct'] != null && cap != null) {
    recIssue(issues, 'REC-10', `${at}.cam_cap_pct`,
      'REC-10: cam_cap_pct is superseded by recovery_terms.cap; stating both lets the two drift apart',
      t['cam_cap_pct'], 'warning');
  }
  return shareValue;
}

function checkRecoveryTrueUp(
  t: Record<string, unknown>, issues: ValidationMessage[], at: string,
  share: number | null, asOf: string | null,
): void {
  const rows = t['recovery_true_up'];
  if (rows == null) return;
  if (!Array.isArray(rows)) {
    recIssue(issues, 'REC-04', `${at}.recovery_true_up`,
      'REC-04: recovery_true_up must be an array of reconciliation rows', rows);
    return;
  }
  for (const [j, raw] of rows.entries()) {
    const p = `${at}.recovery_true_up[${j}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      recIssue(issues, 'REC-04', p, 'REC-04: each true-up entry must be an object', raw);
      continue;
    }
    const row = raw as Record<string, unknown>;
    const start = row['period_start'];
    const end = row['period_end'];
    if (!isDate(start) || !isDate(end)) {
      recIssue(issues, 'REC-04', `${p}.period_start`,
        'REC-04: a true-up states period_start and period_end as YYYY-MM-DD dates');
      continue;
    }
    if (end < start) {
      recIssue(issues, 'REC-04', `${p}.period_end`,
        `REC-04: period_end (${end}) precedes period_start (${start})`, end);
      continue;
    }

    // REC-05: a reconciliation of a period that has not ended is a forecast.
    // Anchored on the rent roll's own as_of_date — never on file metadata,
    // which is an edit timestamp and would refuse a legitimately re-saved
    // document. Skipped when the rent roll states no date.
    if (asOf !== null && !(end < asOf)) {
      recIssue(issues, 'REC-05', `${p}.period_end`,
        `REC-05: the true-up period ends ${end}, on or after the rent roll as_of_date ${asOf} — a reconciliation of an open period is a forecast, and this section carries settled facts`, end);
    }

    const poolActual = row['pool_actual'];
    const uncapped = row['tenant_share_uncapped'];
    const capped = row['tenant_share_capped'];
    const billed = row['estimated_billed'];
    const trueUp = row['true_up_amount'];

    // REC-06: the one product a single document can check.
    if (leaseNum(poolActual) && share !== null && leaseNum(uncapped)) {
      const want = roundRec(poolActual * share);
      if (roundRec(uncapped) !== want) {
        recIssue(issues, 'REC-06', `${p}.tenant_share_uncapped`,
          `REC-06: tenant_share_uncapped states ${uncapped} but pool_actual x pro_rata_share is ${want}`, uncapped);
      }
    }

    // REC-07: the cap can only reduce. The capped amount itself is stated,
    // not recomputed — see the section note.
    if (leaseNum(uncapped) && leaseNum(capped) && roundRec(capped) > roundRec(uncapped)) {
      recIssue(issues, 'REC-07', `${p}.tenant_share_capped`,
        `REC-07: tenant_share_capped (${capped}) exceeds tenant_share_uncapped (${uncapped}) — a cap cannot increase a recovery`, capped);
    }

    // REC-08: the subtraction the whole row exists to record.
    if (leaseNum(capped) && leaseNum(billed) && leaseNum(trueUp)) {
      const want = roundRec(capped - billed);
      if (roundRec(trueUp) !== want) {
        recIssue(issues, 'REC-08', `${p}.true_up_amount`,
          `REC-08: true_up_amount states ${trueUp} but tenant_share_capped less estimated_billed is ${want}`, trueUp);
      }
    }

    const settlement = row['settlement'];
    if (settlement != null && !(typeof settlement === 'string' && (RECOVERY_SETTLEMENTS as readonly string[]).includes(settlement))) {
      recIssue(issues, 'REC-04', `${p}.settlement`,
        `REC-04: settlement must be one of ${RECOVERY_SETTLEMENTS.join(', ')}`, settlement);
    }
  }
}

function checkLeaseClauses(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const block = resolveCrossCheckSection(parsed, 'rent_roll').block;
  if (!block) return;
  const tenants = deepGet(block.content, 'tenants');
  if (!Array.isArray(tenants)) return;
  const rawAsOf = deepGet(block.content, 'as_of_date');
  const asOf = isDate(rawAsOf) ? rawAsOf : null;
  for (const [i, raw] of tenants.entries()) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const t = raw as Record<string, unknown>;
    const at = `tenants[${i}]`;
    checkEscalationSchedule(t, issues, at);
    checkTerminationOption(t, issues, at);
    checkCoTenancy(t, issues, at);
    checkLeasingCapital(t, issues, at);
    const share = checkRecoveryTerms(t, issues, at);
    checkRecoveryTrueUp(t, issues, at, share, asOf);
  }
}

// ─── §4.7 / §4.8 Rate hedges and escrows (RFC 0056) ──────────────────────────
//
// A cap's strike, notional and term are stated, never priced. Nothing values
// the instrument, projects a strike crossing or rolls an escrow balance
// forward — that needs a forward curve, which this contract does not fetch.
// The one thing these rules insist on is that the author answer what happens
// when the cap expires, and that a stated replacement is a funded line.

/** The only instrument this contract types. Closed. */
export const HEDGE_INSTRUMENTS = Object.freeze(['rate_cap'] as const);

/**
 * Named, refused, and left for a mark-to-market contract. Both can be worth
 * less than zero; a cap cannot. Typing them as caps would make the capital
 * stack wrong in the one case that matters.
 */
export const RESERVED_HEDGE_INSTRUMENTS = Object.freeze([
  'rate_swap', 'rate_collar',
] as const);

/** The `rate_index` vocabulary minus `fixed`, which a cap is not struck against. */
export const HEDGE_INDEXES = Object.freeze([
  'sofr', 'prime', 'treasury_5yr', 'treasury_10yr',
] as const);

/** What the author says happens in the month after the cap expires. No default. */
export const HEDGE_EXPIRY_ASSUMPTIONS = Object.freeze([
  'replace', 'unhedged', 'loan_matures_first',
] as const);

/** Closed, with a label-bearing `other` — the RFC 0052 shape. */
export const ESCROW_NAMES = Object.freeze([
  'tax', 'insurance', 'replacement_reserve', 'ti_lc',
  'interest', 'operating', 'rate_cap_replacement', 'other',
] as const);

export type HedgeInstrument = (typeof HEDGE_INSTRUMENTS)[number];
export type HedgeExpiryAssumption = (typeof HEDGE_EXPIRY_ASSUMPTIONS)[number];
export type EscrowName = (typeof ESCROW_NAMES)[number];

function hedgeIssue(
  issues: ValidationMessage[], code: string, section: string, field: string, message: string, value?: unknown,
): void {
  issues.push({ code, severity: 'error', section, field, message, ...(value !== undefined ? { value } : {}) });
}

/** The §4.7 hedge object: shape, the rate_type gate, and the legacy agreement. */
function checkRateHedge(
  h: Record<string, unknown>, rateType: unknown, legacyCapPct: unknown,
  issues: ValidationMessage[],
): void {
  const at = 'rate_hedge';
  const inst = h['instrument'];
  // HDG-02 before HDG-01: a reserved name earns its own message, not "unknown".
  if (typeof inst === 'string' && (RESERVED_HEDGE_INSTRUMENTS as readonly string[]).includes(inst)) {
    hedgeIssue(issues, 'HDG-02', 'debt_structure', `${at}.instrument`,
      `HDG-02: ${inst} is reserved for a later mark-to-market contract and is refused here — its value moves with the curve and can be negative, which a cap's cannot`,
      inst);
  } else if (typeof inst !== 'string' || !(HEDGE_INSTRUMENTS as readonly string[]).includes(inst)) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.instrument`,
      `HDG-01: instrument must be one of ${HEDGE_INSTRUMENTS.join(', ')}`, inst);
  }

  const notional = h['notional'];
  if (!finiteNum(notional) || notional < 0) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.notional`,
      'HDG-01: notional must be a finite nonnegative amount', notional);
  }

  // A fraction, not a percent — a strike of 3.5 is 350%, which is the mistake
  // this bound exists to catch.
  const strike = h['strike_rate'];
  if (!finiteNum(strike) || strike <= 0 || strike >= 1) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.strike_rate`,
      'HDG-01: strike_rate must be a fraction in (0, 1) — 0.035 is 3.5%', strike);
  }

  const index = h['index'];
  if (typeof index !== 'string' || !(HEDGE_INDEXES as readonly string[]).includes(index)) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.index`,
      `HDG-01: index must be one of ${HEDGE_INDEXES.join(', ')}`, index);
  }

  const eff = h['effective_date'];
  const exp = h['expiration_date'];
  if (!isDate(eff)) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.effective_date`,
      'HDG-01: effective_date must be a real YYYY-MM-DD date', eff);
  }
  if (!isDate(exp)) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.expiration_date`,
      'HDG-01: expiration_date must be a real YYYY-MM-DD date', exp);
  } else if (isDate(eff) && exp <= eff) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.expiration_date`,
      `HDG-01: expiration_date ${exp} must be strictly after effective_date ${eff}`, exp);
  }

  const premium = h['premium'];
  if (premium !== undefined && premium !== null && (!finiteNum(premium) || premium < 0)) {
    hedgeIssue(issues, 'HDG-01', 'debt_structure', `${at}.premium`,
      'HDG-01: premium must be a finite nonnegative amount, or null for genuinely none', premium);
  }

  // HDG-03: a fixed-rate loan does not carry a rate cap.
  if (rateType !== 'floating' && rateType !== 'hybrid') {
    hedgeIssue(issues, 'HDG-03', 'debt_structure', 'rate_type',
      `HDG-03: a stated rate_hedge requires rate_type "floating" or "hybrid" (found ${JSON.stringify(rateType)})`,
      rateType);
  }

  // HDG-04: the legacy scalar has to agree with the typed body.
  if (finiteNum(legacyCapPct) && finiteNum(strike) && legacyCapPct !== strike) {
    hedgeIssue(issues, 'HDG-04', 'debt_structure', 'rate_cap_pct',
      `HDG-04: rate_cap_pct ${legacyCapPct} disagrees with rate_hedge.strike_rate ${strike}`, legacyCapPct);
  }

  // HDG-06: no default. A cap's expiry is the fact the reader came for, and
  // "unstated" is the answer that hides the cliff.
  const after = h['post_expiration_assumption'];
  if (typeof after !== 'string' || !(HEDGE_EXPIRY_ASSUMPTIONS as readonly string[]).includes(after)) {
    hedgeIssue(issues, 'HDG-06', 'debt_structure', `${at}.post_expiration_assumption`,
      `HDG-06: post_expiration_assumption must be stated as one of ${HEDGE_EXPIRY_ASSUMPTIONS.join(', ')}`,
      after);
  }
}

/** The §4.8 escrow array. Returns the set of names it managed to read. */
function checkEscrows(
  escrows: unknown, uses: Record<string, unknown>, issues: ValidationMessage[],
): Set<string> {
  const seen = new Set<string>();
  const at = 'uses.escrows';
  if (!Array.isArray(escrows) || escrows.length === 0) {
    hedgeIssue(issues, 'ESC-01', 'sources_uses', at,
      'ESC-01: escrows must be a nonempty array when stated');
    return seen;
  }
  const labels = new Set<string>();
  const upfrontByName = new Map<string, number>();
  for (const [i, raw] of escrows.entries()) {
    const p = `${at}[${i}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      hedgeIssue(issues, 'ESC-01', 'sources_uses', p, 'ESC-01: each escrow must be an object');
      continue;
    }
    const e = raw as Record<string, unknown>;
    const name = e['name'];
    if (typeof name !== 'string' || !(ESCROW_NAMES as readonly string[]).includes(name)) {
      hedgeIssue(issues, 'ESC-01', 'sources_uses', `${p}.name`,
        `ESC-01: escrow name must be one of ${ESCROW_NAMES.join(', ')}`, name);
      continue;
    }

    const label = e['label'];
    if (name === 'other') {
      // ESC-02: `other` says nothing until the label says what it is.
      if (typeof label !== 'string' || label.trim().length === 0) {
        hedgeIssue(issues, 'ESC-02', 'sources_uses', `${p}.label`,
          'ESC-02: an "other" escrow requires a nonempty label', label);
      } else if (labels.has(label.trim())) {
        hedgeIssue(issues, 'ESC-02', 'sources_uses', `${p}.label`,
          `ESC-02: duplicate "other" escrow label ${JSON.stringify(label.trim())}`, label);
      } else {
        labels.add(label.trim());
      }
    } else {
      if (label !== undefined && label !== null) {
        hedgeIssue(issues, 'ESC-02', 'sources_uses', `${p}.label`,
          `ESC-02: only an "other" escrow carries a label; ${name} names itself`, label);
      }
      if (seen.has(name)) {
        hedgeIssue(issues, 'ESC-02', 'sources_uses', `${p}.name`,
          `ESC-02: duplicate escrow name ${JSON.stringify(name)}`, name);
      }
    }
    seen.add(name);

    // ESC-01: an escrow that funds neither at close nor monthly is not one.
    let stated = 0;
    for (const key of ['upfront', 'monthly'] as const) {
      const v = e[key];
      if (v === undefined || v === null) continue;
      if (!finiteNum(v) || v < 0) {
        hedgeIssue(issues, 'ESC-01', 'sources_uses', `${p}.${key}`,
          `ESC-01: ${key} must be a finite nonnegative amount`, v);
        continue;
      }
      stated++;
      if (key === 'upfront' && !upfrontByName.has(name)) upfrontByName.set(name, v);
    }
    if (stated === 0) {
      hedgeIssue(issues, 'ESC-01', 'sources_uses', p,
        'ESC-01: an escrow must state at least one of upfront or monthly');
    }
  }

  // ESC-03: the legacy scalars have to agree with the typed lines.
  for (const [legacyKey, name] of [
    ['interest_reserve', 'interest'],
    ['operating_reserves', 'operating'],
  ] as const) {
    const legacy = uses[legacyKey];
    const typed = upfrontByName.get(name);
    if (finiteNum(legacy) && typed !== undefined && !sameMoney(legacy, typed)) {
      hedgeIssue(issues, 'ESC-03', 'sources_uses', `uses.${legacyKey}`,
        `ESC-03: uses.${legacyKey} ${legacy} disagrees with the ${name} escrow's upfront ${typed}`, legacy);
    }
  }
  return seen;
}

function checkHedgesAndEscrows(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const debt = resolveCrossCheckSection(parsed, 'debt_structure').block;
  const su = resolveCrossCheckSection(parsed, 'sources_uses').block;

  let assumption: unknown;
  let hedgeStated = false;
  if (debt) {
    const h = deepGet(debt.content, 'rate_hedge');
    if (h !== undefined && h !== null) {
      if (typeof h !== 'object' || Array.isArray(h)) {
        hedgeIssue(issues, 'HDG-01', 'debt_structure', 'rate_hedge',
          'HDG-01: rate_hedge must be an object when stated', h);
      } else {
        hedgeStated = true;
        const rec = h as Record<string, unknown>;
        assumption = rec['post_expiration_assumption'];
        checkRateHedge(rec, deepGet(debt.content, 'rate_type'), deepGet(debt.content, 'rate_cap_pct'), issues);
        // HDG-05: the premium is the same cash as the use that funds it.
        const premium = rec['premium'];
        const cost = su ? deepGet(su.content, 'uses.rate_cap_cost') : undefined;
        if (finiteNum(premium) && finiteNum(cost) && !sameMoney(premium, cost)) {
          hedgeIssue(issues, 'HDG-05', 'debt_structure', 'rate_hedge.premium',
            `HDG-05: rate_hedge.premium ${premium} disagrees with sources_uses.uses.rate_cap_cost ${cost}`,
            premium);
        }
      }
    }
  }

  if (!su) return;
  const uses = deepGet(su.content, 'uses');
  if (uses === null || typeof uses !== 'object' || Array.isArray(uses)) return;
  const u = uses as Record<string, unknown>;
  const escrows = u['escrows'];
  const names = escrows === undefined || escrows === null
    ? new Set<string>()
    : checkEscrows(escrows, u, issues);

  // ESC-04: the rule that turns "this cap expires in year three" from a note
  // into a funded line. Both directions, so neither side can drift alone.
  const wantsReplacement = hedgeStated && assumption === 'replace';
  const hasReplacement = names.has('rate_cap_replacement');
  if (wantsReplacement && !hasReplacement) {
    hedgeIssue(issues, 'ESC-04', 'sources_uses', 'uses.escrows',
      'ESC-04: rate_hedge.post_expiration_assumption "replace" requires a rate_cap_replacement escrow');
  } else if (hasReplacement && !wantsReplacement) {
    hedgeIssue(issues, 'ESC-04', 'sources_uses', 'uses.escrows',
      `ESC-04: a rate_cap_replacement escrow requires rate_hedge.post_expiration_assumption "replace" (found ${JSON.stringify(assumption)})`,
      assumption);
  }
}

// ─── §4.8 Renovation draw and expense-targeted capex (RFC 0057) ──────────────
//
// A contingency is the number a construction lender watches, and two deals
// stating the same one are indistinguishable when one has drawn none of it and
// the other has drawn all of it. These rules read the draw the author stated.
//
// Nothing here applies a saving. `annual_savings` is never subtracted from an
// expense line, from EGI or from NOI — `in_noi_model` records whether the author
// already did, and CAPX-07 makes them say so, because a stated saving with no
// such flag is how a document gets double-counted.

/** Where the payback arithmetic is compared. Years, not money. */
const PAYBACK_DP = 4;

function capxIssue(
  issues: ValidationMessage[], code: string, field: string, message: string, value?: unknown,
): void {
  issues.push({
    code, severity: 'error', section: 'sources_uses', field, message,
    ...(value !== undefined ? { value } : {}),
  });
}

/**
 * One `expense_targeted` entry. `expenseKeys` is null when `noi_model` is absent
 * or unreadable, in which case CAPX-06 checks the shape but not the target.
 */
function checkExpenseTargeted(
  e: Record<string, unknown>, expenseKeys: Set<string> | null,
  issues: ValidationMessage[], at: string,
): void {
  const label = e['label'];
  if (typeof label !== 'string' || label.trim().length === 0) {
    capxIssue(issues, 'CAPX-06', `${at}.label`,
      'CAPX-06: an expense-targeted capex entry requires a nonempty label', label);
  }

  for (const key of ['amount', 'annual_savings'] as const) {
    const v = e[key];
    if (!finiteNum(v) || v < 0) {
      capxIssue(issues, 'CAPX-06', `${at}.${key}`,
        `CAPX-06: ${key} must be a finite nonnegative amount`, v);
    }
  }

  const begin = e['savings_begin'];
  if (typeof begin !== 'string' || taxPeriodKind(begin) === null) {
    capxIssue(issues, 'CAPX-06', `${at}.savings_begin`,
      'CAPX-06: savings_begin must be an RFC 0041 period selector (Y1+, YYYY-Qn, YYYY-MM or YYYY-MM-DD)',
      begin);
  }

  // The target is checked against the keys actually present, not a hardcoded
  // list, so a module adding a class-specific expense line keeps working.
  const targets = e['targets'];
  if (typeof targets !== 'string' || targets.trim().length === 0) {
    capxIssue(issues, 'CAPX-06', `${at}.targets`,
      'CAPX-06: targets must name the noi_model.expenses key this project reduces', targets);
  } else if (expenseKeys !== null && !expenseKeys.has(targets)) {
    capxIssue(issues, 'CAPX-06', `${at}.targets`,
      `CAPX-06: targets ${JSON.stringify(targets)} names no key under noi_model.expenses`, targets);
  }

  // CAPX-07: the disclosure that keeps a reader from applying the saving twice.
  if (typeof e['in_noi_model'] !== 'boolean') {
    capxIssue(issues, 'CAPX-07', `${at}.in_noi_model`,
      'CAPX-07: in_noi_model must state whether this saving is already inside noi_model',
      e['in_noi_model']);
  }

  const payback = e['simple_payback_years'];
  if (payback === undefined || payback === null) return;
  const amount = e['amount'];
  const savings = e['annual_savings'];
  if (!finiteNum(payback) || payback < 0) {
    capxIssue(issues, 'CAPX-08', `${at}.simple_payback_years`,
      'CAPX-08: simple_payback_years must be a finite nonnegative number', payback);
    return;
  }
  if (!finiteNum(amount) || !finiteNum(savings)) return;
  // A project with no stated saving has no payback period; a number there
  // would be a fiction, so state nothing rather than Infinity.
  if (savings === 0) {
    capxIssue(issues, 'CAPX-08', `${at}.simple_payback_years`,
      'CAPX-08: simple_payback_years cannot be stated against zero annual_savings', payback);
    return;
  }
  const expected = quantizeAtDecimals(amount / savings, PAYBACK_DP);
  if (quantizeAtDecimals(payback, PAYBACK_DP) !== expected) {
    capxIssue(issues, 'CAPX-08', `${at}.simple_payback_years`,
      `CAPX-08: simple_payback_years ${payback} must equal amount / annual_savings (${expected})`,
      payback);
  }
}

function checkRenovationDraw(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const su = resolveCrossCheckSection(parsed, 'sources_uses').block;
  if (!su) return;
  const r = deepGet(su.content, 'uses.renovation');
  if (r === undefined || r === null) return;
  const at = 'uses.renovation';
  if (typeof r !== 'object' || Array.isArray(r)) {
    capxIssue(issues, 'CAPX-01', at, 'CAPX-01: renovation must be an object when stated', r);
    return;
  }
  const ren = r as Record<string, unknown>;

  for (const key of ['budget', 'contingency', 'contingency_used', 'drawn_to_date'] as const) {
    const v = ren[key];
    if (!finiteNum(v) || v < 0) {
      capxIssue(issues, 'CAPX-01', `${at}.${key}`,
        `CAPX-01: ${key} must be a finite nonnegative amount`, v);
    }
  }
  if (!isDate(ren['as_of_date'])) {
    capxIssue(issues, 'CAPX-01', `${at}.as_of_date`,
      'CAPX-01: as_of_date must be a real YYYY-MM-DD date', ren['as_of_date']);
  }

  // The relational rules below only compare figures CAPX-01 accepted: a bound
  // computed from a budget we just refused as negative is noise, not a finding.
  const amt = (v: unknown): v is number => finiteNum(v) && v >= 0;
  const budget = ren['budget'];
  const contingency = ren['contingency'];
  const used = ren['contingency_used'];
  const drawn = ren['drawn_to_date'];

  // CAPX-02: a contingency drawn past its size is an overrun, and calling it a
  // contingency is what hides that.
  if (amt(contingency) && amt(used) && used > contingency) {
    capxIssue(issues, 'CAPX-02', `${at}.contingency_used`,
      `CAPX-02: contingency_used ${used} exceeds the contingency ${contingency} — that is an overrun, not a contingency`,
      used);
  }

  if (amt(drawn)) {
    if (amt(budget) && amt(contingency) && drawn > budget + contingency) {
      capxIssue(issues, 'CAPX-03', `${at}.drawn_to_date`,
        `CAPX-03: drawn_to_date ${drawn} exceeds budget plus contingency (${budget + contingency})`,
        drawn);
    }
    if (amt(used) && drawn < used) {
      capxIssue(issues, 'CAPX-03', `${at}.drawn_to_date`,
        `CAPX-03: drawn_to_date ${drawn} is below contingency_used ${used}; the contingency draw is part of the total`,
        drawn);
    }
  }

  // CAPX-04: stated and verified, the RFC 0052 net_sale_proceeds posture — the
  // figure a lender quotes should be checkable, not recomputed by every reader.
  const remaining = ren['contingency_remaining'];
  if (remaining !== undefined && remaining !== null) {
    if (!finiteNum(remaining)) {
      capxIssue(issues, 'CAPX-04', `${at}.contingency_remaining`,
        'CAPX-04: contingency_remaining must be a finite number when stated', remaining);
    } else if (amt(contingency) && amt(used) && !sameMoney(remaining, contingency - used)) {
      capxIssue(issues, 'CAPX-04', `${at}.contingency_remaining`,
        `CAPX-04: contingency_remaining ${remaining} must equal contingency less contingency_used (${contingency - used})`,
        remaining);
    }
  }

  // CAPX-05: the legacy scalars have to agree with the typed body.
  for (const [legacyKey, typedKey] of [
    ['renovation_budget', 'budget'],
    ['renovation_contingency', 'contingency'],
  ] as const) {
    const legacy = deepGet(su.content, `uses.${legacyKey}`);
    const typed = ren[typedKey];
    if (finiteNum(legacy) && amt(typed) && !sameMoney(legacy, typed)) {
      capxIssue(issues, 'CAPX-05', `uses.${legacyKey}`,
        `CAPX-05: uses.${legacyKey} ${legacy} disagrees with renovation.${typedKey} ${typed}`, legacy);
    }
  }

  const targeted = ren['expense_targeted'];
  if (targeted === undefined || targeted === null) return;
  if (!Array.isArray(targeted) || targeted.length === 0) {
    capxIssue(issues, 'CAPX-06', `${at}.expense_targeted`,
      'CAPX-06: expense_targeted must be a nonempty array when stated');
    return;
  }

  const noi = resolveCrossCheckSection(parsed, 'noi_model').block;
  const expenses = noi ? deepGet(noi.content, 'expenses') : undefined;
  const expenseKeys = expenses !== null && typeof expenses === 'object' && !Array.isArray(expenses)
    ? new Set(Object.keys(expenses as Record<string, unknown>))
    : null;

  for (const [i, raw] of targeted.entries()) {
    const p = `${at}.expense_targeted[${i}]`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      capxIssue(issues, 'CAPX-06', p, 'CAPX-06: each expense_targeted entry must be an object');
      continue;
    }
    checkExpenseTargeted(raw as Record<string, unknown>, expenseKeys, issues, p);
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
function checkComponents(parsed: ParsedUWFile, issues: ValidationMessage[], ledger: CoverageLedger): void {
  const components = roleAwareDirectRead(parsed, 'components', 'CC-11', ledger);
  if (ledger.coverage['CC-11']?.reason === 'variant_unresolvable') {
    markSkipped(ledger, 'CC-12', 'variant_unresolvable', 'components');
    ledger.unresolvable.get('components')?.codes.add('CC-12');
    return;
  }
  if (!components) {
    markSkipped(ledger, 'CC-11', 'not_applicable', 'no components section');
    markSkipped(ledger, 'CC-12', 'not_applicable', 'no components section');
    return;
  }

  const assetClass = parsed.frontmatter.asset_class;

  // CC-11: a components section is only valid under asset_class mixed_use.
  markEvaluated(ledger, 'CC-11');
  if (assetClass !== 'mixed_use') {
    markSkipped(ledger, 'CC-12', 'not_applicable', 'CC-11 fired');
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
  const noiModel = roleAwareDirectRead(parsed, 'noi_model', 'CC-12', ledger);
  if (ledger.resolutions['CC-11']?.['components']) {
    ledger.resolutions['CC-12'] ??= {};
    ledger.resolutions['CC-12']!['components'] = ledger.resolutions['CC-11']!['components']!;
  }
  if (!noiModel && !ledger.coverage['CC-12']) markSkipped(ledger, 'CC-12', 'section_absent', 'noi_model');
  if (noiModel) {
    const propNOI = deepGet(noiModel.content, 'net_operating_income') as number | undefined;
    const compNOIs = admissible
      .map(([, raw]) =>
        raw && typeof raw === 'object'
          ? (raw as Record<string, unknown>)['net_operating_income']
          : undefined,
      )
      .filter((v): v is number => typeof v === 'number');
    if (propNOI == null) markSkipped(ledger, 'CC-12', 'field_absent', 'noi_model.net_operating_income');
    else if (admissible.length === 0 || compNOIs.length !== admissible.length) markSkipped(ledger, 'CC-12', 'field_absent', 'components[*].net_operating_income');
    if (propNOI != null && admissible.length > 0 && compNOIs.length === admissible.length) {
      markEvaluated(ledger, 'CC-12');
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
function seniorDebtTranche(parsed: ParsedUWFile, ledger: CoverageLedger): Record<string, unknown> | null {
  const cs = roleAwareDirectRead(parsed, 'capital_stack', 'CC-03', ledger);
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

    // CS-02b: a split coupon is one preferred-equity tranche with two
    // explicitly typed rate components. Keep the field-presence rule here,
    // beside CS-02, so schema-valid and hand-built ParsedUWFile inputs receive
    // the same refusal.
    const hasCashRate = Object.prototype.hasOwnProperty.call(t, 'cash_rate');
    const hasAccruedRate = Object.prototype.hasOwnProperty.call(t, 'accrued_rate');
    if (t['accrual'] === 'split') {
      if (cls !== 'preferred_equity') {
        issues.push({ code: 'CS-02b', severity: 'error', section, field: `${prefix}${label}.accrual`, message: `CS-02b: split accrual is supported only for preferred_equity tranche ${label}` });
      }
      if (!hasCashRate || !Number.isFinite(t['cash_rate'])) {
        issues.push({ code: 'CS-02b', severity: 'error', section, field: `${prefix}${label}.cash_rate`, message: `CS-02b: split tranche ${label} must state a numeric cash_rate` });
      }
      if (!hasAccruedRate || !Number.isFinite(t['accrued_rate'])) {
        issues.push({ code: 'CS-02b', severity: 'error', section, field: `${prefix}${label}.accrued_rate`, message: `CS-02b: split tranche ${label} must state a numeric accrued_rate` });
      }
      if (hasRate && Number.isFinite(t['cash_rate']) && Number.isFinite(t['accrued_rate'])
        && t['rate'] !== (t['cash_rate'] as number) + (t['accrued_rate'] as number)) {
        issues.push({ code: 'CS-02b', severity: 'error', section, field: `${prefix}${label}.rate`, message: `CS-02b: split tranche ${label}.rate must equal cash_rate + accrued_rate` });
      }
    } else if (hasCashRate || hasAccruedRate) {
      issues.push({ code: 'CS-02b', severity: 'error', section, field: `${prefix}${label}.accrual`, message: `CS-02b: cash_rate and accrued_rate are permitted only when tranche ${label} uses accrual: "split"` });
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
function checkSizeIntensive(parsed: ParsedUWFile, issues: ValidationMessage[], ledger: CoverageLedger): void {
  // 1. UWX record, not a compiled UW Lite summary — Lite states size in its
  //    own grammar, and its compiled envelope carries the x_uw_lite_source
  //    extension (surfaced under `extensions` by fromUWEnvelope, under
  //    `sections` by a re-parse of the serialized UWX).
  if (parsed.sections[UW_LITE_SOURCE_EXTENSION] || parsed.extensions?.[UW_LITE_SOURCE_EXTENSION]) {
    markSkipped(ledger, 'CC-13', 'not_applicable', 'compiled UW Lite summary');
    return;
  }

  // 2. Deal-record profile only. An absent profile is the plain underwriting
  //    record; any other declared profile has no property section by design.
  const profile = (parsed.frontmatter as Record<string, unknown>)['document_profile'];
  if (profile != null && profile !== DEAL_UNDERWRITING_PROFILE) {
    markSkipped(ledger, 'CC-13', 'not_applicable', `document_profile ${String(profile)}`);
    return;
  }

  // 3. Recognized class with a primary size field (not mixed_use, §XIII.2;
  //    not an unrecognized class, §XIII.3).
  const assetClass = parsed.frontmatter.asset_class;
  if (typeof assetClass !== 'string') {
    markSkipped(ledger, 'CC-13', 'not_applicable', 'no asset_class');
    return;
  }
  const intensive = getSizeIntensive(assetClass);
  if (!intensive) {
    markSkipped(ledger, 'CC-13', 'not_applicable', `${assetClass} has no primary size field`);
    return;
  }

  // 4. A property section exists — a missing section is a different defect
  //    with a different remedy (RFC 0027, unresolved question 5).
  const propertyEntry = parsed.sections['property'];
  const roleBearing = propertyEntry && (isVariantMap(propertyEntry) ? Object.values(propertyEntry) : [propertyEntry]).some(hasBlockRole);
  const property = roleBearing ? roleAwareDirectRead(parsed, 'property', 'CC-13', ledger)
    : getSection(parsed, 'property') ?? getSectionVariant(parsed, 'property', 'default');
  if (ledger.coverage['CC-13']?.reason === 'variant_unresolvable') return;
  if (!property) {
    markSkipped(ledger, 'CC-13', 'section_absent', 'property');
    return;
  }

  // 5. Not externalized (RFC 0021) — the directive is not the section.
  //    Presence of the key is the whole test, as in the Lite projection.
  if (
    EXTERNAL_ANNOTATION_KEY in (property.annotation as Record<string, unknown>) ||
    EXTERNAL_ANNOTATION_KEY in property.content
  ) {
    markSkipped(ledger, 'CC-13', 'not_applicable', 'property is externalized');
    return;
  }
  markEvaluated(ledger, 'CC-13');

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
function checkSectionReadiness(parsed: ParsedUWFile, issues: ValidationMessage[], ledger: CoverageLedger): void {
  // CC-14 preconditions mirror CC-13's 1 and 2 (RFC 0028 §1). Precondition 3
  // (not externalized) is satisfied structurally: an externalized-but-
  // unresolved section still parses as a block, so it is present here.
  const isCompiledLite =
    !!(parsed.sections[UW_LITE_SOURCE_EXTENSION] || parsed.extensions?.[UW_LITE_SOURCE_EXTENSION]);
  const profile = (parsed.frontmatter as Record<string, unknown>)['document_profile'];
  const isDealRecord = profile == null || profile === DEAL_UNDERWRITING_PROFILE;

  const hasProperty = hasStageSection(parsed, 'property');
  if (isCompiledLite) markSkipped(ledger, 'CC-14', 'not_applicable', 'compiled UW Lite summary');
  else if (!isDealRecord) markSkipped(ledger, 'CC-14', 'not_applicable', 'not a deal record');
  else markEvaluated(ledger, 'CC-14');
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


function checkLeaseUpSchedule(parsed: ParsedUWFile, issues: ValidationMessage[], ledger: CoverageLedger): void {
  const entry = parsed.sections['lease_up_schedule'];
  if (!entry) {
    markSkipped(ledger, 'CC-15', 'not_applicable', 'no lease_up_schedule');
    return;
  }
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
  // CC-15 reads the base variant ONLY (RFC 0008: non-base variants are
  // exempt by design — a downside is supposed to disagree). So the §5.3
  // lone-variant fallback does not apply here, and a map with no base or
  // default is `not_applicable`, not unresolvable: nothing was silenced.
  const base = isVariantMap(entry)
    ? ((entry as Record<string, UWBlock>)['base'] ?? (entry as Record<string, UWBlock>)['default'])
    : (entry as UWBlock);
  if (base && hasBlockRole(base)) {
    const r = resolveRoleBlock(base, 'lease_up_schedule');
    if (r.state === 'unresolvable') {
      noteUnresolvable(ledger, 'lease_up_schedule', r.variants, 'CC-15', r.detail);
      markSkipped(ledger, 'CC-15', 'variant_unresolvable', 'lease_up_schedule');
      return;
    }
    ledger.resolutions['CC-15'] ??= {};
    ledger.resolutions['CC-15']!['lease_up_schedule'] = {
      ...(base.annotation.variant ? { variant: base.annotation.variant } : {}), via: 'preference',
    };
  }
  if (!base) {
    markSkipped(ledger, 'CC-15', 'not_applicable', 'no base variant');
    return;
  }
  const stabilizedNoi = base
    ? deepGet(base.content as Record<string, unknown>, 'stabilized_summary.annualized_noi')
    : undefined;
  const noiModel = roleAwareDirectRead(parsed, 'noi_model', 'CC-15', ledger);
  if (ledger.coverage['CC-15']?.reason === 'variant_unresolvable') return;
  const modelNoi = deepGet(noiModel?.content, 'net_operating_income');
  if (base && !noiModel) markSkipped(ledger, 'CC-15', 'section_absent', 'noi_model');
  else if (base && !(typeof stabilizedNoi === 'number' && Number.isFinite(stabilizedNoi))) markSkipped(ledger, 'CC-15', 'field_absent', 'lease_up_schedule.stabilized_summary.annualized_noi');
  else if (base && !(typeof modelNoi === 'number' && Number.isFinite(modelNoi) && modelNoi !== 0)) markSkipped(ledger, 'CC-15', 'field_absent', 'noi_model.net_operating_income');
  if (
    typeof stabilizedNoi === 'number' && Number.isFinite(stabilizedNoi) &&
    typeof modelNoi === 'number' && Number.isFinite(modelNoi) && modelNoi !== 0
  ) {
    markEvaluated(ledger, 'CC-15');
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

// ─── Cash-flow series (RFC 0034, §4.26) ──────────────────────────────────────
//
// Structural rules only, the lease-up split: date grammar, ordering, and the
// sign-change precondition are validation; the arithmetic over stated metrics
// belongs to `verifyCashFlowSeries` (cash-flow-series.ts). Multi-variant, so
// every variant is checked — a downside series with a gapped date is just as
// malformed as a base one.

function checkCashFlowContent(
  content: Record<string, unknown>,
  variant: string,
  issues: ValidationMessage[],
): void {
  const section = 'cash_flow_series';
  const label = variant === 'default' ? '' : ` (variant "${variant}")`;

  const dayCount = content['day_count'];
  if (dayCount != null && !isDayCountConvention(dayCount)) {
    issues.push({
      code: 'CF-01', severity: 'error', section, field: 'day_count',
      message: `CF-01: day_count${label} must be a registered convention (actual/365f, actual/360, 30/360us), not ${JSON.stringify(dayCount)}`,
    });
  }

  const series = content['series'];
  const rows = Array.isArray(series) ? series : [];
  if (!Array.isArray(series) || rows.length === 0) {
    issues.push({
      code: 'CF-02', severity: 'error', section, field: 'series',
      message: `CF-02: series${label} must be a non-empty array of dated flows`,
    });
    return;
  }

  // CF-01 (row grammar) / CF-02 (non-decreasing dates). One diagnostic per
  // defect: a row outside the grammar is not also reported as out of order.
  let hasNegative = false;
  let hasPositive = false;
  let prevOrdinal: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const date = rec['date'];
    const amount = rec['amount'];
    const kind = rec['kind'];

    const parsed = typeof date === 'string' ? parseISODate(date) : null;
    if (parsed === null) {
      issues.push({
        code: 'CF-01', severity: 'error', section, field: `series[${i}].date`,
        message: `CF-01: date ${JSON.stringify(date)}${label} is not a valid ISO-8601 calendar day (YYYY-MM-DD)`,
      });
      prevOrdinal = null;
    } else {
      const ordinal = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
      if (prevOrdinal !== null && ordinal < prevOrdinal) {
        issues.push({
          code: 'CF-02', severity: 'error', section, field: `series[${i}].date`,
          message: `CF-02: dates${label} must be non-decreasing; ${String(date)} precedes the prior row`,
        });
      }
      prevOrdinal = ordinal;
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      issues.push({
        code: 'CF-01', severity: 'error', section, field: `series[${i}].amount`,
        message: `CF-01: amount${label} must be a finite signed number, not ${JSON.stringify(amount)}`,
      });
    } else {
      if (amount < 0) hasNegative = true;
      if (amount > 0) hasPositive = true;
    }

    if (kind != null && !(CASH_FLOW_KINDS as readonly string[]).includes(kind as string)) {
      issues.push({
        code: 'CF-01', severity: 'error', section, field: `series[${i}].kind`,
        message: `CF-01: kind ${JSON.stringify(kind)}${label} is not a registered flow kind (${CASH_FLOW_KINDS.join(', ')})`,
      });
    }
  }

  // CF-03: a stated xirr needs a sign change — otherwise the stated number
  // cannot be the root of anything.
  const statedXirr = deepGet(content, 'stated_metrics.xirr');
  if (statedXirr != null && !(hasNegative && hasPositive)) {
    issues.push({
      code: 'CF-03', severity: 'error', section, field: 'stated_metrics.xirr',
      message: `CF-03: stated_metrics.xirr${label} is stated but the series has no sign change (needs at least one negative and one positive amount)`,
    });
  }
}

function checkCashFlowSeries(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const entry = parsed.sections['cash_flow_series'];
  if (!entry) return;
  const variants: Array<[string, UWBlock]> = isVariantMap(entry)
    ? Object.entries(entry as Record<string, UWBlock>)
    : [['default', entry as UWBlock]];
  for (const [variant, block] of variants) {
    checkCashFlowContent(block.content as Record<string, unknown>, variant, issues);
  }
}

// ─── Distribution waterfall (RFC 0035 + RFC 0036, §4.27) ─────────────────────
//
// Structural rules only, the standing split: the ladder grammar, the cash
// reference, and the capital precondition are validation; the allocation
// arithmetic belongs to `verifyWaterfall` (waterfall.ts). Multi-variant.

const RATIO_QUANTUM = 1e-4;
const RATE_QUANTUM = 1e-6;

function sumsToOne(a: unknown, b: unknown): boolean {
  return typeof a === 'number' && typeof b === 'number' &&
    Number.isFinite(a) && Number.isFinite(b) &&
    a >= 0 && a <= 1 && b >= 0 && b <= 1 &&
    Math.abs(a + b - 1) < RATIO_QUANTUM;
}

/**
 * RFC 0059. The clawback is a terminal true-up, so the only structural
 * questions are whether its basis carries the input it needs, whether the cap
 * is the one cap that exists, and whether the rates are fractions.
 */
function checkWaterfallClawback(
  content: Record<string, unknown>,
  tiers: readonly WaterfallTier[],
  section: string,
  label: string,
  issues: ValidationMessage[],
): void {
  const raw = content['clawback'];
  if (raw == null) return;
  const push = (code: string, field: string, message: string) => {
    issues.push({ code, severity: 'error', section, field: `clawback.${field}`, message: `${code}: ${message}${label}` });
  };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    push('WF-10', 'basis', 'clawback must be an object stating a basis and a cap');
    return;
  }
  const cb = raw as Record<string, unknown>;
  const basis = cb['basis'];
  const BASES = ['lp_preferred_shortfall', 'lp_irr_floor', 'lp_em_floor'];
  if (typeof basis !== 'string' || !BASES.includes(basis)) {
    push('WF-10', 'basis', `basis must be one of ${BASES.join(', ')} — the vocabulary is closed`);
  } else if (basis === 'lp_irr_floor') {
    const rate = cb['floor_rate'];
    if (!(typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate < 1)) {
      push('WF-10', 'floor_rate', 'lp_irr_floor requires floor_rate as a fraction in (0,1) — 0.12 is 12%, not 12');
    }
  } else if (basis === 'lp_em_floor') {
    const mult = cb['floor_multiple'];
    if (!(typeof mult === 'number' && Number.isFinite(mult) && mult > 1)) {
      push('WF-10', 'floor_multiple', 'lp_em_floor requires floor_multiple greater than 1');
    }
  }

  // WF-11: a preferred-shortfall floor with no preferred tier to measure it.
  if (basis === 'lp_preferred_shortfall' && !tiers.some((t) => t?.type === 'preferred_return')) {
    push('WF-11', 'basis', 'lp_preferred_shortfall needs a preferred_return tier — without one there is no accrual to fall short of');
  }

  // WF-12: the cap is not a choice.
  if (cb['cap'] !== 'promote_received') {
    push('WF-12', 'cap', 'cap must be "promote_received" — a GP cannot owe back more promote than it received, and any other cap is a different instrument');
  }

  // WF-13: a stated tax rate is a fraction.
  const tax = cb['net_of_tax_rate'];
  if (tax != null && !(typeof tax === 'number' && Number.isFinite(tax) && tax >= 0 && tax < 1)) {
    push('WF-13', 'net_of_tax_rate', 'net_of_tax_rate must be a fraction in [0,1) — 0.37 is 37%, not 37');
  }
}

function checkWaterfallContent(
  content: Record<string, unknown>,
  variant: string,
  parsed: ParsedUWFile,
  issues: ValidationMessage[],
): void {
  const section = 'distribution_waterfall';
  const label = variant === 'default' ? '' : ` (variant "${variant}")`;
  const wf01 = (field: string, message: string) => {
    issues.push({ code: 'WF-01', severity: 'error', section, field, message: `WF-01: ${message}${label}` });
  };

  const split = content['equity_split'] as Record<string, unknown> | undefined;
  if (!split || !sumsToOne(split['lp'], split['gp'])) {
    wf01('equity_split', 'equity_split must state lp and gp fractions in [0,1] summing to 1.0');
  }

  const tiers = content['tiers'];
  const rows = Array.isArray(tiers) ? (tiers as WaterfallTier[]) : [];
  if (!Array.isArray(tiers) || rows.length === 0) {
    wf01('tiers', 'tiers must be a non-empty ordered ladder');
  } else {
    // Ladder order: return_of_capital? preferred_return? catch_up? split+
    const ORDER: Record<string, number> = { return_of_capital: 0, preferred_return: 1, catch_up: 2, split: 3 };
    let prevRank = -1;
    let splitCount = 0;
    let prevEm: number | null = null;
    let prevIrr: number | null = null;
    const seenSingleton = new Set<string>();
    rows.forEach((tier, i) => {
      const type = tier && typeof tier === 'object' ? (tier as { type?: unknown }).type : undefined;
      if (typeof type !== 'string' || !(type in ORDER)) {
        wf01(`tiers[${i}].type`, `unknown tier type ${JSON.stringify(type)} (closed: return_of_capital, preferred_return, catch_up, split)`);
        return;
      }
      const rank = ORDER[type]!;
      // Equal-rank repetition of a singleton is the duplicate defect below,
      // not an ordering defect — one diagnostic per defect.
      if (rank < prevRank) {
        wf01(`tiers[${i}]`, `tier order must be return_of_capital → preferred_return → catch_up → split(s); ${type} is out of order`);
      }
      prevRank = Math.max(prevRank, rank);
      if (type !== 'split') {
        if (seenSingleton.has(type)) wf01(`tiers[${i}]`, `duplicate ${type} tier; each appears at most once`);
        seenSingleton.add(type);
      }
      if (type === 'preferred_return') {
        const t = tier as { rate?: unknown; accrual?: unknown };
        if (!(typeof t.rate === 'number' && t.rate > 0 && t.rate < 1)) {
          wf01(`tiers[${i}].rate`, 'preferred_return rate must be a fraction in (0, 1)');
        }
        if (t.accrual !== 'simple' && t.accrual !== 'compound_annual') {
          wf01(`tiers[${i}].accrual`, `accrual must be "simple" or "compound_annual", not ${JSON.stringify(t.accrual)}`);
        }
      }
      if (type === 'catch_up') {
        const t = tier as { gp_share?: unknown; target_promote?: unknown };
        const gs = t.gp_share;
        const tp = t.target_promote;
        if (!(typeof gs === 'number' && gs > 0 && gs <= 1) || !(typeof tp === 'number' && tp > 0 && tp < 1)) {
          wf01(`tiers[${i}]`, 'catch_up must state gp_share in (0, 1] and target_promote in (0, 1)');
        } else if (!(gs > tp)) {
          wf01(`tiers[${i}].gp_share`, `catch_up gp_share (${gs}) must exceed target_promote (${tp}) or the tier can never fill`);
        }
      }
      if (type === 'split') {
        splitCount++;
        const t = tier as { lp_share?: unknown; gp_share?: unknown; until_lp_em?: unknown; until_lp_irr?: unknown; hurdle_mode?: unknown };
        if (!sumsToOne(t.lp_share, t.gp_share)) {
          wf01(`tiers[${i}]`, 'split lp_share and gp_share must be fractions in [0,1] summing to 1.0');
        }
        // Hurdles (RFC 0035 `until_lp_em`, RFC 0036 `until_lp_irr`): each in
        // range, a capped split paying the LP, the terminal split uncapped by
        // either field, and each kind of hurdle strictly increasing down the
        // ladder (a later tier hurdled at or below an earlier one has
        // capacity zero by construction and would pay nothing, silently).
        let emOk = false;
        let irrOk = false;
        if (t.until_lp_em != null) {
          if (!(typeof t.until_lp_em === 'number' && Number.isFinite(t.until_lp_em) && t.until_lp_em > 0)) {
            wf01(`tiers[${i}].until_lp_em`, 'until_lp_em must be a positive equity multiple');
          } else {
            emOk = true;
          }
        }
        if (t.until_lp_irr != null) {
          if (!(typeof t.until_lp_irr === 'number' && t.until_lp_irr > 0 && t.until_lp_irr < 1)) {
            wf01(`tiers[${i}].until_lp_irr`, 'until_lp_irr must be a fraction in (0, 1) — an IRR hurdle rate, 0.12 not 12');
          } else {
            irrOk = true;
          }
        }
        if (t.hurdle_mode != null) {
          if (t.hurdle_mode !== 'both' && t.hurdle_mode !== 'any') {
            wf01(`tiers[${i}].hurdle_mode`, 'hurdle_mode must be "both" or "any"');
          } else if (t.until_lp_em == null || t.until_lp_irr == null) {
            wf01(`tiers[${i}].hurdle_mode`, 'hurdle_mode is only permitted when both until_lp_em and until_lp_irr are stated');
          }
        }
        if (t.until_lp_em != null || t.until_lp_irr != null) {
          if ((emOk || irrOk) && !(typeof t.lp_share === 'number' && t.lp_share > 0)) {
            wf01(`tiers[${i}].lp_share`, 'a capped split must pay the LP (lp_share > 0) or the cap can never bind');
          }
          if (i === rows.length - 1) {
            const field = t.until_lp_irr != null && t.until_lp_em == null ? 'until_lp_irr' : 'until_lp_em';
            wf01(`tiers[${i}].${field}`, 'the final split must be uncapped — capped ladders need a terminal residual tier');
          }
        }
        if (emOk) {
          const em = t.until_lp_em as number;
          if (prevEm !== null && !(em > prevEm + RATIO_QUANTUM)) {
            wf01(`tiers[${i}].until_lp_em`, `until_lp_em (${em}) must exceed the earlier tier's hurdle (${prevEm}) — a later tier hurdled at or below an earlier one can never pay`);
          }
          prevEm = prevEm === null ? em : Math.max(prevEm, em);
        }
        if (irrOk) {
          const irr = t.until_lp_irr as number;
          if (prevIrr !== null && !(irr > prevIrr + RATE_QUANTUM)) {
            wf01(`tiers[${i}].until_lp_irr`, `until_lp_irr (${irr}) must exceed the earlier tier's hurdle (${prevIrr}) — a later tier hurdled at or below an earlier one can never pay`);
          }
          prevIrr = prevIrr === null ? irr : Math.max(prevIrr, irr);
        }
      }
    });
    if (splitCount === 0) {
      wf01('tiers', 'the ladder must end in at least one split tier');
    }
  }

  // WF-10 .. WF-15: the RFC 0059 clawback provision.
  checkWaterfallClawback(content, rows, section, label, issues);

  // WF-02 / WF-03: the cash reference.
  const ref = content['cash_flow_ref'] as Record<string, unknown> | undefined;
  const refVariant = ref && typeof ref['variant'] === 'string' ? (ref['variant'] as string) : null;
  if (refVariant === null) {
    issues.push({
      code: 'WF-02', severity: 'error', section, field: 'cash_flow_ref',
      message: `WF-02: cash_flow_ref must name a cash_flow_series variant${label}`,
    });
    return;
  }
  const cfEntry = parsed.sections['cash_flow_series'];
  const cfBlock = cfEntry
    ? (isVariantMap(cfEntry)
      ? (cfEntry as Record<string, UWBlock>)[refVariant]
      : (refVariant === 'default' ? (cfEntry as UWBlock) : undefined))
    : undefined;
  if (!cfBlock) {
    issues.push({
      code: 'WF-02', severity: 'error', section, field: 'cash_flow_ref.variant',
      message: `WF-02: cash_flow_ref.variant ${JSON.stringify(refVariant)}${label} does not resolve to a cash_flow_series variant in this document`,
    });
    return;
  }
  const seriesRows = (cfBlock.content as Record<string, unknown>)['series'];
  if (Array.isArray(seriesRows) && !seriesRows.some((r) =>
    r && typeof r === 'object' && typeof (r as Record<string, unknown>)['amount'] === 'number' &&
    ((r as Record<string, unknown>)['amount'] as number) < 0)) {
    issues.push({
      code: 'WF-03', severity: 'error', section, field: 'cash_flow_ref.variant',
      message: `WF-03: the referenced series${label} has no contribution (no negative amount); a waterfall over pure inflows has no capital to return`,
    });
  }

  // WF-15 (RFC 0059): a clawback provision is unexercisable without a terminal
  // distribution to have overpaid out of. A warning, not an error — the
  // provision may legitimately be stated ahead of the exit.
  if (content['clawback'] != null && Array.isArray(seriesRows)) {
    const lastPositive = [...seriesRows].reverse().find((r) =>
      r && typeof r === 'object' && typeof (r as Record<string, unknown>)['amount'] === 'number' &&
      ((r as Record<string, unknown>)['amount'] as number) > 0);
    if (lastPositive === undefined) {
      issues.push({
        code: 'WF-15', severity: 'warning', section, field: 'clawback',
        message: `WF-15: a clawback provision is stated but the referenced series${label} has no distribution, so no promote can have been paid and the provision is unexercisable as stated`,
      });
    }
  }
}

function checkWaterfall(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const entry = parsed.sections['distribution_waterfall'];
  if (!entry) return;
  const variants: Array<[string, UWBlock]> = isVariantMap(entry)
    ? Object.entries(entry as Record<string, UWBlock>)
    : [['default', entry as UWBlock]];
  for (const [variant, block] of variants) {
    checkWaterfallContent(block.content as Record<string, unknown>, variant, parsed, issues);
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

// ─── Document currency identity (RFC 0046) ──────────────────────────────────

function checkCurrencyIdentity(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const declared = parsed.frontmatter.currency_code;
  if (declared == null) return; // absent preserves legacy symbol behavior
  if (isCurrencyCode(declared)) return;
  issues.push({
    code: 'CUR-01', severity: 'error', field: 'currency_code',
    message: `CUR-01: currency_code ${JSON.stringify(declared)} is not three uppercase ASCII letters; currency identity is never inferred from locale or a display symbol`,
    value: declared,
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

// `manual` left SOURCE_TAGS at format 2.0 (actor-only), so the set needs no
// exemption filter any more; the name survives for its call sites' clarity.
const NON_MANUAL_SOURCE_TAGS: ReadonlySet<string> = new Set(SOURCE_TAGS);

function checkSourceVocabulary(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  // The 2.0 boundary is per-FILE (format spec v2 §1.3): in a uw_version 2.0
  // file the actor grammar is enforced (SRC-01/SRC-02 are errors, and the new
  // SRC-03 rejects the retired `resolution: "manual"` spelling); a 1.x file
  // keeps the 1.x warnings under this same validator — the only reading
  // consistent with the round-trip guarantee.
  const fileIsV2 = isV2File(parsed.frontmatter);
  const severity = fileIsV2 ? ('error' as const) : ('warning' as const);

  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const blocks = isVariantMap(entry)
      ? Object.values(entry as Record<string, UWBlock>)
      : [entry as UWBlock];

    for (const block of blocks) {
      if (fileIsV2 && block.meta?.resolution === 'manual') {
        issues.push({
          code: 'SRC-03',
          severity: 'error',
          section: sectionId,
          message: `Section ${sectionId} resolution is 'manual', which left the resolution vocabulary at 2.0 (actor-only). Use 'user_input' — 'uwmd migrate --to-v2' rewrites it mechanically.`,
        });
      }
      const src = block.meta?.source;
      if (typeof src !== 'string' || src.length === 0) continue; // absence is META/DQ territory

      if (NON_MANUAL_SOURCE_TAGS.has(src)) {
        issues.push({
          code: 'SRC-02',
          severity,
          section: sectionId,
          message: `Section ${sectionId} _meta.source is '${src}', a resolution tag in the actor field. Move it to _meta.resolution; readers treat the actor as absent.`,
        });
        continue;
      }

      if (parseActorSource(src).kind === 'invalid') {
        issues.push({
          code: 'SRC-01',
          severity,
          section: sectionId,
          message: `Section ${sectionId} _meta.source '${src}' is not 'manual' or '<namespace>/<id>' with a registered actor namespace (${['agent', 'document', 'system', 'institution'].join(', ')}).`,
        });
      }
    }
  }
}

// ─── META-V2-IN-V1 / META-V1-IN-V2: _meta shape by uw_version (RFC 0009) ─────
//
// A file's `uw_version` frontmatter is global and decides the `_meta` shape
// for every block in it (RFC 0009 resolved question 3). "Read both shapes" is
// a property of parsers, never of a single file: nested `_meta` in a 1.x file
// and flat `_meta` in a 2.0 file are both errors. Blocks without `_meta` at
// all carry no `meta_shape` and are exempt — absence stays META/DQ territory.

function checkMetaShape(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  const fileIsV2 = isV2File(parsed.frontmatter);

  const walk = (sectionId: string, block: UWBlock): void => {
    if (block.meta_shape === undefined) return;
    if (block.meta_shape === 'v2' && !fileIsV2) {
      issues.push({
        code: 'META-V2-IN-V1',
        severity: 'error',
        section: sectionId,
        message: `Section ${sectionId} carries the nested v2 _meta shape in a uw_version '${parsed.frontmatter.uw_version ?? '1.x'}' file. The nested shape requires uw_version "2.0" — run 'uwmd migrate --to-v2' to convert the whole file.`,
      });
      return;
    }
    if (block.meta_shape === 'v1' && fileIsV2) {
      issues.push({
        code: 'META-V1-IN-V2',
        severity: 'error',
        section: sectionId,
        message: `Section ${sectionId} carries the flat v1 _meta shape in a uw_version '${parsed.frontmatter.uw_version}' file. v2 writers MUST emit the nested shape for every block.`,
      });
    }
  };

  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    const blocks = isVariantMap(entry)
      ? Object.values(entry as Record<string, UWBlock>)
      : [entry as UWBlock];
    for (const block of blocks) walk(sectionId, block);
  }
  for (const [sectionId, blocks] of Object.entries(parsed.superseded)) {
    for (const block of blocks) walk(sectionId, block);
  }
  for (const block of parsed.pipeline_log) walk('pipeline_log', block);
  for (const block of parsed.custom_calculations) walk('custom_calculations', block);
  for (const block of parsed.custom_scenarios) walk('custom_scenarios', block);
  for (const [extId, block] of Object.entries(parsed.extensions)) walk(extId, block);
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
