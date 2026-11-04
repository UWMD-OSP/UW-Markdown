---
rfc: 0132
title: Separate physical and economic occupancy
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

# RFC 0132: Separate physical and economic occupancy

**Proposed — unaccepted.** Project-owner acceptance or revision is required.
The current standard is unchanged by this proposal-only PR.

## Summary

Physical occupancy and economic occupancy are separately named metrics. Unknown input remains unknown with a reason, and an explicitly stated zero remains zero. Neither metric supplies the other.

## Motivation

`rentroll.ts` currently infers occupied commercial area only from positive rent, and a null multifamily mix occupancy defaults to full occupancy. These choices collapse physical use, current rent and missing information. A zero-rent occupied suite is a concrete distinguishing control.

## Proposed change

### Proposed rules

- The source contract MUST distinguish `physical_occupancy_pct` from `economic_occupancy_pct`; neither is a substitute for the other. Rates remain fractions.
- Physical occupancy MUST use the existing accepted class-specific physical numerator and capacity denominator, on one declared as-of date or measurement period. Positive rent MUST NOT by itself determine physical occupancy.
- Economic occupancy MUST name its income/collection basis, period, numerator and denominator. A reference implementation MUST NOT select a universal economic formula from a field label or assume that contractual rent, collected cash and market potential are interchangeable.
- Missing, null, structurally invalid or unresolved required input MUST yield an unavailable result with an explicit reason. A producer MUST NOT default that state to zero or full occupancy.
- An explicit measured zero MUST remain zero; it MUST NOT trigger a fallback or be confused with missing data.
- A stated physical value MUST NOT populate an absent economic value, or the reverse. Reader and full-carrier round trips MUST preserve both names, explicit nulls and stated unavailability reasons.

### Proposed evidence

Each evaluated metric should expose `{value, reason}` where `value` is a finite fraction or null and `reason` identifies a missing prerequisite when unavailable. The wire location and closed reason vocabulary require review. Existing class size selectors, period rules and physical occupancy definitions remain the precedents; this draft changes no dictionary entry by itself.

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

`rentroll.ts`, class dictionary/pack declarations, the editor and Excel layouts require synchronized explicit measures after acceptance. Hotel sold-room-night occupancy and other existing class definitions must retain their stated bases until a reviewed mapping identifies them. This proposal does not generate a free-rent schedule.

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

Choose the economic occupancy basis or closed set of bases before adding a dictionary formula: contractual rent versus potential, collected cash versus potential, and concessions/credit treatment are distinct conventions. Also settle the unavailable-result carrier and the physical treatment of notice/holdover/model/down states for each affected class.

## Prior art

The current metric dictionary's explicit-input and null rules, Protocol VIII.5
reporting quantum, and the existing schema/validator code-ownership discipline
are the primary precedents. RFC 0092's explicit basis/selection and unavailable
assertion evidence provide the closest in-repository design example.
