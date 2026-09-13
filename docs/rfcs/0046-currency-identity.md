---
rfc: 0046
title: Document currency identity
status: accepted
author: jaredmaxey
created: 2026-09-13
accepted: 2026-09-13
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0046: Document currency identity

## Summary

RFC 0001 made locale a display-only choice and deliberately deferred currency
identity. This RFC adds an optional document-level `currency_code` so a deal
can state its denomination independently from its display locale.

The first tranche is intentionally one-currency-per-document. It does not
convert amounts, infer a code from a symbol or locale, validate against a live
ISO registry, or permit mixed-currency arithmetic. A document without the new
field remains byte- and display-compatible with existing files.

## Contract

### Source field

`frontmatter.currency_code` is optional and, when present, MUST match
`^[A-Z]{3}$`. The value is an authored denomination assertion, not an FX or
registry lookup. A malformed value produces `CUR-01` and display renders MUST
refuse it.

The code applies to monetary values in the document's standard sections and
calculation display results. It does not change canonical numeric storage,
rounding, receipts, signatures, or calculation formulas. Documents that need
multiple currencies MUST remain separate documents or use an explicitly
scoped future money representation; this RFC does not combine them.

### Display

Locale continues to control decimal separators, grouping, and dates. An
explicit currency code controls the currency identity. Display formatters
render an explicit code as an unambiguous ISO-style prefix (`USD 1,234.56`),
using the locale's numeric separators. The locale's conventional symbol is
used only when `currency_code` is absent, preserving RFC 0001 output.

The reference renderer, report renderer, and calc result display all thread
the document code. CSV, JSON, Lite canonicalization, hashes, signatures,
receipts, and machine calculations remain unchanged.

### Protocol

The `CUR` validator family is registered with `CUR-01`:

| Code | Severity | Trigger |
|---|---|---|
| `CUR-01` | error | `frontmatter.currency_code` is present but is not three uppercase ASCII letters. |

An absent code is not an error or warning. The reference implementation does
not claim that a syntactically valid code is an allocated ISO 4217 code; the
assertion remains attributable source data.

## Compatibility

- Existing documents have no `currency_code` and retain existing output.
- Parsing, editing, validation of unrelated fields, and all numeric results are
  unchanged for valid documents.
- A malformed new field is an explicit refusal rather than a silent fallback.
- No schema or protocol version bump is needed for the format field itself;
  the validator family and display contract are additive to Protocol 2.12.0.

## Verification

The implementation adds unit and named conformance coverage for:

- USD, EUR, and an unlisted-but-syntactically-valid code rendering across
  `en-US` and `de-DE`;
- absent-code byte/display compatibility;
- malformed-code `CUR-01` validation and render refusal;
- locale-invariant calculation values with code-aware display strings; and
- unchanged CSV output.

## Explicitly deferred

- Per-value or per-section currency identity;
- FX rates, conversion, triangulation, and monetary arithmetic across codes;
- live ISO 4217 registry validation;
- currency-specific decimal precision or cash rounding;
- currency-aware workbook import/export; and
- currency identity inferred from `$`, `£`, `€`, locale, address, or asset
  location.

