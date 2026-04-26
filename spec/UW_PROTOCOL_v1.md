# UW Protocol — v1.0

**Status:** Draft  ·  **Format pairing:** `.uw.md` v1.1 (see [`UW_FORMAT_SPEC_v1.md`](UW_FORMAT_SPEC_v1.md))  ·  **License:** MIT

This document specifies the contract that any conforming **viewer**,
**editor**, **calc host**, or **agent host** must satisfy in order to
interoperate with `.uw.md` files.

The format spec defines what bytes are allowed on disk. The protocol
spec defines what implementations must do with them.

The reference TypeScript implementation lives in
[`packages/uwmd-core/`](../packages/uwmd-core/). Where this document
references a code symbol (e.g. `BUILTIN_REMEDIATIONS`, `BANCROFT_LAYERS`,
`WRITE_UW_SECTION_TOOL`), the symbol is exported from `@uwmd/core` and is
the single source of truth — this document describes what those exports
mean.

---

## 0. Front matter

### 0.1 Conformance language

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
"**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**", "**MAY**", and
"**OPTIONAL**" in this document are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

### 0.2 Abstract

The UW Protocol defines four conformance tiers. Each tier is a
strict superset of the previous: a Tier-N implementation MUST satisfy
all requirements of tiers 1..N.

| Tier | Name | Capability |
|---|---|---|
| 1 | Reader | Parse + display, read-only |
| 2 | Editor | Round-trip writes, supersede semantics |
| 3 | Calc Host | Evaluate `custom_calculations` and module calculations |
| 4 | Agent Host | Run AI agent layers and apply structured edits |

### 0.3 Semantic versioning

Three independent semvers are tracked:

- **Format version** (`uw_version` in frontmatter, currently `1.1`) — the
  bytes-on-disk schema. Bumped on any breaking format change.
- **Protocol version** (this document, currently `1.0.0`) — the
  contract for implementations. Bumped on any normative change to
  required behavior.
