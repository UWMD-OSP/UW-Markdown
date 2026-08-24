---
rfc: 0027
title: Declare every asset class's size intensive, once
status: draft
author: jaredmaxey
created: 2026-08-23
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0027: Declare every asset class's size intensive, once

## Summary

Ten asset classes ship with a calc pack, a defaults table, an Excel layout, and
a worked example. Each one divides by a **size intensive** — the denominator of
every per-unit metric: `total_units` for multifamily, `rentable_square_feet` for
office and industrial, `gross_leasable_area` for retail,
`net_rentable_square_feet` for self-storage, `keys` for hospitality,
`total_beds` for student housing, `gross_acres` for land. Exactly one of those —
multifamily's — is named in the format spec. The other nine are established only
by pack source and example files, so every consumer that has needed them
re-derived the vocabulary independently, and the three that *didn't* re-derive
it silently emit nothing: a 142-key hotel exports an empty `total_units` column,
a 42,500 SF office building's Lender Package cover states no size at all, and
the same building's UW Lite summary has no Property section.

This RFC declares the vocabulary in the format spec (§4.1) and adds one
normative **per-class selection table** to the protocol spec — which field is a
given class's size, what to call it, what unit it carries — so the ten copies
collapse into one. It is entirely additive: no existing file changes meaning, no
pack formula changes, and no currently-conforming implementation becomes
non-conforming.

## Motivation

### The spec names one class's vocabulary

`spec/UW_FORMAT_SPEC_v1.md` §4.1's property payload declares exactly four size
fields:

```json
  "total_units": null,
  "total_nra_sqft": null,
  "land_area_sqft": null,
  "land_area_acres": null,
```

The intensives every other class's pack actually reads appear nowhere in the
normative section:

| Asset class | Field the pack divides by | Declared in §4.1? |
|---|---|---|
| `multifamily` | `total_units`, `total_nra_sqft` | yes |
| `office` | `rentable_square_feet` | **no** |
| `industrial` | `rentable_square_feet` | **no** |
| `retail` | `gross_leasable_area` | **no** |
| `self_storage` | `net_rentable_square_feet`, `rentable_units` | **no** |
| `hospitality` | `keys` | **no** |
| `student_housing` | `total_beds` | **no** |
| `senior_housing` | `total_units` | yes |
| `land` | `gross_acres`, `usable_acres`, `entitled_units` | **no** — and §4.1 declares `land_area_acres`, a *different field* that nothing reads |
| `mixed_use` | per component (§4.23) | yes — `section-components.schema.json` declares `total_units` / `total_beds` |

The last row is the tell. RFC 0019 declared the component intensives in a schema
because it had to write one; the property-level intensives were never forced
through the same gate, so they were never declared at all. And `land` is worse
than undeclared: §4.1 offers `land_area_acres`, `LAND_PACK` divides by
`gross_acres` and `usable_acres`, and nothing reconciles them.

### Five consumers, five independent re-derivations

Because the vocabulary is not declared, every tool that needs it reads the packs
and copies the answer:

1. **`packages/uwmd-excel/src/{office,retail,industrial,self-storage,hospitality,student-housing,senior-housing,land}.ts`** — the `WorkbookLayout`s, each hard-coding its class's field.
2. **`tools/web-editor/src/catalog.ts`** — the quick-edit field grid, which acquired the same ten-way mapping in the PR immediately preceding this RFC, and which had shipped *without* it: six of ten classes were offered no size input at all.

And three consumers that never re-derived it, and are wrong today:

3. **`packages/uwmd-core/src/renderer.ts`** — the `csv` one-row-per-deal read model hard-codes a `total_units` column; `summary` and `chat` hard-code a Units line.
4. **`packages/uwmd-core/src/report.ts`** — the §7.1 Lender Package / §7.2 Credit Memo cover facts and property table hard-code `total_units` / `total_nra_sqft`.
5. **`packages/uwmd-core/src/lite-bridge.ts`** — `UW_LITE_FIELD_MAPPINGS` anchors `property.total_units` and `property.total_nra_sqft` and nothing else, so UW Lite cannot express any other class's size.

`BUILTIN_VIEW_MODELS.property` in `protocol.ts` — the table the protocol tells
implementers to use as their default rendering layout — has `total_units` as its
one `primary: true` size field, labeled "Units", for all ten classes.

