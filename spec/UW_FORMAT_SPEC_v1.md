# .uwx.md — UW Markdown Extended Format Specification
## Version 1.1 | April 2026

---

> A `.uwx.md` file is the canonical, lossless, human- and machine-readable representation of a CRE deal underwriting. It is simultaneously a document (readable by a lender), a data file (parseable by tools), a pipeline artifact (written to by agents in sequence), and a context bundle (dropped into an AI assistant for instant deal literacy). It replaces the Excel underwriting model as the source of truth, and replaces the Word credit memo as the human-readable output — by being both at once.

---

### Naming: "UW Markdown" the format, `.uwx.md` the file

The standard is called **UW Markdown**, and a deal record is colloquially "a UW
Markdown document" — the same way people say "a Word document" while the file on
disk is `.docx`. The precision matters when it matters:

| Term | Means |
|---|---|
| **UW Markdown** | The standard as a whole — this spec, the protocol, and the representations below. Use it in prose. |
| **UWX** / `.uwx.md` | **The complete underwriting record**, specified by this document: full section model, append-only provenance, calc inputs. Lossless. |
| **UW Lite** / `.uw.md` | A constrained, human-readable *summary*, specified separately in [`UW_LITE_SPEC_v1.md`](UW_LITE_SPEC_v1.md). Semantics come from `<!-- uw:path -->` anchors. Explicitly lossy. |

Where the Word analogy stops: `.doc` is a superseded predecessor, whereas **UW
Lite is neither older nor deprecated**. It is a current, deliberately lossy
*view* of a deal, with its own specification and its own job. UWX is what a deal
*is*; Lite is one way of showing it. The projection UWX → Lite MUST report every
path it omits ([RFC 0017](../docs/rfcs/0017-uw-lite-source-representation.md)).

Structured content carrying the legacy `.uw.md` extension predates this split.
It remains readable — detected by sniffing rather than by extension — but
**extension no longer implies structure**, and a byte-identical `.uwx.md`
sibling is the migration output. Do not write new structured files as `.uw.md`.

---

### Conformance language

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
"**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**", "**MAY**", and
"**OPTIONAL**" in this document are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119). For
implementation requirements (what tools must *do* with these bytes), see
the companion [`UW_PROTOCOL_v1.md`](UW_PROTOCOL_v1.md).

### Section count

Part IV registers **25 numbered subsections (§ 4.0 – § 4.24)**:
21 standard data sections (§ 4.0 – § 4.20), the extension-section
meta-spec (§ 4.21) that defines the `x_` namespace for non-standard
content, the `gaps` inventory (§ 4.22), the mixed-use `components`
section (§ 4.23), and the `capital_stack` section (§ 4.24). When this and
the protocol document refer to "the 21 standard sections" they mean
§ 4.0 through § 4.20.

---

## Part I — Design Philosophy

### 1.1 The Core Problem This Solves

An Excel underwriting model is a calculation engine with no portability. You cannot drop it into a terminal. An AI tool cannot read it without preprocessing. It has no provenance — you cannot tell who changed a cell, when, or why. It cannot be validated programmatically. It cannot render itself into a lender package.

A `.uwx.md` file solves this by being structured enough for machines while staying readable enough for humans. The format is the deal. Everything that lives in Excel, Word, and a banker's email thread lives in one file.

### 1.2 Design Principles

**Lossless.** Every number, assumption, flag, narrative, and audit trail that would exist in an institutional underwriting model has a defined home. Nothing is omitted to keep the file small.

**Dual representation.** Every section carries both prose (human-readable narrative, tables) and a structured JSON data block (machine-parseable). Either layer can stand alone; together they are the complete record.

**Append-only by default.** Tools and agents add to the file — they do not rewrite existing sections. History is preserved inline. A compact operation removes superseded blocks when the file is ready to archive.

**Provenance on every block.** Every data block carries a `_meta` object that records who wrote it, when, with what confidence, and whether it requires human review. No fact in the file is anonymous.

**Source-tagged assumptions.** Every assumption carries a `source` tag: `scenario_default | market_data | ai_extracted | user_override | investor_profile | agent_computed`. Users and reviewers always know whether a number came from AI, from market data, or from their own input.

**Pipeline-stateful.** The frontmatter tracks which pipeline stages have run. A tool reading a `.uwx.md` knows immediately what work has been done, what is pending, and what is blocked.

**Toolchain-agnostic.** The format is plain Markdown + fenced JSON. It can be read by any text editor, any Markdown renderer, any JSON parser. No proprietary tooling is required to read it. Proprietary tooling (Bancroft agents, uwmd CLI) is required to *generate* sections correctly, but not to read them.

### 1.3 Relationship to the Bancroft Agent Suite

Each Bancroft layer corresponds to one or more `.uwx.md` sections it is responsible for:

| Bancroft Layer | Writes Sections |
|---|---|
| L0 — Document Ingestion | `rent_roll`, `operating_statement`, `lease_schedule` |
| L1 — Screening | `screening`, `preliminary_sizing` |
| L2 — Underwriting | `noi_model`, `valuation`, `market_analysis`, `borrower_sponsor` |
| L4 — Structuring | `debt_structure`, `sources_uses`, `covenants` |
| L5 — Compliance | `compliance` |
| L6 — Risk Rating | `risk_assessment` |
| L7 — Assembly | Reads all sections, renders output artifacts |
| L9 — Portfolio | Appends to `operating_statement`, updates `risk_assessment` |

The wizard populates: `deal_context`, `property`, `rent_roll` (draft), `debt_structure` (terms), `borrower_sponsor` (form inputs), `dcf` (hold period inputs).

The deterministic engine (`calculations.ts`, `dcfEngine.ts`) writes: `noi_model`, `dcf`, `stress_tests`, `validation`, `custom_calculations` (result fields only — definitions are user-authored).

Users and AI assistants write: `deal_context` (narrative), `custom_calculations` (definitions), `custom_scenarios`, `x_*` extension sections.

---

## Part II — File Grammar

### 2.1 File Structure

A `.uwx.md` file is a UTF-8 encoded plain text file with the extension `.uwx.md`. Its structure, top to bottom:

```
[1] YAML Frontmatter          ← delimited by --- / ---
[2] Deal Header               ← H1, human-readable property title
[3] Deal Summary Table        ← generated after L7; quick-read metrics
[4] Sections                  ← ordered by section registry (§ 4.x)
    [4a] Section Header       ← H2 with section name and anchor
    [4b] Prose Block          ← human-readable narrative and/or tables
    [4c] Data Block(s)        ← fenced JSON with uw: annotation
    [4d] Divider              ← --- between sections
[5] Pipeline Log              ← always last; append-only execution history
```

Sections MUST appear in the canonical order defined in Part IV. Parsers MUST tolerate out-of-order sections by scanning for `uw:section=` annotations rather than relying on position.

### 2.2 Frontmatter Schema

The frontmatter is YAML. All fields shown; `*` = required.

```yaml
---
# ── Identity ──────────────────────────────────────────────
uw_version: "1.0"                   # * format version
deal_id: "uw_YYYY_[hash8]"          # * globally unique deal identifier
deal_name: "string"                 # human label, e.g. "Parkview Apts — Phoenix"
created: "ISO8601"                  # * timestamp of file creation
last_modified: "ISO8601"            # * updated on every write

# ── Property Identity ─────────────────────────────────────
property_address: "string"          # * full street address
city: "string"
state: "XX"                         # 2-char state code
zip: "string"
asset_class: "multifamily | office | retail | industrial | self_storage | hospitality | mixed_use | senior_housing | student_housing | land"
asset_subtype: "string | null"      # e.g. "garden_style", "strip_center", "warehouse"
loan_type: "permanent | bridge | construction | value_add | refinance"
scenario: "stabilized_acquisition | ground_up_development | value_add | lease_up | nnn_single_tenant | lihtc_section8 | house_flip | commercial_flip | property_conversion | build_to_rent | distressed_reo | land_banking"

# ── Pipeline State ────────────────────────────────────────
# Layer keys correspond 1:1 to BANCROFT_LAYERS in the reference library.
# L3 is intentionally reserved for a future pre-structuring layer and is
# omitted from v1; conforming files MUST NOT define L3_* keys. A layer key
# absent from pipeline_state is treated as "pending" by default. Use
# "skipped" only when a layer is explicitly bypassed for this deal
# (e.g. a refinance with no L0 ingestion).
pipeline_state:
  L0_ingestion:    "complete | in_progress | pending | skipped | failed"
  L1_screening:    "complete | in_progress | pending | skipped | failed"
  L2_underwriting: "complete | in_progress | pending | skipped | failed"
  L4_structuring:  "complete | in_progress | pending | skipped | failed"
  L5_compliance:   "complete | in_progress | pending | skipped | failed"
  L6_risk:         "complete | in_progress | pending | skipped | failed"
  L7_assembly:     "complete | in_progress | pending | skipped | failed"

# ── Overall Status ────────────────────────────────────────
status: "draft | in_progress | complete | flagged | archived"
deal_stage: "scope | screening | term_sheet | full_underwrite | credit_approval | closing | monitoring"
recommendation: "pending | approve | approve_with_conditions | decline | null"

# ── Key Metrics (denormalized for quick parsing) ──────────
# These mirror the financial_model section; kept here for fast lookup
# without parsing the full document. Updated by the engine after each run.
quick_metrics:
  purchase_price: null
  loan_amount: null
  noi_underwritten: null
  dscr: null
  ltv: null
  debt_yield: null
  cap_rate: null
  irr_projected: null
  equity_required: null

# ── Active Flags (denormalized) ───────────────────────────
# Mirror of validation section flags; kept here for pipeline routing
flags: []
blocking_flags: []

# ── Rendering ────────────────────────────────────────────
tier: "screener | analyst"           # determines which sections render to output PDF
institution_config_id: "string | null"  # Bancroft institution profile used

# ── Provenance ───────────────────────────────────────────
created_by: "wizard | import | manual | agent"
source_documents: []                 # list of filenames ingested via L0
---
```

**Pipeline stages.** The `deal_stage` enum advances monotonically as
the deal progresses. The `scope` stage indicates a back-of-napkin
readiness level: a `scope`-stage file MAY consist almost entirely of
provisional blocks (see Part III §3.4 `_meta.provisional`) and
represents triage rather than commitment. The minimum content for
`scope` is a `property` section with at least an address, an asset
class, and one of `units` or `asking_price`; everything else MAY be
filled in from the fallback cascade (see Protocol §IX). Advancing
past `scope` requires real documents, not better assumptions —
producers MUST re-stamp defaulted blocks with observed data before
setting `deal_stage: screening` or later.

### 2.3 Section Headers

Each section uses an H2 header with a machine-readable anchor:

```markdown
## Property {#property}
```

The anchor (e.g., `{#property}`) is the section ID used for internal linking and cross-referencing. It matches the `uw:section=` annotation on data blocks within that section. Parsers use the annotation, not the header text.

### 2.4 Data Block Annotation Syntax

Every data block is a fenced JSON code block. The opening fence carries a structured annotation:

```
```json uw:section=<section_id> [key=value ...]
```

**Required annotation keys:**

| Key | Values | Description |
|---|---|---|
| `uw:section` | section ID from registry | Identifies which section this block belongs to |

**Optional annotation keys (parsed from fence tag for fast access; also present in `_meta`):**

| Key | Values | Description |
|---|---|---|
| `source` | `wizard`, `agent:L0-01`, `engine`, `user`, etc. | Who wrote this block |
| `ts` | ISO8601 | Timestamp of this block |
| `v` | integer | Version number within this section (starts at 1) |
| `superseded` | `true` | Marks a block that has been replaced by a newer version |
| `variant` | string | For sections with multiple instances (e.g., `t12`, `t3`, `budget`) |
| `confidence` | `high`, `medium`, `low` | Quick confidence signal |

**Full example fence tag:**

```
```json uw:section=rent_roll source=agent:L0-01 ts=2026-04-24T10:12:00Z v=1 confidence=high
```

### 2.5 The `_meta` Object

Every data block MUST contain a `_meta` object as its first key. This is the canonical provenance record.

```json
"_meta": {
  "section": "rent_roll",
  "version": 1,
  "superseded": false,
  "source": "agent:L0-01",
  "agent_id": "L0-01",
  "agent_version": "1.0.0",
  "actor": "system",
  "timestamp": "2026-04-24T10:12:00Z",
  "confidence": "high",
  "human_review_required": false,
  "flags": [],
  "input_hash": "sha256:abc123...",
  "notes": null
}
```

| Field | Type | Description |
|---|---|---|
| `section` | string | Section ID |
| `version` | integer | Monotonically increasing per section per file |
| `superseded` | boolean | True if a newer version exists in this file |
| `source` | string | Structured source identifier (see 2.6) |
| `agent_id` | string | Bancroft agent code, or `"wizard"`, `"engine"`, `"user"` |
| `agent_version` | semver | Version of the agent/tool that produced this block |
| `actor` | string | `"system"` or user identifier |
| `timestamp` | ISO8601 | When this block was written |
| `confidence` | enum | `"high"` / `"medium"` / `"low"` |
| `human_review_required` | boolean | Whether a human should review before advancing pipeline |
| `flags` | string[] | Flags raised by this specific block |
| `input_hash` | string | Hash of the inputs that produced this block (for reproducibility) |
| `notes` | string | Free-text notes from the agent or user |

