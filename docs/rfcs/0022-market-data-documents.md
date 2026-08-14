---
rfc: 0022
title: Market data as an attributable UW document
status: draft
author: jaredmaxey
created: 2026-08-13
depends_on:
  - 0018
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0022: Market data as an attributable UW document

## Summary

Define `market-data-v1`, a document profile for dated, attributable market
observations, and give the existing cascade a reference implementation that
resolves against it. A verification receipt over a deal that used market data
pins the market-data document's semantic digest, so the computation is
reproducible against exactly the observations used. An observation MAY be
promoted to an input of record through an explicit edit that records who
accepted it — and the promoted value stays distinguishable from a diligenced
one.

This adds no market-data vendor integration, no pricing model, and no automated
valuation. It makes an external number *attributable*; it does not make it true.

## Motivation

`MarketDataLookup` and `InvestorProfile` have existed in `cascade.ts` since the
v1.1 train as interfaces with no reference implementation. The consequence is
that the **top two steps of the fallback cascade have never had a worked
example**, which is the same failure mode UW Lite had before RFC 0021's
predecessor work: a normatively specified thing with zero instances drifts,
because nothing exercises it.

The deeper problem is attribution. Today a market-derived value arrives through
a host-implemented `resolve()` call and lands in a document tagged
`market_data`, with `staleness_seconds` as the only vintage signal. There is no
record of *which* observation set produced it. Two CoStar pulls a week apart are
indistinguishable after the fact, so a receipt over that deal cannot be
reproduced, and a reviewer asking "what did we assume for submarket vacancy, and
where did it come from?" has no answer the file can give.

RFC 0018 established that the way to make an external artifact citable is to
give it a profile, an identity, and a digest. Market data is exactly that shape.

## Prerequisite

Depends on **RFC 0018**, accepted 2026-08-13, for the document-profile mechanism,
member identity, and package membership. A market-data document is a package member like any other.

## Proposed change

### 1. The `market-data-v1` profile

A market-data document is a UW document whose profile is `market-data-v1`. It
carries observations, not conclusions.

```markdown
---
uw_version: "1.1"
document_profile: market-data-v1
document_id: md:phx-multifamily:2026-Q2
as_of: "2026-06-30"
provider: "Example Research LLC"
geo: "Phoenix-Mesa-Chandler, AZ"
asset_class: multifamily
---

```json uw:section=market_observations v=1
{
  "observations": [
    {
      "field_path": "valuation.going_in_cap_rate",
      "value": 0.0545,
      "unit": "fraction",
      "range": { "low": 0.0510, "central": 0.0545, "high": 0.0590 },
      "basis": "42 closed sales, trailing 12 months",
      "confidence": "medium"
    }
  ]
}
```
```

Rules:

- `document_id`, `as_of`, `provider`, and `geo` are REQUIRED. An observation set
  with no as-of date or no named provider is not attributable and MUST be
  refused rather than stored with those fields blank.
- Each observation MUST carry `field_path`, `value`, and `unit`. `range` is
  optional and carries the `{low, central, high}` shape the existing
  `MarketDataLookup` already returns.
- `basis` is a free-text account of what the observation rests on (sample size,
  method). It is REQUIRED and MUST NOT be empty. A number with no stated basis is
  an assertion, not an observation, and this profile is for observations.
- `field_path` MUST be a path a deal record could carry. A market-data document
  MUST NOT introduce field paths that do not exist in the section model.
- Rates are fractions, per the repo-wide convention.
- A market-data document has **no `deal_id`** and MUST NOT be interpreted as an
  underwriting record. It contains no calculations and no pack applies to it.

### 2. Resolution

`MarketDataLookup` is retained unchanged for hosts querying a live warehouse.
This RFC adds a second, deterministic resolver that reads a market-data document:

```ts
createDocumentMarketData(doc: ParsedUWFile, opts?: { now?: Date }): MarketDataLookup
```

It resolves `field_path` against the document's observations, filtered by
`asset_class` and `geo`, and reports staleness from `as_of` rather than from a
wall-clock guess. Because it is a plain `MarketDataLookup`, it drops into the
existing cascade with no change to `resolveValue`.

Where several market-data documents are in scope, the **most recent `as_of`
wins**; ties are an error rather than a silent pick, on the same reasoning as
RFC 0021's ambiguous-inheritance rule.

### 3. Receipts pin the observation set

When a deal's resolution consumed market data, the receipt records the
market-data document's `document_id`, `as_of`, and **semantic digest**:

```json
{
  "inputs_provenance": [
    {
      "source": "market_data",
      "document_id": "md:phx-multifamily:2026-Q2",
      "as_of": "2026-06-30",
      "digest": "sha256:<64 lowercase hex>"
    }
  ]
}
```

Verification then has a reproducible target: recomputation uses exactly those
observations. If the market-data document is unavailable to the verifier, the
result is **`unverifiable`**, not `failed` — an absent reference set is not
evidence of tampering, the same distinction the verifier already draws for
unknown packs and signed receipts with no backend.

A verified receipt over a deal that used market data means: the stated outputs
follow deterministically from these inputs, and these particular observations
were the ones used. It does **not** mean the observations are accurate, current,
representative, or that the provider is competent.

### 4. Promotion to an input of record

An analyst who accepts a market observation as the underwritten value promotes
it through an explicit Tier-2 edit. Promotion is never automatic and never a
side effect of resolution.

