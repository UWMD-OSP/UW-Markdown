# Starter products: Display conventions

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL.md)
> §III (except §III.1b and §III.6a)
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D11). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

### III.1 Number formatting

**Normative schema for remediation entries:**
[`spec/schemas/issue-remediation.schema.json`](../../spec/schemas/issue-remediation.schema.json)
(used by §III.6). Every entry in `BUILTIN_REMEDIATIONS` and any module
remediation table MUST validate against it.



All numeric display strings MUST be produced by rules equivalent to
those encoded in `DEFAULT_NUMBER_FORMAT` (`protocol.ts`) and
implemented in `format.ts`.

| Kind | Default | Example input | Example output |
|---|---|---|---|
| Currency | `$1,234,567` (no fractional digits, en-US separators) | `1234567` | `$1,234,567` |
| Percent | `5.51%` (decimal × 100, 2 decimals) | `0.0551` | `5.51%` |
| Ratio | `1.234x` (3 decimals, `x` suffix) | `1.234567` | `1.235x` |
| Count | `50` (no thousands separator by default in CSV; with separator in display) | `50` | `50` |
| Null | `n/a` | `null` | `n/a` |

Implementations MAY override per-call to add fractional digits or
suppress suffixes (the second-arg options in `format.ts`), but the
default presentation MUST match the table above.

The table above is the **`en-US`** row of the per-locale registry; see
§III.1a for the other registered locales.

### III.1a Display locales (RFC 0001)

A file MAY declare the display locale it was authored in
(`frontmatter.locale`; absent = `en-US`), and an implementation declares
the locales it renders (`ImplementationManifest.supported_locales`;
absent = `['en-US']`). Negotiation is support-or-refuse:

> An implementation MUST support `en-US` and MAY support additional
> registered locales. When producing a **display render** (chat, summary,
> report) of a file whose `locale` it does not support, it MUST emit
> `LOC-01` (error, `LOC` family §III.6a) and MUST NOT fall back to a
> different locale — two readers disagreeing about what `1.234,56` means
> is the failure this rule prevents. Parsing, validation, editing, and
> calc of such a file are unaffected.

**The display-only boundary.** `locale` governs human display renders
ONLY. Canonical JSON content (numbers, ISO dates, fraction rates), the
CSV renders (interchange, not display), UW Lite's canonical form,
digests/signatures/receipts, and calc evaluation are locale-free.
`CalcEvaluationContext.locale` is locale-invariant: evaluation MUST be
identical whatever locale a context declares.

**The registry, not ICU.** Formatting for every non-`en-US` locale MUST
be produced from the rules below (`BUILTIN_FORMAT_RULES`,
`format-rules.ts`) — never from runtime `Intl`/ICU, whose output varies
across runtimes and versions. The rows are the normative contract; new
locales land via additive RFC amendments to this table.

| Locale | Decimal | Grouping | Currency | Percent | Date (display) |
|---|---|---|---|---|---|
| `en-US` | `.` | `,` | `$` prefix | `5.51%` | ISO passthrough |
| `en-GB` | `.` | `,` | `£` prefix | `5.51%` | `DD/MM/YYYY` |
| `de-DE` | `,` | `.` | `€` suffix, NBSP | `5,51 %` (NBSP) | `DD.MM.YYYY` |
| `fr-FR` | `,` | NBSP | `€` suffix, NBSP | `5,51 %` (NBSP) | `DD/MM/YYYY` |
| `ja-JP` | `.` | `,` | `¥` prefix | `5.51%` | `YYYY/MM/DD` |
| `zh-CN` | `.` | `,` | `¥` prefix | `5.51%` | `YYYY-MM-DD` |

NBSP is U+00A0. Currency symbols are the locale's conventional default
symbol when `frontmatter.currency_code` is absent. When that optional field
is present, its three-uppercase-letter identity is rendered as an explicit
prefix (`USD 1,234.56`), while the locale continues to control numeric
separators. Identity is never inferred from `$`, locale, address, or asset
location; no FX conversion or currency-specific precision is performed.
Date patterns are applied textually to the ISO source — no timezone
arithmetic. Example (`de-DE`): `1234567.5` → `1.234.567,5 €`;
`0.0551` → `5,51 %`; `2026-04-15` → `15.04.2026`.

### III.2 Date/time

Dates in the file are ISO-8601 strings. The default display style is
the declared locale's date pattern (§III.1a) — for `en-US`, `iso`
passthrough. Implementations MAY surface `short`, `medium`, or `long`
styles via `Intl.DateTimeFormat`; those styles are convenience, not
conformance surfaces.

### III.3 Section display hierarchy

Section cards SHOULD be presented in the order defined by
`BUILTIN_VIEW_MODELS[id].display_order`. Sections not present in the
file MUST NOT render an empty card.

### III.4 Badge system

Each block carries provenance via `_meta.provenance.source`. Implementations
SHOULD display a compact badge per block:

| `_meta.provenance.source` pattern | Suggested label | Color hint |
|---|---|---|
| `agent/*` | "AI" or layer ID | accent |
| `manual` | "Manual" | neutral |
| `document/*` | "Document" | neutral |
| `system/*` | "System" | muted |
| `institution/*` | "Institution" | muted |

Confidence is rendered from `_meta.quality.confidence` ∈ `{high, medium, low}`.
Style options (pill/icon/text) are at implementer discretion.

### III.5 Supersede UX

When a section has superseded blocks, implementations SHOULD provide
a way to reveal them (a toggle, a side panel, etc.). Superseded blocks
MUST NOT be confused with the canonical block in any default view.

### III.6 Validation issue display

Each issue from `validateUWFile()` carries a `code`. Implementations
SHOULD render the matching `IssueRemediation` from
`BUILTIN_REMEDIATIONS` — title and remediation copy verbatim. The
goal is uniform UX across implementations, so end-users learning the
format on one tool see the same remediation copy on another.