Blocks MAY also carry the optional fields `partial`, `provisional`,
`field_overrides`, `content_hash`, and `parent_hash`. See Part III
§3.4 for their semantics. These fields are additive: a block omitting
them is well-formed, and validators MUST NOT reject blocks for their
absence.

### 2.6 Source Identifiers

| Pattern | Meaning |
|---|---|
| `wizard` | Entered via the underwriting wizard UI |
| `wizard:step_N` | Specific wizard step (1–5) |
| `agent:L0-01` | Specific Bancroft agent |
| `engine:calculations.ts` | Deterministic calculation engine |
| `engine:dcfEngine.ts` | DCF engine |
| `engine:financialValidityChecker` | Validation engine |
| `user` | Manual user edit |
| `user:override` | User explicitly overrode a calculated or AI value |
| `import:filename.pdf` | Parsed from a specific uploaded document |
| `market:costar` | Market data from CoStar |
| `market:websearch` | Market data from live web search |
| `profile:investor` | Sourced from the investor's saved profile / buy box |
| `scenario:defaults` | Scenario default assumptions |

The following short-form source tags are normative for cascade
resolution (see Protocol §IX). Producers stamping a value resolved by
the fallback cascade MUST use the tag corresponding to the cascade
step that produced the value.

| Tag | Meaning |
|---|---|
| `user_input` | The user typed the value (initial entry). |
| `user_override` | The user explicitly overrode a prior value. |
| `manual` | A human-authored block, source not otherwise classified. |
| `investor_profile` | Resolved from the active investor profile / buy box. |
| `market_data` | Resolved from a market-data lookup at write time. |
| `ai_extracted` | Extracted from a source document by an AI agent. |
| `agent_computed` | Computed by an agent from prior agent outputs. |
| `asset_class_default` | Pulled from the published asset-class default table for the deal's asset class. |
| `scenario_default` | A value derived from a named scenario in this file or institution config. |
| `global_default` | Pulled from a non-asset-class fallback table. |
| `system_default` | Hardcoded constant in the reference library or institution config. Producers SHOULD avoid relying on this layer for normative values. |

### 2.7 Update Semantics

When an agent or tool updates a section, it:

1. Locates the most recent non-superseded block for that `uw:section`
2. Sets `"superseded": true` in that block's `_meta` and in the fence tag
3. Appends a new block with `version = previous_version + 1`

This means the file grows; history is always recoverable. The canonical current value of any section is the **last block** where `_meta.superseded === false` for that `uw:section`.

The `uwmd compact` command strips superseded blocks and leaves only current versions.

### 2.8 Multi-Variant Sections

Some sections have multiple valid instances at the same time (not superseded, just parallel):

- `operating_statement` — may have `t12`, `t3`, `budget`, `ytd` variants
- `stress_tests` — may have named scenarios
- `due_diligence` — sub-documents (appraisal, environmental, title) are separate sub-sections

For multi-variant sections, the fence tag carries a `variant=` key:

```
```json uw:section=operating_statement variant=t12 source=agent:L0-02 ts=... v=1
```

Parsers collect all non-superseded variants for multi-variant sections and expose them as an array.

---

## Part III — Provenance Model

### 3.1 Assumption Source Hierarchy

When multiple sources provide a value for the same assumption, the hierarchy determines which value wins:

```
user:override          ← highest authority (explicit human decision)
    ↑
user (wizard input)
    ↑
agent:computed         ← agent ran calculation from prior agent outputs
    ↑
market data            ← live market data (CoStar, web search)
    ↑
ai_extracted           ← AI read a value from a source document
    ↑
investor_profile       ← user's saved buy box / investor preferences
    ↑
scenario:defaults      ← lowest authority (fallback when nothing else available)
```

The `assumptions` section (§ 4.16) records every assumption with its source. The UI displays source badges. The engine always uses the highest-authority available value.

### 3.2 Confidence Levels

| Level | Meaning |
|---|---|
| `high` | Deterministic calculation or direct extraction from a clearly structured source document. Should be trusted. |
| `medium` | AI-extracted from an ambiguous source, or derived from a benchmark range midpoint. Verify key decisions against this. |
| `low` | Estimated, inferred, or default value with no source document. Flag for human review before advancing. |

A section with any `low` confidence field sets `human_review_required: true` in `_meta`.

### 3.3 Human Review Gates

The pipeline respects two types of human review requirements:

**Soft gate** (`human_review_required: true` on a block): The pipeline continues but flags the deal for human attention before the next stage.

**Hard gate** (a `blocking_flags` entry in frontmatter): The pipeline halts. No further agents run until the flag is cleared by a human. Examples: OFAC match, appraised value > UW value by >10%, Phase II environmental required.

### 3.4 Optional Integrity / Quality Fields

Beyond the required and recommended `_meta` fields described above
(§2.5), blocks MAY carry the following optional fields. A block
lacking any of these fields is well-formed; validators MUST NOT
reject blocks for omitting them.

| Field | Type | Meaning |
|---|---|---|
| `partial` | boolean | The block is present but at least one field inside it is missing or unknown. When `partial: true`, an enumeration of which paths and why SHOULD be provided in `field_overrides`. |
| `provisional` | boolean | The entire block is a placeholder, derived from defaults rather than observed data. Stronger signal than `confidence: 'low'`. Downstream consumers SHOULD label outputs derived from provisional blocks accordingly. |
| `field_overrides` | array | Per-field overrides where the block-level `confidence`, `source`, or annotations do not apply uniformly. Each entry has a dot-notated `path` relative to the block's content root and may carry its own `confidence`, `source`, `reason` (`illegible | missing | overridden | estimated | computed`), and `note`. |
| `content_hash` | string | The SHA-256 hash of the block's canonicalized JSON content. The canonicalization rule (RFC 8785 JCS, with `_meta.content_hash` and `_meta.signature` removed before hashing) is defined in Protocol §IX.2. Producers MAY emit; consumers MAY ignore. |
| `parent_hash` | string \| null | The `content_hash` of the block this one supersedes. `null` on a chain root. Required only when participating in an integrity-checked supersede chain — once any block in a supersede chain carries `content_hash`, every later block in that chain MUST carry both `content_hash` and `parent_hash`. |

**Precedence with `field_overrides`.** A `field_overrides` entry
whose `path` matches a field replaces, for that field only, the
block-level `confidence` and `source`. The block-level values still
apply to every field not enumerated. This produces two surfaces for
expressing confidence; the consolidation lives in the v2 `_meta`
reorganization (RFC 0009).

**Path syntax.** `field_overrides[].path` uses dot-notation with
bracketed array indices (e.g. `units[7].current_rent`). Paths whose
key segments contain a literal `.` are not expressible; no current
section schema uses dotted keys.

**Integrity opt-in.** A file containing zero `content_hash` fields is
indistinguishable from a pre-integrity file; chain verification is a
no-op. To benefit from chain verification, a producer SHOULD stamp
`content_hash` on every block it writes once it adopts the integrity
path.

### 3.5 `confidence` vs `human_review_required`

`confidence` and `human_review_required` are orthogonal:

- `confidence` is a quality estimate of the data ("how much do we
  trust the value?").
- `human_review_required` is a workflow gate ("must a human review
  this before the file can advance to the next stage?").

High-confidence data MAY require review (e.g. for compliance audit).
Low-confidence data MAY NOT require review (e.g. a placeholder filled
in while drafting that the producer plans to overwrite). Validators
MUST NOT infer one from the other; the existing
`META_LOW_CONFIDENCE_NO_REVIEW_FLAG` issue is informational only.

---

## Part IV — Section Registry

Each section entry specifies: ID, canonical header, purpose, who writes it, required fields, dependencies, and complete JSON schema.

**Universal field — `_notes`:** Every data block in every section (standard and custom) accepts a top-level `_notes` string field immediately after `_meta`. This field is always optional, never validated, and never consumed by agents or the engine. It is a free-text annotation written by users or agents to explain context, flag concerns, or leave instructions for the next reader — human or AI. Example: `"_notes": "Tax assessment will reset at sale — current figure understates by ~$40k. Run revised NOI before credit committee."` Renders display `_notes` as a footnote on the relevant section.

**Reference path notation:** To reference a live value from another section within custom calculations or custom scenarios, use dot-path notation: `{section_id}.{field_path}`. Array indices are supported: `dcf.annual_cash_flows[0].net_cash_flow_levered`. If the referenced value does not exist, the result is `null` and status is `awaiting_inputs`.

---

### § 4.0 — Deal Context

**ID:** `deal_context`  
**Header:** `## Deal Context {#deal_context}`  
**Purpose:** The narrative layer. Describes the deal in plain language — what it is, why it's being considered, what the goal is, and any special circumstances that a structured underwriting model cannot capture. This section is the first thing an AI assistant reads to orient itself. It is the only section the user is always expected to write in their own voice.  
**Written by:** `wizard` (structured form fields), `user` (free narrative prose), `agent:L7-01` (AI-synthesized summary — appended as a second block, never replaces user narrative)  
**Required for pipeline stage:** All stages (prose block optional; structured block required for screening+)  
**Dependencies:** None

The Deal Context section has two distinct layers:

1. **User-authored narrative** — written in the prose block, before the data block. No format requirements. Can be one sentence or several paragraphs. This is where the user explains the story of the deal: the relationship context, the market timing, the specific constraint they're working within, the reason they're looking at this asset class, the gut feeling that brought this deal to the table. No schema can capture this — it lives here.

2. **Structured data block** — the machine-readable distillation of that context into typed fields. Tools route on these fields, AI assistants read them to calibrate their analysis, and the render engine uses them to frame the output package.

The `ai_synthesis` sub-object is populated by `agent:L7-01` after the full underwriting runs. It summarizes what the data actually shows in one paragraph, identifies strengths and risks from the model's perspective, and gives an overall impression. It is appended as a separate versioned block — the user's narrative is never touched.

```json uw:section=deal_context source=user ts=ISO8601 v=1 confidence=high
{
  "_meta": { "...": "see §2.5" },
  "_notes": null,

  "deal_summary": "string | null",

  "investment_thesis": "string | null",

  "acquisition_rationale": "string | null",

  "value_creation_strategy": "string | null",

  "hold_strategy": "exit_at_stabilization | long_term_hold | develop_and_sell | refinance_and_hold | 1031_exchange | portfolio_addition | flip | other | null",

  "exit_strategy_description": "string | null",

  "deal_goal": "string | null",

  "special_circumstances": "string | null",

  "known_risks_user_identified": [],

  "known_opportunities_user_identified": [],

  "deal_history": "string | null",

  "time_constraints": {
    "loi_deadline": null,
    "due_diligence_period_days": null,
    "close_deadline": null,
    "hard_deadline": false,
    "notes": null
  },

  "competitive_situation": "string | null",

  "lender_preferences": {
    "preferred_lender_type": "bank | credit_union | cmbs | agency | life_co | debt_fund | private | sba | no_preference | null",
    "preferred_loan_type": "string | null",
    "rate_ceiling_pct": null,
    "min_io_period_months": null,
    "max_recourse": "full | partial | non_recourse | null",
    "notes": null
  },

  "investor_context": {
    "portfolio_role": "core | core_plus | value_add | opportunistic | null",
    "target_market_fit": "string | null",
    "buy_box_fit": "strong | moderate | marginal | exception | null",
    "buy_box_exception_reason": "string | null",
    "tax_considerations": "string | null",
    "depreciation_strategy": "string | null"
  },

  "deal_tags": [],

  "ai_synthesis": {
    "generated": false,
    "summary": null,
    "key_risks_identified": [],
    "key_strengths_identified": [],
    "overall_impression": "strong | adequate | marginal | weak | null",
    "generated_by": null,
    "generated_at": null
  }
}
```

---

### § 4.1 — Property

**ID:** `property`  
**Header:** `## Property {#property}`  
**Purpose:** Physical asset description, identity, and condition.  
**Written by:** `wizard:step_1`, `wizard:step_2`, `agent:L1-01` (normalizes)  
**Required for pipeline stage:** All stages  
**Dependencies:** None

```json
{
  "_meta": { "...": "see §2.5" },
  "address": {
    "street": "string",
    "city": "string",
    "state": "XX",
    "zip": "string",
    "county": "string | null",
    "apn": "string | null",
    "legal_description": "string | null",
    "coordinates": { "lat": 0.0, "lng": 0.0 }
  },
  "asset_class": "multifamily | office | retail | industrial | self_storage | hospitality | mixed_use | senior_housing | student_housing | land",
  "asset_subtype": "string | null",
  "year_built": 0,
  "year_renovated": null,
  "total_units": null,
  "total_nra_sqft": null,
  "land_area_sqft": null,
  "land_area_acres": null,
  "stories": null,
  "building_class": "A | B | C | D | null",
  "construction_type": "wood_frame | masonry | steel | concrete | mixed | null",
  "parking_spaces": null,
  "parking_ratio": null,
  "parking_type": "surface | structured | garage | covered | null",
  "amenities": [],
  "condition": "excellent | good | average_good | average | fair | poor | null",
  "deferred_maintenance_est": null,
  "recent_capex_description": null,
  "recent_capex_amount": null,
  "zoning": null,
  "flood_zone": null,
  "opportunity_zone": null,
  "hud_qualified_census_tract": null,
  "environmental_concerns_noted": false
}
```