### What that looks like from outside

Rendering the shipped office and hotel examples, today, on `main`:

```
$ uwmd render examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md --format csv
deal_id,...,asset_class,deal_stage,total_units,year_built,purchase_price,...
uw_2026_hospitality_001,...,hospitality,full_underwrite,,2009,23800000,...
                                                       ^ 142 keys, exported as nothing
```

```
$ uwmd report examples/Riverside-Office-Phoenix-AZ.uwx.md --stdout
  cover facts: Asset class | Vintage | Purchase price | Loan amount
  -> no size fact at all. The multifamily cover carries "Units 48" and "NRA 41,400 SF".
```

```
$ uwmd convert examples/Riverside-Office-Phoenix-AZ.uwx.md --to lite --stdout
  Warning: Lite projection omitted 146 advanced path(s).
  -> and no "# Property" section. The multifamily projection carries
     "Total units: 48" and "Total NRA: 41,400".
```

None of these is a rendering bug to patch in place. Each is a consumer asking
"how big is this deal?" of a format that answers the question for one asset
class out of ten. Patching them one at a time produces a sixth and a seventh
copy of the mapping.

### Why now

The immediate trigger is the web editor: making its field grid class-aware
required the mapping, and writing that mapping down for the second time in a
month made it obvious it belongs in the spec. The deeper reason is that
`mixed_use` landed (RFC 0019) and the capital stack landed (RFC 0026), so the
asset-class matrix is closed at ten. The vocabulary is complete and stable —
this is the moment to declare it, before an eleventh consumer copies it again.

## Proposed change

Three parts: declare the fields (§4.1), declare the *selection* (protocol §XI,
new), and add one validator rule.

### A — Format spec §4.1: declare the fields

Amend the §4.1 property payload to include every class's size intensive, all
optional and all `null` by default. New normative language:

> A property block **MUST** state the size intensive its asset class uses (the
> **primary size field**, per Protocol §XI.1). It **MAY** state any of the
> others. A field that does not apply to the asset class **SHOULD** be `null` or
> absent rather than zero, because zero is a quantity and a denominator, not an
> absence.

Payload additions, after `total_nra_sqft`:

```json
  "rentable_square_feet": null,
  "gross_leasable_area": null,
  "net_rentable_square_feet": null,
  "rentable_units": null,
  "keys": null,
  "total_beds": null,
  "gross_acres": null,
  "usable_acres": null,
  "entitled_units": null,
```

Each gets a one-line definition in the section's field notes. Two need the note
more than the others:

- **`gross_acres` vs. the existing `land_area_acres`.** They are not synonyms
  and the spec must say so. `land_area_acres` is the parcel a *building* sits
  on — a detail field on an improved property. `gross_acres` is the deal's own
  size for a land deal, and `usable_acres` nets out what cannot be built on;
  `LAND_PACK` divides by the latter two. A land deal **SHOULD** state
  `gross_acres` / `usable_acres` and **SHOULD NOT** restate them as
  `land_area_acres`.
- **`total_units` on senior and student housing.** Both classes carry two
  counts. Senior housing sizes per unit and also states beds; student housing
  sizes per bed and also states units. Both figures are legitimate; §XI.1 says
  which one is the denominator.

### B — Protocol spec §XI (new): the size-intensive registry

A normative table — the single place a consumer asks "how big is this deal, and
what do I call it?" — mirrored executably in `protocol.ts`.

| Asset class | Primary | Label | Unit | Secondary |
|---|---|---|---|---|
| `multifamily` | `total_units` | Units | `units` | `total_nra_sqft` |
| `office` | `rentable_square_feet` | RSF | `sqft` | — |
| `industrial` | `rentable_square_feet` | RSF | `sqft` | — |
| `retail` | `gross_leasable_area` | GLA | `sqft` | — |
| `self_storage` | `net_rentable_square_feet` | NRSF | `sqft` | `rentable_units` |
| `hospitality` | `keys` | Keys | `keys` | — |
| `student_housing` | `total_beds` | Beds | `beds` | `total_units` |
| `senior_housing` | `total_units` | Units | `units` | `total_beds` |
| `land` | `gross_acres` | Gross acres | `acres` | `usable_acres`, `entitled_units` |
| `mixed_use` | *(none — per component, §4.23)* | — | — | — |

