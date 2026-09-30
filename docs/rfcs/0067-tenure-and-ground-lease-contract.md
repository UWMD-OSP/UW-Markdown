---
rfc: 0067
title: Tenure and ground-lease contract
status: draft
author: jaredmaxey (StackUW)
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

## Summary

Give UW Markdown a tenure. `ownership` (§4.2) gains an OPTIONAL `interest_type` -
`fee_simple | leasehold | leased_fee`, absent meaning `fee_simple` - and an OPTIONAL
`ground_lease` object stating the lease a leasehold owes or a leased fee collects: parties, term,
extension options, the rent schedule with each step's reset kind, an optional percentage
participation, subordination of the fee, and the reversion. `noi_model.expenses` (§4.5) gains an
OPTIONAL named `ground_rent` line that MUST state whether it sits inside
`net_operating_income`. One cross-check, `CC-17`, ties the stated ground rent to the schedule's
figure for the underwritten year. Coverage verbs are unchanged - for a leasehold they read NOI
after ground rent - and no tranche class is added: RFC 0060's decision stands. Nothing is
projected or exercised; every existing document is unchanged.

## Motivation

RFC 0060 closed the `ground_lease` tranche question and kept the need open:

- It refused the class as "wrong conceptual layer" - "Keep the payment upstream of NOI; the
  structure needs a tenure contract" (RFC 0060:67). A ground lease is "Tenure and encumbrance, not
  capital. Nobody contributed a dollar of capital to the leasehold borrower; the lessee owes
  periodic rent" (:81-83); a tranche would double-count against `net_operating_income` (:95-101).
- It measured the gap: §4.4 `operating_statement.expenses` has no `ground_rent` key (:108-109);
  §4.5 `noi_model.expenses` has "no `ground_rent` key **and no generic bucket at all**" (:110-114);
  "No section anywhere in the format types the leasehold as an object" (:115). Remaining term,
  resets and escalations, extension options, the fee/leasehold relationship and subordination "are
  all absent" (:117-121).
- It named the fix: "a **demand-gated property/tenure or ground-lease contract against its own
  section**, with its own RFC and a demonstrated consumer" (:124-126), preserved in its table as
  "Ground-lease / leasehold tenure contract" (:252). Its non-goals excluded "ground-rent escalation
  schedules" from 0060 itself (:227), not from the format.

Current text confirms it: §4.2 `ownership` (format v1 :797-833) carries transaction type, owner,
acquisition date and price, existing debt and entity - no interest type and no lease; §4.5
`expenses` is the fixed list at :1256-1337.

**Demonstrated consumer.** StackUW (`cc.underwriter`) - its owner decided on 2026-09-29 to
underwrite the leasehold acquisition first (improvements on leased land, ground rent the
obligation), with ground rent stated BEFORE NOI as a named line and the reversion a stated exit
input never inferred from the term. Its engine computes the schedule, the NOI after ground rent
and the exit; until this RFC is released it signs a leasehold deal's ground rent only as dollars
inside NOI and total operating expenses and states no tenure (its Q-100 conformance rule). This RFC
is the carrier that lets it state what it computed.

## Proposed change

Normative text uses RFC 2119 terms. All additions are OPTIONAL; rates are fractions; dates are
`YYYY-MM-DD`.

### 1. §4.2 `ownership.interest_type`

```json
"interest_type": "fee_simple | leasehold | leased_fee"
```

- `fee_simple` - the document's subject is not encumbered by a ground lease it states. Absent
  means `fee_simple`, so every existing document keeps its meaning.
- `leasehold` - the subject is the lessee's estate: improvements on land held under
  `ground_lease`, which the owner PAYS.
- `leased_fee` - the subject is the lessor's estate: land under `ground_lease`, which the owner
  COLLECTS. Declared for vocabulary completeness; no consumer underwrites it yet (see Unresolved).

### 2. §4.2 `ownership.ground_lease`

