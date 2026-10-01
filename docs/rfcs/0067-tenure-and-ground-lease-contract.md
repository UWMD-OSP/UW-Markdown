---
rfc: 0067
title: Tenure and ground-lease contract
status: draft
author: claude-code (agent proposal)
created: 2026-09-29
depends_on:
  - 0053
  - 0055
  - 0060
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0067: Tenure and ground-lease contract

**Draft agent proposal.** A coding agent wrote this RFC. StackUW's
leasehold-acquisition plan is adopter requirements evidence, not UWMD
authority. No owner decision selects any of the semantics proposed here. The
owner has not accepted the RFC, and implementation is not authorized. Open
decisions are listed in [Decision status](#decision-status).

This is a design record. It is internally consistent, but deliberately **not
implementation-ready**: several choices must be made before acceptance, and
this text does not pretend they are made.

## Summary

UW Markdown cannot say whether a deal's subject is a fee-simple or a leasehold
interest. It also has no typed ground lease and no named ground-rent line.
This draft proposes the narrowest first contract the evidence supports:

- **Tenure:** an OPTIONAL `interest_type` of `fee_simple` or `leasehold`.
  When it is absent, tenure is **unstated**, never assumed.
- **Ground lease:** an OPTIONAL typed contract holding only stated legal and
  economic lease facts, namely parties, term, extension options, the rent
  schedule with each step's reset kind, subordination of the fee, and the
  reversion terms.
- **Ground rent:** an OPTIONAL named §4.5 line, `noi_model.expenses.ground_rent`.
  Like every §4.5 expense line, it is a component of
  `total_operating_expenses`.

Nothing is projected, exercised or valued. No capital-stack tranche is added;
RFC 0060's decision stands. No cross-check is proposed as normative.

## Demonstrated gap

Re-verified on `main` at `3e61ada` (2026-10-01). References name files,
symbols and spec sections.

**What UWMD lacks today.** No file under `spec/`, and no source file in
`packages/*/src`, mentions `interest_type`, `ground_lease`, `ground_rent`,
leasehold, leased fee, fee simple or tenure.

- **§4.2 `ownership`** carries transaction type, current owner, acquisition
  date and price, existing debt, borrowing entity and ownership notes. It has
  no property-interest fact and no lease.
- **§4.4 `operating_statement.expenses`** has no `ground_rent` key. A
  historical payment can only sit in `other_expenses`.
- **§4.5 `noi_model.expenses`** is a fixed named list: taxes, insurance,
  management, payroll, utilities, repairs, contract services, marketing,
  administrative, professional fees and replacement reserves. It has no
  `ground_rent` line and no generic bucket.
- **No section types a ground lease.** Term, rent resets, extension options,
  the fee/leasehold relationship and subordination have no representation.
- **Nothing distinguishes leasehold underwriting from a tranche.**
  `TrancheClass` (`capital-stack.ts`) is `senior_debt | mezzanine_debt |
  preferred_equity | common_equity | bridge | seller_financing | other_debt`.
  RFC 0060 (`decided`, accepted 2026-09-19) refused a `ground_lease` class as
  the "wrong conceptual layer": a ground lease is "tenure and encumbrance, not
  capital". It preserved the need as "a demand-gated property/tenure or
  ground-lease contract against its own section, with its own RFC and a
  demonstrated consumer". `docs/wiki/13-status.md` records the same.

**What the format does today.** RFC 0060 notes that ground-rent dollars "may be
reflected in NOI, at the author's discretion and without a named line". A
reader cannot tell whether a document's NOI is before or after ground rent.

**Adopter evidence.** This is StackUW's (`cc.underwriter`) evidence, not
verified in this repository. Its planning, dated 2026-09-29, prioritizes
underwriting a leasehold acquisition (improvements on leased land, ground rent
an obligation), with ground rent stated before NOI as a named line. It reports
that it currently signs a leasehold deal's ground rent only as dollars inside
NOI and total operating expenses, with no tenure stated (its Q-100 rule). It
also applies a leasehold exit-value adjustment. Adopter demand shows a consumer
exists; it does not set UWMD's contract.

## Proposed first contract

Everything in this section is a proposal. RFC 2119 terms describe what the
proposal would require if accepted. All additions are OPTIONAL; rates are
fractions; dates are `YYYY-MM-DD`.

### 1. Tenure: `interest_type`

```json
"interest_type": "fee_simple | leasehold"
```

- `fee_simple` — the author states that the subject is a fee-simple interest:
  land and improvements, not a lessee's estate.
- `leasehold` — the author states that the subject is a lessee's estate:
  improvements on land held under a ground lease, whose rent the subject's
  owner pays.
- **Absent** — tenure is **unstated**. A document that predates this field has
  not established fee-simple ownership by omitting it. No reader, validator,
  pack or cross-check may treat absence as `fee_simple`, or as any other
  positive statement about the legal interest. A renderer that shows tenure
  shows "not stated".

`leased_fee` (the lessor's estate) is **deferred**. No consumer underwrites it,
and no repository evidence defines its semantics.

### 2. Ground-lease contract: stated lease facts only

```json
"ground_lease": {
  "lessor": "string | null",
  "lessee": "string | null",
  "commencement_date": "YYYY-MM-DD | null",
  "expiration_date": "YYYY-MM-DD | null",
  "extension_options": [
    {
      "count": 0,
      "term_years": 0,
      "notice_months": null,
      "rent_reset": "fair_market | fixed | cpi | null"
    }
  ],
  "rent_schedule": [
    {
      "effective_date": "YYYY-MM-DD",
      "lease_year": null,
      "reset_kind": "initial | fixed | cpi | fair_market",
      "ground_rent_annual": null,
      "cpi": { "index": null, "floor": null, "cap": null },
      "terms": null
    }
  ],
  "fee_subordinated": null,
  "reversion": {
    "improvements_revert_to_lessor": null,
    "surrender_condition": "as_is | demolished | null"
  }
}
```

- **Rent schedule.** Each step states the **resulting** annual ground rent from
  its `effective_date`, not the increment. This is RFC 0055's
  `escalation_schedule` rule (`LSE-01`), so a reader never compounds resets.
  - `reset_kind` says how the step's rent is set, reusing RFC 0055's
    `rent_reset` words (`fixed`, `cpi`, `fair_market`) plus `initial`.
  - `ground_rent_annual` is stated where the contract fixes it: the `initial`
    step, a `fixed` step, or a reset that has already occurred.
  - For a **future** `cpi` or `fair_market` reset whose result the contract
    does not determine, it is `null`, and no tool fills it. An author's
    assumed future reset value is an underwriting projection, not a lease
    fact, and has no home in this contract.
  - `cpi` carries the stated index label and optional `floor`/`cap`, as
    fractions on the change since the prior step.
- **Extension options** reuse RFC 0055's `renewal_options` shape exactly.
  Whether the underwriting assumes an option is exercised is an underwriting
  assumption, not a lease term. The earlier draft's
  `underwritten_as_exercised` is therefore removed (see
  [Deferred](#deferred-and-out-of-scope)).
- **`fee_subordinated`** — `true` when the fee is subordinated to the
  leasehold mortgage, `false` when it is not, `null` when unknown.
- **Reversion** states the legal terms at expiry: whether improvements revert
  to the lessor, and the surrender condition. It carries **no exit
  adjustment**. The earlier draft's `exit_haircut` is a valuation assumption
  and is removed (see [Deferred](#deferred-and-out-of-scope)).
- **No remaining term field.** The earlier draft's `remaining_term_years` had
  no stated reference date. Remaining term is read from `expiration_date`
  against a date the reader chooses; the format states no derived figure.

**Nothing here is calculated.** Core would not:

- forecast CPI, appraise a fair-market reset, or fill a `null` future rent;
- exercise or assume an extension option;
- infer renewal;
- compute remaining term or reversion economics;
- generate per-period ground-rent rows.

This is the posture of RFC 0055 ("Nothing here is exercised") and RFC 0053
("The schedule documents and verifies the stated tax line; it does not project
it").

### 3. Where the contract lives (proposal; final home open)

| Option | Shape | For | Against |
|---|---|---|---|
| **A. Split (preferred)** | `interest_type` in §4.2 `ownership`; the `ground_lease` contract in its own new standard section, numbered at acceptance | §4.2's purpose is "current ownership, acquisition terms, entity structure", so the estate acquired is an ownership fact. RFC 0060 places the contract "against its own section". A multi-decade contract with a schedule and options is the kind of object §4.24–§4.27 gave their own sections. RFC 0064's carrier decision shows a standard section can be created directly by RFC. | One more section ID. Readers join two places. |
| B. All in §4.2 | `ownership.interest_type` and `ownership.ground_lease` | One place; it is the earlier draft's choice. | It departs from RFC 0060's "its own section" and puts a long contract inside an acquisition-terms section. |
| C. Nested under the expense line | The contract under `noi_model.expenses.ground_rent`, as RFC 0053 nests `reassessment`/`abatement` under `real_estate_taxes` | The schedule sits beside the line it would verify. | Term, options, reversion and subordination are not attributes of an expense line. |
| D. A `tenure` section | Both facts in a new section | One tenure home. | It moves an ownership fact out of §4.2 for no demonstrated gain. |

The draft prefers A. The choice is open before acceptance.

### 4. Ground rent in the underwritten NOI

```json
"ground_rent": { "value": 0.0, "source": "schedule | actual | estimate" }
```

`noi_model.expenses.ground_rent` is a named §4.5 line. Like every §4.5 expense
line, it is a component of `total_operating_expenses`, so a document that
states it has NOI after ground rent.

The repository evidence for this representation:

- **RFC 0060's matrix** gives the ground-lease treatment as "Keep the payment
  upstream of NOI", and lists "ground rent as a named line" as material
  information lost today.
- **§4.5 expense lines compose `total_operating_expenses`.** `uwmd-excel`
  emits Total Operating Expenses as `SUM` over each class layout's
  `expenseLines` and NOI as EGI − Total OpEx (`toWorkbook.ts`). A §4.5 line
  that is *not* in the total would break that footing and Excel ↔ calc parity.
- **The earlier draft's `in_net_operating_income` flag is removed.** Its
  precedents, `CAPX-07` `in_noi_model` (§4.8) and `TAX-08` `in_exit_noi`
  (§4.9), are flags on amounts held *outside* the aggregate they may be
  reflected in. A flag on a §4.5 line saying the line is not in §4.5's own
  total contradicts the section's structure.

Double counting is prevented by existing boundaries, unchanged here:

- **No tranche.** A ground lease is tenure and encumbrance, not a capital-stack
  tranche (RFC 0060). `TrancheClass` is unchanged, and a ground lease stated as
  a tranche remains the double count RFC 0060 refused.
- **Sizing reads NOI.** The capital-stack sizing verbs read
  `noi_model.net_operating_income` (`capital-stack.ts`), and `CC-05` compares
  the DSCR NOI with it. When the named line is stated, those verbs read NOI
  after ground rent, with unchanged formulas.
- **No tool moves amounts.** No tool may move an amount across NOI, or into or
  out of the named line. Restating ground rent as the named line is the
  author's act.

**Open: an unstated position.** For a `leasehold` whose `noi_model` has no
named line, a reader still cannot tell whether NOI reflects ground rent folded
into another line or excludes it. The options are below; this is an owner
decision.

- **N1.** A `leasehold` document with a `noi_model` MUST state
  `noi_model.expenses.ground_rent`, using `0` when no rent is payable (for
  example, a prepaid lease).
- **N2.** A `CAPX-07`-shaped boolean on the tenure or ground-lease object
  states whether `noi_model` already reflects ground rent when no named line
  is stated.

The draft leans to N1, because it removes the ambiguity without a second
place to state the same fact. Neither is accepted.

### 5. Candidate line-to-schedule check (not normative)

A check that the stated ground-rent line agrees with the contract schedule
would catch drift between them. It is **not proposed for emission**: no code is
reserved and nothing is implemented. Its contract is open:

- **Reference.** Possible references are:
  - an explicitly stated selector naming the schedule step the line equals,
    following `TAX-07`, which ties `real_estate_taxes.value` to a stated
    `stabilized_period` rather than inferring a year;
  - `ownership.acquisition_date` (the earlier draft's choice);
  - a stated underwriting-period start.

  The draft leans to the explicit selector, because it infers nothing.
- **Comparison.** Exact at the §VIII.9.4 currency quantum, as `TAX-03` foots,
  or `CC-05`'s 1%.
- **Family.** An in-family rule, as `TAX-07` is, or a registered `CC-NN`
  check. `CC-NN` is a closed sequence extended by RFC (Protocol §III.6a), and
  `CC-16` is the last registered.
- **Steps with `null` rent.** A step with a `null` future rent cannot be
  compared, so the check would skip it.

### 6. Validation (proposal)

A new `GL-NN` family (Protocol §III.6a), owned by `validate`. Every code would
be an `error`, as `LSE-NN` and `TAX-NN` are. Each refuses a stated value that
breaks its typed contract; **absence of any field emits nothing**.

| Code | Condition |
|---|---|
| `GL-01` | A stated `interest_type` is not `fee_simple` or `leasehold`. |
| `GL-02` | A ground-lease contract is stated and `interest_type` is not `leasehold`, including when `interest_type` is absent. Tenure is never inferred from the contract's presence. |
| `GL-03` | A stated `commencement_date` or `expiration_date` is not a real date, or commencement is not before expiration. |
| `GL-04` | Rent-schedule steps lack a real `effective_date` or are not strictly increasing. A stated `ground_rent_annual` is not finite and nonnegative. An `initial` or `fixed` step omits it. A step lies outside `[commencement_date, expiration_date + total stated option term]` when those are stated. |
| `GL-05` | `reset_kind` or `rent_reset` is outside its vocabulary; `cpi` fields appear on a non-`cpi` step; or `floor > cap`. |
| `GL-06` | An option's `count` or `term_years` is not a positive integer, or `notice_months` is not a nonnegative integer. |
| `GL-07` | `fee_subordinated` or `improvements_revert_to_lessor` is not a boolean or `null`, or `surrender_condition` is outside its vocabulary. |
| `GL-08` | A stated `noi_model.expenses.ground_rent.value` is not finite and nonnegative, or `source` is outside its vocabulary. |

The N1/N2 decision above would add one rule. The candidate check in §5 adds
none.

## Deferred and out of scope

Each of these needs its own contract and evidence:

- **`leased_fee` tenure** and leased-fee underwriting: no consumer.
- **A leasehold exit-value adjustment.** StackUW applies one, but it is a
  valuation assumption. Its home (§4.9 `exit_analysis`, §4.6 `valuation`, or
  elsewhere) and its rules are unsettled, so this draft names no field. A
  later contract must keep it outside the lease facts and must not derive it
  from the remaining term.
- **Underwriting assumptions about the lease:** whether an extension option is
  assumed exercised, and any assumed future reset value.
- **Percentage-rent participation.** It is a lease term, but RFC 0060's list
  of lost information does not include it, computing it needs a defined base,
  and its only evidence is adopter planning. It is deferred to keep the first
  contract narrow.
- **A historical §4.4 `operating_statement.expenses.ground_rent` line.**
- **Fee-sale / closing bifurcation** (a fee sale stated as a source).
- **Financing treatment** of leasehold mortgages beyond existing tranches.
- **Lender ground-lease reserves.**
- **Projected CPI or fair-market resets**, and any per-period ground-rent
  series. No deterministic projection contract exists, and RFC 0054 deferred
  per-period lease series until a consumer needs them.
- **Mixed-use components.** Ground rent for a component of a `mixed_use` deal
  is out of scope; that layout emits no §4.5 expense lines.

## Compatibility analysis

- **Existing `.uw.md` files** — none change meaning or validity. Every field
  is optional. An existing document's tenure stays **unstated**; this draft
  assigns it no meaning, not `fee_simple`. No existing rule changes.
- **Tier-1 Reader** — the parser already carries undeclared content keys.
  Renderers MAY show tenure, and show "not stated" when it is absent.
- **Tier-2 Editor** — new editable fields; no edit-semantics change.
- **Tier-3 Calc Host** — no formula change. Packs read
  `noi_model.net_operating_income` as stated.
- **Tier-4 Agent Host** — none.
- **Modules** — no manifest change.
- **Capital stack** — `TrancheClass` and the sizing verbs are unchanged.
- **Excel** — every single-class layout emits Total OpEx as `SUM` over its
  `expenseLines` (multifamily, office, retail, industrial, self-storage,
  hospitality, senior housing, student housing, land). A stated `ground_rent`
  line must be added to each, in the same change as the format line, or the
  workbook's NOI stops footing to the stated NOI. The mixed-use layout emits no
  §4.5 expense lines.

No deprecation path is needed.

## Conformance impact

This PR changes no fixture. If accepted, a feature directory such as
`conformance/tenure/` (in the `conformance/lease/` layout) would pin:

- **Accept cases:**
  - a leasehold with `initial`, `fixed`, past `cpi` and future `fair_market`
    steps, the future step `null`;
  - options stated, but none exercised by the format;
  - the named line inside `total_operating_expenses`;
  - an existing document with no tenure, whose validation is byte-identical and
    whose tenure is "not stated".
- **Reject cases**, one per `GL-NN` code, including:
  - a contract with `interest_type` absent (`GL-02`);
  - a `fixed` step with no rent (`GL-04`);
  - `floor > cap` (`GL-05`).
- **Parity:** Excel for the named line in each single-class layout.

No case would exercise the candidate check until its contract is decided.

## Reference implementation (if accepted)

This draft authorizes no implementation. If accepted, the implementation would
touch:

- `spec/UW_FORMAT_SPEC_v1.md` (§4.2, the contract's section, the §4.5 line);
- `spec/UW_PROTOCOL_v1.md` (the §III.6a `GL-NN` row);
- a shape schema for the contract, like `lease-escalation-schedule.schema.json`;
- `packages/uwmd-core/src/validator.ts` and `types.ts`;
- the nine `uwmd-excel` single-class layouts;
- the fixtures above;
- the wiki.

The format-spec rule bullets and the validator rules would land together, as
`verify-codes` requires. The RFC would not be `implemented` until it ships in a
release with a CHANGELOG entry.

## Alternatives considered

- **Absent `interest_type` means `fee_simple`.** This was the earlier draft's
  choice. A document that never stated tenure would be read as asserting a
  legal interest it never stated.
- **Declare `leased_fee` now for completeness.** Vocabulary with no consumer or
  semantics; deferred.
- **A `ground_lease` tranche class.** Refused by RFC 0060; nothing here reopens
  it.
- **`exit_haircut` inside the lease's reversion.** A valuation assumption is
  not a legal lease term; deferred to a separate contract.
- **An `in_net_operating_income` flag on the §4.5 line.** It contradicts
  §4.5's composition and Excel's footing; see §4.
- **A normative `CC-17` keyed to `acquisition_date`.** Its reference date,
  tolerance and family were all undecided, so it cannot be normative; it is
  now a candidate (§5).
- **Requiring a stated rent on every step.** It forces producers to state
  projected CPI and fair-market results as contract facts.
- **Stating the reset mechanics and letting core project the rent.** It
  contradicts the format's state-and-verify posture and puts CPI paths and
  appraisals into the verifier.

## Decision status

RFC 0067 remains `draft`.

| Item | Source | State |
|---|---|---|
| A ground lease is not a capital-stack tranche; `TrancheClass` unchanged | RFC 0060 (`decided`, 2026-09-19) | Existing decision. Unchanged. |
| §4.5 lines compose `total_operating_expenses`; sizing verbs read `noi_model.net_operating_income`; Excel ↔ calc parity is exact | Format §4.5, §4.24; Protocol §VIII.5; `uwmd-excel` | Existing. Unchanged. |
| Stated schedules are verified, never projected; options are never exercised | RFC 0053, RFC 0055 | Existing posture, adopted here. |
| Leasehold acquisition is the demonstrated consumer | StackUW planning, 2026-09-29 | Adopter evidence. Not verified in this repository. Not authority. |
| `interest_type` (`fee_simple`, `leasehold`); absence is unstated | This draft | Proposal. |
| Ground-lease contract fields (stated lease facts only) | This draft | Proposal. |
| Named §4.5 `ground_rent` line inside `total_operating_expenses` | This draft, following RFC 0060 and §4.5 structure | Proposal. |
| `GL-NN` family, every code an error | This draft | Proposal. |
| Home of the contract (A preferred; B, C, D) | — | **Owner decision required.** |
| Leasehold without a named line: N1 (MUST state the line) or N2 (disclosure flag) | — | **Owner decision required.** |
| Candidate line-to-schedule check: whether to have one, and its reference, tolerance and family | — | **Owner decision required.** Not emitted. |
| Whether `leasehold` requires a contract object, and which contract fields are required | — | **Owner decision required.** The draft requires neither. |
| Percentage rent in the first scope | — | **Owner decision required.** The draft defers it. |
| `leased_fee`, exit adjustment, option and reset assumptions, §4.4 line, bifurcation, financing, lender reserves, projected resets | — | Deferred to separate contracts. |
| Acceptance of RFC 0067 and implementation | — | Not decided. Not authorized. |

## Prior art

- RFC 0060 — the decision this RFC answers; its tenure row is the demand this
  draft addresses.
- RFC 0055 — the step shape (resulting rent, not increment) and the
  `renewal_options` / `rent_reset` vocabulary.
- RFC 0053 — a stated schedule that is verified, never projected; `TAX-07`'s
  explicit period tie and `TAX-08`'s position flag.
- RFC 0057 — `CAPX-07`'s `in_noi_model` disclosure for an amount held outside
  `noi_model`.
- RFC 0064 — a standard section created directly by RFC.
- Appraisal practice for leasehold interests deducts ground rent before NOI.
  No specific source is cited.
