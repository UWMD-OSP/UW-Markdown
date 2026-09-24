---
rfc: 0062
title: Permit same-day cash-flow rows while refusing ambiguous selectors
status: draft
author: codex
created: 2026-09-24
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0062: Permit same-day cash-flow rows while refusing ambiguous selectors

## Summary

Separate document validity from selector uniqueness for the existing
`cash_flow_series.series` registry entry. Legal same-day rows remain separate
and do not emit `PS-02`; an ordinary date selector refuses
`CALC-PERIOD-002` when its requested date matches multiple rows, while a unique
date in the same series resolves normally. The four other registered series
keep their existing duplicate rules.

This is a proposed normative reconciliation, not an implementation bug fix.
**Owner acceptance remains pending.** Jared selected **Protocol 2.17.1 —
normative errata** during review on 2026-09-24. The working-tree implementation,
protocol mirrors and conformance are prepared for review; this draft has not
been accepted and nothing is released. No schema or public type changes.

## Motivation

The released requirements conflict:

- [Format §4.26, CF-02](../../spec/UW_FORMAT_SPEC_v1.md#426-cash-flow-series)
  permits equal dates, forbids merging same-day rows and retains row identity.
  [RFC 0034](0034-calendar-anchored-cash-flows.md) supplies the dated verifier;
  Protocol §VIII.9 operates on these source rows.
- [Protocol §VIII.2a](../../spec/UW_PROTOCOL_v1.md#viii2a-explicit-period-addressing-rfc-0041)
  registers this same series but requires a `PS-02` error for every duplicate
  canonical identity. Its resolver also refuses **any** duplicate identity in
  the entire selected series before looking up the requested date.
  [RFC 0041](0041-period-indexed-addressing.md) records those requirements.
- RFC 0044 / Protocol §VIII.9.5 preserves same-day projected rows and says date
  selectors retain duplicate-date ambiguity. RFC 0045 / §VIII.9.6 retains
  separate property cash components and source-index bindings.

The [completed-corpus review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
demonstrated the interaction. No private data is needed to reproduce it:
`conformance/property-cash-flow-assembly/valid-same-day` assembles successfully
but its source document emits three `PS-02` errors.
`conformance/cash-flow/verify-same-day-flows/case.json` verifies successfully;
wrapping its identical payload in a document emits `PS-02`.

Against the latter payload at commit `17749ed`, both the repeated
`2026-03-17` selector and the unique `2031-03-17` selector refuse
`CALC-PERIOD-002`. The second result proves that merely suppressing validation
is insufficient. The proposal changes the whole-series refusal scope for
ordinary cash-flow selection as well as the document verdict.

## Proposed change

### Document validity

For `cash_flow_series.series`, multiple rows MAY have the same valid ISO date.
They MUST remain distinct. An implementation MUST NOT merge, net, reorder or
collapse rows merely because dates are equal. Equal dates alone MUST NOT
produce `PS-02`. Existing CF-01, CF-02 and CF-03 requirements remain in force,
including finite amounts, valid calendar dates and non-decreasing ordering.
PS-01 still reports malformed registered period data; PS-03 is unchanged.

### Ordinary date selection

A selector `cash_flow_series.series@<date>.<leaf>` MUST inspect the source
series and require a unique row at the requested canonical date. Two or more
matching rows MUST refuse with the existing `CALC-PERIOD-002`. It MUST NOT
choose first or last, sum rows, or infer intent from kind, label, amount or
position. A unique requested date MUST resolve even when other dates repeat.
Absent dates, absent/null sections or series, and incompatible selector kinds
retain the existing null behavior; malformed source periods still refuse.
Section/variant selection, full-path overrides, safe traversal and scalar
quantization remain unchanged.

The exception MUST NOT relax document or selector duplicate rules for
`dcf.annual_cash_flows`, `noi_model.projections`,
`lease_up_schedule.schedule` or `distribution_waterfall.stated_schedule`.
For those series, any duplicate canonical identity still invalidates the
whole series for selection, including selection of a different unique period.

Rows remain individually addressable only through existing legitimate
identity-preserving surfaces, such as declared cash-flow metric row bindings
and RFC 0045 source-index mappings. No numeric-index calc grammar is added.

### Whole-column Excel boundary

`resolvePeriodColumn` currently projects a complete identity-keyed column for
RFC 0043 contextual bindings. It MUST continue to refuse duplicate identities
rather than silently dropping same-day rows from its map. This draft does not
authorize a duplicate-key workbook binding or change §VIII.2c's whole-column
validity guard. Unique scalar lookup and acceptance of a whole workbook column
are distinct contracts. Ordinary selector tests must not be used to claim a
new Excel export capability. Full-series duplicates remain visible to the scan.

## Compatibility analysis

No source data shape changes. Existing valid unique-date documents lose no
capability. Format-legal same-day ledgers gain a consistent document verdict
and unique-date scalar lookup; repeated-date lookup still refuses. Readers
and validators adopting the reconciled protocol must stop emitting the
cash-flow-only PS-02 error. Editors retain byte/order preservation. Calc hosts
must narrow only this series' ordinary selector refusal scope. Agent hosts
inherit the lower-tier requirements. Module manifest shapes and other period series are unchanged. As with an
explicit protocol pin, a module requiring exactly 2.17.0 must opt into 2.17.1
(or an appropriate compatible range); the default supported-version list now
names the errata version rather than advertising both contradictory contracts.

This changes required observable behavior of released implementations.
Conformance to the old contradictory rules is not silently relabeled:
version treatment must be settled before adoption. Absent cash-flow sections
and legacy unique-date sections behave unchanged. No migrations, inferred
dates, new financial formulas, defaults or tolerance changes are introduced.

### Version treatment selected by the owner

Protocol §0.3 requires a bump for any normative required-behavior change.
`conformance/README.md`, “Regenerating expected outputs,” requires a protocol
bump when expected normative output changes. Released Protocol 2.17.0 pairs
with core/CLI 2.13.0. The repository's minor-version rule says requirements
strengthen monotonically, yet the old rule requires an error that this
reconciliation forbids; that rule does not mechanically settle the bump.

RFC 0061 was editorial (labels only); core 2.6.1 restored an existing required
behavior without changing the protocol; RFC 0036 introduced normative behavior
with a protocol minor. None determined this released contradiction. The
CHANGELOG's older “Versioning” anchor referenced by VERSIONS does not currently
exist. The task paused for an owner choice rather than inventing policy.

**Jared chose Protocol 2.17.1 as normative errata**, rather than 2.18.0 as a
normative feature change. This explicitly acknowledges both the changed PS-02
verdict and unique-date resolver behavior; it does not claim byte-identical
results or automatic compatibility with both contradictory old requirements.
This is a narrow errata precedent, not blanket authority to put new protocol
features into patches.

The executable constant, checked protocol labels, current source matrix and
receipt-issuance protocol labels move together to 2.17.1. VERSIONS and the
Unreleased changelog distinguish this unaccepted source proposal from published
core/CLI 2.13.0 and Protocol 2.17.0. Format remains 2.0. No package version,
dependency, lockfile, tag or publication changes. Choosing the version did not
accept this RFC.

## Conformance impact

Add a minimal public full-document scenario under `conformance/cash-flow/`
using synthetic rows with one repeated date and one unique date. Pin together:

1. Parsing and full validation: no errors and no CF/PS diagnostics for legal
   data; compare source rows before/after to prove no merging or reordering.
2. Cash-flow verification of the same preserved rows.
3. The repeated-date selector returns `CALC-PERIOD-002`.
4. The unique-date selector returns its stated amount in that same document.
5. An absent date remains null.

Extend the existing full-document cash-flow runner narrowly to execute optional
selector expectations and row-preservation expectations on that same parsed
document. Add a negative-control scenario for another registered series that
still emits `PS-02` and refuses `CALC-PERIOD-002`, including selection of a
different unique period. Preserve the existing
`tier-3-calc-host/fixtures/period-07-duplicate` result.

Strengthen the existing public RFC 0045 same-day case to check the absence of
PS-02 while retaining its existing assembled row/binding expectations. The
unrelated LU-04/CC-14 warnings in that source fixture are not suppressed.
No private workbook data enters conformance.

## Reference implementation

The public `PeriodSeriesEntry` type and its closed JSON Schema already describe
the five frozen series. The cash-flow payload schema explicitly permits
same-day rows; no schema change is needed.

The proposed implementation checks the existing registered path narrowly in
`period-validation.ts` and `period-path.ts`, with comments referencing this
RFC. A registry policy field would change an exported type and schema to model
one known exception; it is unnecessary here. Do not create another registry.

- `scanPeriodSeries` keeps reporting all duplicate canonical identities.
- Document validation omits only cash-flow duplicate-date PS-02 diagnostics.
- `resolvePeriodReference` checks the requested identity for cash-flow
  duplicates; all other series retain whole-series refusal.
- `resolvePeriodColumn` retains its whole-column refusal.
- `protocol.ts` remediation copy describes the narrowed PS-02 scope.
- No new public type, function, enum, error code or schema field is needed.

Updated Protocol §VIII.2a's selection and validation paragraphs and clarified the
existing Format §4.26 row-addressability statement with a reference to unique
date selection. The executable validation-code description, period-addressing
wiki and living status are updated together. Historical RFC 0034/0041 release
statements are preserved and link this reconciliation as a proposal.

Focused tests must cover scanner duplicate reporting, every active variant,
malformed-date/CF retention, repeated versus unique selectors, missing and
kind-mismatched selectors, all four unaffected registry entries, overrides,
source non-mutation, exact row order and whole-column refusal. Build and run
focused tests before the full repository gates and independent new-fixture
execution. Existing financial algorithms, tolerances and Excel formulas do
not change.

### Prepared implementation verification

The new period tests first recorded six failures against the old behavior;
after reconciliation, 289 focused tests pass. Full workspace tests pass:
2,451 across 138 files. Default conformance passes 591 checks (including the
two new scenarios); the focused cash-flow/assembly suites pass 43. All three
profiles pass (161 checks, 67 declared capability skips). Schema validation
passes 46 compilations and the emitted-code guard passes 221 checks.

Build, test typechecking, lint, index/version/package/lockfile/release guards
and the documentation build pass. The two new scenarios were also executed
independently: clean same-day document and verified metrics, repeated-date
refusal, unique-date success, missing-date null, unchanged rows; the DCF
negative control retains PS-02 and both duplicate/unique selector refusals.
The new positive document also passes the existing CLI validator (exit 0).
An initial duplicate test import detected by lint/typechecking was corrected;
the final checks and the edited test file pass. No schema or financial math
changed. These results do not confer RFC acceptance or constitute a release.

## Alternatives considered

1. **Merge/net same-day rows:** destroys component identity, provenance and
   reserve/acquisition distinctions; explicitly violates CF-02.
2. **Make same-day rows globally invalid:** contradicts RFC 0034 and legal
   acquisition/draw/assembly consumers.
3. **Choose a row by array order:** silently invents selector intent; row
   reordering would change the selected financial fact.
4. **Add row-index calc syntax:** outside RFC 0041's grammar and this task.
   Existing source-index binding surfaces do not authorize numeric indexing
   in arbitrary calc expressions.
5. **Relax duplicates for every registered series:** there is no evidence or
   normative authorization for other series; repeated NOI years, lease
   periods and waterfall statement dates remain protected.
6. **Only suppress PS-02:** leaves unique cash-flow dates unselectable whenever
   another date repeats; does not meet the proposed selector contract.
7. **Discard duplicate rows in the scanner:** makes first-match lookup appear
   unique and breaks whole-column safety. Preserve duplicate observations.

## Unresolved questions

Jared must accept, request changes to, or reject the RFC. The 2.17.1 errata
choice is already recorded and does not need to be asked again. Status remains
`draft`; the tested implementation does not itself constitute owner acceptance.
Terminal settlement, reserve rollforward, levered assembly and any other
protocol feature are excluded.

## Prior art

RFC 0034 defines a ledger of individual flows; RFC 0041 defines identity-based
selection; RFCs 0044/0045 preserve same-day projection/assembly rows.
RFC 0043's guarded whole-column Excel binding remains a separate consumer.
These existing repository contracts supply the required semantics without a
new date primitive or error family.
