---
rfc: 0094
title: Allocate three present-invalid metadata leaf diagnostics
status: draft
author: codex
created: 2026-10-18
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0094: Allocate three present-invalid metadata leaf diagnostics

## Summary

Propose `META-04`/error for exactly three **present but invalid** canonical
metadata values: `_meta.quality.confidence`, `_meta.lifecycle.revision` and
`_meta.provenance.timestamp`. Keep absent-member handling, existing completeness
warnings and META-01/02/03 unchanged. Use the all-retained-physical plus current
model-reference operation already established by RFCs0090/0091/0093. Add a
separate ordered pass after the required booleans and before role/period/source
checks. Conditional provenance references remain separate.

**Draft; direction only.** The owner's2026-10-18 direction authorizes this
bounded proposal, not acceptance, implementation or diagnostic activation. The
exact timestamp admission domain remains an explicit acceptance question below.
This PR changes documentation only: no specification, schema, implementation,
fixture, expectation, capability declaration or release state is activated.

Owner direction,2026-10-18, recorded with its exact question context:

> RFC0093 explicitly excludes these remaining fields. Do you approve the reviewed Issue #354 packet’s proposed direction for a separate bounded RFC: META-04/error for present-invalid confidence, revision and timestamp; preserve existing absence warnings and META-01/02/03; keep conditional references separate? This approves direction only, not activation. Packet: https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6256947939

> Approve this RFC direction

## Motivation

Issue354's complete-validation work independently reproduced present
`confidence: null`, `revision: 0` and `timestamp: "not a timestamp"` without an
owning registered error. These are distinct from whole missing metadata,
parent/container shape, required actor admission, the two review booleans and
the three RFC0093 predicates. An unrelated error elsewhere in a document does
not discharge these requirements. The separately reported missing
`inherited_from` conditional obligation is outside this RFC.

Existing authority already supplies the confidence vocabulary and positive
integer revision predicate: Format2.5c/2.5d and the block schema. Timestamp
requires joint reconciliation: Format2.5b says ISO8601, the schema requires a
string with `format: date-time` while describing UTC, the TypeScript metadata
type describes UTC, and ProtocolV.4 requires UTC writes. Those statements do
not yet establish a single exhaustive reader grammar. Neither a permissive host
date parser nor one schema library's extra accepted spellings defines it.

## Decisions proposed from precedent

| Call | Proposed decision | Basis |
|---|---|---|
| D1: code | One new `META-04`, error, with exactly the three field predicates below | Owner-directed bounded allocation; ProtocolIII.6a/XI registered errors |
| D2: applicability | All retained physical references, then current model-only references; exact identity deduplication | RFC0090 D3, RFC0091 applicability, RFC0093 D2/D5/D7 |
| D3: placement | Complete old shape, RFC0093 P1/P2/P3, actor, META-02/03, then the complete META-04 pass; role/period/source remain later | Existing checkpoint order; no global issue sort |
| D4: parent precedence | Existing rejected whole metadata shape suppresses META-04; nonobject/missing quality suppresses confidence only | RFC0090/0091 parent admission and RFC0093 D4 |
| D5: presence | Own canonical leaf member, including null; no inherited member, convenience alias or inferred value | RFC0093 presence/authority; preserve existing absence allocations |
| D6: timestamp | Reconcile one exact timestamp reader predicate before acceptance; no implementation-defined date parser | Format2.5b, schema date-time, ProtocolV.4 UTC writer requirement |

## Proposed change

Synchronize Format2.5b–2.5d, ProtocolIII.6a/V.3–V.4/XI, the executable registry and
remediation in the eventual implementation. The current docs-only proposal
changes none of them.

### Exact leaf predicates

After the existing metadata container admission succeeds, a validator MUST emit
one `META-04`/error for each failed present canonical leaf on each distinct
assessed block, in this order:

