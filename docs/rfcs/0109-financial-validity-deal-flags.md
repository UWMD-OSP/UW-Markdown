---
rfc: 0109
title: Report financial-validity findings as deal flags, not record errors
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0109: Report financial-validity findings as deal flags, not record errors

> **Accepted by the owner, 2026-10-21, as drafted** (owner: "Owner rulings, 2026-10-21. RFC 0107 (#460) accepted with D2 = yes, add quick_metrics.ltc as a second home; D3 = check every stated LTC, not construction only. RFC 0108 (#461) accepted with D2 = yes, align completeness.severity; D3 = yes, replace the four stage names with the seven deal_stage values. RFC 0109 (#462) accepted with D1 = a separate deal_flags list; D3 = institutions list codes one by one in validation_overrides.financial_validity_errors. All other decisions as drafted.").
> Origin: owner ruling of 2026-10-21 (5). The
> owner's reason: an honest underwriting of a weak deal must not read as a broken
> record to the party receiving it. It changes what fails validation, so it is
> normative.

## Summary

Today a DSCR under 1.00x or an LTV over 85% is an `error`-severity issue
(`FV-04`, `FV-09`). It sets `overall_status` to `errors` and makes
`uwmd validate` exit 1, the same outcome as a malformed block or a sources-and-uses
imbalance. This RFC separates the two questions. **Validity** asks whether the
record is well formed and internally consistent. **Deal flags** ask whether the
deal crosses a plausibility band. `FV-NN` findings become deal flags: reported
in their own list, never counted in `overall_status`, the exit status, stage
readiness or receipt counts. An institution configuration MAY raise chosen
codes to errors, and only then do they fail validation.

## Motivation

- **A weak deal is not a broken record.** Format §5.2's error bands describe the
  deal (DSCR under 1.00x means the property does not cover its debt). A lender
  that receives an accurate record of that deal sees `overall_status: errors`
  and exit 1, which every consumer reads as "this record is defective."
- **The current answer, with its citations** (from the 2026-10-20 question): an
  FV error-band finding fails validation (`overall_status: errors`, Format §6.2;
  exit 1, Protocol §II.6a.2), but nothing downstream treats it as a defect. It is
  not a hard gate (`blocking` comes only from `blocking_flags`, Format §3.3).
  Stage readiness ignores it (§5.1). Receipts record and do not block (UW
  Receipt §3). Signing and snapshot authentication exclude financial validation
  (Protocol §V.11, §V.13.2). Only the status and the exit code say "broken," and
  they are the two signals a receiving party reads first.
- **The record already keeps them apart.** Format §4.17 stores
  `financial_validity[]` separately from `cross_section_consistency[]`, and calls
  the section the "deal health signal."

## Proposed change

1. **Format §5.2: findings are deal flags.** A `FV-NN` finding describes the deal,
   not the record. A validator MUST report it in the result's `deal_flags` list
   and MUST NOT place it in `issues`, `errors`, `warnings` or `info`. It MUST NOT
   affect `overall_status`, the exit status, `stage_readiness` or a receipt's
   `validation` counts. Everything RFC 0105 fixed is unchanged: which homes are
   read, one flag per home at the most severe band, and `field` and `section`
   under RFC 0104.
2. **The flag's shape (D2).** A deal flag carries `code`, `section`, `field`,
   `message`, `value`, `threshold` and `band`. `band` is `"error"` or `"warning"`,
   naming the §5.2 column crossed. It has no `severity`, so no consumer counts it
   as an error by reading the usual member.
3. **Institution escalation (D3).** The institution configuration (Format C.6,
   Protocol §VI.3) gains `validation_overrides.financial_validity_errors`: an
   array of `FV-NN` codes. For a listed code, an **error-band** finding is
   reported as an ordinary `error` issue, not as a deal flag, and counts as one.
   A warning-band finding of a listed code stays a deal flag. The member is
   admitted under RFC 0097's strict rules: a present value that is not an array of
   registered `FV-NN` codes is `VAL-INSTITUTION-CONFIG-MALFORMED`.
4. **Protocol §III.6a.** The `FV-NN` row says the family is reported as deal flags
   (Format §5.2) unless an institution configuration escalates a code.
   `ValidationResult` gains `deal_flags: DealFlag[]`, always present and possibly
   empty.
5. **Format §6.2 and the CLI.** `--json` output gains `deal_flags`. Human output
   lists them under their own heading after the validation issues. The exit
   status ignores them.
6. **Format §4.17.** A stored `validation` section records deal flags in
   `financial_validity[]`. Its `overall_status` means what the result's means, so
   it also excludes them (consistent with RFC 0108 D4).
7. **Receipts (D5).** Receipt `validation` counts exclude deal flags; no new
   receipt member.

## Compatibility analysis

No compatibility path (prelaunch; no 5.0 before launch).

- **Records.** No record changes. Records with an FV error-band value stop
  reporting `errors` and stop exiting 1, unless an institution escalates the code.
