---
rfc: 0082
title: A borrower-underwriting document profile for a loan to an operating company
status: draft
author: claude-code (agent proposal)
created: 2026-10-12
depends_on:
  - 0018
  - 0022
  - 0078
  - 0079
  - 0081
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0082: A borrower-underwriting document profile for a loan to an operating company

**Draft agent proposal.** A coding agent wrote this RFC. StackUW's lending
program, its owner's decisions and its shipped engine are cited as adopter
requirements evidence. They are not UWMD owner authorship or acceptance.
Nothing here is accepted until the UWMD owner accepts it.

## Summary

A UW document today can only describe a deal on a property. This RFC adds a
document profile, `borrower-underwriting-v1`, on the profile mechanism of
RFC 0018, for an underwriting record whose subject is an operating-company
borrower on a senior term loan. The profile:

- has a `borrower` identity block in frontmatter instead of the property
  identity fields;
- carries two new sections:
  - `corporate_financials`, the borrower's stated income statement by fiscal
    year;
  - `borrower_term_loan`, one senior term loan with its stated per-year
    schedule and two covenant tests;
- adds a stated-figure verifier (Protocol §VIII.13) that reproduces EBITDA,
  free cash flow, the balance roll-forward, leverage, fixed-charge coverage
  and each covenant verdict from the document's own stated figures. It
  projects nothing and fills nothing in.

Every existing document keeps its bytes, its meaning and its findings. No
`asset_class`, metric-dictionary entry, pack or property section changes.

## Motivation

**A borrower is not a property.** The format's identity is a property's
identity. `property_address` is required (Format §2.2), `asset_class` is a
property class (§2.2a), and a Reader must parse both (Protocol §II.1 item 1).
The section registry (Part IV) is property sections, and the metric
dictionary is keyed by asset class (`spec/metrics/README.md`). A loan to an
operating company has no address and no class. Its cash flow is the
borrower's income statement, not rent less operating expenses.

Today such a record can be written in only two ways, and both fail:

1. **Invent an address and a class.** The record is then false, and every
   NOI-based check reads the borrower's figures as a property's.
2. **Carry the figures in `x_*` extension sections** (§4.21). Those are
   surfaced but never verified, so the record is unverifiable. Under RFC 0078
   that is the opposite of what the protocol is for.

RFC 0003's custom classes do not fit either. A namespaced class is still an
asset class, and the document still requires `property_address`.

**The profile mechanism already exists for exactly this.** RFC 0018 defines
`document_profile` as "a versioned contract for the purpose and permitted
sections of one document". RFC 0022's `market-data-v1` is a document with no
property identity, its own required identity fields and its own section. The
reference validator already treats any declared profile other than
`deal-underwriting-v1` as having "no property section by design"
(`packages/uwmd-core/src/validator.ts`, the `CC-13` and `CC-14`
preconditions). A borrower record is the same shape of problem.

**Adopter evidence (StackUW).** StackUW is a UWMD adopter. In its lending
program, its owner chose an operating company on a senior term loan as the
first non-real-estate subject (StackUW decision Q-434, 2026-10-10). On
2026-10-12 he opened that program's signed export, filing this RFC upstream
first. StackUW's engine already computes the figures this profile states:

- an income statement to EBITDA and free cash flow, with every year stated and
  none estimated;
- one senior term loan with a monthly schedule, a balloon at maturity, and
  leverage and fixed-charge coverage tests per year.

It has shipped them through its connector (StackUW tasks 4850, 4994, 4995,
4996 and 5003). Its signed export waits on a protocol home for these figures,
which is what this RFC proposes.

## Proposed change

### 1. The `borrower-underwriting-v1` profile (Format §2.2d, new)

A borrower-underwriting document is a UW document whose `document_profile`
is `borrower-underwriting-v1`. It is an underwriting record, so it has a
`deal_id`, but its subject is a borrower.

````markdown
---
uw_version: "3.0"
document_profile: borrower-underwriting-v1
deal_id: "uw_2026_8f3a2c1d"
deal_name: "Example Fabrication LLC senior term loan"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
currency_code: "USD"
borrower:
  legal_name: "Example Fabrication LLC"
  jurisdiction: "Delaware"
  industry: "metal fabrication"
