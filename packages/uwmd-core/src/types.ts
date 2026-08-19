// .uw.md format — TypeScript type definitions
// Spec: UW_FORMAT_SPEC_v1.md v1.1

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type PipelineStatus = 'complete' | 'in_progress' | 'pending' | 'skipped' | 'failed';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type DealStage =
  | 'scope'
  | 'screening'
  | 'term_sheet'
  | 'full_underwrite'
  | 'credit_approval'
  | 'closing'
  | 'monitoring';

/**
 * Source tags surface where a value came from. Producers stamp `_meta.source`
 * with a value drawn from this union or an institution-defined pattern (e.g.
 * 'agent/L6-01', 'document/rent_roll'). Free-form strings remain valid for
 * forward compat; this union enumerates the canonical values.
 *
 * Cascade-resolved values use the lower seven tags below; see protocol §IX.
 */
export type SourceTag =
  | 'user_input'
  | 'user_override'
  | 'manual'
  /**
   * A value inherited from an ancestor in the composition DAG (RFC 0021 §5).
   * Always carries `_meta.inherited_from` naming the asserting document, so it
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
  | 'land';

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
};

/**
 * Every v1 asset class, as a runtime list. Derived from {@link AssetClass} via
 * {@link ASSET_CLASS_MEMBERS}, so it is exactly the union — no more, no less.
 *
 * Adding an asset class is a normative format change (see RFC 0003 for
 * module-declared classes); this list is the library's mirror of the enum in
 * `spec/UW_FORMAT_SPEC_v1.md` and `spec/schemas/`, not an independent registry.
 */
export const ASSET_CLASSES: readonly AssetClass[] = Object.freeze(
  Object.keys(ASSET_CLASS_MEMBERS) as AssetClass[],
);

// ─── Provenance ───────────────────────────────────────────────────────────────

export interface UWFieldOverride {
  /** Dot-notated path relative to the block's content root (e.g. "units[7].current_rent"). */
  path: string;
  confidence?: ConfidenceLevel;
  source?: SourceTag;
  reason?: 'illegible' | 'missing' | 'overridden' | 'estimated' | 'computed';
  note?: string;
}

export interface UWMeta {
  section: string;
  version: number;
  superseded: boolean;
  source: SourceTag;            // see spec §2.6 for source identifier patterns
  agent_id: string | null;
  agent_version: string | null;
  actor: string;
  timestamp: string;            // ISO8601
  confidence: ConfidenceLevel;
  human_review_required: boolean;
  flags: string[];
  input_hash: string | null;    // sha256:... — reproducibility anchor
  notes: string | null;

  // ─── Optional integrity / quality fields (format spec Part III §3) ──────────

  /**
   * True when at least one field inside this block is missing or unknown.
   * When true, `field_overrides` SHOULD enumerate which paths and why.
   */
  partial?: boolean;

  /**
   * True when the entire block is a placeholder, derived from defaults rather
   * than observed data. Stronger signal than confidence:'low'. Downstream
   * consumers SHOULD label outputs derived from provisional blocks.
   */
  provisional?: boolean;

  /**
   * Per-field overrides where the block-level confidence/source does not apply
   * uniformly. The path is dot-notated relative to the block content root.
   */
  field_overrides?: UWFieldOverride[];

  /**
   * sha256 of the canonicalized block content (excluding _meta.content_hash
   * and _meta.signature themselves). See protocol §IX.2 for the
   * canonicalization rule. Optional; when present, the chain becomes
   * verifiable.
   */
  content_hash?: string;

  /**
   * content_hash of the block this one supersedes. null on a chain root.
   * Optional, but if any block in a supersede chain has it, all later blocks
   * in that chain MUST.
   */
  parent_hash?: string | null;

  /**
   * Which observation set a `market_data_accepted` value was promoted from
   * (RFC 0022 §4). REQUIRED whenever `source` is `market_data_accepted`, and
   * meaningless otherwise.
   *
   * Without it, "accepted from market data" is an unfalsifiable claim: a
   * reviewer could see the tag but never recover *which* observations, of which
   * vintage, were accepted — the exact gap RFC 0022 exists to close.
   */
  market_data_ref?: MarketDataRef;

  /**
   * Which ancestor asserted an `inherited_assumption` value (RFC 0021 §5).
   * REQUIRED whenever `source` is `inherited_assumption`, and meaningless
   * otherwise — an inherited value with no named ancestor is indistinguishable
   * from an ambient default, which is exactly what §5 forbids.
   */
  inherited_from?: InheritedFrom;
}

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
  /** ISO `YYYY-MM-DD`, copied from the observation set. */
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

export interface UWPipelineState {
  L0_ingestion?: PipelineStatus;
  L1_screening?: PipelineStatus;
  L2_underwriting?: PipelineStatus;
  L4_structuring?: PipelineStatus;
  L5_compliance?: PipelineStatus;
  L6_risk?: PipelineStatus;
  L7_assembly?: PipelineStatus;
}

export interface UWQuickMetrics {
  purchase_price?: number | null;
  loan_amount?: number | null;
  noi_underwritten?: number | null;
  dscr?: number | null;
  ltv?: number | null;
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
  asset_class: AssetClass;
  asset_subtype?: string | null;
  loan_type?: string | null;
  scenario?: string | null;
  pipeline_state?: UWPipelineState;
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

export interface ParsedUWFile {
  frontmatter: UWFrontmatter;
  sections: ParsedSections;
  prose: { [sectionId: string]: string };
  pipeline_log: UWBlock[];
  custom_calculations: UWBlock[];
  custom_scenarios: UWBlock[];
  extensions: { [extensionId: string]: UWBlock };
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
  /**
   * Deprecated string-form code from prior versions, emitted alongside
   * the canonical numeric `code` for one release as a migration aid.
   * Consumers should switch to reading `code`. Removal target: v1.2.
   */
  legacy_code?: string;
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
  overall_status: 'clean' | 'warnings' | 'errors' | 'blocking';
  stage_readiness: StageReadiness;
  issues: ValidationMessage[];
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info: ValidationMessage[];
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
  thresholds?: Partial<FinancialThresholds>;  // institution overrides
}

// ─── Institution sidecar (.uw.institution.json) ───────────────────────────────

export interface InstitutionConfig {
  institution_name: string;
  thresholds?: Partial<FinancialThresholds>;
  required_fields?: string[];       // dot-path fields that must be non-null
  render_template?: string;
}
