# .uwx.md — UW Markdown Extended Format Specification
## Format 3.0 | October 2026

Normative contract accepted in [RFC 0081](../docs/rfcs/0081-one-format-one-protocol.md), paired with Protocol 4.0.0 and core/CLI 4.0.0. Only `uw_version: "3.0"` is admitted. A reader MUST refuse an absent or different value at parse stage with `UNSUPPORTED_FORMAT_VERSION`, naming the declared value and the supported value; no partial read is permitted.

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
| **UW Lite** / `.uw.md` | A constrained, human-readable *summary*, specified separately in [`UW_LITE_SPEC.md`](UW_LITE_SPEC.md). Semantics come from `<!-- uw:path -->` anchors. Explicitly lossy. |

Where the Word analogy stops: `.doc` is a superseded predecessor, whereas **UW
Lite is neither older nor deprecated**. It is a current, deliberately lossy
*view* of a deal, with its own specification and its own job. UWX is what a deal
*is*; Lite is one way of showing it. The projection UWX → Lite MUST report every
path it omits ([RFC 0017](../docs/rfcs/0017-uw-lite-source-representation.md)).

Structured fences in a file named `.uw.md` MUST be refused with `SOURCE_CONTENT_MISMATCH`. Structured records use `.uwx.md`; `.uw.md` is the Lite representation.

---

### Conformance language

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
"**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**", "**MAY**", and
"**OPTIONAL**" in this document are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119). For
implementation requirements (what tools must *do* with these bytes), see
the companion [`UW_PROTOCOL.md`](UW_PROTOCOL.md).

### Section count

Part IV registers **36 numbered subsections (§ 4.0 – § 4.35)**:
21 standard data sections (§ 4.0 – § 4.20), the extension-section
meta-spec (§ 4.21) that defines the `x_` namespace for non-standard
content, the `gaps` inventory (§ 4.22), the mixed-use `components`
section (§ 4.23), the `capital_stack` section (§ 4.24), the
`lease_up_schedule` section (§ 4.25), the `cash_flow_series`
section (§ 4.26), the `distribution_waterfall` section (§ 4.27), and the
optional `reserve_accounts` section (§ 4.28), and official class sections (§ 4.29–§ 4.35).
When this and the protocol document refer to "the 21 standard
sections" they mean § 4.0 through § 4.20.

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

**Resolution-tagged assumptions.** Every assumption carries a resolution tag: `scenario_default | market_data | ai_extracted | user_override | investor_profile | agent_computed`. Users and reviewers always know whether a number came from AI, from market data, or from their own input.

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
uw_version: "3.0"                   # * format version
deal_id: "uw_YYYY_[hash8]"          # * globally unique deal identifier
deal_name: "string"                 # human label, e.g. "Parkview Apts — Phoenix"
created: "ISO8601"                  # * timestamp of file creation
last_modified: "ISO8601"            # * updated on every write
locale: "en-US"                     # display locale (RFC 0001); absent = en-US.
                                    # Governs chat/summary/report display ONLY —
                                    # content stays canonical (JSON numbers,
                                    # ISO dates, fraction rates). Registered
                                    # values: en-US, en-GB, de-DE, fr-FR,
                                    # ja-JP, zh-CN (starter guide §III.1a). An
                                    # unregistered value is LOC-01: display
                                    # renders are refused, never silently
                                    # produced in a different locale.
currency_code: "USD"                # optional document monetary identity
                                    # (RFC 0046); three uppercase ASCII letters.
                                    # It controls currency identity only; locale
                                    # still controls numeric separators. Absent
                                    # preserves the locale's conventional symbol.

# ── Property Identity ─────────────────────────────────────
property_address: "string"          # * full street address
city: "string"
state: "XX"                         # 2-char state code
zip: "string"
asset_class: "multifamily | office | retail | industrial | self_storage | hospitality | mixed_use | senior_housing | student_housing | land | data_center | manufactured_housing | <namespaced custom identifier, see §2.2a>"
asset_subtype: "string | null"      # e.g. "garden_style", "strip_center", "warehouse"
loan_type: "permanent | bridge | construction | value_add | refinance"
scenario: "stabilized_acquisition | ground_up_development | value_add | lease_up | house_flip | commercial_flip | property_conversion | land_banking"  # optional; null or reverse-DNS extension also admitted (§2.2b)