---
````

Rules:

- `uw_version`, `document_profile`, `deal_id`, `created`, `last_modified` and
  `borrower` are REQUIRED.
- `borrower.legal_name` and `borrower.jurisdiction` (state or country of
  organization) are REQUIRED non-empty strings. `borrower.industry` is
  OPTIONAL and descriptive only: no calculation, default, pack or check MAY
  depend on it, as with `scenario` (§2.2b).
- These frontmatter fields MUST be absent: `property_address`, `city`,
  `state`, `zip`, `asset_class`, `asset_subtype`, `loan_type`, `scenario` and
  `quick_metrics`. Each is property identity or an NOI-based metric, and none
  has a meaning for a borrower. Their presence is `BRW-01`.
- A missing or malformed `borrower` block is `BRW-01`.
- The `borrower` block is a nested mapping one level deep, which Appendix D
  already admits.

**Sections.**

| Section | In a borrower document |
|---|---|
| `corporate_financials` (§4.36, new) | REQUIRED. Its absence is `BRW-03`. |
| `borrower_term_loan` (§4.37, new) | OPTIONAL. If present, it requires `corporate_financials`. |
| `borrower_sponsor` (§4.12) | OPTIONAL and unchanged, for principals and guarantors. Nothing in this RFC reads it. |
| `deal_context`, `due_diligence`, `risk_assessment`, `compliance`, `assumptions`, `validation`, `pipeline_log`, `gaps`, `x_*` | OPTIONAL and unchanged. |
| `property`, `ownership`, `rent_roll`, `operating_statement`, `noi_model`, `valuation`, `debt_structure`, `sources_uses`, `dcf`, `stress_tests`, `market_analysis`, `custom_calculations`, `custom_scenarios`, `components`, `capital_stack`, `lease_up_schedule`, `cash_flow_series`, `distribution_waterfall`, `reserve_accounts`, and the official class sections (§4.29 to §4.35) | MUST NOT appear. Each is defined over property income, a property value or a class. Each one present is `BRW-02`. |

**What does not apply.** A borrower document has no asset class, so:

- no metric-dictionary entry and no primary size (§XIII) apply to it;
- the §5.1 stage table and its class overlays do not apply;
- `CC-13` and `CC-14` are `skipped / not_applicable`, as they already are for
  every non-deal-underwriting profile;
- no `CC-NN` check that reads a forbidden section is evaluated.

### 2. `corporate_financials` (Format §4.36, new)

**ID:** `corporate_financials`
**Header:** `## Corporate Financials {#corporate_financials}`
**Purpose:** The borrower's stated income statement, one entry per fiscal
year, oldest first.

```json uw:section=corporate_financials source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": { "section": "corporate_financials", "provenance": { "source": "manual", "actor": "example-author", "timestamp": "2026-10-12T00:00:00Z" }, "quality": { "confidence": "high", "human_review_required": false }, "lifecycle": { "revision": 1, "superseded": false } },
  "years": [
    {
      "period_end": "2026-12-31",
      "revenue": 18400000,
      "cost_of_goods_sold": 11200000,
      "operating_expenses": 4300000,
      "depreciation_and_amortization": 900000,
      "cash_taxes": 410000,
      "capex": 650000,
      "change_in_working_capital": 120000,
      "ebitda": 3800000,
      "free_cash_flow": 2620000
    },
    {
      "period_end": "2027-12-31",
      "revenue": 19300000,
      "cost_of_goods_sold": 11700000,
      "operating_expenses": 4450000,
      "depreciation_and_amortization": 950000,
      "cash_taxes": 440000,
      "capex": 700000,
      "change_in_working_capital": 90000,
      "ebitda": 4100000,
      "free_cash_flow": 2870000
    }
  ]
}
```

