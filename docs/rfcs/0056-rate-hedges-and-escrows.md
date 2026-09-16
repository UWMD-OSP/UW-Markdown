---
rfc: 0056
title: 'Typed rate hedges, escrows and the reserves that fund them'
status: implemented
accepted: 2026-09-15
author: claude
created: 2026-09-15
depends_on:
  - 0046
  - 0052
  - 0053
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0056: Typed rate hedges and escrows

## Summary

`debt_structure` records a floating loan's hedge as a single number,
`rate_cap_pct`, and `sources_uses` records what it cost as a single number,
`rate_cap_cost`. Neither carries a strike, a notional, a term, or what happens
when the cap expires. This contract types the instrument, types the escrow lines
beside it, and reserves `rate_swap` and `rate_collar` against a later
mark-to-market contract.

It registers two validator families: `HDG-NN` on the hedge (format §4.7) and
`ESC-NN` on the escrows (format §4.8).

Everything is optional and verified, never derived. No cap is priced, no payoff
is projected, and no escrow balance is rolled forward.

## Motivation

A floating-rate bridge loan with a three-year cap on a five-year hold has a
cliff in month 37. The document can say the cap struck at 3.5% and cost
$410,000, and that is all it can say. It cannot say:

- **What the cap is written on.** A $40M loan with a $30M notional is
  75% hedged; `rate_cap_pct: 0.035` reads identically to a fully hedged one.
- **When it expires.** The single most consequential fact about a cap is its
  term, and there is no field for it.
- **What happens next.** Replace it, run unhedged, or the loan matures first —
  three different deals, none of them expressible.
- **That the replacement was budgeted.** `uses` has `rate_cap_cost` for the
  cap bought at close. There is no line for the one bought in year three, and a
  replacement cap in a higher-rate environment is routinely the larger number.

This is the RFC 0053 and RFC 0055 situation a third time: the spec documents the
stub, the underwriting turns on it, and the only place to put the real terms is
a `notes` string.

The escrows have the same shape of gap. `uses` carries four flat scalars —
`operating_reserves`, `interest_reserve`, `rate_cap_cost`, `other_reserves` —
with no way to say which are lender-required, which fund monthly rather than at
close, or that the tax and insurance escrows exist at all. Format §4.5 has a
typed `replacement_reserves` inside the NOI model; §4.8 has no counterpart on
the capital side.

## Proposed change

Every member below is OPTIONAL. A document stating none of them validates
exactly as it does today. Rates are fractions, not percents.

### 1. `debt_structure.rate_hedge` — the instrument

```ts
interface RateHedge {
  instrument: 'rate_cap';
  notional: number;                 // finite, >= 0
  strike_rate: number;              // a fraction, in (0, 1)
  index: 'sofr' | 'prime' | 'treasury_5yr' | 'treasury_10yr';
  effective_date: string;           // YYYY-MM-DD
  expiration_date: string;          // YYYY-MM-DD, strictly after effective_date
  premium: number | null;           // upfront cash, null when genuinely none
  post_expiration_assumption: 'replace' | 'unhedged' | 'loan_matures_first';
  counterparty?: string;            // author narrative; nothing is inferred
}
```

`index` reuses the `rate_index` vocabulary minus `fixed`, which is not a thing a
cap is struck against.

| Code | Rule |
|---|---|
| `HDG-01` | `instrument` is from the closed set; `notional` finite and nonnegative; `strike_rate` a fraction in `(0, 1)`; `index` from the closed set; both dates real, with `expiration_date` strictly after `effective_date`; `premium` finite and nonnegative when stated. |
| `HDG-02` | `rate_swap` and `rate_collar` are **reserved and refused**. Both have a mark-to-market value that moves with the curve and can be an asset or a liability; a cap cannot be worth less than zero. Typing them as caps would make the capital stack wrong in the one case that matters. |
| `HDG-03` | A hedge requires `rate_type` to be `floating` or `hybrid`. A fixed-rate loan does not carry a rate cap. |
| `HDG-04` | `strike_rate` agrees with the legacy `rate_cap_pct` when both are stated. |
| `HDG-05` | `premium` agrees with `sources_uses.uses.rate_cap_cost` at the currency quantum when both are stated. |
| `HDG-06` | `post_expiration_assumption` is stated and from the closed set. |

`HDG-04` and `HDG-06` are the moves `TAX-04` and `LSE-06` made: a legacy scalar
that has to agree with the typed body, and a field that forces the author to
answer the question the structure raises rather than leaving it null.

