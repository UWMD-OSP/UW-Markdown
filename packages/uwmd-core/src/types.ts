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
  | 'investor_profile'
  | 'market_data'
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
