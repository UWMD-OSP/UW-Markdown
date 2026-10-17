---
rfc: 0091
title: Allocate the two required metadata boolean diagnostics
status: accepted
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

## Acceptance and scope

**Accepted by the owner, 2026-10-17; implementation unreleased.** The owner
supplied this decision after reviewing the bounded implementation and six
new-kit declarations:

> Owner decision (2026-10-17): RFC 0091 goes to acceptance. I've reviewed the six review declarations in the authored-2026-10-17 kit and accept them as written.

The owner also required:

The initial integration required exact-head CI and an artifact freeze. The later
owner rule below retires that prelaunch retention requirement; normal CI remains.

The synchronized implementation is integrated on main; normal
integration review, exact-final-head CI and subsequent exact-main verification
remain required. Acceptance allocates no release version and authorizes no tag,
npm publication or public launch.

Issue #354's nine native partial refusals do not establish nine missing
allocations. Six cases have accepted owning errors or fail an existing
container-admission precondition. Three contain six missing required boolean
members. This RFC allocates `META-02`/error for canonical
`_meta.quality.human_review_required` and `META-03`/error for canonical
`_meta.lifecycle.superseded`, with the applicability, precedence and operation
boundaries below. These are category `validate` when represented as Protocol
errors; ordinary `ValidationMessage` objects gain no `category` member.
It does not expand `META-01`, the five closed `META_FIELD_MISSING_<FIELD>`
suffixes or the low-confidence informational rule, and allocates no generic
schema/fallback diagnostic.

## Decisions

| Decision | Accepted contract | Basis |
|---|---|---|
| D1 | META-02/error and META-03/error for the two already-required canonical boolean members; literal true/false only | Owner decision; existing Format/schema types |
| D2 | Existing container/actor precedence, independent findings and exact field attribution; flags pass follows shape/actor and precedes role/period/source | Independently reviewed bounded implementation |
| D3 | All retained physical blocks, including history, plus explicit mutable-model identity union | Owner-approved operation boundaries; no history-authority decision for RFC0085 |
| D4 | Governed diagnostic expectations and authored positives; no ongoing prelaunch artifact freeze | Six declarations accepted; later2026-10-17 owner rule retires retention work |
| D5 | Activation can change validation exits and newly issued receipt policy counts; no source or historical-subject repair | Explicit owner activation decision; existing receipt rules |
| D6 | No prelaunch version recommendation;4.x.x development and coordinated npm5.0.0 launch | Later2026-10-17 explicit owner rule |

## Evidence and joint contract

Authority: main `001cc001d36d8b4a219bb6516f40db69d1a8dc34`, including
accepted RFC0090 and the completed #377 correction. Python WIP
`dcc5bd0ad5d859944ed1dfcbe11d2b0f1e367183` remains parse-only and is not
a normative oracle. Its nine actual CLI responses have exit1, preserve sources,
and honestly contain partial validation plus unallocated local evidence; their
uncoded error envelopes do not satisfy ProtocolError's required code/category.

