# UW Protocol — v1.3

**Status:** Release candidate  ·  **Format pairing:** `.uwx.md` v1.1 (see [`UW_FORMAT_SPEC_v1.md`](UW_FORMAT_SPEC_v1.md))  ·  **License:** MIT

This document specifies the contract that any conforming **viewer**,
**editor**, **calc host**, or **agent host** must satisfy in order to
interoperate with UW Markdown files.

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
- **Protocol version** (this document, currently `1.7.0`) — the
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
- Representation discovery, fidelity classes, and media negotiation.
- The forward-compatibility rules for unknown frontmatter fields,
  unknown sections, and unknown extensions.

### I.2 What this document does not specify

- The bytes-on-disk format. See [`UW_FORMAT_SPEC_v1.md`](UW_FORMAT_SPEC_v1.md).
- UI design beyond display conventions. Implementations MAY render
  any way they wish provided values resolve to the same display strings.
- Deployment-specific network server behavior. Optional [HTTP](bindings/UW_HTTP_BINDING_v1.md)
  and [MCP](bindings/UW_MCP_BINDING_v1.md) companion profiles carry registered
  representations, but no conformance tier requires a network transport.
- Persistence. How implementations cache, version, or back up the file
  is out of scope.

### I.3 Locale

V1 freezes locale to `en-US` for all numeric and date formatting.
Implementations MUST NOT vary number formatting by user locale in v1.
V2 will introduce a locale negotiation mechanism; the type
`SupportedLocale` exists in `protocol.ts` as a v2 hook.

### I.4 Self-declaration

Every conforming implementation SHOULD expose an
`ImplementationManifest` that documents its tier, capabilities, representations,
supported asset classes, protocol version, and format version. Hosts
that load `.uwx.md` files from third parties MAY use the manifest to
refuse files that exceed their declared format version.

**Normative schema:** [`spec/schemas/implementation-manifest.schema.json`](schemas/implementation-manifest.schema.json).
The TypeScript interface in [`@uwmd/core/protocol.ts`](../packages/uwmd-core/src/protocol.ts)
is a mirror — implementations in non-TS languages SHOULD validate
against the JSON Schema.

### I.5 Representation discovery and negotiation

Protocol 1.2 adds the optional `ImplementationManifest.representations` array.
Each entry is a `RepresentationCapability` with:

- stable `id`;
- one or more `media_types` and `file_extensions`;
- supported `directions` (`read`, `write`, or both);
- `fidelity` (`source`, `model`, or `view`);
- an independently versioned `representation_version`; and
- for views, a required `view` identifier.

`source` fidelity can preserve an authoring byte stream, `model` fidelity
round-trips a semantically equivalent UW Document Envelope, and `view` fidelity
is intentionally lossy. A view MUST NOT advertise `model` fidelity.

HTTP-style output negotiation uses ordinary `Accept` media ranges and quality
values. Exact types are more specific than `type/*`, which is more specific than
`*/*`; structured suffixes do not create an implicit wildcard. A caller may also
require a direction and minimum fidelity. No acceptable representation produces
`REPRESENTATION_NOT_ACCEPTABLE` (HTTP binding status 406). An unsupported input
`Content-Type` produces `REPRESENTATION_UNSUPPORTED_MEDIA_TYPE` (HTTP binding
status 415).

The normative manifest shape is in
[`implementation-manifest.schema.json`](schemas/implementation-manifest.schema.json).
The reference functions are `negotiateRepresentation` and
`resolveInputRepresentation` in `@uwmd/core`.

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

### III.6a Validator code taxonomy

Every issue code emitted by a conforming validator MUST belong to one
of three families. The prefix is part of the contract — adopters can
filter, group, and route issues by prefix without parsing the message
text.

| Prefix | Family | Meaning | Default severity |
|---|---|---|---|
| `CC-NN` | Cross-section consistency | Two or more sections disagree about the same fact (e.g. loan amount in `sources_uses` ≠ loan amount in `debt_structure`). NN is a two-digit integer registered in this spec. | `warning` or `error` depending on the specific check |
| `FV_*` | Single-section financial validity | One section's value falls outside a registered plausibility threshold (e.g. vacancy rate well below the asset class's `warning_below`). The suffix names the field and direction. | typically `warning` |
| `META_*` | `_meta` / provenance integrity | A block's `_meta` object is missing, malformed, or internally inconsistent (e.g. low confidence without `human_review_required: true`). | `info` or `warning` |

