---
rfc: 0028
title: Make a missing required section a reportable defect
status: implemented
author: jaredmaxey
created: 2026-08-26
accepted: 2026-08-26
implemented: 2026-08-26
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0028: Make a missing required section a reportable defect

> **Accepted 2026-08-26**, with the three review decisions resolved as
> follows: the two-rule design and severities stand as proposed;
> `operating_statement` takes option **(a)** — it joins
> `STAGE_REQUIREMENTS.full_underwrite` (and the stages above it), reviving
> the validator's dead variant-aware `hasSection` case rather than striking
> the spec's claim; and example stage-honesty cleanup is a **tracked
> follow-up** in `docs/wiki/13-status.md`, not part of this RFC's
> implementation.

## Summary

Format spec §4.1 says the `property` section is required at every pipeline
stage, and §5.1 lists the sections each stage requires — but no validator
rule fires when a required section is absent. The only trace is
`stage_readiness`, a block of booleans that says a stage is not ready without
saying why, and that nothing downstream of `overall_status` ever reads. The
result, first recorded when RFC 0027 was scanned: 28 in-scope corpus
documents have no `property` section at all and still validate
`clean`/`warnings`.

This RFC adds two rules. **`CC-14`** (warning) fires when a deal-record UWX
document has no `property` section, unconditionally on stage — the narrow
rule the RFC 0027 spin-off note asked for. **`DQ-06`** (info) names, for the
declared `deal_stage`, each required section that is absent — the
issues-stream mirror of `stage_readiness`, sibling to the field-level
`DQ-04`. It also corrects §5.1's drift from the shipped validator: the table
predates the v1.1 `scope` stage and disagrees with `STAGE_REQUIREMENTS` in
three places.

The severities are set by a fresh corpus scan (Appendix A), and the scan is
why neither rule is an error: 68 of 75 staged corpus documents — including
all twelve worked examples — fail their declared stage's section list,
because `deal_stage` declarations in practice state where a deal *is going*,
not what the file already contains.

## Motivation

Three defects, one root cause: section-level completeness is computed but
never reported.

1. **A missing `property` section is silent.** §4.1: "Required for pipeline
   stage: All stages." Yet 28 in-scope corpus documents omit it and validate
   without a single issue. `CC-13` (RFC 0027) deliberately does not absorb
   this — its applicability list states "a missing section is a different
   defect with a different remedy" — and the spin-off note in
   `docs/wiki/13-status.md` queues this RFC by name.

2. **`stage_readiness` is invisible in practice.** `computeStageReadiness`
   (validator.ts) evaluates `STAGE_REQUIREMENTS` per stage and returns seven
   booleans. Nothing in the issues stream reflects them: a consumer reading
   `issues` / `overall_status` — which is what the CLI exit code, the web
   editor's remediation panel, and the new Tier-1 validation-verdict
   baselines all consume — sees nothing. `DQ-04` closed exactly this gap for
   scope-stage *fields*, and its own comment defers sectional gaps to
   `stage_readiness`; this RFC gives sections the same treatment.

3. **§5.1 has drifted from the validator.** Three disagreements:
   - §5.1 has no **`scope`** row. The stage shipped in the v1.1 train;
     `STAGE_REQUIREMENTS.scope` requires `property` (plus field-level checks
     that `DQ-04` owns).
   - §5.1 requires **`operating_statement`** (T-12) at Full Underwrite;
     `STAGE_REQUIREMENTS.full_underwrite` does not list it. The validator's
     `hasSection` still carries a variant-aware special case for
     `operating_statement` that no stage list reaches — dead code that marks
     where the requirement was lost.
   - §5.1's **Portfolio Monitoring** row adds "updated `operating_statement`
     (annual)" and "re-run `validation`"; the validator's `monitoring` list
     is identical to `closing`. Freshness ("updated", "re-run") is not
     expressible as section presence at all.

## Proposed change

### 1. `CC-14` — the property section must exist (warning)

New row in §5.3:

| Check ID | Description | Sections |
|---|---|---|
| `CC-14` | A deal-record document must have a `property` section (§4.1) (RFC 0028) | `property` |

Normative language, mirroring `CC-13`'s structure:

> **`CC-14` severity and applicability.** `CC-14` is a **warning**, never an
> error: the scan in RFC 0028 Appendix A found 28 corpus documents that a
> refusal would invalidate retroactively, and an institution wanting a hard
> gate expresses it through `INCOMPLETE_DATA_POLICIES`. The rule fires only
> when **all** of the following hold:
>
> 1. The source is a UWX record, not a UW Lite summary.
> 2. The document's profile is a deal record (market-data and other
>    non-deal profiles have no property section by construction).
> 3. The `property` section is not externalized (RFC 0021); an
>    externalized-but-unresolved section is present, not missing.
>
> `CC-14` is unconditional on `deal_stage` — §4.1 requires the section at
> every stage, and every scope-stage corpus document already satisfies it.
> When `CC-14` fires, `CC-13` must not also fire (its precondition 4 already
> ensures this): one defect, one diagnostic.

