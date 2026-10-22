---
rfc: 0114
title: Record the area measurement standard behind per-area metrics
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0114: Record the area measurement standard behind per-area metrics

> **Accepted by the owner, 2026-10-21, as drafted** (owner: "RFC 0113 (#476) and RFC 0114 (#477) accepted as drafted.").
> Origin: issue #343 finding M10, left open by the
> metric variants table in `spec/metrics/README.md` ("whether to record the area
> measurement standard"). It adds an optional, validated member, so it is
> normative. No formula changes.

## Summary

`price_per_sqft`, `price_per_nrsf` and the other per-area metrics divide by the
class's primary size field: rentable SF for office and industrial, GLA for
retail, NRSF for self storage. Nothing in a record says how that area was
measured. BOMA, IPMS, REBNY and RICS give different areas for the same building,
and a reader comparing two records' price per SF cannot tell whether they
measured alike. This RFC adds an optional `property.area_measurement` that names
the standard and edition behind the stated areas. It changes no metric and does
not convert between standards.

## Motivation

- **Same building, different denominators.** Rentable area under one standard
  can differ from another by several percent. That moves price per SF as much as
  a real price change would.
- **Lenders and appraisers state the basis.** Appraisal review compares units of
  comparison on a stated basis (OCC *Comptroller's Handbook*). The record has
  nowhere to carry it.

## Proposed change

1. **Format §4.1 `property`.** Optional `area_measurement`:
   ```json
   "area_measurement": {
     "standard": "boma | ipms | rebny | rics | other",
     "edition": "string",
     "note": "string"
   }
   ```
   `standard` is a closed vocabulary. An unknown value is refused, as other closed
   vocabularies are (D2). `edition` names the publication, for example
   `"ANSI/BOMA Z65.1-2017"`, as free text. `note` is optional. The member applies
   to every area-valued size field the record states.
2. **Validation.** A malformed member (unknown `standard`, or `edition` not a
   string) is an error under a new `PROP-` or `CLS-` code assigned at
   implementation. An absent member is not a finding (D3).
3. **No metric change, no conversion.** The per-area formulas are unchanged, and a
   Verifier does not compare or convert areas across standards.
4. **Variants table.** The per-area row says the basis is recorded in
   `property.area_measurement` when stated.

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). The member is optional, so no
existing record changes meaning.

## Conformance impact

New cases: a valid member on an office record, plus refusals for an unknown
`standard` and a non-string `edition`. No expected metric output changes.

## Reference implementation

The Format text and `property` schema, the validator check and its code
(`verify-codes` registry), the Python validator, the cases and the variants
table row.

## Alternatives considered

- **Require it at `full_underwrite`.** This would make the basis visible on
  every credit file. It is a stronger rule than the evidence asks for. Not
  proposed; see D3.
- **One id per standard and area type** (for example `boma_2017_office_rsf`).
  This is more precise, but the vocabulary would grow with every edition. Not
  proposed.
- **Convert to a common basis.** No conversion between standards is exact.
  Rejected.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Where the basis lives | `property.area_measurement`, one per record | The size fields live in `property` (§4.1). Alternative: one entry per size field |
| D2 | `standard` vocabulary | Closed: `boma`, `ipms`, `rebny`, `rics`, `other`; edition as free text | House pattern of closed vocabularies. Alternative: free text |
| D3 | When it is required | Never; absent is not a finding | Records the basis without a new obligation. Alternative: required (or a warning) at `full_underwrite` |
| D4 | Effect on metrics | None; no cross-standard comparison or conversion | UWMD verifies stated figures; a conversion would be a new convention |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Issue #343 (M10); `spec/metrics/README.md` "Variants in use" (#451).
- Protocol §XIII and RFC 0027 (primary size fields per class).