| Order | Field | Invalid present value | Remediation intent |
|---|---|---|---|
| 1 | `_meta.quality.confidence` | Anything other than the exact strings `high`, `medium`, `low` | State the actual confidence using that closed vocabulary. |
| 2 | `_meta.lifecycle.revision` | Anything outside JSON Schema's `integer` with `minimum: 1` | State the actual positive integer revision; do not infer chain history. |
| 3 | `_meta.provenance.timestamp` | A non-string, or a string outside the exact date-time domain resolved under T1 | State the actual write timestamp in that admitted domain; do not insert the current time. |

`null`, arrays, objects, booleans, exact-empty strings and wrong-case or padded
confidence values are invalid present values. Revision strings are invalid;
numeric1.0 and1e0 denote integer1. Booleans never count as integers, including
in Python. There is no coercion, trimming, default insertion or repair. Do not
add a safe-integer limit, chain-monotonicity rule, fence-revision comparison or
financial numerical procedure under this allocation. Nonfinite mutable-model
numbers are not valid revisions. Source number admission remains the existing
Reader obligation.

A timestamp that is only a calendar date, an unqualified local time, an exact
empty string or arbitrary prose is not a schema date-time. T1 must settle the
remaining grammar/offset/calendar edge domain before this RFC can be accepted.
A host accepting a string is not sufficient evidence of lawful admission.

Each finding MUST identify the exact canonical `field`, block section and failed
requirement. Available physical location/variant context SHOULD distinguish
peers. Ordinary `ValidationMessage`/validation issue objects MUST NOT gain a
`category` member. When carried as a `ProtocolError`, use existing category
`validate`. No public diagnostic subtype, generic schema fallback or new result
state is allocated.

### Presence, parents and independent findings

A leaf is present only when its admitted canonical parent has that own member.
An absent leaf MUST NOT acquire META-04. Existing absence warnings retain their
predicates, severity, inputs, applicability and relative order. In particular,
this RFC does not promote `META_FIELD_MISSING_CONFIDENCE`,
`META_FIELD_MISSING_VERSION` or `META_FIELD_MISSING_TIMESTAMP` to errors.

Present null is an invalid present value for META-04. If the existing
completeness predicate also warns on null, retain that warning: the allocation
must not silently remove an existing finding. Newly scanning history does not
expand the old active/projected completeness-warning population.

Preserve the old whole-missing-meta and wrapper/nested-object admission
boundaries. A rejected `_meta`, provenance or lifecycle container suppresses
this descendant pass for that block, as for actors/booleans. A missing or
nonobject quality container receives its accepted RFC0093 handling and suppresses
only the confidence leaf; admitted revision and timestamp remain independent.

Placement/section-only RFC0093 errors, actor-only META-01, META-02 and META-03 do
not suppress META-04. A META-04 finding does not suppress another leaf, boolean,
actor, annotation, source, role, financial or conditional-reference finding.
META-01/02/03 gain no predicate and change no severity. Optional metadata,
field overrides, revision-chain relationships and conditional provenance
references are outside this code's closed list.

### Population, source/model authority and diagnostic order

Use the accepted RFC0090/0093 operation, including physical current, historical,
overwritten, variant, append-only and extension blocks. Traverse retained
physical block references in source order, then supplied model-only references
in `sections`, `superseded`, `pipeline_log`, `custom_calculations`,
`custom_scenarios`, `extensions` order, preserving entry/array order. Deduplicate
only exact object identity; equal values/keys/digests do not establish identity.

Fresh SOURCE conclusions require freshly parsing the actual operation input.
For resolved composition, account for the original root and actual consumed
referenced parts, excluding unrelated loaded files; retain the original physical
references before any reduction or row-metadata stripping. Keep the assembled
financial projection and treat synthesized block references as MODEL references
under the accepted operation. Do not join independent full validation arrays or
repair selection to conceal invalid metadata.

Mutable MODEL validation MUST use current canonical content/annotation on the
retained-reference/model union, observing in-place mutations, replaced/added
blocks and exact identity. Do not reparse stale `raw`/`rawJson`, use divergent
convenience metadata or fabricate lost physical coverage. A model without the
parser inventory assesses only supplied collections. Other representations,
including Lite's compiled-model path, retain their accepted operation boundaries.
This does not promote historical financial values or decide RFC0085.

