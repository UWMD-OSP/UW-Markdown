---
rfc: 0106
title: Refuse a structured block whose JSON is not an I-JSON object
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0106: Refuse a structured block whose JSON is not an I-JSON object

> **Accepted by the UWMD maintainers, 2026-10-20, as drafted** (owner: "RFC 0106 accepted as drafted (D1 document refusal, D2 not a JSON object or not I-JSON, D3 new SOURCE_BLOCK_MALFORMED (parse), D4 superseded blocks also refused, D5 no version)").
> Origin:
> [#432](https://github.com/UWMD-OSP/UW-Markdown/issues/432), found while
> certifying the independent Python implementation (#354). It adds a Reader
> refusal, so it is normative.

## Summary

Nothing says what a Reader does with a `uw:section` block whose body is not
valid JSON, or is JSON a parser cannot read faithfully. The reference silently
drops a block with a syntax error, reads duplicates and overflowing numbers
lossily, and crashes on a `null` or scalar root. Python refuses, but with no
code. This RFC makes every such block a document refusal with one registered
code, `SOURCE_BLOCK_MALFORMED` (category `parse`).

## Motivation

| Block body | Reference | Python |
|---|---|---|
| Syntax error, empty body | Drops the block silently; `validate` proceeds | Refuses, no code |
| Duplicate member name | Last value wins | Refuses, no code |
| Number outside finite binary64 (`1e999`, a huge integer) | `Infinity` or lost precision | Refuses, no code |
| Escaped lone surrogate | Read as is | Refuses, no code |
| `null`, scalar or array root | `validate` crashes | Refuses, no code |

A record a reader cannot read faithfully must not verify or be re-emitted, or
the Tier-2 byte-preservation and verification guarantees mean nothing. The
Protocol already refuses exactly these defects for the institution configuration
(`VAL-INSTITUTION-CONFIG-MALFORMED`); section blocks have no such rule.

## Proposed change

1. **Format §2.4**: a structured block's body MUST be one JSON object that is
   I-JSON (RFC 7493): unique member names after decoding, numbers representable
   as finite binary64, no lone surrogates.
2. **Protocol §XI** registers `SOURCE_BLOCK_MALFORMED` (`parse`, error): a Reader
   MUST refuse the document, naming the block's line and the defect. No partial
   result is returned.
3. The refusal applies to every structured block, current or superseded, because
   a superseded block is still part of the record a signature covers.

## Compatibility analysis

No compatibility path (prelaunch). A document with such a block was already
either refused (Python) or silently misread (reference); nothing correct is
lost. No corpus document has one.

## Conformance impact

Portable `documents/malformed` cases, one per row of the table, each owing
`SOURCE_BLOCK_MALFORMED`.

## Alternatives considered

- **A block-level finding, and continue.** The rest of the record could still be
  validated, but a reader would then return a parse result that omits or
  misstates authored data, which is what this RFC removes.
- **Accept JavaScript `JSON.parse` semantics.** Last-duplicate-wins and lossy
  numbers are exactly the silent data changes Appendix D bans for frontmatter.

## Decisions (accepted 2026-10-20)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Outcome | Document refusal | Faithful reading is a Reader obligation |
| D2 | What is malformed | Not a JSON object, or not I-JSON | Matches the institution-config rule |
| D3 | Code | New `SOURCE_BLOCK_MALFORMED` (`parse`) | Alternative: reuse `UNSUPPORTED_YAML_FEATURE`, which is about frontmatter |
| D4 | Superseded blocks | Also refused | Part of the signed record |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |
