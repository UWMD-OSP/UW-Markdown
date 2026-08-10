# UW Lite Markdown 1.0

**Extension:** `.uw.md`  
**Media type:** `text/vnd.uwmd.lite+markdown`  
**Representation ID:** `uw-lite-markdown`  
**Status:** implementation draft under accepted RFC 0017

## 1. Purpose and assurance boundary

UW Lite is a constrained Markdown source representation for readable commercial
real-estate underwriting. It is not a second financial model. Conforming
compilers map supported Lite fields into the same UW Document Envelope and
deterministic calculation packs used by UW Extended Markdown (`.uwx.md`).

Normative parsing is deterministic. AI may propose a Lite document through a
separate import workflow, but AI inference is not part of this grammar and AI
does not perform financial calculations.

## 2. Encoding and line structure

A document is UTF-8 text. Readers accept LF or CRLF and retain original source
bytes when exposing a lossless syntax tree. Grammar terminals below operate on
logical lines after removing CR from CRLF.

```ebnf
document       = frontmatter, { line } ;
line           = heading | field | blank | prose ;
heading        = 1*6("#"), wsp, text ;
field          = wsp, bullet, wsp, label, ":", wsp, display-value,
                wsp, anchor ;
bullet         = "-" | "*" | "+" ;
anchor         = "<!--", wsp, "uw:", field-path,
                { wsp, attribute }, wsp, "-->" ;
attribute      = attr-name, "=", attr-value ;
field-path     = alpha, { alpha | digit | "_" | "-" | "." } ;
blank          = { wsp } ;
wsp            = " " | tab ;
```

Labels are presentation only. The anchor field path is semantic. An anchored
line that does not match `field` is an error and must be preserved as opaque
source rather than guessed.

## 3. Frontmatter

The document begins with frontmatter delimited by lines containing only `---`.
Lite 1.0 supports unique top-level `key: value` entries whose values are
strings, finite numbers, booleans, or null. Nested mappings, sequences, anchors,
tags, directives, and block scalars are not supported in the initial profile.

`uw_lite_version` is required and must resolve to `1.0`. A YAML numeric
spelling of `1.0` and the string `"1.0"` identify the same representation
version.

## 4. Fields, values, and units

Example:

```markdown
- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->
- Going-in cap rate: 5.50% <!-- uw:valuation.going_in_cap_rate scenario=base -->
```

Supported display values normalize as follows:

| Display | Semantic value | Default unit |
|---|---:|---|
| `$12,500,000` | `12500000` | `USD` |
| `5.50%` | `0.055` | `fraction` |
| `1.25x` | `1.25` | `ratio` |
| `1,250` | `1250` | absent |
| `true`, `false` | boolean | absent |
| `null`, `~` | null | absent |
| quoted or other text | string | absent |

The optional `unit` attribute overrides the default unit label but does not
change numeric scaling. `period` and `scenario` qualify field identity.
Other attributes are preserved and participate in financial canonicalization.

The tuple `(field-path, period, scenario)` must be unique. Duplicate identities
are errors. Implementations must report unknown field paths during compilation;
the parser itself preserves them.

## 5. Syntax tree and error handling

A lossless reader exposes frontmatter, headings, fields, prose, blank lines, and
opaque nodes with 1-based source ranges and raw text. Unknown headings and prose
are valid and preserved.

Errors include missing/unsupported versions, malformed frontmatter, malformed
anchored fields or attributes, invalid empty values, and duplicate identities.
A document with parsing errors cannot receive a financial canonical digest or a
trusted verification receipt.

## 6. Financial canonical form

The Lite financial canonical form is RFC 8785 canonical JSON containing:

- canonicalization ID `uw-lite-financial`;
- canonicalization version `1.0`; and
- fields sorted by path, period, and scenario, with normalized value, unit,
  qualifiers, and sorted additional attributes.

Labels, headings, prose, field order, bullet character, whitespace, comma
grouping, and equivalent supported numeric display spellings are excluded.
Meaningful field values, units, qualifiers, and additional attributes are
included.

Canonicalization must fail when the parsed document has an error. SHA-256
digests over the exact canonical UTF-8 bytes use the form
`sha256:<lowercase hex>`.

## 7. Canonical rendering

A canonical renderer normalizes line endings, heading spacing, anchored field
layout, attribute ordering, and trailing horizontal whitespace while preserving
frontmatter values, labels, display values, prose, blank lines, and opaque
content. Parsing a canonical rendering must produce the same financial canonical
form as the source.

## 8. Compilation and projections

Parsing and compilation are separate. A compiler validates anchors against a
versioned field catalog, checks required inputs and units, applies only
spec-declared defaults, and returns a UW Document Envelope plus a report of
errors, warnings, defaults, and exclusions.

The reference `deal-summary-v1` bridge maps these aliases:

| Lite path | UW envelope path | Unit |
|---|---|---|
| `acquisition.purchase_price` | `valuation.purchase_price` | `USD` |
| `valuation.going_in_cap_rate` | same | `fraction` |
| `noi.net_operating_income` | `noi_model.net_operating_income` | `USD` |
| `debt.loan_amount` | `debt_structure.loan_amount` | `USD` |
| `debt.interest_rate` | `debt_structure.interest_rate` | `fraction` |
| `debt.annual_debt_service` | `debt_structure.annual_debt_service` | `USD` |
| `property.total_units` | same | absent |
| `property.total_nra_sqft` | same | absent |

Direct paths under registered UW sections are also accepted. Period-qualified
and non-base-scenario fields require later versioned profiles and are rejected
rather than flattened. The complete original Lite source is retained in the
`x_uw_lite_source` envelope extension.

`Lite -> Envelope -> UWX` is deterministic for supported constructs.
`UWX -> Lite` is a named, explicitly lossy projection and must return an
omission report. Projection cannot claim model-fidelity round-trip.

## 9. Verification receipts

Receipts follow accepted RFC 0016, normatively defined in
[`UW_RECEIPT_v1.md`](UW_RECEIPT_v1.md). Issuance and verification are
implemented in `@uwmd/core` (`receipts.ts`) and exercised by
`conformance/receipts/`.

A positive trusted result means signed content is unchanged and deterministic
math agrees with stated inputs, pack, and policy. It does not mean inputs are
true, complete, audited, or supported by source documents. Consumers must not
present a verified receipt as an unqualified checkmark; see
`UW_RECEIPT_v1.md` §1.

## 10. Compatibility

During the transition, structured fenced-JSON content using the legacy
`.uw.md` extension is detected as UWX and remains readable with a migration
warning. A byte-identical sibling `.uwx.md` is the default migration output.
Mixed Lite and UWX markers are ambiguous and require explicit handling.
