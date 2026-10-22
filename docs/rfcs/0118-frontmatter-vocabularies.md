---
rfc: 0118
title: Refuse a deal_stage or tier outside its vocabulary
status: draft
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0118: Refuse a deal_stage or tier outside its vocabulary

> **Draft for owner acceptance.** Origin: owner ruling of 2026-10-22 (5), taking
> option 1 on bug bash finding #492: an out-of-vocabulary value is an error, as
> other closed vocabularies are. `uwmd init` already refuses such values (#503).
> This RFC adds the validation rule, which changes what validation reports, so
> it is normative.

## Summary

Format §2.2 gives frontmatter `deal_stage` seven values and `tier` two
(`screener`, `analyst`). Validation never checks either. A record stating
`deal_stage: bogus` validates with warnings only, and `stage_readiness` and
`DQ-06` then read an undefined stage. `asset_class` is the precedent: a value
outside its vocabulary is `INVALID-ASSET-CLASS-001`, an error. This RFC treats
`deal_stage` and `tier` the same way.

## Proposed change

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

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). A record with an
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

## Unresolved questions

- `status` (`draft | in_progress | complete | flagged | archived`) and
  `recommendation` are also enumerated in §2.2 and also unchecked. They were not
  part of the ruling. A follow-up could close them the same way.

## Decisions proposed for owner review

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
