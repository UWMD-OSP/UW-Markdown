---
rfc: 0108
title: Align the §4.17 validation section's vocabulary with the validation result
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - conformance-corpus
---

# RFC 0108: Align the §4.17 validation section's vocabulary with the validation result

> **Accepted by the owner, 2026-10-21, with D2 and D3** (owner: "Owner rulings, 2026-10-21. RFC 0107 (#460) accepted with D2 = yes, add quick_metrics.ltc as a second home; D3 = check every stated LTC, not construction only. RFC 0108 (#461) accepted with D2 = yes, align completeness.severity; D3 = yes, replace the four stage names with the seven deal_stage values. RFC 0109 (#462) accepted with D1 = a separate deal_flags list; D3 = institutions list codes one by one in validation_overrides.financial_validity_errors. All other decisions as drafted.").
> Origin: owner ruling of 2026-10-21 (4): align
> the §4.17 `validation` vocabulary with the CLI result before 5.0. It changes a
> section's closed vocabulary, so it is normative.
>
> **Owner ruling, 2026-10-21 evening** (owner: "Accept your RFC 0108 mapping of
> "blocking" completeness items to error; no blocking_flags added."). In the
> corpus, a stored `completeness[]` item with the retired severity `blocking`
> becomes `error`, and no `blocking_flags` entry is added: the items name what a
> later stage requires, and the records are not halted.

## Summary

A record's stored `validation` section (Format §4.17) and a validator's result
(Format §6.2, Protocol §III.6a) describe the same thing in different words. The
section says `warnings_only` and `errors_present`; the result says `warnings` and
`errors`. This RFC makes the section use the result's words, so a stored health
signal and a fresh `uwmd validate` read the same way. The owner also ruled to
align the two smaller mismatches in the same section: completeness severities
(D2) and stage names (D3).

## Motivation

| §4.17 `validation` section | Validation result (§6.2, `ValidationResult`) |
|---|---|
| `overall_status`: `clean \| warnings_only \| errors_present \| blocking` | `overall_status`: `clean \| warnings \| errors \| blocking` |
| `completeness[].severity`: `blocking \| warning \| info` | issue `severity`: `error \| warning \| info`; `blocking` is a status, not a severity |
| `completeness[].required_for_stage`: `screening \| underwriting \| credit_approval \| closing` | `deal_stage` (§2.2): `scope \| screening \| term_sheet \| full_underwrite \| credit_approval \| closing \| monitoring` |

- A consumer reading both must map one vocabulary onto the other by hand, and
  `underwriting` names no stage at all.
- Every example and fixture that states the section writes `warnings_only`:
  `examples/Parkview-Apts-Glendale-AZ.uwx.md`,
  `examples/Riverside-Office-Phoenix-AZ.uwx.md`,
  `examples/parkview-reviewed.uwx.md`,
  `conformance/documents/fixtures/02-full-multifamily.uwx.md`,
  `conformance/institution-config/24-automatic-adjacent/record.uwx.md` and
  `conformance/documents/malformed/57-yaml-nested-under-scalar.uwx.md`.
- Neither implementation reads the section's contents, so the change touches the
  spec and the corpus only.

## Proposed change

1. **Format §4.17 `overall_status`** becomes `clean | warnings | errors | blocking`,
   with the meaning §6.2 gives each value. A producer that writes the section
   SHOULD copy the status of the validation run it records.
2. **`completeness[].severity`** (D2) becomes `error | warning | info`. A
   completeness item that halts the pipeline is recorded as a `blocking_flags`
   entry (Format §3.3), as it is everywhere else.
3. **`completeness[].required_for_stage`** (D3) takes the seven `deal_stage`
   values of §2.2. The retired `underwriting` corresponds to `full_underwrite`;
   `screening`, `credit_approval` and `closing` are unchanged.
4. **Corpus.** The six files above change `warnings_only` to `warnings`, and any
   `completeness[]` entry using a retired severity or stage name is rewritten.
   The documents baseline `02-full-multifamily.parsed.json` follows its fixture.

## Compatibility analysis

No compatibility path (prelaunch; the owner asked for this before 5.0). Records
stating `warnings_only` or `errors_present` use a retired spelling; no
implementation reads it, so nothing breaks at runtime. There is no section
schema to update (`spec/schemas` has none for `validation`).

If RFC 0109 is accepted, `overall_status` excludes financial-validity findings in
both places, and the section's `financial_validity[]` array is where those deal
flags are recorded. The two RFCs are independent, but D4 below keeps them
consistent.

## Conformance impact

The six files above, and `documents/expected/02-full-multifamily.parsed.json`,
which surfaces the fixture's section as data. No other expected output changes:
no check reads the section. A retired spelling is not refused (D5).

## Reference implementation

- **Files:** `spec/UW_FORMAT_SPEC.md` §4.17 and the six corpus/example files.
- **API surface:** none.
- **Test plan:** `npm run conformance` and the docs-site example render
  unchanged apart from the status word.

## Alternatives considered

- **Rename the result's values instead** (`warnings_only` in `ValidationResult`).
  The result is the wire contract every adopter reads and the reference already
  ships; the stored section is the one nobody reads. Rejected.
- **Drop `overall_status` from the section.** It is the section's headline
  signal and costs nothing to keep aligned.

## Unresolved questions

- Whether the section should be fully generated from a `ValidationResult` (one
  mapping, no hand-written fields). Not proposed here.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | `overall_status` values | `clean \| warnings \| errors \| blocking`, as §6.2 | The ruling; the result is the wire contract |
| D2 | `completeness[].severity` | **Ruled: yes**, `error \| warning \| info`; halting goes to `blocking_flags` | One severity vocabulary |
| D3 | `completeness[].required_for_stage` | **Ruled: yes**, the seven §2.2 `deal_stage` values | `underwriting` names no stage |
| D4 | Interplay with RFC 0109 | The section's status means exactly what the result's status means | One meaning; with 0109 accepted, both exclude deal flags |
| D5 | Retired spellings | Not refused; the corpus is rewritten | No reader depends on them; alternative: a `DQ` warning |
| D6 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Format §6.2 and `ValidationResult` (`packages/uwmd-verify/src/types.ts`): the
  vocabulary this RFC adopts.
