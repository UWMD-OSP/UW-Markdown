# Independent Python structured Reader foundation

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354).
This unpublished, incomplete implementation is written independently from the
Format and Protocol. It uses Python's standard library and has no Node runtime,
external packages, hosted services, production fixture lookup, or TypeScript
translation. No PyPI name, supported Python floor or publication is decided.

The discovery manifest advertises only `parse`, **no Reader/Verifier tier,
full-validation, expression-calculation, signature, receipt or optional-profile capability**.
The adapter reads structured Format 3.0 Markdown and separately verifies stated
reserve accounts, explicit reserve-draw plans and replacement-funding commitments.
It also executes accepted expressions through the read-only `calc` command.
It does not certify every Reader or Verifier requirement.

## Read-only expression execution — 2026-10-18

```powershell
python implementations/python/uwmd.py calc deal.uwx.md calculations.json --json
python implementations/python/uwmd.py calc deal.uwx.md calculations.json --calc-context context.json --json
```

A declaration object returns one `CalcResult`; an array returns an ordered array.
Numeric values are quantized once at the declared `round_to` or the Protocol's
unit default. Refused calculations carry their registered `calc` error and a
null value; any failed result makes the command exit1. The command reads source,
declarations and optional context without writing them.

`uwmd_calc` independently executes the accepted grammar and all 21 expression
builtins, with own-property guards, frontmatter/section/prior-result precedence,
exact selected variants, declaration roles, period identities and scalar/null
overrides. Ordinary member-period lookup retains its specified first-match
behavior; explicit `@` selection applies its separate all-row and duplicate
checks. Logical operators and ternary syntax are lazy; ordinary function
arguments, including `if` and `coalesce`, are evaluated eagerly.

`uwmd_fdlibm` embeds the accepted independent Python pinned pow/exp/log procedure
and its exact constant words, retaining the Sun notices. Runtime imports only
`struct`; it reads no experiment or expected-result files. Financial functions
retain the accepted associations, raw intermediate IEEE values and IRR procedure.
Public primitive domain/refusal checks and final finite-result reporting remain
separate. Quantization uses the existing exact ECMAScript decimal formatter.

The actual CLI is checked against all 110 unchanged portable base calc cases via
`run_calc_cases.py`, which calls the shared `run_case` and retains subprocess
streams, exits and input hashes. Its report is explicitly development evidence:
there is no manifest override or advertised-capability certification. CI reuses
the existing Windows/Linux/macOS Python jobs and uploads the complete captures.
Archived native operands and mathematical certificates prove bounded procedure
identity and measured accuracy; they are not new cross-runtime executions.

Discovery stays `capabilities: ["parse"]`, `profiles: []`, with no tier. Complete
validation, dictionary reproduction, other stated-result verifiers and receipt
verification remain distinct closure gates. This command neither loads modules
nor generates missing underwriting models. Existing resource limits are host
budgets, not new numerical conventions.

## Current implementation target

