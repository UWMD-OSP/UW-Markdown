# Completed Golden Deal corpus: reconciled current-source validation

Date: 2026-09-24 UTC

## Current result and scope

All eight registered private cases pass: **640 registered, 640 evaluated, 640
passing, zero failing, zero unavailable**, with all 20 existing refusal assertions
passing. A separate stale-workbook package fixture also produces the expected
`PKGZIP-002` refusal. These are comparison results under explicit private rules,
not proof that UWMD independently generates every source-model result.

This record supersedes the intermediate diagnostic review in local commit
`2250568`. The earlier 568/337/231/72 result remains historical evidence.
Validation uses integrated main `e49eb4364efc0a43e7644adc15154ed6fee35aa8`:
Format 2.0, accepted but **unreleased Protocol 2.17.1**, unchanged core/CLI 2.13.0.
Published core/CLI 2.13.0 still pair with Protocol 2.17.0. RFC 0062 remains
**accepted**, not implemented under the repository's release-status semantics.
The [integration CI run](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/35955586528)
passed all 13 jobs. This reconciliation was subsequently integrated and pushed
to canonical main at `dd3029d6125c9d1c7509b9906099bf93af11c034`, without a
tag, publication or release.

No source workbook, Artifact B expectation, raw-source manifest, protocol,
schema, implementation, package version or normative precision rule changed.
Private reference revisions, source values, mappings, identities and paths stay
in the private corpus. Its normal Git history preserves the former references;
a committed inventory and per-assertion ledgers link each former reference,
current frozen source and replacement reference revision.

## Reconciliation and coverage

| Registered comparison results | Before reconciliation | After reconciliation |
|---|---:|---:|
| Registered | 640 | 640 |
| Evaluated | 568 | 640 |
| Passing | 337 | 640 |
| Failing | 231 | 0 |
| Unavailable | 72 | 0 |
| Existing refusal assertions passing | 20/20 | 20/20 |

All 231 prior failures received individual source evidence. Their primary
dispositions are 222 stale-source/reference differences and nine historical
extraction errors: eight child-versus-portfolio NOI bindings and one truncated
cached scalar. The ledger also records changed definitions, calculation recipes
and comparison rules; overlapping findings are not counted as extra failures.

The review followed workbook cell identity, labels, economic scope, formulas and
changed input dependencies. It did not select targets by numeric agreement.
All 72 formerly unavailable assertions have explicit current source cells;
none required an invented expected value, assertion retirement or source-defect
exemption. Named extension evidence preserves concepts without pretending that
a dedicated typed consumer exists.

Across the four refreshed references' 468 assertions, 362 compare stated-source
representations, 98 exercise existing scalar/calculation recipes, and eight
calculate source-defined equity metrics over stated cash periods. Receipt and
round-trip verification do not convert stated-source checks into forecast or
cash-flow-assembly tests.

Specific definition safeguards:

- Cumulative peak equity includes operating shortfalls and remains distinct
  from acquisition equity, total contributions and positive/negative cash
  multiples. Existing scalar grammar can calculate the source-defined metrics.
- Operating inputs and below-NOI roof/turn capital remain separate.
- Acquisition transaction costs remain in unlevered acquisition cash; debt
  issuance costs, refinancing fees and prepayment charges affect levered cash.
- Restriction expiry, year-average turnover conversion, achieved rents and
  reassessment timing retain their source definitions.
- Portfolio NOI is tied to the portfolio row and the sum of both child rows for
  all eight periods. Current child receipts, parent provenance, relationship
  sidecar, package and aggregate rollup verify. The original stale workbook
  digest is retained and rejected in a separate negative integrity fixture.

## Tolerance audit

A debt-yield fraction inherited a generic `0.01` absolute currency tolerance.
That rule could admit a full percentage-point difference and had admitted a
material historical discrepancy. It now uses the corpus's documented 0.1%
relative comparison, which rejects that old result. The private ledger retains
the old rule, unit, definition, actual discrepancy and counterfactual check.

The same defect was corrected in 28 rate/multiple comparisons across three
references, including six in an already-current reference. IRRs use the existing
one-basis-point absolute rule; other affected ratios use 0.1% relative.
Currency tolerances and stricter existing calculation rules remain distinct.
No public precision defect was established, and UWMD's 2/6/4-decimal dated-metric
quantization did not change.

## Remaining current-source discrepancies

There is no surviving mismatch among the 640 registered comparisons and no
new implementation defect demonstrated by this reconciliation. The following
coverage limits remain explicit:

