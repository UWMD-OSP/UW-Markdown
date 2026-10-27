---
rfc: 0118
title: Refuse closed frontmatter values outside their vocabularies
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0118: Refuse closed frontmatter values outside their vocabularies

## Resolution

The UWMD maintainers accepted closed-vocabulary validation for frontmatter on
2026-10-22, including `status` and `recommendation`. Out-of-vocabulary values
are errors, consistent with other closed vocabularies and the existing
initialization refusal (#503). This resolves the missing validation reported
in #492.

## Summary

Format §2.2 gives frontmatter `deal_stage` seven values and `tier` two
(`screener`, `analyst`). Validation never checks either. A record stating
`deal_stage: bogus` validates with warnings only, and `stage_readiness` and
`DQ-06` then read an undefined stage. `asset_class` is the precedent: a value
outside its vocabulary is `INVALID-ASSET-CLASS-001`, an error. This RFC treats
`deal_stage` and `tier` the same way.

## Change

1. **`INVALID-DEAL-STAGE-001` (error).** A stated `deal_stage` that is not one of
   the seven §2.2 values: `scope`, `screening`, `term_sheet`,
   `full_underwrite`, `credit_approval`, `closing`, `monitoring`.
   - The check reports at `frontmatter.deal_stage`.
   - Stage readiness still computes, and `DQ-06` does not run for an invalid
     stage, so no gap list is reported against a stage that does not exist.
   - An absent `deal_stage` keeps its current meaning: no declared stage, and
     not a finding.
2. **`INVALID-TIER-001` (error).** A stated `tier` that is not `screener` or
   `analyst`. An absent `tier` is not a finding.
3. **Format §2.2** says both fields are closed vocabularies and names the codes.
   The code taxonomy (Protocol §III.6a) registers them.

## Validation impact

A record with an
out-of-vocabulary stage or tier now fails validation. The shipped examples and
fixtures use valid values; the implementation PR checks them all.

## Conformance impact

New malformed documents:
- `deal_stage: bogus` gives `INVALID-DEAL-STAGE-001`, and no `DQ-06`;
- `tier: bogus` gives `INVALID-TIER-001`;
- a non-string `deal_stage` (`3`) gives `INVALID-DEAL-STAGE-001`.

No existing expected output changes.

## Reference implementation

Format §2.2; the Protocol code registry and `protocol.ts`; the validator; the
Python validator; the cases. `uwmd init` already refuses both (#503).

## Alternatives considered

- **A warning.** An unknown stage would still drive readiness and `DQ-06`
  silently. Rejected; the ruling chose an error.
- **One frontmatter-vocabulary code for both fields.** This is fewer codes, but
  `asset_class` set the per-field pattern. Not proposed; see D1.

## Owner extension, 2026-10-22

The UWMD maintainers accepted the RFC and directed the same vocabulary checks for
`status` and `recommendation`. `INVALID-STATUS-001` and
`INVALID-RECOMMENDATION-001` are errors at their frontmatter fields. Status
admits `draft`, `in_progress`, `complete`, `flagged`, `archived`; recommendation
admits `pending`, `approve`, `approve_with_conditions`, `decline` and null.
Absent/null values remain unstated; values are never coerced or trimmed.
Current positive fixtures using undocumented `under_review` are authored with
`in_progress`; explicit invalid-value controls remain invalid.

## Decisions

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Codes | `INVALID-DEAL-STAGE-001`, `INVALID-TIER-001` | The `INVALID-ASSET-CLASS-001` pattern. Alternative: one shared code |
| D2 | Severity | Error | The ruling (option 1) |
| D3 | Readiness with an invalid stage | `stage_readiness` computes; no `DQ-06` | DQ-06 names gaps at the declared stage, and an invalid stage declares none |
| D4 | Absent values | Not a finding | As today |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0003 / Format §2.2a (`INVALID-ASSET-CLASS-001`); RFC 0028 (`DQ-06`);
  RFC 0108 (the seven `deal_stage` values); #492 and #503.
