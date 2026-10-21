# UW Protocol — verification

**Status:** Stable — protocol **4.1.0**  ·  **Format pairing:** Format **3.0** ([`UW_FORMAT_SPEC.md`](UW_FORMAT_SPEC.md)) only  ·  **License:** MIT

> **Protocol 4.1.0.** Adds [RFC 0084](../docs/rfcs/0084-document-signature-binding.md) document snapshot authentication to the single Format 3.0 contract. Core/CLI 4.2.0 pair with it; core/CLI 4.0.0, 4.0.1 and 4.1.0 carry Protocol 4.0.0.

This document specifies how any party **verifies** a UW Markdown
document: that it is well formed, that its stated figures agree with
each other under the standard's definitions, and that its results
reproduce from its stated inputs. It defines two conformance tiers,
**Reader** and **Verifier**, and six optional verification profiles.

The format spec defines what bytes are allowed on disk. This protocol
defines what a document's contents mean and how a receiver checks them.
It does not define how documents are produced, edited, displayed or
computed. Those are the starter products (calc engine, editor, viewer,
Excel exporter, defaults, AI agents), described non-normatively in the
[starter products guide](../docs/starter/README.md).

The reference TypeScript implementation lives in
[`packages/uwmd-verify/`](../packages/uwmd-verify/) (`@uwmd/verify`, the
standard), with the starter toolkit
[`packages/uwmd-core/`](../packages/uwmd-core/) on top of it. Where this
document references a code symbol (e.g. `BUILTIN_EDIT_POLICIES`,
`VALIDATOR_CODE_FAMILIES`, `SIZE_INTENSIVES`), the symbol is exported
from `@uwmd/verify`, re-exported by `@uwmd/core`, and is the single
source of truth — this document describes what those exports mean.

---

## 0. Front matter

### 0.1 Conformance language

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**",
"**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**", "**MAY**", and
"**OPTIONAL**" in this document are to be interpreted as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

### 0.2 Abstract

The UW Protocol defines two conformance tiers and six optional
verification profiles. A Verifier MUST satisfy every Reader
requirement. A profile adds to whichever tier the implementation
claims.

| Tier | Manifest value | Capability |
|---|---|---|
| Reader | `reader` | Parse a document and check that it is well formed, read-only (§II.1). |
| Verifier | `verifier` | Reader, plus the Format validation rules, reproduction of the standard's metric definitions, the stated-figure verifiers and receipt verification (§II.2). |

| Profile | Manifest value | Adds |
|---|---|---|
| Module | `module` | Evaluate formulas the standard does not itself define: module calculations and a document's own `custom_calculations` (§II.3). |
| Integrity | `integrity` | Recompute hash chains and verify block signatures (§V.9–V.11). |
| Representations | `representations` | Lite, XML and CSV representations and their negotiation (§I.5). |
| Portfolio | `portfolio` | Portfolio and relationship sidecars (Part XV). |
| Sensitivity | `sensitivity` | Reproduce stated sensitivity grids (§VIII.7). |
| Stochastic | `stochastic` | Reproduce stated seeded distributions (§VIII.8). |

Editing and AI-agent hosting are starter products, outside the Protocol. Conformance claims use only Reader and Verifier and the six profiles above.

### 0.3 Semantic versioning

Three independent semvers are tracked:

- **Format version** (`uw_version` in frontmatter, currently `3.0`, the only admitted version)
  — the bytes-on-disk schema. Bumped on any breaking format change.
- **Protocol version** (this document, currently `4.1.0`) — the
  verification contract. Bumped on any normative change to required
  behavior. From 3.0.0 it moves only when what a document *means* or
  how it is *verified* changes. Starter-product changes version their
  packages only; there is no starter-guide version (RFC 0078 D13).
- **Reference library versions** (`@uwmd/verify`'s and `@uwmd/core`'s
  `package.json`) — the implementation. Independent semver.

An implementation declares the highest format and protocol versions it
supports via its `ImplementationManifest` (§I.4).

---

## I. Scope and Conformance

**The standard is verification.** UW Markdown exists so that parties
who do not share software (sponsor and lender, lender and credit
committee, GP and LP) can exchange a document that the receiver checks
independently of the producer's tools. One test draws the boundary of
this document: *if Argus, an Excel model or StackUW exported a
`.uw.md`, a lender could verify it using only the standard, with none of
this project's tools.* A rule a verifier needs is normative here. A rule
that only a producing, editing or displaying tool needs is
starter-product guidance.

To **verify** a document means all three of the following
(RFC 0078 D1):

1. **Well formed.** It parses, carries its required fields, and its
   values are valid.
2. **Internally consistent.** Its stated figures agree with each other
   under the standard's definitions.
3. **Reproducible.** Its results recompute from its stated inputs, as
   its receipts attest.

The standard defines and checks numbers. It never produces or projects
them.

### I.1 What this document specifies

- The two conformance tiers, Reader and Verifier, and the optional
  verification profiles (Part II).
- Document currency identity (§III.1b) and the validator code taxonomy
  (§III.6a).
- The provenance rules verification depends on: replace vs supersede,
  source authority, `_meta` authorship, canonical block JSON, integrity
  chains, block signatures and replacement-funding verification (§V.2–V.4,
  §V.9–V.12).
- Extensibility, the module system and the module manifest schema
  (Parts VI, VII and X).
- The expression language, as the notation the standard's metric
  definitions and module calculations are written in, with its
  determinism, numeric model and error taxonomy (§VIII.1–VIII.6).
- The stated-figure verifiers (§VIII.9–VIII.12) and the optional
  sensitivity and stochastic profiles (§VIII.7, §VIII.8).
- The protocol error taxonomy (Part XI).
- The size-intensive registry (Part XIII).
- Representation discovery, fidelity classes, and media negotiation (§I.5).
- The optional portfolio profile (Part XV).
- The forward-compatibility rules for unknown frontmatter fields,
  unknown sections, and unknown extensions (Part XII).

### I.2 What this document does not specify

- The bytes-on-disk format. See [`UW_FORMAT_SPEC.md`](UW_FORMAT_SPEC.md).
- **The starter products.** How a tool produces, edits, displays,
  computes or projects a document is not part of the standard: display
  conventions and locales, view models, byte-preserving round trips,
  multi-variant edits, frontmatter update rules, the fallback cascade
  and default tables, refinement, workbook bindings, the AI agent host
  and capability tokens. The non-normative
  [starter products guide](../docs/starter/README.md) describes how the
  reference tools behave. Those tools keep their test suites and can
  change without a Protocol version (RFC 0078). A rule that protects
  verification stays here even when only a writer can break it:
  append-only provenance and `_meta` authorship (§V.2–V.4) are examples.
- UI design. Verification is defined over values, and display strings
  carry no meaning (RFC 0078 D11).
- Deployment-specific network server behavior. Optional [HTTP](bindings/UW_HTTP_BINDING_v1.md)
  and [MCP](bindings/UW_MCP_BINDING_v1.md) companion profiles carry registered
  representations, but no conformance tier requires a network transport.
- Persistence. How implementations cache, version, or back up the file
  is out of scope.

### I.3 Locale

