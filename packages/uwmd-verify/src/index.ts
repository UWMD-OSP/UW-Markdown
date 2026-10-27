// @uwmd/verify — the reference implementation of the UW Markdown standard
// (RFC 0083). Everything a party needs to read and verify a `.uw.md` document:
// the reader, validation, the safe-expression evaluator and quantization,
// stated-precision comparison, the metric dictionary, receipts, integrity, the
// module system and the optional verification profiles.
//
// `@uwmd/core` (the starter toolkit) re-exports this whole surface, so every
// name here is also a `@uwmd/core` export. Nothing in this package reaches a
// starter module, a vendor SDK or a static `node:` import
// (`standard-closure.test.ts`), so `./browser` exports the same surface.

export { parseUWFile, getSection, getSectionVariant, deepGet, blockPayload } from './parser.js';
export { SCENARIOS, isScenarioId } from './scenario.js';
export type { Scenario, UWScenarioId } from './scenario.js';
export { validateUWFile, lookupRemediation, getReturnTaxBasis } from './validator.js';
// RFC 0053 — the reassessment and abatement vocabularies.
export { REASSESSMENT_TRIGGERS, TAX_ABATEMENT_KINDS } from './validator.js';
// RFC 0055 — the commercial lease clause vocabularies.
export { TERMINATION_PENALTY_COMPONENTS, CO_TENANCY_TRIGGERS, CO_TENANCY_REMEDIES } from './validator.js';
// RFC 0056 — the rate-hedge and escrow vocabularies.
export {
  HEDGE_INSTRUMENTS, RESERVED_HEDGE_INSTRUMENTS, HEDGE_INDEXES,
  HEDGE_EXPIRY_ASSUMPTIONS, ESCROW_NAMES,
} from './validator.js';
export type { HedgeInstrument, HedgeExpiryAssumption, EscrowName } from './validator.js';
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
} from './source-representation.js';
export type {
  UWSourceRepresentation,
  UWSourceDetection,
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
  flattenEnvelopeBlockValues,
  flattenUWSourceBlockValues,
  UW_CSV_BUNDLE_CODEC,
} from './uwcsv.js';
export type { UWCSVBundle, UWCSVDecodeOptions, UWBlockValueRow, UWJSONValueType } from './uwcsv.js';
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

export { parseExpression, evaluate, BUILTINS, CalcError, calcError } from './calc/index.js';
// The standard evaluator: its `CalcResult` carries no `display` string (RFC
// 0083 §3). `@uwmd/core` exports a wrapper under the same name that adds it.
export { evaluateCalc } from './calc/index.js';
// RFC 0088 selected raw primitive surface; no evaluator activation.
export { pinnedPow, pinnedExp, pinnedLog } from './calc/pinned-numerics.js';

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

export { validateAgainstModules, checkModuleSections } from './module-runtime.js';
// Display-free, like `evaluateCalc`; `@uwmd/core`'s export adds `display`.
export { evaluateModuleCalculations } from './module-runtime.js';
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
export type { DocumentProfile, UWEdgeLayer, UWEdgeEndpointKind, UWEdgeTypeDef, SizeIntensive, MetricDictionary, MetricDictionaryCalculation, MetricDictionarySize } from './protocol.js';
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

export {
  verifyLeaseUpSchedule,
  leaseUpContext,
  leaseUpPeriodOrdinal,
  LEASE_UP_STABILIZED_TOLERANCE,
  LEASE_UP_VERIFY_DECIMALS,
} from './lease-up.js';
export type {
  LeaseUpModelType,
  LeaseUpGranularity,
  LeaseUpPeriod,
  LeaseUpAssumptions,
  LeaseUpStabilizedSummary,
  LeaseUpSchedule,
  LeaseUpVerdict,
  LeaseUpIssueCode,
  LeaseUpIssue,
  LeaseUpVerification,
  LeaseUpContext,
} from './lease-up.js';

export {
  verifyCashFlowSeries,
  datedFlowsOf,
  xnpvOf,
  xirrOf,
  CASH_FLOW_KINDS,
  CASH_FLOW_VERIFY_DECIMALS,
} from './cash-flow-series.js';
export type {
  CashFlowKind,
  CashFlowRow,
  CashFlowStatedMetrics,
  CashFlowSeries,
  CashFlowVerdict,
  CashFlowIssueCode,
  CashFlowIssue,
  CashFlowVerification,
  DatedFlow,
} from './cash-flow-series.js';
export {
  DAY_COUNT_CONVENTIONS,
  DEFAULT_DAY_COUNT,
  isDayCountConvention,
  parseISODate,
  actualDays,
  yearfrac,
} from './calc/day-count.js';
export type { DayCountConvention, CalendarDate } from './calc/day-count.js';
export {
  evaluateCashFlowMetric,
  evaluateCashFlowMetrics,
  CASH_FLOW_METRICS,
} from './calc/dated-flows.js';
export type { CashFlowMetric, CashFlowMetricDecl } from './calc/dated-flows.js';