| Field | Meaning | Stated or derived |
|---|---|---|
| `period_end` | The fiscal year's last day, as an ISO-8601 calendar date | stated, REQUIRED |
| `revenue` | Revenue | stated, REQUIRED |
| `cost_of_goods_sold` | Cost of goods sold | stated, REQUIRED |
| `operating_expenses` | Operating expenses, **including** depreciation and amortization | stated, REQUIRED |
| `depreciation_and_amortization` | The depreciation and amortization within `operating_expenses` | stated, REQUIRED |
| `cash_taxes` | Cash taxes paid | stated, REQUIRED |
| `capex` | Capital expenditure | stated, REQUIRED |
| `change_in_working_capital` | Positive consumes cash, negative releases it | stated, REQUIRED |
| `ebitda` | `revenue − cost_of_goods_sold − operating_expenses + depreciation_and_amortization` | derived, OPTIONAL; verified when stated |
| `free_cash_flow` | `ebitda − cash_taxes − capex − change_in_working_capital`, before financing | derived, OPTIONAL; verified when stated |

Normative rules:

- **Every year is stated.** A producer MUST NOT estimate a missing year,
  grow one year from another, or fill a missing amount. A reader or verifier
  MUST NOT either. A year whose inputs are absent is not a year.
- **Shape (`BRW-04`, error).** `years` MUST be non-empty. Every `period_end`
  MUST be a real calendar date. Dates MUST be strictly increasing, so there
  are no duplicates. Every amount MUST be a finite number.
- **Signs (`BRW-05`, error).** Every stated amount except
  `change_in_working_capital` MUST be non-negative. `ebitda` and
  `free_cash_flow` MAY be negative.
- **D&A within operating expenses (`BRW-06`, error).**
  `depreciation_and_amortization` MUST NOT exceed `operating_expenses`. It is
  stated as part of them, so a larger figure states a negative remainder.
  StackUW refuses the same input today (`DA_EXCEEDS_OPEX`).
- **Each entry is one full fiscal year.** Interim and last-twelve-months
  periods are out of scope (see Unresolved questions).

### 3. `borrower_term_loan` (Format §4.37, new)

**ID:** `borrower_term_loan`
**Header:** `## Borrower Term Loan {#borrower_term_loan}`
**Purpose:** One senior term loan to the borrower: its stated terms, its
stated schedule by fiscal year, and two covenant tests per year.

```json uw:section=borrower_term_loan source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": { "section": "borrower_term_loan", "provenance": { "source": "manual", "actor": "example-author", "timestamp": "2026-10-12T00:00:00Z" }, "quality": { "confidence": "high", "human_review_required": false }, "lifecycle": { "revision": 1, "superseded": false } },
  "terms": {
    "loan_amount": 9000000,
    "term_months": 24,
    "reference_rate": 0.043,
    "rate_floor": 0.01,
    "spread": 0.035,
    "annual_amortization_pct": 0.05,
    "max_leverage": 3.5,
    "min_fixed_charge_coverage": 1.25
  },
  "years": [
    {
      "period_end": "2026-12-31",
      "opening_balance": 9000000,
      "interest": 685912.50,
      "scheduled_principal": 450000,
      "balloon_principal": 0,
      "ending_balance": 8550000,
      "leverage": 2.25,
      "leverage_pass": true,
      "fixed_charge_coverage": 2.4122,
      "fixed_charge_coverage_pass": true
    },
    {
      "period_end": "2027-12-31",
      "opening_balance": 8550000,
      "interest": 650812.50,
      "scheduled_principal": 450000,
      "balloon_principal": 8100000,
      "ending_balance": 0,
      "leverage": 0,
      "leverage_pass": true,
      "fixed_charge_coverage": 2.6889,
      "fixed_charge_coverage_pass": true
    }
  ]
}
```

The example's figures follow the adopter's accrual: a coupon of
max(0.043, 0.01) + 0.035 = 0.078, accrued monthly on the opening balance,
and 37,500 of scheduled principal a month. Its two years match the
`corporate_financials` example in §2.

**Terms** are all stated and all REQUIRED. Rates are fractions, and
`term_months` is a positive integer. The loan funds in full on the first
day of the fiscal year of its first `years` entry, and month 1 of the term
is that year's first month. Revolvers, delayed draws, sweeps, fees, PIK
interest, warrants and refinancing are out of scope. A loan carrying any of
them is not this section's loan.

**Years.** Each entry is a fiscal year that appears in
`corporate_financials`, matched by `period_end`. Entries are oldest first,
consecutive, and run from the funding year to the last stated year. The
stated income statement MUST cover the whole term, so the year containing
the maturity month has an entry. These are all `BRW-09` (error):

