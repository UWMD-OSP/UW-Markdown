// .uw.md format — TypeScript type definitions
// Spec: UW_FORMAT_SPEC_v1.md v1.1

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type PipelineStatus = 'complete' | 'in_progress' | 'pending' | 'skipped' | 'failed';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type DealStage =
  | 'screening'
  | 'term_sheet'
  | 'full_underwrite'
  | 'credit_approval'
  | 'closing'
  | 'monitoring';

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

export interface UWMeta {
  section: string;
  version: number;
  superseded: boolean;
  source: string;               // see spec §2.6 for source identifier patterns
  agent_id: string | null;
  agent_version: string | null;
  actor: string;
  timestamp: string;            // ISO8601
  confidence: ConfidenceLevel;
  human_review_required: boolean;
  flags: string[];
  input_hash: string | null;    // sha256:... — reproducibility anchor
  notes: string | null;
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
}

export interface StageReadiness {
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
