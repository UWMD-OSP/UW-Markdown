---
rfc: 0037
title: Cross-check resolution over variant maps, and a validation coverage channel
status: implemented
author: jaredmaxey
created: 2026-09-09
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0037: Cross-check resolution over variant maps, and a validation coverage channel

> **Status note.** Accepted and implemented 2026-09-09 under owner-led
> governance, in the same change as this document. Raised by underwriter.cc
> as UPSTREAM-005 (2026-09-02) after a $15.2M senior-loan disagreement
> validated clean for weeks because every cross-check that would have caught
> it had silently no-opped on a variant map.

## Summary

Two related defects in the reference validator's cross-section consistency
pass (`checkCrossSectionConsistency`, format spec §5.3) are fixed by two
normative additions. First, a **resolution rule**: when a section a `CC-NN`
rule reads is present as a variant map, the validator resolves it to one
block by a stated preference order (`default`, then `base`, then a
rule-specific variant such as `t12` for `operating_statement` or `appraisal`
for `due_diligence`), takes a lone variant when there is exactly one, and
otherwise declares the section **unresolvable for cross-checking** and says
so with a new `info` code, `CC-16`. Second, a **coverage channel**: a
conforming validator reports, for every `CC-NN` rule it registers, whether
the rule was *evaluated* or *skipped* and why, so "checked and clean" is
distinguishable from "never looked". Neither addition changes any rule's
threshold or severity.

## Motivation

- **Variant maps silently disable rules.** `getSection` returns `null` for a
  multi-variant section — correct, and documented as "use
  `getSectionVariant`" — but ten of the fifteen cross-checks resolve their
  sections with a bare `getSection`. Splitting a section into variants is a
  protocol feature, not a producer error: format §2.8 names six multi-variant
  sections, and the UW JSON envelope (RFC 0014, `uw-document-envelope.schema.json`
  `sections` → `oneOf: [block, variantMap]`) admits a variant map on **any**
  section, so an envelope carrying a senior facility and a mezz sleeve as two
  `debt_structure` variants is conforming and loses `CC-02`, `CC-03`, `CC-05`
  and `CC-09` with no diagnostic. On underwriter.cc's exports `debt_structure`
  is a variant map on 100% of documents.
- **There is no coverage channel.** `ValidationResult` distinguishes error /
  warning / info, but not "checked and clean" from "never evaluated". A
  consumer cannot tell a reconciled document from one whose reconciliation
  rules all no-opped. `verifyCapitalStack` already models the right posture
  with `CS-SIZING-UNEVALUABLE`; the cross-check pass had no equivalent.
- **The precedent exists and is inconsistent.** `CC-15` already reads "the
  base variant" of `lease_up_schedule`; the `operating_statement` lookup
  already prefers `t12` then `default`; `stress_tests` prefers `default`.
  Three rules had three private conventions and twelve had none.

## Proposed change

### Format spec §5.3 — resolution over variant maps

Add, after the check table:

> **Resolution over variant maps (RFC 0037).** A cross-section check reads
> each section it names as **one block**. When that section is present as a
> variant map (§2.8, or any section of a UW JSON envelope carrying more than
> one block), a conforming validator MUST resolve it by this order and take
> the first variant present: (1) the check's registered preference, if any —
> `CC-01` prefers `t12` on `operating_statement`; `CC-08` prefers `appraisal`
> on `due_diligence`; (2) `default`; (3) `base`; (4) the sole variant, when
> the map holds exactly one. A check whose own rule exempts every variant
> but a named one (`CC-15` reads the lease-up **base** variant only, RFC
> 0008) stops after that name and reports `not_applicable` rather than
> unresolvable. If none applies the section is **unresolvable
> for cross-checking**: every check that reads it is skipped, the skip is
> recorded in coverage (below), and the validator emits `CC-16` once per
> unresolvable section as `info`, naming the variants found and the checks
> skipped. A validator MUST NOT pick an arbitrary variant, average variants,
> or check variants pairwise — a document that states two senior facilities
> has not stated which one reconciles with `sources_uses`.

> **Coverage (RFC 0037).** A conforming validator MUST report, alongside its
> issues, a **coverage** record for every `CC-NN` check it registers:
> `evaluated` when the comparison was actually performed (whether or not it
> produced an issue), or `skipped` with one of four reasons —
> `section_absent`, `variant_unresolvable`, `field_absent`,
> `not_applicable` — and a short detail naming the section, field or
> precondition. A check with no coverage entry is a check the validator does
> not implement. Coverage is reporting, not a verdict: it never changes
> `overall_status`.

