---
rfc: 0017
title: Split .uw.md Lite from .uwx.md Extended as distinct source representations
status: draft
author: jaredmaxey
created: 2026-08-08
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0017: Split `.uw.md` Lite from `.uwx.md` Extended as distinct source representations

> **Corrective and retroactive.** The change this RFC describes has already
> shipped. It is written after the fact to close a governance gap, and it records
> that gap honestly in [Process failure](#process-failure) rather than presenting
> the work as if it followed the normal order. The status stays `draft` until the
> project owner accepts it; nothing here should be read as self-approval.

## Summary

Split the single `.uw.md` file type into two named source representations: **UW
Lite** (`.uw.md`), a constrained, human-readable deal summary whose semantics come
from explicit `<!-- uw:path -->` anchors, and **UWX** (`.uwx.md`), the complete
structured underwriting record carrying the full section model, append-only
provenance, and calc inputs. Define a deterministic one-way compiler
(Lite → Envelope → UWX), an explicitly lossy reverse projection (UWX → Lite) that
must report every omitted path, and a detection-and-migration path for legacy
structured `.uw.md` files. This RFC supplies the governance record for
`spec/UW_LITE_SPEC_v1.md`, which shipped citing an RFC number that belongs to a
different proposal.

## Process failure

This section exists because the repo's own rule was broken and the record should
say so plainly.

`CLAUDE.md` states that anything touching `spec/` is normative and requires an
RFC. `spec/UW_LITE_SPEC_v1.md` was published as a normative specification with
**Status: implementation draft under accepted RFC 0015**. Three things were wrong:

1. **RFC 0015 is a different proposal.** `docs/rfcs/0015-portfolio-relationships.md`
   is *"Add portfolio and relationship profiles,"* created 2026-08-05 — before the
   Lite work — and legitimately holds that number. The Lite implementation
   collided with it.
2. **No RFC described the Lite/UWX split at all.** RFC 0014 (multi-format
   interchange) is the accepted RFC nearest in subject matter, but it never
   mentions Lite or UWX; it defines the envelope and codec contract for
   `.uw.json` / `.uw.xml` / CSV. The Lite split rode in without governance.
3. **"Accepted" was asserted, not earned.** No RFC with that content was ever
   reviewed or accepted, so the status line claimed a review that never happened.

`CHANGELOG.md` records the same mistake — *"UW Lite / UWX transition foundation
(RFCs 0015 and 0016)"* — where 0015 was taken and 0016 did not exist. This RFC
takes **0017**, the next free number; the companion [RFC 0016](./0016-verification-receipts.md)
supplies the receipts definition, which matches every existing citation. The
corrected references land with this RFC.

Numbering note: `0012` is an unused gap and is deliberately left unused rather
than backfilled, so that existing external references to RFC numbers keep their
meaning.

## Motivation

The single `.uw.md` type was being asked to do two incompatible jobs.

**A broker or analyst wants to read and hand-write a one-page summary.** That
argues for lean Markdown that looks like a normal document — labels, prose,
bullets — with just enough machine anchoring to extract values reliably.

**An underwriting system needs the complete record.** That argues for the full
section model, append-only provenance, `_meta` integrity chains, calc inputs,
scenarios, and superseded history — which is not something anyone hand-writes or
reads casually.

Serving both from one extension forced a bad trade in every tool: a viewer could
not tell from the filename whether to expect a five-field summary or a complete
provenance-bearing record, and "is this file valid `.uw.md`?" had no single
answer. The concrete symptom was that structured fenced-JSON content and
anchored-summary content are ambiguous when mixed, with no defined resolution.

Separately, the reverse direction was dangerous by default. Exporting a full
record "to Markdown" silently discarded provenance, scenarios, and assumptions.
Users had no way to know what they had just thrown away.

## Proposed change

### Two named representations

Registered in `packages/uwmd-core/src/source-representation.ts`:

| | UW Lite | UWX |
|---|---|---|
| Extension | `.uw.md` | `.uwx.md` |
| Media type | `text/vnd.uwmd.lite+markdown` | `text/vnd.uwmd.extended+markdown` |
| Representation ID | `uw-lite-markdown` | `uwx-markdown` |
| Version | `1.0` | `1.0` |

### UW Lite grammar and canonical form

Specified normatively in `spec/UW_LITE_SPEC_v1.md`. In outline:

- Flat YAML-subset frontmatter; `uw_lite_version` **MUST** resolve to `1.0`.
- Semantics live in anchors (`- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->`),
  never in labels. Labels are presentation only.
- Display values normalize deterministically: `$12,500,000` → `12500000` `USD`;
  `5.50%` → `0.055` `fraction`; `1.25x` → `1.25` `ratio`. Consistent with the
  repo-wide rule that rates are fractions, not percents.
- The tuple `(field-path, period, scenario)` **MUST** be unique.
- A **financial canonical form** (RFC 8785) excludes labels, headings, prose,
  field order, bullet character, whitespace, comma grouping, and equivalent
  numeric spellings; it includes values, units, qualifiers, and additional
  attributes. SHA-256 over its exact UTF-8 bytes gives `sha256:<lowercase hex>`.
- Parsing a canonical rendering **MUST** reproduce the source's canonical form.
- A document with parse errors **MUST NOT** receive a canonical digest or a
  trusted receipt (see [RFC 0016](./0016-verification-receipts.md)).

### The `deal-summary-v1` bridge

Compilation and parsing are separate steps. The compiler validates anchors
against a versioned catalog, applies only spec-declared defaults, and returns a
UW Document Envelope plus a report of mappings, defaults, and issues. It maps
eight aliases (`acquisition.purchase_price` → `valuation.purchase_price`,
`noi.net_operating_income` → `noi_model.net_operating_income`, and so on) and
also accepts direct paths under registered UW sections.

Deliberate refusals, each an error rather than a guess:

- period-qualified fields (`LITE_COMPILE_PERIOD_UNSUPPORTED`) — they need a later
  versioned profile and **MUST NOT** be flattened into an unqualified value;
- non-`base` scenarios (`LITE_COMPILE_SCENARIO_UNSUPPORTED`);
- unit mismatches (`LITE_COMPILE_UNIT_MISMATCH`) — a mapped USD field written as a
  bare number is rejected, never coerced;
- unknown fields (`LITE_COMPILE_FIELD_UNKNOWN`);
- two Lite paths resolving to one envelope target (`LITE_COMPILE_TARGET_CONFLICT`).

The complete original Lite source is retained inside the envelope as the
`x_uw_lite_source` extension, so compiling never destroys the human-authored
document.

### The reverse projection is lossy and must say so

`UWX → Lite` is a named projection, not a round-trip. It **MUST** return an
omission report listing every envelope path the Lite profile cannot carry, and
callers **MUST** surface that before writing. `Lite → Envelope → UWX` is
deterministic for supported constructs; the reverse **MUST NOT** be described as
model-fidelity round-tripping.

### Legacy detection

During the transition, structured fenced-JSON content using the legacy `.uw.md`
extension is detected as UWX and remains readable with a migration warning. A
byte-identical sibling `.uwx.md` is the default migration output. Mixed Lite and
UWX markers are ambiguous and **MUST** be handled explicitly rather than
resolved by preference.

## Compatibility analysis

This is the section the original omission cost the most, so it is stated bluntly.

**Existing `.uw.md` files — the meaning of the extension changed.** Before this
change, `.uw.md` meant "the underwriting record." After it, `.uw.md` means "the
Lite summary," and existing structured files are legacy content detected by
sniffing rather than by extension. No file becomes unreadable — detection plus
`parseUWXFile` and `migrateLegacyUWMarkdown` preserve access, and migration is
byte-identical — but any tool that assumed *extension implies structure* is
wrong going forward.

This is a **pre-1.0-launch redefinition**, which is the only reason it is
acceptable without a deprecation cycle. Had `.uw.md` been widely deployed, this
would have required a staged migration with a warning period. It should be
recorded as a change that was affordable because of timing, not because it was
small.

**Existing implementers, by tier:**

- **Tier-1 Reader** — must not assume extension implies structure. A reader that
  routes on filename alone will mis-parse Lite files. Readers **SHOULD** use
  `detectUWSourceRepresentation`.
- **Tier-2 Editor** — unaffected for UWX. Editing Lite means compiling to UWX
  first; byte preservation applies to the UWX record, and the retained
  `x_uw_lite_source` is what preserves the original Lite bytes.
- **Tier-3 Calc Host** — unaffected. Calc operates on the envelope, which both
  representations reach.
- **Tier-4 Agent Host** — unaffected, and the AI-never-computes invariant holds
  in both directions: the Lite compiler is deterministic and performs no
  inference. AI may *propose* a Lite document through a separate import
  workflow, but that is outside this grammar.

**Modules** — unaffected. Modules declare sections and calculations against the
envelope, which is representation-neutral.

## Conformance impact

**Existing fixtures needing updates:** none were invalidated.

**New fixtures — already landed** in `conformance/lite/`, wired into
`scripts/run-conformance.mjs` as a named `lite` suite that runs by default:

- `fixtures/` (5) — each must parse with zero errors and compile, freezing the
  canonical form, its digest, the canonical rendering, the compilation report
  plus UWX serialization, and the projection report.
- `malformed/` (12) — every parse-time `LITE_*` code, including a
  `must_parse: false` case asserting the parser throws on unterminated
  frontmatter.
- `compile/` (6) — every `LITE_COMPILE_*` refusal above. The runner fails a
  fixture here that has parse errors, keeping parse and compile failures from
  blurring together.
- `equivalence.json` — fixtures differing only along excluded axes must share one
  digest.

Two properties are asserted as invariants without baselines, so they bind any
implementation: the canonical-rendering round-trip, and display equivalence.

This took the corpus from 26 to 90 assertions. Gap worth naming: **the projection
report is frozen, but there is no fixture asserting that a lossy projection is
*refused or surfaced* by a caller** — that contract lives in the tools, and
tool-level conformance does not exist yet.

## Reference implementation

Shipped. Files:

- `packages/uwmd-core/src/lite.ts` — parser, financial canonicalization, canonical
  renderer, `UWLiteError`.
- `packages/uwmd-core/src/lite-bridge.ts` — `compileUWLite`,
  `projectUWEnvelopeToLite`, `stringifyUWX`, `UW_LITE_FIELD_MAPPINGS`.
- `packages/uwmd-core/src/source-representation.ts` — IDs, media types,
  `detectUWSourceRepresentation`, `migrateLegacyUWMarkdown`.
- `packages/uwmd-core/src/index.ts` / `browser.ts` — exports; the Lite surface is
  browser-safe and reaches the web editor.
- `packages/uwmd-cli` — `convert` / `export` plus representation discovery.
- `tools/web-editor` — opens either representation; Lite imports compile to UWX,
  and Lite export names every omitted path first.
- Sibling `lite.test.ts` / `lite-bridge.test.ts`, plus the conformance suite above.

## Alternatives considered

**Keep one `.uw.md` and switch on content.** This is what the codebase did
implicitly, and it is why mixed content had no defined resolution. Content
sniffing alone gives no stable answer for a file carrying both marker styles, and
it forces every tool to implement the same heuristic identically. Rejected;
sniffing is retained only as a *legacy* path, not the model.

**Make Lite a lossless bidirectional encoding of UWX.** Rejected as dishonest.
Lite cannot represent append-only provenance, superseded history, or per-block
integrity metadata without becoming as complex as UWX, at which point it stops
being the readable summary that motivates it. Better to have a narrow profile
that reports exactly what it drops than a wide one that pretends to round-trip.

**Use a frontmatter discriminator instead of a new extension.** A
`uw_kind: lite | extended` key would avoid a second extension. Rejected because
tools route on extension long before they parse frontmatter — editors, viewers,
content-type negotiation, and OS file associations all decide first. A
discriminator would still leave `.uw.md` ambiguous at every one of those layers.

**Extend RFC 0014 rather than write a new RFC.** RFC 0014 governs *encodings of
one record* (JSON, XML, CSV) — same content, different serialization. Lite is a
different thing: a deliberately smaller *profile* with a lossy projection back.
Folding it into 0014 would blur the accepted guarantee that 0014's codecs are
semantically equivalent. Rejected.

## Unresolved questions

- **Later Lite profiles.** `deal-summary-v1` refuses periods and non-base
  scenarios. Do those arrive as `deal-summary-v2`, or as separately named
  profiles (`operating-v1`)? Naming affects the compiler's catalog lookup and
  should be settled before a second profile exists.
- **Should the Lite spec's §9 receipts reference stay normative** while
  [RFC 0016](./0016-verification-receipts.md) is `draft`? A normative reference to
  a draft is the same class of problem this RFC is correcting. Recommendation:
  soften §9 to informative until 0016 is accepted.
- **Tool-level conformance for loss reporting.** The omission report is verified;
  the requirement that a caller *surfaces* it is not testable in the current
  corpus.
- **`x_uw_lite_source` growth.** Retaining the full Lite source in every compiled
  UWX doubles storage for small deals. Acceptable now; may want a
  reference-by-digest option later.

## Prior art

- **Markdown + front matter profiles** (Jekyll, MDX) — the pattern of one
  readable surface syntax compiling into a richer internal model.
- **OpenAPI vs. Swagger 2.0 extensions** — a cautionary case where one file
  extension carried two incompatible structures and tooling had to sniff.
- **HTML5 vs. XHTML serializations** — two syntaxes over one DOM; the lesson
  taken here is that the shared model must be the normative artifact, which is
  why both representations compile to the UW Document Envelope.
- **RFC 0014** — the envelope and codec contract this builds on.
