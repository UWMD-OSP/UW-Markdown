---
rfc: 0091
title: Allocate the two required metadata boolean diagnostics
status: draft
author: codex
created: 2026-10-17
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0091: Allocate the two required metadata boolean diagnostics

## Status and smallest owner decision

**Draft; no activation.** Issue #354's nine native partial refusals do not
establish nine missing diagnostic allocations. Six cases have accepted owning
errors or fail an existing container-admission precondition. The remaining three
contain six missing required boolean members with no registered diagnostic.

The smallest requested owner decision is whether to allocate `META-02`/error for
`_meta.quality.human_review_required` and `META-03`/error for
`_meta.lifecycle.superseded`, with the precise applicability, precedence and
operation boundaries below. These are validation findings, category `validate`
when represented as Protocol errors; ordinary `ValidationMessage` objects gain
no `category` member. This proposal does not expand `META-01`, the five closed
`META_FIELD_MISSING_<FIELD>` suffixes, or the low-confidence informational rule.
It allocates no generic schema/fallback diagnostic and no release version.

The proposed historical/physical applicability is an explicit new choice for
these two fields, not an automatic extension of RFC0090's actor allocation.
Accepting the final RFC would still require synchronized implementation,
independent verification and governed conformance dispositions before activation.

## Evidence and joint contract

Authority: main `001cc001d36d8b4a219bb6516f40db69d1a8dc34`, including
accepted RFC0090 and the completed #377 correction. Python WIP
`dcc5bd0ad5d859944ed1dfcbe11d2b0f1e367183` remains parse-only and is not
a normative oracle. Its nine actual CLI responses have exit1, preserve sources,
and honestly contain partial validation plus unallocated local evidence; their
uncoded error envelopes do not satisfy ProtocolError's required code/category.