| Class | Current evidence and limit |
|---|---|
| Representation / validation | Named source evidence and generic dated series preserve the selected information. RFC 0062 resolves legal same-day rows while ambiguous date selection still refuses. |
| Deterministic calculation / precision | Registered calculations pass their declared private tolerances; this is not universal spreadsheet equivalence or independent recomputation of cached models. |
| Cash-flow assembly | Two complete monthly sources remain outside unchanged RFC 0045 admission: terminal cash dates fall at the following boundary, and one also contains reserve-funded spending. Correct refusals remain visible. |
| Provenance / integrity | Refreshed artifacts verify; the historical stale-source digest is a verified negative case, not a suppressed failure. |
| Profile / module / adopter choices | Leasing, affordable-rent conversion, future recovery allocation and financing policy remain source-specific assumptions without a demonstrated generic execution contract. |
| Tooling | Crosswalk registration, stale-reference maintenance and unit-inappropriate comparisons were private tooling defects, now reconciled. |
| Potential protocol omission | Terminal-boundary assembly and reserve-account state remain bounded candidates requiring separate decisions; existing refusals are not implementation bugs. |

Five source roles containing 5,459 workbook assertions remain outside the broad
UWMD crosswalk suite. They are inventoried, not counted as 640-suite successes.
No additional real-deal RFC 0045 assembly qualifies merely because the refreshed
broad suite passes.

## Candidate reassessment

| Candidate | Assessment | Evidence and boundary |
|---|---|---|
| Same-day cash rows | Resolved by existing accepted surface | RFC 0062 allows separate same-day cash rows without PS-02; ambiguous date selectors refuse deterministically, unique dates select, other series protections remain. No numeric-index grammar was added. |
| Terminal cash date | Strengthened | Both complete monthly sources place final cash at the immediate next-period boundary. Projection preserves dates; disposition equals that cash boundary, but the existing assembly rule requires disposition inside the final calendar source period. Stated dated-series verification already works. |
| Reserve account treatment | Strengthened as a separate contract | Acquisition funding, periodic contributions, draws, releases and ending balances are explicit in the covered-land and development sources. Replacement reserves deducted in annual NOI are different. Property and financing reserves also remain separate. Gross spending must not be silently netted against reserve releases to pass coverage. |
| Speculative leasing / rollover | Strengthened for bounded adopter/profile work | Selected source assumptions specify renewal probability, new/renewal cohorts, downtime, market resets, different TI/LC bases, concessions and cash timing. Restriction expiry/conversion is another explicit policy. No generic forecasting contract follows from collection iteration. |
| LSE / ESC / REC consumers | Mixed: bounded consumers strengthened; some needs resolved | Lease clauses can state terms; forecasts require explicit cohort rules. Escrow declarations can state funding, while account roll-forward remains separate. Closed-period recovery verification exists; future occupancy/recovery allocation is a distinct candidate. TI/LC cash expenditure is demonstrated, but a general amortization consumer is not. |
| Financing assembly | Strengthened; stated-cash need resolved | Bridge/takeout, fees, paydown and payoff are source-defined. Existing dated-series verification handles stated pretax equity cash; generating that cash from debt terms requires a separate bounded assembly contract. |
| Universal release-parity claim | Weakened | Much of the corpus checks attributable stated outputs. Broad-suite success does not establish independent leasing, financing or reserve generation. |
| Investor income tax / post-sale | Insufficient evidence | Property transfer taxes and assessment assumptions do not establish investor tax. Immediate boundary settlement is not evidence of later post-sale distributions. |
| Hedges / expense-targeted savings / clawback | Insufficient evidence | Renovation and stated financing do not establish these consumers. No requirement was manufactured. |

RFC 0054's deferred ledger and RFC 0060's tranche-class decision remain intact.

## Verification

Private verification passed: 1,294 source-binding, provenance, scope and
adversarial reconciliation checks; 13 diagnostic-overlay tests; 33 coverage
self-checks; 61 dated-workbook checks; the full eight-case suite; all 20 existing
refusals; and the additional stale-source package refusal. All ten workbook
hashes and all 6,071 cached workbook assertions agree with their source anchors.
The control adds 28 assertions to that inventory. Cache agreement is not model
recalculation.

Both monthly coverage rollups pass, as do the development and selected monthly
independent workbook audits. Both RFC 0044 monthly projections and all 14 dated
metric claims across eight series pass. RFC 0045 still correctly refuses
`date_horizon` and `coverage`; no assertion was altered to force qualification.

The public follow-up passes build, tests, test typechecking, default and profile
conformance, schemas, lint, index/code/version/package/lockfile/release checks
and the documentation build. Full outputs remain in the private evidence bundle.

## Single next task

Prepare a narrowly bounded owner-review proposal for **terminal cash settlement
at the final period's exclusive boundary** in RFC 0045, using the two reproduced
monthly cases. Pin dates, eligible terminal components, refusal behavior and
legacy compatibility. Reserve-account and financing assembly remain separate.
The [owner-review brief](../reviews/2026-09-24-terminal-boundary-design.md) now completes this design task. It distinguishes cash after a source-period end
from cash after economic disposition: the reviewed monthly examples demonstrate
the former only. It recommends optional monthly boundary admission with no
post-sale cash interval. Owner scope acceptance remains pending; no RFC or
implementation has been started. The design brief remains local.
