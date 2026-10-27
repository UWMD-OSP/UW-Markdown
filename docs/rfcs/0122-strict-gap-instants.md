---
rfc: 0122
title: Make DQ-05 date parsing deterministic
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0122: Make DQ-05 date parsing deterministic

## Resolution

Accepted as drafted by the UWMD maintainers on 2026-10-22 (fourth set), including the
explicit grammar details and typed refusal of an invalid supplied clock.

## Contract

Admit exactly a four-digit-year `YYYY-MM-DD`, interpreted at UTC midnight, or
`YYYY-MM-DDTHH:mm[:ss[.fraction]]` followed by uppercase `Z` or a signed numeric
offset `+HH:mm`/`-HH:mm`. Fraction, when present, has one through three digits
and requires seconds. Missing seconds mean zero; fractional digits denote exact
milliseconds after right-padding to three digits. Years are 0001 through 9999.

Validate the Gregorian calendar date before applying the zone: reject invalid
month/day combinations and day overflow rather than normalizing them. Hours are
00 through 23; minutes and seconds 00 through 59. Numeric offset hours are 00
through 23 and minutes 00 through 59; either signed zero offset denotes UTC.
Reject whitespace, local-time date-times, legacy textual dates, unpadded fields,
24:00, leap-second spellings and trailing text. Do not consult the host timezone
or a permissive date parser for admission.

Use the same admitted grammar for an explicitly supplied validation clock.
Production clock defaults remain the host's current instant. Invalid or absent
last_checked contributes no staleness finding; it is not converted to epoch or
silently normalized. Existing structural field owners remain unchanged. A bad
explicit clock is a typed invalid-input refusal, not an invented stale result.

Only after admission compare instants using the existing DQ-05 strict older-than
freshness rule. Retain the existing default 14 days and institution override;
this RFC changes neither threshold nor financial math.

## Decisions

| Question | Recommendation | Precedent |
|---|---|---|
| Date only? | Calendar-valid YYYY-MM-DD at UTC midnight | Accepted resolution and existing strict calendar-date contracts |
| Date-time zones? | Explicit Z or numeric offset; no local-time interpretation | Accepted resolution; deterministic results across implementations |
| Precision and shortened time? | HH:mm with optional seconds and 1-3 fractional digits; exact milliseconds | Existing millisecond validation-clock comparison, without submillisecond rounding |
| Invalid last_checked? | No DQ-05; retain structural owners | DQ-05 is a staleness test, not a new schema error |
| Invalid explicit clock? | Typed refusal | An invalid clock cannot establish a verification claim |

## Implementation and conformance

Specify the grammar alongside Format 4.16 data-gap rules and the protocol data
quality contract; synchronize executable types/schema descriptions as needed.
Use shared strict parsers in the TypeScript and independent Python validators.
Portable controls cover leap years/invalid days, UTC date-only, equal instants
with opposing offsets, exact threshold versus older, unzoned/textual/overflow
refusals, fractional precision, and invalid explicit clock. Run under multiple
host timezones with one fixed clock. No fixture values are repaired to simulate
acceptance. Implementation uses PROTO-VALIDATION-CLOCK under the existing PROTO
operation-refusal family; no document issue is invented.
