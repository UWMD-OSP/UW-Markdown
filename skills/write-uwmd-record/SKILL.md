---
name: write-uwmd-record
description: Use when asked to create, draft or fill in a UW Markdown (.uwx.md) commercial real-estate underwriting record from deal facts, an offering memorandum, a rent roll or an operating statement. Produces a record that validates; never calculates financial metrics itself.
---

# Write a UW Markdown record

A `.uwx.md` record is one plain-text file: YAML frontmatter, Markdown narrative,
and labeled JSON blocks holding the deal's typed facts. Deterministic code
calculates and verifies every financial result. Your job is to state the facts
faithfully and explain them, not to compute.

## Rules (never break these)

1. **No financial math.** Do not compute NOI, DSCR, LTV, debt yield, cap rate,
   price per unit, IRR, NPV or any other derived figure. Leave a derived field
   `null`, or compute it with a tool (`uwmd calc`, or the record's calc pack via
   `uwmd scope`) and state the tool's exact value. A stated figure is recomputed
   by every verifier, and a wrong one fails verification.
2. **State only what a source says.** Never invent a missing fact. Leave it
   `null` or absent, and say in the narrative what is missing and why it matters.
3. **Rates are fractions.** `0.055` is 5.5%; never write `5.5` for a rate.
4. **Provenance on every block.** Each JSON block carries a `_meta` object (below).
   When a host application writes the record, the host owns `_meta`; you supply
   the facts.
5. **Append, don't overwrite.** To change a section in an existing record,
   supersede it (Format §2.7) or use `uwmd edit`, which preserves every byte
   outside the edit.

## Workflow

1. **Pick the class and stage.** `asset_class` is one of `multifamily`,
   `office`, `retail`, `industrial`, `self_storage`, `hospitality`, `mixed_use`,
   `senior_housing`, `student_housing`, `land`, `data_center` or
   `manufactured_housing`. `deal_stage` is usually `scope` or `screening` for a
   first draft.
2. **Start from a scaffold**, not a blank page:
   ```bash
   uwmd init --asset-class multifamily --stage screening --name "Parkview Apartments" --output parkview.uwx.md
   ```
   It writes the frontmatter and every section the class and stage need, with
   correct fences and `_meta`. The examples at
   https://github.com/UWMD-OSP/UW-Markdown/tree/main/examples show a filled record
   for every class.
3. **Fill the frontmatter**: `deal_name`, address fields, `asset_class`,
   `deal_stage`. Leave `quick_metrics` values `null` unless a tool computed them.
4. **Fill each section's JSON block** with stated facts: `property` (size,
   year built, units or square feet), `rent_roll`, `operating_statement`
   (historical), `noi_model` (underwritten income and expenses),
   `debt_structure`, `valuation`, `sources_uses`. Write each section's narrative
   above its block: what the source says, what is assumed, what is missing.
5. **Set honest quality.** In each block's `_meta.quality`, `confidence` is
   `high` only for figures read directly from a reliable source. Use `low` and
   `human_review_required: true` for estimates.
6. **Validate**, then fix every error:
   ```bash
   uwmd validate parkview.uwx.md
   ```
   Or call the `uwmd_validate` tool of the UW Markdown MCP connector. Look up an
   unfamiliar code with `uwmd_explain_code`. Fix the stated fact; never edit a
   number just to clear a warning.
   A stage-readiness error (`DQ-04` and its siblings) names the facts the
   chosen `deal_stage` needs: supply them, or choose an earlier stage.
7. **Verify** before handing the record over: `uwmd verify parkview.uwx.md` (or
   `uwmd_verify`). Inspect every stated metric: an `unverifiable` one names missing inputs or unavailable precision and must be disclosed; a `failed` one means a
   stated figure disagrees with its own inputs.

## Block anatomy

A section is a fenced JSON block whose info string names it:

````text
```json uw:section=property source=manual ts=2026-10-20T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": { "source": "manual", "actor": "analyst", "timestamp": "2026-10-20T00:00:00Z" },
    "quality": { "confidence": "high", "human_review_required": false },
    "lifecycle": { "revision": 1, "superseded": false }
  },
  "total_units": 48,
  "year_built": 1986
}
```
````

The fence is exactly three backticks plus `json uw:section=<id>`; tildes or
indented fences are ordinary Markdown, not data. The block body is one JSON
object. `_meta.section` repeats the section id.

## Done means

- `uwmd validate` reports no error, and every remaining warning is explained in
  the narrative.
- `uwmd verify` reports no `failed` statement, and every `unverifiable` statement is disclosed; an exit0 alone does not establish complete assurance.
- A stated LTV has an explicit `ltv_basis` and the matching source input (Format §4.6); never guess a denominator or claim pro-forma support.
- Every figure traces to a source document or is marked as an assumption.

## References

- Format specification: https://uwmd.org/spec/format
- Field reference for each section: Format Part IV
- What each validation code means: `uwmd_explain_code`, or Protocol §XI
- The AI boundary: https://uwmd.org/ai/
