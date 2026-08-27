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
  UWSignatureAlgorithm,
  ValidationMessage,
  ValidationSeverity,
} from './types.js';

import { deepGet, getSection, getSectionVariant } from './parser.js';
import { CORE_VERSION } from './version.js';

// ─── Versioning ───────────────────────────────────────────────────────────────

/** Semver of this protocol. Bumped independently of @uwmd/core's npm version. */
export const PROTOCOL_VERSION = '1.7.0' as const;

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
  | 'module-load'
  /** Verifies `_meta.signature` on blocks (§V.11.5, RFC 0010). */
  | 'signing'
  /** Verifies `ModuleManifest.signature` and honors a host policy (§X.1.4, RFC 0002). */
  | 'module-signature-verification';

export type RepresentationFidelity = 'source' | 'model' | 'view';
export type RepresentationDirection = 'read' | 'write';

/** Discoverable support for one source, model, or view representation. */
export interface RepresentationCapability {
  id: string;
  media_types: string[];
  file_extensions: string[];
  directions: RepresentationDirection[];
  fidelity: RepresentationFidelity;
  representation_version: string;
  /** Required for view-fidelity representations. */
  view?: string;
  streaming?: boolean;
  max_bytes?: number;
}
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
  /** Machine-readable representation discovery (Protocol 1.2+). */
  representations?: RepresentationCapability[];
  /** Asset classes the implementation specifically supports (omit = all). */
  asset_classes?: AssetClass[];
  /** Role / form factor of the implementation. */
  role?: ViewerRole;
  /** Public homepage / docs URL. */
  homepage?: string;
}

/**
 * What `@uwmd/core` itself self-certifies to — the answer `uwmd manifest`
 * returns, and the reference entry in any cross-implementation report.
 *
 * A literal rather than something assembled at call time, because the
 * conformance driver treats it as the identity of the implementation under
 * test: a manifest that varied with the caller's environment would make two
 * runs of the same suite incomparable.
 */
export const REFERENCE_IMPLEMENTATION_MANIFEST: ImplementationManifest = Object.freeze({
  id: 'org.uwmd.core',
  name: '@uwmd/core reference implementation',
  version: CORE_VERSION,
  protocol_version: PROTOCOL_VERSION,
  format_version: FORMAT_VERSION,
  tier: 'tier-4-agent-host',
  capabilities: Object.freeze([
    'parse',
    'validate',
    'render-json',
    'render-csv',
    'render-summary',
    'render-chat',
    'edit-replace',
    'edit-supersede',
    'edit-frontmatter',
    'calc-evaluate',
    'calc-deterministic',
    'agent-host',
    'module-load',
    // Both are gated on the optional @uwmd/signing package being installed.
    // Claimed here because the reference *implementation* is the pair: core
    // defines the contract, signing supplies the algorithms, and an adopter
    // asking "does this implementation verify signatures" means the pair.
    'signing',
    'module-signature-verification',
  ]) as ViewerCapability[],
  role: 'library',
  homepage: 'https://uwmd.org',
});

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

// ─── Source tags & fallback cascade (Protocol §IX) ────────────────────────────

/**
 * Ordered cascade steps used to resolve a value that has no explicit
 * user input or document extraction. A producer MUST stamp
 * `_meta.source` with the cascade step that produced the value, and
 * MUST NOT reorder this cascade. See protocol §IX.
 *
 * Step 0 (`user_override`) and step 1 (`user_input`) are detected by
 * walking the parsed file for an existing block at the field path
 * whose `_meta.source` matches; the remaining steps are looked up in
 * external tables (inherited assumptions, investor profile, market data)
 * or built-in tables (asset class, global, system).
 *
 * **`inherited_assumption` was added by RFC 0021 §5 (protocol 1.5.0),**
 * taking the cascade from seven steps to eight. It sits directly below
 * `user_input`, so a value someone entered on the deal always beats one
 * inherited from an ancestor — inheritance supplies defaults, it never
 * overrides.
 *
 * It sits *above* `investor_profile`, which the RFC's own diagram is silent
 * on because that diagram omits `investor_profile` entirely. Resolved on the
 * merits: an inherited assumption comes from a named ancestor in this deal's
 * composition DAG, so it is more specific to this deal than an
 * institution-wide preference set, and the more specific source should win.
 *
 * Inheritance resolves along the composition DAG **only**. A document not
 * reachable as an ancestor contributes nothing, and there is no ambient or
 * global assumption scope — so a standalone record, which is every record
 * that existed before RFC 0021, can never resolve at this step and no
 * existing digest moves.
 */
export type CascadeStep =
  | 'user_override'
  | 'user_input'
  | 'inherited_assumption'
  | 'investor_profile'
  | 'market_data'
  | 'asset_class_default'
  | 'global_default'
  | 'system_default';

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

/**
 * The full set of canonical short-form source tags producers stamp into
 * `_meta.source`. Eight of these match `CascadeStep` 1:1; the rest are
 * non-cascade tags — `manual`, `ai_extracted`, `agent_computed`,
 * `scenario_default`, and `market_data_accepted`.
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
 * Long-form patterns (e.g. `agent/L6-01`, `document/rent_roll`,
 * `import:filename.pdf`) remain valid; this constant enumerates the
 * canonical short forms only.
 */