---

### § 4.2 — Ownership & Acquisition

**ID:** `ownership`  
**Header:** `## Ownership & Acquisition {#ownership}`  
**Purpose:** Current ownership, acquisition terms, entity structure, existing debt.  
**Written by:** `wizard`, `agent:L2-CRE-11`  
**Required for pipeline stage:** Underwriting and beyond  
**Dependencies:** None

```json
{
  "_meta": { "...": "see §2.5" },
  "transaction_type": "acquisition | refinance | cash_out_refi | recapitalization",
  "current_owner": "string | null",
  "acquisition_date": "YYYY-MM-DD | null",
  "acquisition_price": null,
  "current_estimated_value": null,
  "existing_debt": {
    "outstanding_balance": null,
    "rate": null,
    "maturity": "YYYY-MM-DD | null",
    "lender": null,
    "prepayment_penalty_est": null
  },
  "borrowing_entity": {
    "name": "string",
    "type": "llc | lp | gp | corp | individual | trust | tic | dst | other",
    "state_of_formation": null,
    "year_formed": null,
    "ein": null
  },
  "ownership_structure_notes": null,
  "key_man_identified": false,
  "foreign_ownership_pct": null,
  "anonymous_ownership_flags": false
}
```

---

### § 4.3 — Rent Roll

**ID:** `rent_roll`  
**Header:** `## Rent Roll {#rent_roll}`  
**Purpose:** Full unit-level or tenant-level schedule of leases, rents, occupancy, and concessions.  
**Written by:** `agent:L0-01`, `wizard:step_3` (simplified version)  
**Variants:** `multifamily` (default), `commercial`  
**Required for pipeline stage:** Screening and beyond  
**Dependencies:** `property`

#### Multifamily Variant

```json
{
  "_meta": { "...": "see §2.5" },
  "rent_roll_type": "multifamily",
  "as_of_date": "YYYY-MM-DD",
  "total_units": 0,
  "occupied_units": 0,
  "vacant_units": 0,
  "notice_units": 0,
  "model_units": 0,
  "down_units": 0,
  "physical_occupancy_pct": 0.0,
  "economic_occupancy_pct": null,
  "gross_potential_rent_monthly": 0.0,
  "gross_potential_rent_annual": 0.0,
  "in_place_rent_monthly": 0.0,
  "in_place_rent_annual": 0.0,
  "loss_to_lease_monthly": 0.0,
  "loss_to_lease_pct": 0.0,
  "concessions_monthly": 0.0,
  "concessions_annual": 0.0,
  "net_effective_rent_monthly": 0.0,
  "month_to_month_units": 0,
  "month_to_month_pct": 0.0,
  "units": [
    {
      "unit_id": "string",
      "unit_type": "string",
      "sqft": null,
      "floor": null,
      "building": null,
      "tenant_name": null,
      "lease_start": null,
      "lease_end": null,
      "lease_term_months": null,
      "monthly_rent": null,
      "market_rent": null,
      "loss_to_lease": null,
      "rent_per_sqft": null,
      "concession": null,
      "concession_monthly_equiv": null,
      "net_effective_rent": null,
      "status": "occupied | vacant | notice | model | down | admin",
      "move_in_date": null,
      "is_month_to_month": false,
      "subsidy_type": "market | section_8 | lihtc | other | null",
      "hap_contract": null,
      "notes": null
    }
  ],
  "unit_mix_summary": [
    {
      "unit_type": "string",
      "count": 0,
      "avg_sqft": null,
      "avg_rent_inplace": 0.0,
      "avg_rent_market": null,
      "loss_to_lease_avg": null,
      "occupancy_pct": 0.0,
      "pct_of_total": 0.0
    }
  ],
  "lease_expiration_schedule": [
    {
      "month": "YYYY-MM",
      "expiring_count": 0,
      "expiring_rent_monthly": 0.0,
      "pct_of_total_income": 0.0
    }
  ]
}
```

#### Commercial Variant

```json
{
  "_meta": { "...": "see §2.5" },
  "rent_roll_type": "commercial",
  "as_of_date": "YYYY-MM-DD",
  "total_nra_sqft": 0,
  "leased_sqft": 0,
  "vacant_sqft": 0,
  "physical_occupancy_pct": 0.0,
  "weighted_avg_lease_term_years": null,
  "in_place_rent_annual": 0.0,
  "in_place_rent_per_sqft": 0.0,
  "market_rent_per_sqft": null,
  "tenants": [
    {
      "tenant_id": "string",
      "tenant_name": "string",
      "suite": null,
      "floor": null,
      "nra_sqft": 0,
      "pct_of_nra": 0.0,
      "lease_type": "nnn | gross | modified_gross | absolute_nnn | null",
      "lease_commencement": null,
      "lease_expiration": null,
      "lease_term_years": null,
      "remaining_term_years": null,
      "base_rent_annual": 0.0,
      "base_rent_per_sqft": 0.0,
      "escalation_type": "fixed_pct | cpi | fixed_dollar | none | null",
      "escalation_rate_pct": null,
      "escalation_schedule": null,
      "renewal_options": [
        {
          "count": 0,
          "term_years": 0,
          "notice_months": null,
          "rent_reset": "fair_market | fixed | cpi | null"
        }
      ],
      "termination_option": null,
      "co_tenancy_clause": false,
      "co_tenancy_details": null,
      "ti_allowance_original": null,
      "ti_outstanding_balance": null,
      "rofo": false,
      "rofr": false,
      "assignment_subletting": null,
      "personal_guarantee": false,
      "guarantee_amount": null,
      "guarantee_type": "personal | corporate | both | null",
      "anchor_tenant": false,
      "cam_cap_pct": null,
      "tenant_credit": "investment_grade | non_investment_grade | private | individual | null",
      "status": "occupied | vacant | holdover | dark | pending | null",
      "notes": null
    }
  ],
  "tenant_concentration": [
    {
      "tenant_name": "string",
      "pct_of_nra": 0.0,
      "pct_of_income": 0.0
    }
  ],
  "lease_expiration_schedule": [
    {
      "year": 0,
      "expiring_sf": 0,
      "expiring_pct_of_nra": 0.0,
      "expiring_rent_annual": 0.0
    }
  ]
}
```

---

### § 4.4 — Operating Statement

**ID:** `operating_statement`  
**Header:** `## Operating Statement {#operating_statement}`  
**Purpose:** Historical income and expense data from the property's financial records.  
**Written by:** `agent:L0-02`  
**Variants:** `t12` (required), `t3` (preferred), `ytd`, `budget`, `t24`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `property`

```json
{
  "_meta": { "...": "see §2.5" },
  "period_type": "T12 | T3 | YTD | Budget | T24",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "annualized": true,
  "statement_prepared_by": "owner | management_company | cpa | lender | null",
  "cpa_certified": false,
  "income": {
    "gross_potential_rent": 0.0,
    "less_vacancy_credit_loss": 0.0,
    "vacancy_pct": 0.0,
    "less_concessions": 0.0,
    "less_loss_to_lease": 0.0,
    "other_income": {
      "laundry": null,
      "parking": null,
      "pet_fees": null,
      "late_fees": null,
      "storage": null,
      "utility_reimbursements": null,
      "cable_internet": null,
      "vending": null,
      "lease_termination_fees": null,
      "insurance_proceeds": null,
      "other": null,
      "total": 0.0
    },
    "effective_gross_income": 0.0
  },
  "expenses": {
    "real_estate_taxes": null,
    "insurance": null,
    "management_fees": null,
    "management_fee_pct_egi": null,
    "payroll_benefits": null,
    "utilities": {
      "electric": null,
      "gas": null,
      "water_sewer": null,
      "trash": null,
      "total": null
    },
    "repairs_maintenance": null,
    "contract_services": null,
    "marketing_advertising": null,
    "administrative": null,
    "professional_fees": null,
    "capital_expenditures_actual": null,
    "replacement_reserves": null,
    "other_expenses": null,
    "total_operating_expenses": 0.0
  },
  "net_operating_income": 0.0,
  "expense_ratio": 0.0,
  "noi_margin": 0.0,
  "noi_per_unit": null,
  "noi_per_sqft": null,
  "anomalies": [],
  "non_recurring_items": []
}
```

---

### § 4.5 — NOI Model (Underwritten)

**ID:** `noi_model`  
**Header:** `## Underwritten NOI {#noi_model}`  
**Purpose:** Analyst-adjusted income and expense model representing the underwritten stabilized cash flow. All calculations here are deterministic engine outputs, not AI outputs.  
**Written by:** `engine:calculations.ts` (values), `agent:L2-CRE-01` + `agent:L2-CRE-02` (adjustments/rationale)  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `rent_roll`, `operating_statement`, `market_analysis`

```json
{
  "_meta": { "...": "see §2.5" },
  "underwriting_basis": "stabilized | value_add | lease_up | as_is | stressed",
  "income": {
    "gross_potential_rent": {
      "value": 0.0,
      "source": "rent_roll | market | blended",
      "per_unit_monthly": null,
      "per_sqft_annually": null,
      "rationale": null
    },
    "vacancy_credit_loss": {
      "value": 0.0,
      "rate_applied": 0.0,
      "source": "underwritten | market | borrower_stated",
      "vs_t12_actual": null,
      "vs_submarket_avg": null,
      "rationale": null
    },
    "concessions": {
      "value": 0.0,
      "rationale": null
    },
    "loss_to_lease": {
      "value": 0.0,
      "rationale": null
    },
    "other_income": {
      "value": 0.0,
      "vs_t12": null,
      "non_recurring_excluded": null,
      "breakdown": {}
    },
    "effective_gross_income": 0.0
  },
  "expenses": {
    "real_estate_taxes": {
      "value": 0.0,
      "per_unit": null,
      "source": "actual | reassessment_estimate | benchmark",
      "sale_triggers_reassessment": false,
      "reassessment_basis": null,
      "benchmark_low": null,
      "benchmark_high": null
    },
    "insurance": {
      "value": 0.0,
      "pct_of_estimated_value": null,
      "source": "actual | benchmark | quote"
    },
    "management_fees": {
      "value": 0.0,
      "rate_pct": 0.0,
      "applied_to": "egi | gpr",
      "source": "contract | benchmark"
    },
    "payroll_benefits": {
      "value": 0.0,
      "per_unit": null,
      "source": "actual | benchmark"
    },
    "utilities": {
      "value": 0.0,
      "per_unit": null,
      "source": "actual | benchmark"
    },
    "repairs_maintenance": {
      "value": 0.0,
      "per_unit": null,
      "source": "actual | benchmark"
    },
    "contract_services": {
      "value": 0.0,
      "source": "actual | benchmark"
    },
    "marketing_advertising": {
      "value": 0.0,
      "source": "actual | benchmark"
    },
    "administrative": {
      "value": 0.0,
      "source": "actual | benchmark"
    },
    "professional_fees": {
      "value": 0.0,
      "source": "actual | benchmark"
    },
    "replacement_reserves": {
      "value": 0.0,
      "per_unit": null,
      "source": "actual | benchmark | replacement_cost_schedule"
    },
    "total_operating_expenses": 0.0,
    "expense_ratio": 0.0,
    "expense_per_unit": null,
    "expense_per_sqft": null,
    "vs_benchmark_assessment": "within_range | below_benchmark | above_benchmark | null"
  },
  "net_operating_income": 0.0,
  "noi_per_unit": null,
  "noi_per_sqft": null,
  "noi_margin": 0.0,
  "vs_t12_noi": null,
  "vs_t12_variance_pct": null,
  "variance_explanation": null,
  "projections": {
    "year_1": {
      "revenue_growth_rate": 0.0,
      "expense_growth_rate": 0.0,
      "projected_egi": 0.0,
      "projected_opex": 0.0,
      "projected_noi": 0.0
    },
    "year_2": {
      "projected_noi": 0.0
    }
  }
}
```

---

### § 4.6 — Valuation

**ID:** `valuation`  
**Header:** `## Valuation {#valuation}`  
**Purpose:** Value conclusions using income approach, with third-party appraisal cross-check.  
**Written by:** `agent:L2-CRE-04`, `engine:calculations.ts`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `noi_model`, `market_analysis`

```json
{
  "_meta": { "...": "see §2.5" },
  "purchase_price": null,
  "purchase_price_per_unit": null,
  "purchase_price_per_sqft": null,
  "gross_rent_multiplier": null,
  "income_approach": {
    "cap_rate_applied": 0.0,
    "cap_rate_source": "market_comparable | appraiser | underwriter | investor_target | blended",
    "cap_rate_range": { "low": null, "mid": 0.0, "high": null },
    "noi_used": 0.0,
    "noi_source": "underwritten | t12 | annualized_t3",
    "indicated_value": 0.0,
    "value_per_unit": null,
    "value_per_sqft": null
  },
  "appraised_value": null,
  "appraised_as_of": null,
  "appraiser_name": null,
  "appraisal_report_date": null,
  "appraisal_approach": "income | sales_comparison | cost | blended | null",
  "appraisal_cap_rate": null,
  "sales_comparison": {
    "indicated_value": null,
    "price_per_unit_range_low": null,
    "price_per_unit_range_high": null,
    "comp_count": null
  },
  "uw_value_vs_purchase_price_pct": null,
  "uw_value_vs_appraised_pct": null,
  "appraisal_inflation_flag": false,
  "value_used_for_ltv": 0.0,
  "value_used_for_ltv_basis": "appraised | underwritten | lesser_of | purchase_price"
}
```

