// UW Protocol — TypeScript contract surface for conforming implementers.
//
// This module is the executable counterpart to spec/UW_PROTOCOL_v1.md.
// Where the prose document defines normative behavior, this module names the
// types implementers must satisfy and exports the BUILTIN_* tables that any
// Tier-1+ Reader, Tier-2+ Editor, Tier-3+ Calc Host, or Tier-4 Agent Host
// references.
//
// Types defined in `./types.ts` are re-used here, never duplicated. The
// protocol surface is a layer over the format types — same way OpenAPI
// operations are a layer over JSON Schema.

import type {
  AssetClass,
  ConfidenceLevel,
  DealStage,
  FinancialThresholds,
  ParsedUWFile,
  PipelineStatus,
  UWBlock,
  UWMeta,
  ValidationMessage,
  ValidationSeverity,
} from './types.js';

// ─── Versioning ───────────────────────────────────────────────────────────────

/** Semver of this protocol. Bumped independently of @uwmd/core's npm version. */
export const PROTOCOL_VERSION = '1.0.0' as const;

/** Format spec version this protocol pairs with. */
export const FORMAT_VERSION = '1.1' as const;

// ─── Capability tiers ─────────────────────────────────────────────────────────

/** The four conformance tiers defined in UW_PROTOCOL_v1.md Part II. */
export type ViewerTier =
  | 'tier-1-reader'        // parse + display, read-only
  | 'tier-2-editor'        // round-trip writes, supersede semantics
  | 'tier-3-calc-host'     // evaluate custom_calculations / custom_scenarios
  | 'tier-4-agent-host';   // host AI agents that produce write_uw_section calls

/** What kind of actor the implementation serves. Informational. */
export type ViewerRole = 'web' | 'cli' | 'desktop' | 'ide-extension' | 'library' | 'service';

/**
 * Granular capability flags. Tiers are coarse; capabilities let an
 * implementer signal partial conformance (e.g. read-only viewer that
 * also supports editing one specific section).
 */
export type ViewerCapability =
  | 'parse'
  | 'validate'
  | 'render-json'
  | 'render-csv'
  | 'render-summary'
  | 'render-chat'
  | 'render-pdf'
  | 'render-docx'
  | 'edit-replace'
  | 'edit-supersede'
  | 'edit-frontmatter'
  | 'calc-evaluate'
  | 'calc-deterministic'
  | 'agent-host'
  | 'module-load';

/**
 * What a conforming implementation declares about itself. A reader of a
 * `.uw.md` file should be able to discover whether a given tool will be
 * able to handle the file by inspecting this manifest.
 */
export interface ImplementationManifest {
  /** Stable identifier (e.g. "io.uwmd.web-viewer"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semver of the implementation. */
  version: string;
  /** Protocol semver this implementation targets. */
  protocol_version: string;
  /** Format semver this implementation can read. */
  format_version: string;
  /** Tier the implementation self-certifies to. */
  tier: ViewerTier;
  /** Optional finer-grained capability list. */
  capabilities?: ViewerCapability[];
  /** Asset classes the implementation specifically supports (omit = all). */
  asset_classes?: AssetClass[];
  /** Role / form factor of the implementation. */
  role?: ViewerRole;
  /** Public homepage / docs URL. */
  homepage?: string;
}

// ─── Display conventions (Part III of the spec) ───────────────────────────────

/** Frozen to 'en-US' in v1; field reserved for v2 i18n work. */
export type SupportedLocale = 'en-US';

export interface NumberFormatRules {
  locale: SupportedLocale;
  currency: { decimals: number; symbol: string };
  percent:  { decimals: number; multiplier: number; suffix: string };
  ratio:    { decimals: number; suffix: string };
  count:    { thousands_separator: boolean };
  null_display: string;
}

export interface DateFormatRules {
  locale: SupportedLocale;
  /** 'iso' = passthrough of the source ISO-8601 string. */
  default_style: 'iso' | 'short' | 'medium' | 'long';
}

/** Default number-formatting table referenced by Part III §3.1. */
export const DEFAULT_NUMBER_FORMAT: NumberFormatRules = {
  locale: 'en-US',
  currency: { decimals: 0, symbol: '$' },
  percent:  { decimals: 2, multiplier: 100, suffix: '%' },
  ratio:    { decimals: 3, suffix: 'x' },
  count:    { thousands_separator: true },
  null_display: 'n/a',
};

export const DEFAULT_DATE_FORMAT: DateFormatRules = {
  locale: 'en-US',
  default_style: 'iso',
};

// ─── Badges (Part III §3.4) ───────────────────────────────────────────────────

export type ConfidenceBadgeStyle = 'pill' | 'icon' | 'text';

/** Compressed display hint for the source field on a UWMeta. */
export interface SourceBadge {
  source: string;             // raw _meta.source value
  display_label: string;      // short label (e.g. "AI", "Manual", "Document")
  authority: EditAuthority;   // who is allowed to overwrite this block
}

export type FlagSeverity = 'info' | 'warning' | 'blocking';

// ─── View models (Part IV) ────────────────────────────────────────────────────

/** A single field-level rendering hint inside a SectionViewModel. */
export interface FieldViewHint {
  /** Dot-path within the section's content, resolved via parser.deepGet. */
  path: string;
  /** Display label. */
  label: string;
  /** Formatting kind. Drives which formatter in `./format.ts` applies. */
  kind: 'currency' | 'percent' | 'ratio' | 'count' | 'date' | 'string' | 'enum' | 'list';
  /** True if this field should be highlighted as a primary metric. */
  primary?: boolean;
  /** Human-readable units for ratios/counts/strings (e.g. "yrs", "units"). */
  unit?: string;
  /** Decimals override (otherwise DEFAULT_NUMBER_FORMAT applies). */
  decimals?: number;
  /** For 'enum' kind: allowed values for badge coloring. */
  enum?: readonly string[];
}

/**
 * Layout description for a single section. Renderers walk this to produce
 * any presentation (web cards, terminal output, PDF, etc.) without
 * hard-coding section-specific knowledge.
 */
export interface SectionViewModel {
  section_id: string;
  display_name: string;
  /** Order in the standard section list (0..20 for the 21 standard sections). */
  display_order: number;
  /** Brief one-line description of what this section captures. */
  description: string;
  /** Fields to surface on the section's primary card / one-line summary. */
  primary_fields: FieldViewHint[];
  /** Fields shown on expand. */
  detail_fields?: FieldViewHint[];
  /** True if the section may have multiple variants (stress tests, scenarios). */
  multi_variant?: boolean;
}

export type ViewModelRegistry = Readonly<Record<string, SectionViewModel>>;

// ─── Edit semantics (Part V) ──────────────────────────────────────────────────

/** Who is permitted to overwrite a block, derived from `_meta.source`. */
export type EditAuthority =
  | 'agent_only'         // only the originating agent may overwrite
  | 'human_only'         // only manual edits may overwrite
  | 'either'             // agents or humans may overwrite
  | 'system_only';       // only system processes (init, migration) may overwrite

export interface EditPolicy {
  /** Glob-style pattern matching `_meta.source` (e.g. "agent/*", "manual"). */
  source_pattern: string;
  authority: EditAuthority;
  /** If true, edits MUST go through supersede (append a new block); else replace. */
  supersede_on_edit: boolean;
}

/**
 * A discrete edit operation against a parsed file. Tier-2 implementers
 * accept these and produce a new `.uw.md` with byte-stable formatting
 * for unrelated regions (round-trip preservation).
 */
export type EditOperation =
  | {
      kind: 'frontmatter_set';
      path: string;        // dot-path into frontmatter
      value: unknown;
    }
  | {
      kind: 'section_replace';
      section_id: string;
      variant?: string;
      content: Record<string, unknown>;
      meta: Partial<UWMeta>;
    }
  | {
      kind: 'section_supersede';
      section_id: string;
      variant?: string;
      content: Record<string, unknown>;
      meta: Partial<UWMeta>;
    }
  | {
      kind: 'pipeline_log_append';
      entry: Record<string, unknown>;
    };