export {
  validatePortfolioProfile,
  uninterpretedPortfolioTypes,
  getPortfolioRelationships,
  entityEdgesToPortfolioEdges,
  PORTFOLIO_PROFILE_VERSION,
  PORTFOLIO_ENTITY_TYPES,
} from './portfolio.js';
export type {
  PortfolioEntityType,
  PortfolioProvenance,
  PortfolioEntity,
  PortfolioEdge,
  PortfolioProfile,
} from './portfolio.js';

export {
  computeWaterfall,
  verifyWaterfall,
  WATERFALL_VERIFY_DECIMALS,
} from './waterfall.js';
export type {
  WaterfallParty,
  WaterfallTier,
  WaterfallTierReturnOfCapital,
  WaterfallTierPreferredReturn,
  WaterfallTierCatchUp,
  WaterfallTierSplit,
  WaterfallClawback,
  WaterfallPartyOutcomes,
  WaterfallStatedOutcomes,
  WaterfallScheduleRow,
  WaterfallScheduleCell,
  DistributionWaterfall,
  WaterfallPartyResult,
  WaterfallAllocation,
  WaterfallVerdict,
  WaterfallIssueCode,
  WaterfallIssue,
  WaterfallVerification,
} from './waterfall.js';

export type {
  // Core types
  UWBlock,
  UWFenceAnnotation,
  BlockRole,
  CrossCheckResolutionEvidence,
  UWMeta,
  UWMetaPatch,
  UWProvenance,
  UWQuality,
  UWLifecycle,
  UWIntegrity,
  UWFieldOverride,
  UWBlockSignature,
  UWSignatureAlgorithm,
  MarketDataRef,
  UWFrontmatter,
  UWQuickMetrics,
  ParsedUWFile,
  ParsedSections,
  // Options
  ParseOptions,
  InstitutionConfig,
  // Validation
  ValidationMessage,
  ValidationResult,
  DealFlag,
  ValidationPolicy,
  CrossCheckCoverage,
  CrossCheckSkipReason,
  ReturnTaxBasis,
  StageReadiness,
  FinancialThresholds,
  // Enums
  ConfidenceLevel,
  ValidationSeverity,
  DealStage,
  AssetClass,
  UWAssetClassId,
} from './types.js';

export { DEFAULT_THRESHOLDS, ASSET_CLASSES, UW_SIGNATURE_ALGORITHMS, FINANCIAL_VALIDITY_CODES } from './types.js';

// ─── Protocol surface ─────────────────────────────────────────────────────────
export {
  CONFORMANCE_TARGETS,
  VERIFIER_OBLIGATION_CAPABILITIES,
  BLOCK_ROLES,
  CROSS_CHECK_ROLE_PREFERENCE,
  PERIOD_SERIES,
  PROTOCOL_VERSION,
  FORMAT_VERSION,
  SUPPORTED_FORMAT_VERSIONS,
  SUPPORTED_PROTOCOL_VERSIONS,
  BUILTIN_EDIT_POLICIES,
  BUILTIN_REMEDIATIONS,
  VALIDATOR_CODE_FAMILIES,
  validatorCodeFamily,
  CROSS_CHECK_RULE_IDS,
  CROSS_CHECK_VARIANT_PREFERENCE,
  RETURN_TAX_BASES,
  DEFAULT_RETURN_TAX_BASIS,
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  SOURCE_TAGS,
  RESOLUTION_METHODS,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  isCurrencyCode,
  ACTOR_NAMESPACES,
  ACTOR_SOURCE_RE,
  parseActorSource,
  lookupIncompleteDataPolicy,
  STAGE_CONTRACT,
  stageOneOfFor,
  STAGE_REQUIREMENTS,
  FRONTMATTER_VOCABULARIES,
  STAGE_SECTION_OVERLAYS,
  requiredSectionsFor,
  lookupStageContract,
} from './protocol.js';
export type {
  StageContractEntry,
  StageRequirement,
  ConformanceTarget,
  ConformanceTier,
  ConformanceProfile,
  ViewerRole,
  ViewerCapability,
  ValidatorCodeFamily,
  ImplementationManifest,
  SupportedLocale,
  FieldViewHint,
  SectionViewModel,
  EditAuthority,
  EditPolicy,
  EditOperation,
  IssueRemediation,
  CalcEvaluationContext,
  CalcResult,
  ModuleManifest,
  ModuleConformanceRequirements,
  ModuleSignature,
  ModuleAssetClassDecl,
  ModuleSectionDecl,
  ModuleCalcDecl,
  ModuleValidationDecl,
  ModuleLoadResult,
  ProtocolError,
  ProtocolErrorCategory,
  CascadeStep,
  CanonicalSourceTag,
  ActorNamespace,
  ParsedActorSource,
  GapAction,
  IncompleteDataPolicy,
} from './protocol.js';