The [existing Reader review](https://github.com/UWMD-OSP/UW-Markdown/blob/90ee5217af8e430db7a1a4e737bda76e6991598f/docs/reviews/2026-10-15-python-reader-354.md#2026-10-17--nine-native-refusals-and-draft-rfc0091)
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

## Accepted diagnostic contract

| Code | Exact predicate after container admission | Field | Severity |
|---|---|---|---|
| META-02 | `_meta.quality` is an object and `human_review_required` is absent, null or any nonboolean JSON value | `_meta.quality.human_review_required` | error |
| META-03 | `_meta.lifecycle` is an object and `superseded` is absent, null or any nonboolean JSON value | `_meta.lifecycle.superseded` | error |

Literal `true` and `false` both pass. Numbers0/1, strings, arrays and objects do
not. Do not infer a flag from low confidence, actor, revision, a fence annotation,
current routing or a missing schema default. No byte insertion or coercion.

Preserve whole-missing-meta handling and existing wrapper/nested-object shape
precedence. No new child boolean finding on a rejected metadata container.
A missing/nonobject quality object suppresses only META-02, unless the exact
existing wrapper/nested-object predicate already rejects the whole container.
Other admitted parents, actor and independent findings remain assessed. Its separate
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

Fresh-source validation includes **all retained physical blocks**:
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

These were five affected **checks**, not five automatically replaceable
expected files. The standalone sources are outside the734 conformance-source
inventory. The only existing expected.json change adds META-02/03 to the
capital-stack diagnostic-code expectation on unchanged sources, retaining its
original expectation and CC-03 mismatch-only distinction. The four zero-error
profile predicates now exercise new authored positives under the owner's
RFC0048 option(a); their original inputs remain unchanged and separately assert
six META-02 errors. All original auxiliary fidelity/composition assertions remain.

The original revisions have no authored values for their six absent review
flags. Neither narrative review_status/flags nor buildMeta defaults for NEW
blocks establish those historical declarations. The owner accepted the six new
explicit declarations on2026-10-17; their disposition is below. RFC0048's
positive-validation promise is unchanged. No original source, package, signature
or receipt subject is rewritten. The historical research hook used placeholder
messages and no new registry copy; its frozen observations remain evidence,
not a regenerated render baseline.

## Activation gates and historical consequences

Final integration requires independent verification of the two predicates,
full physical/model populations and ordering; run absent/null/every-type and
container/actor/override/source-boundary controls in both implementations;
measure the complete applicable native/portable/producer/receipt consumers;
prepare explicit governed expectations on original sources; synchronize
Format/Protocol/registry/validators/conformance/documentation; and obtain green
exact-final-head CI. After merge, verify exact-main CI before treating integration
as complete. The current schema already requires both
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

## Independently reviewed implementation and owner acceptance

The bounded implementation applies exactly these predicates in TypeScript and
Python. [The existing review](https://github.com/UWMD-OSP/UW-Markdown/blob/c558a55656562f619154aa21e26ebd383173da13/docs/reviews/2026-10-15-python-reader-354.md#rfc0091-implementation-acceptance-packet)
records independent review, exhaustive original-source/consumer dispositions,
actual CLI and receipt boundaries, focused negative controls and exact CI.
The archive retains before/after observations and original expectation evidence.
The owner accepted this contract and the authored-kit declarations on2026-10-17.
The final integration gate applies to the exact final commit, not an earlier
green checkpoint. No other RFC or release state changes.

A model-only diagnostic's section follows the existing actor traversal context
(collection key for keyed collections, block annotation for append entries).
This does not invent annotation authority for an inconsistent hand-built model.
Source-origin findings use the physical block's annotation. Exact field paths
remain canonical in both operations.

## Owner RFC0048 disposition — 2026-10-17

The owner selected option (a): genuinely author new positive examples and retain
the originals as metadata-incomplete history. The subsequent2026-10-17 decision
quoted above accepts RFC0091 and the six authored declarations, with final review
and CI required before merge. It authorizes no release. RFC0048's promise and
all zero-error positive-validation assertions remain unchanged.

The four new records are under `examples/standalone/authored-2026-10-17/` with
new document/member/package identities, canonical provenance and six explicit
review/lifecycle declarations with one-line reasons in `declarations.json`.
The inline/externalized carriers share one NEW logical deal identity and
canonical metadata because full resolved equivalence is required; each has its
own package member and byte identity. No metadata/frontmatter is excluded from
that comparison. All six new blocks explicitly declare superseded false.

The new abstract, source note and both rent-roll blocks require human review
before real use. The two deliberately authored fictional property blocks do not
require human fact-review for their structural demonstration purpose. These are
new author decisions, never inferred from narrative review_status or flags or
retroactively attributed to the old author. Five new fragments have separate
part identities and explicit metadata. The new dated fragment uses accepted
Format4.26's series field with the original stated rows, without new arithmetic.

Every original source, embedded member, ZIP and signed/receipt fixture remains
byte-identical. Prior index/metric expectation bytes are retained; only eleven
new case/index entries and four NEW metric rows are appended. The four original
positive profile case names now load newly authored positive inputs, retaining
the exact zero-error condition. All original auxiliary composition, fragment,
API and package predicates remain on original bytes; the same seven predicates
also exercise the new kit. Separate controls require the old six META-02 errors
and preserve the complete history inventory. This is not a legacy admission shim.

A bounded downstream-writer inventory distinguishes current public Format3
serialization from old internal adapters and passthrough. StackUW at audited
commit fea704ee6a2b4d01057f216880678445347c76fe has an omission-preserving
reshapeMetaV1toV2 helper in packages/underwriting-engine/src/export/meta-v2.ts,
but its current default Format3 writer calls toFormat3Meta, which emits both
required booleans. The blanket current-writer omission claim is therefore not
verified at that head. Typed fresh outputs avoid META02/03; untyped malformed
values or bypassed/externally supplied admitted metadata remain exposed.
Defaulted booleans do not prove underlying facts or authorization to repair an
old source. Genuine Format2 refusals and wrapper precedence remain distinct.
The writer inventory is source/synthetic-probe evidence, not deployed-service
certification; no StackUW code is modified by this RFC.

## Subsequent owner release rule — 2026-10-17

The owner's later rule supersedes this RFC's prelaunch compatibility,
artifact-retention, migration-note and version-recommendation obligations.
Every @uwmd npm package launches together at5.0.0; prelaunch releases use4.x.x
from main as needed. There is no prelaunch backward compatibility or document,
signature, receipt or historical-artifact preservation/repair work. The former
2,731-artifact freeze and previous migration/version appendix are retired.

The accepted META-02/03 predicates, retained-physical-block applicability,
container/actor precedence, mutable-model authority and diagnostic ordering remain
unchanged. Retained blocks supplied to a current verification operation remain
part of that operation; this does not require retaining a prelaunch corpus.
Current verification stays read-only, with source/digest and receipt rules tested
as current contracts. No numerical rule, schema, capability, package number or
release is changed by this policy correction.