Keep every existing checkpoint and unrelated finding in its current relative
order. After completing all META-02/03 findings, emit the complete META-04 pass in
the union order above, per block confidence, revision, timestamp. Only then run
the existing role/period/source checkpoints. Do not interleave another block's
META-04 with actor or boolean passes or globally sort by code.

### Results and transport

META-04 findings enter the ordinary issue/error partitions and derived status,
display and CLI exit semantics. Structural invalidity is distinct from
unavailable composition and unsupported sources. A Python completeness gate may
consume local evidence only when the emitted META-04 owns that exact predicate,
block reference and path; an error elsewhere is insufficient. Preserve all
unrelated unallocated evidence as an incomplete operation.

New receipt policy counts follow the actual validation result. This proposal
changes no source digest, signed subject, receipt wire contract, issuance rule,
authentication order or verifier verdict precedence. Validation remains read-only.

## Timestamp contract reconciliation — T1 remains open

The smallest remaining normative selection is **one exact reader timestamp
acceptance domain**, synchronized across Format prose, schema assertions and
both implementations. Confirm whether reader admission follows the RFC3339
`date-time` domain referenced by JSON Schema, with numeric offsets, or a clearly
specified UTC-only profile; then state the corresponding exact lexical/calendar
boundaries. Protocol's UTC writer rule alone does not settle reader admission.
This is an admission-contract question, not a new financial convention.

Two concrete alternatives for final owner review; neither is selected here:

| Alternative | Timestamp predicate and exact META-04 consequence | Joint contract consequence |
|---|---|---|
| T1A: schema-led reader | A string must satisfy RFC3339 section5.6's date-time grammar and section5.7 restrictions. Valid coloned numeric offsets, lowercase t/z and fractions do not fail merely for their spelling; compact/hour-only offsets and space separation fail the ABNF predicate. Calendar/leap-second validation must follow the stated restrictions rather than a host parser. | Reconcile reader prose/descriptions to this date-time domain while retaining the separate UTC write rule; freeze an explicit deterministic leap-second policy before activation. |
| T1B: explicit UTC-only reader | A string must be four-digit year0000–9999, two-digit Gregorian-valid month/day, uppercase T, hour00–23, minute00–59, second00–59, optional decimal point plus one or more ASCII digits, uppercase Z, with no other characters. Every numeric offset (including +00:00), lowercase separator, space, local time and second60 receives META-04; no normalization. | Add the exact narrower UTC assertion to the schema and synchronize Format/Protocol; this is an owner-selected restriction beyond the current date-time assertion, not an inferred existing rule. |

T1B's Gregorian validity includes the usual divisible-by4/100/400 leap-year
rule, applied also to year0000. T1A's actual leap-second-date/announcement
handling cannot be replaced with AJV's mere hour-position test. Selecting T1A
must include its deterministic assertion/fixture policy; selecting T1B resolves
that edge by excluding second60. Both retain the same three-field META-04 code,
parent gates, absence handling and pass ordering.

Required boundary dispositions include coloned offsets, `Z`/case, `+00:00` versus
`-00:00`, whitespace separation, missing zones, fractional seconds, actual
calendar validity, year0000 and leap-second handling. Do not choose a leap-second
rule by copying a host date parser, a library's simple hour check or an unpinned
external calendar oracle.

Independently measured repository tooling uses `ajv-formats`3.0.1 full
`date-time`. It accepts `2026-10-18T00:00:00-07:00`, lowercase `t/z`, a space
separator, compact`+0000` and hour-only`+00`. RFC3339's ABNF numeric offset uses
hours **and coloned minutes**; those library acceptances do not establish the
normative domain. The same tool accepts a leap-second-shaped
`2026-10-18T23:59:60Z` without establishing an announced leap second on that date.
`Date.parse` rejects that string but accepts `2026-02-30T00:00:00Z` and an
unqualified local date-time. Neither tool is the proposed validator algorithm.