// ─── Refinement / context profiles (starter guide §IX, §X) ────────────────────────
export { extractDependencyGraph, getExprDependencies } from './calc/dependencies.js';
export type { DependencyGraph, ExtractDependencyGraphOptions } from './calc/dependencies.js';
export type { PeriodRefinementIssue, SectionRefinementIssue, PeriodExcelBinding, PeriodColumnSnapshot } from './protocol.js';
export { resolvePeriodColumn } from './period-path.js';

export type { PeriodKey, PeriodSeriesEntry } from './protocol.js';
export { canonicalPeriod, parsePeriodSelector, periodKeyIdentity } from './periods.js';
export { resolvePeriodPath } from './period-path.js';
export type { PeriodResolutionOptions } from './period-path.js';
// RFC 0066: the one section selection every section-rooted read shares (§VIII.2).
export { resolveSectionBlock } from './section-resolution.js';
export type { SectionSelectionOptions } from './section-resolution.js';

export { projectLeaseUpCashFlows, LeaseUpCashFlowProjectionError } from './lease-up-cash-flows.js';
export type { LeaseUpCashFlowPlan, LeaseUpCashFlowProjection, LeaseUpCashFlowProjectionIssue } from './protocol.js';

// RFC 0045 — explicit property cash-flow assembly.
export { assemblePropertyCashFlows, PropertyCashFlowAssemblyError } from './property-cash-flows.js';
// RFC 0047 — read-only source inventory for authoring an RFC 0045 plan.
export { inspectPropertyCashFlowInputs } from './property-cash-flow-inputs.js';
export type {
  PropertyCashFlowInputInventory,
  PropertyCashFlowInputRow,
  PropertyCashFlowInputVariant,
} from './property-cash-flow-inputs.js';
export type { PropertyCashFlowPlan, PropertyCashFlowAssembly, PropertyCashFlowAssemblyIssue,
  PropertyCashFlowCategory, PropertyCashFlowCell, PropertyCashFlowCoverage,
  PropertyCashFlowAssertions, PropertyCashFlowBinding, PropertyCashFlowCellEvidence } from './protocol.js';
// RFC 0052 — named exit sale deductions.
export type { SaleDeduction, SaleDeductionName } from './protocol.js';
export { UNLEVERED_SALE_DEDUCTIONS, RESERVED_LEVERED_SALE_DEDUCTIONS } from './protocol.js';

export { computeReplacementCashFlowBindingDigest, verifyReplacementFundingBindings } from './replacement-funding.js';
export type { ReplacementCashFlowRef, ReplacementFunding, ReplacementFundingBindingContext, ReplacementFundingVerificationIssue, ReplacementFundingVerificationResult } from './protocol.js';

export { verifyReserveAccounts } from './reserve-accounts.js';
export type { ReserveSource, ReserveMovementKind, ReserveMovement, ReservePeriod, PropertyReserveAccount, ReserveAccounts, ReservePeriodEvidence, ReserveAccountsVerificationIssue, ReserveAccountsVerification } from './protocol.js';

export { verifyReserveDrawBindings } from './reserve-draw-bindings.js';

// RFC 0115 — document-level section verifiers behind the portable Verifier
// subcommands (§II.6a.1), and the section report each prints.
export { verifyCapitalStackDocument, verifyLeaseUpDocument, verifyWaterfallDocument } from './section-verification.js';
export type { SectionVerificationOptions } from './section-verification.js';
export type { SectionVerificationReport, CashFlowVerificationReport, WaterfallVerificationReport,
  CapitalStackVerificationReport, LeaseUpVerificationReport } from './protocol.js';
export type { ReserveDrawReference, ReserveGrossExpenditureReference, ReserveGrossExpenditure, ReserveDrawBinding, ReserveDrawBindingPlan, ReserveDrawBindingEvidence, ReserveDrawBindingVerification } from './protocol.js';