```json
"ground_lease": {
  "lessor": "string | null",
  "lessee": "string | null",
  "commencement_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "remaining_term_years": null,
  "extension_options": [
    {
      "count": 0,
      "term_years": 0,
      "notice_months": null,
      "rent_reset": "fair_market | fixed | cpi | null",
      "underwritten_as_exercised": false
    }
  ],
  "rent_schedule": [
    {
      "effective_date": "YYYY-MM-DD",
      "lease_year": null,
      "ground_rent_annual": 0.0,
      "reset_kind": "initial | fixed | cpi | fair_market",
      "cpi": { "index": null, "floor": null, "cap": null },
      "terms": null
    }
  ],
  "percentage_rent": {
    "rate": 0.0,
    "base": "effective_gross_income",
    "combination": "additive | greater_of"
  },
  "fee_subordinated": null,
  "reversion": {
    "improvements_revert_to_lessor": true,
    "surrender_condition": "as_is | demolished | null",
    "exit_haircut": null
  }
}
```

- **Rent schedule.** Each step states the **resulting** annual ground rent from its
  `effective_date`, not the increment - the RFC 0055 `escalation_schedule` rule (format v1
  :1106-1109), so a reader never compounds resets to learn what year 30 costs. `reset_kind` says
  how the step's figure was set: `initial`, a `fixed` step, a `cpi` reset (with its stated index
  label and optional `floor`/`cap` as fractions on the change since the prior step), or a
  `fair_market` reset. The reset years ARE the steps' dates (`lease_year` optional, for leases
  written in lease years). `reset_kind` reuses RFC 0055's `rent_reset` words (`fair_market`,
  `fixed`, `cpi`, format v1 :962) rather than coining `fmv`.
- **Extension options** reuse the RFC 0055 `renewal_options` shape (format v1 :957-964) plus
  `underwritten_as_exercised`, which records the author's underwriting assumption; the format
  exercises nothing.
- **Percentage rent** is the participation: `rate` of `base`, combined with the scheduled rent as
  `combination` states. `base` is a closed vocabulary with one member today.
- **`fee_subordinated`** - `true` when the fee is subordinated to the leasehold mortgage, `false`
  when not, `null` when unknown.
- **Reversion** states what happens at expiry and the author's stated exit adjustment
  `exit_haircut` (a fraction of the cap-rate exit value). It is a stated input; the format never
  derives it from the remaining term. (Whether it belongs here or in §4.9 `exit_analysis` is open.)
- **Nothing here is exercised or projected** - the RFC 0055 posture (format v1 :1103-1104) and the
  RFC 0053 one ("The schedule documents and verifies the stated line; it does not project it",
  :1394-1396). No per-period ground-rent rows are generated.

### 3. §4.5 `noi_model.expenses.ground_rent`

```json
"ground_rent": {
  "value": 0.0,
  "in_net_operating_income": true,
  "source": "schedule | actual | estimate"
}
```

- `in_net_operating_income` MUST be stated as a boolean - the `TAX-08` `in_exit_noi` (:1845-1848)
  and `CAPX-07` `in_noi_model` (:1730-1733) precedent: a stated amount with no position flag is how
  a document is double-counted. When `true`, `value` is inside `total_operating_expenses` and
  `net_operating_income` is after ground rent.
- For `interest_type: leasehold`, a producer SHOULD state `true` - the appraisal convention for a
  leasehold interest, and the one the demonstrated consumer uses.

### 4. Rules

A new registered family `GL-NN` (Protocol §III.6a, `spec/UW_PROTOCOL_v1.md:569-598`), severity
`error` like `LSE-NN` and `TAX-NN`, owned by `validate`:

- `GL-01` - `interest_type` is one of the three values. `leasehold` or `leased_fee` requires
  `ground_lease`, and `ground_lease` requires one of them: the type and the body agree, or neither
  is stated (the `LSE-06` shape, :1120-1122).
- `GL-02` - `commencement_date` and `expiration_date` are real dates, commencement first;
  `remaining_term_years`, when stated, is finite, nonnegative and not above the full term.
- `GL-03` - `rent_schedule` steps have a real `effective_date` and a finite nonnegative
  `ground_rent_annual`, strictly increasing by date, each inside `[commencement_date,
  expiration_date]` extended by the stated options' total term.
- `GL-04` - `reset_kind` is one of the four values; `cpi` fields appear only on a `cpi` step, and
  `floor <= cap` when both are stated.
