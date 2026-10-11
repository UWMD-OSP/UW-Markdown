# Starter products: Defaults and the fallback cascade

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL_v1.md)
> §V.7 and §V.8
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D4). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

### V.7 Fallback cascade

A producer that needs to assign a value to a field for which no
explicit user input or document extraction is available MUST resolve
the value by walking the following ordered cascade. The first step
that yields a value wins. The producer MUST stamp the resulting
`_meta.resolution` (or, when only a subset of fields was resolved this
way, a `_meta.field_overrides[].resolution`) with the cascade step
that produced the value; a leaf-level `resolution` wins over the
block-level one for its path. (Before RFC 0031 split the field, the
tag was stamped into `_meta.source`; readers MUST interpret a
canonical tag found there as `resolution` — format spec §2.6.)

| Step | Source tag | Description |
|---:|---|---|
| 1 | `user_override` | An explicit user-entered correction. |
| 2 | `user_input` | An explicit user-entered initial value. |
| 3 | `inherited_assumption` | An assumption declared by an ancestor in the composition DAG. See §V.7.1. |
| 4 | `investor_profile` | Values declared in the active investor profile (e.g. preferred rate spread). |
| 5 | `market_data` | A market-data lookup at the time of resolution. |
| 6 | `asset_class_default` | The published default for the deal's asset class. See §V.8. |
| 7 | `global_default` | The published global default. |
| 8 | `system_default` | A hardcoded constant in the reference library or institution config. Producers SHOULD avoid relying on this layer for normative values. |

`market_data_accepted` (RFC 0022 §4) is **not** a cascade step. It is an in-file
value of record that resolves at step 2 while retaining its own source tag,
because a market observation an analyst accepted for lack of better evidence
must stay distinguishable from a value someone entered from diligence.

A producer MAY skip steps that are not available (e.g. no investor
profile attached). A producer MUST NOT reorder the cascade. The
runtime constant `CASCADE_ORDER` in `protocol.ts` is the canonical
machine-readable representation; conformant resolvers walk this
array.

**Variant-map sections (RFC 0066).** The in-file steps read a
variant-map section's value from the one block §VIII.2 selects. That
covers steps 1 and 2, and recognition of an in-file `market_data`
value. The selection is the consumer's explicit variant, then the role
its calculations declare, then RFC 0040's generic order. Another
variant's tagged value never stands in for the selected block. When no
block can be selected, resolution refuses with `CALC-RESOLVE-002`
rather than letting fence order choose, just as §V.7.1 refuses
equidistant ancestors.

A producer that resolves a value via a step at or below
`asset_class_default` (i.e. not from observed user or document data)
SHOULD also stamp the resulting block with `_meta.provisional: true`
unless the value originated from `inherited_assumption`,
`investor_profile`, or fresher `market_data`. This signals the
refinement engine that the field is a candidate for
value-of-information ranking.

This obligation is deliberately a SHOULD, and it is safe to leave as
one (*stated by [RFC 0032](../rfcs/0032-provisional-signing-scope.md)*):
`_meta.provisional` sits inside canonical block JSON (§V.9), so
stamping it moves the block's `content_hash` and therefore any §V.11
signature — and the protocol accepts that two conforming producers
may diverge here. Agreement of hashes or signatures across
independently-produced blocks is **not a protocol goal** and is
unachievable regardless of this clause, since canonical content
includes producer-specific fields (`timestamp`, `source`) in every
block. What the protocol does guarantee across implementations is
agreement on *computed values* (§VIII; RFCs 0023 and 0024) and on
*verification verdicts* (RFC 0016 receipts). A signature attests to
who wrote what, when — it does not attest that every conforming
producer would have written the same bytes.

#### V.7.1 Inherited assumptions

*Added at protocol 1.5.0 by [RFC 0021](../rfcs/0021-composable-documents.md)
§5, taking the cascade from seven steps to eight.*

A composite record MAY declare assumptions its descendants inherit. Resolution
of `inherited_assumption` is subject to four normative rules:

1. **Composition-scoped only.** Inheritance resolves along the composition DAG.
   A document not reachable as an ancestor contributes nothing, and there is no
   ambient or global assumption scope. A standalone record therefore can never
   resolve at this step, which is why introducing it moves no existing digest.
2. **Nearest ancestor wins.** Where several ancestors assert one field, the one
   fewest hops away supplies the value.
3. **Equidistant ancestors are an error** (`COMP-AMBIGUOUS-INHERIT`), never a
   silent pick. Diamond inheritance resolves explicitly or not at all: choosing
   by traversal order would make the answer depend on how the graph was walked.
4. **The value is traceable.** An inherited value MUST record the asserting
   ancestor's `document_id` and digest in `_meta.inherited_from`. An inherited
   value with no named ancestor is indistinguishable from an ambient default,
   which rule 1 forbids.

Step 3's position is normative in both directions. It sits **below**
`user_input`, so a value entered on the deal always wins — inheritance supplies
defaults, it never overrides. It sits **above** `investor_profile`, because an
assumption asserted by a named ancestor of this specific deal is more specific
than an institution-wide preference set.

When the resolved value carries an associated range (e.g.
asset-class defaults publish `{low, central, high}`), the producer
MAY also stamp `_meta.field_overrides` for that path with the range
recorded under the entry's `note`, so downstream tooling can compute
value-of-information without re-resolving the cascade.

### V.8 Asset-class default tables

The reference library publishes per-asset-class default tables under
`@uwmd/core/defaults`. Each entry resolves to a `{low, central,
high}` triple plus a unit and source tag. Producers consuming the
table at cascade step 5 (`asset_class_default`) MUST use the
published `central` value as the resolved scalar and MAY surface the
range to downstream consumers via `field_overrides`.

Tables are versioned independently of the protocol; consumers MAY
pin a specific table version via institution config. Default-table
revisions bump their semver and appear in the CHANGELOG.

The `MarketDataLookup` interface (cascade step 4) is defined by the
reference library but ships no built-in implementation; adopters
bring their own (CoStar, Yardi, internal). When no implementation is
attached, step 4 is silently skipped and resolution falls through to
step 5.
