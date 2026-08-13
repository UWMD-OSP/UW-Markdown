// uwmd — .uw.md file format library
// Public API surface

export { parseUWFile, getSection, getSectionVariant, deepGet } from './parser.js';
export { validateUWFile, lookupRemediation } from './validator.js';
export { compact, diff } from './compactor.js';
export { render, UnsupportedRenderFormatError } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';
export { renderReportHtml, REPORT_CSS } from './report.js';
export type { ReportOptions, ReportResult } from './report.js';
export {
  UW_LITE_REPRESENTATION_ID,
  UWX_REPRESENTATION_ID,
  UW_LITE_REPRESENTATION_VERSION,
  UWX_REPRESENTATION_VERSION,
  UW_LITE_MEDIA_TYPE,
  UWX_MEDIA_TYPE,
  UW_LITE_EXTENSION,
  UW_LITE_SOURCE_DESCRIPTOR,
  UWX_SOURCE_DESCRIPTOR,
  UWX_EXTENSION,
  UWSourceRepresentationError,
  detectUWSourceRepresentation,
  migrateLegacyUWMarkdown,
} from './source-representation.js';
export type {
  UWSourceRepresentation,
  UWSourceDetection,
  UWSourceMigration,
} from './source-representation.js';

export {
  UWLiteError,
  parseUWLite,
  canonicalizeUWLiteFinancial,
  renderCanonicalUWLite,
} from './lite.js';
export type {
  UWLiteScalar,
  UWLiteSourceRange,
  UWLiteIssue,
  UWLiteNode,
  UWLiteFieldNode,
  ParsedUWLite,
} from './lite.js';

export {
  UW_LITE_BRIDGE_PROFILE,
  UW_LITE_SOURCE_EXTENSION,
  UW_LITE_FIELD_MAPPINGS,
  UWLiteBridgeError,
  compileUWLite,
  projectUWEnvelopeToLite,
  stringifyUWX,
} from './lite-bridge.js';
export type {
  UWLiteFieldMapping,
  UWLiteCompilationIssue,
  UWLiteCompilationReport,
  UWLiteCompilationResult,
  UWLiteProjectionReport,
  UWLiteProjectionResult,
} from './lite-bridge.js';

export {
  UW_JSON_REPRESENTATION_VERSION,
  UW_JSON_MEDIA_TYPE,
  UWJsonError,
  toUWJson,
  stringifyUWEnvelope,
  stringifyUWJson,
  stringifyUWJsonWithDigest,
  parseUWJson,
  parseUWJsonVerified,
  fromUWJson,
  UW_JSON_CODEC,
} from './uwjson.js';
export type { ToUWJsonOptions } from './uwjson.js';

export {
  UW_XML_REPRESENTATION_VERSION,
  UW_XML_MEDIA_TYPE,
  UW_XML_NAMESPACE,
  UWXmlError,
  stringifyUWXml,
  parseUWXml,
  parseUWXmlVerified,
  UW_XML_CODEC,
} from './uwxml.js';
export type { UWXmlOptions } from './uwxml.js';

export {
  UW_CSV_BUNDLE_VERSION,
  UW_CSV_BUNDLE_MEDIA_TYPE,
  UWCSVError,
  encodeUWCSVBundle,
  decodeUWCSVBundle,
  encodeUWCSVZip,
  decodeUWCSVZip,
  UW_CSV_BUNDLE_CODEC,
} from './uwcsv.js';
export type { UWCSVBundle, UWCSVDecodeOptions } from './uwcsv.js';
export { CORE_CODEC_REGISTRY, encodeUWDocument, decodeUWDocument } from './codecs.js';
export {
  UWMD_PUBLIC_ORIGIN,
  UWMD_DEAL_RESOURCE_TEMPLATE,
  UWBindingError,
  uwmdDealResourceURI,
  uwmdETag,
  createUWHTTPResponse,
  decodeUWHTTPRequest,
  assertUWIfMatch,
  createUWMCPResource,
  createUWMCPGetDocumentResult,
  createUWMCPValidationResult,
  createUWMCPListRepresentationsResult,
  applyUWMDSourceEdit,
  createUWMCPApplyEditResult,
} from './bindings.js';
export type {
  UWHTTPBody,
  UWHTTPResponse,
  UWHTTPResponseOptions,
  UWCSVView,
  UWMCPResourceContent,
  UWMCPResourceLink,
  UWMCPToolResult,
  UWMCPDocumentOptions,
  UWSourceEditResult,
} from './bindings.js';

export {
  UW_ENVELOPE_VERSION,
  UWEnvelopeError,
  toUWEnvelope,
  fromUWEnvelope,
  envelopeSemanticValue,
  canonicalizeUWEnvelope,
  computeEnvelopeDigest,
  stampEnvelopeDigest,
  verifyEnvelopeDigest,
  areEnvelopesEquivalent,
  assertUWEnvelope,
} from './envelope.js';
export type {
  UWEnvelopeBlock,
  UWEnvelopeSectionEntry,
  UWDocumentEnvelope,
  ToEnvelopeOptions,
  EnvelopeDigestVerification,
} from './envelope.js';