// RFC 0079 stated-metric comparison, independent of packs and defaults.
export { getStatedDecimals, compareStatedMetric } from './calc/stated-precision.js';
export type { StatedMetricComparison } from './calc/stated-precision.js';

export { toBuiltinAssetClass } from './types.js';

export { checkBuiltinClassContent } from './builtin-class-validation.js';
// The twelve builtin classes' section, rule and view-model declarations (RFC 0080). Pure data.
export { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';

// Verification rule sets (RFC 0111, Protocol §XII.5): the declared Format
// version selects the bands, dictionary and packs a record is verified under.
export { RULE_SETS, getRuleSet, ruleSetFor } from './rule-sets.js';
export type { UWRuleSet } from './rule-sets.js';

// Stated-metric verification against the metric dictionary (RFC 0083 §2).
export { verifyStatedMetrics } from './metric-verification.js';
export type {
  StatedMetricBindings,
  StatedMetricDefinition,
  StatedMetricEvidence,
  StatedMetricOutcome,
  StatedMetricsReport,
  StatedMetricUnverifiableReason,
  VerifyStatedMetricsOptions,
} from './metric-verification.js';

// ─── Standard symbols `@uwmd/core` used to export through starter modules ─────
// (RFC 0083 Phase 1 moved them to their standard homes; core's `runner`,
// `gaps`, `cascade` and `packs` still re-export them under the same names.)
export { buildMeta } from './metadata.js';
export { readGapsContent } from './gaps-content.js';
export type { GapItem, GapReason, GapSummary, GapsContent } from './gaps-content.js';
export type { MarketDataLookup } from './market-data.js';
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
  DATA_CENTER_PACK,
  MANUFACTURED_HOUSING_PACK,
  getPackForAssetClass,
} from './builtin-packs/index.js';

// ─── This package's identity (receipts issued or verified directly) ───────────
export { VERIFY_PACKAGE_NAME, VERIFY_VERSION } from './version.js';

// ─── Building blocks the starter toolkit uses (RFC 0083 Phase 2) ──────────────
// Exported so `@uwmd/core` builds on this package's public entry instead of
// deep paths. Each is part of the standard behavior it names; none is new.
export { CONFORMANCE_PROFILES, isConformanceTier } from './protocol.js';
export type { SourceTag } from './types.js';
export { isBlockedSegment, UWMDParseError } from './parser.js';
export { writeDoubleQuotedScalar } from './yaml-scalar.js';
export { isBlockRole } from './block-roles.js';
export { blockOverrides, bumpRawMetaVersion, stampMetaIntoBlockContent } from './metadata.js';
export type { Expr } from './calc/parser.js';
export { periodReferencePath } from './calc/parser.js';
export { getPeriodReferences } from './calc/dependencies.js';
export { periodPayload, periodReferenceContract, periodSection, resolvePeriodReference } from './period-path.js';
// The source-edit seam (RFC 0083 §3): `@uwmd/core`'s `bindings-edit.ts` injects
// its editor through these to provide `applyUWMDSourceEdit` and
// `createUWMCPApplyEditResult`.
export { applyUWMDSourceEditWith, createUWMCPApplyEditResultWith } from './bindings.js';
export type { UWSourceEditAdapter } from './bindings.js';
export {
  documentSigningPayload, resolveDocumentSigningSubject, verifyDocumentSignature, DocumentSigningError,
} from './document-signatures.js';
export type {
  DocumentSigningSubject, UWDocumentSignature, DocumentSignatureVerifier,
  DocumentSignatureResult, DocumentSignatureCode, DocumentSignatureIssue,
} from './document-signatures.js';

export { parseGapInstant, ValidationClockError } from './gap-instant.js';

export type { UWExtensionEntry, UWParsedExtensionEntry } from './types.js';
export type { UWEnvelopeExtensionEntry } from './envelope.js';
export { extensionBlocks, mapExtensionEntry } from './extension-entry.js';

export { UW_ENVELOPE_CANONICALIZATION_VERSION } from './protocol.js';

export { JSONValueError } from './json-admission.js';

export { projectUWParse } from './portable-projection.js';
export type { UWPortableBlock } from './portable-projection.js';

export { verifyProForma, PRO_FORMA_REGISTRY, PRO_FORMA_IDENTITIES, PRO_FORMA_FAMILIES } from './pro-forma.js';
export type { VerifyProFormaOptions } from './pro-forma.js';
export type * from './pro-forma-types.js';

export * from './document-facts.js';

export { DOCUMENT_FACTS_PROFILES } from './protocol.js';
export { readDocumentFactsPackage } from './document-facts-package.js';
