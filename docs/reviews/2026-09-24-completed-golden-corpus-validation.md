# Completed Golden Deal corpus: current-contract validation

Date: 2026-09-24 UTC

## Baseline and privacy

Validation targeted UWMD commit `ecc8bfc416c1119021e993d2ebc8d89b403c550b`:
Format 2.0, Protocol 2.17.0, core/CLI 2.13.0. Both the canonical checkout and
the designated Codex worktree were clean before testing. The Codex worktree
was fast-forwarded to that commit. This report changes documentation only.

The completed private corpus was independently pinned by its commit and workbook
hashes in the local evidence bundle. No source model, baseline, or private
reference document was modified. This public record contains no property names,
addresses, identities, workbook contents, private paths, or investment values.
The September 21 release comparison remains a historical result for its frozen
corpus; its counts and evidence blockers are not current-corpus claims.

## Source health and existing suite

The inventory contains eight underlying deals, two monthly derivatives, one
synthetic control and one source/parser negative case. One deal has separate
raw-evidence refusal and sponsor-underwriting roles.

- All ten source workbook hashes agree with their Artifact B anchors. All 6,071
  workbook-backed assertion values match cached cells, with no null assertions
  or native formula-error cells. With the control, the corpus has 6,099 assertions.
  Cache agreement is not an independent recomputation of every model.
- All 11 existing raw-source manifests match. The synthetic control has no
  raw-source manifest; the blanket manifest command reports that absence.
- The existing coverage and dated-workbook self-checks pass (33 and 61 checks).
  Both covered monthly derivatives pass all 12 existing coverage checks. Four
  existing independent audits pass: 2,732 checks on a retail workbook, 1,742
  on the development workbook and 1,715 each on a selected monthly sponsor
  workbook and its derivative.
- The existing UWMD harness has eight registered cases: four pass, four stop
  at stale crosswalk counts. The passing cases cover 172 Artifact B assertions
  and all 20 refusal assertions. The other 468 registered assertions are not
  evaluated. Five case roles, with 5,459 assertions, remain outside that suite.
- The registered assertion counts sum to 640, but the harness's aggregate
  expectation still says 608. Neither is the old release's 532. The four stale
  crosswalks must be rebuilt from current economics, not merely padded.
- No current crosswalk carries a `baseline_defect` disposition. The historical
  six release exceptions must not be carried forward as current exceptions.

These failures are source-to-reference maintenance gaps, not financial failures
of the current UWMD implementation. Passing the raw-evidence refusal case proves
its declared refusal contract; it does not independently prove the adequacy of
its diligence gap list.

## RFC 0045 qualification

The claim that every available model is annual is now contradicted. Two
explicitly covered monthly derivatives exist. Neither qualifies for successful
assembly under the current contract without changing source semantics:

| Candidate | Source evidence | Current result |
|---|---|---|
| Monthly operating derivative | Complete monthly components, explicit zeros, currency and cash dates | `CALC-CF-ASSEMBLY`, `date_horizon`: disposition is the first day after the final source month. Protocol VIII.9.6.5 requires it inside that month. |
| Monthly covered-land derivative | Complete monthly components plus separate property and financing reserves | `CALC-CF-ASSEMBLY`, `coverage`, at `plan.assertions.reserve_spending_excluded`: the source charges gross reserve-funded TI/LC and separately releases reserve cash. VIII.9.6.4 expressly refuses that bundle. The same final-period date boundary also applies. |

No date was shifted, extra period fabricated, or reserve-funded spending hidden
to produce a passing assembly. No successful real-deal RFC 0045 assembly is
claimed. Annual cash-flow models, portfolio-level aggregation and the mixed-grain
investment schedule require separate qualification; monthly lease support alone
is not a complete dated property ledger.

Existing `inspect-property-cash-flows`, `project-lease-up`, `assemble-property`
and `verify-cash-flows` commands were exercised on local derivative files.
Both RFC 0044 projections passed, preserving 60 and 18 source periods, exact
cash dates, copied bundle amounts and matching semantic envelope digests.
The derived bundles were computed deterministically from retained source
components; this verifies projection, not independent leasing economics.