---

### § 4.7 — Debt Structure

**ID:** `debt_structure`  
**Header:** `## Debt Structure {#debt_structure}`  
**Purpose:** Complete loan terms, sizing metrics, covenants, and rate sensitivity.  
**Written by:** `wizard:step_4`, `agent:L4-01`, `agent:L4-04`  
**Required for pipeline stage:** Screening and beyond  
**Dependencies:** `valuation`, `noi_model`

```json
{
  "_meta": { "...": "see §2.5" },
  "loan_amount": 0.0,
  "loan_purpose": "acquisition | refinance | cash_out_refi | construction | bridge | supplement",
  "loan_type": "conventional | agency_fannie | agency_freddie | cmbs | sba_504 | sba_7a | bridge | construction | life_co | hud_221d4 | hud_223f | mezzanine | null",
  "rate_type": "fixed | floating | hybrid",
  "interest_rate": 0.0,
  "rate_index": "sofr | prime | treasury_5yr | treasury_10yr | fixed | null",
  "rate_spread_bps": null,
  "rate_floor_pct": null,
  "rate_cap_pct": null,
  "note_rate_at_close": null,
  "amortization_years": 30,
  "loan_term_years": 0,
  "io_period_months": 0,
  "balloon_year": null,
  "balloon_payment_est": null,
  "recourse": "full | partial | non_recourse | carve_outs_only",
  "prepayment_type": "stepdown | yield_maintenance | defeasance | open | lockout | none | null",
  "prepayment_schedule": null,
  "origination_fee_pct": null,
  "exit_fee_pct": null,
  "lender_name": null,
  "lender_type": "bank | credit_union | cmbs_conduit | agency | life_co | debt_fund | private | sba | null",
  "annual_debt_service": 0.0,
  "monthly_debt_service": 0.0,
  "sizing_metrics": {
    "ltv": 0.0,
    "dscr_underwritten": 0.0,
    "dscr_inplace": null,
    "debt_yield": 0.0,
    "debt_yield_inplace": null,
    "binding_constraint": "ltv | dscr | debt_yield | null",
    "max_loan_at_ltv": null,
    "max_loan_at_dscr": null,
    "max_loan_at_debt_yield": null,
    "headroom_ltv_bps": null,
    "headroom_dscr": null,
    "headroom_debt_yield_bps": null
  },
  "stress_dscr": {
    "plus_100bps": null,
    "plus_200bps": null,
    "plus_300bps": null
  },
  "covenants": [
    {
      "type": "min_dscr | max_ltv | min_occupancy | min_nw_guarantor | min_liquidity | cash_trap | restricted_payments | leasing_threshold",
      "threshold": "string",
      "test_frequency": "annual | quarterly | monthly | at_maturity",
      "cure_period_days": null,
      "remedy_cascade": null
    }
  ]
}
```

---

### § 4.8 — Sources & Uses

**ID:** `sources_uses`  
**Header:** `## Sources & Uses {#sources_uses}`  
**Purpose:** Complete capital stack — all equity, debt, and cost components.  
**Written by:** `wizard:step_4`, `agent:L4-05`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `debt_structure`, `valuation`

```json
{
  "_meta": { "...": "see §2.5" },
  "total_project_cost": 0.0,
  "sources": {
    "senior_loan": 0.0,
    "mezzanine_debt": null,
    "preferred_equity": null,
    "equity_sponsor": 0.0,
    "equity_lp": null,
    "seller_financing": null,
    "government_grant": null,
    "tax_credit_equity": null,
    "other": null,
    "total": 0.0
  },
  "uses": {
    "purchase_price": 0.0,
    "closing_costs": {
      "broker_commission": null,
      "title_insurance": null,
      "transfer_taxes": null,
      "legal_fees": null,
      "due_diligence": null,
      "loan_origination_fee": null,
      "appraisal": null,
      "environmental": null,
      "survey": null,
      "inspection": null,
      "other": null,
      "total": 0.0
    },
    "renovation_budget": null,
    "renovation_contingency": null,
    "operating_reserves": null,
    "interest_reserve": null,
    "rate_cap_cost": null,
    "other_reserves": null,
    "total": 0.0
  },
  "equity_metrics": {
    "equity_total": 0.0,
    "equity_pct_of_cost": 0.0,
    "equity_per_unit": null,
    "equity_per_sqft": null,
    "loan_to_cost": null
  },
  "sources_uses_balanced": true
}
```

---

### § 4.9 — DCF & Hold Period Analysis

**ID:** `dcf`  
**Header:** `## DCF & Hold Period {#dcf}`  
**Purpose:** Multi-year discounted cash flow model, exit analysis, and returns.  
**Written by:** `engine:dcfEngine.ts`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `noi_model`, `debt_structure`

```json
{
  "_meta": { "...": "see §2.5" },
  "hold_period_years": 5,
  "analysis_start_date": null,
  "assumptions": {
    "revenue_growth_rate": 0.0,
    "expense_growth_rate": 0.0,
    "exit_cap_rate": 0.0,
    "exit_cap_rate_source": "string",
    "exit_cap_spread_over_going_in_bps": null,
    "disposition_costs_pct": 0.02,
    "discount_rate": null,
    "going_in_cap_rate": null
  },
  "annual_cash_flows": [
    {
      "year": 1,
      "gross_potential_rent": 0.0,
      "effective_gross_income": 0.0,
      "total_expenses": 0.0,
      "net_operating_income": 0.0,
      "annual_debt_service": 0.0,
      "net_cash_flow_levered": 0.0,
      "net_cash_flow_unlevered": 0.0,
      "cash_on_cash_return": 0.0,
      "cumulative_equity_invested": 0.0,
      "loan_balance_eoy": null
    }
  ],
  "exit_analysis": {
    "exit_year": 5,
    "exit_noi": 0.0,
    "exit_cap_rate": 0.0,
    "exit_value_gross": 0.0,
    "disposition_costs": 0.0,
    "exit_value_net": 0.0,
    "loan_balance_at_exit": 0.0,
    "net_proceeds_to_equity": 0.0,
    "exit_value_per_unit": null,
    "exit_value_per_sqft": null
  },
  "returns": {
    "levered_irr": null,
    "unlevered_irr": null,
    "equity_multiple": null,
    "avg_cash_on_cash": null,
    "total_equity_distributions": null,
    "npv": null,
    "discount_rate_used": null,
    "payback_period_years": null
  },
  "sensitivity_matrix": {
    "exit_cap_rate_axis": [],
    "rent_growth_axis": [],
    "irr_grid": []
  }
}
```

---

### § 4.10 — Stress Tests

**ID:** `stress_tests`  
**Header:** `## Stress Tests {#stress_tests}`  
**Purpose:** Scenario analysis showing deal performance under adverse conditions.  
**Written by:** `engine:calculations.ts`, `agent:L2-CRE-12`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `noi_model`, `debt_structure`

```json
{
  "_meta": { "...": "see §2.5" },
  "base_dscr": 0.0,
  "base_debt_yield": 0.0,
  "base_noi": 0.0,
  "scenarios": [
    {
      "name": "base_case | mild_stress | moderate_stress | severe_stress | custom",
      "label": "string",
      "revenue_shock_pct": 0.0,
      "expense_shock_pct": 0.0,
      "rate_shock_bps": 0,
      "cap_rate_expansion_bps": null,
      "resulting_egi": 0.0,
      "resulting_opex": 0.0,
      "resulting_noi": 0.0,
      "resulting_debt_service": 0.0,
      "resulting_dscr": 0.0,
      "resulting_debt_yield": 0.0,
      "resulting_ltv": null,
      "resulting_exit_value": null,
      "passes_dscr_minimum": true,
      "minimum_dscr_threshold": 1.0,
      "passes_debt_yield_minimum": true,
      "minimum_debt_yield_threshold": null
    }
  ],
  "break_even": {
    "break_even_occupancy_pct": 0.0,
    "break_even_rent_per_unit_monthly": null,
    "break_even_rent_per_sqft_annually": null,
    "current_vs_breakeven_occupancy_cushion": 0.0,
    "current_vs_breakeven_rent_cushion_pct": null
  },
  "rate_sensitivity": [
    {
      "rate_change_bps": 0,
      "resulting_rate_pct": 0.0,
      "resulting_annual_debt_service": 0.0,
      "resulting_dscr": 0.0
    }
  ]
}
```

---

### § 4.11 — Market Analysis

**ID:** `market_analysis`  
**Header:** `## Market Analysis {#market_analysis}`  
**Purpose:** Submarket conditions, rent comparables, sales comparables, and demand outlook.  
**Written by:** `agent:L2-CRE-07`, `agent:L2-CRE-08`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `property`

```json
{
  "_meta": { "...": "see §2.5" },
  "market": "string",
  "submarket": "string",
  "market_tier": "1 | 2 | 3 | null",
  "data_as_of": "YYYY-MM-DD | null",
  "data_sources": [],
  "vacancy": {
    "current_rate": null,
    "prior_year_rate": null,
    "yoy_change_bps": null,
    "trend": "improving | stable | deteriorating | null",
    "source": null
  },
  "rents": {
    "avg_asking_per_unit": null,
    "avg_asking_per_sqft": null,
    "yoy_rent_growth_pct": null,
    "trend": "strong | moderate | flat | declining | null",
    "by_unit_type": []
  },
  "supply": {
    "units_under_construction": null,
    "units_planned_12mo": null,
    "units_planned_24mo": null,
    "pct_of_existing_stock": null,
    "major_projects": [],
    "supply_assessment": "low | moderate | elevated | high | null"
  },
  "demand": {
    "net_absorption_trailing_12mo": null,
    "employment_growth_pct": null,
    "population_growth_pct": null,
    "major_employers": [],
    "demand_drivers": [],
    "outlook": "positive | neutral | negative | null"
  },
  "cap_rates": {
    "range_low": null,
    "range_mid": null,
    "range_high": null,
    "trend": "compressing | stable | expanding | null",
    "source": null
  },
  "comparable_sales": [
    {
      "address": null,
      "property_name": null,
      "sale_date": null,
      "units_or_sqft": null,
      "year_built": null,
      "sale_price": null,
      "price_per_unit": null,
      "price_per_sqft": null,
      "cap_rate": null,
      "distance_miles": null,
      "notes": null
    }
  ],
  "comparable_rentals": [
    {
      "property_name": null,
      "address": null,
      "units": null,
      "unit_type": null,
      "asking_rent_per_unit": null,
      "asking_rent_per_sqft": null,
      "occupancy_pct": null,
      "year_built": null,
      "distance_miles": null,
      "concessions": null
    }
  ],
  "market_risk_rating": "low | moderate | elevated | high | null",
  "market_narrative": "string | null"
}
```

---

### § 4.12 — Borrower & Sponsor

**ID:** `borrower_sponsor`  
**Header:** `## Borrower & Sponsor {#borrower_sponsor}`  
**Purpose:** Borrowing entity, principals, financial strength, and CRE track record.  
**Written by:** `wizard` (form), `agent:L2-CRE-09`, `agent:L2-CRE-10`, `agent:L2-CRE-11`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `ownership`

```json
{
  "_meta": { "...": "see §2.5" },
  "principals": [
    {
      "name": "string",
      "role": "managing_member | gp | owner | guarantor | key_principal | investor | other",
      "ownership_pct": null,
      "is_guarantor": false,
      "is_key_man": false,
      "net_worth_stated": null,
      "liquid_assets_stated": null,
      "contingent_liabilities_stated": null,
      "years_cre_experience": null,
      "pfs_received": false,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "tax_returns | cpa_letter | pfs_stated | bank_statements | null"
    }
  ],
  "financial_summary": {
    "global_net_worth": null,
    "global_liquidity": null,
    "nw_to_loan_ratio": null,
    "nw_to_loan_policy_min": null,
    "liquidity_to_loan_ratio": null,
    "liquidity_to_loan_policy_min": null,
    "global_debt_service_annual": null,
    "global_dscr": null,
    "all_figures_verified": false,
    "unverified_flag": true
  },
  "real_estate_portfolio": {
    "total_properties": null,
    "total_value_stated": null,
    "total_debt_stated": null,
    "implied_equity": null,
    "portfolio_ltv": null,
    "asset_classes_managed": [],
    "markets_active_in": []
  },
  "track_record": {
    "deals_completed": null,
    "total_deal_volume": null,
    "avg_hold_period_years": null,
    "similar_asset_class_experience": null,
    "similar_market_experience": null,
    "deals_in_default_or_loss": null,
    "summary_narrative": null
  },
  "entity_structure_flags": [],
  "key_man_risk_flag": false,
  "sponsor_narrative": null
}
```