The frozen current-source inventory below contains no schema-valid non-Z
timestamp. That absence does not decide T1 or prove cross-implementation grammar
agreement. A docs-only draft can record this open question; acceptance and
implementation require its resolution and independent positive/negative controls.

## Conformance impact

### Independent baseline inventory

Baseline: immutable main `0450ae57034d794a51dfa83fb41f9e0baaaa8019`.
Read all876 tracked source-extension paths (`.uwx.md`, `.uw.md`, `.uwpart.md`)
from Git blobs; independently scan closed recognized structured fences before
routing; decode JSON and inspect only the three own leaf paths on admitted
parents. This produced2223 physical object blocks. No unclosed/invalid-JSON
recognized fence occurred in that candidate scan. This is a raw source-extension
inventory, not a claim that all876 inputs are admitted Format3 records.

Present leaf counts: confidence1509, revision1581, timestamp1509. The candidate
predicate inventory found174 present-invalid leaves across78 files:

| Family | Files | Physical leaf findings | Classification |
|---|---:|---:|---|
| `conformance/reserve-accounts/` | 27 | 28 confidence=`verified` | Focused reserve-verifier inputs; not evidence of a complete-validation pass. |
| `conformance/reserve-draw-bindings/` | 46 | 138 confidence=`verified` | Focused reserve-draw inputs; not proof of whole-document metadata admission. |
| `conformance/starter/editor/fixtures/*/after.uwx.md` | 5 | 8 timestamp=`<volatile>` | Normalized expected-output templates; not authored timestamp declarations. |

There were no present-invalid revisions and no candidate hidden by the old
wrapper/provenance/lifecycle rejection in this scan. No candidate occurred in
`conformance/documents/fixtures/` or `conformance/documents/malformed/`. Independently
resolving all111 portable `validate` case inputs against their declared fixture
directories found zero intersection with these78 candidate paths. This is an
input-path inventory, not execution of a new META-04 validator or a prediction
that every future derived-result expectation remains unchanged.

The reserve runners invoke their focused financial verifiers; their positive
financial verdicts do not allocate a different confidence vocabulary. Independent
review of the73 reserve-family expected states found17 documents whose focused
financial verdict is `verified` (6 reserve-account documents carrying7 candidate
blocks and11 reserve-draw documents carrying33), and56 documents in other
financial states. Neither group promises complete metadata validity. The editor
runner deliberately normalizes timestamps into `<volatile>` before comparing its
AFTER templates (`scripts/run-conformance.mjs`, `stripVolatileFields`). Those8 template
strings are not8 demonstrated failures in actual writer output. Distinguish
these consumer obligations from native/portable complete-validation expectations
before proposing any implementation fixture disposition.

Do not convert this174-leaf inventory, the earlier27-schema audit or every schema
rejection into new validator codes or blanket expectation changes. Current
sources and expectations remain unchanged in this proposal. Implementation must
inventory the actual invoked validation operations, independently attribute each
changed finding and derived status/exit/display/receipt count, and identify which
focused fixtures need separately authored valid validation controls. No existing
negative assertion may be weakened to obtain a green result.

### Reproduction and evidence boundaries

The independent scan uses `git ls-files -z` and `git cat-file --batch` at the
exact baseline above, UTF8 JSON decoding, physical fence order and own canonical
members, before routing. Its independent Markdown carrier scan accepts zero to
three leading spaces, backtick or tilde fences of length at least three, matching
longer closing fences, and keeps generic fenced examples opaque. A widened scan
reproduced the same2223 objects and exact174 candidate records as the initial
literal-backtick scan; no extra candidate was silently omitted by that narrower
first recognizer. Confidence uses exact enum membership; revision uses
integer/minimum without Python boolean coercion. Timestamp candidate
classification uses the installed schema tool's full date-time predicate only
as measured tooling evidence; T1 remains unresolved. Source SHA256 plus physical
block ordinal, opening line, annotation, field and value identify every candidate
in AppendixA. Whole/nested-shape exclusions and absences are separate populations.