// ─── Validation remediation (Part III §3.6) ───────────────────────────────────

export interface IssueRemediation {
  /** Validation code (e.g. "CC-01"). */
  code: string;
  /** Default severity emitted by validator.ts. */
  severity: ValidationSeverity;
  /** Short title shown in the issue list. */
  title: string;
  /** Plain-language description of what is wrong. */
  description: string;
  /** Imperative remediation copy ("Recompute LTV from current loan_amount / purchase_price."). */
  remediation: string;
  /** Spec section anchor for deep-linking. */
  spec_ref?: string;
}

// ─── Calc engine contract (Part VIII, Tier 3) ─────────────────────────────────

/**
 * Variables made available to a custom_calculation expression. The host
 * resolves `parsed` paths via parser.deepGet semantics.
 */
export interface CalcEvaluationContext {
  parsed: ParsedUWFile;
  /** Result map of previously-evaluated calculations in the same batch. */
  prior_results: Readonly<Record<string, number | string | boolean | null>>;
  /** Locale for number parsing. v1: must be 'en-US'. */
  locale: SupportedLocale;
}

export interface CalcResult {
  calc_id: string;
  ok: boolean;
  value: number | string | boolean | null;
  /** Unit string from the calc declaration (e.g. "%", "$", "x"). */
  unit?: string;
  /** Formatted display string per DEFAULT_NUMBER_FORMAT. */
  display?: string;
  error?: ProtocolError;
}

// ─── Agent host contract (Part IX, Tier 4) ────────────────────────────────────

export interface AgentHostCapability {
  /** Layer ID this host can run (e.g. "L6"). Maps to BANCROFT_LAYERS. */
  layer_id: string;
  /** Whether the host runs the layer with a real LLM (vs. dry-run replay). */
  live: boolean;
  /** Tool schemas the agent is allowed to call. */
  tools: ('write_uw_section' | 'write_multiple_sections')[];
}

// ─── Module manifest (Part X) ─────────────────────────────────────────────────

/**
 * A loaded module declaration. Mirrors the JSON Schema in
 * spec/schemas/module-manifest.schema.json — keep in lockstep.
 */
export interface ModuleManifest {
  manifest_version: '1';
  id: string;                       // reverse-DNS recommended
  name: string;
  version: string;                  // semver
  description: string;
  authors: string[];
  license: string;                  // SPDX identifier
  requires_protocol: string;        // semver range
  requires_format: string;          // semver range
  requires_tier: ViewerTier;
  asset_classes?: AssetClass[];
  deal_stages?: DealStage[];
  sections?: ModuleSectionDecl[];
  calculations?: ModuleCalcDecl[];
  validations?: ModuleValidationDecl[];
  thresholds?: Partial<FinancialThresholds>;
  view_models?: SectionViewModel[];
  ui?: Record<string, unknown>;     // free-form, host-specific
  agent_layers?: ModuleAgentLayerDecl[];
  depends_on?: { id: string; version: string }[];
}

export interface ModuleSectionDecl {
  id: string;
  display_name: string;
  schema: Record<string, unknown>;  // JSON Schema fragment
  required?: boolean;
}

export interface ModuleCalcDecl {
  id: string;
  label: string;
  formula: string;                  // safe-expression string
  unit?: string;
  /** True if the formula has no side effects and same inputs → same output. */
  deterministic: boolean;
}

export interface ModuleValidationDecl {
  code: string;                     // e.g. "CC-MOD-01"
  severity: ValidationSeverity;
  message: string;
  rule: string;                     // safe-expression returning boolean
}

export interface ModuleAgentLayerDecl {
  id: string;
  reads: string[];
  writes: string[];
  prompt_template: string;
}

export interface ModuleLoadResult {
  ok: boolean;
  manifest?: ModuleManifest;
  errors: ProtocolError[];
}

// ─── Error taxonomy (Part XI) ─────────────────────────────────────────────────