- `GL-05` - each option's `count` and `term_years` are positive whole numbers, `notice_months` a
  nonnegative whole number, `rent_reset` from its vocabulary, `underwritten_as_exercised` a boolean.
- `GL-06` - `percentage_rent.rate` is in `(0, 1]`, `base` is `effective_gross_income`, and
  `combination` is `additive` or `greater_of`.
- `GL-07` - `reversion.exit_haircut`, when stated, is in `[0, 1]`; `fee_subordinated` is a boolean
  or `null`.
- `GL-08` - `noi_model.expenses.ground_rent.in_net_operating_income` is stated as a boolean and
  `value` is finite and nonnegative.

**The one cross-check.** `CC-17` (the `CC-NN` sequence is closed and extended by RFC, Protocol
:635-636; `CC-16` is the last registered, format v1 :3198):

- `CC-17` - `noi_model.expenses.ground_rent.value` equals the `ground_lease` rent for the
  underwritten year: the `rent_schedule` step in force on `ownership.acquisition_date`, combined
  per `percentage_rent.combination` with `rate x noi_model.income.effective_gross_income` when
  `percentage_rent` is stated. Tolerance: the §VIII.9.4 currency quantum (`TODO(impl)`, see
  Unresolved). Coverage (RFC 0037): `skipped` / `field_absent` when either side or
  `acquisition_date` is absent; `not_applicable` when there is no `ground_lease`.

### 5. Coverage - no verb change, no tranche

The capital-stack sizing verbs read `noi_model.net_operating_income` (format v1 :2912;
`packages/uwmd-core/src/capital-stack.ts:334`), and `CC-05` compares the DSCR NOI with it (:3187).
With `in_net_operating_income: true`, that NOI is after ground rent, so a leasehold's DSCR, debt
yield and every `*_through` verb read the figure a leasehold lender sizes on - unchanged formulas.
`TrancheClass` is unchanged; a ground lease stated as a tranche remains the double count RFC 0060
refused (:95-101).

## Compatibility analysis

- **Existing `.uw.md` files** - none change meaning or validity. Every field is optional;
  `interest_type` absent is `fee_simple`; no existing rule changes; `CC-17` is `not_applicable`
  without a `ground_lease`.
- **Tier-1 Reader** - unknown-field handling already covers readers that predate this; renderers
  MAY show the tenure. Tier-1 validation baselines list issues only (e.g.
  `conformance/tier-1-reader/expected/08-variant-cross-checks.validation.json`), so a skipped
  `CC-17` changes none of them. `TODO(impl)`: enumerate any test that pins the full CC coverage
  record; each gains a `not_applicable` `CC-17` row.
- **Tier-2 Editor** - new editable fields; no edit-semantics change.
- **Tier-3 Calc Host** - no formula change; packs that read `net_operating_income` read it as
  stated.
