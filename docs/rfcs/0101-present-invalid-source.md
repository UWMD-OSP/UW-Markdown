---
rfc: 0101
title: Refuse every present source value outside the actor grammar
status: accepted
author: claude-code
created: 2026-10-20
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0101: Refuse every present source value outside the actor grammar

> **Accepted by the owner, 2026-10-19** (Jared on #413: "accept your proposed
> disposition (any present value outside the §2.6 grammar is SRC-01; null is
> SRC-01 plus the retained warning)"). The RFC, its decisions and the
> implementation land together.

## Summary

Format §2.6 already says an out-of-grammar `_meta.provenance.source` is `SRC-01`.
The reference skipped every value that was not a non-empty string, so `""`, `0`,
`false`, `[]` and `{}` validated clean, and `null` drew only the completeness
warning. This RFC states the rule for those values, and the reference now applies
it: every **present** value outside the grammar is `SRC-01`. `null` is `SRC-01`
and keeps its existing `META_FIELD_MISSING_SOURCE` warning. Absence alone is
unchanged.

## Motivation

#413 (found certifying the independent Python implementation, #354):

| `provenance.source` | Reference before | Python | This RFC |
|---|---|---|---|
| absent | `META_FIELD_MISSING_SOURCE` | same | unchanged |
| `""`, `0`, `false`, `[]`, `{}` | nothing | `SRC-01` | `SRC-01` |
| `null` | `META_FIELD_MISSING_SOURCE` | `SRC-01` | `SRC-01` + `META_FIELD_MISSING_SOURCE` |

A record whose actor is `""` validated clean, though edit policies (Protocol
§V.3) resolve on that field.

## Proposed change

Format §2.6 gains one sentence after "An out-of-grammar source is `SRC-01` (error)":

> Any present value outside this grammar is out of grammar, including a
> non-string, the empty string and `null`. A `null` source also keeps its
> existing `META_FIELD_MISSING_SOURCE` warning, because a new allocation never
> silently removes an existing finding (RFC 0094). An absent source is not
> `SRC-01`; it stays with the completeness warning.

`_overrides[].source` already refuses non-strings with `SRC-01` and is unchanged.

## Compatibility analysis

Documents stating a non-string, empty or null source now fail validation. That is
the defect. No corpus or example states one. The Python implementation already
emits `SRC-01`; it adds the retained `null` warning on the #354 branch. No version
is allocated (RFC 0091 D6).

## Conformance impact

New `conformance/source/06-empty-source`, `07-null-source` (also requires
`META_FIELD_MISSING_SOURCE`) and `08-nonstring-source`, indexed as `verifier`.

## Reference implementation

`validator.ts` `checkSourceVocabulary`: skip only an undefined source; emit
`SRC-01` at `_meta.provenance.source` for any other non-string or empty value.
Tests: `validator.src.test.ts` (six refused values, null with its warning,
absence unchanged).

## Alternatives considered

- **Null as absence only** (the reference's old reading). Rejected by the owner:
  a stated `null` is a present value outside the grammar.
- **Drop the warning for null.** Rejected: RFC 0094's rule keeps an existing
  finding when a new allocation also applies.

## Unresolved questions

None.

## Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Non-string / empty | `SRC-01` | §2.6 grammar; owner ruling |
| D2 | `null` | `SRC-01` plus the retained `META_FIELD_MISSING_SOURCE` | Owner ruling; RFC 0094 retention |
| D3 | Absent | Unchanged (warning only) | Absence is completeness, not grammar |

## Prior art

RFC 0094 of this project (present-invalid metadata leaves; retained warnings).
