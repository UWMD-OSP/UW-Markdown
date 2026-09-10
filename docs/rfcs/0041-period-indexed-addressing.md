---
rfc: 0041
title: Period-indexed addressing — one period axis over the format's per-period series
status: draft
author: jaredmaxey
created: 2026-09-10
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0041: Period-indexed addressing — one period axis over the format's per-period series

> The format carries per-period data in **four unrelated dialects**:
> positional rows with a `year` field (`dcf.annual_cash_flows[N]`),
> year-keyed objects (`noi_model.projections.year_N`), calendar period
> strings (`lease_up_schedule.schedule[].period`, `2026-Q3` / `2026-07`)
> and ISO dates (`cash_flow_series.series[].date`,
> `distribution_waterfall.stated_schedule[].date`). A row is addressable only by
> its **position** in an array, which is not what any consumer means —
> "year 3 NOI" is a period, not an index — and any consumer that keys
> facts by path without array indices (the assumptions-registry contract,
> and every fact shredder built on it) collapses a whole series into one
> leaf. This RFC adds a **period selector** to dot-path addressing
> (`dcf.annual_cash_flows@Y3.net_operating_income`), a **registry** that
> says, per section path, which row field names the period and in which
> grammar, and a **canonical period key** so a fact can be keyed
> `(path, period)` across every dialect. It mandates no storage shape and
> renames no field. Protocol 2.6.0 → 2.7.0; the format version does not
> move.

## Summary

Three additive changes:

1. **Protocol §VIII.2 addressing** gains a period selector on a dot-path
   segment: `<series-path>@<period>` resolves to the row of a registered
   period series whose period key equals `<period>`, wherever the row
   sits. `annual_cash_flows@Y3` is year 3 whether it is row 0, row 2, or
   absent (→ `null`, the §VIII.2 posture). Positional `[N]` stays valid
   and means what it always meant: a position.
2. **A period-series registry** (`PERIOD_SERIES`, normative, exported by
   the reference library) lists every standard-section path that is a
   per-period series, the row field (or key pattern) that names its
   period, and the period **grammar** it uses. Modules MAY register
   their own series the same way (RFC 0003 posture).
3. **A canonical period key** (§VIII.2a): every registered grammar maps
   to `{ kind: 'year' | 'quarter' | 'month' | 'date', index?: integer,
   date?: string }` by an exact rule, so a consumer can key a fact
   `(path, canonical period)` and compare year 3 across producers that
   wrote `year: 3`, `year_3`, `2028-Q1` or `2028-01-01` — the "second
   dimension the leaf row has no column for".

Two validator rules (`PS-01`, `PS-02`) make the registry checkable.
Nothing a conforming file states today changes meaning.

## Motivation

**The measurement.** The first production implementation shreds every
deal into a fact table keyed by the assumptions-registry path dialect,
whose contract is that a path "can never contain an array index"
(object keys only; an array is itself a leaf). Over its nine canonical
class documents: **2,664 facts, of which 592 (22%) are composites** — a
per-period array stored as one JSONB leaf — against 16,299 leaves when
the same documents are walked with `[i]` indices. Most of that gap is
the per-period spine of a deal (`annualNOI`, `annualOpEx`,
`monthlyTILC`, reserve balances) collapsing from ~30 rows each into one.
The values are not lost; what is lost is that **a period is not a row**:
you cannot index on it, group by it, join two deals' year-3 NOI, or put
`WHERE period = 3` in front of a query planner. The implementation's own
finding, in protocol terms: *"period is not a footnote on the unit but a
SECOND dimension the leaf row has no column for … or every array-valued
leaf is un-aggregatable across producers."*

