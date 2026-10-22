---
rfc: 0104
title: Validation issue field paths are dotted paths from the payload root; issue order is not normative
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0104: Validation issue field paths and issue order

> **Accepted by the owner, 2026-10-20, as drafted** (owner: "RFC 0104 accepted as drafted (D1 dotted paths from the payload/frontmatter root, D2 issue order not normative, D3 array elements by index, D4 no version allocated)").
> Origin:
> [#424](https://github.com/UWMD-OSP/UW-Markdown/issues/424), found while
> certifying the independent Python implementation (#354). It changes what a
> validation result says, so it is normative. Implementation follows acceptance.

> **Owner rulings, 2026-10-21.** D2 has one normative exception: the
> RFC 0093–0096 metadata and payload passes keep their fixed order (Protocol
> §III.6a). A frontmatter-scoped issue carries `section` `"frontmatter"` in
> every implementation.

## Summary

Protocol §III.6a defines a validation issue's `code`, `severity` and `section`,
but not what `field` means or whether `issues` has an order. Two conforming
implementations differ on both. This RFC makes `field` the dotted path from the
block payload root (from the frontmatter root for frontmatter issues), and
states that issue order carries no meaning.

## Motivation

| Code | Reference (TS) `field` | Python `field` |
|---|---|---|
| `META_FIELD_MISSING_SOURCE` | `source` | `_meta.provenance.source` |
| `META_FIELD_MISSING_TIMESTAMP` | `timestamp` | `_meta.provenance.timestamp` |
| `META_MISSING` | absent | `_meta` |
| `SRC-01` (some paths) | absent | `_meta.provenance.source` |

The newer metadata codes (`META-01`…`META-05`, RFC 0093–0096) already use full
paths in both implementations; the older emitters predate any rule. A consumer
that wants to point an author at the field cannot do so from `source` alone: it
names neither the object nor the nesting.

Issue order differs too (the reference reports `CC-13` first, Python last).
Conformance already compares codes as multisets, but nothing tells a consumer
not to rely on order.

## Proposed change

Protocol §III.6a gains two rules:

1. **`field`** is the dotted path to the offending member, from the block
   payload root for a section-scoped issue (`_meta.provenance.source`,
   `units[3].sqft`) and from the frontmatter root for a frontmatter issue
   (`asset_class`, `quick_metrics.dscr`). An array element is addressed by its
   index in brackets. An issue about a whole block has `field` absent. An issue
   about a missing object names the object (`META_MISSING` → `_meta`).
2. **Order** of `issues` is not normative. A consumer that needs a stable order
   sorts by `(section, field, code)`; conformance compares issues as multisets.

## Compatibility analysis

No compatibility path (the prelaunch rule). Consumers reading the
old short `field` spellings of the `META_*` completeness codes see full paths.
The portable corpus does not pin these spellings, so no frozen expectation
changes; reference-only baselines that do are re-derived in the implementation
PR.

## Conformance impact

A portable case pins `field` for one completeness code, one `SRC-01` path and
one array element, so implementations cannot drift again.

## Reference implementation

Align the reference emitters to rule 1. The implementation PR inventories every
emitter whose `field` is not already a payload path and lists each change.
Python already follows rule 1 for the codes in the table.

## Alternatives considered

- **Leaf names.** Shorter, but ambiguous (`source` under `provenance` and under a
  reserve-account movement are different fields) and unlike the newer codes.
- **Address array elements by their `id`** (`tranches.common.position`, as
  `CS-01` does today) rather than by index. Stable under reordering and easier
  to read, but not a path a generic tool can follow. Recorded as D3.
- **Make order normative.** It would freeze implementation details for no
  consumer benefit.

## Decisions (accepted 2026-10-20)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | What `field` is | Dotted path from the payload (or frontmatter) root | Newer codes already do this; Python does it throughout |
| D2 | Issue order | Not normative; sort by `(section, field, code)` if needed | Conformance already compares multisets |
| D3 | Array elements | By index (`tranches[2].position`) | A path any tool can follow; alternative: by element `id` |
| D4 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |
