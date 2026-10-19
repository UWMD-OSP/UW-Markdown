---
rfc: 0096
title: Allocate bounded stated-payload admission diagnostics
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

# RFC 0096: Allocate bounded stated-payload admission diagnostics

## Summary

Propose four closed error allocations for missing validation admission in
lease-up payloads (`LU-05`), recovery leaves (`REC-11`), capital-stack sizing
claims (`CS-03`) and waterfall claims (`WF-16`). They validate stated structure,
types and already specified bounds; they do not generate a model, recompute
financial results, fetch unavailable sources or replace a financial verifier.
**Draft, not accepted or activated.** This document and its research evidence
change no runtime, schema, original source, frozen expectation or capability.

This is governed preparation toward Issue354's complete `validate` capability.
The independent Python checkpoint remains parse-only. Accepted RFC0095 is
implemented separately in merged PR392; its metadata population does not determine the
payload population proposed here. RFCs0085/0089/0092 remain separate.

## Motivation and evidence boundary

The accepted contracts are Format4.3,4.23–4.27, ProtocolII/III/VIII/XI/XIII,
RFCs0008/0026/0035/0058/0059/0081 and their named schemas. The drafting base is
main `64c34f3a33685338f9626eada2eb56a49dbd2297` after PR392. Python development evidence is
`df7831e6d3675881d3f7714da42230c7163da256`; it is not shipped capability evidence.
A reproducible, bounded observation set is frozen in the existing
[Issue354 review family](../reviews/2026-10-17-validation-diagnostic-gap-354.0096-payload.observations.json).
Its30 observations are29 synthetic cases plus one unchanged native fixture,
not a population census,30 newly allocated defects or30 conformance changes.
The source hashes, exact observed issues, local fields and transport states
are in that artifact. Inline/unit-test inputs are not an exhaustive physical
source inventory.

Four actual CLI subprocesses parsed valid structured sources and produced no
registered issues, but refused to claim a complete validation result:

| Source construction | Unallocated local field | CLI observation |
|---|---|---|
| lease_up_schedule model_type=unknown, monthly, one period2026-01 | model_type | exit1, partial_validation_result, no top-level overall_status |
| rent_roll tenant recovery_terms={method:net,admin_fee_pct:bad} | tenants[0].recovery_terms.admin_fee_pct | same |
| capital_stack with valid senior tranche and sizing=bad | sizing | same |
| valid equity cash vector and split waterfall, stated_outcomes=false | stated_outcomes | same |

All four returned empty stderr and `partial_validation_result.issues=[]`, and
left source bytes unchanged. The [read-only reproducer](../reviews/2026-10-17-validation-diagnostic-gap-354.0096-payload.repro.py)
extracts the exact WIP from Git into a temporary directory, reuses its authored
source factories and runs `python -B implementations/python/uwmd.py validate
<source> --json`. Run it from a checkout containing that commit:

```powershell
python -B docs/reviews/2026-10-17-validation-diagnostic-gap-354.0096-payload.repro.py
```

This is actual execution, not an imagined future code path. Reproduction
requires Python with tarfile's data extraction filter and the WIP Git object.
Source factories are `test_validation_cli.py::property_source`,
`test_validation.py::well_formed` and
`test_validation_optional_shapes.py::{stack,cash,waterfall}`. The corresponding
WIP tests include `test_validation_lease_up.py`,
`test_validation_lease_up_ownership.py`, `test_validation_optional_shapes.py`
and `test_validation_refusal_reconciliation.py`.

The [nine TypeScript observations](../reviews/2026-10-17-validation-diagnostic-gap-354.0096-payload.ts-observations.json)
were executed against built TS checkpoint4b0e1ae1, whose RFC0095 changes do not
change these four payload validators. They distinguish actual existing owners
from the Python WIP's sometimes coarser field attribution. They are not future
expectations. Main TS `lease-up-structure.ts`, validator
`checkRecoveryTerms/checkRecoveryTrueUp/checkCapitalStack/checkWaterfallContent`
and the five schemas named below are the reproducible authority comparison.