**Why the app cannot fix it alone.** It could mint a period grammar of
its own (0- or 1-based? month or year? what names a period on an
irregular ledger?) and build a period-indexed relation on it. That is
the pre-RFC-0031 failure mode — several near-identical private dialects,
none of them the format's — and the same implementation declined to do
it for exactly that reason (its decision record: *"do not adopt a
grammar ahead of the corpus/spec that supports it"*). The right home for
a period axis is the protocol, once, for every implementer's analytics.

**Why the format cannot answer it today.** Measured at 2.6.2, the
standard sections carry per-period data four ways:

| Section path | Row / key shape | Period named by | Grammar |
|---|---|---|---|
| `dcf.annual_cash_flows` | array of rows | `year` field, integer, 1-based | year index |
| `noi_model.projections` | object keyed `year_1`, `year_2`, … | the key | year index |
| `lease_up_schedule.schedule` | array of rows | `period` field | `YYYY-Qn` or `YYYY-MM` (`LU-01`), one cadence per schedule |
| `cash_flow_series.series` | array of rows | `date` field | ISO-8601 date (RFC 0034) |
| `distribution_waterfall.stated_schedule` | array of rows | `date` field | ISO-8601 date (RFC 0035) |

None of these is wrong on its own — each grammar suits its section.
What is missing is (a) a way to **address** a row by its period rather
than its position, (b) a **declaration** of which field is the period so
a generic consumer does not have to know each section by hand, and (c)
one **comparable** period key across the grammars. The format's own
reference-path notation already reaches for this and cannot express it:
§4 "Reference path notation" documents `dcf.annual_cash_flows[N]` and
the custom-calculation table's "cash-on-cash in a specific year" reads
`annual_cash_flows[N].net_cash_flow_levered` — a **position** standing
in for a **year**, correct only while producers write rows in order from
year 1 with no gaps, which nothing checks.

## Proposed change

### A. Protocol §VIII.2 — the period selector (normative)

A dot-path segment MAY carry a period selector: `<segment>@<period>`.

- The selector is valid only on a segment whose full path is a
  registered period series (§C). On any other segment it is a
  resolution error (`calc` category, `PROTO-CALC-0xx`), not `null` — a
  misspelled series path must not silently read nothing.
- `<period>` is one of the **selector grammars**:
  - `Y<n>` — year index, integer ≥ 1;
  - `Q<n>` — quarter index, integer ≥ 1 (1 = the first period of the
    series' declared cadence, when the cadence is quarterly);
  - `M<n>` — month index, integer ≥ 1;
  - `<YYYY-MM-DD>` — a calendar date;
  - `<YYYY-Qn>` / `<YYYY-MM>` — a calendar quarter / month (the `LU-01`
    literals).
- Resolution: the series' rows are read through its registry entry
  (§C), each row's period is canonicalized (§B), the selector is
  canonicalized the same way, and the first row whose canonical key is
  equal is the result. No row → `null` (§VIII.2: a missing path resolves
  to null). A selector whose `kind` cannot compare with the series'
  kind (a date on a year-indexed series, a year index on a dated
  series) → `null` with a `PS-03` warning at validation time when the
  reference is static (a custom calculation), silent at evaluation
  time.
- Positional `[N]` is unchanged and continues to mean the N-th element.
  Both may appear in one path (`series@Y3.tiers[0]`), each on its own
  segment.
- `@` is reserved: a **key** containing `@` MUST be addressed through
  the existing escape (none exists today — `@` is not a legal
  identifier character in the calc grammar, so this is a non-issue for
  custom calculations; for `ProtocolError.pointer` and
  `_meta.field_overrides` paths, which are strings, implementations
  MUST treat `@` as the selector and MUST NOT emit keys containing it).

### B. Protocol §VIII.2a — the canonical period key (normative)

```ts
type PeriodKey =
  | { kind: 'year';    index: number }          // 1-based hold year
  | { kind: 'quarter'; index: number }          // 1-based, within the series
  | { kind: 'month';   index: number }          // 1-based, within the series
  | { kind: 'date';    date: string }           // ISO-8601 YYYY-MM-DD
```

Canonicalization is per **grammar**, exact, and total:

| Grammar | Canonical key |
|---|---|
| year index (`year: 3`, `year_3`, selector `Y3`) | `{ kind: 'year', index: 3 }` |
| `YYYY-Qn` in a quarterly series | `{ kind: 'quarter', index: i }` where `i` is the row's 1-based position in the **gap-free** series (`LU-02` guarantees contiguity, so position and period agree) |
| `YYYY-MM` in a monthly series | `{ kind: 'month', index: i }`, same rule |
| ISO date | `{ kind: 'date', date }` verbatim |

Two keys are **equal** when `kind` and (`index` or `date`) are equal.
Keys of different `kind` are never equal; the RFC deliberately does
**not** define year-of-a-date or month-of-a-year conversions — those
need a deal calendar (an acquisition date and a day count) that not
every file states, and inventing one silently is the wrong default.
A future RFC may add a **calendar-anchored** projection (`kind:
'date'` → `kind: 'year'` given `deal.acquisition_date` and a §VIII.9.1
day count) once the corpus shows the need; see Unresolved questions.

### C. The period-series registry (normative; `PERIOD_SERIES`)

```ts
interface PeriodSeriesEntry {
  path: string;                 // dot-path to the series, section-rooted
  shape: 'rows' | 'keyed';      // array of rows | object keyed by period
  period_field?: string;        // shape 'rows': the row field naming the period
  key_pattern?: string;         // shape 'keyed': e.g. '^year_(\\d+)$', group 1 = index
  grammar: 'year_index' | 'calendar_period' | 'iso_date';
  cadence_field?: string;       // grammar 'calendar_period': the sibling field naming the cadence
  spec_ref: string;
}
```

Initial entries (all measured at 2.6.2 — nothing here is a new field):

| `path` | `shape` | period | `grammar` | spec |
|---|---|---|---|---|
| `dcf.annual_cash_flows` | rows | `year` | `year_index` | §4.9 |
| `noi_model.projections` | keyed | `^year_(\d+)$` | `year_index` | §4.5 |
| `lease_up_schedule.schedule` | rows | `period` | `calendar_period` (cadence `period_granularity`) | §4.25 |
| `cash_flow_series.series` | rows | `date` | `iso_date` | §4.26 |
| `distribution_waterfall.stated_schedule` | rows | `date` | `iso_date` | §4.27 |

The registry is **exported** by the reference library (`PERIOD_SERIES`,
frozen, beside `BUILTIN_REMEDIATIONS`) and mirrored in the protocol
spec by a table that a test reads back from the spec — the
`BUILTIN_REMEDIATIONS`-vs-§5.3 lesson of 2.6.2 applies: two copies of a
registry with no test comparing them will drift.

Modules MAY register entries for their own sections (`org.uwmd.*`
paths) through their manifest; the runtime merges them for resolution.
An entry whose `path` is not a section the file carries is simply
unreachable, not an error.

### D. Validator rules

| Code | Severity | Rule |
|---|---|---|
| `PS-01` | warning | A registered series (present in the file) has a row whose period field is absent, or whose value does not parse under the registered grammar. Names the row's position. |
| `PS-02` | error | Two rows of a registered series canonicalize to the same period key. (A year stated twice is a contradiction, not a restatement.) |
| `PS-03` | warning | A static period selector in a custom calculation or scenario targets a series whose kind cannot compare with the selector's (§A). |

`LU-01`/`LU-02` are unchanged and remain the owners of the lease-up
schedule's own grammar and contiguity; `PS-01` reads through them, it
does not restate them. `PS-*` is a new code family; §III.6a's family
table gains a row (the RFC 0030 test that every emitted code has a
family will fail until it does — by design).

### E. The consumer story (informative)

A fact consumer that must not carry array indices keys a per-period
fact as `(path, PeriodKey)` — for a row series, the fact path is the
series path plus the leaf name (`dcf.annual_cash_flows.net_operating_income`)
and the period is the second column; for a keyed series the pattern
group supplies the index and the key is dropped from the path
(`noi_model.projections.projected_noi` @ year 2). This is exactly the
relation the motivating implementation deferred building until the
protocol named the axis. A row-per-period relation, a JSONB leaf, and a
columnar store are all conforming storages of the same facts; the RFC
defines the **address**, not the storage.

### F. What this RFC does not change

- No section gains or loses a field; no row is renamed. Files at 2.6.x
  validate identically save for `PS-01`/`PS-02` on series that were
  already malformed (a row with no `year`, or two rows for one year).
- Positional addressing. `[N]` stays; the reference-path prose gains a
  sentence saying `@` is the period form and `[N]` the positional one.
- Calc builtins (§VIII.3). `sum(dcf.annual_cash_flows[*].x)`-style
  wildcards are **not** proposed here (Unresolved questions).
- Receipts. Addressing does not change bytes; no receipt baseline
  moves.

## Compatibility analysis

- **Existing files** — no file contains `@` in a path today (measured:
  the corpus's custom calculations and `field_overrides` paths carry
  none; implementers SHOULD confirm on their own corpora before
  upgrading their resolvers). All resolve as before.
- **Tier-1 readers** — gain `PS-01`/`PS-02`; a 2.6.x reader on a 2.7.0
  file with `@` selectors in a custom calculation resolves them to
  `null` (unknown segment) — a visible under-report, the §XII.4 skew
  posture, no shim.
- **Tier-2 editors** — untouched; edits address by JSON path and
  `_meta.field_overrides` by the existing string grammar, which now
  admits `@` (§A) but never requires it.
- **Tier-3 calc** — the resolver gains one segment form; every existing
  expression evaluates byte-identically.
- **Modules** — additive registration through the manifest; a module
  that registers nothing is unaffected.
- **Lease-up schedules** — canonical `quarter`/`month` indices are
  defined by position **because** `LU-02` makes the series gap-free;
  a schedule that violates `LU-02` already fails validation, so the
  canonical key is never computed over a gapped series.

## Conformance impact

New in `conformance/period-series/`:

| Scenario | Pins |
|---|---|
| `accept-01-year-selector` | `dcf.annual_cash_flows@Y3.net_operating_income` in a custom calculation reads the row with `year: 3` when rows are stated out of order. |
| `accept-02-keyed-year` | `noi_model.projections@Y2.projected_noi` reads `year_2`. |
| `accept-03-calendar-period` | a quarterly lease-up schedule; `@2026-Q4` and `@Q2` read the same row. |
| `accept-04-iso-date` | `cash_flow_series.series@2027-03-15.amount`. |
| `accept-05-positional-unchanged` | `[N]` on the same file reads by position; the two forms disagree on the out-of-order file and both are right. |
| `reject-01-duplicate-period` | two `year: 3` rows → `PS-02`. |
| `warn-01-period-absent` | a row with no `year` → `PS-01`. |
| `warn-02-kind-mismatch` | `annual_cash_flows@2027-01-01` in a custom calculation → `PS-03`, evaluates `null`. |
| `reject-02-selector-unregistered` | `@Y3` on `rent_roll.units` → the resolution error. |

Roughly 9 fixtures; `gen-conformance-cases` for the runner.

## Reference implementation

`packages/uwmd-core`:

- `protocol.ts` — `PERIOD_SERIES`, `PeriodKey`, `canonicalPeriod(entry,
  rowOrKey)`, `PS-*` remediations, the `PS` code family.
- `parser.ts` — `deepGet` learns the `@` segment: split the segment on
  `@`, look the path-so-far up in the merged registry, canonicalize and
  scan. Everything else in `deepGet` is unchanged (measured: today it
  rewrites `[N]` to `.N` and walks keys — the selector is one extra
  branch before that rewrite).
- `validator.ts` — `PS-01`/`PS-02` over the registry; `PS-03` over
  static references in `custom_calculations` / `custom_scenarios`.
- `spec/UW_PROTOCOL_v1.md` §VIII.2, new §VIII.2a, the registry table;
  `spec/UW_FORMAT_SPEC_v1.md` reference-path prose; §5.3-style table
  for `PS-*`.
- Tests: the registry read back from the spec table; canonicalization
  over every grammar; the nine scenarios.

Estimated size: a day. Nothing in `module-runtime.ts` moves unless a
module registers a series.

## Alternatives considered

- **Mandate one period grammar everywhere** (rewrite `annual_cash_flows`
  rows to carry a `period` string, or `lease_up_schedule` to carry a
  year index). Rejected: a breaking format change to fix an addressing
  gap, and each section's grammar is right for its section — a dated
  irregular series has no year index, a stabilized projection has no
  calendar.
- **A sidecar** (RFC 0015-style) listing per-period facts in one
  normalized shape. Rejected: it duplicates the document's own data and
  invites the two copies to disagree; the registry approach declares
  where the data already is.
- **Positional addressing plus a rule that rows must be in period
  order from 1 with no gaps.** Rejected as the sole answer: it makes
  `[N]` mean a period only by convention, still leaves four grammars
  for a consumer to know by hand, and does nothing for keyed objects
  or dated series. (`PS-02` and `LU-02` keep the useful half of it.)
- **Leave it to implementations.** Rejected by the motivating
  implementation itself: it declined to mint a private dialect and
  asked for this instead.

## Unresolved questions

- **Calendar anchoring** — whether to define `date → year` given
  `deal.acquisition_date` (or `cash_flow_series.day_count` and RFC 0034's
  exponent rule), so a dated series can be joined to a year-indexed one.
  Deferred: needs the corpus to show two series on one deal that a
  consumer wants joined, and a decision on whose calendar wins.
- **Wildcards** — `series@*` / `series[*]` as an array-valued reference
  for `sum(...)` in custom calculations. Useful, separate.
- **Selector on a variant map** — when a series' section is a variant
  map, resolution follows RFC 0037's order (and RFC 0040's roles if
  accepted) before the selector applies; confirm at implementation that
  no special case is needed.
- **`Q<n>`/`M<n>` on a calendar series** — index-within-series (proposed)
  vs. index-from-acquisition. Proposed is the only one computable
  without a calendar; flip at acceptance if a calendar rule lands first.

## Prior art

- RFC 0034 (calendar-anchored cash flows) — dated series, day counts.
- RFC 0035 (distribution waterfall) — dated distributions.
- RFC 0021 §6 / §4.25 (lease-up schedule) — `LU-01` period grammar and
  `LU-02` contiguity, which this RFC leans on rather than restates.
- RFC 0031 (actor source grammar) — the "one grammar, not several
  near-identical dialects" argument, applied here to periods.
- RFC 0037 / RFC 0040 — resolution over variant maps, which a selector
  sits after.
- The 2.6.2 `BUILTIN_REMEDIATIONS` fix — why the registry is read back
  from the spec by a test.
- underwriter.cc TASK-990 (finding 2), TASK-1033, Q-385 and TASK-1053 —
  the measurements and the decision to raise this upstream rather than
  fork a dialect.
