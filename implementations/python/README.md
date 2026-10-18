# Independent Python structured Reader foundation

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354).
This unpublished, incomplete implementation is written independently from the
Format and Protocol. It uses Python's standard library and has no Node runtime,
external packages, hosted services, production fixture lookup, or TypeScript
translation. No PyPI name, supported Python floor or publication is decided.

The discovery manifest advertises only `parse`, **no Reader/Verifier tier,
full-validation, expression-calculation, signature, receipt or optional-profile capability**.
The adapter reads structured Format 3.0 Markdown and separately verifies stated
reserve accounts, explicit reserve-draw plans and replacement-funding commitments. It does not certify every Reader or Verifier requirement.

## Current implementation target

Python targets the accepted current Format/Protocol and current conformance
contracts. Under the [owner rule](../../AGENTS.md#owner-rule--2026-10-17), there
is zero prelaunch compatibility or artifact-preservation work: no legacy modes,
migration/deprecation paths, bump recommendations or historical replay gates.
Read-only validation, current source/digest correctness and RFC discipline remain.
RFC0090 and RFC0091 are accepted; their actor and canonical boolean rules apply.
No capability promotion or release is implied.

## Complete validation implementation — in progress


### Registered completeness ownership in validate transport

Protocol III.6a already assigns the five absent canonical leaves to
`META_FIELD_MISSING_SECTION`, `VERSION`, `SOURCE`, `TIMESTAMP` and `CONFIDENCE`
(warnings). RFC0091 explicitly retains the missing-revision warning. The
validator now reconciles duplicate local evidence only when that exact warning
was actually emitted for the same physical block index and canonical path,
and the owning parent objects exist with the leaf genuinely absent. It retains
the original local evidence privately as handled; registered issue values,
order, partitions and readiness are unchanged.

Before this correction, an absent revision emitted its registered warning but
still caused an uncoded local refusal. The complete five-field boundary now
returns the ordinary warning-only ValidationResult/exit0 for that absence.
Explicit null or invalid authored values, bad/missing parents, late metadata,
section disagreement and unrelated override conditions retain their separate
registered or unallocated handling. No parent failure is consumed through a
child completeness warning. Active/history populations and the low-level
source inventory are unchanged. This closes duplicate transport, not the
remaining metadata diagnostic-allocation or complete validate capability gate.

Six focused methods cover all five fields, exact physical ownership, retained
local evidence, null/type/parent/independent failures, history and ten real CLI
subprocess comparisons. Discovery remains parse-only.

### Registered source-type ownership in validate transport

Format 2.6 already assigns an authored nonstring canonical provenance `source`
to SRC-01/error. The source inventory previously emitted that registered error
and a duplicate local string-type finding, unnecessarily forcing partial
transport. The integrated assessor now retains that local evidence as handled
only with an actual SRC-01/error at the same physical block, section and exact
`_meta.provenance.source` path, whose canonical authored value is nonstring.
The ordinary ValidationResult keeps the original error and exit1.

This does not classify another metadata requirement as a source error. Missing
source keeps its exact completeness owner; invalid strings/SRC-02, resolution
SRC-03 and leaf source findings retain their existing behavior. History is not
reclassified. Independent timestamp, quality-parent, member-order, routing and
annotation failures still require their own existing or unallocated handling.
Seven focused methods cover the registered owner/proof boundaries, a defensive
nonobject constructed-payload proof refusal, every JSON
nonstring type, source strings and resolution tags, physical/leaf/history scope,
read-only inputs and four real CLI comparisons. No diagnostic or capability is
added; discovery remains parse-only.

### Registered promoted-reference absence in validate transport

[RFC0022's implementation record](../../docs/rfcs/0022-market-data-documents.md)
already allocates
DQ-06/error to a promoted block or leaf with no market-data reference. The
integrated command now handles only the duplicate required-presence evidence
for an actually emitted error at the same current physical block, section and
canonical `_meta.provenance.market_data_ref` path. The original local finding
remains in `handled_shape_findings`; ordinary issues, error partitions, coverage,
readiness and source bytes are unchanged. A covered absence returns the ordinary
error ValidationResult/exit1 instead of an uncoded partial refusal.

Authored null, false, zero, empty string, arrays and incomplete objects retain
their independent unallocated reference-type/member findings. Stage-gap DQ-06/info,
wrong-owner fields/sections/indices, replaced peers, append/extensions and history
cannot consume an absent-reference finding. Existing current-variant population
is retained, including component-role peers; no financial role selection or
new diagnostic population is introduced. Independent timestamp/quality/override
requirements remain local. This is one integrated transport correction; complete
validate remains unclaimed and discovery remains parse-only.

### Accepted hospitality field-home admission

The current accepted-main integration includes RFC0081 section 5 G3: in
hospitality, `rent_roll.keys` and `hotel_metrics.adr`, `occupancy`,
`available_room_nights` and `key_count` receive existing CLS-04/error when
stated, including null. The five exact predicates share a small pure helper;
the validator applies them only to the existing property-level selected source.
Historical, unselected component and unresolved external payloads do not acquire
this check. The previous WIP all-peer `rent_roll.keys` shortcut is removed.

Format 4.3/4.32 and G3 explicitly remove these official field homes. This does
not allocate CLS-04 to arbitrary unknown members merely because a schema is
closed. Generic field admission, broader class-field source applicability and
unallocated negative-wire conditions remain separate gates. Unknown data is
retained; no aliases, source edits, model generation or new diagnostic are added.
Focused evidence: three helper methods and six integration methods, including
five real validation subprocesses, selected/default/current-revision controls,
role collision, history, component, external and foreign-class inputs, detached
findings and parse-only discovery. No whole validate capability is claimed.

### Current checkpoint — real validate command, capability unclaimed

`python -B implementations/python/uwmd.py validate <file> --json` now invokes
the independent orchestration on a fresh parse of the supplied bytes. Supported
inline inputs return the structural ValidationResult fields, all seven stage
booleans, all fifteen CC coverage entries and the separately checked V.12 result.
Exactly one JSON document is written to stdout. Structural errors or failed/
unverifiable V.12 return exit1; warning-only results return0. Frontmatter blocking
flags retain `overall_status: blocking` but do not alone fail this operation:
they halt a producer workflow (Format3.3), while the accepted CLI fails on actual
structural errors or the separate binding refusal. Parse refusals preserve
allocated codes; the known UNSUPPORTED_FORMAT_VERSION,
UNSUPPORTED_YAML_FEATURE and SOURCE_CONTENT_MISMATCH refusals reached through
validate carry `category: parse`, `code` and `message` under Protocol XI's
ProtocolError schema. Unallocated local source/selection failures do not gain
a fallback code or a successful ValidationResult. I/O/internal failures return2.
Validation never writes input.

This is an implemented, **unadvertised developing command**, not a complete
validation/Verifier claim. The manifest still claims only parse. Detected
unsupported inputs refuse explicitly: Composition exposes its first existing
assessment issue in source/rule order, including an earlier section's
COMP-UNRESOLVED. An individual directive's malformed/duplicate/count error
precedes lookup for that section; it does not override an earlier section's
unresolved result. COMP-UNRESOLVED is a fallback only when an unresolved
assessment supplies no issue. Every assessment issue remains retained; no global
directive-priority rule or part resolver is introduced. Unallocated metadata,
lease-up or the REC/CS/WF shapes below
use an uncoded local error.
Both refusal forms carry detached local assessments and an explicitly labeled
`partial_validation_result`, not a new normative ValidationResult state.
The private unperformed V.12 `None` is omitted from CLI partial output rather
than serialized as a new union member. Normal CLI output excludes prototype
assessment siblings.

Whole-absent metadata retains its registered META_MISSING warning and accepted
warning-only exit. Its duplicated inspector-local absence finding is consumed
only for the exact physical block index where completeness actually emitted that
warning, after confirming authored absence. A late/present metadata object,
another block or uncovered history cannot match by field name alone. Existing
META-01 container rejection and exact REC ownership are reconciled below; other
unallocated conditions remain visible. The accepted source inspector emits actor and boolean findings once; no candidate pass is layered over it.

`run_validation_cases.py` executes each unchanged portable validate case through
the actual command and unchanged shared `run_case` comparison. A transparent
subprocess observer retains exact argv/stdout/stderr/exits plus source/case/
expected/result hashes; it neither alters case flags nor advertises validate.
That direct case evidence is separate from an advertised-capability run, which
would report missing-capability failures under `--no-skip`. The first actual run
at `b254047c` passed111/111 with zero failed/skipped, but three additional
malformed REC/CS/WF optional-shape probes still returned clean/exit0. That
first result is preserved as narrower evidence, not a complete admission proof.

The integrated local optional-shape assessment now inspects current inline
recovery terms/true-up rows, top-level and component stack sizing declarations,
and WF clawback/stated outcomes/schedules against their exact normative schema
fragments. Clawback `floor_multiple` follows accepted RFC0059's strict `>1`,
distinct from the positive `until_lp_em` tier hurdle; the prior Python `>0`
guard was an implementation defect, not an owner decision.
It preserves schema-admitted null/empty/zero, distinguishes bool from numbers,
checks fixed closed unions/objects and never computes a sizing or outcome.
These shape conditions receive no invented registered diagnostic. Conditions
not already represented by an exact registered check cause a command refusal
with detached local field/source evidence. The bounded checker
explicitly refuses unsupported schema validation keywords, including in
conditional/union branches, rather than treating an unchecked condition as valid.
Unknown unrelated payload is preserved, externalized payload stays unresolved,
and history is not financially reclassified. Other registered REC/CS/WF
semantic checks and arithmetic are unchanged.

After the optional-shape and accepted clawback-floor corrections, all
**111/111 actual portable validation cases passed** at source checkpoint
`33c11ca0da07c1018d2178a8416027f9d95c6a58`, with zero failed/skipped.
Command: `python -B implementations/python/run_validation_cases.py`.
The retained report SHA-256 is
`1e3e20df8b3fa97c2e1e176e0e2531964e4b49fcd545552ab2d77ef4d19191be`.
This executes the unchanged cases/comparisons through real subprocesses; it is
not a run of the advertised validate capability. Stream files retain the shared
runner's UTF-8-decoded/text-mode captures, including its newline normalization;
their hashes are not a raw stdout-byte attestation. All three same-source
malformed optional probes changed from clean/exit0 to explicit local refusal/
exit1 without altering their registered issue arrays. Focused current controls
pass nine real-command methods and eight optional-admission methods.
Discovery remains parse-only and the whole-capability gates below remain open.

Exact remaining validate gates include accepted transport for unallocated
metadata/section shape conditions; unreviewed top-level and other optional
payload domains; CS selector/source admission beyond declaration shape; REC
source-reference admission; all applicable family-order/partition/negative-wire
controls; malformed/unresolved composition refusal precedence; and independent
cross-platform command evidence. These are remaining validation obligations,
not a claim that the bounded shape collector discovers every unsupported
authored input. CS sizing, waterfall outcomes and the other stated-figure
recomputations are subsequent base-Verifier obligations, rather than automatic
blockers to the structural validate command. Composition resolution is optional:
UW_COMPOSITION section 8 permits a conforming implementation to report an
externalized section unresolved instead of presenting the record as complete.
No local assessment list proves complete schema coverage. General dictionary,
state-and-verify financial outcomes and receipt verification remain subsequent
base-Verifier obligations. No numerical procedure or optional profile is enabled.

### Accepted metadata integration

RFC0090/0091 now own required canonical actors and booleans. Shape admission
runs first, then all actors, then each physical block's META-02/META-03, before
active role/period/source checks. All retained physical data blocks are checked,
including history and overwritten peers. No fence inference or JSON repair occurs.
The source checker is shared with accepted main; the pipeline retains duplicate
local evidence privately while normal registered results own these exact failures.
Unrelated typed/conditional metadata remains an explicit local refusal.

### Base-metadata field admission checkpoint

The integrated admission audit covers every declared non-integrity member in
[Format 2.5–2.6](../../spec/UW_FORMAT_SPEC.md), the base metadata/leaf portions of
[uwmd-block.schema.json](../../spec/schemas/uwmd-block.schema.json), and the
conditional references of RFCs 0021/0022. This is field admission within the
existing validate command, not another inspector or complete validation claim.

The audit found two concrete false-clean paths and one missing registered
finding. A leaf-only `market_data_accepted` declaration previously returned
clean/exit0 without a reference, and a non-string `market_data_ref.rationale`
also returned clean/exit0. Block-level missing-reference input already refused
locally but omitted its published diagnostic. The existing DQ-06/error allocation
in [RFC0022's implementation record](../../docs/rfcs/0022-market-data-documents.md)
now applies to promoted block **or leaf** resolution lacking a usable reference
within the published checkDataQuality population: current `sections` entries
and every current variant, including financially ineligible component variants.
It excludes overwritten peers, append collections, extensions and history;
all active physical blocks still retain their existing local required/typed
reference evidence. RFC0090 broadens only its shape/actor population, not this
other registered check. Wider DQ-06 diagnostic applicability would require a
separate governed clarification; no source evidence is discarded here.
This is distinct from DQ-06/info for missing declared-stage sections under RFC0028.
Empty object/array references are present under the published presence test and
remain malformed local shape findings; null, false, zero and exact-empty strings
are absent. No Python container truthiness is substituted. A stated optional
rationale must be a string; omission and the exact empty string remain admitted.

| Field / accepted condition | Registered finding or local assessment | Applicable evidence boundary |
|---|---|---|
| Whole absent `_meta`; five absent completeness fields | Existing META_MISSING / META_FIELD_MISSING_* warnings | Exact active physical block. Duplicate local evidence is handled only at the actual completeness index/path with authored absence and admitted parents; null, parent and independent failures remain distinct. |
| Retired `section_id`, nonobject `_meta`, malformed provenance/lifecycle object | Existing META-01/error | All retained physical blocks; exact wrapper predicate precedes actor, with no expanded allocation. |
| Required nonempty canonical actor | Existing META-01/error; no local duplicate | All physical blocks including history/overwritten/append/extensions; absent/null/empty/non-string refuse, whitespace remains authored. |
| First `_meta` member and matching `_meta.section` | Uncoded local shape findings | Active physical blocks, including overwritten peers; no silent correction or history reclassification. |
| Source/resolution vocabulary at block or leaf | Existing SRC-01/02/03 errors | Exact authored values on active physical blocks. The canonical block source type condition is handled only by its exact actual SRC-01/error owner; no alias, field substitution or history expansion. |
| Agent source requires agent_id; nullable agent_id/agent_version/notes types | Uncoded local shape findings | Agent_id may explicitly be null; no agent identity inferred. Unknown provenance members remain informative. |
| Timestamp string/date-time | Completeness warning when absent; uncoded local shape finding for typed/date-time refusal | Existing RFC3339 calendar/offset/fraction/leap-slot controls; no event-authentication assertion. |
| Promoted block/leaf missing market_data_ref | Existing DQ-06/error plus retained local required-reference evidence | Registered finding: current section entries/all current variants, independent of quality shape or financial role selection. Local reference evidence: every active physical block, including overwritten/append/extension peers. History keeps its separate shape/actor-only scope. |
| Authored market_data_ref: document_id/as_of/digest, optional rationale; inherited_from: document_id/digest/distance | Uncoded local shape findings | References checked whenever authored; conditional absence also checked for market promotion / block inherited_assumption. Lowercase SHA256 digest; positive JSON-integer distance. Empty text and unknown reference members retain schema-admitted meaning; no lookup or provenance authentication. |
| Required quality confidence/review flag; optional flags/partial/provisional; forbidden field_overrides | Existing completeness/info/DQ findings preserved; accepted META-02 handles only the review boolean; other unallocated type/shape findings remain local | Exact enums/booleans/string arrays, with confidence and review kept orthogonal. Missing optional members are not fabricated. |
| Lifecycle positive integer revision / boolean superseded | Accepted META-03 handles only superseded; unallocated revision shapes remain local | JSON integer semantics distinguish bool. This checks field shape, not a newly invented chain grouping, revision-history policy or integrity verdict. |
| Leaf path/confidence/source/resolution/reason/note | Existing SRC vocabulary errors; unallocated leaf shapes local | Every active authored entry; path string/type evidence only, no guessed target existence or new path grammar. Unknown entry members remain retained. |
| `_notes`, unknown payload and optional integrity/signature content | Informative / unchecked at this base boundary | No ordinary validation of `_notes`, no INT/signature/profile claim or metadata rewrite. |

Ten new focused methods inventory the entire declared field set and test
required/type/nullable/conditional controls, both reference objects, exact
presence semantics, schema-admitted empty/zero values, all leaf members,
registered precedence, detached evidence, active physical/history distinctions
and four real CLI subprocess inputs. A retained frozen promoted-source control
retains its registered metadata findings and handled absent-field evidence,
then tests a model-only rationale mutation; it does not claim a promotion or full validation case pass.
Source bytes and current parsed models
remain unchanged. They supplement existing source/actor/timestamp controls;
field inventory alone is not a schema conformance claim.

Required conditions with no allocated ordinary diagnostic still receive the
explicit local refusal described above. An actor-only META-01 or an unrelated
registered error does not consume a local requirement. An existing registered
wrapper/nested-object rejection is an admission precondition: its descendant
local metadata evidence remains retained privately but does not require another
refusal transport. This does not allocate those descendants to META-01. Complete
negative-wire acceptance must resolve the remaining boundary without broad META-01 expansion,
new suffixes or silently discarded findings. The all111 portable execution at
the prior checkpoint remains distinct from these additional admission controls;
new-head portable/nonportable/cross-platform proof is not implied by inspection.

### Next coherent payload-admission gate — proposal

The next subsystem is exhaustive admission of the **formal normative payload
schemas**, not four isolated property probes or another public inspector.
Its bounded inventory contains 27 artifacts:

| Formal section or nested domain | Existing schema artifacts to reconcile |
|---|---|
| Capital / component / calendar / waterfall / lease-up / reserves / gaps | section-capital-stack, section-components, section-cash-flow-series, section-distribution-waterfall, section-lease-up-schedule, section-reserve-accounts, section-gaps |
| Official builtin payloads | section-dc-capacity/power/revenue; section-hotel-brand/food-beverage/metrics; section-mhc-sites; rent-roll-hospitality |
| Tax / sources / capex | tax-terminal, tax-reassessment, tax-abatement, sources-uses-escrow, renovation-draw, expense-targeted-capex |
| Commercial lease / recoveries / hedge | lease-termination-option, lease-escalation-schedule, lease-co-tenancy, lease-recovery-terms, lease-recovery-true-up, debt-rate-hedge |

These are schema filenames under `spec/schemas` without `.schema.json` suffixes;
the starter refinement-issue output schema and optional-profile/representation/
receipt schemas are outside this structural payload inventory. Required work is
one explicit domain/applicability map, not automatically applying every schema
to every record. Preserve section presence, current identity/role/class rules,
null/omission conditions, external unresolved status and history scope. Route
universal `_meta`, `_role`, `_overrides` and `_notes` through their owning Format
contracts: several closed section schemas omit valid universal annotations.
Unknown members remain retained wherever the owning contract admits them.

Actual schema keywords beyond the current fragment checker include `anyOf`,
`dependentRequired` and `uniqueItems`; fixed period, currency, nonblank and digest
patterns; date-time through the existing RFC3339 predicate; and two registered
local cross-schema references (components to capital stack, renovation draw to
expense-targeted capex). No network resolver or new dependency is needed.
Unsupported required keywords must explicitly refuse, including unused union/
conditional branches. Existing registered semantic loops remain separate;
schema constraints do not invent new ordinary codes. Exit gates are exhaustive
field/condition tests per artifact, all current-source/class/null boundaries,
registered versus uncovered-local evidence, unchanged complete portable CLI
comparisons and independent nonportable/wire checks before capability promotion.

A second inventory must separately identify **explicit normative Format rules**
for domains without complete schemas. There is no general property schema.
The integrator's four prior-source probes (address=true, asking_price=true,
asset_class={}, total_units="twelve") are observed accepted outputs, not four
established normative defects. Property's illustrative JSON depicts an address
object while existing sources also use strings; asking_price is not in that
property template. Neither examples nor a TypeScript-only interface establish
exhaustive required types or authorize new failure diagnostics. Preserve those
observations and pin each actual rule/condition before adding admission behavior.
This proposal authorizes no broad implementation or new conformance claim.

### Formal-domain applicability audit — 2026-10-17

A read-only audit at `046640b5` harvested the 734 existing corpus `.uwx.md`
sources once: 725 parsed and nine retained their existing source refusals.
It extracted 1,149 **current inline candidate subjects** for the 27 artifacts
below, separately tagging 30 overwritten, historical or externalized blocks.
Test-only AJV2020 with formats read the unchanged normative schemas; it did not
invoke the TypeScript validator, run financial models, activate a Python schema
loop or change any fixture/expectation. All 734 source and 27 schema hashes were
verified unchanged after the audit. The complete retained report SHA-256 is
`c39c817afb2cb13f6b75da7f66ec47bc72074d1831e484e3711da5cabf9b482a`.

`N / R` below means extracted subjects / schema-rejected payload views, **not**
validation failures, complete cases or newly allocated diagnostics. For section
roots, the test-only payload view separates `_meta`, `_role`, `_overrides` and
`_notes` for their owning universal contracts; original source/model values stay
unchanged. Missing optional subjects produce no candidate. Malformed/missing
parent containers are not endorsed by failing to descend into them: their
owning admission must be checked first. Every extracted subject was non-null;
this is no proof of all authored-null parent boundaries. Scalar null fields do
occur and retain the individual schema types and conditional rules.

All rows require an exact source/current identity, not a financial role fallback.
The root section rows use every canonical current variant after Format2.7/2.8
routing; ordinary historical payloads are not newly reclassified, and an actual
external=true directive is unresolved payload rather than a malformed inline
object. Metadata/source/actor checks keep their separate physical scopes.
Builtin class applicability is the exact frontmatter class; schema existence
alone does not select a model or impose foreign-class requirements. Component
presence/class restrictions and admitted slot keys still belong to MU/CC rules.

| Artifact (filename without .schema.json) | Section / nested authored source | Exact condition / null and class boundary | N / R |
|---|---|---|---:|
| section-capital-stack | capital_stack; components.<admitted class>.capital_stack | Optional stack; nonempty tranches when stated. Component stack uses the same CS rules, without top-level senior reconciliation. Individual nullable rates/months do not override class/conditional CS semantics. | 5 / 2 |
| section-cash-flow-series | cash_flow_series, each current variant | Required nonempty series; nullable label/stated_metrics and nullable row companions stay distinct from required date/amount. No cash metric recomputation here. | 245 / 7 |
| section-components | components | Mixed-use allowed income-class slots; at least two/NOI/allocation restrictions are additional MU rules. Omitted slots are absent, not zero; malformed/null slots are not silently dropped. | 19 / 4 |
| section-dc-capacity | dc_capacity | data_center; required named capacity fields and redundancy, optional measured/design detail by exact schema types. | 8 / 1 |
| section-dc-power | dc_power | data_center; required utility_rate_per_kwh/billing; optional declared companions only. | 9 / 0 |
| section-dc-revenue | dc_revenue | data_center; required lease_type/rent_per_kw_month; no financial defaults or inferred revenues. | 9 / 0 |
| section-distribution-waterfall | distribution_waterfall, each current variant | Required reference/split/tiers; nullable declared outcomes/schedule/clawback and nullable hurdles remain conditional, with registered WF grammar separate. | 28 / 16 |
| section-gaps | gaps | Required items; each item requires section/reason; optional stage/date-time/owner fields keep their actual schema constraints. Empty items is not a missing section. | 2 / 0 |
| section-hotel-brand | hotel_brand | hospitality, optional section; nullable flag/term_years, stated fee fractions by actual bounds. | 5 / 0 |
| section-hotel-food-beverage | hotel_food_beverage | hospitality, optional section; authored monetary companions are numbers, not inferred from absence. | 5 / 0 |
| section-hotel-metrics | hotel_metrics | hospitality, optional section; only optional nullable market_revpar is payload. Universal annotations need their own admission route. | 4 / 1 |
| section-lease-up-schedule | lease_up_schedule, each current variant | Required model_type/cadence/schedule; nullable target/assumptions/stabilized_summary preserve owning LU conditions. No projected trajectory or aggregate proof. | 176 / 9 |
| section-mhc-sites | mhc_sites | manufactured_housing; required named sizes/rent/date member, POH conditional rent; as_of_date is presence-only, not an inferred calendar/type assertion. | 49 / 32 |
| section-reserve-accounts | reserve_accounts, each current variant | Required account/period/movement structures; RSV01–05 structural ownership separate from RSV06–08 balance verification. | 73 / 10 |
| rent-roll-hospitality | rent_roll | hospitality; its declared room inputs/occupancy shape, rather than generic tenant fields or hotel_metrics aliases. | 5 / 2 |
| tax-reassessment | noi_model.expenses.real_estate_taxes.reassessment | Optional object; trigger required; G1 all-or-none assessment group plus separately typed optional/null companions. | 11 / 3 |
| tax-abatement | noi_model.expenses.real_estate_taxes.abatement | Optional object; schema kind/schedule and conditional stabilized period; owning TAX period/order/arithmetic rules remain separate. | 7 / 0 |
| tax-terminal | dcf.exit_analysis.terminal_tax | Optional object; complete stated assessment/in_exit_noi required when present; normal reassessment's lone-trigger permission does not apply. | 4 / 1 |
| sources-uses-escrow | sources_uses.uses.escrows[i] | Each authored array entry; closed name, nullable stated amounts/disclosures, existing ESC ties independent. | 323 / 1 |
| renovation-draw | sources_uses.uses.renovation | Optional object; at least budget or contingency; G1 draw group/remaining conditions and field nullability separately applied. | 18 / 6 |
| expense-targeted-capex | sources_uses.uses.renovation.expense_targeted[i] | Every authored entry; required label/amount/target/savings/start/in_noi_model; nullable optional payback. Empty parent-array admissibility must follow its own constraint, not item validation alone. | 8 / 2 |
| lease-escalation-schedule | rent_roll.tenants[i].escalation_schedule | Every stated tenant clause, without a class-based financial projection; array/item shape plus separate LSE date/order/term rules. | 6 / 0 |
| lease-termination-option | rent_roll.tenants[i].termination_option | Required date/notice in a stated object; nullable penalty/conditions; optional penalty_includes has its own nonempty/unique rules. | 6 / 3 |
| lease-co-tenancy | rent_roll.tenants[i].co_tenancy_details | Stated object trigger/remedy plus owning flag/companion conditions; missing optional clause does not create a lease remedy. | 7 / 1 |
| lease-recovery-terms | rent_roll.tenants[i].recovery_terms | G1 cap-alone permission and non-null method/accumulation conditions; nullable share/fee/cap fields preserve explicit schema admission. | 15 / 3 |
| lease-recovery-true-up | rent_roll.tenants[i].recovery_true_up | Stated rows require dates, nullable stated amounts/ref/settlement; signed true_up_amount allowed; exact source REC09 and arithmetic remain owned separately. | 8 / 0 |
| debt-rate-hedge | debt_structure.rate_hedge | Optional object; instrument/strike plus G1 terms-group applicability and exact V.12 source selection. Nullable premium/counterparty/funding do not normalize non-nullable group fields. | 94 / 22 |

The raw whole-object comparisons rejected 129 subjects; the separate payload
views rejected 126. The difference is three hospitality `hotel_metrics` blocks
whose lawful `_meta` is absent from that closed payload schema. This is why a
blanket whole-fence schema loop is not the admission composition. Eight candidate
subjects were outside their named class; those observations must be routed by
the actual class/CC rules, not treated as eight new failures.

Twenty-two existing portable validate inputs hit these schema constraints, all
with expected exit1; no matched expected-exit0 input was rejected. Many already
have a precise HDG/ESC owning finding, such as `conformance/hedge/0070-bad-kind`
and `0070-unknown-member`. Turning every schema rejection into a new local
partial response would still break their accepted top-level issue/V.12 wire.
The implementation therefore needs exact condition/source identity consumption
where a registered finding actually covers it; one error in a block cannot
consume unrelated shape failures. None of the reused native empty-prefix
expectations had a schema rejection. Most rejected subjects are intentional
negative fixtures, not joint-contract conflicts.

Two other contrasts must not be mislabeled: the toy LU/WF payloads under
`conformance/calc/fixtures/period-*` serve calculation/selector assertions,
not positive full-validation assertions. The retail `gross_leasable_area` in
`conformance/size-intensive/cc-13-silent-for-mixed-use/deal.uwx.md` is rejected
by the closed component schema, but its expectation pins only no CC13 and no
synthesized deal size; it does not assert clean MU/schema admission. Neither
contrast authorizes rewriting expected data or declaring an owner conflict.

Null semantics have an explicit accepted answer, not a new convention: RFC0081's
Decision on G1 null members says null neither triggers nor satisfies a group,
**while a non-nullable member stated as null stays a type error**. Apply field
type and group statedness separately. Do not strip all nulls to force schema
agreement, replace optional omissions with null, or conflate a standalone
object/array schema with the enclosing optional carrier's admission. The lack of
null-root corpus subjects is a remaining negative-evidence coverage gap, not a
contradictory contract by itself. Exact negative-wire disposition for unallocated
conditions remains the separately recorded command gate; no new diagnostic,
capability, schema activation or general validator is introduced by this audit.

## Validation applicability audit — 2026-10-16

This audit covers the developing API, not a complete validation claim. Accepted
authorities are [Format 2–5](../../spec/UW_FORMAT_SPEC.md),
[Protocol III.6a / VIII](../../spec/UW_PROTOCOL.md) and the referenced schemas/
RFCs. All fifteen registered CC entries are produced, including skips; all
fourteen FV codes have focused threshold/severity/type/override controls.
Reachable codes and passing projections do not establish every field condition.

### External source boundary

The **local** `composition_assessment` sibling uses the existing
CompositionResolution precedent: `status: resolved | unresolved`,
`externalized` section ids in source order, and ProtocolError-shaped `issues`.
It is not a normative ValidationResult member or a full composition-resolution
result. No new validation status or severity is introduced. A current fence
marked `external=true` is unresolved; a payload member merely named `external`
does not change an inline block's meaning. Malformed directives receive accepted
COMP shape/count/duplicate findings in this separate assessment, not guessed
validator findings.

Current identity and role selection run before content availability is checked.
An exact selected external statement yields field_absent coverage with an
explicit unresolved detail; it never falls through to another variant.
CC-14 counts its presence, and CC-13 exempts an externalized property. Source,
metadata and role checks still inspect every active physical block; payload
rules do not interpret directives as incomplete reserve/cash/class data.
Existing cash identities can satisfy WF/REC reference existence while their
contribution/distribution facts remain unavailable. External components still
obey CC-11's unconditional asset-class restriction.

The existing V.12 helper privately inventories blocks it actually consults.
Only a consulted external dependency makes this local API's
`replacement_funding_verification` **null (unperformed)**. That null is not an
accepted V.12 result, is never emitted by the existing standalone V.12 command,
and cannot be transported as a complete future validate result. Unrelated or
unselected external blocks do not suppress an otherwise decidable V.12 union.
Scope field readiness stays false for unresolved property content. The other
stage booleans report the accepted section-presence table, not whole-record
completeness; `composition_assessment.status` must be consulted separately.

The preceding 33 focused validation methods include eleven external-boundary
methods and two FV audit methods; subsequent field, readiness and metadata-routing
controls bring the current focused count to 62. External controls include the unchanged
frozen missing-part source's unresolved meaning, exact roles/history, malformed
directives, source retention and V.12 consultation precedence. No fragment
resolution, smaller partial collection, network fetch, composition-suite pass,
new receipt interpretation or CLI capability follows.

### Lease-up field/applicability closure — 2026-10-17

The private family integrates [Format 4.25](../../spec/UW_FORMAT_SPEC.md) and
the [lease-up schema](../../spec/schemas/section-lease-up-schedule.schema.json).
Existing current-source LU-01–04 checks retain their code, severity, ordering and
applicability. The new **local** `section_assessment.lease_up_schedule` contains
uncoded `shape_findings` plus physical `blocks_checked` and
`external_blocks_skipped` evidence. It is not a normative ValidationResult
member, registered diagnostic, complete schema capability or financial verdict.

| Schema field/condition | Allocated ordinary finding | Additional local payload admission evidence |
|---|---|---|
| `model_type` required, natural_turnover / absorption_curve only | LU-04 warning only for natural_turnover with no rent_roll | Missing/null/unknown/wrong-type model remains uncoded; neither model changes required assumptions or row fields. |
| `period_granularity`; every row `period` matches calendar cadence | LU-01 error | Required/enum/string/grammar shape evidence; no new code or period policy. |
| Strictly increasing gap-free periods | LU-02 error | Existing comparison remains unchanged; no inferred/interpolated rows. |
| Required nonempty `schedule`; target not before first period | LU-03 error; cadence/target grammar uses LU-01 | Nonarray/nonobject rows, missing period and nullable target shape remain visible. |
| Six `assumptions` members | No generic allocated LU shape finding | All optional/nullable; three fraction fields in [0,1], other amounts nonnegative; finite numeric types only, no bool/string coercion, defaults or model-based requirement. |
| Nine optional numeric schedule fields | No generic allocated LU shape finding | All nullable; occupied/leased SF and two rent-PSF members nonnegative; vacancy [0,1]; four cash members finite without invented numerical/sign bounds. |
| `stabilized_summary` occupied SF/occupancy/annualized EGI/NOI | CC-15 separately checks the eligible base NOI seam | Nullable shape; occupied SF nonnegative, occupancy [0,1], EGI/NOI finite. Endpoint/occupancy equations are not recomputed. |
| Closed top/row/assumption/summary member sets | No generic allocated LU shape finding | Unknown data retained with uncoded local evidence. Universal `_notes` is never validated; `_meta`/`_role`/`_overrides` retain their own contracts. |
| Physical identity, history and external directives | Current LU diagnostics unchanged; Composition owns unresolved external references | Payload shape covers all retained inline physical lease blocks, with current/superseded context; history is not reclassified or refused by local evidence. Actual external markers skip unavailable payload checks; an ordinary payload member called external is not a marker. |

Twelve new methods exercise every numeric member's type/null/boundary domain,
all containers/closed member sets, both model vocabularies, optional/universal
fields, source/variant/current/history/external accounting, detachment and seven
unchanged frozen lease-up **document diagnostic** assertions. The two bare
lease-up financial cases and the positive documents' verified outcome are
separate obligations. No trajectory, rent/occupancy model, net-cash-flow
recomputation or stabilized aggregate verification follows from this evidence.
An uncoded finding cannot silently become a registered failure or a complete
successful validate response; CLI/discovery stay unchanged pending the whole
applicable diagnostic/admission/result/refusal boundary.

### CC coverage ledger

The implementation records selection evidence only for role-bearing sources;
all comparisons require finite stated operands. The following is the actual
implemented ledger, with remaining proof limits named explicitly.

| Check | Implemented condition / source selection | Remaining audit gate |
|---|---|---|
| CC-01 | Detail rent roll versus preferred t12 operating statement GPR, 3% | Complete canonical field-location and zero/malformed operand controls. |
| CC-02 | Senior debt stated LTV versus selected valuation, 0.005 | Accepted underwritten-value/lazy-price fallback, missing/null/invalid/zero operand behavior, threshold and source-selection proof added below. Alternate stated-LTV carrier priority and nonpositive-denominator applicability are not newly settled. |
| CC-03 | Senior loan amount against sources.loan_amount and one senior stack tranche ($100 tolerance); exact tranche.rate against debt_structure.interest_rate | Canonical rate, missing/null/type/zero, role/history/external and independent-leg controls now pass. Multiple senior tranches are not aggregated; full source bucket applicability remains audited. |
| CC-04 | Stated total_sources versus total_uses, tolerance 1 | Accepted derived uses are a separate calculation rule; no invented stated-versus-derived discrepancy finding. |
| CC-05 | Senior debt underwriting NOI versus selected NOI, 1% | Audit all admitted source locations, not inferred NOI. |
| CC-06 | First DCF annual row NOI versus NOI model, 2% published precedent | Complete first-year identity/registered field applicability; do not silently introduce a selector or numeric rule. |
| CC-07 | Selected DCF and stress base exit cap, 0.005 | Canonical assumption paths and unavailable operands. |
| CC-08 | Preferred appraisal due diligence versus valuation, tolerance 1000 | Complete canonical nested/flat carrier applicability. |
| CC-09 | Senior debt versus stress base annual debt service, tolerance 500 | Complete canonical carrier/partial-leg controls. |
| CC-10 | Stated uses purchase price versus valuation, tolerance 100 | Canonical typed uses and unavailable inputs. |
| CC-11 | Active components section presence allowed only for mixed_use, including externalized components | Presence is independently checked; payload MU rules remain separate. |
| CC-12 | Ordered sum of stated finite component NOIs versus property NOI | Full malformed/component inclusion/applicability audit; no new aggregation/tolerance convention. |
| CC-13 | Registered class primary-size presence, deal profile only; missing/externalized property exempt | Full per-class field shape and zero/null/role evidence; existing raw-size registry stays authoritative. |
| CC-14 | Unconditional deal-record property presence, including unresolved external reference | Non-deal profile and Lite/source discrimination must remain exact. |
| CC-15 | Eligible base/default/sole lease-up scenario versus NOI, 2% | Complete variant/canonical field controls; role cannot select another scenario. |
| CC-16 | One info finding per unresolvable section, affected checks sorted | Reporting only; not one of the fifteen coverage entries and not a financial failure. |

The CC-02 operand proof follows accepted RFC 0079 D2 and its Decisions table,
plus Protocol XIII.2: stated underwritten value is the denominator; purchase
price is used only when that value is absent/null, never for a stated zero or
invalid value. Seven integrated API methods cover that boundary, missing/null/
typed operands, a stated zero loan, the existing 0.005 comparison threshold,
senior-role selection/refusal, superseded/component peers, unresolved external
operands and no mutation. These are structural reconciliation tests, not a new
LTV metric procedure or a portable validate command run. The already implemented
accepted behavior required no production change.

The broader field audit did not establish a defect authorizing a blanket ratio
guard or removal of every alternate carrier. Format 4.7's block example places
LTV in `sizing_metrics.ltv`, while published reconciliation/remediation precedent
also reads top-level `ltv`. Preserve current behavior until that applicability is
reconciled; no claim is made that either carrier priority or negative-denominator
domain was newly settled. Other CC carrier audits remain in the table above.

The CC-03 canonical rate closure follows [Format 4.7 / 4.24 / 5.3](../../spec/UW_FORMAT_SPEC.md)
and [RFC 0026 section A](../../docs/rfcs/0026-capital-stack.md): the selected senior loan
states `interest_rate`, and its coupon must agree exactly with the single
senior-debt tranche's `rate`. The unrelated `rate_pct` payload is preserved,
never an alias. The published amount tolerance remains $100 (CC-03 remediation
declaration); no rate tolerance, aggregation or new numerical procedure is added.
Seven focused methods include adjacent finite binary64 rates, explicit zero,
missing/null/malformed operands and no-stack behavior.
[RFC 0040 diagnostics](../../docs/rfcs/0040-variant-role-resolution.md)
permits another independent leg to evaluate when one consulted section is
unresolvable. The controls demonstrate exactly that, including source/stack
amount evidence beside a debt-role collision or unavailable external debt.
The unchanged frozen agree/mismatch document diagnostic assertions also pass;
their stack sizing outcomes are a separate obligation. All 52 focused validation
methods pass, including the existing 111 direct API projections. This is no
additional portable command or complete capability claim.

At this committed source checkpoint the full Python suite passed **206 methods**
in 46.748 seconds (all 151 original methods unchanged, plus 52 integrated
validation and three YAML methods). The actual shared Reader subprocess passed
**17/17**, with zero failed, skipped or unverifiable cases. Existing standalone
reserve/draw/replacement controls remain in that full suite; validate CLI and
manifest claims remain unchanged. No JavaScript full suite was run in this lane.

### FV conditions and field locations

[Format 5.2](../../spec/UW_FORMAT_SPEC.md) fixes defaults, institution overrides
and strict below/above comparisons. The current code reads stated values and
does not reproduce DSCR/IRR or another model to perform these plausibility checks.

| Codes | Condition and severity | Implemented source / remaining gate |
|---|---|---|
| FV-01 / FV-02 | Cap rate below 3% / above 15%, warning | valuation.going_in_cap_rate. |
| FV-03 | Debt yield below 7%, warning | debt_structure.sizing_metrics.debt_yield only; unsupported top-level shortcuts are retained as unknown data, not selected. |
| FV-04 | DSCR below 1.20 warning / below 1.00 error | Senior debt sizing_metrics.dscr_underwritten only; exact boundaries and institution overrides tested. |
| FV-05 / FV-06 | Equity multiple below 1 / above 5, warning | dcf.returns.equity_multiple. |
| FV-07 / FV-08 | Levered IRR below 5% / above 40%, warning | dcf.returns.levered_irr; no IRR procedure is executed here. |
| FV-09 | LTV above 75% warning / above 85% error | Senior debt sizing_metrics.ltv only; no top-level shortcut. |
| FV-10 / FV-11 | OpEx ratio below 20% / above 70%, warning | noi_model.expenses.expense_ratio; canonical/null/type/override controls pass without a top-level fallback. |
| FV-12 | Annual rent growth above 8%, warning | dcf.assumptions.revenue_growth_rate; no NOI or cash_flow_projection alias and no growth model is run. |
| FV-13 / FV-14 | Vacancy below 2% / above 40%, warning | noi_model.income.vacancy_credit_loss.rate_applied; missing/null/wrong-type values do not fall through to shortcuts. |

The construction-LTC row in Format 5.2 has 80%/90% thresholds, but the current
registered FV registry contains FV-01–14 and names no separate LTC finding.
Do not fabricate FV-15 or overload another code. Reconcile the ordinary
published routing before a complete command claim; no financial threshold
decision is needed. Likewise, derived uses footing in Format 4.8 G1 does not
by itself register a new CC-04 stated-versus-derived disagreement.

### Remaining family / field-condition gates

| Family | Implemented scope | Minimum remaining validation obligation |
|---|---|---|
| LOC / CUR / descriptive identity | Locale/currency vocabulary, builtin/custom class syntax, scenario and BTR agreement | Complete frontmatter presence/type/source applicability, preserving unknown fields; descriptive values never select models. |
| SRC / ROLE / META | All active physical SRC-01/02/03, ROLE-01, pinned META-01, five missing-field warnings, missing-meta warning and low-confidence info | Accepted RFC0090 actor META-01 plus wrapper/nested-shape and SRC/ROLE findings are registered unchanged; actor findings are not duplicated locally. Every declared base metadata/leaf field is now audited; promoted block/leaf missing-reference DQ-06/error is integrated separately from stage-gap info. Unallocated typed/conditional shape findings remain local, while the five completeness warnings stay exact. Complete negative-wire transport for these conditions remains a gate. The original actor/corpus conflict is now governed history, not a remaining gate. |
| DQ / stage readiness | Seven class-adjusted presence lists, scope fields, provisional/partial/gap/freshness checks, field/stage/declaration-specific incomplete policies | All seven presence lists, overlays and role-selected scope readiness now share tested inputs; scope completeness treats absent/null/exact empty strings as missing without trimming, coercion or claiming field-type validity. Field-specific institution matching and equal-specificity overrides have controls; finish exact gap/override consumption and remaining externalized-field applicability without executing substitution/default actions. |
| MU / CS | Bounded class map, allocation/NOI and component debt restriction; tranche identities/rates/split/months and partnership-boundary checks | Authored optional accrual now enforces the closed enum, including explicit-null refusal under existing CS-01, for top-level and component stacks. Complete remaining closed-field shape/applicability and stated sizing declaration guards; financial stack sizing reproduction stays separate. |
| LU / PS / RT | Registered period structure/kinds, static PS-03, cadence/contiguity/target and rent-roll presence; tax-basis vocabulary | Fixed LU model/assumption/row/summary field shape is now integrated as local section_assessment where no LU diagnostic is allocated; existing LU-01–04 remain unchanged. Diagnostic/admission allocation for those schema conditions is still a complete-command gate. Period/shape inspection is not evaluation or stated-aggregate verification. |
| TAX / CAPX | Frozen diagnostic arrays, same-quantum tax equations, abatement/draw/target/payback rules | Terminal required assessment versus optional normal G1 group is now controlled. Finish closed-object/stated-member/null/conditional applicability; no savings applied. |
| LSE / REC | Frozen arrays, lease dates/steps/options/remedies/balances and settled recovery arithmetic | Complete optional administrative-fee/gross-up/cap/true-up shape/conditions and exact source-reference admission. Schema bounds alone do not assign those conditions to REC-01 (explicit share/cap pct) or REC-02 (method/companions/accumulation); do not invent that routing. No cap history or pool allocation is generated. |
| HDG / ESC / V.12 | Existing selected-source structure and exact separate binding union; external consulted-source gating is local only | Preserve all scalar/date/group/source/refusal conditions, debt-only evidence and no false result from unresolved content; complete future command transport must exclude local null as a normative result. |
| WF | Tier/split/hurdle/clawback structure and current exact cash identity; optional clawback/outcome/schedule schema-fragment admission | Complete remaining top-level/source applicability; actual outcomes, IRR hurdles and clawback arithmetic remain separate stated-figure verification. |
| RSV / BED | Existing reserve structure and student bed/date rules | Complete per-source/class/optional-member application and malformed-input evidence; RSV balance verification remains separate and unchanged. |
| CLS / class rules / MOD | Fixed fields, accepted class-specific definitions/rules and the five G3 removed hospitality field homes on selected sources; all 61 builtin validation code projections | Exhaustive role/type/conditional/input applicability remains open. The generic scalar field loop still needs its own selected-source audit; arbitrary closed-schema extras have no blanket CLS-04 allocation. Keep class checks separate from generic 171-metric reproduction and raw size lookup. |
| External composition | Local unresolved/directive assessment, exact presence and dependent-field gating | UW_COMPOSITION section 8 permits unresolved reporting without a part resolver. The command now preserves the first existing composition issue, including earlier COMP-UNRESOLVED, with full assessments retained; no cross-section directive priority is invented. Focused actual CLI controls include frozen count-mismatch/missing-part assertions; no complete-record, part-resolution or composition-suite claim. Remaining full negative-wire/applicability proof is distinct from implementing an optional resolver. |
| General command and result | Real unadvertised command, exact result partitions, seven stage keys, fifteen coverage keys, separate V.12 and explicit unsupported-input refusal | All111 unchanged actual portable cases passed at the prior source checkpoint. Preserve that proof on each new production checkpoint and close the specific admission/refusal, ordering and nonportable gates above, with independent three-OS evidence before promotion. Parse-only discovery remains unchanged until whole-capability proof passes. |

This is a completion backlog inside the single integrated validator. It does
not authorize more isolated inspector commands. General dictionary comparison,
calendar cash-flow/property assembly/waterfall stated outcomes and receipt
verification remain mandatory base-Verifier milestones after this validation
boundary; optional Integrity/Module/Representations profiles do not enlarge
the minimum. Existing #365 and RFC 0088 limits remain explicit where actually
dependent, without blocking independent accepted structural work.

## Structured YAML sequence mappings

The Reader admits the object entries shown in Format §2.2a's `modules` list,
including continuation members, and preserves the same shape in unknown
frontmatter keys. This combines Appendix D's sequences with its one mapping
layer; it does not load modules or select a calculation. Scalar list entries
retain their authored meanings. Duplicate decoded keys, deeper mappings and
features outside Appendix D still refuse with `UNSUPPORTED_YAML_FEATURE`.
Numeric spellings, JSON pointers and UTF-8 byte spans remain attributable to
the unchanged source, including CRLF and quoted keys. Real parse subprocess
controls check the object shape and input bytes. Discovery remains parse-only;
complete validation and Reader/Verifier tier gates remain separate.

## Minimum-complete capability path — 2026-10-16

This assessment uses main `fbf8f66a` (through #371). It inventories code and
accepted contracts; it is **not a new conformance run**. Earlier run counts below
are historical evidence. That assessment baseline contained 151 unit methods, counted
from their definitions. The newer execution evidence appears above.

The next engineering milestone is **complete structural validation**, integrating
the existing checks behind one `validate <file> --json` result. Further isolated
inspection commands do not close that capability. Keep discovery at
`capabilities: ["parse"]`, `profiles: []`, with no tier, until each complete
claim has its own exit evidence.

### Minimum requirements and current implementation

[Protocol II.1–II.6a](../../spec/UW_PROTOCOL.md) separates the two tiers.
Reader requires structured parsing, current/history routing and preservation of
unknown data; it does **not** require full validation, expression evaluation,
representations or signatures. Verifier adds complete Format validation,
dictionary reproduction, every applicable stated-figure verifier and receipt
verification. It checks stated inputs; it does not generate financial models,
fill defaults, host agents, or require starter rendering/editing workflows.

| Obligation and accepted authority | Present Python scope | Required closure |
|---|---|---|
| Reader parsing: Format II, Appendix D; Protocol II.1, XII.1–2 | `uwmd_source`, `uwmd_frontmatter`, `uwmd_reader` retain bytes, number tokens, unknown data, physical blocks and the portable projection. Existing evidence: 17 portable parse cases and nine additional frozen Reader refusals. Legal one-layer sequence-object source support now also admits all 61 builtin-class documents unchanged. | Settle the bare scalar-key question below; audit source admission, all current registered/unknown sections and canonical lifecycle routing. Do not impose validation on otherwise parseable incomplete records. |
| Reader current/history identity: Format 2.4, 2.7–2.8; Protocol II.6a.6 | Registered parallel sections, role opt-in and append collections are implemented. Reader projection and verification share `source_superseded`, which recognizes the exact fence flag or JSON lifecycle true without altering authored metadata. | The documented fence-only history-routing defect is corrected under the accepted Format 2.4/2.7 contract. Exact nullable versus named variant identities and the remaining Reader gates still require independent evidence before certification. |
| Full `validate`: Format II–V and 6.2; Protocol III.6a, V.12 | The real unadvertised command integrates structural result partitions, all fifteen CC coverage entries, seven readiness values and separate V.12. All111 unchanged actual portable subprocess cases now pass; local/composition refusals remain explicit. No complete capability is claimed. | Finish the named field/domain, applicable ordering and nonportable obligations above before promotion. Preserve published metadata warning/info/error distinctions; a portable pass does not establish complete admission or a Verifier tier. |
| Standard metrics: Protocol II.2.2, VIII.2, VIII.5.1, XIII; [dictionary](../../spec/metrics/README.md) | Source numeric precision, AST parsing, calendar and quantization foundations exist. A private allowlisted executor supplies accepted class-validation prerequisites only. No complete statement discovery, comparison API or document metric report. | Reproduce all 171 class-scoped definitions and eleven raw primary-size selectors, with exact class/id lookup, lazy null branches, role/variant selection and retained source precision. Verified/failed/unverifiable remain distinct; absent inputs are never filled. |
| General calculation method: Protocol II.2.6, VIII.1–6 | `uwmd_expressions` parses grammar and inventories references; `uwmd_periods` inspects already-selected payloads. `uwmd_numeric` provides a small seed. No execution, document lookup, overrides, prior-result evaluation, complete builtins or `calc` command. | If using expression evaluation, implement the full grammar, resolution, operator/null/lazy semantics and listed builtin signatures/refusals. Return schema-conforming quantized `CalcResult` objects; arrays preserve declaration order. AST admission or a few successful operations cannot justify `calc-evaluate`. |
| Calendar cash flows: Protocol VIII.9; Format 4.26 | Integer Gregorian dates, three day counts, ordered totals/MOIC and selected-source structural prerequisites only. | Complete declared/stated metric verification, source/variant/override refusal, quantized results and xnpv/xirr procedure. `calc-cash-flow` has a separate declaration/refusal contract; these functions are not expression-callable. |
| Property cash-flow assembly: Protocol VIII.9.5–9.6 | Closed lease-up/CF source checks used by bindings; no assembly or complete stated-result verifier. | Independently reproduce every accepted stated assembly/projection claim, coverage/source admission and explicit refusal. Reproducing a producer's stated model is verification; generating missing models remains outside this implementation's purpose. |
| Distribution waterfalls: Protocol VIII.10; Format 4.27 | Structural WF checks now participate in the developing validation API; allocation and stated-outcome verification are absent. | Full applicable structure, allocation/stated outcomes, hurdle/clawback procedures and finite ordered evidence; do not equate structural WF checks with outcome verification. |
| Reserve accounts: Protocol VIII.11; Format 4.28 | `uwmd_reserves`: complete standalone structure/balance/continuity verification with ordered binary64 arithmetic, 2dp comparison, source digest and required states. Existing evidence: all 28 unchanged cases through shared `run_case`. | Retain this implementation and evidence, integrate structural findings into validation, and close the lawful-source Envelope boundary below. This is not general calculation support. |
| Reserve draw bindings: Protocol VIII.12 | `uwmd_reserve_draws`, `uwmd_binding_sources`: complete standalone selected-source/allocation checks; selected reserve variants verify in full, original whole-document digest retained. Existing evidence: all 46 unchanged cases through shared `run_case`. | Retain exact nullable variants, plan/source/digest/arithmetic precedence and evidence; close the same Envelope boundary. Omitted plan is not a selected/verified plan. |
| Replacement funding: Protocol V.12; RFCs 0070/0075/0076/0081 | `uwmd_replacement_funding`: exact selected-cash commitment and structural prerequisites, snapshots and accepted result union. Existing evidence: 71 explicitly adapted standalone comparisons, **not** portable `validate` passes. | Integrate the existing async verifier beside, never inside, structural errors. Complete validation must invoke it for applicable outright funding and refuse incomplete/failed verification. Its selected-cash digest is independent of #365. |
| Receipts: Protocol II.2.4; [UW Receipt 3–5, 10–11](../../spec/UW_RECEIPT.md) | JCS and Envelope digest prerequisites only. No receipt parsing, recomputation, verdict API or command. Digest-only matches against receipt subjects are not receipt verification. | Implement exact supported receipt shape/version, subject canonicalization, pack/version/engine identity, reference inputs, output coverage/recomputation/results digest and precedence. Return exactly verified/failed/unverifiable with RCP findings. Unknown packs/versions, unavailable references or absent signature backends must remain unverifiable. Issuance is not required to close a read-only Verifier. |

The dependency helpers are not additional capabilities: `uwmd_jcs` implements
independent RFC 8785 canonicalization; `uwmd_envelope` projects complete semantic
content; `uwmd_text` pins ECMAScript whitespace; and
`uwmd_source_lifecycle` preserves verification history selection. Their tests
support the callers above. No production module calls Node, imports TypeScript,
looks up expected results, or supplies absent underwriting values.

### The complete validation boundary

The result is the existing `ValidationResult`: `overall_status` (clean,
warnings, errors or blocking), all seven `stage_readiness` booleans, `issues`,
partitioned `errors`/`warnings`/`info`, and `coverage`. Each issue carries
registered code, severity and message plus applicable section/field/evidence.
[Format 5.1–5.3](../../spec/UW_FORMAT_SPEC.md) requires class-adjusted readiness,
DQ-06 stage gaps, role-aware selection and one coverage entry per registered
CC check: evaluated, or skipped with section_absent, variant_unresolvable,
field_absent or not_applicable. A missing coverage entry is unimplemented,
not clean. Coverage does not change overall status.

Integration must apply each helper's accepted conditions, not concatenate local
inventories. For example, the frozen missing-meta source pins META_MISSING;
an absent `_meta` must not be relabeled META-01 merely because a local shape
check rejects it. Retired wrappers and the allocated nested-object shape have
their own META-01 contract (RFC 0081 section 3); a schema rule alone does not
allocate every typed metadata/required-field failure to that code. The complete validator must preserve
published META_MISSING and META_FIELD_MISSING_* warnings and the informational
low-confidence finding; the developing API now integrates those published distinctions.

Complete validation includes the applicable CC, FV, DQ, MU, CS, LU, RT, PS,
ROLE, LOC, CUR, TAX, LSE, HDG/ESC, WF, REC, RSV structure, CAPX, BED, META,
SRC, builtin CLS/class-specific and builtin rule families registered by
Protocol III.6a and their accepted Format/RFC rules. This includes all official
builtin classes, not just multifamily. External module loading/custom formulas,
editing policies and optional integrity checks are not silently made mandatory
by this inventory; apply their owning capability and accepted case context.
PS-03 is the statically recognizable selector-kind mismatch check specified by
VIII.2a under default section selection. Its inspection of syntax, including
conditional branches, is not a runtime short-circuit/evaluation verdict.

`replacement_funding_verification` is a separate sibling result under V.12;
HDG-09 must never be appended to synchronous structural errors. A structurally
clean but stale, unavailable or uninvoked applicable outright binding is not a
complete successful result. Preserve accepted 0076 selection refusals together
with 0081's narrower all-or-none hedge-terms applicability.

Portable stdout must be exactly one JSON document; diagnostics use stderr.
Exit 0 means success, 1 a protocol-described refusal/error with parseable JSON,
and 2 an unrecoverable internal error (II.6a.2). Operational refusals must be
expressible as [ProtocolError](../../spec/schemas/protocol-error.schema.json);
a calc failure has category `calc`, registered code and null value, rather than
a fabricated successful result. These are whole-command gates, not new wrapper
or capability names. The existing narrow wrappers have local `ok` meanings
and do not provide these command contracts.

The other mandatory result boundaries also remain explicit:

- `calc` returns `calc_id`, `ok` and `value` under the
  [CalcResult schema](../../spec/schemas/calc-result.schema.json), with numeric
  values quantized once and protocol errors separately identified. Missing
  input/null is not an invented zero, ambiguous selection is CALC-RESOLVE-002,
  and nonboolean logical operands are CALC-TYPE-001. The current local CLI
  diagnostic envelope is not yet a complete ProtocolError adapter.
- Cash-flow and waterfall verification use the accepted three verdicts.
  A stated IRR whose procedure raises is failed; undefined MOIC is
  unverifiable; an absent metric is not checked. Waterfall failure outranks
  indeterminacy. Property assembly has closed plan/result schemas and typed
  CALC-CF-ASSEMBLY reasons with nested source evidence (VIII.9.6), rather than
  a generic successful calc or reconstructed producer assumptions.
- Reserve results have `state`, optional `reason`, `source_digest`,
  `evidence` and `issues` under the two accepted verification schemas.
  Absent section/omitted plan is not_checked/not_applicable; malformed
  prerequisites, unavailable digest and nonfinite arithmetic remain
  unverifiable; stale draw commitment or finite disagreement is failed.
  The commands exit 1 for failed/unverifiable, 0 for verified/not_applicable.
- A receipt verifier returns `verdict`, `issues` and, when available,
  recomputed results. UW Receipt 5.1 orders unavailable canonicalization
  (RCP-09), subject mismatch (RCP-01 or version-aware RCP-10), resolved
  reference mismatch (RCP-12), inability to decide (RCP-05/06/08/11), invalid
  signature, output coverage/value disagreement (RCP-02/03, or engine-aware
  RCP-07), then results-digest mismatch (RCP-04), before verified. Equal
  subject hashes alone cannot pass this sequence. The existing reference CLI
  is `receipt verify <file> <receipt.json>`; the portable six-command table
  has no receipt operation, so a genuine API/CLI adapter is needed for its
  nonportable assertions. For the launch implementation, support the
  accepted launch receipt/version/procedure registry; historical pre-5 receipt
  success is not a reason to add a legacy decoder, alternate numerical
  backend or acceptance fallback.

### Optional scope does not enlarge the minimum

| Optional claim | Current status and closure boundary |
|---|---|
| Module profile (`module-load`, `calc-evaluate`; Protocol VII/X, II.3) | Not implemented. A base Verifier may reproduce builtin metrics by any method; module/document-declared custom formulas remain unverifiable without this profile. If it evaluates expressions, II.2.6 still applies. |
| Integrity profile (`integrity`, `signing`; V.9–11) | `uwmd_block_integrity` supplies V.9 hashes and bounded V.10 chain assessment, including explicit unsupported identity classification. All physical history stays visible; signatures remain unchecked. Eleven hash-only standalone comparisons are not signature passes. Complete supported-domain chain classification and block-signature verification are missing. |
| Document snapshot authentication (`document-signature-verification`; V.13) | Not implemented; separate optional Integrity-profile capability. Existing semantic digest controls do not implement guarded authentication, trusted keys or signature verdicts. No tier requires it. |
| Representations profile and discovery (I.5/II.3; representation specs) | No advertised representation entries or codecs/negotiation. Lite/XML/CSV/Envelope round trips and source/model/view fidelity are separate from structured Markdown Reader certification. #365 affects a lawful source-to-Envelope shape, not a requirement that every Reader implement codecs. |
| Portfolio; sensitivity; stochastic (XV; VIII.7; VIII.8) | Not implemented; separate optional flags, contracts and profile-owned evidence. Their absence cannot prevent a complete base Reader/Verifier claim. |
| Rendering, editing, refinement, AI hosting/workflows | Starter products, outside both tiers. No Python implementation is needed to complete base verification; StackUW owns financial-model generation, agents, skills and workflows. |

A receipt with a signature and no verification backend must report RCP-08
unverifiable; implementing every signing algorithm is not a prerequisite for
the read-only receipt verifier. It cannot silently accept the signature.
Receipt issuance, block authorship, document authentication and arithmetic
recomputation attest different things and must not substitute for one another.

### Actual corpus obligations and evidence

Current accepted-main `e2761157` counts below were read from the existing
[ownership index](../../conformance/corpus-index.json) and generated
[portable cases](../../conformance/runner/cases), not inferred from suite names
or older README totals:

| Owner | Indexed reference checks | Portable cases |
|---|---:|---:|
| Reader | 26 | 17 |
| Verifier | 698 | 281 |
| Module | 76 | 1 |
| Integrity | 32 | 14 |
| Representations | 142 | 0 |
| Portfolio | 14 | 0 |
| Sensitivity | 5 | 0 |
| Stochastic | 7 | 0 |
| Starter products, reported separately | 106 | 37 |
| Total | 1,106 | 350 |

A separate integrator audit at prior checkpoint `0a2cbd9d` executed 99 native
structural comparison projections through the real Python CLI: 21 tax, 21 lease,
18 capex, 16 recovery and 23 malformed-document comparisons. All projections
matched at that historical checkpoint, but only 90 returned normal ValidationResult responses; nine returned
explicit partial local refusals. This is **not** 99 complete case passes or all
nonportable validation coverage. The nine refused inputs retain unsupported
REC conditional-shape or metadata evidence rather than silently returning clean.
The current exact-nine reconciliation above supersedes only that refusal count;
this broader historical report remains unchanged.
Report SHA-256: `80b09523e92f5e379e064241f2c0ccbd9d9e8357f6ff552b605543f8b5e75287`.

The 281 portable Verifier cases are **111 validate** (17 documents, 71 hedge,
23 scenario), **96 calc**, **28 reserve accounts** and **46 reserve draws**.
Validate cases require `validate`; calc cases require `calc-evaluate`;
the two reserve commands require both `parse` and `calc-evaluate`. Directly
running the 74 unchanged reserve cases proves those commands but bypasses
catalogue discovery, deliberately and explicitly. It cannot justify claiming
the broader calculation capability. With the current parse-only manifest,
a selected portable Reader+Verifier run would run 17 and capability-skip 281;
that is an inventory prediction, not a newly executed result.

Portable comparisons are subsets, with length-sensitive arrays and only named
projections/masks; full validation output is not proved by a code-set projection.
The current Python 71 replacement, eleven hash-only, nine source/role and four
currency comparisons explicitly adapt to narrower standalone outputs. They
are useful evidence, not additional unchanged portable passes or complete
validation/profile claims.

The nonportable Verifier checks matter: the index includes 41 metric checks,
61 builtin-owned checks stored under `modules`, 12 receipt checks, 20 cash-flow,
85 property-assembly, 42 waterfall, 11 capital-stack checks, plus full structural
families. Directory names do not make builtin classes optional modules.
Closure must reproduce their unchanged accepted assertions independently,
using shared comparison functions where suitable and clearly labeled API
adapters for contracts the portable driver does not expose. Running the
TypeScript reference suite alone does not test Python.

An absent/empty capability list means **claim everything**, not nothing.
Unclaimed profile cases are unverifiable, capability omissions are skipped,
and neither counts as passed. Certification must publish manifest, selector,
exact source head, commands, counts and skips; `--no-skip` rejects incomplete
selected claims (II.6/II.6a). No corpus, expected file or capability requirement
may be rewritten to make the Python report green.

### Real dependencies and contract questions

| Boundary | Consequence for closure |
|---|---|
| Appendix D scalar keys | Bare `12:`, `true:`, `null:` have YAML scalar meanings, but JSON frontmatter has string member names. Admission/coercion/collision behavior is not pinned by the frozen cases; Python refuses them. Resolve this narrow source contract before Reader certification; quoted string keys already work. |
| Unlabelled versus literal `default` variants | Current parse projection uses `attributes.get("variant", "default")`, so admitted unlabelled and explicitly named `default` peers can collapse despite physical retention. Prove exact source identity, no silent peer loss and stable current/history selection at the Reader surface; coordinate the joint representation question with #365 instead of inventing a mapping or choosing a peer. Explicit local unsupported refusal is honest partial behavior while unresolved, not proof of complete Reader support for lawful admitted input. |
| Metadata completeness prose omission | III.6a names the five missing-field paths and explicitly pins the low-confidence info finding, but omits the other severities. Preserve the accepted published validator precedent: META_MISSING and all five META_FIELD_MISSING_* findings are warning, META_LOW_CONFIDENCE_NO_REVIEW_FLAG is info, and allocated wrapper/nested-shape META-01 is error. This is an ordinary implementation decision, recorded under the repository's precedent rule, not an owner blocker or permission to alter severity. Independently implement the triggers and report the prose omission separately. |
| [#365](https://github.com/UWMD-OSP/UW-Markdown/issues/365), lawful role-opted extension variants versus Envelope 1.0 singleton extension slots | Source is retained and digest callers report unavailable rather than discard peers or invent a new shape. Whole-source reserve/draw and future receipt commitments need the accepted representation resolution for these documents. Structural validation, selected-cash replacement commitments, block hashes and ordinary dictionary arithmetic are independently implementable. Draft proposals are not an accepted codec contract. |
| [#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) / RFC 0088 numerical determinism | Full pow/log/exp/annuity/NPV/IRR/XNPV/XIRR paths need accepted cross-runtime procedures/order. Experiments do not select them. All 171 current dictionary formulas use arithmetic/conditionals and, as their only named function, round (six occurrences); their definitions do not themselves depend on those procedures. Complete general builtin support and numerical-dependent stated-figure branches still do. |
| Historical role changes in chain grouping | Bounded chain reports explicitly mark unsupported identity classification. Do not invent a history/orphan policy or call this complete Integrity support; it is optional and does not block base validation/metrics. |
| Stale counts and portable catalogue granularity | “21 sections” in II.1 and old corpus README totals are documentary drift, not a new closed registry. Recognize current Format Part IV and preserve unknown IDs. Broad reserve-case calc flags and missing portable receipt/metric cases are evidence/discovery limitations, not permission to omit normative Verifier work or fabricate a narrower flag. |

### Ordered capability-closing milestones and exit gates

1. **Close the Reader proof alongside validation work.** Reconcile the identified
   source/key/lifecycle boundaries; retain required frontmatter parsing, unknown
   data and exact current/history/variant behavior. Gate: all 26 Reader-owned
   assertions (17 genuine portable cases plus nine frozen refusals), additional
   contract-boundary controls, unchanged source bytes and explicit manifest
   evidence. Optional representations/signatures are not part of this gate.
2. **Complete the implemented `validate` capability, not another inspector.** Use one
   orchestration API with reusable selected-source/role/period/currency/reserve/
   replacement helpers; finish missing registered structural, threshold, class
   and cross-check families internally, preserving the accepted metadata-family
   severities. Gate: complete result fields/partitions and every applicable
   family/completeness ordering and precedence constraint,
   every registered CC coverage entry, stage overlays, source-order/role/absence/
   refusal controls, all 111 current governed portable validate cases through the real
   command, plus every applicable nonportable validation assertion and separate
   V.12 failure states. Only then advertise `validate`; no Verifier tier follows yet.
3. **Close metric reproduction and the chosen calculation method.** Implement
   document runtime selection, lazy null/refusal semantics, token precision and
   every builtin dictionary definition/size selector. Gate: all 171 definitions
   across twelve classes, eleven raw-size contracts, all 41 metric checks and
   adversarial missing/type/zero/selection/precision controls. If expressions
   are the method, finish II.2.6's entire builtin/grammar contract and the
   96 Verifier calc cases before advertising `calc-evaluate`; dictionary-only
   success never promotes that flag. Independent arithmetic work can proceed
   while the numerical procedures are resolved.
4. **Close all remaining stated-figure obligations.** Integrate existing
   reserve/draw/replacement verifiers and independently complete calendar
   cash flows, lease-up/property assembly and waterfalls. Gate: all applicable
   indexed assertions, exact schemas/states/precedence, original-source digest,
   finite ordered evidence and numerical cross-platform results; accepted
   #365/0088 resolutions are prerequisites only for the paths they affect.
   Missing claims, unavailable inputs and real disagreement remain distinct.
5. **Close receipt verification, then certify the base Verifier.** Implement the
   read-only receipt contract and its 12 indexed verification assertions,
   including recomputation, reference-input and identity/precedence controls;
   do not require issuance or optional signing success. Gate: audit all
   26 Reader + 698 Verifier indexed assertions against their actual required
   capabilities and accepted contexts; pass every applicable base assertion,
   with optional requirements separately identified. Run the real 298-case portable
   Reader+Verifier selection without capability skips, explicit exclusions/
   refusals for unclaimed optional profiles, unchanged corpus and repeatable
   independent cross-platform evidence. Claim a Verifier tier only when all
   II.2 obligations, including nonportable ones, are implemented and demonstrated.

## Standalone reserve-account verification

`python -B implementations/python/uwmd.py verify-reserve-accounts <file> --json`
implements accepted Format §4.28 and Protocol §VIII.11. It snapshots parsed
source, checks closed account/period/movement facts and provenance, then checks
authored-order binary64 balance identities and explicitly claimed continuity
at the existing separately applied 2dp half-away boundary. No movement class,
missing row or financial assumption is inferred. All active reserve variants
are inspected independently; source rows and metadata remain unchanged.

The result distinguishes absent `not_checked/not_applicable`, structural or
digest/nonfinite `unverifiable`, finite disagreement `failed`, and `verified`.
Overflow does not discard later finite period evidence. Exit status is 1 for
failed/unverifiable, 0 for verified/absent. Balance agreement does not establish
source authenticity, economic completeness or correct producer classification.
No gross expenditure, cash-flow assembly, formula evaluation or receipt is made.

The prerequisite `uwmd_envelope.py` projects complete Envelope 1.0 blocks,
annotations, metadata, retained prose, collections and explicit superseded
history, including extension history. Its SHA-256 preimage excludes only the
three top-level volatile members. `uwmd_jcs.py` independently implements RFC8785
UTF-16 key ordering, Unicode/refusal and ECMAScript binary64 number serialization
using exact integer-rational shortest-decimal search; it never calls Node.
Existing frozen receipt/document-signature *subject digests* are test oracles
only. No receipt verification, document authentication or Integrity capability
is implemented by computing those source digests.

The current Reader admits role-opted extension variant maps while the accepted
Envelope schema permits a single block at each extension ID. That unresolved
representation boundary ([Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365))
produces `unverifiable/digest_unavailable`, without
inventing an envelope shape or changing either contract. Ordinary singleton
selection follows existing Reader semantics; no signature-only source guards
are added. Annotation mapping collisions also refuse unavailable projection
rather than erase an authored field.

Verification evidence: 91 Python unit methods preserve all earlier 74 controls
and execute every one of the 28 unchanged generated reserve cases through the
actual shared driver's subprocess/comparison function. They also pin published
RFC8785 vectors, independent frozen whole-source digests, prose/annotation/history
mutations, source/schema nonblank semantics, no mutation, monetary boundaries,
compound date/order findings, overflow precedence and retained finite evidence.
These 28 direct case results are **not** a portable tier/capability certification
run: the catalogue currently requires `calc-evaluate` for those cases and has
no dedicated reserve token. The manifest stays parse-only; no wrapper invents
capabilities. Genuine portable Reader runs remain separately reported as 17/17.

## Standalone reserve-draw bindings

`python -B implementations/python/uwmd.py verify-reserve-draws <file> [plan.json] --json`
implements accepted Protocol §VIII.12/RFC0065. An omitted plan returns
`not_checked/not_applicable`; explicitly supplied JSON null is invalid structure.
The plan names exact nullable variants, account/period/movement IDs, gross
lease-up TI/LC cells or cash-flow row ordinals, declared funded shares and
positive allocations. No default/base/role/fence-order fallback is used.

Each selected reserve variant is checked in full, including accounts/periods
not individually selected by an edge. Unselected reserve variants do not affect
that account verification, while the original *whole-document* Envelope digest
still binds their content, provenance and history. Selected CF/lease-up sources
undergo closed shape, finite amount, real calendar/order/contiguity, range and
registered-model checks. Binding does not recompute their financial metrics.

The verifier snapshots both inputs, validates inventories/edge uniqueness before
hashing, checks stale digests before source resolution, and refuses source
errors before allocation comparisons. It retains all finite resolved edges even
when another source fails. In authored binding order, independent draw and
expenditure sums use binary64 without intermediate rounding and the existing
separate 2dp quantum. All selected draws must be fully allocated; expenditure
totals must match the declared funded share without exceeding gross magnitude.
Overflow preserves finite edge evidence and later independent finite mismatch
findings. Gross expenditure, authored dates/periods and metadata remain unchanged;
no cash-flow generation, owner-cash remainder, transfer, classification or timing
convention is invented.

The existing frozen `superseded-source` case exposed an earlier Python semantic
projection gap: `superseded=true` in a fence must route that complete block to
history even when the optional JSON lifecycle flag is absent. A source-lifecycle
helper now serves Envelope/reserve/binding verification without injecting JSON
metadata or changing the existing Reader projection/source bytes. This fixes
implementation behavior against the accepted contract; it changes no receipt
canonicalization rule or document-authentication admission requirement.

Evidence: **103 Python methods** preserve the prior 91 controls and add twelve
focused binding methods. Every one of the **46 unchanged generated binding
cases** executes through the actual shared subprocess/comparison function,
alongside the existing 28 reserve cases. Extra controls cover exact identity,
selective/full-source verification, closed sources, precedence, monetary
boundaries, overflow with later finite findings, evidence order and no mutation.
These direct case results are not tier/capability certification: the catalogue
requires broader `calc-evaluate`, which remains unimplemented and unclaimed.
The manifest stays parse-only and genuine Reader 17/17 runs remain separate.


## Standalone replacement-funding bindings

`python -B implementations/python/uwmd.py verify-replacement-funding <file> --json`
implements accepted Protocol §V.12/RFC0070, including RFC0075 senior preference,
RFC0076 refused selections and RFC0081's optional terms group. Its two-member
CLI wrapper is **nonnormative**: `structural_issues` contains only the relevant
hedge, funding, escrow, cash-source and currency prerequisites;
`replacement_funding_verification` has the exact §V.12.3 result union. There is
no overall validation/readiness result. `calc` remains unsupported; the unadvertised `validate` command has the bounded scope above.
Exit status is nonzero for relevant structural refusal or failed/unverifiable
binding. A lawful nonapplicable path returns `not_checked/not_applicable`.

The independent property selector preserves canonical current revisions,
excludes component/invalid roles, prefers senior debt and refuses a consulted
role collision before fallback. Exact cash lookup separately uses the authored
variant, so an unlabelled peer cannot capture an explicitly named `default`.
Shape/assumption, selection/reference, full selected-series structure and raw
payment sign/date checks precede hashing. Explicit zero is admitted; payment
must follow the initial effective date, with no expiration boundary or monetary
quantization. Debt-only findings survive refused cash-side selection;
`unresolvable_source` takes precedence when selection prevents assessment.
Known strike-only hedges have no replacement-selection claim under RFC0081;
malformed stated hedges cannot establish that exemption. Retired hedge agreement
codes do not reappear.

The digest helper hashes exactly the fixed section, authored cash variant, safe
row index, exact document currency (or canonical null), and entire ordered
cash-row vector. All authored row members, including absent versus null, remain
significant. Metadata, prose, debt and top-level cash metrics are excluded; no
metric is recomputed. This is a separate binding digest, never an Envelope or
selected-row-only hash. Lawful unrelated extension variants therefore do not
block it even when [Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365)
prevents an Envelope digest. Both published monetary-identity digests match.

The structural API never hashes. The separate async verifier snapshots before
its first await, then reports verified/equal, failed/stale binding with HDG-09,
or unverifiable structure/source/hash-provider states. Only actual inequality
produces HDG-09, in verification rather than structural errors. Source, reference,
commitment, provenance and caller objects remain unchanged. This consistency
check proves neither a verified deal nor an executed cap trade.

Evidence: **119 Python methods** preserve all prior 103 controls, including
reserve28 and reserve-draw46 direct cases. Sixteen new methods include **71
adapted standalone comparisons**: actual command subprocesses, then unchanged
shared `replacement-funding` projection and `json_subset` comparison. A test-only
adapter maps narrow structural findings to that projection's input. It does not
implement validate, change generated cases/capability flags, or claim 71 portable
or full-validation passes. The catalogue requires broader `validate`, which
remains unimplemented. Discovery stays parse-only; genuine Reader17/17 runs stay
separate.


## Block hashes and bounded chain assessment

`python -B implementations/python/uwmd.py verify-block-integrity <file> --json`
adds independent Protocol §V.9 block hashing and a bounded §V.10 chain assessment.
This command's report and local assessment vocabulary are **nonnormative**. It
is not the full `IntegrityResult`, an integrity-profile claim, full validation,
signature verification or document authentication. Discovery stays parse-only;
generic verify and calc remain unsupported. The unadvertised validate command has the bounded scope above.

`compute_block_hash` snapshots an explicit fenced object, removes only top-level
`_meta`, canonicalizes with independent RFC8785 JCS and hashes UTF-8 using stdlib
SHA-256. The result is lowercase unprefixed hex. Literal payload `content`, nested
`_meta`, `_role`, `_overrides`, `_notes`, absent/null distinctions and array order
are included. Entire top-level provenance/lifecycle/integrity metadata is excluded.
No old digest rule, source rewrite, financial procedure or Envelope is involved.

The file checker retains every physical block, including superseded history,
with exact authored variant, source ordinal and actual hash evidence. It assesses
unambiguous singleton sequences, registered parallel identities and current
role-opted variant identities. Missing labels and explicitly named `default`
remain distinct. It does not apply financial role preferences or discard old
payloads. Where removed historical roles or multiple append-only entries leave
chain identity outside this implementation's supported domain, it retains all
block hashes but returns local `unsupported` assessment and `ok: false`, without
inventing an INT finding or choosing a new historical grouping policy. Counts
cover classified chains only. `verify_block_chain` instead takes an explicitly
addressed ordered block sequence; the caller owns that identity and ordering.

Wholly unhashed supported sequences are skipped and remain unchecked. Only
missing hashes **after** opt-in produce INT-03 warning; parent mismatches against
the immediately prior retained block produce INT-01 error; stamped content drift
produces INT-04 warning. Earlier unhashed prefixes do not acquire an extra rule.
A retained first block's non-null parent does not create a new missing-history
refusal: accepted replace/root behavior and pending history decisions are kept.
INT-02 belongs to editing and is not emitted by read-only assessment.

The nonnormative local `ok` is strict: any reported finding, unsupported chain or
unavailable hash makes it false. `complete` means only this supported assessment
finished. `unavailable` distinguishes malformed local inputs, unsupported hashing
metadata, JCS refusal or failed/malformed SHA providers from actual mismatches.
No fabricated INT-01/04 is used for those failures. Evidence for other performed
checks is retained. CLI exit is nonzero whenever local `ok` is false.

Signature presence is counted, always with `signatures_checked: false` and
`signatures_verified: 0`. No signature format, key, algorithm or authenticity
check is performed; a matching block hash does not authenticate its author or
prove that history is complete. Existing signing fixtures supply **hash-only**
evidence, never signature-conformance passes. No broader profile flag is added.

Evidence: **132 Python methods** preserve the earlier 119 controls, including
Reader17, direct reserve28/draw46 and 71 adapted replacement comparisons. Thirteen
new methods include **11 actual standalone frozen hash-only comparisons**: the
broken-parent fixture, the existing editor's pre-edit block and nine block-signing
sources. A test-only projection compares applicable INT-01/03/04 expectations via
the unchanged shared subset comparator; it never claims full signing or portable
integrity passes. Further controls cover exact scope, opt-in prefixes, independent
parent/content failures, nullable/current/history identities, unsupported grouping,
hash-provider/JCS failures, unchanged roots and snapshots before the first await.


## Metadata, active source and role inventory

`python -B implementations/python/uwmd.py inspect-source-roles <file> --json`
performs a bounded independent Format §2.5/§2.6/§2.8 inventory. The report is a
**nonnormative standalone wrapper**, not `ValidationResult`, complete Format
validation or a Reader/Verifier tier claim. Discovery stays parse-only;
calc and generic verify remain unsupported; the developing validate command is described above. The unadvertised validate command has the bounded scope above.

`inspect_source_roles` snapshots the current parsed-value model. Its source/role
checks inspect every active physical block, including earlier active blocks
hidden by canonical singleton selection,
all parallel variants, extension sections and unselected role peers. It reports
exact SRC-01 actor-grammar failures, SRC-02 resolution tags in actor fields,
SRC-03 unknown resolution values and ROLE-01 invalid active scalar roles. The
same actor/resolution checks apply to admitted top-level `_overrides` entries.
Actor and resolution fields are never moved, normalized, inferred or repaired;
`manual` is an actor and cannot be used as a resolution. Explicit null differs
from an absent optional resolution. `_meta.role` and retired flat metadata are
never interpreted as aliases. Pinned RFC 0081 META-01 routing checks reject
`section_id` wrappers, present nonobject `_meta`, and nonobject/missing nested
provenance or lifecycle. Accepted RFC0093 below now allocates late `_meta`, mismatched section
identity and invalid quality-container findings; actor admission remains independent.

Registered findings are separate from `shape_findings`, which are explicitly
local diagnostics with no invented registered code or severity. Other selected
provenance/quality/lifecycle member types and override path/confidence/reason/note
shapes are checked against the accepted block schema. These checks do not invent
an override path grammar, traverse a target, require its existence, reject unknown
payload/annotation members, or apply override precedence to underwriting values.
An agent source requires the `agent_id` member; admitted null remains unchanged.
JSON integer semantics admit revision `1.0` and reject booleans.

Historical blocks are counted as skipped by the active source/role checks;
their metadata shape and actor are inspected, and their roles are not
reclassified. Source byte spans,
physical ordinals and exact authored variants distinguish findings on repeated
active blocks. Returned evidence is detached and the original source/Reader
projection remains unchanged. The wrapper's local `ok` requires both finding
lists to be empty; CLI exit is nonzero when this bounded inventory refuses.

The live underscore provenance-completeness family, full timestamp/metadata
schema validation, conditional market-data/composition reference verification,
edit authority, role selection for calculations and signatures remain separate
obligations. This inventory does not add defaults, financial behavior or a full
validation capability.

Evidence: the original twelve focused methods include **nine actual standalone scoped
fixture comparisons**, using the shared subset comparator through an explicit
test-only projection. The accepted actor rule below adds its governed diagnostic
expectations alongside the frozen prelaunch assertions; it does not claim those
old assertions pass unchanged. Source vocabulary fixtures,
bare metadata negatives and declared/invalid role fixtures are checked only for
the implemented finding families; these are not portable validate passes.
Additional controls cover all actor namespaces, exact ASCII spelling, every
resolution tag, malformed leaf values, active physical peers, superseded flags,
unknown payload retention and no mutation. Discovery flags remain unchanged.


### Required actor admission — RFC0090

Accepted RFC0090 defines the bounded actor contract implemented here. It adds
META-01/error at `_meta.provenance.actor` for absent, null, exact empty string
or non-string values. Every nonempty string is retained, including whitespace;
there is no trimming, actor namespace rule, inferred principal or alias fallback.
Other typed metadata findings remain uncoded local assessments.

The existing wrapper/nested-object checks run first across all retained physical
blocks, followed by the actor pass in physical source order, then the existing
active ROLE/SRC checks. Whole-missing metadata remains a completeness matter
(local in this partial command); malformed wrappers/nested objects receive their
existing single META-01 and no actor cascade. History, append/extension blocks,
unselected variants and overwritten physical peers receive actor checks. History
roles and sources are not reclassified. The legacy `blocks_checked` and
`history_blocks_skipped` counters describe only the active source/role pass.

Routing correction against accepted RFC 0081 section 3: the original test
blob above also allocated META-01 for (1) otherwise valid metadata with
`_meta.section="wrong"` and (2) otherwise valid metadata appearing after a
payload member. Both assertions are now explicitly corrected to no registered
issue plus an uncoded local finding at `_meta.section` or `_meta` respectively;
local `ok` remains false. Those requirements are retained in their active-only
scope and are not widened to history or used as actor-suppression predicates.
This removes a prior unsupported code allocation rather than preserving it for
prelaunch compatibility. Combined controls prove missing actors still produce
their own META-01 with either requirement, including history, without allocating
an extra historical finding for member order or section identity.

The current canonical inline parsed `_meta` is authoritative. The operation
snapshots `Document.source.blocks`; it does not silently reparse immutable raw
bytes or certify a caller-mutated model as the original source. Physical spans
remain origin evidence, not a source/model consistency verdict. Inputs and source
bytes are unchanged. No new command, capability, full validation or tier claim
is introduced.

Governed test delta: the previous source-test blob
`0333e25bd130d024b25e8c53784f3394aa162894` asserted malformed actor `0` only
as a local finding and compared three actor-absent role documents without actor
codes. The governed tests now explicitly expect META-01/error instead of the actor
local finding, and 11/8/8 actor findings on the unchanged documents below.
These are governed diagnostic assertions, not rewritten frozen validate results
or a complete affected-corpus inventory.

| Unchanged source fixture | Git blob |
| --- | --- |
| `10-declared-roles.uwx.md` | `cf59916f6d05e96ba2d34cff2405453b25945279` |
| `11-role-collision.uwx.md` | `0231d5b466b733637f8fd062fbd515ba0bf82f82` |
| `12-role-eligibility.uwx.md` | `6c2a00fc74c4305315a4af235abe4c889914b573` |

Five additional focused methods cover actor value boundaries, all-physical
coverage, shape/actor/role/source ordering, independent actor admission beside
unallocated order/identity requirements, and parsed-model authority. Existing
source, timestamp, quality, lifecycle and override diagnostics keep their
registered-versus-local allocation. Changing an actor would leave the V.9
content hash (which excludes `_meta`) unchanged but can change block signatures,
Envelope/document signatures and receipt subjects; this implementation changes
diagnostics only and never repairs actors or reissues historical evidence.


## Document currency assertion

`python -B implementations/python/uwmd.py inspect-document-currency <file> --json`
independently checks the accepted document-level currency assertion under Protocol
§III.1b/RFC0046. A non-null authored value that is not exactly three uppercase
ASCII letters emits `CUR-01` with error severity. Accepted §V.12.2 explicitly
admits absent/null identity; evidence preserves their difference rather than
inserting or normalizing a value. No hedge, reserve or other financial section
is required for this document-level check.

This standalone wrapper is **nonnormative** and limited to currency identity.
It reports the exact authored value, relevant findings and a local `ok`; its
exit is nonzero on a currency refusal. It does not provide a full frontmatter
or document ValidationResult. Discovery remains parse-only; calc and
generic verify remain unsupported; the developing validate command is described above.

There is no whitespace trimming, case conversion, locale/location inference,
ISO4217 allocation lookup, display rendering, FX, precision choice or financial
calculation. Unallocated but syntactically valid `ZZZ` stays an authored identity.
Source bytes, parsed values, unrelated frontmatter and Reader projection remain
unchanged; returned evidence is detached.

Seven focused methods include four actual standalone scoped fixture comparisons:
the unchanged frozen currency validation projection pins `CUR-01` error, and
existing explicit-MXN/absent/null sources exercise accepted identity cases. An
explicit test-only projection uses the unchanged shared subset comparator;
these are not portable validation, rendering or binding-verification passes.
Other controls cover exact ASCII/type admission, missing versus null, unsupported
locale independence, no financial-block prerequisites and retained source bytes.

## Source lifecycle routing correction

Reader projection and existing verification now use one source lifecycle helper.
Exact fence `superseded=true` or JSON `lifecycle.superseded: true` routes a
physical block to ordered history before role opt-in, singleton/variant lookup,
extension routing or append-collection handling. A false flag in either location
does not override true in the other. Authored metadata, payload, spans, raw bytes
and historical evidence are preserved without injecting missing JSON members.
This fixes the existing reserve-draw superseded-source parse discrepancy; it
changes no Envelope shape, digest rule, receipt verdict, discovery or tier claim.

## Accepted RFC0091 source-inspection contract

The bounded source inspector reports META-02/error for an absent, null or
nonboolean canonical `_meta.quality.human_review_required`, and META-03/error
for the same condition at `_meta.lifecycle.superseded`. Both literal booleans
pass. Parent-shape precedence, physical/history ordering, actor independence
and canonical model authority follow the accepted RFC; no coercion or source edit
occurs. Eight focused controls cover these boundaries. The owner accepted the
contract on2026-10-17; discovery stays parse-only, and this helper is not complete
validate. Incomplete admitted canonical metadata, including history, gains errors;
validation exits and newly issued receipt policy counts can change without
repairing sources or rewriting historical subjects. No version is allocated.

## Accepted hospitality field-home predicates

`uwmd_builtin_field_homes.py` supplies only the five removed official field-home
predicates from accepted RFC0081 G3, for the developing complete validator.
Presence is invalid even for null: `rent_roll.keys` and `hotel_metrics.adr`,
`occupancy`, `available_room_nights`, `key_count`. The caller owns class and
current-source selection and registered CLS-04 attribution. Arbitrary unknown
members and universal annotations receive no invented allocation. Three focused
methods cover exact presence/type boundaries, ownership, order and no mutation.
This helper adds no command or capability; discovery remains parse-only.


### Independent capital-tranche findings

The developing `validate` command now retains independent CS-01 member errors
in id, class, position, amount order and uses the reference id-or-index field
attribution, including component stack prefixes. RFC0050 CS-02b independently
reports split-class, cash-rate and accrued-rate failures before an assessable
total-rate disagreement. An absent total rate remains CS-02, without a duplicate
CS-02b aggregate failure. Existing type/value guards, current-source selection,
metadata checks and the separate sizing assessment remain unchanged.
Focused controls exercise ordinary and component stacks, nullable authored terms,
literal booleans, duplicates, split rates, history/current peers, mutable model
authority, result partitions and real CLI exits. This closes a loss of registered
finding multiplicity and attribution; it does not claim exhaustive capital-stack
admission, sizing verification or complete validation. Discovery stays parse-only.


### Accepted RFC0093 metadata shape

The integrated validator and bounded source inventory allocate only the accepted
P1/P2/P3 META-01 errors: late canonical metadata, present invalid/mismatched
canonical section, and required missing/nonobject quality. A complete retained
physical shape pass follows prior wrapper admission and precedes all actors,
then the existing flags. P1/P2 never suppress independent actors or flags; P3
suppresses only the already unadmitted quality child. Missing metadata/section
and missing-confidence warning behavior remain unchanged.

The current Document API is a mutable-model operation: non-index string-member
order and canonical current block values/annotations are authoritative.
Private fresh-source entrypoints parse the supplied bytes and preserve decoded
lexical JSON order, including numeric keys and escaped metadata spelling.
The real validate and source-inventory commands use those source entrypoints.
Neither path reparses stale raw bytes to override a mutated model. Exact emitted
owners consume only the identical local requirement; unrelated typed/conditional
requirements still produce explicit incomplete-operation evidence.
Discovery remains parse-only; this is not a complete validation capability claim.


### Recovery parent admission

The developing validator reports the existing REC-02 for non-null, nonobject
recovery terms and caps under Format4.3/RFC0058. The cap predicate applies
independently of method; absence, null, empty objects and G1's lone cap retain
their prior admission. Duplicate local type evidence is consumed only with the
actual REC-02/error on the same physical block, tenant field and fixed type
constraint. An unrelated code, sibling field, peer, missing owner or changed
constraint cannot provide coverage. Unknown members and other unallocated
conditions stay explicit local refusals. No recovery amount, cash source,
default, standalone command, conformance expectation or discovery claim changes.


### Lease-up registered-condition ownership

The developing validator consumes duplicate local evidence only for an actual
LU-03 nonempty-schedule error or LU-01 cadence/period/target grammar error on the
same current physical block and exact field. Predicate tags are private;
ordinary result states and registered issue ordering remain unchanged.
Unallocated model, numeric, row-container and unknown-member requirements remain
local even beside a registered LU error. This corrects partial-refusal transport
for the unchanged native empty-schedule negative without computing a trajectory,
changing a frozen expectation or claiming complete validation.
