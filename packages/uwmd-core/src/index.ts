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

// RFC 0007 — sensitivity tables. A declaration, not a grammar extension: the
// §VIII.1 sandbox is unchanged, and the grid never travels through
// `CalcResult.value`.
// RFC 0005 — stochastic calculations. Sampling is a declaration plus the §VIII.7
// override mechanism; the grammar and the builtins are untouched, and the
// builtins stay pure.
export {
  evaluateStochastic,
  isStochasticDecl,
  SUMMARY_STATS,
  MAX_STOCHASTIC_SAMPLES,
  MIN_STOCHASTIC_SAMPLES,
} from './calc/stochastic.js';
export type {
  StochasticDecl,
  StochasticInput,
  StochasticResult,
  StochasticSummary,
  DistributionSpec,
  SummaryStat,
} from './calc/stochastic.js';
export {
  Pcg64,
  PRNG_ALGORITHM,
  inverseNormalCdf,
  sampleUniform,
  sampleNormal,
  sampleTriangular,
} from './calc/prng.js';

export {
  evaluateSensitivity,
  isSensitivityDecl,
  assertSensitivityOk,
  MAX_SENSITIVITY_CELLS,
  MAX_SENSITIVITY_AXIS,
} from './calc/sensitivity.js';
export type {
  SensitivityDecl,
  SensitivityAxis,
  SensitivityCell,
  SensitivityResult,
} from './calc/sensitivity.js';
export type { CalcValue, Builtin, CalcErrorCode } from './calc/index.js';
// The §VIII.5 quantization boundary. Exported because a host that reports its
// own derived numbers alongside pack results must quantize them the same way, or
// its receipt digest will not reproduce.
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
  MIXED_USE_PACK,
  getPackForAssetClass,
  emitFromAst,
  emitExcelFormula,
  emitCalcExcelFormula,
  ExcelEmitError,
} from './packs/index.js';
export type { ExcelEmitOptions } from './packs/index.js';

export {
  loadModuleManifest,
  loadModuleManifestAsync,
  createModuleRegistry,
  createModuleRegistryAsync,
  getModuleCalculationsForAssetClass,
  ModuleRegistryError,
} from './modules.js';
export type {
  ModuleRegistry,
  LoadModuleOptions,
  LoadModuleAsyncOptions,
  CreateModuleRegistryOptions,
  CreateModuleRegistryAsyncOptions,
  ModuleSignaturePolicy,
} from './modules.js';

// RFC 0003 — module-declared asset classes. Identifier grammar and resolution
// are crypto-free and browser-safe; `AssetClass` itself stays a closed union.
export {
  parseAssetClass,
  isCustomAssetClass,
  resolveAssetClass,
  declaredAssetClasses,
  assetClassDeclarationConflicts,
  declaredModuleDependencies,
} from './asset-class.js';
export type {
  AssetClassKind,
  AssetClassIdentity,
  AssetClassResolution,
  ResolveAssetClassOptions,
} from './asset-class.js';

export {
  evaluateModuleCalculations,
  validateAgainstModules,
  checkModuleSections,
} from './module-runtime.js';
export type { ModuleRuntimeOptions, ModuleCalcOutcome } from './module-runtime.js';

// RFC 0002 — module signatures. Crypto-free half only; `@uwmd/signing` supplies
// the verifier that `verifyModuleSignature` and the async loaders accept.
export {
  moduleSigningPayload,
  verifyModuleSignature,
  checkSignatureShape,
  MODULE_SIGNATURE_SCHEME,
} from './module-signing.js';
export type {
  ModuleSignatureFailure,
  ModuleSignatureVerdict,
  ModuleSignatureVerifier,
  VerifyModuleSignatureOptions,
} from './module-signing.js';

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
  // RFC 0027: the Protocol §XIII size-intensive registry. Browser-safe.
  SIZE_INTENSIVES,
  getSizeIntensive,
  resolveDealSize,
} from './protocol.js';
export type { DocumentProfile, UWEdgeLayer, UWEdgeEndpointKind, UWEdgeTypeDef, SizeIntensive } from './protocol.js';
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
  MIXED_USE_DEFAULTS,
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
  blockSigningPayload,
  canonicalBlockSigningInput,
} from './integrity.js';
export type {
  IntegrityCode,
  IntegrityIssue,
  IntegrityResult,
  BlockSigningInput,
  BlockSigFailure,
  BlockSigVerdict,
  BlockSignatureVerifier,
  VerifyChainOptions,
} from './integrity.js';

export { canonicalize } from './integrity-canonical.js';

export { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';
export { REFERENCE_IMPLEMENTATION_MANIFEST } from './protocol.js';

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

export {
  verifyCapitalStack,
  recomputeSizing,
  trancheAnnualDebtService,
  isDebtTranche,
  capitalStackContext,
  CAPITAL_STACK_SIZING_DECIMALS,
} from './capital-stack.js';
export type {
  Tranche,
  TrancheClass,
  Accrual,
  SizingFn,
  SizingFigure,
  CapitalStack,
  CapitalStackContext,
  CapitalStackVerdict,
  CapitalStackIssueCode,
  CapitalStackIssue,
  SizingResult,
  CapitalStackVerification,
} from './capital-stack.js';

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
  UWBlockSignature,
  UWSignatureAlgorithm,
  MarketDataRef,
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
  UWAssetClassId,
} from './types.js';

export { DEFAULT_THRESHOLDS, ASSET_CLASSES, UW_SIGNATURE_ALGORITHMS } from './types.js';

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
  ModuleSignature,
  ModuleAssetClassDecl,
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
