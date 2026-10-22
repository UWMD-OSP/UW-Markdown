---
rfc: 0078
title: 'The protocol is verification: separate the standard from the starter products'
status: implemented
accepted: 2026-10-10
implemented: 2026-10-11
author: UWMD maintainers
created: 2026-10-10
affects:
  - protocol-spec
  - format-spec
  - conformance-corpus
  - core-library
  - tooling
---

# RFC 0078: The protocol is verification: separate the standard from the starter products

**Legacy tier readings superseded by [RFC 0081](0081-one-format-one-protocol.md).** The "during 3.x" readability of the Protocol 2.x tier names, D12's file-name deferral and the Phase 3 legacy-id bookkeeping are removed in Protocol 4.0.0. The two-layer design stands.

**Implemented; released in 3.0.0** (Protocol 3.0.0). Written from the
owner's direction of 2026-10-10 (D1–D13). Drafted with AI assistance;
reviewed by maintainers. See [Resolution](#resolution).

## Summary

UW Markdown is two different things that the specs currently treat as one:

1. **The standard**: a document format plus the rules any party uses to
   *verify* a document. It checks that the document is well formed, that its
   stated numbers agree with each other, and that its results reproduce from
   its stated inputs.
2. **The starter products**: tools the project gives away so the standard
   spreads. These are a calc engine, a web editor, a report viewer, an Excel
   exporter, default assumptions and AI agents.

Today the Protocol makes the starter products *normative*. Two of its four
conformance tiers are an editor and an AI-agent host, and a ~1,650-line calc
engine contract is required at Tier 3. Meanwhile the metric definitions that
verification depends on are not normative at all: DSCR is defined only in
library code (`packages/uwmd-core/src/packs/multifamily.ts`), in no spec.

This RFC inverts that. The **standard** is the format, the verification
protocol, receipts, the module system, and a new normative, machine-readable
**metric dictionary** that defines every metric. The starter products become
non-normative reference tools built on the standard. The test for the
boundary: *if Argus, an Excel model or another vendor's tool exported a
`.uw.md`, a lender could verify it using only the standard, with none of our
tools.*

## Motivation

**What the project is for.** UWMD's value is trust between parties who do not
share software: sponsor to lender, lender to credit committee, GP to LP. A
document they exchange must be checkable by the receiver, independent of the
producer's tools. That requires a standard that is small enough for anyone to
implement, neutral enough that no modeling vendor competes with it, and
complete in its definitions.

**What the current specs do instead:**

- **The tool contracts are normative, so implementers face the whole stack.**
  §0.2 defines four strictly nested tiers: Reader, Editor, Calc Host and Agent
  Host. §I.1 says the Protocol specifies "the contract for hosting
  Bancroft-style AI agents". §V (edit semantics, ~760 lines), §VIII (calc
  engine, ~1,650 lines) and §IX (AI host) are all requirements. A lender's IT
  team that only wants to check incoming documents meets a spec that reads
  like the manual for our own products.
- **The definitions verification needs are not normative.** The ten builtin
  calc packs (`packs/*.ts`) are the only definition of DSCR, LTV, debt yield,
  cap rate, cash-on-cash and the rest. A verifier that does not run our
  library cannot know what a stated DSCR is supposed to equal.
- **Opinions sit inside the standard.** The fallback cascade and per-class
  default tables (§V.7–V.8: vacancy, expense ratios) are assumptions, not
  verification. Putting them in the Protocol makes our underwriting opinions
  part of "the standard".
- **Churn.** Calc-engine details live in the Protocol, so the Protocol version
  moved three times in two days (2.23.0, 2.24.0, 2.25.0, 2026-10-08 to
  2026-10-10) for changes that did not alter what any document *means*.
- **It was never chosen.** The 2026-10-10 product-decision audit found no
  owner record selecting this shape. The owner's stated intent is that the
  calc engine and the web/report viewer are simple starter products given away
  on top of the standard, not requirements of verification.

## Owner direction (2026-10-10)