Normative rules:

- **§XI.1** — The **primary size field** of an asset class is the field its calc
  pack uses as the denominator of its per-unit value metrics. A conforming
  implementation that displays, exports, or indexes a deal's size **MUST**
  select the field through this table and **MUST NOT** assume `total_units`.
- **§XI.2** — `mixed_use` has **no** property-level primary size field. A
  consumer needing a mixed-use deal's size **MUST** read the per-component
  intensives from the `components` section (§4.23) and **MUST NOT** synthesize a
  property-level total by summing across uses, because the components are
  denominated in different units — a bed and a square foot do not add.
- **§XI.3** — The table is closed for protocol 1.x. A module declaring a custom
  asset class (RFC 0003, deferred) will declare its own entry; until that RFC
  lands, an unrecognized asset class has no primary size field and a consumer
  **MUST** degrade to stating no size rather than guessing one.

`mixed_use` returning nothing is deliberate, and is why the lookup's return type
is nullable rather than total. A registry that forced every class to name one
field would have forced a wrong answer here.

### C — Validator: `CC-13`

| Check ID | Description | Sections |
|---|---|---|
| `CC-13` | The property section must state the primary size field for `frontmatter.asset_class` (Protocol §XI.1) | `property`, frontmatter |

**Severity: warning, not error.** A screening-stage deal legitimately does not
know its RSF yet, and the `gaps` / provisional machinery (§III.6a) already owns
"we don't know this yet". An error here would refuse documents the cascade is
designed to accept. `CC-13` does not fire for `mixed_use` (§XI.2) or for an
unrecognized asset class (§XI.3).

`CC-13` joins the cross-section family rather than `FV-*` because it is keyed on
`frontmatter.asset_class`, exactly as `CC-11` is.

## Compatibility analysis

**Existing `.uw.md` / `.uwx.md` files.** None becomes invalid. Every added field
is optional and the one new rule is a warning. All ten worked examples already
state their primary size field — the spec is catching up to the corpus, not the
other way round. A file that would newly warn is one that never stated a size,
which was already unusable for per-unit metrics.

**Tier-1 Reader.** Additive. A reader that ignores §XI keeps working; one that
adopts it renders a size for nine more classes.

**Tier-2 Editor.** Additive. The new fields are ordinary scalars under an
existing section; no edit policy changes.

**Tier-3 Calc Host.** **No change at all** — and this is the load-bearing
compatibility claim. Every pack formula already reads these paths. This RFC
declares what the packs already do; it does not touch a single formula, so no
metric changes value, no receipt over an existing document changes verdict, and
no Excel parity assertion moves. If any number moves, the implementation is
wrong.

**Tier-4 Agent Host.** Additive. `BUILTIN_VIEW_MODELS.property` gains
class-conditional primary fields; a host using the frozen table unchanged keeps
its current rendering.

**Modules.** No manifest schema change. RFC 0003 (custom asset classes,
deferred) will need to declare a size intensive alongside its pack; §XI.3
reserves that.

**The one genuine hazard: the CSV column.** The one-row-per-deal `csv` rendering
has a `total_units` header and a consumer may key on it. Renaming it would break
them. The proposal is therefore additive: keep `total_units` (populated when the
deal has one, empty otherwise, exactly as today) and append `size_basis` and
`size_quantity`. A hotel then exports `total_units=`, `size_basis=keys`,
`size_quantity=142`. Column *order* is part of the contract, so the new columns
go at the end — not next to `total_units`, where they would read better.

## Conformance impact

**Existing fixtures needing updates:** none are expected to change output, and
that expectation is itself an assertion. The Tier-3 and Excel-parity fixtures
must produce byte-identical results, since no formula changes. If
`conformance/3-calc/` or the Excel parity suites move, the implementation has
overreached its mandate.

Fixtures whose expected files change because the rendering intentionally
improves:

- `conformance/1-read/` — any fixture pinning `render --format csv` gains the
  two new columns.
- Any fixture pinning `summary` output for a non-multifamily class gains a size
  line.

