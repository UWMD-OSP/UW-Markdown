---
rfc: 0001
title: Locale negotiation
status: draft
author: jaredmaxey
created: 2026-04-26
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0001: Locale negotiation

## Summary

v1 freezes every numeric and date format to `en-US` so that two conforming
implementations cannot disagree about how `1234.5` or `2026-04-15` renders.
This RFC proposes a minimal, additive locale-negotiation surface that lets
implementations declare which locales they support and lets a `.uw.md`
file declare the locale it was authored in. Parsing and rendering remain
deterministic per locale; cross-locale conversion is explicitly out of
scope.

## Motivation

- `SupportedLocale` in [`protocol.ts:99`](../../packages/uwmd-core/src/protocol.ts) is `'en-US'` literally — the only allowed value.
- `NumberFormatRules` ([`protocol.ts:101`](../../packages/uwmd-core/src/protocol.ts)) and `DateFormatRules` ([`protocol.ts:110`](../../packages/uwmd-core/src/protocol.ts)) carry a `locale` field that is therefore meaningless.
- Format spec §III currency/percent/ratio rules are hard-coded to US conventions (`$`, `1,000.00`, ISO dates rendered as `MM/DD/YYYY` in chat).
- Adopters in the EU, UK, and Asia have to either fork the renderer or store values in a non-canonical way to get their locale's display rules.

The cost of staying frozen is an entire class of adopters self-excluded from
conformance. The cost of getting locale wrong is non-determinism — the same
file rendered by two conforming tools showing different numbers. Locale
negotiation is the design that lets adopters opt in without breaking determinism.

## Proposed change

### Format spec

Add a `locale` frontmatter key (default `en-US`) and one new normative
section in Part III:

```yaml
# Frontmatter
locale: en-US     # default; one of the SupportedLocale values
```

Spec language (RFC 2119):

> A conforming implementation **MUST** support `en-US`. An implementation
> **MAY** support additional locales. When parsing a file whose `locale`
> the implementation does not support, the parser **MUST** emit a
> `BLOCKING-LOCALE-001` validation error and **MUST NOT** fall back to a
> different locale.

Numeric, percent, ratio, and date rendering rules are factored into a per-locale
table in spec §III. `en-US` keeps its current rules verbatim; new locales
land via additive amendments to the table.

### Protocol spec

`SupportedLocale` becomes:

```ts
export type SupportedLocale =
  | 'en-US'
  | 'en-GB'
  | 'de-DE'
  | 'fr-FR'
  | 'ja-JP'
  | 'zh-CN';
```

`ImplementationManifest.capabilities` gains a `supported_locales: SupportedLocale[]`
field (defaulting to `['en-US']` for backwards compatibility). A reader that
encounters a file whose `locale` is outside its declared `supported_locales`
errors per the format-spec rule above.

`NumberFormatRules` and `DateFormatRules` are kept; their `locale` field
becomes meaningful. The `BUILTIN_FORMAT_RULES` registry gains one entry per
listed locale.

### Library

- `formatCurrency`, `formatPercent`, `formatRatio`, `formatDate` accept an optional `locale: SupportedLocale` argument; default remains `'en-US'`.
- `parseUWFile` reads `frontmatter.locale` and threads it through to the validator and renderer.
- New `BUILTIN_REMEDIATIONS['BLOCKING-LOCALE-001']` entry covering the unsupported-locale error.

The change is **additive** — files without a `locale` key continue to be
treated as `en-US`.

## Compatibility analysis

- **Existing `.uw.md` files** — no breakage. Files without `locale` default to `en-US`.
- **Tier-1 readers** — must declare `supported_locales` in their manifest. A reader that only supports `en-US` continues to work for every existing file; it errors on a file authored in `de-DE`, which is the desired behavior.
- **Tier-2 editors** — must preserve the `locale` key on round-trip (already covered by general round-trip preservation).
- **Tier-3 calc hosts** — calc engine is locale-agnostic (numbers are stored canonically); only display changes. No behavior change.
- **Tier-4 agent hosts** — must run agents with the file's declared locale (so generated narrative text matches).
- **Modules** — `ModuleManifest.requires_locales?: SupportedLocale[]` (additive, optional). A module that hard-codes US-specific thresholds declares `requires_locales: ['en-US']`.