- **Reference library version** (`@uwmd/core`'s `package.json`) — the
  implementation. Independent semver.

An implementation declares the highest format and protocol versions it
supports via its `ImplementationManifest` (§I.4).

---

## I. Scope and Conformance

### I.1 What this document specifies

- The four conformance tiers.
- Display conventions implementers MUST follow when rendering values
  to humans.
- View models implementers SHOULD use as the default per-section
  layout.
- Edit semantics — what counts as a replace, what requires supersede,
  who is allowed to write what.
- The expression language and evaluation contract for `custom_calculations`.
- The contract for hosting Bancroft-style AI agents.
- The module manifest schema.
- The protocol error taxonomy.
- The forward-compatibility rules for unknown frontmatter fields,
  unknown sections, and unknown extensions.

### I.2 What this document does not specify

- The bytes-on-disk format. See [`UW_FORMAT_SPEC_v1.md`](UW_FORMAT_SPEC_v1.md).
- UI design beyond display conventions. Implementations MAY render
  any way they wish provided values resolve to the same display strings.
- Network protocols. The `.uw.md` file is the protocol surface; how it
  is transported is out of scope.
- Persistence. How implementations cache, version, or back up the file
  is out of scope.

### I.3 Locale

V1 freezes locale to `en-US` for all numeric and date formatting.
Implementations MUST NOT vary number formatting by user locale in v1.
V2 will introduce a locale negotiation mechanism; the type
`SupportedLocale` exists in `protocol.ts` as a v2 hook.

### I.4 Self-declaration

Every conforming implementation SHOULD expose an
`ImplementationManifest` that documents its tier, capabilities,
supported asset classes, protocol version, and format version. Hosts
that load `.uw.md` files from third parties MAY use the manifest to
refuse files that exceed their declared format version.

**Normative schema:** [`spec/schemas/implementation-manifest.schema.json`](schemas/implementation-manifest.schema.json).
The TypeScript interface in [`@uwmd/core/protocol.ts`](../packages/uwmd-core/src/protocol.ts)
is a mirror — implementations in non-TS languages SHOULD validate
against the JSON Schema.

---

## II. Capability Tiers

### II.1 Tier 1 — Reader

A Tier-1 Reader MUST:

1. Parse all required frontmatter fields (`uw_version`, `deal_id`,
   `deal_name`, `created`, `last_modified`, `property_address`, `city`,
   `state`, `zip`, `asset_class`).
2. Recognize all 21 standard section IDs from the format spec §4.
3. Treat unknown frontmatter keys, unknown sections, and unknown
   `x_*` extension blocks as informative: parse and surface them, but
   do not error.
4. Resolve supersede semantics: when multiple blocks share a `section_id`,
   the most recent non-superseded block is canonical (§V.2).
5. Apply the display conventions in Part III when surfacing any value
   to a human user.
6. Surface validation issues using the remediation copy from
   `BUILTIN_REMEDIATIONS`.

A Tier-1 Reader MUST NOT silently mutate any input bytes.

### II.2 Tier 2 — Editor

A Tier-2 Editor MUST satisfy all Tier-1 requirements, and additionally:

1. Round-trip preservation: bytes outside the modified region of the
   file MUST be preserved, modulo line-ending normalization.
2. Honor `BUILTIN_EDIT_POLICIES` (§V.3) — supersede vs replace.
3. Update `_meta` on every write per §V.4 (new `version`, new
   `timestamp`, correct `actor` and `source`).
4. Update `frontmatter.last_modified` on every write.
5. Reject any `EditOperation` whose `meta.source` is not permitted by
   policy with a `ProtocolError` of category `edit`.

### II.3 Tier 3 — Calc Host

A Tier-3 Calc Host MUST satisfy all Tier-2 requirements, and additionally:

1. Parse the safe-expression grammar in Part VIII exactly as specified.
2. Implement the built-in function set (§VIII.3) with the listed
   signatures and semantics.
3. Be deterministic: same `CalcEvaluationContext` MUST produce the same
   `CalcResult`.
4. Refuse expressions containing constructs outside the grammar
   (function definitions, assignments, lambdas, control flow keywords,
   property access on disallowed targets) with a `ProtocolError` of
   category `calc`.

### II.4 Tier 4 — Agent Host

A Tier-4 Agent Host MUST satisfy all Tier-3 requirements, and additionally:

1. Honor the `BANCROFT_LAYERS` dependency graph: layer L depends on
   inputs from earlier layers; the host MUST NOT run L until its
   dependencies are satisfied (§IX.1).
2. Validate every agent tool call against `WRITE_UW_SECTION_TOOL` or
   `WRITE_MULTIPLE_SECTIONS_TOOL` before applying.
3. Strip any `_meta` and `_notes` the agent included inside
   `section_data` and substitute the canonical `_meta` constructed by
   the host (§IX.4).
4. Append a `pipeline_log` entry for every successful agent invocation.

### II.5 Tier composition

An implementation MAY claim partial conformance — e.g. "Tier 1 + edit
on `frontmatter` only". Such partial claims are expressed via
`ViewerCapability` flags rather than tier number.

### II.6 Self-certification

To self-certify at a tier, run every fixture in the corresponding
`conformance/tier-N-*/` directory and verify the output matches.
Tier 4 uses shape assertions due to LLM nondeterminism (§IX.6).

---

## III. Display Conventions

### III.1 Number formatting

**Normative schema for remediation entries:**
[`spec/schemas/issue-remediation.schema.json`](schemas/issue-remediation.schema.json)
(used by §III.6). Every entry in `BUILTIN_REMEDIATIONS` and any module
remediation table MUST validate against it.



All numeric display strings MUST be produced by rules equivalent to
those encoded in `DEFAULT_NUMBER_FORMAT` (`protocol.ts`) and
implemented in `format.ts`.

| Kind | Default | Example input | Example output |
|---|---|---|---|
| Currency | `$1,234,567` (no fractional digits, en-US separators) | `1234567` | `$1,234,567` |
| Percent | `5.51%` (decimal × 100, 2 decimals) | `0.0551` | `5.51%` |
| Ratio | `1.234x` (3 decimals, `x` suffix) | `1.234567` | `1.235x` |
| Count | `50` (no thousands separator by default in CSV; with separator in display) | `50` | `50` |
| Null | `n/a` | `null` | `n/a` |

Implementations MAY override per-call to add fractional digits or
suppress suffixes (the second-arg options in `format.ts`), but the
default presentation MUST match the table above.

### III.2 Date/time

Dates in the file are ISO-8601 strings. The default display style in
v1 is `iso` — passthrough. Implementations MAY surface `short`,
`medium`, or `long` styles via `Intl.DateTimeFormat('en-US', ...)`.

### III.3 Section display hierarchy

Section cards SHOULD be presented in the order defined by
`BUILTIN_VIEW_MODELS[id].display_order`. Sections not present in the
file MUST NOT render an empty card.

### III.4 Badge system

Each block carries provenance via `_meta.source`. Implementations
SHOULD display a compact badge per block:

| `_meta.source` pattern | Suggested label | Color hint |
|---|---|---|
| `agent/*` | "AI" or layer ID | accent |
| `manual` | "Manual" | neutral |
| `document/*` | "Document" | neutral |
| `system/*` | "System" | muted |
| `institution/*` | "Institution" | muted |

Confidence is rendered from `_meta.confidence` ∈ `{high, medium, low}`.
Style options (pill/icon/text) are at implementer discretion.

### III.5 Supersede UX

When a section has superseded blocks, implementations SHOULD provide
a way to reveal them (a toggle, a side panel, etc.). Superseded blocks
MUST NOT be confused with the canonical block in any default view.

### III.6 Validation issue display

Each issue from `validateUWFile()` carries a `code`. Implementations
SHOULD render the matching `IssueRemediation` from
`BUILTIN_REMEDIATIONS` — title and remediation copy verbatim. The
goal is uniform UX across implementations, so end-users learning the
format on one tool see the same remediation copy on another.

---

## IV. View Models

### IV.1 SectionViewModel

A `SectionViewModel` (`protocol.ts`) describes how to lay out one
section. It comprises:

- `display_name` — heading shown to users.
- `display_order` — sort key relative to other sections.
- `description` — one-line context shown on hover or below the heading.
- `primary_fields` — fields surfaced on the section's collapsed card.
- `detail_fields` — additional fields revealed on expand.
- `multi_variant` — true for sections like `stress_tests` that may
  appear with multiple variants.

Each `FieldViewHint` declares a `path` resolved via `parser.deepGet`,
a `label`, and a `kind` mapping to a formatter in `format.ts`.

### IV.2 BUILTIN_VIEW_MODELS

`protocol.ts` exports a registry covering all 21 standard sections.
Implementations SHOULD use this registry as the default. Modules MAY
override per-section by declaring a `view_models[]` entry with the
matching `section_id` (§X).

### IV.3 Composition

When a module's view model and `BUILTIN_VIEW_MODELS` both define an
entry for the same `section_id`, the module's entry wins. When two
modules conflict, the host MUST refuse to load both unless they
declare `depends_on` relationships that establish a precedence.

---

## V. Edit Semantics

**Normative schema:** [`spec/schemas/edit-operation.schema.json`](schemas/edit-operation.schema.json)
defines the wire shape for every `EditOperation` accepted by a Tier-2 Editor.

### V.1 Round-trip preservation

A Tier-2 Editor receiving an `.uw.md` and returning an `.uw.md`
MUST preserve bytes outside the directly-modified region, modulo:

- Line-ending normalization (CRLF → LF is permitted).
- Trailing-whitespace stripping is permitted.
- Reordering of frontmatter keys is NOT permitted.
- Reformatting JSON inside untouched fence blocks is NOT permitted.

### V.2 Replace vs supersede

| Operation | Effect |
|---|---|
| `frontmatter_set` | In-place update of one frontmatter path. `last_modified` MUST be updated. |
| `section_replace` | Overwrite the canonical block for `section_id`. The previous block is discarded. Permitted only for sources whose policy is `supersede_on_edit: false`. |
| `section_supersede` | The previous block is marked `superseded: true` in its `_meta`; a new block is appended with `version = previous.version + 1`. |
| `pipeline_log_append` | Append-only. Existing entries are immutable. |

### V.3 Source authority

`BUILTIN_EDIT_POLICIES` (`protocol.ts`) establishes the default policy
for each `_meta.source` pattern:

- `agent/*` → `either` authority, `supersede_on_edit: true`.
- `manual` → `either` authority, `supersede_on_edit: false`.
- `document/*` → `either` authority, `supersede_on_edit: true`.
- `system/*`, `institution/*` → `system_only` authority,
  `supersede_on_edit: false`.

A module MAY contribute additional patterns; conflicts resolve in
favor of the more-specific glob (e.g. `agent/L6` beats `agent/*`).

### V.4 _meta authorship

On every write, the host MUST set:

- `_meta.version` — incremented from the prior canonical block's
  version (or 1 for a new section).
- `_meta.superseded` — `false` on the new block; `true` on the prior
  block when superseding.
- `_meta.source` — derived from the actor (agent ID, "manual", etc.).
- `_meta.timestamp` — current ISO-8601 UTC timestamp.
- `_meta.actor` — human or system identifier of the writer.
- `_meta.agent_id`, `_meta.agent_version` — populated for agent
  writes; null otherwise.

### V.5 Multi-variant edits

For sections with `multi_variant: true`, edits MUST specify a
`variant` key. Operations against missing variants create a new
variant; operations against existing variants follow the same
replace/supersede policy as single-variant sections.

### V.6 Frontmatter update rules

`uw_version`, `deal_id`, and `created` MUST NOT be modified by
post-init edits. `last_modified` MUST be updated on every write.
`pipeline_state` MUST be updated by Tier-4 hosts as layers complete.

---

## VI. Extensibility

### VI.1 `x_*` extension blocks

Section IDs prefixed with `x_` are reserved for extensions. Tier-1
Readers MUST parse and surface them but MAY render them as raw JSON
if no view model is registered.

### VI.2 Custom calculations and scenarios

`custom_calculations` and `custom_scenarios` are first-class blocks,
not `x_*` extensions. A Tier-3 Calc Host MUST evaluate them; lower
tiers MUST surface their declared result and unit verbatim from the
file (treating the host as a fixed observer of pre-computed values).

### VI.3 InstitutionConfig layering

A `.uw.institution.json` sidecar (format spec Appendix C.6) overrides
threshold defaults. Implementations MUST apply the institution config
to validation but MUST NOT apply it to display formatting in v1
(locale is frozen).

---

## VII. Module System

### VII.1 What a module is

A module is a declarative manifest (see §X) plus optional supporting
files. Modules in v1 contain no executable code; all dynamic behavior
is expressed via the safe-expression language (§VIII).

### VII.2 Lifecycle

1. Host loads a `module.uw.yaml` or `module.uw.json` file.
2. Host validates against
   `spec/schemas/module-manifest.schema.json`.
3. Host checks `requires_protocol` and `requires_format` against its
   own versions. If incompatible, refuse with `ProtocolError`
   category `module`.
4. Host registers the module's sections, calculations, validations,
   thresholds, view models, and agent layers.
5. Host runs subsequent operations with the module's contributions
   merged into its registries.

### VII.3 Conflict resolution

When two loaded modules declare the same section ID, calculation ID,
or view-model `section_id`:

- If both modules are unrelated, the host MUST refuse to load the
  second one and report a `ProtocolError`.
- If one module declares the other in `depends_on`, the dependent
  module's declarations override.

### VII.4 Capability negotiation

A module's `requires_tier` declares the minimum host tier. A Tier-2
host MUST refuse to load a module whose `requires_tier` is
`tier-3-calc-host` or higher.

---

## VIII. Calc Engine Contract (Tier 3)

**Normative schema:** [`spec/schemas/calc-result.schema.json`](schemas/calc-result.schema.json)
defines the shape of every value a Tier-3 Calc Host returns.

### VIII.1 Safe-expression grammar (EBNF)

```
expr        ::= conditional
conditional ::= comparison ( "?" expr ":" expr )?
comparison  ::= additive ( ( "==" | "!=" | "<=" | ">=" | "<" | ">" ) additive )?
additive    ::= multiplicative ( ( "+" | "-" ) multiplicative )*
multiplicative ::= unary ( ( "*" | "/" | "%" ) unary )*
unary       ::= ( "-" | "!" )? primary
primary     ::= number | string | bool | null
              | identifier
              | identifier "(" arglist? ")"
              | identifier ( "." identifier | "[" string "]" )+
              | "(" expr ")"
arglist     ::= expr ( "," expr )*
identifier  ::= [A-Za-z_][A-Za-z0-9_]*
number      ::= [0-9]+ ( "." [0-9]+ )?
string      ::= "'" [^']* "'"
bool        ::= "true" | "false"
null        ::= "null"
```

Hosts MUST reject any input that does not parse against this grammar.
Notably absent: assignment, function definitions, arrow functions,
`for`/`while`/`if` keywords, property assignment, and indexed
assignment.

### VIII.2 Variable resolution

Identifiers and dot-paths resolve against the
`CalcEvaluationContext` via `parser.deepGet` semantics:

- Top-level identifiers map to:
  - `frontmatter.<id>` first
  - then `sections.<id>` (the canonical block's `content`)
  - then `prior_results.<id>`
- Dot-paths drill into nested objects.
- A missing path resolves to `null`, not an error. Operators MUST
  propagate null as null for arithmetic (null + x → null).

### VIII.3 Built-in functions

| Name | Signature | Notes |
|---|---|---|
| `sum(...nums)` | `(number\|null)[] → number` | Nulls treated as 0. |
| `avg(...nums)` | `(number\|null)[] → number\|null` | Null if no non-null inputs. |
| `min(...nums)` | `(number\|null)[] → number\|null` | |
| `max(...nums)` | `(number\|null)[] → number\|null` | |
| `coalesce(...args)` | `(any)[] → any` | First non-null. |
| `if(cond, then, else)` | `(bool, any, any) → any` | |
| `round(num, dec)` | `(number, number) → number` | Half-away-from-zero. |
| `pmt(rate, n, pv)` | Standard mortgage payment formula. |
| `npv(rate, ...flows)` | Net present value. |
| `irr(...flows)` | Internal rate of return; null if no real root. |

### VIII.4 Determinism

Calc hosts MUST be deterministic across runs and platforms. No
function in the standard library may consult system time, environment
variables, or randomness. Floating-point operations MUST follow IEEE
754 double precision.

### VIII.5 CalcError taxonomy

| Code | Meaning |
|---|---|
| `CALC-PARSE-001` | Expression failed to parse against the grammar. |
| `CALC-RESOLVE-001` | Identifier could not be resolved. |
| `CALC-TYPE-001` | Operator applied to incompatible types. |
| `CALC-DIV-ZERO` | Division by zero. |
| `CALC-IRR-DIVERGE` | IRR did not converge. |
| `CALC-LIMIT-001` | Expression exceeded host complexity limits. |

---

## IX. AI Host Contract (Tier 4)

### IX.1 Layer DAG

`BANCROFT_LAYERS` (`context.ts`) is the normative layer dependency
graph for v1. Each layer declares its `reads` (sections it needs as
input) and `writes` (sections it produces). A host MUST satisfy all
`reads` before invoking a layer.

The seven canonical layers are L0 (ingestion), L1 (screening), L2
(underwriting), L4 (structuring), L5 (compliance), L6 (risk), L7
(assembly). Modules MAY contribute additional layers; module layers
MUST NOT use IDs that shadow canonical IDs.

### IX.2 Context bundling

`buildAgentPrompt()` defines the canonical context bundle shape: the
deal frontmatter, the relevant `reads` sections (canonical blocks
only — superseded blocks excluded), validation issues affecting those
sections, and the layer's prompt template.

### IX.3 Tool schemas

Two normative tool schemas are exported from
`packages/uwmd-core/src/agents/schemas.ts`:

- `WRITE_UW_SECTION_TOOL` — single-section writes.
- `WRITE_MULTIPLE_SECTIONS_TOOL` — batched writes for layers that
  produce multiple sections (see `MULTI_SECTION_LAYERS`).

Tool calls that fail validation against these schemas MUST be
rejected; the host MAY surface the failure to the agent for retry.

### IX.4 _meta substitution

Agents may include `_meta` and `_notes` inside `section_data`. The
host MUST strip both keys from the agent payload and substitute the
canonical `_meta` constructed via `buildMeta()`. This prevents agents
from forging provenance.

### IX.5 Pipeline log

Every successful layer invocation MUST append a `pipeline_log` entry
with `timestamp`, `agent_or_actor`, `event_type`, and `status`.
Failures MUST also be logged, with `status: "failed"` and an error
string.

### IX.6 Shape assertions for tests

Because LLM outputs are nondeterministic, the Tier-4 conformance
fixtures use JSON Schema shape assertions rather than byte-equality.
A run is considered conformant if the post-run file shape matches
the expected schema and the `pipeline_log` entry was appended.

---

## X. Module Manifest Specification

The canonical schema is
[`spec/schemas/module-manifest.schema.json`](schemas/module-manifest.schema.json).
Implementations MAY validate manifests with any compliant JSON Schema
2020-12 validator (`ajv`, `Validator`, `jsonschema`, etc.).

Required fields: `manifest_version` (always `"1"` in v1), `id`, `name`,
`version`, `description`, `authors`, `license`, `requires_protocol`,
`requires_format`, `requires_tier`.

Optional fields are documented in the schema. The TypeScript mirror
type `ModuleManifest` in `protocol.ts` is kept in lockstep.

---

## XI. Error Taxonomy

**Normative schema:** [`spec/schemas/protocol-error.schema.json`](schemas/protocol-error.schema.json).
The TypeScript `ProtocolError` interface in `@uwmd/core/protocol.ts` is a
mirror — implementers in any language SHOULD validate emitted errors
against the JSON Schema.

All protocol-level errors MUST be expressible as a `ProtocolError`:

```ts
{
  category: 'parse' | 'validate' | 'render' | 'edit' | 'calc' | 'agent' | 'module' | 'version',
  code: string,           // e.g. "PROTO-EDIT-001"
  message: string,
  pointer?: string,       // dot-path into the file
  remediation?: string,
  cause?: string,
}
```

Error codes follow `CATEGORY-PREFIX-NNN`. Categories are stable across
versions; specific codes may be added but never repurposed.

---

## XII. Versioning and Forward Compatibility

### XII.1 Unknown frontmatter keys

MUST be preserved on round-trip and surfaced to consumers without
error.

### XII.2 Unknown sections

A section ID not in the standard 21 and not in any loaded module
MUST be parsed and surfaced. Validators MAY warn but MUST NOT error.

### XII.3 Format version skew

If the file's `uw_version` exceeds the implementation's supported
format version by a major bump, the implementation MUST refuse to
edit and SHOULD refuse to display sections it does not recognize.

### XII.4 Protocol version skew

A module declaring `requires_protocol: ">=2"` MUST NOT load on a
host advertising protocol version `1.x.y`.

---

## XIII. Future work (non-normative)

The following items are deferred to v2 and consolidated here for
discoverability. None of them are required for v1 conformance.

- **Locale negotiation** — v1 freezes formatting to `en-US`. The
  `SupportedLocale` type in `protocol.ts` is the v2 hook; full
  locale negotiation will land via RFC.
- **Module signing** — Sigstore-style signature on module manifests,
  verified by the host according to its policy.
- **Custom asset-class declarations from modules** — the asset-class
  enum is hard-coded in `types.ts` for v1; modules cannot extend it
  without a spec bump.
- **Conformance test runner v2** — language-agnostic driver and
  reporter format so non-TS implementers don't have to write their
  own runner.
- **Stochastic calculations** — `deterministic: false` calc declarations
  (Monte Carlo, sensitivity sweeps).
- **Hospitality module** — full implementation of the example sketched
  in Appendix E, serving as the reference module for the module system.

Each of these opens as an RFC under `docs/rfcs/` once that process
is in place.

---

## Appendix A — Self-certification checklist

For each tier you claim:

- [ ] Run every fixture in `conformance/tier-N-*/`. Output matches.
- [ ] Publish your `ImplementationManifest` (id, version, tier,
      capabilities, supported asset classes).
- [ ] Document any non-default configuration users must set to
      achieve conformance.
- [ ] Add yourself to the README's "Who's building on it" section
      via PR.

## Appendix B — Reference implementations

- **`@uwmd/core`** — TypeScript reference: parser, validator,
  renderer, runner, agent host. All four tiers.
- **`tools/web-viewer/`** — Single-file Tier-1 reference viewer.
  Self-contained HTML, no build step.

## Appendix C — Conformance corpus index

See [`conformance/README.md`](../conformance/README.md). Per-tier
directories contain fixtures and expected outputs.

## Appendix D — Worked example: Tier-1 Reader in <500 LOC

The file [`tools/web-viewer/index.html`](../tools/web-viewer/index.html)
is a complete Tier-1 Reader in ~450 lines of HTML/CSS/JS, including
an inline parser, the `BUILTIN_VIEW_MODELS` subset, and the formatter
helpers. It is intended to be read end-to-end as a learning
artifact.

## Appendix E — Worked example: authoring a hospitality module

A minimal hospitality module manifest:

```yaml
manifest_version: "1"
id: org.uwmd.hospitality
name: Hospitality Underwriting Module
version: 0.1.0
description: Adds RevPAR/ADR/occupancy fields and STR comp validations.
authors: [UW Markdown contributors]
license: MIT
requires_protocol: ">=1.0.0 <2.0.0"
requires_format: ">=1.1 <2.0"
requires_tier: tier-3-calc-host
asset_classes: [hospitality]
calculations:
  - id: revpar
    label: RevPAR
    formula: adr * occupancy
    unit: "$"
    deterministic: true
validations:
  - code: CC-MOD-HOSP-01
    severity: warning
    message: "RevPAR below market by more than 15%."
    rule: "revpar >= market_revpar * 0.85"
```

## Appendix F — Glossary

- **Block**: a fenced JSON region inside a `.uw.md` file annotated
  with `uw:section=…`.
- **Canonical block**: the most recent, non-superseded block for a
  given section ID (and variant, if applicable).
- **Layer**: a Bancroft AI agent stage with declared `reads` and
  `writes`.
- **Module**: a declarative manifest extending the standard sections,
  calculations, validations, view models, and/or agent layers.
- **Provenance**: the `_meta` block carried inside every fenced
  section, recording authorship, timestamp, version, and confidence.
- **Round-trip preservation**: writing an unchanged region back to
  disk produces byte-identical output (modulo line endings).
- **Supersede**: the operation of marking a prior block as
  `superseded: true` and appending a new block with incremented
  version.
- **View model**: a per-section layout description used to render the
  section uniformly across implementations.
