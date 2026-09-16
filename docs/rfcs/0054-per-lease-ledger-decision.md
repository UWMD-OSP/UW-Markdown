---
rfc: 0054
title: Where per-lease economics live — a decision, not a container
status: accepted
accepted: 2026-09-15
author: claude
created: 2026-09-15
depends_on:
  - 0008
  - 0041
  - 0053
affects:
  - format-spec
  - documentation
---

# RFC 0054: The per-lease ledger decision

## Summary

The roadmap asks us to "choose a state-and-verify `lease_ledger` series (rather
than widening the point-in-time rent roll) to support lease clauses, CAM
true-ups, and TI/LC balances." This RFC takes that decision and **declines the
premise**: those three things do not share a shape, and putting them in one
container makes two of them wrong.

The recommendation is to **split by shape** — type the lease clauses where they
already are, and defer the periodic ledger until a consumer exists. This RFC
decides placement only. It defines no fields and implements nothing.

## The constraint that decides it

A per-lease monthly ledger is a two-dimensional collection: lease × period.
The Tier-3 calc grammar addresses neither dimension.

- **Paths are flat identifiers.** A path is `head.segment.segment`, each segment
  matching `^[A-Za-z_][A-Za-z0-9_]*$`. There is no array index and no wildcard.
- **`sum()` is variadic, not an aggregator.** It sums the arguments it is
  handed. It cannot be pointed at a collection.
- **RFC 0041 allows one period selector per reference.** A ledger needs two
  coordinates; the grammar accepts one.

So a ledger could be stated and verified by TypeScript, exactly as
`lease_up_schedule` and `cash_flow_series` are, but **no pack formula could ever
read it**. Closing that gap would take either a grammar extension or an
aggregating builtin over a collection value — and this project has already
decided that new calc capability ships as declarations plus context overrides,
never as grammar extensions, stateful builtins, or a widened `CalcResult.value`.

That constraint does not forbid a ledger. It does mean a ledger buys less than
it appears to, which changes what it is worth paying for it.

### A correction this decision rests on

Format §4.25 and §4.26 both currently claim that cells of these structures
"remain addressable by ordinary path traversal," citing
`lease_up_schedule.schedule[5].rent_revenue` and `cash_flow_series.series[3].amount`.

**Neither expression parses.** Both raise `CALC-PARSE-001` against the current
engine. A plain path such as `lease_up_schedule.occupied` parses fine; the
bracket is what fails.

This matters here because the sentence is the main reason to believe a
variable-length array stays reachable from formulas. It does not. Any
implementing RFC should correct both passages in the same change, and the
correction is the cheap half of this work.

## The three things are not one thing

| Quantity | Shape | Where it belongs |
|---|---|---|
| Escalation schedule, break/termination option, co-tenancy, renewal options, guarantees, CAM cap | **Attribute of a lease.** Time-invariant: the clause is in the document whether you look in month 3 or month 40. | The lease record it describes. |
| TI/LC outstanding balance | **Rolls forward.** A balance is point-in-time, but the interesting thing is its path. | A period series. |
| CAM true-up, free-rent burn-off | **Inherently periodic.** An annual reconciliation is an event in a year. | A period series. |

The roadmap phrase bundles all three under "ledger." Only the bottom two are
periodic. Forcing the clauses into a period series would restate an unchanging
fact once per month, which is the kind of redundancy that drifts.

## Options

### A — Widen the rent roll

Add typed clause fields *and* time-series fields to each unit/tenant record.

Rejected for the time-series half. `rent_roll` carries an `as_of_date`; it is a
snapshot. RFC 0008 created `lease_up_schedule` precisely because "`rent_roll` is
a snapshot in time and `noi_model` a stabilized projection; the path between
them ... is the entire thesis." Putting a multi-year escalation path inside the
snapshot re-conflates what that RFC separated.

There is also a timing argument: `rent_roll` is being joined to
`MULTI_VARIANT_SECTIONS` on a parked branch, a change whose own commit message
counts 33 breaking consumer sites. Widening the same section concurrently
compounds that.

### B — One new `lease_ledger` section

A lease × period section, state-and-verify, modeled on `lease_up_schedule`.

Rejected **for now**, on cost rather than principle:

- It is unaddressable from formulas, per the constraint above.
- The authoring burden is real: fifty tenants over sixty months is three
  thousand stated rows, every one of which a verifier must recompute.
- **No consumer exists.** This project has already learned what that produces —
  a module system shipped whose loader registered modules that nothing ran, and
  the gap hid because every fixture tested loading and none tested effect. A
  ledger with no reader is that failure mode with a larger fixture.

### C — Split by shape (recommended)

1. **Type the lease clauses in place**, on the commercial rent roll's tenant
   record. The stubs are already there and already untyped:
   `escalation_schedule`, `termination_option`, `co_tenancy_details`,
   `ti_allowance_original`, `ti_outstanding_balance`, `cam_cap_pct`. This is the
   RFC 0053 move — type the documented stub, verify what the prose already
   asserts — and it needs no new section. Add the LC balance the roadmap notes
   is missing beside the TI one.
2. **Correct the §4.25 / §4.26 addressability claim** in the same change.
3. **Defer the periodic series** until something reads it. When it arrives, it
   is a period-addressed sibling of `lease_up_schedule`, not a widening of the
   rent roll — the roadmap's instinct was right about the *container*, just
   applied to the wrong contents.

Option C unblocks the Wave 1/2 "lease clauses and TI/LC amortization" item,
which is the thing actually waiting on this decision, without building a
three-thousand-row structure nothing consumes.

## What this RFC does not decide

- **Any field shape.** Typing the clauses is a separate RFC with its own
  vocabulary and validation codes.
- **Straight-line TI/LC amortization.** The roadmap pins it on this decision;
  the answer is that amortization is periodic and therefore belongs with the
  deferred series, not with the clause typing.
- **Whether the calc grammar should ever address collections.** Out of scope
  and, on current rules, out of bounds.
- **Per-lease monthly ledgers for residential.** The commercial rent roll is
  where the clause stubs exist; multifamily is unit-level and month-to-month and
  has no equivalent need demonstrated.

## Acceptance

**Accepted 2026-09-15.** The clause typing proceeds on the rent roll and the
periodic ledger waits for a named consumer.

The §4.25 and §4.26 correction lands with the implementing RFC, because those
sentences are untrue today regardless of which option had won.
