---
rfc: 0116
title: Stage readiness by class section, a scope minimum in Format fields, and present meaning stated
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0116: Stage readiness by class section, a scope minimum in Format fields, and present meaning stated

> **Accepted by the owner, 2026-10-22 (second set), as drafted.** Origin: owner ruling of 2026-10-22 (5), taking
> option 1 on bug bash findings #485, #486 and #495. All three change how Format
> §5.1 and Protocol `STAGE_REQUIREMENTS` decide readiness, so they are batched
> here. It changes what validation reports, so it is normative.

## Summary

Bug bash pass 3 found three ways the stage-readiness machinery disagrees with
itself.

- **#485.** `uwmd init` writes data-center and manufactured-housing records
  without the class sections `dc_capacity` and `mhc_sites`. `CLS-03` then
  refuses them at every stage, while every other missing section is a
  readiness question reported as `DQ-06` info.
- **#486.** Scope readiness (`DQ-04`) requires `property.units` or
  `property.asking_price`. Neither is a §4.1 field, so a schema-conformant
  `property` can never be scope-ready.
- **#495.** A section counts as present whatever it holds. A blank record's
  null-filled scaffold sections make it "ready" for every stage from
  screening up, while scope, which also checks fields, is not ready.

This RFC handles the class sections through the stage overlay, defines the
scope minimum in Format fields, makes "present" mean "states something", and
makes readiness cumulative.

## Change

1. **Class sections are stage requirements (#485).** The §5.1 class overlay
   (RFC 0029) gains two rows: `data_center` requires `dc_capacity`, and
   `manufactured_housing` requires `mhc_sites`, from **screening** onward (D1).
   A missing class section is then a readiness gap: `stage_readiness` false,
   and `DQ-06` info at the declared stage, as for any other section. `CLS-03` is
   retired and stays reserved (release rule (b)). `CLS-04`, the field contract
   of a stated class section, is unchanged.
2. **The scope minimum uses Format fields (#486).** Scope requires
   `property.address` and `property.asset_class`. It also requires either the
   class's **primary size field** (Protocol §XIII.1, the field `CC-13` names)
   or `valuation.purchase_price` (D2). This replaces "one of `units` or
   `asking_price`" in Format §2.2 and Protocol `STAGE_REQUIREMENTS.scope`. A
   mixed-use record satisfies the size alternative with any component size its
   slot names.
3. **Present means stated (#495).** A required section counts as present only if
   a current block states at least one non-null value outside `_meta`, `_notes`
   and `_role` (D3). Arrays and objects count when they hold such a value at
   any depth. A section whose every leaf is null, or empty, is a gap.
4. **Readiness is cumulative.** A stage is ready only if every earlier stage is
   ready, so the scope field rules hold at every later stage. `stage_readiness`
   is therefore monotonic: once one stage is false, every later stage is false.
5. **`uwmd init` (starter product).** Init copies `--address` and the asset
   class into `property`, satisfying those portions of scope readiness when
   given those flags. Size or price must still be supplied by the author.
   It writes no other value. (Init never fabricates figures.)

## Validation impact

Records that were "ready"
only through scaffold sections become not ready. Their `DQ-06` info lists
grow, but no verdict on a stated figure changes. A data-center or
manufactured-housing record without its class section no longer fails
validation; it is not ready from screening on.

## Conformance impact

- The class-section cases that expect `CLS-03` become readiness cases (`DQ-06`
  at the declared stage; `stage_readiness` false from screening).
- New cases:
  - a §4.1-conformant scope record that is ready;
  - a scope record with only `valuation.purchase_price` as its size
    alternative;
  - a blank `init` record that is not ready at any stage;
  - a record whose `rent_roll` is all null, which is a gap at term sheet.
- Existing examples are re-checked; any whose readiness changes are listed in
  the implementation PR.

## Reference implementation

Format §2.2, the §5.1 overlay table and text; Protocol `STAGE_REQUIREMENTS`,
the overlay function and the code taxonomy (`CLS-03` retired); `validator.ts`
(`hasStageSection`, `computeStageReadiness`); `builtin-class-validation.ts`;
the Python validator; `init.ts`; the cases.

## Alternatives considered

- **#485: init writes the class section with nulls.** This hides the gap.
  Under item 3 it would still not count as present. Not proposed.
- **#486: add `units` and `asking_price` to §4.1.** This adds two fields that
  duplicate the class size registry and `valuation.purchase_price`. Rejected.
- **#495: present means the block exists.** This is today's rule, and it is the
  defect. Rejected.

## Decisions

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | From which stage the class section is required | Screening | Screening is the first stage that sizes a deal, and price per kW or per site needs the class section. Alternative: scope |
| D2 | Scope's size alternative | The class's primary size field (Protocol §XIII.1) or `valuation.purchase_price` | Both are existing Format fields. Alternative: primary size only |
| D3 | What counts as stated | Any non-null value outside `_meta`/`_notes`/`_role`, at any depth | A null scaffold states nothing. Alternative: every required field non-null (would need a per-section field list) |
| D4 | `CLS-03` | Retired and reserved | Release rule (b) |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0028 (stage table machine-checked, `DQ-06`), RFC 0029 (class overlays),
  RFC 0027 / Protocol §XIII.1 (primary size per class), RFC 0080 (class
  sections).
- Issues #485, #486, #495 (bug bash pass 3).