**New fixtures** (sketch, under `conformance/size-intensive/`):

1. `registry-covers-every-class` — for each of the ten classes, the §XI table's
   primary field is either present or, for `mixed_use`, explicitly absent. Pins
   §XI.1 and §XI.2 against the shipped table.
2. `pack-agreement` — for each class, the primary size field is a path that
   class's pack actually divides by. This is what keeps the registry from
   drifting from the packs, and it is a **coverage** assertion, not an equality:
   senior housing states beds its pack never divides by.
3. `csv-exports-size-for-every-class` — render each of the ten worked examples
   to `csv`; `size_quantity` is non-empty for nine and empty for `mixed_use`,
   and `total_units` retains its current value for every one of them. The second
   half is the compatibility pin.
4. `report-cover-states-size` — the office example's Lender Package cover
   carries `RSF 42,500`; the hotel's carries `Keys 142`.
5. `lite-round-trip-non-multifamily` — the office example projects to Lite with
   a `# Property` section carrying its RSF, and that Lite source compiles back
   to the same value.
6. `cc-13-warns-and-does-not-refuse` — an office document with no
   `rentable_square_feet` produces a `CC-13` **warning** and still parses and
   calculates.
7. `cc-13-silent-for-mixed-use` — a `mixed_use` document with no property-level
   size produces no `CC-13`.

## Reference implementation

**Files affected:**

- `spec/UW_FORMAT_SPEC_v1.md` — §4.1 payload + field notes; §5.3 gains `CC-13`.
- `spec/UW_PROTOCOL_v1.md` — new §XI.
- `packages/uwmd-core/src/protocol.ts` — the executable mirror: the
  `SIZE_INTENSIVES` table + class-conditional `BUILTIN_VIEW_MODELS.property`.
- `packages/uwmd-core/src/validator.ts` — `CC-13` + its `BUILTIN_REMEDIATIONS`
  entry.
- `packages/uwmd-core/src/renderer.ts` — `csv` gains `size_basis` /
  `size_quantity`; `summary` and `chat` select through the table.
- `packages/uwmd-core/src/report.ts` — cover facts and property table select
  through the table.
- `packages/uwmd-core/src/lite-bridge.ts` — `UW_LITE_FIELD_MAPPINGS` gains an
  anchor per intensive, so Lite can state any class's size.
- `packages/uwmd-excel/src/*.ts` — the layouts read the table instead of
  hard-coding. Behavior unchanged; duplication removed.
- `tools/web-editor/src/catalog.ts` — the field grid's per-class mapping is
  replaced by the table, and its pack-coverage test re-points at it.

**API surface** (all additive exports from `@uwmd/core`, browser-safe):

```ts
export interface SizeIntensive {
  readonly path: string;        // 'keys' — relative to the property section
  readonly label: string;       // 'Keys'
  readonly unit: string;        // 'keys'
  readonly secondary: readonly string[];
}

/** The §XI registry. `null` for mixed_use (§XI.2) and for any unrecognized
 *  class (§XI.3) — never a guess. */
export function getSizeIntensive(assetClass: string): SizeIntensive | null;

/** The deal's size as {basis, quantity}, read through the registry. `null`
 *  when the class has no primary field or the document omits it. */
export function resolveDealSize(
  parsed: ParsedUWFile,
): { basis: string; label: string; unit: string; quantity: number } | null;

export const SIZE_INTENSIVES: Readonly<Record<string, SizeIntensive>>;
```

**Test plan.** Beyond the conformance fixtures: a unit test per consumer
(renderer, report, lite-bridge) asserting a non-multifamily class now states its
size; a table-vs-packs agreement test in core mirroring conformance fixture 2,
so the invariant fails fast in `npm test` and not only under
`npm run conformance`; and a **no-drift** test asserting the multifamily
renderings are byte-identical before and after, since multifamily is the one
class whose output must not change.

Follow-up PR; not bundled with this RFC.

## Alternatives considered

**1. Enumerate the fields in §4.1 and stop — part A without part B.** Declares
the vocabulary, which is the literal gap. But every consumer would still need to
know *which* field is a given class's size, so all five re-derivations survive
and the sixth still gets written. It fixes the documentation defect and none of
the three behavioral ones. Rejected: the duplication is the actual problem, and
declaration without selection does not touch it.

