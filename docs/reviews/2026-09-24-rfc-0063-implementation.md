# RFC 0063 implementation verification

Owner acceptance: Jared accepted `f04b34ab5606264424bddc02b09ced256a09bbcc`
on 2026-09-24 and authorized local implementation. RFC status is **accepted**,
not implemented, until shipped. This record does not authorize push or release.

## Contract and version reconciliation

The closed optional `disposition_period_rule` accepts `within_final_period` or
`allow_exclusive_end`. Omission preserves the prior behavior and serialized
result exactly. Explicit legacy mode adds only the copied plan member. The
opt-in additionally permits the exact representable exclusive calendar boundary
of the final validated monthly or quarterly source period. No later date,
extra source/operating period, coverage cell, proration, inferred timing or
post-sale cash is added. Sale-slot cash remains anchored to disposition.
Reserve, financing, investor-tax and RFC 0062 behavior remain unchanged.

Baseline `f04b34a` contained Protocol 2.17.1, with no intervening protocol work.
The additive accepted implementation prepares **Protocol 2.18.0**, including
RFC 0062's unreleased 2.17.1 errata. Both RFCs remain accepted. Format stays 2.0;
package versions, dependency links, release tags and published artifacts stay
unchanged. Published core/CLI 2.13.0 still implement Protocol 2.17.0.

## Synthetic verification

- All 26 prior assembly fixtures retain exact full results or typed refusals,
  compared with a pre-implementation capture, including source bytes and plans.
  No existing assembly fixture or expectation was changed. The two receipt
  issuance baselines update only their emitted protocol version to 2.18.0;
  all receipt calculation values, digests and package versions are unchanged.
- 59 new synthetic fixture triplets exercise the accepted matrix; the assembly
  suite passes **85/85**. Independent monthly/quarterly inside, boundary, later
  date and year-rollover cases cover absence and explicit legacy refusal.
- Further cases cover leap/non-leap February, leading-zero years, representable
  limits, malformed/gapped/reordered sources, extra mappings/cells, cash outside
  the hold, sale/cost/reserve anchoring, reserve assertions, unsupported financing,
  invalid option shapes and named sale deductions.
- Positive cases pin source identities, deterministic tie order, copied dates
  and amounts, unchanged coverage cells, plan snapshots and source digests.
  Four-metric expectations for both cadences and rollovers were computed with
  the pre-change RFC 0034 engine from independently authored synthetic rows.
- API/schema/browser-safe tests cover own `undefined`, nonfinite reserve cash,
  overflow, exact legacy equivalence, snapshots and ambiguous/unique selectors.
  CLI tests use the existing plan-file command for each cadence. Existing
  RFC 0062 and other-series/Excel protections remain in the regression suites.

## Private Golden Deal probes

Probes reuse the frozen source-attributed inputs from the completed boundary
review. Private paths, identities and financial values remain outside this repo.

| Evidence case | Observed result |
|---|---|
| A: monthly timing-only case | Absent and explicit legacy plans retain the original `date_horizon` refusal. Explicit opt-in assembles 244 distinct cash rows and 426 coverage cells; dates/amounts copy the source, the digest and CLI result agree, sale rows remain anchored, and a disposition one day later refuses. |
| B: monthly reserve-dependent case | All three plan modes retain the original `coverage` refusal at `plan.assertions.reserve_spending_excluded`. Timing does not cure it. |
| Existing projections and stated-series metrics | Both monthly projections are unchanged. All 14 metric claims across eight stated streams retain their original results; input hashes are unchanged. |

Case A's component ledger matches the original netted-period stream's XIRR,
XNPV and total net cash at the existing precision. **MOIC differs.** The existing
RFC 0034 definition divides total positive rows by absolute total negative rows;
retaining component rows presents different gross inflows/outflows than the
source's netted-period representation. This is a comparison limit, not a new
formula or a reason to net rows. No complete model/metric parity is claimed.
Quarterly remains a deterministic calendar generalization, not direct Golden
Deal evidence. The private corpus and original probe inputs were not edited.

## Repository gates

All **14 repository gates pass**: build, tests, default conformance, test
type-checking, conformance profiles, schema validation, lint, indexes, codes,
versions, packages, lockfile, release consistency and docs build. The final
suite reports **2,533 unit tests** and **650 conformance cases**, with all three
capability profiles passing. `git diff --check` passes. No dependency or
lockfile changed, so no install was needed.

The first verification pass exposed stale receipt protocol labels, one runner
lint issue and missing site registration for this review page. Those were
corrected and the affected gates rerun successfully. No financial expectation
was regenerated or relaxed. The 26-case exact legacy comparison and private
Golden Deal probe results are retained in local verification artifacts.