export type ProtocolErrorCategory =
  | 'parse'
  | 'validate'
  | 'render'
  | 'edit'
  | 'calc'
  | 'agent'
  | 'module'
  | 'version';

export interface ProtocolError {
  category: ProtocolErrorCategory;
  code: string;                     // e.g. "PROTO-EDIT-001"
  message: string;
  /** Path into the file (section.field or frontmatter.path). */
  pointer?: string;
  /** Suggested remediation text. */
  remediation?: string;
  /** Underlying error message if wrapping a thrown exception. */
  cause?: string;
}

// ─── Built-in tables ──────────────────────────────────────────────────────────

/**
 * View models for the 21 standard sections defined in UW_FORMAT_SPEC_v1.md §4.
 * Implementers SHOULD use these as the default rendering layout. Modules MAY
 * override per-section by declaring their own `view_models` entry.
 */
export const BUILTIN_VIEW_MODELS: ViewModelRegistry = Object.freeze({
  property: {
    section_id: 'property',
    display_name: 'Property',
    display_order: 0,
    description: 'Physical asset description: units, vintage, class, amenities.',
    primary_fields: [
      { path: 'total_units',         label: 'Units',        kind: 'count',   primary: true, unit: 'units' },
      { path: 'year_built',          label: 'Built',        kind: 'count' },
      { path: 'building_class',      label: 'Class',        kind: 'enum',    enum: ['A', 'B', 'C', 'D'] },
      { path: 'asset_subtype',       label: 'Subtype',      kind: 'string' },
    ],
    detail_fields: [
      { path: 'year_renovated',      label: 'Renovated',    kind: 'count' },
      { path: 'total_nra_sqft',      label: 'NRA',          kind: 'count',   unit: 'sqft' },
      { path: 'land_area_acres',     label: 'Land',         kind: 'ratio',   decimals: 2, unit: 'acres' },
      { path: 'parking_spaces',      label: 'Parking',      kind: 'count',   unit: 'spaces' },
      { path: 'zoning',              label: 'Zoning',       kind: 'string' },
      { path: 'condition',           label: 'Condition',    kind: 'string' },
      { path: 'deferred_maintenance_est', label: 'Deferred Maint', kind: 'currency' },
      { path: 'amenities',           label: 'Amenities',    kind: 'list' },
    ],
  },
  rent_roll: {
    section_id: 'rent_roll',
    display_name: 'Rent Roll',
    display_order: 1,
    description: 'Unit-level lease detail and current rent state.',
    primary_fields: [
      { path: 'total_units',         label: 'Total Units',  kind: 'count',   primary: true },
      { path: 'occupied_units',      label: 'Occupied',     kind: 'count',   primary: true },
      { path: 'physical_occupancy',  label: 'Occupancy',    kind: 'percent', primary: true },
      { path: 'avg_rent',            label: 'Avg Rent',     kind: 'currency' },
    ],
  },
  noi_model: {
    section_id: 'noi_model',
    display_name: 'NOI Model',
    display_order: 2,
    description: 'Underwritten T-12 normalized operating statement.',
    primary_fields: [
      { path: 'net_operating_income',     label: 'NOI',  kind: 'currency', primary: true },
      { path: 'effective_gross_income',   label: 'EGI',  kind: 'currency' },
      { path: 'total_operating_expenses', label: 'OpEx', kind: 'currency' },
      { path: 'opex_ratio',               label: 'OpEx Ratio', kind: 'percent' },
    ],
    detail_fields: [
      { path: 'gross_potential_rent',     label: 'GPR',         kind: 'currency' },
      { path: 'vacancy_loss',             label: 'Vacancy Loss', kind: 'currency' },
      { path: 'vacancy_rate',             label: 'Vacancy Rate', kind: 'percent' },
      { path: 'other_income',             label: 'Other Income', kind: 'currency' },
    ],
  },
  debt_structure: {
    section_id: 'debt_structure',
    display_name: 'Debt',
    display_order: 3,
    description: 'Loan terms and computed debt metrics.',
    primary_fields: [
      { path: 'loan_amount',     label: 'Loan',     kind: 'currency', primary: true },
      { path: 'interest_rate',   label: 'Rate',     kind: 'percent',  primary: true },
      { path: 'dscr',            label: 'DSCR',     kind: 'ratio',    primary: true },
      { path: 'ltv',             label: 'LTV',      kind: 'percent',  primary: true },
    ],
    detail_fields: [
      { path: 'loan_term_years',     label: 'Term',         kind: 'count', unit: 'yrs' },
      { path: 'amortization_years',  label: 'Amortization', kind: 'count', unit: 'yrs' },
      { path: 'io_period_months',    label: 'IO Period',    kind: 'count', unit: 'mo' },
      { path: 'debt_yield',          label: 'Debt Yield',   kind: 'percent' },
      { path: 'annual_debt_service', label: 'Annual DS',    kind: 'currency' },
      { path: 'recourse',            label: 'Recourse',     kind: 'string' },
    ],
  },
  valuation: {
    section_id: 'valuation',
    display_name: 'Valuation',
    display_order: 4,
    description: 'Purchase price, underwritten value, comparable analysis.',
    primary_fields: [
      { path: 'purchase_price',        label: 'Purchase Price', kind: 'currency', primary: true },
      { path: 'underwritten_value',    label: 'UW Value',       kind: 'currency' },
      { path: 'going_in_cap_rate',     label: 'Going-in Cap',   kind: 'percent', primary: true },
      { path: 'price_per_unit',        label: 'Price/Unit',     kind: 'currency' },
    ],
  },
  dcf: {
    section_id: 'dcf',
    display_name: 'DCF',
    display_order: 5,
    description: 'Discounted cash flow, hold-period assumptions, IRR.',
    primary_fields: [
      { path: 'levered_irr',                 label: 'Levered IRR',     kind: 'percent', primary: true },
      { path: 'levered_equity_multiple',     label: 'Equity Multiple', kind: 'ratio',   primary: true },
      { path: 'assumptions.hold_period_years', label: 'Hold',          kind: 'count', unit: 'yrs' },
      { path: 'assumptions.exit_cap_rate',     label: 'Exit Cap',      kind: 'percent' },
    ],
  },
  sources_uses: {
    section_id: 'sources_uses',
    display_name: 'Sources & Uses',
    display_order: 6,
    description: 'Capital stack reconciliation.',
    primary_fields: [
      { path: 'total_sources', label: 'Total Sources', kind: 'currency', primary: true },
      { path: 'total_uses',    label: 'Total Uses',    kind: 'currency', primary: true },
    ],
  },
  market_analysis: {
    section_id: 'market_analysis',
    display_name: 'Market',
    display_order: 7,
    description: 'MSA / submarket fundamentals and comp set.',
    primary_fields: [
      { path: 'msa',                    label: 'MSA',            kind: 'string', primary: true },
      { path: 'market_vacancy_rate',    label: 'Market Vacancy', kind: 'percent' },
      { path: 'average_asking_rent',    label: 'Asking Rent',    kind: 'currency' },
      { path: 'recent_rent_growth',     label: 'Rent Growth',    kind: 'percent' },
    ],
  },
  borrower_sponsor: {
    section_id: 'borrower_sponsor',
    display_name: 'Sponsor',
    display_order: 8,
    description: 'Borrower / sponsor financial strength.',
    primary_fields: [
      { path: 'name',              label: 'Sponsor',    kind: 'string', primary: true },
      { path: 'net_worth',         label: 'Net Worth',  kind: 'currency' },
      { path: 'liquidity',         label: 'Liquidity',  kind: 'currency' },
      { path: 'years_experience',  label: 'Experience', kind: 'count', unit: 'yrs' },
    ],
  },
  deal_context: {
    section_id: 'deal_context',
    display_name: 'Deal Context',
    display_order: 9,
    description: 'Investment thesis, value creation, hold strategy narrative.',
    primary_fields: [
      { path: 'investment_thesis',        label: 'Thesis',         kind: 'string', primary: true },
      { path: 'value_creation_strategy',  label: 'Value Creation', kind: 'string' },
      { path: 'hold_strategy',            label: 'Hold Strategy',  kind: 'string' },
    ],
  },
  stress_tests: {
    section_id: 'stress_tests',
    display_name: 'Stress Tests',
    display_order: 10,
    description: 'Sensitivity scenarios — vacancy, rate, exit cap shocks.',
    multi_variant: true,
    primary_fields: [
      { path: 'name',  label: 'Scenario', kind: 'string', primary: true },
      { path: 'dscr',  label: 'DSCR',     kind: 'ratio' },
      { path: 'irr',   label: 'IRR',      kind: 'percent' },
    ],
  },
  risk_assessment: {
    section_id: 'risk_assessment',
    display_name: 'Risk Assessment',
    display_order: 11,
    description: 'Aggregate risk rating and key risk factors.',
    primary_fields: [
      { path: 'overall_rating', label: 'Rating',     kind: 'string', primary: true },
      { path: 'risk_score',     label: 'Score',      kind: 'count' },
      { path: 'key_risks',      label: 'Key Risks',  kind: 'list' },
    ],
  },
  // Remaining standard sections registered with minimal hints; implementers
  // may pull richer view models from their own modules.
  loan_terms_summary: {
    section_id: 'loan_terms_summary', display_name: 'Loan Terms Summary', display_order: 12,
    description: 'Term sheet summary issued to borrower.',
    primary_fields: [],
  },
  closing_conditions: {
    section_id: 'closing_conditions', display_name: 'Closing Conditions', display_order: 13,
    description: 'CPs, post-close covenants, reserve requirements.',
    primary_fields: [],
  },
  third_party_reports: {
    section_id: 'third_party_reports', display_name: 'Third-Party Reports', display_order: 14,
    description: 'Appraisal, PCA, ESA, zoning, survey status.',
    primary_fields: [],
  },
  insurance: {
    section_id: 'insurance', display_name: 'Insurance', display_order: 15,
    description: 'Required coverages and current binder status.',
    primary_fields: [],
  },
  environmental: {
    section_id: 'environmental', display_name: 'Environmental', display_order: 16,
    description: 'Phase I / II findings and recognized environmental conditions.',
    primary_fields: [],
  },
  legal: {
    section_id: 'legal', display_name: 'Legal', display_order: 17,
    description: 'Title, survey, entity structure, ongoing litigation.',
    primary_fields: [],
  },
  compliance: {
    section_id: 'compliance', display_name: 'Compliance', display_order: 18,
    description: 'BSA/AML, OFAC, fair-lending, regulatory checks.',
    primary_fields: [],
  },
  monitoring: {
    section_id: 'monitoring', display_name: 'Monitoring', display_order: 19,
    description: 'Post-close performance tracking and covenant compliance.',
    primary_fields: [],
  },
  recommendation: {
    section_id: 'recommendation', display_name: 'Recommendation', display_order: 20,
    description: 'Final credit recommendation and rationale.',
    primary_fields: [
      { path: 'decision',   label: 'Decision',  kind: 'string', primary: true },
      { path: 'rationale',  label: 'Rationale', kind: 'string' },
    ],
  },
});