A promoted value carries `source: "market_data_accepted"` — **not**
`user_input`. This is the crux. The workflow reflects how analysts actually work:
you accept a submarket cap rate because you have no better evidence, and it
becomes the number you underwrite. But a value accepted for lack of evidence and
a value established by diligence are different things, and a file that renders
them identically has destroyed information a credit reviewer needs.

The promoted block's `_meta` MUST record:

- the accepting actor and timestamp (normal Tier-2 provenance);
- the `document_id`, `as_of`, and digest of the observation promoted; and
- an optional `rationale`.

Consequences:

- `market_data_accepted` is a distinct `SourceTag`. Consumers that do not
  recognize it MUST NOT collapse it to `user_input`.
- The value is no longer a cascade fallback — it is present in the document —
  so `gaps`/VOI stop ranking the field as unresolved. That is the point of
  promoting. Its origin nevertheless stays legible forever.
- Promotion does not upgrade confidence automatically. `confidence` remains the
  host's to set, and a promoted medium-confidence observation is still medium
  confidence.

### 5. Investor profiles are out of scope

`InvestorProfile` (cascade step 2) is deliberately **not** addressed here. It is
an institution-private preference set, and it is not yet clear anyone wants to
exchange one. Portfolio-level shared assumptions — the use case that might
otherwise have justified folding it in — are handled by RFC 0021 §5 as
`inherited_assumption`, resolved along the composition graph.

If a portable investor profile is ever wanted, it should be its own RFC and
should reuse this profile's shape rather than inventing a third one.

## Compatibility analysis

Existing documents, envelopes, packages, and receipts remain valid. The profile
is optional and additive; `MarketDataLookup` keeps its current signature, so
hosts implementing it today are unaffected.

`market_data_accepted` is a new `SourceTag` value. Existing consumers already
tolerate institution-defined source tags (the type admits free-form strings), so
an unrecognized tag degrades to "some other source" rather than an error. The
normative requirement is only that it not be *rewritten* to `user_input`.

The cascade order is unchanged by this RFC. RFC 0021 inserts
`inherited_assumption` above `market_data`; the two are independent and compose.

## Conformance impact

A new named `market-data` suite:

- `valid/quarterly-observations/` — parse, canonical form, digest, and
  resolution through the cascade.
- `reject/no-as-of/`, `reject/no-provider/`, `reject/empty-basis/`,
  `reject/unknown-field-path/` — the attribution requirements, each proved to
  fail rather than store a blank.
- `resolve/most-recent-wins/` and `reject/ambiguous-as-of/` — vintage selection
  and the tie error.
- `resolve/staleness/` — an observation past `staleness_seconds` falls through
  to `asset_class_default`.
- `receipt/pins-digest/` — a receipt over a deal that consumed market data
  records the digest, and recomputation reproduces the outputs.
- `receipt/market-data-absent/` — the verifier reports `unverifiable`, not
  `failed`.
- `receipt/market-data-mutated/` — altering the observation set after issuance
  is detected.
- `promote/explicit/` — promotion records actor, digest, and as-of, and the
  resulting tag is `market_data_accepted`, **not** `user_input`.
- `promote/gaps-cleared/` — a promoted field leaves the VOI gap ranking while
  retaining its origin tag.

## Reference implementation

- `spec/schemas/uw-market-data.schema.json` — the profile schema.
- `packages/uwmd-core/src/market-data.ts` — `MarketDataDocument`,
  `parseMarketDataDocument`, `createDocumentMarketData`, vintage selection, and
  the error taxonomy. Browser-safe; no network access of any kind.
- `packages/uwmd-core/src/cascade.ts` — unchanged interface; the new resolver is
  a plain implementation of it.
- `packages/uwmd-core/src/receipts.ts` — `inputs_provenance` and the
  three-state handling of an absent observation set.
- `packages/uwmd-core/src/types.ts` — the `market_data_accepted` source tag.
- CLI: `uwmd market-data validate <file>`, and `--market-data <file>` on
  `scope` / `refine` so the top cascade steps finally have a runnable example.
- `examples/` — one worked market-data document, per the lesson from shipping a
  normative representation with zero instances.

## Alternatives considered

1. **Reference implementation only, no profile.** Smallest change and it does
   unblock the cascade example. Rejected because observations stay
   unattributable and unhashable, so a receipt can never pin what they were —
   which is the actual gap.
2. **Record only the as-of date in receipts, not a digest.** Works even against
   a live warehouse. Rejected because two different pulls on the same date
   verify identically when they may differ, which is precisely the ambiguity
   this RFC exists to remove. Hosts querying a warehouse can snapshot it into a
   document when they need a receipt.
3. **Treat market data as out of scope for receipts.** Defensible — a receipt
   attests math over stated inputs and inputs are inputs. Rejected because
   market data is the input class most likely to change under you, and the one a
   reviewer is most likely to want pinned.
4. **Let promotion write `user_input`.** Simpler, and it matches what analysts
   feel they are doing. Rejected: it erases the distinction between a value
   accepted for lack of evidence and one established by diligence.
5. **Fold in investor profiles.** See §5.

## Unresolved questions

- Whether `basis` should become structured (sample size, method, geography
  radius) rather than free text. Free text is honest about what providers
  actually publish, but is not machine-comparable.
- Whether an observation should be able to express a distribution rather than
  `{low, central, high}` — this overlaps RFC 0005 (stochastic calculations) and
  should not be decided here.
- Whether a promoted value should expire, forcing periodic re-acceptance as the
  observation ages.
