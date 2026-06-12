// uwmd — browser-safe subset of the public API.
//
// This entry point excludes everything that pulls in node-only modules or the
// @anthropic-ai/sdk so it can be bundled directly into a web app (Tier-2 web
// editor, calc-aware editor, etc.) without polyfills or build-time exclusion
// rules.
//
// Excluded vs. the main entry: `runBancroftAgent`, `runBancroftAgentStreaming`,
// `WRITE_UW_SECTION_TOOL`, `WRITE_MULTIPLE_SECTIONS_TOOL`, `MULTI_SECTION_LAYERS`,
// `ToolOutput`, `BancroftRunOptions`, `BancroftRunResult`, `ProgressEvent`.
//
// Everything else — parser, validator, renderer, editor, calc engine, format
// helpers, protocol surface, types — is identical to the main entry.

export { parseUWFile, getSection, getSectionVariant, deepGet } from './parser.js';
export { validateUWFile, lookupRemediation } from './validator.js';
export { compact, diff } from './compactor.js';
export { render } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';
export { renderReportHtml, REPORT_CSS } from './report.js';
export type { ReportOptions, ReportResult } from './report.js';

export {
  UWJSON_VERSION,
  UWJsonError,
  toUWJson,
  stringifyUWJson,
  parseUWJson,
  fromUWJson,
} from './uwjson.js';
export type { UWJsonDocument, UWJsonBlock, ToUWJsonOptions } from './uwjson.js';

export { writeAgentBlock, writeErrorEntry, buildMeta } from './runner.js';
export type { AgentOutput, RunOptions, RunResult } from './runner.js';

export { applyEdit, resolvePolicy } from './editor.js';
export type { EditContext, EditResult } from './editor.js';

export { evaluateCalc, parseExpression, evaluate, BUILTINS, CalcError, calcError } from './calc/index.js';
export type { CalcValue, Builtin, CalcErrorCode } from './calc/index.js';

export {
  MULTIFAMILY_PACK,
  OFFICE_PACK,
  RETAIL_PACK,
  INDUSTRIAL_PACK,
  SELF_STORAGE_PACK,
  getPackForAssetClass,
  emitFromAst,
  emitExcelFormula,
  ExcelEmitError,
} from './packs/index.js';
export type { ExcelEmitOptions } from './packs/index.js';

export {
  loadModuleManifest,
  createModuleRegistry,
  getModuleCalculationsForAssetClass,
  ModuleRegistryError,
} from './modules.js';
export type { ModuleRegistry, LoadModuleOptions, CreateModuleRegistryOptions } from './modules.js';

export {
  buildAgentContext,
  buildAgentPrompt,
  isContextReady,
  getLayerDependencies,
  BANCROFT_LAYERS,
} from './context.js';
export type { AgentContext, BancroftPrompt, LayerDefinition } from './context.js';

export { generateBlankUWFile } from './init.js';

export type {
  UWBlock,
  UWFenceAnnotation,
  UWMeta,
  UWFrontmatter,
  UWPipelineState,
  UWQuickMetrics,
  ParsedUWFile,
  ParsedSections,
  ParseOptions,
  InstitutionConfig,
  ValidationMessage,
  ValidationResult,
  StageReadiness,
  FinancialThresholds,
  ConfidenceLevel,
  PipelineStatus,
  ValidationSeverity,
  DealStage,
  AssetClass,
} from './types.js';

export { DEFAULT_THRESHOLDS } from './types.js';

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
export type {
  CurrencyOptions,
  PercentOptions,
  RatioOptions,
  CountOptions,
  DateOptions,
  NullOptions,
} from './format.js';

export {
  PROTOCOL_VERSION,
  FORMAT_VERSION,
  DEFAULT_NUMBER_FORMAT,
  DEFAULT_DATE_FORMAT,
  BUILTIN_VIEW_MODELS,
  BUILTIN_EDIT_POLICIES,
  BUILTIN_REMEDIATIONS,
} from './protocol.js';
export type {
  ViewerTier,
  ViewerRole,
  ViewerCapability,
  ImplementationManifest,
  SupportedLocale,
  NumberFormatRules,
  DateFormatRules,
  ConfidenceBadgeStyle,
  SourceBadge,
  FlagSeverity,
  FieldViewHint,
  SectionViewModel,
  ViewModelRegistry,
  EditAuthority,
  EditPolicy,
  EditOperation,
  IssueRemediation,
  CalcEvaluationContext,
  CalcResult,
  AgentHostCapability,
  ModuleManifest,
  ModuleSectionDecl,
  ModuleCalcDecl,
  ModuleValidationDecl,
  ModuleAgentLayerDecl,
  ModuleLoadResult,
  ProtocolError,
  ProtocolErrorCategory,
} from './protocol.js';

export type { SectionDiff } from './compactor.js';
export type { InitOptions } from './init.js';