### 2. `DQ-06` — declared-stage section readiness (info)

For a document declaring `deal_stage: S`, each section in `STAGE_REQUIREMENTS[S].required_sections`
that is absent produces one **info**-severity issue naming the section:

> `DQ-06: full_underwrite requires noi_model; section is missing.`

- Info, not warning: the Appendix A scan shows the corpus treats
  `deal_stage` as aspiration (all twelve worked examples fail their declared
  stage's list), so any nagging severity would either drown real warnings or
  pressure authors into boilerplate sections. Info makes `stage_readiness`
  legible without changing `overall_status`.
- `DQ-06` **suppresses the `property` entry when `CC-14` fires** — the
  warning already names it, and one defect gets one diagnostic.
- Documents with no `deal_stage` produce no `DQ-06` (there is no claim to
  check). This is the same posture as `DQ-04`.
- Escalation is deliberately out of scope: an institution that wants
  stage-readiness as a gate expresses it through `INCOMPLETE_DATA_POLICIES`
  or a module validation, and a future RFC can revisit once the corpus's
  own stage declarations are honest (see Unresolved questions).

### 3. §5.1 alignment (errata-grade, but bundled here for one review)

- Add a **Scope** row: `property` (field-level requirements are §III.6a /
  `DQ-04` territory).
- Annotate the Full Underwrite row: `operating_statement` (T-12) remains
  the documented *institutional* expectation, but the machine-checked list
  (`STAGE_REQUIREMENTS`) is normative for `DQ-06`, and it does not include
  `operating_statement` today. **Decision requested from review:** either
  (a) add `operating_statement` to `STAGE_REQUIREMENTS.full_underwrite`
  (the validator's variant-aware `hasSection` is already built for it), or
  (b) strike it from §5.1. The author leans (a) — the dead code is evidence
  it was meant to be checked. Appendix A quantifies the blast radius of (a):
  it adds one missing-section entry to 47 `full_underwrite` documents'
  `DQ-06` output and changes no verdict, because `DQ-06` is info.
- Rewrite the Monitoring row to separate **presence** (checkable: the
  `closing` list) from **freshness** ("updated", "re-run" — not expressible
  as section presence; belongs to `DQ-05` staleness machinery and is out of
  scope here).

### Library changes (`@uwmd/core`, additive)

- `validator.ts`: emit `CC-14` and `DQ-06` per the rules above; export
  nothing new (both ride the existing `ValidationResult`).
- `protocol.ts`: two `BUILTIN_REMEDIATIONS` entries (`CC-14` warning,
  `DQ-06` info) with `spec_ref`s.
- If review chooses (a) for `operating_statement`: one line in
  `STAGE_REQUIREMENTS.full_underwrite`, which also revives the dead
  `hasSection` special case.

## Compatibility analysis

- **Existing `.uw.md`/`.uwx.md` files:** none become invalid. `CC-14` is a
  warning; `DQ-06` is info; neither changes `overall_status` beyond
  `clean → warnings` for the 28 property-less documents — the same class of
  transition RFC 0027 shipped with `CC-13`.
- **Tier-1 Readers:** must surface the new codes (same obligation as any
  §5.3 row). The Tier-1 validation-verdict baselines (added 2026-08-25)
  will show the new codes as explicit diffs — that is the mechanism working
  as designed, not a break.
- **Tier-2/3/4:** untouched; no edit, calc, or agent behavior changes.
- **Modules:** no manifest change. Module-declared validations keep their
  namespace.
- **Receipts / Excel / composition:** untouched — no number moves anywhere.

## Conformance impact

- **Baselines that change (expected, mechanical):** any suite that runs
  `validateUWFile` over a fixture missing `property` or stage-required
  sections gains warning/info entries. Concretely: the three Tier-1
  validation baselines (`01-minimal-screening` and `02-full-multifamily`
  gain `DQ-06` entries; `04-scope-only` gains none — scope requires only
  `property`, which it has), and Tier-1 `malformed` expectations are
  subset-matched, so they absorb the new codes without edits.
- **New fixtures:** a `CC-14` positive (deal record, no property section,
  must warn — and must *not* also emit `CC-13`); a `CC-14` non-fire for a
  market-data profile document; a `DQ-06` positive naming exactly the
  missing sections for a declared stage; a `DQ-06` non-fire for a document
  with no `deal_stage`; an externalized-property document where `CC-14`
  stays silent (precondition 3).

## Reference implementation

- **Files affected:** `packages/uwmd-core/src/validator.ts`,
  `packages/uwmd-core/src/protocol.ts`, `validator.cc.test.ts` /
  `validator.dq.test.ts`, spec §5.1/§5.3, conformance fixtures above.
- **API surface:** no new exports.
- **Test plan:** unit tests for each precondition of `CC-14` (Lite source,
  non-deal profile, externalized section, present section), the
  `CC-14`/`CC-13` mutual-exclusion, `DQ-06` per-stage output including the
  property suppression, and no-stage silence. Conformance as above.

Implementation follows acceptance as a separate PR (the RFC 0027 pattern:
spec, core, conformance can land together — the change is small).

## Alternatives considered

- **Error severity for `CC-14`.** Refuses 28 corpus documents retroactively
  and breaks several conformance scenarios whose expected verdicts assume
  `warnings` at worst. RFC 0027 already litigated this exact question for
  `CC-13` and the same answer holds: the applicability preconditions do the
  discriminating work, and hard gates are institution policy.
- **Warning severity for `DQ-06`.** Fires on all twelve worked examples
  (Appendix A) — the project would be shipping examples that warn, which
  either normalizes warnings or pressures the examples into stub sections
  authored to silence a validator. Info reports the same facts without
  either failure mode.
- **Fold both into one code.** One diagnostic would then need to carry two
  severities and two remedies ("add a property section" vs "your stage
  claim overstates the file"). The registry's design is one code, one
  remedy.
- **Fix `stage_readiness` consumers instead** (e.g. have the CLI print the
  readiness block). Doesn't help any consumer of `ValidationMessage[]` —
  the web editor's remediation panel, the conformance baselines, module
  hosts — and leaves the data outside the one stream the protocol says
  tools must surface.
- **Do nothing.** The status quo the status doc already flags; the 28
  silent documents are the argument against it.

## Unresolved questions

- **Example stage-honesty.** All twelve worked examples declare
  `full_underwrite` and none satisfies its section list (most miss
  `validation`, `borrower_sponsor`, `preliminary_sizing`,
  `market_analysis`). After `DQ-06` lands, the follow-up work item is to
  either add those sections to the examples or restage them — tracked
  outside this RFC. Only once the examples are honest can a future RFC
  reconsider `DQ-06`'s severity.
- **`operating_statement` at Full Underwrite** — decision (a)/(b) requested
  from review, see Proposed change §3.
- **Monitoring freshness** ("updated annually", "re-run") — expressible via
  `DQ-05`-style staleness, not section presence; deferred.

## Prior art

- **RFC 0027 Appendix A** established the scan-before-severity method this
  RFC reuses, and its acceptance note is where this RFC was queued.
- **JSON Schema's `required`** keyword reports each missing property as its
  own instance-path error — the per-section granularity `DQ-06` adopts.
- **CommonMark's spec tests** distinguish "must parse" from "should warn"
  surfaces; UW Markdown's `errors`/`warnings`/`info` triage is the same
  split, and this RFC keeps advisory facts out of the refusal channel.

## Appendix A — corpus scan (2026-08-26)

Method: parse every tracked `examples/**/*.uwx.md` and structured
`conformance/**/*.uw{,x}.md`, keep documents with a `deal_stage`, and diff
their sections against `STAGE_REQUIREMENTS[stage].required_sections` (the
shipped validator tables, all seven stages).

- **75** staged documents. By stage: 47 `full_underwrite`, 16 `screening`,
  7 `scope`, 5 `credit_approval`.
- **68 (91%) fail their declared stage's section list** — 47
  `full_underwrite`, 16 `screening`, 5 `credit_approval`. All 7 `scope`
  documents pass: where the stage claim is modest, the file meets it.
- **28 documents have no `property` section.** Zero are worked examples —
  all are conformance fixtures (tier-3 calc-host `deal.uw.md` files, the
  mixed-use `malformed/` set, three capital-stack scenarios) whose
  `deal_stage: full_underwrite` is boilerplate, exactly as the RFC 0027
  scan characterized it.
- **All 12 worked examples fail `full_underwrite` readiness.** The modal
  gap is `validation` + `borrower_sponsor` + `preliminary_sizing` +
  `market_analysis`; `Parkview-Apts-Glendale-AZ` and `parkview-after-L6`
  miss only `preliminary_sizing`.
- Consequence for severities: an error `CC-14` refuses 28 files; a warning
  `DQ-06` puts every shipped example in `warnings`. The proposal's
  warning/info split is the only assignment under which no example's
  verdict changes and no fixture is refused, while every silent gap becomes
  a named issue.