Verification is locale-free. Canonical JSON content, digests,
signatures, receipts and expression evaluation do not vary by locale,
and a Verifier MUST reach the same verdict whatever display locale a
document declares (`frontmatter.locale`) or an implementation supports.
Display locales are starter-product guidance
([starter guide §III.1a](../docs/starter/display.md#iii1a-display-locales-rfc-0001)). The
`LOC-NN` validator family stays registered (§III.6a).

### I.4 Self-declaration

Every conforming implementation SHOULD expose an
`ImplementationManifest` that documents its tier, profiles, capabilities,
representations, supported asset classes, protocol version, and format
version. Hosts
that load `.uwx.md` files from third parties MAY use the manifest to
refuse files that exceed their declared format version.

**Normative schema:** [`spec/schemas/implementation-manifest.schema.json`](schemas/implementation-manifest.schema.json).
The TypeScript interface in [`@uwmd/verify`'s `protocol.ts`](../packages/uwmd-verify/src/protocol.ts)
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

Protocol 4.1.0 has two conformance tiers, Reader and Verifier, and a
Verifier satisfies every Reader requirement. Optional verification
profiles (§II.3) add to either tier. Only `reader` and `verifier` tier values are admitted (§II.5).


### II.1 Reader

A Reader MUST:

1. Parse all required frontmatter fields (`uw_version`, `deal_id`,
   `deal_name`, `created`, `last_modified`, `property_address`, `city`,
   `state`, `zip`, `asset_class`).
2. Recognize all 21 standard section IDs from format spec Part IV.
3. Treat unknown frontmatter keys, unknown sections, and unknown
   `x_*` extension blocks as informative: parse and surface them, but
   do not error.
4. Resolve supersede semantics: when multiple blocks share a `section_id`,
   the most recent non-superseded block is canonical (§V.2).
5. If — and only if — it claims the `validate` capability, emit only
   codes whose family is registered in §III.6a. A Reader that does not
   claim `validate` owes no validator codes.

A Reader MUST NOT silently mutate any input bytes.

A Reader surfaces structured values. How it displays them is not part
of the standard: the display conventions Protocol 2.x required of a
Tier-1 Reader (Part III) and the rendering of `BUILTIN_REMEDIATIONS`
copy ([starter guide §III.6](../docs/starter/display.md#iii6-validation-issue-display)) are starter-product guidance (RFC 0078 D11).

Parsing and validating are separate capabilities (`parse`, `validate`).
The validator requirement once read as owing every family to any
reader, including `INT-NN`, which needs a hash chain, and `POL-NN`,
which needs an edit engine. A read-only reader could not satisfy it.


### II.2 Verifier

A Verifier MUST satisfy all Reader requirements, and additionally:

1. Claim `validate` and apply the Format validation rules (format spec
   Format 3.0 Part V) to every
   document it verifies, emitting only registered codes (§III.6a).
2. Reproduce the standard's metric definitions. For each metric the
   standard defines, reproduce its quantized value (§VIII.5) from the
   document's stated inputs, by any method (RFC 0078 D2). A stated
   value that disagrees after quantization is a verification failure.
   A metric whose inputs are absent is `unverifiable`, not failed. The
   definitions are written in the expression notation of
   §VIII.1–VIII.3 and published in the normative [metric dictionary](metrics/README.md), including class-scoped formulas, input paths, minimum stated precision, round_to and null semantics.
   **Where a document states a metric (RFC 0099).** A statement of metric
   *m* is a finite JSON number at frontmatter `quick_metrics.m`, at `S.m`
   for each section `S` in the dictionary's
   `statement_bindings.output_sections`, or at each path in
   `statement_bindings.aliases[m]`, in every current block variant. It
   applies to every class whose dictionary has an entry with id *m*. The
   registry is closed: a field it does not bind is not a statement, and no
   binding is inferred from a field name. A Verifier MUST check every
   statement it finds, each address separately, with the entry's formula,
   `round_to` and comparison precision; a `failed` statement at any address
   fails verification. A non-numeric value at a bound address is not a
   statement. A metric marked `positive_size_denominator` is unverifiable
   when a registered size it divides by is stated below zero (RFC 0100).
3. Implement the stated-figure verifiers and apply them to the figures
   a document states: calendar-anchored cash flows, including the IRR
   procedure (§VIII.9); property cash-flow assembly (§VIII.9.6);
   distribution waterfalls (§VIII.10); property reserve accounts
   (§VIII.11); reserve draw bindings (§VIII.12); and
   replacement-funding bindings (§V.12).
4. Verify receipts as [`UW_RECEIPT`](UW_RECEIPT.md)
   specifies.
5. Be deterministic (§VIII.4) and follow the numeric model (§VIII.5):
   the same document and inputs MUST produce the same verdict and the
   same quantized values on every run and platform.
6. Wherever it evaluates an expression, whether as its method for
   requirement 2 or under the Module profile: parse the safe-expression
   grammar (§VIII.1) exactly as specified; implement the built-in
   function set (§VIII.3) with the listed signatures and semantics; and
   refuse expressions containing constructs outside the grammar
   (function definitions, assignments, lambdas, control flow keywords,
   property access on disallowed targets) with a `ProtocolError` of
   category `calc`.

A Verifier checks numbers. It never produces, defaults or projects one:
a value a document does not state is never filled in to make a check
pass (§I).

### II.3 Verification profiles

A profile is an optional, named addition to a tier. An implementation
declares the profiles it claims in `ImplementationManifest.profiles`
(§I.4). A check that belongs to a profile the implementation does not
claim is reported `unverifiable`, or refused with the typed refusal its
section names, and never reported as passed or failed.

| Profile | An implementation claiming it MUST | Capability flags (§II.6a.5) |
|---|---|---|
| `module` | Evaluate the formulas the standard does not itself define, in the expression language (§VIII.1–VIII.6): module calculations (Parts VII and X) and a document's own `custom_calculations` and `custom_scenarios` (§VI.2). | `module-load`, `calc-evaluate` |
| `integrity` | Recompute `content_hash` / `parent_hash` chains (§V.9, §V.10) and verify block signatures (§V.11). | `integrity`, `signing` |
| `representations` | Read and write the registered representations it advertises (UW Lite, XML mapping, CSV bundle) and negotiate them (§I.5). | the `representations` array |
| `portfolio` | Read and validate portfolio and relationship sidecars (Part XV). | `portfolio-relationships` |
| `sensitivity` | Reproduce stated sensitivity grids (§VIII.7). | `calc-sensitivity` |
| `stochastic` | Reproduce stated seeded distributions with the exact sampler (§VIII.8). | `calc-stochastic` |

A Verifier without the Module profile reports module and
document-declared calculations `unverifiable`, never wrong.


### II.4 Starter-product claims

Editing, display and AI-agent hosting are not conformance tiers. A tool
that edits documents or hosts agents compatibly with the reference
starter products says so as a product claim, against the
[starter products guide](../docs/starter/README.md) and its test
suites, not as Protocol conformance. The capability flags for that work
(`edit-replace`, `edit-supersede`, `edit-frontmatter`, `agent-host`,
`refinement`, `capability-verify` and the `render-*` family) stay in
`ImplementationManifest.capabilities`, so those claims remain checkable
against their fixtures (§II.6a.5).

A tool that writes documents is still bound by the rules that protect
verification: replace vs supersede (§V.2), source authority (§V.3),
`_meta` authorship (§V.4), canonical block JSON (§V.9) and integrity
chains (§V.10). A document that breaks them fails verification,
whoever wrote it.

### II.5 Tier composition

An implementation MAY claim partial conformance — e.g. "Reader + the
Integrity profile + `edit-frontmatter`". Such partial claims are
expressed via `ViewerCapability` flags and profiles rather than a tier
alone. An implementation whose capabilities do not stack into a tier
SHOULD publish capabilities and omit a tier claim rather than round
down.

A partial claim is **checkable**, not merely declarative: conformance
cases carry the capabilities they require (§II.6a.5), so a claim can be
run rather than believed.

Conformance tier values are only reader and verifier. No legacy value or numeric alias is admitted; modules declare requires_conformance and optional requires_profiles (§VII.4).

### II.6 Self-certification

To self-certify, run the cases owned by the claimed tier (including Reader
for Verifier) and explicitly claimed profiles whose required capabilities
(§II.6a.5) are a subset of the capabilities the implementation claims, and
verify the output matches. Publish starter-product results separately. A
self-certification claim MUST be published together with the capability
list it was run against, and with the number of cases skipped; "passes
the corpus" without that list does not identify what was run.

Directory membership is **not** a normative signal. Each case is tagged
with exactly one owner in [`conformance/corpus-index.json`](../conformance/corpus-index.json):
`reader`, `verifier`, one of the six profiles, or `starter-products`.
Directories are named by content (§Appendix C); their names do not
make editor, agent, rendering, default/cascade, projection or refinement
checks part of the standard. Starter checks remain in CI under
[`docs/starter/`](../docs/starter/README.md) ownership and are reported
separately from standard claims. A mixed check that also asserts product
behavior is a starter check; its assertions are retained in full.

An implementation in any language can be driven by the shared
conformance driver instead of writing its own, by exposing the CLI
protocol in §II.6a. That is strongly RECOMMENDED: two independent
re-implementations of a test runner drift, and when they do, "passes the
conformance corpus" stops meaning the same thing for two implementations
that both say it.

### II.6a Conformance CLI protocol (RFC 0004)

Self-certification (§II.6) is a claim. This section is how an
implementation makes that claim **checkable by somebody else**, in any
language, without writing its own test runner.

An implementation that wants to be driven by the shared conformance
driver exposes a command-line binary supporting the subcommands below.
The driver shells out to it; nothing about the implementation's
language, runtime, or packaging is observable across that boundary.

#### II.6a.1 Subcommands

| Invocation | stdout |
|---|---|
| `<bin> manifest` | The implementation's `ImplementationManifest`. |
| `<bin> parse <file>` | The parsed file, keyed as `ParsedUWFile`. |
| `<bin> validate <file> --json` | A structural `ValidationResult`, plus separate `replacement_funding_verification` (RFC 0070). |
| `<bin> render <file> --format <chat\|summary\|json\|csv>` | The rendered body, as text. |
| `<bin> edit <file> <operation.json> --json` | `{ ok, content?, error? }`. |
| `<bin> calc <file> <calc.json> --json` | A `CalcResult`, or an array of them for an array input. |

`edit --json` **MUST NOT** write the edited file. A driver that rewrote
fixtures as a side effect of reading them would corrupt the corpus it is
testing.

`render` emits the body rather than a JSON envelope. It is the one
subcommand whose natural output is text, and wrapping it would gain
nothing a driver can use.

`render` and `edit` drive starter-product fixtures (§II.4). Neither
tier requires them: an implementation that does not claim the `render-*`
or `edit-*` capabilities they need has those cases skipped (§II.6a.5).

#### II.6a.2 Stream and exit-code contract

- **stdout** carries exactly one JSON document (or, for `render`, the
  rendered text), optionally followed by a trailing newline. Nothing
  else. A log line, a deprecation notice, or a progress bar on stdout
  makes the response unparseable, and a driver MUST report that as its
  own distinct failure rather than as a wrong answer.
- **stderr** is free for diagnostics and is ignored by the driver.
  Warnings belong here.
- **Exit `0`** — the operation succeeded.
- **Exit `1`** — the operation failed in a way the protocol describes: a
  validation error, a refused edit, a calc that could not evaluate.
  stdout is still a parseable response.
- **Exit `2`** — unrecoverable internal error. stdout is not required to
  be anything.

Selected institution-config failures are operation errors, not ValidationResult
findings: `validate --json` emits only `{ "error": ProtocolError }` and exits1.
The exact codes, message/pointer precedence and source-admission ordering are
normative in §VI.3. No partial result or replacement-funding result accompanies
that refusal. Pure SOURCE/MODEL calls and receipts do not discover configs.

Implementations SHOULD emit UTF-8 regardless of platform locale.

#### II.6a.3 What the driver may assume about output

The driver compares a response against a frozen baseline. Baselines are
**projections**, not transcripts: a calc baseline names four fields, and
a conforming implementation reporting `round_to` and `display` as well is
more informative, not wrong. So comparison is a **subset** test by
default — every field the baseline names must be present and equal, and
extra fields are permitted.

Arrays are exempt from that leniency and compare length-sensitively. An
implementation that omits one validation issue has not been concise; it
has disagreed.

Values that differ legitimately between two correct runs —
`last_modified`, `_meta.provenance.timestamp`, the fence `ts=`, and `content_hash`,
which changes with the authored payload — are masked before comparison. A
baseline that pinned any of them would be asserting the clock.
`parent_hash` is **not** masked: it is stamped from the prior head's
`content_hash`, which the fixture fixes.

#### II.6a.4 Scope

Each generated portable case MUST carry exactly one `target`: `reader`,
`verifier`, `module`, `integrity`, `representations`, `portfolio`,
`sensitivity`, `stochastic`, or `starter-products`. The closed vocabulary
is mirrored by [`conformance-case.schema.json`](schemas/conformance-case.schema.json)
and `ConformanceTarget` in `protocol.ts`.  Directory and id prefixes do
not determine conformance. The reference ownership index is checked for
missing, duplicated and unclassified results; generating portable cases
also checks its exhaustive case identities.

The reference runner and the [portable driver](../conformance/runner/README.md)
select `--tier reader` or `--tier verifier` (which includes Reader),
`--profile <name,...>`, and `--starter-products`. With no selector they run
all their cases and report counts by target, keeping starter checks
separate. Profile selection does not imply another profile. `--tier` accepts only reader or verifier; any other value is a usage error. No numeric shortcuts or suite aliases are admitted.

Profile cases without an explicit manifest profile claim are reported
`unverifiable` (§II.3), never passed or failed. Capability skips (§II.6a.5)
remain a distinct outcome. Both appear in the report; `--no-skip` makes
an incomplete claim fail the certification run without treating an
unsupported profile as a wrong numerical answer.

The portable cases cover checks expressible as one CLI operation. The
reference runner also checks multi-step contracts, receipt verification,
integrity, representations and other cross-fixture invariants. Passing
only the portable subset is not a claim about omitted checks. Existing
fixture-family selections remain available in the reference runner via
`--suite=<family>`. Baseline updates require a full run or `--suite`, because
target filtering inside a mixed suite must not overwrite unselected
baselines. A family includes its child suites; updates selecting only a child suite are refused.

#### II.6a.5 Required capabilities and skips

Each conformance case MAY declare `requires_capabilities`, an array of
`ViewerCapability` values. Within the selected tier/profile scope, a
case with no such key has no capability-based exemption. Unclaimed
profiles remain `unverifiable` (§II.3), and starter-product checks remain
outside Protocol conformance (§II.4).

An implementation driven by the conformance driver **MUST** populate
`capabilities` in its `manifest` output. An absent or empty list
**MUST** be treated as claiming every capability: a missing declaration
is not a licence to skip, and forgetting the field has to fail closed
against the claimant rather than exempt it from the corpus.

A driver **MUST** report a case whose required capabilities are not all
claimed as **skipped**, and **MUST NOT** count it as passed. The skip
count and the capabilities that caused it are part of the result: a
report stating only a pass count does not distinguish an implementation
that ran the corpus from one that declined it.

A driver **SHOULD** offer a mode that treats any skip as a failure. The
reference implementation claims every capability, so it runs that way
in CI — otherwise a case tagged with a capability nothing claims stops
being executed and nothing says so.

Example:

```jsonc
{
  "id": "starter-products__starter-editor__section-supersede-risk-rating__edit",
  "target": "starter-products",
  "requires_capabilities": ["edit-supersede"],
  "command": "edit",
  "args": ["before.uw.md", "operation.json", "--json"]
}
```

#### II.6a.6 The parse conformance projection

`uwmd parse --json` output is compared against a baseline as a
**subset**: every key the baseline names MUST be present and equal, and
an implementation MAY emit more. The baseline therefore states the
minimum a conforming reader surfaces, not the shape of its model.

```jsonc
{
  "frontmatter": { /* every frontmatter key, verbatim */ },
  "sections": {
    "<section_id>": { "meta": { /* _meta */ }, "content": { /* block content */ } }
  },
  "superseded": { "<section_id>": [ /* same shape, document order */ ] },
  "pipeline_log": [], "custom_calculations": [], "custom_scenarios": [],
  "extensions": {}, "prose": {}
}
```

A multi-variant section (§2.8) nests one such object per variant key.

`_meta` carries **only the keys the document carried**. A parser that
fills every optional field with a default MUST NOT project the filled
value: absent and explicit-`null` are distinguishable in the source, and
a baseline that demanded `"agent_id": null` from a document never
mentioning `agent_id` would assert a distinction the source does not
make.

Not part of the projection, and MUST NOT be required of any
implementation: fence-annotation echoes recoverable from `_meta`, source
line numbers, per-block prose recoverable from the document, and the
`_notes` fence member (an annotation excluded from this parse projection, though included in the block digest). These
are artifacts of a particular reader. `prose` therefore appears in a
baseline as `{}`: an implementation MAY populate it, and a baseline MUST
NOT demand entries.

This section exists because the requirement it replaces lived in a
corpus README and made `@uwmd/core`'s in-memory `ParsedUWFile` a
protocol surface by accident. §II.1 requires a reader to surface
structured data; it does not prescribe a shape, and a conformance
corpus is not the place to add one silently.

---

## III. Currency and Validator Codes

Display is starter-product guidance (RFC 0078 D11): verification is
defined over values, and display strings carry no meaning. The display
conventions moved to the non-normative
[starter products guide](../docs/starter/README.md). Two sections stay
normative here because they are not display: §III.1b, document currency
identity, is format semantics, and §III.6a, the validator code
taxonomy, belongs to the error taxonomy (Part XI).



### III.1b Document currency identity (RFC 0046)

`frontmatter.currency_code` is an optional document-level denomination
assertion. If present it MUST match `^[A-Z]{3}$`; a malformed value emits
`CUR-01` (error) and display renders MUST refuse it. A syntactically valid
code is preserved as authored identity; the reference implementation does
not perform a live ISO 4217 allocation lookup.

The field applies to monetary display values and calc result display strings
in the document. It does not alter canonical numeric storage, CSV/JSON
interchange, Lite canonicalization, hashes, signatures, receipts, or numeric
calculation. This first tranche supports one currency per document only;
per-value identity, FX, and mixed-currency arithmetic require a future
additive money representation.






### III.6a Validator code taxonomy

Every issue code emitted by a conforming validator MUST carry a
**registered family prefix**. The prefix is part of the contract —
adopters filter, group, and route issues by prefix without parsing the
message text.

Each family names the **capability that owns it**. An implementation
MUST NOT be required to emit codes from a family whose owning
capability it does not claim (§II.5), and conformance cases for those
codes are tagged accordingly (§II.6a.5). A family with no owning
capability is unconditional: every implementation owes it.

| Prefix | Family | Owning capability | Default severity |
|---|---|---|---|
| `CC-NN` | Cross-section consistency — two or more sections disagree about the same fact. NN is a two-digit integer registered in this spec. | `validate` | `warning` or `error` per check |
| `FV-NN` | Single-section financial validity — a value falls outside a registered plausibility threshold. | `validate` | typically `warning` |
| `DQ-NN` | Data quality — a required value is missing, provisional, or below a stage threshold. | `validate` | `warning` or `error` |
| `MU-NN` | Mixed-use composition (§XII). | `validate` | `warning` or `error` |
| `CS-*` | Capital stack (§XIII); RFC0096 adds CS-03 sizing-declaration admission; RFC 0050 registers `CS-02b` for malformed split preferred-equity coupons; RFC 0098 adds CS-04 for an absent or invalid `point_in_time`. | `validate` | `warning` or `error` |
| `DS-NN` | Debt structure field admission (format §4.7, RFC 0098): `DS-01` refuses a stated `point_in_time` outside `closing`/`stabilization`. | `validate` | `error` |
| `SIZE-NN` | Generic size contract (format §5.5, RFC 0100): `SIZE-01` refuses a stated size, count, area or rent in the closed table that is negative or non-finite or, for a count, not an integer. `CLS-04` stays the class contracts' code. | `validate` | `error` |
| `LU-NN` | Lease-up schedule structure — period grammar, contiguity, presence and closed LU-05 payload admission (format spec §4.25, RFCs0008/0096). | `validate` | `warning` or `error` |
| `RT-NN` | Return-metric declarations — the `dcf.returns` basis fields (format §4.9, RFC 0038). | `validate` | `error` |
| `PS-NN` | Period-series shape and identity (RFC 0041). | `validate` | PS-01/03 warning; PS-02 error |
| `ROLE-NN` | Signed block role vocabulary (RFC 0040). | `validate` | `error` |
| `LOC-NN` | Display locale ([starter guide §III.1a](../docs/starter/display.md#iii1a-display-locales-rfc-0001), RFC 0001). | `validate` | `error` |
| `CUR-NN` | Document currency identity (§III.1b, RFC 0046). | `validate` | `error` |
| `TAX-NN` | Property-tax reassessment basis and abatement schedule (format §4.5 and §4.9, RFC 0053). | `validate` | `error` |
| `LSE-NN` | Commercial lease clauses — escalation steps, break options, co-tenancy, TI/LC balances (format §4.3, RFC 0055). | `validate` | `error` |
| `HDG-NN` | RFC 0070 adds HDG-07/08/10 structural funding rules and HDG-09 solely for async digest mismatch. Interest-rate hedges — cap strike, notional, term and post-expiration assumption (format §4.7, RFC 0056). `rate_swap` and `rate_collar` are reserved and refused by `HDG-02`. | `validate` | `error` |
| `ESC-NN` | Escrow and reserve cash lines, and the rate-cap replacement tie (format §4.8, RFC 0056). | `validate` | `error` |
| `WF-NN` | Distribution waterfall structure (format §4.27, RFC 0035/0036/0051) and the RFC 0059 clawback provision (`WF-10`–`WF-13`, `WF-15`). RFC0096 adds WF-16 stated-claim admission. Stated-figure disagreement is reported by the verifier as `WF-OUTCOME-DISAGREES`, not as a validator code. | `validate` | `WF-15` warning; otherwise `error` |
| `REC-NN` | Expense recoveries and the CAM true-up (format §4.3, RFC0058), with closed REC-11 admission (RFC0096). The capped amount and the pool allocation are stated, not recomputed; `REC-07` checks only the direction a cap can move. | `validate` | `error` |
| `RDB-NN` | Optional reserve draw binding plan/source/allocation verification (§VIII.12, RFC 0065); ordinary document validation and assembly unchanged. | `calc-evaluate` | `error` |
| `RSV-NN` | Property reserve-account structure (RSV-01–05, Format §4.28, RFC 0064); separate balance verifier findings RSV-06–08 (§VIII.11). No expenditure netting or assembly admission. | `validate` | `error` |
| `CAPX-NN` | Renovation draw and expense-targeted capex (format §4.8, RFC 0057). `CAPX-07` requires the `in_noi_model` disclosure; no stated saving is ever applied. | `validate` | `error` |
| `BED-NN` | Student-housing bed counts — in-place and pre-leased beds and the dates they were measured on (format §4.3, RFC 0069). Counts are stated, never derived from one another. | `validate` | `error` |
| `META-*` | Format 3.0 bare/nested block shape and required nonempty provenance actor and bounded placement/section/quality admission (`META-01`, RFCs 0081/0090/0093), required canonical boolean members (`META-02`/`META-03`, RFC0091), exactly three present-invalid canonical leaves (`META-04`, RFC0094), and closed optional/conditional metadata (`META-05`/`META-06`, RFC0095). | `validate` | `error` |
| `MOD-CALC-*` | Official class or module calculation errors. | `validate`, `module-load` | `error` |
| `MOD-RULE-*` | Safe-expression rule errors from builtin or module validation. | `validate`, `module-load` | `error` |
| `CLS-NN` | Official builtin field contracts (RFC 0080, RFC 0081). | `validate` | error |
| `CC-DC-NN` | Data-center class rules (Format §4.29–§4.31). | `validate` | warning / error |
| `CC-MH-NN` | Manufactured-housing class rules. | `validate` | error |
| `CC-HOSP-NN` | Hospitality class rules. | `validate` | warning / error |
| `INVALID-ASSET-CLASS-NNN` | Asset-class identifier syntax (§X.2). | `validate` | `error` |
| `SRC-NN` | Actor grammar and closed resolution vocabulary (Format §2.6). | `validate` | `error` |
| `INT-NN` | Integrity — `content_hash` / `parent_hash` chain (§V.10). | `integrity` | `warning` or `error` |
| `POL-NN` | Edit policy (§V.3; `POL-03` is the capability-token refusal, [starter guide §XIV](../docs/starter/capability-tokens.md#xiv-capability-tokens-optional-rfc-0011)). | `edit-replace` or `edit-supersede` | `error` |
| `MOD-*` | Module runtime (§X). | `module-load` | `info` to `error` |
| `CALC-*` | Calc engine (§VIII). | `calc-evaluate` | `error` |
| `UNSUPPORTED_YAML_FEATURE` | Frontmatter YAML subset violation (format Appendix D). | `parse` | `error` |
| `UNSUPPORTED_FORMAT_VERSION` | Absent or non-3.0 document version (RFC 0081). | `parse` | `error` |
| `PROTO-*` | Protocol-level refusal — a malformed request. | *(none)* | `error` |
| `RCP-*` | Verification receipt (§XI). | *(none)* | `error` |

**Coverage (RFC 0037).** Beside its issues, a conforming validator reports
a per-check coverage record for the `CC-NN` family — `evaluated`, or
`skipped` with a reason (`section_absent`, `variant_unresolvable`,
`field_absent`, `not_applicable`) — as format §5.3 specifies. A host that
displays validation results SHOULD show "not evaluated" distinctly from
"clean": the two are different facts about the document, and the
difference is the whole reason the record exists. `CC-16` (`info`) is the
one skip that also surfaces as an issue, because the producer can act on
it by declaring an eligible statement or resolving a consulted role collision.

**Role-aware selection (RFC 0040).** Implement format §2.8/§5.3 using the
closed `BLOCK_ROLES` and frozen `CROSS_CHECK_ROLE_PREFERENCE` table. Report
optional per-section `CrossCheckCoverage.resolutions` only for role-bearing
selections; role-free results remain unchanged. `ROLE-01` is a structural
error in every active block with an invalid scalar `_role`. This annotation
is included in the existing content hash; `_meta.role` is not an alias.

`FV-NN` is the financial-validity vocabulary; no `legacy_code` is emitted.
`META_*` (underscore) is the **provenance-completeness family** and is live:
the reference validator emits exactly three codes — `META_MISSING` (no `_meta`
object), `META_FIELD_MISSING_<FIELD>` (a required `_meta` field absent), and
`META_LOW_CONFIDENCE_NO_REVIEW_FLAG` (`info`: low confidence without
`human_review_required`) — and the Reader conformance baselines pin them.
`<FIELD>` ranges over exactly five names, each naming one nested Format 3.0
field: `SECTION` (`_meta.section`), `VERSION` (`_meta.lifecycle.revision`),
`SOURCE` (`_meta.provenance.source`), `TIMESTAMP`
(`_meta.provenance.timestamp`) and `CONFIDENCE` (`_meta.quality.confidence`).
The code names are unchanged (RFC 0081 §3), so `VERSION` names the revision
field. The `DQ-NN` sequence polices incomplete *data*, not incomplete
*provenance*; the two families do not overlap.

The separate hyphenated `META-01` rejects a block that is not in the Format
3.0 shape (format §2.4–§2.5). `SOURCE_CONTENT_MISMATCH` rejects structured
fences under `.uw.md`; `UNSUPPORTED_FORMAT_VERSION` rejects absent or non-3.0
frontmatter.

**Bounded metadata admission (RFC0093).** After the complete existing
wrapper/nested-object shape checkpoint, emit one `META-01`/error for each failed
predicate below, on every retained physical block followed by model-only blocks
in the exact-identity union order defined below. Within each block emit P1, P2,
then P3. Complete this entire pass before the actor pass and META-02/03 pass;
retain all unrelated issue ordering and existing completeness populations.

| Predicate | Error condition | Exact field |
|---|---|---|
| P1 | Present canonical top-level `_meta` is not first under the operation-specific member order. | `_meta` |
| P2 | Present canonical `_meta.section` is not a nonempty string exactly equal to the admitted fence annotation section. | `_meta.section` |
| P3 | Required canonical `_meta.quality` is absent, null, an array or a scalar. | `_meta.quality` |

Existing whole-missing-meta and rejected wrapper/provenance/lifecycle shape
precedence suppress these additions, actor and child-boolean findings. Missing
`section` keeps its existing warning without P2. P1/P2 do not suppress actors or
admitted-parent boolean findings; P3 suppresses only quality-dependent META-02.
An actor-only error does not suppress this pass. Empty quality objects pass P3;
missing confidence keeps its existing warning and missing review flags retain
META-02. Matching unknown nonempty section ids pass P2; no trimming, aliasing,
coercion, inferred metadata or schema-wide fallback is permitted.

For actual structured fenced-JSON source operations, P1 uses the lexical sequence
of decoded top-level member names from a fresh parse of the supplied source.
Escaped `_meta` is the same name; numeric-index enumeration and canonical sorting
cannot recover authored order. Source-taking validation, CLI and receipt operations
MUST use this source rule for actual JSON blocks. Mutable-model operations instead
use the current own enumerable non-array-index string-member order. An array-index
name is exactly the canonical unsigned decimal spelling from0 through4294967294;
`00`, `-0` and `4294967295` are not array-index names. Numeric members alone cannot
create a model P1 error. A source with `0` before `_meta` fails P1, while its model
can have `_meta` first among non-index members; the model result certifies no
authored numeric order. Current canonical content/annotation, not cached meta,
`raw` or `rawJson`, supplies the predicate values. Ordinary ValidationMessage
objects gain no category; ProtocolError transport uses category `validate`.

Other representations keep their accepted codec/compilation path. UW Lite has
no authored fenced-JSON order and uses its compiled model order without a new
lexical-evidence refusal. Findings enter ordinary issues/error partitions,
status and CLI exits. Receipt policy counts use actual validation findings;
subject construction, digest and authentication/verdict precedence are unchanged.
This amendment allocates no other metadata or payload requirement.

**Required actor admission (RFC 0090).** Extend only
`META-01`/error to absent, null, exact-empty or non-string canonical
`_meta.provenance.actor`, one finding per assessed block, field
`_meta.provenance.actor`. Existing wrapper/nested-object shape failures and
whole-missing-meta handling take precedence and suppress the additional actor
finding for that block. Preserve completeness codes, severities, applicability
and relative order. Preserve all existing visible-model shape findings first;
then apply the exact existing wrapper/nested-object predicate/message to
previously unseen retained physical block references in source order. This
explicit source-accounting correction precedes the actor pass and
adds no other metadata-schema requirement. The actor pass precedes role,
period-series and source-vocabulary checks.

Source validation MUST include every retained physical block before reduction,
including history, overwritten selections, variants, append-only entries and
extensions, in physical source order. Model assessment MUST use parser-retained
actual block references plus provided model-only blocks, deduplicating exact
object identity, then traversing model-only blocks in `sections`, `superseded`,
`pipeline_log`, `custom_calculations`, `custom_scenarios`, `extensions` order
(entry/array order within each). In-place edits are observed; replacement or
removal from a projection does not erase retained physical evidence. A model
without that parser-object inventory assesses only its supplied collections;
its `raw` string does not certify complete source coverage and MUST NOT be
silently reparsed to override current values. Fresh-source conclusions require
a fresh parse of the exact operation input. This does not redirect other
validation checks to historical blocks or import V.13 signing restrictions.

**Required metadata booleans (RFC0091).** After all shape and actor
findings, emit `META-02`/error for an absent, null or nonboolean canonical
`_meta.quality.human_review_required`, and `META-03`/error for an absent,
null or nonboolean canonical `_meta.lifecycle.superseded`. Attribute each
finding to that exact field and block section. Both literal booleans pass;
MUST NOT coerce, infer or insert either value. Whole missing metadata or an
existing wrapper/nested-object shape failure suppresses both child findings.
A missing or nonobject quality container suppresses only META-02; its separate
container failure is P3 above. An actor-only META-01 suppresses
neither flag. Existing completeness/low-confidence rules remain unchanged.

Use the retained-physical plus model-only identity union and canonical inline
metadata authority defined above for actors, including history and otherwise
unselected peers; no stale raw reparse or selection change. Traverse physical
blocks first, then model-only collections in the stated order; within each
block emit META-02 before META-03. This pass precedes role, period-series and
source-vocabulary checks and preserves unrelated findings' relative order.
No other required metadata field or malformed parent gains an allocation.

**Present-invalid metadata leaves (RFC0094).** Complete the entire required
boolean pass first; then, before role/period/source checks, traverse the same
retained-physical plus current model-only exact-reference union above. For each
block emit `META-04`/error for each present invalid canonical leaf, in this order:

| Field | Admitted present domain |
|---|---|
| `_meta.quality.confidence` | Exactly the strings `high`, `medium`, `low`. |
| `_meta.lifecycle.revision` | Finite integral number at least1; JSON1.0/1e0 are integer1, booleans are not numbers for this predicate; no new maximum. |
| `_meta.provenance.timestamp` | Exact T1B UTC-Z domain in Format §2.5 and below. |

T1B consumes the entire string `YYYY-MM-DDTHH:mm:ss[.digits]Z`, using only ASCII
digits, year0000–9999 and valid proleptic Gregorian month/day (leap if divisible
by400 or divisible by4 but not100), hour00–23, minute/second00–59, uppercase T/Z
and an optional nonempty fraction without a new length cap. Reject every numeric
offset, lowercase separator, whitespace, second60 and invalid date without
normalization, time-zone conversion, host-parser authority, clock or calendar
lookup. The allocation imposes no age, temporal ordering or revision-chain test.

Presence means an own member of the admitted canonical parent. An absent leaf
never gains META-04. Keep every existing completeness warning predicate,
applicability and relative order, including null warnings alongside new errors.
Old rejected metadata/provenance/lifecycle shapes suppress descendants; missing
or nonobject quality suppresses only confidence. Other shape/actor/boolean
errors do not suppress these leaves. Use current canonical values, never cached
metadata aliases or stale raw text; resolved source composition accounts for
original root, actual consumed parts and derived model references as above.

Each finding identifies its exact canonical field and section. Ordinary issues
gain no category; ProtocolError transport uses `validate`. Findings enter normal
issues/error partitions, status and CLI exits. Newly issued receipt policy counts
follow actual validation findings; source digests, authenticated subjects,
issuance rules and authenticate-first receipt verdict precedence are unchanged.
Validation stays read-only. Optional/conditional metadata and all other shapes
remain outside this closed list; no generic fallback is allocated.

**Closed optional metadata and reference admission (RFC0095).** Complete all
META-04 findings before the entire META-05 pass; complete META-05 across the
physical/current MODEL identity union before the entire META-06 pass. Only then
run existing role/period/source checkpoints and remaining checks in their
existing relative order. Do not globally sort or interleave old per-block
findings. Exact reference deduplication, current canonical own-member authority,
SOURCE versus MODEL and resolved root/consumed-part accounting above apply.

META-05/error has exactly these predicates, in this per-block order:

| Field | Invalid present domain |
|---|---|
| `_meta.provenance.agent_id`, then `.agent_version`, then `.notes` | Neither string nor null. |
| `_meta.quality.flags` | Not an array; otherwise each non-string item at its indexed field, in array order. |
| `_meta.quality.partial`, then `.provisional` | Not a literal boolean. |
| `_meta.quality.field_overrides` | Any present value; use block-level annotations. |
| `_overrides` | Not an array; otherwise each entry in array order. |

For each override entry: a nonobject/null/array receives one parent META-05 and
no children. An object receives independent findings in path/confidence/reason/
note order: path absent or non-string; present confidence outside high/medium/low;
present reason outside illegible/missing/overridden/estimated/computed; present
note non-string. Unknown members, empty strings, duplicate/unmatched paths gain
no extra rejection. Source/resolution remain SRC-owned; no generic fallback.

META-06/error uses agent_id, inherited_from, market_data_ref order per block:

- A valid canonical `agent/<id>` source requires an own agent_id member. Absence
  yields META-06; null/empty string satisfy presence. Wrong present types yield
  META-05 only. An invalid source/override source creates no agent-id trigger.
- An optional absent carrier passes. A required absent or any present invalid
  carrier yields one parent finding; only non-null non-array objects are
  admitted, with no duplicate absence or child findings beneath invalid parents.
- inherited_from children are checked once in document_id/digest/distance order:
  required string, exact sha256: plus64 lowercase ASCII hexadecimal digits,
  finite JSON integral number at least1. No nonempty document id or safe-integer
  ceiling is added; booleans are not numbers.
- market_data_ref children are checked once in document_id/as_of/digest/rationale
  order: required string, required exact Gregorian date-only below, required
  exact digest above, then optional string rationale. Unknown children pass.

The two carrier absence triggers are symmetric: own canonical resolution OR
any own resolution of any stated object override entry equals the corresponding
inherited_assumption or market_data_accepted tag. Missing, invalid, duplicate,
unmatched and shadowed paths never remove an assertion; a later tag does not
retract earlier tags. Collapse all assertions to one obligation per block/carrier,
not per path. Inherited prototypes/nonobject entries do not trigger. Canonical
inheritance plus an override market assertion requires both carriers. Fetching,
hop inference and arbitrary peer/effective-leaf selection are forbidden here.

market_data_ref.as_of is the entire ASCII string YYYY-MM-DD, years0001–9999,
with valid proleptic Gregorian month/day and the400/4/100 leap rule. No whitespace,
Unicode digits, year zero, reduced widths, timestamps, offsets, trimming or
normalization. This is not T1B. Missing as_of in an admitted carrier produces
one child finding; a missing required carrier produces only its parent finding.
Reference digests require an absolute end, including rejection of line endings.

Whole-missing/rejected canonical metadata/provenance/lifecycle suppresses these
canonical descendants. Missing/nonobject quality suppresses only its own new
quality predicates. Sibling _overrides remains independent even with rejected
metadata. Actor or META-02/03/04 errors do not suppress otherwise admitted new
predicates; invalid agent_id does not suppress references. Later DQ checks must
tolerate invalid optional shapes and apply their accepted literal boolean
predicates. Existing completeness warnings and META-01–04 remain unchanged.

DQ-06/info means declared-stage readiness only. Remove promoted-reference
DQ-06/error and duplicate emission; META-06 owns attribution under the rule
above. Preserve readiness placement, CC-14 suppression and unrelated order.
Issues keep exact field/section/severity and ordinary result partitions, status
and CLI exits. ProtocolError category is validate; ordinary issues gain no
category. Newly issued receipt policy counts reflect actual findings; subject,
digest, issuance and authenticate-first verdict rules remain unchanged.
Validation is read-only; no new result state, inferred value or source repair.

#### Closed current-payload admission (RFC0096)

The validation-only error allocations are LU-05 (Format §4.25 model/payload
admission), REC-11 (Format §4.3 remaining recovery leaves/closed objects),
CS-03 (Format §4.24 stated sizing declarations, including admitted components),
and WF-16 (Format §4.27 stated claims and remaining clawback leaves).
The corresponding Format tables define every closed predicate; no schema
fallback or financial-result interpretation is allocated. Ordinary findings
carry no category; ProtocolError transport uses category validate.

A number means a finite binary64 numeric value; booleans are not numbers.
An integer is a finite number with no fractional component; this RFC adds no
safe-integer ceiling. A nullable optional field may be absent or exactly null.
An own, present non-null value MUST satisfy its named predicate. Required
members in the four Format allocations are required own members, without trimming, coercion, inferred
defaults or filling absent values. String length means the actual nonempty
string, so whitespace is not silently trimmed. Unknown members are rejected
only in the exact closed objects enumerated here. `_notes` is never validated;
`_meta`, `_role` and `_overrides` retain their existing universal owners.

These payload allocations MUST visit the current canonical block or every
current variant of each named standard section, independently of a financial
role-selection fallback. A role collision or missing financial primary does
not exempt other current peers from admission. This is the existing payload
population of Format4 and the original formal audit, not metadata's
all-retained-physical population. History, superseded/overwritten physical
blocks and physical append inputs which no longer constitute a current payload
MUST NOT independently gain these errors. Unknown/extension sections and
nested opaque lookalikes are not these named payloads.

SOURCE MUST freshly parse the actual source, perform accepted selection and
composition, and assess the assembled current payload. A consumed part's
payload is assessed where it becomes current assembled content, not again as
an independent physical block. Unused loaded parts are not assessed. MODEL
MUST assess current own model members, without stale raw/convenience metadata
or reparsing away mutations. Existing unresolved, unavailable and unsupported
composition refusals remain typed operation outcomes; this RFC neither invents
missing payloads nor turns source availability into a structural error.
Metadata's separate root/consumed-part/derived-model physical union remains
unchanged under RFCs0090/0091/0093/0094/0095.

Container precedence is local: emit one parent-carrier finding and stop that
subtree when its listed container type fails; continue independent siblings.
A required own member's absence and a present invalid value produce one finding
at that exact member, not simultaneous missing/type findings. A leaf failing
several predicates produces one finding. A condition already owned by an
existing registered error in the four allocations MUST NOT be emitted again under a new code.
Deduplication requires the same selected block, row, field and predicate; an
unrelated REC/LU/WF finding never suppresses an unowned sibling.

Run one complete payload-admission pass after existing data-quality checks,
before CC-16 coverage-summary output, remediation enrichment and result
partitioning. It MUST preserve all existing checks' relative order. Within
this pass use LU-05, REC-11, CS-03, WF-16 family order. Visit an unlabelled entry
as one current block; for maps visit every current variant in Unicode code-point
key order. Admitted component-class keys use the same ordering, only under the existing
mixed_use and declared component-class eligibility of Format4.23; an unknown
component key or opaque nested object does not create a new traversal scope. Do not select only base or
primary. This pass does not resort the preexisting issue array.

Within LU use model_type, stabilization_target, assumptions, schedule,
stabilized_summary; within REC visit tenant array order, terms before true-up,
with terms field order as its closed list above, cap fields pct/over/accumulation,
and true-up row fields as its closed list above. Within CS visit array order,
then id, fn, selector union, value. Within WF visit clawback, stated_outcomes,
stated_schedule; clawback floor_rate then floor_multiple; outcomes lp then gp
(contributions, distributions, moic, xirr), then promote_total, profit_total,
clawback_amount; schedule row date then by_tier; tier rows tier, lp, gp.
In each object assess its listed fields first, then unknown own members in
Unicode code-point order. Parent failure stops only its subtree.

Existing code ownership is predicate-based, not an instruction to concatenate
duplicate full validation arrays. Implementations may share admission helpers
with existing validators, but MUST preserve the registered findings, exact
fields, independent siblings and order. No schema-library error order defines
the result. Errors enter ordinary errors/issues partitions and existing overall
status and CLI exit semantics. Stage readiness remains independently derived;
no profile or complete-Verifier claim follows from this allocation.

Existing per-lease structural REC-01–04 and REC-09 admission applies to current
rent_roll peers independently of property-level cross-check resolution. Keep
existing selected-check order, assess remaining peers once without duplicate
selected findings, and do not expand REC-05–08 arithmetic or unrelated LSE checks.
Newly issued receipt policy counts use actual findings under existing issuance
rules; no subject, digest, signature, result-state or verdict-precedence change.

Retired agreement/transition codes are not emitted: HDG-04/05, ESC-03, CAPX-05, REC-10, TAX-04, CLS-01/02/05, META-V2-IN-V1 and META-V1-IN-V2. SRC-01/02 are errors, and SRC-03 refuses any resolution outside the closed vocabulary.

RFC 0072 extends the existing data-quality sequence with `DQ-07`
(scenario structure/vocabulary), `DQ-08` (BTR subtype carrier disagreement)
and `DQ-09` (BTR class scope), all **warning**.
Their rules live in Format §2.2b/c and §5.4; they introduce no calculation,
default-selection or underwriting procedure. Their canonical copy is in
`BUILTIN_REMEDIATIONS`; the remediation schema already admits these entries.

`CC-NN`, `FV-NN`, `DQ-NN`, `MU-NN`, and `SRC-NN` are closed sequences extended by
RFC without renumbering. `MOD-*` and `CS-*` are open extension points:
modules MAY add their own, and adopters MUST treat an unknown code
within a registered family the same way they treat a known one (render
the message; consult `BUILTIN_REMEDIATIONS` if present; fall back to
message text otherwise).

**This table is not the mechanism that keeps itself current.** It said
"one of three families" for four minor versions while the reference
validator emitted eighteen, because a prose list duplicating a list
that lives in code goes stale silently. The machine-readable registry
is `VALIDATOR_CODE_FAMILIES` in
[`packages/uwmd-verify/src/protocol.ts`](../packages/uwmd-verify/src/protocol.ts),
remediation copy is `BUILTIN_REMEDIATIONS` beside it, and a test
asserts every code in the latter resolves to a family in the former.
The spec states the rule; the assertion enforces the list.

**Remediation entries.** Every entry in `BUILTIN_REMEDIATIONS` and any
module remediation table MUST validate against
[`spec/schemas/issue-remediation.schema.json`](schemas/issue-remediation.schema.json).
(This stays normative because it governs the code registry, not display.)

Implementations that surface validator output to end users SHOULD use
the prefix to colorize, group, or filter issues — for example,
collapsing `MOD-*` and `INT-NN` notices behind a "show provenance
issues" toggle while always surfacing `CC-NN` and `FV-NN` inline.

---





---

## V. Edit Semantics

**Normative schema:** [`spec/schemas/edit-operation.schema.json`](schemas/edit-operation.schema.json)
defines the wire shape for every `EditOperation`.

Editors are starter products (§II.4). What stays normative in this part
are the rules that protect verification, which bind every tool that
writes a document: §V.2–§V.4 and §V.9–§V.12. Round-trip preservation
(starter guide §V.1), multi-variant edits (starter guide §V.5), frontmatter
update rules (starter guide §V.6), the fallback cascade (starter guide §V.7)
and default tables (starter guide §V.8) are in the non-normative
[starter products guide](../docs/starter/README.md) (RFC 0078 D3, D4). Integrity hashes are computed over canonical JSON
(§V.9), not raw bytes, so byte preservation is an editor guarantee, not a
verification requirement.

**Trusted role assignment (RFC 0040).** `section_replace` and
`section_supersede` accept optional `role: BlockRole | null` outside `content`.
Omission preserves the prior block's `_role`; a valid scalar assigns it;
null removes it. Invalid assignments MUST be refused as `PROTO-EDIT-002`.
The host MUST strip `content._role` and MUST NOT populate the trusted `role`
field from model output. Agent writing preserves an existing role and strips
invented roles on new blocks. Hashing and signature verification cover this
annotation through the existing content path, without new exclusions.

**Metadata patch.** `section_replace` and `section_supersede` carry `meta`, a
patch with optional `provenance` and `quality` objects whose members override
the `_meta` the host builds for the written block. The host owns `section`,
`lifecycle` and `integrity` (invariant 5), and the actor: a
`meta.provenance.source` other than the source the edit was authorized for
MUST be refused as `PROTO-EDIT-002`. Any other `meta` member, including a flat
`source` or `confidence`, MUST be refused as `PROTO-EDIT-002` rather than
ignored. An agent writer's `content._overrides` is dropped: per-field override
provenance is written only by a human writer.


### V.2 Replace vs supersede

| Operation | Effect |
|---|---|
| `frontmatter_set` | In-place update of one frontmatter path. `last_modified` MUST be updated. |
| `section_replace` | Overwrite the canonical block for `section_id`. The previous block is discarded. Permitted only for sources whose policy is `supersede_on_edit: false`. |
| `section_supersede` | The previous block is marked `_meta.lifecycle.superseded: true`; a new block is appended with `_meta.lifecycle.revision = previous.revision + 1`. |
| `pipeline_log_append` | Append-only. Existing entries are immutable. |

### V.3 Source authority

RFC0093 metadata admission uses the canonical source/model authority and exact
retained-physical identity union in §III.6a. It changes no actor namespace or edit
authority. Placement, section and quality failures do not authorize source repair.

`_meta.provenance.source` is **actor-only** (RFC 0031): `manual`, or
`<namespace>/<id>` where the namespace is one of the closed set
`agent | document | system | institution` (runtime registry
`ACTOR_NAMESPACES`) and `<id>` matches `[A-Za-z0-9][A-Za-z0-9._-]*`.
The grammar is normative in format spec §2.6; resolution methods
belong in `_meta.provenance.resolution` (the fallback cascade,
[starter guide §V.7](../docs/starter/defaults-and-cascade.md#v7-fallback-cascade)).

`BUILTIN_EDIT_POLICIES` (`protocol.ts`) establishes the default policy
for each `_meta.provenance.source` pattern:

- `agent/*` → `either` authority, `supersede_on_edit: true`.
- `manual` → `either` authority, `supersede_on_edit: false`.
- `document/*` → `either` authority, `supersede_on_edit: true`.
- `system/*`, `institution/*` → `system_only` authority,
  `supersede_on_edit: false`.
- `*` (terminal catch-all) → `either` authority,
  `supersede_on_edit: true`.

The catch-all is normative: **every source resolves to a policy.** An
unrecognized source gets the conservative treatment — the prior block
is preserved by supersede — never the permissive one. (Before it
existed, an unmatched source was read as *both* authorized and exempt
from `supersede_on_edit`, so such a block could be replaced in place
with `POL-01` and `POL-02` unable to fire.) An implementation given a
caller-supplied policy list that covers no matching pattern for a
source MUST refuse the write rather than grant it: a list that does
not cover a source is an incomplete policy, not an authorization.

Authority classification MUST derive from the parsed actor namespace,
not from string prefix tests: `manual` is human; `agent/*` is agent;
`system/*` and `institution/*` are system. A source outside the
grammar — a retired colon form, a bare word, a resolution tag —
belongs to **no** authority class: it can write where authority is
`either` and can never satisfy `human_only`, `agent_only`, or
`system_only`. (The prefix test's negative space used to classify
`agent:L0-01` as a *human* write.) `document/*` likewise satisfies
none of the three restricted classes — a document is evidence, not an
authority class.

A module MAY contribute additional patterns; conflicts resolve in
favor of the more-specific glob (e.g. `agent/L6` beats `agent/*`), and
any module pattern is more specific than the catch-all.

### V.4 _meta authorship

On every write, the host MUST set:

- `_meta.lifecycle.revision` — incremented from the prior canonical
  block's revision (or 1 for a new section).
- `_meta.lifecycle.superseded` — `false` on the new block; `true` on the
  prior block when superseding.
- `_meta.provenance.source` — the actor:
  `manual | agent/<id> | document/<id> | system/<id> | institution/<id>`,
  with `<id>` matching `[A-Za-z0-9][A-Za-z0-9._-]*` (format spec §2.6;
  RFC 0031). This is the grammar a producer is bound to — nothing
  outside it resolves a specific edit policy or an authority class.
- `_meta.provenance.resolution` — OPTIONAL; one member of the closed
  resolution vocabulary (format §2.6) naming how the value was resolved (e.g. a step of the starter fallback
  cascade, [§V.7](../docs/starter/defaults-and-cascade.md#v7-fallback-cascade)), when the
  host knows it.
- `_meta.provenance.timestamp` — current write time in the exact T1B UTC-Z domain (Format §2.5, RFC0094); never normalize existing timestamps while validating.
- `_meta.provenance.actor` — REQUIRED nonempty string naming the initiating
  human or system principal. RFC 0090 actor admission performs no
  trimming, source-namespace grammar or principal inference.
- `_meta.provenance.agent_id`, `_meta.provenance.agent_version` —
  populated for agent writes; null otherwise.






### V.9 Canonical block JSON

`_meta.integrity.content_hash` is lowercase hexadecimal SHA-256 of the UTF-8 RFC 8785 (JCS) canonical JSON of the fenced block object with its `_meta` member removed. Every other member is included: all payload fields, `_role`, `_overrides` and `_notes` when present. A payload member named `content` is ordinary content; no wrapper is interpreted. Nothing else is stripped or defaulted. The existing `canonicalize` is the reference serializer.

Implementations MUST produce **byte-identical** canonical output across platforms. Specifically:

- Object keys are sorted by UTF-16 code-unit comparison (RFC 8785 §3.2.3).
- Strings are JSON-escaped per RFC 8785 §3.2.2.
- Numbers serialize per ECMAScript ToString (RFC 8785 §3.2.2.3), with `-0`
  rendered as `0`. Non-finite numbers MUST be rejected: canonical JSON has no
  representation for `Infinity` or `NaN`.
- `undefined` values inside objects are dropped (mirroring `JSON.stringify`).
- Array order is preserved and no whitespace is emitted.

This block rule does not replace the generic canonicalization used for receipts and other non-block digests.

Metadata-only edits leave content_hash unchanged. The signature input remains content_hash, section, actor, timestamp, kid and signed_at (§V.11), so signatures bind author and time to content. They do not transitively bind parent_hash. Chain verification still compares parent_hash with the predecessor content_hash.

### V.10 Block integrity (content_hash + parent_hash chains)

Two optional `_meta.integrity` fields make supersede chains tamper-evident:

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
`_meta.provenance.actor` and the operation that produced the block against the
section's `EditPolicy`:

- `POL-01 error` — actor not authorized for the policy authority
  (`agent_only`, `human_only`, `system_only`, `either`).
- `POL-02 error` — `section_replace` used where the policy mandates
  `section_supersede` (heuristic: `_meta.lifecycle.revision > 1` with no
  superseded prior revisions visible).

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

`_meta.integrity.content_hash` is tamper-**evident**, not tamper-**proof**: it
detects a change only for a reader who already holds a trusted copy
of the hash. `_meta.integrity.signature` closes that gap for the deployments
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

`_meta.integrity.signature` is an object:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `alg` | `"ed25519"` \| `"es256"` \| `"es384"` | yes | Signature algorithm. Closed signature algorithm set. |
| `kid` | string | yes | Opaque key identifier the verifier resolves in its own key store. |
| `sig` | string | yes | Signature bytes, base64url (RFC 4648 §5), unpadded. |
| `signed_at` | string | yes | ISO 8601 instant the signature was produced. MAY differ from `_meta.provenance.timestamp` — a block edited offline is signed when re-uploaded. |
| `v` | string | no | Signing-protocol version. Absent means `"1"`. |

`es256` and `es384` signatures are raw `r || s` (IEEE P1363), the
JOSE convention and what Web Crypto produces. DER-wrapped ECDSA
signatures are **not** interchangeable and MUST NOT be emitted.

The entire `_meta` member, including `content_hash` and `signature`, is excluded from block canonicalization
(§V.9), so stamping one does not change the hash it commits to.

#### V.11.2 What is signed

The signature input is the RFC 8785 canonical JSON of exactly these
six fields, and nothing else:

```json
{
  "actor": "<_meta.provenance.actor>",
  "content_hash": "<_meta.integrity.content_hash>",
  "kid": "<signature.kid>",
  "section": "<the block's section id>",
  "signed_at": "<signature.signed_at>",
  "timestamp": "<_meta.provenance.timestamp>"
}
```

The signer commits to the block's `content_hash` rather than to the
block itself — the hash already covers the content, and re-deriving
it inside the signature would buy nothing. The other five fields are
what a verifier needs in order to answer *who* signed *what*, *when*.

Four of the six fields (`actor`, `content_hash`, `signed_at`,
`timestamp` — and in practice `kid`) are specific to the producing
party, so two conforming producers signing equivalent underwriting
content produce different signing inputs and different signatures
**by design** (*stated by
[RFC 0032](../docs/rfcs/0032-provisional-signing-scope.md)*). A
verifier MUST NOT treat signature disagreement between
independently-produced blocks as evidence that either is
non-conforming; conformance of *values* is the province of §VIII
determinism and RFC 0016 receipts.

The whole `_meta` member is outside `content_hash` (§V.9). An edit that
changes only `_meta` — provenance, quality stamps such as `provisional`,
lifecycle, or any `integrity` member including `parent_hash` — leaves
`content_hash` unchanged, and the signature stays valid as long as the signed
`actor`, `timestamp` and `section` are unchanged. The signing input names no
`parent_hash`, and `parent_hash` is outside the hash, so a signature does not
bind it transitively: re-rooting a supersede chain does not invalidate prior
signatures, as RFC 0010 §4 intended (RFC 0081 §3). Chain order is still
verified by comparing each `parent_hash` with the predecessor's
`content_hash` (§V.10).

A verified block signature MUST NOT be presented as authentication of the
document frontmatter, variant selection, lifecycle state or collection
membership. Document snapshot authentication requires §V.13.

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
which this protocol does not define.

#### V.11.5 Capability declaration

An implementation that verifies signatures adds `signing` to its
`ImplementationManifest.capabilities`. The
`conformance/signing/` suite gates that claim; an implementation that
does not claim `signing` skips the suite and remains conformant.

---

### V.12 Replacement-funding binding verification (RFC 0070)

This procedure and HDG-06–10 apply only when the all-or-none hedge terms group is stated (Format §4.7, RFC 0081 G1). A strike-only hedge states no replacement-selection claim; replacement_funding requires the terms group.

Released in Protocol 2.21.0 (RFC 0070). Synchronous validateUWFile
retains its result shape. CLI complete validation exits nonzero for structural
errors or applicable outright binding states other than verified, in both modes.

#### V.12.1 Exact row-reference semantics and consistency commitment

Use [RFC 0045](../docs/rfcs/0045-explicit-property-cash-flow-assembly.md)'s source-snapshot,
explicit-variant and zero-based-row binding posture. That RFC's whole-document
digest lives in its output. Here the binding is stored **inside the document**,
so committing to the containing whole-document digest would be circular.

A conforming implementation MUST:

1. Resolve the current property-level `debt_structure` and
   `sources_uses` under existing RFC 0040 selection, with the hedge rules'
   registered `senior` preference on `debt_structure` (format §5.3, RFC 0075).
   RFC 0070 does not extend hedge checks to component financing or introduce
   tranche-specific hedges.
   If a selection needed for a stated `rate_hedge`, with or without a funding
   object, is ambiguous or unresolvable, refuse with `HDG-08` and report
   `unverifiable/unresolvable_source`; never treat it as absence or choose by
   fence order (RFC 0076).
2. Select the same document's current, nonsuperseded `cash_flow_series` block
   whose explicit variant identifier equals `cash_flow_ref.variant` exactly.
   No primary/base/default/sole-variant, role, date, label, cross-document,
   historical-block or first/last-fence fallback is permitted. A single block
   is eligible only when it explicitly declares the matching variant.
3. Structurally validate that selected series under §4.26. It must be nonempty;
   all rows must have real dates, finite amounts, legal row shapes/kinds and
   nondecreasing dates. Existing CF findings remain applicable. Metrics are
   outside binding verification; existing metric verification still applies
   when a consumer claims their correctness.
4. Require an in-range, nonnegative safe-integer `row_index`. Its identity is
   its ordinal in that exact ordered series, not a date selector or calc path.
5. Check the digest's syntax synchronously. Separately recompute and compare
   it through the async verifier in §V.12.3 using the following **fixed scope**.
   Structural validation alone does not establish that the commitment matches.

The digest preimage is exactly:

```ts
{
  currency_code: parsed.frontmatter.currency_code ?? null,
  row_index: cash_flow_ref.row_index,
  section: 'cash_flow_series',
  series: selectedPayload.series,
  variant: cash_flow_ref.variant
}
```

`currency_code` is always a key in the canonical preimage. If authored as a
non-null value, use that exact value without trimming, case conversion or
inference; RFC 0046's existing CUR-01 rule still checks its validity. If absent
or explicitly null, use JSON `null`. Absence and null therefore have the same
canonical monetary identity. **No new requirement to author currency is added.**
The declaration binds the payment to the document's stated monetary identity,
including an explicitly unspecified identity. No currency is inferred from
locale, symbol, property location or renderer behavior, and no FX or per-row
currency rule is introduced. A malformed authored currency cannot be repaired
by the digest helper or verifier.

Serialize that preimage with exact RFC 8785 canonical JSON, UTF-8 encode, hash
with SHA-256, and prepend `sha256:` to its lowercase 64-hex result. There is
no financial rounding/quantization and no metadata normalization in this scope.
The entire ordered array and every authored row member are included. Absent
optional row members stay absent; explicit null remains null. Numeric JSON
spellings such as `360000` and `360000.0` canonicalize identically.

For RFC 0070's §2 example (cap-cash, row_index 1), these known answers
pin monetary identity:

| Authored document currency | Canonical preimage value | Binding digest |
|---|---|---|
| `USD` | `"USD"` | `sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa` |
| absent or null | `null` (key retained) | `sha256:33072bf8b331730e37176a3fb1b1f80cb3fc1c398bed4746fcffc3d5b74ea63a` |

The preimage excludes the binding object, debt, document ID, section prose,
cash-series top-level label/day count/metrics, and all block metadata. Those
are not row identity. The fixed section value, exact variant, index, document
currency and ordered row content are the identity commitment. A metadata-only
revision or an unrelated document edit does not invalidate it.

This scope is intentionally more conservative than a hash of the selected row:

- Editing the index or variant without recommitting fails.
- Inserting, deleting or reordering distinguishable rows anywhere in the
  selected vector fails, even when the selected date/amount happen to match.
- Any authored row-content or canonical document-currency change fails.
  Removing a stated currency changes its canonical value to null; replacing
  absent currency with explicit null alone does not change the commitment.
- A different eligible cash row with the same date or amount cannot silently
  become the target while the old digest is retained.
- Swapping literally identical JSON rows makes no observable change to the
  ordered value vector. The binding still addresses the exact ordinal; this
  contract does not invent a durable identity for economically indistinguishable
  occurrences. Date/label/amount equality is never a search or deduplication rule.

Async verification of a stale binding MUST fail with HDG-09. A consumer claiming
complete validation/verification MUST refuse it. Sync structural validation
cannot determine staleness and MUST NOT pretend to have checked it. An editor/exporter MUST NOT silently scan for a
similar row, renumber the reference, or refresh its digest during validation.
An intentional source edit requires an explicit reviewed rebind, represented
through the existing append-only edit/provenance rules. Validation is read-only.

The hash detects inconsistency, not malicious coordinated rewriting. It is not
a signature, original-source authenticity proof, executed-trade receipt, or
proof that an author has disclosed every cost. Existing signatures, provenance,
and adopter-source comparison retain those separate responsibilities.

#### V.12.2 Validation/error rules

The phase is part of the contract. HDG-07/08/10 are synchronous
validation errors; HDG-09 is an **async verification** error. There is no HDG-11
rule. Lack of hashing is not a structural error.

| Phase | Condition | Exact finding/result |
|---|---|---|
| Sync | Escrow branch (absent/null funding or explicit escrow) lacks the named replacement escrow, including missing sources/uses | ESC-04. This includes the RFC 0056 coverage-defect regression. |
| Sync | Named replacement escrow without `replace`, or alongside outright mode, even if zero funded | ESC-04. Preserve existing ESC-01/02 for invalid escrow data. |
| Sync | Non-null funding object has illegal shape/mode, unknown members, missing required union members, reference under escrow, or is stated without `replace` | HDG-07. Missing `cash_flow_ref` or one of its required members is a shape failure; an authored member with invalid type/value is checked by HDG-08. |
| Sync | Exact cash variant missing/wrong/superseded, required section selection ambiguous/unresolvable, invalid/out-of-range index, malformed digest value, or illegal selected row/series structure | HDG-08. Preserve applicable existing CF findings. Never use fallback selection. |
| Sync | Validly addressed amount is positive, or valid payment date is on/before a valid stated initial effective date | HDG-10. Amount zero is valid; before/on/after expiration is valid when after effective date. |
| Sync | Invalid/missing initial hedge dates or other existing hedge facts | Existing HDG-01 through HDG-06, as applicable. Do not invent an anchor or add HDG-10 when its prerequisite anchor is invalid. |
| Sync | Authored non-null currency is malformed | Existing CUR-01. Absent/null currency has no currency finding and canonicalizes to null. |
| Sync | Binding digest has not been recomputed, or hashing is unavailable | **No error solely for this condition.** A clean structural result carries no claim of digest verification. Consumer status is `not_checked` until the separate verifier runs. |
| Async | Structurally eligible binding recomputes to stated digest | `verified`; no verification issue. |
| Async | Structurally eligible binding recomputes to another digest | `failed`, reason `stale_binding`; HDG-09 with stated/computed digests and exact variant/index. Sync may still be clean. |
| Async | Invalid prerequisites or unresolved source prevent verification | `unverifiable`, reason `invalid_structure` or `unresolvable_source`; expose relevant structural findings without claiming a digest comparison. |
| Async | Supported hash provider cannot perform the check | `unverifiable`, reason `crypto_unavailable`; no fabricated HDG-09 and no new structural error. |
| Consumer | Outright verifier not invoked | `not_checked`, reason `not_invoked`; cannot claim complete success. |
| Consumer | Outright structurally valid but verification `failed`, `unverifiable` or `not_checked` | Complete claim refuses, independently of the synchronous `ValidationResult` status. |
| Async | No outright binding is applicable and funding structure is lawful | `not_checked`, reason `not_applicable`; escrow funding relies on synchronous RFC 0056 checks. |

The initial premium's single home is `rate_hedge.premium` (format §4.7). The
successor payment does not become part of `premium`.

Within a selected funding object, check shape/assumption first, selection and
reference next, then series structure and payment semantics. Stop that binding's
deeper checks when prerequisites are invalid; retain independent shape/CF/CUR
errors. HDG-07 never creates a successful alternate funding path. ESC-04
independently reports applicable escrow conflict/absence; a well-formed outright
branch is exempt from **escrow-absence** ESC-04 but must pass its own HDG rules.
Preserve existing deterministic validation ordering. The async result is separate;
it does not remove, insert or reorder synchronous findings.

#### V.12.3 Separate async API and consumer obligations

`validateUWFile(parsed, thresholdOverrides?)` retains its synchronous signature,
`ValidationResult` shape and structural purpose. Existing portable SHA-256 helpers
are asynchronous for Node/Web Crypto. Add a separate verifier following
`verifyChain`'s stronger-verification architecture; do not add an async replacement
for structural validation.

Proposed exact public API and result contract:

```ts
interface ReplacementFundingBindingContext {
  debt_variant: string | null; // selected property-level debt; null if unvariant
  cash_flow_variant: string;
  row_index: number;
  currency_code: string | null; // exact authored value, or canonical null
}

interface ReplacementFundingVerificationIssue {
  code: 'HDG-09';
  severity: 'error';
  section: 'debt_structure';
  field: 'rate_hedge.replacement_funding.cash_flow_ref.binding_digest';
  message: string;
  context: ReplacementFundingBindingContext;
  stated_digest: string;
  computed_digest: string;
}

type ReplacementFundingVerificationResult =
  | {
      state: 'not_checked';
      reason: 'not_invoked' | 'not_applicable';
      issues: readonly [];
    }
  | {
      state: 'unverifiable';
      reason: 'invalid_structure' | 'unresolvable_source' | 'crypto_unavailable';
      context: ReplacementFundingBindingContext | null;
      structural_issues: readonly ValidationMessage[];
      issues: readonly [];
    }
  | {
      state: 'failed';
      reason: 'stale_binding';
      context: ReplacementFundingBindingContext;
      stated_digest: string;
      computed_digest: string;
      issues: readonly [ReplacementFundingVerificationIssue];
    }
  | {
      state: 'verified';
      context: ReplacementFundingBindingContext;
      stated_digest: string;
      computed_digest: string;
      issues: readonly [];
    };

export declare function verifyReplacementFundingBindings(
  parsed: ParsedUWFile
): Promise<ReplacementFundingVerificationResult>;

export declare function computeReplacementCashFlowBindingDigest(
  series: readonly CashFlowRow[],
  variant: string,
  rowIndex: number,
  currencyCode: string | null
): Promise<string>;
```

These functions/types MUST be exported from `index.ts` and the browser-safe
entry. Reuse `canonicalize` and the existing Node/Web Crypto hash seam.
No new dependency or synchronous crypto implementation is required. The digest
helper validates supported inputs, uses the fixed preimage in section 3 and
returns the prefixed digest. Its explicit null parameter represents absent/null
document currency. It never guesses currency, authors a funding object, stamps
metadata, searches rows or mutates input. Invalid helper arguments use a typed
`ProtocolError`; they are not silently normalized.

The verifier MUST capture an immutable snapshot before its first await, resolve
the selected property-level hedge and exact source against that snapshot, and
apply the same relevant structural prerequisites as the synchronous validator.
Relevant prerequisites are the funding rules, hedge facts needed for the binding,
escrow conflict check, exact reference selection, selected series structure,
payment semantics and currency validity. Unrelated financial validation findings
remain the caller's responsibility; a verified binding is not a verified deal.

Result semantics are exact:

- `verified` occurs only after successful recomputation and equality. Both
  digests are present and equal; context identifies the checked source snapshot.
- `failed` occurs only after recomputation and inequality. Both digests
  are present and unequal; its single HDG-09 issue reports that comparison.
- `unverifiable` has no computed-digest success claim. Invalid structural
  prerequisites use `invalid_structure`; missing/ambiguous required selection
  uses `unresolvable_source`. The latter takes precedence when source
  selection prevents assessment. Both expose applicable structural findings.
  A hash-provider failure uses `crypto_unavailable` with a resolved context
  and no structural findings. It must not manufacture a mismatch.
- `not_checked/not_applicable` is returned when the selected funding path
  is lawfully escrow-funded, or no outright requirement applies. Malformed
  stated new funding or unresolved required selections return `unverifiable`
  instead; they cannot be hidden as not applicable. That includes a stated
  hedge with no funding object whose loan or cash lines cannot be selected
  (RFC 0076).
- `not_checked/not_invoked` is a consumer's initial status before invocation,
  not an outcome returned after the verifier checks an applicable binding.
  Consumers retaining only synchronous validation MUST expose this status
  for outright documents. Omitting the async call never establishes `verified`.

No result changes synchronous `overall_status`, readiness or error arrays.
No verification outcome changes the file. Digest equality proves consistency of
the declared source snapshot, not payment purpose, executed-trade status,
authenticity or a calculation.

For any consumer claiming complete validation/verification of outright funding,
success requires **both** successful structural validation **and**
`replacement_funding_verification.state === 'verified'`. Call both against
one immutable parsed snapshot; caller mutations while hashing must not change
the verdict. Legacy escrow funding needs no digest and can complete through its
unchanged structural rules, with `not_applicable` binding status.

During implementation, CLI `validate` text/JSON, MCP validation results and
built-in web validation consumers claiming this capability MUST invoke the
verifier. Preserve existing root `ValidationResult` fields; add a separate
`replacement_funding_verification` result member on the claimed-complete
consumer payload, rather than folding verification into structural issues.
Text output labels structural status and binding-verification state separately.
CLI exit status MUST be nonzero for applicable outright `failed`,
`unverifiable` or `not_checked`, and for existing structural refusal;
a clean structural report alone cannot produce complete-success output. No
feature flag may silently disable verification while retaining that claim.
A sync-only editor may report structural validation plus explicit not-checked
status; it must qualify its result and cannot advertise complete verification.



### V.13 Document snapshot authentication (RFC 0084)

This optional Integrity-profile capability is `document-signature-verification`.
It authenticates an assembled semantic snapshot, independently of block
attribution (§V.11) and financial verification (Part VIII). A deployment
chooses its trusted key store out of band. It MUST NOT report a document as
authenticated merely because some or all block signatures verified.

#### V.13.1 Detached artifact and signing input

The artifact is defined by `uw-document-signature.schema.json`. Its conventional
sidecar name is `<document>.signature.json`; transport and filenames are not
signed. It MUST NOT be embedded in the source or envelope. Required members are
`kind: "uwmd-document-signature"`, `signature_version: "1"`, `subject`, `alg`,
`kid`, `signed_at` and `sig`. Both top-level and subject objects are closed.
`alg`, `kid` and `sig` follow §V.11.1; signing time is self-asserted.
`signed_at` MUST contain a real calendar date, uppercase `T`, hours 00–23,
minutes/seconds 00–59, an optional decimal fraction and uppercase `Z` or
an explicit numeric offset. The schema pins this spelling; leap-second
spellings and dates normalized by a permissive date parser MUST refuse.

The subject has exactly these members: `representation: "uwx-markdown"`,
`representation_version: "1.0"`, `canonicalization: "uw-envelope-semantic"`,
`canonicalization_version: "1.0"`, and `digest: "sha256:<64 lowercase hex>"`.
Only structured Format 3.0 Markdown is supported by this first capability.

The exact signing input is RFC 8785 canonical JSON of the artifact with only
`sig` removed. The kind, version, whole subject, algorithm, key id and time
MUST remain in the input. This separates the signature domain from blocks,
receipts and modules and prevents relabeling a key id even when two ids name
the same public key. Signature bytes MUST be canonical unpadded base64url:
Ed25519/ES256 are 64 bytes (86 characters, with zero unused low four bits);
ES384 is 96 bytes (128 characters). ECDSA is raw IEEE P1363 `r || s`.

#### V.13.2 Guarded Format-to-envelope projection

A signer or verifier MUST freshly parse the supplied source. It MUST NOT accept
a caller-provided digest, stamped `semantic_digest`, filtered parsed object or
resolved composition in place of that source. Duplicate decoded JSON member
names, duplicate mapping keys in restricted YAML frontmatter, unclosed fences,
malformed JSON and conflicting/repeated fence attribute keys MUST refuse.
Section identity in the fence and `_meta.section` MUST agree. Every block MUST
have an object `_meta.lifecycle` with boolean `superseded`; a stated fence
`superseded` MUST be `true` or `false` and match it. A fence revision, if stated,
MUST be a positive integer. Unsafe section/variant/annotation keys
`__proto__`, `constructor` and `prototype` MUST refuse.
These names also refuse as frontmatter mapping keys.

Before routing source blocks, more than one active block for a singleton
selection key MUST refuse, regardless of revision number. A key is the section
id for single-instance sections; for a parallel section it is the section id
and explicit variant (or `default` if absent). Parallel sections are
`operating_statement`, `stress_tests`, `due_diligence`, `lease_up_schedule`,
`cash_flow_series`, `distribution_waterfall` and `reserve_accounts`;
append-only
`pipeline_log`, `custom_calculations` and `custom_scenarios` retain every block
in source order and do not use singleton selection. Role-based sections are
parallel when active blocks state a `_role` and active blocks in that section
also declare explicit variants (Format §2.8). Repeated `x_*` ids and superseded
extension blocks MUST refuse: the current extension map cannot represent their
history faithfully. Unknown ordinary sections are retained, not filtered.

The envelope semantic object has `envelope_version: "1.0"`,
`format_version: "3.0"`, the parsed `frontmatter`, `sections`, `pipeline_log`,
`custom_calculations`, `custom_scenarios`, `extensions` and `superseded`.
Each projected block contains its parsed `annotation`, complete JSON `content`
(including `_meta`), and `prose` only when that block's immediately preceding,
trimmed Markdown is nonempty. JSON key order and CRLF versus LF do not change
this value. Markdown preceding the first section belongs to that section;
trailing Markdown after the final section is outside the projection.

Current singleton sections map ids to blocks; parallel sections map ids to
variant-keyed block maps. Explicitly superseded ordinary blocks go into arrays
under `superseded[section]` in source order. Append-only collections and the
extension map retain their exact block objects. All collections are present,
including empty maps and arrays. Every scanned source section block MUST appear
exactly once in the projection; a lost, overwritten or duplicated block MUST
refuse. A parsed object used for broader integrity checks MUST have the same
envelope semantic digest as its authenticated source.

Remove only top-level `generated_at`, `generator` and `semantic_digest` from
the envelope. Canonicalize the remainder by RFC 8785, encode as UTF-8 and compute
SHA-256, rendered as `sha256:` plus lowercase hex. These are the existing
`uw-envelope-semantic` 1.0 bytes (UW Receipt §3.1), with guards that refuse
inputs whose projection is ambiguous or lossy; the canonicalization is not
silently revised. No calculation pack, default filling or financial validation
is part of this projection. A structurally authenticatable record with wrong
financial figures can still be authenticated.

The commitment is semantic, not byte-exact: independent section reordering
that preserves these collections and cosmetic serialization may retain it.
Changing variant labels, current/history state, frontmatter, retained metadata
or prose, block signatures, or ordered collections changes it. Compaction,
addition, deletion or insertion from another document requires a new artifact.

#### V.13.3 Verification and required authentication

Verification returns exactly one state with a structured reason:

| State | Trigger | Code |
|---|---|---|
| `verified` | Supported artifact, subject recomputed and equal, signature verified using the trusted key. | none |
| `unsigned` | No artifact supplied (null or absent). | `INT-12` |
| `failed / malformed` | Artifact shape or signature encoding is malformed. | `INT-09` |
| `failed / bad_signature` or `algorithm_mismatch` | Crypto check refuses. | `INT-10` |
| `failed / subject_mismatch` | Recomputed source digest differs. | `INT-11` |
| `failed / malformed_source` | Source/accounting guard refuses, or parsed integrity input differs from source. | `INT-15` |
| `unverifiable / no_backend`, `unknown_kid`, or `backend_error` | Signature present but cannot be checked. | `INT-13` |
| `unverifiable / unsupported_version` | Unsupported artifact, representation or canonicalization version. | `INT-14` |

Shape and encoding are checked first, followed by version support, source
projection and digest equality, then cryptographic verification. Unsupported
versions are not proof of tampering. A verifier without a key store MUST NOT
upgrade unchecked metadata to `verified`. A valid artifact signature over a
different snapshot MUST fail against the supplied source.

Required document authentication accepts only `verified`. Deleting or
withholding the sidecar, removing the backend, or supplying an unknown key MUST
refuse acceptance. `IntegrityResult.document_signature` exposes this state
separately; `signatures_present` and `signatures_verified` remain block counts.
Unrequested document authentication does not change existing block results.
An explicitly requested document check that reports `failed` makes overall
integrity fail even when the caller does not require a signature for every
record. Optional `unsigned`/`unverifiable` states retain their distinct scope.
The reference CLI requests required authentication with
`--document-signature=<artifact> --keystore=<trusted-public-keys>`; unreadable
or malformed artifact files exit nonzero. `--resolved` cannot be combined with
source snapshot authentication.

The document issuer can assemble blocks attributed to other parties and sign
that assembly. This authenticates the issuer's snapshot; it MUST NOT be
presented as endorsement of the whole assembly by every block author. Editing
a snapshot requires a new document signature; block signatures remain
independently verifiable when the host supersedes earlier blocks.

---

## VI. Extensibility

### VI.1 `x_*` extension blocks

Section IDs prefixed with `x_` are reserved for extensions. A Reader
MUST parse and surface them. How a tool displays them (for example as raw
JSON when no view model is registered) is starter-product guidance.

### VI.2 Custom calculations and scenarios

`custom_calculations` and `custom_scenarios` are first-class blocks,
not `x_*` extensions. An implementation claiming the Module profile
(§II.3) MUST evaluate them. Any other implementation MUST surface their
declared result and unit verbatim from the file (treating itself as a
fixed observer of pre-computed values), and a Verifier without the
Module profile reports them `unverifiable`, never wrong.

### VI.3 InstitutionConfig layering

A `.uw.institution.json` sidecar (Format Appendix C.6) configures the three
validation overrides below. Implementations MUST apply admitted settings to
validation, and MUST NOT apply them to display formatting. The selected-config
operation contract is normative under RFC0097. The minimum wire schema is
[`institution-config.schema.json`](schemas/institution-config.schema.json);
byte/profile admission, binary64 finiteness and filesystem outcomes also require
the following runtime rules. No new financial threshold or comparison is added.

#### VI.3.1 Selection and operation boundary

A filesystem validation adapter selects exactly one file:

1. If the caller explicitly supplies an institution-config path, use that path.
   The reference CLI's existing `--institution` option selects it. Resolve a
   relative explicit path from the invocation's working directory.
2. Otherwise select `.uw.institution.json` in the directory of the absolute,
   lexically resolved document path. Do not search the working directory,
   parents, frontmatter ids or another document's directory. Do not realpath
   the document through symlinks merely to choose a different sidecar directory.
3. An explicit path suppresses automatic discovery entirely. Do not merge two
   files or fall back to the adjacent file if the explicit one fails.

For example, from `/work`, `records/link.uwx.md` selects
`/work/records/.uw.institution.json` even if the document link targets
`/archive/deal.uwx.md`. `records/../deal.uwx.md` selects
`/work/.uw.institution.json`. This accepted directory rule is independent of
existing document-read semantics; it does not change whether/how the OS follows
a document link. Tests must distinguish invocation-path and physical-target
sidecars.
A missing automatically selected path is the sole absence/default branch.
Attempt the read; a genuine not-found outcome for that automatic path means no
configuration. Access denial, a directory in place of the file, a broken
symlink at the sidecar path, or any other read failure is not absence. An
explicit missing path is unreadable. If a path disappears after selection or
inspection, classify the actual read outcome; do not rely on a racy exists-only
check. Distinguishing a dangling link from no directory entry is an adapter
responsibility and is tested without prescribing an OS-specific API.

CLI argument and fatal input-source/representation/parse admission retain their
existing precedence. After those prerequisites and before document validation
predicates or financial funding checks, finish config preflight. Do not add new
document parse rules through this RFC. Once config preflight fails, no ordinary
ValidationResult, overall status, partitions, stage-readiness, coverage or
replacement-funding result is computed or presented for that operation.

Pure SOURCE/MODEL validation APIs remain I/O-free with respect to institution
files. `validateUWFile(input, thresholdOverrides?)` and Python's equivalent take
the caller's supplied nested threshold map; that parameter is not the sidecar
wire object. They do not discover files or acquire hidden sidecar authority.
A file adapter parses the selected wire object into that existing parameter.

#### VI.3.2 Bounded malformed domain and atomic application

The selected file MUST decode as strict UTF-8 and exactly one JSON value with
only JSON whitespace around it. A leading BOM, trailing non-whitespace, invalid
UTF-8, invalid JSON or duplicate object member names is malformed. Names are
compared after JSON escape decoding, without trimming or Unicode normalization.
Every decoded member name and string value, including opaque data, MUST have
well-formed Unicode scalar content: reject an escaped lone high/low surrogate;
a correctly paired escaped surrogate sequence is admitted. Do not normalize
strings or replace invalid code units. A Unicode-profile failure is malformed
without a pointer, at the same pre-shape stage as whole JSON admission.
The BOM, duplicate-name and decoded-Unicode rules are explicit accepted
profile choices, not inherited JSON MUSTs or reuse of document JCS admission.
[RFC8259 section4](https://www.rfc-editor.org/rfc/rfc8259.html#section-4)
recommends unique names; [section8.1](https://www.rfc-editor.org/rfc/rfc8259.html#section-8.1)
permits parsers to ignore a BOM. They do not themselves select this stricter
configuration profile. The owner accepted these stated choices at4a31eb3c.
The root MUST be an object, not null or an array.

The recognized carrier is an own `validation_overrides` member. Absence means
no override. If present it MUST be an object, not null or an array. Empty is
valid. Its three recognized optional own members MUST be finite binary64
numbers when present; null, booleans and strings are invalid, with no coercion:

| Wire member | Existing explicit API member |
|---|---|
| dscr_warning_below | dscr.warning_below |
| ltv_warning_above | ltv.warning_above |
| debt_yield_warning_below | debt_yield.warning_below |

This adds no numeric bounds, threshold defaults, rounding or comparisons.
Negative values, zero and finite fractional values are admitted as configuration
numbers; the existing validation comparison procedures remain unchanged.
A JSON number spelling which overflows binary64 is not an admitted recognized
threshold. No new safe-integer restriction is imposed.

A root own `thresholds` member is explicitly noncanonical and malformed,
including when a canonical carrier is also present. Do not choose between two
carriers or treat it as a nested wire alias. This does not change the existing
nested threshold-map parameter of pure APIs.

Other top-level data and other members of `validation_overrides` remain opaque:
this RFC does not allocate new validation for `institution_id`, workflow/render
preferences or an exhaustive vocabulary for every Format5.2 threshold. Do not
report an opaque member as applied. A similarly named nested lookalike is not
the root canonical carrier. The duplicate-name JSON rule still applies to every
object in the selected file. This scope is deliberately explicit; unknown-data
handling is not a claim of complete institution-policy support. In particular,
a lexically valid overflow number in opaque data (for example an unknown
`note_number:1e309`) does not trigger the recognized-leaf finite check and is
never applied or reported as a threshold. An adapter need not coerce that opaque
number into binary64 or reserialize the config. Original bytes stay unchanged.
An escaped lone surrogate remains malformed even in opaque data under the whole
Unicode rule above; paired scalars are valid. Neither rule authenticates a config
or makes it an Envelope, signature or receipt subject.

The adapter MUST admit the complete selected config before applying any
recognized override. One invalid recognized member refuses the whole operation;
no partial map is passed to validation. On success build fresh affected bands
from existing defaults, then replace only the named member. Existing DSCR/LTV
error limits and unrelated bands remain present. Do not mutate process-wide
defaults, the caller's model/map, the document or the selected config bytes.

#### VI.3.3 Exact refusal, precedence and field attribution

Allocate exactly these operation errors, both category `validate`:

| Code | Condition | Required message |
|---|---|---|
| VAL-INSTITUTION-CONFIG-UNREADABLE | Selected read fails, except genuine automatic absence | Selected institution config could not be read. |
| VAL-INSTITUTION-CONFIG-MALFORMED | Decoding/JSON/profile or recognized admission fails | Selected institution config is malformed. |

These codes do not enter ordinary errors/warnings/issues arrays, change their
registered severity system or allocate a META/FV fallback. Add operation-error
documentation/remediation without pretending they are document issue families.
`ProtocolError`'s existing category/shape remains unchanged. Its pointer comment
and the protocol-error schema describe these two codes relative to the selected
configuration input, not the underwriting document. Existing other codes retain their own pointer authority.
No new pointer syntax or outer filename field is allocated.

Return exactly one primary config error:

1. Read failure wins before decode/profile checks.
2. Decode, whole JSON syntax, duplicate-name or Unicode-profile failure: malformed; omit pointer.
3. Nonobject root: malformed; omit pointer.
4. Own root `thresholds`: malformed; pointer `thresholds`.
5. Invalid canonical carrier: malformed; pointer `validation_overrides`.
6. Invalid recognized leaves: first in the fixed order dscr_warning_below,
   ltv_warning_above, debt_yield_warning_below; pointer is the exact
   `validation_overrides.<member>` path.

No document-field issue or lower-priority config error cascades. Opaque members
have no admission pass beyond the whole-JSON rules. A caller MAY receive optional
`cause`/`remediation` strings permitted by ProtocolError; do not add schema-forbidden
inner members, reinterpret pointer as a document field or expose config bytes
as part of the error. Optional diagnostic detail does not change the primary
code/message/pointer above.

#### VI.3.4 CLI transport

`validate <file> --json`, with an optional explicit config selector, MUST exit1
and write exactly one JSON object to stdout:

```json
{
  "error": {
    "category": "validate",
    "code": "VAL-INSTITUTION-CONFIG-MALFORMED",
    "message": "Selected institution config is malformed.",
    "pointer": "validation_overrides.ltv_warning_above"
  }
}
```

The outer object has only `error`; its value conforms to the existing
`protocol-error.schema.json`. Omit pointer for cases which have none. A trailing
newline is allowed. No `partial_validation_result`, structural result, clean
verdict or partial override output accompanies this refusal. Stderr may carry
diagnostics but cannot substitute for the structured stdout error. A described
selected-config failure is exit1, never internal-error exit2 or success exit0.
An actual unrelated implementation defect retains the existing exit2 boundary.

Without `--json`, the same refusal/code exits1; human diagnostics go to stderr
and stdout contains no validation-result claim. No new normative CLI selector
syntax is required beyond the existing optional reference-CLI flag.

Any existing aggregate adapter which invokes validation, including the
reference `verify` command's validation branch, must propagate this same typed
validation-operation failure and cannot report that branch as passed. Its
existing aggregate wrapper/other independent operations are not redesigned by
this RFC, and no new `verify --institution` flag is allocated.

#### VI.3.5 Receipt and authentication boundary

Receipt issuance presently validates with builtin defaults and records those
counts (`receipts.ts` validate/counts calls). Issuance/verification options have
no config parameter, and receipt CLI commands load no sidecar. Verification
checks count shape rather than recomputing the policy counts. Configured CLI
validation findings can therefore differ from builtin receipt counts.

This RFC MUST NOT silently make receipt issue/verify discover or refuse on an
adjacent config. It changes no receipt subject, policy identity/count binding,
signature requirement, recomputation, result-digest or verdict precedence. Any
extension of receipts to configured policy requires its own explicit governed
scope. Config errors are not additional document findings or receipt error counts.
The accepted authenticate-first receipt contract remains authority.

---

## VII. Module System

### VII.1 What a module is

A module is a declarative manifest (see §X) plus optional supporting
files. Modules contain no executable code; all dynamic behavior
is expressed via the safe-expression language (§VIII).

### VII.2 Lifecycle

1. Host loads a `module.uw.yaml` or `module.uw.json` file.
2. Host validates against
   `spec/schemas/module-manifest.schema.json`.
3. Host checks `requires_protocol` and `requires_format` against its
   single Format 3.0 and Protocol 4.1.0 values. If incompatible, refuse with `ProtocolError`
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

**Dependent overrides (normative, RFC 0074).** Protocol 2.22.0 adds these
rules. Hosts that implement Protocol 2.21.0 or earlier, the reference library
among them, run both declarations instead of one effective declaration.

*Who may override.* A module may redeclare an ID that a loaded module
declares only if it names, in its own `depends_on`, the module whose
declaration is currently in effect for that ID. Any other redeclaration is a
conflict under the first rule above. In particular:

- In a chain A ← B ← C, B overrides A by naming A, and C overrides B by
  naming B. C naming only A while B's declaration is in effect is a
  conflict, because it would silently undo B's override.
- Two modules that both depend on A, but not on each other, are unrelated.
  Both redeclaring one of A's IDs is a conflict.
- A transitive path alone does not authorize an override. If only A and C
  declare an ID and C names only B, that is a conflict.

*What an override does.* An overridden declaration does not take effect, in
any namespace.

- **Calculations.** The replacement is evaluated once, where the overriding
  module declares it. Every module keeps its own declaration order (§X), and
  modules are evaluated in registry order. This section defines no
  cross-module evaluation order beyond §VII.2's: a module follows the
  modules it depends on.
- **Sections.** The effective declaration's `required` flag is checked once,
  as part of the module that owns it.
- **View models.** The effective declaration is the view model for that
  `section_id`. This protocol defines no view-model consumer; a host that
  renders module view models MUST use the effective declaration.

*Invariant.* A dependent override MUST NOT make a declaration unavailable to
anything that, under the module dependency and applicability rules, would
otherwise use it. A host MUST refuse a set of modules containing such an
override. The decision is static, made from the manifests, and independent of
the order the modules are listed in. Two rules implement it:

1. **Prior-result readers.** A calculation that reads an overridden
   calculation ID as a prior result (§VIII.2) MUST be either a calculation
   of the overriding module declared after that ID, or a calculation of a
   module that depends on the overriding module, directly or transitively.
   A replacement that reads its own ID is not declared after that ID, so it
   does not qualify. The one exemption is a calculation that the first
   module to declare the ID declares before it, which never had a value to
   read. A calculation reads an ID when the parsed expression contains it
   as an identifier or as the head of a path. A string literal, a later
   path segment, a bracket key, a period-path head and a function name are
   not reads. A head that a document's frontmatter or sections might shadow
   still counts. Validation rules are not readers, because they run after
   every calculation.
2. **Scope.** The overriding module MUST apply to every asset class to which
   the module whose declaration it overrides applies. A module applies to
   the builtin classes in its `asset_classes` and the custom classes in its
   `declares_asset_classes`. A module naming neither applies to every class,
   and only such a module reaches a document with no class. This rule
   applies to sections, calculations and view models alike.

Each rule is checked from whichever side loads second: the overriding module
against readers already loaded, and a later reader against overrides already
in effect. Listings of the same valid dependency graph therefore get the same
verdict and, if accepted, the same effective declarations. A module that
overrides is also subject to the Protocol floor in §X.

The reference library refuses with `PROTO-MOD-080` (section ID),
`PROTO-MOD-081` (calculation ID) and `PROTO-MOD-082` (view-model
`section_id`). It refuses an override that would leave a prior-result reader
without a value with `PROTO-MOD-083`, and one whose module does not apply
wherever the overridden module does with `PROTO-MOD-084`. The registry is
refused as a whole. `conformance/modules/registry/` pins these rules.

### VII.4 Capability negotiation

A manifest MUST declare `requires_conformance: "reader" | "verifier"` and MAY declare `requires_profiles`, an array of unique members of the closed profile list (§II.3). Reader < Verifier. Absent profiles means none. An invalid tier, non-array profiles declaration, duplicate profile, or unknown profile is `PROTO-MOD-006`; a host below the tier or lacking a required profile is `PROTO-MOD-029`. `requires_tier` is not admitted.

A module declaring calculations SHOULD require Verifier plus the module profile; this recommendation adds no new refusal. Builtin packs declare Verifier with no profiles. Reference LoadModuleOptions uses hostConformance (default verifier) and hostProfiles (default the reference ImplementationManifest profiles).

---

## VIII. Calc Engine Contract

**Normative schema:** [`spec/schemas/calc-result.schema.json`](schemas/calc-result.schema.json)
defines the shape of every value an implementation returns when it
evaluates an expression.

**What binds whom (RFC 0078).** §VIII.1–VIII.3, with §VIII.2a, are the
notation the standard's metric definitions and module calculations are
written in. A Verifier MAY compute a definition any way that reproduces
its quantized value, and MUST follow the notation exactly wherever it
evaluates an expression (§II.2). Determinism (§VIII.4), the numeric
model (§VIII.5) and the error taxonomy (§VIII.6) bind every Verifier.
Sensitivity tables (§VIII.7) and stochastic calculations (§VIII.8) are
the Sensitivity and Stochastic profiles. §VIII.9–VIII.12 are the
stated-figure verifiers every Verifier implements. Refinement
(starter guide §VIII.2b) and workbook bindings (starter guide §VIII.2c) are
in the non-normative
[starter products guide](../docs/starter/refinement-and-workbooks.md).

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
              | identifier member+ "@" period_selector member*
              | "(" expr ")"
member      ::= "." identifier | "[" string "]"
period_selector ::= "Y" positive_integer | calendar_quarter | calendar_month | calendar_date
positive_integer ::= [1-9][0-9]*
calendar_quarter ::= [0-9]{4} "-Q" [1-4]
calendar_month ::= [0-9]{4} "-" [0-9]{2}
calendar_date ::= [0-9]{4} "-" [0-9]{2} "-" [0-9]{2}
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

**Variant-map sections (RFC 0066).** When `sections.<id>` is present as a
variant map (format §2.8, RFC 0040's Markdown opt-in, or any section a UW
JSON envelope carries as more than one block), an identifier rooted at
`<id>` reads exactly one block, selected in this order:

1. The caller's `CalcEvaluationContext.sectionVariants[<id>]`, when
   supplied: exactly that variant, with no fallback. An explicitly
   selected component is allowed. A requested variant that is absent, or
   that carries an invalid `_role`, refuses. The same entry applies to a
   standalone block, which matches only its own variant key.
2. The evaluated calculation's declared role, `section_roles[<id>]` (§X):
   the unique eligible block carrying that `_role`. Two eligible blocks
   carrying it refuse, without fallback. None continues to step 3.
3. RFC 0040's generic order: the unique `primary`, then the `default`
   variant, then `base`, then the sole eligible variant. A `primary`
   collision refuses, without fallback.
4. Otherwise refuse.

Blocks whose `_role` is `component` or invalid are excluded before steps
2–4. A refusal is `CALC-RESOLVE-002` (§VIII.6): the result is
`ok: false`, the identifier MUST NOT resolve to `null` or fall through to
`prior_results`, and the message MUST name the section and the variants
found. A missing section remains `null`: a missing path is not an
ambiguity. A standalone block without an explicit selection resolves as
before. An evaluator MUST NOT choose by fence order, sum blocks, or infer
from amounts, producer key names or labels. A role preference reaches
resolution only from the evaluated declaration. A calculation never
inherits a validator check's preference (RFC 0041), and the calculation
context carries none.

Every consumer that reads a section for a calculation's inputs MUST select
by this rule, so no two consumers read different blocks of one map. That
covers a Verifier reproducing a metric (§II.2) and every starter product
that reads calculation inputs: the cascade's in-file steps (starter guide §V.7),
refinement (starter guide §VIII.2b) and workbook binding
(starter guide §VIII.2c), all described in the
non-normative [starter products guide](../docs/starter/README.md).

### VIII.2a Explicit period addressing (RFC 0041)

A period reference selects by stated identity, never row position:
`dcf.annual_cash_flows@Y3.net_operating_income`. The safe-expression grammar
adds one `@selector` after the section-rooted path of a registered series;
ordinary member access may follow it. Exactly one selector is allowed per
reference. Existing expressions and bracket-string literal keys are unchanged.
`@` inside a quoted key remains a literal character; generic `deepGet`, metadata
pointers and other arbitrary string paths do not acquire selector semantics.
The contextual `resolvePeriodPath(parsed, path, options?)` accepts one reference
using this calc grammar. Numeric bracket indices are not added to that grammar;
an existing bracket-string index such as `['0']` remains valid after a selector.

Selectors and canonical `PeriodKey` identities:

| Selector | Key | Constraints |
|---|---|---|
| `Y<n>` | `{ kind: 'year', index: n }` | positive safe integer, no leading zero |
| `YYYY-Qn` | `{ kind: 'quarter', year, quarter: n }` | four-digit year, quarter 1–4 |
| `YYYY-MM` | `{ kind: 'month', year, month }` | four-digit year, month 01–12 |
| `YYYY-MM-DD` | `{ kind: 'date', date }` | valid Gregorian date under §VIII.9.1 |

Different kinds never compare equally. Calendar years are absolute, including
when a schedule begins midyear. No relative Qn/Mn, wildcard, year-of-date,
calendar conversion, or acquisition-date inference is defined here.
`canonicalPeriod(entry, value)` reads the registered row field or keyed period;
`periodKeyIdentity` produces stable kind-qualified keys. Year_N object keys
canonicalize their positive safe integer suffix, so year_01 and year_1 collide.

The frozen standard `PERIOD_SERIES` registry is normative:

| Path | Shape | Period | Grammar | Cadence |
|---|---|---|---|---|
| `dcf.annual_cash_flows` | rows | `year` | year_index | — |
| `noi_model.projections` | keyed | `^year_(\d+)$` | year_index | — |
| `lease_up_schedule.schedule` | rows | `period` | calendar_period | `period_granularity` |
| `cash_flow_series.series` | rows | `date` | iso_date | — |
| `distribution_waterfall.stated_schedule` | rows | `date` | iso_date | — |

Module-defined series are deferred. A rows series is an array of objects; a
keyed series is an object of period-keyed objects. A present calendar series
must state monthly or quarterly cadence and every row must use that kind.
Missing or null section/series/period resolves to null. An empty series has no
matching period. Every present row is inspected before selection: malformed
shape or periods refuse as `CALC-PERIOD-001`. For every registered series except
`cash_flow_series.series`, any duplicate canonical identity refuses as
`CALC-PERIOD-002`, even without prevalidation. For `cash_flow_series.series`,
multiple rows MAY share a valid date: an ordinary selector MUST refuse
`CALC-PERIOD-002` only when its requested canonical date matches multiple rows.
A date appearing exactly once MUST resolve normally even when other dates in
that series repeat. The resolver MUST NOT choose by first/last row, sum or merge
matches, or infer intent from kind, label, amount or position. A well-formed
selector of a different kind returns null. Missing leaf values return null; calc results
remain scalar, although the public resolver may return the selected row object.

**Section context.** These references are section-rooted and do not consult
frontmatter or prior results for the section head. If the caller supplies
`CalcEvaluationContext.sectionVariants[section]` (also accepted by
`PeriodResolutionOptions`), select exactly that variant, with no fallback.
An explicitly selected component is intentional and allowed; invalid roles
are not. Otherwise use RFC 0040's generic primary/default/base/sole selection,
excluding components and invalid roles, with no check-specific role preference.
Ambiguity or a missing explicitly requested variant in a present section is
`CALC-PERIOD-003`. A missing section remains null. Own-property traversal and
the blocked segments `constructor`, `prototype`, `__proto__` remain enforced.
Ordinary identifiers select by the same order under §VIII.2 (RFC 0066). There,
a calculation's declared `section_roles` takes the place of "no check-specific
role preference", and a refusal is `CALC-RESOLVE-002`. Period references keep
this paragraph unchanged.

**Overrides and consumers.** Check a full selector-path override before reading
document data; null is an explicit override. First validate the registry path
and selector itself so an override cannot legitimize an invalid reference.
Canonical keys join identifier-like leaf segments with dots and retain other
leaf keys in bracket-string form. Dependencies use this same spelling, preserving
period identity and distinguishing a literal dotted key from nested traversal.
No document writes or changes to numeric quantization occur.
Rows retain identity through existing source-row binding surfaces; this
exception adds no numeric-index calc grammar. Whole-column contextual Excel
projection (starter guide §VIII.2c) still refuses duplicate identities rather than collapsing
rows into a unique-key column. Its whole-series validity guard is distinct from
ordinary scalar date selection.

Excel emission MUST refuse selector nodes with `EXCEL-EMIT-PATH` unless explicit
contextual bindings under starter guide §VIII.2c are supplied. A static named-range mapping
alone MUST NOT stand for a row chosen by its current position. The reference refinement engine
uses finite stated period inputs as fixed values under
starter guide §VIII.2b. Its general
cascade is unchanged.

**Validation.** Inspect all active variants of every present registered series:
`PS-01` warning for malformed shape/row/period; `PS-02` error for each duplicate
canonical identity **except in `cash_flow_series.series`** (RFC 0062).
Duplicate valid cash-flow dates MUST NOT produce `PS-02`: these are legal
distinct ledger rows under Format §4.26. They MUST NOT be merged, netted,
reordered or collapsed merely because dates are equal. All existing CF rules
still apply. Duplicate rules for `dcf.annual_cash_flows`,
`noi_model.projections`, `lease_up_schedule.schedule` and
`distribution_waterfall.stated_schedule` are unchanged.
`PS-03` warns for a statically recognizable kind mismatch
in custom calculation or scenario formula/base_formula fields under default
section selection. When that selection is ambiguous, do not guess the cadence.
Superseded history and arbitrary narrative strings are not reinterpreted.
Existing LU/CF/WF structural and financial rules remain unchanged. These new
diagnostics may expose missing period identities in older files; do not fabricate
years or dates to clear them.



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
| `pow(base, exp)` | `(number\|null, number\|null) → number\|null` | Pinned power (§VIII.5.2). Non-finite result raises `CALC-TYPE-001`. |
| `log(num)` | `(number\|null) → number\|null` | Natural log. Non-positive input raises `CALC-TYPE-001`. |
| `exp(num)` | `(number\|null) → number\|null` | Pinned exponential (§VIII.5.2). Non-finite result raises `CALC-TYPE-001`. |
| `pmt(rate, n, pv)` | Standard mortgage payment formula. |
| `fv(rate, n, pmt[, pv])` | Future value of a series of equal payments + initial pv. |
| `pv(rate, n, pmt[, fv])` | Present value of a series of equal payments + future value. |
| `nper(rate, pmt, pv[, fv])` | Number of periods to pay down `pv` with `pmt` payments. Closed-form; see the note below. |
| `npv(rate, ...flows)` | Net present value. |
| `irr(...flows)` | Internal rate of return; CALC-IRR-DIVERGE on the specified bracket/iteration failure. See the convergence procedure below. |
| `is_calendar_date(value)` | `(any) → boolean` | `true` only for a valid `YYYY-MM-DD` calendar-date string; see below. Never `null`. No argument value raises. |

**Closed-form functions (normative).** `pmt`, `fv`, `pv`, and `nper` **MUST** be
evaluated in closed form — `nper` as
`log((pmt - fv·rate) / (pmt - pv·rate)) / log(1 + rate)`, and the others by the
formulas in §VIII.3's table. `nper` in particular is solved iteratively in some
formulations, and an implementation that does so inherits exactly the
reproducibility problem the `irr` procedure below exists to remove. `irr` — and
`xirr` (§VIII.9.3), which runs this same procedure over date-derived exponents —
are the only builtins permitted to iterate.

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

**Calendar-date predicate (normative, RFC 0071).** Protocol 2.22.0 adds
`is_calendar_date`. Protocol 2.21.0 and every earlier version lack it.

`is_calendar_date(value)` takes exactly one argument; a call with any other
number of arguments raises `CALC-TYPE-001`. The argument is evaluated like any
other argument (§VIII.2), and an error raised while evaluating it propagates
unchanged. The function returns `true` if and only if all three conditions
hold, and `false` otherwise:

1. **Type.** `value` is a string. `null` (including a missing path, §VIII.2), a
   number, a boolean, and any object- or array-valued resolution are not
   strings. A host **MUST NOT** convert a non-string to a string before testing
   it.
2. **Lexical form.** `value` is exactly ten characters of the form
   `YYYY-MM-DD`, where each `Y`, `M` and `D` is an ASCII digit `0`–`9`
   (U+0030–U+0039) and each `-` is U+002D. No other character may appear
   anywhere: no leading, trailing or internal whitespace of any kind, sign,
   expanded year, time, `T` designator, zone designator (`Z`, `±hh:mm`) or
   fractional part. A host **MUST NOT** trim, case-fold or Unicode-normalize
   `value` first.
3. **Calendar.** Let `y`, `m` and `d` be the decimal values of the year, month
   and day digits. Then `1 ≤ m ≤ 12` and `1 ≤ d ≤ L(y, m)`, where:
   - `L` is 31 for months 1, 3, 5, 7, 8, 10 and 12;
   - `L` is 30 for months 4, 6, 9 and 11;
   - for month 2, `L` is 29 when `y` is a leap year and 28 otherwise.

   `y` is a leap year when it is divisible by 400, or divisible by 4 and not
   by 100. This is the proleptic Gregorian calendar of §VIII.9.1, under which
   year `0000` is a leap year. Every year from `0000` to `9999` is in range.

The result **MUST** be computed from the characters of `value` alone, by
integer comparison. A host **MUST NOT** consult a date parser (`Date.parse` or
equivalent), a time zone, a locale, the host clock, or any environment setting
(§VIII.4). The calendar is the one §VIII.2a `YYYY-MM-DD` selectors and §VIII.9
dates already use.

Unlike the arithmetic builtins, `is_calendar_date` does not propagate `null`.
It answers whether its argument is a calendar date, and `null` is not one. An
expression that accepts an absent value says so explicitly:
`x == null || is_calendar_date(x)`.

No Excel emission is defined. Excel's date functions depend on locale and on
the workbook date system, and its 1900 date system treats `1900-02-29` as a
real day. A converter refuses a formula that calls `is_calendar_date`, as the
reference emitter already refuses `avg` and `coalesce` (`EXCEL-EMIT-FN`).

A module that calls `is_calendar_date` is subject to the protocol floor in §X.

Calendar-anchored `xirr` and day counts are specified in §VIII.9.

### VIII.4 Determinism

Every implementation that evaluates an expression or reproduces a
metric MUST be deterministic across runs and platforms. No
function in the standard library may consult system time, environment
variables, or randomness. Floating-point operations MUST follow IEEE
754 double precision. Determinism of the *reported* value additionally
requires the quantization rule in §VIII.5.

### VIII.5 Numeric model

Evaluation and reporting are separate concerns, and this section fixes
the boundary between them. Without it, two conforming hosts agree on
every arithmetic step and still disagree in the last unit in the last
place — which is invisible to a tolerant comparison and fatal to a
digest. UW Receipts (`UW_RECEIPT.md`) hash calc outputs, so an
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
| `x` | 4 | Ratio reporting precision; document statements may be coarser under §VIII.5.1. |
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
precision (§ `DEFAULT_NUMBER_FORMAT`). Digests and equality checks are defined over `value`, never over `display`.
Native spreadsheet recalculation is subject to the export limits in §VIII.5.2.

**Digests.** Any digest taken over calc outputs — a receipt's
`results_digest` in particular — MUST be taken over quantized values.
A host that hashes unquantized results produces digests that do not
reproduce across platforms.

> **Implementation note.** Quantizing by multiplying by `10 ** dec`
> reintroduces the artifact it is meant to remove: `1.005 * 100` is
> `100.49999999999999`, so that formulation yields `1.00` where
> spreadsheet `ROUND` yields `1.01`. Shifting through a decimal string
> (`Number("1.005e2")` → `100.5`) is correctly rounded and agrees.
> See `packages/uwmd-verify/src/calc/quantize.ts`.

### VIII.5.1 Stated metric precision (RFC 0079)

The normative [metric dictionary](metrics/README.md) defines a reporting
`round_to` and a minimum comparison precision, `minimum_stated_decimals`.
Retain the stated metric's **source numeric token's decimal precision**, in
stored units. Rates are fractions: `0.0550` carries four decimals (0.01%);
`0.73` carries two (1%). Trailing zeroes count. For exponent notation, decimal
places are the coefficient's fractional digits minus its exponent, floored at
zero: `1.200e-2` carries five. A representation using percent tokens, such as
Lite, shifts this precision by two when decoding the value to its stored
fraction. Optional display strings do not set precision.

Evaluate the dictionary formula unrounded under §VIII.1–VIII.4. Let `s` be the
statement's source decimal places, `m = minimum_stated_decimals`, and
`d = min(max(s, m), round_to)`. Quantize that **unrounded** result once at `d`,
half away from zero under §VIII.5. Compare it to the stated value (quantized to
`round_to` only when `s > round_to`). Equality is **verified**; a finite
disagreement is **failed**. A coarser statement is checked at the minimum, not
refused: `0.07` can equal `0.070` (7.0%), and LTC `0.6` verifies a raw `0.601852`
at the 1% comparison minimum. DSCR `1.5` against `1.7` **fails** at the 0.01x
minimum. Missing usable formula inputs remain **unverifiable**; coarse spelling
alone never causes an unverifiable result.

There is no additional absolute or relative tolerance. Quantizing first at
`round_to` and then at `d` is forbidden double rounding. A Verifier MUST NOT
fill absent inputs or change the dictionary definition to clear a finding.
The reference comparison API requires source decimal places as an input and
rejects absent/invalid precision arguments as typed caller errors; do not
reconstruct precision by stringifying a parsed number.

`cap_rate`, `debt_yield` and `cash_on_cash` have a three-fractional-decimal
minimum (0.1%). Other percentage entries have a two-decimal minimum (1%);
ratios have a two-decimal minimum (0.01x). The dictionary records the monetary
minimums and the RFC's Decisions table justifies each group.
Raw primary-size selectors retain exact finite-number identity with minimum
zero and `round_to: null`. Receipt outputs, result digests and starter Excel
parity still use full effective `round_to`, independently of statement precision.

Every class's `ltv` uses `debt_structure.loan_amount / valuation.underwritten_value`,
falling back to `valuation.purchase_price` only when no underwritten value is
stated. This agrees with the validator's CC-02 and capital-stack `ltv_through`.

All eleven income-class `cash_on_cash` entries (the nine RFC 0079 classes plus RFC 0080's `data_center` and `manufactured_housing`) use stated
`dcf.annual_cash_flows.Y1.net_cash_flow_levered` over
`sources_uses.equity_metrics.equity_total`; absent/null Y1 levered flow falls
back to `noi_model.net_operating_income - debt_structure.annual_debt_service`.
**Producers of non-multifamily documents now need to state
`sources_uses.equity_metrics.equity_total` for cash-on-cash.** The verifier never
substitutes a sponsor contribution or assembles equity. Producers can explicitly
state an aggregate equal to a single, sole non-debt source and document that
identity; ambiguous mezz/preferred/common stacks require an explicit equity
statement. Missing total equity yields null. No debt role, tranche summation
or projected cash flow is implied. Land gains no income metric in this RFC.

### VIII.5.2 Pinned power, exponential and logarithm (RFC 0088)

Every power, exponential and natural-logarithm operation used by a conforming
financial procedure MUST follow the single exact pinned fdlibm procedure in
[accepted RFC 0088](../docs/rfcs/0088-pin-financial-numerical-procedures.md#primitive-admission-and-resource-contract).
The exact eight-file source closure, binary64 constant words and signed/unsigned
word-site map referenced there define the procedure; an arbitrary host pow/exp/log
or approximate equivalent is insufficient. This applies to every exponent class,
including integral, fractional and negative exponents. Source fast paths are part
of that one procedure, not an alternative dispatch policy.

Basic operations round individually to binary64 nearest/ties-even with gradual
underflow. Word operations use the mapped signed32/unsigned32 modulo2^32 semantics,
including count32 shifts. Implementations MUST NOT use host transcendental/sqrt
substitutes inside the primitive, FMA/reassociation, extra precision, reciprocal
replacement for negative powers, or exp(log(x)*y) substitution. Generated NaN
payload/sign and exception flags are excluded; finite words, signed zeros and
signed infinities are exact. The procedure has fixed scalar state and a conservative
76 software-sqrt loop-body bound; it introduces no exponent-sized loop or arbitrary
input cutoff. Document, AST and solver limits remain separate.

Raw pinnedPow(base, exponent), pinnedExp(value) and pinnedLog(value) accept only
primitive binary64 numbers, including signed zero, NaN and infinities; a nonnumber
raises CALC-TYPE-001 without coercion (pow checks base before exponent). Raw results
are not quantized. Internal financial procedures use these same primitives, with
the existing associations and consumer guards. Public calc pow/exp retain their
nonfinite-result refusals; log retains null propagation and its input<=0 refusal,
without adding a local finite-result guard. Public sqrt is unchanged; the pinned
power's software sqrt is a closed internal helper.

The [accepted ordered financial graphs](../docs/rfcs/0088-pin-financial-numerical-procedures.md#ordered-financial-graphs),
including periodic/dated NPV, annuities and IRR/XIRR, are normative. Do not change
association, accumulation order, final quantization, null/default/type handling,
solver bracket/tolerances or refusal precedence. An internal Infinity may produce
a finite final zero; it MUST NOT be confused with a public primitive refusal.
Stability rearrangements using log1p/expm1 are not part of this procedure.

Native spreadsheet recalculation of exported formulas may differ beyond about
eleven significant digits and may return errors on IEEE edge cases, including
subnormals and overflow. These accepted export limits do not alter verification:
UWMD verifies the stated record, never the spreadsheet's recomputation. Eleven
digits is not a universal accuracy guarantee. Full receipt outputs/digests and
stated metric comparisons retain their distinct §VIII.5/§VIII.5.1 boundaries.

### VIII.6 CalcError taxonomy

| Code | Meaning |
|---|---|
| `CALC-PARSE-001` | Expression failed to parse against the grammar. |
| `CALC-RESOLVE-001` | Identifier could not be resolved. |
| `CALC-RESOLVE-002` | An identifier names a present variant-map section from which §VIII.2 selects no block. Either an explicitly requested variant is absent or carries an invalid role, or a declared role or `primary` is claimed more than once, or no generic rule applies (RFC 0066). |
| `CALC-TYPE-001` | Operator applied to incompatible types. |
| `CALC-DIV-ZERO` | Division by zero. |
| `CALC-IRR-DIVERGE` | IRR did not converge. |
| `CALC-LIMIT-001` | Expression exceeded host complexity limits. |
| `CALC-SENS-001` | Sensitivity axis missing or has no variable (§VIII.7.4). |
| `CALC-SENS-002` | Sensitivity axis has fewer than two values, or a non-finite one. |
| `CALC-SENS-003` | Sensitivity grid exceeds the cell or per-axis bound. |
| `CALC-SENS-004` | Both sensitivity axes vary the same variable. |
| `CALC-SENS-005` | Sensitivity `round_to` is out of range. |
| `CALC-STOCH-001` | Stochastic declaration has no integer `seed` (§VIII.8.5). |
| `CALC-STOCH-002` | Stochastic `samples` outside [2, 100000]. |
| `CALC-STOCH-003` | A stochastic input path or distribution is malformed, or a variable is drawn twice. |
| `CALC-STOCH-004` | `summarize` is empty or names an unknown statistic. |
| `CALC-STOCH-005` | Stochastic declaration has no random inputs. |
| `CALC-STOCH-006` | Stochastic `round_to` is out of range. |

### VIII.7 Sensitivity tables (RFC 0007)

A sensitivity table is one base formula evaluated once per (row,
column) pair, with the two axis variables overridden. It is the thing
every underwriter builds by hand in Excel, and the alternative — N×M
`custom_calculations` blocks, one per cell — bloats the document, hides
the axis design from any reader, and forces every consumer to re-derive
the grid's structure from calc-id naming conventions.

#### VIII.7.1 A declaration, not a function

A sensitivity table is declared in JSON, **not** written as a call
inside the §VIII.1 grammar:

```jsonc
{
  "id": "exit_value",
  "label": "Exit Value",
  "base_formula": "noi_model.net_operating_income / dcf.exit_cap_rate",
  "row_axis": { "variable": "dcf.exit_cap_rate", "values": [0.05, 0.06, 0.075] },
  "col_axis": { "variable": "noi_model.net_operating_income", "values": [600000, 660000] },
  "unit": "$",
  "round_to": 2
}
```

This is deliberate. A `sensitivity_table(expr, {…}, {…})` builtin would
need object literals, array literals, and a string argument that is
executed as a program — three extensions to a grammar whose narrowness
is the reason it can be evaluated on untrusted input at all. The axis
data is already JSON one level up, so the grammar buys nothing by
reaching it.

`base_formula` is an ordinary safe expression. The sandbox is unchanged.

#### VIII.7.2 Overrides

Evaluation uses **overrides**: values keyed by full dotted path, exactly
as an expression writes them (`dcf.exit_cap_rate`, not
`exit_cap_rate`), consulted ahead of frontmatter, sections, and prior
results.

Two properties are normative:

- **Overrides shadow, they never write.** After a sweep, the document
  reads exactly as it did before. A sweep that mutated the document
  would silently change the deal.
- **A `null` override means "treat this path as absent"**, and is
  distinct from having no override. Collapsing the two would make it
  impossible to ask what a formula does when an input goes missing.

Overrides are general, not sensitivity-specific: scenario sweeps and
stress tests need the same mechanism.

#### VIII.7.3 Results

The result is its own type, and **MUST NOT** be carried in
`CalcResult.value`, which stays `number | string | boolean | null`.
Receipts pin that union (§VIII.5), the CLI renders it, and the Excel
emitter emits from it; a grid smuggled through it would break all three
for a feature none of them asked to carry.

`grid[row][col]` follows the axes' declared order. Each cell is either a
value or the error that stopped it, never both.

**A failed cell does not fail the table.** A grid where one combination
divides by zero is still a useful grid, and refusing the whole thing
would hide the cells that worked. The result reports `failed_cells` so a
consumer can say how much of the table is real.

#### VIII.7.4 Refusals

A declaration that cannot produce a meaningful grid is refused before
any cell is evaluated:

| Code | Trigger |
|---|---|
| `CALC-SENS-001` | An axis is missing, or its `variable` is empty. |
| `CALC-SENS-002` | An axis has fewer than two values, or a non-finite one. |
| `CALC-SENS-003` | The grid exceeds 256 cells, or an axis exceeds 64 values. |
| `CALC-SENS-004` | Both axes vary the same variable. |
| `CALC-SENS-005` | `round_to` is outside `[0, 12]` or not an integer. |

Two of these are worth the words:

- **One value is not a sweep** (`CALC-SENS-002`). A degenerate 1×N grid
  is something every consumer would then have to special-case.
- **Two axes on one variable** (`CALC-SENS-004`) is not a redundancy but
  a trap: the second override silently wins for every cell, producing a
  grid whose rows are identical and whose reader has no way to see why.

The 256-cell bound keeps a host's evaluation cost predictable when the
declaration comes from a document it did not write. Three-axis (cube)
tables are out of scope; a follow-up RFC can add them if the case
appears.

#### VIII.7.5 Host obligations

An implementation that evaluates expressions but does not claim the
Sensitivity profile (§II.3) MUST report a typed refusal rather than
crash or silently skip. One that claims it MUST produce the same grid as any other host for the same
document and declaration — the base formula is deterministic, the axes
are literals, and quantization is §VIII.5, so there is nothing left to
disagree about.

### VIII.8 Stochastic calculations (RFC 0005)

Underwriting reasons about ranges: "DSCR is 1.45 base case but
1.20–1.65 across rate paths." Today those numbers are computed
elsewhere and pasted in as plain values, losing the model behind them,
or approximated as best/base/worst — which renders nicely and cannot
answer "what is the probability this underwrites above our minimum
DSCR?"

A stochastic calculation declares the inputs that vary, the
distribution each is drawn from, and a seed. The result is a
distribution summary.

#### VIII.8.1 A declaration, not built-ins

Sampling is **not** a function inside the §VIII.1 grammar. RFC 0005
proposed `uniform()`, `normal()`, `triangular()`, and
`monte_carlo(expr, n)`; each is disqualifying on its own terms:

- Every builtin is a pure function of its arguments. A sampling builtin
  carries PRNG state, and "the calc engine is pure" is what makes a
  formula auditable.
- `monte_carlo(expr, n)` needs a *lazy* argument, but arguments are
  evaluated eagerly — so it becomes either a special-cased builtin or a
  string executed as a program.
- A call whose legality depends on the enclosing declaration's
  `deterministic` flag is a context-sensitive grammar, checked by a
  deliberately context-free parser.

Instead the inputs are declared, and each draw is an ordinary
evaluation using the override mechanism of §VIII.7.2. The grammar and
the built-ins are untouched.

```jsonc
{
  "id": "dscr_distribution",
  "label": "DSCR distribution",
  "base_formula": "noi_model.net_operating_income / debt_structure.annual_debt_service",
  "inputs": [
    { "variable": "noi_model.net_operating_income",
      "distribution": { "kind": "uniform", "min": 540000, "max": 660000 } },
    { "variable": "debt_structure.annual_debt_service",
      "distribution": { "kind": "normal", "mean": 400000, "stddev": 15000 } }
  ],
  "samples": 2000,
  "seed": 42,
  "summarize": ["mean", "median", "p10", "p90", "stddev"]
}
```

`seed` is **required**. A stochastic calc without one produces a
different answer every run, which is the opposite of what this format
exists to guarantee (`CALC-STOCH-001`).

**Input order is part of the contract.** One PRNG stream feeds the
inputs in declared order, so reordering the list changes every sample.
The alternative — a stream per input — would make output depend on a
hidden per-input keying rule instead, which is worse because it is
invisible.

#### VIII.8.2 The PRNG

Normative: **PCG-XSL-RR-128/64** (`pcg64`), seeded as the reference
`srandom` does — zero the state, step, add the seed, step again. A host
that merely assigned the seed to the state would produce a different
stream from every correct implementation while still being perfectly
deterministic, and so would pass any self-consistency test.

Uniform doubles take the **top 53 bits** of a draw divided by 2⁵³. Not
64 bits over 2⁶⁴: that rounds, so two distinct draws can map to one
double and a third can reach exactly `1.0`.

Specifying the algorithm rather than naming a library is deliberate —
a library's version would become part of the determinism contract.

#### VIII.8.3 Distributions and exactness

Every distribution is sampled by **inverting its CDF** at a uniform
draw. This is about determinism, not elegance. IEEE 754 exactly
specifies `+ − × ÷` and `sqrt`; it does **not** specify `log`, `exp`,
`sin`, or `cos`, whose last-place results differ between platforms. So
Box-Muller (`log`, `cos`) and Marsaglia polar (`log`) are unusable:
they produce samples that agree to fifteen digits across hosts and
disagree in the sixteenth.

| Kind | Parameters | Cross-host exactness |
|---|---|---|
| `uniform` | `min`, `max` | **Exact** — arithmetic only. |
| `triangular` | `min`, `mode`, `max` | **Exact** — arithmetic and `sqrt`. |
| `normal` | `mean`, `stddev` | **Not exact in the tails.** |

`normal` uses Acklam's rational inverse-CDF approximation (relative
error ≈ 1.15 × 10⁻⁹). Its central region — about 95% of draws — is
arithmetic only and therefore exact; both tails need `log`, so two
hosts may disagree in the last place there.

That limitation is stated rather than hidden. The alternative was to
omit the normal distribution, which is worse: it is the one adopters
reach for. Conformance therefore compares `uniform` and `triangular`
results **exactly** and normal-derived results at a stated tolerance.
Naming which distributions are exact is more useful than a blanket
tolerance that conceals the difference.

`triangular`'s parameters are exactly the `low`/`central`/`high` the
asset-class default tables already carry, so an adopter can turn
existing napkin-mode ranges into distributions without inventing any
numbers.

#### VIII.8.4 Summaries

**Percentiles use nearest-rank, never interpolation.** For `n` sorted
samples, the `k`-th percentile is `sorted[ceil(k/100 × n) − 1]`. A
percentile is therefore an observed sample, which makes it exactly
reproducible whenever the samples are; interpolating between neighbours
adds an arithmetic step two hosts can round differently, for a number
nobody reads to that precision.

`stddev` is the **sample** standard deviation (`n − 1`). A single draw
has no spread, and reporting `0` would claim a certainty the run does
not have.

A draw whose formula does not evaluate to a finite number is counted in
`failed_samples` and **excluded** from the summary — not folded in as
zero, which would drag every statistic toward it. When every draw
fails, each requested statistic is present and `null`; an absent key
would be indistinguishable from one the declaration never requested.

Raw samples are withheld unless `return_samples` is set. 100,000
samples inline would make a document unreadable.

#### VIII.8.5 Refusals and capability

| Code | Trigger |
|---|---|
| `CALC-STOCH-001` | `seed` missing or not an integer. |
| `CALC-STOCH-002` | `samples` outside `[2, 100000]`. |
| `CALC-STOCH-003` | An input path is empty, drawn twice, or its distribution is malformed. |
| `CALC-STOCH-004` | `summarize` is empty or names an unknown statistic. |
| `CALC-STOCH-005` | No random inputs. |
| `CALC-STOCH-006` | `round_to` out of range. |

Drawing one variable twice (`CALC-STOCH-003`) is refused rather than
tolerated: the later draw silently wins for every sample while the
earlier one still consumes the stream, so the distribution is wrong in
a way no output reveals.

A host that evaluates stochastic declarations claims the Stochastic
profile (§II.3) and declares `calc-stochastic` in its
`ImplementationManifest.capabilities`. One that does not MUST report a
typed refusal rather than crash or silently return a point estimate.

### VIII.9 Calendar-anchored cash flows (RFC 0034)

The format's `cash_flow_series` section (format spec §4.26) states
dated, irregular flows. This section fixes the arithmetic two engines
must agree on when they read one: how a pair of dates becomes a year
fraction, how a rate discounts a dated flow, and how the one searched
number (`xirr`) is found. Everything here is reachable only through a
declaration or the verifier (§VIII.9.4) — the §VIII.1 grammar and the
§VIII.3 expression-callable table are unchanged. RFC 0071 later added
`is_calendar_date`, a validity predicate over the same calendar. No day count,
`yearfrac`, date arithmetic or date value type is reachable from an expression.

#### VIII.9.1 Day-count registry (normative, closed)

Mirrored in `@uwmd/core` as `DAY_COUNT_CONVENTIONS` / `yearfrac`. For
calendar dates `d1 ≤ d2` (proleptic Gregorian):

- **`actual/365f`** — `yearfrac = actualDays(d1, d2) / 365`, where
  `actualDays` counts calendar days between the dates. Leap days count
  as days; the denominator is always 365 (the "fixed" in 365F).
- **`actual/360`** — `yearfrac = actualDays(d1, d2) / 360`.
- **`30/360us`** — **exactly the Excel `DAYS360` U.S. method**, pinned
  so implementers do not reach for one of the other NASD variants: with
  date parts `(y1, m1, dd1)` and `(y2, m2, dd2)` — if `dd1 = 31` set
  `dd1 = 30`; then if `dd2 = 31` **and** `dd1 = 30` set `dd2 = 30`;
  `days = (y2 − y1)·360 + (m2 − m1)·30 + (dd2 − dd1)`;
  `yearfrac = days / 360`. There is **no February special-casing** —
  the NASD end-of-February adjustments are deliberately excluded, and
  the divergence from "full NASD" is documented here rather than
  discovered in a receipt mismatch.

`yearfrac` MUST be evaluated in binary64 with the division performed
last (`days` is an exact integer in every convention). An unknown
convention MUST be refused, never defaulted.

#### VIII.9.2 `xnpv` (normative, closed-form)

Over a series with anchor date `d0` (the first row's date, §4.26
`CF-02`) and rate `r > −1`:

```
xnpv(r) = Σᵢ amountᵢ × (1 + r) ^ (−tᵢ)     tᵢ = yearfrac(d0, dᵢ, day_count)
```

Terms MUST be accumulated in series order, left to right (the §VIII.5
posture on association order). `r ≤ −1` raises `CALC-TYPE-001`.

#### VIII.9.3 `xirr` (normative)

The root of `xnpv(r) = 0`, computed by **the §VIII.3 `irr` procedure
verbatim** with `npv` replaced by `xnpv`: bracket over
`[-0.999, 10.0]`; return an exact **high**-endpoint root; bisect to
`|xnpv(mid)| < 1e-9` or a half-interval below `1e-12`, whichever comes
first, capped at 200 iterations; **no Newton polish**. Failure to
bracket or to converge raises `CALC-XIRR-DIVERGE`. The §VIII.3 note on
the low endpoint carries over unchanged: a root at exactly `-0.999` is
not a well-defined binary64 quantity and is not owed.

`irr` and `xirr` are the only builtins permitted to iterate (§VIII.3).

#### VIII.9.4 Reachability, declarations, and quantization

Neither function enters the §VIII.1 grammar. They are reachable only
through:

1. **`verifyCashFlowSeries`** — the §4.26 three-state verifier, which
   recomputes each stated metric and compares at the quantization
   boundary (§VIII.5), and
2. **`CashFlowMetricDecl`** — a JSON declaration, the §VIII.7/§VIII.8
   pattern:

```json
{
  "id": "levered_xirr",
  "label": "Levered XIRR",
  "series_path": "cash_flow_series",
  "variant": "base",
  "metric": "xirr",
  "unit": "%"
}
```

`metric` is closed: `xirr | xnpv | moic | total_net`; `xnpv` requires
a `rate` (a fraction). The result is one quantized number in an
ordinary `CalcResult` — `CalcResult.value` is not widened and no
result carries a date. `CalcEvaluationContext.overrides` applies: a
caller MAY shadow an individual row
(`cash_flow_series.series[7].amount`) without touching the document,
the same shadowing contract sensitivity sweeps use. Quantization
follows the §VIII.5 unit defaults (`$` → 2, `%` → 6, `x` → 4).

A declaration naming a missing, malformed, or wrong-variant series
raises `CALC-CF-SERIES`. A host that evaluates cash-flow declarations
declares `calc-cash-flow` in its `ImplementationManifest.capabilities`;
one that does not MUST report a typed refusal rather than crash.

#### VIII.9.5 Explicit lease-up cash-flow projection (RFC 0044)

`projectLeaseUpCashFlows(parsed, plan)` asynchronously returns a
`LeaseUpCashFlowProjection` candidate. The plan MUST state `source_variant`,
registered `day_count`, and non-empty `cash_dates: [{ period, date }]`; other
plan or mapping fields MUST be refused. Selection MUST use the exact variant
(including eligible component roles), with no base/default fallback. Flat and
Format 3.0 bare section payloads use the period-selection contract.

The selected schedule MUST satisfy RFC 0008 LU-01/02/03 structural rules and
`verifyLeaseUpSchedule(schedule, leaseUpContext(parsed))` MUST return `verified`.
Every row MUST state finite numeric `net_cash_flow`; zero is valid, absent/null
is not zero. The adapter MUST copy that exact binary64 value, without rounding
or substituting the recomputed total. Verification retains its existing quanta.

Every source period MUST map exactly once to a real YYYY-MM-DD cash date.
Missing, extra and duplicate mappings MUST refuse. Mapping array order is
irrelevant; output follows source period order, in which dates MUST be
non-decreasing. Cash dates are caller assertions and MAY lie outside their
accrual periods. Same-day rows MUST remain separate, so ordinary date selectors
continue to refuse duplicate-date ambiguity. No synthetic anchor row is added.

Output contains `source_envelope_digest` from the complete semantic document
envelope (including superseded blocks), exact `source_variant`, `series`, and
`bindings: [{ source_path, date, amount }]`. The canonical source path is
`lease_up_schedule.schedule@<period>.net_cash_flow`; the outer variant applies
to every binding. Digest and values MUST describe the same source snapshot.
The series label MUST be `Lease-up receipts and TI/LC only`; each row uses
`kind: "other"` and its source path as label. `stated_metrics` MUST be omitted.
Net cash flow here covers rent revenue, concessions and TI/LC capex only.
The operation MUST NOT infer operating expenses, acquisition, debt, disposition,
NOI or complete investment returns. It MUST NOT write documents or mutate _meta.

Refusals use `LeaseUpCashFlowProjectionError.proto`, a serializable
`LeaseUpCashFlowProjectionIssue` with category `calc`, code
`CALC-LU-PROJECTION`, message and pointer. Plan pointers begin `plan`; source
pointers identify the selected section and variant. Optional `evidence` retains
the original `selection` ProtocolError, `structure` ValidationMessage array or
`verification` LeaseUpVerification. Failed and unverifiable verdicts MUST remain
distinct; no nested diagnostic is renamed. The three normative schemas are
`lease-up-cash-flow-plan`, `lease-up-cash-flow-projection`, and
`lease-up-cash-flow-projection-issue` under `spec/schemas/`.


### VIII.9.6 Explicit property cash-flow assembly (RFC 0045)


#### 1. First scope and economic boundary

This opt-in assembler applies the following requirements when invoked. It is
not mandatory at any pipeline stage.

The plan MUST state `basis: "unlevered"` and `tax_basis: "pre_tax"`. Amounts
represent cash paid or received by a hypothetical owner funding the whole asset
without debt. Property taxes belong in operating expenses; investor income and
capital-gains taxes do not. Debt draws, principal, interest, financing fees,
refinancing proceeds and investor allocations MUST NOT enter this stream.
Existing debt sections may remain in the document; they are not assembly inputs.

The plan MUST identify one currency using an uppercase three-letter
`currency_code`, and MUST carry an explicit same-currency assertion for each
selected source variant. Exact string equality is required. This is an author
assertion of denomination, not validation against a new currency registry.
No display symbol, locale, property location, exchange rate or decimal count
establishes currency identity. No conversion or scaling is performed. A missing
or conflicting assertion refuses. Documentary evidence of currency remains a
host review responsibility; the assembler cannot infer it from bare numbers.

Amounts MUST already be signed cash amounts: receipts positive, payments
negative. The assembler copies values without negation, proration, rescaling,
netting or intermediate rounding. An accrual expense or amortization charge
is not an acceptable substitute for its cash payment.

#### 2. Source contract

The additive entry point is
`assemblePropertyCashFlows(parsed, plan): Promise<PropertyCashFlowAssembly>`.
It accepts one parsed document, one exact `lease_up_schedule` variant and one
distinctly selected supplemental `cash_flow_series` variant from that document.
There is no default variant, fallback role, cross-document input or override map.

The lease-up source MUST pass `projectLeaseUpCashFlows` under the caller's
complete explicit cash-date plan. Preserve its failed/unverifiable distinctions
and nested evidence. The assembler MUST invoke the adapter against the supplied
document rather than trust a previously serialized projection object.

The supplemental series MUST satisfy the existing §4.26 structural rules,
including finite amounts and real, nondecreasing dates. Its explicitly stated
day count MUST equal the plan's registered day count. If it states metrics,
their existing verifier MUST return `verified`; absent metrics make no claim
about completeness. A successful metric verifier alone is not a structural check.

Every supplemental row MUST be assigned exactly once by zero-based `row_index`
to one coverage cell. Indexes refer to that specific series in the digested
source snapshot. This is an assembly-plan binding, not new expression syntax
or an RFC 0041 date selector: same-date rows remain individually addressable.
Each binding carries its canonical source path, exact variant, date and amount
in the result. Unknown fields, invalid indexes, unused rows and repeated source
row identities refuse. Advisory `kind` labels cannot substitute for coverage.

General `dcf`, NOI and valuation totals are not directly accepted sources in
this first adapter. The author must state separately covered cash rows in the
supplemental series, with provenance. In particular, never append NOI or a
levered/net terminal total to the lease-up bundle as another income component.

#### 3. Coverage ledger

A coverage cell is the exact pair `(slot, category)`. `slot` is either an
absolute source period, `acquisition` or `disposition`. Required cells are:

| Slot | Required categories | Ownership |
|---|---|---|
| Every lease-up period | `rent`, `concessions`, `ti_lc` | Automatically owned together by that period's RFC 0044 row. |
| Every lease-up period | `other_income`, `operating_expenses`, `other_capex`, `reserve_net` | Supplemental rows or explicit zero declaration. |
| `acquisition` | `purchase_price`, `transaction_costs`, `reserve_net` | Supplemental rows or explicit zero declaration, subject to the purchase rule below. |
| `disposition` | `gross_sale`, `transaction_costs`, `reserve_net` | Supplemental rows or explicit zero declaration. |

For each cell not owned by lease-up, the plan MUST provide exactly one of:

- `rows`: a nonempty list of distinct supplemental row indexes; or
- `zero`: a nonempty author explanation that no cash flow applies to that cell.

A cell may contain multiple cash rows at different dates. A row cannot cover
multiple cells. Duplicate cell declarations, a row and zero declaration for the
same cell, unknown categories, missing cells or attempts to bind lease-up-owned
cells refuse. A numeric zero source row remains a real row; null or omission is
never zero. A zero declaration produces coverage evidence, not a synthetic row.

The purchase cell MUST contain at least one negative payment and MUST NOT be
declared zero. All purchase rows MUST be negative. `gross_sale` and
`other_income` rows MUST be nonnegative; `transaction_costs`,
`operating_expenses` and `other_capex` rows MUST be nonpositive. Refunds are
stated separately as `other_income`, with their category explained in provenance.
`reserve_net` may have either sign. The existing lease-up verifier governs the
mixed signed bundle; no new component-sign rule is retrofitted onto RFC 0044.

`other_income` MUST exclude rent and concessions. `other_capex` MUST exclude
TI/LC. `gross_sale` MUST exclude costs of sale, debt payoffs and separately
returned reserves. Transaction costs MUST be separately stated cash payments,
not recomputed from a percentage. Vacancy already reflected in stated rent is
not a second expense. None of these exclusions is inferred from row labels.

#### 4. Reserve treatment and limits of double-count checks

The reserve boundary is cash available to the hypothetical owner:
funding a restricted reserve is an outflow, and releasing cash to that owner is
an inflow. `reserve_net` contains those external transfers. Spending *inside*
the funded reserve is not another owner outflow. If reserve-funded work is also
included in lease-up TI/LC or a supplemental expense/capital row, the plan MUST
be refused; this first scope cannot split or adjust the lease-up bundle.

The plan MUST explicitly assert that reserve-funded spending is excluded from
all other selected cash amounts, and that gross sale excludes separately returned
reserves. It MUST also state that no restricted reserve remains after disposition.
If the author cannot make those assertions, assembly is unsupported; do not
assume a zero balance or estimate a release. Even when reserves do not apply,
the corresponding coverage cells need explicit zero explanations.

Structural checks catch duplicate identities and declared coverage overlaps.
They cannot prove that differently named rows do not contain the same economic
payment, or that an authored zero is true. The result MUST distinguish
`coverage: "declared_complete"` from financial verification. Source digests and
author assertions are audit evidence, not proof of economic completeness.

#### 5. Dates, valuation anchor and terminal proceeds

The lease-up source supplies the complete, gap-free monthly or quarterly period
set. The plan MUST state an acquisition date inside the first source period and
acquisition MUST be strictly before disposition.

RFC 0063 adds the optional top-level plan member
`disposition_period_rule?: 'within_final_period' | 'allow_exclusive_end'`.
If absent or `within_final_period`, disposition MUST lie inside the final source
calendar period under the existing rule. If `allow_exclusive_end`, disposition
MUST either lie inside that period or equal its exact exclusive upper calendar
boundary. No other date is admitted: one day later MUST refuse. No grace window
or settlement horizon is introduced.

Derive the boundary only from the final validated canonical `YYYY-MM` or
`YYYY-Qn` source identity. Let `y` be the stated year, `m` the month (or
`3 * (n - 1) + 1` for a quarter), and width 1 or 3 respectively. Add width to
`m`; if it exceeds 12, subtract 12 and increment `y`. The boundary is day 01 of
that resulting month, using four-digit year and two-digit month/day padding.
Use calendar integers, not timezones, elapsed days, row counts or acquisition.
Leading-zero years retain their identity. A boundary in year 10000 grants no
additional representable date; MUST NOT wrap/clamp/truncate or invalidate an
otherwise valid inside-period disposition. Source grammar and validation remain
unchanged. December and Q4 2027 both yield 2028-01-01; 2028-01-02 refuses.

The enum is closed. An own member with any other value (including JavaScript
`undefined`, null, boolean or unknown string) MUST refuse `CALC-CF-ASSEMBLY`,
reason `plan`, pointer `plan.disposition_period_rule`. Unknown plan/assertion
members still refuse. No schema default or host-materialized default is allowed.
Copy a supplied valid member verbatim into `result.plan`; absence MUST remain
absent. Omission preserves existing validation, serialized output, diagnostics,
digests and refusals exactly. Explicit `within_final_period` differs only in the
echoed member, not behavior. Hosts MUST NOT infer or silently retry with opt-in.
Out-of-range disposition still refuses `date_horizon` at `plan`; existing
assertion/source/horizon/coverage/closing/sign refusal order remains unchanged.

The exclusive boundary creates no source period. The complete final monthly or
quarterly period remains the final operating/accrual period. MUST NOT synthesize
an extra month/quarter, lease-up row, period coverage cell or post-sale operating
period. All source periods and mappings remain mandatory; no append, ignore or
caller-provided final-period override. Existing inside-period dispositions and
explicitly authored partial-period amounts remain valid; no proration occurs.
Timing admission MUST NOT cure any reserve assertion refusal, infer a release,
or add reserve opening/ending balances, contributions, funded draws, internal
spending or reconciliation. Existing external-transfer treatment, financing and
investor-tax exclusions, RFC 0052 sale deductions and RFC 0062 same-day semantics
remain unchanged.

All cash dates MUST lie within that closed acquisition/disposition interval.
Acquisition-slot rows MUST occur on the acquisition date, and disposition-slot
rows MUST occur on the disposition date. Period-slot rows retain explicitly
stated cash dates, which may differ from the period of accrual. The author MUST
assert that the stated amounts cover only the declared hold and include any
settlement of receivables/payables at exit. A cash lag beyond disposition refuses;
extending the post-sale settlement horizon requires a later contract.

Sort output by date, breaking ties by lease-up source order first, then
supplemental row index. Preserve every row separately and copy amounts exactly.
The required purchase payment makes acquisition the first actual cash date.
No synthetic zero is inserted to move the RFC 0034 anchor.

`gross_sale` is a stated cash receipt. The assembler MUST NOT derive it from
trailing or forward NOI, a cap rate or the existing `deriveDCF` helper. Net exit
cash emerges only from the separately stated rows; no extra net-proceeds row
may be appended. A zero exit recovery needs its own explicit zero explanation.

#### 5a. Named sale deductions and net proceeds (RFC 0052)

The plan MAY carry `sale_deductions`, naming each cash row bound to the
`(disposition, transaction_costs)` cell from a closed vocabulary. The unlevered
names are `broker_commission`, `transfer_tax`, `title_and_escrow`,
`legal_and_closing`, `seller_credits`, `survey_and_diligence` and `other`.
An `other` entry MUST carry a nonempty author label; any other name MUST NOT,
because the name already states what the amount is.

`prepayment_penalty`, `defeasance` and `loan_payoff` are reserved in the same
vocabulary and MUST be refused here: they are levered, below-NOI amounts, and
this assembly is unlevered and pre-tax. Reserving rather than omitting them
keeps a later levered contract from colliding with adopter usage and turns a
basis violation into an explained refusal rather than a silent one.

When `sale_deductions` is present it MUST name every row covering that cell,
exactly once, and MUST NOT name a row the cell does not cover. Partial naming
refuses: a rollup over some deductions looks complete and is worse than none.
Omitting `sale_deductions` entirely remains valid. Names carry no sign rule of
their own; the existing nonpositive `transaction_costs` rule governs every row
they name, `seller_credits` included, and naming changes no amount, date or
output position. Each deduction remains its own dated §4.26 row.

The plan MAY also carry `net_sale_proceeds`, a stated figure the assembler
verifies and MUST NOT derive. Verification sums the `gross_sale` and
`transaction_costs` rows at the disposition slot and compares against the stated
figure, both sides quantized at the §VIII.9.4 currency quantum per §VIII.5. The
check spans the whole `transaction_costs` cell rather than only the named rows,
so it cannot be satisfied by leaving a deduction unnamed. It excludes
`reserve_net`: a returned reserve is not sale proceeds. Stating
`net_sale_proceeds` without a `gross_sale` row refuses; omitting it leaves the
result's status `not_stated`. A verified figure is evidence about stated
amounts, never proof that the deductions are complete or the exit is real.

#### 6. Candidate result and metric interpretation

New public types are `PropertyCashFlowPlan`,
`PropertyCashFlowAssembly` and `PropertyCashFlowAssemblyIssue`, exported with
the function from core and browser. Result fields MUST include:

- Whole-source semantic envelope digest using the existing digest contract.
- The explicit basis, tax basis, currency, acquisition/disposition dates and
  day count; a copy of the plan's economic assertions and zero explanations.
- A `CashFlowSeries`, labelled `Unlevered pre-tax property cash flow`, without
  `stated_metrics`; source bindings in output-row order and each cell's ownership.
- `coverage: "declared_complete"` and separate source verification evidence.

The wrapper carries economic meaning; the unchanged §4.26 series alone does not
encode currency or basis. Consumers MUST retain the wrapper when displaying or
comparing results. This RFC does not define persistence of that wrapper in a
standard section, a signature profile, or a way to label it equity cash flow.

Callers may evaluate existing metrics over the candidate using explicit
declarations. With acquisition included, `xnpv` is net present value of the
stated investment stream at acquisition, **not an appraisal value**. A discount
rate remains caller-supplied. Existing `xirr` bracket/convergence refusals and
boundary quantization remain unchanged. No IRR, growth, tax, amortization or
terminal-value formula is added. Same-day rows retain RFC 0041 selector ambiguity.

The operation MUST NOT write files, alter source blocks or `_meta`, accept
changed source values as overrides, or emit partial successful output on refusal.
Implementations MUST take a coherent source snapshot before asynchronous hashing.

#### 7. Refusals

Use `PropertyCashFlowAssemblyError extends CalcError` with a structured
`CALC-CF-ASSEMBLY` issue. Distinct reasons MUST identify plan shape, source
selection, source structure, source verification, coverage, basis/currency,
amount/sign or date/horizon failures. Include plan/source pointers and preserve
existing nested lease-up and cash-flow diagnostics. The wire contract below
pins the reason enum and payload shapes; the implementation must register them
with the normative schemas and protocol prose in the same commit.

#### 8. Wire contract

The following types define the JSON contract; the schemas are
`property-cash-flow-plan`, `property-cash-flow-assembly` and
`property-cash-flow-assembly-issue` under `spec/schemas/`. All object shapes are closed
(`additionalProperties: false`), including array entries. All members are required
unless marked optional; optional members are omitted, never emitted as null.
Strings used as variants must be nonempty. Zero explanations must contain at
least one non-whitespace character; preserve their authored text without trimming.
`DayCountConvention`, `CashFlowSeries`, `ProtocolError`, `ValidationMessage`,
`CashFlowVerification` and `LeaseUpCashFlowProjectionIssue` retain existing types.

```ts
type PropertyCashFlowCategory =
  | 'rent' | 'concessions' | 'ti_lc'
  | 'other_income' | 'operating_expenses' | 'other_capex' | 'reserve_net'
  | 'purchase_price' | 'transaction_costs' | 'gross_sale';

interface PropertyCashFlowCell {
  slot: string; // acquisition, disposition, or exact source period
  category: PropertyCashFlowCategory;
}

type PropertyCashFlowCoverage = PropertyCashFlowCell & (
  | { rows: number[]; zero?: never }
  | { zero: string; rows?: never }
);

interface PropertyCashFlowAssertions {
  cash_amounts_only: true;
  no_financing_or_investor_tax: true;
  no_overlapping_economic_amounts: true;
  reserve_spending_excluded: true;
  gross_sale_excludes_reserve_release: true;
  no_terminal_restricted_reserve: true;
  hold_only_and_exit_settled: true;
}

type SaleDeductionName =
  | 'broker_commission' | 'transfer_tax' | 'title_and_escrow'
  | 'legal_and_closing' | 'seller_credits' | 'survey_and_diligence' | 'other'
  // Reserved below-NOI names; refused by this unlevered assembler.
  | 'prepayment_penalty' | 'defeasance' | 'loan_payoff';

interface SaleDeduction {
  row: number; // a supplemental row covering (disposition, transaction_costs)
  name: SaleDeductionName;
  label?: string; // required when name is 'other', refused otherwise
}

interface PropertyCashFlowPlan {
  basis: 'unlevered';
  tax_basis: 'pre_tax';
  currency_code: string; // ^[A-Z]{3}$; author-stated identity
  day_count: DayCountConvention;
  acquisition_date: string;
  disposition_date: string;
  lease_up: {
    source_variant: string;
    currency_code: string;
    cash_dates: Array<{ period: string; date: string }>;
  };
  supplemental: {
    source_variant: string;
    currency_code: string;
  };
  assertions: PropertyCashFlowAssertions;
  coverage: PropertyCashFlowCoverage[];
  sale_deductions?: SaleDeduction[];
  net_sale_proceeds?: number;
}

interface PropertyCashFlowBinding {
  output_row_index: number;
  source_section: 'lease_up_schedule' | 'cash_flow_series';
  source_variant: string;
  source_path: string;
  date: string;
  amount: number;
  cells: PropertyCashFlowCell[];
}

type PropertyCashFlowCellEvidence = PropertyCashFlowCell & (
  | { output_rows: number[]; zero?: never }
  | { zero: string; output_rows?: never }
);

interface PropertyCashFlowAssembly {
  source_envelope_digest: string;
  plan: PropertyCashFlowPlan;
  coverage: 'declared_complete';
  series: CashFlowSeries;
  bindings: PropertyCashFlowBinding[];
  cells: PropertyCashFlowCellEvidence[];
  source_verification: {
    lease_up: 'verified';
    supplemental_metrics: 'verified' | 'not_stated';
  };
  sale_deductions?: Array<{
    output_row_index: number;
    name: SaleDeductionName;
    label?: string;
    amount: number;
  }>;
  net_sale_proceeds:
    | { status: 'verified'; stated: number; computed: number }
    | { status: 'not_stated' };
}

interface PropertyCashFlowAssemblyIssue {
  category: 'calc';
  code: 'CALC-CF-ASSEMBLY';
  reason: 'plan' | 'selection' | 'structure' | 'verification'
    | 'coverage' | 'basis_currency' | 'amount_sign' | 'date_horizon'
    | 'sale_deduction';
  message: string;
  pointer: string;
  evidence?: {
    selection?: ProtocolError;
    lease_up?: LeaseUpCashFlowProjectionIssue;
    structure?: ValidationMessage[];
    verification?: CashFlowVerification;
  };
}
```

`rows` and `output_rows` contain nonnegative safe integer indexes, are nonempty
and have no duplicate entries. The input coverage array is nonempty; its legal
slot/category pairs are exactly the non-lease-up cells in VIII.9.6.3. Date strings must
be real `YYYY-MM-DD` dates. The plan's lease-up map is the RFC 0044 map with the
outer day count; there is no second nested day-count setting. Neither source's
currency assertion is inferred from the other. Required assertions must be
literal `true`; false, missing or unknown assertions refuse. These declarations
do not make hidden economic overlap mechanically detectable.

The result's `plan` is a deep copy, preserving the caller's array order. No
output object or array shares mutable references with a source or input plan.
Source validation and copying must use one consistent snapshot; mutation of
the caller's document or plan during the asynchronous call cannot change the
returned amounts, evidence or digest. No plan digest is introduced by this RFC.

Result `bindings` follow output row order and their `output_row_index` equals
their array index. Lease-up paths retain RFC 0044 canonical period paths;
supplemental paths are `cash_flow_series.series[N].amount`. Source variant and
whole-document digest qualify each path. Each lease-up binding owns exactly
three cells in `rent`, `concessions`, `ti_lc` order. Each supplemental binding
owns exactly one cell. Every binding's date and amount match its output row.

Result `cells` are ordered acquisition first, source periods in source order,
then disposition. Within each slot, use the category order printed in the
§VIII.9.6.3 table. `output_rows` are ascending output indexes. Input coverage entry order
and order within an input `rows` list do not change output rows or cell evidence.
Zero explanations are copied verbatim. Every output row is covered; the three
lease-up cells intentionally reference their common single bundled row.

The series has exactly `label`, `day_count` and `series`. Each row has exactly
`date`, `amount`, `kind: "other"` and `label` equal to its canonical source path.
Use `other` consistently: coverage cells, not the advisory row-kind taxonomy,
define economic ownership. The wrapped plan carries basis and currency. No
stated metrics or newly calculated monetary total is emitted.

`supplemental_metrics` is `not_stated` when every existing metric declaration
is absent or null, including an empty or null `stated_metrics` object. Otherwise
the source must pass the existing metric verifier and the value is `verified`.
Structural validation always runs separately. In particular, compare actual
calendar dates for ordering; equal day-count exponents do not permit reversed
calendar dates under `30/360us`. This tightens no existing generic metric API.

Refuse in this order: plan shape; basis/currency and assertions; exact source
selection; supplemental structure preflight; lease-up adapter; supplemental
metric verification;
hold horizon; coverage ownership; closing-slot timing; category signs. Traverse arrays in input order and
required cells in the canonical order above; report the first failure. A nested
RFC 0044 refusal uses outer reason `verification` and preserves the original
issue in `evidence.lease_up`, even when that nested issue concerns its date map
or source structure. This labels the failed adapter stage, not a new verdict on
the source. Selection failures use `selection` and preserve their existing issue.
Supplemental structure is checked before the lease-up adapter because its
whole-envelope hash also visits supplemental values. A noncanonical value
elsewhere in the envelope refuses with `structure` at `sections`.
Explicit source shape checks use `structure`; failed metric recomputation uses
`verification`. False economic assertions use `coverage`. All pointers use the
existing dotted/bracket style rooted at `plan` or
`sections.<section>[<JSON-quoted variant>]`. Message prose is explanatory; code,
reason, pointer and nested evidence carry the machine-readable contract.


### VIII.10 Distribution waterfall allocation (RFC 0035, RFC 0036, RFC 0059)

The format's `distribution_waterfall` section (format spec §4.27)
states a tier ladder over a §4.26 dated series. This section fixes the
allocation two engines must agree on. Like §VIII.9 it is a verifier
surface (`verifyWaterfall`), not calc-engine surface: no grammar
tokens, no builtins, no `CalcResult` changes.

**The walk (normative).** Amounts are evaluated in binary64 and
quantized only at the reporting boundary (§VIII.5). Maintain, per
party (`lp`, `gp`): `unreturned` capital, `accrued_pref`,
`contributions`, `distributions`, receipts by tier kind, and the
party's dated flow list. Walk the referenced series **in row order**:

1. **Accrue first.** Let `Δt = yearfrac(prev_date, date, day_count)`
   (§VIII.9.1; the series' convention; the first row's `prev_date` is
   itself, so `Δt = 0`, and same-date rows accrue nothing). For each
   party, when a `preferred_return` tier is present:
   `simple` — `accrued_pref += unreturned × rate × Δt`;
   `compound_annual` — `accrued_pref += (accrued_pref + unreturned) ×
   ((1 + rate)^Δt − 1)` — unpaid pref itself compounds.
2. **Contribution rows** (`amount < 0`): each party's `unreturned` and
   `contributions` grow by its `equity_split` share of `|amount|`; the
   share joins the party's dated flows as an outflow at the row's
   anchor-relative `t` (§VIII.9.2).
3. **Distribution rows** (`amount > 0`): the cash fills the ladder in
   order; each tier pays up to its **capacity**, and the remainder
   falls through. Capacities and splits:
   - `return_of_capital` — capacity `Σ unreturned`; paid pro-rata by
     `unreturned`; reduces it.
   - `preferred_return` — capacity `Σ accrued_pref`; paid pro-rata by
     accrued balance; reduces it.
   - `catch_up` — with `P` = total **profit** distributed so far
     (distributions minus return-of-capital receipts, both parties,
     including earlier tiers of this row — pref receipts **count as
     profit**, or a catch-up following the pref tier could never fill)
     and `G` = GP profit so far: capacity `x = (target_promote × P − G)
     / (gp_share − target_promote)`, floored at 0. `gp_share` of the
     payment goes to the GP, the rest to the LP.
   - `split` — paid `lp_share` / `gp_share`. A capped tier's capacity
     is governed by its stated hurdles; the final tier is unbounded.
     When both `until_lp_em` and `until_lp_irr` are stated:
     - if `hurdle_mode` is `"any"`, the **smaller** of the two capacities
       governs (the tier ends when either hurdle is met; RFC 0051);
     - if `hurdle_mode` is `"both"` or omitted, the **larger** of the two
       capacities governs (both must be met before the tier ends).
     - `until_lp_em`: `max(0, until_lp_em × lp.contributions −
       lp.distributions) / lp_share` (unchanged from 2.3.0).
     - `until_lp_irr` (= `h`, RFC 0036): let `F` be the LP's dated
       flows so far — every contribution outflow and distribution
       inflow appended by earlier rows **and by earlier tiers of this
       row**, at their anchor-relative `t` (§VIII.9.2) — and `t_row`
       this row's `t`. The LP's **hurdle balance** is
       `B = −xnpv(F, h) × (1 + h) ^ t_row`
       (§VIII.9.2's sum, accumulated in flow order; the same `t`
       values the outcome `xirr` will use). Capacity is
       `max(0, B) / lp_share`. `B ≤ 0` means the LP has already
       achieved the hurdle and the tier pays nothing.

     The hurdle test is the balance identity, **not** a comparison
     against a solved `xirr`: `xnpv(F ∪ {(t_row, B)}, h) = 0` exactly,
     so a tier that fills lands the LP at the hurdle rate by
     construction, without iteration. The reported outcome `xirr` is
     still the §VIII.9.3 procedure over the final flows; at a filled
     boundary the two agree to within that procedure's stopping
     tolerance, which the §VIII.9.4 `%` quantum (6 dp) absorbs. The
     identity — not "LP IRR ≥ h" — is the definition: for flows with a
     capital call after a distribution `xnpv(·, r)` need not be
     monotone in `r`, "IRR ≥ h" can be ambiguous or undefined, and two
     engines solving for the IRR could legitimately disagree on whether
     the hurdle was met; the balance is single-valued for every finite
     flow list.
   Payments join each party's dated flows as inflows. Cash never
   remains after the final tier (it is unbounded by grammar). An
   implementation MUST NOT determine a tier boundary by iterating on
   `xirr`; §VIII.9.3 remains the only permitted iteration and it runs
   only in step 4.
4. **Outcomes.** Per party: `moic = distributions ÷ contributions`;
   `xirr` by the §VIII.9.3 procedure over the party's dated flows.
   `promote_total` = GP distributions − GP return-of-capital receipts
   − GP pref receipts; `profit_total` = Σ distributions −
   Σ contributions.
5. **Clawback true-up** (RFC 0059), only when `clawback` is stated.
   After the walk, compute the LP's shortfall against the stated floor:
   `lp_preferred_shortfall` — `unreturned + accrued_pref`;
   `lp_em_floor` — `floor_multiple × contributions − distributions`;
   `lp_irr_floor` — the step-3 hurdle balance
   `B = −xnpv(F, floor_rate) × (1 + floor_rate)^t` over the LP's dated
   flows at the **final row's** `t`. Then
   `gross = min(max(0, shortfall), max(0, promote_total))` — the GP can
   never return more promote than it received — and
   `clawback = gross × (1 − net_of_tax_rate)` when that rate is stated,
   otherwise `gross`. The result is a single terminal figure, never a
   schedule row and never per-period state: a clawback moves cash
   backward after the last row, so representing it as a tier would put a
   negative distribution in `by_tier`. An implementation MUST NOT
   determine it by iterating on `xirr`; every basis above is closed-form.
   A waterfall with no `clawback` reports `null`, which is distinct from
   a stated provision that computes to `0` (the LP cleared its floor).
6. **Verification** (three-state): stated outcomes at the §VIII.9.4
   quanta (`$`→2, `x`→4, `%`→6); stated schedule cells at the currency
   quantum with an absent cell reading 0; a stated `xirr` whose
   recomputation raises is `failed`; a `moic` over zero contributions
   is `unverifiable`; a missing or structurally invalid referenced
   series makes every stated figure `unverifiable`; a stated
   `clawback_amount` on a waterfall declaring no provision is
   `unverifiable`, because there is no recomputed figure to disagree
   with. Failure outranks indeterminacy.

---


### VIII.11 Property reserve-account verification (RFC 0064)

`verifyReserveAccounts(parsed)` is a separately invoked, browser-safe,
read-only verifier for Format §4.28. It MUST snapshot the supplied parsed
source before any await. It MUST inspect every current nonsuperseded
`reserve_accounts` variant independently, preserving account/period/movement
order, authored source pointers and block metadata. It MUST NOT choose a
variant by fence order, aggregate variants, create periods, infer zero
movements, project draws, accrue interest or derive releases.

1. Absent section: return `not_checked / not_applicable`, null digest,
   empty evidence and issues. No synthetic account or balance is produced.
2. Apply §4.28 structural checks in block/account/period/movement source order;
   refuse before arithmetic on any finding as `unverifiable / invalid_structure`.
3. Compute `source_digest` using the existing complete Envelope 1.0 semantic
   SHA-256 digest (RFC 0014), including source content, provenance and history,
   excluding only the envelope's digest/generator/generated-at fields. A digest
   failure returns `unverifiable / digest_unavailable`; never claim verified.
4. For each period, start at its stated opening balance. In authored movement
   order, add each contribution and subtract each internal draw or external
   release exactly once. Use IEEE-754 binary64 with no intermediate rounding.
   Quantize the computed ending balance and the independently stated ending
   balance separately at the existing currency quantum (2dp), half-away-from-zero
   per §VIII.5. They MUST be equal; no tolerance beyond this quantum is added.
   A disagreement emits `RSV-06` at the period's `ending_balance`.
   Sub-cent amounts are judged in binary64, so a half-cent sum can differ
   from exact decimal arithmetic.
5. Only when `previous_period_id` explicitly claims continuity, compare this
   opening balance with the immediately preceding stated ending balance at
   the same quantum. A disagreement emits `RSV-07` at `opening_balance`.
   This checks a claimed balance boundary, never source completeness or a
   financial timing convention. Gaps are never populated.
6. Any nonfinite balance arithmetic returns `unverifiable /
   nonfinite_arithmetic` with `RSV-08`; never serialize a nonfinite balance
   as a result; continue checking all remaining periods. Otherwise return
   `failed` if any balance disagrees, or
   `verified`. Return all finite item-level evidence and typed findings.

The wire types in `protocol.ts` and
[reserve-accounts-verification.schema.json](schemas/reserve-accounts-verification.schema.json)
name `state`, optional `reason`, `source_digest`, `evidence` and
`issues`. Evidence identifies the variant (null if unstated), account,
period, dotted source field, currency, period source, stated opening/ending,
raw computed ending and copied movement rows. Verifier mismatches carry
account/period/source context; structural issues carry variant context in
`value`. Findings preserve deterministic source order; ending mismatch
precedes continuity mismatch within a period.

The reference CLI `uwmd verify-reserve-accounts <file> [--json]` returns this
result, exits 1 on `failed` or `unverifiable`, and exits 0 on `verified`
or absent/not-applicable. Ordinary `validate` checks structure and does not
claim arithmetic verification. A custody verifier neither writes the file
nor alters gross expenditure or relaxes §VIII.9.6's
`reserve_spending_excluded` refusal. Digest consistency and matching balances
are not source authenticity, movement classification or economic completeness
proofs. Draw-to-expenditure binding is specified separately in §VIII.12
(RFC 0065).

### VIII.12 Reserve draw to gross expenditure binding verification (RFC 0065)

`verifyReserveDrawBindings(parsed, plan?)` is a separately invoked, browser-safe,
read-only verifier. The optional external plan is governed by
[reserve-draw-binding-plan.schema.json](schemas/reserve-draw-binding-plan.schema.json).
It changes no document section, source amount, metadata, owner-cash row or
§VIII.9.6.4 rule. RFC 0045's `reserve_spending_excluded` refusal is unchanged.

**Plan.** All plan and reference objects are closed. Require `source_digest`
(the complete Envelope 1.0 semantic SHA-256 digest), uppercase three-letter
`currency_code`, `coverage: "declared_complete"`, nonempty `selected_draws`,
`expenditures` and `bindings` arrays. Selected draws name exact `variant`,
`account_id`, `period_id`, `movement_id`. Explicit null means unlabelled;
strings mean exactly that authored variant. Never fall back to a variant key,
role, default/base preference or fence order. Every source must be current and
nonsuperseded. Account/period/movement IDs resolve within that exact variant.

Each expenditure declares unique `expenditure_id`, exact `ref`, `category`,
`gross: true`, `currency_code`, positive `funded_amount` and source
`{document, locator}`. A lease-up ref is
`{section: "lease_up_schedule", variant, period, field: "ti_lc_capex"}`
with category `ti_lc`; never bind its net/bundled cash row. A supplemental
ref is `{section: "cash_flow_series", variant, row_index}` (nonnegative
safe integer) with category `other_capex` or `operating_expenses`.
The producer's gross/category/currency/source declaration establishes the
selected row's meaning, as RFC 0045 explicitly declares coverage categories.
An undifferentiated total, owner transfer or financing row has no admitted gross
expenditure declaration here. Neither hashing nor labels authenticate this
assertion. No classification is inferred from dates, labels, amounts, advisory
cash-flow kinds or shared provenance.

Each binding is `{draw, expenditure_id, funded_amount}`. Every selected draw
and expenditure source address is unique. Draw/expenditure edge pairs are unique
even when allocation amounts differ. Amounts MUST be finite and positive at the
currency quantum. The inventory declares completeness of selected draws only;
it does not prove external-source completeness. No omitted draw is selected.

**Procedure, in source/plan order.**

1. Snapshot both inputs before any await. Omitted plan (undefined) returns
   `not_checked / not_applicable`, null digest and empty evidence/issues.
   Stated null or malformed plan returns `unverifiable / invalid_structure`
   with RDB-01; duplicate inventories or edges emit RDB-05 before arithmetic.
2. Compute the whole Envelope semantic digest, including content, metadata and
   history per RFC 0014. Unavailable digest returns
   `unverifiable / digest_unavailable`. A stale stated digest returns
   `failed / stale_binding` with RDB-02 and no arithmetic evidence.
3. Resolve every exact source reference. Missing/ambiguous/superseded sources or
   an undeclared edge endpoint emit RDB-03. Each selected reserve variant MUST
   verify in full under §VIII.11; failure emits RDB-04, retaining source findings
   in the issue value. Unselected reserve variants are not verified or selected.
   Selected cash-flow series MUST contain closed finite, calendar-valid,
   nondecreasing rows as RFC 0070's source binding does. Selected lease-up
   structure MUST pass its shared structural checks and have a registered model.
   Invalid source shape/order emits RDB-04.
4. The movement MUST be a positive `internal_draw` in a `property_reserve`
   account. The exact gross expenditure MUST be finite and negative at the
   currency quantum; missing/null amounts are never zero. Category and source
   shape MUST agree. Account, declared expenditure and plan currency MUST agree
   with the document currency when stated. Violations emit RDB-06; no FX is
   performed. Source/refusal findings return `unverifiable / invalid_source`
   before allocation verdicts, retaining every finite fully resolved edge.
5. In binding array order, sum positive allocations independently by draw and
   by expenditure in IEEE-754 binary64 without intermediate rounding. Quantize
   each final sum and each independently stated comparison amount separately at
   the existing 2dp currency quantum, half-away-from-zero per §VIII.5.
   Every selected draw's sum MUST equal its stated amount (RDB-07 otherwise).
   Every expenditure's sum MUST equal its explicitly stated funded amount and
   MUST NOT exceed its absolute gross amount (RDB-08 otherwise). An unbound
   selected draw is a completeness failure, not a missing-zero source inference.
   Sub-cent sums are judged in binary64; there is no decimal arithmetic override
   or tolerance beyond the existing quantum.
6. Nonfinite allocation sums emit RDB-09; continue checking all later finite
   totals and retain all finite edge evidence. Return
   `unverifiable / nonfinite_arithmetic` at the end if any sum is nonfinite;
   otherwise `failed` for allocation/share disagreement, or `verified`.

**Result.** The closed
[reserve-draw-binding-verification.schema.json](schemas/reserve-draw-binding-verification.schema.json)
names `state`, optional `reason`, computed `source_digest`, optional
`stated_digest`, ordered `evidence` and typed `issues`. Each edge retains
binding index, currency, allocation, exact draw and expenditure references,
canonical source paths, independently stated draw and gross amounts, declared
funded share, reserve source pointer, expenditure declaration's source pointer,
and copied source block metadata. Cash rows retain authored dates; lease-up
cells retain authored periods with date=null. Never invent a lease-up cash date,
acquisition/disposition interval, owner-cash remainder, transfer, forecast or
release. Findings carry dotted source/plan fields; inventories and edges are
checked before source resolution, then draws, expenditures, edges, draw totals
and expenditure totals in their authored order.

The reference CLI `uwmd verify-reserve-draws <file> [plan.json] [--json]`
returns this result, exits 1 on failed/unverifiable, and 0 on verified or omitted
plan. Ordinary document validation remains unchanged, with no automatic binding
verification. A verifying plan asserts only consistency of declared funding
identity: it does not authenticate gross classification or evidence, admit
reserve-dependent RFC 0045 assembly, bind external transfers, create owner cash,
net expenditure or assemble financing.

---










---

## X. Module Manifest Specification

The canonical schema is
[`spec/schemas/module-manifest.schema.json`](schemas/module-manifest.schema.json).
Implementations MAY validate manifests with any compliant JSON Schema
2020-12 validator (`ajv`, `Validator`, `jsonschema`, etc.).

Required fields: `manifest_version` (always `"1"`), `id`, `name`,
`version`, `description`, `authors`, `license`, `requires_protocol`,
`requires_format`, `requires_conformance`. `requires_profiles` is optional. Both ranges MUST be satisfied by the single admitted Format 3.0 and Protocol 4.1.0 values.

Optional fields are documented in the schema. The TypeScript mirror
type `ModuleManifest` in `protocol.ts` is kept in lockstep.

**Calculation role preferences (RFC 0066).** A `calculations[]` entry MAY
declare `section_roles`, a map from section id to any `_role` except
`component`. It applies only under §VIII.2, to that calculation's reads of a
role-bearing variant map, and an explicit `sectionVariants` entry still wins.
Hosts pass nothing extra: the evaluator reads the map from the declaration. A
host that validates manifests MUST refuse a malformed map rather than ignore it,
because ignoring it changes which block is read. The reference library refuses
it with `PROTO-MOD-079`.

**A registered module must actually run.** Registering a manifest is
not the same as honoring it, and a host that loads a module and then
ignores its `calculations`, `validations`, and `sections` has adopted
nothing. A host that loads modules:

- SHOULD evaluate a module's `calculations` in **declaration order**,
  threading each result into the next as a prior result. Order is the
  author's, and a later calc that reads an earlier one depends on it.
- SHOULD evaluate each `validations[].rule` as a §VIII.1 safe
  expression. A rule asserts what must be TRUE: it reports an issue when
  it evaluates to `false`, and **MUST NOT** report one when it evaluates
  to `null`. `null` is "the inputs are absent" (§VIII.2), and a document
  that does not carry a section has not violated a rule about it.
- MUST NOT introduce an evaluation path a module can reach that the calc
  engine cannot. A rule is a safe expression, evaluated by the same
  sandbox, or it is a second unsandboxed language reachable from a
  third-party manifest.
- SHOULD report a `sections[].required` section that is absent, and
  SHOULD report a rule or calculation that fails to *evaluate* rather
  than silently skipping it. A skipped rule is a rule its author believes
  is protecting them.

**Module ranges.** A module's `requires_protocol` MUST be satisfied by
4.1.0 and its `requires_format` by 3.0. No earlier contract satisfies a
module range, and an unavailable feature never triggers a fallback load.
§VII.2 step 3 is the enforcement: a host refuses a manifest whose ranges
its own versions do not satisfy, with a `ProtocolError` of category
`module` (`PROTO-MOD-030` in the reference library).

**Protocol floor for `is_calendar_date` (RFC 0071).** A module manifest
whose `calculations[].formula` or `validations[].rule` calls
`is_calendar_date` anywhere in its expression **MUST** declare a
`requires_protocol` range that excludes every Protocol version in which
`is_calendar_date` is unavailable. Protocol 4.1.0 is the only contract that
defines it, so the floor is `>=4.0.0` (for example `^4.0.0`). A comparator
that only excludes an earlier label, such as `>3.0.0`, does not meet the
requirement, because a later 3.x label would satisfy it without the builtin.

The range is what lets a host without the builtin decline the module. Under
§VII.2 step 3 that host refuses the manifest, so it never registers a rule
it cannot evaluate. Without the floor, it would load the module and report
each such rule as a failure to evaluate (`CALC-RESOLVE-001`) on every
document.

**Protocol floor for modules that override (RFC 0074).** A module manifest
that redeclares a section ID, calculation ID or view-model `section_id`
declared by a module it names in `depends_on` uses the §VII.3 override
rules. It **MUST** declare a `requires_protocol` range that excludes every
Protocol version without those rules. Protocol 4.1.0 is the only contract
that carries them, so the floor is `>=4.0.0`. As with `is_calendar_date`, a
comparator that only excludes an earlier label does not meet the
requirement. A host without the §VII.3 override rules runs both
declarations and may accept a module set §VII.3 refuses, so calculation
outcomes and validation behavior can differ; the floor keeps such a host
from loading the module at all.

Neither floor adds a loader check or an error code: §VII.2 step 3 is the
enforcement. A manifest that violates either requirement is
non-conforming, and a host is not required to detect the violation.

Section `schema` fragments are normative JSON Schema. A host holding a
JSON Schema validator SHOULD apply them; one that does not is still
conforming, and the reference library is in the second category by
design (§Layering — `@uwmd/core` takes no validator dependency).

Third-party modules are declarative extensions. Every official asset class is builtin; none requires an official module.

### X.1 Module signatures (RFC 0002)

A module manifest is executable surface. Its `calculations` carry
formulas the calc engine evaluates, and its `validations` can decide
whether a deal reads as blocking or advisory. A host that loads one
from npm, a URL, or a colleague's directory has no built-in way to
ask whether it is the manifest the author published.

`ModuleManifest.signature` gives it one. The canonical schema is
[`module-signature.schema.json`](schemas/module-signature.schema.json).

**Advisory by construction.** The protocol does not require anyone to
sign, or anyone to check. It fixes what "signature valid" *means*, so
that two conforming hosts reach the same verdict on the same manifest;
what to *do* about an unsigned or invalid module is host policy
(§X.1.4).

#### X.1.1 What is signed

The signature input is the RFC 8785 canonical JSON of the manifest
with `signature` **removed** — removed rather than set to `null`, so
signing a manifest and verifying it afterwards see byte-identical
input.

Every other field is covered, including `depends_on`. A module's
dependencies are part of what its author published, and leaving them
out would let an attacker redirect a signed module at a different
dependency without breaking the signature.

#### X.1.2 Wire format

| Field | Type | Required | Meaning |
|---|---|---|---|
| `scheme` | `"uwmd-keystore"` | yes | Signing scheme. See below. |
| `alg` | `"ed25519"` \| `"es256"` \| `"es384"` | yes | Same closed set as §V.11. ECDSA is raw `r \|\| s`. |
| `kid` | string | yes | Key identifier the host resolves in its own key store. |
| `sig` | string | yes | Signature bytes, base64url, unpadded. |
| `signed_at` | string | yes | ISO 8601 instant the signature was produced. |
| `identity` | string | no | Identity the signer claims. **Advisory** — see §X.1.5. |

`uwmd-keystore` is the one scheme this protocol implements: a detached
signature verified against a key store the host holds, reusing the
block-signature machinery of §V.11 rather than inventing a second one.

`sigstore` is **reserved and unimplemented**. Keyless signing needs a
Fulcio trust root and a Rekor inclusion proof, which means either a
vendored root snapshot with a release-cadence obligation or network
access at verification time. Neither fits a protocol whose conformance
corpus is offline and deterministic. The `scheme` discriminator exists
so that adding it later is additive rather than breaking.

#### X.1.3 Verification verdicts

A host that verifies MUST distinguish these five outcomes. They are
listed with the error codes the reference implementation emits.

| Code | Reason | Meaning |
|---|---|---|
| `PROTO-MOD-068` | `missing` | The manifest carries no `signature`. |
| `PROTO-MOD-069` | `unsupported_scheme` | `scheme` names something this host does not implement. |
| `PROTO-MOD-070` | `malformed` | `signature` is present but not a well-formed `ModuleSignature`. |
| `PROTO-MOD-071` | `unknown_key` | `kid` names a key the host's store does not hold — including the case where the host has no signature backend at all. |
| `PROTO-MOD-072` | `invalid` | The signature did not validate over the canonical manifest. |

Three of these must not be collapsed into one another, because they
call for three different responses:

- **`missing`** — nothing was claimed. The host decides a policy.
- **`unknown_key`** — something was claimed and this host cannot
  check it. The host loads a key.
- **`invalid`** — something was claimed and it is false. The host
  rejects the module.

A verifier that reports all three as "signature failed" makes them
indistinguishable at exactly the point where the operator has to act.

`malformed` is separate from `invalid` for the same reason: telling an
author their manifest was tampered with, when the real problem is a
missing `signed_at`, sends them hunting for an attack that never
happened. A manifest carrying a malformed `signature` is refused by
structural validation regardless of policy — declining to *verify* is
not a licence to admit nonsense.

#### X.1.4 Host policy

A host's policy is one of:

- **`ignore`** — do not look. What every host did before this section
  existed, and the default.
- **`verify-if-present`** — an unsigned module loads; a bad signature
  refuses. The pragmatic adoption setting: it never punishes an author
  who has not signed yet, and never lets a broken claim through.
- **`require`** — an unsigned module refuses too.

Both checking policies MUST refuse on `unknown_key`. A host that
cannot check a signature has not established anything about the
module, and treating "I hold no key for this" as success would make
the policy decorative.

> A host that declares the `module-signature-verification` capability
> in its `ImplementationManifest` MUST produce the verdicts in §X.1.3
> and MUST NOT load a module that fails verification under its
> declared policy.

Dependency verification is a host decision, not a protocol
requirement. The protocol supplies the verifier; whether to walk
`depends_on` transitively and demand a signature at each hop is
policy.

#### X.1.5 What a signature does not tell you

`identity` is a claim *inside* the signed bytes. A valid signature
proves the holder of that key asserted that identity — never that the
assertion is true. It is worth exactly as much as the host's decision
to bind that `kid` to that identity in its key store, which is an
out-of-band act this protocol does not describe.

A host wanting "only modules from `@example.org`" enforces it with an
allow-list over `identity` *on top of* a trusted key store, and gains
nothing from the allow-list alone.

### X.2 Module-declared asset classes (RFC 0003)

A module may introduce an asset class the standard does not have. The
identifier grammar is format spec §2.2a; this section is **resolution** —
what a host does when it meets one.

#### X.2.1 Declaration

`ModuleManifest.declares_asset_classes` is a list of:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | The namespaced identifier (§2.2a). |
| `display_name` | yes | Human-readable name. |
| `fallback` | no | The closest **builtin**, for readers without this module. |
| `required_sections` | no | Sections this class requires beyond the stage baseline. |
| `optional_sections` | no | Sections this class recognizes but does not require. |

Distinct from `asset_classes`, which names builtin classes a module
*enhances*. A module may do both — declare `com.example.data_center` and
also contribute calculations to `industrial`.

A declaration whose `id` is a builtin is refused at load: that is not an
extension, it is a redefinition, and `asset_classes` is how a module
enhances a builtin. A `fallback` MUST be a builtin — falling back to
another custom class moves the problem one hop and can cycle.

#### X.2.2 Resolution

Given a document's `asset_class`, a host resolves it to exactly one of
three outcomes:

1. **Resolved.** The class is a builtin, or a loaded module declares it.
   The host reads the document fully.
2. **Degraded.** No loaded module declares it, but the host holds a
   declaration carrying a `fallback`. The host MAY render using the
   fallback's view models, MUST report the result as degraded, and MUST
   emit `MOD-FALLBACK-001` (warning). It MUST NOT present the result as
   a full read.
3. **Unresolved.** Neither. The host emits `MOD-MISSING-001` (error).
   The document's `modules` list is what lets it say *what to load*
   rather than only that something is missing.

**Holding a declaration is not holding the module.** A host may know a
class's display name and fallback from a cached declaration or an
operator's configuration; that is enough to degrade gracefully and not
enough to resolve. What "loaded" means is the module's calculations and
validations, and a host that treated a cached declaration as equivalent
would run a document through a class whose rules it does not have.

**Determinism is the contract**, and it holds in all three outcomes:
every host with the module resolves identically, every host without one
and with a fallback degrades identically, every host with neither fails
identically. There is no arrangement in which two conforming hosts read
the same file differently — which is the property that makes opening
this extension point safe, and the reason the enum could not simply be
opened to arbitrary strings.

#### X.2.3 Conflicts

Two loaded modules declaring the **same identifier** is
`MOD-ASSET-CLASS-CONFLICT-001` (error). Reverse-DNS names one owner, so
two declarations mean one module is squatting; a host MUST NOT pick one
silently, because that makes resolution depend on load order.

Two declarations sharing a **display name** is `MOD-DISPLAY-CONFLICT-001`
(info). Two unrelated verticals both calling something "Data Center" is
confusing for a reader and irrelevant to a machine; a host SHOULD show
the identifier alongside the name and otherwise carry on.

#### X.2.4 Third-party custom classes and official builtins

A custom class has no builtin calc pack, no Excel layout, and no entry
in the §XIII size-intensive registry — those tables are keyed to the
official builtin set, which grows by RFC with full standard and starter support (RFC 0080). Every official asset class is builtin; only third-party private or unofficial classes use module declarations. A module supplies its own
calculations for the classes it declares (§X, module runtime); anything
the module does not supply, a custom class does not have.

This is a real limit, not an oversight. Wiring a custom class into the
size-intensive registry would mean a third party could change what
`price_per_unit` divides by, and the per-unit metrics are exactly where
a silent denominator change does the most damage.

---

### Official builtin contracts (RFC 0080, RFC 0081)

Only the twelve builtin ids resolve as builtins. Namespaced suffix shadows, including org.uwmd.data_center, are INVALID-ASSET-CLASS-002. Module lists use object entries; official module ids are ordinary unsatisfied dependencies. No class behavior varies by version or prior packaging. CLS-03/04 and MOD-CALC-ERROR are errors; rules retain declared severities. Hospitality rent_roll requires available_room_nights when stated; optional hotel_metrics holds only market_revpar. CC-HOSP-02 reads `rent_roll.occupancy == null || (rent_roll.occupancy >= 0 && rent_roll.occupancy <= 1)`. Standard class formulas and paths live in spec/metrics/; eleven classes have property-level primary sizes and mixed-use uses component slots. Envelope content is the bare fenced object with nested metadata.

## XI. Error Taxonomy

**Normative schema:** [`spec/schemas/protocol-error.schema.json`](schemas/protocol-error.schema.json).
The TypeScript `ProtocolError` interface in `@uwmd/core/protocol.ts` is a
mirror — implementers in any language SHOULD validate emitted errors
against the JSON Schema.

All protocol-level errors MUST be expressible as a `ProtocolError`:

```ts
{
  category: 'parse' | 'validate' | 'render' | 'edit' | 'calc' | 'agent' | 'module' | 'version'
          | 'package' | 'portfolio',
  code: string,           // e.g. "PROTO-EDIT-001"
  message: string,
  pointer?: string,       // dot-path into the owning input; selected config for §VI.3 errors
  remediation?: string,
  cause?: string,
}
```

Error codes follow `CATEGORY-PREFIX-NNN`. Categories are stable across
versions; specific codes may be added but never repurposed. The
`render`, `edit` and `agent` categories stay registered for the starter
products (§II.4); no tier requires an implementation to emit them.

Validator issue codes are part of this taxonomy. Their registered
families, owning capabilities and remediation-entry schema are
normative in §III.6a, which keeps its section number so existing
references resolve (RFC 0078). RFC0093 adds only P1/P2/P3 to META-01;
its fields, error severity, ordering and admitted-parent suppression are normative
there. RFC0094 adds the closed META-04 present-leaf allocation; RFC0095 adds
closed META-05 optional/override and META-06 conditional/reference allocations,
with readiness-only DQ-06/info. Their exact fields, complete-pass ordering and
admitted-parent suppression are normative in §III.6a. META-01/02/03 and ordinary
issue/ProtocolError transport remain unchanged.

### XI.1 Selected institution-configuration operation errors (RFC0097)

`VAL-INSTITUTION-CONFIG-UNREADABLE` and
`VAL-INSTITUTION-CONFIG-MALFORMED` are category `validate` operation errors.
Their exact conditions/messages, fixed primary precedence, optional config-relative
pointer and error-only JSON/exit1 are defined in §VI.3. They MUST NOT be emitted
as document errors/warnings/issues or change ordinary issue severities/counts.
For unreadable input, obtain a readable selected config; for malformed input,
correct that config's strict profile or indicated canonical carrier/finite leaf.
Do not repair the underwriting document or fall back to another policy.

The `ProtocolError.pointer` authority for these two codes is the selected config,
not a document field. This does not change other codes' pointer authority or the
ProtocolError DTO. Optional cause/remediation may not expose config bytes. Receipts
retain their own input/policy/authentication rules; §VI.3 adds no config dependency.

---

## XII. Versioning and Forward Compatibility

### XII.1 Unknown frontmatter keys

MUST be preserved on round-trip and surfaced to consumers without
error.

### XII.2 Unknown sections

A section ID not in the standard 21 and not in any loaded module
MUST be parsed and surfaced. Validators MAY warn but MUST NOT error.

### XII.3 Format version skew

A Reader MUST refuse absent or non-`"3.0"` uw_version at parse stage with `UNSUPPORTED_FORMAT_VERSION`, naming the declared value and supported value. No partial read, display-only mode or newer-minor tolerance is admitted.

### XII.4 Protocol version skew

A module MUST NOT load unless its requires_protocol range is satisfied by 4.1.0 and its requires_format range by 3.0. No earlier contract satisfies either range.

---

## XIII. Size-Intensive Registry

The normative size registry and its selection rules now live in the
[metric dictionary](metrics/README.md#primary-size-selection), specifically
`size_intensives` in `spec/metrics/builtin.json` (RFC 0078 Phase 2).
`SIZE_INTENSIVES` / `getSizeIntensive()` remain executable mirrors. The
registry originated in RFC 0027 at protocol 1.6.0 (called §XI in that RFC).

### XIII.1 Primary size field

See [primary-size selection](metrics/README.md#primary-size-selection).

### XIII.2 Mixed-use has no property-level size

See [mixed-use and unknown classes](metrics/README.md#mixed-use-and-unknown-classes).

### XIII.3 Unrecognized classes

See [the missing-entry rule](metrics/README.md#mixed-use-and-unknown-classes).

---







---

## XV. Portfolio and Relationship Profiles (optional, RFC 0015)

An optional capability (`portfolio-relationships`) and a JSON sidecar —
`<portfolio>.uwportfolio.json` — carrying typed entities and
provenance-backed relationship edges that span deals: a borrower owns
properties, a property secures a loan, a source document supports a
deal. The sidecar is the portable carrier for the **entity layer** of
the §V edge registry RFC 0018 established (`BUILTIN_EDGE_TYPES`), whose
entity-layer edges `projectPackageLinksToEntityEdges` can already
produce. It is **out-of-band by design**: a sidecar is not part of any
`.uwx.md` file, claims no `_meta` ownership, and changes no record's
canonical bytes.

Schema: `uw-portfolio-profile.schema.json`. Reference surface:
`validatePortfolioProfile`, `uninterpretedPortfolioTypes`,
`getPortfolioRelationships`, `entityEdgesToPortfolioEdges`;
`uwmd portfolio validate|edges`.

### XV.1 Profile shape

- A profile MUST contain `portfolio_version`, `entities`, and `edges`;
  `portfolio_id` is RECOMMENDED. **`portfolio_version` is independently
  versioned** from the format and protocol; this section defines `1.0`.
- Each entity and edge `id` MUST be non-empty and unique within the
  profile (`PORT-006`). IDs are opaque, case-sensitive strings;
  consumers MUST NOT derive identity from an ID's spelling.
- The initial entity types are `property`, `deal`, `borrower`, `loan`,
  and `document`. Extension entity types MUST be preserved and MAY be
  reported as uninterpreted, never refused. A `property` or `deal`
  entity MAY carry `deal_id`, which MUST exactly equal the referenced
  deal's canonical frontmatter `deal_id` when the deal is available.

### XV.2 Edges resolve against the canonical registry

- Every edge MUST have `id`, `type`, `from`, `to`, and a non-empty
  `provenance` array (`PORT-007`/`PORT-009`); `from` and `to` MUST
  resolve to entity IDs in the same profile (`PORT-008`).
- **Edge types come from the §V registry, not from this section.** A
  *known* type not valid on the `entity` layer (e.g. `abstracts`) MUST
  be refused (`PORT-010`) — the one-table-two-layers rule, enforced
  from the sidecar side. An *unknown* type MUST be preserved and MAY be
  reported as uninterpreted. Where the registry declares `from`/`to`
  entity-kind constraints for a builtin edge, a violation MUST be
  refused (`PORT-011`) — checked only when the endpoint's entity type
  is itself registered; an extension entity type is outside the
  constraint's vocabulary, not in violation of it.
- Each provenance entry MUST contain a stable `source` identifier and
  MAY carry `locator`, `note`, or `retrieved_at`. **`source` here is a
  document/source identifier** (the lease-abstract `SourceRef`
  posture), NOT the §V.3/RFC 0031 `_meta.provenance.source` actor grammar.

### XV.3 Update and preservation obligations

- A profile update MUST append provenance evidence or replace the
  affected sidecar as a new version; it MUST NOT silently remove
  provenance from an existing edge. This is an append-only evidence
  rule, not a storage or revision-control requirement.
- An editor making a targeted edit MUST preserve bytes outside the
  edited region, and unknown fields at every level MUST survive
  round-trips (the §XII posture). The reference implementation is
  read-only and carries no editor; this obligation binds
  implementations that write sidecars.

### XV.4 What a profile is not

Hosts MAY store, query, index, or enrich profiles however they choose.
The profile MUST NOT define SQL tables, graph traversal semantics,
aggregate financial calculations, or ownership of host `_meta` fields.
A portfolio that wants to *state* fund-level numbers uses an RFC 0021
composite with rollup receipts; the sidecar stays descriptive.

---

## XVI. Future work (non-normative)

Every RFC accepted through protocol 2.6.0 is implemented (RFC 0001–0038,
excepting 0013). The items below were **named and deliberately deferred**
by an implemented RFC; each records where its design lives so later work
does not foreclose it. None is required for conformance at any tier or
profile, and
each opens as its own RFC under `docs/rfcs/` when taken up. The
maintainable copy of the forward plan is [`ROADMAP.md`](../ROADMAP.md).

- **Combined-hurdle "any" mode and GP-side hurdles** — RFC 0036 shipped
  IRR hurdles with "both must be met" semantics (protocol 2.6.0,
  §VIII.10 step 3); RFC 0051 lifted `hurdle_mode: "any"` (the smaller capacity)
  into the normative contract. `until_gp_irr` remains left out rather than reserved.
- **Clawback / crystallization** — deferred by RFC 0035 and again by
  RFC 0036 (an IRR ladder makes it more pressing: a promote paid on an
  interim hurdle that later un-earns itself); expected to land as a
  terminal true-up tier, not per-period state.
- **Currency-code disambiguation** — deferred by RFC 0001; a
  `currency_code` on monetary values so a deal authored in one locale can
  carry another currency's amounts.
- **Lease-up follow-ons** — RFC 0008 deferred the Excel emit of
  `lease_up_schedule`, its coupling to `dcf`, and defaults-table entries.
- **Portfolio and relationship agent layers (L9 / L10)** — RFC 0015
  shipped the data surface (§XV); reference layers that consume it are
  follow-up work the interchange format did not gate on.
- **Embedding-based corpus retrieval** — RFC 0013 stays a draft by
  decision until an adopter needs semantic (find-similar, risk-pattern)
  retrieval; analytical retrieval is served by the corpus fact table.
- **Investor profile** — interface-only in `@uwmd/core`; excluded from
  RFC 0022 §5 as an institution-private preference set nobody has yet
  asked to exchange.

---

## Appendix A — Self-certification checklist

For the tier and each profile you claim:

- [ ] Run every conformance case whose required capabilities you claim
      (§II.6). Output matches. Publish the skip count with the result.
- [ ] Publish your `ImplementationManifest` (id, version, tier,
      profiles, capabilities, representations, supported asset classes).
- [ ] Document any non-default configuration users must set to
      achieve conformance.
- [ ] Add yourself to the README's "Who's building on it" section
      via PR.

## Appendix B — Reference implementations

- **`@uwmd/verify`** — TypeScript reference: parser, validator,
  expression evaluator, stated-figure verifiers, metric dictionary,
  receipts, integrity, modules and the profiles. Verifier, with all six
  profiles (RFC 0083).
- **`@uwmd/core`** — the starter products on top of `@uwmd/verify`
  (renderer, editor, defaults, cascade, agent host, CLI), which are not
  part of the standard. It re-exports `@uwmd/verify`'s surface; `uwmd
  manifest` reports the pair as one implementation.
- **`tools/web-viewer/`** — Single-file reference Reader and starter
  viewer. Self-contained HTML, no build step.

## Appendix C — Conformance corpus index

See [`conformance/README.md`](../conformance/README.md). Content directories contain fixtures and expected outputs with explicit target ownership (RFC 0081 Phase 5);
directory membership is not a normative signal (§II.6).


## Appendix D — Worked example: a Reader in <500 LOC

The file [`tools/web-viewer/index.html`](../tools/web-viewer/index.html)
is a complete Reader in ~450 lines of HTML/CSS/JS, including
an inline parser, the `BUILTIN_VIEW_MODELS` subset, and the formatter
helpers. It is intended to be read end-to-end as a learning
artifact. Its view models and formatters are starter-product display,
not part of the standard. A worked Verifier example, a consumer that
checks a document with only the metric dictionary and an expression
evaluator, is in [`conformance/metrics/`](https://github.com/UWMD-OSP/UW-Markdown/tree/main/conformance/metrics) (RFC 0078 Phase 2).

## Appendix E — Worked example: authoring a third-party specialty module

A minimal third-party module manifest. Every official asset class,
hospitality included, is builtin (Format §2.2a); a module adds private or
unofficial content on top of one:

```yaml
manifest_version: "1"
id: com.example.specialty
name: Specialty Facility Underwriting Module
version: 0.1.0
description: Adds a private specialty-revenue calculation and benchmark check for industrial assets.
authors: [UW Markdown contributors]
license: MIT
requires_protocol: "^4.0.0"
requires_format: "^3.0"
requires_conformance: verifier
requires_profiles: [module]
asset_classes: [industrial]
calculations:
  - id: specialty_revenue
    label: Specialty revenue
    formula: industrial_inputs.unit_rate * industrial_inputs.occupied_units
    unit: "$"
    deterministic: true
validations:
  - code: CC-SPECIALTY-01
    severity: warning
    message: "Specialty revenue below the stated benchmark."
    rule: "specialty_revenue >= industrial_inputs.benchmark_revenue"
```

## Appendix F — Glossary

- **Block**: a fenced JSON region inside a `.uwx.md` file annotated
  with `uw:section=…`.
- **Canonical block**: the most recent, non-superseded block for a
  given section ID (and variant, if applicable).
- **Layer**: a Bancroft AI agent stage with declared `reads` and
  `writes`. A starter-product term (starter guide §IX).
- **Module**: a declarative manifest extending the standard sections,
  calculations, validations, view models, and/or agent layers.
- **Provenance**: the `_meta` block carried inside every fenced
  section, recording authorship, timestamp, version, and confidence.
- **Profile**: an optional, named verification capability added to a
  tier (§II.3).
- **Reader**: the conformance tier that parses a document and checks it
  is well formed (§II.1).
- **Round-trip preservation**: writing an unchanged region back to
  disk produces byte-identical output (modulo line endings). An editor
  guarantee of the starter products (starter guide §V.1).
- **Starter product**: a reference tool the project gives away on top of
  the standard (calc engine, editor, viewer, Excel exporter, defaults,
  AI agents). Non-normative; see the
  [starter products guide](../docs/starter/README.md).
- **Supersede**: the operation of marking a prior block
  `_meta.lifecycle.superseded: true` and appending a new block with an
  incremented `_meta.lifecycle.revision`.
- **Verifier**: the conformance tier that checks a document is well
  formed, internally consistent and reproducible (§II.2).
- **View model**: a per-section layout description used to render the
  section uniformly across implementations. A starter-product term
  (starter guide §IV).
