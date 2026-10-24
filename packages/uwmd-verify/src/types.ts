import type { UWScenarioId } from './scenario.js';

// .uwx.md format — TypeScript type definitions
// Spec: spec/UW_FORMAT_SPEC.md (Format 3.0)

/** The signed block annotation used for property-level selection (RFC 0040). */
export type BlockRole = 'primary' | 'senior' | 'junior' | 'summary' | 'detail' | 'component';

/** Selection evidence for one section read by a cross-check. */
export interface CrossCheckResolutionEvidence {
  variant?: string;
  via: 'preference' | 'role' | 'primary' | 'default' | 'base' | 'sole' | 'single';
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ValidationSeverity = 'error' | 'warning' | 'info';

/** Why a §5.3 cross-check was not evaluated (RFC 0037). */
export type CrossCheckSkipReason =
  | 'section_absent'
  | 'variant_unresolvable'
  | 'field_absent'
  | 'not_applicable';

/**
 * Per-rule coverage for the §5.3 cross-section checks (RFC 0037): `evaluated`
 * when the comparison actually ran (whether or not it produced an issue),
 * `skipped` with a reason and a short detail otherwise. Reporting only — it
 * never moves `overall_status`.
 */
export interface CrossCheckCoverage {
  status: 'evaluated' | 'skipped';
  reason?: CrossCheckSkipReason;
  detail?: string;
  /** Omitted for role-free sections; keys are section ids, not rule ids. */
  resolutions?: Record<string, CrossCheckResolutionEvidence>;
}

/** Tax basis of the metrics stated in `dcf.returns` (format §4.9, RFC 0038). */
export type ReturnTaxBasis = 'pre_tax' | 'after_tax';

export type DealStage =
  | 'scope'
  | 'screening'
  | 'term_sheet'
  | 'full_underwrite'
  | 'credit_approval'
  | 'closing'
  | 'monitoring';

/**
 * Source tags surface where a value came from. Producers stamp
 * `_meta.provenance.source` with a value drawn from this union or an institution-defined pattern (e.g.
 * 'agent/risk-rater', 'document/rent_roll'). Free-form strings remain valid for
 * forward compat; this union enumerates the canonical values.
 *
 * **RFC 0031 split the field.** `_meta.provenance.source` is actor-only
 * (`manual | agent/<id> | document/<id> | system/<id> | institution/<id>`);
 * the resolution-method tags below belong in `_meta.provenance.resolution`.
 * A resolution tag in the actor field is `SRC-02`, an error; readers never
 * reinterpret it. See protocol §V.3 and format spec §2.6.
 */
export type SourceTag =
  | 'user_input'
  | 'user_override'
  | 'manual'
  /**
   * A value inherited from an ancestor in the composition DAG (RFC 0021 §5).
   * Always carries `_meta.provenance.inherited_from` naming the asserting document, so it
   * is traceable rather than ambient.
   */
  | 'inherited_assumption'
  | 'investor_profile'
  | 'market_data'
  /**
   * A market observation an analyst explicitly accepted as the underwritten
   * value (RFC 0022 §4). Deliberately distinct from `user_input`: a value
   * accepted for lack of better evidence and a value established by diligence
   * are different claims, and a file that renders them identically has
   * destroyed something a credit reviewer needs. Consumers that do not
   * recognize this tag MUST NOT rewrite it to `user_input`.
   */
  | 'market_data_accepted'
  | 'ai_extracted'
  | 'agent_computed'
  | 'asset_class_default'
  | 'scenario_default'
  | 'global_default'
  | 'system_default'
  | (string & {});

/**
 * The full set of canonical short-form source tags. As of RFC 0031 these are
 * the **resolution-method** vocabulary — producers stamp them into
 * `_meta.provenance.resolution` (never the actor field). Eight of these match
 * `CascadeStep` 1:1; the rest are non-cascade tags — `ai_extracted`,
 * `agent_computed`, `scenario_default`, and `market_data_accepted`.
 *
 * `market_data_accepted` (RFC 0022 §4) is deliberately *not* a cascade step:
 * it is an in-file value of record that resolves at the `user_input` step
 * while keeping its own tag, because a value accepted for lack of better
 * evidence must stay distinguishable from one someone typed in.
 *
 * `scenario_default` is retained but its meaning is sharpened to mean
 * "value derived from a named scenario in the file or institution
 * config." Producers needing a generic fallback SHOULD use
 * `system_default` instead.
 *
 * Actor patterns (`manual`, `agent/risk-rater`, `document/rent_roll`, …) are a
 * separate vocabulary — see `ACTOR_NAMESPACES` / `parseActorSource` in
 * `protocol.ts`.
 */
export const SOURCE_TAGS = Object.freeze([
  'user_input',
  'user_override',
  // 'manual' left this vocabulary at format 2.0 (RFC 0009 resolved question
  // 4): it is actor-only now, and `user_input` is the resolution-method
  // spelling for human-typed values. It remains a legal member of the
  // `SourceTag` union above because the ACTOR field is typed with it.
  'inherited_assumption',
  'investor_profile',
  'market_data',
  'market_data_accepted',
  'ai_extracted',
  'agent_computed',
  'asset_class_default',
  'scenario_default',
  'global_default',
  'system_default',
] as const);

export type CanonicalSourceTag = (typeof SOURCE_TAGS)[number];

/**
 * The one format this implementation reads and writes (RFC 0081 D1). A
 * document declaring any other `uw_version`, or none, is refused with
 * `UNSUPPORTED_FORMAT_VERSION`. Re-exported from `protocol.ts`.
 */
export const SUPPORTED_FORMAT_VERSIONS = Object.freeze(['3.0'] as const);

export type AssetClass =
  | 'multifamily'
  | 'office'
  | 'retail'
  | 'industrial'
  | 'self_storage'
  | 'hospitality'
  | 'mixed_use'
  | 'senior_housing'
  | 'student_housing'
  | 'land'
  | 'data_center'
  | 'manufactured_housing';

/**
 * An asset class as it may appear in a document: a builtin, or a
 * module-declared custom identifier (RFC 0003, protocol §X.2).
 *
 * Deliberately separate from {@link AssetClass}, which stays a closed union.
 * Folding custom ids into `AssetClass` would collapse it to `string` and take
 * `ASSET_CLASS_MEMBERS`, every pack and layout lookup's narrowing, and the
 * §XIII / §5.1 class tables down with it. Anything that needs a *builtin*
 * still asks for `AssetClass`; this type is for the boundary — frontmatter and
 * module declarations — where a custom class is legal.
 *
 * The `(string & {})` arm keeps editor autocomplete on the builtin members
 * while accepting any identifier; `parseAssetClass` is what actually validates
 * one.
 */
export type UWAssetClassId = AssetClass | (string & {});

/**
 * Exhaustiveness anchor for {@link AssetClass}.
 *
 * A type union is erased at runtime, so every runtime list of asset classes is
 * a hand-maintained copy that can silently fall out of step with the union.
 * `Record<AssetClass, true>` closes that gap at compile time: add a member to
 * the union without adding it here and `tsc` fails with a missing property;
 * leave a stale key behind and that fails too. `ASSET_CLASSES` is then derived
 * rather than written, so it cannot drift.
 *
 * Keep this immediately below the union — the two are one declaration in two
 * halves. Consumers should use `ASSET_CLASSES`; this record is the mechanism.
 */
const ASSET_CLASS_MEMBERS: Record<AssetClass, true> = {
  multifamily: true,
  office: true,
  retail: true,
  industrial: true,
  self_storage: true,
  hospitality: true,
  mixed_use: true,
  senior_housing: true,
  student_housing: true,
  land: true,
  data_center: true,
  manufactured_housing: true,
};

/**
 * Every v1 asset class, as a runtime list. Derived from {@link AssetClass} via
 * {@link ASSET_CLASS_MEMBERS}, so it is exactly the union — no more, no less.
 *
 * Adding an asset class is a normative format change (see RFC 0003 for
 * module-declared classes); this list is the library's mirror of the enum in
 * `spec/UW_FORMAT_SPEC.md` and `spec/schemas/`, not an independent registry.
 */
export const ASSET_CLASSES: readonly AssetClass[] = Object.freeze(
  Object.keys(ASSET_CLASS_MEMBERS) as AssetClass[],
);

// ─── Provenance ───────────────────────────────────────────────────────────────

export interface UWFieldOverride {
  /** Dot-notated path relative to the block's content root (e.g. "units[7].current_rent"). */
  path: string;
  confidence?: ConfidenceLevel;
  /** Actor override for this field (RFC 0031 actor grammar, Format §2.6). */
  source?: SourceTag;
  /**
   * How this field's value was resolved (a canonical `SOURCE_TAGS` member,
   * e.g. the cascade step that produced it — starter guide §V.7 permits stamping
   * at leaf level). A leaf-level `resolution` wins over the block-level one
   * for its path. RFC 0031.
   */
  resolution?: SourceTag;
  reason?: 'illegible' | 'missing' | 'overridden' | 'estimated' | 'computed';
  note?: string;
}

/**
 * `_meta.provenance` (Format §2.5): who wrote the block, when, and how its
 * values were resolved. `source`, `actor` and `timestamp` are REQUIRED.
 */
export interface UWProvenance {
  /**
   * The writer, in the actor grammar `manual | <namespace>/<id>` (RFC 0031;
   * Format §2.6, Protocol §V.3). A resolution tag here is `SRC-02` and any
   * other out-of-grammar value is `SRC-01`; both are errors.
   */
  source: SourceTag;
  /** How the value was resolved: one member of the closed `SOURCE_TAGS`
   *  vocabulary (`SRC-03` otherwise). Optional and orthogonal to `source`. */
  resolution?: SourceTag;
  /** The principal that initiated the write. */
  actor: string;
  /** REQUIRED when `source` matches `agent/*`. */
  agent_id?: string | null;
  agent_version?: string | null;
  /** Exact T1B UTC-Z write time: Gregorian YYYY-MM-DDTHH:mm:ss[.digits]Z (RFC0094). */
  timestamp: string;
  notes?: string | null;
  /**
   * Which observation set a `market_data_accepted` value was promoted from
   * (RFC 0022 §4). REQUIRED whenever `resolution` is `market_data_accepted`.
   */
  market_data_ref?: MarketDataRef;
  /**
   * Which ancestor asserted an `inherited_assumption` value (RFC 0021 §5).
   * REQUIRED whenever `resolution` is `inherited_assumption`.
   */
  inherited_from?: InheritedFrom;
}

/** `_meta.quality` (Format §2.5). `confidence` and `human_review_required`
 *  are REQUIRED. Per-field exceptions live in the block's `_overrides`. */
export interface UWQuality {
  confidence: ConfidenceLevel;
  human_review_required: boolean;
  flags?: string[];
  /** True when at least one field inside the block is missing or unknown;
   *  the block's `_overrides` SHOULD then enumerate which paths and why. */
  partial?: boolean;
  /** True when the whole block is a placeholder derived from defaults rather
   *  than observed data. Stronger than `confidence: 'low'`. */
  provisional?: boolean;
}

/** `_meta.lifecycle` (Format §2.7): the block's place in its supersede chain. */
export interface UWLifecycle {
  /** 1-based supersede-chain position. */
  revision: number;
  /** True on every block that is not the chain head. */
  superseded: boolean;
}

/**
 * `_meta.integrity` (Format Part III, Protocol §V.9–§V.11). Optional as a
 * whole: integrity is opt-in. The whole `_meta` member is outside the block
 * digest, so stamping any of these never changes `content_hash`.
 */
export interface UWIntegrity {
  /** Absent means `sha256`, the only admitted block hash algorithm. */
  algorithm?: 'sha256';
  /** `sha256:<64 hex>` reproducibility anchor, or null. */
  input_hash?: string | null;
  /** Lowercase hex SHA-256 of the JCS of the block minus `_meta` (§V.9). */
  content_hash?: string;
  /** `content_hash` of the retained predecessor; null/absent on the first retained hashed-chain block (RFC 0085). */
  parent_hash?: string | null;
  /**
   * Detached signature over this block's signing input (Protocol §V.11,
   * RFC 0010). The cryptography lives in `@uwmd/signing`.
   */
  signature?: UWBlockSignature;
}

/**
 * A block's `_meta` (Format §2.5), exactly as the document states it and as
 * `uwmd-block.schema.json` defines it. There is one shape: readers never
 * reshape it, and `block.meta` is the parsed `_meta` object itself.
 */
export interface UWMeta {
  /** MUST equal the fence annotation's section. */
  section: string;
  provenance: UWProvenance;
  quality: UWQuality;
  lifecycle: UWLifecycle;
  integrity?: UWIntegrity;
}

/**
 * The caller-suppliable part of a written block's `_meta` (an edit
 * operation's `meta`). The host owns `section`, `lifecycle` and `integrity`
 * (invariant 5) and fills the required provenance and quality members; a
 * patch overrides individual provenance or quality members.
 */
export interface UWMetaPatch {
  provenance?: Partial<UWProvenance>;
  quality?: Partial<UWQuality>;
}

/**
 * A detached signature over a block's signing input (protocol §V.11).
 *
 * What it covers is deliberately narrow — `content_hash`, `section`, `actor`,
 * `timestamp`, `kid`, `signed_at` — and deliberately excludes `parent_hash`.
 * Signing is per-block authorship; chain integrity is the separate
 * `content_hash`/`parent_hash` mechanism. Coupling them would make re-rooting a
 * chain after a merge invalidate every prior signature, which is a legitimate
 * edit destroying evidence it has no business touching.
 */
export interface UWBlockSignature {
  /** Algorithm identifier. Closed set at protocol 1.x; see §V.11. */
  alg: UWSignatureAlgorithm;
  /** Opaque key identifier the verifier looks up in its own key store. */
  kid: string;
  /** Base64url-encoded (unpadded) signature bytes. */
  sig: string;
  /**
   * ISO 8601 instant the signature was produced. MAY differ from
   * `_meta.provenance.timestamp` — a block edited offline is signed when re-uploaded.
   */
  signed_at: string;
  /** Signing-protocol version. Absent means `"1"`. */
  v?: string;
}

/** The algorithms protocol 1.x admits for `_meta.integrity.signature.alg`. */
export type UWSignatureAlgorithm = 'ed25519' | 'es256' | 'es384';

/** Runtime mirror of {@link UWSignatureAlgorithm}, for validation. */
export const UW_SIGNATURE_ALGORITHMS: readonly UWSignatureAlgorithm[] = Object.freeze([
  'ed25519',
  'es256',
  'es384',
]);

/** Identity and digest of the ancestor that asserted an inherited value. */
export interface InheritedFrom {
  document_id: string;
  /** `sha256:<64 lowercase hex>` over the ancestor's canonical form. */
  digest: string;
  /** Hops up the composition DAG; 1 is the immediate parent. */
  distance: number;
}

/**
 * Identity, vintage, and digest of the observation set a value was promoted
 * from. The digest is what makes it checkable rather than merely stated.
 */
export interface MarketDataRef {
  document_id: string;
  /** Whole ASCII Gregorian YYYY-MM-DD, years0001–9999, no normalization (RFC0095). */
  as_of: string;
  /** `sha256:<64 lowercase hex>` over the observation set's canonical form. */
  digest: string;
  /** Why this observation was accepted as the underwritten value. */
  rationale?: string;
}

// ─── Fence annotation (parsed from the opening ``` line) ─────────────────────

export interface UWFenceAnnotation {
  section: string;
  source?: string;
  ts?: string;
  v?: number;
  superseded?: boolean;
  variant?: string;
  confidence?: ConfidenceLevel;
  [key: string]: string | number | boolean | undefined;
}

// ─── A single parsed data block ───────────────────────────────────────────────

export interface UWBlock<T extends Record<string, unknown> = Record<string, unknown>> {
  annotation: UWFenceAnnotation;
  meta: UWMeta;
  content: T;
  prose: string;       // markdown text immediately preceding this block
  rawJson: string;
  lineStart: number;   // 1-indexed line of the opening fence
  lineEnd: number;     // 1-indexed line of the closing ```
}

// ─── Frontmatter ──────────────────────────────────────────────────────────────

export interface UWQuickMetrics {
  purchase_price?: number | null;
  loan_amount?: number | null;
  noi_underwritten?: number | null;
  dscr?: number | null;
  ltv?: number | null;
  /** Loan-to-cost, a fraction (RFC 0107); a Format §5.2 `FV-15` home. */
  ltc?: number | null;
  debt_yield?: number | null;
  cap_rate?: number | null;
  irr_projected?: number | null;
  equity_required?: number | null;
  [key: string]: number | null | undefined;
}

export interface UWFrontmatter {
  uw_version: string;
  deal_id: string;
  deal_name: string;
  created: string;
  last_modified: string;
  property_address: string;
  city: string;
  state: string;
  zip: string;
  /**
   * Builtin, or a module-declared custom identifier (RFC 0003). A namespaced
   * value obliges the file to name its modules in `modules` — see
   * `declaredModuleDependencies`.
   */
  asset_class: UWAssetClassId;
  /**
   * Display locale the file was authored in (RFC 0001). Absent = `en-US`.
   * Governs chat/summary/report display only; content stays canonical and
   * locale-free. An unregistered value is LOC-01 and refuses display renders.
   */
  locale?: string;
  /** Optional document-level monetary denomination (RFC 0046). */
  currency_code?: string;
  /** Open descriptive subtype; build_to_rent is defined only on multifamily (§2.2c). */
  asset_subtype?: string | null;
  loan_type?: string | null;
  /** Single business plan (§2.2b), independent of product, program and hold strategy. */
  scenario?: UWScenarioId | null;
  status?: string;
  deal_stage?: DealStage;
  recommendation?: string | null;
  quick_metrics?: UWQuickMetrics;
  flags?: string[];
  blocking_flags?: string[];
  tier?: 'screener' | 'analyst';
  institution_config_id?: string | null;
  created_by?: string;
  source_documents?: string[];
  [key: string]: unknown;
}

// ─── Parsed file output ───────────────────────────────────────────────────────

export interface ParsedSections {
  // Single-variant sections: section_id → current block
  // Multi-variant sections: section_id → { variant_id: block }
  [sectionId: string]: UWBlock | { [variant: string]: UWBlock };
}

/** Exact nullable extension identity; never coerce absence to literal default. */
export type UWExtensionEntry<T> =
  | { mode: 'single'; block: T }
  | { mode: 'variants'; blocks: Array<{ variant: string | null; block: T }> };

export type UWParsedExtensionEntry = UWExtensionEntry<UWBlock>;

export interface ParsedUWFile {
  frontmatter: UWFrontmatter;
  sections: ParsedSections;
  prose: { [sectionId: string]: string };
  pipeline_log: UWBlock[];
  custom_calculations: UWBlock[];
  custom_scenarios: UWBlock[];
  extensions: Record<string, UWParsedExtensionEntry>;
  superseded: { [sectionId: string]: UWBlock[] };
  raw: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationMessage {
  code: string;
  severity: ValidationSeverity;
  section?: string;
  field?: string;
  message: string;
  value?: unknown;
  threshold?: { min?: number; max?: number };
  /** Short title from BUILTIN_REMEDIATIONS, when a matching registry entry exists. */
  title?: string;
  /** Imperative remediation copy from BUILTIN_REMEDIATIONS, when available. */
  remediation?: string;
  /** Spec section anchor for deep-linking, when available. */
  spec_ref?: string;
}

export interface StageReadiness {
  scope: boolean;
  screening: boolean;
  term_sheet: boolean;
  full_underwrite: boolean;
  credit_approval: boolean;
  closing: boolean;
  monitoring: boolean;
}

export interface ValidationResult {
  /**
   * The rule set the record was validated under: its declared Format version
   * (`uw_version`), Protocol §XII.5 (RFC 0111 D5).
   */
  rule_set: string;
  overall_status: 'clean' | 'warnings' | 'errors' | 'blocking';
  stage_readiness: StageReadiness;
  issues: ValidationMessage[];
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
  /**
   * Format §5.2 financial-validity findings (RFC 0109). They describe the deal,
   * not the record: never in `issues`, never counted in `overall_status`.
   * Always present, possibly empty.
   */
  deal_flags: DealFlag[];
  /** One entry per registered `CC-NN` rule (`CROSS_CHECK_RULE_IDS`), RFC 0037. */
  coverage: Record<string, CrossCheckCoverage>;
}

/**
 * One Format §5.2 band crossed at one home (RFC 0109). `band` names the column
 * crossed; there is deliberately no `severity`, so no reader counts a weak deal
 * as a defective record.
 */
export interface DealFlag {
  code: string;
  section: string;
  field: string;
  message: string;
  value: number;
  threshold: { min?: number; max?: number };
  band: 'error' | 'warning';
}

/** The registered Format §5.2 financial-validity codes (RFC 0105, RFC 0107, RFC 0109). */
export const FINANCIAL_VALIDITY_CODES = [
  'FV-01', 'FV-02', 'FV-03', 'FV-04', 'FV-05', 'FV-06', 'FV-07',
  'FV-08', 'FV-09', 'FV-10', 'FV-11', 'FV-12', 'FV-13', 'FV-14', 'FV-15',
] as const;

/** Validation policy an institution configuration supplies beyond thresholds. */
export interface ValidationPolicy {
  /**
   * `validation_overrides.financial_validity_errors` (RFC 0109 D3): for each
   * listed code an error-band finding is reported as an `error` issue instead
   * of a deal flag. A warning-band finding stays a flag (D4).
   */
  financial_validity_errors?: readonly string[];
}

// Default financial validity thresholds (spec §5.2)
export interface FinancialThresholds {
  dscr: { error_below: number; warning_below: number };
  ltv: { warning_above: number; error_above: number };
  debt_yield: { warning_below: number };
  cap_rate: { warning_below: number; warning_above: number };
  vacancy_rate: { warning_below: number; warning_above: number };
  opex_ratio: { warning_below: number; warning_above: number };
  irr: { warning_below: number; warning_above: number };
  equity_multiple: { warning_below: number; warning_above: number };
  annual_rent_growth: { warning_above: number };
  ltc: { warning_above: number; error_above: number };
}

export const DEFAULT_THRESHOLDS: FinancialThresholds = {
  dscr:              { error_below: 1.0,  warning_below: 1.2 },
  ltv:               { warning_above: 0.75, error_above: 0.85 },
  debt_yield:        { warning_below: 0.07 },
  cap_rate:          { warning_below: 0.03, warning_above: 0.15 },
  vacancy_rate:      { warning_below: 0.02, warning_above: 0.40 },
  opex_ratio:        { warning_below: 0.20, warning_above: 0.70 },
  irr:               { warning_below: 0.05, warning_above: 0.40 },
  equity_multiple:   { warning_below: 1.0,  warning_above: 5.0 },
  annual_rent_growth:{ warning_above: 0.08 },
  ltc:               { warning_above: 0.80, error_above: 0.90 },
};

// ─── Parser options ───────────────────────────────────────────────────────────

export interface ParseOptions {
  strict?: boolean;                 // throw on JSON parse errors (default: false — collect)
  /** Observe each source block before routing/reduction (RFC 0084 accounting). */
  onBlock?: (block: UWBlock) => void;
  /** Observe frontmatter keys before assignment, including keys the reader refuses to retain. */
  onFrontmatterMember?: (path: readonly string[]) => void;
  thresholds?: Partial<FinancialThresholds>;  // institution overrides
}

// ─── Institution sidecar (.uw.institution.json) ───────────────────────────────

/** Canonical sidecar wire object (Format C.6, RFC0097); not a pure API map. */
export interface InstitutionConfig {
  validation_overrides?: {
    dscr_warning_below?: number;
    ltv_warning_above?: number;
    debt_yield_warning_below?: number;
    /** `FV-NN` codes whose error band fails validation (RFC 0109 D3). */
    financial_validity_errors?: string[];
    /** Other data is opaque and is never claimed applied. */
    [member: string]: unknown;
  };
  /** Forbidden wire member; pure APIs separately accept FinancialThresholds. */
  thresholds?: never;
  [member: string]: unknown;
}

/** Resolve only published builtin identities; never suffix-match custom ids. */
export function toBuiltinAssetClass(raw: string): AssetClass | null {
  return (ASSET_CLASSES as readonly string[]).includes(raw) ? raw as AssetClass : null;
}