Add to the check table:

| Check ID | Description | Sections |
|---|---|---|
| `CC-16` | A section a cross-check reads is present as multiple variants and none resolves under the §5.3 preference order; the checks reading it were skipped (`info`) (RFC 0037) | any |

### Protocol spec §III.6a

No new family: `CC-16` sits in the registered `CC-NN` sequence. A sentence
under the taxonomy table points at the coverage record as the mechanism a
host uses to display "not evaluated" beside "clean".

### `@uwmd/core`

- `ValidationResult` gains `coverage: Record<string, CrossCheckCoverage>`,
  keyed `CC-01` … `CC-15`; `CrossCheckCoverage` is
  `{ status: 'evaluated' | 'skipped'; reason?: CrossCheckSkipReason; detail?: string }`.
  Both types are exported. `CC-16` itself is an issue, not a coverage key.
- `CROSS_CHECK_VARIANT_PREFERENCE` (`['default', 'base']`) and
  `CROSS_CHECK_RULE_IDS` are exported from `protocol.ts`; `BUILTIN_REMEDIATIONS`
  gains `CC-16`.
- `uwmd validate` prints a one-line coverage summary in its human output
  (`--json` carries the full record).

## Compatibility

- **Format:** additive. No document that validated before validates
  differently except that a document with an unresolvable variant map now
  carries an `info` issue it did not have. `overall_status` is unchanged in
  every case (`info` never moves it).
- **Protocol:** additive — a new registered code in an existing family and a
  new field on the validation result. Candidate for the next protocol minor;
  this RFC does not cut it.
- **Documents whose variant map resolves under the new order** (a `default`
  or lone variant) now have checks evaluated that were previously skipped and
  may gain real `CC-NN` warnings or errors. That is the point: those
  disagreements existed and were invisible.
- **Consumers constructing `ValidationResult` by hand** must add `coverage`.
  The tier-1 baselines compare `overall_status` and issue `(code, severity)`
  pairs only, so no existing baseline moves.

## Conformance

- `tier-1-reader/fixtures/08-variant-cross-checks.uwx.md`: `due_diligence`
  as two variants (`appraisal`, `environmental`) beside
  `valuation.appraised_value` — resolves by preference and `CC-08` fires;
  `operating_statement` as `t3` + `budget` and `stress_tests` as `downside` +
  `upside` — neither resolves, so `CC-01`, `CC-07` and `CC-09` are skipped and
  `CC-16` is emitted once per section. The frozen verdict pins all of it.
- Unit coverage in `validator.coverage.test.ts`: every reason, the preference
  order, the lone-variant rule, `CC-16` de-duplication, and that coverage
  keys are exactly the registered rule ids.

## Implementation

Landed with this RFC: `validator.ts` (`resolveCrossCheckSection`, the
coverage ledger threaded through the five functions that emit `CC` codes),
`types.ts`, `protocol.ts`, `cli.ts`, `index.ts`, the fixture and its
baselines, and the two spec edits above.

## Alternatives considered

- **Check every variant pairwise.** Rejected: a document with two
  `debt_structure` variants (senior, mezz) is not two candidate seniors; a
  pairwise `CC-03` would report the mezz sleeve as a failed senior
  reconciliation, which is a false positive with the same cost as the false
  negative it replaces.
- **A declared aggregate variant** (`variant=aggregate`) the producer must
  emit. Rejected for now: it moves the burden to every producer and invents a
  block that restates other blocks' sums, which is exactly the kind of
  restatement `CC-NN` exists to police. `default` already serves as the
  producer's declared answer, and a producer that wants a check evaluated can
  name one.
- **Coverage as `info` issues only.** Rejected: fifteen `info` lines on every
  clean document would bury the real ones. Coverage is a record beside the
  issues; `CC-16` is the one case that deserves an issue because the producer
  can act on it.

## Unresolved questions

- Whether the envelope should restrict variant maps to the §2.8 multi-variant
  sections. This RFC deliberately does not: the envelope grammar has been
  public since RFC 0014 and producers rely on it. If a future RFC narrows it,
  the resolution rule here still applies to the sections that remain.