The currently registered `CC-NN` codes are `CC-01` through `CC-10`,
defined in §VI of the format spec. New `CC-NN` codes are added by RFC
and MUST extend the integer sequence without renumbering. `FV_*` and
`META_*` codes are open extension points: the reference validator
ships an initial set, modules MAY add their own, and adopters MUST
treat unknown codes within the same family the same way they treat
known codes (render the message; consult `BUILTIN_REMEDIATIONS` if
present; fall back to message text otherwise).

The reference registry lives in
[`packages/uwmd-core/src/validator.ts`](../packages/uwmd-core/src/validator.ts);
remediation copy lives in `BUILTIN_REMEDIATIONS` in the same file.
Implementations that surface validator output to end users SHOULD use
the prefix to colorize, group, or filter issues — for example, a UI
might collapse `META_*` notices behind a "show provenance issues"
toggle while always surfacing `CC-NN` and `FV_*` inline.

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

A Tier-2 Editor receiving an `.uwx.md` and returning an `.uwx.md`
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

### V.7 Fallback cascade

A producer that needs to assign a value to a field for which no
explicit user input or document extraction is available MUST resolve
the value by walking the following ordered cascade. The first step
that yields a value wins. The producer MUST stamp the resulting
`_meta.source` (or, when only a subset of fields was resolved this
way, a `_meta.field_overrides[].source`) with the cascade step that
produced the value.

| Step | Source tag | Description |
|---:|---|---|
| 1 | `user_override` | An explicit user-entered correction. |
| 2 | `user_input` | An explicit user-entered initial value. |
| 3 | `inherited_assumption` | An assumption declared by an ancestor in the composition DAG. See §V.7.1. |
| 4 | `investor_profile` | Values declared in the active investor profile (e.g. preferred rate spread). |
| 5 | `market_data` | A market-data lookup at the time of resolution. |
| 6 | `asset_class_default` | The published default for the deal's asset class. See §V.8. |
| 7 | `global_default` | The published global default. |
| 8 | `system_default` | A hardcoded constant in the reference library or institution config. Producers SHOULD avoid relying on this layer for normative values. |

`market_data_accepted` (RFC 0022 §4) is **not** a cascade step. It is an in-file
value of record that resolves at step 2 while retaining its own source tag,
because a market observation an analyst accepted for lack of better evidence
must stay distinguishable from a value someone entered from diligence.

A producer MAY skip steps that are not available (e.g. no investor
profile attached). A producer MUST NOT reorder the cascade. The
runtime constant `CASCADE_ORDER` in `protocol.ts` is the canonical
machine-readable representation; conformant resolvers walk this
array.

A producer that resolves a value via a step at or below
`asset_class_default` (i.e. not from observed user or document data)
SHOULD also stamp the resulting block with `_meta.provisional: true`
unless the value originated from `inherited_assumption`,
`investor_profile`, or fresher `market_data`. This signals the
refinement engine that the field is a candidate for
value-of-information ranking.

#### V.7.1 Inherited assumptions

*Added at protocol 1.5.0 by [RFC 0021](../docs/rfcs/0021-composable-documents.md)
§5, taking the cascade from seven steps to eight.*

A composite record MAY declare assumptions its descendants inherit. Resolution
of `inherited_assumption` is subject to four normative rules:

1. **Composition-scoped only.** Inheritance resolves along the composition DAG.
   A document not reachable as an ancestor contributes nothing, and there is no
   ambient or global assumption scope. A standalone record therefore can never
   resolve at this step, which is why introducing it moves no existing digest.
2. **Nearest ancestor wins.** Where several ancestors assert one field, the one
   fewest hops away supplies the value.
3. **Equidistant ancestors are an error** (`COMP-AMBIGUOUS-INHERIT`), never a
   silent pick. Diamond inheritance resolves explicitly or not at all: choosing
   by traversal order would make the answer depend on how the graph was walked.
4. **The value is traceable.** An inherited value MUST record the asserting
   ancestor's `document_id` and digest in `_meta.inherited_from`. An inherited
   value with no named ancestor is indistinguishable from an ambient default,
   which rule 1 forbids.

