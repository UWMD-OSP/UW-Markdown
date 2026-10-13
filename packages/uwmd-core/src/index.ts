// uwmd — .uw.md file format library
// Public API surface
//
// `@uwmd/core` is the starter toolkit built on `@uwmd/verify`, the reference
// implementation of the standard (RFC 0083). It re-exports verify's whole
// surface, so every 4.0.x name stays importable from here, and adds the starter
// products below: editor, runner, renderer, report, defaults and cascade,
// refinement, display formatting, the Excel emitter and the agents.
//
// Four names override verify's under the same name: `evaluateCalc` and
// `evaluateModuleCalculations` add the starter `display` string, and
// `issueReceipt` and `verifyReceipt` default the engine identity to
// `@uwmd/core`. An explicit export here shadows the `export *`.

export * from '@uwmd/verify';

// Receipts issued or verified through core name `@uwmd/core` (RFC 0083).
export { issueReceipt, verifyReceipt } from './receipt-engine.js';

export { compact, diff } from './compactor.js';
export { render, UnsupportedRenderFormatError, UnsupportedLocaleError, InvalidCurrencyCodeError } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';
export { renderReportHtml, REPORT_CSS } from './report.js';
export type { ReportOptions, ReportResult } from './report.js';
// Source edits wire the starter editor into the bindings (RFC 0083).
export { applyUWMDSourceEdit, createUWMCPApplyEditResult } from './bindings-edit.js';

export { writeAgentBlock, writeErrorEntry } from './runner.js';
export type { AgentOutput, RunOptions, RunResult } from './runner.js';

export { applyEdit, applyEditAsync, resolvePolicy } from './editor.js';
export type { EditContext, EditResult, EditOptions } from './editor.js';
// The exported evaluator adds the starter `display` string (RFC 0083).
export { evaluateCalc } from './calc-display.js';

export { emitFromAst, emitExcelFormula, emitCalcExcelFormula, ExcelEmitError } from './packs/index.js';
export type { ExcelEmitOptions } from './packs/index.js';
// Module calculation results carry the starter `display` string (RFC 0083).
export { evaluateModuleCalculations } from './calc-display.js';
export { AmbiguousInheritanceError, selectInheritedAssumption } from './cascade.js';
export type { InheritedAssumptions } from './cascade.js';

export {
  buildAgentContext,
  buildAgentPrompt,
  isContextReady,
  getLayerDependencies,
  BANCROFT_LAYERS,
} from './context.js';
export type { AgentContext, BancroftPrompt, LayerDefinition } from './context.js';

export { runBancroftAgent, runBancroftAgentStreaming } from './agents/bancroft.js';
export type { BancroftRunOptions, BancroftRunResult, ProgressEvent } from './agents/bancroft.js';
export { WRITE_UW_SECTION_TOOL, WRITE_MULTIPLE_SECTIONS_TOOL, MULTI_SECTION_LAYERS } from './agents/schemas.js';
export type { ToolOutput } from './agents/schemas.js';
// The provider seam (RFC-free, additive). Deliberately NOT re-exported from
// browser.ts: `createAnthropicProvider` reaches `@anthropic-ai/sdk`, and the
// browser entry must never pull it in.
export { AgentProviderError } from './agents/provider.js';
export type {
  AgentProvider,
  AgentRequest,
  AgentCompletion,
  AgentToolCall,
  AgentToolSchema,
  AgentMessage,
} from './agents/provider.js';
export { createAnthropicProvider } from './agents/providers/anthropic.js';
export type { AnthropicProviderOptions } from './agents/providers/anthropic.js';
export {
  createReplayProvider,
  createRecordingProvider,
  parseAgentCassette,
  agentRequestFingerprint,
  CASSETTE_VERSION,
} from './agents/providers/replay.js';
export type { AgentCassette, RecordedExchange, RecordingProvider } from './agents/providers/replay.js';
export { generateBlankUWFile, INIT_SCENARIOS } from './init.js';

// ─── Section footing (line items → section totals) ────────────────────────────
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

// ─── Asset-class defaults & cascade (starter guide §V.7-§V.8) ──────────────────────
export {
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
  getAssetClassDefaults,
  getDefaultRange,
  listDefaultedFields,
} from './defaults.js';
export type { DefaultRange, DefaultUnit, AssetClassDefaults } from './defaults.js';

export { inferGaps, summarizeGaps } from './gaps.js';
export type { InferGapsOptions } from './gaps.js';

export { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';
export { REFERENCE_IMPLEMENTATION_MANIFEST } from './reference-implementation.js';

export { resolveValue, readInFile } from './cascade.js';
export type { CascadeContext, ResolvedValue, InvestorProfile, GlobalDefaults, SystemDefaults } from './cascade.js';

// ─── Display formatting ───────────────────────────────────────────────────────
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
  CASCADE_ORDER,
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
  AgentHostCapability,
} from './starter-protocol.js';

// Convenience re-export: diff result type
export type { SectionDiff } from './compactor.js';
export type { InitOptions } from './init.js';

export { rankGaps } from './refinement.js';
export type {
  RankGapsOptions,
  RankGapsResult,
  RankedGap,
  OutputSensitivity,
  NonMonotonicWarning,
} from './refinement.js';

export { buildContext } from './context-profiles.js';
export type {
  ContextProfile,
  BuildContextOptions,
  ContextResult,
} from './context-profiles.js';

export { parseCalculationContext } from './calculation-context.js';

export { DATA_CENTER_DEFAULTS, MANUFACTURED_HOUSING_DEFAULTS } from './defaults.js';