The wider27-schema audit remains
[separate evidence](../reviews/2026-10-17-validation-diagnostic-gap-354.formal-audit.json.gz).
A schema rejection is not automatically a new validator error. Descriptions,
defaults and examples are annotations; JSON Schema2020-12's default format
vocabulary does not automatically assert calendar validity. See
[Format-Annotation](https://json-schema.org/draft/2020-12/json-schema-validation#section-7.2.1)
and [metadata annotations](https://json-schema.org/draft/2020-12/json-schema-validation#section-9).
Existing typed parse refusals still own malformed JSON/source grammar and
unsupported format admission. The four parsed payload examples are not those
reader failures.

## Proposed change

All MUST statements below are proposed contract text, contingent on acceptance
and synchronized implementation. No generic schema fallback is allocated.

### Diagnostic transport and candidate allocation

| Code | Severity | Closed responsibility |
|---|---|---|
| LU-05 | error | Lease-up model identity, optional payload carriers/leaves and closed members listed below |
| REC-11 | error | Remaining recovery typed leaves and closed members listed below |
| CS-03 | error | Stated capital-stack sizing declaration shape listed below |
| WF-16 | error | Waterfall stated claims and unselected clawback leaves listed below |

Each emits the ordinary `ValidationIssue`/`ValidationMessage` DTO, without a
`category` member. A corresponding `ProtocolError` has category `validate`.
The section, exact authored field and available variant context MUST identify
the failed predicate. No new public API export is required.

The allocation audit at the base checked the Protocol registry and all RFCs,
including retired codes. These four candidates are unallocated. `REC-10` is
retired by RFC0081 and MUST NOT be reused. RFC0036 expressly did not allocate
its earlier draft label `WF-04`; WF-16 avoids repurposing that draft label.
Existing financial result codes such as `CS-SIZING-DISAGREES`,
`CS-SIZING-UNEVALUABLE` and `WF-OUTCOME-DISAGREES` are not structural code aliases.

### Common predicates and authority

A number means a finite binary64 numeric value; booleans are not numbers.
An integer is a finite number with no fractional component; this RFC adds no
safe-integer ceiling. A nullable optional field may be absent or exactly null.
An own, present non-null value MUST satisfy its named predicate. Required
members below are required own members, without trimming, coercion, inferred
defaults or filling absent values. String length means the actual nonempty
string, so whitespace is not silently trimmed. Unknown members are rejected
only in the exact closed objects enumerated here. `_notes` is never validated;
`_meta`, `_role` and `_overrides` retain their existing universal owners.

These payload allocations MUST visit the current canonical block or every
current variant of each named standard section, independently of a financial
role-selection fallback. A role collision or missing financial primary does
not exempt other current peers from admission. This is the existing payload
population of Format4 and the original formal audit, not metadata's
all-retained-physical population. History, superseded/overwritten physical
blocks and physical append inputs which no longer constitute a current payload
MUST NOT independently gain these errors. Unknown/extension sections and
nested opaque lookalikes are not these named payloads.

SOURCE MUST freshly parse the actual source, perform accepted selection and
composition, and assess the assembled current payload. A consumed part's
payload is assessed where it becomes current assembled content, not again as
an independent physical block. Unused loaded parts are not assessed. MODEL
MUST assess current own model members, without stale raw/convenience metadata
or reparsing away mutations. Existing unresolved, unavailable and unsupported
composition refusals remain typed operation outcomes; this RFC neither invents
missing payloads nor turns source availability into a structural error.
Metadata's separate root/consumed-part/derived-model physical union remains
unchanged under RFCs0090/0091/0093/0094/0095.

Container precedence is local: emit one parent-carrier finding and stop that
subtree when its listed container type fails; continue independent siblings.
A required own member's absence and a present invalid value produce one finding
at that exact member, not simultaneous missing/type findings. A leaf failing
several predicates produces one finding. A condition already owned by an
existing registered error below MUST NOT be emitted again under a new code.
Deduplication requires the same selected block, row, field and predicate; an
unrelated REC/LU/WF finding never suppresses an unowned sibling.

### LU-05: lease-up fixed payload

Modify Format4.25 and `section-lease-up-schedule.schema.json` annotations to
allocate LU-05 exactly as follows:

| Field/object | Predicate |
|---|---|
| model_type | Required; exactly natural_turnover or absorption_curve |
| stabilization_target | Optional nullable; when non-null, a string in the declared monthly YYYY-MM or quarterly YYYY-Q1…Q4 grammar |
| assumptions | Optional nullable object, closed to the six members below |
| stabilized_summary | Optional nullable object, closed to the four members below |
| schedule row object | Closed to period plus the nine numeric members below; nonobject rows remain the existing LU-01 missing/invalid period boundary |
| section payload | Closed to model_type, period_granularity, stabilization_target, assumptions, schedule, stabilized_summary and the universal members above |

Optional nullable numeric fields, in fixed order:

| Container | Order and predicate |
|---|---|
| schedule[i] | occupied_sf, leased_sf, in_place_rent_psf, market_rent_psf: >=0; vacancy_rate:[0,1]; rent_revenue, concessions, ti_lc_capex, net_cash_flow: finite, signed |
| assumptions | monthly_turnover_rate:[0,1]; market_rent_psf_at_stabilization:>=0; vacancy_during_lease_up:[0,1]; concession_months_per_lease:>=0; tenant_improvement_psf:>=0; leasing_commission_rate:[0,1] |
| stabilized_summary | occupied_sf:>=0; occupancy_rate:[0,1]; annualized_egi, annualized_noi: finite, signed |

The description of concessions/capex as negative does not create a new sign
restriction beyond the admitted numeric schema domain. Model type gates no
other shape check. No rent roll, trajectory, occupancy denominator or endpoint
recomputation is required for LU-05. LU-01 keeps cadence and row-period grammar;
LU-02 contiguity; LU-03 schedule presence/type/nonempty and target inversion;
LU-04 remains a missing-rent-roll warning; CC-15 remains endpoint tolerance.
The target grammar allocation above is explicit: WIP Python's LU-01 target
handling and TS's silently ignored invalid target are implementation evidence,
not authority to broaden LU-01 implicitly. No calendar/date-time profile is
added to these monthly/quarterly identities.

### REC-11: unallocated recovery leaves

Modify Format4.3 and the annotations in `lease-recovery-terms.schema.json` and
`lease-recovery-true-up.schema.json`. On every object tenant in a current
rent_roll, optional nullable recovery_terms/recovery_true_up retain their
existing parent admission owners. Allocate only these additional predicates:

| Field | Predicate when present and non-null |
|---|---|
| recovery_terms.share_basis | exactly nra, gla or stated |
| recovery_terms.base_year | integer |
| recovery_terms.expense_stop_per_sqft | finite >=0 |
| recovery_terms.fixed_recovery_annual | finite >=0 |
| recovery_terms.admin_fee_pct | finite [0,1) |
| recovery_terms.gross_up_pct | finite (0,1] |
| recovery_terms.cap.over | exactly base_year or prior_year |
| recovery_terms.cap.accumulation | exactly cumulative, non_cumulative or compounding, only when the invalid stated value is not already owned by REC-02's applicable accumulation predicate |
| recovery_true_up[i].pool_actual | finite >=0 |
| recovery_true_up[i].tenant_share_uncapped | finite >=0 |
| recovery_true_up[i].tenant_share_capped | finite >=0 |
| recovery_true_up[i].estimated_billed | finite >=0 |
| recovery_true_up[i].true_up_amount | finite, signed |

The three closed objects are recovery_terms (method, pro_rata_share,
share_basis, base_year, expense_stop_per_sqft, fixed_recovery_annual,
admin_fee_pct, gross_up_pct, recoverable_pool, cap), cap (pct, over,
accumulation), and each true-up row (period_start, period_end, pool_actual,
tenant_share_uncapped, tenant_share_capped, estimated_billed, true_up_amount,
settlement, cash_flow_ref). Extra own members receive REC-11 at the exact child.
No new inner closed structure is imposed on cash_flow_ref.

Already owned and excluded: REC-01 share/cap fractions; REC-02 terms/cap
carrier, closed method, required selected-method companion and applicable
accumulation; REC-03 pool container/nonempty/member vocabulary; REC-04 true-up
carrier/row/date/settlement; REC-05 closed-period admission; REC-06/07/08
financial ties/direction; REC-09 cash-reference carrier/selection. A present
wrong companion type/bound (for example base_year=bad with base_year_stop) is
REC-11; absence/null of the required companion remains REC-02. A coarse WIP
REC-02 parent finding does not establish ownership of an unrelated child.
REC-11 does not reallocate or tighten REC-04's accepted calendar contract.

### CS-03: capital-stack sizing claims

Modify Format4.24 and `section-capital-stack.schema.json` annotations.
Absent sizing is valid. Present sizing MUST be an array (null is invalid);
empty is valid. Each item MUST be an object closed to id, fn, over, through,
value, with required own id, fn and value:

- id: nonempty string.
- fn: exactly coverage, blended_coverage, debt_yield_through, ltc_through,
  ltv_through or weighted_cost.
- value: finite number, including signed values and zero.
- Exactly one own over/through member; over is a nonempty string; through is
  an integer >=1. For neither/both selectors emit one CS-03 at sizing[i];
  do not cascade selector-leaf findings. Otherwise report a wrong selected
  carrier at sizing[i].over or sizing[i].through.

Apply the same declaration check to each admitted builtin component's own
capital_stack.sizing, under Format4.23's existing component eligibility;
qualify fields as <component>.capital_stack.sizing[i] and section=components.
Do not invent a new component kind or validate a component-like extension.
CS-01 tranches/identities, CS-02 coupon/class, CS-02b split coupon and
CS-WATERFALL-UNSUPPORTED retain their owners. This RFC does not resolve a
selector to a tranche, require a missing financial input, calculate sizing or
interpret unknown selectors as zero. Format4.24's fn/selector association table
and its financial unverifiable/refusal rules remain authority; the new code
covers the structural union above, without adding a new calculation rule.

### WF-16: waterfall claims and remaining clawback leaves

Modify Format4.27 and `section-distribution-waterfall.schema.json` annotations.
Allocate exactly the following:

| Field/object | Predicate |
|---|---|
| stated_outcomes | Optional nullable object, closed to lp, gp, promote_total, profit_total, clawback_amount |
| stated_outcomes.lp / gp | Optional nullable objects, closed to contributions, distributions, moic, xirr |
| each party's contributions, distributions, xirr | Optional nullable finite signed number |
| each party's moic | Optional nullable finite number >=0 |
| promote_total, profit_total, clawback_amount | Optional nullable finite signed number |
| stated_schedule | Optional nullable array; empty valid |
| stated_schedule[i] | Object closed to required date and by_tier |
| stated_schedule[i].date | Required string matching exactly four ASCII digits, hyphen, two ASCII digits, hyphen, two ASCII digits |
| stated_schedule[i].by_tier | Required array; empty valid |
| by_tier[j] | Object closed to required tier plus optional nullable lp and gp |
| by_tier[j].tier | Integer >=0 |
| by_tier[j].lp / gp | Optional nullable finite signed number |
| clawback.floor_rate | Optional nullable finite (0,1), when not already owned by selected-basis WF-10 |
| clawback.floor_multiple | Optional nullable finite >1, when not already owned by selected-basis WF-10 |
| clawback object | Closed to basis, floor_rate, floor_multiple, net_of_tax_rate, cap |

WF-10 retains clawback carrier/basis and selected-floor presence/domain;
WF-11 preferred-tier precondition; WF-12 cap; WF-13 tax fraction; WF-15 warning.
Malformed clawback parents stop WF-16 descendants. WF-01 ladder/equity split,
WF-02 source reference and WF-03 contribution keep their existing owners.
No claim is generated from an absent leaf, no distribution date/tier is inferred,
and no balance is recomputed. The structural tier integer predicate does not
add a new index-range or duplicate-cell financial interpretation.

The stated_schedule date predicate is lexical admission only. Its existing
schema has a digit pattern, no format:date assertion. This RFC does NOT
transplant RFC0095's as_of Gregorian/year profile, RFC0094's T1B timestamp or
REC-04's separate date owner. A date-shaped impossible calendar value's
financial comparison/refusal remains the existing verifier's responsibility.
Any broader calendar requirement needs an explicit governed decision and
cross-runtime vectors; the WIP's stronger local date check cannot supply it.

### Deterministic pass and issue ordering

Add one complete payload-admission pass after existing data-quality checks,
before CC-16 coverage-summary output, remediation enrichment and result
partitioning. It MUST preserve all existing checks' relative order. Within
this pass use LU-05, REC-11, CS-03, WF-16 family order. Visit an unlabelled entry
as one current block; for maps visit every current variant in Unicode code-point
key order. Component names use the same ordering. Do not select only base or
primary. This pass does not resort the preexisting issue array.

Within LU use model_type, stabilization_target, assumptions, schedule,
stabilized_summary; within REC visit tenant array order, terms before true-up,
with terms field order as its closed list above, cap fields pct/over/accumulation,
and true-up row fields as its closed list above. Within CS visit array order,
then id, fn, selector union, value. Within WF visit clawback, stated_outcomes,
stated_schedule; clawback floor_rate then floor_multiple; outcomes lp then gp
(contributions, distributions, moic, xirr), then promote_total, profit_total,
clawback_amount; schedule row date then by_tier; tier rows tier, lp, gp.
In each object assess its listed fields first, then unknown own members in
Unicode code-point order. Parent failure stops only its subtree.

Existing code ownership is predicate-based, not an instruction to concatenate
duplicate full validation arrays. Implementations may share admission helpers
with existing validators, but MUST preserve the registered findings, exact
fields, independent siblings and order. No schema-library error order defines
the result. Errors enter ordinary errors/issues partitions and existing overall
status and CLI exit semantics. Stage readiness remains independently derived;
no profile or complete-Verifier claim follows from this allocation.

## Accepted-contract corrections outside the proposal

These dispositions require no new diagnostic family and MUST be reviewed
separately from the proposed allocations:

1. The WIP's local shape owner mapping currently recognizes some REC-01/02
   predicates but retains already-represented REC-03/04 and WF-10/13 conditions
   as partial refusals. Consume only an actual matching registered finding
   for the same selected block, row, field and condition. Preserve local
   evidence as handled; do not erase a sibling admin_fee_pct defect because
   another member has REC-01. LU-01's actual invalid-period finding already
   covers a nonobject row's unavailable required period; do not invent a
   second parent code solely because the schema also asserts object type.
2. Under RFC0081 G1 nullable companion values do not trigger a method and do
   not satisfy required companions. TS currently counts any non-cap own key,
   so {pro_rata_share:null} spuriously emits REC-02. Fix that trigger under
   the accepted rule. A non-null companion still requires a valid method;
   cap alone still needs no method or accumulation. The schema's conditional
   check must not treat null method as satisfying a triggered requirement.
3. method itself is non-nullable in the current closed enum. RFC0081's S6
   disposition explicitly retains type errors for non-nullable members stated
   null, while Format4.3 broadly describes null as unstated. Do not silently
   broaden the enum or manufacture a method. The proposed reconciliation is
   present method:null => existing REC-02; absent method with only nullable
   null companions => admitted. Pin this precise qualification in synchronized
   text and controls before claiming the null discrepancy resolved. It is not
   a new REC-11 condition and is an explicit review point below.
4. LU stabilization_target allocation is proposed above, not retroactive
   acceptance of WIP LU-01 target errors. Existing registered target inversion
   stays LU-03; no new financial/period convention is inferred.

## Conformance impact and complete-validation gate

No existing fixture or expected result changes in this docs-only draft.
The implementation must publish a predicate-by-predicate attribution inventory
before expectation changes, keeping the unchanged source corpus as authority.
New authored controls must cover every listed predicate, bounds, null/absence,
booleans-as-numbers, extra members, malformed parents, independent siblings,
required declarations, each current peer, component qualification, history
exclusion, SOURCE/MODEL mutations, composition and unavailable source outcomes.
No bulk rebaseline or assumption that all27 schema rejections require codes.

The bounded observation dispositions are:

| Observations in frozen evidence | Count | Proposed disposition |
|---|---:|---|
| LU unknown model, numeric type, bounded assumption | 3 | LU-05 |
| LU historical unknown model with valid current | 1 | Not a new error: outside proposed current-payload scope |
| LU nonobject row, bad period, wrong cadence, empty schedule | 4 | Existing LU-01/03 ownership; preserve accompanying PS-01 warnings |
| REC admin type, cap.over, base_year type, negative pool_actual | 4 | REC-11; coarse unrelated parent finding does not consume leaf |
| REC unknown method, null method, null method+share, cap accumulation | 4 | Existing REC-02, with G1 qualification above |
| REC pool carrier, true-up carrier/date/settlement | 4 | Existing REC-03/04 exact-predicate ownership |
| CS sizing carrier/fn/value | 3 | CS-03 |
| WF outcomes carrier, claim type, lexical date, unused floor type | 4 | WF-16 |
| WF selected floor, tax fraction | 2 | Existing WF-10/13 exact-predicate ownership |
| Unchanged native lease-up/reject-empty-schedule/deal.uwx.md | 1 | Existing LU-03 plus independent stage DQ-06/info; no new expectation |

The four repro sources must yield ordinary registered errors after accepted
implementation, not an uncoded partial refusal or a clean result. Independent
TS/Python tests must verify issue order, exact fields, ordinary DTO partitions,
actual subprocess exits/JSON framing and source preservation. Applicable
nonportable MODEL, composed SOURCE, receipt-issuance policy counts and verifier
result-separation controls remain required. No receipt signing/preflight or
recomputation-precedence rule is changed by this RFC; newly registered error
counts must be tested through existing policy transport.

Complete validate certification still requires ProtocolII/III's entire
capability audit, all111 unchanged portable validation cases plus applicable
nonportable admission, source selection/composition, issue ordering, partitions,
stage readiness and transport obligations, independently on Windows/Linux/macOS.
This RFC is not the certification and does not claim these four domains exhaust
all requirements. Dictionary, stated financial result and receipt verification
remain separate complete-Verifier obligations. Discovery stays [parse] until
validation's entire capability gate is proven.

## Reference implementation

Follow acceptance with synchronized Format/Protocol/schema annotations and
registry/remediation entries in one reviewed TS/Python implementation PR.
Likely runtime locations are `packages/uwmd-verify/src/validator.ts`, its fixed
payload helpers and Python's `uwmd_validation_lease_up.py` /
`uwmd_validation_optional_shapes.py`, with ordinary CLI/receipt policy controls.
No general JSON Schema runtime engine, new dependency or public symbol is needed.
Accepted-contract owner-consumption/null fixes should be isolated and independently
reviewable. Financial procedures and their existing result states stay separate.

## Alternatives considered

- Generic schema-error code: rejected; erases precise ownership and may turn
  annotations into asserted rules or unavailable sources into invalid documents.
- All-retained-physical payload scope: rejected for this proposal; metadata's
  identity/accounting RFCs do not allocate financial-payload history validation.
- Keep uncoded partials permanently: rejected; useful development honesty does
  not close complete validate's registered admission/transport requirements.
- Reuse REC-10/WF-04 or extend META-01: rejected; retired/unallocated historical
  labels and narrow metadata contracts do not own these payload requirements.
- Infer defaults or stronger dates/signs from local schema tooling: rejected;
  new financial/calendar conventions require an explicit governed contract.

## Decisions proposed for owner review

| Question | Exact recommended disposition |
|---|---|
| New allocations | Accept only LU-05/REC-11/CS-03/WF-16 closed predicates above, error, validation-only |
| Payload population | Current canonical/all current variants, assembled MODEL authority; do not broaden to physical history |
| Target grammar | Allocate target carrier/declared grammar to LU-05; keep row grammar LU-01 and inversion LU-03 |
| Recovery null qualification | Preserve nullable companions' null-as-unstated behavior; present non-nullable method:null remains REC-02 under RFC0081 S6 |
| Waterfall date | Allocate only the existing exact lexical date shape; do not import as_of/T1B or silently tighten calendar admission |
| Financial selector/result meaning | Leave accepted fn/selector, calendar comparison, result/refusal and arithmetic rules unchanged |

These are proposed contract decisions, not owner approvals. The draft may be
revised from independent review before final acceptance is requested. Any
remaining genuine conflict over target allocation or the recovery null
qualification must be resolved in the final text, rather than hidden behind
an implementation convenience. No new numerical choice is proposed.

## Remaining acceptance and activation gates

1. Independently verify each listed predicate against Format/schema/accepted
   RFC authority and audit the fresh codes against final current registry.
2. Reproduce the four CLI sources and review all30 observations, distinguishing
   implementation ownership/null corrections from genuinely new allocations.
3. Confirm the current-only source/model/composition scope, field/pass ordering,
   target allocation and explicit date/null boundaries in final reviewed text.
4. Owner accepts the final RFC text; docs-only draft CI must be green.
5. Synchronized TS/Python/spec/schema/registry implementation, attributed
   conformance controls and independent material-claim review; exact-head and
   exact-main required CI before an implementation claim. No activation by draft.

## Prior art

RFCs0090–0095 establish bounded diagnostic allocation, exact shape precedence,
ordinary transport and synchronized independent verification; their metadata
population is not generalized here. RFC0081 G1 distinguishes stated facts,
nullable absence and required input groups. RFCs0026/0035 and Format4.24's
"stated and verified, never trusted" separate declaration admission from
financial recomputation. JSON Schema2020-12 distinguishes assertions from
annotations as cited above. The owner's prelaunch rule applies; this draft
allocates no release or publication action.
