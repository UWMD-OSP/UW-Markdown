---
rfc: 0001
title: Locale negotiation
status: draft
author: jaredmaxey
created: 2026-04-26
revised: 2026-09-01
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0001: Locale negotiation

> **Revised 2026-09-01** against everything implemented since the April
> draft. The mechanism survives — the file declares its locale, readers
> support it or refuse, no silent fallback — with these changes: the error
> code becomes **`LOC-01`** in a registered `LOC` family (the draft's
> `BLOCKING-LOCALE-001` predates RFC 0030's §III.6a family registry and
> reads like a `blocking_flags` cousin, which it is not); the
> **display-only boundary is now normative and exhaustive** — locale touches
> chat/summary/report renders and nothing else: canonical JSON content, the
> CSV interchange renders, UW Lite's canonical form, digests, receipts, and
> the calc engine all stay locale-free, and `CalcEvaluationContext.locale`
> (which the engine provably never reads) is pinned locale-invariant;
> **non-`en-US` formatting MUST come from the curated rules registry, never
> runtime `Intl`** — ICU varies across runtimes and versions, and
> "deterministic per locale" cannot rest on whatever ICU shipped this
> morning (`en-US` keeps its existing code path byte-identical, protecting
> every baseline); the conformance home is a **named `conformance/locale/`
> suite** (the `capital-stack`/`lease-up`/`capability` precedent) rather
> than fixtures folded into tier-1; and both April unresolved questions are
> resolved — dates render per-locale in display, always ISO inside JSON,
> and currency-code disambiguation is explicitly **deferred** to a future
> RFC rather than smuggled in here.

## Summary

v1 freezes every numeric and date format to `en-US` so that two conforming
implementations cannot disagree about how `1234.5` or `2026-04-15` renders.
This RFC proposes a minimal, additive locale-negotiation surface: a file
declares the locale it was authored in (`locale` frontmatter, default
`en-US`), an implementation declares the locales it supports
(`supported_locales` in its manifest), and a reader facing a locale it does
not support refuses (`LOC-01`) rather than silently falling back. Rendering
remains deterministic per locale via a curated rules table; cross-locale
conversion is explicitly out of scope.

## Motivation

- `SupportedLocale` in `protocol.ts` is `'en-US'` literally — the only
  allowed value; `NumberFormatRules.locale` / `DateFormatRules.locale` are
  therefore vestigial. The type was always the v2 hook (Protocol §XV lists
  this RFC as the future work that opens it).
- Format spec Part III display rules are hard-coded to US conventions
  (`$`, `1,000.00`).
- Adopters in the EU, UK, and Asia must fork the renderer to get their
  locale's display rules — an entire class of adopters self-excluded from
  conformance.

The cost of getting locale wrong is non-determinism — the same file rendered
by two conforming tools showing different numbers. Negotiation (declare,
support-or-refuse) is what lets adopters opt in without breaking that.

## Proposed change

### The display-only boundary (normative)

`locale` governs **human display renders only**: `chat`, `summary`, report
HTML/PDF, and display strings in view-model/badge surfaces. Everything
machines read stays locale-free, exhaustively:

- **Canonical JSON content** — numbers are JSON numbers, dates ISO-8601,
  rates fractions. Unchanged by this RFC and by any locale.
- **CSV renders** (`formatPercentCsv`, `formatNumberCsv`, the export views)
  — CSV is interchange, not display; separators stay canonical.
- **UW Lite** — its canonical form is a byte-level contract
  (canonicalization + digests); Lite stays locale-frozen for 1.x.
- **Digests, signatures, receipts** — cover canonical bytes; untouched.
- **The calc engine** — locale-invariant. `CalcEvaluationContext.locale`
  exists and the engine never reads it; this RFC widens the *type* and pins
  the *behavior*: evaluation MUST be identical whatever locale a context
  declares. A conformance case pins this.

### Format spec

New frontmatter key and one normative rule in Part III:

```yaml
locale: en-US     # default when absent; one of the SupportedLocale values
```

> A conforming implementation MUST support `en-US` and MAY support
> additional registered locales. When rendering a display surface for a
> file whose `locale` it does not support, an implementation MUST emit
> `LOC-01` (error) and MUST NOT fall back to a different locale — two
> readers disagreeing about what `1.234,56` means is the failure this rule
> exists to prevent. Parsing, validation, editing, and calc of such a file
> are unaffected: the content is canonical and locale-free.

Part III's number/date rules become a **per-locale table**; `en-US` keeps
its current rules verbatim. First wave (each row fully stated in the spec,
each with a conformance fixture): `en-US`, `en-GB`, `de-DE`, `fr-FR`,
`ja-JP`, `zh-CN`. New locales land via small additive RFC amendments to the
table.