The [existing Reader review](../reviews/2026-10-15-python-reader-354.md#2026-10-17--nine-native-refusals-and-draft-rfc0091)
links exhaustive original-source hashes, all nine responses, independent current
TypeScript findings and read-only Python/Node predicate inventories. Source,
schema, conformance and introducing RFCs jointly establish authority. Schema
rejection does not by itself allocate a validator error or a typed parse refusal.

Format2.5c requires boolean `human_review_required`; Format2.5d requires boolean
`superseded`. The normative block schema states the same required types.
Format3.5's low confidence/review distinction does not remove either type rule.
ProtocolIII.6a allocates only an **informational** low-confidence review finding,
and exactly five missing-field warning suffixes, neither of these booleans.
RFC0090 expressly narrows META-01 to existing wrapper/nested-object admission
and the required actor. Extending it to these booleans would change its contract.

## Exact nine cases and disposition

Paths below are relative to `conformance/`. Their original SHA256 identities and
complete responses are in the linked evidence; no original source is repaired.

| Source | Exact unmet condition | Existing disposition or gap |
|---|---|---|
| `recoveries/reject-cap-without-accumulation/deal.uwx.md` | `tenants[0].recovery_terms.cap.accumulation` absent with stated method/cap.pct | Format4.3 / RFC0058, RFC0081 G1: existing REC-02/error. |
| `recoveries/reject-share-as-percent/deal.uwx.md` | `tenants[0].recovery_terms.pro_rata_share` exceeds1 | Format4.3: existing REC-01/error, fraction in(0,1]. |
| `recoveries/reject-member-without-method/deal.uwx.md` | Non-null recovery member without method; cap.pct also lacks accumulation | Existing REC-02/error at method and accumulation. Do not drop either registered finding or change their order. |
| `documents/malformed/02-low-confidence-no-review.uwx.md` | Property `_meta.quality.human_review_required` and `_meta.lifecycle.superseded` absent | Two genuinely unallocated required boolean conditions. Existing actor error and review info remain separate. |
| `documents/malformed/03-sources-uses-mismatch.uwx.md` | Same two members absent on sources_uses | Same gap; CC-04/actor findings are not substitutes. |
| `documents/malformed/10-property-section-missing.uwx.md` | Same two members absent on debt_structure | Same gap; readiness/actor findings are not substitutes. |
| `documents/malformed/20-flat-meta.uwx.md` | Flat metadata lacks admitted nested provenance/lifecycle; local quality child also absent | Existing META-01/error rejects the metadata container; preserve completeness warnings and local evidence without pretending its children were admitted. |
| `documents/malformed/21-section-id-wrapper.uwx.md` | Retired section_id wrapper; local late-meta observation | Existing META-01/error rejects the wrapper before bare-block metadata admission. This does not allocate late-meta on an otherwise admitted bare block. |
| `documents/malformed/29-actor-shape-precedence.uwx.md` | First physical block is a retired wrapper, with missing/mismatched nested members; second x_actor has empty actor | Existing shape META-01 on first block and actor META-01 on second; all five completeness warnings remain. Never let actor-only failure consume unrelated metadata conditions. |

None of these nine is an unavailable external source or unsupported composition.
Existing `COMP_*` operational refusals and allocated parse errors are distinct.
Composition8 permits unresolved refusal by implementations without composition;
that permission does not license a structural-invalidity fallback code.

The accepted-contract implementation correction can consume only the exact
REC condition already handled by its owning block/tenant loop. Invalid
wrapper/nested-container checks may retain subordinate local evidence without
calling that container admission an unknown diagnostic. Preserve every existing
registered issue and all independent annotations; another error somewhere in
the document is never sufficient. Otherwise well-shaped late metadata,
section disagreement or missing quality object remains a distinct unallocated
requirement, outside this two-boolean RFC.

## Proposed diagnostic contract

| Code | Exact predicate after container admission | Field | Severity |
|---|---|---|---|
| META-02 | `_meta.quality` is an object and `human_review_required` is absent, null or any nonboolean JSON value | `_meta.quality.human_review_required` | error |
| META-03 | `_meta.lifecycle` is an object and `superseded` is absent, null or any nonboolean JSON value | `_meta.lifecycle.superseded` | error |

Literal `true` and `false` both pass. Numbers0/1, strings, arrays and objects do
not. Do not infer a flag from low confidence, actor, revision, a fence annotation,
current routing or a missing schema default. No byte insertion or coercion.

Preserve whole-missing-meta handling and existing wrapper/nested-object shape
precedence. No new child boolean finding on a rejected metadata container.
A missing/nonobject quality object is not reinterpreted as META-02; its separate
required-container diagnostic remains outside this RFC. Preserve all existing
completeness warnings, low-confidence informational findings, actor errors and
unrelated source/role/financial findings. An actor-only META-01 does not suppress
META-02/03. Missing revision still receives its existing warning, not META-03.

After the complete existing shape checkpoint and actor pass, add this pass
before role/period/source checks. Traverse assessed block references in physical
source order, then model-only order; within each block emit META-02 before
META-03. Preserve relative order of every prior registered issue. One finding
per failed field per distinct block reference; equal-valued physical blocks owe
separate findings. Do not deduplicate by section/variant/value/digest.

### Applicability and source/model authority

Proposed fresh-source validation includes **all retained physical blocks**:
current, historical, overwritten, append-only, variants and extensions. Being
unselected does not make required boolean metadata lawful. This does not make
historical financial values current or decide retained-history authority under
RFC0085. The measured difference versus active-only scope is two historical
findings; it must not be hidden as an implementation detail.

Mutable-model validation uses RFC0090's explicit reference-union operation
pattern: parser-retained actual block references followed by supplied model-only
blocks, exact-identity deduplication and the existing sections, superseded,
pipeline_log, custom_calculations, custom_scenarios, extensions traversal order.
A model without that inventory assesses its supplied collections only. Do not
reparse stale `raw`, fabricate omitted physical peers or claim source equality.
Fresh-source conclusions require a fresh parse of the actual operation input.

These diagnostics do not change parser selection or substitute a fence's value
for missing canonical JSON metadata. Malformed lifecycle evidence remains
preserved alongside any existing routing; validation does not repair selection.

## Wider admission audit and expected conformance impact

The separate frozen27-schema audit considered734 sources,725 Python admissions,
1149 current candidate payload subjects and30 history/overwritten/external
contexts.129 whole-object versus126 payload-view rejections are **not**126 new
validator defects: universal annotations, owning class/conditional scope,
existing issue families, negative fixtures and operation boundaries matter.
All22 associated portable validate cases already expect exit1. No general
property schema or new types inferred from illustrative examples are admitted.
The archived complete audit and hashes remain linked from the existing review.

Independent Python and Node two-boolean inventories agree exactly on205 of734
unchanged conformance source documents:943 authored absences (488 review flags,
455 superseded flags), including two historical findings. Active-only scope
would expose941 predicates in the same205 sources. No present malformed value
happens to occur in this corpus slice; explicit negative controls must cover it.
None of the111 actual portable validate source identities is exposed; this does
not establish zero impact on native consumers, receipts or other sources.

An isolated in-memory research hook on the unchanged native runner produces
1090 passes /5 differences /0 updates, versus1095 baseline passes:

- `capital-stack/senior-reconciles-debt-structure`: expected actor-only error set
  would additionally contain META-02/03 on its unchanged sources.
- `standalone/profiles/lease-abstract-v1`, `source-note-v1`, `inline-deal` and
  `externalized-deal`: existing `examples/standalone/*.uwx.md` sources omit
  required review flags; their zero-error admission assertions would fail.

These are five affected **checks**, not a claim that five expected files should
be rewritten. The standalone sources are outside the734 conformance-source
inventory. Before activation, decide and measure their governed examples/source
or assertion dispositions, including dependent identities/package evidence.
Preserve original records. This RFC changes none of those artifacts. The hook
uses placeholder messages and no new registry copy, so it is not a final render
baseline or complete consumer-impact measurement.

## Activation gates and historical consequences

Before owner acceptance/activation: independently verify the two predicates,
full physical/model populations and ordering; run absent/null/every-type and
container/actor/override/source-boundary controls in both implementations;
measure the complete applicable native/portable/producer/receipt consumers;
prepare explicit governed expectations on original sources; synchronize
Format/Protocol/registry/validators/conformance/documentation; and obtain green
exact-final-head and exact-main CI. The current schema already requires both
booleans and must be verified unchanged, not altered for cosmetic lockstep.

Diagnostic-only assessment of the same bytes does not itself change payload,
Envelope or receipt subject digests. Newly issued receipts may have different
validation counts and signing payloads; current receipt verification/preference
rules remain authoritative. Actually editing example metadata may change signed
subjects and must not be described as a harmless expectation change. No old
artifact is rewritten, reissued or authenticated under a new rule. No legacy
verification shim is required by the owner's first-public-baseline policy.

Python discovery stays `capabilities: ["parse"]` until its whole validation gate
and applicable nonportable obligations are proven. Dictionary/calculation,
stated-result and receipt capabilities remain separate. This narrow allocation
does not solve every remaining typed admission obligation. RFC0085/0088/0089
remain separate drafts. No Format/Protocol/package version is allocated, and no
UWMD5.0 tag, release preparation or publication is authorized.
