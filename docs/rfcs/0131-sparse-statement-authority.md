---
rfc: 0131
title: Preserve authored sparse-statement aggregates
status: draft
author: UWMD maintainers
created: 2026-11-04
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0131: Preserve authored sparse-statement aggregates

**Proposed — unaccepted.** Project-owner acceptance or revision is required.
The current standard is unchanged by this proposal-only PR.

## Summary

Authored financial aggregates remain authoritative. A subtotal is recomputed only when its entire declared detail is available; absent or null detail is never zero. Complete detail that disagrees with a stated aggregate produces a diagnostic instead of silently replacing the aggregate.

## Motivation

The starter `opstatement.ts` helper excludes nested `total` fields while summing detail. Consequently an aggregate-only `other_income.total=12000` or `utilities.total=6000` becomes zero, and an unrelated editor input can persist the substituted totals. The workbook already retains aggregate-only inputs (`toWorkbook.test.ts`).

## Proposed change

### Proposed rules

- A finite authored aggregate MUST remain the selected source value. A producer MUST NOT silently replace it because detail is absent, incomplete or inconsistent.
- Recalculation MUST require all members of an explicitly defined complete detail set, on the same section, variant, period and basis. Every required member MUST be a finite number. Explicit zero qualifies; absent, null and numeric strings do not.
- A known-empty complete set sums to zero only when that emptiness is explicitly established; an absent collection establishes no such fact.
- With a complete detail set, the independently computed subtotal MUST be compared at the existing applicable reporting quantum. Disagreement MUST be reported with the authored value, computed value, location and basis. It MUST NOT change the source aggregate or claim that the source is accurate.
- Without an authored aggregate, complete detail MAY supply a derived subtotal. Without either, the result MUST remain unavailable with a reason. A dependent NOI/ratio MUST NOT turn that missing prerequisite into zero.
- Source inspection MUST remain read-only. The starter editor MUST preserve authored aggregates during ordinary detail edits and expose disagreements before a user explicitly adopts a recalculated value.

### Completeness boundary

A detail set is supplied by an accepted class/profile definition or an explicit bounded calculation declaration. Merely enumerating whichever numeric leaves happen to be present does not prove completeness. This draft does not invent missing class line registries, a new amount tolerance or a new financial basis. The exact mismatch diagnostic allocation and the initial dynamic utility/other-income completeness declaration remain review questions below.

## Current contract and synchronized changes

This proposal concerns current source/verification and starter tooling, not a
release authorization. Format/Protocol text, schemas, executable contracts and
applicable conformance cases must land together in the eventual implementation.
No package version or published compatibility baseline changes in this draft.

## Conformance impact

Add synthetic positive, wrong-value, absent, null, explicit-zero, invalid-type,
variant-isolation and source-immutability controls at the affected boundaries.
Retain each existing code owner and the independent numeric comparison quantum.
The accompanying proposal tests distinguish executable current prerequisites
from expected-failure acceptance gates; they claim no implementation support.
Existing frozen conformance expectations are unchanged in this proposal PR.

## Reference implementation

`packages/uwmd-core/src/opstatement.ts`, its editor model and workbook handoff need consistent aggregate selection and separate computed/diagnostic evidence. Existing dictionary and native procedures continue to consume explicit stated inputs. The separately scoped starter save guard can land without treating this normative proposal as accepted.

Files to review include the corresponding `packages/uwmd-core/src` helper and
editor tests, `packages/uwmd-verify/src/validator*`, `protocol.ts`, dictionary
bindings where applicable, representation preflights and independent Python
validation. Implementation is a separately reviewed follow-up to this draft.

## Alternatives considered

Silently substituting zero or another metric/value hides unavailable evidence.
Changing only display or only carrier admission leaves inconsistent public
results. Retaining explicit source values plus bounded, separately reported
verification evidence keeps source facts and computed assertions assessable.

## Unresolved questions

Which closed diagnostic family should own a complete-detail mismatch? Which accepted class detail registries or explicit completeness carrier cover dynamic utilities and other income? Acceptance must settle these before a conforming verifier claims the broader subtotal procedure.

## Prior art

The current metric dictionary's explicit-input and null rules, Protocol VIII.5
reporting quantum, and the existing schema/validator code-ownership discipline
are the primary precedents. RFC 0092's explicit basis/selection and unavailable
assertion evidence provide the closest in-repository design example.