The complete inventory report SHA256 is
`3ba6f087ae6e90b716ee7f075ff0d60580beef6045b090347b083d8ab594ad8c`;
the15-value timestamp boundary report SHA256 is
`6b11fe95dcc93b324bb8ad6e3c5d2fbe3f10307f41f72689dd95193fbd9e0f1f`.
These are candidate evidence, not accepted expected outputs, platform results or
production verification claims. The original Git source hashes in AppendixA
remain the authority for reproduction, not a local mutable worktree.

### Required new controls before implementation integration

- Every admitted literal and invalid JSON type for each leaf, null versus absent,
  exact case/whitespace, revision1/1.0/1e0/0/negative/fractional/string/boolean and
  numeric admission boundaries; no inferred chain checks.
- T1's complete frozen timestamp positive/negative boundary set, independently
  checked in TypeScript/Python and schema tooling without host-parser authority.
- Whole missing metadata, every existing rejected parent, quality-only refusal,
  P1/P2 errors, actor-only error and both boolean errors; independent coexistence
  and the exact complete-pass ordering.
- All physical history/unselected/extension/append peers and current model
  additions/mutations/replacements; distinct equal values versus exact identity;
  composed root/consumed parts/derived blocks and Lite's accepted model path.
- Existing absence warning populations, all partitions/readiness/coverage,
  real CLI stdout/stderr/exits, read-only source bytes, new receipt policy counts
  and unchanged receipt/signature/subject/precedence behavior.

## Reference implementation

No implementation is included or authorized by this draft. After final owner
acceptance, implement the exact same closed predicate and pass in TypeScript and
Python together, with synchronized Format/Protocol/registry/remediation and
schema annotations or justified assertion changes for T1. Primary sites:
`packages/uwmd-verify/src/validator.ts`, `protocol.ts` and focused tests;
`implementations/python/uwmd_source_validation.py` and the integrated #354
validation modules/tests. Reuse existing DTO/result transport; no new public
function, generic fallback, manifest capability or complete Verifier claim.

## Alternatives considered

- Expand META-01: confuses admitted leaf values with its accepted closed
  wrapper/actor/P1/P2/P3 list; the owner directed a separate META-04.
- Broaden META-02/03: confuses confidence, revision and timestamp with their
  two exact boolean predicates.
- One generic schema refusal: captures unrelated conditional/optional/payload
  requirements, obscures exact ownership and erases existing warning boundaries.
- Active-only metadata: exempts blocks to which Format and RFC0090/0091/0093
  explicitly apply the metadata requirements.
- Host-parser date acceptance or trim/default repair: produces runtime-dependent
  admission or alters the evidence instead of validating the stated record.

## Unresolved questions and acceptance gates

1. T1: approve the exact timestamp reader domain and settle its grammar/calendar
   boundaries, jointly reconciling ISO8601/UTC/date-time authority. No choice is
   inferred from current examples or `ajv-formats` extensions.
2. Final owner acceptance of this complete draft remains required. The earlier
   direction authorizes preparation only.
3. Independently inventory actual validation/CLI/receipt impact on unchanged
   sources; synchronize both implementations/contracts and individually governed
   expectations only after acceptance. Preserve all unrelated issue order and
   assertion strength; run required exact-head integration CI.

Conditional references and remaining unallocated metadata requirements remain
separate. RFC0085/0089/0092 and numerical semantics are untouched.

## Prior art

- [RFC0090](0090-provenance-actor-admission.md),
  [RFC0091](0091-required-metadata-booleans.md),
  [RFC0093](0093-metadata-shape-diagnostics.md): closed diagnostic ownership,
  parent precedence and physical/model authority.
