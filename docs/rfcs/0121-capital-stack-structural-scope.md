---
rfc: 0121
title: Bound CS-01 to tranche identities and required members
status: draft
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0121: Bound CS-01 to tranche identities and required members

## Recommendation

Accept the owner-approved narrow reading of Format 4.24: CS-01 owns the four
required tranche members and their identity constraints. This draft makes that
boundary explicit; it does not add whole-schema validation.

## Proposed contract

CS-01 MUST check tranche object admission, the required own members `id`,
`class`, `position` and `amount`, their existing Format-defined types/domains,
and uniqueness of id and position within the selected stack. The current
closed class vocabulary and integer position rule remain authority. Missing,
null or wrongly typed required members remain malformed; no numeric domain is
invented or relaxed by this clarification.

CS-01 MUST NOT stand for every JSON Schema failure in a tranche. Coupon/class
requirements remain CS-02; split-coupon requirements remain CS-02b; stack
point-in-time remains CS-04; sizing declaration admission remains CS-03;
waterfall attempts retain CS-WATERFALL-UNSUPPORTED. Other independent owners
retain their existing predicates and findings. Do not suppress an independent
finding just because CS-01 also applies.

Apply the same ownership boundary to an admitted builtin component stack under
Format 4.23. Do not infer component admission from an arbitrary extension.

## Decisions proposed

| Question | Recommendation | Precedent |
|---|---|---|
| Does malformed mean all schema failures? | No; the four required members, tranche-object shape and identity uniqueness | The CS-01 sentence immediately follows those members in Format 4.24 |
| Other fields? | Retain their existing code owners and exact conditions | Format 4.24 and RFC 0096 explicitly preserve separate owners |
| Broader schema validator? | Not part of CS-01 | Avoid duplicate/conflicting diagnostics; issue #516 records the ambiguity |

## Implementation and conformance after acceptance

Clarify Format 4.24 and synchronized code/schema descriptions where present.
The current TypeScript and Python narrow reading should remain behaviorally
stable. Add portable controls proving each required-member failure and duplicate
identity, plus valid four-member tranches with independent coupon/sizing defects
that must be reported by their own codes. Check field ownership and counts,
including admitted components. No formula, tolerance or dependency changes.

## Status

Draft for owner review; this PR implements no validator change.
