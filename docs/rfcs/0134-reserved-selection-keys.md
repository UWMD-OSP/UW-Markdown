---
rfc: 0134
title: Refuse reserved section and variant ids in every representation
status: draft
author: UWMD maintainers
created: 2026-11-19
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0134: Refuse reserved section and variant ids in every representation

## Summary

`__proto__`, `constructor` and `prototype` are already refused as section,
variant and annotation keys on the guarded signing and verification projection
(Protocol §V.13.2). The `@uwmd/verify` 4.4.0 Markdown reader also refuses them
as section ids and variants (`RESERVED_SELECTION_KEY`), after advisory
[GHSA-9w76-w6hc-pwj7](https://github.com/UWMD-OSP/UW-Markdown/security/advisories/GHSA-9w76-w6hc-pwj7).
This RFC makes the same three names invalid section ids and variant ids in the
Format itself. Every Reader then refuses them in Markdown, JSON, XML and CSV
alike, with one registered diagnostic.

## Motivation

- Format §2.4 says only that `uw:section` names a section id, and §2.8 leaves
  `variant` as any string. Nothing in the Format excludes the three names, yet
  Protocol §V.13.2 requires signers and verifiers to refuse them.
- `@uwmd/verify` 4.4.0 refuses them in `parseUWFile` while the JSON and XML
  readers still admit a `__proto__` section as an own key. One document can
  therefore be readable in one representation and refused in another, and a
  conversion can fail on a document that was admitted.
- `RESERVED_SELECTION_KEY` is a reference-implementation code with no Protocol
  registration, so an independent Reader has no contract to match.
- These ids are hazards in every implementation language whose readers use
  object or dictionary maps, not only JavaScript. No legitimate section needs
  them.

## Proposed change

**Format §2.4** (after the required-key table), new normative text:

> A section id and a `variant` value MUST NOT be `__proto__`, `constructor` or
> `prototype`. A Reader MUST refuse a document whose structured block names one
> of them as its section id or variant, whether the block is current or
> superseded, with `RESERVED_SELECTION_KEY` (Protocol §XI.3). It returns no
> partial result.

**Format §2.8**: cross-reference the rule above for variant keys.

**Envelope and the JSON, XML and CSV representations**: the same names as a key
of `sections`, `superseded`, `extensions` or a variant map are refused with the
same code before schema admission.

**Protocol §XI.3** (new, after §XI.2): register `RESERVED_SELECTION_KEY` as a
category `parse` refusal, on the model of `SOURCE_BLOCK_MALFORMED`. The message
names the block's opening line (or the representation's member path) and the
reserved name. No partial parse result is returned, so no validation,
verification or receipt operation runs over the document. §V.13.2 keeps its
guarded-path error and cites the Format rule.

**Schemas**: add a `propertyNames` exclusion for the three names to the
envelope section, history, extension and variant maps.

## Compatibility analysis

Apply the [prelaunch policy](https://github.com/UWMD-OSP/UW-Markdown/blob/main/AGENTS.md#prelaunch-policy):
before the 5.0 public launch there is no public compatibility baseline,
migration path, deprecation period or historical-artifact retention
requirement.

The current contract admits these ids in the Format and refuses them only on
the §V.13.2 projection and in the reference Markdown reader. After this RFC
every Reader refuses them in every representation. The Reader tier gains a
refusal; the Verifier tier is unchanged in effect, since it already refused.
No optional profile changes. Protocol types, schemas and normative text change
together (invariant 7).

## Conformance impact

No existing fixture changes; none uses these ids.

New Reader fixtures, each expecting refusal with `RESERVED_SELECTION_KEY`:

- `reader/reserved-ids/section-proto-markdown` (role-variant block),
- `reader/reserved-ids/section-constructor-superseded-markdown`,
- `reader/reserved-ids/variant-prototype-markdown`,
- `reader/reserved-ids/section-proto-json`,
- `reader/reserved-ids/section-proto-xml`,
- `reader/reserved-ids/variant-constructor-json`,
- `reader/reserved-ids/section-prototype-csv`.

## Reference implementation

- **Files affected:** `packages/uwmd-verify/src/protocol.ts` (code registry),
  the envelope, JSON, XML and CSV admission paths in `@uwmd/verify`, the
  envelope and representation schemas under `spec/schemas/`, and the Python
  Reader under `implementations/python`. `parseUWFile` already conforms.
- **API surface:** no new exports. `RESERVED_SELECTION_KEY` becomes a
  registered Protocol code rather than a reader-only one.
- **Test plan:** the fixtures above in both reference Readers, plus unit tests
  that each representation refuses all three names as a section id, a
  superseded section id and a variant, and that a conversion between
  representations never admits one.

## Alternatives considered

- **Keep them as own keys everywhere** (null-prototype maps only). Safe in
  JavaScript, but leaves every other implementation to rediscover the hazard,
  and keeps the Format and §V.13.2 in disagreement. Rejected.
- **Restrict section ids to `[a-z][a-z0-9_]*`** (the `segment` grammar used for
  asset classes). This would exclude `__proto__` but not `constructor` or
  `prototype`, and is a much larger change to custom and extension ids. Out of
  scope; it could follow separately.

## Unresolved questions

- Whether the same three names should also be reserved as `_meta` and
  extension member names in every representation, not only as selection keys.
  §V.13.2 already refuses them as frontmatter mapping keys; this RFC does not
  widen the rule further.

## Prior art

- The OWASP prototype pollution guidance and CWE-1321 recommend refusing these
  names at the input boundary rather than relying on map construction alone.
- JSON Schema's `propertyNames` keyword is the standard way to exclude member
  names from an object map.