- [Format2.5](../../spec/UW_FORMAT_SPEC.md#25-the-_meta-object),
  [block schema](../../spec/schemas/uwmd-block.schema.json), ProtocolIII.6a/V.3.
- [JSON Schema2020-12 date/time formats](https://json-schema.org/draft/2020-12/json-schema-validation#section-7.3.1)
  references [RFC3339 section5.6](https://www.rfc-editor.org/rfc/rfc3339#section-5.6).
  Their specified domain must be distinguished from a particular library's
  measured extensions. No quoted external text establishes an owner decision.

## AppendixA: Exact source candidates

Each entry gives the unchanged Git source SHA256 and physical block ordinals
(opening lines in parentheses). All listed confidence values are exactly
`verified`; all listed timestamp values are exactly `<volatile>`. No revision
candidate was found. Full per-block annotations and values are in the hashed
inventory report; source plus ordinal/line reconstruct them without routing.

| Source path | SHA256 | Field suffix | Physical blocks (opening lines) |
|---|---|---|---|
| `conformance/reserve-accounts/balance-mismatch/deal.uwx.md` | `c4f0d1cf1a2257e7011d69bd452b41ac130b096ffd35bd495410937f9b37f97d` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/bank-interest/deal.uwx.md` | `2baa82c994daff568cd56548306b6b142af6e47bf9958ac5faf04c1cca9cb25a` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/bare-block/deal.uwx.md` | `b067d7c97b18da8df3bfdd918449afeb97f4ddccf269bf74632411d6b37ce292` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/broken-continuity/deal.uwx.md` | `9637648e39e4eca2e1a82306a8b3a2ffc2d82c1834478be9d7a5ec1f9975487f` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/currency-disagrees/deal.uwx.md` | `5804be9b762679656c5a82963feaf8220f80aa1addccf018535f592bf4d8a935` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/duplicate-account/deal.uwx.md` | `3b4420179ad9642ca4176ff49ba90a7ad04e56fee3aa324eb8936e0911a25881` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/duplicate-movement/deal.uwx.md` | `d52e9f5ca42a138877688c5e963d9bb568ee3322071f33623d99e556ade72bae` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/duplicate-period/deal.uwx.md` | `5bb1cfa917034228aa60443d53e58147004e68de7f2bb46f9508ca267b5984fd` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/empty-explicit-movements/deal.uwx.md` | `29ff092e05927ccbf7c30aed202567a61d4dcaf5a46fb85cf1a5226ba8dcba1a` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/half-away-mismatch/deal.uwx.md` | `e569445ecf054589c39d1e088d468afa2bd919e493190e8991ac9f3d9bf25023` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/invalid-date/deal.uwx.md` | `6979c6e081d80043f1f779837c8053fc9e5075684874a1acf554e6d0e2e9a624` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/large-cent-draw-contribution/deal.uwx.md` | `18f8a941f3ccfac58b89de106e47be0dd88e4d48b380eda081eb04a79d02867c` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/large-cent-multiple-contributions/deal.uwx.md` | `6d2af5c03caef0ae6d79b471edf322f5f672a9fb0b3ba205e1cb65b87bc56a1b` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/large-cent-one-cent-mismatch/deal.uwx.md` | `ea2473d52283a5d90cc7eece58aac53f2b07c057ef72ad6473e1604f7deb4b84` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/lender-reserve/deal.uwx.md` | `e7a6278ad0515e6ef975d1e0a334665955d8dc301f04b02c4a0904ebab10a5f0` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/missing-movements/deal.uwx.md` | `e136c4fe75a2d4fb617843af42bdea28668893ae85f6affec46567244d354a29` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/missing-source/deal.uwx.md` | `34067926357e477edc3d16dda3952516a966ed16ec75746674c60c2abed0ec0d` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/negative-movement/deal.uwx.md` | `d8165e879d73919362bd1e3fa9f860d295afdd481fdffc4f8b67ed4d9801bc03` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/overflow-then-finite-periods/deal.uwx.md` | `e0d963343dabe1c1564379d398a2ac65176843aba0d98882a828166d0452f0d3` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/overflow/deal.uwx.md` | `018d12af112c92a1ff2e2c25950bd68a533f575a9e87e12494e0f995809fdeb4` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/quantum-equal/deal.uwx.md` | `05c282a990c181c2926d91b7da239be91ee47ba832eb967e5d17c8b0bf17bc36` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/unclassified/deal.uwx.md` | `579d32a97eefaca014cd6613ff9c51eaf3ddf188256c05874b8438e1d9119266` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/unknown-field/deal.uwx.md` | `c871efcc32d113b03bc450ebbd63d2d1283d1e23c5d851f01699884bb8477020` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/unordered-movements/deal.uwx.md` | `9f88554cd000c1e90db033b0e3fdbc9209d71b6ad0a3c080bdad955103216c71` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/unordered-periods/deal.uwx.md` | `26bd2627d69e111d2b5d6017ca8def46da0117359625815569900df0e27faec7` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-accounts/verified-source-classes/deal.uwx.md` | `485abfc79320b7e8dd84044ba0a05ef3d1623cd42c064aad6be523b3fa7bc524` | `_meta.quality.confidence` | 1 (12), 2 (111) |
| `conformance/reserve-accounts/wrong-previous-period/deal.uwx.md` | `26c4e2439135914292fc2e358cdd0e7fa305d3eab4f9e7c1909d04b725469d9d` | `_meta.quality.confidence` | 1 (12) |
| `conformance/reserve-draw-bindings/absent/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/ambiguous-net-row/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/bare-block/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/cent-multiple-draws/deal.uwx.md` | `97d35c3631c07b4901da9217034150f27eb0d3940074aa2c870304e748d23ed2` | `_meta.quality.confidence` | 1 (12), 2 (85), 3 (116) |
| `conformance/reserve-draw-bindings/cent-one-cent-share/deal.uwx.md` | `4df0066fd41ff2f2b89d90e11d79e222f0cd626a518b4b49b6c515bdfa8c2244` | `_meta.quality.confidence` | 1 (12), 2 (85), 3 (116) |
| `conformance/reserve-draw-bindings/cent-one-cent-unallocated/deal.uwx.md` | `6a19cb8085ddb08f41b161a4c07b65a66eb1166e996607105e6ed1a603e4c9f0` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (111) |
| `conformance/reserve-draw-bindings/cent-split-draw/deal.uwx.md` | `e3c9583f84ae49bc1ac99b0b9d0725fce10b4a782f6a2c372e40379c5f7cacfd` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (111) |
| `conformance/reserve-draw-bindings/closed-plan/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/duplicate-edge/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/duplicate-selected-draw/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/duplicate-source-row/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/excess-draw-allocation/deal.uwx.md` | `0221b3034196140ff86f1c08433f3e141aa0b0ebdc6f872b76881e706ab4ec65` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/external-release/deal.uwx.md` | `8bc0a1dfcb194aac852d534f20f32c1940d907ba16fc64fa99f555339515bab7` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/funded-share-disagrees/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/incomplete-draw/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/invalid-source-date/deal.uwx.md` | `279ce4d00e0338aa0463df1fc7dd0a32a176215f2241f6eaf1ba7f5a51d48131` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/lease-up-component/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/lender-reserve/deal.uwx.md` | `6f2d6d116cc2f7daf44b39e9be42090039775b2776861bf75da818bb6030946a` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/many-to-many-partial/deal.uwx.md` | `75020d7cc5a845b598239bc50fb31f580e2b0649f561fc6c7d288a70982af5ae` | `_meta.quality.confidence` | 1 (12), 2 (85), 3 (122) |
| `conformance/reserve-draw-bindings/missing-account/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-completeness/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-expenditure-row/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-movement/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-period/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-reserve-variant/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/missing-source/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/nonfinite-allocation/deal.uwx.md` | `b3afd2f64714ebca7d179db5a4c6a152a92b82c2602c4a1a234d3ddc7dfbbdc6` | `_meta.quality.confidence` | 1 (12), 2 (107), 3 (144) |
| `conformance/reserve-draw-bindings/null-plan/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/one-to-one/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/operating-expense/deal.uwx.md` | `c3906d09b55012b27c5f6269e6c2efd659d111d1da4e23b3192e0e9c955d30cb` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/overbinding-gross/deal.uwx.md` | `39fa69d03f93a175031051c0f3f84d6faea78f046ea77d9b277b7018683555ba` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/partial-expenditure/deal.uwx.md` | `6d0bd5da4355c98ea5fa62e930a0a713ac6164f05197df964fee32a8d27759df` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/reserve-balance-mismatch/deal.uwx.md` | `20493e01ee25784b48f93d2f579d9fe472ed94c16c6fd05d0b442c871243b688` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/same-day-identities/deal.uwx.md` | `19bfde44aa80aad675b72c9cd3ceef029e5f88d66118fffdb1c119d79a3bc3b3` | `_meta.quality.confidence` | 1 (12), 2 (85), 3 (122) |
| `conformance/reserve-draw-bindings/split-draw/deal.uwx.md` | `a9fe333ab59d039b4a4f72a94eaf66aeb82e3ada1c9244e0c490ec5df72e43b7` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (111) |
| `conformance/reserve-draw-bindings/stale-digest/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/stated-final-boundary/deal.uwx.md` | `14366da4e32754e2269cfb85d67e1b02c086d8d3a24d28550a085e2c7c5a7186` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/subcent-allocation/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/superseded-source/deal.uwx.md` | `305fa2663cd484fa98c776370a1ad787128785d5e7388ce310ddf54ed6dfd3c5` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/unbound-selected-draw/deal.uwx.md` | `1ba3c19e0fedb74f33776abf0d7e2afc3f6b188e2ab5fbf974c3156089e75826` | `_meta.quality.confidence` | 1 (12), 2 (85), 3 (116) |
| `conformance/reserve-draw-bindings/unclassified-movement/deal.uwx.md` | `949b2426915b0a169d0e8944ca9dc82ab11cfc7acfa7a1cd8af00171b2f84003` | `_meta.quality.confidence` | 1 (12), 2 (73), 3 (104) |
| `conformance/reserve-draw-bindings/undeclared-draw-edge/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/wrong-category/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/wrong-currency/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/wrong-expenditure-variant/deal.uwx.md` | `2a6a014bccf6de538e8b08062827bf3df97a9bffd851dcb59629a8ff667eca08` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/reserve-draw-bindings/wrong-gross-sign/deal.uwx.md` | `ea10f39a2f306bc17ef70915a82b9e6f59833e199adc3df6c65c672c7e5a3b61` | `_meta.quality.confidence` | 1 (12), 2 (74), 3 (105) |
| `conformance/starter/editor/fixtures/frontmatter-set-recommendation/after.uwx.md` | `ceda441e9f6fe9ea37b4d74b656224a7d3311675d8e8ee02e8d72df96c0772a3` | `_meta.provenance.timestamp` | 1 (34) |
| `conformance/starter/editor/fixtures/gaps-section-update/after.uwx.md` | `d4b19a736f386bcc7d823c134a963755a692ea62ba5ffb51c9f6028818278c8d` | `_meta.provenance.timestamp` | 1 (23), 2 (55) |
| `conformance/starter/editor/fixtures/parent-hash-stamp/after.uwx.md` | `66a776754ba2eec0b6f23a09d7e842e891f61629aa6b04914d6d97a36b968097` | `_meta.provenance.timestamp` | 1 (28), 2 (64) |
| `conformance/starter/editor/fixtures/section-replace-property/after.uwx.md` | `fc757019caf68b41de323c5ca6c0de1352d209cc020ed318ab7f30faf248a9ef` | `_meta.provenance.timestamp` | 1 (23) |
| `conformance/starter/editor/fixtures/section-supersede-risk-rating/after.uwx.md` | `0e27514ee30c3ed6a5eb95200848609c68f8ec088b3831a5b9948c209efb5f1b` | `_meta.provenance.timestamp` | 1 (23), 2 (58) |
