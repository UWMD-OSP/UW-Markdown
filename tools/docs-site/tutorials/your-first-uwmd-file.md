---
title: "Your first UW Markdown file"
---

# Your first UW Markdown file

This walks you from a blank file to a parseable, validatable deal in
about ten minutes. No prior CRE knowledge required.

If you're already familiar with markdown frontmatter and want the full
schema, skip to the [format spec](/spec/format) and the
[format 2.0 delta](/spec/format-v2).

## Goal

By the end you'll have a small `.uwx.md` file containing:

- Frontmatter identifying the deal.
- One `property` section with full provenance.
- Enough metadata that the validator and any Tier-1 reader can
  display it.

This is *intentionally* the smallest useful file, not a realistic
underwrite. To see a full deal, look at
[`examples/Parkview-Apts-Glendale-AZ.uwx.md`](https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples/Parkview-Apts-Glendale-AZ.uwx.md)
once you're done here.

> **The zero-effort path:** `npx @uwmd/cli init` scaffolds a complete
> format-2.0 file with every standard section stubbed out. This tutorial
> builds a file by hand instead, so you understand what each piece is.

## Step 1 — Create the file

Make a new file called `hello-deal.uwx.md`.

Two extensions exist, and they mean different things: **`.uwx.md`** is a
structured record — typed JSON sections with provenance, which is what
this tutorial builds — while **`.uw.md`** is
[UW Lite](/guide/lite-and-uwx), a minimal human-first profile. Tools
recognize both automatically.

## Step 2 — Add the frontmatter

Frontmatter is the YAML block between two `---` lines at the top of
the file. Paste this at the top:

```yaml
---
uw_version: "2.0"
deal_id: HELLO-001
deal_name: "Hello Deal"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "100 Test Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
tier: screener
created_by: "manual"
---
```

A few notes on what's required:

- `uw_version` — declares the format version. `"2.0"` is current;
  readers also accept `"1.0"` and `"1.1"` files forever — a file keeps
  the behavior of the version it declares.
- `deal_id` — your own unique identifier; any string works.
- `quick_metrics` — denormalized financial summary used for fast
  pipeline routing. Required for screening-stage files. Note that rates
  are **fractions, not percents**: `0.06` means 6%.
- The other fields are conventional and surface in most tools.

If you're not sure what some of these terms mean (DSCR, debt yield,
cap rate), see the [glossary](/guide/glossary).

## Step 3 — Add a property section

Below the closing `---`, add a markdown heading and a fenced JSON
block:

````markdown
# Hello Deal

A minimal `.uwx.md` file showing how property details are stored.

## Property {#property}

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B",
  "asset_subtype": "garden",
  "total_nra_sqft": 45000,
  "land_area_acres": 2.1,
  "stories": 2,
  "parking_spaces": 75,
  "parking_type": "surface",
  "zoning": "R-3",
  "condition": "good",
  "amenities": ["pool", "laundry"],
  "_notes": null
}
```
````

Three things to notice:

- The fence header `json uw:section=property ...` binds the JSON block
  to the registered `property` section. Without it the parser treats
  the block as opaque markdown. The header values (`source`, `ts`,
  `v`, `confidence`) mirror the `_meta` inside so tools can scan a file
  without parsing every block — keep them in sync when you edit.
- The `_meta` object is the block's provenance, in three groups:
  **`provenance`** (who wrote it, when, from what source),
  **`quality`** (confidence, review flags), and **`lifecycle`**
  (revision number, superseded or not). Every section block carries
  one — see the [format 2.0 spec](/spec/format-v2) for each field.
- The section's actual data (`total_units`, `year_built`, …) sits at
  the top level of the block, right beside `_meta`.

## Step 4 — Validate it

If you have the reference CLI installed:

```bash
npx @uwmd/cli validate hello-deal.uwx.md
```

You should see **no errors** — just two `[INFO]` notes (`DQ-06`)
telling you a screening-stage deal usually also carries
`debt_structure` and `validation` sections. That's the validator being
helpful about completeness, not a failure; add those sections the same
way when you're ready.

If it complains instead:

- "Missing required frontmatter field" — add the field listed in the
  error.
- A malformed-`_meta` error — check that every key in each of the three
  `_meta` groups is present, even if `null`.
- A `CC-NN` code — see the [validator code taxonomy](/spec/protocol#iii-6a-validator-code-taxonomy)
  for what each prefix means.

## Step 5 — Open it in a viewer

Drag `hello-deal.uwx.md` into the
[reference web viewer](https://github.com/UWMD-OSP/UW-Markdown/tree/main/tools/web-viewer)
(`tools/web-viewer/index.html`). You'll see the deal rendered with
the property section as a card.

## Where to go next

- **Add more sections.** Try a `rent_roll`, `noi_model`, or
  `debt_structure`. Each is registered in the format spec; the same
  fence header pattern applies.
- **Try the supersede pattern.** Edits never destroy history: append a
  new block for the same section with `lifecycle.revision` incremented,
  and the old block stays in the file with `superseded: true`.
- **Wire up calc.** A Tier-3 calc host evaluates safe-expression
  formulas (cap rate, DSCR, etc.) against your sections. See the
  [protocol §VIII](/spec/protocol#viii-calc-engine).
- **Verify it.** `npx @uwmd/cli receipt issue hello-deal.uwx.md` writes
  a [verification receipt](/guide/receipts) attesting that the deal's
  computed outputs follow from its stated inputs.

If you're picking which tool to reach for, the
[tools comparison](/guide/tools) has a decision tree.
