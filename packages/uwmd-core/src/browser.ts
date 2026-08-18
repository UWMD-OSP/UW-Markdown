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
export { render, UnsupportedRenderFormatError } from './renderer.js';
export type { RenderFormat, RenderTier, RenderOptions, RenderResult } from './renderer.js';
export { renderReportHtml, REPORT_CSS } from './report.js';
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
export type { ReportOptions, ReportResult } from './report.js';
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

export { evaluateCalc, parseExpression, evaluate, BUILTINS, CalcError, calcError } from './calc/index.js';
export type { CalcValue, Builtin, CalcErrorCode } from './calc/index.js';
// The §VIII.5 quantization boundary — browser-safe, and the web editor needs it
// to quantize hand-overridden fields the same way pack results are quantized.
export {
  quantizeDecimal,
  resolveRoundTo,
  DEFAULT_ROUND_TO,
  DEFAULT_ROUND_TO_BY_UNIT,
  MAX_ROUND_TO,
} from './calc/index.js';

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
  emitCalcExcelFormula,
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

// ─── RFC 0018: document profiles, lease abstracts, deal packages ─────────────
// All browser-safe: no I/O, no network, no hashing implementation imported.
export {
  BUILTIN_DOCUMENT_PROFILES,
  DEAL_UNDERWRITING_PROFILE,
  LEASE_ABSTRACT_PROFILE,
  SOURCE_NOTE_PROFILE,
  MARKET_DATA_PROFILE,
  DOCUMENT_PROFILE_PATTERN,
  lookupDocumentProfile,
  STANDARD_SECTION_IDS,
  isStandardSectionId,
  EXTENSION_SECTION_PREFIX,
  BUILTIN_EDGE_TYPES,
  lookupEdgeType,
  isEdgeTypeValidOnLayer,
} from './protocol.js';
export type { DocumentProfile, UWEdgeLayer, UWEdgeEndpointKind, UWEdgeTypeDef } from './protocol.js';
export {
  UW_PACKAGE_VERSION,
  UW_PACKAGE_ZIP_CODEC,
  UW_PACKAGE_ZIP_MEDIA_TYPE,
  UW_PACKAGE_CONTEXT_CODEC,
  UW_PACKAGE_CONTEXT_MEDIA_TYPE,
  CONTEXT_INLINABLE_ROLES,
  UWPackageError,
  isSafeMemberPath,
  validateUWDealPackageManifest,
  assertUWDealPackageManifest,
  projectPackageLinksToEntityEdges,
  edgeTypesForLayer,
} from './deal-package.js';
export type {
  UWDealPackageManifest,
  UWPackageMember,
  UWPackageLink,
  UWMemberRole,
  UWSourceReference,
  UWEntityEdge,
} from './deal-package.js';
export {
  projectUWDealPackageContext,
  validateUWDealPackageContext,
  verifyContextContentDigests,
} from './deal-package-context.js';
export type {
  UWDealPackageContext,
  UWContextContent,
  UWSourceEvidenceDescriptor,
  ProjectContextOptions,
} from './deal-package-context.js';
export {
  LEASE_ABSTRACT_PROFILE_ID,
  LEASE_ABSTRACT_GROUPS,
  LEASE_TERM_STATUSES,
  LEASE_ARTIFACT_KINDS,
  LeaseAbstractError,
  validateLeaseAbstract,
  assertLeaseAbstract,
  projectLeaseAbstractToRentRoll,
} from './lease-abstract.js';
export type {
  LeaseAbstract,
  LeaseAbstractGroup,
  LeaseTermValue,
  LeaseTermStatus,
  LeaseArtifactKind,
  SourceRef,
  RentRollProjectionRow,
  RentRollProjectionReport,
  RentRollProjectionResult,
} from './lease-abstract.js';
export {
  UWPART_EXTENSION,
  UWPART_MEDIA_TYPE,
  UWPART_REPRESENTATION_ID,
  UWPART_VERSION,
  EXTERNAL_ANNOTATION_KEY,
  CompositionError,
  parseUWPart,
  readExternalDirective,
  validateExternalDirective,
  resolveComposition,
  resolveComposite,
  DEFAULT_MAX_COMPOSITION_DEPTH,
  DEFAULT_MAX_COMPOSITION_MEMBERS,
  externalizeSection,
  stringifyUWPart,
} from './composition.js';
export { AmbiguousInheritanceError, selectInheritedAssumption } from './cascade.js';
export type { InheritedAssumptions } from './cascade.js';
export type {
  UWPart,
  ParseUWPartOptions,
  ExternalSectionDirective,
  CompositionErrorCode,
  CompositionStatus,
  CompositionResolution,
  ResolveCompositionOptions,
  CompositeStatus,
  CompositeResolution,
  CompositeLink,
  ResolveCompositeOptions,
  StaleMember,
  ExternalizeSectionOptions,
  ExternalizationResult,
} from './composition.js';
export {
  MARKET_DATA_PROFILE_ID,
  MARKET_OBSERVATIONS_SECTION,
  DEFAULT_MARKET_DATA_STALENESS_SECONDS,
  MarketDataError,
  validateMarketDataDocument,
  parseMarketDataDocument,
  createDocumentMarketData,
  selectCurrentMarketData,
  promoteMarketObservation,
  isDealFieldPath,
  isValidAsOf,
} from './market-data.js';
export type {
  MarketDataDocument,
  MarketObservation,
  MarketObservationRange,
  DocumentMarketDataOptions,
  PromoteObservationOptions,
  PromotedObservation,
} from './market-data.js';
export {
  PACKAGE_MANIFEST_PATH,
  encodeUWDealPackageZip,
  decodeUWDealPackageZip,
  verifyUWDealPackage,
} from './deal-package-zip.js';
export type {
  UWDealPackageInput,
  UWDealPackageDecoded,
  UWPackageDecodeOptions,
  PackageVerification,
  PackageVerificationStatus,
} from './deal-package-zip.js';
export { inspectZipSafety, isSafeZipPath } from './zip-safety.js';
export type { ZipSafetyLimits, ZipSafetyViolation } from './zip-safety.js';
export { sha256BytesHex } from './integrity.js';



