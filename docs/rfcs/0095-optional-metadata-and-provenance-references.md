---
rfc: 0095
title: Allocate bounded optional metadata and provenance-reference diagnostics
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

# RFC 0095: Allocate bounded optional metadata and provenance-reference diagnostics

## Summary

Allocate two closed validation diagnostics: `META-05`/error for the optional
metadata and block-override predicates enumerated below, and `META-06`/error
for conditional agent identity presence and stated provenance-reference carrier
requirements. Preserve META-01/02/03/04, existing completeness warnings and SRC
vocabulary ownership. Use the accepted retained-physical/current-model operation.
**Accepted by the owner, 2026-10-18.** See [Resolution](#resolution).

## Motivation and verified authority

The [existing Issue354 packet](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6256947939)
records remaining local admission refusals separately from the accepted
META-01/02/03/04 contracts. Passing all111 portable validation cases does not
prove exhaustive Format admission or allocate a diagnostic for an unrelated
requirement. A schema rejection also does not automatically justify a validator
error, a typed parse refusal or a new generic fallback.

The original reviewed draft was `cf3112951537fe0b69f1f06239fcc3330e6303c6`.
This revision is based on current main
`fa9a9ea37d31b918f5993eae4276b159f31719f3`, with accepted RFC0094 implementation
reviewed separately in [PR388](https://github.com/UWMD-OSP/UW-Markdown/pull/388).
The Python development checkpoint is
`54a44a3bde8bdca75e946b2f1801db672a18e095`; its local111-case result is development
evidence, not complete validation or Verifier certification. The read-only population inventory and isolated date controls below are
research evidence, not a live error count or executed future conformance result.
Authored controls do not change frozen expectations.

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

## Accepted contract

All MUST statements in this section define the accepted contract for the
synchronized implementation. This docs-only acceptance does not activate runtime
predicates or change governing specifications, schemas or frozen expectations.

### Closed allocations and field attribution

Both allocated codes have severity `error`. Ordinary validation issues keep the
existing DTO without a `category` member; a corresponding `ProtocolError` uses
category `validate`. Identify the exact field, block section and failed
requirement. Preserve available variant/physical context without inventing a new
public issue shape. No coercion, normalization, inferred defaults or source repair.

#### META-05: optional metadata and override predicates

Emit only the following findings when their stated members are present. Absent
optional members remain valid; presence means an own member of the admitted
canonical parent. Null is a present value, admitted only where explicitly allowed.

| Fixed order | Field | Exact invalid condition |
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
and exact field attribution remains an implementation gate; this RFC does not
allocate a second code for the same requirement. No semver grammar is added for
agent_version, no flag vocabulary is closed and `_notes` remains outside this
allocation. In particular, `_notes` is not provenance.notes: its existing
"never validated" annotation is not overridden here.

#### META-06: agent presence and provenance-reference carriers

After completing the entire META-05 pass, assess each block in the same union
order. Within each block use agent_id, inherited_from, market_data_ref order.
Own-member authority also applies to carriers, required/optional carrier children
and the canonical resolution/source used by conditional triggers. Inherited
prototype properties neither satisfy a required member nor create a trigger.
SOURCE uses decoded JSON members; MODEL uses current own canonical members.
A stated malformed reference remains independently invalid without a matching
resolution; U2 decides required absence, not whether stated carriers are checked.

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
  finding at that same parent field **under U2's stated-assertion trigger**.
  Optional absent carriers receive no finding. Stated carriers are checked
  even when their matching resolution is not selected.
- For an admitted inherited_from object, assess required document_id:string,
  digest:exact `sha256:` followed by64 lowercase ASCII hexadecimal digits,
  then distance:finite JSON integer at least1. Missing members and invalid
  members each yield one finding at the exact child path in that order.
  No safe-integer ceiling, graph lookup, hop recomputation or network fetch
  is added. Python booleans are not integers.
- For an admitted market_data_ref object, assess required document_id:string,
  as_of under the exact **U3** date-only domain, digest with the same exact lexical predicate, then optional
  rationale:string in that order. Missing required members receive their own
  child finding; present null is not a string. Unknown members remain admitted.

The schema has no minLength for document_id or rationale: this RFC does not
add one. For as_of, null and exact-empty string are invalid under U3; an admitted
carrier missing this required member receives one child finding. A carrier digest is a stated reference identifier; validating
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
Existing data-quality consequences keep their predicates and relative order,
except that U1 removes the old promoted-reference DQ-06/error emission and
assigns its requirement to the earlier META-06 pass.

Complete old shape, RFC0093 placement/section/quality, actor, META-02/03 and
META-04 passes first. Then complete all META-05 findings across the union;
then all META-06 findings; then run existing role/period/source checkpoints and
the remaining validators in their existing relative order. Do not globally
sort issues or interleave these passes with per-block old findings. Remove the
later attribution DQ-06/error under U1; it MUST NOT also emit for a requirement
already discharged in META-06. Readiness DQ-06/info and CC-14 suppression stay
in their existing pass positions.

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

The implemented findings enter ordinary issue/error partitions and derived
validation status, displays and CLI exits. A local completeness assessor may
consume only evidence owned by the exact allocated predicate, block reference
and path. An unrelated error elsewhere is not ownership. Preserve local evidence
for requirements this RFC does not allocate.

Structural invalidity is distinct from unsupported composition and unavailable
reference sources. Malformed JSON keeps accepted Reader refusal behavior; valid
JSON with bad metadata is not relabelled as a parse error. Carrier validation
performs no external resolution. No new validation result state, receipt verdict,
issuance policy, wire schema, digest construction, signing rule or authentication
precedence is introduced. Actual validation policy counts may reflect the accepted
new errors after implementation; authenticate/recompute rules remain separate.
Validation is read-only and MUST NOT fabricate or repair metadata.

Unrelated integrity/schema/financial requirements, timestamp annotations outside
RFC0094, lease termination admission and all unallocated section predicates
remain separate. This is not a generic schema-to-error allocation or complete
Python validation/Verifier certification. Discovery stays parse-only until its
independent complete capability gate passes.

## Accepted decisions from precedent and owner direction

| Call | Accepted disposition | Evidence |
|---|---|---|
| D1 | Two closed META codes, error, ProtocolError category validate only | Accepted RFC0094 allocation/transport pattern |
| D2 | All retained physical/current-model references and source composition accounting | RFC0090/0091/0093/0094 |
| D3 | Complete META-05 then META-06 after META-04, before role/period/source | Existing metadata pass pattern; no global sort |
| D4 | String-or-null is literal; agent presence does not imply nonempty | Format2.5b and block schema |
| D5 | Source/resolution keep SRC ownership; no generic schema fallback | RFC0031 and closed META-01–04 allocations |
| D6 | Reuse exact carrier domains except the expressly selected U3 date predicate | Block schema plus explicit U3 boundary |

### U1 — DQ-06 split: ACCEPTED OWNER DECISION

DQ-06/info MUST mean stage readiness only. Promoted-reference attribution moves
to META-06/error under U2; remove the old attribution emission from
`checkDataQuality`. Its separate carrier-shape and child checks stay in META-06.
No readiness predicate, CC-14 property suppression, severity or unrelated issue
ordering changes. There is no DQ-06/error alias or duplicate attribution output.

This is more than a code rename: the current attribution check visits
`parsed.sections` and current variants, whereas META-06 visits the full exact
identity union. History, overwritten peers, append and extension blocks can
therefore become newly assessed. The U2 inheritance trigger is symmetric with
market attribution, and supplied mutable MODEL records are assessed using their
current own members. Inventory this population and report it to the owner before
activation. A raw source candidate is not automatically an admitted operation;
rejected inputs and unavailable/unconsumed composition parts must be separated.

### U2 — symmetric stated-assertion triggers: ACCEPTED OWNER DECISION

For each distinct admitted block identity, independently determine these two
boolean obligations from current own members:

| Required carrier | Trigger tag |
|---|---|
| `_meta.provenance.inherited_from` | `inherited_assumption` |
| `_meta.provenance.market_data_ref` | `market_data_accepted` |

For either row the trigger is true when the admitted canonical
`_meta.provenance.resolution` equals its tag **or** any object entry in the stated
block-level `_overrides` array has an own `resolution` equal to that tag.
Inherited prototype members are not assertions. Nonobject entries cannot assert
a resolution and retain only their independent META-05 entry error. Invalid
source/resolution vocabularies keep their SRC ownership; no coercion or prefix
matching creates a trigger.

This is assertion accounting, not effective leaf-metadata selection. An
object's missing, invalid, exact-empty, duplicate, unmatched or shadowed `path`
does not erase its own resolution assertion. Its independent META-05 path
finding, when required, remains. No path parser, target-existence check or
last/first-winner selection is introduced for attribution. An assertion in a
later override cannot retract an earlier assertion, including a different tag
at the same path. Canonical inheritance plus an override market assertion
therefore requires both carriers. This deliberately removes the current
market-only override asymmetry.

Collapse all matching assertions for a block/carrier to one boolean obligation.
Emit the missing carrier finding once at its canonical carrier field, never once
per assertion/path. A present null/scalar/array carrier produces its one shape
finding instead of an additional absence finding. An admitted object receives
its ordered child findings once. This also suppresses duplicate diagnostics for
shared physical/model object identity; equal distinct blocks remain distinct.
Optional stated carriers are still validated without a matching trigger.

Existing malformed-wrapper/provenance parent precedence continues to suppress
its metadata descendants, even if a sibling override states a tag. Assess the
sibling override's own shape and annotation predicates independently, but do not
invent a provenance parent or cascade carrier findings beneath a rejected parent.
RFC0090/0091/0093 physical/current-model authority and SOURCE composition
accounting apply identically to both references; no external reference fetching,
hop inference or source-repair behavior is added.

Proposed trigger controls below assume the canonical parent shape is admitted
and both carriers are absent; counts name only the new carrier findings:

| Canonical resolution | Stated override assertions (array order) | Required findings |
|---|---|---|
| market_data_accepted | none or repeated market tags | One market_data_ref parent error |
| absent | inherited_assumption | One inherited_from parent error |
| inherited_assumption | market_data_accepted | inherited_from, then market_data_ref |
| absent | same path: market_data_accepted then user_input | One market_data_ref; later assertion does not retract it |
| absent | same path: user_input then market_data_accepted | One market_data_ref; order does not change the obligation |
| absent | same path: inherited_assumption, market_data_accepted, user_input | inherited_from, then market_data_ref; one each |
| absent | missing/non-string path with own market_data_accepted | One market_data_ref plus the independent META-05 path error |
| absent | null entry followed by own market_data_accepted | One market_data_ref plus one META-05 entry error, no crash |
| absent | MODEL prototype-only resolution | No required-carrier finding; optional stated carriers still checked |

### U3 — market reference calendar date: ACCEPTED OWNER DECISION

A stated `market_data_ref.as_of` MUST be a string containing exactly ten ASCII
characters `YYYY-MM-DD`: four ASCII year digits, two month digits, two day digits,
and the two literal hyphens. The year MUST be 0001–9999. Validate the proleptic
Gregorian month/day, including the divisible-by-4, except-divisible-by-100,
unless-divisible-by-400 leap-year rule. Whole-string matching is required;
reject leading/trailing whitespace, line terminators, Unicode digits, reduced
widths, signs, year zero, timestamps, offsets, week dates and invalid dates.
Never trim, coerce, repair or normalize the stated value.

The carrier semantics remain explicit: an absent optional market_data_ref gives
no error; an absent carrier when U2 requires it gives one parent META-06/error;
a present null/nonobject carrier gives its parent shape finding. An admitted
carrier with absent, null or invalid as_of gives one child META-06/error at
`_meta.provenance.market_data_ref.as_of`, in document_id/as_of/digest/rationale
order. Calendar validity does not authenticate or fetch the referenced artifact.

This is a date-only field. Do not reuse RFC0094's T1B timestamp domain, which
admits year0000 and has time components. Do not tighten unrelated calendar
fields or call a permissive host string-date parser. A lexical end anchor alone
does not establish U3's Gregorian validity and selected year domain.

#### Joint Format, Protocol and schema activation text

Under this RFC, one synchronized activation changeset MUST:

1. Amend Format2.5b's two conditional table rows and following canonical-only
   sentence to the complete U2 assertion rule, with the exact carrier child
   domains and U3 as_of predicate. Format2.5f leaf-wins behavior is unchanged;
   it does not select attribution assertions away.
2. Amend ProtocolIII.6a/XI, executable registry and remediation for META-05/06,
   DQ-06/info-only, the fixed pass/field ordering, source/model/shape authority
   and exact U2/U3 predicates. Remove only the old attribution DQ-06/error.
3. Amend `spec/schemas/uwmd-block.schema.json`: retain the existing object types,
   required members, nullability and unknown-member admission; describe both
   canonical and override triggers on inherited_from/market_data_ref; assert
   conditional presence symmetrically for both at the root (sibling `_overrides`
   cannot be inspected from a provenance-only local subschema). The admitted
   canonical parent guard MUST precede conditional descendant requirements.
   Add a reusable `$defs/MarketReferenceDate` with the exact schema below and
   reference it from `$defs/UWMeta/properties/provenance/properties/market_data_ref/properties/as_of`.
   The calendar assertion MUST NOT depend on optional `format` plugin support.
   Both existing reference-digest patterns must likewise use an absolute end
   guard for the accepted exact `sha256:` plus64 lowercase ASCII hex
   predicate; a trailing newline is not a lawful digest. No other digest
   construction, identity or authentication rule changes.
4. Synchronize TypeScript, independent Python, authored positive/negative
   conformance controls and explicitly attributed expectation changes. Test
   schema/Format/Protocol admission jointly; no runtime-only stricter domain.

Accepted `$defs/MarketReferenceDate` assertion for synchronized activation:

```json
{
  "type": "string",
  "pattern": "^(?!0000)(?:[0-9]{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])|(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)|02-(?:0[1-9]|1[0-9]|2[0-8]))|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)-02-29)(?![\\s\\S])",
  "description": "Whole ASCII YYYY-MM-DD, valid Gregorian date, years 0001–9999; no trimming or normalization. RFC 0095 U3."
}
```

The final negative lookahead is an absolute end guard, including line
terminators. In ECMAScript an unflagged `$` also requires the end of input; a
match before a line terminator requires multiline mode. See the primary
[CompileAssertion specification, Assertion :: $, step6](https://tc39.es/ecma262/multipage/text-processing.html#sec-compileassertion).
This corrects the earlier explanatory claim only: the accepted lookahead patterns,
predicates, frozen89-reference inventory and date vectors are unchanged, with
no activation or contract change.
The regex admits only the selected year/month/day domain, including century
leap cases. Independent TS/Python vectors and schema-predicate comparisons are
required below. No governing spec/schema, registry, runtime or frozen expected
result is changed by this docs-only acceptance.

## Conformance impact and evidence gates

No fixture, expected result or original source changes in this acceptance PR. The
read-only inventory below reports measured source populations, not a future
validation or conformance error total. Before activation, independently inventory
every live requirement owner and source population at the final implementation
base; distinguish intentionally invalid cases, positive documents, output
templates and focused financial tests. The earlier27-schema audit is not27
new error allocations. Original111 portable validate expectations remain the
current authority unless a separately reviewed attributed change is approved.

Implementation must provide these focused authored controls and independent
expected arrays, with the owner-selected U1–U3 rules frozen before activation:

| Group | Required positive/negative evidence |
|---|---|
| Nullable optional members | Absent/null/empty/ordinary string accepted; booleans/numbers/objects/arrays rejected at each exact field; no invented version or identity grammar |
| Agent presence | Valid agent source with absent/null/empty/wrong-type agent_id; manual/nonagent/invalid source; override source alone does not create the canonical condition |
| Quality | Each optional member absent; true/false; flags empty/string items/each invalid element; null containers; any field_overrides value including null |
| Override annotation | Absent/empty array; each bad parent/entry; missing and typed path; full confidence/reason domains; note null; unknown members/empty and duplicate paths; independent SRC attribution; null entries cannot crash later DQ checks |
| Reference shapes | Each optional absence and required absence under U2; null/array/scalar/object; each missing/wrong-type child; exact digest anchors/case/length/trailing newline; distance0/1/1.0/fraction/bool/large integer; unknown members |
| Owner choices | Both DQ-06 conditions together, stage suppression and exact attribution; canonical-only and override-only reference triggers; shadowed/duplicate paths; as_of vectors selected under U3 |
| Parent/order | Whole missing/rejected metadata with independently invalid sibling _overrides; invalid quality independent of provenance; META-01/02/03/04 unchanged; complete META-05 then META-06 then unrelated checkpoints |
| Physical/model/composed | History, overwritten and extension peers, append and unselected variants; identity dedup; equal distinct objects; in-place mutation, replaced/added blocks and own-versus-prototype carriers/children/triggers; fresh SOURCE, current MODEL, root/consumed parts and unused loaded files |
| Transport/integrity | Exact issue fields/partitions/status and actual CLI stdout/stderr/exits; unsupported/unavailable source distinctions; byte preservation; receipt policy counts with unchanged subject/authentication/verdict procedures |

Freeze independent TypeScript/Python observations at exact heads and retain
platform identity. A successful focused run does not establish a full capability.
Required final-head CI follows ordinary integration gates. No rebaseline is
authorized merely to make Python pass.

### Read-only pre-activation attribution inventory

Exact source/implementation authority is main
`fa9a9ea37d31b918f5993eae4276b159f31719f3`. The independently authored
[population review and all49 newly assessed source paths](https://github.com/UWMD-OSP/UW-Markdown/blob/1580d3357c0ab1b958b8fcdd89d1ad49ba6be738/docs/reviews/2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.md)
and its linked JSON/compressed trace identify every input hash, block origin,
parent gate, canonical/override assertion and rejection. The observer compiles
exact Git runtime sources and executes the actual old checkDataQuality function;
it does not use stale dist or activate the candidate. A separately written
second observer independently reproduces the standalone counts and new rows.

| Measured standalone population | Count |
|---|---:|
| Tracked recognized `.uwx.md`, `.uwpart.md`, `.uw.md` sources | 880 |
| Sources reaching the fenced parser | 816 |
| Earlier typed parser refusals | 9 |
| Lite sources outside authored fenced-block counting | 55 |
| Retained-physical/current-model union | 2,238 |
| Existing sections/current-variant attribution population | 2,149 |
| Newly assessed references / source paths | 89 /49 |
| New references with admitted canonical parents | 87 |
| New references retaining earlier parent precedence | 2 |
| Observed new reference-carrier findings | 0 |

The89 references are22 history/superseded,15 pipeline-log,7 custom-calculation,
6 custom-scenario,22 extension and17 physically retained references lost from
projection. Current named variants already belong to the old pass and are not
all newly assessed. Exact object identity, not content equality, deduplicates.
The two earlier-parent cases remain
`conformance/hedge/0070-superseded-source/deal.uwx.md:63` (whole metadata absent)
and `conformance/documents/malformed/33-meta-pass-order.uwx.md:80` (retired wrapper).

The new population comprises66 references in37 conformance files,17 in10 example
files and6 in2 download templates. The review distinguishes33 references in
explicit malformed/reject locations,33 other conformance references without an
inferred metadata-validity promise,16 ordinary example references,1 path-inferred
negative example and6 template references. Template presence is not observed
writer output. No assertion is weakened or expectation inferred from these labels.

Composition is a separate operation census, **not additive** to unique repository
records:12 local-directory attempts give7 resolved operations,3 unresolved and
2 part-load/admission refusals. The resolved operations retain12 root and21
consumed-part physical references, plus7 synthesized current-model references
(union40; old sections12; newly assessed28 original references). Unused loaded
parts are excluded. Local parts-directory association is explicitly a packaging
assumption rather than a corpus-wide resolver. Of38 standalone fragments,36 pass
part admission and2 are separately refused; parsing a fence does not prove a
usable composition input.

The only tracked promoted-reference assertion is
`conformance/market-data/promote/explicit/deal-after-promotion.uwx.md:9`; its
market_data_ref is structurally valid and its `2026-06-30` date satisfies U3.
No tracked block states an inheritance assertion/carrier. The old runtime emits
zero attribution DQ-06/errors on these parsed sources; the new reference pass
likewise observes zero carrier failures. Sparse positive coverage requires the
new negative, non-string-tag, duplicate/shadowed, history, MODEL and transport controls; it is
not evidence of full implementation. Seventeen separately authored census controls
pass, including the existing null-override TypeError as an observed current
failure, not an approved refusal or a new expectation.

This inventories **reference attribution**, not all META-05/06 optional-field or
conditional-agent-id effects, all validation results, live producer emissions,
ZIP members, generated Lite models or embedded unit-test source strings. The
census checks as_of string shape; the independently tested U3 calendar domain
and explicit check of the one observed carrier are separate evidence. Do not
claim a zero total RFC0095 conformance impact from zero observed reference
failures. Re-run the attribution inventory at the actual activation base,
including separately pending RFC0094 implementation, and review any expectation
delta before activation. No current source/fixture/expected result is changed.

### Executed independent date-only evidence (isolated research)

The isolated review files use the existing
`docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only` stem.
They are not imported by a production parser, validator or schema registry.
The independently authored [Python reference](https://github.com/UWMD-OSP/UW-Markdown/blob/5667d100be1eebdcb1fe494a9086cd4361518934/docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.py)
and [TypeScript reference](https://github.com/UWMD-OSP/UW-Markdown/blob/5667d100be1eebdcb1fe494a9086cd4361518934/docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.ts)
share manually authored frozen inputs, not implementation logic. The Python
procedure uses ASCII character arithmetic; TS independently uses an exact-width
ASCII grammar and calendar arithmetic. Neither uses a string-date parser,
current clock or RFC0094's T1B predicate.

- [106 date vectors and6 admitted-carrier contexts](https://github.com/UWMD-OSP/UW-Markdown/blob/5667d100be1eebdcb1fe494a9086cd4361518934/docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.vectors.json):
  both procedures pass all112 expectations (25 date admits,81 refusals).
  The six contexts distinguish a required absent as_of from present null,
  wrong-type and invalid-calendar values; unknown carrier siblings remain intact.
- [Complete400-year cycle](https://github.com/UWMD-OSP/UW-Markdown/blob/5667d100be1eebdcb1fe494a9086cd4361518934/docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.cycle.json):
 158,400 ordered inputs (years1–400, months1–12, days0–32),146,097 admits and
 12,303 refusals. Both references, the proposed JSON Schema with format plugins
 disabled, and the independent Python `datetime.date(year, month, day)` integer
 constructor oracle agree. The constructor is an external calendar oracle, not
 a parser or an activated dependency.
- The whole ordered truth sequence (ASCII1/0, no separators/newline) has SHA256
 `140e5faf25833eca88eae2bd7a3d35d787f90ab2a06952f87a79dbac894d1b7f`.
 The frozen vectors have SHA256
 `f8d3ebc4aef8b0992edf2a333cc53fa2325b869c680ba990158225f18c6e7400`.
 [Observed local report](https://github.com/UWMD-OSP/UW-Markdown/blob/5667d100be1eebdcb1fe494a9086cd4361518934/docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.observations.json)
 records source hashes, Node24.14.1/Windows and TypeScript5.9.3. The independent
 Python files identify the author authority main separately from the unmodified
 Python WIP checkpoint. Fresh final-head CI re-executes the research; archived
 observations alone are not a fresh platform result.

Reproduce from the repository root with existing locked dependencies and Python:

```bash
node docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.check.mjs
```

On Windows, set `PYTHON` to the desired Python executable when `python` is not
available. The check compiles/type-checks the isolated TS source into a temporary
folder, re-executes independent Python, compares the exact proposed schema to
this RFC, and confirms vector/input immutability. Its CI step is explicitly
research-only and does not allocate a code, activate a predicate, replace frozen
conformance expectations or advertise validation capability.

## Reference implementation plan

Under the owner acceptance, synchronize Format2.5b/c/f, ProtocolIII.6a/XI,
the executable registry/remediation, applicable schema annotations and any
assertions explicitly selected in U1–U3, plus TypeScript and independent Python.
Expected implementation sites are `packages/uwmd-verify/src/validator.ts`,
`protocol.ts` and metadata types; Python `uwmd_source_validation.py`, `uwmd_validation_provenance.py` and the
complete validation ledger/core; authored conformance cases/portable transport assertions.

Reuse current physical/reference accounting, not divergent parallel parsers.
Keep standalone evidence ownership separate from ordinary result projection.
Audit current producer obligations and live consumer outputs without fabricating
metadata. No new public function, CLI command, diagnostic DTO property, financial
procedure, schema fallback or capability promotion is needed for this allocation.
Production implementation and changes to governing contracts are outside this
docs-only acceptance PR. The isolated review controls have no production imports or hooks.

## Alternatives considered

- Extend META-01 or META-04: obscures their owner-accepted closed predicates.
- Emit one generic schema error: conflates missing diagnostics with composition,
  source availability, optional annotations and requirements owned by other codes.
- Treat bad metadata as a parse refusal: misclassifies admitted JSON and erases
  the ordinary validation/error transport boundary.
- Infer missing identity/reference/defaults or fetch external data: changes the
  stated record and exceeds read-only validation.
- Activate the uncontroversial rows while leaving U1–U3 implementation-defined:
  would leave cross-implementation results undefined; the owner accepted the exact
  U1–U3 text instead.

## Resolution

Accepted by the owner, 2026-10-18, in
[#389](https://github.com/UWMD-OSP/UW-Markdown/pull/389):

> RFC 0095 (#389) is accepted as pinned at c551e956: U1 the DQ-06 split with attribution under META-06, U2 symmetric stated-assertion triggers, U3 the whole-string YYYY-MM-DD Gregorian date domain. Mark it ready and merge when exact-main CI is green; […] Implement META-05/06 and the as_of domain in TS and Python together on the #354 lane, with the 89-reference inventory frozen as the activation baseline and the calendar vectors as cross-runtime tests. No release, version, tag or publication.

The owner's U1–U3 choices, pinned in the sections above, were given verbatim
(2026-10-18):

> U1 adopt the draft's recommended split: DQ-06/info stays for stage readiness only; promoted-reference attribution moves to META-06/error under the U2 trigger; remove the duplicate emission; inventory the newly assessed population and report it to me before any activation.
>
> U2: the obligation is triggered by canonical provenance.resolution and by any stated override resolution assertion, applied identically to both references; shadowed and duplicate paths are suppressed exactly once; no fetching, no inferred asymmetry.
>
> U3: calendar date domain: whole-string YYYY-MM-DD, ASCII digits, valid Gregorian date, years 0001–9999, no trimming or normalization, null and absence as the draft defines; synchronize Format, Protocol and schema in the same RFC and add independent TS and Python vectors; do not reuse T1B.
>
> Pin all three in the RFC text, re-review, and bring it to me for acceptance when exact-head CI is green. Drafting authority only until then; prelaunch 4.x, no versions, releases, tags or publication.

The implementation ([#392](https://github.com/UWMD-OSP/UW-Markdown/pull/392))
implements the closed predicates in TypeScript and independent Python source
validation, with Format/Protocol/registry/schema synchronized. The reviewed89-reference inventory and all calendar inputs remain
unchanged. A separate exact-RFC0094-base inventory of884 recognized sources
(820 fenced parses,9 prior typed refusals,55 Lite inputs outside this census)
found no META-05/06 findings in2320 retained/current references;408 earlier-parent
rejections remain separately classified. All22 admitted canonical agent-source
blocks state agent_id. This is a standalone-source predicate inventory, not a
claim about every composition, generated model, embedded test or full validation.

Six new native controls38–43 independently state exact metadata fields/order,
including a lawful empty result. Existing source fixtures and frozen expected
results are unchanged. Actual TypeScript/Python META-06 predicates exercise the frozen106 date vectors
and6 carrier contexts. The activated schema matches the frozen158400-input
Gregorian cycle; isolated research procedures supply independent full-cycle
evidence. SOURCE/MODEL/history/composition identity controls, actual CLI exits
and receipt-policy effects accompany the implementation. The old attribution
DQ-06/error is removed; declared-stage readiness remains DQ-06/info.

The companion SRC override correction enforces already accepted leaf vocabularies
within the existing sections/current-variant population only. It does not widen
SRC to META's retained-physical population or silently fix other source grammar
behavior. No complete validation/Verifier capability, release or publication is
claimed by this allocation. The complete-validation WIP remains independently
gated; full certification cannot be inferred from portable examples or helpers.

## Prior art

The repository's accepted RFC0090/0091/0093/0094 metadata allocations establish
closed predicates, source/model authority and deterministic pass order. Accepted
RFC0021/0022 establish attributable reference records; RFC0028 establishes stage
readiness; RFC0031 separates source identity and resolution. The block JSON
Schema separates presence, nullability, item types and unknown-member admission;
those assertions must be reconciled with their validation owners, not translated
indiscriminately into new errors.