- **Tier-4 Agent Host** - none.
- **Modules** - no manifest change.
- **Excel** - the expense emitters enumerate §4.5 lines by path
  (`packages/uwmd-excel/src/multifamily.ts:25-37`); a stated `ground_rent` needs a row wherever
  §4.5 expenses are emitted, identically to core (RFC 0060:42's invariant 4). `TODO(impl)`: list
  every class emitter.

No deprecation path: nothing breaks.

## Conformance impact

No existing fixture changes. New feature directory `conformance/tenure/`, in the
`conformance/lease/` layout (`<case>/deal.uwx.md` + `expected.json`):

- `accept-leasehold-stepped` - leasehold with fixed, CPI and fair-market steps, two options (one
  exercised), `ground_rent` inside NOI agreeing with the step in force: no `GL-*`, `CC-17`
  evaluated clean.
- `accept-leasehold-participation` - `greater_of` and `additive` variants: `CC-17` clean.
- `accept-fee-simple-unchanged` - an existing fee-simple deal: byte-identical validation.
- `reject-type-without-lease`, `reject-lease-without-type` (`GL-01`); `reject-dates-reversed`
  (`GL-02`); `reject-duplicate-step-date`, `reject-step-outside-term` (`GL-03`);
  `reject-cpi-floor-above-cap` (`GL-04`); `reject-fractional-option-term` (`GL-05`);
  `reject-participation-rate-zero` (`GL-06`); `reject-haircut-above-one` (`GL-07`);
  `reject-ground-rent-without-position` (`GL-08`).
- `warn-ground-rent-disagrees-with-schedule` - `CC-17` fires; `skip-no-acquisition-date` - `CC-17`
  skipped `field_absent`.

## Reference implementation

- **Files affected:** `spec/UW_FORMAT_SPEC_v1.md` (§4.2 template + prose, §4.5 template + prose,
  §5.3 CC table row); `spec/UW_PROTOCOL_v1.md` (§III.6a `GL-NN` row); a
  `spec/schemas/ownership-ground-lease.schema.json` (shape only, like
  `lease-escalation-schedule.schema.json`); `packages/uwmd-core/src/validator.ts` (a
  `checkGroundLease` pass + `CC-17`, honoring RFC 0040 role selection); `packages/uwmd-core/src/protocol.ts`
  (codes, descriptions, remediations); `packages/uwmd-core/src/types.ts` (the new shapes);
  `packages/uwmd-excel/src/*` (the `ground_rent` row); the fixtures above.
- **API surface:** additive types for `interest_type`, `ground_lease`, `ground_rent`; no removed
  or changed export.
- **Test plan:** `validator.ground-lease.test.ts` for each `GL-*` firing and skipping and for
  `CC-17` evaluated/skipped/not-applicable; Excel parity for the new row; `npm run verify-codes`
  (new family registered, every documented code emitted); `npm run verify-indexes` (README row);
  `npm run conformance`.

The RFC is not `implemented` until it ships in a release with a CHANGELOG entry.

## Alternatives considered

- **A `ground_lease` tranche class** - refused by RFC 0060 (:67, :88-101); nothing here reopens it.
- **A new top-level `tenure` section** - RFC 0060:125 says "against its own section". Placing the
  object in §4.2 keeps the estate beside the acquisition it qualifies and avoids a section with no
  meaning for fee-simple deals; the own-section option stays open (Unresolved).
- **Folding ground rent into an existing §4.5 line** - loses the named line both RFC 0060 (:67)
  and the consumer's convention require.
- **Stating the reset mechanics and letting core project the rent** - contradicts the format's
  "document, not project" posture (RFC 0053, RFC 0055) and would put CPI paths and appraisals into
  the verifier.
- **A per-period ground-rent series** - deferred, as RFC 0054 deferred per-lease series until a
  consumer needs it.

## Unresolved questions

1. **Home of the object** - §4.2 member (proposed) or its own section (RFC 0060:125)?
2. **Home of the exit haircut** - `ground_lease.reversion.exit_haircut` (proposed) or §4.9
   `exit_analysis`, next to `exit_value_gross`, with a rule tying them?
3. **`CC-17` reference date and tolerance** - `ownership.acquisition_date` and the currency quantum
   (proposed), or a stated underwritten-year start and `CC-05`'s 1%?
4. **SHOULD or MUST** - is `in_net_operating_income: true` a MUST for `leasehold`, or a SHOULD with
   an `FV`-style warning when `false`?
5. **§4.4** - add `operating_statement.expenses.ground_rent` for the historical statement (RFC
   0060:108-109), or leave it in `other_expenses`?
6. **`leased_fee`** - declare it now (proposed, vocabulary only) or wait for a consumer?
7. **Bifurcation** - the consumer's second slice (a fee sale at closing, stated as a source) may
   need a `sources_uses` source name and a ground-rent coverage figure; out of scope here, to be
   raised with that slice.

## Prior art

- RFC 0060 - the decision this RFC answers; its tenure row (:252) is the demand this fills.
- RFC 0055 - the step shape (resulting rent, not increment) and the `renewal_options` /
  `rent_reset` vocabulary reused here.
- RFC 0053 - a stated schedule that is verified, never projected; `TAX-08`'s position boolean.
- RFC 0057 - `CAPX-07`'s `in_noi_model` disclosure, the double-count guard reused by `GL-08`.
- RFC 0037 / RFC 0040 - CC coverage records and role-aware selection that `CC-17` follows.
- Appraisal practice for leasehold interests: ground rent is deducted before NOI, and the
  leasehold is valued on NOI after ground rent over the remaining term.