No deprecation path required — additive change.

## Conformance impact

New fixtures in `conformance/tier-1-reader/fixtures/`:
- `de-DE-rendering/` — same Parkview deal frontmatter set to `de-DE`, expected chat/summary outputs use German formatting (`1.234,56 €`, `15.04.2026`).
- `unsupported-locale-error/` — file with `locale: xx-XX`, expected `BLOCKING-LOCALE-001` error from a reader that doesn't declare it.

Existing tier-1/2/3 fixtures continue to pass without change (they implicitly carry `locale: en-US`).

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/protocol.ts` — expand `SupportedLocale`, add `supported_locales` to `ImplementationManifest`.
  - `packages/uwmd-core/src/format.ts` — per-locale formatter dispatch.
  - `packages/uwmd-core/src/format-rules.ts` (new) — `BUILTIN_FORMAT_RULES` registry.
  - `packages/uwmd-core/src/validator.ts` — emit `BLOCKING-LOCALE-001` on unsupported locale.
  - `packages/uwmd-core/src/renderer.ts` — thread locale through render.
  - `spec/UW_FORMAT_SPEC_v1.md` — Part III locale table.
  - `spec/UW_PROTOCOL_v1.md` — §IV manifest changes.
- **API surface:** `formatCurrency(value, { locale })`, `formatPercent(value, { locale })`, etc. (additive optional argument). New export: `BUILTIN_FORMAT_RULES`.
- **Test plan:** unit tests for each locale's formatter; integration test that a file with `locale: de-DE` renders the German fixture's expected output.

## Alternatives considered

1. **Per-section locale override.** Allow `locale` inside `_meta` so a single file could mix locales. Rejected — opens the door to internally-inconsistent files (one section in `de-DE`, another in `en-US`) and complicates renderer state. The frontmatter-level decision is simpler and covers the actual use case (a deal originated in one country).

2. **Runtime locale switching at render time.** Let the reader pass a `locale` to render, regardless of file content. Rejected — breaks determinism. A file should render the same way for any conforming reader. The file declares its locale; readers either support it or error.

3. **Defer to ICU's full locale tag space.** `SupportedLocale = string` with an ICU-style validator. Rejected for v2-of-protocol — too large a surface to certify against. The closed enum can grow over time via small additive RFCs.

## Unresolved questions

- Which locales ship in the first wave? Proposal: `en-US`, `en-GB`, `de-DE`, `fr-FR`, `ja-JP`, `zh-CN`. Pulls from where adopters have indicated demand.
- Date display format — should the chat-render's date format also be per-locale (`15.04.2026` for `de-DE`), or always ISO (`2026-04-15`)? Recommend per-locale for chat; always ISO inside JSON content.
- Currency symbol disambiguation — does `en-US` always render `$` as `USD`? What about a deal in Mexico authored in `en-US` with peso amounts? Likely needs a `currency_code` field on monetary values to fully resolve.

## Prior art

- **CommonMark** stays locale-agnostic by punting display entirely. Not an option here — UW Markdown's value proposition is determinism *including* display.
- **JSON Schema `format: date`** — defines the wire format but punts display. We do the same for storage; display is the new surface.
- **ICU locale data** — the canonical source for per-locale formatting rules. Our `BUILTIN_FORMAT_RULES` is a small curated subset chosen to ship verbatim, not a runtime ICU dependency.
- **OpenAPI 3.1 i18n** — does not attempt locale negotiation; each spec is monolingual. UW Markdown's frontmatter-locale approach is closer to what HTTP `Accept-Language` does, except evaluated at parse time rather than request time.