export {
  negotiateRepresentation,
  resolveInputRepresentation,
  RepresentationNegotiationError,
} from './negotiation.js';
export type { NegotiationOptions, NegotiatedRepresentation } from './negotiation.js';
export { CodecRegistry, UWCodecError } from './codec.js';
export type {
  UWCodec,
  RepresentationDescriptor,
  RepresentationDirection,
  RepresentationFidelity,
} from './codec.js';

export { writeAgentBlock, writeErrorEntry, buildMeta } from './runner.js';
export type { AgentOutput, RunOptions, RunResult } from './runner.js';

export { applyEdit, applyEditAsync, resolvePolicy } from './editor.js';
export type { EditContext, EditResult, EditOptions } from './editor.js';

export { evaluateCalc, parseExpression, evaluate, BUILTINS, CalcError, calcError } from './calc/index.js';
export type { CalcValue, Builtin, CalcErrorCode } from './calc/index.js';

export {
  MULTIFAMILY_PACK,
  OFFICE_PACK,
  RETAIL_PACK,
  INDUSTRIAL_PACK,
  SELF_STORAGE_PACK,
  HOSPITALITY_PACK,
  SENIOR_HOUSING_PACK,
  STUDENT_HOUSING_PACK,
  LAND_PACK,
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

export { runBancroftAgent, runBancroftAgentStreaming } from './agents/bancroft.js';
export type { BancroftRunOptions, BancroftRunResult, ProgressEvent } from './agents/bancroft.js';
export { WRITE_UW_SECTION_TOOL, WRITE_MULTIPLE_SECTIONS_TOOL, MULTI_SECTION_LAYERS } from './agents/schemas.js';
export type { ToolOutput } from './agents/schemas.js';
export { generateBlankUWFile } from './init.js';

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

// ─── Asset-class defaults & cascade (Protocol §V.7-§V.8) ──────────────────────
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
  getAssetClassDefaults,
  getDefaultRange,
  listDefaultedFields,
} from './defaults.js';
export type { DefaultRange, DefaultUnit, AssetClassDefaults } from './defaults.js';

export { inferGaps, summarizeGaps, readGapsContent } from './gaps.js';
export type { GapItem, GapReason, GapSummary, GapsContent, InferGapsOptions } from './gaps.js';

export {
  sha256Hex,
  computeBlockHash,
  verifyChain,
  verifyProvenance,
} from './integrity.js';
export type { IntegrityCode, IntegrityIssue, IntegrityResult } from './integrity.js';

export { canonicalize } from './integrity-canonical.js';

export { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

export {
  UW_RECEIPT_VERSION,
  UW_LITE_CANONICALIZATION,
  UWX_CANONICALIZATION,
  RECEIPT_RESULT_TOLERANCE,
  BUILTIN_POLICY_SET,
  BUILTIN_POLICY_SET_VERSION,
  ReceiptError,
  resolveReceiptSubject,
  computeReceiptResults,
  computeResultsDigest,
  issueReceipt,
  receiptSigningPayload,
  verifyReceipt,
  assertUWReceipt,
} from './receipts.js';
export type {
  UWReceipt,
  UWReceiptSubject,
  UWReceiptResult,
  UWReceiptComputation,
  UWReceiptPolicy,
  UWReceiptSignature,
  UWReceiptCanonicalization,
  UWReceiptVerdict,
  UWReceiptIssue,
  UWReceiptIssueCode,
  UWReceiptVerification,
  ReceiptErrorCode,
  ReceiptSignatureVerifier,
  ReceiptSubjectOptions,
  ReceiptSubjectResolution,
  ReceiptIssuanceOptions,
  ReceiptVerificationOptions,
} from './receipts.js';

export { resolveValue, readInFile } from './cascade.js';
export type {
  CascadeContext,
  ResolvedValue,
  MarketDataLookup,
  InvestorProfile,
  GlobalDefaults,
  SystemDefaults,
} from './cascade.js';

export type {
  // Core types
  UWBlock,
  UWFenceAnnotation,
  UWMeta,
  UWFieldOverride,
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
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  CASCADE_ORDER,
  SOURCE_TAGS,
  lookupIncompleteDataPolicy,
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
  CascadeStep,
  CanonicalSourceTag,
  GapAction,
  IncompleteDataPolicy,
} from './protocol.js';

// Convenience re-export: diff result type
export type { SectionDiff } from './compactor.js';
export type { InitOptions } from './init.js';

// ─── Refinement / context profiles (Protocol §IX, §X) ────────────────────────
export { extractDependencyGraph, getExprDependencies } from './calc/dependencies.js';
export type { DependencyGraph } from './calc/dependencies.js';

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