The owner agreed with each proposal below (session of 2026-10-10). D1–D8 were
agreed first; D9–D13 resolved the draft's open questions the same day, each as
recommended. They bind this RFC.

| # | Question | Direction |
|---|---|---|
| D1 | What does "verify" mean? | All three: **well formed** (parses, required fields, valid values), **internally consistent** (stated figures agree with each other under the standard's definitions), **reproducible** (results recompute from stated inputs, as receipts attest). The standard defines and checks numbers; it never produces or projects them. |
| D2 | Do documents carry formulas or numbers? | Metric **definitions** are normative. The expression language is the notation the definitions are written in, and the means our starter engine uses. A verifier may compute a definition any way that reproduces its quantized value. Module-declared metrics are written in the expression language, so verifying them needs an evaluator (see Conformance). |
| D3 | Editing and AI agents | Editor mechanics (Tier 2) and the AI-agent contract (Tier 4) become non-normative starter-product guidance. Only what protects verification stays normative: append-only provenance, supersede-not-destroy, `_meta` authorship, canonical block JSON, integrity chains, signatures. |
| D4 | Defaults, cascade, gap ranking, refinement | Starter product, not standard. |
| D5 | "Equal to multifamily" | Applies in both layers: every official asset class has full standard support (class id, size metric, required sections, metric definitions, verification rules) **and** full starter support (calc pack, Excel layout, defaults, example). |
| D6 | Excel ↔ engine parity | A quality bar for the Excel starter product, not a Protocol requirement. The dictionary keeps them on one set of definitions. |
| D7 | Levered and after-tax returns | "In the standard" means fields, canonical definitions and verification of stated figures. Computing them from loan terms or tax law is starter-product or vendor work. |
| D8 | Packaging | Split later: a small `@uwmd/verify` reference implementation of the standard, with `@uwmd/core` as the starter toolkit on top that still re-exports it. Separate follow-up. |
| D9 | Sensitivity tables (§VIII.7) and stochastic results (§VIII.8) | Optional **verification profiles** in the standard: a document that states a sensitivity grid or a seeded distribution must be reproducible, so the grid rules and the exact sampler (PCG64, RFC 0005) stay normative for those profiles. Authoring sensitivities and simulations is starter-product work. |
| D10 | Capability tokens (§XIV) | **Starter guide.** They govern what tools may write, not how a document is verified. Signatures (§V.11) stay normative. |
| D11 | Display conventions (§III.1 number formatting, §III.1a locales) | **Starter guide.** Verification is defined over values; display strings carry no meaning. §III.1b currency identity and §III.6a code taxonomy stay normative. |
| D12 | Spec file naming | Keep `UW_PROTOCOL_v1.md` during 3.0 so links do not break; retitle it "UW Protocol — verification"; rename in a later editorial pass. |
| D13 | Starter products' versioning | Package semver only. There is no starter-spec version. |

Related principles recorded the same day (maintainers' process file):
scope is completeness-driven, not demand-gated; earlier "closed / never"
scope bans are backlog, not binding; levered and after-tax returns belong in
the standard.

## Proposed change

### 1. Two layers

**The standard (normative).** Made up of:
- `UW_FORMAT_SPEC_v1/v2` (bytes, sections, validation rules), unchanged in
  status.
- The verification parts of the Protocol (below).
- `UW_RECEIPT_v1`.
- The new metric dictionary.
- The representation specs (`UW_LITE_SPEC_v1`, `UW_XML_MAPPING_v1`,
  `UW_CSV_BUNDLE_v1`, `UW_COMPOSITION_v1`) and the optional
  HTTP/MCP bindings, unchanged in status.

**Starter products (non-normative).** These are the reference tools: the
evaluator implementation and packs as code, defaults and the cascade,
refinement and gap ranking, the editor (web editor, VS Code extension, edit
API), the viewer and report renderer, the Excel exporter, Bancroft agents,
and CLI convenience commands. Their behavior moves to a non-normative
**Starter products guide** (`docs/starter/`), keeps its test suites, and can
change without a Protocol version.

### 2. Disposition of the current Protocol, section by section

| Current section | Disposition |
|---|---|
| §0 Front matter, §I Scope and Conformance | **Rewritten**: the standard is verification. New scope statement and the boundary test above. §I.5 representation negotiation stays normative (exchange). |
| §II Capability Tiers | **Rewritten** (see Conformance impact): Reader and Verifier, plus optional verification profiles. Editor, Calc Host and Agent Host are retired as Protocol tiers. §II.6a conformance CLI protocol stays (it runs the verifier corpus). |
| §III Display conventions | **Starter guide** (D11), except §III.1b document currency identity (format semantics) and §III.6a validator code taxonomy, which move under §XI Error taxonomy. |
| §IV View models | **Starter guide.** |
| §V Edit semantics | **Split.** Normative: §V.2 replace vs supersede, §V.3 source authority, §V.4 `_meta` authorship, §V.9 canonical block JSON, §V.10 integrity chains, §V.11 signatures, §V.12 replacement-funding verification. Starter guide: §V.1 byte-preserving round trip, §V.5 multi-variant edits, §V.6 frontmatter update rules, §V.7 fallback cascade, §V.8 default tables. Integrity hashes are computed over canonical JSON (§V.9), not raw bytes, so byte preservation is an editor guarantee, not a verification requirement. |
| §VI Extensibility, §VII Module system, §X Module manifest | **Normative**: how third parties extend the standard. |
| §VIII Calc engine contract | **Split.** Normative: §VIII.1 grammar, §VIII.2 variable resolution and §VIII.3 built-in functions as the *notation* of the dictionary and of module metrics; §VIII.4 determinism; §VIII.5 numeric model (binary64, half-away-from-zero quantization); §VIII.6 error taxonomy; the stated-figure verifiers §VIII.9 (cash flows), §VIII.9.6 (assembly), §VIII.10 (waterfall), §VIII.11 (reserves), §VIII.12 (draw binding); the IRR procedure. Starter guide: §VIII.2b refinement and §VIII.2c workbook bindings. §VIII.7 sensitivity and §VIII.8 stochastic: **normative optional verification profiles** (D9). |
| §IX AI Host Contract | **Starter guide.** Invariant 1 ("AI never does financial math; agents never invent values") stays a project rule for every tool, and the standard keeps its "MUST NOT be inferred" field rules. |
| §XI Error taxonomy, §XII Versioning | **Normative.** |
| §XIII Size-intensive registry | **Normative**, moves into the metric dictionary. The "closed for protocol 1.x" wording is removed (stale, and contrary to principle 1). |
| §XIV Capability tokens | **Starter guide** (D10). |
| §XV Portfolio profiles | **Normative, optional profile** (descriptive data exchanged between parties). |
| §XVI, Appendices | Updated to match. Appendix D's "Tier-1 Reader in <500 LOC" becomes a reader-and-verifier example. |

### 3. The metric dictionary (new, normative)

`spec/metrics/` holds one machine-readable entry per metric, validated by
`spec/schemas/metric-dictionary.schema.json`. Each entry carries:

- `id` and `label`;
- the asset classes it applies to (or all);
- the `formula` in §VIII.1 notation, with input paths;
- `unit` and `round_to`;
- the section role preferences (e.g. `debt_structure: senior`);
- null semantics (what an absent input yields).

Normative rule: a Verifier MUST reproduce each dictionary metric's quantized
value (§VIII.5) for a document's stated inputs, by any method. A stated value
that disagrees after quantization is a verification failure; a metric whose
inputs are absent is `unverifiable`, not failed.

**First content is an extraction, not a redesign.** The dictionary starts as
the metrics the ten builtin packs and the size registry already compute,
moved over with no change in meaning. A test asserts that every pack is
generated from, or identical to, its dictionary entries, so the starter engine,
the Excel exporter and any verifier cannot drift. Adding or changing a
definition after that is an RFC, as any normative change is.

The dictionary is where completeness lives. Later RFCs fill it: every official
asset class (principle 1), levered and after-tax definitions (D7), and the
reopened backlog items from the audit.

### 4. Versioning

- **Protocol 3.0.0.** Retiring three conformance tiers and changing the
  `ImplementationManifest` tier vocabulary is breaking for conformance claims.
- **Format unchanged** (2.0). No document changes meaning or validity.
- After 3.0, the Protocol version moves only when what a document *means* or
  how it is *verified* changes. Starter-product changes version their
  packages only.

## Compatibility analysis

- **Existing `.uw.md` files.** None become invalid; none change meaning. The
  dictionary is an extraction of current pack semantics.
- **Existing implementers:**
  - *Tier-1 Readers* stay conforming Readers.
  - *Tier-3 Calc Hosts* that reproduce the builtin metrics become conforming
    Verifiers. Any that also evaluate module calculations claim the Module
    profile.
  - *Tier-2 Editor* and *Tier-4 Agent Host* claims become starter-product
    compatibility claims, outside the Protocol.
  - One adopter is the only known external claimant.
- **`ImplementationManifest`.** The `tier` enum changes to `reader` /
  `verifier` with a `profiles` list. During 3.x the four old values stay
  readable and are mapped with a deprecation warning: tier-1 → reader,
  tier-3 → verifier, tier-4 → verifier (2.x Tier 4 included Tier 3), tier-2 →
  reader; the editor and agent-host claims become non-normative product notes.
- **Modules.** No manifest change. A verifier without an evaluator reports
  module metrics `unverifiable`, never wrong.
- **`@uwmd/core` API.** No breaking change in this RFC; the package split (D8)
  is a follow-up with re-exports.

## Conformance impact

- **New tier model:**
  - **Reader:** parse and well-formedness, i.e. today's Tier 1, unchanged.
  - **Verifier:** Reader, plus the Format validation rules, plus reproduction
    of every dictionary metric, plus the stated-figure verifiers, plus receipt
    verification.
  - **Optional profiles:**
    - **Module:** evaluate module-declared formulas.
    - **Integrity:** chains and signatures.
    - **Representations:** Lite/XML/CSV.
    - **Portfolio.**
    - **Sensitivity** and **Stochastic** (D9): reproduce stated grids and
      seeded distributions.
- **Corpus.** `conformance/tier-1-*` and the verifier-relevant tier-3 fixtures
  become the Reader and Verifier corpora. Tier-2 and tier-4 fixtures move to
  starter-product test suites under `docs/starter/` ownership, still run in CI
  but no longer conformance.
- **New fixtures:**
  - dictionary schema validation;
  - pack ≡ dictionary for all ten classes;
  - a verifier-only consumer that checks a document with no pack or engine
    code, only the dictionary and an expression evaluator, against every
    builtin example. This is the "a lender with only the standard" test.

## Reference implementation

In phases, each its own PR once this RFC is accepted:

1. **Spec restructure.** Protocol 3.0 text: rewrite §0, §I and §II; move the
   starter sections to `docs/starter/` with a pointer table; update the
   implementation-manifest schema, `protocol.ts` tier types and their
   mirror tests.
2. **Metric dictionary.** Create the `spec/metrics/` entries and schema by
   extraction from `packs/*.ts` and `SIZE_INTENSIVES`, add the pack ≡
   dictionary test, and add the verifier-only consumer fixture.
3. **Corpus re-tiering** and the conformance CLI's tier names.
4. **Project docs:**
   - AGENTS.md: invariant 4 (Excel parity) becomes a starter-product quality
     bar.
   - Add "the standard vs the starter products" to orientation.
   - Wiki 04/05/10/11 and docs site (Standard vs Tools navigation).
5. **Release.** Protocol 3.0.0 with the next core release. Release
   preparation pairs Protocol 3.0.0 with core/CLI 3.0.0 and Format 2.1
   (RFC 0080). Released in 3.0.0.
6. **Follow-up RFCs:** `@uwmd/verify` package split (D8); asset classes as
   full builtins (principle 1, including data center and manufactured
   housing); levered and after-tax definitions (D7).

## Alternatives considered

1. **Keep the four nested tiers.** It is the current state and needs no
   work. Rejected: it keeps the standard's adoption cost at "build our whole
   product", keeps our assumptions inside the standard, and still leaves the
   metric definitions non-normative.
2. **Protocol = format only.** No definitions, no verification rules.
   Rejected: a receiver could check structure but not whether a stated DSCR
   is right, which is the trust the project exists to provide (D1).
3. **Definitions in prose only, no machine-readable dictionary.** Rejected:
   prose and code drift. That is exactly how DSCR ended up defined only in
   code. One machine-readable source keeps the verifier, engine and Excel on
   the same definitions.
4. **Move the starter products to separate repositories now.** Rejected for
   now: the boundary should be drawn in the specs and packages first. A repo
   split can follow if it helps (the D8 package split is the first step).

## Unresolved questions

None. The five questions the first draft left open (sensitivity and
stochastic results, capability tokens, display conventions, spec file naming,
starter-product versioning) were resolved by the owner on 2026-10-10 as
recommended; see D9–D13.

## Resolution

**Accepted 2026-10-10 (PR #298); implemented 2026-10-11; released in 3.0.0**
with Protocol 3.0.0 (Stable), Format 2.1 and core/CLI 3.0.0. The decisions
are D1–D13 under [Owner direction](#owner-direction-2026-10-10). Implementing
PRs: #300 (spec restructure), #299 (metric dictionary), #304 (corpus
re-tiering), #303 (project docs) and #305 (release preparation). The
follow-up RFCs in item 6 were left to their own RFCs. RFC 0081 later removed
the legacy tier readings and legacy-id bookkeeping noted below.

**Metric dictionary.** The [metric dictionary](../../spec/metrics/README.md)
is an extraction of the builtin calculations and primary-size selectors with
no change of meaning (D1–D3):

- one class-scoped entry per existing pack declaration, including mixed-use
  components; formulas, paths and labels are not reconciled across classes;
- packs and their Excel bindings stay TypeScript declarations and must equal
  the dictionary exactly, in both directions;
- each entry states its current unit-derived `round_to` explicitly and uses
  the existing expression null/refusal semantics, including lazy cash-on-cash
  selection, with no new tolerance or fallback (Protocol §VIII.1, §VIII.2,
  §VIII.5; RFC 0066);
- size quantities are selector entries with `round_to: null`, raw
  finite-number semantics and the existing secondary-path metadata (RFC 0027
  selects raw stated quantities without quantizing or inferring a
  denominator);
- the [lender fixture](../../conformance/metrics/README.md) binds example
  statements through a fixture-only map (canonical output fields, explicit
  existing field aliases, Lite anchors and size selectors), which creates no
  normative alias contract; it freezes per-statement disagreements as
  findings rather than correcting the examples or the definitions;
- adding the dictionary changed neither Format nor `PROTOCOL_VERSION`.

**Corpus ownership.** The [runtime corpus index](../../conformance/corpus-index.json)
tags each reference case with exactly one owner; fixture paths, assertions
and expected outputs were unchanged. Review added five validate-only Verifier
checks, for 1,061 reference checks and 332 portable cases:

| Owner | Reference | Portable |
|---|---:|---:|
| reader | 23 | 16 |
| verifier | 679 | 280 |
| module | 68 | 1 |
| integrity | 15 | 0 |
| representations | 134 | 0 |
| portfolio | 14 | 0 |
| sensitivity | 5 | 0 |
| stochastic | 7 | 0 |
| starter-products | 116 | 35 |
| **Total** | **1,061** | **332** |

The lender-only fixture reported 187 verified / 0 failed / 0 unverifiable.
The ownership rules:

- **Spec text wins** over reviewer intuition (owner ruling, 2026-10-11): a
  case testing something §II.2 lists as a Verifier requirement is
  Verifier-owned. Cases that need expression evaluation keep
  `requires_capabilities: ["calc-evaluate"]`, so a Verifier that does not
  claim it skips them rather than failing (§II.6a.5).
- A check that also asserts editing, rendering, defaults/cascade, authoring,
  projection or refinement stays a starter-product check in full; assertions
  are not removed to claim standard coverage (D3–D6, D10–D11).
- Exact dictionary reproductions (id, formula and unit equal a
  `spec/metrics/builtin.json` entry) are Verifier. That includes nine former
  Module cases (land usable-land ratio, self-storage economic occupancy,
  senior-housing care-revenue ratio, student-housing pre-lease rate and five
  mixed-use cases) and `dscr-from-section` (the dictionary `dscr` formula and
  unit under the id `implied_dscr`); an independent re-scan of all 97 suite-3
  calcs found no other exact match. Custom declarations, manifests, the
  registry and the runtime are Module; the custom ADR × occupancy
  `revpar-basic` is not a second standard RevPAR definition and stays Module.
- IRR cases `irr-01`…`05` are Verifier (§II.2 item 3).
- Expression-notation cases are Verifier with `calc-evaluate` required:
  `date-01`…`48` pin the §VIII.3 `is_calendar_date` built-in, `period-01`…`12`
  the §VIII.1/§VIII.2a period grammar (including the same-day selection the
  cash-flow verifier mirrors), and `variant-01`…`11` the §VIII.2 resolution of
  the role-bearing `debt_structure` map that every dictionary `ltv`/`dscr`
  entry reads through its `section_roles` (§II.2 item 6).
- The no-stack capital-stack pins (`no-stack-single-loan`,
  `gd05-total-equity`) are Verifier: they assert the absence of `CS-*` codes
  and dictionary multifamily metrics.
- Registered codes inside mixed starter checks are covered by five added
  `<scenario> [validate]` Verifier cases for `CUR-01`, `LOC-01`, `SRC-01`,
  `POL-01` and `POL-02`. Each reuses its fixture; its baseline is the
  validator's `overall_status` and `(code, severity)` pairs (plus
  `provenance` pairs for the POL cases), and the source case's required code
  must also appear. They are reference-only (§II.6a.1 `validate` takes no
  policy input).
- Lite compilation cases (`lite [compile-report]`, `lite [uwx]`,
  `lite/compile/01`…`06`) and the package context invariants are
  Representations (UW_LITE_SPEC_v1 §8; RFC 0018 §3–§5);
  `no-member-only-projection` stays a starter check.
- Dispatch fails closed: a runner suite with no index rows, or an indexed
  suite with no runner, is a coverage error.
- Verifier selection includes Reader; profiles and starter products are
  explicit selectors, and named fixture families use `--suite`.
- The default run executes every reference check, including the three
  formerly opt-in shapes, and reports counts by owner.
- Cases of unclaimed profiles report `unverifiable`, distinct from capability
  skips; `--no-skip` rejects an incomplete certification run without calling
  an unsupported profile a wrong result (§II.3; RFC 0030).
- Baseline updates are permitted only for full runs or complete fixture
  families (including child suites). Unknown owners, duplicate results,
  missing results and portable identities without an indexed owner are
  refused (§II.6a.3).
- Starter checks belong to `docs/starter` and remain blocking CI checks.

**Project docs.** The invariants keep their numbers (source comments and RFCs
cite them) and each is labelled with its layer. Starter-product invariants
(3, byte preservation; 4, Excel parity) still block a PR. A starter-product
change needs no RFC and no Protocol version, but needs tests, a CHANGELOG
entry, package semver and maintainer sign-off on any number; a new or changed
metric definition is a dictionary change and needs an RFC (§3). On the docs
site the Receipt spec, the representation specs and the HTTP/MCP bindings sit
under **Standard**, issuing receipts with the CLI sits under **Starter
products**, and the module system links to Protocol §VII.

## Prior art

- **XBRL.** The specification defines the document format and validation.
  *Taxonomies* define the concepts and their calculation relationships, which
  is the closest analogue to the metric dictionary. Filing software and
  viewers are products built on top, and none of them is part of the
  standard.
- **HTML and browsers, JSON Schema and validators.** In both, the spec defines
  what documents mean and how to check them, and any number of independent
  tools implement it.