Python targets the accepted current Format/Protocol and current conformance
contracts. Under the [owner rule](../../AGENTS.md#owner-rule--2026-10-17), there
is zero prelaunch compatibility or artifact-preservation work: no legacy modes,
migration/deprecation paths, bump recommendations or historical replay gates.
Read-only validation, current source/digest correctness and RFC discipline remain.
RFCs 0090–0097 are accepted; their closed metadata and current-payload admission rules apply. RFC0088 supplies the production pinned numerical procedure.
No capability promotion or release is implied.

## Complete validation implementation — in progress


### Current command and evidence

`validate <file> --json` freshly parses the actual input and produces one
ValidationResult, all seven stage-readiness booleans, all fifteen CC coverage
entries and separate Protocol V.12 replacement-funding verification. Structural
errors or failed/unverifiable V.12 return exit1; warning-only results return0.
Workflow blocking flags retain overall_status:blocking but do not alone fail the
operation. Known allocated source refusals retain their parse category/code;
I/O/internal failures return2. Inputs are never rewritten.

The developing command remains unadvertised. Normal wire output excludes private
metadata/section/composition assessments. Incomplete operations retain those
assessments beside partial_validation_result with an explicit refusal. Unresolved
composition exposes its first existing issue in source/rule order, including an
earlier COMP-UNRESOLVED; no global directive-priority rule is invented. An
unperformed V.12 result is omitted from partial wire output, never emitted as a
new union member. Local incomplete conditions gain no generic diagnostic code.

Production proof head: `7178f177745e0bb0ae95bb28887983b2f64eba8f`, tree
`a61141c51ebff1aba0f026f1e03d4de8e278f867`.

- Actual unchanged portable validate: **111/111**, zero failures/skips,
 44 exit 0 / 67 exit 1, 47.164s. Shared run_case/comparisons are unchanged; discovery
 remains parse-only. All 333 input hash entries and 222 stream hashes were
 independently rechecked. Report SHA256:
 `f0427cb738c9345c7baf6d764f1a07921cb33397dd260f234382d8f7b5eb10a4`.
- All eight new native 0096 controls match actual CLI projections: ordered
 code/severity/section/field arrays 44–49 and two REC exact-identity projections.
 Seven exit 1, one exit 0. Report SHA256:
 `6612464f094a41c625cb2dd5df9ae549874d4f67c377b885a6c3d97dad30008e`.
 These captures are at 8632028b; production/schema/corpus is identical to 7178f177,
 whose only following change updates the test inventory count.
- Seventeen pure0096 methods and ten integrated methods cover predicates,
 same-physical/field/current-owner consumption, M/P/null, source/model/composed
 authority, external exemptions, ordering and actual CLI/source-byte controls.
 The 63-method affected run matched all predicates/arrays; only its obsolete
 recovery count 16 failed after two new fixtures. The count changed to 18 and all
 seventeen family methods reran successfully. This is focused evidence, not a
 newly executed full Python suite or certification.

The portable 111 are 17 document, 71 replacement-funding and 23 scenario cases. Their
named projections do not establish every Format admission requirement or complete
output. Portable stream hashes retain shared text-mode/newline normalization;
they are not raw-byte stdout attestations. The interrupted b50976d0 run is
cancelled/incomplete, not successful evidence. A docs-only change does not require
a new111 run when runtime, schema and corpus remain identical.

### Accepted metadata admission — RFCs 0090–0095

These diagnostic allocations are implemented, not remaining owner questions.
All are closed predicates; none authorizes generic schema-to-code fallback.

| Accepted authority | Current implementation |
|---|---|
| Completeness | Whole absent meta retains META_MISSING/warning; five absent section/revision/source/timestamp/confidence leaves retain exact META_FIELD_MISSING_* warnings. Null/invalid parent differs from absence. Low-confidence information remains separate. |
| RFC0090 | META-01/error for absent/null/exact-empty/nonstring actor; every nonempty string remains untrimmed. Original wrapper/nested-container precedence remains. |
| RFC0091 | META-02/error for missing/null/nonboolean human_review_required; META-03/error for missing/null/nonboolean superseded. No coercion or inferred defaults. |
| RFC0093 | Additional META-01 predicates for late/misplaced meta, present invalid/mismatched section, required absent/nonobject quality. Independent actor/flag errors are not suppressed by P1/P2/P3. |
| RFC0094 | META-04/error for present-invalid confidence, positive JSON-integer revision or strict T1B timestamp. Absent leaves retain completeness warnings. No safe-integer ceiling on revision. |
| RFC0095 | Closed META-05 optional/annotation and META-06 reference/conditional predicates. Reference as_of uses whole ASCII Gregorian YYYY-MM-DD, years 0001–9999, not T1B. |

Metadata applies to the retained physical/current-model identity union, including
history, overwritten peers, append/extensions and consumed composition sources.
Passes complete in shape→actor→META02/03→META04→META05→META06 order before active
checks. SOURCE uses actual lexical JSON order; MODEL uses current non-array-index
string order/current canonical values, never stale raw or convenience metadata.
Absence warnings and duplicate local evidence are consumed only by the exact
actual same-reference/field/current-predicate owner. Independent siblings remain.

Ordinary SRC covers current standard sections/current variants. ROLE additionally
covers current extensions and all active append entries. These populations do
not expand to history/overwritten/original-only composition references. Broad
standalone source inspectors retain their separate private population. RFC0095
moves promoted-reference admission to META-06; **DQ-06 remains readiness info**,
not a market-reference error collision. `_notes` remains informative/unvalidated;
optional integrity/signature content retains its own profile.

### Accepted institution preflight — RFC0097

CLI validation discovers `.uw.institution.json` adjacent to the actual document;
`--institution <path>` selects one file instead, relative to cwd. The accepted
flat validation_overrides mappings are dscr_warning_below→dscr.warning_below,
ltv_warning_above→ltv.warning_above and debt_yield_warning_below→debt_yield.warning_below.
Affected full default bands are copied, preserving all other thresholds. The pure
API retains caller-supplied nested maps and performs no filesystem I/O.

The private main-safe `uwmd_institution_config` helper admits strict UTF-8/whole
JSON, decoded unique names and Unicode scalar strings/keys throughout the file.
It rejects BOM, malformed JSON, duplicates and lone surrogates without a pointer;
paired Unicode is admitted. Opaque overflow/huge integer spellings remain opaque
lexical numbers, avoiding host integer limits. Only the three recognized leaves
are converted to finite binary64. No new numeric ranges or depth limits apply.
Resource/runtime failures remain internal errors, not invented malformed inputs.

Selection is lexical abspath, not symlink realpath. Read first; automatic read
ENOENT defaults only when lstat also establishes no entry. Explicit absence,
directory, denied read, dangling link or inability to inspect is UNREADABLE.
The whole config is admitted atomically before fresh default bands are built;
unknown data is not claimed applied and a root thresholds carrier is forbidden.

Fatal source/representation/parse admission precedes config preflight. After
those prerequisites, preflight finishes before any validation/funding predicates.
Failure returns only an outer `error` with category `validate`, exact code/message
and optional config-relative pointer, exit1: VAL-INSTITUTION-CONFIG-UNREADABLE or
VAL-INSTITUTION-CONFIG-MALFORMED. There is
no ordinary/partial result, coverage, readiness or binding result. Non-JSON CLI
refusal writes human diagnostics to stderr and no result claim to stdout. Pure
SOURCE/MODEL APIs retain caller-provided maps and no hidden config I/O; receipts
and other independent operations gain no sidecar dependency. Python has no
aggregate verify command; this work adds none.

The former local refusal policy is replaced by the accepted RFC0097 contract.
Focused helper and actual CLI evidence precede the one synchronized portable
checkpoint; the earlier7178f177 portable111 proof above does not claim this new runtime.
Discovery remains parse-only pending the complete validation gate.

### Accepted current-payload admission — RFC0096

The pure `uwmd_payload_admission.py` helper accepts explicit current PayloadView
inputs; the WIP adapter owns source selection/context and ledger integration.
It imports no schema/research I/O or WIP validation module. No standalone command,
model reproduction or complete-validation claim follows from this helper.

| New error | Implemented closed predicate; existing owners preserved |
|---|---|
| LU-05 | Required model vocabulary, nullable target type/cadence grammar, assumptions/row/summary numbers and closed members. LU-01 retains cadence/row period, LU-02 contiguity, LU-03 schedule presence/inversion. Target grammar is now LU-05; no projected trajectory is generated. |
| REC-11 | Optional term/cap/true-up type/bounds/closed members. REC-01 fractions, REC-02 parent/method/required companions/M&P accumulation, REC-03 pool, REC-04 row/date/settlement and REC-09 exact source remain separate. M/P means own nonnull method/pct even if independently invalid. Null companions neither trigger nor satisfy a required group. |
| CS-03 | Optional sizing array when present; required id/fn/value and exact own over/through union. Components require mixed_use, admitted key and matching component_class. No sizing function is recomputed. Tranche CS-01/02/02b retain independent findings. |
| WF-16 | Unused floors, closed nullable stated outcomes/schedules/tier members. Dates are lexical whole ASCII YYYY-MM-DD, not Gregorian; year 0000/impossible calendar dates do not acquire new structural errors. Selected floor remains WF-10, tax WF-13. |

The new pass runs on current canonical/current variants and assembled MODEL,
excluding history, overwritten peers and unused parts. Order is LU→REC→CS→WF
with Unicode code-point map/extra-member order, after old DQ and before CC-16.
Existing unrelated findings are not resorted. The external payload exemption
requires BOTH the fence marker and an own admitted Composition §3 directive;
a malformed marker-only MODEL cannot hide independent payload findings. SOURCE
composition refusals retain their existing owner.

Structural REC-01–04/09 covers current peers; selected financial REC-05–08 and
LSE do not expand. The governed reject-member-without-method expectation changes
from two REC-02 to one under exact M/P. Missing/invalid split total rate remains
CS-02 without duplicate CS-02b aggregate; independent tranche fields keep order.
RFC0055 notice_months is a nonnegative safe integer; this specific ceiling does
not extend to revision or unrelated integers.

### Formal admission inventory: remaining condition-to-owner proof

The existing inventory contains 27 schema artifacts. This is an applicability map,
not 27 new diagnostic allocations or a blanket whole-fence schema loop.

| Formal section or nested domain | Existing schema artifacts to reconcile |
|---|---|
| Capital / component / calendar / waterfall / lease-up / reserves / gaps | section-capital-stack, section-components, section-cash-flow-series, section-distribution-waterfall, section-lease-up-schedule, section-reserve-accounts, section-gaps |
| Official builtin payloads | section-dc-capacity/power/revenue; section-hotel-brand/food-beverage/metrics; section-mhc-sites; rent-roll-hospitality |
| Tax / sources / capex | tax-terminal, tax-reassessment, tax-abatement, sources-uses-escrow, renovation-draw, expense-targeted-capex |
| Commercial lease / recoveries / hedge | lease-termination-option, lease-escalation-schedule, lease-co-tenancy, lease-recovery-terms, lease-recovery-true-up, debt-rate-hedge |

Filenames are under spec/schemas without .schema.json. Required class/current/
role/source population, nullable carrier, G1 conditional and each exact accepted
code must be reconciled together. Universal meta/role/overrides/notes keep their
own contracts. Unknown lawful data is retained. Explicit semantic loops can own
schema operators; adding unused anyOf/dependentRequired/uniqueItems helpers does
not close a production validation path.

No general property schema exists. Illustrative JSON or a TypeScript-only
interface does not establish exhaustive address/asking_price types or allocate
a new error. Rejected schema subjects and toy calculation-only payloads do not
by themselves establish a validation defect or owner decision.

### Formal-domain applicability audit — 2026-10-17

This dated frozen audit is evidence at 046640b5, not a current capability gate.
Accepted 0095/0096 supersede its former missing metadata/payload allocations;
its subject/rejection counts are not newly executed validation results.

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
contradictory contract by itself. Current negative-wire disposition must use accepted 0090–96 owners first,
with remaining conditions in the residual gate table; no new diagnostic,
capability, schema activation or general validator is introduced by this audit.

## Validation applicability audit — 2026-10-16

This audit covers the developing API, not a complete validation claim. Accepted
authorities are [Format 2–5](../../spec/UW_FORMAT_SPEC.md),
[Protocol III.6a / VIII](../../spec/UW_PROTOCOL.md) and the referenced schemas/
RFCs. All fifteen registered CC entries are produced, including skips; all
fourteen FV codes have focused threshold/severity/type/override controls.
Reachable codes and passing projections do not establish every field condition.

### External source and composition boundary

The local composition_assessment is not a normative ValidationResult member.
It records resolved/unresolved, source-order externalized IDs and existing COMP
issues. A payload merely named external is inline data. Actual directive admission
and lookup have separate errors; unavailable payload is not an empty property,
malformed reserve or fabricated V.12 result. Presence-based readiness does not
establish payload availability; selected external sources do not fall through to
another peer. Only a consulted external dependency prevents V.12 assessment.

Independent resolution is implemented in `uwmd_composition`: whole-section
content from its one part, declared collection identity/UTF-8 ordering, original
root+consumed sources, exact number-token source origins and unused-part exclusion.
History-only parts receive existing COMP-PART-MALFORMED. The private source-taking
validate API can consume actual parts; MODEL assessment snapshots the current
assembled view. Ordinary SRC/ROLE stays on its narrower current projection;
metadata alone uses the retained identity union. The CLI exposes accepted
resolve--parts--json, not invented validate flags. Unresolved reporting remains
allowed by Composition §8 and cannot claim a complete unavailable record.

### Lease-up structural versus financial scope

Accepted LU-01–05 and CC-15 are implemented with the exact owners above. The local
assessment retains history/overwritten findings separately without widening current
ordinary payload validation. Active exact registered owners consume duplicate
local evidence; another code/field/peer/stale predicate cannot cover a sibling.
No trajectory, rent/occupancy model, net-cash-flow or stabilized aggregate is
recomputed here. Those stated-result obligations remain base-Verifier work.

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
manifest claims remained unchanged. These are dated evidence counts, not a
new full-suite run at 7178f177. No JavaScript full suite was run in this lane.

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

### Minimum residual validation gates

Accepted metadata 0090–95, payload 0096 and config0097 contracts are implemented. They are
not open owner questions. A passing111-case subset still leaves these exact
implementation/proof boundaries:

| Existing path | Residual complete-validation gate |
|---|---|
| Formal 27-domain inventory above | Finish conditional/null/carrier/current/class/operator-to-owner mapping and negative-wire assertions. Gap item/summary and remaining tax/capex/component/CF optional fields need exact accepted owners before code; schema rejection alone is not a new diagnostic. |
| uwmd_validation_core / cross | Complete CC/FV/DQ carrier/operand/selection/coverage/readiness/incomplete-policy proof, including zero/null/invalid/role collision and skipped reasons. Existing keys/projections alone do not prove every condition. Completed CC-02 denominator and CC-03 independent amount/rate controls are evidence, not new numerical choices. |
| uwmd_validation_builtins | Fixed scalar types/enum/min/max, MHC conditions, hospitality field homes and 61 builtin diagnostic projections exist. Complete class/current/role/external/foreign-class and nullable/top-level conditional proof; no generic CLS-04 for unknown lawful data. Pending metric definitions are not changed to clear this gate. |
| uwmd_validation.py and CLI | Demonstrate all applicable ordering, partitions, seven readiness values, V.12 precedence and typed parse/error/exit/source-preservation assertions across SOURCE, mutable MODEL and resolved composition. Unperformed V.12 stays partial, not a fifth result state. |
| uwmd_institution / accepted RFC0097 | Strict main-safe admission and exact preflight/error-only transport are implemented. Complete synchronized new config-native/portable and cross-platform proof; do not treat earlier local refusals or partial application as current authority. |
| Format 5.2 construction LTC | 80%/90% appear without a separately named FV-01–14 diagnostic. Reconcile routing; do not invent FV-15 or a numerical convention. |
| Capability proof | Complete every applicable native assertion and final truthful portable/transport proof on Windows/Linux/macOS with explicit manifests/selectors/skips. Only then advertise validate; that does not establish a Verifier tier. |

Remaining negative-proof gaps must first be tied to exact accepted predicates and
owners or typed refusals. This audit establishes no additional code allocation.
General dictionary comparison, calendar cash flows, property financial assembly,
waterfall outcomes and receipts remain subsequent base-Verifier obligations.
Optional profiles and model-generation/workflow products do not enlarge the minimum.

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

## Accepted RFC0093 metadata admission

Source-role assessment implements the accepted three META-01/error predicates:
misplaced canonical metadata, present invalid/mismatched section and required
absent/nonobject quality. A separate complete pass precedes actors and META-02/03
across retained physical references; the earlier container gate stays unchanged.
Source-taking operations parse actual bytes and use decoded lexical order;
`inspect_source_roles(document)` observes the current model's non-index member
order. Private source operation helpers add no public capability. Focused tests
cover numeric-key boundaries, source/model mutations, history and exact identity.
The developing complete validator integrates the same admission rules separately;
this main-safe change does not advertise `validate` or a Verifier tier.

## Accepted RFC0095 optional and reference admission

Source-role assessment completes all META-05/error findings, then all META-06/error
findings after META-04, using the same retained physical/current canonical model
identity union. Optional provenance strings/null, quality flags/booleans and
sibling override shape predicates have closed ownership; rejected canonical
parents suppress descendants, while sibling annotations remain independent.
Reference assertions are symmetric across canonical resolution and any stated
object override, without effective-path selection or duplicate carrier findings.
The independent date-only predicate consumes exact ASCII Gregorian YYYY-MM-DD,
years 0001–9999; it is separate from T1B. Shared frozen date vectors exercise the
actual Python META-06 predicate, not a fixture lookup in runtime code.

This source helper does not supply or advertise a complete validate CLI. Ordinary
result integration is on the published complete-validation WIP; composition,
complete admission, native obligations and independent certification still gate
promotion. Source inspection keeps its own evidence DTO and does not certify a
financial result or receipt. Discovery remains parse-only.

## Accepted RFC0094 present-invalid leaves

Source-role assessment applies META-04/error only to present-invalid canonical
confidence, finite integral revision>=1 and exact T1B UTC-Z timestamp. The complete
leaf pass follows all META-02/03 findings across retained physical references.
Source/model authority, old parent precedence, absence warnings and independent
findings retain their accepted scope. Focused controls exercise all60 timestamp
vectors, types, history, identity, current model mutation and actual source CLI.
Other optional and conditional metadata shapes remain explicitly local where no
registered diagnostic owns them. This bounded admission implementation does not
ship the developing complete `validate` CLI or advertise a validation capability.

## Minimum-complete capability path — reconciled 2026-10-19

This matrix reconciles accepted contracts and exact 7178f177 development
evidence above. It is not a complete conformance execution. Discovery stays
parse-only until each complete claimed operation has its honest exit evidence.
Further standalone inspectors do not close validation.

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
| General calculation method: Protocol II.2.6, VIII.1–6 | `uwmd_calc` now executes the accepted grammar, source selection, overrides, prior-result API, all 21 builtins and quantized `CalcResult` values through the actual `calc` CLI. The current base portable subset has110 cases; the new scoped evidence is described above. | Complete all applicable nonportable execution and transport controls and independent platform evidence before any capability claim. Passing this subset does not close validation, dictionary reproduction, other financial verifiers or receipts; discovery remains parse-only. |
| Calendar cash flows: Protocol VIII.9; Format 4.26 | Integer Gregorian dates, three day counts, ordered totals/MOIC and selected-source structural prerequisites only. | Complete declared/stated metric verification, source/variant/override refusal, quantized results and xnpv/xirr procedure. `calc-cash-flow` has a separate declaration/refusal contract; these functions are not expression-callable. |
| Property cash-flow assembly: Protocol VIII.9.5–9.6 | Closed lease-up/CF source checks used by bindings; no assembly or complete stated-result verifier. | Independently reproduce every accepted stated assembly/projection claim, coverage/source admission and explicit refusal. Reproducing a producer's stated model is verification; generating missing models remains outside this implementation's purpose. |
| Distribution waterfalls: Protocol VIII.10; Format 4.27 | Structural WF checks now participate in the developing validation API; allocation and stated-outcome verification are absent. | Full applicable structure, allocation/stated outcomes, hurdle/clawback procedures and finite ordered evidence; do not equate structural WF checks with outcome verification. |
| Reserve accounts: Protocol VIII.11; Format 4.28 | `uwmd_reserves`: complete standalone structure/balance/continuity verification with ordered binary64 arithmetic, 2dp comparison, source digest and required states. Existing evidence: all 28 unchanged cases through shared `run_case`. | Structural findings are integrated into validation. Close remaining applicable native/platform proof and the lawful-source Envelope boundary below. This is not general calculation support. |
| Reserve draw bindings: Protocol VIII.12 | `uwmd_reserve_draws`, `uwmd_binding_sources`: complete standalone selected-source/allocation checks; selected reserve variants verify in full, original whole-document digest retained. Existing evidence: all 46 unchanged cases through shared `run_case`. | Retain exact nullable variants, plan/source/digest/arithmetic precedence and evidence; close the same Envelope boundary. Omitted plan is not a selected/verified plan. |
| Replacement funding: Protocol V.12; RFCs 0070/0075/0076/0081 | `uwmd_replacement_funding`: exact selected-cash commitment and structural prerequisites, snapshots and accepted result union. Existing evidence: 71 explicitly adapted standalone comparisons, **not** portable `validate` passes. | The async verifier is integrated beside structural errors in actual validate. Close remaining applicable native/transport/source proof; unperformed binding stays partial. Its selected-cash digest is independent of #365. |
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
  and nonboolean logical operands are CALC-TYPE-001. Current scoped calc responses have schema/comparison evidence; complete
  malformed-input/nonportable transport proof remains a separate gate.
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
- Receipt verification remains unimplemented. Its current contract includes
  accepted RFC0088 authenticate-first precedence: malformed transport retains
  its typed refusal; canonical subject/reference and pack/input/backend
  availability precede signature authentication; supplied signatures must verify
  before recomputation or a recomputation-refusal verdict. Coverage/value and
  engine-aware disagreement, then results_digest, retain UW Receipt §5 ordering.
  Missing signing backend is RCP-08/unverifiable, never ignored. Equal subject
  hashes cannot verify a receipt. The existing receipt verify operation and
  twelve native assertions need an actual Python API/transport; issuance is not
  required to complete a read-only Verifier.

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

Current WIP `7178f177` counts below were read from the existing
[ownership index](../../conformance/corpus-index.json) and generated
[portable cases](../../conformance/runner/cases), not inferred from suite names
or older README totals:

| Owner | Indexed reference checks | Portable cases |
|---|---:|---:|
| Reader | 26 | 17 |
| Verifier | 734 | 295 |
| Module | 76 | 1 |
| Integrity | 32 | 14 |
| Representations | 142 | 0 |
| Portfolio | 14 | 0 |
| Sensitivity | 5 | 0 |
| Stochastic | 7 | 0 |
| Starter products, reported separately | 106 | 37 |
| Total | 1,142 | 364 |

The 312 portable Reader+Verifier cases are 17 parse, 111 validate, 110 base calc,
28 reserve and 46 draw. The extra Module-owned calc case is outside base calc 110.
Reserve cases require broader calc-evaluate discovery; direct scoped passes do
not certify that capability. Parse-only discovery cannot honestly pass a complete
validate/calc/Verifier selector. Counts are an ownership inventory, not a newly
executed 760-case native Python proof.

Portable comparisons are subsets, with length-sensitive arrays and only named
projections/masks; full validation output is not proved by a code-set projection.
The current Python 71 replacement, eleven hash-only, nine source/role and four
currency comparisons explicitly adapt to narrower standalone outputs. They
are useful evidence, not additional unchanged portable passes or complete
validation/profile claims.

The nonportable Verifier checks matter: the index includes 45 metric checks,
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
| RFC0088 numerical determinism | Accepted and implemented in production Python calc with pinned pow/exp/log, unchanged associations, quantizer and solver. It is no longer an unresolved arithmetic prerequisite; independent procedure/financial/transport proof remains part of any complete calculation claim. |
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
   across twelve classes, eleven raw-size contracts, all 45 metric checks and
   adversarial missing/type/zero/selection/precision controls. If expressions
   are the method, finish II.2.6's entire builtin/grammar contract and the
   110 Verifier calc cases before advertising `calc-evaluate`; dictionary-only
   success never promotes that flag. Independent arithmetic work can proceed
   using the accepted numerical procedures.
4. **Close all remaining stated-figure obligations.** Integrate existing
   reserve/draw/replacement verifiers and independently complete calendar
   cash flows, lease-up/property assembly and waterfalls. Gate: all applicable
   indexed assertions, exact schemas/states/precedence, original-source digest,
   finite ordered evidence and numerical cross-platform results; accepted
   #365 representation resolution is prerequisite only for the paths it affects.
   Missing claims, unavailable inputs and real disagreement remain distinct.
5. **Close receipt verification, then certify the base Verifier.** Implement the
   read-only receipt contract and its 12 indexed verification assertions,
   including recomputation, reference-input and identity/precedence controls;
   do not require issuance or optional signing success. Gate: audit all
   26 Reader + 734 Verifier indexed assertions against their actual required
   capabilities and accepted contexts; pass every applicable base assertion,
   with optional requirements separately identified. Run the real 312-case portable
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
requires broader `calc-evaluate`, which remains unclaimed pending whole-capability proof.
The manifest stays parse-only and genuine Reader 17/17 runs remain separate.


## Standalone replacement-funding bindings

`python -B implementations/python/uwmd.py verify-replacement-funding <file> --json`
implements accepted Protocol §V.12/RFC0070, including RFC0075 senior preference,
RFC0076 refused selections and RFC0081's optional terms group. Its two-member
CLI wrapper is **nonnormative**: `structural_issues` contains only the relevant
hedge, funding, escrow, cash-source and currency prerequisites;
`replacement_funding_verification` has the exact §V.12.3 result union. There is
no overall validation/readiness result. Complete `validate` is still developing;
the separate accepted `calc` CLI is described above.
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
or full-validation passes. The catalogue requires complete `validate`, which
remains unclaimed; the developing actual command is described above. Discovery stays parse-only; genuine Reader17/17 runs stay
separate.


## Block hashes and bounded chain assessment

`python -B implementations/python/uwmd.py verify-block-integrity <file> --json`
adds independent Protocol §V.9 block hashing and a bounded §V.10 chain assessment.
This command's report and local assessment vocabulary are **nonnormative**. It
is not the full `IntegrityResult`, an integrity-profile claim, full validation,
signature verification or document authentication. Discovery stays parse-only;
generic receipt/metric verification remains unimplemented; calc is described above. The unadvertised validate command has the bounded scope above.

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
calc exists; generic receipt/metric verification remains unimplemented; the developing validate command is described above. The unadvertised validate command has the bounded scope above.

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
provenance or lifecycle. Accepted RFC0093 separately allocates misplaced `_meta`,
present invalid/mismatched section and required absent/nonobject quality to
META-01 across retained physical references; these do not suppress independent
actor or admitted-parent findings.

Registered findings are separate from `shape_findings`, which are explicitly
local diagnostics with no invented registered code or severity. Other selected
provenance/quality/lifecycle member types and override path/confidence/reason/note
shapes are checked against the accepted block schema. These checks do not invent
an override path grammar, traverse a target, require its existence, reject unknown
payload/annotation members, or apply override precedence to underwriting values.
Accepted META-05/06 now own the bounded optional/reference predicates above.
An agent source requires the `agent_id` member; admitted null remains unchanged.
JSON integer semantics admit revision `1.0` and reject booleans.

Historical blocks are counted as skipped by the active source/role checks;
their accepted metadata shape, actor, required booleans, present-invalid leaves
and RFC0095 optional/reference predicates are inspected, and their roles are not reclassified. Source byte spans,
physical ordinals and exact authored variants distinguish findings on repeated
active blocks. Returned evidence is detached and the original source/Reader
projection remains unchanged. The wrapper's local `ok` requires both finding
lists to be empty; CLI exit is nonzero when this bounded inventory refuses.

The live underscore completeness family and accepted conditional-reference
admission are integrated above. External reference resolution,
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
Other metadata uses accepted RFC0091/0093/0094/0095 owners above; no generic META-01 expansion is inferred.

The existing wrapper/nested-object checks run first across all retained physical
blocks, followed by the actor pass in physical source order, then the existing
active ROLE/SRC checks. Whole-missing metadata remains a completeness matter
(local in this partial command); malformed wrappers/nested objects receive their
existing single META-01 and no actor cascade. History, append/extension blocks,
unselected variants and overwritten physical peers receive actor checks. History
roles and sources are not reclassified. The legacy `blocks_checked` and
`history_blocks_skipped` counters describe only the active source/role pass.

RFC0093 explicitly owns late metadata and present invalid/mismatched section
under META-01 across retained references. Earlier local-only wording is
superseded. These predicates do not suppress independent actor or flag errors.

The current canonical inline parsed `_meta` is authoritative. The operation
snapshots `Document.source.blocks`; it does not silently reparse immutable raw
bytes or certify a caller-mutated model as the original source. Physical spans
remain origin evidence, not a source/model consistency verdict. Inputs and source
bytes are unchanged. No new command, capability, full validation or tier claim
is introduced.

Accepted metadata tests cover every retained physical/current-model scope,
value boundaries, ordering, actual-owner consumption and source preservation.
Diagnostics do not rewrite source, infer actors or authenticate an artifact.

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
recovery terms and caps under Format 4.3/RFC0058. The cap predicate applies
independently of method; absence, null, empty objects and G1's lone cap retain
their prior admission. Duplicate local type evidence is consumed only with the
actual REC-02/error on the same physical block, tenant field and fixed type
constraint. An unrelated code, sibling field, peer, missing owner or changed
constraint cannot provide coverage. RFC0096 owns closed recovery extras and
declared optional members; REC-02 cannot consume those siblings generically. No recovery amount, cash source,
default, standalone command, conformance expectation or discovery claim changes.


### Lease-up registered-condition ownership

Exact current LU-01/03/05 owners consume duplicate private evidence only for the
same block/field/current predicate. RFC0096 owns former model, numeric, target/
container and closed-member conditions under LU-05. Historical and overwritten
evidence stays separate; no trajectory is generated.

## Accepted RFC0096 payload admission helper

`uwmd_payload_admission.py` supplies the closed LU-05, REC-11, CS-03 and WF-16
predicates for the developing validator. Its caller supplies current assembled
payload views and owns source/variant/component selection; it performs no source
reads, history traversal, fetching or financial calculation. Family order and
code-point field ordering follow the accepted RFC. Nullable recovery companions,
existing diagnostic ownership and lexical-only waterfall dates remain distinct.
Seventeen focused methods cover the independent predicates and nonmutation.

This private helper is not a standalone inspector or complete validation command.
It adds no advertised capability; discovery remains parse-only. The complete WIP validator already integrates this helper with the evidence
above; whole-capability portable/nonportable certification remains separate
Issue354 work.


## Accepted RFC0097 selected institution configuration

`uwmd_institution_config.py` is a private standard-library-only admission/file
adapter for the developing validator. It selects one explicit or lexical adjacent
path, defaults only on genuine automatic absence, admits the whole strict JSON/
UTF8/decoded-name/Unicode profile and atomically returns only the three recognized
finite binary64 leaves. Opaque number tokens are not coerced or applied. Fresh
bands come from caller-supplied defaults; no document, config or caller map is
mutated. Unreadable/malformed inputs produce the two accepted operation errors
with exact messages/pointers; resource/programming failures remain internal errors.

Twelve focused methods cover strict profile, defaults/atomicity and actual or
injected file/link/race outcomes. This module imports no developing validator and
adds no standalone command or discovery capability. Actual `validate` preflight/
error-only transport is integrated separately on the existing complete-validation
WIP. Pure SOURCE/MODEL calls and receipt operations gain no hidden config I/O.
Discovery remains parse-only; this helper is not complete validation certification.