Step 3's position is normative in both directions. It sits **below**
`user_input`, so a value entered on the deal always wins — inheritance supplies
defaults, it never overrides. It sits **above** `investor_profile`, because an
assumption asserted by a named ancestor of this specific deal is more specific
than an institution-wide preference set.

When the resolved value carries an associated range (e.g.
asset-class defaults publish `{low, central, high}`), the producer
MAY also stamp `_meta.field_overrides` for that path with the range
recorded under the entry's `note`, so downstream tooling can compute
value-of-information without re-resolving the cascade.

### V.8 Asset-class default tables

The reference library publishes per-asset-class default tables under
`@uwmd/core/defaults`. Each entry resolves to a `{low, central,
high}` triple plus a unit and source tag. Producers consuming the
table at cascade step 5 (`asset_class_default`) MUST use the
published `central` value as the resolved scalar and MAY surface the
range to downstream consumers via `field_overrides`.

Tables are versioned independently of the protocol; consumers MAY
pin a specific table version via institution config. Default-table
revisions bump their semver and appear in the CHANGELOG.

The `MarketDataLookup` interface (cascade step 4) is defined by the
reference library but ships no built-in implementation; adopters
bring their own (CoStar, Yardi, internal). When no implementation is
attached, step 4 is silently skipped and resolution falls through to
step 5.

### V.9 Canonical block JSON

The `_meta.content_hash` of a block is the SHA-256 hash of the
**canonical JSON serialization** of the block's content (the JSON
object inside the fence, exclusive of the fence annotation line and
exclusive of `_meta.content_hash` and `_meta.signature` themselves).

The canonical form is **RFC 8785 (JCS — JSON Canonicalization
Scheme)** with one uw-md addition: the keys `content_hash` and
`signature` inside any nested `_meta`-shaped object are removed
before hashing. A `_meta`-shaped object is any object that carries
`version`, `source`, AND either `section` or `section_id` — this
catches both the top-level `_meta` (whose on-disk spelling is
`section_id`) and any nested provenance (e.g. inside
`field_overrides`).

Implementations MUST produce **byte-identical** canonical output
across platforms. Specifically:

- Object keys are sorted by code-unit comparison (RFC 8785 §3.2.3).
- Strings are JSON-escaped per RFC 8785 §3.2.2.
- Numbers serialize per ECMAScript ToString (RFC 8785 §3.2.2.3),
  with `-0` rendered as `0` and non-finite numbers rejected
  (canonical JSON has no representation for `Infinity` or `NaN`).
- `undefined` values inside objects are dropped (mirroring
  `JSON.stringify`).

The reference library's implementation is in
`@uwmd/core/integrity-canonical`; it is dependency-free and ~120
lines.

### V.10 Block integrity (content_hash + parent_hash chains)

Two optional `_meta` fields make supersede chains tamper-evident:

- `content_hash` — the canonical-JSON SHA-256 of the block (§V.9).
- `parent_hash` — the `content_hash` of the block this one
  supersedes; `null` on a chain root.

**Opt-in.** A block lacking both fields is well-formed and verifies
as `ok: true, chains_with_hashes: 0`. A producer that wants
tamper-evidence MUST stamp every block it writes within a hashed
chain. Once any block in a supersede sequence carries
`content_hash`, every later block in that sequence MUST carry one
(else `INT-03 warning`).

**Verification (`verifyChain`).** For every supersede chain in a
parsed file:

1. If no block in the chain carries `content_hash`, the chain is
   skipped.
2. Each non-root block's `parent_hash` MUST equal the prior block's
   `content_hash` (else `INT-01 error`).
3. Each block's stamped `content_hash` MUST recompute from its
   current canonicalized content (else `INT-04 warning`).

**Editor enforcement (`applyEdit`).** When the section's current
head carries `content_hash`, the caller's `EditContext.parentHash`
MUST equal it; mismatch is rejected as `INT-02` (concurrent write
detected). The new block is then stamped with `parent_hash =
prior.content_hash` and a freshly computed `content_hash`. The
async stamping is performed by `applyEditAsync` (Web Crypto's
SHA-256 is async); the sync `applyEdit` performs only the INT-02
mismatch check.

