---
title: "Your first .uw.md file"
---

# Your first `.uw.md` file

This walks you from a blank file to a parseable, validatable
`.uw.md` deal in about ten minutes. No prior CRE knowledge required.

If you're already familiar with markdown frontmatter and want the full
schema, skip to the [format spec](/spec/format).

## Goal

By the end you'll have a 30-line `.uw.md` file containing:

- Frontmatter identifying the deal.
- One `property` section.
- Enough metadata that the validator and any Tier-1 reader can
  display it.

This is *intentionally* the smallest conformant file, not a realistic
underwrite. To see a full deal, look at
[`examples/Parkview-Apts-Glendale-AZ.uwx.md`](https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples/Parkview-Apts-Glendale-AZ.uwx.md)
once you're done here.

## Step 1 — Create the file

Make a new file called `hello-deal.uw.md`. The `.uw.md` extension is
the convention; tools recognize it automatically.

## Step 2 — Add the frontmatter

Frontmatter is the YAML block between two `---` lines at the top of
the file. Paste this at the top:

```yaml
---
uw_version: "1.1"
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

- `uw_version` — declares the format version. Use `"1.1"` for a new
  file today.
- `deal_id` — your own unique identifier; any string works.
- `quick_metrics` — denormalized financial summary used for fast
  pipeline routing. Required for screening-stage files.
- The other fields are conventional and surface in most tools.

If you're not sure what some of these terms mean (DSCR, debt yield,
cap rate), see the [glossary](/guide/glossary).

## Step 3 — Add a property section

Below the closing `---`, add a markdown heading and a fenced JSON
block:

````markdown
# Hello Deal

A minimal `.uw.md` file showing how property details are stored.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "manual",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
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
    "amenities": ["pool", "laundry"]
  },
  "_notes": null
}
```
````

The fence header `json uw:section=property ...` is what binds the
JSON block to the registered `property` section. Without it the
parser treats the block as opaque markdown.

The `_meta` object records who wrote the block, when, and with what
confidence. Every section block needs one — see the
[`_meta` reference](/spec/format#provenance) for what each field means.

## Step 4 — Validate it

If you have the reference CLI installed:

```bash
npx uwmd validate hello-deal.uw.md
```

You should see no errors. If the validator complains:

- "Missing required frontmatter field" — add the field listed in the
  error.
- "Section X has malformed `_meta`" — check that every key in `_meta`
  is present, even if `null`.
- A `CC-NN` code — see the [validator code taxonomy](/spec/protocol#iii-6a-validator-code-taxonomy)
  for what each prefix means.

## Step 5 — Open it in a viewer

Drag `hello-deal.uw.md` into the
[reference web viewer](https://github.com/UWMD-OSP/UW-Markdown/tree/main/tools/web-viewer)
(`tools/web-viewer/index.html`). You'll see the deal rendered with
the property section as a card.

## Where to go next

- **Add more sections.** Try a `rent_roll`, `noi_model`, or
  `debt_structure`. Each is registered in the format spec; the same
  fence header pattern applies.
- **Try the supersede pattern.** Edit your file by *appending* a new
  block with `_meta.supersedes` pointing at the previous block's
  `_meta` ID. The old block stays in the file with `superseded: true`.
- **Wire up calc.** A Tier-3 calc host evaluates safe-expression
  formulas (cap rate, DSCR, etc.) against your sections. See the
  [protocol §VIII](/spec/protocol#viii-calc-engine).

If you're picking which tool to reach for, the
[tools comparison](/guide/tools) has a decision tree.
