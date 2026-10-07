# 07 — Data model reference

Authoritative type source: [`packages/uwmd-core/src/types.ts`](../../packages/uwmd-core/src/types.ts)
and [`packages/uwmd-core/src/protocol.ts`](../../packages/uwmd-core/src/protocol.ts).
Section field schemas: `UW_FORMAT_SPEC_v1.md` §4. Real populated example:
[`examples/Parkview-Apts-Glendale-AZ.uwx.md`](../../examples/Parkview-Apts-Glendale-AZ.uwx.md).

This page gives the *working shapes* an agent needs to read/write deals.

## Enums (`types.ts`)

```ts
ConfidenceLevel = 'high' | 'medium' | 'low'
PipelineStatus  = 'complete' | 'in_progress' | 'pending' | 'skipped' | 'failed'
ValidationSeverity = 'error' | 'warning' | 'info'
DealStage = 'scope' | 'screening' | 'term_sheet' | 'full_underwrite'
          | 'credit_approval' | 'closing' | 'monitoring'
AssetClass = 'multifamily' | 'office' | 'retail' | 'industrial' | 'self_storage'
           | 'hospitality' | 'mixed_use' | 'senior_housing' | 'student_housing' | 'land'
```

`SourceTag` is the canonical-tag union *plus* `(string & {})` — long-form
patterns like `agent/L6-01`, `document/rent_roll`, `import:file.pdf` are valid.
The cascade-resolved short tags are: `user_override`, `user_input`,
`investor_profile`, `market_data`, `asset_class_default`, `global_default`,
`system_default` (see `CASCADE_ORDER` in `protocol.ts`).

## `ParsedUWFile` (parser output)

```ts
interface ParsedUWFile {
  frontmatter: UWFrontmatter;
  sections: ParsedSections;                 // id → UWBlock | { variant → UWBlock }
  prose: { [sectionId: string]: string };
  pipeline_log: UWBlock[];
  custom_calculations: UWBlock[];
  custom_scenarios: UWBlock[];
  extensions: { [extensionId: string]: UWBlock };
  superseded: { [sectionId: string]: UWBlock[] };   // version history
  raw: string;
}
```

## `UWBlock` (one data block)

