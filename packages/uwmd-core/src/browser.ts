// uwmd — browser-safe subset of the public API.
//
// This entry point excludes everything that pulls in node-only modules so it
// can be bundled directly into a web app (Tier-2 web editor, calc-aware editor,
// etc.) without polyfills or build-time exclusion rules.
//
// It re-exports the whole of `@uwmd/verify/browser` (RFC 0083), which has no
// Node-only export, and adds the browser-safe starter products below. Excluded
// vs. the main entry: `applyEditAsync`, `buildContext`, `CASCADE_ORDER` and
// `REFERENCE_IMPLEMENTATION_MANIFEST`.
//
// As in the main entry, `evaluateCalc`, `evaluateModuleCalculations` and
// `issueReceipt` are core's wrappers, which shadow verify's.

export * from '@uwmd/verify/browser';

export { diff } from './compactor.js';
export { render, UnsupportedRenderFormatError, UnsupportedLocaleError, InvalidCurrencyCodeError } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';
export { renderReportHtml, REPORT_CSS } from './report.js';
export type { ReportOptions, ReportResult } from './report.js';
// Source edits wire the starter editor into the bindings (RFC 0083).
export { applyUWMDSourceEdit, createUWMCPApplyEditResult } from './bindings-edit.js';

export { writeAgentBlock, writeErrorEntry } from './runner.js';
export type { AgentOutput, RunOptions, RunResult } from './runner.js';

export { applyEdit, resolvePolicy } from './editor.js';
export type { EditContext, EditResult } from './editor.js';

export { deriveRentRoll, rentRollVariant } from './rentroll.js';
export type {
  RentRollVariant,
  RentRollBasis,
  RentRollDerivation,
  DerivedField,
  DerivedKind,
} from './rentroll.js';
export { deriveOperatingStatement } from './opstatement.js';
export type { OperatingStatementDerivation } from './opstatement.js';
export { deriveDebt } from './debt.js';
export type { DebtDerivation } from './debt.js';
export { deriveSourcesUses } from './sourcesuses.js';
export type { SourcesUsesDerivation } from './sourcesuses.js';
export { deriveValuation } from './valuation.js';
export type { ValuationDerivation } from './valuation.js';
export { deriveDCF } from './dcf.js';
export type { DCFDerivation } from './dcf.js';
// The exported evaluator adds the starter `display` string (RFC 0083).
export { evaluateCalc } from './calc-display.js';

export { emitFromAst, emitExcelFormula, emitCalcExcelFormula, ExcelEmitError } from './packs/index.js';
export type { ExcelEmitOptions } from './packs/index.js';
// Module calculation results carry the starter `display` string (RFC 0083).
export { evaluateModuleCalculations } from './calc-display.js';
export { AmbiguousInheritanceError, selectInheritedAssumption } from './cascade.js';
export type { InheritedAssumptions } from './cascade.js';

export { generateBlankUWFile, INIT_SCENARIOS } from './init.js';

// ─── Intelligence surfaces (browser-safe: no node, no SDK) ───────────────────
// Cascade resolution, value-of-information gap ranking, completeness gaps,
// asset-class default tables, and calc dependency introspection. These power
// the editor's "what's resolved / what's missing / what to ask next" panels
// and the calc-transparency view.
export { resolveValue, readInFile } from './cascade.js';
export type { CascadeContext, ResolvedValue } from './cascade.js';
export { rankGaps } from './refinement.js';
export type {
  RankGapsOptions,
  RankGapsResult,
  RankedGap,
  OutputSensitivity,
  NonMonotonicWarning,
} from './refinement.js';
export { inferGaps, summarizeGaps } from './gaps.js';
export type { InferGapsOptions } from './gaps.js';
export {
  getAssetClassDefaults,
  getDefaultRange,
  listDefaultedFields,
  MULTIFAMILY_DEFAULTS,
  OFFICE_DEFAULTS,
  RETAIL_DEFAULTS,
  INDUSTRIAL_DEFAULTS,
  SELF_STORAGE_DEFAULTS,
  HOSPITALITY_DEFAULTS,
  SENIOR_HOUSING_DEFAULTS,
  STUDENT_HOUSING_DEFAULTS,
  LAND_DEFAULTS,
  MIXED_USE_DEFAULTS,
} from './defaults.js';
export type { AssetClassDefaults, DefaultRange, DefaultUnit } from './defaults.js';

export {
  formatCurrency,
  formatPercent,
  formatRatio,
  formatCount,
  formatDate,
  formatNull,
  formatValue,
  formatPercentCsv,
  formatNumberCsv,
} from './format.js';
export {
  BUILTIN_FORMAT_RULES,
  formatNumberWithRules,
  currencyWithRules,
  dateWithRules,
} from './format-rules.js';
export type { LocaleFormatRules } from './format-rules.js';
export type {
  CurrencyOptions,
  PercentOptions,
  RatioOptions,
  CountOptions,
  DateOptions,
  NullOptions,
} from './format.js';
// Starter-product protocol tables (RFC 0083): same names, from starter-protocol.ts.
export {
  DEFAULT_NUMBER_FORMAT,
  DEFAULT_DATE_FORMAT,
  BUILTIN_VIEW_MODELS,
} from './starter-protocol.js';
export type {
  CapabilityRejection,
  CapabilityVerifyContext,
  CapabilityVerdict,
  CapabilityVerifier,
  NumberFormatRules,
  DateFormatRules,
  ConfidenceBadgeStyle,
  SourceBadge,
  FlagSeverity,
  ViewModelRegistry,
} from './starter-protocol.js';

export type { SectionDiff } from './compactor.js';
export type { InitOptions } from './init.js';

// Receipts (RFC 0016) — issuance and verification are browser-safe: SHA-256
// comes from Web Crypto via `integrity.sha256TextHex`, and no signing backend
// is bundled here. Receipts issued through core name `@uwmd/core` as their
// issuer; `verifyReceipt` is verify's.
export { issueReceipt } from './receipt-engine.js';
export { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

export { parseCalculationContext } from './calculation-context.js';

export { DATA_CENTER_DEFAULTS, MANUFACTURED_HOUSING_DEFAULTS } from './defaults.js';
