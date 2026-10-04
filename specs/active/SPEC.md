# Specification: RFC 0071 calendar-date predicate (implementation)

The active implementation is [RFC 0071](../../docs/rfcs/0071-calendar-date-predicate.md).
It was accepted and its implementation authorized on 2026-10-04, from canonical
`main` at `a1b3a747f5dcd3c42f6d8159305bba0774d71366`. The frozen contract is
the RFC's owner acceptance record. The implementation branch is
`claude/implement-rfc-0071`.

- **Builtin.** `is_calendar_date(value) → boolean` joins the shared §VIII.3
  set, through the one evaluator. It returns `true` only for an exact ASCII
  `YYYY-MM-DD` string that names a real proleptic Gregorian date, for years
  `0000`–`9999`. Every other value returns `false`.
- **Errors.** A wrong argument count raises `CALC-TYPE-001`, and an error
  inside the argument expression propagates.
- **Implementation.** It reuses `parseISODate` behind an explicit string
  check.
- **Spec and schema.** The Protocol gains the §VIII.3 row and paragraph, the
  §VIII.9 cross-reference and the §X MUST protocol floor. The floor reuses
  §VII.2 step 3 (`PROTO-MOD-030`) and adds no new code. The `module-manifest`
  `requires_protocol` description gains a matching note.
- **Excel.** No mapping is added; emission refuses with `EXCEL-EMIT-FN`.
- **Out of scope:**
  - the `actualDays()` early-year defect;
  - RFC 0068;
  - a numeric-type predicate;
  - release preparation and version selection.

When the implementation merges, archive this file and its task matrix, as was
done for RFC 0070. RFC 0070's verified matrix is at
`specs/archive/rfc-0070-replacement-funding.md`. RFC 0070 is now `implemented`.
RFC 0063's completed task record is at `specs/archive/rfc-0063-exclusive-boundary.md`.