# ── Pipeline State ────────────────────────────────────────
# Layer keys correspond 1:1 to BANCROFT_LAYERS in the reference library.
# L3 is intentionally reserved for a future pre-structuring layer and is
# omitted; conforming files MUST NOT define L3_* keys. A layer key
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
provisional blocks (see Part III §3.4 `_meta.quality.provisional`) and
represents triage rather than commitment. The minimum content for
`scope` is a `property` section with at least an address, an asset
class, and one of `units` or `asking_price`; everything else MAY be
filled in from the fallback cascade (see the
[starter guide](../docs/starter/defaults-and-cascade.md#v7-fallback-cascade)). Advancing
past `scope` requires real documents, not better assumptions —
producers MUST re-stamp defaulted blocks with observed data before
setting `deal_stage: screening` or later.

### 2.2a Asset-class identifiers (RFC 0003)

`asset_class` is one of the twelve official builtin values **or** a
module-declared custom identifier.

```
asset_class := builtin | custom
builtin     := 'multifamily' | 'office' | 'retail' | 'industrial'
             | 'self_storage' | 'hospitality' | 'mixed_use'
             | 'senior_housing' | 'student_housing' | 'land'
             | 'data_center' | 'manufactured_housing'
custom      := segment ('.' segment){2,}
segment     := [a-z][a-z0-9_]*
```

The official builtin set grows by RFC with full standard and starter support. Every official class is builtin (RFC 0080); the namespaced extension space is for third-party private or unofficial classes. All namespaced ids ending in a builtin name, including `org.uwmd.data_center`, are refused by `INVALID-ASSET-CLASS-002`.

**Three segments minimum.** `com.data_center` reads as a namespace with
no owner, and two segments is where squatting on a short prefix starts
to look attractive. Reverse-DNS fixes ownership at the identifier, so
two implementations can never disagree about whose
`com.example.data_center` this is.

An identifier that is neither a builtin nor a well-formed custom
identifier is `INVALID-ASSET-CLASS-001` (error).

**Builtin names are reserved in the final segment.** A custom
identifier whose last segment equals a builtin name — say
`com.example.multifamily` — is `INVALID-ASSET-CLASS-002` (error). The
namespace already prevents *collision*, so this is stricter than
correctness requires; it is here because such an identifier reintroduces
exactly the ambiguity the closed enum removes, and because any host that
does suffix matching (a host bug, and one that will happen) would
conflate the two. `com.example.multifamily_senior` remains available and
says more.

**A namespaced class obliges the file to name its modules.** A document
whose `asset_class` is custom SHOULD carry a `modules` list naming what
declares it:

```yaml
asset_class: com.example.specialty_facility
modules:
  - id: com.example.datacenters
    version: ">=0.1.0 <1.0.0"
```

Each entry is an object with `id` and an optional semver-range `version`; an entry
of any other shape (for example a bare module id) names no module and is itself
`MOD-DEPENDENCY-UNDECLARED`. Omitting the list is
`MOD-DEPENDENCY-UNDECLARED` (**warning**, not error): the document is
well-formed, and a host that happens to hold the module reads it
correctly. The cost falls on every other reader, who can then say only
that something is missing and not what to load.

Resolution — what a host does when it encounters a custom class — is
Protocol §X.2. It is deliberately not in this document: the identifier
is a property of the file, while resolution depends on what a particular
reader has loaded.

### 2.2b Business-plan identity (`scenario`, RFC 0072)

`scenario` is an OPTIONAL single-valued description of the deal's business
plan / execution strategy. Absent or null makes no assertion. The standard
vocabulary is closed:

| Value | Business plan / execution strategy |
|---|---|
| `stabilized_acquisition` | Acquire an already stabilized income property and operate it without a material repositioning plan. |
| `ground_up_development` | Create new improvements through ground-up construction before sale or stabilized operation. |
| `value_add` | Reposition an existing property through improvements or operating changes. |
| `lease_up` | Execute initial or renewed leasing to bring an existing property to stabilized occupancy. |
| `house_flip` | Improve an existing home for resale rather than continuing rental operation. |
| `commercial_flip` | Improve or reposition an existing commercial property for resale rather than continuing operation. |
| `property_conversion` | Convert existing improvements to a different property use. |
| `land_banking` | Hold land for a future development or disposition opportunity without a current construction plan. |

New producers SHOULD use one standard plan or a reverse-DNS extension under
§2.2a's identifier grammar: `segment ('.' segment){2,}`, with
`segment := [a-z][a-z0-9_]*`. A scenario extension requires no module declaration;
it supplies no executable behavior. Preserve the whole identifier and do not
interpret its suffix as a standard plan.

Product/lease form, regulatory/capital program and acquisition circumstance
are independent of this axis. `deal_context.hold_strategy` (§4.0) states the
hold/exit strategy, not the execution plan; neither field implies the other.
The author states the plan and explains any composite strategy in narrative;
there is no automatic precedence among axes or inference of an unstated plan.
Stress tests, custom scenarios and analytical section variants keep their
separate meanings.

Any unlisted bare scenario value or non-null malformed structure receives `DQ-07` (warning). A reader MUST preserve it and MUST NOT reject or rewrite it solely for this reason. A value outside the standard vocabulary cannot identify an execution plan; readers do not infer one.

Scenario and subtype identity are **descriptive and routable only**. No
calculation, default, pack or underwriting behavior MAY depend on either
identity. Validation is limited to the structural/vocabulary guidance in
§5.4; identity does not change stage requirements or financial cross-checks.

### 2.2c Single-site BTR subtype (`asset_subtype`, RFC 0072)

Frontmatter `asset_subtype` and `property.asset_subtype` (§4.1) remain OPTIONAL,
open strings. This RFC defines only `build_to_rent`, scoped to frontmatter
`asset_class: multifamily`: a community of detached or attached homes
purpose-built to be leased by the home, on one site and under one loan.
Scattered-site single-family portfolios are outside this defined identity.
It asserts product identity; it introduces no loan-count or financial check,
new asset class, module or pack. Physical-form details can coexist in the
property fields and narrative.

For descriptive identity, frontmatter governs; the canonical property block's
subtype is a fallback when frontmatter is absent or null. If either carrier
states `build_to_rent` and both non-null carriers are present, they SHOULD
agree (`DQ-08`, warning); if either states it outside multifamily, warn
`DQ-09`. Neither carrier is rewritten. Renderers may retain section-local
display text; display preference does not override identity authority.
All other free subtype values retain their prior admissibility, with no new
agreement or class-scope checks and no corpus migration.

A stabilized BTR acquisition states independent axes:

```yaml
asset_class: multifamily
asset_subtype: build_to_rent
scenario: stabilized_acquisition
```

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
| `source` | `manual`, `agent/L0-01`, `system/calculations.ts`, etc. | Who wrote this block (actor grammar, §2.6) |
| `ts` | ISO8601 | Timestamp of this block |
| `v` | integer | Version number within this section (starts at 1) |
| `superseded` | `true` | Marks a block that has been replaced by a newer version |
| `variant` | string | For sections with multiple instances (e.g., `t12`, `t3`, `budget`) |
| `confidence` | `high`, `medium`, `low` | Quick confidence signal |

**Full example fence tag:**

```
```json uw:section=rent_roll source=agent/L0-01 ts=2026-04-24T10:12:00Z v=1 confidence=high
```

A Format 3.0 block body is an object containing section payload fields and reserved members. `_meta` is REQUIRED and MUST be the first key; `_role`, `_overrides` and `_notes` are OPTIONAL. Every other member is payload, including a member named `content`. The section id is stated in the fence annotation and `_meta.section`, never as a block member. A top-level `section_id` is refused with `META-01`.

The Document Envelope has a separate block structure: `{ annotation, content, prose? }`, where `content` is the complete fenced object. Conversion is mechanical because the annotation carries the section id.

### 2.5 The `_meta` Object

Every data block MUST carry `_meta` as its first key,
organized into four named sub-objects by concern:

```json
"_meta": {
  "section": "rent_roll",
  "provenance": {
    "source": "agent/L2-01",
    "resolution": "ai_extracted",
    "actor": "jared@example.com",
    "agent_id": "L2-01",
    "agent_version": "1.0.0",
    "timestamp": "2026-09-01T10:12:00Z",
    "notes": null
  },
  "quality": {
    "confidence": "medium",
    "human_review_required": true,
    "flags": [],
    "partial": false,
    "provisional": false
  },
  "lifecycle": {
    "revision": 1,
    "superseded": false
  },
  "integrity": {
    "input_hash": null,
    "content_hash": "3f0c2a9e5b7d14c86a1e2f9b0d4c7a35e8f61b2d9c0a7e4f3b5d81c6a2e9f07b",
    "parent_hash": null
  }
}
```

#### 2.5a Routing

| Field | Type | Description |
|---|---|---|
| `section` | string | REQUIRED section ID; MUST equal the fence annotation. `section_id` is not admitted. |

#### 2.5b `provenance` — who wrote this block, and how its values were resolved

| Field | Type | Req | Description |
|---|---|---|---|
| `source` | string | yes | The actor (§2.6 grammar, RFC 0031): `manual` or `<namespace>/<id>` with a registered namespace. The grammar is enforced (§2.6). |
| `resolution` | string | no | How the value was resolved — one member of the closed resolution vocabulary (§2.6). Orthogonal to `source`. |
| `actor` | nonempty string | yes | The principal that initiated the write. Distinct from `source`: `source` is the policy-vocabulary identity of the writer, `actor` is who asked for the write. No trimming, source grammar or attribution inference applies (RFC 0090). |
| `agent_id` | string\|null | no | Bancroft agent code, or `"wizard"`, `"engine"`, `"user"`. REQUIRED when `source` matches `agent/*`. |
| `agent_version` | string\|null | no | Version (semver) of the agent or tool that produced this block. |
| `timestamp` | T1B UTC-Z string | yes | When this block was written; exact reader domain below (RFC0094). |
| `notes` | string\|null | no | Free-text notes from the agent or user. |
| `market_data_ref` | object | cond. | REQUIRED under the canonical or any stated override `market_data_accepted` assertion (RFC0095). |
| `inherited_from` | object | cond. | REQUIRED under the canonical or any stated override `inherited_assumption` assertion (RFC0095). |

`market_data_ref` and `inherited_from` sit in `provenance`, not `integrity`:
each names *where a value came from*. For each distinct admitted block, the
corresponding carrier is REQUIRED when its tag occurs in own canonical
`provenance.resolution` **or any own resolution of an object entry in the stated
block-level `_overrides` array**, identically for both references. Invalid,
missing, unmatched, duplicate or shadowed paths do not erase an assertion.
A later assertion cannot retract an earlier one. Collapse matching assertions to
one obligation per block/carrier; do not select an effective leaf winner, fetch
references or infer asymmetry. Rejected canonical metadata/provenance/lifecycle
parents suppress descendants; independent sibling annotations are still assessed.

A stated carrier is a non-null non-array object even without a matching tag.
For `inherited_from`, require `document_id:string`, `digest` exactly `sha256:`
plus64 lowercase ASCII hexadecimal digits, and `distance` a finite integral JSON
number at least1 (no new maximum; booleans are not numbers). For `market_data_ref`,
require `document_id:string`, `as_of` in the domain below and the same exact
digest; optional `rationale` is a string. Unknown children remain admitted;
`document_id` and `rationale` have no nonempty constraint. Present null is invalid.

`market_data_ref.as_of` consumes the whole string: exactly ASCII `YYYY-MM-DD`,
four year digits, two month digits, two day digits and literal hyphens. Years
are0001–9999; month/day follow the proleptic Gregorian calendar (leap if divisible
by400 or divisible by4 but not100). No trimming, normalization, offsets, time
components, Unicode digits or year zero. This date-only domain is distinct from
RFC0094 T1B. A missing required carrier produces one parent META-06; an admitted
carrier missing as_of produces one child META-06. Carrier shape errors suppress
its children. Lexical reference validation does not authenticate external data.

#### 2.5c `quality` — how trustworthy or complete the data is

| Field | Type | Req | Description |
|---|---|---|---|
| `confidence` | enum | yes | `high` / `medium` / `low`, as §3.2. |
| `human_review_required` | boolean | yes | See §3.3. |
| `flags` | string[] | no | Flags raised by this specific block. |
| `partial` | boolean | no | See §3.4. When true, `_overrides` (§2.5f) SHOULD enumerate which paths and why. |
| `provisional` | boolean | no | See §3.4. |

Per-field exceptions are stated only in block-level `_overrides` (§2.5f).
Present `flags` MUST be an array with string elements; present `partial` and
`provisional` MUST be booleans. A present `quality.field_overrides`, regardless
of value, is forbidden. These are closed META-05/error predicates (RFC0095).

#### 2.5d `lifecycle` — where this block sits in the supersede chain

| Field | Type | Req | Description |
|---|---|---|---|
| `revision` | integer ≥ 1 | yes | 1-based supersede-chain position; monotonically increasing per section per file. |
| `superseded` | boolean | yes | True on every block that is not the chain head (a newer revision exists in this file). |

#### 2.5e `integrity` — cryptographic / structural verification (all optional)

| Field | Type | Description |
|---|---|---|
| `algorithm` | `"sha256"` | Hash algorithm for the three hash fields. **Absent means `sha256`**, and `sha256` is the only admitted value — the field exists for forward agility, not present choice (RFC 0009 resolved question 2). The entire `_meta` object is outside the block digest. |
| `input_hash` | string\|null | Hash of the inputs that produced this block: a reproducibility anchor. |
| `content_hash` | string | SHA-256 of JCS of the fenced object with its `_meta` member removed (Protocol §V.9). |
| `parent_hash` | string\|null | The `content_hash` of the superseded predecessor; null on a chain root. |
| `signature` | object | See §3.4 and Protocol §V.11 (RFC 0010). |

The whole sub-object is optional: integrity remains opt-in.

---

#### 2.5f The `_overrides` block annotation


Per-field exceptions to the block-level metadata are stated in a
top-level block annotation, a sibling of `_meta`:

```json
{
  "_meta": { "section": "rent_roll", "provenance": { "source": "manual", "actor": "analyst", "timestamp": "2026-10-11T00:00:00Z" }, "quality": { "confidence": "high", "human_review_required": false }, "lifecycle": { "revision": 1, "superseded": false } },
  "_overrides": [
    {
      "path": "units[7].current_rent",
      "confidence": "low",
      "resolution": "ai_extracted",
      "reason": "illegible"
    }
  ]
}
```

Each entry states a dot-notated `path` relative to the block's payload root
and MAY carry its own `confidence`, `source` (actor, §2.6 grammar),
`resolution` (closed vocabulary, §2.6), `reason` and `note`. `reason` is a
closed vocabulary: `illegible | missing | overridden | estimated | computed`.
The
precedence rule is unchanged and remains as RFC 0031 stated it: `_overrides`
wins for the paths it covers — `confidence`, `source`, and `resolution`
alike — `_meta.quality` / `_meta.provenance` apply elsewhere.

`_overrides` is **block content for integrity purposes**: it is inside the
digest, including every stated override.

**Closed optional admission (RFC0095).** A present `_overrides` MUST be an array;
each entry MUST be a non-null non-array object with an own string `path`.
Present confidence is high/medium/low, reason is one of the five values above,
and note is a string. No path parser, target-existence, nonempty or uniqueness
constraint is added; unknown members remain admitted. META-05/error applies in
container/entry/path/confidence/reason/note order. Source/resolution keep their
SRC-01/02/03 ownership. Sibling `_overrides` is assessed even when `_meta` is
missing or rejected; invalid containers/entries must not crash later validators.
Optional provenance agent_id/agent_version/notes are string-or-null. A valid
canonical agent source requires an own agent_id member (META-06 if absent);
null/empty strings satisfy presence, wrong types receive META-05 only. No actor
inference, source-suffix comparison or new identity/version grammar is imposed.
Complete metadata ordering, parent precedence and physical/current MODEL
accounting are defined in Protocol §III.6a; META-01–04 and absence warnings remain
unchanged. DQ-06/info is stage readiness only; it emits no attribution duplicate.

---

A `_meta` without nested `provenance` and `lifecycle` is `META-01`. The provenance-completeness codes remain `META_MISSING`, `META_FIELD_MISSING_<FIELD>` and `META_LOW_CONFIDENCE_NO_REVIEW_FLAG`.

**Bounded metadata admission (RFC0093).** After existing wrapper/nested-shape
admission, each of the following yields one `META-01`/error per distinct retained
physical or model-only block, in this order: present top-level `_meta` not first
(field `_meta`); present `_meta.section` not a nonempty string exactly equal to
the admitted annotation section (field `_meta.section`); required `_meta.quality`
absent, null, array or scalar (field `_meta.quality`). Complete the entire new
pass after existing shape findings and before all actor and boolean findings.
Protocol §III.6a defines exact source/model order, identity union and transport.

Fresh structured JSON source uses lexical decoded top-level member order,
including escaped names and authored numeric-key placement. Mutable models use
current own enumerable non-array-index string-member order; array-index names
are exactly canonical unsigned decimal spellings0 through4294967294. Their
original position is not recoverable from ordinary model enumeration. Never
reparse stale raw text or substitute convenience metadata for current content.
Other representations retain their accepted compilation/model path, including
UW Lite; no authored fenced-JSON order is attributed to generated blocks.

Whole missing metadata and existing rejected wrapper/provenance/lifecycle shape
keep their earlier precedence without these additional errors. Absent section
keeps its warning without the present-invalid-section error. Placement/section
errors do not suppress actors or admitted-parent booleans; missing/nonobject
quality suppresses only META-02. An empty quality object is admitted: confidence
completeness and missing human_review_required remain independently assessed.
Matching unknown nonempty sections pass; do not trim, normalize, coerce or infer
values. No other metadata-schema requirement receives a diagnostic allocation.

**Required actor admission (RFC 0090).** After existing
wrapper/nested-shape precedence, an absent, null, exact-empty or non-string
canonical `_meta.provenance.actor` produces one `META-01`/error with field
`_meta.provenance.actor`. Any nonempty string passes; validators MUST NOT trim,
apply `source` grammar, infer or insert a principal. A whole missing `_meta`,
a retired `section_id` wrapper, or malformed `_meta`/nested `provenance` or
`lifecycle` retains its existing handling without an additional actor error.
Apply the exact existing wrapper/nested-object predicate also to previously
unseen retained physical blocks; newly exposed shape findings precede actor
findings. This explicit source-accounting correction does not allocate other
metadata-schema failures to `META-01`.

Source validation MUST account for every retained physical structured block
before routing/reduction, including superseded, overwritten, append-only,
variant and extension blocks. This does not change current selection or grant
history authority. Mutable-model assessment instead uses retained parser block
references plus current model-only blocks, deduplicated by exact identity;
models without that inventory assess only supplied collections and cannot claim
complete physical-source coverage. `raw` MUST NOT be silently reparsed as an
alternative authority. Canonical inline `_meta` supplies the actor predicate;
a divergent convenience meta alias cannot repair it. Fresh-source conclusions
require a fresh parse of the exact operation input. Protocol §III.6a defines
ordering; RFC 0090 defines the precise model boundary.

**Required boolean admission (RFC0091).** An absent, null or nonboolean
canonical `_meta.quality.human_review_required` is `META-02`/error; the same
condition at `_meta.lifecycle.superseded` is `META-03`/error. Literal true and
false are valid without coercion or inferred defaults. Apply these predicates
to every retained physical block, including historical and otherwise unselected
blocks, and to supplied model-only blocks using the actor authority/identity
boundary above. Whole-missing-meta and existing wrapper/nested-object shape
precedence suppress child findings; a missing/nonobject quality container
suppresses only META-02. An actor-only error does not suppress either flag.
Existing completeness rules and META-01 retain their scope. Protocol §III.6a
defines exact attribution and ordering; these allocations do not extend to
other missing or malformed metadata members.

**Present-invalid metadata leaves (RFC0094).** After the complete META-02/03
pass, emit one `META-04`/error for each present invalid canonical leaf, per block
in this order: `_meta.quality.confidence` must be exactly `high`, `medium` or
`low`; `_meta.lifecycle.revision` must be a finite integral number at least1;
`_meta.provenance.timestamp` must satisfy T1B below. Numeric1.0 and1e0 are
integer1; booleans are not integers. No new safe-integer maximum, chain rule or
fraction-length limit is imposed.

T1B is exactly `YYYY-MM-DDTHH:mm:ss[.digits]Z`: ASCII digits, four-digit year0000
through9999 and a valid proleptic Gregorian date, hour00–23, minute/second00–59,
uppercase T/Z and optional nonempty ASCII fraction. Gregorian leap years are
divisible by400 or divisible by4 but not100, including year0000. Consume the
entire string. Offsets (including zero), lowercase, whitespace, second60 and
normalization are refused; no clock or leap-second lookup supplies admission.
This profile applies to the canonical provenance timestamp only.

Use the same all-retained-physical plus current model-reference identity union
and SOURCE/MODEL/composition authority as above. Complete every shape, actor and
boolean pass before this complete leaf pass, and keep role/period/source checks
later. Within each block confidence precedes revision, then timestamp. Attribute
each finding to its exact canonical field and block section. Rejected old whole
metadata/provenance/lifecycle shape suppresses descendants; absent/nonobject
quality suppresses only confidence. Placement/section, actor and boolean errors
do not suppress independent leaves. An absent leaf gains no META-04; existing
completeness warning predicates, populations and order remain, including any
warning that also applies to present null. No default, coercion, repair or
generic schema fallback is permitted. Optional metadata and conditional
references remain outside this closed allocation. Protocol §III.6a defines
transport and resulting validation/receipt-policy accounting.

### 2.6 Source Identifiers

`_meta.provenance.source` names the actor: `manual` or `<namespace>/<id>`, where namespace is one of `agent`, `document`, `system`, `institution`, and id matches `[A-Za-z0-9][A-Za-z0-9._-]*`. `/` is the sole delimiter. Examples: `agent/L0-01`, `document/om.pdf`, `system/calculations.ts`, `institution/threshold-override`. An out-of-grammar source is `SRC-01` (error); a resolution tag in that field is `SRC-02` (error). Readers never interpret a resolution as an actor or move it between fields.

`_meta.provenance.resolution` is OPTIONAL and describes how values were resolved. It MUST be one member of this closed vocabulary; any other value is `SRC-03` (error). `manual` is actor-only; human-typed values use `user_input`.

| Tag | Meaning |
|---|---|
| `user_input` | The user typed the value (initial entry). |
| `user_override` | The user explicitly overrode a prior value. |
| `inherited_assumption` | Inherited from an ancestor in the composition DAG ([starter guide §V.7.1](../docs/starter/defaults-and-cascade.md#v71-inherited-assumptions)). |
| `investor_profile` | Resolved from the active investor profile / buy box. |
| `market_data` | Resolved from a market-data lookup at write time. |
| `market_data_accepted` | A market observation an analyst explicitly accepted as the underwritten value (RFC 0022 §4). |
| `ai_extracted` | Extracted from a source document by an AI agent. |
| `agent_computed` | Computed by an agent from prior agent outputs. |
| `asset_class_default` | Pulled from the published asset-class default table for the deal's asset class. |
| `scenario_default` | A value derived from a named analytical scenario in this file or institution config; never selected by frontmatter `scenario` (§2.2b). |
| `global_default` | Pulled from a non-asset-class fallback table. |
| `system_default` | Hardcoded constant in the reference library or institution config. Producers SHOULD avoid relying on this layer for normative values. |

Block-level source and resolution also have leaf counterparts in `_overrides`. Defaults and their precedence are starter-product behavior, described in [the starter guide](../docs/starter/defaults-and-cascade.md); these tags record provenance and do not authorize inference by a verifier. The cascade tags are nonetheless normative for cascade resolution: a producer stamping a value resolved by the fallback cascade MUST use the tag of the cascade step that produced the value ([starter guide §V.7](../docs/starter/defaults-and-cascade.md#v7-fallback-cascade) holds the authoritative step table).

Both fields MAY be present; they answer different questions. A block
written by agent L6-01 from the asset-class default table carries
`"provenance": { "source": "agent/L6-01", "resolution": "asset_class_default", ... }`.

### 2.7 Update Semantics

When an agent or tool updates a section, it:

1. Locates the most recent non-superseded block for that `uw:section`
2. Sets `"superseded": true` in that block's `_meta.lifecycle` and in the fence tag
3. Appends a new block with `lifecycle.revision = previous_revision + 1`

This means the file grows; history is always recoverable. The canonical current value of any section is the **last block** where `_meta.lifecycle.superseded === false` for that `uw:section`.

The `uwmd compact` command strips superseded blocks and leaves only current versions.

### 2.8 Multi-Variant Sections

Some sections have multiple valid instances at the same time (not superseded, just parallel):

- `operating_statement` — may have `t12`, `t3`, `budget`, `ytd` variants
- `stress_tests` — may have named scenarios
- `due_diligence` — sub-documents (appraisal, environmental, title) are separate sub-sections

For multi-variant sections, the fence tag carries a `variant=` key:

```
```json uw:section=operating_statement variant=t12 source=agent/L0-02 ts=... v=1
```

Parsers collect non-superseded variants by their declared variant keys.

**Signed block roles (RFC 0040).** Any active block MAY carry one optional
`_role` beside `_meta`, drawn from `primary`, `senior`, `junior`, `summary`,
`detail`, `component`. This scalar is content covered by the existing block
hash, not provenance metadata; `_meta.role` is not an alias. Primary names the
generic statement, senior/junior the debt position, detail/summary its level
of aggregation, and component a part of the property. Roles are allowed on
any section, including a standalone block. Invalid values (including null or
arrays) MUST raise `ROLE-01` in every active block. Superseded history is not
reclassified. Only a trusted host or explicit human assignment may set a role;
agent content MUST NOT invent it. See §5.3 for selection and Protocol §V for
editing. Parse and representation conversion MUST preserve this annotation.

---

**Markdown opt-in.** When an active section declares `_role` and has explicit
`variant=` fences, readers collect all its active named variants, even outside
the standard multi-variant section registry. Collect before choosing a version,
so fence order cannot discard an unannotated peer. Superseded roles do not
activate selection. Role-free Markdown retains its existing routing behavior;
removing a section's last role ends this opt-in. UW JSON envelopes already
represent variant maps on every section.

---

## Part III — Provenance Model

### 3.1 Assumption Source Hierarchy

Assumption resolution precedence is non-normative starter-product guidance in [defaults and cascade](../docs/starter/defaults-and-cascade.md). The `assumptions` section (§4.16) records stated methods; a verifier checks stated facts without producing missing ones.

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

The nested fields of §2.5 are optional except where explicitly required. A
block omitting an optional field is well-formed; validators MUST NOT reject a
block for its absence.

| Field | Type | Meaning |
|---|---|---|
| `_meta.quality.partial` | boolean | The block is present but at least one field inside it is missing or unknown. When `partial: true`, an enumeration of which paths and why SHOULD be provided in `_overrides` (§2.5f). |
| `_meta.quality.provisional` | boolean | The entire block is a placeholder, derived from defaults rather than observed data. Stronger signal than `confidence: "low"`. Downstream consumers SHOULD label outputs derived from provisional blocks accordingly. |

Leaf exceptions belong only to block-level `_overrides`. **Precedence:** an
`_overrides` entry whose `path` matches a field replaces, for that field only,
the block-level `confidence`, `source` and `resolution`; the block-level values
still apply to every field not enumerated. **Path syntax:** paths use dot
notation with bracketed array indices, such as `units[7].current_rent`; keys
containing a literal `.` are not expressible, and no section schema uses
dotted keys.

`_meta.integrity.content_hash` is lowercase hexadecimal SHA-256 of the UTF-8 RFC 8785 (JCS) canonical JSON of the fenced object **with its `_meta` member removed** (Protocol §V.9). All other members, including `_role`, `_overrides`, `_notes`, and any payload member named `content`, are included. Nothing else is excluded or defaulted. Metadata-only changes keep the hash; payload edits change it.

`parent_hash` is the predecessor's `content_hash`, or null at a chain root. Once any block in a supersede chain carries `content_hash`, every later block in that chain MUST carry both `content_hash` and `parent_hash`. **Integrity opt-in:** a file containing no `content_hash` is unchecked, and chain verification is a no-op. A producer that adopts the integrity path SHOULD stamp `content_hash` on every block it writes.

`signature` is optional: `{ alg, kid, sig, signed_at, v? }`, with `alg` one of `ed25519`, `es256`, `es384`, `sig` unpadded base64url and `signed_at` an ISO timestamp. It requires `content_hash` (`INT-05`). The signing input is unchanged (Protocol §V.11): content hash, section, actor, timestamp, kid and signed_at. It binds author and time to content, but does not transitively bind `parent_hash`. **Signing opt-in:** a signature is meaningful only where `content_hash` is stamped, and reading, validating and computing over a document never require cryptography. A consumer with no key store MUST treat a signature as opaque metadata and MUST report it as present but unchecked, never as verified (Protocol §V.11.3).

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

**Explicit period references (RFC 0041 / Protocol §VIII.2a):** safe calc
expressions and `resolvePeriodPath` can address a registered series by identity,
for example `dcf.annual_cash_flows@Y3.net_operating_income`. Holding years,
absolute months/quarters and dates remain distinct. Generic object paths and
metadata pointer strings retain their existing literal-key semantics. The
protocol defines duplicate refusal, variant context and PS-01/02/03 diagnostics.
No field is moved and no period is inferred from row position.

---

### § 4.0 — Deal Context

**ID:** `deal_context`  
**Header:** `## Deal Context {#deal_context}`  
**Purpose:** The narrative layer. Describes the deal in plain language — what it is, why it's being considered, what the goal is, and any special circumstances that a structured underwriting model cannot capture. This section is the first thing an AI assistant reads to orient itself. It is the only section the user is always expected to write in their own voice.  
**Written by:** `wizard` (structured form fields), `user` (free narrative prose), `agent/L7-01` (AI-synthesized summary — appended as a second block, never replaces user narrative)  
**Required for pipeline stage:** All stages (prose block optional; structured block required for screening+)  
**Dependencies:** None

The Deal Context section has two distinct layers:

1. **User-authored narrative** — written in the prose block, before the data block. No format requirements. Can be one sentence or several paragraphs. This is where the user explains the story of the deal: the relationship context, the market timing, the specific constraint they're working within, the reason they're looking at this asset class, the gut feeling that brought this deal to the table. No schema can capture this — it lives here.

2. **Structured data block** — the machine-readable distillation of that context into typed fields. Tools route on these fields, AI assistants read them to calibrate their analysis, and the render engine uses them to frame the output package.

The `ai_synthesis` sub-object is populated by `agent/L7-01` after the full underwriting runs. It summarizes what the data actually shows in one paragraph, identifies strengths and risks from the model's perspective, and gives an overall impression. It is appended as a separate versioned block — the user's narrative is never touched.

```json uw:section=deal_context source=manual ts=ISO8601 v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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

`asset_subtype` remains an open descriptive string. The defined single-site
`build_to_rent` identity and frontmatter/property agreement rules are in §2.2c.
Frontmatter governs identity; the canonical property value supplies an absent/null
frontmatter fallback. Other free values are unchanged.

**ID:** `property`  
**Header:** `## Property {#property}`  
**Purpose:** Physical asset description, identity, and condition.  
**Written by:** `wizard:step_1`, `wizard:step_2`, `agent/L1-01` (normalizes)  
**Required for pipeline stage:** All stages  
**Dependencies:** None

```json
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
  "rentable_square_feet": null,
  "gross_leasable_area": null,
  "net_rentable_square_feet": null,
  "rentable_units": null,
  "keys": null,
  "total_beds": null,
  "gross_acres": null,
  "usable_acres": null,
  "entitled_units": null,
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

**Size intensives (RFC 0027).** A property block MUST state the size intensive
its asset class uses (the **primary size field**, per Protocol §XIII.1). It MAY
state any of the others. A field that does not apply to the asset class SHOULD
be `null` or absent rather than zero, because zero is a quantity and a
denominator, not an absence. Validated by `CC-13` (§5.3) as a warning.

Field notes:

- `rentable_square_feet` — rentable area (RSF); the primary size field for
  `office` and `industrial`.
- `gross_leasable_area` — GLA in square feet; the primary size field for
  `retail`.
- `net_rentable_square_feet` — NRSF; the primary size field for
  `self_storage`.
- `rentable_units` — the storage-unit count; a self-storage secondary.
- `keys` — the room count; the primary size field for `hospitality`.
- `total_beds` — the bed count; the primary size field for `student_housing`
  and a secondary for `senior_housing`.
- `gross_acres` / `usable_acres` — the deal's own size for a `land` deal;
  `usable_acres` nets out what cannot be built on. **Not synonyms for the
  existing `land_area_acres`**, which is the parcel a *building* sits on — a
  detail field on an improved property. A land deal SHOULD state
  `gross_acres` / `usable_acres` and SHOULD NOT restate them as
  `land_area_acres`.
- `entitled_units` — units the entitlement permits; a `land` secondary.
- `total_units` on senior and student housing: both classes carry two counts.
  Senior housing sizes per unit and also states beds; student housing sizes
  per bed and also states units. Both figures are legitimate; Protocol §XIII.1
  says which one is the denominator.

---

### § 4.2 — Ownership & Acquisition

**ID:** `ownership`  
**Header:** `## Ownership & Acquisition {#ownership}`  
**Purpose:** Current ownership, acquisition terms, entity structure, existing debt.  
**Written by:** `wizard`, `agent/L2-CRE-11`  
**Required for pipeline stage:** Underwriting and beyond  
**Dependencies:** None

```json
{
  "_meta": {
    "section": "ownership",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `agent/L0-01`, `wizard:step_3` (simplified version)  
**Variants:** `multifamily` (default), `commercial`  
**Required for pipeline stage:** Screening and beyond  
**Dependencies:** `property`

#### Multifamily Variant

```json
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
  "occupied_beds": null,
  "preleased_beds": null,
  "preleased_as_of": null,
  "preleased_term_start": null,
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

**Student-housing bed counts (RFC 0069).** `occupied_beds`, `preleased_beds`,
`preleased_as_of` and `preleased_term_start` are OPTIONAL. They are meaningful
when `asset_class` is `student_housing`; other classes SHOULD leave them `null`
or absent. Student housing leases by the bed and re-leases nearly its whole roll
on one date, so the roll carries two bed counts measured on different dates.

- `occupied_beds` (integer, ≥ 0) — beds under a lease in place as of the roll's
  `as_of_date`.
- `preleased_beds` (integer, ≥ 0) — beds under a signed lease for the academic
  term that begins on `preleased_term_start`, counted as of `preleased_as_of`.
- `preleased_as_of` (`YYYY-MM-DD`) — the date `preleased_beds` was measured.
- `preleased_term_start` (`YYYY-MM-DD`) — the first day of the term
  `preleased_beds` describes. The term is in the future relative to
  `preleased_as_of`, not relative to the date a tool reads the file.

The fields describe the top-level `rent_roll` only:

- They do not extend to `senior_housing`, which also states `total_beds`
  (§4.1).
- They give a `student_housing` component of a `mixed_use` deal (§4.23) no
  bed-count semantics.
- A class other than `student_housing` that states them draws no issue for
  doing so. The rules below still apply to what it states.

The fields are optional as a group. A roll may omit either count, and with
`preleased_beds` the whole pre-leasing tuple. A count that is stated is a
complete typed fact only with its measurement date:

- A stated `occupied_beds` MUST be accompanied by the roll's `as_of_date` as a
  real date.
- A stated `preleased_beds` MUST be accompanied by both `preleased_as_of` and
  `preleased_term_start`.

The two counts are **stated, never derived**. Pre-leasing never sets occupancy,
neither count is inferred from the other, and no rule compares the two.
`property.total_beds` (§4.1) remains the size field and the denominator of
every per-bed metric (Protocol §XIII.1). Neither count may exceed it, including
for capacity a later phase will deliver. Future-phase capacity needs its own
explicit representation, which this section does not define.

An absent count is not an issue. A roll that omits a count draws no `BED-*`
issue for it, and a pack metric over an absent count resolves to `null`
(Protocol §VIII.2). Stage requirements for absent facts belong to
incomplete-data policies, not to this family. A pre-leasing date stated without
`preleased_beds` is inert context. It must still be a real date, and the pair
must still be in order, but it requires nothing else. Every rule compares
stated values with each other, never with the current date or file metadata.

- `BED-01` — **error** when a stated `occupied_beds` or `preleased_beds` is not
  a finite, nonnegative integer. This is checked whether or not
  `property.total_beds` is stated.
- `BED-02` — **error** when a valid `occupied_beds` or `preleased_beds` exceeds
  `property.total_beds`. The comparison runs only when `property.total_beds` is
  a finite number. Otherwise only this comparison is skipped; `CC-13` already
  reports an absent or non-numeric primary size field.
- `BED-03` — **error** when `occupied_beds` is stated and the roll's
  `as_of_date` is absent or not a real `YYYY-MM-DD` date.
- `BED-04` — **error** when `preleased_beds` is stated and `preleased_as_of` or
  `preleased_term_start` is absent.
- `BED-05` — **error** when a stated `preleased_as_of` or
  `preleased_term_start` is not a real `YYYY-MM-DD` date. This is checked
  whenever the date is stated, with or without `preleased_beds`.
- `BED-06` — **error** when both pre-leasing dates are real and
  `preleased_as_of` is on or after `preleased_term_start`. A count measured on
  or after the day the term began describes occupancy, not pre-leasing.

#### Commercial Variant

```json
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
      "escalation_schedule": [
        { "effective_date": "YYYY-MM-DD", "base_rent_annual": 0.0 }
      ],
      "renewal_options": [
        {
          "count": 0,
          "term_years": 0,
          "notice_months": null,
          "rent_reset": "fair_market | fixed | cpi | null"
        }
      ],
      "termination_option": {
        "earliest_date": "YYYY-MM-DD",
        "notice_months": 0,
        "penalty": null,
        "penalty_includes": ["unamortized_ti | unamortized_lc | free_rent | fee"],
        "conditions": null
      },
      "co_tenancy_clause": false,
      "co_tenancy_details": {
        "trigger": "named_tenant_departure | occupancy_threshold | both",
        "named_cotenants": [],
        "occupancy_threshold": null,
        "remedy": "rent_reduction | alternate_rent | termination_right",
        "remedy_value": null,
        "cure_period_months": null
      },
      "ti_allowance_original": null,
      "ti_outstanding_balance": null,
      "lc_original": null,
      "lc_outstanding_balance": null,
      "rofo": false,
      "rofr": false,
      "assignment_subletting": null,
      "personal_guarantee": false,
      "guarantee_amount": null,
      "guarantee_type": "personal | corporate | both | null",
      "anchor_tenant": false,
      "recovery_terms": {
        "method": "net | base_year_stop | fixed_stop | fixed_amount | none",
        "pro_rata_share": 0.0412,
        "share_basis": "nra | gla | stated | null",
        "base_year": null,
        "expense_stop_per_sqft": null,
        "fixed_recovery_annual": null,
        "admin_fee_pct": null,
        "gross_up_pct": null,
        "recoverable_pool": ["real_estate_taxes", "insurance", "contract_services"],
        "cap": {
          "pct": 0.05,
          "over": "base_year | prior_year",
          "accumulation": "cumulative | non_cumulative | compounding"
        }
      },
      "recovery_true_up": [
        {
          "period_start": "YYYY-MM-DD",
          "period_end": "YYYY-MM-DD",
          "pool_actual": 0.0,
          "tenant_share_uncapped": 0.0,
          "tenant_share_capped": 0.0,
          "estimated_billed": 0.0,
          "true_up_amount": 0.0,
          "settlement": "billed | credited | disputed | unsettled",
          "cash_flow_ref": null
        }
      ],
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

**Expense recoveries and the CAM true-up (RFC 0058).** `recovery_terms` and
`recovery_true_up` are OPTIONAL. A tenant stating neither adds no requirement. A cap may be stated alone; method is required as soon as any other member of recovery_terms is stated non-null. A lone `cap` needs neither `over` nor `accumulation`. Rules reading method evaluate only when it is stated. A nullable optional member stated as `null` is not stated: it neither satisfies nor triggers a group requirement (the `ESC-04` absent/null equivalence). Like the RFC 0055 clauses these are
**attributes of a lease** plus a reconciliation of a **closed** period — not a
periodic ledger, which RFC 0054 placed behind a named consumer.

Two figures are deliberately **stated, not recomputed**. The capped amount,
because a `cumulative` or `compounding` cap depends on a base-year history no
single document carries — recomputing it from one year would produce a confident
wrong number, so `REC-07` checks only the direction a cap can move. And the
allocation of a pool across tenants, because that needs a policy for vacant space
and is a modeling decision, not a recorded fact; each tenant states its own share.

- `REC-01` — `pro_rata_share` is a fraction in `(0,1]` and `cap.pct` a fraction
  in `(0,1)`. `0.0412` is 4.12%. A share stated as a percent multiplies every
  recovery by a hundred, which is why this is an error and not a warning.
- `REC-02` — the `method` vocabulary is closed, and `base_year_stop`,
  `fixed_stop` and `fixed_amount` each REQUIRE their input (`base_year`,
  `expense_stop_per_sqft`, `fixed_recovery_annual`). Once `method` is stated, a stated `cap.pct` REQUIRES
  `cap.accumulation`: there is **no default**, because `cumulative`,
  `non_cumulative` and `compounding` diverge materially inside three years.
  A lone `cap` with no `method` is the G1 lone fact and is valid without
  `accumulation`; REC-02 does not reach it (RFC 0081 G1).
- `REC-03` — every `recoverable_pool` entry names a § 4.4
  `operating_statement.expenses` key. `total_operating_expenses` (a total),
  `management_fee_pct_egi` (a ratio), `capital_expenditures_actual` and
  `replacement_reserves` (capital, not operating) are not members. A pool naming
  a nonexistent expense recovers zero without saying so.
- `REC-04` — a true-up row states `period_start` and `period_end` as real dates
  with the end on or after the start, and any `settlement` from the closed
  vocabulary.
- `REC-05` — `period_end` is strictly before the rent roll's `as_of_date`. A
  reconciliation of an open period is a forecast, and this section carries
  settled facts. The check is anchored on `as_of_date` and **skipped when it is
  absent** — never on file metadata, which is an edit timestamp and would refuse
  a legitimately re-saved document.
- `REC-06` — `tenant_share_uncapped` equals `pool_actual × pro_rata_share` at
  the currency quantum, when all three are present.
- `REC-07` — `tenant_share_capped` does not exceed `tenant_share_uncapped`.
- `REC-08` — `true_up_amount` equals `tenant_share_capped − estimated_billed` at
  the currency quantum. A negative amount is a credit the tenant is owed.
- `REC-09` — a stated `cash_flow_ref` names a § 4.26 `cash_flow_series` variant
  that exists in this document. This is the cross-cutting requirement that new
  dated cash lands in the addressable sink, where assembly and receipt coverage
  already verify it. A dangling reference is the one failure that looks like
  success: the row claims the settled amount reached the cash flows, and nothing
  else checks that it did.


**Closed recovery payload admission (`REC-11`, RFC0096).**

On every object tenant in a current
rent_roll, optional nullable recovery_terms/recovery_true_up retain their
existing parent admission owners. Allocate only these additional predicates:

| Field | Predicate when present and non-null |
|---|---|
| recovery_terms.share_basis | exactly nra, gla or stated |
| recovery_terms.base_year | integer |
| recovery_terms.expense_stop_per_sqft | finite >=0 |
| recovery_terms.fixed_recovery_annual | finite >=0 |
| recovery_terms.admin_fee_pct | finite [0,1) |
| recovery_terms.gross_up_pct | finite (0,1] |
| recovery_terms.cap.over | exactly base_year or prior_year |
| recovery_terms.cap.accumulation | exactly cumulative, non_cumulative or compounding; REC-02 owns the conditional case M and P defined below, otherwise invalid present non-null values receive REC-11 |
| recovery_true_up[i].pool_actual | finite >=0 |
| recovery_true_up[i].tenant_share_uncapped | finite >=0 |
| recovery_true_up[i].tenant_share_capped | finite >=0 |
| recovery_true_up[i].estimated_billed | finite >=0 |
| recovery_true_up[i].true_up_amount | finite, signed |

The three closed objects are recovery_terms (method, pro_rata_share,
share_basis, base_year, expense_stop_per_sqft, fixed_recovery_annual,
admin_fee_pct, gross_up_pct, recoverable_pool, cap), cap (pct, over,
accumulation), and each true-up row (period_start, period_end, pool_actual,
tenant_share_uncapped, tenant_share_capped, estimated_billed, true_up_amount,
settlement, cash_flow_ref). Extra own members receive REC-11 at the exact child.
No new inner closed structure is imposed on cash_flow_ref.

Already owned and excluded: REC-01 share/cap fractions; REC-02 terms/cap
carrier, closed method, required selected-method companion and applicable
accumulation; REC-03 pool container/nonempty/member vocabulary; REC-04 true-up
carrier/row/date/settlement; REC-05 closed-period admission; REC-06/07/08
financial ties/direction; REC-09 cash-reference carrier/selection. A present
wrong companion type/bound (for example base_year=bad with base_year_stop) is
REC-11; absence/null of the required companion remains REC-02. A coarse WIP
REC-02 parent finding does not establish ownership of an unrelated child.
REC-11 does not reallocate or tighten REC-04's accepted calendar contract.

#### Exact cap accumulation ownership and null precedence

For an admitted recovery_terms and cap object, let M mean an own method member
whose value is not null, and P mean an own cap.pct whose value is not null.
These are presence predicates, not inferred values or successful enum/number
admission. Validate method and pct independently under their existing owners.

- If M and P, REC-02 owns accumulation: absent, null or outside the three-string
  vocabulary gives exactly one REC-02 at cap.accumulation. REC-11 MUST NOT
  duplicate that same condition. An invalid pct also keeps its independent REC-01.
- Otherwise accumulation is optional/nullable. Absent/null gives no accumulation
  finding; a present non-null value outside the vocabulary gives REC-11 once.
- A present method:null remains its own REC-02 type error under the non-nullable
  enum/S6 qualification. It does not make M true. Nullable companion nulls neither
  require a method nor satisfy an actually required companion.

| method | cap | Findings at the named method/pct/accumulation fields |
|---|---|---|
| absent | {pct:0.05} | none |
| absent | {pct:0.05,accumulation:null} | none |
| absent | {pct:0.05,accumulation:bad} | REC-11 accumulation |
| absent | {pct:null,accumulation:bad} | REC-11 accumulation |
| net | {pct:0.05} | REC-02 accumulation |
| net | {pct:0.05,accumulation:null} | REC-02 accumulation |
| null | {pct:0.05,accumulation:null} | REC-02 method only |
| net | {pct:null,accumulation:bad} | REC-11 accumulation |
| net | {pct:false,accumulation:null} | REC-01 pct; REC-02 accumulation |

This explicitly corrects the current implementation's own-null accumulation
trigger on a method-absent cap; it does not silently preserve that coarse
predicate as authority. Synchronized Format/Protocol/schema conditions MUST pin
M/P and the same null/required boundaries. Neither method nor accumulation is
invented or defaulted. These diagnostic dispositions are accepted; they add no financial treatment.
These are validation admissions, not financial recomputation.

Nothing here is projected: no future recovery is forecast, no pool is grossed up
from occupancy, and `gross_up_pct` records the occupancy a pool was grossed up
to rather than performing the gross-up.

**Lease clauses (RFC 0055).** `escalation_schedule`, `termination_option`,
`co_tenancy_details`, `lc_original` and `lc_outstanding_balance` are OPTIONAL. A
tenant stating none of them is unchanged. These are **attributes of a lease**,
placed here by RFC 0054 because they hold whether you read the roll in month 3 or
month 40; per-period quantities belong in a period series, not on this record.

Rates are fractions, not percents. Nothing here is exercised: no rent is
escalated, no break is taken, no remedy is applied and no balance is amortized.

- `LSE-01` — escalation steps are objects with a real `effective_date` and a
  finite nonnegative `base_rent_annual`, strictly increasing by date. A step
  states the **resulting** rent, not the increment, so a reader never compounds
  percentages to learn what year six costs.
- `LSE-02` — every step lies within `[lease_commencement, lease_expiration]`
  when both are stated. An unstated term checks nothing.
- `LSE-03` — a stated schedule requires `escalation_type` present and not
  `none`. A flat lease does not carry steps.
- `LSE-04` — `termination_option.earliest_date` is a real date inside the lease
  term, `notice_months` a nonnegative whole number, and `penalty` finite and
  nonnegative when stated. `null` means genuinely no penalty.
- `LSE-05` — `penalty_includes` entries come from
  `unamortized_ti | unamortized_lc | free_rent | fee`, without repeats. It
  records what the stated penalty is composed of; it never recomputes it.
- `LSE-06` — `co_tenancy_details` requires `co_tenancy_clause: true`, and
  `co_tenancy_clause: true` requires details. The boolean and the body agree, or
  neither is stated.
- `LSE-07` — the trigger carries what it needs: a nonempty `named_cotenants` for
  `named_tenant_departure`, an `occupancy_threshold` strictly between 0 and 1
  for `occupancy_threshold`, both for `both`. `cure_period_months` is a
  nonnegative whole number.
- `LSE-08` — `remedy_value` is required for `rent_reduction` (a fraction in
  `(0, 1]`) and `alternate_rent` (nonnegative), and refused for
  `termination_right`, whose remedy is the right itself.
- `LSE-09` — TI and LC amounts are finite and nonnegative, and an outstanding
  balance never exceeds its original. Amortization is periodic and out of scope.

---

#### Hospitality Variant (RFC 0081 G3)

**Normative schema:** [rent-roll-hospitality.schema.json](schemas/rent-roll-hospitality.schema.json) (the class contract for a hospitality `rent_roll`; other members of the section are unconstrained by it).

Hospitality states its key count only as `property.keys` (integer ≥ 0). Its `rent_roll` is stage-required (§5.1); when stated it MUST contain `available_room_nights` (integer ≥ 0), otherwise `CLS-04`. Optional fields: `occupied_room_nights` (integer ≥ 0), `adr` (number ≥ 0), and `occupancy` (fraction in [0,1]). `rent_roll.keys` is not admitted. `hotel_metrics` (§4.32) is optional and holds only market_revpar. No hotel class-required section is added. RevPAR stays rooms_revenue / available_room_nights. ADR, occupancy and available room nights also feed total_room_revenue; room_revenue_per_key divides its 2dp rounded total by property.keys. The dictionary supplies the unchanged null guards, units and round_to.

### § 4.4 — Operating Statement

**ID:** `operating_statement`  
**Header:** `## Operating Statement {#operating_statement}`  
**Purpose:** Historical income and expense data from the property's financial records.  
**Written by:** `agent/L0-02`  
**Variants:** `t12` (required), `t3` (preferred), `ytd`, `budget`, `t24`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `property`

```json
{
  "_meta": {
    "section": "operating_statement",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `system/calculations.ts` (values), `agent/L2-CRE-01` + `agent/L2-CRE-02` (adjustments/rationale)  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `rent_roll`, `operating_statement`, `market_analysis`

```json
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
      "reassessment_basis": null,
      "benchmark_low": null,
      "benchmark_high": null,

      "reassessment": {
        "trigger": "sale | construction_completion | statutory_cycle | none",
        "jurisdiction": null,
        "value_basis": null,
        "assessment_ratio": null,
        "assessed_value": 0.0,
        "millage_rate": 0.0,
        "indicated_tax": 0.0,
        "round_to_decimals": null
      },
      "abatement": {
        "kind": "exemption | freeze | pilot | phase_in | credit",
        "program": null,
        "stabilized_period": null,
        "schedule": [
          { "period": "Y1", "full_tax": 0.0, "abated_tax": 0.0 }
        ]
      }
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

**Property taxes and reassessment (RFC 0053).** A deal carries three distinct
property taxes, and this section holds the second:

| Tax | Where | Whose |
|---|---|---|
| Trailing | `operating_statement.expenses.real_estate_taxes` | The seller's actual. |
| Going-in underwritten | `noi_model.expenses.real_estate_taxes` | The buyer's, after their purchase triggers reassessment. |
| Terminal | `dcf.exit_analysis.terminal_tax` (§4.9) | The **next** buyer's, after this sale reassesses at the exit price. |

`reassessment` and `abatement` are OPTIONAL. A document omitting both is
unchanged. Rates are fractions, not percents. The prose `reassessment_basis`
is retained as narrative; when `reassessment` is present it governs.

Only `trigger` is required. `assessed_value`, `millage_rate` and `indicated_tax` form an all-or-none assessment group. `jurisdiction`, `value_basis`, `assessment_ratio` and `round_to_decimals` are admitted only with that group. `TAX-01`–`TAX-03` evaluate only when the group is stated. A lone `reassessment: {"trigger": "sale"}` states the sale-trigger fact. A member stated as `null` is not stated: it neither satisfies nor triggers a group requirement (the `ESC-04` absent/null equivalence).

- `TAX-01` — `trigger` is one of the four listed values, `assessed_value`,
  `millage_rate` and `indicated_tax` are finite, and when `value_basis` and
  `assessment_ratio` are both stated, `assessed_value` MUST equal their product.
  Stating one of that pair without the other is refused.
- `TAX-02` — `indicated_tax` MUST equal `assessed_value × millage_rate`.
- `TAX-03` — `value` MUST equal `indicated_tax` quantized at
  `round_to_decimals`, which MUST be an integer and MAY be negative to round to
  a magnitude. Omitting it means the §VIII.9.4 currency quantum, so an unrounded
  value MUST foot exactly.

- `TAX-05` — abatement `schedule` periods are RFC 0041 selectors (`Y1`+,
  `YYYY-Qn`, `YYYY-MM`, or `YYYY-MM-DD`), all of one granularity, strictly
  increasing, without duplicates. Holding years order numerically, so `Y10`
  follows `Y9`.
- `TAX-06` — `kind` is one of the five listed values and every entry holds
  `0 ≤ abated_tax ≤ full_tax` with both finite. A `freeze` additionally holds
  `full_tax` nondecreasing.
- `TAX-07` — when `stabilized_period` is stated it MUST name a period in the
  schedule, and `value` MUST equal that period's `abated_tax`.

The schedule documents and verifies the stated tax line; it does not project it.
No per-period expense rows are generated, and no jurisdiction rules are inferred
from `jurisdiction`, which is a label.

---

### § 4.6 — Valuation

**ID:** `valuation`  
**Header:** `## Valuation {#valuation}`  
**Purpose:** Value conclusions using income approach, with third-party appraisal cross-check.  
**Written by:** `agent/L2-CRE-04`, `system/calculations.ts`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `noi_model`, `market_analysis`

```json
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `wizard:step_4`, `agent/L4-01`, `agent/L4-04`  
**Required for pipeline stage:** Screening and beyond  
**Dependencies:** `valuation`, `noi_model`

```json
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "loan_amount": 0.0,
  "loan_purpose": "acquisition | refinance | cash_out_refi | construction | bridge | supplement",
  "loan_type": "conventional | agency_fannie | agency_freddie | cmbs | sba_504 | sba_7a | bridge | construction | life_co | hud_221d4 | hud_223f | mezzanine | null",
  "rate_type": "fixed | floating | hybrid",
  "interest_rate": 0.0,
  "rate_index": "sofr | prime | treasury_5yr | treasury_10yr | fixed | null",
  "rate_spread_bps": null,
  "rate_floor_pct": null,
  "rate_hedge": null,
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

**Rate hedges (RFC 0056, RFC 0081 G1).** `rate_hedge` is OPTIONAL. Only `instrument` and `strike_rate` are required. `notional`, `index`, `effective_date`, `expiration_date` and `post_expiration_assumption` form an all-or-none terms group (`HDG-01`). A strike-only hedge may also state premium; no other fact is inferred. `HDG-01` validates stated members; `HDG-02`/`HDG-03` apply to every hedge. `HDG-06`–`HDG-10`, replacement_funding and the hedge clauses of `ESC-04` evaluate only when the terms group is stated. The premium is the single home of the cap cost. A member stated as `null` is not stated: it neither satisfies nor triggers a group requirement (the `ESC-04` absent/null equivalence). `replacement_funding: null` therefore requires no terms group.
When `debt_structure` is a variant map, the hedge rules read the one block
§5.3 selects for them, preferring `senior` (RFC 0075). A hedge on any other
block is not read.

```json
"rate_hedge": {
  "instrument": "rate_cap",
  "notional": 30000000.0,
  "strike_rate": 0.035,
  "index": "sofr | prime | treasury_5yr | treasury_10yr",
  "effective_date": "2026-01-01",
  "expiration_date": "2029-01-01",
  "premium": 410000.0,
  "post_expiration_assumption": "replace | unhedged | loan_matures_first",
  "counterparty": null
}
```

Rates are fractions, not percents. Nothing here is priced: the premium is the
cash the author paid, not a value struck off a forward curve, and no strike
crossing is projected.

- `HDG-01` — `instrument` is from the closed set; `notional` finite and
  nonnegative; `strike_rate` a fraction strictly between 0 and 1; `index` from
  the closed set (the `rate_index` vocabulary minus `fixed`, which a cap is not
  struck against); both dates real, with `expiration_date` strictly after
  `effective_date`; `premium` finite and nonnegative when stated, `null` for
  genuinely none.
- `HDG-02` — `rate_swap` and `rate_collar` are **reserved and refused**. Their
  mark-to-market moves with the curve and can be negative, which a cap's cannot;
  typing them as caps would make the capital stack wrong in the one case that
  matters. They wait for their own contract.
- `HDG-03` — a stated `rate_hedge` requires `rate_type` to be `floating` or
  `hybrid`. A fixed-rate loan does not carry a rate cap.


- `HDG-06` — `post_expiration_assumption` is stated and from the closed set.
  It has no default on purpose: a cap's term is the fact the reader came for,
  and leaving it unstated is the answer that hides the cliff. `replace` is tied
  to a valid replacement-funding path by ESC-04 (§ 4.8) and RFC 0070.

**Replacement funding (RFC 0070; Protocol 2.21.0).**
The OPTIONAL `rate_hedge.replacement_funding` is null/absent, or one closed
object: `{ "mode": "escrow" }` or `{ "mode": "outright", "cash_flow_ref":
{ "variant": "cap-cash", "row_index": 1, "binding_digest": "sha256:<64 lowercase hex>" } }`.
It MUST be stated only under `post_expiration_assumption: "replace"`.
The assumption remains the post-expiration lifecycle statement; funding is
separate. No other modes/members, inline date/amount or successor terms exist.

- `HDG-07` — refuse invalid union shape/unknown members/missing reference
  members and funding under a nonreplacement assumption.
- `HDG-08` — require unambiguous property-level debt/sources selection (RFC
  0040), exact current explicitly named §4.26 variant, no fallback, safe
  nonnegative in-range zero-based row index, legal ordered nonempty series,
  real dates/finite amounts/row kinds and digest syntax.
  A stated `rate_hedge` (non-null, on any current `debt_structure` block when
  none is selected) whose `debt_structure` or `sources_uses` selection is
  ambiguous or unresolvable under §5.3 MUST report `HDG-08`, once. Rules that
  read the refused section are not evaluated. Absent sections are not
  refusals (§4.8 ESC-04). A section with no stated hedge reports nothing
  here (RFC 0076).
- `HDG-10` — bound payment MUST be nonpositive (explicit zero is valid) and
  strictly after the initial hedge effective_date. Payment may precede, equal
  or follow expiration. Invalid anchors retain HDG-01; no date is inferred.
- `HDG-09` — only the separate async verifier reports an actual recomputed
  digest mismatch; synchronous validation MUST NOT report an unchecked digest
  as an error. Complete outright claims require async `verified`.

The reference designates a dedicated modeled future replacement payment,
not an executed trade, commencement or settlement assertion. Amount/date
remain solely in the cash row. Do not add/derive/net/reallocate cash, invent
funding, price a cap, project payoff, fetch curves, value MTM, expand swaps/
collars or roll escrow balances. Advisory row labels/kinds do not prove purpose.
See Protocol §V.12 for exact commitment bytes and separate verification states.

`notional` is the member that makes partial hedging legible. A $40M loan with a
$30M notional is 75% hedged; without it, that deal and a fully hedged one read
identically.

---

### § 4.8 — Sources & Uses

**ID:** `sources_uses`  
**Header:** `## Sources & Uses {#sources_uses}`  
**Purpose:** Complete capital stack — all equity, debt, and cost components.  
**Written by:** `wizard:step_4`, `agent/L4-05`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `debt_structure`, `valuation`

```json
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
    "renovation": null,
    "other_reserves": null,
    "escrows": null,
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

**Escrows (RFC 0056).** `uses.escrows` is OPTIONAL and types the cash lines the
a single amount cannot describe: which are lender-required, which fund
monthly rather than at close, and that the tax and insurance escrows exist at
all. A document stating none of them is unchanged.

```json
"escrows": [
  {
    "name": "tax | insurance | replacement_reserve | ti_lc | interest | operating | rate_cap_replacement | other",
    "label": null,
    "upfront": 120000.0,
    "monthly": 30000.0,
    "lender_required": true
  }
]
```

The closed vocabulary with a label-bearing `other` is RFC 0052's shape, for the
same reason: an open string makes two documents incomparable, and a closed list
with no escape hatch makes the honest author lie. Nothing is rolled forward —
an amortizing balance is periodic, which RFC 0054 placed behind a named
consumer.

- `ESC-01` — `escrows` is a nonempty array of objects; `name` from the closed
  set; `upfront` and `monthly` finite and nonnegative when stated, with at least
  one of the two stated. An escrow that funds neither at close nor monthly is
  not one.
- `ESC-02` — `other` requires a nonempty `label` and every other name refuses
  one, since it names itself. `name` is unique across the array, and `other`
  entries are distinguished by unique labels.

- `ESC-04` — `replace` MUST have a valid replacement-funding path.
  Absent/null replacement_funding and explicit escrow mode MUST state the
  lawful existing `rate_cap_replacement` escrow (ESC-01/02).
  Explicit outright mode requires the exact RFC 0070 payment binding and
  MUST NOT coexist with a replacement escrow, even a zero-funded one.
  A replacement escrow requires `replace`. Missing sources_uses or uses is
  not an exemption: correcting that skip enforces released RFC 0056 behavior.
  ESC-04 is not evaluated when a stated hedge's `debt_structure` or
  `sources_uses` selection refuses. `HDG-08` reports that instead (RFC 0076).
  Existing valid escrow-funded documents need no edits or new currency field.

**The renovation draw (RFC 0057, RFC 0081 G1).** `uses.renovation` is OPTIONAL and requires at least one of budget or contingency. `contingency_used`, `drawn_to_date`, `as_of_date` form an all-or-none draw group (`CAPX-01`); stating it requires both budget and contingency. `contingency_remaining` is admitted only with that group. A member stated as `null` is not stated: it neither satisfies nor triggers a group requirement (the `ESC-04` absent/null equivalence). `CAPX-01` validates stated members; `CAPX-02`–`CAPX-04` evaluate only with the draw group. Two deals stating the same contingency are indistinguishable when one has
drawn none of it and the other has drawn all of it.

```json
"renovation": {
  "budget": 4000000.0,
  "contingency": 500000.0,
  "contingency_used": 120000.0,
  "contingency_remaining": 380000.0,
  "drawn_to_date": 1850000.0,
  "as_of_date": "2026-09-01",
  "expense_targeted": []
}
```

A draw is a fact **as of `as_of_date`**. Nothing is projected: there is no
S-curve, no remaining-to-spend schedule and no milestone release. A draw over
time is periodic, which RFC 0054 placed behind a named consumer.

- `CAPX-01` — `budget`, `contingency`, `contingency_used` and `drawn_to_date`
  are finite and nonnegative, and `as_of_date` is a real `YYYY-MM-DD` date.
- `CAPX-02` — `contingency_used` does not exceed `contingency`. A contingency
  drawn past its size is an overrun, and calling it a contingency is what hides
  that.
- `CAPX-03` — `drawn_to_date` does not exceed `budget + contingency`, and is at
  least `contingency_used`: the contingency draw is part of the total, not
  beside it.
- `CAPX-04` — `contingency_remaining`, when stated, equals
  `contingency − contingency_used` at the currency quantum (protocol § VIII.5).
  It is stated and verified rather than left to the reader's subtraction, the
  posture RFC 0052 took with `net_sale_proceeds`.


**Expense-targeted capex (RFC 0057).** `renovation.expense_targeted` is OPTIONAL
and names capital spend bought specifically to reduce an operating expense. A
$600,000 retrofit that takes $95,000 a year out of the utility line is a
different thing from $600,000 of deferred maintenance, and the format had no way
to say which one it was looking at.

```json
{
  "label": "LED and controls retrofit",
  "amount": 600000.0,
  "targets": "utilities",
  "annual_savings": 95000.0,
  "savings_begin": "Y2",
  "in_noi_model": false,
  "simple_payback_years": 6.3158
}
```

**The saving is stated, never applied.** Nothing subtracts `annual_savings` from
an expense line, from EGI or from NOI — invariant 1 holds here as everywhere,
and this is the surface most likely to tempt someone into breaking it.

- `CAPX-06` — `label` nonempty; `amount` and `annual_savings` finite and
  nonnegative; `savings_begin` an RFC 0041 period selector; `targets` names a
  key that exists under `noi_model.expenses` when that section is present.
  The target is checked against the keys actually there, not a closed list, so a
  module adding a class-specific expense line keeps working.
- `CAPX-07` — `in_noi_model` is stated as a boolean, saying whether the author
  has already reflected this saving in `noi_model`. It is required because a
  stated saving with no such flag is how a document gets double-counted: the
  author reduces the line, and a second reader applies the saving again.
- `CAPX-08` — `simple_payback_years`, when stated, equals
  `amount ÷ annual_savings` at four decimals, and is refused against zero
  savings. A project with no stated saving has no payback period, and a number
  there would be a fiction.

Redevelopment **downtime** needs no new field: § 4.25 `lease_up_schedule` with
`model_type: "natural_turnover"` already expresses a period of suppressed
occupancy carrying its own `ti_lc_capex`, which is what downtime is.

---

**Derived uses footing (RFC 0081 G1).** When uses is stated, its derived total is the sum of its numeric leaves, plus each interest/operating escrow upfront once and each rate_hedge premium in active debt_structure once. Other escrow names remain uncounted. A typed `renovation` contributes its `budget` plus its `contingency`, the amount the retired renovation scalars contributed (RFC 0081 §7). Its draw group and `contingency_remaining` record how much of that amount was disbursed as of `as_of_date` (`CAPX-02`–`CAPX-04`) and are not further uses. Neither they nor `expense_targeted` adds to the total. A producer states each fact in one home only.

### § 4.9 — DCF & Hold Period Analysis

**ID:** `dcf`  
**Header:** `## DCF & Hold Period {#dcf}`  
**Purpose:** Multi-year discounted cash flow model, exit analysis, and returns.  
**Written by:** `system/dcfEngine.ts`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `noi_model`, `debt_structure`

```json
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
    "preferred_equity_redemption_at_exit": null,
    "net_proceeds_to_common_equity": null,
    "exit_value_per_unit": null,
    "exit_value_per_sqft": null,
    "terminal_tax": {
      "trigger": "sale | construction_completion | statutory_cycle | none",
      "jurisdiction": null,
      "value_basis": null,
      "assessment_ratio": null,
      "assessed_value": 0.0,
      "millage_rate": 0.0,
      "indicated_tax": 0.0,
      "round_to_decimals": null,
      "in_exit_noi": false,
      "value_basis_differs_because": null
    }
  },
  "returns": {
    "tax_basis": "pre_tax",
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

**Exit proceeds (RFC 0077).** `exit_value_net` is the sale price less
disposition costs. `loan_balance_at_exit` is the balance of every debt repaid
from the sale. When a `capital_stack` (§ 4.24) is present, that is every
`senior_debt`, `mezzanine_debt`, `bridge`, `seller_financing` and `other_debt`
tranche, and never an equity-class tranche. `net_proceeds_to_equity` is the
proceeds to the whole equity stack, preferred and common:
`exit_value_net − loan_balance_at_exit`.

`preferred_equity_redemption_at_exit` is OPTIONAL. It states the cash paid at
the sale to retire every `preferred_equity` tranche, accrued return included.
It is stated, never derived, and an agent MUST NOT invent it.
`net_proceeds_to_common_equity` is OPTIONAL. When the redemption is stated, it
is `net_proceeds_to_equity − preferred_equity_redemption_at_exit`. Without the
redemption it is the producer's stated figure and is not footed. Splitting the
equity stack's proceeds between partners belongs to `distribution_waterfall`
(§ 4.27), not here.

**`returns.tax_basis` (RFC 0038).** Declares the tax basis of every metric
stated in `returns` — `levered_irr`, `unlevered_irr`, `equity_multiple`,
`avg_cash_on_cash`, `total_equity_distributions`, `npv`,
`payback_period_years`: `pre_tax` (the default when the field is absent)
or `after_tax`. The declaration is per section, not per metric — a
`returns` object MUST NOT mix bases; a producer that has both states one
and carries the other in an extension or a separate document. Any other
value is `RT-01` (error, Protocol §III.6a). Readers that compare return
metrics across documents MUST treat differing bases as incomparable rather
than as a spread. `frontmatter.quick_metrics.irr_projected` inherits the
`dcf` declaration. `getReturnTaxBasis()` in `@uwmd/core` returns the
effective basis, default included.

**Terminal tax (RFC 0053).** `exit_analysis.terminal_tax` is OPTIONAL and holds
the **next** buyer's tax, after this sale reassesses the property at the exit
price. It takes the §4.5 `reassessment` shape and the same `TAX-01` through
`TAX-03` rules, plus:

- `TAX-08` — `in_exit_noi` MUST be stated as a boolean, recording whether this
  tax is already inside `exit_noi`. When `trigger` is `sale`, `value_basis`
  MUST equal `exit_analysis.exit_value_gross` — the next buyer is reassessed at
  what they pay — unless `value_basis_differs_because` gives a nonempty reason.

`TAX-08` is what catches a going-in tax carried into terminal NOI, which
overstates exit value.

**The engine does not solve the circularity.** Exit value depends on the
reassessed tax, which depends on exit value. There is no iteration in the calc
engine and this section adds none: an author who wants the converged figure runs
that solve in their own model and states the result, which these rules then
check for internal consistency. No arithmetic is asserted over `exit_noi`
itself, because `exit_value_gross` capitalizes a *forward* (year N+1) NOI this
block does not store — the same reason `deriveDCF` leaves it an input.

---

### § 4.10 — Stress Tests

**ID:** `stress_tests`  
**Header:** `## Stress Tests {#stress_tests}`  
**Purpose:** Scenario analysis showing deal performance under adverse conditions.  
**Written by:** `system/calculations.ts`, `agent/L2-CRE-12`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `noi_model`, `debt_structure`

```json
{
  "_meta": {
    "section": "stress_tests",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `agent/L2-CRE-07`, `agent/L2-CRE-08`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `property`

```json
{
  "_meta": {
    "section": "market_analysis",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `wizard` (form), `agent/L2-CRE-09`, `agent/L2-CRE-10`, `agent/L2-CRE-11`  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** `ownership`

```json
{
  "_meta": {
    "section": "borrower_sponsor",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `agent/L3-01` through `agent/L3-06`  
**Required for pipeline stage:** Credit approval and closing  
**Dependencies:** `property`

```json
{
  "_meta": {
    "section": "due_diligence",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `agent/L6-01` through `agent/L6-06`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `noi_model`, `valuation`, `market_analysis`, `borrower_sponsor`, `debt_structure`

```json
{
  "_meta": {
    "section": "risk_assessment",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `agent/L5-01` through `agent/L5-06`  
**Required for pipeline stage:** Credit approval  
**Dependencies:** `debt_structure`, `ownership`, `borrower_sponsor`

```json
{
  "_meta": {
    "section": "compliance",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `system/calculations.ts` (compiles from all sections)  
**Required for pipeline stage:** Full underwriting  
**Dependencies:** All financial sections

```json
{
  "_meta": {
    "section": "assumptions",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "assumptions": [
    {
      "key": "string",
      "label": "string",
      "section": "string",
      "category": "income | expense | financing | market | exit | scenario | borrower",
      "value": null,
      "unit": "pct | dollar | dollar_per_unit | dollar_per_sqft | years | months | bps | ratio | count | boolean | string",
      "source": "user_input | user_override | manual | inherited_assumption | investor_profile | market_data | market_data_accepted | ai_extracted | agent_computed | asset_class_default | scenario_default | global_default | system_default",
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
      "user_input": 0,
      "user_override": 0,
      "market_data": 0,
      "ai_extracted": 0,
      "agent_computed": 0,
      "investor_profile": 0,
      "asset_class_default": 0,
      "scenario_default": 0
    },
    "low_confidence_count": 0,
    "override_count": 0
  }
}
```

An assumption entry's `source` takes one canonical tag from
`SOURCE_TAGS` (§2.6 resolution vocabulary — this registry aggregates by
*method*, which is the question "how much of this underwriting is
assumed?" needs answered). `wizard_input`, which this section used to
require and no other vocabulary or line of code recognized, is
`user_input` (RFC 0031). `summary.by_source` keys follow the same
vocabulary; the keys shown above are illustrative, not exhaustive.

---

### § 4.17 — Flags & Validation

**ID:** `validation`  
**Header:** `## Flags & Validation {#validation}`  
**Purpose:** All warnings, errors, policy flags, and cross-section consistency checks. This section is the machine-readable deal health signal.  
**Written by:** `system/financialValidityChecker`  
**Required for pipeline stage:** All stages  
**Dependencies:** All sections (reads everything)

```json
{
  "_meta": {
    "section": "validation",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
  "_meta": {
    "section": "pipeline_log",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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

```json uw:section=custom_calculations source=manual ts=2026-10-11T00:00:00Z v=1
{
  "_meta": {
    "section": "custom_calculations",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
| True all-in yield | NOI ÷ (purchase price + closing costs + reserves) | `valuation.purchase_price`, `sources_uses.closing_costs.total`, `sources_uses.uses.escrows` (operating upfront), `noi_model.net_operating_income` |
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

```json uw:section=custom_scenarios source=manual ts=2026-10-11T00:00:00Z v=1
{
  "_meta": {
    "section": "custom_scenarios",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
| Renovation budget overrun +20% | construction | `sources_uses.uses.renovation.budget` +20% |
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

```json uw:section=x_{user_defined_id} source=manual ts=2026-10-11T00:00:00Z v=1
{
  "_meta": {
    "section": "x_your_id",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "integrity": {
      "input_hash": null
    }
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

```json uw:section=gaps source=system/gaps-maintainer ts=2026-10-11T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "gaps",
    "provenance": {
      "source": "system/gaps-maintainer",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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

**Auto-maintenance.** When an editor (a starter product since RFC 0078, Protocol §II.4) is invoked with the `--maintain-gaps` flag, the editor runs `inferGaps()` after every successful write and either updates the existing `gaps` section or creates one. The auto-write is stamped `_meta.provenance.source: 'system/gaps-maintainer'` and `_meta.provenance.actor: 'system'` so it is filterable from human-authored entries.

**Validator codes.** A `provisional` block with no matching gap entry triggers `DQ-01`; a `partial` block with no `_overrides` triggers `DQ-03`; consuming a provisional block at a stage whose policy is `halt` triggers `DQ-02`; a stale entry (older than the institution's freshness threshold) triggers `DQ-05`. See Protocol §III.6a.

---

### § 4.23 — Components (Mixed-Use)

**ID:** `components`  
**Header:** `## Components {#components}`  
**Purpose:** Decomposes a mixed-use property into its constituent uses, each keyed by its own asset class. A mixed-use property is two or more uses under one purchase price and one loan — apartments over ground-floor retail, an office podium under a hotel — and no single income model or denominator describes it. This section states each use's own income so that property-level figures foot as the sum of the components while use-level metrics stay honest. It is the one section whose presence is gated to a single `asset_class`.  
**Written by:** `wizard`, `manual`, `agent/L4-*` (component subtotals only — an agent MUST NOT populate `allocation_pct`; see Allocation below)  
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
- A component MUST NOT carry its own `debt_structure`. This section models one property-level loan. Component-level financing (for example a separately-financed commercial condo) is expressed as a component-level **`capital_stack`** (§ 4.24, RFC 0026): a component MAY carry a `capital_stack` object of the same shape as the top-level section, validated by the same `CS-*` rules. The senior-reconciliation rule (generalized `CC-03`) applies only to the top-level stack — a component stack is that component's own financing and has no property-level `debt_structure` counterpart to reconcile with.

**Footing.** Property `noi_model.net_operating_income` MUST equal the sum of the component `net_operating_income` figures (`CC-12`). Because every admitted class computes NOI on the same basis, this sum is well-defined with no special case.

**Operating-business components.** `hospitality`, `senior_housing`, and `student_housing` are operating businesses. Where a component's own calc pack strikes a model-level intermediate subtotal above NOI — `gross_operating_profit` for `hospitality`, `total_labor_expense` for `senior_housing` — that subtotal MAY be carried in the component and is surfaced per component. These subtotals sit at different points in their respective waterfalls and MUST NOT be blended into a single synthesized property-level intermediate. A property-level `gross_operating_profit` MAY be reported only as a memo summing the components that declare one; a component that has none contributes N/A, never `0`.

**Allocation.** One purchase price and one loan cover the whole property, so use-level intensive metrics (price per apartment, loan per retail square foot) require splitting those single figures across components. There is no deterministic way to derive that split — income share, area share, and appraised-value share all disagree, and the choice is an underwriter's judgment. Therefore `allocation_pct` is an **input**, never a derivation: it is user-supplied, MUST sum to `1.0` across present components within `0.0001`, and an agent MUST NOT populate it. When `allocation_pct` is absent, every use-level intensive metric MUST evaluate to `null` rather than fall back to an area- or income-share guess.

```json uw:section=components source=manual ts=2026-10-11T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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
**Written by:** `wizard`, `manual`, `agent/L4-*` (tranche amounts and terms are user-supplied capital terms — an agent MUST NOT invent a tranche `rate`, `amount`, or a stated `sizing` value)  
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
- `accrual` — `cash` (current‑pay; enters cash coverage), `accrued` (PIK; compounds on balance and does **not** enter cash coverage), or `split` (RFC 0050; preferred-equity current-pay plus accrued components). `split` is permitted only on `preferred_equity`.
- `cash_rate` — fraction required only when `accrual` is `split`; the current-pay component that enters cash coverage. MUST NOT appear for another accrual mode.
- `accrued_rate` — fraction required only when `accrual` is `split`; the accrued/PIK component that does not enter cash coverage. MUST NOT appear for another accrual mode.
- For `accrual: "split"`, `rate` is required and MUST equal `cash_rate + accrued_rate`; disagreement is `CS-02b`.
- `amortization_months`, `io_months`, `term_months` — debt terms, from which the tranche's own annual debt service is derived deterministically.

**Normative rules (RFC 2119):**

- The `capital_stack` section is OPTIONAL and asset-class independent. A document with no `capital_stack` behaves exactly as before this RFC; every single-loan metric is unchanged.
- **The stack is one point in time** (*stated by [RFC 0033](../docs/rfcs/0033-capital-stack-point-in-time.md)*). The section states the capitalization contemporaneous with the operating year the sizing verbs read (`noi_model.net_operating_income`) — for a deal underwritten to stabilization, the stabilized (permanent) stack. Facilities that do not coexist at that point MUST NOT be stated as concurrent tranches: a construction loan and the permanent takeout that retires it are one senior position in time sequence, and stating both double-counts the senior capital and misstates every attachment point above it. A producer underwriting a ground-up development SHOULD emit the stabilized stack — the takeout senior plus the layers that survive into stabilization — and MUST NOT add the retired construction facility to it. A `bridge` tranche is unaffected: a deal underwritten *during* its bridge period states the bridge-period capitalization, which is the point in time its NOI describes. Phased stacks (construction → takeout, draw schedules, as-is/as-stabilized dual sizing) are deferred with the multi-period spine (RFC 0026 § D; RFC 0033).
- Each tranche MUST state `id`, `class`, `position`, and `amount`; `id` and `position` MUST be unique within the section. A malformed or duplicate-keyed tranche MUST be rejected (`CS-01`).
- Every debt tranche and every `preferred_equity` tranche MUST state a `rate`; a `common_equity` tranche MUST NOT (`CS-02`).
- When a `capital_stack` is present, its `senior_debt` tranche MUST reconcile with `debt_structure` and the `sources_uses` senior bucket — same amount, same rate. This is the generalized `CC-03`: the senior view is stated once and agrees everywhere.
- **Sizing is stated and verified, never trusted.** Each `sizing` entry names a closed `fn`, a selector, and a stated `value`; a verifier recomputes `fn` and compares. Disagreement is `CS-SIZING-DISAGREES` and the result is `failed`, never a silent pass. A figure that reads a tranche field the document does not supply is `unverifiable`, never `0`.
- **The distribution waterfall is out of scope for this version.** A `capital_stack` that attempts to encode distribution tiers, promote, IRR hurdles, or catch-up MUST be refused (`CS-WATERFALL-UNSUPPORTED`) with guidance to `x_partnership_structure`; the multi-period distribution waterfall is deferred (RFC 0026 § E) pending a hold-period cash-flow primitive.

**Sizing declaration admission (`CS-03`, RFC0096).**

Absent sizing is valid. Present sizing MUST be an array (null is invalid);
empty is valid. Each item MUST be an object closed to id, fn, over, through,
value, with required own id, fn and value:

- id: nonempty string.
- fn: exactly coverage, blended_coverage, debt_yield_through, ltc_through,
  ltv_through or weighted_cost.
- value: finite number, including signed values and zero.
- Exactly one own over/through member; over is a nonempty string; through is
  an integer >=1. For neither/both selectors emit one CS-03 at sizing[i];
  do not cascade selector-leaf findings. Otherwise report a wrong selected
  carrier at sizing[i].over or sizing[i].through.

Apply the same declaration check to each admitted builtin component's own
capital_stack.sizing, under Format4.23's existing component eligibility;
qualify fields as `<component>.capital_stack.sizing[i]` and `section=components`.
Do not invent a new component kind or validate a component-like extension.
CS-01 tranches/identities, CS-02 coupon/class, CS-02b split coupon and
CS-WATERFALL-UNSUPPORTED retain their owners. This RFC does not resolve a
selector to a tranche, require a missing financial input, calculate sizing or
interpret unknown selectors as zero. Format4.24's fn/selector association table
and its financial unverifiable/refusal rules remain authority; the new code
covers the structural union above, without adding a new calculation rule.

**Sizing vocabulary (closed, non-extensible).** Each figure selects tranches with `over` (a single tranche `id`), `through` (a `position`, cumulative through that layer), or `*` (the whole stack):

| `fn` | selector | recomputation |
|---|---|---|
| `coverage` | `over` | `noi_model.net_operating_income` ÷ that tranche's annual debt service |
| `blended_coverage` | `through` | NOI ÷ Σ **cash-pay** debt service at or above the position (accrued/PIK excluded; a split preferred tranche contributes `amount × cash_rate`) |
| `debt_yield_through` | `through` | NOI ÷ cumulative debt balance through the position — the attachment-point yield |
| `ltc_through` / `ltv_through` | `through` | cumulative balance through the layer ÷ total cost / value |
| `weighted_cost` | `*` | amount-weighted average `rate` across the stack; a split preferred tranche uses its full `rate`, not only `cash_rate` |

An accrued/PIK tranche contributes **zero** to `blended_coverage` but its balance still counts in `debt_yield_through` — accrual changes cash coverage, not the capital ahead of you. A split preferred tranche contributes only its `cash_rate` service to coverage and its full stated rate to `weighted_cost`.

```json uw:section=capital_stack source=manual ts=2026-10-11T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
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

### § 4.25 — Lease-Up Schedule

**ID:** `lease_up_schedule`  
**Header:** `## Lease-Up Schedule {#lease_up_schedule}`  
**Purpose:** Models the trajectory from current to stabilized rents over a defined window. `rent_roll` (§ 4.2) is a snapshot in time and `noi_model` (§ 4.4) a stabilized projection; the path between them — turnover pace, market-rent assumption, vacancy during lease-up, TI/LC capital — is the entire thesis of a value-add or ground-up deal, and this section is where that path lives as structure rather than `_notes`. The section is **asset-class independent** and **multi-variant**: base / upside / downside scenarios coexist under `variant=` exactly as `stress_tests` variants do.  
**Written by:** `wizard`, `manual`, `agent/L4-*` (the assumption set and stated figures are the deal thesis — an agent MAY draft a schedule but the host stamps `agent/<id>` and the figures remain subject to verification)  
**Required for pipeline stage:** Optional; used whenever the underwriting assumes a lease-up path. Never required — a stabilized acquisition legitimately has no lease-up story.  
**Dependencies:** `rent_roll` (soft — see `LU-04`), `noi_model` (`CC-15`), `property` (the § XIII size denominator for `occupancy_rate` verification)  
**Schema:** [`spec/schemas/section-lease-up-schedule.schema.json`](schemas/section-lease-up-schedule.schema.json)  
**Introduced by:** RFC 0008 (lease-up modeling).

Like `capital_stack` (§ 4.24), this is a **state-and-verify** structure (RFC 0021 § 6): the Tier‑3 calc engine never reads the schedule by pack formula, so the variable-length period array is safe, and every stated aggregate is recomputed by a deterministic verifier (`verifyLeaseUpSchedule`, a sibling of `verifyCapitalStack`) over a **fixed, closed recompute vocabulary**. The schedule is **data, not formulas** — no calc-engine iteration, time axis, or new builtin is involved. Cells are read by the verifier and by host code, **not** by pack formulas: calc paths are flat identifiers, so `lease_up_schedule.schedule[5].rent_revenue` does not parse and raises `CALC-PARSE-001` (corrected by RFC 0055; the claim that it was addressable was never true).

**Fields.**

- `model_type` — `natural_turnover` (an occupied asset re-leasing at market through turnover; value-add) or `absorption_curve` (filling vacant or newly-built space; ground-up). Closed. The type gates nothing structurally.
- `period_granularity` — `monthly` or `quarterly`, uniform per schedule.
- `stabilization_target` — the period by which the deal is underwritten to stabilize, in the declared grammar.
- `assumptions` — the driving assumption set (`monthly_turnover_rate`, `market_rent_psf_at_stabilization`, `vacancy_during_lease_up`, `concession_months_per_lease`, `tenant_improvement_psf`, `leasing_commission_rate`). All rates are **fractions** (`0.04`, never `4`). These are the deal thesis, not defaultable background: nothing here enters the cascade tables.
- `schedule` — one entry per period: `period`, `occupied_sf`, `leased_sf`, `in_place_rent_psf`, `market_rent_psf`, `vacancy_rate`, `rent_revenue`, `concessions` (negative), `ti_lc_capex` (negative), `net_cash_flow`.
- `stabilized_summary` — the stated endpoint: `occupied_sf`, `occupancy_rate`, `annualized_egi`, `annualized_noi`.

**Normative rules (RFC 2119):**

- The section is OPTIONAL. A document with no `lease_up_schedule` behaves exactly as before this RFC; no pipeline stage requires it (`STAGE_REQUIREMENTS` untouched).
- **Period grammar (`LU-01`, error).** A `period` is `YYYY-Qn` (quarterly) or `YYYY-MM` (monthly), matching the declared `period_granularity`. One schedule uses one cadence; mixed granularity within a schedule MUST be rejected.
- **Contiguity (`LU-02`, error).** Periods MUST be strictly increasing and gap-free. A schedule that skips a quarter is asserting something it does not say; a period with no activity states its figures, even when they are zero.
- **Non-empty, non-inverted (`LU-03`, error).** `schedule` MUST be non-empty, and `stabilization_target` MUST NOT be earlier than the first period.
- **Turnover needs a starting point (`LU-04`, warning).** `model_type: natural_turnover` with no `rent_roll` present in the document is a warning, not a refusal — a compose-time fragment may carry the schedule without the roll.
- **Stated figures are verified, never trusted.** A verifier MUST recompute, three-state (`verified` / `failed` / `unverifiable`), quantizing both sides at the same quantum (Protocol § VIII.5 posture): each period's `net_cash_flow` = `rent_revenue + concessions + ti_lc_capex` (a period omitting a stated component is `unverifiable` for that row, never `failed`); `stabilized_summary.occupied_sf` against the final period; and `stabilized_summary.occupancy_rate` = final occupied SF ÷ the § XIII size denominator (no resolvable square-foot denominator → `unverifiable`, never a guess).
- **Endpoint agreement (`CC-15`, warning, § 5.3).** The **base** variant's `stabilized_summary.annualized_noi` MUST agree with `noi_model.net_operating_income` within `LEASE_UP_STABILIZED_TOLERANCE` (2%, a named exported constant). The tolerance is deliberate, not softness: unlike `CC-01` (one number restated in two places, exact), the trajectory endpoint and the stabilized-year projection are two different models of stabilization, and demanding exact agreement would force producers to hand-tune one to echo the other — destroying the independent-model signal the check exists to read. Non-base variants are exempt: a downside scenario is *supposed* to disagree with stabilized NOI.

**Closed lease-up payload admission (`LU-05`, RFC0096).**

The closed LU-05/error admission predicates are:

| Field/object | Predicate |
|---|---|
| model_type | Required; exactly natural_turnover or absorption_curve |
| stabilization_target | Optional nullable; when non-null, a string in the declared monthly YYYY-MM or quarterly YYYY-Q1…Q4 grammar |
| assumptions | Optional nullable object, closed to the six members below |
| stabilized_summary | Optional nullable object, closed to the four members below |
| schedule row object | Closed to period plus the nine numeric members below; nonobject rows remain the existing LU-01 missing/invalid period boundary |
| section payload | Closed to model_type, period_granularity, stabilization_target, assumptions, schedule, stabilized_summary and the universal members above |

Optional nullable numeric fields, in fixed order:

| Container | Order and predicate |
|---|---|
| schedule[i] | occupied_sf, leased_sf, in_place_rent_psf, market_rent_psf: >=0; vacancy_rate:[0,1]; rent_revenue, concessions, ti_lc_capex, net_cash_flow: finite, signed |
| assumptions | monthly_turnover_rate:[0,1]; market_rent_psf_at_stabilization:>=0; vacancy_during_lease_up:[0,1]; concession_months_per_lease:>=0; tenant_improvement_psf:>=0; leasing_commission_rate:[0,1] |
| stabilized_summary | occupied_sf:>=0; occupancy_rate:[0,1]; annualized_egi, annualized_noi: finite, signed |

The description of concessions/capex as negative does not create a new sign
restriction beyond the admitted numeric schema domain. Model type gates no
other shape check. No rent roll, trajectory, occupancy denominator or endpoint
recomputation is required for LU-05. LU-01 keeps cadence and row-period grammar;
LU-02 contiguity; LU-03 schedule presence/type/nonempty and target inversion;
LU-04 remains a missing-rent-roll warning; CC-15 remains endpoint tolerance.
For a present non-null stabilization_target, assess string type independently
of cadence. Assess its monthly/quarterly grammar only when current own
period_granularity is exactly monthly/quarterly. An absent or invalid cadence
keeps its existing LU-01; do not infer a quarterly default or add a target-grammar
finding without an admitted declared grammar. A non-string target still receives
LU-05 independently. Synchronized schema assertions MUST use the same cadence
eligibility and whole-input ASCII grammar, not an unconditional fallback pattern.

The target grammar allocation above is explicit: WIP Python's LU-01 target
handling and TS's silently ignored invalid target are implementation evidence,
not authority to broaden LU-01 implicitly. No calendar/date-time profile is
added to these monthly/quarterly identities.

```json uw:section=lease_up_schedule variant=base source=manual ts=2026-10-11T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "lease_up_schedule",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "model_type": "natural_turnover",
  "period_granularity": "quarterly",
  "stabilization_target": "2027-Q4",
  "assumptions": {
    "monthly_turnover_rate": 0.04,
    "market_rent_psf_at_stabilization": 22.00,
    "vacancy_during_lease_up": 0.18,
    "concession_months_per_lease": 1,
    "tenant_improvement_psf": 35.00,
    "leasing_commission_rate": 0.06
  },
  "schedule": [
    { "period": "2026-Q3", "occupied_sf": 31000, "leased_sf": 31000, "in_place_rent_psf": 21.50, "market_rent_psf": 22.00, "vacancy_rate": 0.27, "rent_revenue": 166375, "concessions": -5400, "ti_lc_capex": -42500, "net_cash_flow": 118475 },
    { "period": "2026-Q4", "occupied_sf": 34000, "leased_sf": 35500, "in_place_rent_psf": 21.65, "market_rent_psf": 22.00, "vacancy_rate": 0.20, "rent_revenue": 184025, "concessions": -8100, "ti_lc_capex": -52500, "net_cash_flow": 123425 }
  ],
  "stabilized_summary": {
    "occupied_sf": 40500,
    "occupancy_rate": 0.953,
    "annualized_egi": 858000,
    "annualized_noi": 478000
  }
}
```

**Deliberately deferred (RFC 0008).** Excel emit of a Lease-Up sheet; a `dcf` coupling (`derive_dcf_from_lease_up`); defaults-table entries; and a shared period-schedule primitive. If a later module (e.g. a hospitality RevPAR ramp) wants a period schedule, it SHOULD reuse this section's period grammar rather than invent a second one — noted so the two cannot drift, but no abstraction is built ahead of the second consumer.

---

### § 4.26 — Cash Flow Series

**ID:** `cash_flow_series`  
**Header:** `## Cash Flow Series {#cash_flow_series}`  
**Purpose:** A **dated, irregular** cash-flow series — ISO-8601 calendar dates and signed amounts — for hold-period modeling on real calendars: mid-month closings, irregular draws, anniversary exits. `lease_up_schedule` (§ 4.25) carries *period-cadence* rows on a uniform monthly/quarterly axis; this section carries flows anchored to *calendar dates*, which is a different contract (cadence vs. calendar) and deliberately a different section. The section is **asset-class independent** and **multi-variant**: base / upside / downside scenarios coexist under `variant=` exactly as `stress_tests` variants do.  
**Written by:** `wizard`, `manual`, `agent/L4-*` (an agent MAY draft a series — e.g. from a vendor projection engine — but the host stamps `agent/<id>` and the stated figures remain subject to verification)  
**Required for pipeline stage:** Optional; never required. A deal underwritten on stabilized annual figures alone legitimately has no dated series.  
**Dependencies:** none required; `dcf` (§ 4.9) is a natural sibling but no cross-check is defined by RFC 0034 (deferred — see the RFC's unresolved questions).  
**Schema:** [`spec/schemas/section-cash-flow-series.schema.json`](schemas/section-cash-flow-series.schema.json)  
**Introduced by:** RFC 0034 (calendar-anchored cash flows).

Like `capital_stack` (§ 4.24) and `lease_up_schedule` (§ 4.25), this is a **state-and-verify** structure (RFC 0021 § 6): the calc engine never reads the series by pack formula, so the variable-length array is safe, and every stated aggregate is recomputed by a deterministic verifier (`verifyCashFlowSeries`, a sibling of `verifyCapitalStack` and `verifyLeaseUpSchedule`) over a **fixed, closed recompute vocabulary** (Protocol § VIII.9). The series is **data, not formulas**. Rows are read by the verifier and by host code, **not** by pack formulas: calc paths are flat identifiers, so `cash_flow_series.series[3].amount` does not parse and raises `CALC-PARSE-001` (corrected by RFC 0055).

**Fields.**

- `label` — free text ("Levered hold-period cash flow"). Optional.
- `day_count` — one of the closed Protocol § VIII.9.1 registry: `actual/365f` (the default when absent), `actual/360`, or `30/360us`. Governs every year-fraction this section's metrics use.
- `series` — one entry per flow: `date` (ISO-8601 `YYYY-MM-DD`), `amount` (signed; outflows negative), optional `kind` (closed: `acquisition | operating | capex | debt_service | refinance | disposition | other`), optional `label`. `kind` is advisory taxonomy for renderers and rollups; it gates no rule.
- `stated_metrics` — the stated aggregates, all optional, each verified when present:
  - `total_net` — `Σ amount` (currency).
  - `moic` — `Σ inflows ÷ |Σ outflows|` (multiple).
  - `xnpv` — `{ "rate": <fraction>, "value": <number> }` (currency; the rate is a fraction, `0.08` never `8`).
  - `xirr` — the annualized rate (fraction).

**Normative rules (RFC 2119):**

- The section is OPTIONAL. A document with no `cash_flow_series` behaves exactly as before RFC 0034; no pipeline stage requires it (`STAGE_CONTRACT` untouched).
- **Row grammar (`CF-01`, error).** Every `date` MUST be a valid ISO-8601 calendar date (`YYYY-MM-DD` naming a real day — `2026-02-30` refuses); every `amount` MUST be a finite number. An unknown `day_count` or `kind` MUST be refused (closed enums).
- **Ordering (`CF-02`, error).** `series` MUST be non-empty and dates MUST be non-decreasing. Same-day flows are legal (a closing and its first draw share a date). They MUST NOT be merged, netted, reordered or collapsed merely because their dates are equal — each row keeps its identity through existing row-binding surfaces. Duplicate dates alone MUST NOT produce PS-02. Ordinary date selectors require a unique matching row and otherwise refuse CALC-PERIOD-002 (Protocol §VIII.2a, RFC 0062); this adds no numeric-index calc grammar. The first row's date is the series **anchor**.
- **A stated `xirr` needs a sign change (`CF-03`, error).** A stated `xirr` on a series whose amounts do not include at least one negative and at least one positive value MUST be refused: the stated number cannot be the root of anything.
- **Stated figures are verified, never trusted.** A verifier MUST recompute, three-state (`verified` / `failed` / `unverifiable`), quantizing both sides at the same quantum (Protocol § VIII.5 posture; § VIII.9.4): `total_net` and `moic` directly; `xnpv` closed-form at the stated `rate` (§ VIII.9.2); `xirr` by the § VIII.9.3 procedure. A stated metric whose recomputation *raises* (an `xirr` that fails to bracket) is `failed` — the document asserts a number the procedure cannot produce. A `moic` stated on a series with no outflows is `unverifiable` (an undefined ratio is not evidence of tampering). A metric absent from `stated_metrics` is simply not checked.

```json uw:section=cash_flow_series variant=base source=manual ts=2026-10-11T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "cash_flow_series",
    "provenance": {
      "source": "manual",
      "actor": "example-author",
      "timestamp": "2026-10-11T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "label": "Levered hold-period cash flow",
  "day_count": "actual/365f",
  "series": [
    { "date": "2026-03-17", "amount": -14250000, "kind": "acquisition", "label": "Close" },
    { "date": "2026-09-30", "amount": 412000, "kind": "operating" },
    { "date": "2027-03-31", "amount": 431000, "kind": "operating" },
    { "date": "2027-06-15", "amount": -350000, "kind": "capex", "label": "Roof + amenity" },
    { "date": "2031-03-17", "amount": 19800000, "kind": "disposition", "label": "Exit" }
  ],
  "stated_metrics": {
    "total_net": 6043000,
    "moic": 1.4139,
    "xnpv": { "rate": 0.06, "value": 1022812.04 },
    "xirr": 0.075239
  }
}
```

*(The stated metrics above were computed by the reference verifier, not
asserted — `moic` at the 4-decimal ratio quantum, `xnpv` at the currency
quantum, `xirr` at the 6-decimal rate quantum.)*

**Deliberately deferred (RFC 0034).** Excel emit — Excel's `XIRR` is Newton-seeded, so a live `=XIRR(...)` formula cannot hold the bit-exact parity boundary the ROUND-wrapped closed-form formulas do; if a Cash Flow sheet is ever emitted, stated/computed metrics land as literals, by an RFC that takes that exception knowingly. Also deferred: a `dcf` cross-check and defaults-table entries. The RFC 0026 Phase 2 distribution waterfall — whose stated precondition this section removed — was taken up as RFC 0035 (§ 4.27).

---

### § 4.27 — Distribution Waterfall

**ID:** `distribution_waterfall`  
**Header:** `## Distribution Waterfall {#distribution_waterfall}`  
**Purpose:** The tiered split of a deal's equity cash flows between the aggregate **LP** and the **GP** — return of capital, a preferred return accrued under a day-count convention, a GP catch-up, and residual promote splits. This is the partnership half of the underwriting: `capital_stack` (§ 4.24) is the liability side at one point in time (RFC 0033), and this section is the equity side over the hold — which is why the § 4.24 `CS-WATERFALL-UNSUPPORTED` boundary stays: partnership tiers never live inside the debt stack. The section is **asset-class independent** and **multi-variant** (`variant=` per the `stress_tests` rules).  
**Written by:** `wizard`, `manual`, `agent/L4-*` — with one prohibition mirroring § 4.24's: an agent MUST NOT invent tier terms, splits, or hurdle levels; they are partnership terms from the operating agreement.  
**Required for pipeline stage:** Optional; never required. A single-party deal legitimately has no waterfall.  
**Dependencies:** `cash_flow_series` (§ 4.26) — the referenced variant is the cash vector (`WF-02`).  
**Schema:** [`spec/schemas/section-distribution-waterfall.schema.json`](schemas/section-distribution-waterfall.schema.json)  
**Introduced by:** RFC 0035 (distribution waterfall); the shape was documented and deferred by RFC 0026 §E. `until_lp_irr` by RFC 0036. `clawback` by RFC 0059.

Like § 4.24 – § 4.26 this is a **state-and-verify** structure (RFC 0021 § 6) — the fourth: the document states the ladder and the outcomes, and a deterministic verifier (`verifyWaterfall`) **recomputes the entire allocation** — period by period, tier by tier — by the normative Protocol § VIII.10 procedure, so two conforming engines agree on the promote. The Tier-3 calc engine is untouched.

**Fields.**

- `cash_flow_ref` — `{ "variant": "<name>" }`: the § 4.26 variant holding the **equity** cash vector. Negative amounts are contributions (capital calls); positive amounts are distributable cash. The series' own `day_count` governs every year fraction here.
- `equity_split` — `{ "lp": 0.90, "gp": 0.10 }`: each party's share of every contribution, summing to 1.0 (ratio quantum). The GP share is co-invest; the promote comes from the tiers.
- `tiers` — the ordered ladder, closed `type` vocabulary, in this order (any of the first three MAY be absent; each of the first three appears at most once; at least one `split`):
  1. `return_of_capital` — pro-rata by unreturned contributed capital.
  2. `preferred_return` — `{ "rate": 0.09, "accrual": "simple" | "compound_annual" }`: accrues on each party's unreturned capital pari passu; paid pro-rata by accrued balance. `rate` is a fraction in (0, 1).
  3. `catch_up` — `{ "gp_share": 1.0, "target_promote": 0.20 }`: `gp_share` of this tier's cash goes to the GP until GP cumulative **profit** reaches `target_promote` of total profit distributed. Profit means distributions above returned capital; **pref receipts count as profit** (Protocol § VIII.10 — excluding them would give a catch-up that follows the pref tier capacity zero forever). `gp_share` MUST exceed `target_promote` (otherwise the tier can never fill — a grammar refusal, not a runtime case).
  4. `split` — `{ "lp_share": 0.80, "gp_share": 0.20, "until_lp_em": 1.5, "until_lp_irr": 0.12 }`: residual split; `lp_share + gp_share` MUST sum to 1.0 (ratio quantum). The optional `until_lp_em` (> 0) caps the tier where cumulative LP distributions reach that multiple of LP contributions to date. The optional `until_lp_irr` (a fraction in (0, 1)) caps the tier where the LP's dated flows — every contribution and distribution to date, including this tier's payment at this row's date — reach that internal rate of return under the series' day count (Protocol § VIII.10, the **hurdle balance**: closed-form, never a nested solve). `until_lp_em` and `until_lp_irr` MAY both be stated on one tier; the tier then ends only when **both** hurdles are met (the larger capacity governs) unless `hurdle_mode: "any"` is specified (the smaller capacity governs; RFC 0051). Stating `hurdle_mode` on a tier that does not state both hurdles is an error (`WF-01`). A capped split MUST have `lp_share > 0` whichever hurdle caps it (a cap on a tier that pays the LP nothing can never bind). The final tier MUST be a `split` uncapped by either field. Across the ladder, successive stated `until_lp_irr` values MUST strictly increase, as MUST successive stated `until_lp_em` values (a later tier hurdled at or below an earlier one has capacity zero by construction and would pay nothing, silently).
- `clawback` — optional (RFC 0059): the terminal true-up provision. `{ "basis": "lp_preferred_shortfall | lp_irr_floor | lp_em_floor", "floor_rate": null, "floor_multiple": null, "net_of_tax_rate": null, "cap": "promote_received" }`. `basis` is a **closed vocabulary**; `lp_irr_floor` requires `floor_rate` and `lp_em_floor` requires `floor_multiple` (`WF-10`), `lp_preferred_shortfall` requires a `preferred_return` tier to fall short of (`WF-11`). `cap` MUST be `"promote_received"` (`WF-12`) — a GP cannot owe back more promote than it received, and any other cap is a different instrument. `net_of_tax_rate` is a fraction in `[0,1)` (`WF-13`), **stated and applied, never derived**: this section does not model the GP's tax position. A provision stated over a series with no distribution is `WF-15`, a warning, since the provision may legitimately precede the exit.
- `stated_outcomes` — the headline claims, all optional, each verified when present: `lp` / `gp` objects with `contributions`, `distributions`, `moic`, `xirr`; plus `promote_total`, `profit_total` and `clawback_amount` (RFC 0059). A stated `clawback_amount` on a waterfall declaring no `clawback` provision is `unverifiable`, not a disagreement — there is no recomputed figure to compare it to.
- `stated_schedule` — optional: one entry per distribution date — `{ "date": "YYYY-MM-DD", "by_tier": [{ "tier": 0, "lp": 118475.0, "gp": 13163.9 }] }`, tier indexes into `tiers`. When present it MUST match the recomputed allocation cell-for-cell (an absent cell reads as 0); when absent only `stated_outcomes` are checked. Either way the verifier recomputes the full allocation — the schedule is display detail, not the source of truth.

**Normative rules (RFC 2119):**

- The section is OPTIONAL; no pipeline stage requires it (`STAGE_CONTRACT` untouched).
- **Ladder grammar (`WF-01`, error).** As above: closed types, singleton and ordering rules, a terminal `split` uncapped by either hurdle, shares in [0, 1] with the stated sums, `rate` in (0, 1), `until_lp_em` > 0, `until_lp_irr` in (0, 1), capped splits paying the LP, `hurdle_mode` in ["both", "any"] only when both hurdles are stated, successive hurdles of one kind strictly increasing (compared at the ratio / rate quantum respectively), `gp_share > target_promote`, and `equity_split` summing to 1.0.
- **The reference must resolve (`WF-02`, error).** `cash_flow_ref.variant` MUST name a variant present in the document's `cash_flow_series`. A waterfall without its cash vector is not reviewable.
- **A waterfall needs capital (`WF-03`, error).** The referenced series MUST contain at least one negative amount; over pure inflows every tier is vacuous.
- **Stated figures are verified, never trusted.** `verifyWaterfall` recomputes by Protocol § VIII.10, three-state, both sides quantized at the § VIII.9.4 quanta (`$` → 2, `x` → 4, `%` → 6): outcomes and schedule cells against the recomputed allocation; a stated `xirr` whose recomputation raises (§ VIII.9.3 refusal — e.g. a zero-contribution party) is `failed`; a `moic` over zero contributions is `unverifiable`; an unresolvable or structurally invalid referenced series makes every stated figure `unverifiable`, never a guess.

**Stated-claim admission (`WF-16`, RFC0096).**

Allocate exactly the following:

| Field/object | Predicate |
|---|---|
| stated_outcomes | Optional nullable object, closed to lp, gp, promote_total, profit_total, clawback_amount |
| stated_outcomes.lp / gp | Optional nullable objects, closed to contributions, distributions, moic, xirr |
| each party's contributions, distributions, xirr | Optional nullable finite signed number |
| each party's moic | Optional nullable finite number >=0 |
| promote_total, profit_total, clawback_amount | Optional nullable finite signed number |
| stated_schedule | Optional nullable array; empty valid |
| stated_schedule[i] | Object closed to required date and by_tier |
| stated_schedule[i].date | Required string matching exactly four ASCII digits, hyphen, two ASCII digits, hyphen, two ASCII digits |
| stated_schedule[i].by_tier | Required array; empty valid |
| by_tier[j] | Object closed to required tier plus optional nullable lp and gp |
| by_tier[j].tier | Integer >=0 |
| by_tier[j].lp / gp | Optional nullable finite signed number |
| clawback.floor_rate | Optional nullable finite (0,1), when not already owned by selected-basis WF-10 |
| clawback.floor_multiple | Optional nullable finite >1, when not already owned by selected-basis WF-10 |
| clawback object | Closed to basis, floor_rate, floor_multiple, net_of_tax_rate, cap |

WF-10 retains clawback carrier/basis and selected-floor presence/domain;
WF-11 preferred-tier precondition; WF-12 cap; WF-13 tax fraction; WF-15 warning.
Malformed clawback parents stop WF-16 descendants. WF-01 ladder/equity split,
WF-02 source reference and WF-03 contribution keep their existing owners.
No claim is generated from an absent leaf, no distribution date/tier is inferred,
and no balance is recomputed. The structural tier integer predicate does not
add a new index-range or duplicate-cell financial interpretation.

The stated_schedule date predicate is lexical admission only. Its synchronized
schema assertion MUST consume the entire ASCII digit/hyphen string, including
rejection of trailing line endings. Explicit absolute-end guards preserve this
contract across validator regex engines; no optional format plugin defines it. Its existing
schema has a digit pattern, no format:date assertion. This RFC does NOT
transplant RFC0095's as_of Gregorian/year profile, RFC0094's T1B timestamp or
REC-04's separate date owner. A date-shaped impossible calendar value's
financial comparison/refusal remains the existing verifier's responsibility.
Any broader calendar requirement needs an explicit governed decision and
cross-runtime vectors; the WIP's stronger local date check cannot supply it.

**Deliberately deferred (RFC 0035, RFC 0036, RFC 0051, RFC 0059).** N-party splits, Excel emit (the § 4.26 literals posture), a `capital_stack` cross-check (waterfall contributions vs. the common-equity tranche), and GP-side hurdles (RFC 0051 lifted `hurdle_mode: "any"` into the normative contract; RFC 0059 took clawback as a terminal true-up, leaving per-period crystallization and interim promote escrows deferred).

---

### § 4.28 — Property Reserve Accounts (RFC 0064)

**ID:** `reserve_accounts`  
**Header:** `## Property Reserve Accounts {#reserve_accounts}`  
**Purpose:** Source-attributable stated property cash custody; asset-class independent and multi-variant.  
**Written by:** `manual`, `wizard`, `agent/L4-*` — source extraction only; agents never reconcile balances or invent classifications.  
**Required for pipeline stage:** Optional; never required.  
**Dependencies:** None.  
**Introduced by:** RFC 0064.

The optional, asset-class-independent standard section `reserve_accounts`
records property cash custody. Its closed payload is `{accounts: [...] }`
(nonempty), beside the universal `_meta`, `_role` and `_notes` members.
The normative structural schema is
[section-reserve-accounts.schema.json](schemas/section-reserve-accounts.schema.json).
This section is optional and never required.

Each account states `account_id`, `class: "property_reserve"`, `purpose`,
`owner` (economic owner), `currency_code` (three uppercase letters),
`source`, and a nonempty ordered `periods` array. Currency MUST agree with
frontmatter currency when stated there; there is no FX or mixed-currency
aggregation. Each account is verified independently. `lender_reserve` and
lender financing escrows are outside this contract.

Each period states `period_id`, real `start_date` and `end_date` calendar
bounds, finite nonnegative `opening_balance` and `ending_balance`,
`source`, and an explicit `movements` array. An empty array is an authored
statement of no movements; omission or null is refused. Period dates MUST be
ordered without overlap, with strictly increasing starts; adjacent statements
MAY share a boundary. These are source dates, not generated period buckets.
Optional `previous_period_id` explicitly claims opening/ending continuity
with the immediately preceding stated period, whose ID it MUST name. Omission
makes no continuity claim; no missing periods or dates are inferred.

Each movement states `movement_id`, real `date` within the inclusive
opening/closing bounds, `kind`, finite nonnegative `amount`,
`counterparty`, and `source`. Dates MUST be nondecreasing; same-day rows
stay separate, ordered, and counted once. Account IDs are unique within a
section, period IDs within an account, and movement IDs within a period.
Accounts and variants remain independent; no cross-account totals are derived.

Every `source` is a closed `{document, locator}` object of nonblank strings.
It identifies attributable evidence for the account identity/owner, the stated
period balances, or the individual movement and its boundary/classification.
The host-owned block `_meta` remains unchanged. The producer MUST establish
movement meaning from the referenced source, never from labels or amounts:

| Closed kind | Source-established meaning |
|---|---|
| `contribution` | Cash entering custody from outside the property reserve account, with its funding counterparty identified. |
| `internal_draw` | Custody cash paying separately stated gross property expenditure, with the payee identified. The economic expenditure remains gross. |
| `external_release` | Custody cash returned to the stated economic owner, separately from gross sale proceeds. |

A source that does not establish a class MUST remain unclassified and refuse;
unknown kinds (including bank interest), absent classes, and lender reserves
MUST NOT be coerced into this vocabulary. Source pointers and an arithmetic
match do not authenticate evidence or prove its completeness. Binding a draw
to a gross expenditure row belongs to RFC 0065, outside this contract.

Ordinary document validation performs structural checks only:

- `RSV-01` — malformed closed object, missing explicit fact/provenance, invalid amount or currency.
- `RSV-02` — duplicate account, period or movement identity.
- `RSV-03` — invalid or out-of-bounds calendar dates.
- `RSV-04` — unsupported account class or unclassified/unknown movement kind.
- `RSV-05` — unordered/overlapping periods, unordered movements or invalid explicit predecessor.

Separately invoked Protocol §VIII.11 verification checks the balance identity
and any explicitly claimed continuity. It emits `RSV-06` for an ending
balance disagreement, `RSV-07` for continuity disagreement and `RSV-08`
for nonfinite arithmetic/quantization. These are verifier findings, never
ordinary structural-validation findings. Absent account data emits no RSV
finding and makes no account-state claim. Nothing alters RFC 0045's
`reserve_spending_excluded` refusal, cash-flow rows, NOI deductions or gross
expenditure. No interest accrual, forecast, cash-boundary assembly or derived
release is provided.

---

RFC 0065 supplies an optional external draw-to-gross-expenditure binding plan
and separately invoked verifier (Protocol §VIII.12), using the stated §4.28
identities. It adds no document field or section requirement and changes no
gross amount or RFC 0045 reserve refusal. See the
[plan schema](schemas/reserve-draw-binding-plan.schema.json) and
[result schema](schemas/reserve-draw-binding-verification.schema.json).

### Official class sections (RFC 0080, RFC 0081)

These additive sections use the same bare block body and role/variant resolution as existing standard sections. Fixed field contracts are enforced by core (CLS-03 missing required section, CLS-04 invalid stated field). The normative schemas below govern their payloads; additional annotations do not change the calculations. Primary size is always stated on property, never synthesized: `critical_it_load_kw` for data centers and `total_sites` for manufactured housing. The matching detailed-section quantity must agree exactly when both are stated.

### 4.29 Capacity & Topology

**ID:** `dc_capacity`

**Class:** `data_center`. **Presence:** required.

**Normative schema:** [section-dc-capacity.schema.json](schemas/section-dc-capacity.schema.json).

| Field | Type / constraint |
|---|---|
| `critical_it_load_kw` | number; {'minimum': 0} |
| `planned_it_load_kw` | number; {'minimum': 0} |
| `contracted_it_load_kw` | number; {'minimum': 0} |
| `utility_feed_kw` | number; {'minimum': 0} |
| `design_pue` | number; {'minimum': 1} |
| `measured_pue` | ['number', 'null']; {'minimum': 1} |
| `redundancy` | string; {'enum': ['n', 'n_plus_1', 'n_plus_2', '2n', '2n_plus_1']} |
| `raised_floor_sf` | ['integer', 'null']; {'minimum': 0} |
| `design_density_kw_per_rack` | ['number', 'null']; {'minimum': 0} |
### 4.30 Power Economics

**ID:** `dc_power`

**Class:** `data_center`. **Presence:** optional.

**Normative schema:** [section-dc-power.schema.json](schemas/section-dc-power.schema.json).

| Field | Type / constraint |
|---|---|
| `utility_rate_per_kwh` | number; {'minimum': 0} |
| `billing` | string; {'enum': ['metered_pass_through', 'all_in', 'breakered']} |
| `power_margin` | ['number', 'null']; {'minimum': 0} |
| `stated_annual_power_cost` | ['number', 'null']; {'minimum': 0} |
### 4.31 Revenue

**ID:** `dc_revenue`

**Class:** `data_center`. **Presence:** optional.

**Normative schema:** [section-dc-revenue.schema.json](schemas/section-dc-revenue.schema.json).

| Field | Type / constraint |
|---|---|
| `lease_type` | string; {'enum': ['powered_shell', 'wholesale_turnkey', 'retail_colocation', 'hyperscale_build_to_suit']} |
| `rent_per_kw_month` | number; {'minimum': 0} |
| `interconnection_revenue_annual` | number; {'minimum': 0} |
| `services_revenue_annual` | number; {'minimum': 0} |
| `market_rent_per_kw_month` | ['number', 'null']; {'minimum': 0} |
### 4.32 Hotel Operating Metrics

**ID:** `hotel_metrics`

**Class:** `hospitality`. **Presence:** optional.

**Normative schema:** [section-hotel-metrics.schema.json](schemas/section-hotel-metrics.schema.json).

| Field | Type / constraint |
|---|---|
| `market_revpar` | ['number', 'null']; {} |
### 4.33 Brand & Franchise

**ID:** `hotel_brand`

**Class:** `hospitality`. **Presence:** optional.

**Normative schema:** [section-hotel-brand.schema.json](schemas/section-hotel-brand.schema.json).

| Field | Type / constraint |
|---|---|
| `flag` | ['string', 'null']; {} |
| `franchise_fee_pct_of_rooms` | number; {'minimum': 0, 'maximum': 0.2} |
| `marketing_fund_pct` | number; {'minimum': 0, 'maximum': 0.1} |
| `loyalty_program_pct` | number; {'minimum': 0, 'maximum': 0.1} |
| `term_years` | ['integer', 'null']; {'minimum': 0} |
### 4.34 Food & Beverage

**ID:** `hotel_food_beverage`

**Class:** `hospitality`. **Presence:** optional.

**Normative schema:** [section-hotel-food-beverage.schema.json](schemas/section-hotel-food-beverage.schema.json).

| Field | Type / constraint |
|---|---|
| `fb_revenue` | number; {'minimum': 0} |
| `fb_cogs` | number; {'minimum': 0} |
| `fb_labor` | number; {'minimum': 0} |
| `complimentary_breakfast_cost_per_occupied_room` | number; {'minimum': 0} |
### 4.35 Manufactured Housing Sites

**ID:** `mhc_sites`

**Class:** `manufactured_housing`. **Presence:** required.

**Normative schema:** [section-mhc-sites.schema.json](schemas/section-mhc-sites.schema.json).

| Field | Type / constraint |
|---|---|
| `total_sites` | integer; {'minimum': 1} |
| `occupied_sites` | integer; {'minimum': 0} |
| `park_owned_homes` | integer; {'minimum': 0} |
| `weighted_pad_rent_monthly` | number; {'minimum': 0} |
| `poh_home_rent_monthly` | ['number', 'null']; {'minimum': 0} |
| `as_of_date` | presence only; calendar/date validity is deferred |

POH home rent is required and numeric when `park_owned_homes > 0`; it is absent or null when no homes are park-owned. Zero pad or home rent is permitted. `as_of_date` is presence-only in this scope.

### Class verification rules

Rules use Protocol §VIII.1 safe expressions. A false result emits the listed finding; absent inputs do not become zero. A type/evaluation error emits MOD-RULE-ERROR. Reporting and statement comparisons use the dictionary and existing §VIII.5 quantizer.

| Code | Severity | Assertion |
|---|---|---|
| `CC-DC-01` | error | `dc_capacity.design_pue >= 1` |
| `CC-DC-02` | warning | `dc_capacity.design_pue <= 1.6` |
| `CC-DC-03` | error | `dc_capacity.critical_it_load_kw <= dc_capacity.planned_it_load_kw` |
| `CC-DC-04` | warning | `dc_capacity.contracted_it_load_kw <= dc_capacity.critical_it_load_kw` |
| `CC-DC-05` | warning | `facility_load_kw <= dc_capacity.utility_feed_kw` |
| `CC-DC-06` | warning | `dc_capacity.measured_pue == null &#124;&#124; dc_capacity.measured_pue <= dc_capacity.design_pue * 1.15` |
| `CC-DC-07` | warning | `dc_revenue.market_rent_per_kw_month == null &#124;&#124; rent_index >= 0.85` |
| `CC-HOSP-01` | warning | `hotel_metrics.market_revpar == null &#124;&#124; revpar >= hotel_metrics.market_revpar * 0.85` |
| `CC-HOSP-02` | error | `rent_roll.occupancy == null &#124;&#124; (rent_roll.occupancy >= 0 && rent_roll.occupancy <= 1)` |
| `CC-HOSP-03` | warning | `hotel_brand.franchise_fee_pct_of_rooms + hotel_brand.marketing_fund_pct + hotel_brand.loyalty_program_pct <= 0.13` |
| `CC-HOSP-04` | warning | `hotel_metrics.market_revpar` is stated but RevPAR (`noi_model.income.rooms_revenue / rent_roll.available_room_nights`) is uncomputable, so `CC-HOSP-01` is not evaluated. The finding names the missing canonical inputs; RevPAR is never inferred from ADR × occupancy. |
| `CC-MH-01` | error | `mhc_sites == null &#124;&#124; (mhc_sites.total_sites != null && mhc_sites.total_sites >= 1 && round(mhc_sites.total_sites, 0) == mhc_sites.total_sites)` |
| `CC-MH-02` | error | `mhc_sites == null &#124;&#124; (mhc_sites.occupied_sites != null && mhc_sites.occupied_sites >= 0 && round(mhc_sites.occupied_sites, 0) == mhc_sites.occupied_sites && mhc_sites.occupied_sites <= mhc_sites.total_sites)` |
| `CC-MH-03` | error | `mhc_sites == null &#124;&#124; (mhc_sites.park_owned_homes != null && mhc_sites.park_owned_homes >= 0 && round(mhc_sites.park_owned_homes, 0) == mhc_sites.park_owned_homes && mhc_sites.park_owned_homes <= mhc_sites.total_sites)` |
| `CC-MH-04` | error | `mhc_sites == null &#124;&#124; (mhc_sites.weighted_pad_rent_monthly != null && mhc_sites.weighted_pad_rent_monthly >= 0)` |
| `CC-MH-05` | error | `mhc_sites == null &#124;&#124; mhc_sites.as_of_date != null` |
| `CC-MH-06` | error | `mhc_sites == null &#124;&#124; mhc_sites.park_owned_homes != 0 &#124;&#124; mhc_sites.poh_home_rent_monthly == null` |
| `CC-MH-07` | error | `mhc_sites == null &#124;&#124; mhc_sites.park_owned_homes == null &#124;&#124; mhc_sites.park_owned_homes <= 0 &#124;&#124; (mhc_sites.poh_home_rent_monthly != null && mhc_sites.poh_home_rent_monthly >= 0)` |
| `CC-DC-08` | error | Stated property critical IT kW equals stated dc_capacity critical IT kW. |
| `CC-MH-08` | error | Stated property sites equal stated mhc_sites total_sites. |
| `CLS-03` | error | A required official class section is absent. |
| `CLS-04` | error | A stated official field violates its fixed field contract; hospitality rent_roll requires available_room_nights when stated. |

---

## Part V — Validation Rules

### 5.1 Pipeline Stage Completeness Requirements

The following sections must be present (non-null) before advancing to each stage:

| Stage | Required Sections |
|---|---|
| **Scope** | `property` (see also the field-level scope requirements, Protocol §III.6a / `DQ-04`) |
| **Screening** | + `debt_structure` (amounts only), `validation` |
| **Term Sheet** | + `rent_roll`, `borrower_sponsor` (principals only), `preliminary_sizing` |
| **Full Underwrite** | + `operating_statement` (T-12), `noi_model`, `valuation`, `sources_uses`, `market_analysis` |
| **Credit Approval** | + `dcf`, `stress_tests`, `risk_assessment`, `compliance`, `assumptions` |
| **Closing** | + `due_diligence` (all items cleared), `debt_structure` (final terms) |
| **Portfolio Monitoring** | Same section list as Closing |

This table is machine-checked (RFC 0028): a validator MUST compute
`stage_readiness` from it, and MUST report each section the *declared*
`deal_stage` requires but the file lacks as a `DQ-06` **info** issue — a
declared stage is where the deal is going, so the gap is reportable but not
refusable. A missing `property` section is `CC-14` (§5.3) instead, at every
stage. Freshness obligations that earlier revisions listed under Monitoring
("updated `operating_statement` annually", "re-run `validation`") are not
expressible as section presence; staleness belongs to the `DQ-05` machinery
(§4.22) and institution policy.

**Class overlays (RFC 0029).** The base lists assume an income property with
direct tenancy. Two asset classes diverge structurally, and for them a
validator MUST adjust the requirements as follows — exhaustively; an asset
class not listed here (including an unrecognized one) takes the base lists
verbatim:

| `asset_class` | Adjustment |
|---|---|
| `land` | `rent_roll` and `operating_statement` are **exempt** at every stage: raw land has no tenancy and no operating statement — its carry lives in `noi_model` and `dcf`, and nothing stands in for the exempted sections. |
| `mixed_use` | `components` **substitutes** for `rent_roll` and `operating_statement`: wherever a stage's base list requires either, the requirement is satisfied by (and only by) a `components` section, which §4.23 already makes the home of per-component income and operating detail. |

A substitution is checkable — the substitute section is *required* at the
stage where the replaced section would have been (a substitute replacing two
sections is required once) — where an exemption simply removes the
requirement. `stage_readiness` and `DQ-06` MUST resolve through the same
overlay, and `CC-14` is unaffected: `property` is never exempt for any
class. Section ids remain class-neutral containers otherwise: hospitality's
`rent_roll` carries keys/ADR/segmentation, senior housing's carries
unit/acuity mix, a data center's carries its kW leases and a manufactured-housing
community's its site/pad mix, and no overlay entry exists for them because
reuse is the design, not a gap. The RFC 0080 builtins (`data_center`,
`manufactured_housing`) take the base lists verbatim, exactly as multifamily
does: their class sections (`dc_capacity`, `mhc_sites`) are required by the
class (`CLS-03`), never substituted for `rent_roll`.

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
| `CC-13` | The property section must state the primary size field for `frontmatter.asset_class` (Protocol §XIII.1) (RFC 0027) | `property`, frontmatter |
| `CC-14` | A deal-record document must have a `property` section (§4.1) (RFC 0028) | `property` |
| `CC-15` | The lease-up base variant's `stabilized_summary.annualized_noi` must agree with `noi_model.net_operating_income` within `LEASE_UP_STABILIZED_TOLERANCE` (2%) (RFC 0008) | `lease_up_schedule`, `noi_model` |
| `CC-16` | A section a cross-check reads is present as multiple variants and none resolves under the §5.3 preference order; the checks reading it were skipped (`info`) (RFC 0037) | any |

**Resolution over variant maps (RFC 0037 / RFC 0040).** A cross-check
reads one block per section. Exclude component-role blocks and invalid roles
before every selection step, including standalone/default/base/sole paths.
For eligible variants, try (1) explicit check preference (`t12` on CC-01's
operating statement, `appraisal` on CC-08's due diligence); (2) unique check
role; (3) unique `primary`; (4) `default`; (5) `base`; (6) sole eligible
variant. CC-01 prefers `detail` on rent_roll; CC-02/03/05/09 prefer `senior`
on debt_structure. The rate-hedge and escrow rules `HDG-01`–`HDG-10` and
`ESC-04` (§4.7/§4.8) also prefer `senior` on debt_structure, as one shared
selection, so a hedge is read from the senior loan (RFC 0075). All of these
are registered in `CROSS_CHECK_ROLE_PREFERENCE`. A consulted role collision
MUST refuse immediately, without fallback. An earlier successful key selection
does not consult later roles. Repeated components are allowed but excluded.

Eligible standalone blocks resolve as `single`. CC-15 keeps its base/default
lease-up scenario exception; roles cannot choose another scenario. Its selected
schedule must still be eligible. Existing direct reads observe roles when
present, with their role-free behavior preserved. CC-14 checks section presence.
No arithmetic, tolerance, tranche aggregation or scenario averaging changes.

If resolution fails, record `variant_unresolvable` coverage and emit `CC-16`
once per section, naming affected checks in sorted order. Role-bearing
diagnostics state the collision or eligibility failure; role-free messages
remain unchanged. A multi-leg check may evaluate another leg, so this issue
does not imply that every affected check was wholly skipped.

**Role selection evidence (RFC 0040).** Optional coverage `resolutions` maps
section ids to `{ variant?, via }`, where `via` is `preference`, `role`,
`primary`, `default`, `base`, `sole`, or `single`. Emit it only for selections
from sections bearing roles, even when a later field check skips comparison.
Multi-section checks record selections separately. Role-free coverage has no
new fields. Constants, reporting and diagnostics do not alter financial math.

**Coverage (RFC 0037).** A conforming validator MUST report, alongside its
issues, a **coverage** record for every `CC-NN` check it registers
(`CROSS_CHECK_RULE_IDS`): `evaluated` when the comparison was actually
performed, whether or not it produced an issue; or `skipped` with one of
four reasons — `section_absent`, `variant_unresolvable`, `field_absent`,
`not_applicable` — and a short detail naming the section, field or
precondition. A check with no coverage entry is a check the validator does
not implement. Coverage is reporting, not a verdict: it never changes
`overall_status`. It exists because a document whose reconciliation checks
all no-opped is indistinguishable from a reconciled one without it.

**Asset-class identifier codes (RFC 0003).** These sit outside the
`CC-NN` sequence deliberately: they are about the *identifier*, not a
disagreement between two sections, and grouping them with cross-section
consistency checks would misfile them for anyone filtering by prefix.

| Code | Severity | Rule |
|---|---|---|
| `INVALID-ASSET-CLASS-001` | error | `asset_class` is neither a builtin nor a well-formed namespaced identifier (§2.2a). |
| `INVALID-ASSET-CLASS-002` | error | A namespaced identifier whose final segment shadows a builtin name (§2.2a). |
| `MOD-DEPENDENCY-UNDECLARED` | warning | A namespaced `asset_class` with no frontmatter `modules` list naming what declares it, or a `modules` entry that is not an object with an `id` (§2.2a). |

Resolution-time findings — `MOD-FALLBACK-001`, `MOD-MISSING-001`,
`MOD-ASSET-CLASS-CONFLICT-001`, `MOD-DISPLAY-CONFLICT-001` — are **not**
validation rules and do not appear here. They depend on which modules a
particular host has loaded, so the same document would validate
differently for different readers; they belong to Protocol §X.2.2 and
are reported by resolution, not validation.

**`CC-13` severity and applicability.** `CC-13` is a **warning**, never an
error: a screening-stage deal legitimately does not know its RSF yet, and the
`gaps` / provisional machinery already owns "we don't know this yet". An
institution wanting a hard gate expresses it through
`INCOMPLETE_DATA_POLICIES`. The rule fires only when **all** of the following
hold:

1. The source is a UWX record, not a UW Lite summary (Lite states size in its
   own grammar).
2. The document's profile is a deal record (market-data and other non-deal
   profiles have no property section by construction).
3. The asset class is recognized (Protocol §XIII.3) and is not `mixed_use`
   (Protocol §XIII.2).
4. The document has a property section. A missing section is a different
   defect with a different remedy, and `CC-13` would give the wrong
   diagnostic.
5. The property section is not externalized (RFC 0021); the resolved record is
   where the field lives.

**`CC-14` severity and applicability.** `CC-14` is a **warning**, never an
error: the RFC 0028 corpus scan found 28 documents a refusal would invalidate
retroactively, and an institution wanting a hard gate expresses it through
`INCOMPLETE_DATA_POLICIES`. The rule fires only when **all** of the following
hold:

1. The source is a UWX record, not a UW Lite summary (Lite states its
   property facts in its own grammar).
2. The document's profile is a deal record (market-data and other non-deal
   profiles have no property section by construction).
3. The `property` section is not merely externalized (RFC 0021) — an
   externalized-but-unresolved section is present, not missing.

`CC-14` is unconditional on `deal_stage` — §4.1 requires the section at every
stage. When `CC-14` fires, `CC-13` must not also fire (its precondition 4
ensures this), and `DQ-06` must suppress its own `property` entry: one
defect, one diagnostic.

**`CC-15` severity and applicability.** `CC-15` is a **warning**, never an
error, and is **tolerance-checked**, never exact — see §4.25 for why the 2%
band is deliberate. It reads only the **base** variant of
`lease_up_schedule` (falling back to the sole/default variant when no
`base` exists) and fires only when both `stabilized_summary.annualized_noi`
and `noi_model.net_operating_income` are stated. Non-base variants are
exempt by design: a downside scenario is supposed to disagree with
stabilized NOI. `stabilized_summary.annualized_noi` deliberately does **not**
also cross-check `quick_metrics.noi_underwritten` — `quick_metrics` is a
frontmatter restatement with no cross-check of its own (`CC-01` compares the
rent roll to the operating statement, not NOI to the frontmatter), and RFC
0008 adds one seam, the trajectory endpoint against the stabilized-year
model, not a second.

---

### 5.4 Descriptive identity guidance (RFC 0072)

These diagnostics MUST be warnings, never errors.

- `DQ-07`: non-null `scenario` outside the eight standard plans and reverse-DNS
  extension grammar, including unlisted values and non-string
  structures (§2.2b). Absent/null is valid and emits nothing.
- `DQ-08`: either subtype carrier states `build_to_rent` and both non-null
  carriers differ (§2.2c). Frontmatter governs; preserve both values.
- `DQ-09`: either subtype carrier states `build_to_rent` outside frontmatter
  `asset_class: multifamily` (§2.2c).

Other free subtype values add no diagnostics. These checks do not alter
calculations, default resolution, packs, financial validation or stage readiness.

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
  "pipeline_log": [ "...entries..." ]
}
```

### 6.2 `uwmd validate <file> [--json]`

Runs all validation rules (Part V) and returns, with `--json`:

```json
{
  "overall_status": "clean | warnings | errors | blocking",
  "stage_readiness": {
    "scope": true,
    "screening": true,
    "term_sheet": false,
    "full_underwrite": false,
    "credit_approval": false,
    "closing": false,
    "monitoring": false
  },
  "issues": [ "...ValidationIssue objects..." ],
  "...": "plus errors, warnings, info, coverage and replacement_funding_verification"
}
```

Readiness is reported for every `deal_stage` (§2.2). The reference CLI
still accepts a deprecated `--stage <stage>` that repeats one stage's
readiness; it changes neither the result nor the exit status.

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
| `json` | Extracted data only (no prose) | Any stage |
| `csv` | Flat metrics summary | Any stage |
| `chat` | Compressed context for AI assistant | Any stage |
| `summary` | One-page deal summary markdown | Screening+ |

The `--tier screener` flag renders only the Tier 1 sections (no Bancroft-generated sections). The `--tier analyst` flag renders the full package.

`uwmd render` does not produce PDF or Word output. The lender package and
credit memo PDFs (Part VII) come from the separate `uwmd-report` tool
(`@uwmd/report`); no DOCX renderer exists.

### 6.5 `uwmd compact <file>`

Removes all blocks where `_meta.lifecycle.superseded === true`. Preserves the pipeline log. Outputs the compacted file. Appends a `compact` entry to the pipeline log.

### 6.6 `uwmd diff <file_a> <file_b>`

Compares two `.uwx.md` files (or two versions of the same file at different timestamps) and outputs a structured diff showing which sections changed, what values changed, and which source produced the change.

### 6.7 `uwmd init --scenario <scenario> --address <address>`

`--scenario` writes a standard business plan (§2.2b) or a well-formed
reverse-DNS extension; omitted means null. It refuses unlisted bare or malformed values before writing. Readers still preserve these values and
warn rather than reject (§5.4). `--asset-subtype` writes the open subtype
carrier; for single-site BTR use `--asset-class multifamily --asset-subtype
build_to_rent --scenario stabilized_acquisition` (or the actual plan).
`uwmd init` writes only bare nested Format 3.0 blocks, with `uw_version: "3.0"`; it takes no `--format`. Lite compilation emits the same Format 3.0 contract for all twelve builtin classes. No migrate command is part of the toolchain.

The new file is named with `--output <file>` (default `new-deal.uwx.md`);
`init` takes no file argument and refuses to overwrite an existing file.

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
4. Set `_meta.lifecycle.revision` to `previous_revision + 1` (or `1` if no previous block exists)
5. Set `_meta.lifecycle.superseded = false`
6. Never write to sections outside its defined scope (see the Part IV "Written by" field)
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

**RFC 0072 clarification:** this legacy heading and `scenario_defaults.json`
reference do not refer to frontmatter `scenario` (§2.2b). That field MUST NOT
select defaults. Defaults and the fallback cascade are starter-product
guidance ([starter guide §V.7–§V.8](../docs/starter/defaults-and-cascade.md#v7-fallback-cascade)),
whose published defaults are keyed by asset class. Repair of the vestigial
file reference and broader terminology is deferred separately.

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

**Selected configuration admission (normative, RFC0097).** Filesystem validation
selects one explicit path or the lexical document-adjacent `.uw.institution.json`,
without merging, fallback or relocating discovery through the document's realpath.
Only genuine automatic absence keeps defaults. A selected unreadable/malformed
config refuses the validation operation; it is not a document finding. Protocol
§VI.3 defines source/preflight order, strict UTF-8/JSON/decoded-name/Unicode
admission, atomic application, fixed typed error/pointer precedence and transport.
The minimum wire schema is
[`institution-config.schema.json`](schemas/institution-config.schema.json).

The own optional `validation_overrides` carrier must be an object. Its three
optional own leaves above must be finite binary64 numbers, with no coercion,
null/default inference or additional financial range. Admit the entire selected
config before applying any leaf. The root member `thresholds` is forbidden;
the pure API's nested threshold map is a separate input. Other members remain
opaque and are not claimed applied. Unknown overflow number spellings remain
opaque; malformed Unicode or duplicate decoded names anywhere are refused.

Admitted overrides replace only their named warning limits in fresh affected
default bands. Existing error limits, unrelated bands and financial comparisons
remain unchanged. No source/config bytes or caller/process defaults are mutated.
Pure SOURCE/MODEL validation does no hidden config I/O, and receipt issue/verify
adds no config loading or subject/count/verdict change. Full rules are in
Protocol §VI.3 and its operation-error taxonomy (§XI).

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

**Scalar semantics.** A supported construct keeps its YAML 1.2 meaning unless
this appendix narrows it:

- A double-quoted scalar decodes YAML 1.2 double-quoted escapes: `\"` is `"`,
  `\\` is `\`, and `\n`, `\t`, `\uXXXX` and the other YAML 1.2 escapes keep
  their YAML meaning.
- A single-quoted scalar reads `''` as one `'`. Nothing else in it is an
  escape.
- Inside either kind of quoted scalar, `&`, `*`, `!`, `#`, `{`, `}`, `[` and
  `]` are content, not YAML indicators.
- A `#` preceded by whitespace, outside a quoted scalar, begins a comment. The
  comment is not part of the value.
- Each entry is one line (`key: value` per line, above). A quoted scalar that
  does not close on its line, uses an escape YAML 1.2 does not define, or is
  followed by anything other than a comment is outside the subset.

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

*Format 3.0 | UW Markdown | October 2026*
*This document is itself a reference artifact. The canonical format for a deal is a `.uwx.md` file. This spec defines what valid means.*