- **Consumers.** Any consumer reading FV codes from `issues` must read
  `deal_flags`. In the reference that is:
  - the chat and summary renders (`render-chat`, `render-summary`);
  - the web editor's validation panel and sidebar counts;
  - the VS Code diagnostics;
  - the MCP connector's `uwmd_validate` output;
  - the validator page.
- **Institution configs.** Existing configs keep their meaning. The new member is
  optional.
- **Receipts.** A receipt issued before this RFC over a record with an FV
  error-band finding states `validation.errors` including it. Re-issuing gives a
  smaller count. Receipts are prelaunch, so no compatibility rule is added.

## Conformance impact

- `documents/malformed/67-financial-validity-homes`: its rows move from
  `field_issues` to a new `deal_flags` expectation, and its `overall_status`
  becomes whatever the non-FV findings give.
- The documents runner reads a `deal_flags` expectation, compared as a multiset
  like `field_issues`.
- **New cases.** A record whose only finding is an FV error band is `clean` and
  exits 0. The same record with an institution config listing that code is
  `errors` and exits 1. A config listing an unregistered code is refused as
  malformed.
- Baselines that include FV codes are re-derived:
  - `documents/expected/02-full-multifamily.validation.json` and its chat render;
  - `institution-config/20-empty-carrier`, `21-opaque-overflow-paired-scalar`,
    `22-three-flat-overrides`, `24-automatic-adjacent` and
    `28-nested-lookalike-opaque`, whose threshold-override expectations move to
    `deal_flags`.

## Reference implementation

- **Files:**
  - `packages/uwmd-verify/src/validator.ts`: FV findings go to `deal_flags`, with escalation.
  - `types.ts`: the `DealFlag` type and `ValidationResult.deal_flags`.
  - `protocol.ts`: the family note.
  - `packages/uwmd-core/src/institution-config.ts`: admit the new member.
  - `cli.ts`: transport and human output.
  - `receipts.ts`: counts.
  - The renders and tools listed above.
  - Python's `uwmd_validation_cross.py`, `uwmd_institution_config.py` and CLI.
- **API surface:** `DealFlag` and `ValidationResult.deal_flags` (additive);
  `ValidationResult.issues` no longer contains `FV-NN` (behavior change).
- **Test plan:**
  - A weak-deal record is `clean`.
  - Escalation per code, error band only.
  - Strict admission of the new config member.
  - Receipt counts.
  - Each tool shows deal flags apart from issues.
  - Python parity on the same cases.

## Alternatives considered

- **Downgrade every FV error band to `warning`.** The record would still read as
  `warnings`, and a 0.95x DSCR would look like a documentation lapse. It also
  loses the error/warning distinction §5.2 draws. Rejected.
- **Keep FV in `issues` with a `category: "deal"` member** and exclude that
  category from `overall_status`. That is less disruptive for consumers, but every
  existing reader of `errors` still counts the finding unless it learns the new
  member. That is exactly the misreading the ruling is about. Rejected by the
  owner's D1 ruling.
- **A separate `uwmd assess` command for deal flags.** It splits one read of the
  record into two, and a host that runs only `validate` would never see them.
- **Escalate by band, not by code** (`financial_validity_errors: true` raises
  every error band). Simpler, but an institution that hard-stops on DSCR seldom
  does so on cap rate. Rejected by the owner's D3 ruling.

## Unresolved questions

- Whether `stage_readiness` should ever consult deal flags (for example
  `credit_approval` not ready while DSCR is under 1.00x). Not proposed: readiness
  is about missing facts (§5.1).
- Whether the starter pipeline should still raise a `blocking_flags` entry for a
  chosen deal flag. That is host policy, unchanged by this RFC.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Where FV findings go | **Ruled: a separate `deal_flags` list**, out of `issues` | A reader of `errors` cannot miscount what is not there |
| D2 | Flag shape | `band: "error" \| "warning"` and no `severity` | Keeps §5.2's two bands without the word that means "defect" |
| D3 | Escalation | **Ruled: codes listed one by one** in `validation_overrides.financial_validity_errors: ["FV-04", …]`, error band only | Per-code, as institutions set hard stops |
| D4 | Escalated warning band | Stays a deal flag | The ruling raises findings "to errors"; a warning band is not one |
| D5 | Receipts | Counts exclude deal flags; no new member | Receipts already do not block; no new wire member needed |
| D6 | Stored §4.17 status | Excludes deal flags, like the result | One meaning (RFC 0108 D4) |
| D7 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Credit-policy practice separates a file's completeness and consistency, which
  are the underwriter's checks, from policy exceptions on the deal. Exceptions
  are flagged and approved, not treated as defects. Format §4.17's
  `policy_flags[]` with `exception_filed`/`exception_approved` already models
  this.
- Linters separate errors from findings an organisation may promote by
  configuration (ESLint rule levels, Biome's `--diagnostic-level`).