```ts
interface UWBlock<T = Record<string, unknown>> {
  annotation: UWFenceAnnotation;   // parsed from the ```json uw:… fence
  meta: UWMeta;                    // provenance (see below)
  content: T;                      // the section's JSON fields
  prose: string;                   // markdown immediately before the block
  rawJson: string;
  lineStart: number; lineEnd: number;   // 1-indexed
}
```

## `UWMeta` (provenance — every block has one)

```ts
interface UWMeta {
  section: string; version: number; superseded: boolean;
  source: SourceTag; agent_id: string | null; agent_version: string | null;
  actor: string; timestamp: string;            // ISO-8601
  confidence: ConfidenceLevel; human_review_required: boolean;
  flags: string[]; input_hash: string | null; notes: string | null;
  // optional integrity/quality:
  partial?: boolean; provisional?: boolean;
  field_overrides?: UWFieldOverride[];         // {path, confidence?, source?, reason?, note?}
  content_hash?: string; parent_hash?: string | null;
}
```

## `UWFrontmatter`

```ts
interface UWFrontmatter {
  uw_version: string; deal_id: string; deal_name: string;
  created: string; last_modified: string;
  property_address: string; city: string; state: string; zip: string;
  asset_class: AssetClass; asset_subtype?: string | null;
  loan_type?: string | null; scenario?: string | null;
  pipeline_state?: UWPipelineState; status?: string;
  deal_stage?: DealStage; recommendation?: string | null;
  quick_metrics?: UWQuickMetrics;
  flags?: string[]; blocking_flags?: string[];
  tier?: 'screener' | 'analyst';
  institution_config_id?: string | null;
  created_by?: string; source_documents?: string[];
  [key: string]: unknown;            // forward-compatible
}
```

`UWPipelineState` keys: `L0_ingestion`, `L1_screening`, `L2_underwriting`,
`L4_structuring`, `L5_compliance`, `L6_risk`, `L7_assembly` (each `PipelineStatus`).

`UWQuickMetrics` (frontmatter snapshot — kept in sync with section data via CC-NN
checks): `purchase_price`, `loan_amount`, `noi_underwritten`, `dscr`, `ltv`,
`debt_yield`, `cap_rate`, `irr_projected`, `equity_required` (all `number|null`).

## Section field paths used by the multifamily pack

The calc formulas reference these paths — they are the *de facto* required shape
for a multifamily deal that wants live metrics (from `packs/multifamily.ts`):

Path | Used by
---|---
`noi_model.net_operating_income` | cap_rate, dscr, debt_yield, cash_on_cash
`valuation.purchase_price` | cap_rate, ltv, price_per_unit
`debt_structure.loan_amount` | ltv, debt_yield, loan_per_unit, loan_per_sqft
`debt_structure.annual_debt_service` | dscr, cash_on_cash
`property.total_units` | price_per_unit, loan_per_unit
`property.total_nra_sqft` | loan_per_sqft
`sources_uses.equity_metrics.equity_total` | cash_on_cash (aggregate invested equity)
`dcf.annual_cash_flows.Y1.net_cash_flow_levered` | cash_on_cash (preferred year-1 numerator)

> Note the calc-engine resolution rule: an identifier like `noi_model` resolves to
> the section's *inner* user data; `.net_operating_income` then drills in. See
> [04 — Calc engine › Variable resolution](04-calc-engine.md).

## Display view models (`BUILTIN_VIEW_MODELS` in `protocol.ts`)

For rendering, each section has a `SectionViewModel` with `primary_fields` and
`detail_fields` (`FieldViewHint`: `path`, `label`, `kind`
`currency|percent|ratio|count|date|string|enum|list`, `primary?`, `unit?`,
`decimals?`). This drives any presentation (cards, terminal, future PDF) without
hard-coding section knowledge. The view-model registry is a *rendering layer* and
is not 1:1 with the spec's section registry. A hint's `path` follows the
section's `§ 4.x` shape, not a worked example's. Where the spec states a line as
`{ value, ... }`, as `noi_model` does for its income and expense lines, the hint
reads `.value`; a hint on the object itself formats as `n/a`.

## Financial validity thresholds (`DEFAULT_THRESHOLDS` in `types.ts`)

The validator compares computed metrics against these (FV-NN codes). Institutions
override via `.uw.institution.json` (`InstitutionConfig.thresholds`).

Metric | Thresholds
---|---
`dscr` | error_below 1.0, warning_below 1.2
`ltv` | warning_above 0.75, error_above 0.85
`debt_yield` | warning_below 0.07
`cap_rate` | warning_below 0.03, warning_above 0.15
`vacancy_rate` | warning_below 0.02, warning_above 0.40
`opex_ratio` | warning_below 0.20, warning_above 0.70
`irr` | warning_below 0.05, warning_above 0.40
`equity_multiple` | warning_below 1.0, warning_above 5.0
`annual_rent_growth` | warning_above 0.08
`ltc` | warning_above 0.80, error_above 0.90

> All rates are **fractions, not percents** (e.g. `cap_rate: 0.0551` = 5.51%,
> `ltv: 0.70` = 70%). This is consistent everywhere: frontmatter, section data,
> defaults, thresholds. The `%` unit only affects *display* formatting.

## Asset-class defaults (`MULTIFAMILY_DEFAULTS` in `defaults.ts`)

A `{low, central, high}` range per field path, with a `unit`,
`source: 'asset_class_default'`, and a `citation`. Fields include
`noi_model.expense_ratio` (0.34/0.40/0.46), `rent_roll.vacancy_pct`
(0.04/0.06/0.10), `debt_structure.rate_pct` (0.06/0.067/0.075),
`debt_structure.ltv_pct` (0.55/0.65/0.75), `valuation.exit_cap_rate_pct`
(0.045/0.055/0.065), and more. These feed the cascade and the refinement (VOI)
engine. Bump the table `version` when a range shifts materially.

## Validation result shape (`ValidationResult`)

```ts
interface ValidationResult {
  overall_status: 'clean' | 'warnings' | 'errors' | 'blocking';
  stage_readiness: StageReadiness;            // per DealStage boolean
  issues: ValidationMessage[];
  errors: ValidationMessage[]; warnings: ValidationMessage[]; info: ValidationMessage[];
}
```

`ValidationMessage`: `{ code, severity, section?, field?, message, value?,
threshold?, title?, remediation?, spec_ref?, legacy_code? }` — `title`/
`remediation`/`spec_ref` are filled from `BUILTIN_REMEDIATIONS` when a matching
code exists.

## Exit proceeds (RFC 0077)

`dcf.exit_analysis` foots in one direction: gross sale, less disposition
costs (`exit_value_net`), less `loan_balance_at_exit` (every debt repaid at
sale, mezzanine included) gives `net_proceeds_to_equity`. That is the whole
equity stack, preferred and common. Two optional fields split it.
`preferred_equity_redemption_at_exit` is stated cash, never derived, because
accrued pref needs conventions the format does not define.
`net_proceeds_to_common_equity` is footed from it. Partner splits belong to
§4.27, not here. `deriveDCF` is the single footing every tool shares.

## Replacement funding (RFC 0070, Protocol 2.21.0)

§4.7 adds optional nullable `rate_hedge.replacement_funding`:
`{mode:"escrow"}` or
`{mode:"outright",cash_flow_ref:{variant,row_index,binding_digest}}`.
The union/reference are closed. Non-null funding requires the lifecycle
assumption `replace`; unhedged/loan_matures_first cannot carry it.

Absent/null funding preserves valid RFC 0056 escrow documents unchanged.
Explicit escrow still requires the named replacement escrow. Outright forbids
that escrow and binds an exact current explicit §4.26 variant and safe zero-based
row index. Date and amount remain solely in that row: amount <= 0, date strictly
after the initial effective_date, with no expiration constraint. A zero premium
needs an explicit zero row. This is a modeled future payment, never an executed
replacement trade. No pricing, derived cash flow or reserve roll-forward exists.

The JCS/SHA-256 preimage contains exactly currency_code (authored or null),
row_index, fixed cash_flow_series section, complete ordered series and variant.
Same-day rows retain their ordinals; no search, fallback or silent rebind occurs.
HDG-07/08/10 are structural; HDG-09 is an actual async mismatch only.

**Which loan carries the hedge (RFC 0075).** When `debt_structure` is a
variant map, every HDG rule, ESC-04 and the binding verifier read one block,
selected under §5.3 with a registered `senior` preference. That is the same
preference CC-02/03/05/09 use. A unique `senior` wins over `primary`,
`default` and `base`. Two seniors still refuse, and a hedge stated only on a
junior is not read.

**When the loan or cash lines cannot be selected (RFC 0076).** A stated
`rate_hedge` on a refused `debt_structure` (any current block counts when
none is selected), or a readable one beside a refused `sources_uses`, reports
one HDG-08. The rules that need the refused side are not evaluated, so
ESC-04 never misreports an escrow it cannot pair with a hedge. The verifier
says `unverifiable/unresolvable_source`. An absent section is not a refusal:
ESC-04 still applies.