**Provenance verification (`verifyProvenance`).** Cross-checks
`_meta.actor` and the operation that produced the block against the
section's `EditPolicy`:

- `POL-01 error` — actor not authorized for the policy authority
  (`agent_only`, `human_only`, `system_only`, `either`).
- `POL-02 error` — `section_replace` used where the policy mandates
  `section_supersede` (heuristic: `version > 1` with no superseded
  prior versions visible).

**Adversarial-write caveat.** A non-conforming producer can
trivially defeat integrity by simply not stamping `content_hash`
(`verifyChain` returns "no chain to verify" silently). Adopters who
need adversarial resistance MUST enforce a "must have hashes" policy
externally — for example, a CI gate that runs `uwmd verify
--integrity` and rejects files where `chains_with_hashes <
chains_with_supersedes`. §V.11 (block signatures) is the stronger
tool: a signature cannot be omitted quietly, because a verifier that
requires one reports its absence.

### V.11 Block signatures (RFC 0010)

`_meta.content_hash` is tamper-**evident**, not tamper-**proof**: it
detects a change only for a reader who already holds a trusted copy
of the hash. `_meta.signature` closes that gap for the deployments
that need it — regulated lender data rooms, multi-party deal flow
where sponsor, lender, and appraiser each sign their own sections,
and agent-host accountability where a signature proves *which* agent
instance wrote a block rather than merely what the `actor` field
claims.

Signed blocks are **not the everyday case**. Reading, validating,
editing, and computing over `.uw.md` requires no cryptography, and
the reference library takes no crypto dependency: the wire format and
the signing input are normative here, while signing and verification
live in the separate optional `@uwmd/signing` package.

#### V.11.1 Wire format

`_meta.signature` is an object:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `alg` | `"ed25519"` \| `"es256"` \| `"es384"` | yes | Signature algorithm. Closed set for protocol 1.x. |
| `kid` | string | yes | Opaque key identifier the verifier resolves in its own key store. |
| `sig` | string | yes | Signature bytes, base64url (RFC 4648 §5), unpadded. |
| `signed_at` | string | yes | ISO 8601 instant the signature was produced. MAY differ from `_meta.timestamp` — a block edited offline is signed when re-uploaded. |
| `v` | string | no | Signing-protocol version. Absent means `"1"`. |

`es256` and `es384` signatures are raw `r || s` (IEEE P1363), the
JOSE convention and what Web Crypto produces. DER-wrapped ECDSA
signatures are **not** interchangeable and MUST NOT be emitted.

Like `content_hash`, `signature` is excluded from canonicalization
(§V.9), so stamping one does not change the hash it commits to.

#### V.11.2 What is signed

The signature input is the RFC 8785 canonical JSON of exactly these
six fields, and nothing else:

```json
{
  "actor": "<_meta.actor>",
  "content_hash": "<_meta.content_hash>",
  "kid": "<signature.kid>",
  "section": "<the block's section id>",
  "signed_at": "<signature.signed_at>",
  "timestamp": "<_meta.timestamp>"
}
```

The signer commits to the block's `content_hash` rather than to the
block itself — the hash already covers the content, and re-deriving
it inside the signature would buy nothing. The other five fields are
what a verifier needs in order to answer *who* signed *what*, *when*.

