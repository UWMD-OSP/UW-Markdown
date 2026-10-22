---
rfc: 0093
title: Close three metadata-shape diagnostic gaps
status: accepted
author: UWMD maintainers
created: 2026-10-18
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0093: Close three metadata-shape diagnostic gaps

## Summary

Amend the closed `META-01`/error list with exactly three conditions already
required by Format2.4–2.5: a present canonical `_meta` that is not the first
block member; a present canonical `_meta.section` that is invalid or disagrees
with the block annotation; and an absent or nonobject required `_meta.quality`.
Assess every retained physical block, followed by model-only additions, using
RFC0090/0091's operation boundaries. Place a separate bounded shape pass after
existing wrapper/nested-shape findings and before actors and required booleans.

**Accepted by the owner,2026-10-18, at reviewed head `0306d126`.** The docs-only
acceptance merged in #384 at `0450ae57034d794a51dfa83fb41f9e0baaaa8019`.
The synchronized Issue354 implementation applies this accepted contract in
TypeScript/Python, Format/Protocol and registry/schema annotations. It adds no
capability claim or release. The predicates and operation boundaries below are unchanged from
the reviewed text.

> Owner, 2026-10-18: RFC 0093 (#384) is accepted as drafted at 0306d126: the three META-01 predicates exactly as listed, no generic fallback, META-02/03 unchanged.

> Owner decision (2026-10-18), #354 metadata shape: yes, allocate it. Open a bounded, docs-only RFC that amends the META-01 closed list with exactly three predicates: a late or misplaced _meta, a present but invalid or mismatched canonical _meta.section, and a required _meta.quality that is absent or not an object.

## Motivation

[Issue354's existing metadata-shape packet](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6243597561)
identifies these three requirements separately from already allocated absences,
actor admission and canonical boolean admission. Its null-quality counterexample
has otherwise admitted metadata. The developing Python `validate` command
retains the requirement as uncoded local evidence and returns a partial refusal;
the current reference validator supplies only the existing missing-confidence
warning. Neither result establishes complete validation of that requirement.

The [latest Python checkpoint](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6248041372)
passes111 actual portable validation cases with parse-only discovery. This
portable result does not allocate missing diagnostics or prove full admission.
The packet and checkpoint are existing evidence, not new runs for this RFC.
Baseline: main `8a646aa219620c143bb8439aa67cf010d9896a79`;
Python WIP `a3993a82e5259e3bf8af6fccf9c1c695d5189e5c`.

Joint authority:

- Format2.4/2.5 require the first canonical `_meta` member;2.5a requires the
  canonical section string to equal the fence annotation;2.5/2.5c and
  `spec/schemas/uwmd-block.schema.json` require the quality object.
- The block schema describes first-member order but cannot express JSON member
  order or equality to an external annotation. A schema rejection alone does
  not allocate an ordinary validation code.
- RFC0090 explicitly excludes late metadata and section disagreement from its
  actor allocation. RFC0091 explicitly excludes these and the quality-container
  diagnostic. They therefore need this bounded amendment, not an implementation
  reinterpretation of either accepted RFC.

## Decisions

| Call | Accepted decision | Accepted precedent |
|---|---|---|
| D1: allocation | Extend META-01/error by only P1/P2/P3 below; category `validate` only when transported as a ProtocolError | Owner direction; existing ProtocolIII.6a/XI diagnostic and DTO boundary |
| D2: population | All retained physical blocks, including history and unselected peers; then exact-identity model-only union | Format2.4–2.5 say every block; RFC0090 D3 and RFC0091 applicability |
| D3: placement | Complete existing wrapper/nested-shape checkpoint, then this new pass, then the complete actor pass, then META-02/03 | RFC0090 keeps shape before actors; RFC0091 puts flags after shape/actors |
| D4: descendants | Existing whole-container refusal wins; P1/P2 do not reject admitted descendants; P3 suppresses only its quality-dependent boolean check | RFC0090 actor independence; RFC0091 per-parent suppression |
| D5: authority | Exact operation input, canonical content and annotation, current model references; no stale-raw reparse or convenience-meta substitution | RFC0090 source/model contract |
| D6: already allocated absences | Whole missing metadata and absent section retain their existing warning rules and populations | ProtocolIII.6a; RFC0091 expressly preserves completeness |
| D7: member order | Source operations use decoded lexical order; model operations assess current non-array-index string-member order, without an authored numeric-order claim | Format2.4 first-member rule; RFC0090 distinguishes model input from exact-source assessment; integer-index enumeration cannot recover JSON lexical order |

## Accepted change

The following owner-accepted text is to be synchronized into Format2.4–2.5 and
ProtocolIII.6a/V.3. The implementation must synchronize the ProtocolXI registry
and remediation descriptions without adding a diagnostic code or new result
state. Existing META-01 wrapper/nested-object and actor meanings remain.

### 1. Exact predicates

A JSON object here means a non-null object with named members; arrays and
scalars are not objects. Presence means an own canonical member exists, not
truthiness, an inherited property or a convenience view.

After the existing wrapper/nested-object admission succeeds and canonical
`_meta` is present, assess these predicates in P1/P2/P3 order:

| Predicate | META-01/error condition | Exact `field` | Remediation intent |
|---|---|---|---|
| P1: placement | The present top-level `_meta` is not first under the operation-specific order defined in section3 | `_meta` | State the canonical metadata as the first member; validation never moves it. |
| P2: section | `_meta.section` is present and is not a nonempty string exactly equal to the block's admitted annotation section | `_meta.section` | State the exact annotated section identity; do not infer it from a collection key. |
| P3: quality container | `_meta.quality` is absent, null, an array or any scalar | `_meta.quality` | State the required quality object with its explicitly authored members; do not fabricate confidence or review flags. |

Each failed predicate MUST yield one finding per distinct assessed block. Several
predicates on the same admitted block MUST coexist in the table's order. The
message MUST identify the failed requirement, and MUST include its exact
`field`; available physical source/variant context SHOULD identify distinct
peers. No public diagnostic subtype, new severity or new category is allocated.
Ordinary `ValidationMessage` objects gain no `category` member.

For P2, null, booleans, numbers, arrays, objects and the exact empty string are
invalid. Whitespace, case or spelling is not normalized: strings pass only by
exact equality to the admitted annotation. A matching unknown nonempty section
identity does not fail this predicate merely for being unknown. Do not introduce
a registry-membership or section-alias rule. The annotation's own parsing and
admission remain separate. Neither the projected map key nor convenience
`block.meta.section` overrides canonical `block.content._meta.section`.

P1 concerns only the reserved top-level metadata member. A nested payload key
named `_meta` neither satisfies canonical metadata nor creates a new traversal
rule: when the canonical member is absent, retain the existing whole-missing-meta
behavior. Ordinary payload and lawful unknown members remain payload.

### 2. Shape precedence and independent findings

Existing retired `section_id` wrapper and malformed `_meta`/provenance/lifecycle
container predicates retain their earlier META-01 refusal. On such a rejected
container, MUST NOT cascade P1/P2/P3, actor or child-boolean errors. This is the
existing admission boundary, not permission to consume another block's finding.

Whole absent `_meta` MUST retain `META_MISSING` and its existing applicability;
it MUST NOT gain P1, P2 or P3. An otherwise admitted `_meta` with absent `section`
MUST retain `META_FIELD_MISSING_SECTION`, without P2. Every other previously
allocated missing-field warning retains its predicate, severity, population and
relative order. In particular P3 does not remove an existing
`META_FIELD_MISSING_CONFIDENCE` warning.

P1 and P2 MUST NOT suppress actors, admitted-parent META-02/03 or independent
source, role, annotation and financial findings. P3 MUST NOT suppress actors,
lifecycle admission or META-03. An absent/nonobject quality object has no admitted
`human_review_required` child, so RFC0091's existing suppression of META-02
remains. An empty quality object passes P3; its absent review boolean receives
META-02 and its absent confidence keeps the existing completeness warning.
Actor-only META-01 does not itself reject the container or suppress P1/P2/P3.

This amendment allocates no other metadata or payload shape. Invalid authored
confidence, revision, timestamp, optional provenance values, conditional
references and override members remain separate requirements with their own
accepted owners or unresolved allocations. No schema-wide fallback is permitted.

### 3. Physical applicability, authority and ordering

Fresh-source validation MUST parse the actual supplied source and retain every
recognized structured block before routing or reduction. P1/P2/P3 MUST apply to
current, superseded, overwritten, variant, append-only and extension blocks.
Being unselected does not waive an every-block shape requirement. This does not
promote historical financial values to current or decide RFC0085's separate
retained-history authority question.

Use RFC0090's reference union: retained physical block references in source order,
then model-only block references in its declared traversal order (`sections`,
`superseded`, `pipeline_log`, `custom_calculations`, `custom_scenarios`,
`extensions`, retaining entry/array order). Deduplicate only exact block identity.
Equal values, section ids, variants or hashes do not establish identity.

Mutable-model validation MUST assess current canonical content and annotation
on those references, including added/replacement blocks and in-place mutations.
It MUST NOT silently reparse `parsed.raw` or `block.rawJson`, substitute cached
`block.meta`, or infer complete physical coverage from a reduced model.
Hand-built/copied/deserialized models without the parser association have only
their supplied model collections. No source-equality claim follows from them.

For structured fenced-JSON source P1, use the lexical sequence of decoded top-level JSON member names
from the admitted input. Escaped spellings of `_meta` denote the same member.
A payload key such as `"0"` following `_meta` does not make metadata late merely
because a host's object enumeration moves integer-index keys first. Do not use
canonical sorting, a regex search, nested keys or an unrelated source snapshot.
For the distinct mutable-model operation, P1 MUST assess `_meta` against the
current object's own enumerable **non-array-index string members**, in their
observable order. An array-index name is exactly a canonical unsigned decimal
integer spelling from0 through4294967294 (`"0"` qualifies; `"00"`, `"-0"` and
`"4294967295"` do not). Numeric-index members alone MUST NOT create a model P1
error or fallback diagnostic: their authored placement is irrecoverable from an
ordinary JavaScript object. This rule is shared by both implementations, not
Python insertion order versus TypeScript numeric sorting.

Thus fresh source `{"0":1,"_meta":{...}}` fails P1, while a model with only
`"0"` and `_meta` has `_meta` first among its non-index members. A model whose
non-index payload member precedes `_meta` fails P1. The model result makes no
claim about the numeric members' original lexical position. This explicit
operation distinction does not waive the lexical rule for any source operation.

Validation/CLI/receipt operations taking structured fenced-JSON source
MUST use fresh lexical order for their actual JSON blocks, even if they delegate
other checks to a model validator. Merely calling the model path and claiming full
source validation is insufficient. Parser-private lexical evidence may support
that operation; it MUST NOT override current model member order on a subsequent
model operation, and stale `raw`/`rawJson` remains non-authoritative. Exercise
both paths, integer boundaries, current key mutations and object identity before
activation. No new public result member or unassessed-order state is introduced.

Other accepted representations retain their existing codec/compilation path.
In particular UW Lite has no authored fenced-JSON member sequence: its compiled
block model is assessed under the model rule, without attributing generated JSON
order to the Lite source. Do not reject Lite receipt operations for unavailable
lexical evidence that their accepted representation never carries. This RFC adds
no representation admission rule, and does not change Lite financial canonical
form or its exclusion of authored field order (UW Lite Spec6/8).

Keep every existing wrapper/nested-shape finding at its current checkpoint and
in its existing relative order. Then emit the complete P1/P2/P3 pass in the union
order above, per block P1 before P2 before P3. Only after the whole new pass emit
the complete RFC0090 actor pass, then the complete RFC0091 META-02/03 pass, then
existing role/period/source checks. This prevents a late shape finding from being
interleaved into another block's actor or boolean pass. Existing unrelated
findings MUST retain relative order; do not globally sort issues by code.

### 4. Result and operation boundaries

New findings participate in the ordinary `ValidationResult.issues` and its error
partition, derived status/display and existing validation CLI exit semantics.
A registered P1/P2/P3 error is not an unsupported-composition or unavailable-source
condition. In Python, consume duplicate local evidence only when the exact
predicate is owned by the actual emitted error on the same physical block/path;
retain unrelated unallocated evidence as an explicit incomplete operation.
A code elsewhere in the document or an actor-only META-01 is insufficient.

Validation remains read-only. No source normalization, inferred metadata,
selection repair, new Envelope interpretation or financial arithmetic follows.
Existing receipt policy counts are calculated from the actual validation result;
this proposal adds no receipt refusal rule and changes neither subject/digest
construction nor accepted authentication/verdict precedence.

## Conformance impact

Independent pre-activation inspection of the original corpus at main
`0450ae57034d794a51dfa83fb41f9e0baaaa8019` found no admitted P1/P2/P3 failure.
The documents subset contains52 source files and171 decoded structured blocks;
existing `20-flat-meta`, `21-section-id-wrapper` and
`29-actor-shape-precedence` remain rejected-container controls, not new findings.
The pinned all-corpus inspection covered818 original sources:748 `.uwx.md`,
18 `.uwpart.md` and52 `.uw.md`;1,926 decoded JSON-object blocks contained1,519
admitted canonical metadata objects,403 whole-missing metadata objects and4
existing rejected shapes. No new predicate failed and no JSON decoding failed. A separate runtime comparison of739 parseable `.uwx.md` records (9 parser
refusals) found zero changed validation issue sequences or overall statuses.
No original source or expectation is changed.

Four newly authored malformed sources `30-meta-placement`, `31-meta-section`,
`32-meta-quality` and `33-meta-pass-order` add independent exact metadata-field,
multiplicity and complete-pass ordering assertions. Placement includes escaped
`_meta`, numeric-first negative and metadata-first/numeric-after positive peers.
Section covers seven invalid values plus matching unknown identity. Quality
covers six missing/nonobject forms, an empty object with its independent META-02,
and a complete positive peer. The combined control preserves the original wrapper
finding without a new field, followed by P1/P2/P3, actor and lifecycle findings.
Expected rows are authored from the accepted predicates, never generated by
bulk rebaselining. These are native Verifier cases; portable discovery and the111
existing portable validation cases are unchanged.

Required positive/negative controls:

- First `_meta` versus late `_meta`, with escaped decoded key, integer-like
  payload key, nested payload `_meta`, ordinary `content` payload and unknown data.
- Present null/empty/every wrong-type section; exact match, mismatch, absent
  section, unknown matching section and annotation/map/convenience disagreements.
- Absent/null/every nonobject quality; `{}`; valid quality with both literal
  review booleans; missing confidence and missing review child kept distinct.
- Each predicate alone and all combinations; wrapper/nested-container rejection,
  whole missing metadata, actor-only failure and independent annotation errors.
- Physical history, overwritten/default/named peers, append/extension blocks;
  distinct equal-valued blocks versus exact-reference duplicates.
- Current model mutations, added/replaced/removed projections, observable non-index key
  reordering, numeric-index boundaries/operation distinctions, copied models without retained inventory and stale raw/convenience
  values. Include nonportable member-order controls that schema cannot assert.
- Stable issue order, error/warning/info partitions, all stage readiness and
  coverage values, actual CLI stdout/stderr and exit behavior, unchanged input
  bytes, new receipt validation-policy counts and unchanged receipt precedence.

Any expectation change must be attributed to an accepted P1/P2/P3 error or its
derived result consequences, independently reviewed against the original input.
No bulk expectation update or weakening of a negative assertion is authorized.
The111 portable validation cases and applicable nonportable obligations remain
required before Python can advertise `validate`; this RFC does not close them all.

## Reference implementation

The synchronized TypeScript/Python implementation follows this acceptance:

- `packages/uwmd-verify/src/validator.ts` and tests: retain existing shape pass;
  add the bounded reference-union pass before actors/booleans. Parser-local
  member-order evidence may need private support in `parser.ts` and its tests.
- `implementations/python/uwmd_source_validation.py`, integrated validation
  provenance/core modules and their tests on the developing #354 branch: emit
  the same exact findings and reconcile only their owned local evidence.
- Format2.4–2.5, ProtocolIII.6a/V.3/XI, `protocol.ts` and remediation records,
  conformance and developer capability documentation synchronize. Audit the
  existing block schema's required/object/string predicates; do not invent a
  schema property for source order or edit admitted values merely for symmetry.

Private orchestration may distinguish exact-source and mutable-model operations;
source callers must not accidentally select the model order rule.

No new public export, diagnostic code, ValidationResult state or capability
claim is proposed. Reuse the existing `META-01` error contract. Python discovery
remains parse-only until the independent complete-validation gate is met.

## Alternatives considered

- **Active-only:** conflicts with every-block Format language and RFC0090/0091's
  retained-physical metadata applicability; silently exempts unselected peers.
- **One generic schema error:** expands far beyond the owner's three predicates,
  conflates allocated warnings with errors and erases requirement-specific bounds.
- **New META codes or broader META-02/03:** contrary to the owner-directed closed
  META-01 amendment; a missing parent is distinct from a malformed boolean child.
- **Treat every META-01 as a whole-container refusal:** suppresses independent
  actor/boolean findings when the only failure is placement or section identity.
- **Infer or repair metadata during validation:** changes the operation input and
  conceals absent declarations instead of reporting them.

## Unresolved questions

No additional owner selection is requested for applicability or pass placement:
D2/D3 follow the accepted precedent above and the owner accepted the complete
text on2026-10-18. Implementation must establish complete affected-case counts and
independent member-order/source-model evidence before activation. Other typed
metadata allocations and complete Python capability proof remain separate work.
RFC0085's retained-history authority and RFC0089's representation remain separate.

## Prior art

- [RFC0090](0090-provenance-actor-admission.md), especially D2/D3: closed actor
  allocation, complete shape checkpoint and operation-local reference authority.
- [RFC0091](0091-required-metadata-booleans.md): all-physical applicability,
  admitted-parent suppression, physical order and exact diagnostic ownership.
- [Format2.4–2.5](../../spec/UW_FORMAT_SPEC.md#24-data-block-annotation-syntax)
  and the [block schema](../../spec/schemas/uwmd-block.schema.json).
