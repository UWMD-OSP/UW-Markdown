// Starter-product protocol tables (RFC 0078 D10, D11; RFC 0083).
//
// Display conventions, source badges, the builtin view models, the fallback
// cascade order, the agent host and capability tokens serve the non-normative
// starter products in docs/starter/, not verification. They were part of
// `protocol.ts`; they live here so the standard side of the library
// (`protocol.ts` and everything it reaches) never depends on them.
// `@uwmd/core` exports every name below unchanged from `index.ts` and
// `browser.ts`.

import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import type { CascadeStep, EditAuthority, SectionViewModel, SupportedLocale } from './protocol.js';

// ─── Display conventions (Part III of the spec) ───────────────────────────────

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
  source: string;             // raw _meta.provenance.source value
  display_label: string;      // short label (e.g. "AI", "Manual", "Document")
  authority: EditAuthority;   // who is allowed to overwrite this block
}

export type FlagSeverity = 'info' | 'warning' | 'blocking';

// ─── View models (Part IV) ────────────────────────────────────────────────────

export type ViewModelRegistry = Readonly<Record<string, SectionViewModel>>;

// ─── Fallback cascade (starter guide §IX) ─────────────────────────────────────

/** Ordered cascade as a runtime value (frozen). Index === precedence. */
export const CASCADE_ORDER: readonly CascadeStep[] = Object.freeze([
  'user_override',
  'user_input',
  'inherited_assumption',
  'investor_profile',
  'market_data',
  'asset_class_default',
  'global_default',
  'system_default',
]);

// ─── Agent host (starter guide §IX; non-normative since RFC 0078) ─────────────

export interface AgentHostCapability {
  /** Layer ID this host can run (e.g. "L6"). Maps to BANCROFT_LAYERS. */
  layer_id: string;
  /** Whether the host runs the layer with a real LLM (vs. dry-run replay). */
  live: boolean;
  /** Tool schemas the agent is allowed to call. */
  tools: ('write_uw_section' | 'write_multiple_sections')[];
}

// ─── Built-in tables ──────────────────────────────────────────────────────────

/**
 * View models for the standard sections defined in UW_FORMAT_SPEC.md §4.
 * Implementers SHOULD use these as the default rendering layout. Modules MAY
 * override per-section by declaring their own `view_models` entry.
 */