The signing input names no `parent_hash` field. RFC 0010 read that as
a guarantee that re-rooting a supersede chain leaves prior signatures
intact; **it is not**. `content_hash` is computed over the block's
`_meta` as well as its content (§V.9), and `parent_hash` lives in
`_meta`, so a re-rooted block gets a new hash and its signature no
longer applies. Re-rooting therefore requires re-signing. See the
[erratum](../docs/rfcs/0010-signed-blocks.md#erratum-parent_hash-is-covered-transitively).

A signature is over one block. A document with several signed blocks
carries several independent signatures, which is the property
multi-party deal flow needs: "the sponsor signed the rent roll" and
"the lender signed the term sheet" must be separately checkable, and
must stay checkable after either block is superseded.

#### V.11.3 Verification

Verification is **opt-in and capability-gated**. A verifier holding
no key store treats a signature as opaque metadata: it MUST report
that signatures were *present and unchecked*, and MUST NOT report the
document as verified on their account. In the reference library that
is `IntegrityResult.signatures_present` alongside
`signatures_verified`.

A conforming signing-aware verifier emits:

| Code | Severity | Trigger | Needs a key store |
|---|---|---|---|
| `INT-05` | error | `signature` present with no `content_hash`. The signature commits to nothing. | no |
| `INT-06` | error | `signature.kid` names a key the store does not hold. | yes |
| `INT-07` | error | The signature does not verify; or `alg` is outside the admitted set; or the stamped `content_hash` no longer recomputes. | partly |
| `INT-08` | warning | `alg` is in the verifying deployment's deprecation list. Empty at protocol 1.7. | no |

Three of these distinctions are load-bearing:

- **`INT-06` is not `INT-07`.** "I cannot check this" and "this is
  forged" call for opposite responses — load a key versus reject the
  document. A verifier that merges them tells an operator to re-sign
  when the real fix is to configure their key store.
- **A drifted hash on a signed block escalates.** The same drift is
  `INT-04 warning` on an unsigned block and `INT-07 error` on a
  signed one. On an unsigned block it is a bookkeeping slip; on a
  signed one it means the content in front of you is not the content
  anybody signed.
- **Signatures are checked on every block, not only chain heads.** A
  signature on a superseded block is exactly the evidence per-block
  signing exists to preserve.

#### V.11.4 Key distribution

Out of scope, deliberately. A public key that travels inside the
document it authenticates proves nothing, so keys are distributed out
of band and a verifier decides which `kid` values it trusts.

**Rotation** is "issue new blocks under a new `kid` and keep the old
key loaded". A `kid` MUST be unique within a key store and MUST NOT
be reused for a different key; blocks signed under a retired `kid`
stay verifiable for as long as the store retains it.

`signed_at` is self-asserted by the signer. Audit-grade
non-repudiation needs a timestamping authority's countersignature,
which protocol 1.x does not define.

#### V.11.5 Capability declaration

An implementation that verifies signatures adds `signing` to its
`ImplementationManifest.capabilities`. The
`conformance/signing/` suite gates that claim; an implementation that
does not claim `signing` skips the suite and remains conformant.

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
conditional ::= logicalOr ( "?" expr ":" expr )?
logicalOr   ::= logicalAnd ( "||" logicalAnd )*
logicalAnd  ::= comparison ( "&&" comparison )*
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

Logical operators `&&` and `||` short-circuit: the right operand is
only evaluated when the left does not determine the result. Both
operands MUST be `boolean` or `null`; non-boolean operands raise
`CALC-TYPE-001`. A `null` operand propagates as `null` (matching the
arithmetic null-propagation rule).

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
| `abs(num)` | `(number\|null) → number\|null` | Absolute value; null propagates. |
| `floor(num)` | `(number\|null) → number\|null` | Round toward `-∞`; null propagates. |
| `ceil(num)` | `(number\|null) → number\|null` | Round toward `+∞`; null propagates. |
| `sqrt(num)` | `(number\|null) → number\|null` | Negative input raises `CALC-TYPE-001`. |
| `pow(base, exp)` | `(number\|null, number\|null) → number\|null` | `base ** exp`. Non-finite result raises `CALC-TYPE-001`. |
| `log(num)` | `(number\|null) → number\|null` | Natural log. Non-positive input raises `CALC-TYPE-001`. |
| `exp(num)` | `(number\|null) → number\|null` | `e^num`. Non-finite result raises `CALC-TYPE-001`. |
| `pmt(rate, n, pv)` | Standard mortgage payment formula. |
| `fv(rate, n, pmt[, pv])` | Future value of a series of equal payments + initial pv. |
| `pv(rate, n, pmt[, fv])` | Present value of a series of equal payments + future value. |
| `nper(rate, pmt, pv[, fv])` | Number of periods to pay down `pv` with `pmt` payments. Closed-form; see the note below. |
| `npv(rate, ...flows)` | Net present value. |
| `irr(...flows)` | Internal rate of return; null if no real root. See the convergence note below. |

**Closed-form functions (normative).** `pmt`, `fv`, `pv`, and `nper` **MUST** be
evaluated in closed form — `nper` as
`log((pmt - fv·rate) / (pmt - pv·rate)) / log(1 + rate)`, and the others by the
formulas in §VIII.3's table. `nper` in particular is solved iteratively in some
formulations, and an implementation that does so inherits exactly the
reproducibility problem the `irr` procedure below exists to remove. `irr` is the
only builtin permitted to iterate.

**`irr` convergence (normative).** `irr(...flows)` **MUST** return the root
computed by the following procedure, which is defined so that any implementation
using IEEE 754 `binary64` arithmetic in the stated order produces bit-identical
results. Introduced by [RFC 0024](../docs/rfcs/0024-iterative-function-determinism.md)
in protocol 1.4.0.

Let `npv(r) = Σ flows[t] / (1 + r)^t` for `t = 0 … n-1`.

1. **Domain.** The search interval is `lo = -0.999`, `hi = 10.0` (i.e. -99.9% to
   1000%). A root outside it is not reported; see step 5.
2. **Bracket.** Evaluate `npv` at `lo` and `hi`. If either is non-finite, or if
   `npv(lo) * npv(hi) > 0`, the procedure fails — see step 5.
3. **Endpoint root.** If `npv(lo)` is exactly `0`, return `lo`; if `npv(hi)` is
   exactly `0`, return `hi`. This precedes step 4 because bisection cannot
   reach it: the retention test in step 4 is a product with the endpoint value,
   and an endpoint value of zero makes that product zero for every midpoint.
4. **Bisection.** Bisect for at most 200 iterations, stopping when
   `|npv(mid)| < 1e-9` or `(hi - lo) / 2 < 1e-12`, whichever comes first, with
   `mid = (lo + hi) / 2` evaluated in `binary64`. Retain the half whose
   endpoints bracket the sign change, comparing `npv(lo) * npv(mid) < 0`. The
   midpoint at which a stopping condition is met is the result.
5. **No polish.** The bisection result is the answer. An implementation **MUST
   NOT** refine it with Newton's method or any other step: Newton's iterates
   depend on a derivative evaluation order this document does not pin, and the
   refinement it buys is below the quantization boundary of §VIII.5.
6. **Failure.** If step 2 fails to bracket, or step 4 exhausts its iterations
   without meeting a stopping condition, raise `CALC-IRR-DIVERGE`. An engine
   **MUST NOT** substitute a root found outside `[lo, hi]`.

Two consequences an implementer must not read past:

- **A cash flow with an even number of roots in `[lo, hi]` raises**, rather than
  returning one of them. `npv` has the same sign at both endpoints in that case,
  so step 2 finds no bracket: `irr(-100, 230, -132)` raises `CALC-IRR-DIVERGE`
  even though `0.1` and `0.2` are both roots. This is intended. A cash flow with
  several sign changes has no single internal rate of return, and a host
  **SHOULD** surface that as a modeling problem rather than a number.
- **A root exactly at `lo` is not a well-defined `binary64` quantity.** `1.0 +
  (-0.999)` is `0.001000000000000001`, not `0.001`, so `npv(lo)` for a cash flow
  whose exact root is -99.9% lands a few ULP either side of zero, and its sign
  decides whether step 2 brackets at all. Step 3 is therefore reachable at `hi`,
  where `1.0 + 10.0` is exact, and effectively unreachable at `lo`. Callers
  **SHOULD NOT** build on behavior at the low endpoint.

`xirr` and day-count conventions remain deferred to v2.

### VIII.4 Determinism

Calc hosts MUST be deterministic across runs and platforms. No
function in the standard library may consult system time, environment
variables, or randomness. Floating-point operations MUST follow IEEE
754 double precision. Determinism of the *reported* value additionally
requires the quantization rule in §VIII.5.

### VIII.5 Numeric model

Evaluation and reporting are separate concerns, and this section fixes
the boundary between them. Without it, two conforming hosts agree on
every arithmetic step and still disagree in the last unit in the last
place — which is invisible to a tolerant comparison and fatal to a
digest. UW Receipts (`UW_RECEIPT_v1.md`) hash calc outputs, so an
unstated precision is an unstated interoperability contract.

**Evaluation.** A host MUST evaluate expressions in IEEE 754 binary64
and MUST NOT round intermediate values. Rounding inside an expression
happens only where the author asked for it with `round(num, dec)`.

**Reporting.** The `value` a host reports for a calculation MUST be
quantized to that calculation's *effective decimal places*, using
**half away from zero** — the same rule `round()` implements and the
same rule spreadsheet `ROUND` implements, which is what makes the two
comparable. `-2.5` at 0 places is `-3`, not `-2`.

**Effective decimal places** are the declaration's `round_to` when it
states one; otherwise the default for its `unit`:

| `unit` | Default `round_to` | Rationale |
|---|---|---|
| `$` | 2 | Money is quantized to cents. |
| `%` | 6 | Rates are fractions (`0.0551`), so six places on the fraction is four on the percentage a reader sees. |
| `x` | 4 | The precision lender term sheets quote ratios such as DSCR at. |
| absent, or any other value | 6 | Residual case; matches the rate default rather than introducing a second convention. |

There is deliberately no "unspecified precision" mode: the table is
total, so every declaration has an effective precision whether or not
its author thought about one.

`round_to` MUST be an integer in `[0, 12]`. Past roughly fifteen
significant decimal digits a binary64 carries no fractional
information left to quantize, so a larger value would state a
precision the representation cannot hold.

**Quantization is not display.** A host's `display` string is a
presentation concern and MAY apply its own locale, symbol, and
precision (§ `DEFAULT_NUMBER_FORMAT`). Digests, equality checks, and
Excel parity are defined over `value`, never over `display`.

**Digests.** Any digest taken over calc outputs — a receipt's
`results_digest` in particular — MUST be taken over quantized values.
A host that hashes unquantized results produces digests that do not
reproduce across platforms.

> **Implementation note.** Quantizing by multiplying by `10 ** dec`
> reintroduces the artifact it is meant to remove: `1.005 * 100` is
> `100.49999999999999`, so that formulation yields `1.00` where
> spreadsheet `ROUND` yields `1.01`. Shifting through a decimal string
> (`Number("1.005e2")` → `100.5`) is correctly rounded and agrees.
> See `packages/uwmd-core/src/calc/quantize.ts`.

### VIII.6 CalcError taxonomy

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

### IX.7 Context Profiles

A consumer of a `.uwx.md` file SHOULD declare which **context profile**
it consumes. The profile determines which sections are included,
whether superseded blocks appear, whether prose is included, and the
approximate token budget the producer targets when constructing the
context payload.

The five normative profiles are:

| Profile | Audience | Includes | Notes |
|---|---|---|---|
| `summary` | Chat agents, orchestration heuristics | Frontmatter slim subset, `pipeline_state`, `quick_metrics`, `gaps` head | Soft target ≤ 600 tokens (chars/4 estimate). |
| `live` | Calc-aware editors | All non-superseded sections, full prose | Default for human-facing tools. |
| `compact` | LLMs at scale | All non-superseded sections, JSON only, minified, ordered stable→volatile | Targets ≤ 55% of `live` token count on the canonical Parkview fixture. `_meta` stripped by default. |
| `full` | Archival / forensic | Every byte, prose included, no compaction | Round-trips the input file byte-for-byte when no truncation. |
| `relevant` | Custom Bancroft layers | Caller-supplied section list, `live`-style payload | Used by `consumed_profile: 'relevant'` layers; the host passes the layer's `reads` as the section filter. |

A producer that satisfies a request for profile `X` MUST NOT return
a context strictly larger than `X` allows; it MAY return a smaller
context (e.g. truncated to fit `maxTokens`) and MUST set
`truncated: true` in the result when it does.

The `compact` profile MUST order sections **stable-first** so prompt-
cache prefixes survive frequent edits to volatile downstream
sections. The canonical order is:

1. `frontmatter`
2. `property`
3. `ownership`
4. `borrower_sponsor`
5. `debt_structure`
6. `sources_uses`
7. `valuation`
8. `rent_roll`
9. `operating_statement`
10. `noi_model`
11. `market_analysis`
12. `compliance`
13. `risk_assessment`
14. `dcf`
15. `stress_tests`
16. `custom_calculations`
17. `gaps`
18. `extensions`

Sections not on this list trail the canonical prefix in
`Object.keys` order.

Token estimates use the `chars/4` approximation; producers MUST
document the approximation and SHOULD validate periodically against
the true tokenizer cost (typical drift ±5% on `.uwx.md` content).

### IX.8 Layer-declared profile consumption

Each Bancroft layer declares a `consumed_profile` field in
`BANCROFT_LAYERS`. A host MUST request that profile (and only that
profile) when preparing the layer's input context. Conformance Tier-4
verifies the declaration via the
`consumer-profile-contract` fixture.

For canonical v1 layers the declared profiles are:

| Layer | `consumed_profile` |
|---|---|
| L0 — Document Ingestion | `summary` |
| L1 — Screening | `summary` |
| L2 — Underwriting | `relevant` |
| L4 — Structuring | `relevant` |
| L5 — Compliance | `relevant` |
| L6 — Risk Rating | `relevant` |
| L7 — Assembly | `live` |

Module-contributed layers MUST declare `consumed_profile`. A module
layer that consumes `full` or that declines to declare a profile is
non-conformant.

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

## XIII. Size-Intensive Registry

Every asset class's calc pack divides by a **size intensive** — the denominator
of its per-unit value metrics. This section is the single normative answer to
"how big is this deal, and what do I call it?" for consumers that display,
export, or index a deal's size. It is mirrored executably by `SIZE_INTENSIVES`
/ `getSizeIntensive()` in `@uwmd/core`'s `protocol.ts`. (Added at protocol
1.6.0 by RFC 0027; the RFC text refers to this section as §XI — see the errata
note there.)