---

### § 4.13 — Due Diligence

**ID:** `due_diligence`  
**Header:** `## Due Diligence {#due_diligence}`  
**Purpose:** Third-party report status, findings, and clearance for all DD items.  
**Written by:** `agent:L3-01` through `agent:L3-06`  
**Required for pipeline stage:** Credit approval and closing  
**Dependencies:** `property`

```json
{
  "_meta": { "...": "see §2.5" },
  "appraisal": {
    "received": false,
    "appraiser_name": null,
    "appraiser_cert_no": null,
    "firm": null,
    "on_approved_vendor_list": null,
    "effective_date": null,
    "report_date": null,
    "as_is_value": null,
    "as_stabilized_value": null,
    "as_complete_value": null,
    "cap_rate_applied": null,
    "income_approach_noi": null,
    "sales_comp_indicated_value": null,
    "extraordinary_assumptions": [],
    "hypothetical_conditions": [],
    "exposure_time_months": null,
    "marketing_time_months": null,
    "uspap_compliant": null,
    "within_policy_age": null,
    "policy_max_age_months": null,
    "adequacy_rating": "acceptable | acceptable_with_conditions | requires_revision | not_reviewed | null",
    "flags": []
  },
  "environmental": {
    "phase1_received": false,
    "phase2_received": false,
    "consultant_name": null,
    "firm": null,
    "phase1_report_date": null,
    "phase2_report_date": null,
    "rec_count": null,
    "rec_descriptions": [],
    "hrec_count": null,
    "crec_count": null,
    "vec_flag": false,
    "regulatory_database_hits": null,
    "phase2_recommended": null,
    "phase2_reason": null,
    "remediation_required": false,
    "remediation_cost_est": null,
    "clearance_status": "clear | recs_present | phase2_required | remediation_required | not_reviewed | null",
    "flags": []
  },
  "title": {
    "commitment_received": false,
    "effective_date": null,
    "title_company": null,
    "commitment_amount": null,
    "existing_liens": [],
    "schedule_b_exceptions": [],
    "material_exceptions": [],
    "required_endorsements": [],
    "property_tax_current": null,
    "mechanic_liens_present": false,
    "judgment_liens_present": false,
    "deed_restrictions": [],
    "easements": [],
    "clearance_status": "clear | exceptions_to_clear | material_issues | not_reviewed | null"
  },
  "survey": {
    "received": false,
    "survey_date": null,
    "surveyor": null,
    "survey_type": "alta | boundary | topographic | null",
    "encroachments_found": null,
    "easements_noted": [],
    "setback_issues": null,
    "parking_count_confirmed": null,
    "lot_size_sqft_confirmed": null,
    "clearance_status": "clear | issues_noted | not_reviewed | null"
  },
  "inspection": {
    "received": false,
    "inspector": null,
    "firm": null,
    "inspection_date": null,
    "building_systems_assessed": [],
    "deferred_maintenance_est": null,
    "immediate_needs": [],
    "short_term_needs_0_3yr": [],
    "long_term_needs_3_10yr": [],
    "major_system_remaining_life": {
      "roof_years": null,
      "hvac_years": null,
      "plumbing_years": null,
      "electrical_years": null,
      "elevators_years": null
    },
    "clearance_status": "clear | items_noted | significant_issues | not_reviewed | null"
  },
  "seismic": {
    "required": false,
    "received": false,
    "pml_pct": null,
    "clearance_status": "clear | pml_exceeds_threshold | not_reviewed | null"
  },
  "checklist": {
    "total_items_required": 0,
    "items_received": 0,
    "items_outstanding": [],
    "blocking_items": [],
    "ready_to_close": false
  }
}
```

---

### § 4.14 — Risk Assessment

**ID:** `risk_assessment`  
**Header:** `## Risk Assessment {#risk_assessment}`  
**Purpose:** Component risk scores, composite rating, and credit recommendation.  
**Written by:** `agent:L6-01` through `agent:L6-06`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `noi_model`, `valuation`, `market_analysis`, `borrower_sponsor`, `debt_structure`

```json
{
  "_meta": { "...": "see §2.5" },
  "scoring_model_version": "string",
  "component_scores": {
    "property": {
      "score": null,
      "max_score": 10,
      "weight": 0.25,
      "sub_factors": {
        "asset_quality": null,
        "physical_condition": null,
        "lease_structure": null,
        "functional_obsolescence": null,
        "location_quality": null
      },
      "strengths": [],
      "weaknesses": [],
      "rationale": null
    },
    "market": {
      "score": null,
      "max_score": 10,
      "weight": 0.20,
      "sub_factors": {
        "vacancy_trend": null,
        "supply_pipeline": null,
        "demand_outlook": null,
        "market_liquidity": null,
        "cap_rate_trend": null
      },
      "strengths": [],
      "weaknesses": [],
      "rationale": null
    },
    "borrower": {
      "score": null,
      "max_score": 10,
      "weight": 0.25,
      "sub_factors": {
        "financial_strength": null,
        "experience": null,
        "track_record": null,
        "management_depth": null
      },
      "strengths": [],
      "weaknesses": [],
      "rationale": null
    },
    "loan_structure": {
      "score": null,
      "max_score": 10,
      "weight": 0.30,
      "sub_factors": {
        "ltv": null,
        "dscr": null,
        "debt_yield": null,
        "covenant_package": null,
        "recourse_structure": null,
        "io_period_risk": null
      },
      "strengths": [],
      "weaknesses": [],
      "rationale": null
    }
  },
  "composite_score": null,
  "composite_rating_1_to_10": null,
  "regulatory_rating": "pass | special_mention | substandard | doubtful | loss | null",
  "top_risks": [],
  "top_mitigants": [],
  "risk_narrative": null,
  "recommendation": "approve | approve_with_conditions | decline | pending_human_review | null",
  "conditions": [],
  "decline_reasons": [],
  "policy_exceptions_required": [],
  "approval_authority_required": null,
  "status": "draft | preliminary | final",
  "human_review_required": true
}
```

---

### § 4.15 — Compliance

**ID:** `compliance`  
**Header:** `## Compliance {#compliance}`  
**Purpose:** Regulatory classification, AML screening, fair lending, and concentration checks.  
**Written by:** `agent:L5-01` through `agent:L5-06`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `debt_structure`, `ownership`, `borrower_sponsor`

```json
{
  "_meta": { "...": "see §2.5" },
  "hvcre": {
    "classification": "hvcre | non_hvcre | uncertain | not_applicable | null",
    "contributing_capital_test_met": null,
    "ltv_within_regulatory_limits": null,
    "pre_sold_leased_pct": null,
    "one_to_four_family_exclusion": false,
    "risk_weight_pct": null,
    "regulatory_citation": null,
    "rationale": null
  },
  "cra": {
    "eligible": null,
    "census_tract": null,
    "census_tract_income_category": "low | moderate | middle | upper | null",
    "majority_minority_tract": null,
    "lmi_census_tract": null,
    "small_business_loan_eligible": null,
    "cra_category": null
  },
  "bsa_aml": {
    "ofac_sdn_clear": null,
    "fincen_314a_clear": null,
    "pep_flags": [],
    "anonymous_structure_flag": false,
    "foreign_ownership_flag": false,
    "high_risk_geography_flag": false,
    "structuring_indicators": [],
    "overall_bsa_risk": "low | medium | high | null",
    "escalation_required": false,
    "escalation_reason": null
  },
  "fair_lending": {
    "review_triggered": false,
    "trigger_reasons": [],
    "pricing_variance_flag": false,
    "appraisal_bias_flag": false,
    "compliance_officer_review_required": false
  },
  "concentration": {
    "cre_total_pct_of_capital": null,
    "construction_pct_of_capital": null,
    "single_borrower_pct_of_tier1": null,
    "geographic_concentration_flag": false,
    "asset_class_concentration_flag": false,
    "within_all_concentration_limits": null,
    "nearest_limit_headroom_pct": null
  },
  "policy_exceptions": [
    {
      "exception_type": "string",
      "policy_code": "string",
      "description": "string",
      "value_requested": "string",
      "policy_limit": "string",
      "justification": null,
      "approval_authority": null,
      "status": "pending | approved | denied | null"
    }
  ]
}
```

---

### § 4.16 — Assumptions Registry

**ID:** `assumptions`  
**Header:** `## Assumptions {#assumptions}`  
**Purpose:** Complete audit trail of every assumption used in the underwriting, with source and provenance. This is the single source of truth for where every number came from.  
**Written by:** `engine:calculations.ts` (compiles from all sections)  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** All financial sections

```json
{
  "_meta": { "...": "see §2.5" },
  "assumptions": [
    {
      "key": "string",
      "label": "string",
      "section": "string",
      "category": "income | expense | financing | market | exit | scenario | borrower",
      "value": null,
      "unit": "pct | dollar | dollar_per_unit | dollar_per_sqft | years | months | bps | ratio | count | boolean | string",
      "source": "scenario_default | market_data | ai_extracted | user_override | investor_profile | agent_computed | wizard_input",
      "source_detail": null,
      "agent": null,
      "timestamp": "ISO8601",
      "confidence": "high | medium | low",
      "is_overridden": false,
      "original_value": null,
      "override_rationale": null,
      "linked_to_policy": false,
      "policy_threshold": null
    }
  ],
  "summary": {
    "total_assumptions": 0,
    "by_source": {
      "scenario_default": 0,
      "market_data": 0,
      "ai_extracted": 0,
      "user_override": 0,
      "investor_profile": 0,
      "agent_computed": 0,
      "wizard_input": 0
    },
    "low_confidence_count": 0,
    "override_count": 0
  }
}
```

---

### § 4.17 — Flags & Validation

**ID:** `validation`  
**Header:** `## Flags & Validation {#validation}`  
**Purpose:** All warnings, errors, policy flags, and cross-section consistency checks. This section is the machine-readable deal health signal.  
**Written by:** `engine:financialValidityChecker`  
**Required for pipeline stage:** All stages  
**Dependencies:** All sections (reads everything)

```json
{
  "_meta": { "...": "see §2.5" },
  "overall_status": "clean | warnings_only | errors_present | blocking",
  "financial_validity": [
    {
      "flag_id": "string",
      "metric": "dscr | ltv | cap_rate | vacancy_rate | opex_ratio | irr | rent_growth | equity_multiple | debt_yield | noi | other",
      "value": null,
      "threshold": {
        "type": "min | max | range",
        "min": null,
        "max": null
      },
      "severity": "error | warning | info",
      "message": "string",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": [
    {
      "section": "string",
      "field": "string",
      "required_for_stage": "screening | underwriting | credit_approval | closing",
      "severity": "blocking | warning | info",
      "message": "string"
    }
  ],
  "cross_section_consistency": [
    {
      "flag_id": "string",
      "sections_involved": [],
      "description": "string",
      "severity": "error | warning | info",
      "field_a": { "section": "string", "field": "string", "value": null },
      "field_b": { "section": "string", "field": "string", "value": null },
      "variance": null
    }
  ],
  "policy_flags": [
    {
      "policy_code": "string",
      "description": "string",
      "deal_value": "string",
      "policy_threshold": "string",
      "exception_filed": false,
      "exception_approved": false
    }
  ],
  "human_review_items": [],
  "thresholds_used": {
    "dscr_error_below": 1.0,
    "dscr_warning_below": 1.20,
    "ltv_warning_above": 0.75,
    "ltv_error_above": 0.85,
    "cap_rate_warning_below": 0.03,
    "cap_rate_warning_above": 0.15,
    "vacancy_warning_below": 0.02,
    "vacancy_warning_above": 0.40,
    "opex_ratio_warning_below": 0.20,
    "opex_ratio_warning_above": 0.70,
    "irr_warning_below": 0.05,
    "irr_warning_above": 0.40,
    "annual_rent_growth_warning_above": 0.08,
    "equity_multiple_warning_below": 1.0,
    "equity_multiple_warning_above": 5.0
  }
}
```

---

### § 4.18 — Pipeline Log

**ID:** `pipeline_log`  
**Header:** `## Pipeline Log {#pipeline_log}`  
**Purpose:** Immutable append-only execution history. Every agent run, user edit, render, and validation event is recorded. This is the audit trail.  
**Written by:** All tools (append-only — never superseded, only appended to)  
**Required for pipeline stage:** All stages

```json
{
  "_meta": { "...": "see §2.5 (note: pipeline_log _meta has no superseded field — it is always append-only)" },
  "entries": [
    {
      "entry_id": "string",
      "timestamp": "ISO8601",
      "event_type": "file_created | agent_run | user_edit | wizard_input | engine_run | render | import | export | validation | compact | note | flag_raised | flag_cleared | human_review | approval",
      "agent_or_actor": "string",
      "section_affected": null,
      "status": "success | partial | failed | skipped | pending",
      "input_sections": [],
      "output_sections": [],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": null
    }
  ]
}
```

Although Pipeline Log is registered here as §4.18, the **rendered file
position** is always last — see §2.1. The split between registry order and
file position is intentional: the registry orders sections by topic; the
file orders them so readers see the most recent run history at the bottom.

---

### § 4.19 — Custom Calculations

