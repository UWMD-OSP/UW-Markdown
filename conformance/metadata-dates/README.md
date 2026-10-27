# Independent calendar-domain conformance

The RFC 0095 date vectors are consumed by the TypeScript and Python validation
tests. The independent TypeScript/Python/schema comparison and 400-year integer
calendar oracle run in Main CI. These inputs moved from review paperwork without
changing accepted dates, algorithms or frozen vector/cycle digests.

Run the adjacent `2026-10-17-validation-diagnostic-gap-354.0095-date-only.check.mjs`
with Node from the repository root. It checks the RFC schema, every declared
vector and the complete Gregorian cycle, preserving all inputs.