export const SOURCE_TAGS = Object.freeze([
  'user_input',
  'user_override',
  'manual',
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

// ─── Incomplete-data policies (Format Spec §4.22) ─────────────────────────────

/**
 * What a producer should do when an incomplete-data condition (missing or
 * provisional value) is encountered for a `(section, field, stage)` tuple.
 *
 * - `halt`        — refuse to advance; surface as DQ-02 error.
 * - `degrade`     — continue, but mark the affected output as conditional.
 * - `substitute`  — fill from the cascade step named by `fallback_source`.
 * - `defer`       — continue and surface the gap; treat the deficiency as
 *                   acceptable at this stage.
 */
export type GapAction =
  | { kind: 'halt' }
  | { kind: 'degrade' }
  | { kind: 'substitute'; fallback_source: CascadeStep }
  | { kind: 'defer' };

export interface IncompleteDataPolicy {
  /** Section the policy applies to. Required. */
  section: string;
  /** Optional dot-path within the section. When omitted, the policy applies
   *  to the whole section. */
  field_path?: string;
  /** Optional pipeline stage. When omitted, the policy applies at every stage. */
  stage?: import('./types.js').DealStage;
  action: GapAction;
  /** Human-readable explanation of why this policy exists. */
  rationale?: string;
}

/**
 * Curated default policies covering high-impact (section, stage) pairs in the
 * multifamily workflow. Adopters MAY extend this set; lookups consult adopter
 * policies first, then these defaults.
 *
 * Policies stack: more-specific (with field_path) wins over less-specific;
 * within the same specificity, more-specific stage wins over wildcard.
 */
export const BUILTIN_INCOMPLETE_DATA_POLICIES: readonly IncompleteDataPolicy[] = Object.freeze([
  // ─── rent_roll ─────────────────────────────────────────────────────────────
  {
    section: 'rent_roll',
    stage: 'scope',
    action: { kind: 'substitute', fallback_source: 'asset_class_default' },
    rationale: 'Scope-stage triage: assume default vacancy/occupancy.',
  },
  {
    section: 'rent_roll',
    stage: 'screening',
    action: { kind: 'degrade' },
    rationale: 'Screening tolerates estimates; surface as conditional.',
  },
  {
    section: 'rent_roll',
    stage: 'full_underwrite',
    action: { kind: 'halt' },
    rationale: 'Full underwrite requires the actual rent roll.',
  },

  // ─── noi_model ─────────────────────────────────────────────────────────────
  {
    section: 'noi_model',
    field_path: 'expense_ratio',
    stage: 'scope',
    action: { kind: 'substitute', fallback_source: 'asset_class_default' },
  },
  {
    section: 'noi_model',
    stage: 'scope',
    action: { kind: 'substitute', fallback_source: 'asset_class_default' },
  },
  {
    section: 'noi_model',
    stage: 'screening',
    action: { kind: 'degrade' },
  },
  {
    section: 'noi_model',
    stage: 'full_underwrite',
    action: { kind: 'halt' },
    rationale: 'Full underwrite requires a T-12 / proforma derived NOI.',
  },

  // ─── debt_structure ────────────────────────────────────────────────────────
  {
    section: 'debt_structure',
    stage: 'scope',
    action: { kind: 'substitute', fallback_source: 'asset_class_default' },
  },
  {
    section: 'debt_structure',
    stage: 'screening',
    action: { kind: 'substitute', fallback_source: 'investor_profile' },
  },
  {
    section: 'debt_structure',
    stage: 'term_sheet',
    action: { kind: 'halt' },
    rationale: 'Term sheet stage requires concrete debt terms.',
  },

  // ─── valuation ─────────────────────────────────────────────────────────────
  {
    section: 'valuation',
    stage: 'scope',
    action: { kind: 'substitute', fallback_source: 'asset_class_default' },
  },
  {
    section: 'valuation',
    stage: 'full_underwrite',
    action: { kind: 'halt' },
  },

  // ─── borrower_sponsor ──────────────────────────────────────────────────────
  {
    section: 'borrower_sponsor',
    stage: 'screening',
    action: { kind: 'defer' },
    rationale: 'Sponsor diligence often arrives later; record but allow advance.',
  },
  {
    section: 'borrower_sponsor',
    stage: 'credit_approval',
    action: { kind: 'halt' },
  },

  // ─── compliance ────────────────────────────────────────────────────────────
  {
    section: 'compliance',
    stage: 'closing',
    action: { kind: 'halt' },
    rationale: 'Compliance gaps cannot be carried into closing.',
  },
]);

/**
 * Look up the most-specific applicable policy for `(section, field_path, stage)`.
 *
 * Specificity order (highest to lowest):
 *   1. matching section + matching field_path + matching stage
 *   2. matching section + matching field_path (any stage)
 *   3. matching section + matching stage (any field)
 *   4. matching section (any field, any stage)
 *
 * Returns null when no policy matches.
 */
export function lookupIncompleteDataPolicy(
  section: string,
  field_path: string | undefined,
  stage: import('./types.js').DealStage,
  policies: readonly IncompleteDataPolicy[] = BUILTIN_INCOMPLETE_DATA_POLICIES,
): IncompleteDataPolicy | null {
  let best: IncompleteDataPolicy | null = null;
  let bestScore = -1;
  for (const p of policies) {
    if (p.section !== section) continue;
    const fieldMatch = p.field_path === undefined || p.field_path === field_path;
    if (!fieldMatch) continue;
    const stageMatch = p.stage === undefined || p.stage === stage;
    if (!stageMatch) continue;
    let score = 0;
    if (p.field_path !== undefined) score += 4;
    if (p.stage !== undefined) score += 2;
    // Tie-break: prefer policies for the exact stage over wildcard, even if
    // both have field_path defined.
    if (p.stage === stage) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

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
  /**
   * The result. A numeric value is **quantized** per §VIII.5 — the reported
   * value is the one a digest covers, so it carries no unquantized tail.
   */
  value: number | string | boolean | null;
  /** Unit string from the calc declaration (e.g. "%", "$", "x"). */
  unit?: string;
  /**
   * Decimal places `value` was quantized to. Echoed rather than left implicit so
   * a consumer can see the precision contract it actually got, including when
   * the declaration relied on the unit default.
   */
  round_to?: number;
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
  /**
   * Detached signature over the canonical manifest (§X.1, RFC 0002).
   *
   * Advisory at the protocol level: what to do with an unsigned module, or one
   * whose signature fails, is a host-policy decision. What the protocol fixes is
   * the *surface*, so that two hosts agree on what "signature valid" means.
   */
  signature?: ModuleSignature;
}

/**
 * A detached signature over a module manifest.
 *
 * Deliberately the same shape as `UWMeta.signature` (§V.11) plus a `scheme`
 * discriminator and an optional identity claim. A module manifest and a block
 * are different artifacts, but "who signed this, with which key, when" is the
 * same question, and answering it two different ways would mean two verifiers,
 * two key-store formats, and two chances to get the canonicalization wrong.
 */
export interface ModuleSignature {
  /**
   * Signing scheme. `uwmd-keystore` is a detached signature over the canonical
   * manifest, verified against a key store the host holds — the same machinery
   * as block signatures.
   *
   * `sigstore` is reserved, not implemented: keyless signing needs a Fulcio
   * trust root and a Rekor inclusion proof, which means a vendored root
   * snapshot and network verification. Both sit badly with a protocol whose
   * conformance corpus is offline and deterministic. The discriminator exists
   * so adding it later is additive rather than a breaking change.
   */
  scheme: 'uwmd-keystore';
  /** Algorithm, from the same closed set as block signatures (§V.11). */
  alg: UWSignatureAlgorithm;
  /** Opaque key identifier the host resolves in its own key store. */
  kid: string;
  /** Base64url-encoded (unpadded) signature bytes. */
  sig: string;
  /** ISO 8601 instant the signature was produced. */
  signed_at: string;
  /**
   * Identity the signer claims (an email, a domain, an org). **Advisory and
   * unverified by this layer** — it is a hint for humans and for a host's
   * allow-list policy, and a host that trusts it without checking that the
   * `kid` actually belongs to that identity has learned nothing.
   */
  identity?: string;
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
  /**
   * Decimal places the reported value is quantized to, half away from zero
   * (§VIII.5). Integer in [0, 12]. Omitted means "use the normative default for
   * `unit`" — see `resolveRoundTo` in `calc/quantize.ts`. This is a precision
   * *contract*, not a display hint; `display` remains separate.
   */
  round_to?: number;
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

// ─── Standard section registry (FORMAT_SPEC Part IV) ─────────────────────────

/**
 * The section ids the format registers in `UW_FORMAT_SPEC_v1.md` Part IV: the
 * 21 standard data sections (§ 4.0 – § 4.20) plus `gaps` (§ 4.22). Each entry is
 * the `**ID:**` that subsection declares. § 4.21 is the `x_` extension
 * meta-spec, which registers a namespace rather than a section, so it has no id
 * here.
 *
 * This exists because "is this a section the format knows about?" had no single
 * answer in the library. `BUILTIN_VIEW_MODELS` claims to be that list and is
 * not — it omits eight of these (including `operating_statement`) and adds
 * eight ids Part IV never registers — and `lite-bridge.ts` keeps a third,
 * different list. Rather than pick one of two wrong answers, RFC 0022 reads the
 * spec, which is the authority. Reconciling the other two is tracked separately;
 * `protocol.test.ts` pins this list so it cannot drift from Part IV silently.
 *
 * Extension sections (`x_`-prefixed, § 4.21) are valid but deliberately absent:
 * they are institution-defined, so membership here would be a category error.
 * Use `isStandardSectionId` for registry membership and check the `x_` prefix
 * separately when extensions are permitted.
 */
export const STANDARD_SECTION_IDS: readonly string[] = Object.freeze([
  'deal_context',
  'property',
  'ownership',
  'rent_roll',
  'operating_statement',
  'noi_model',
  'valuation',
  'debt_structure',
  'sources_uses',
  'dcf',
  'stress_tests',
  'market_analysis',
  'borrower_sponsor',
  'due_diligence',
  'risk_assessment',
  'compliance',
  'assumptions',
  'validation',
  'pipeline_log',
  'custom_calculations',
  'custom_scenarios',
  'gaps',
  'components',
  'capital_stack',
]);

const STANDARD_SECTION_ID_SET = new Set(STANDARD_SECTION_IDS);

/** True when `id` is a section registered by FORMAT_SPEC Part IV. */
export function isStandardSectionId(id: string): boolean {
  return STANDARD_SECTION_ID_SET.has(id);
}

/** The `x_` namespace FORMAT_SPEC § 4.21 reserves for non-standard content. */
export const EXTENSION_SECTION_PREFIX = 'x_' as const;

// ─── Size-intensive registry (PROTOCOL §XIII, RFC 0027) ──────────────────────

/**
 * One asset class's entry in the Protocol §XIII selection table: which
 * `property` field is the class's size, what to call it, and what unit it
 * carries. The primary size field is the denominator that class's calc pack
 * uses for its per-unit value metrics.
 */
export interface SizeIntensive {
  /** Field path relative to the `property` section, e.g. `'keys'`. */
  readonly path: string;
  /** Display label, e.g. `'Keys'`, `'RSF'`. */
  readonly label: string;
  /** Unit token, e.g. `'keys'`, `'sqft'`. */
  readonly unit: string;
  /** Secondary size fields the class legitimately also states. */
  readonly secondary: readonly string[];
}

/**
 * The Protocol §XIII registry, keyed by asset class. `mixed_use` is
 * deliberately absent (§XIII.2): its size lives per-component in the
 * `components` section and MUST NOT be synthesized by summing across uses.
 * The table is closed for protocol 1.x (§XIII.3) — an unrecognized class has
 * no primary size field, never a guessed one.
 */
export const SIZE_INTENSIVES: Readonly<Record<string, SizeIntensive>> = Object.freeze({
  multifamily:     Object.freeze({ path: 'total_units',              label: 'Units',       unit: 'units', secondary: Object.freeze(['total_nra_sqft']) }),
  office:          Object.freeze({ path: 'rentable_square_feet',     label: 'RSF',         unit: 'sqft',  secondary: Object.freeze([]) }),
  industrial:      Object.freeze({ path: 'rentable_square_feet',     label: 'RSF',         unit: 'sqft',  secondary: Object.freeze([]) }),
  retail:          Object.freeze({ path: 'gross_leasable_area',      label: 'GLA',         unit: 'sqft',  secondary: Object.freeze([]) }),
  self_storage:    Object.freeze({ path: 'net_rentable_square_feet', label: 'NRSF',        unit: 'sqft',  secondary: Object.freeze(['rentable_units']) }),
  hospitality:     Object.freeze({ path: 'keys',                     label: 'Keys',        unit: 'keys',  secondary: Object.freeze([]) }),
  student_housing: Object.freeze({ path: 'total_beds',               label: 'Beds',        unit: 'beds',  secondary: Object.freeze(['total_units']) }),
  senior_housing:  Object.freeze({ path: 'total_units',              label: 'Units',       unit: 'units', secondary: Object.freeze(['total_beds']) }),
  land:            Object.freeze({ path: 'gross_acres',              label: 'Gross acres', unit: 'acres', secondary: Object.freeze(['usable_acres', 'entitled_units']) }),
});

/**
 * The §XIII selection: `null` for `mixed_use` (§XIII.2) and for any
 * unrecognized class (§XIII.3) — never a guess.
 */
export function getSizeIntensive(assetClass: string): SizeIntensive | null {
  return SIZE_INTENSIVES[assetClass] ?? null;
}

/**
 * The deal's size as `{basis, label, unit, quantity}`, selected through the
 * §XIII registry and read from the raw `property` section — never through the
 * cascade, because a deal's size is a fact about the asset, not a default
 * (RFC 0027, unresolved question 4). `null` when the class has no primary
 * size field, when there is no property section, or when the document omits
 * or non-numerically states the field.
 */
export function resolveDealSize(
  parsed: ParsedUWFile,
): { basis: string; label: string; unit: string; quantity: number } | null {
  const assetClass = parsed.frontmatter.asset_class;
  if (typeof assetClass !== 'string') return null;
  const intensive = getSizeIntensive(assetClass);
  if (!intensive) return null;
  const property =
    getSection(parsed, 'property') ?? getSectionVariant(parsed, 'property', 'default');
  if (!property) return null;
  // §VIII.2's unwrap rule, exactly as the calc evaluator applies it: when a
  // block stores the envelope shape, the user-facing payload lives one level
  // down at `content`. The registry must read the same payload the pack
  // divides by, or the two disagree about the same document.
  const payload =
    property.content && typeof property.content === 'object' && 'content' in property.content
      ? (property.content as Record<string, unknown>)['content']
      : property.content;
  const raw = deepGet(payload, intensive.path);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return { basis: intensive.path, label: intensive.label, unit: intensive.unit, quantity: raw };
}

// ─── Document profiles (RFC 0018 §1) ──────────────────────────────────────────

/**
 * A profile is a versioned contract for the *purpose and permitted sections* of
 * one document. It is not a filename extension, an asset class, a pipeline
 * stage, or a calculation pack. A document without a profile remains the
 * existing full underwriting record.
 */
export interface DocumentProfile {
  id: string;
  purpose: string;
  /** Frontmatter keys the profile requires beyond the format's own. */
  required_identity: readonly string[];
  /** Whether deterministic packs apply to this document's contents. */
  financial_role: 'underwriting' | 'descriptive' | 'evidence';
}

export const DEAL_UNDERWRITING_PROFILE = 'deal-underwriting-v1' as const;
export const LEASE_ABSTRACT_PROFILE = 'lease-abstract-v1' as const;
export const SOURCE_NOTE_PROFILE = 'source-note-v1' as const;
export const MARKET_DATA_PROFILE = 'market-data-v1' as const;

export const BUILTIN_DOCUMENT_PROFILES: readonly DocumentProfile[] = Object.freeze([
  Object.freeze({
    id: DEAL_UNDERWRITING_PROFILE,
    purpose: 'Complete or partial underwriting record.',
    required_identity: Object.freeze(['deal_id']),
    financial_role: 'underwriting',
  }),
  Object.freeze({
    id: LEASE_ABSTRACT_PROFILE,
    purpose: 'One executed lease and its amendments.',
    required_identity: Object.freeze(['document_id', 'lease_id']),
    financial_role: 'descriptive',
  }),
  Object.freeze({
    id: SOURCE_NOTE_PROFILE,
    purpose: 'Attributable transcription, summary, or diligence note.',
    required_identity: Object.freeze(['document_id']),
    financial_role: 'evidence',
  }),
  Object.freeze({
    // RFC 0022. `evidence`, not `underwriting`: a market-data document carries
    // observations, contains no calculations, and no pack applies to it. It has
    // no `deal_id` and must never be read as an underwriting record.
    id: MARKET_DATA_PROFILE,
    purpose: 'Dated, attributable market observations for one geography and asset class.',
    required_identity: Object.freeze(['document_id', 'as_of', 'provider', 'geo']),
    financial_role: 'evidence',
  }),
]) as readonly DocumentProfile[];

const PROFILE_BY_ID = new Map(BUILTIN_DOCUMENT_PROFILES.map((p) => [p.id, p]));

/**
 * Profile identifiers are opaque lowercase ASCII tokens. An unknown profile is
 * *preserved*, never reinterpreted — returning undefined means "not one we
 * implement", which is different from "invalid".
 */
export function lookupDocumentProfile(id: string): DocumentProfile | undefined {
  return PROFILE_BY_ID.get(id);
}

export const DOCUMENT_PROFILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ─── Canonical edge registry (RFC 0018 §5) ────────────────────────────────────
//
// ONE registry, TWO layers. RFC 0015 relates business *entities*; RFC 0018
// relates *documents inside a package*. Left as two tables they would both
// contain `guarantees` and `supports` and drift until the same token meant two
// different things depending on which document a reader happened to hold.
//
// RFC 0018 was accepted first, so this table is the canonical home. A future
// implementation of RFC 0015 amends it rather than starting a second one.

export type UWEdgeLayer = 'entity' | 'member';

/** Endpoint kinds an edge may connect. `any` accepts every kind on that layer. */
export type UWEdgeEndpointKind =
  | 'any'
  | 'borrower'
  | 'property'
  | 'loan'
  | 'deal'
  | 'document'
  | 'uw_document'
  | 'source_evidence'
  | 'underwriting_document';

export interface UWEdgeTypeDef {
  type: string;
  /** Layers this type is valid on. Two types are valid on both. */
  layers: readonly UWEdgeLayer[];
  from: readonly UWEdgeEndpointKind[];
  to: readonly UWEdgeEndpointKind[];
  /**
   * `required` — the edge must carry a non-empty provenance array (entity
   * layer). `manifest` — the package manifest *is* the provenance, because
   * every member is content-addressed by digest (member layer).
   */
  provenance: 'required' | 'manifest';
  meaning: string;
}

export const BUILTIN_EDGE_TYPES: readonly UWEdgeTypeDef[] = Object.freeze([
  Object.freeze({
    type: 'owns', layers: Object.freeze(['entity'] as const),
    from: Object.freeze(['borrower'] as const), to: Object.freeze(['property'] as const),
    provenance: 'required', meaning: 'Ownership of the asset.',
  }),
  Object.freeze({
    type: 'borrows_against', layers: Object.freeze(['entity'] as const),
    from: Object.freeze(['borrower'] as const), to: Object.freeze(['property'] as const),
    provenance: 'required', meaning: 'Borrowing secured by the asset.',
  }),
  Object.freeze({
    type: 'secures', layers: Object.freeze(['entity'] as const),
    from: Object.freeze(['property'] as const), to: Object.freeze(['loan'] as const),
    provenance: 'required', meaning: 'The asset secures the loan.',
  }),
  Object.freeze({
    type: 'related_to', layers: Object.freeze(['entity'] as const),
    from: Object.freeze(['any'] as const), to: Object.freeze(['any'] as const),
    provenance: 'required', meaning: 'Untyped association; the fallback.',
  }),
  Object.freeze({
    type: 'abstracts', layers: Object.freeze(['member'] as const),
    from: Object.freeze(['uw_document'] as const), to: Object.freeze(['source_evidence'] as const),
    provenance: 'manifest', meaning: 'This document is an extraction of that source.',
  }),
  Object.freeze({
    type: 'amends', layers: Object.freeze(['member'] as const),
    from: Object.freeze(['document', 'uw_document'] as const),
    to: Object.freeze(['document', 'uw_document'] as const),
    provenance: 'manifest', meaning: 'Modifies the terms of the target.',
  }),
  Object.freeze({
    // NOT the block-level `_meta.superseded`, which is append-only within a
    // single document and untouched by this registry. This relates two whole
    // documents in a package.
    type: 'supersedes', layers: Object.freeze(['member'] as const),
    from: Object.freeze(['document', 'uw_document'] as const),
    to: Object.freeze(['document', 'uw_document'] as const),
    provenance: 'manifest', meaning: 'Replaces the target wholesale.',
  }),
  Object.freeze({
    type: 'contributes_to', layers: Object.freeze(['member'] as const),
    from: Object.freeze(['document', 'uw_document'] as const),
    to: Object.freeze(['underwriting_document'] as const),
    provenance: 'manifest', meaning: 'Feeds the target underwriting record.',
  }),
  Object.freeze({
    // Shared. A guaranty *document* is the member-layer evidence for the
    // entity-layer fact that a borrower guarantees a loan — one relation
    // observed at two layers, not a collision to be renamed apart.
    type: 'guarantees', layers: Object.freeze(['entity', 'member'] as const),
    from: Object.freeze(['borrower', 'document', 'uw_document'] as const),
    to: Object.freeze(['loan', 'document', 'uw_document'] as const),
    provenance: 'required', meaning: 'Credit support for the target.',
  }),
  Object.freeze({
    type: 'supports', layers: Object.freeze(['entity', 'member'] as const),
    from: Object.freeze(['any'] as const), to: Object.freeze(['any'] as const),
    provenance: 'required', meaning: 'Evidentiary support, weaker than `abstracts`.',
  }),
]) as readonly UWEdgeTypeDef[];

const EDGE_TYPE_BY_NAME = new Map(BUILTIN_EDGE_TYPES.map((e) => [e.type, e]));

/**
 * Extension types are permitted at both layers and MUST be preserved by
 * consumers that cannot interpret them, so `undefined` means "not built in",
 * not "invalid".
 */
export function lookupEdgeType(type: string): UWEdgeTypeDef | undefined {
  return EDGE_TYPE_BY_NAME.get(type);
}

export function isEdgeTypeValidOnLayer(type: string, layer: UWEdgeLayer): boolean {
  const def = EDGE_TYPE_BY_NAME.get(type);
  return def ? def.layers.includes(layer) : true; // unknown → preserved, not rejected
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
  | 'version'
  | 'package';

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
  {
    code: 'CC-11', severity: 'error',
    title: 'Components section on a non-mixed-use document',
    description: 'A `components` section is present but frontmatter.asset_class is not `mixed_use`.',
    remediation: 'Set asset_class to `mixed_use`, or remove the components section and model the deal under its own asset class.',
    spec_ref: '§5.3 CC-11',
  },
  {
    code: 'CC-12', severity: 'error',
    title: 'Components do not foot to property NOI',
    description: 'noi_model.net_operating_income does not equal the sum of the component net_operating_income values.',
    remediation: 'Reconcile the component NOIs with the property NOI — the property figure MUST equal their sum (RFC 0019 §3a).',
    spec_ref: '§5.3 CC-12',
  },
  {
    code: 'CC-13', severity: 'warning',
    title: 'Primary size field not stated',
    description: 'The property section does not state the primary size field for frontmatter.asset_class (Protocol §XIII.1) — the denominator of every per-unit metric.',
    remediation: 'State the class\'s primary size field in the property section (e.g. keys for hospitality, rentable_square_feet for office); use null, never zero, when it is genuinely unknown.',
    spec_ref: '§5.3 CC-13',
  },
  {
    code: 'CC-14', severity: 'warning',
    title: 'Property section missing',
    description: 'A deal-record document has no property section; format spec §4.1 requires it at every pipeline stage (RFC 0028).',
    remediation: 'Add a property section stating at least the address and asset class. If the record intentionally has no property (a non-deal profile), declare that profile in document_profile.',
    spec_ref: '§5.3 CC-14',
  },
  {
    code: 'MU-01', severity: 'error',
    title: 'Too few components',
    description: 'A mixed-use property declares fewer than two admissible components.',
    remediation: 'Declare at least two components; a single-component deal is not mixed use and should use that component\'s own asset class.',
    spec_ref: '§4.23 MU-01',
  },
  {
    code: 'MU-02', severity: 'error',
    title: 'Inadmissible component class',
    description: 'A component key is not one of the eight income classes; `land` and unknown classes are excluded.',
    remediation: 'Remove the inadmissible component. Only multifamily, retail, office, industrial, self_storage, hospitality, senior_housing, and student_housing may appear.',
    spec_ref: '§4.23 MU-02',
  },
  {
    code: 'MU-03', severity: 'error',
    title: 'Component class/key mismatch',
    description: 'A component\'s component_class does not equal the key it is filed under.',
    remediation: 'Make component_class equal the key, or move the entry under the key that matches its component_class.',
    spec_ref: '§4.23 MU-03',
  },
  {
    code: 'MU-04', severity: 'error',
    title: 'Component missing NOI',
    description: 'A present component omits net_operating_income, which the property rollup consumes.',
    remediation: 'State the component\'s net_operating_income. A present use with no NOI is an incomplete document, not zero income.',
    spec_ref: '§4.23 MU-04',
  },
  {
    code: 'MU-05', severity: 'error',
    title: 'Component allocation does not sum to 1.0',
    description: 'allocation_pct across present components does not sum to 1.0 within 0.0001.',
    remediation: 'Reconcile the allocation split so present components sum to 1.0, or omit allocation_pct entirely (use-level intensive metrics then evaluate to null).',
    spec_ref: '§4.23 MU-05',
  },
  {
    code: 'MU-06', severity: 'error',
    title: 'Component-level debt not allowed',
    description: 'A component carries its own debt_structure; this section models one property-level loan.',
    remediation: 'Remove the component debt_structure. Component-level financing is expressed as a component-level capital_stack (§4.24, RFC 0026), which this section accepts and validates with the CS-* rules.',
    spec_ref: '§4.23 MU-06',
  },
  {
    code: 'CS-01', severity: 'error',
    title: 'Malformed capital-stack tranche',
    description: 'A tranche omits a required field (id, class, position, amount) or repeats an id/position.',
    remediation: 'Give every tranche a unique id, a valid class, a unique integer position, and a numeric amount.',
    spec_ref: '§4.24 CS-01',
  },
  {
    code: 'CS-02', severity: 'error',
    title: 'Tranche rate does not match its class',
    description: 'A debt or preferred tranche omits its rate, or a common-equity tranche states one.',
    remediation: 'State a rate on every debt and preferred_equity tranche; remove it from common_equity.',
    spec_ref: '§4.24 CS-02',
  },
  {
    code: 'CS-WATERFALL-UNSUPPORTED', severity: 'error',
    title: 'Distribution waterfall is out of scope',
    description: 'The capital_stack encodes a distribution waterfall (promote, hurdles, tiers, or catch-up), which this version does not model.',
    remediation: 'Model the waterfall in x_partnership_structure for now; a later phase adds it once a hold-period cash-flow primitive exists (RFC 0026 §E).',
    spec_ref: '§4.24 CS-WATERFALL-UNSUPPORTED',
  },
  {
    code: 'DQ-01', severity: 'warning',
    title: 'Provisional block without gap entry',
    description: 'A block is marked _meta.provisional=true but no entry in the `gaps` section references it.',
    remediation: 'Add a `gaps` item naming this section/path (or run editor with --maintain-gaps), or remove the provisional flag.',
    spec_ref: 'UW_FORMAT_SPEC_v1.md §3.4 / §4.22',
  },
  {
    code: 'DQ-02', severity: 'error',
    title: 'Provisional value consumed at incompatible stage',
    description: 'A provisional / placeholder value is being consumed at a stage whose policy requires real data.',
    remediation: 'Replace the provisional value with observed data, downgrade deal_stage, or update INCOMPLETE_DATA_POLICIES if appropriate.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.7-§V.8',
  },
  {
    code: 'DQ-03', severity: 'warning',
    title: 'Partial block without field-level enumeration',
    description: 'A block is marked _meta.partial=true but has no _meta.field_overrides[] enumeration.',
    remediation: 'List the affected paths in field_overrides with reason ("missing"|"illegible"|"estimated").',
    spec_ref: 'UW_FORMAT_SPEC_v1.md §3.4',
  },
  {
    code: 'DQ-04', severity: 'error',
    title: 'Scope-stage readiness gap',
    description: 'A field required for scope-stage readiness is missing.',
    remediation: 'Provide the missing scope-stage field (property.address, property.asset_class, and at least one of property.units or property.asking_price) or downgrade deal_stage.',
    spec_ref: 'UW_FORMAT_SPEC_v1.md §2.2',
  },
  {
    code: 'DQ-05', severity: 'info',
    title: 'Stale gap',
    description: 'A `gaps` item has not been re-checked recently and may be obsolete.',
    remediation: 'Re-check the gap and refresh `last_checked`, or close the gap if it has been resolved.',
    spec_ref: 'UW_FORMAT_SPEC_v1.md §4.22',
  },
  {
    code: 'DQ-06', severity: 'info',
    title: 'Declared-stage section gap',
    description: 'A section required by the declared deal_stage (format spec §5.1) is missing — the issues-stream mirror of stage_readiness (RFC 0028).',
    remediation: 'Add the named section, or restate deal_stage to the stage the file actually satisfies; stage_readiness lists what each stage needs.',
    spec_ref: 'UW_FORMAT_SPEC_v1.md §5.1',
  },

  // ─── Integrity (INT-NN) — content_hash / parent_hash chain checks ──────────
  {
    code: 'INT-01', severity: 'error',
    title: 'Parent hash mismatch',
    description: 'A block\'s _meta.parent_hash does not equal the prior block\'s _meta.content_hash in the supersede chain.',
    remediation: 'Recompute the block from the current head: stamp parent_hash with the prior block\'s content_hash and bump the version.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.10',
  },
  {
    code: 'INT-02', severity: 'error',
    title: 'Stale parent hash on edit',
    description: 'applyEdit was invoked with a parent_hash that does not match the current head of the section.',
    remediation: 'Re-read the file, take the latest head\'s content_hash, and retry the edit with the fresh parent_hash.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.10',
  },
  {
    code: 'INT-03', severity: 'warning',
    title: 'Partially hashed chain',
    description: 'Some blocks in a supersede chain carry _meta.content_hash and others do not.',
    remediation: 'Once any block in a chain is hashed, every subsequent block MUST be hashed; rehash the unstamped blocks.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.10',
  },
  {
    code: 'INT-04', severity: 'warning',
    title: 'Content hash does not recompute',
    description: 'A block\'s stamped _meta.content_hash does not match the SHA-256 of its current canonicalized content.',
    remediation: 'Either restore the original content or re-stamp content_hash from the current canonicalized form.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.9',
  },

  {
    code: 'INT-05', severity: 'error',
    title: 'Signature without content hash',
    description: 'A block carries _meta.signature but no _meta.content_hash, so the signature commits to no content.',
    remediation: 'Stamp content_hash first, then re-sign the block; a signature over an absent hash is structurally void.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.11',
  },
  {
    code: 'INT-06', severity: 'error',
    title: 'Unknown signing key',
    description: 'A block signature names a key id that the supplied key store does not hold.',
    remediation: 'Add the public key to the key store under that kid, or re-sign with a key the verifier trusts.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.11',
  },
  {
    code: 'INT-07', severity: 'error',
    title: 'Block signature does not verify',
    description: 'A block signature failed to validate against the canonicalized signing input, or declares an algorithm outside the admitted set.',
    remediation: 'Restore the signed content and provenance fields, or re-sign the block as it now stands.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.11',
  },
  {
    code: 'INT-08', severity: 'warning',
    title: 'Deprecated signature algorithm',
    description: 'A block signature uses an algorithm the verifying deployment has deprecated.',
    remediation: 'Re-sign the block with a current algorithm before the deprecated one is withdrawn.',
    spec_ref: 'UW_PROTOCOL_v1.md §V.11',
  },

  // ─── Module runtime (MOD-*) — findings a loaded module produced (RFC 0006) ──
  //
  // Registered for discoverability. Unlike the families above, these are
  // emitted by `validateAgainstModules`, which does NOT enrich from this
  // registry — a module's own finding names the module that made it, and
  // overwriting that with generic copy would lose the attribution.
  {
    code: 'MOD-SECTION-MISSING', severity: 'error',
    title: 'Required module section missing',
    description: 'A loaded module declares a section as required and the document does not carry it.',
    remediation: 'Add the section, or stop loading that module for this document.',
    spec_ref: 'UW_PROTOCOL_v1.md §X',
  },
  {
    code: 'MOD-CALC-ERROR', severity: 'error',
    title: 'Module calculation failed to evaluate',
    description: 'A calculation declared by a loaded module could not be evaluated.',
    remediation: 'Fix the formula in the module. Any rule reading that calc is silently inconclusive until it is corrected.',
    spec_ref: 'UW_PROTOCOL_v1.md §X',
  },
  {
    code: 'MOD-RULE-ERROR', severity: 'error',
    title: 'Module validation rule failed to evaluate',
    description: 'A validation rule declared by a loaded module could not be evaluated, so it neither passed nor failed.',
    remediation: 'Fix the rule expression in the module, or stop loading it until it is corrected.',
    spec_ref: 'UW_PROTOCOL_v1.md §X',
  },

  // ─── Provenance / policy (POL-NN) — actor and operation authority ──────────
  {
    code: 'POL-01', severity: 'error',
    title: 'Unauthorized actor',
    description: 'The block\'s _meta.actor is not authorized to write this section per its EditPolicy.',
    remediation: 'Re-issue the edit from an actor allowed by the section\'s policy (see BUILTIN_EDIT_POLICIES).',
    spec_ref: 'UW_PROTOCOL_v1.md §VIII',
  },
  {
    code: 'POL-02', severity: 'error',
    title: 'Replace where supersede is required',
    description: 'The section\'s policy requires supersede_on_edit but the head version > 1 has no superseded prior versions.',
    remediation: 'Re-issue the edit as section_supersede so the prior version is preserved as a superseded block.',
    spec_ref: 'UW_PROTOCOL_v1.md §VIII',
  },

  // ─── Financial validity (FV-NN) — renamed from FV_* in v1.1 ────────────────
  // Severity is the *highest* severity any emission of this code can carry
  // (e.g. FV-04 may be warning OR error depending on threshold).
  {
    code: 'FV-01', severity: 'warning',
    title: 'Cap rate below threshold',
    description: 'Going-in cap rate is below the configured warning threshold.',
    remediation: 'Verify NOI and purchase price; an unusually low cap rate often indicates an aggressive valuation.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-02', severity: 'warning',
    title: 'Cap rate above threshold',
    description: 'Going-in cap rate is above the configured warning threshold.',
    remediation: 'A high cap rate may indicate distressed pricing or market dislocation; confirm the underwriting story.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-03', severity: 'warning',
    title: 'Debt yield below threshold',
    description: 'Debt yield is below the configured warning threshold.',
    remediation: 'Re-check NOI and loan amount; consider a smaller loan or higher equity.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-04', severity: 'error',
    title: 'DSCR below threshold',
    description: 'DSCR is below the configured threshold (warning or error).',
    remediation: 'Re-size the loan, lower the rate assumption, or increase NOI to meet the lender constraint.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-05', severity: 'warning',
    title: 'Equity multiple below minimum',
    description: 'Levered equity multiple is below the configured minimum.',
    remediation: 'Re-examine hold period, exit assumptions, and capital structure.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-06', severity: 'warning',
    title: 'Equity multiple above maximum',
    description: 'Levered equity multiple is above the configured maximum (likely unrealistic).',
    remediation: 'Sanity-check exit cap, rent growth, and hold-period assumptions.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-07', severity: 'warning',
    title: 'IRR below threshold',
    description: 'Levered IRR is below the configured warning threshold.',
    remediation: 'Verify the projected exit value and cash-flow trajectory.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-08', severity: 'warning',
    title: 'IRR above threshold',
    description: 'Levered IRR is above the configured warning threshold (likely unrealistic).',
    remediation: 'An IRR over the upper threshold usually signals an aggressive exit cap or rent-growth assumption.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-09', severity: 'error',
    title: 'LTV above threshold',
    description: 'LTV is above the configured threshold (warning or error).',
    remediation: 'Reduce loan size or increase appraised value support.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-10', severity: 'warning',
    title: 'OpEx ratio below minimum',
    description: 'OpEx as a share of EGI is suspiciously low.',
    remediation: 'Verify that all operating line items are captured (taxes, insurance, management, R&M, payroll, utilities).',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-11', severity: 'warning',
    title: 'OpEx ratio above maximum',
    description: 'OpEx as a share of EGI is unusually high.',
    remediation: 'Investigate one-time items, deferred maintenance, or below-market rents.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-12', severity: 'warning',
    title: 'Annual rent growth above threshold',
    description: 'Annual rent growth assumption exceeds the configured threshold.',
    remediation: 'Tie rent growth to a published submarket forecast or document the rationale.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-13', severity: 'warning',
    title: 'Vacancy below minimum',
    description: 'Vacancy assumption is below the configured floor.',
    remediation: 'Use the higher of submarket stabilized vacancy or institutional minimum.',
    spec_ref: '§5.2',
  },
  {
    code: 'FV-14', severity: 'warning',
    title: 'Vacancy above maximum',
    description: 'Vacancy assumption is above the configured warning threshold.',
    remediation: 'A vacancy over the upper threshold usually indicates lease-up or distress; re-examine the value-creation story.',
    spec_ref: '§5.2',
  },
  {
    code: 'UNSUPPORTED_YAML_FEATURE', severity: 'error',
    title: 'Unsupported YAML feature in frontmatter',
    description: 'Frontmatter uses a YAML feature outside the .uw.md subset (anchors, tags, block scalars, complex keys, or directives).',
    remediation: 'Rewrite the frontmatter using only the YAML subset documented in UW_FORMAT_SPEC_v1.md Appendix A — scalars, simple mappings, and dash-prefixed sequences.',
    spec_ref: 'UW_FORMAT_SPEC_v1.md Appendix A',
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
