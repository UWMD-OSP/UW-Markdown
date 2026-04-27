// uwmd — .uw.md file format library
// Public API surface

export { parseUWFile, getSection, getSectionVariant, deepGet } from './parser.js';
export { validateUWFile, lookupRemediation } from './validator.js';
export { compact, diff } from './compactor.js';
export { render } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';

export { writeAgentBlock, writeErrorEntry, buildMeta } from './runner.js';
export type { AgentOutput, RunOptions, RunResult } from './runner.js';

export { applyEdit, resolvePolicy } from './editor.js';
export type { EditContext, EditResult } from './editor.js';

export { evaluateCalc, parseExpression, evaluate, BUILTINS, CalcError, calcError } from './calc/index.js';
export type { CalcValue, Builtin, CalcErrorCode } from './calc/index.js';

export {
  MULTIFAMILY_PACK,
  emitFromAst,
  emitExcelFormula,
  ExcelEmitError,
} from './packs/index.js';
export type { ExcelEmitOptions } from './packs/index.js';

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
export { generateBlankUWFile } from './init.js';

export type {
  // Core types
  UWBlock,
  UWFenceAnnotation,
  UWMeta,
  UWFrontmatter,
  UWPipelineState,
  UWQuickMetrics,
  ParsedUWFile,
  ParsedSections,
  // Options
  ParseOptions,
  InstitutionConfig,
  // Validation
  ValidationMessage,
  ValidationResult,
  StageReadiness,
  FinancialThresholds,
  // Enums
  ConfidenceLevel,
  PipelineStatus,
  ValidationSeverity,
  DealStage,
  AssetClass,
} from './types.js';

export { DEFAULT_THRESHOLDS } from './types.js';

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
export type {
  CurrencyOptions,
  PercentOptions,
  RatioOptions,
  CountOptions,
  DateOptions,
  NullOptions,
} from './format.js';

// ─── Protocol surface ─────────────────────────────────────────────────────────
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

// Convenience re-export: diff result type
export type { SectionDiff } from './compactor.js';
export type { InitOptions } from './init.js';