/**
 * Default edit policies derived from canonical `_meta.source` patterns.
 * Implementers consult this table to decide whether a write is a replace
 * or a supersede, and whether the actor is permitted to write at all.
 */
export const BUILTIN_EDIT_POLICIES: readonly EditPolicy[] = Object.freeze([
  { source_pattern: 'agent/*',     authority: 'either',      supersede_on_edit: true  },
  { source_pattern: 'manual',      authority: 'either',      supersede_on_edit: false },
  { source_pattern: 'document/*',  authority: 'either',      supersede_on_edit: true  },
  { source_pattern: 'system/*',    authority: 'system_only', supersede_on_edit: false },
  { source_pattern: 'institution/*', authority: 'system_only', supersede_on_edit: false },
]);

/**
 * Remediation copy for the cross-cutting consistency checks CC-01..CC-10
 * (see UW_FORMAT_SPEC_v1.md §5.3). Renderers SHOULD surface these strings
 * verbatim in any validation issue list — the goal is uniform UX across
 * every conforming implementation.
 */
export const BUILTIN_REMEDIATIONS: readonly IssueRemediation[] = Object.freeze([
  {
    code: 'CC-01', severity: 'error',
    title: 'NOI mismatch',
    description: 'noi_model.net_operating_income disagrees with quick_metrics.noi_underwritten.',
    remediation: 'Recompute NOI from the noi_model section and update frontmatter.quick_metrics.noi_underwritten.',
    spec_ref: '§5.3 CC-01',
  },
  {
    code: 'CC-02', severity: 'error',
    title: 'DSCR mismatch',
    description: 'debt_structure.dscr disagrees with quick_metrics.dscr.',
    remediation: 'Recompute DSCR = NOI / annual_debt_service and update both surfaces.',
    spec_ref: '§5.3 CC-02',
  },
  {
    code: 'CC-03', severity: 'error',
    title: 'LTV mismatch',
    description: 'debt_structure.ltv disagrees with quick_metrics.ltv.',
    remediation: 'Recompute LTV = loan_amount / purchase_price and update both surfaces.',
    spec_ref: '§5.3 CC-03',
  },
  {
    code: 'CC-04', severity: 'error',
    title: 'Sources & Uses imbalance',
    description: 'sources_uses.total_sources does not equal total_uses.',
    remediation: 'Reconcile capital stack — equity + debt proceeds + other sources MUST equal price + closing + reserves.',
    spec_ref: '§5.3 CC-04',
  },
  {
    code: 'CC-05', severity: 'error',
    title: 'Cap rate mismatch',
    description: 'valuation.going_in_cap_rate disagrees with quick_metrics.cap_rate.',
    remediation: 'Recompute cap rate = NOI / purchase_price and align both surfaces.',
    spec_ref: '§5.3 CC-05',
  },
  {
    code: 'CC-06', severity: 'warning',
    title: 'Debt yield mismatch',
    description: 'debt_structure.debt_yield disagrees with quick_metrics.debt_yield.',
    remediation: 'Recompute debt yield = NOI / loan_amount and align both surfaces.',
    spec_ref: '§5.3 CC-06',
  },
  {
    code: 'CC-07', severity: 'warning',
    title: 'IRR / equity multiple mismatch',
    description: 'dcf.levered_irr disagrees with quick_metrics.irr_projected.',
    remediation: 'Re-run the DCF and update quick_metrics.irr_projected from dcf.levered_irr.',
    spec_ref: '§5.3 CC-07',
  },
  {
    code: 'CC-08', severity: 'error',
    title: 'Equity required mismatch',
    description: 'sources_uses-derived equity disagrees with quick_metrics.equity_required.',
    remediation: 'Set quick_metrics.equity_required = sources_uses.sources.equity.',
    spec_ref: '§5.3 CC-08',
  },
  {
    code: 'CC-09', severity: 'warning',
    title: 'Stage readiness gap',
    description: 'A required section for the declared deal_stage is missing or low-confidence.',
    remediation: 'Either complete the required sections for this stage or downgrade frontmatter.deal_stage.',
    spec_ref: '§5.3 CC-09',
  },
  {
    code: 'CC-10', severity: 'info',
    title: 'Stale provenance',
    description: 'A section\'s _meta.timestamp is older than the file last_modified by more than 30 days.',
    remediation: 'Refresh the section, supersede with a new agent/manual write, or mark deliberate stale.',
    spec_ref: '§5.3 CC-10',
  },
]);

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type {
  AssetClass,
  ConfidenceLevel,
  DealStage,
  FinancialThresholds,
  ParsedUWFile,
  PipelineStatus,
  UWBlock,
  UWMeta,
  ValidationMessage,
  ValidationSeverity,
};