- a missing or out-of-order year;
- an unmatched `period_end`;
- a term that outruns the statement.

**Covenant definitions** (normative, the profile's single definition):

- **Leverage** = `ending_balance ÷ ebitda`, with `ebitda` taken from the
  matching `corporate_financials` year (stated, or derived by §2 if not
  stated). It passes if and only if `ebitda > 0` and leverage ≤
  `max_leverage`. With `ebitda = 0` the figure is `null`, and the test fails.
- **Fixed-charge coverage** = `(ebitda − capex − cash_taxes) ÷ (interest +
  scheduled_principal)`. It excludes `balloon_principal`. It passes if and
  only if it is ≥ `min_fixed_charge_coverage`. With zero fixed charges the
  figure is `null`, and the test passes if and only if the numerator is ≥ 0.
- **A year with no month inside the term** has no debt outstanding. Both
  figures are `null`, both tests pass, and every amount is zero. The year
  containing the maturity month is tested on its own figures.

A producer whose credit agreement defines either ratio differently MUST NOT
state it under these names. It MAY carry its own definition in an `x_*`
section. A stated ratio is always this profile's ratio, never a lookalike.

### 4. Stated-figure verification (Protocol §VIII.13, new)

`verifyBorrowerUnderwriting(parsed)` is a separately invoked, browser-safe,
read-only verifier, in the shape of §VIII.11. It MUST snapshot the parsed
source before any await. It inspects the current non-superseded
`corporate_financials` block and, if present, the `borrower_term_loan`
block. It MUST NOT create a year, infer a zero, project a figure, accrue
interest or derive a term.

1. **Not a borrower document:** return `not_checked / not_applicable`.
2. **Structure:** apply `BRW-01` to `BRW-06` and `BRW-09` in source order. On
   any finding, return `unverifiable / invalid_structure` before any
   arithmetic.
3. **Arithmetic:** evaluate in IEEE 754 binary64 with no intermediate
   rounding (§VIII.5).
4. **Money:** quantize the computed and the stated figure separately at
   2 dp, half away from zero. They MUST be equal, with no further tolerance.
5. **Ratios:** compare under §VIII.5.1 (RFC 0079), with `round_to` 4 and
   `minimum_stated_decimals` 2, the dictionary's `x` rule.

**Findings:**

| Check | Code |
|---|---|
| A stated `ebitda` disagrees with its components | `BRW-07` |
| A stated `free_cash_flow` disagrees with its components | `BRW-08` |
| A year's `opening_balance` is not `loan_amount` (first year) or the prior year's `ending_balance` | `BRW-10` |
| A year's `ending_balance` is not `opening_balance − scheduled_principal − balloon_principal` | `BRW-10` |
| A stated `leverage` or `fixed_charge_coverage` disagrees with §3's definition, or is non-null where §3 gives `null` | `BRW-11` |
| A stated pass flag disagrees with §3's verdict on the stated figures and thresholds | `BRW-12` |
| Non-finite arithmetic, such as division producing infinity | `unverifiable / nonfinite_arithmetic`, `BRW-13` |

An absent `ebitda` or `free_cash_flow` is not checked and is not a
finding.

The result is `failed` if any check disagrees, otherwise `verified`. It
carries the same wire members as §VIII.11 (`state`, optional `reason`,
`source_digest`, `evidence`, `issues`), with a schema at
`spec/schemas/borrower-underwriting-verification.schema.json`. The
reference CLI is `uwmd verify-borrower <file> [--json]`, with §VIII.11's exit
codes.

**What is not verified, deliberately:**

- **`interest` against the terms.** Reproducing it needs an accrual
  convention: StackUW accrues monthly at the coupon ÷ 12 on the opening
  balance, with coupon = max(`reference_rate`, `rate_floor`) + `spread`.
  The standard should choose a convention before it verifies one (Unresolved
  question 2).
- **`scheduled_principal` and `balloon_principal` against
  `annual_amortization_pct`.** These depend on the same month boundary.

A verifier MUST report neither as verified. It MUST NOT recompute a
schedule to fill one in.

### 5. Registrations

- **Protocol §III.6a:** register the `BRW-NN` family, owned by `validate`,
  severity `error`, citing Format §2.2d, §4.36 and §4.37. As with `RSV`,
  `BRW-07`, `BRW-08` and `BRW-10` to `BRW-13` are verifier findings of
  §VIII.13, and ordinary `validate` does not claim arithmetic verification.
- **Protocol §II.1 item 1:** "required frontmatter fields" becomes the
  fields its document's profile requires: §2.2 for a deal-underwriting
  record, §2.2d for a borrower-underwriting record. Item 2 and §XII.2 count
  the two new standard section ids.
- **Protocol §II.2 item 3:** add the borrower-underwriting verifier
  (§VIII.13) to the list of stated-figure verifiers a Verifier implements.
- **Format Part V:** add `BRW-01` to `BRW-13` with the rule text above.
- **Schemas:** `spec/schemas/uw-borrower-underwriting.schema.json` for the
  profile, and the verification schema in §4.
- **The deal-package manifest's `document_profile`** (RFC 0018) admits the new
  id with no schema change, because profile ids are opaque.

**Versions.** The change is additive:

- **Format:** stays 3.0. No existing document changes, and Format §0.3 bumps
  the format only on a breaking change. The `market-data-v1` profile is the
  precedent.
- **Protocol:** a minor version, 4.1.0. It adds required Verifier behavior
  (§II.2) and a code family.
- **Labels:** the maintainers set the actual labels at release preparation.

## Compatibility analysis

- **Existing documents.** None changes. A document without
  `document_profile`, or with any other profile, is read, validated and
  verified exactly as today, with the same bytes and the same findings.
- **Readers.** A Protocol 4.0.0 Reader that meets a borrower document
  surfaces the unknown profile, frontmatter and sections as informative
  (§XII.1, §XII.2) and does not error. A Reader that adopts this RFC parses
  the profile's required fields.
- **Verifiers.** A 4.0.0 Verifier that has not implemented §VIII.13 can claim
  4.0.0 but not 4.1.0. Under Protocol §II.3 it reports the borrower checks
  `unverifiable`, never passed and never failed.
- **Modules and packs.** None applies to a borrower document, and no manifest
  changes.
- **Representations:**
  - **UW XML:** carries every envelope member (`UW_XML_MAPPING` §1), so it
    needs no change.
  - **Excel:** parity ships in the same release. `toWorkbook` renders the two
    sections with `ebitda`, `free_cash_flow`, the balances and both ratios as
    live formulas over the stated cells, `fromWorkbook` round-trips them, and
    the calc-to-Excel parity tests cover every §VIII.13 figure.
  - **UW Lite:** compiles the builtin property classes (`UW_LITE_SPEC`). The
    Lite bridge MUST refuse a borrower document with a typed refusal rather
    than compile a property summary. A Lite borrower summary would be its own
    RFC.
- **Signing, integrity and receipts.** Unchanged. The new sections are
  ordinary bare Format 3.0 blocks under §V.9 to §V.11, so a signed
  borrower document needs no new signing rule.

## Conformance impact

No existing fixture changes.

New named suite `borrower-underwriting`:

- **Accept:**
  - `valid/statement-only/`: a profile document with `corporate_financials`
    and no loan;
  - `valid/term-loan/`: a five-year loan covered by its statement, with a
    balloon in the maturity year;
  - `valid/after-term-year/`: a statement year after maturity, with null
    ratios, both tests passing and zero amounts;
  - `valid/zero-fixed-charges/`: a null fixed-charge coverage that passes on
    a non-negative numerator;
  - `valid/signed/`: the term-loan document signed and verified under §V.11.
- **Reject (structure):**
  - `BRW-01`: a property field present; `quick_metrics` present; no
    `borrower` block; an empty `legal_name`;
  - `BRW-02`: a `noi_model` section present;
  - `BRW-03`: no `corporate_financials`;
  - `BRW-04`: dates out of order; a duplicate `period_end`; an impossible
    date;
  - `BRW-05`: a negative `capex`;
  - `BRW-06`: depreciation and amortization above operating expenses;
  - `BRW-09`: a term that outruns the statement; a missing year.
- **Verify, failed:** `BRW-07`, `BRW-08`, `BRW-10` (opening and ending),
  `BRW-11` (each ratio, and a stated ratio where §3 gives null), `BRW-12`
  (each flag).
- **Verify, verified at precision:** a coarse leverage `2.3` against a
  computed `2.25` fails, and `2.25` verifies, under §VIII.5.1.
- **Unverifiable:** `BRW-13`, non-finite arithmetic.
- **Unchanged:** a deal-underwriting fixture's findings are byte-identical
  with the profile implemented.

## Reference implementation

- **Files:**
  - `packages/uwmd-core/src/borrower-underwriting.ts`: profile parsing, the
    `BRW` rules and `verifyBorrowerUnderwriting`;
  - `packages/uwmd-core/src/protocol.ts`: the code registry and remediation
    entries;
  - `packages/uwmd-core/src/validator.ts`: the profile's frontmatter and
    section rules beside the existing `CC-13` and `CC-14` profile
    preconditions;
  - `packages/uwmd-cli`: `verify-borrower`;
  - `packages/uwmd-excel`: the two sections with live formulas, both
    directions;
  - `packages/uwmd-core/src/lite-bridge.ts`: the typed refusal.
- **API:** `BORROWER_UNDERWRITING_PROFILE_ID`,
  `verifyBorrowerUnderwriting` and its result types. All are additive.
- **Docs:** one worked example under `examples/`, so the profile ships with
  an instance, which was RFC 0022's lesson.
- **Test plan:** the suite above, the Excel parity tests, and the full
  existing corpus unchanged.

## Alternatives considered

1. **A new frontmatter `subject_kind: property | borrower`.** This was the
   adopter's first draft. It duplicates what `document_profile` already
   does. It would also need its own answer for every place the reference
   implementation already branches on the profile (`CC-13`, `CC-14`, deal
   packages). Rejected in favor of the existing mechanism.
2. **A namespaced custom asset class** (RFC 0003). A borrower is not an
   asset, and the document would still need `property_address`. Rejected.
3. **Borrower metrics in the metric dictionary.** The dictionary selects an
   entry by asset class and id, and a borrower document has no class. A
   per-year check over an array also needs iteration the safe-expression
   grammar does not have (§VIII). A dedicated verifier follows the §VIII.11
   precedent instead.
4. **Standardize the loan schedule now**, so `interest` and principal are
   verified from the terms. This is deferred because the standard has no
   accrual convention for a non-property loan yet. The section marks those
   figures as not verified rather than verifying them against one producer's
   convention.
5. **Identity and financial statements only, with the loan in a second
   RFC.** This is smaller, but a borrower record without its loan cannot carry
   the covenant tests that make it an underwriting record. The adopter's
   signed export is that record.

## Unresolved questions

1. **Ratio definitions:** this RFC fixes one definition each for leverage
   and fixed-charge coverage, which are the adopter's. Should the profile
   instead carry a producer's stated definition beside each figure?
2. **Accrual convention:** whether a later RFC standardizes the term loan's
   accrual, so `interest` and principal become verifiable.
3. **Periods:** whether interim and last-twelve-months periods are admitted,
   and how a covenant tested on one is stated.
4. **Headline metrics:** whether a borrower document gets denormalized
   frontmatter metrics of its own (EBITDA, leverage) or none.
5. **Currency:** whether `currency_code` (RFC 0046) becomes REQUIRED for a
   borrower document.
6. **The CSV bundle:** whether it needs a mapping for the two sections.
7. **Further corporate credit:** revolvers, borrowing bases, ECF sweeps,
   unitranche, PIK and warrants. Each would be its own RFC on this profile.

## Prior art

- **RFC 0018 and RFC 0022:** a document profile with its own identity and
  sections, and no property.
- **RFC 0064 (§VIII.11):** a separately invoked stated-figure verifier that
  checks a roll-forward and never fills a gap.
- **Credit-agreement practice:** leverage (total debt to EBITDA) and
  fixed-charge coverage are the two maintenance covenants most commonly
  tested on a senior term loan to an operating company. The definitions
  vary by agreement, which is why §3 names one and refuses lookalikes.