Dates: display renders use the locale's convention (`15.04.2026` for
`de-DE`, `2026/04/15` for `ja-JP`); JSON content stays ISO-8601 always
(April's open question, resolved as leaned).

### Protocol spec

- `SupportedLocale` widens to the six-value union.
- `ImplementationManifest` gains `supported_locales?: SupportedLocale[]`
  (absent = `['en-US']`, so every existing manifest keeps meaning what it
  meant). `implementation-manifest.schema.json` updated in lockstep.
- New **`LOC` validator family** registered in §III.6a
  (`VALIDATOR_CODE_FAMILIES`), owned by `validate`:

| Code | Severity | Trigger |
|---|---|---|
| `LOC-01` | error | The file declares a `locale` this implementation does not list in `supported_locales` (or an unregistered tag). Refusal to *render displays*, never to parse. |

- `ModuleManifest.requires_locales?: SupportedLocale[]` (additive,
  optional) for modules that hard-code locale-specific conventions.

### Library

- **`format-rules.ts` (new)** — `BUILTIN_FORMAT_RULES`, a curated
  `Record<SupportedLocale, NumberFormatRules & DateFormatRules>` registry:
  decimal separator, grouping separator, currency symbol + placement,
  percent spacing, date pattern. **Formatting for non-`en-US` locales is
  implemented from these rules directly — never `Intl`/ICU** — because
  runtime ICU differences are exactly the non-determinism this spec
  refuses. `en-US` keeps its existing implementation and byte-identical
  output (every chat/summary baseline in the corpus stays green).
- `format.ts` — `formatCurrency`, `formatPercent`, `formatRatio`,
  `formatCount`, `formatDate`, `formatValue` accept `locale` in their
  existing options objects (additive; default `'en-US'`). CSV formatters
  deliberately do NOT.
- `renderer.ts` — chat/summary read `frontmatter.locale` and thread it
  through display formatting.
- `validator.ts` — `LOC-01` when a declared locale is outside the
  implementation's support (the reference implementation supports the full
  first wave, so its own `LOC-01` fires only on unregistered tags).
- Round-trip: the `locale` key is ordinary frontmatter — Tier-2 byte
  preservation already covers it; it is not immutable (changing it reflows
  displays, not content).

The change is **additive** — files without `locale` behave exactly as
today. Protocol minor bump; format stays 1.1 (one new optional frontmatter
key plus Part III's table refactor, additive at 1.x).

## Compatibility analysis

- **Existing `.uw.md` files** — no breakage; absent `locale` = `en-US`.
- **Tier-1 readers** — an `en-US`-only reader (the manifest default) works
  on every existing file and refuses display renders of a `de-DE` file with
  `LOC-01`, which is the designed behavior.
- **Tier-2 editors** — round-trip preservation already covers the key.
- **Tier-3 calc hosts** — no behavior change, now pinned by fixture.
- **Tier-4 agent hosts** — SHOULD surface the file's locale in agent
  context so generated narrative matches; agents still write canonical
  numbers.
- **UW Lite / receipts / signing / envelope digests** — untouched by
  construction (the display-only boundary).
- **Modules** — `requires_locales` is additive and optional.

No deprecation path. Additive.

## Conformance impact

New named suite `conformance/locale/`:

- `render-de-DE/` — the shared deal rendered under `de-DE`: chat/summary
  baselines with `1.234.567 €`-style figures and `15.04.2026` dates.
- One render fixture per remaining non-`en-US` first-wave locale (same
  deal, per-locale baseline).
- `unsupported-locale-refuses/` — `locale: xx-XX` → `LOC-01`, and the
  document still parses, validates, and calcs.
- `calc-locale-invariant/` — identical calc results under every registered
  locale in the evaluation context.
- `csv-stays-canonical/` — the CSV render of the `de-DE` file is
  byte-identical to the `en-US` file's.

Existing fixtures pass unchanged (implicit `en-US`).

## Reference implementation

- `packages/uwmd-core/src/protocol.ts` — widen `SupportedLocale`,
  `supported_locales` on `ImplementationManifest`, `LOC` family row,
  `LOC-01` remediation.
- `packages/uwmd-core/src/format-rules.ts` (new) — `BUILTIN_FORMAT_RULES`.
- `packages/uwmd-core/src/format.ts` — `locale` in the options objects;
  registry-driven dispatch for non-`en-US`.
- `packages/uwmd-core/src/renderer.ts` — thread `frontmatter.locale`.
- `packages/uwmd-core/src/validator.ts` — `LOC-01`.
- `spec/UW_FORMAT_SPEC_v1.md` — Part III per-locale table + the frontmatter
  key; `spec/UW_PROTOCOL_v1.md` — manifest + family registration;
  `spec/schemas/implementation-manifest.schema.json` in lockstep.
- Protocol version: minor bump.
- Test plan: unit tests per locale per formatter kind from the registry
  rows; the render/refusal/invariance fixtures above.

## Alternatives considered

1. **Per-section locale override** (`locale` in `_meta`). Rejected —
   internally inconsistent files, renderer state complexity; the real use
   case is per-deal.
2. **Runtime locale switching at render time.** Rejected — breaks
   determinism; the file declares, readers support or refuse.
3. **Full ICU locale tag space** (`SupportedLocale = string`). Rejected —
   uncertifiable surface; the closed enum grows by small additive RFCs.
4. **Runtime `Intl` for the new locales.** Rejected in this revision — ICU
   output varies across Node versions and platforms, which would make
   conformance baselines flap. A curated table the spec states verbatim is
   small (six rows), auditable, and deterministic.

## Deferred (explicitly not this RFC)

- **Currency-code disambiguation** — a deal in Mexico authored in `en-US`
  with peso amounts needs a `currency_code` on monetary values before any
  symbol logic can be honest. That is a *data-model* question, not a
  display-negotiation one; it gets its own RFC when an adopter needs it.
  Until then `en-US` renders `$` exactly as today.
- **Cross-locale conversion** — out of scope by design, unchanged from the
  April draft.
- **Localized validation/remediation message text** — codes are the
  contract; message language stays English for 1.x.

## Prior art

- **CommonMark** punts display entirely; not an option — determinism
  *including* display is the value proposition.
- **JSON Schema `format: date`** — wire format defined, display punted; we
  do the same for storage and make display the negotiated surface.
- **ICU locale data** — the source the curated rows are checked against,
  deliberately not a runtime dependency.
- **HTTP `Accept-Language`** — the closest shape: negotiation, evaluated
  here at parse/render time rather than request time.
