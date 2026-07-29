---
rfc: 0015
title: Split Lite .uw.md from Extended .uwx.md
status: accepted
author: jaredmaxey
created: 2026-07-28
accepted: 2026-07-28
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0015: Split Lite `.uw.md` from Extended `.uwx.md`

## Summary

Make `.uw.md` a constrained, human-readable underwriting source format and
rename the existing Markdown-plus-fenced-JSON representation to `.uwx.md`
(UW Extended Markdown). Both compile into the same UW Document Envelope and use
the same deterministic calculation engine. `.uwx.md` remains the lossless,
data-rich representation used by advanced tooling; `.uw.md` becomes the
approachable entry point and bridge from conventional underwriting documents.

This RFC supersedes RFC 0014 only where it assigns the `.uw.md` extension and
canonical-authoring role to the existing structured syntax. RFC 0014's envelope,
model codecs, views, transports, and fidelity rules remain in force.

Tracked by GitHub issue #9; implementation is decomposed in #17, #16, and #12.

## Motivation

The current format is auditable and machine-friendly, but fenced JSON makes the
first encounter feel like a data interchange format rather than an underwriting
document. A simpler Markdown surface can improve adoption if its limits are
explicit and it does not create a second financial model.

- `.uw.md` is readable and editable without specialized software.
- `.uwx.md` preserves the complete envelope, provenance, extensions, variants,
  superseded history, and byte-preserving Tier-2 edit behavior.

Lite is intentionally constrained. Arbitrary prose cannot be mapped reliably to
financial fields, so AI-assisted extraction is a separate import workflow and
never part of normative Lite parsing.

## Proposed change

### Representations and versions

| Representation | Extension | ID | Fidelity | Purpose |
|---|---|---|---|---|
| UW Lite Markdown | `.uw.md` | `uw-lite-markdown` | `source` | Human authoring |
| UW Extended Markdown | `.uwx.md` | `uwx-markdown` | `source` | Complete structured record |
| UW JSON | `.uw.json` | `uw-json` | `model` | Machine interchange |
| UW XML | `.uw.xml` | `uw-xml` | `model` | XML interchange |
| UW CSV bundle | `.uw.csv/` | `uw-csv-bundle` | `model` | Tabular interchange |

The vendor media types are `text/vnd.uwmd.lite+markdown` and
`text/vnd.uwmd.extended+markdown`. Tools MAY accept `text/markdown` when an
extension or explicit codec selection removes ambiguity.

`uw_version` continues to identify semantic UW section behavior and is not
reset by this rename. Lite adds `uw_lite_version`; UWX adds
`uwx_representation_version`. Representation, semantic format, protocol,
envelope, and package versions evolve independently.

### Lite document contract

A Lite document contains YAML frontmatter, recognized headings, anchored field
lines, narrative, supported tables, and optional generated result/receipt
blocks. Friendly labels do not become schema keys:

```markdown
- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->
```

Headings select sections and anchors select exact fields. Values carry explicit
units and optional period/scenario qualifiers. Rates become fractions in the
semantic model even when displayed as percentages.

Unknown headings and prose MUST be preserved. Unknown anchors produce an issue
and remain opaque. A missing anchor MAY resolve only through a deterministic,
versioned alias table; otherwise the parser reports ambiguity instead of
guessing.

### Syntax tree and compiler

The lossless Lite syntax tree includes frontmatter, source locations, headings,
fields, tables, prose, opaque nodes, raw display values, parsed values/units,
qualifiers, receipts, and validation ambiguities.

Parsing does not itself assert a valid financial model. A separate deterministic
compiler validates required fields and produces a `UWDocumentEnvelope` plus a
structured compilation report. It MUST NOT invent missing inputs. Defaults are
allowed only when the semantic specification declares and reports them.

### Conversion guarantees

`Lite -> Envelope -> UWX` is deterministic for supported constructs.
`UWX -> Lite` is an explicitly lossy, named-profile projection and MUST return
a report of omitted, summarized, or unsupported data. It MUST NOT advertise
model-fidelity round-trip.

For the canonical renderer:

```text
compile(parse(lite)) = compile(parse(render(parse(lite))))
```

### Canonicalization

Lite defines:

- a document canonical form covering all meaningful recognized content; and
- a financial canonical form covering compiled inputs, units, periods,
  scenarios, formulas, model, pack, policy, and deterministic results.

Whitespace, bullet style, heading markers, display labels, and supported number
formatting do not change financial identity. Values, keys, units, periods,
scenarios, formulas, pack, and policy do. Canonicalization is versioned and uses
RFC 8785 canonical JSON after parsing; raw Markdown is not the financial hash.

### Protocol capabilities

Existing cumulative Tiers 1-4 continue to apply to UWX and its envelope-backed
workflow. Lite support is advertised separately:

- `lite-read`: parse and validate syntax;
- `lite-compile`: produce an envelope and compilation report;
- `lite-project`: create a named Lite projection;
- `lite-verify`: verify deterministic math and signed receipts.

Tier-2 byte-preserving edits for existing structured documents move with the
representation to UWX.

### Discovery and migration

During transition, readers inspect content as well as extension:

- structured `.uwx.md` is UWX;
- grammar-conforming `.uw.md` is Lite;
- structured legacy `.uw.md` is accepted as UWX with a migration warning;
- ambiguous input requires explicit `--from` and is never silently rewritten.

Migration writes a sibling `.uwx.md` by default and reports detected format,
before/after semantic digests, warnings, and destination. In-place overwrite or
rename requires an explicit option. Legacy structured `.uw.md` reading remains
for at least one stable release; writing it is deprecated immediately.

## Compatibility analysis

- Existing structured documents remain readable and can be renamed byte-for-byte.
- The envelope and calculation packs do not change because the extension changes.
- Globs must add `*.uwx.md`; MIME systems register both vendor types.
- Lite projections cannot carry every UWX feature; their report is mandatory.
- The pre-launch split is reversible by retaining Lite as an optional adapter
  and preserving the legacy alias.

## Conformance impact

Fixtures cover valid Lite field types, formatting equivalence, unknown and
ambiguous fields, invalid units, duplicates, incomplete inputs, deterministic
compilation, lossy projection reports, legacy detection and byte-identical
migration, extension/content mismatch, and opaque-content preservation.

The corpus MUST show that Lite and UWX documents compiling to the same model
produce equal semantic and result digests.

## Reference implementation

1. Rename current adapters/descriptors to UWX and retain a legacy read alias.
2. Add the Lite lexer/parser, AST, validator, renderer, and canonicalizer.
3. Add deterministic compilation and versioned Lite projections.
4. Expose migration/conversion APIs through core and CLI.
5. Update tools, docs, examples, manifests, schemas, and conformance.

Public APIs use typed errors and structured reports; browser-safe APIs are
exported from `@uwmd/core/browser`.

## Alternatives considered

Keeping the current extension and adding `.uw-lite.md` minimizes migration but
keeps the least approachable format as the brand entry point. Free-form
AI-inferred Markdown is nondeterministic and risks placing interpretation inside
AI. A second Lite semantic model would drift. The accepted design instead uses
two source surfaces over one deterministic model.

## Decisions recorded

On 2026-07-28, the owner accepted the `.uw.md` Lite / `.uwx.md` Extended split
during pre-launch. Advanced tools may favor UWX; Lite is an adoption path, not a
replacement for UWX capabilities.
