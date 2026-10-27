---
rfc: 0113
title: Define hospitality occupied room nights as paid room nights sold
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - conformance-corpus
---

# RFC 0113: Define hospitality occupied room nights as paid room nights sold

> **Accepted by the UWMD maintainers, 2026-10-21, as drafted** (owner: "RFC 0113 (#476) and RFC 0114 (#477) accepted as drafted.").
> Origin: issue #343 finding M07, left open by the
> metric variants table in `spec/metrics/README.md` ("whether to define
> `occupied_room_nights` as paid rooms sold"). It fixes the meaning of a stated
> field that `adr` and `occupancy` read, so it is normative. No formula changes.

## Summary

Hospitality `adr` is rooms revenue ÷ `rent_roll.occupied_room_nights`, and
`occupancy` is `occupied_room_nights` ÷ `available_room_nights`. The Format says
only that `occupied_room_nights` is an integer ≥ 0, and its schema calls it
"room nights sold". USALI and the OCC *Comptroller's Handbook* (Hotels) compute
ADR and occupancy on paid rooms sold, excluding complimentary and house-use
rooms. A producer that counts complimentary nights gets a lower ADR and a higher
occupancy than the same hotel reported the standard way, and no check can tell.
This RFC defines the field as paid room nights sold.

## Motivation

- **The same field, two numbers.** Two producers stating the same hotel can
  disagree on ADR by the share of complimentary nights, and both records
  verify.
- **Lenders read ADR on paid rooms.** Underwriting packages and the OCC handbook
  use the USALI basis. A record that does not say which basis it used cannot
  be compared.

## Proposed change

1. **Format §4.3, hospitality variant.** `occupied_room_nights` is the number of
   room nights sold for revenue in the period that `rooms_revenue` covers.
   Complimentary and house-use room nights are excluded. A room night in a package
   or contract whose price includes the room counts as sold (USALI, Rooms
   Department).
2. **Optional `complimentary_room_nights` (D2).** An integer ≥ 0. Producers MAY
   state the excluded nights separately, so the physical count stays
   recoverable. No metric reads it.
3. **No formula change.** The `adr` and `occupancy` dictionary entries, their
   `round_to` and their null guards are unchanged. The variants table records the
   basis as settled.
4. **Schema.** `spec/schemas/rent-roll-hospitality.schema.json` describes the
   field as paid room nights sold and admits `complimentary_room_nights`.

## Compatibility analysis

No compatibility path (prelaunch; the prelaunch policy). The examples' stated counts
are already paid counts; at implementation, each is checked against its
narrative.

## Conformance impact

No expected output changes. One new fixture states `complimentary_room_nights`
beside a paid count, and shows ADR and occupancy computed on the paid count.

## Reference implementation

The Format text, the schema fragment, the variants table row, the Python
reader's schema copy if it has one, and the fixture.

## Alternatives considered

- **Leave the basis undefined and document it.** This is today's state (#451).
  It leaves M07 open. Rejected.
- **Define the field as physical occupied rooms, with a separate paid count.**
  This inverts the industry basis for the field that ADR reads. Rejected.

## Unresolved questions

- STR's benchmark treats some zero-rate contract nights differently from
  USALI's complimentary rooms (#343 M07). This draft follows USALI, which is what
  `adr` is compared against in the variants table. A separate STR-basis field is
  not proposed.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Meaning of `occupied_room_nights` | Paid room nights sold; complimentary and house-use excluded | USALI and the OCC handbook. Alternative: physical occupied rooms |
| D2 | Record the excluded nights | Optional `complimentary_room_nights`, read by no metric | Keeps the physical count recoverable. Alternative: no field |
| D3 | Formulas | Unchanged | The fix is the input's meaning, not the arithmetic |
| D4 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Issue #343 (M07); `spec/metrics/README.md` "Variants in use" (#451).
- RFC 0103 (stated booked rooms revenue; `CC-HOSP-05` cross-check).
- Draft RFC 0087 (hospitality revenue reconciliation basis), which this RFC
  neither depends on nor changes.