| Asset class | Primary | Label | Unit | Secondary |
|---|---|---|---|---|
| `multifamily` | `total_units` | Units | `units` | `total_nra_sqft` |
| `office` | `rentable_square_feet` | RSF | `sqft` | — |
| `industrial` | `rentable_square_feet` | RSF | `sqft` | — |
| `retail` | `gross_leasable_area` | GLA | `sqft` | — |
| `self_storage` | `net_rentable_square_feet` | NRSF | `sqft` | `rentable_units` |
| `hospitality` | `keys` | Keys | `keys` | — |
| `student_housing` | `total_beds` | Beds | `beds` | `total_units` |
| `senior_housing` | `total_units` | Units | `units` | `total_beds` |
| `land` | `gross_acres` | Gross acres | `acres` | `usable_acres`, `entitled_units` |
| `mixed_use` | *(none — per component, Format §4.23)* | — | — | — |

All field paths are relative to the `property` section (Format §4.1).

### XIII.1 Primary size field

The **primary size field** of an asset class is the field its calc pack uses as
the denominator of its per-unit value metrics. A conforming implementation that
displays, exports, or indexes a deal's size MUST select the field through this
table and MUST NOT assume `total_units`.

### XIII.2 Mixed-use has no property-level size

`mixed_use` has **no** property-level primary size field. A consumer needing a
mixed-use deal's size MUST read the per-component intensives from the
`components` section (Format §4.23) and MUST NOT synthesize a property-level
total by summing across uses, because the components are denominated in
different units — a bed and a square foot do not add.

The lookup's return type is therefore nullable rather than total: a registry
that forced every class to name one field would have forced a wrong answer
here.

### XIII.3 The table is closed for protocol 1.x

A module declaring a custom asset class (RFC 0003, deferred) will declare its
own entry; until that RFC lands, an unrecognized asset class has no primary
size field and a consumer MUST degrade to stating no size rather than guessing
one.

---

## XIV. Future work (non-normative)

The following items are deferred beyond v1.0 and consolidated here for
discoverability. Unless an item says otherwise, it is v2 exploration. None is
required for v1 conformance.

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
- **Multi-format interchange** — accepted RFC 0014 defines an additive post-v1.0 train:
  protocol 1.2 representation discovery, `@uwmd/core` / `uwmd` 1.1 codecs,
  and optional HTTP/MCP binding profiles. The UW Markdown format remains 1.1.

Each of these opens as an RFC under `docs/rfcs/` once that process
is in place.

---

## Appendix A — Self-certification checklist

For each tier you claim:

- [ ] Run every fixture in `conformance/tier-N-*/`. Output matches.
- [ ] Publish your `ImplementationManifest` (id, version, tier,
      capabilities, representations, supported asset classes).
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

- **Block**: a fenced JSON region inside a `.uwx.md` file annotated
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