export {
  buildAgentContext,
  buildAgentPrompt,
  isContextReady,
  getLayerDependencies,
  BANCROFT_LAYERS,
} from './context.js';
export type { AgentContext, BancroftPrompt, LayerDefinition } from './context.js';

export { generateBlankUWFile } from './init.js';

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
export { inferGaps, summarizeGaps, readGapsContent } from './gaps.js';
export type { GapItem, GapSummary, GapsContent, GapReason, InferGapsOptions } from './gaps.js';
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
} from './defaults.js';
export type { AssetClassDefaults, DefaultRange, DefaultUnit } from './defaults.js';
export { getExprDependencies, extractDependencyGraph } from './calc/dependencies.js';
export type { DependencyGraph, ExtractDependencyGraphOptions } from './calc/dependencies.js';

export type {
  UWBlock,
  UWFenceAnnotation,
  UWMeta,
  UWFieldOverride,
  MarketDataRef,
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

export { DEFAULT_THRESHOLDS, ASSET_CLASSES } from './types.js';

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

// Receipts (RFC 0016) — issuance and verification are browser-safe: SHA-256
// comes from Web Crypto via `integrity.sha256TextHex`, and no signing backend
// is bundled here.
export { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';
export {
  UW_RECEIPT_VERSION,
  SUPPORTED_RECEIPT_VERSIONS,
  ROLLUP_FUNCTIONS,
  PORTFOLIO_ROLLUP_SECTION,
  verifyRollup,
  evaluateRollup,
  validateRollupAggregate,
  UW_LITE_CANONICALIZATION,
  UW_LITE_CANONICALIZATION_VERSION,
  UWX_CANONICALIZATION,
  UWX_CANONICALIZATION_VERSION,
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
  UWReceiptInputProvenance,
  UWReceiptInputSource,
  UWReceiptInputResolver,
  RollupFn,
  UWRollupAggregate,
  RollupMember,
  RollupAggregateResult,
  RollupVerification,
  ReceiptErrorCode,
  ReceiptSignatureVerifier,
  ReceiptSubjectOptions,
  ReceiptSubjectResolution,
  ReceiptIssuanceOptions,
  ReceiptVerificationOptions,
} from './receipts.js';
