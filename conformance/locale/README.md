# conformance/locale

Fixtures for display-locale negotiation (RFC 0001, Protocol §III.1a): the
per-locale rendering table, the `LOC-01` refusal, and the display-only
boundary. All scenarios share [`deal.uwx.md`](deal.uwx.md); the runner injects
the scenario's `locale:` frontmatter line, so the canonical content is
byte-identical across locales by construction.

- `render-<locale>/` — `summary_contains` pins the locale's separators,
  symbol placement, and NBSP usage (the strings carry real U+00A0 where the
  Part III table says NBSP).
- `unsupported-locale-refuses/` — `locale: xx-XX` → `LOC-01` from the
  validator, `UnsupportedLocaleError` from chat/summary, while json/csv
  renders and parsing still work.
- `calc-locale-invariant/` — one formula evaluated under every registered
  locale in the calc context; the values must be identical.
- `csv-stays-canonical/` — the CSV render is byte-identical across locales.