**ID:** `custom_calculations`  
**Header:** `## Custom Calculations {#custom_calculations}`  
**Purpose:** User-defined financial calculations specific to this deal, investor, or analysis need. Any metric, ratio, or derived figure not covered by the standard sections lives here — supplemental return metrics, deal-specific ratios, portfolio comparisons, preferred equity waterfall components, or any calculation the user needs.  
**Written by:** `user`, `wizard`, any agent  
**Required for pipeline stage:** Never required; optional at any stage  
**Dependencies:** Any section (via reference paths)

**Design principle:** A custom calculation is defined by its inputs (which may be literal values or live references to standard section fields using dot-path notation) and a plain-English formula description. AI tools can compute the result from the description; the engine can compute it if `formula_expression` is provided and parseable. The result is stored alongside the definition so the file is always self-contained. Recalculation is triggered whenever a referenced section is updated.

**Live reference syntax:** `"source_ref": "noi_model.net_operating_income"` — the engine substitutes the current value of that field into the calculation. If the field is null or the section doesn't exist yet, `status` is set to `awaiting_inputs` and `result` remains null.

```json uw:section=custom_calculations source=user ts=ISO8601 v=1
{
  "_meta": { "...": "see §2.5" },
  "_notes": null,
  "calculations": [
    {
      "calc_id": "string",
      "label": "string",
      "description": "string",
      "category": "returns | debt_metrics | income | expense | ratio | sensitivity | portfolio | waterfall | tax | other",
      "inputs": [
        {
          "variable": "string",
          "label": "string",
          "value": null,
          "source_ref": "string | null",
          "is_live_ref": true
        }
      ],
      "formula_description": "string",
      "formula_expression": "string | null",
      "result": null,
      "result_unit": "pct | dollar | dollar_per_unit | dollar_per_sqft | ratio | years | months | bps | count | string | other",
      "result_label": "string",
      "result_interpretation": "string | null",
      "thresholds": {
        "target": null,
        "minimum": null,
        "maximum": null
      },
      "passes_threshold": null,
      "status": "computed | awaiting_inputs | error | pending",
      "error_message": null,
      "written_by": "user | agent | engine",
      "timestamp": "ISO8601",
      "notes": null
    }
  ]
}
```

**Common examples:**

| Use Case | Formula Description | Inputs |
|---|---|---|
| True all-in yield | NOI ÷ (purchase price + closing costs + reserves) | `valuation.purchase_price`, `sources_uses.closing_costs.total`, `sources_uses.uses.operating_reserves`, `noi_model.net_operating_income` |
| Cash-on-cash in a specific year | Year N levered cash flow ÷ total equity invested | `dcf.annual_cash_flows[N].net_cash_flow_levered`, `sources_uses.equity_metrics.equity_total` |
| NOI/door vs. portfolio average | Subject NOI/door ÷ portfolio average NOI/door | `noi_model.noi_per_unit`, user-supplied `portfolio_avg_noi_per_door` |
| Preferred equity coverage | NOI − senior debt service − preferred return annual | `noi_model.net_operating_income`, `debt_structure.annual_debt_service`, user-supplied `pref_return_annual` |
| Loan constant | Annual debt service ÷ loan amount | `debt_structure.annual_debt_service`, `debt_structure.loan_amount` |
| Gross rent multiplier | Purchase price ÷ gross annual rents | `valuation.purchase_price`, `rent_roll.gross_potential_rent_annual` |

---

### § 4.20 — Custom Scenarios

**ID:** `custom_scenarios`  
**Header:** `## Custom Scenarios {#custom_scenarios}`  
**Purpose:** User-defined what-if analyses that go beyond the standard stress test matrix. These may model specific market events, construction delays, tenant losses, rate cap expiry, partnership changes, or any deal-specific situation the standard scenarios don't capture.  
**Written by:** `user`, `wizard`, agents  
**Required for pipeline stage:** Never required; optional at any stage  
**Dependencies:** `noi_model`, `debt_structure`, `dcf`, `assumptions` (for baseline values to override)

**Design principle:** A custom scenario defines a named set of overrides against a baseline. Overrides reference keys from the `assumptions` registry or field paths in standard sections. The engine recomputes affected metrics with the overrides applied and stores results alongside the scenario definition. Every scenario is fully reproducible from baseline + overrides — no hidden state.

The `sensitivity_sweeps` array supports single-variable sweeps: the user specifies a range of values for one assumption and the engine computes the target metric at each point, producing a result series for charting or tabular display.

```json uw:section=custom_scenarios source=user ts=ISO8601 v=1
{
  "_meta": { "...": "see §2.5" },
  "_notes": null,
  "scenarios": [
    {
      "scenario_id": "string",
      "label": "string",
      "description": "string",
      "rationale": "string | null",
      "type": "stress | upside | sensitivity | regulatory | partnership | construction | market_event | tenant_event | rate | exit | tax | other",
      "based_on": "base_case | mild_stress | moderate_stress | string",
      "overrides": [
        {
          "assumption_key": "string",
          "label": "string",
          "section_ref": "string | null",
          "field_ref": "string | null",
          "original_value": null,
          "override_value": null,
          "override_type": "absolute | pct_change | bps_change",
          "rationale": "string | null"
        }
      ],
      "narrative_setup": "string | null",
      "results": {
        "noi": null,
        "egi": null,
        "dscr": null,
        "ltv": null,
        "debt_yield": null,
        "irr": null,
        "equity_multiple": null,
        "exit_value": null,
        "cash_on_cash_yr1": null,
        "passes_min_dscr": null,
        "min_dscr_threshold": null,
        "additional_metrics": {}
      },
      "narrative_result": "string | null",
      "status": "computed | awaiting_inputs | pending",
      "written_by": "user | agent | engine",
      "timestamp": "ISO8601"
    }
  ],
  "sensitivity_sweeps": [
    {
      "sweep_id": "string",
      "label": "string",
      "description": "string | null",
      "variable_key": "string",
      "variable_label": "string",
      "variable_values": [],
      "output_metric": "dscr | irr | equity_multiple | noi | ltv | debt_yield | cash_on_cash | custom",
      "output_label": "string",
      "results": [],
      "chart_type": "line | bar | table | null",
      "status": "computed | pending"
    }
  ]
}
```

**Common examples:**

| Scenario | Type | Key Override |
|---|---|---|
| Renovation budget overrun +20% | construction | `sources_uses.renovation_budget` +20% |
| Anchor tenant vacates | tenant_event | Override specific tenant status to vacant; recompute NOI |
| Rate cap expires at year 3 | rate | `debt_structure.interest_rate` from capped to index+spread at year 3 |
| Lease-up 6 months longer than underwritten | stress | Delay year-1 revenue growth by 2 quarters |
| Partner buyout at year 2 | partnership | Model equity buyout cost; recalculate year 2+ IRR |
| City rezones — cap rate compression | market_event | `valuation.income_approach.cap_rate_applied` down 50bps |
| 1031 replacement pressure (must close) | regulatory | Override close deadline; model higher purchase price |

---

### § 4.21 — Extension Sections

**ID:** `x_{user_defined_id}`  
**Header:** `## {User Label} {#x_{user_defined_id}}`  
**Purpose:** Fully user-defined sections for content that does not fit any standard section or the `custom_calculations`/`custom_scenarios` frameworks. Extension sections have no enforced schema — they are free-form containers that parsers collect without validating.  
**Written by:** Any tool, user, or agent  
**Required for pipeline stage:** Never required  
**Dependencies:** None (extension sections are isolated by design)

**When to use an extension section instead of custom_calculations/custom_scenarios:**
- The content is narrative-first, not calculation-first (e.g., a renovation scope document, a lender outreach tracker, a lease negotiation log)
- The schema doesn't fit the override-a-baseline model
- The user is prototyping a new section type before it standardizes

**Rules:**
1. Section IDs MUST begin with `x_` — this is the machine signal that the section is non-standard
2. Parsers MUST collect extension sections under `parsed.extensions[id]` without error
3. Validators MUST skip extension sections entirely — no schema checks
4. Renders include extension sections in an "Additional Analysis" appendix when `render_hint.include_in_output` is `true`
5. Cross-section consistency checks do not apply to extension sections
6. The `schema_version` field signals a stable schema ready for standardization review — set it to a semver string when the schema has stabilized across deals

```json uw:section=x_{user_defined_id} source=user ts=ISO8601 v=1
{
  "_meta": {
    "section": "x_your_id",
    "version": 1,
    "superseded": false,
    "source": "user",
    "agent_id": null,
    "agent_version": null,
    "actor": "string",
    "timestamp": "ISO8601",
    "confidence": "high | medium | low",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "render_hint": {
    "include_in_output": false,
    "output_label": "string | null",
    "output_position": "appendix | after_section | null",
    "after_section_id": "string | null",
    "visible_tiers": ["screener", "analyst"]
  },
  "schema_version": null,
  "content": {}
}
```

The `content` object is entirely free-form. Any valid JSON is accepted.

**Documented extension patterns (community-validated):**

| ID | Label | Used For |
|---|---|---|
| `x_renovation_plan` | Renovation Plan | Line-item budget, contractor bids, scope notes, timeline |
| `x_lender_matrix` | Lender Outreach | Lenders contacted, terms quoted, status, next steps |
| `x_partnership_structure` | Partnership / Waterfall | GP/LP splits, promote tiers, preferred return details |
| `x_1031_exchange` | 1031 Exchange | ID period deadlines, relinquished property, QI info |
| `x_entitlement_log` | Entitlement Log | Zoning approvals, variance applications, hearing dates |
| `x_lease_negotiation` | Lease Negotiation | Tenant LOI terms, red lines, open issues, history |
| `x_capex_schedule` | CapEx Schedule | Multi-year capital plan by system, cost, year, priority |
| `x_broker_analysis` | Broker Underwriting | Broker's own underwriting for comparison or reference |
| `x_tax_analysis` | Tax & Depreciation | Cost segregation, bonus depreciation, tax-adjusted returns |

**Graduating to standard:** When an extension section appears frequently enough across deals that a consistent schema emerges, it is a candidate for a standard section in the next spec release. Submit via the spec changelog process with: the `x_` schema you've been using, a description of the use case, and at least 3 example instances.

---

### § 4.22 — Gaps

**ID:** `gaps`  
**Header:** `## Gaps {#gaps}`  
**Purpose:** A first-class inventory of the data the deal does not yet have. Blocks held back by missing inputs, fields filled from defaults, and items deferred for later rounds all surface here. Drives the refinement engine (Protocol §X) and is consulted by every validator that needs to know whether a missing value is intentional or accidental.  
**Written by:** `agent/L0a` (initial scope), `agent/L0b` (refinement loop), `manual` (analyst notes), or `system/gaps-maintainer` (auto-maintenance hook in the editor)  
**Required for pipeline stage:** Optional at every stage (a deal with no open gaps simply omits the section)  
**Dependencies:** None — gaps reference other sections by ID/path but do not require them to exist  
**Schema:** [`spec/schemas/section-gaps.schema.json`](schemas/section-gaps.schema.json)

A gap entry names a missing or low-quality field by `(section, field_path)` and records *why* it is open (`missing | illegible | out_of_scope | deferred | blocked_by_dependency | awaiting_external`). Optional metadata declares the lowest stage the gap blocks, who owns resolving it, and how stale the entry is.

```json uw:section=gaps source=system/gaps-maintainer ts=ISO8601 v=1 confidence=high
{
  "_meta": { "...": "see §2.5" },
  "_notes": null,
  "items": [
    {
      "section": "rent_roll",
      "reason": "missing",
      "blocks_stage": "screening",
      "first_seen": "2026-04-25T10:00:00Z",
      "last_checked": "2026-04-27T09:00:00Z",
      "owner": "agent/L0a",
      "note": "Awaiting unit-level rent roll from broker."
    },
    {
      "section": "noi_model",
      "field_path": "expense_ratio",
      "reason": "deferred",
      "blocks_stage": "full_underwrite",
      "owner": "manual",
      "note": "Using asset-class default until T-12 arrives."
    }
  ],
  "summary": {
    "total_open": 2,
    "blocking_current_stage": 1,
    "blocking_next_stage": 1
  }
}
```

**Auto-maintenance.** When a Tier-2 editor is invoked with the `--maintain-gaps` flag, the editor runs `inferGaps()` after every successful write and either updates the existing `gaps` section or creates one. The auto-write is stamped `_meta.source: 'system/gaps-maintainer'` and `_meta.actor: 'system'` so it is filterable from human-authored entries.