The RFC 0034 verifier passed 14 stated metric claims across eight dated series,
including mixed monthly/annual investment cash, monthly diagnostics, and stated
property/equity cash. Comparison used the existing currency/rate/ratio quanta
(2/6/4 decimals). These are verifier results over stated rows, not proof of
property assembly, financing generation, or factual underwriting accuracy.

## A cross-surface validation conflict

Same-day supplemental rows produce whole-document `PS-02` errors. This is not
caused by proprietary inputs: the existing public fixture reproduces it:

```sh
npm run cli -- validate conformance/property-cash-flow-assembly/valid-same-day/deal.uwx.md --json
npm run cli -- assemble-property conformance/property-cash-flow-assembly/valid-same-day/deal.uwx.md conformance/property-cash-flow-assembly/valid-same-day/plan.json --json
```

The first reports duplicate-period errors; the second succeeds. Format 4.26
CF-02 permits same-day rows and forbids merging them, while Protocol VIII.2a
requires `PS-02` for every duplicate registered period identity. RFC 0045
preserves separate rows and expects ambiguous date selectors to refuse.
Implementation follows both rules. This is a normative interaction and
cross-surface conformance gap, not an unambiguous implementation fix.

A narrow RFC candidate should distinguish legal ledger multiplicity from
ambiguous selector lookup, retaining row identity and `CALC-PERIOD-002` for
ambiguous date selection. No validator severity, schema, or protocol rule was
changed in this evidence pass.

## Broader findings and candidate boundaries

- Commercial escalation, renewal, free-rent, TI/LC and recovery assumptions
  now have concrete source consumers. `LSE-NN` types clauses but does not
  exercise them; `REC-NN` verifies closed-period true-ups rather than forecasting
  future recoveries. A passing evidence crosswalk is not a leasing engine.
- `ESC-NN` can state escrow funding but does not roll balances forward. Two
  source models explicitly expose reserve contributions, draws, releases and
  ending balances. Any reserve consumer must distinguish owner transfers from
  internal spending and preserve the unlevered boundary.
- Renovation budgets and cash exist; expense-targeted savings are not established
  merely by the presence of renovation. No new hedge, preferred-equity,
  waterfall, investor-income-tax or post-sale consumer was demonstrated.
- Existing tax/reassessment and abatement fields can state and verify inputs;
  jurisdiction eligibility and future assessment policy remain assumptions.
- Existing generic dated series represent stated levered cash and mixed grain.
  Debt generation, refinancing and payoff assembly need their own bounded
  contracts. They must not be imported into RFC 0045 implicitly.
- Affordable-rent constraints and rollover warrant adopter/profile investigation,
  using the source assumptions already selected. Private StackUW field gaps
  are not automatically UWMD gaps. The format already has `land`; the corpus's
  generic claim that no land class exists does not apply to current UWMD.
- RFC 0054's deferred ledger and RFC 0060's tranche-class decision remain intact.
  No collection iteration, tranche enum change, or full normative RFC was added.

The highest-value next UWMD task is the narrow same-day validation RFC and its
cross-surface acceptance test. Terminal-boundary settlement and reserve
roll-forward are separate evidence-backed candidates, not part of that fix.
Private reference refresh is also necessary before reusing the broad suite as
current-corpus release acceptance.

## Verification

On the baseline implementation: `npm ci --ignore-scripts` and `npm run build`
passed; `npm test` passed 2,433 tests across 138 files; `typecheck:tests` passed;
default `conformance` passed 589 checks; `conformance:profiles` passed all three
profiles (161 checks and 67 declared capability skips); `validate-schemas`
passed 46 compilations; `verify-codes` passed 221 checks. `lint`,
`verify-indexes`, `verify-versions`, `verify-lockfile`, `verify-packages` and
`verify-release` passed. No publish or OIDC configuration change was attempted.
`npm --prefix tools/docs-site run build` also passed after registering this
review in the existing page/link map. Final lint, index and whitespace checks
passed. Full command output is retained in the private local evidence bundle.