export const BUILTIN_VIEW_MODELS: ViewModelRegistry = Object.freeze({
  ...Object.fromEntries(Object.values(BUILTIN_CLASS_CONTENT).flatMap(c => c.view_models.map(v => [v.section_id, v]))),
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
    // Format §4.5 paths. Income and expense lines sit under `income` /
    // `expenses`, and a money line is `{ value, ... }`, so its hint reads
    // `.value`. A hint on the object itself formats as n/a.
    primary_fields: [
      { path: 'net_operating_income',              label: 'NOI',  kind: 'currency', primary: true },
      { path: 'income.effective_gross_income',     label: 'EGI',  kind: 'currency' },
      { path: 'expenses.total_operating_expenses', label: 'OpEx', kind: 'currency' },
      { path: 'expenses.expense_ratio',            label: 'OpEx Ratio', kind: 'percent' },
    ],
    detail_fields: [
      { path: 'income.gross_potential_rent.value',        label: 'GPR',         kind: 'currency' },
      { path: 'income.vacancy_credit_loss.value',         label: 'Vacancy Loss', kind: 'currency' },
      { path: 'income.vacancy_credit_loss.rate_applied',  label: 'Vacancy Rate', kind: 'percent' },
      { path: 'income.other_income.value',                label: 'Other Income', kind: 'currency' },
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
  lease_up_schedule: {
    section_id: 'lease_up_schedule',
    display_name: 'Lease-Up Schedule',
    display_order: 22,
    description: 'Period-by-period trajectory from current to stabilized rents (RFC 0008). State-and-verify: stated figures are recomputed by verifyLeaseUpSchedule, never trusted.',
    multi_variant: true,
    primary_fields: [
      { path: 'model_type',                          label: 'Model',         kind: 'enum', enum: ['natural_turnover', 'absorption_curve'], primary: true },
      { path: 'stabilization_target',                label: 'Stabilizes',    kind: 'string', primary: true },
      { path: 'stabilized_summary.occupancy_rate',   label: 'Stab. Occ.',    kind: 'percent' },
      { path: 'stabilized_summary.annualized_noi',   label: 'Stab. NOI',     kind: 'currency' },
    ],
    detail_fields: [
      { path: 'period_granularity',                          label: 'Granularity',  kind: 'enum', enum: ['monthly', 'quarterly'] },
      { path: 'assumptions.monthly_turnover_rate',           label: 'Turnover/mo',  kind: 'percent' },
      { path: 'assumptions.vacancy_during_lease_up',         label: 'Lease-up Vac', kind: 'percent' },
      { path: 'assumptions.market_rent_psf_at_stabilization', label: 'Mkt Rent PSF', kind: 'currency' },
      { path: 'stabilized_summary.annualized_egi',           label: 'Stab. EGI',    kind: 'currency' },
    ],
  },
  cash_flow_series: {
    section_id: 'cash_flow_series',
    display_name: 'Cash Flow Series',
    display_order: 23,
    description: 'Dated, irregular cash flows on a real calendar (RFC 0034). State-and-verify: stated metrics are recomputed by verifyCashFlowSeries over the §VIII.9 procedures, never trusted.',
    multi_variant: true,
    primary_fields: [
      { path: 'label',                    label: 'Series',    kind: 'string', primary: true },
      { path: 'stated_metrics.xirr',      label: 'XIRR',      kind: 'percent', primary: true },
      { path: 'stated_metrics.total_net', label: 'Net Total', kind: 'currency' },
      { path: 'stated_metrics.moic',      label: 'MOIC',      kind: 'ratio' },
    ],
    detail_fields: [
      { path: 'day_count',                label: 'Day Count', kind: 'string' },
      { path: 'stated_metrics.xnpv.rate', label: 'XNPV Rate', kind: 'percent' },
      { path: 'stated_metrics.xnpv.value', label: 'XNPV',     kind: 'currency' },
    ],
  },
  distribution_waterfall: {
    section_id: 'distribution_waterfall',
    display_name: 'Distribution Waterfall',
    display_order: 24,
    description: 'Tiered LP/GP split of equity cash flows over a §4.26 dated series (RFC 0035). State-and-verify: the whole allocation is recomputed by verifyWaterfall per protocol §VIII.10, never trusted.',
    multi_variant: true,
    primary_fields: [
      { path: 'stated_outcomes.lp.xirr',       label: 'LP XIRR',  kind: 'percent', primary: true },
      { path: 'stated_outcomes.lp.moic',       label: 'LP MOIC',  kind: 'ratio', primary: true },
      { path: 'stated_outcomes.promote_total', label: 'Promote',  kind: 'currency' },
      { path: 'equity_split.lp',               label: 'LP Split', kind: 'percent' },
    ],
    detail_fields: [
      { path: 'cash_flow_ref.variant',         label: 'Cash Ref', kind: 'string' },
      { path: 'stated_outcomes.gp.xirr',       label: 'GP XIRR',  kind: 'percent' },
      { path: 'stated_outcomes.gp.moic',       label: 'GP MOIC',  kind: 'ratio' },
      { path: 'stated_outcomes.profit_total',  label: 'Profit',   kind: 'currency' },
    ],
  },
  gaps: {
    section_id: 'gaps', display_name: 'Gaps', display_order: 21,
    description: 'Open data gaps blocking stage advancement or carrying provisional defaults. Maintained by the editor when --maintain-gaps is on; otherwise hand-curated.',
    primary_fields: [
      { path: 'summary.total_open',              label: 'Open',              kind: 'count', primary: true },
      { path: 'summary.blocking_current_stage',  label: 'Blocking Current',  kind: 'count' },
      { path: 'summary.blocking_next_stage',     label: 'Blocking Next',     kind: 'count' },
    ],
  },
});

// ─── Capability tokens (starter guide §XIV, RFC 0011) ─────────────────────────────
//
// An optional second gate on writes, for orchestrator-bound deployments: a
// short-lived, scope-limited JWT the editor verifies before accepting an edit.
// Core defines only the interface — the crypto lives behind it, in
// `@uwmd/signing`'s `createCapabilityVerifier` (the RFC 0016
// ReceiptSignatureVerifier injection precedent). Tokens NARROW authority,
// never widen it: the §V.3 static policy check runs first and a token cannot
// override its refusal.

/** Why a capability token was rejected (starter guide §XIV.3). */
export type CapabilityRejection =
  | 'expired'
  | 'not_yet_valid'
  | 'wrong_audience'
  | 'wrong_deal'
  | 'wrong_section'
  | 'wrong_stage'
  | 'wrong_op'
  /** The token's `sub` is not the prospective block's `_meta.provenance.source`. */
  | 'sub_mismatch'
  | 'bad_signature'
  | 'unknown_kid'
  | 'malformed';

/** The edit the verifier is asked to authorize, as the editor sees it. */
export interface CapabilityVerifyContext {
  /** The file's frontmatter `deal_id`. */
  deal_id: string;
  /**
   * The target section id. Frontmatter ops use the reserved name
   * `_frontmatter`; pipeline-log appends use `pipeline_log`.
   */
  section: string;
  /** The file's declared `deal_stage`, or null when none is declared. */
  stage: string | null;
  /** The EditOperation kind. */
  op: string;
  /** The prospective block's `_meta.provenance.source` (the RFC 0031 actor). */
  source: string;
}

export type CapabilityVerdict =
  | { ok: true; sub: string; jti: string }
  | { ok: false; reason: CapabilityRejection };

/**
 * Verifies a capability token against the edit it claims to authorize.
 * Injected into `applyEditAsync` via `EditOptions.capabilityVerifier`; when
 * one is configured, every write MUST present a token it accepts (POL-03
 * otherwise). Async because verification is Web Crypto.
 */
export interface CapabilityVerifier {
  verify(token: string, ctx: CapabilityVerifyContext): Promise<CapabilityVerdict>;
}