**Validator codes.** A `provisional` block with no matching gap entry triggers `DQ-01`; a `partial` block with no `field_overrides` triggers `DQ-03`; consuming a provisional block at a stage whose policy is `halt` triggers `DQ-02`; a stale entry (older than the institution's freshness threshold) triggers `DQ-05`. See Protocol §III.6a.

---

### § 4.23 — Components (Mixed-Use)

**ID:** `components`  
**Header:** `## Components {#components}`  
**Purpose:** Decomposes a mixed-use property into its constituent uses, each keyed by its own asset class. A mixed-use property is two or more uses under one purchase price and one loan — apartments over ground-floor retail, an office podium under a hotel — and no single income model or denominator describes it. This section states each use's own income so that property-level figures foot as the sum of the components while use-level metrics stay honest. It is the one section whose presence is gated to a single `asset_class`.  
**Written by:** `wizard`, `manual`, `agent:L4-*` (component subtotals only — an agent MUST NOT populate `allocation_pct`; see Allocation below)  
**Required for pipeline stage:** Full underwriting, and only when `asset_class` is `mixed_use`  
**Dependencies:** `valuation`, `noi_model` (the property-level figures the components foot into)  
**Schema:** [`spec/schemas/section-components.schema.json`](schemas/section-components.schema.json)  
**Introduced by:** RFC 0019 (mixed-use composition).

The section is a **bounded map keyed by the component's own asset class**, not a variable-length array, so that every field path a calc pack reads stays static (e.g. `components.retail.net_operating_income`). Each entry is one *use type*, not one tenant: a property with two retail suites has a single `retail` component.

**Normative rules (RFC 2119):**

- The `components` section MAY appear **only** when `frontmatter.asset_class` is `mixed_use`. A document with any other asset class carrying a `components` section MUST be rejected (`CC-11`). This keeps the section from becoming a general-purpose escape hatch.
- Each key MUST be one of `multifamily`, `retail`, `office`, `industrial`, `self_storage`, `hospitality`, `senior_housing`, or `student_housing`, and each entry's `component_class` MUST equal its key. These are exactly the asset classes whose `net_operating_income` is computed on the standard `effective_gross_income − total_operating_expenses` basis. `land` MUST NOT be a component — its NOI model nets negative by design, and admitting it would let a carry burden silently reduce property income.
- At least **two** components MUST be present. A single-component document is not mixed use and MUST declare that component's own asset class instead, where a real calc pack and defaults table already apply.
- Each **present** component MUST state `net_operating_income`. A present component that omits a figure a property rollup consumes is an incomplete document, not a use with no income, and MUST raise a typed validation error rather than resolve to zero. An **absent** component — a class simply not listed — contributes nothing to any rollup.
- A component MUST NOT carry its own `debt_structure`. This section models one property-level loan; component-level financing (for example a separately-financed commercial condo) is refused here and specified by RFC 0026 (Capital Stack).

**Footing.** Property `noi_model.net_operating_income` MUST equal the sum of the component `net_operating_income` figures (`CC-12`). Because every admitted class computes NOI on the same basis, this sum is well-defined with no special case.

**Operating-business components.** `hospitality`, `senior_housing`, and `student_housing` are operating businesses. Where a component's own calc pack strikes a model-level intermediate subtotal above NOI — `gross_operating_profit` for `hospitality`, `total_labor_expense` for `senior_housing` — that subtotal MAY be carried in the component and is surfaced per component. These subtotals sit at different points in their respective waterfalls and MUST NOT be blended into a single synthesized property-level intermediate. A property-level `gross_operating_profit` MAY be reported only as a memo summing the components that declare one; a component that has none contributes N/A, never `0`.

**Allocation.** One purchase price and one loan cover the whole property, so use-level intensive metrics (price per apartment, loan per retail square foot) require splitting those single figures across components. There is no deterministic way to derive that split — income share, area share, and appraised-value share all disagree, and the choice is an underwriter's judgment. Therefore `allocation_pct` is an **input**, never a derivation: it is user-supplied, MUST sum to `1.0` across present components within `0.0001`, and an agent MUST NOT populate it. When `allocation_pct` is absent, every use-level intensive metric MUST evaluate to `null` rather than fall back to an area- or income-share guess.

```json uw:section=components source=manual ts=ISO8601 v=1 confidence=high
{
  "_meta": { "...": "see §2.5" },
  "_notes": null,
  "multifamily": {
    "component_class": "multifamily",
    "effective_gross_income": 2180000,
    "operating_expenses": 880000,
    "net_operating_income": 1300000,
    "total_units": 120,
    "nra_sqft": 96000,
    "allocation_pct": 0.78
  },
  "retail": {
    "component_class": "retail",
    "effective_gross_income": 520000,
    "operating_expenses": 148000,
    "net_operating_income": 372000,
    "nra_sqft": 18000,
    "allocation_pct": 0.22
  }
}
```

In this example property NOI is `1300000 + 372000 = 1672000`, which `noi_model.net_operating_income` MUST equal, and the allocations sum to `1.0`.

---

### § 4.24 — Capital Stack

**ID:** `capital_stack`  
**Header:** `## Capital Stack {#capital_stack}`  
**Purpose:** States a deal's full capital structure as an ordered set of typed tranches — senior debt under mezzanine under preferred equity under common equity, with bridge or seller financing where present — and the stack-aware sizing figures a lender underwrites to. `debt_structure` (§ 4.7) models exactly one loan; this section is where a multi-tranche stack lives, so that per-layer coverage and attachment-point risk are visible rather than collapsed into a single mislabeled DSCR. The stack is **asset-class independent**.  
**Written by:** `wizard`, `manual`, `agent:L4-*` (tranche amounts and terms are user-supplied capital terms — an agent MUST NOT invent a tranche `rate`, `amount`, or a stated `sizing` value)  
**Required for pipeline stage:** Optional; used whenever a deal carries more than one capital tranche.  
**Dependencies:** `debt_structure`, `sources_uses` (the senior tranche reconciles with both — see `CC-03`)  
**Schema:** [`spec/schemas/section-capital-stack.schema.json`](schemas/section-capital-stack.schema.json)  
**Introduced by:** RFC 0026 (capital stack).

The section has two parts: an ordered **`tranches`** array and a **`sizing`** array of stated figures a verifier recomputes. Unlike `components` (§ 4.23), which must be a bounded map because a calc pack reads its fields by static path, `capital_stack` is a **state-and-verify** structure (RFC 0021 § 6): the Tier‑3 calc engine never reads it, so a variable-length array is safe. Stated sizing figures are recomputed by a deterministic verifier (`verifyCapitalStack`, a sibling of `verifyRollup`) over a **fixed, closed function vocabulary** — not by a pack formula and not by any calc-engine primitive. This is what lets the stack carry an arbitrary number of tranches (including two mezzanine notes) without the sandbox iterating.

**Tranches.** Each entry is a typed object:

- `id` — document-local, unique within the section, free-form (`senior`, `mezz_a`, `mezz_b`). Two mezzanine notes are simply two tranches.
- `class` — one of `senior_debt`, `mezzanine_debt`, `preferred_equity`, `common_equity`, `bridge`, `seller_financing`, `other_debt`. Non-extensible.
- `position` — integer, `1` = most senior. Positions MUST be unique within the stack.
- `amount` — the committed dollar amount.
- `rate` — the coupon (debt) or preferred return (pref), as a fraction. REQUIRED for every debt tranche and for `preferred_equity`; MUST NOT appear on `common_equity`.
- `accrual` — `cash` (current‑pay; enters cash coverage) or `accrued` (PIK; compounds on balance and does **not** enter cash coverage). Applies to `preferred_equity` and MAY apply to debt.
- `amortization_months`, `io_months`, `term_months` — debt terms, from which the tranche's own annual debt service is derived deterministically.

**Normative rules (RFC 2119):**

- The `capital_stack` section is OPTIONAL and asset-class independent. A document with no `capital_stack` behaves exactly as before this RFC; every single-loan metric is unchanged.
- Each tranche MUST state `id`, `class`, `position`, and `amount`; `id` and `position` MUST be unique within the section. A malformed or duplicate-keyed tranche MUST be rejected (`CS-01`).
- Every debt tranche and every `preferred_equity` tranche MUST state a `rate`; a `common_equity` tranche MUST NOT (`CS-02`).
- When a `capital_stack` is present, its `senior_debt` tranche MUST reconcile with `debt_structure` and the `sources_uses` senior bucket — same amount, same rate. This is the generalized `CC-03`: the senior view is stated once and agrees everywhere.
- **Sizing is stated and verified, never trusted.** Each `sizing` entry names a closed `fn`, a selector, and a stated `value`; a verifier recomputes `fn` and compares. Disagreement is `CS-SIZING-DISAGREES` and the result is `failed`, never a silent pass. A figure that reads a tranche field the document does not supply is `unverifiable`, never `0`.
- **The distribution waterfall is out of scope for this version.** A `capital_stack` that attempts to encode distribution tiers, promote, IRR hurdles, or catch-up MUST be refused (`CS-WATERFALL-UNSUPPORTED`) with guidance to `x_partnership_structure`; the multi-period distribution waterfall is deferred (RFC 0026 § E) pending a hold-period cash-flow primitive.

**Sizing vocabulary (closed, non-extensible).** Each figure selects tranches with `over` (a single tranche `id`), `through` (a `position`, cumulative through that layer), or `*` (the whole stack):

| `fn` | selector | recomputation |
|---|---|---|
| `coverage` | `over` | `noi_model.net_operating_income` ÷ that tranche's annual debt service |
| `blended_coverage` | `through` | NOI ÷ Σ **cash-pay** debt service at or above the position (accrued/PIK excluded) |
| `debt_yield_through` | `through` | NOI ÷ cumulative debt balance through the position — the attachment-point yield |
| `ltc_through` / `ltv_through` | `through` | cumulative balance through the layer ÷ total cost / value |
| `weighted_cost` | `*` | amount-weighted average `rate` across the stack |

An accrued/PIK tranche contributes **zero** to `blended_coverage` but its balance still counts in `debt_yield_through` — accrual changes cash coverage, not the capital ahead of you.

```json uw:section=capital_stack source=manual ts=ISO8601 v=1 confidence=high
{
  "_meta": { "...": "see §2.5" },
  "tranches": [
    { "id": "senior", "class": "senior_debt",      "position": 1, "amount": 26000000, "rate": 0.0625, "amortization_months": 360, "io_months": 24, "term_months": 120, "accrual": "cash" },
    { "id": "mezz_a", "class": "mezzanine_debt",    "position": 2, "amount": 6000000,  "rate": 0.11,   "amortization_months": 0,   "io_months": 120, "term_months": 120, "accrual": "cash" },
    { "id": "pref",   "class": "preferred_equity",  "position": 3, "amount": 4000000,  "rate": 0.09,   "accrual": "accrued" },
    { "id": "common", "class": "common_equity",     "position": 4, "amount": 4000000 }
  ],
  "sizing": [
    { "id": "senior_dscr",     "fn": "coverage",           "over": "senior",  "value": 1.85 },
    { "id": "combined_dscr",   "fn": "blended_coverage",   "through": 2,       "value": 1.14 },
    { "id": "mezz_debt_yield", "fn": "debt_yield_through", "through": 2,       "value": 0.080 },
    { "id": "wacc",            "fn": "weighted_cost",      "over": "*",        "value": 0.0731 }
  ]
}
```

Here the pref tranche is `accrued`, so it is excluded from `combined_dscr` but its balance is not part of `mezz_debt_yield` (which is a debt-only attachment metric through position 2). The senior tranche's `amount` and `rate` reconcile with `debt_structure` under `CC-03`.

---

## Part V — Validation Rules

### 5.1 Pipeline Stage Completeness Requirements

The following sections must be present (non-null) before advancing to each stage:

| Stage | Required Sections |
|---|---|
| **Screening** | `property`, `debt_structure` (amounts only), `validation` |
| **Term Sheet** | + `rent_roll`, `borrower_sponsor` (principals only), `preliminary_sizing` |
| **Full Underwrite** | + `operating_statement` (T-12), `noi_model`, `valuation`, `sources_uses`, `market_analysis` |
| **Credit Approval** | + `dcf`, `stress_tests`, `risk_assessment`, `compliance`, `assumptions` |
| **Closing** | + `due_diligence` (all items cleared), `debt_structure` (final terms) |
| **Portfolio Monitoring** | + Updated `operating_statement` (annual), `validation` (re-run) |

### 5.2 Financial Validity Thresholds

These are the default thresholds. Institution configs may override.

| Metric | Error Below | Warning Below | Warning Above | Error Above |
|---|---|---|---|---|
| DSCR | 1.00x | 1.20x | — | — |
| LTV | — | — | 75% | 85% |
| Debt Yield | — | 7% | — | — |
| Going-in Cap Rate | — | 3% | 15% | — |
| Vacancy Rate | — | 2% | 40% | — |
| OpEx Ratio | — | 20% | 70% | — |
| Levered IRR | — | 5% | 40% | — |
| Equity Multiple | — | 1.0x | 5.0x | — |
| Annual Rent Growth | — | — | 8% | — |
| LTC (construction) | — | — | 80% | 90% |

### 5.3 Cross-Section Consistency Checks

Tools MUST run these after each section write:

| Check ID | Description | Sections |
|---|---|---|
| `CC-01` | Rent roll GPR must match OS GPR within 3% | `rent_roll`, `operating_statement` |
| `CC-02` | UW value in `valuation` must match value used for LTV in `debt_structure` | `valuation`, `debt_structure` |
| `CC-03` | Senior loan reconciles: `sources_uses` senior loan, `debt_structure.loan_amount`, and (when present) the `capital_stack` `senior_debt` tranche must all match | `sources_uses`, `debt_structure`, `capital_stack` |
| `CC-04` | Sources must equal uses in `sources_uses` | `sources_uses` |
| `CC-05` | NOI used for DSCR must match `noi_model.net_operating_income` within 1% | `noi_model`, `debt_structure` |
| `CC-06` | DCF Year 1 NOI must be consistent with `noi_model` projections | `noi_model`, `dcf` |
| `CC-07` | Exit cap rate in `dcf` must match stress test cap rate expansion scenarios | `dcf`, `stress_tests` |
| `CC-08` | Appraised value in `due_diligence.appraisal` must match `valuation.appraised_value` | `due_diligence`, `valuation` |
| `CC-09` | Annual debt service in `stress_tests` base case must match `debt_structure.annual_debt_service` | `stress_tests`, `debt_structure` |
| `CC-10` | Purchase price in `sources_uses.uses` must match `valuation.purchase_price` | `sources_uses`, `valuation` |
| `CC-11` | A `components` section may appear only when `asset_class` is `mixed_use` (RFC 0019) | `components`, frontmatter |
| `CC-12` | Property `noi_model.net_operating_income` must equal the sum of component `net_operating_income` (mixed-use) | `components`, `noi_model` |

---

## Part VI — Toolchain Interface

The `uwmd` command-line tool is the reference implementation. Other tools (AI agents, API consumers, rendering pipelines) implement a subset of this interface.

### 6.1 `uwmd parse <file>`

Reads a `.uwx.md` file and outputs a structured JSON object containing:
- Frontmatter (as-is)
- All non-superseded data blocks, keyed by section ID and variant
- Pipeline log entries

```json
{
  "frontmatter": { "...": "YAML frontmatter as JSON" },
  "sections": {
    "property": { "...": "most recent non-superseded block" },
    "operating_statement": {
      "t12": { "...": "t12 variant" },
      "t3": { "...": "t3 variant" }
    }
  },
  "prose": {
    "property": "string — the markdown prose block for this section",
    "...": "..."
  },
  "pipeline_log": [ "...entries..." ],
  "superseded_blocks": { "...": "all superseded blocks, keyed by section + version" }
}
```

### 6.2 `uwmd validate <file> [--stage <stage>]`

Runs all validation rules (§5) and returns:

```json
{
  "overall_status": "clean | warnings | errors | blocking",
  "stage_readiness": {
    "screening": true,
    "full_underwrite": false,
    "credit_approval": false,
    "closing": false
  },
  "issues": [ "...ValidationIssue objects..." ]
}
```

### 6.3 `uwmd run <file> --agent <agent_id>`

Invokes a Bancroft agent against the file. The agent:
1. Reads the parsed file via `uwmd parse`
2. Performs its analysis
3. Returns a new data block (the section it writes)
4. `uwmd run` appends the new block to the file, superseding the previous version if one exists
5. Appends a `pipeline_log` entry

### 6.4 `uwmd render <file> --format <format> [--tier <tier>]`

Renders the file to an output format. Formats:

| Format | Description | Requires |
|---|---|---|
| `pdf` | Lender-ready deal package PDF | L7 sections complete |
| `docx` | Credit memo Word document | L7 sections complete |
| `json` | Extracted data only (no prose) | Any stage |
| `csv` | Flat metrics summary | Any stage |
| `chat` | Compressed context for AI assistant | Any stage |
| `summary` | One-page deal summary markdown | Screening+ |

The `--tier screener` flag renders only the Tier 1 sections (no Bancroft-generated sections). The `--tier analyst` flag renders the full package.

### 6.5 `uwmd compact <file>`

Removes all blocks where `_meta.superseded === true`. Preserves the pipeline log. Outputs the compacted file. Appends a `compact` entry to the pipeline log.

### 6.6 `uwmd diff <file_a> <file_b>`

Compares two `.uwx.md` files (or two versions of the same file at different timestamps) and outputs a structured diff showing which sections changed, what values changed, and which source produced the change.

### 6.7 `uwmd init --scenario <scenario> --address <address>`

Creates a new `.uwx.md` file with:
- Populated frontmatter
- All section headers in canonical order
- Empty data block stubs (all fields null) for each section
- An initial `pipeline_log` entry recording creation

### 6.8 Agent Contract

Any Bancroft agent writing to a `.uwx.md` file MUST:

1. Read the current state of its input sections before running
2. Produce a single data block JSON object matching the section schema exactly
3. Include a valid `_meta` object as the first key
4. Set `_meta.version` to `previous_version + 1` (or `1` if no previous block exists)
5. Set `_meta.superseded = false`
6. Never write to sections outside its defined scope (see §4 "Written by" field)
7. Never set `human_review_required: false` if the block contains any `low` confidence values
8. Return `{ "status": "awaiting_input", "required": ["section_id", ...] }` if required input sections are missing, rather than failing

---

## Part VII — Rendering Targets

### 7.1 Lender Package PDF (Tier 1)

Sections rendered, in order:
1. Cover page (property photo, address, date, preparer)
2. Executive Summary (key metrics table from `quick_metrics`)
3. Property Overview → `property` section prose + formatted data
4. Proforma / Cash Flow → `noi_model` formatted table
5. Rent Roll Summary → `rent_roll` unit_mix_summary table
6. Debt Structure → `debt_structure` terms table
7. Sources & Uses → `sources_uses` capital stack
8. Borrower Summary → `borrower_sponsor.sponsor_narrative` + financial summary
9. Exit Analysis → `dcf.exit_analysis` + returns table
10. Assumptions & Disclosures → `assumptions` table with source badges; standard disclaimer

### 7.2 Credit Memo (Tier 2 Analyst)

All Tier 1 sections plus:
- Market Analysis → `market_analysis` full narrative + comp tables
- Financial Analysis → Full DCF table + `stress_tests` matrix
- Due Diligence Summary → `due_diligence` checklist and findings
- Risk Assessment → `risk_assessment` component scores + narrative
- Compliance Summary → `compliance` key findings
- Covenants → `debt_structure.covenants` formatted table
- Appendices → Raw agent outputs, full rent roll

### 7.3 AI Chat Context (`--format chat`)

A compressed representation of the deal for dropping into an AI assistant. Includes:
- Full frontmatter
- Prose sections (not data blocks — AI reads narrative faster)
- Key metrics table from `quick_metrics`
- Active flags from `validation`
- Assumptions summary (by source category counts)

Omits: full unit-level rent roll data, full operating statement line items, pipeline log (included as a one-line summary instead).

Target token count: < 8,000 tokens for Tier 1 deal, < 16,000 for full Tier 2 deal.

---

## Appendix A — File Naming Convention

```
{deal_id}_{address_slug}_{YYYYMMDD}.uwx.md
```

Example:
```
uw_2026_a3f9b1_1234-main-st-phoenix-az_20260424.uwx.md
```

Versioned snapshots (before compact):
```
uw_2026_a3f9b1_1234-main-st-phoenix-az_20260424_v3.uwx.md
```

---

## Appendix B — Scenario Default Keys

The following keys MUST exist in the `assumptions` section for every deal, populated from `scenario_defaults.json` when no higher-authority source provides them:

```
vacancy_rate
rent_growth_rate_yr1
rent_growth_rate_yr2_plus
expense_growth_rate
management_fee_pct
replacement_reserves_per_unit
exit_cap_rate_spread_bps
hold_period_years
disposition_costs_pct
io_period_months
leverage_ratio_default
interest_rate_assumption
amortization_years
```

---

## Appendix C — Extension & Customization Points

The format has four layers of extensibility, in order from most structured to least:

### C.1 — Standard Section Extension Fields

Every standard section accepts two universal extension fields without any schema modification:

- **`_notes`** (string) — Free-text annotation on any data block. Never validated, never consumed by the engine, always preserved. For human-to-human and human-to-AI annotation.
- **`extensions`** (object) — A free-form key-value bag inside any standard section's data block for fields that don't fit the schema but are too closely related to warrant a separate section. Keys prefixed with `x_` in `extensions` are never validated. Keys without `x_` are reserved for future spec fields and will generate a warning from validators if unrecognized.

Example: a multifamily deal with a cell tower lease on the roof can store `"extensions": { "x_cell_tower_rent_annual": 18000, "x_cell_tower_lease_expiration": "2031-06-30" }` in the `rent_roll` block rather than creating a full extension section.

### C.2 — Custom Calculations (§ 4.19)

For supplemental metrics, deal-specific ratios, and derived figures. Fully structured, supports live references to standard section values, result is stored and reproducible. See §4.19 for full spec.

### C.3 — Custom Scenarios (§ 4.20)

For what-if analyses beyond the standard stress test matrix. Override any assumption by key; engine recomputes affected metrics. Supports single-variable sensitivity sweeps. See §4.20 for full spec.

### C.4 — Extension Sections (§ 4.21)

For content that doesn't fit any structured framework — renovation plans, lender outreach trackers, partnership structures, negotiation logs. Identified by `x_` prefix on section ID. No schema enforcement; parsers collect without error; renders include in appendix when flagged. See §4.21 for full spec and documented community patterns.

### C.5 — Custom Assumption Sources

Any `source` string not in the defined list (§2.6) is treated as `"custom"` by validators. It is recorded, not rejected. Useful for proprietary data feeds, internal systems, or third-party integrations.

```json
{ "source": "custom:argus_export_2026_q1" }
```

### C.6 — Custom Validation Thresholds

The `.uw.institution.json` sidecar file (same directory as the `.uwx.md` file) can override the default validation thresholds from §5.2 on a per-institution or per-user basis:

```json
{
  "institution_id": "string",
  "validation_overrides": {
    "dscr_warning_below": 1.25,
    "ltv_warning_above": 0.70,
    "debt_yield_warning_below": 0.09
  },
  "required_sections_overrides": {},
  "render_template_overrides": {}
}
```

When a `.uw.institution.json` is present, its thresholds take precedence over the spec defaults. This allows institutional deployments to enforce their own credit policy without modifying the spec.

### C.7 — Spec Evolution Protocol

Extension sections that stabilize into consistent schemas are candidates for promotion to standard sections. Promotion criteria:

1. The `x_` section has been used across ≥ 5 distinct deals with a consistent schema
2. The `schema_version` field is set to a semver string (signals author believes it's ready)
3. A spec change proposal is submitted with: the schema, use-case description, 3+ example instances, and proposed standard section ID

Promoted sections are assigned a section number in the next minor version of the spec. The `x_` version continues to parse correctly — old files are never broken.

---

## Appendix D — YAML Subset (Frontmatter)

The `.uwx.md` frontmatter (between the opening and closing `---` markers) is parsed against a strict YAML **subset**, not full YAML 1.2. Conforming readers MUST reject frontmatter that uses any feature outside this subset with the validator code `UNSUPPORTED_YAML_FEATURE`.

### D.1 — Supported

| Feature | Example |
| ------- | ------- |
| Scalar — bare string | `state: AZ` |
| Scalar — single-quoted string | `notes: 'I need to recheck'` |
| Scalar — double-quoted string | `deal_name: "Parkview Apartments"` |
| Scalar — integer or decimal number | `purchase_price: 7200000` |
| Scalar — boolean | `human_review_required: true` |
| Scalar — null | `extension_id: null` (or `~`) |
| Empty inline sequence | `flags: []` |
| Mapping (top level) | `key: value` per line |
| Mapping (nested, one level) | indented two spaces under a `key:` line |
| Sequence | dash-prefixed items under a `key:` line |
| Comments | `# comment` to end of line |

### D.2 — Rejected

The following YAML features are NOT part of the subset and MUST cause the parser to throw `UNSUPPORTED_YAML_FEATURE`:

| Feature | Why rejected |
| ------- | ------------ |
| Anchors and aliases (`&name`, `*name`) | Implicit cross-references conflict with the explicit-provenance design; surprising round-trip behavior in editors. |
| Explicit tags (`!!str`, `!!int`, `!Custom`) | Type coercion is governed by the spec's field schemas, not YAML tag dispatch. |
| Block scalars (`\|`, `>`) | Multi-line literal scalars create ambiguous indentation rules and cause silent data loss when concatenated. |
| Flow-style mappings or non-empty sequences (`{a: 1}`, `[1, 2, 3]`) | The on-disk representation is meant to be diff-friendly and one-value-per-line. The empty inline sequence `[]` is the lone exception, since it is unambiguous. |
| Complex keys (`?` indicator) | Mapping keys must be simple scalars in `.uwx.md`. |
| Directives (`%YAML`, `%TAG`) | The format pins a single YAML dialect (this subset). |

### D.3 — Rationale

The format is intentionally minimal so a reader can be implemented in a few hundred lines without depending on a full YAML parser. Banning these features early — rather than allowing them and quietly producing wrong data — keeps cross-implementation behavior identical and prevents subtle round-trip bugs in editors that re-emit frontmatter.

If you need long-form prose in a section, put it in the markdown body (between fenced section blocks) or in a dedicated extension section, not in frontmatter.

---

*Specification version 1.1 | underwriter.cc | April 2026*  
*v1.0 → v1.1: Added §4.0 (Deal Context), §4.19 (Custom Calculations), §4.20 (Custom Scenarios), §4.21 (Extension Sections); expanded Appendix C; added universal `_notes` field and reference path notation.*  
*This document is itself a reference artifact. The canonical format for a deal is a `.uwx.md` file. This spec defines what valid means.*
