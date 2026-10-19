---
rfc: 0095
title: Allocate bounded optional metadata and provenance-reference diagnostics
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

# RFC 0095: Allocate bounded optional metadata and provenance-reference diagnostics

## Summary

Propose two closed validation allocations: `META-05`/error for the optional
metadata and block-override predicates enumerated below, and `META-06`/error
for conditional agent identity presence and stated provenance-reference carrier
requirements. Preserve META-01/02/03/04, existing completeness warnings and SRC
vocabulary ownership. Use the accepted retained-physical/current-model operation.
Keep three decisions explicitly open: DQ-06's conflicting allocations, the exact
conditional-reference triggers and the `market_data_ref.as_of` reader domain.

**Draft only.** The owner authorized preparing this document, not accepting its
text, allocating codes in the live registry or activating an implementation.
No implementation, specification, schema, conformance expectation, manifest,
source selection, receipt or release behavior changes in this PR.

Owner direction,2026-10-18, with the exact question context:

> May I prepare a docs-only RFC 0095 from the concrete Issue #354 packet (https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6256947939)? It would propose closed META-05/06 allocations for the remaining optional metadata and conditional-reference requirements, leaving the DQ-06 collision, reference triggers and as_of domain as explicit owner choices. This authorizes drafting only; acceptance and activation remain separate.

> Approve docs-only RFC 0095 draft

## Motivation and verified authority

The [existing Issue354 packet](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6256947939)
records remaining local admission refusals separately from the accepted
META-01/02/03/04 contracts. Passing all111 portable validation cases does not
prove exhaustive Format admission or allocate a diagnostic for an unrelated
requirement. A schema rejection also does not automatically justify a validator
error, a typed parse refusal or a new generic fallback.