**2. One generic field: `size: { basis, quantity }`.** The cleanest possible
consumer story — one path, no table, no per-class logic anywhere. Rejected on
three counts. It is **breaking**: every pack formula, all ten Excel layouts, and
all ten worked examples would change, and every existing receipt would need
re-issuing against re-authored documents — an enormous blast radius for what is
largely a presentation problem. It **loses information**: senior housing and
self-storage each carry two counts, and a single `quantity` cannot hold both.
And it **reads worse in the file**, which matters for a format whose premise is
that a human can read it — `"keys": 142` says more than
`"size": {"basis": "keys", "quantity": 142}`. Note that the *derived*
`{basis, quantity}` pair is still worth having: it is what `resolveDealSize()`
returns and what the CSV exports. So this alternative is adopted as an output
shape and rejected as a storage shape.

**3. Let each pack declare its own size intensive in its manifest.** The
manifest already carries `asset_classes` and `calculations`, so adding
`size_intensive` is a small step, and it keeps the fact next to the formulas
that use it. Rejected because the consumers that need it most cannot reach it:
the CSV renderer, the report renderer, and the Lite bridge all run on documents
whose pack may not be loaded, and a Tier-1 reader has no pack at all by
definition. Size is a property of the *asset class* — which is frontmatter —
not of the *pack*, which is optional. It belongs in a protocol table Tier-1 can
read. (A module declaring a custom class under RFC 0003 will have to declare
both, which §XI.3 anticipates.)

**4. Infer the size field by looking for whichever intensive is present.**
Requires no spec change: try `total_units`, then `rentable_square_feet`, then
`keys`, and take the first hit. Rejected — it is a guess that silently picks
wrong on exactly the classes that carry two counts. A student-housing deal
states both units and beds; first-match order decides whether its price-per-unit
is per bed or per apartment, and both answers look plausible in a report. An
underwriting format cannot resolve a denominator by search order.

## Unresolved questions

1. **Should `CC-13` ever be an error?** It is proposed as a warning because the
   cascade accepts incomplete early-stage documents. But a deal at
   `deal_stage: credit_approval` with no stated size is arguably not a deal.
   Tying severity to `deal_stage` — warning before `full_underwrite`, error at
   and after — is the obvious refinement, and `DQ-04` already reads `deal_stage`
   for exactly this kind of readiness gate. Deferred because it needs a corpus
   scan to confirm nothing real would newly refuse.
2. **Does `land` need `land_area_acres` deprecated, or just disambiguated?**
   This RFC disambiguates. Deprecating is cleaner but affects improved
   properties that legitimately use it, so it is left alone pending evidence
   that the pair confuses anyone in practice.
3. **Where does `total_nra_sqft` sit for office?** Multifamily's secondary is
   `total_nra_sqft`; office's primary is `rentable_square_feet`, and the two
   measure nearly the same thing under different industry conventions. This RFC
   keeps them distinct because the packs do. Whether they should be unified is a
   real question and a separate one — unifying them breaks `MULTIFAMILY_PACK`.
4. **Should `resolveDealSize()` read the cascade rather than the raw document?**
   Reading through `resolveValue` would let a class default supply a size. That
   seems wrong — a deal's size is a fact about the asset, never a default — but
   it deserves an explicit decision rather than an implicit one.

## Prior art

**Schema.org** faces the same shape with `QuantitativeValue`: a `value` plus a
`unitCode` drawn from a closed external code list (UN/CEFACT), rather than a
field per unit. That is alternative 2, and it works there and not here because
Schema.org has no human-authored-file constraint and no installed base of
formulas keyed on the field name.

**OpenAPI's `discriminator`** is the closer analogue to what this RFC actually
does: a value in one place (frontmatter's `asset_class`) selects which of
several shapes applies, declared in a registry both sides read, rather than each
consumer sniffing the payload. §XI is that registry, and §XI.3's refusal to
guess for an unknown class mirrors OpenAPI's requirement that a discriminator
mapping be explicit.

**IANA-style registries** are the model for §XI.3's closure rule: the table is
closed for 1.x and extended by a documented process (RFC 0003), rather than by
implementations inventing entries and hoping they agree.