`HDG-06` deliberately has no default. A cap's expiry is the fact the reader came
for, and "unstated" is the answer that hides the cliff.

### 2. `sources_uses.uses.escrows` — the cash lines

```ts
interface Escrow {
  name: 'tax' | 'insurance' | 'replacement_reserve' | 'ti_lc'
      | 'interest' | 'operating' | 'rate_cap_replacement' | 'other';
  label?: string;              // REQUIRED when name is 'other'
  upfront: number | null;      // funded at close
  monthly: number | null;      // ongoing deposit
  lender_required?: boolean;
}
```

| Code | Rule |
|---|---|
| `ESC-01` | `escrows` is a nonempty array of objects; `name` from the closed set; `upfront` and `monthly` finite and nonnegative when stated, with at least one of the two stated. |
| `ESC-02` | `other` requires a nonempty `label` and no other name carries one; `name` is unique across the array, and `other` entries are distinguished by unique labels. |
| `ESC-03` | `uses.interest_reserve` and `uses.operating_reserves` agree with the `interest` and `operating` escrows' `upfront` at the currency quantum when both are stated. |
| `ESC-04` | `post_expiration_assumption: "replace"` requires a `rate_cap_replacement` escrow, and a `rate_cap_replacement` escrow requires that assumption. |

The closed-vocabulary-with-a-named-`other` shape is RFC 0052's, for the same
reason: an open string makes two documents incomparable, and a closed list with
no escape hatch makes the honest author lie.

`ESC-04` is the point of the contract. It is the rule that turns "this cap
expires in year three" from a note into a funded line.

### 3. Reserved names

```ts
const RESERVED_HEDGE_INSTRUMENTS = ['rate_swap', 'rate_collar'];
```

Refused by `HDG-02` with a message naming the reason. This follows RFC 0052's
reserved levered deductions exactly: the names are spoken for, so no producer
invents an incompatible spelling before the real contract arrives.

## Compatibility

Purely additive. Every member is optional, no existing field changes shape, and
no existing fixture moves. `rate_cap_pct`, `rate_cap_cost`, `interest_reserve`
and `operating_reserves` keep their current meaning and gain only the agreement
rules above. The `HDG-NN` and `ESC-NN` codes are new and fire only on documents
that state the new members.

Format minor and Protocol minor. No package API is removed.

## Out of scope

- **Pricing a cap, or projecting its payoff.** The document states the premium
  the author paid. Nothing values the instrument or computes a strike-crossing
  receipt; that needs a forward curve, which is market data this contract does
  not fetch.
- **Swaps and collars.** Reserved by `HDG-02`. Their mark-to-market can be
  negative, which is a capital-stack question (§4.24), not a debt-terms one.
- **Escrow roll-forward.** A balance that amortizes is periodic, and RFC 0054
  placed periodic per-position series behind a named consumer.
- **Cash-trap and springing-lockbox mechanics.** `covenants` already carries
  `cash_trap` as a type; the cascade is its own vocabulary.
- **Deriving maturity from `loan_term_years`.** There is no stated closing date
  to add it to, so the cap-versus-loan term comparison is left to the author
  through `post_expiration_assumption`.
- **Hedges on anything but the property loan.** Component-level financing is a
  capital stack (`MU-06`), and a component stack has no `debt_structure`.

## Conformance

- A floating loan with a full hedge, a replacement assumption and a matching
  `rate_cap_replacement` escrow validates clean.
- A hedge on a fixed-rate loan refuses `HDG-03`.
- `instrument: "rate_swap"` and `instrument: "rate_collar"` each refuse
  `HDG-02`.
- An expiration on or before the effective date, a strike at 0, a strike above
  1, and a negative notional each refuse `HDG-01`.
- A `strike_rate` disagreeing with `rate_cap_pct` refuses `HDG-04`; a `premium`
  disagreeing with `rate_cap_cost` refuses `HDG-05`.
- A hedge with no `post_expiration_assumption` refuses `HDG-06`.
- An unknown escrow name, a negative amount, and an entry stating neither
  amount each refuse `ESC-01`.
- An `other` escrow with no label, a labeled `tax` escrow, and a duplicated
  name each refuse `ESC-02`.
- An `interest_reserve` disagreeing with the `interest` escrow refuses
  `ESC-03`.
- `post_expiration_assumption: "replace"` with no replacement escrow, and a
  replacement escrow under `unhedged`, both refuse `ESC-04`.
- A document stating none of the new members is unchanged, and the existing
  corpus passes untouched.