This draft is based on main
`8529af18ab1344e5d1b28ddc7cb378fe7911a5cf`, with accepted RFC0094 implementation
reviewed separately in [PR388](https://github.com/UWMD-OSP/UW-Markdown/pull/388).
The Python development checkpoint is
`54a44a3bde8bdca75e946b2f1801db672a18e095`; its local111-case result is development
evidence, not complete validation or Verifier certification. This document does
not claim a new corpus census, live error count or executed future conformance
result. Its examples are proposed controls, not changes to frozen expectations.

| Requirement or conflict | Current repository evidence |
|---|---|
| Optional provenance members | [Format2.5b](../../spec/UW_FORMAT_SPEC.md#25b-provenance--who-wrote-this-block-and-how-its-values-were-resolved) and `spec/schemas/uwmd-block.schema.json`: agent_id/agent_version/notes are string-or-null; agent_id is required when source matches agent/* |
| Optional quality and leaf overrides | Format2.5c/2.5f; block schema `UWMeta.quality` and top-level `_overrides`: typed flags/partial/provisional, forbidden quality.field_overrides and enumerated override members |
| Provenance references | Format2.5b and block schema: inherited_from and market_data_ref are conditional object carriers with explicit required members |
| Attribution versus readiness DQ-06 | RFC0022 implementation record and validator `checkDataQuality` allocate DQ-06/error to missing promoted-market attribution; RFC0028 and the protocol registry allocate DQ-06/info to declared-stage gaps |
| Trigger discrepancy | Format2.5b defines conditional requirements against canonical provenance.resolution; current `checkDataQuality` additionally observes override resolution=market_data_accepted |
| Vintage domain discrepancy | Block schema asserts as_of:string; `MarketDataRef` in `packages/uwmd-verify/src/types.ts` comments ISO YYYY-MM-DD; RFC0022 supplies dated examples without an exhaustive reader predicate |

Existing Python controls at the checkpoint include
`implementations/python/test_validation_metadata_admission.py`,
`test_validation_provenance.py` and the excluded-requirements control in
`test_metadata_leaves_0094.py`. They distinguish nullable values, presence,
reference carriers and unallocated local evidence. These WIP files are evidence
at that checkpoint; they are not claimed to be shipped on this RFC's main base.

## Proposed change

All MUST statements in this section specify the **proposed** contract after
owner acceptance and synchronized implementation. They are not active rules.

### Closed allocations and field attribution

Both proposed codes have severity `error`. Ordinary validation issues keep the
existing DTO without a `category` member; a corresponding `ProtocolError` uses
category `validate`. Identify the exact field, block section and failed
requirement. Preserve available variant/physical context without inventing a new
public issue shape. No coercion, normalization, inferred defaults or source repair.

#### META-05: optional metadata and override predicates

Emit only the following findings when their stated members are present. Absent
optional members remain valid; presence means an own member of the admitted
canonical parent. Null is a present value, admitted only where explicitly allowed.

| Fixed order | Field | Exact proposed invalid condition |
|---|---|---|
| 1 | `_meta.provenance.agent_id` | Present and neither a string nor null |
| 2 | `_meta.provenance.agent_version` | Present and neither a string nor null |
| 3 | `_meta.provenance.notes` | Present and neither a string nor null |
| 4 | `_meta.quality.flags` | Present and not an array; otherwise each non-string element at `_meta.quality.flags[i]` |
| 5 | `_meta.quality.partial` | Present and not a boolean |
| 6 | `_meta.quality.provisional` | Present and not a boolean |
| 7 | `_meta.quality.field_overrides` | Present, regardless of value; leaf exceptions belong in block-level `_overrides` |
| 8 | `_overrides` | Present and not an array; otherwise assess each entry in array order as specified below |

For an admitted override array, emit one META-05 at `_overrides[i]` for a
nonobject entry (including null and arrays) and suppress that entry's children.
For an object entry, assess in this order:

1. `_overrides[i].path`: absent or not a string.
2. `_overrides[i].confidence`: present and not exactly `high`, `medium` or `low`.
3. `_overrides[i].reason`: present and not exactly `illegible`, `missing`,
   `overridden`, `estimated` or `computed`.
4. `_overrides[i].note`: present and not a string.

An invalid array container receives one parent finding, not child findings.
An admitted array receives one finding per invalid element/member in the stated
order. An invalid path does not suppress independent confidence/reason/note.
Unknown members remain admitted by these predicates. Empty strings, duplicate
paths and strings without a matching payload field gain no new rejection.
This RFC does not define a path parser or a target-existence requirement.

The `source` and `resolution` vocabulary predicates retain SRC-01/02/03
ownership. META-05 MUST NOT duplicate them or silently claim an unimplemented
SRC predicate is already discharged. Auditing override vocabulary applicability
and exact field attribution remains an implementation gate; this draft does not
allocate a second code for the same requirement. No semver grammar is added for
agent_version, no flag vocabulary is closed and `_notes` remains outside this
allocation. In particular, `_notes` is not provenance.notes: its existing
"never validated" annotation is not overridden here.

#### META-06: agent presence and provenance-reference carriers

After completing the entire META-05 pass, assess each block in the same union
order. Within each block use agent_id, inherited_from, market_data_ref order.

- If the admitted canonical source is a valid `agent/<id>` under the accepted
  actor-source grammar, emit one META-06 at `_meta.provenance.agent_id` only
  when that own member is **absent**. Present null and exact-empty string satisfy
  presence. A present wrong type belongs only to META-05. Do not derive an actor,
  compare agent_id to the source suffix or impose an identity vocabulary.
  An invalid source keeps its SRC/other existing ownership; do not infer this
  conditional requirement from an unparsed prefix or override source.
- A stated inherited_from or market_data_ref MUST be a non-null non-array
  object. For an invalid present carrier emit one META-06 at the carrier field
  and suppress its descendants. A required-but-absent carrier receives one
  finding at that same parent field **under the trigger selected in U2**.
  Optional absent carriers receive no finding. Stated carriers are checked
  even when their matching resolution is not selected.
- For an admitted inherited_from object, assess required document_id:string,
  digest:exact `sha256:` followed by64 lowercase ASCII hexadecimal digits,
  then distance:finite JSON integer at least1. Missing members and invalid
  members each yield one finding at the exact child path in that order.
  No safe-integer ceiling, graph lookup, hop recomputation or network fetch
  is added. Python booleans are not integers.
- For an admitted market_data_ref object, assess required document_id:string,
  as_of under **U3**, digest with the same exact lexical predicate, then optional
  rationale:string in that order. Missing required members receive their own
  child finding; present null is not a string. Unknown members remain admitted.

The schema has no minLength for document_id or rationale: the draft does not
add one. For as_of, empty-string admission depends on U3 and is not decided by
this direction. A carrier digest is a stated reference identifier; validating
its lexical shape does not authenticate the referenced document or establish
that its contents are available, current or financially valid.

### Parents, independent findings and pass placement

Retain accepted whole-missing-metadata and malformed wrapper/provenance/lifecycle
precedence. Rejection of those parents suppresses only the new canonical
metadata-descendant predicates rather than cascading child findings. Top-level
_overrides is a sibling annotation, not a metadata descendant: assess its own
container/entry predicates independently on an admitted block object, including
when _meta is absent or rejected. A missing _meta with _overrides:[null] keeps
its old metadata finding and the new annotation-entry finding. Do not reinterpret
another unallocated condition as owned by that shape error.

A missing/nonobject quality container keeps RFC0093's META-01 and suppresses
only quality-dependent META-05 predicates. Admitted provenance and top-level
_overrides remain independent. An invalid agent_id does not suppress references;
a META-02/03/04 or actor finding does not suppress these new predicates. A
present forbidden field_overrides does not substitute for lawful _overrides.
Later validators must tolerate rejected annotation containers/entries without
throwing or dereferencing null. Current metadata.ts only guards the array
container in blockOverrides; checkDataQuality's o.resolution read is not an
entry shape guard. Add joint regression controls rather than treating a crash
as an accepted refusal. The existing typed data-quality predicates remain the
authority: malformed truthy optional values do not establish literal true. Audit
TypeScript truthiness versus Python literal-true behavior rather than copying
runtime discrepancies into governed expectations.
Existing data-quality consequences keep their predicates and order unless U1
expressly changes the conflicting promoted-reference allocation.

Complete old shape, RFC0093 placement/section/quality, actor, META-02/03 and
META-04 passes first. Then complete all META-05 findings across the union;
then all META-06 findings; then run existing role/period/source checkpoints and
the remaining validators in their existing relative order. Do not globally
sort issues or interleave these passes with per-block old findings. U1 must
explicitly disposition removal/reallocation of the later DQ-06/error; no
second hidden duplicate of that condition may be introduced.

### Population and operation authority

Use RFC0090/0091/0093/0094's retained-physical plus current-model identity union.
Visit retained physical references in source order, including current, history,
overwrites, variants, append and extension blocks. Then visit model-only
references in sections, superseded, pipeline_log, custom_calculations,
custom_scenarios, extensions order, preserving collection order. Deduplicate
only exact object identity, not value equality, key, digest or revision.

For SOURCE, freshly parse the actual operation input; for resolved composition,
retain the original root and actual consumed parts before reduction/metadata
stripping, excluding unrelated loaded files. The assembled financial projection
stays separate; synthesized blocks are current MODEL references. Do not join
independent full validation arrays or select arbitrary peers to conceal errors.

For mutable MODEL, read current canonical content/annotation from that union,
including in-place mutation and replacement/addition. Do not use stale raw JSON,
divergent convenience metadata or inferred lost physical coverage. Without the
parser inventory assess supplied collections only. Lite and other representations
retain their accepted compilation/model boundaries. No retained-history authority
or compaction decision from draft RFC0085 is presumed.

### Results, transport and scope boundaries

The new findings would enter ordinary issue/error partitions and derived
validation status, displays and CLI exits. A local completeness assessor may
consume only evidence owned by the exact allocated predicate, block reference
and path. An unrelated error elsewhere is not ownership. Preserve local evidence
for requirements this RFC does not allocate or whose choice remains unresolved.

Structural invalidity is distinct from unsupported composition and unavailable
reference sources. Malformed JSON keeps accepted Reader refusal behavior; valid
JSON with bad metadata is not relabelled as a parse error. Carrier validation
performs no external resolution. No new validation result state, receipt verdict,
issuance policy, wire schema, digest construction, signing rule or authentication
precedence is proposed. Actual validation policy counts may reflect the accepted
new errors after implementation; authenticate/recompute rules remain separate.
Validation is read-only and MUST NOT fabricate or repair metadata.

Unrelated integrity/schema/financial requirements, timestamp annotations outside
RFC0094, lease termination admission and all unallocated section predicates
remain separate. This is not a generic schema-to-error allocation or complete
Python validation/Verifier certification. Discovery stays parse-only until its
independent complete capability gate passes.

## Decisions from precedent and unresolved owner choices

| Call | Draft disposition | Evidence |
|---|---|---|
| D1 | Two closed META codes, error, ProtocolError category validate only | Accepted RFC0094 allocation/transport pattern |
| D2 | All retained physical/current-model references and source composition accounting | RFC0090/0091/0093/0094 |
| D3 | Complete META-05 then META-06 after META-04, before role/period/source | Existing metadata pass pattern; no global sort |
| D4 | String-or-null is literal; agent presence does not imply nonempty | Format2.5b and block schema |
| D5 | Source/resolution keep SRC ownership; no generic schema fallback | RFC0031 and closed META-01–04 allocations |
| D6 | Reuse exact schema carrier domains except the unresolved as_of choice | Block schema plus explicit U3 boundary |

### U1 — DQ-06 attribution/readiness collision: OPEN

RFC0022's implementation record and current checkDataQuality use DQ-06/error
for an absent/falsy promoted-market reference. RFC0028 and the live registry use
DQ-06/info for missing declared-stage sections. Both behaviors exist; the
attribution condition is **not an unallocated requirement**.

Recommended decision for review: retain DQ-06/info exclusively for stage
readiness and move only promoted-reference attribution into META-06 under the
chosen U2 trigger. Remove the duplicate attribution emission, retaining its
requirement and error severity. Precisely separate absent from invalid-present
carriers: null/false become invalid carrier shape, not an invented default.
Stage readiness, CC-14 suppression and unrelated DQ ordering stay unchanged.
The current attribution check walks parsed.sections/current variants, excluding
history, overwritten peers, append and extension collections. The proposed
META-06 pass uses the full retained-physical/current-model union: this is an
explicit population expansion requiring acceptance, not merely a code rename.
Inventory the newly assessed population independently before activation.
The resulting code/path/population/ordering changes require explicit governed acceptance
and synchronized tests; they are not authorized by drafting approval.

Alternative: retain DQ-06/error for attribution and allocate a separate
readiness code, amending RFC0028, registry, displays and applicable assertions.
Retaining one code with unrelated severities/meanings would require an explicit
contract rather than silently treating the current collision as intentional.

### U2 — conditional reference triggers: OPEN

Format2.5b says canonical provenance.resolution triggers the two requirements.
Current runtime additionally tests any _overrides[].resolution for
market_data_accepted; an analogous inherited-only override trigger is not equally
specified/enforced. Ordinary override precedence does not settle whether every
stated but shadowed override creates a whole-block carrier obligation.

Choose the complete domain explicitly: canonical resolution only; or canonical
plus defined override assertions for both references; or another precisely
bounded rule. Define empty/invalid override entries, duplicate/shadowed paths,
unselected peers and history consistently with the new all-physical population.
Do not infer a market-only/inheritance-only asymmetry or introduce reference
fetching. The draft carrier-shape checks on stated references are independent
of this required-absence decision. Final acceptance text must pin the triggers
and exact duplicate suppression.

### U3 — market_data_ref.as_of: OPEN

Choose string-only admission as asserted by the current schema, or an explicit
calendar reader domain with joint Format/Protocol/schema synchronization.
The MarketDataRef YYYY-MM-DD comment and dated examples are not by themselves
an exhaustive reader grammar. The referenced market-data artifact has its own
calendar admission in uw-market-data.schema.json and market-data.ts; this does
not silently strengthen the reference carrier's as_of assertion. If calendar admission is selected, specify whole
string, ASCII digits, year range/year zero, Gregorian validity, null/absence,
no trimming/normalization and independent cross-runtime vectors before acceptance.
Do not reuse RFC0094's timestamp T1B for a date-only field or a host date parser.

## Conformance impact and evidence gates

No fixture, expected result or original source changes in this draft. No fixed
impact count is asserted. Before acceptance/activation, independently inventory
every live requirement owner and source population at the final implementation
base; distinguish intentionally invalid cases, positive documents, output
templates and focused financial tests. The earlier27-schema audit is not27
new error allocations. Original111 portable validate expectations remain the
current authority unless a separately reviewed attributed change is approved.

Implementation must provide these focused authored controls and independent
expected arrays, with the selected U1–U3 rules frozen before activation:

| Group | Required positive/negative evidence |
|---|---|
| Nullable optional members | Absent/null/empty/ordinary string accepted; booleans/numbers/objects/arrays rejected at each exact field; no invented version or identity grammar |
| Agent presence | Valid agent source with absent/null/empty/wrong-type agent_id; manual/nonagent/invalid source; override source alone does not create the canonical condition |
| Quality | Each optional member absent; true/false; flags empty/string items/each invalid element; null containers; any field_overrides value including null |
| Override annotation | Absent/empty array; each bad parent/entry; missing and typed path; full confidence/reason domains; note null; unknown members/empty and duplicate paths; independent SRC attribution; null entries cannot crash later DQ checks |
| Reference shapes | Each optional absence and required absence under U2; null/array/scalar/object; each missing/wrong-type child; exact digest anchors/case/length/trailing newline; distance0/1/1.0/fraction/bool/large integer; unknown members |
| Owner choices | Both DQ-06 conditions together, stage suppression and exact attribution; canonical-only and override-only reference triggers; shadowed/duplicate paths; as_of vectors selected under U3 |
| Parent/order | Whole missing/rejected metadata with independently invalid sibling _overrides; invalid quality independent of provenance; META-01/02/03/04 unchanged; complete META-05 then META-06 then unrelated checkpoints |
| Physical/model/composed | History, overwritten and extension peers, append and unselected variants; identity dedup; equal distinct objects; in-place mutation, replaced/added blocks; fresh SOURCE, current MODEL, root/consumed parts and unused loaded files |
| Transport/integrity | Exact issue fields/partitions/status and actual CLI stdout/stderr/exits; unsupported/unavailable source distinctions; byte preservation; receipt policy counts with unchanged subject/authentication/verdict procedures |

Freeze independent TypeScript/Python observations at exact heads and retain
platform identity. A successful focused run does not establish a full capability.
Required final-head CI follows ordinary integration gates. No rebaseline is
authorized merely to make Python pass.

## Reference implementation plan

After owner acceptance only, synchronize Format2.5b/c/f, ProtocolIII.6a/XI,
the executable registry/remediation, applicable schema annotations and any
assertions explicitly selected by U1–U3, plus TypeScript and independent Python.
Expected implementation sites are `packages/uwmd-verify/src/validator.ts`,
`protocol.ts` and metadata types; Python `uwmd_source_validation.py`, `uwmd_validation_provenance.py` and the
complete validation ledger/core; authored conformance cases/portable transport assertions.

Reuse current physical/reference accounting, not divergent parallel parsers.
Keep standalone evidence ownership separate from ordinary result projection.
Audit current producer obligations and live consumer outputs without fabricating
metadata. No new public function, CLI command, diagnostic DTO property, financial
procedure, schema fallback or capability promotion is needed for this allocation.
Implementation code and changes to governing contracts are outside this PR.

## Alternatives considered

- Extend META-01 or META-04: obscures their owner-accepted closed predicates.
- Emit one generic schema error: conflates missing diagnostics with composition,
  source availability, optional annotations and requirements owned by other codes.
- Treat bad metadata as a parse refusal: misclassifies admitted JSON and erases
  the ordinary validation/error transport boundary.
- Infer missing identity/reference/defaults or fetch external data: changes the
  stated record and exceeds read-only validation.
- Activate the uncontroversial rows while leaving U1–U3 implementation-defined:
  leaves cross-implementation results undefined; final acceptance needs exact text.

## Prior art

The repository's accepted RFC0090/0091/0093/0094 metadata allocations establish
closed predicates, source/model authority and deterministic pass order. Accepted
RFC0021/0022 establish attributable reference records; RFC0028 establishes stage
readiness; RFC0031 separates source identity and resolution. The block JSON
Schema separates presence, nullability, item types and unknown-member admission;
those assertions must be reconciled with their validation owners, not translated
indiscriminately into new errors.
