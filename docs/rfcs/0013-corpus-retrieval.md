---
rfc: 0013
title: Embedding-based corpus retrieval
status: draft
author: jaredmaxey
created: 2026-04-27
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0013: Embedding-based corpus retrieval

## Summary

Define a per-section embedding contract so that a portfolio of
`.uw.md` files can be indexed for semantic retrieval. The contract
specifies which sections are embeddable, how the canonical text input
to an embedder is derived from a parsed block, and a small sidecar
file format (`<deal>.embeddings.json`) that carries vector indices
alongside each file. **This is deliberately-deferred territory**; the
RFC exists to record the design decisions so other work doesn't
accidentally foreclose them. No implementation lands until at least
one adopter needs *semantic* retrieval (find-similar-deals,
risk-pattern recall) at portfolio scale — analytical retrieval is
already served (see the status note below).

## Status note — revised 2026-09-03

Drafted 2026-04-27, this RFC predates most of the 1.x train and all of
2.x. A review at protocol 2.3.0 (owner discussion, 2026-09-03) kept it
a draft on purpose — the gate is real demand for *semantic* retrieval,
which no adopter has yet — and reconciled it with what has landed
since:

- **Use case 2 (cross-deal calibration) is served without vectors.**
  The corpus fact table (#146: `@uwmd/batch --facts`, the
  `/guide/data-lake` pipeline) makes "median exit cap rate across 50
  garden-style deals, weighted and filtered" a SQL query over
  identity-pinned rows. Vector lookup is the wrong tool for it. The
  motivating cases that remain are find-similar and risk-pattern
  recall — genuinely semantic, genuinely deferred.
- **The sidecar has a precedent now.** RFC 0015's
  `.uwportfolio.json` (protocol §XV) established the sidecar pattern:
  a JSON Schema in `spec/schemas/` with a README row, a validation
  function with its own code family, and unknown-field preservation.
  The embeddings sidecar follows it when implemented.
- **`content_hash` should not be invented here.** The integrity chain
  and canonical hashing exist; sidecar entries pin to the existing
  canonical block hash rather than a new hash definition.
- **The capability slots into RFC 0030.** "A new optional capability"
  now means a row in the conformance-profiles capability registry,
  not bespoke machinery.
- **Naming and numbering.** Structured records are `.uwx.md`
  (RFC 0017/0020); sidecar examples below should read
  `uw_version: "2.0"` era. The protocol section number is assigned at
  acceptance (the draft's "§XII" is long since taken).
- **Likely scope trim at acceptance.** The `CorpusIndex` query API and
  a reference index package are lake-side infrastructure — the same
  boundary that keeps warehouse loaders out of the standard
  ("backbone, not the lake"). The current intent is: registry +
  `default-v1` input derivation + pinned sidecar are normative; the
  query API drops to non-normative future work, with at most the
  **filter vocabulary** (deal metadata the format already defines)
  kept normative so cross-vendor tooling can exist.
- **Two new unresolved questions** were added below: numeric fields in
  `default-v1`, and the receipts/signing interaction.

## Motivation

A single underwriting file is human-scale. A portfolio of 200 active
deals is fleet-scale. The use cases:

1. **"Find similar deals."** A user underwriting a new 30-unit
   garden-style multifamily in Phoenix asks: "what other deals in our
   pipeline match this profile?" Today the only answer is full-text
   `grep` across the corpus, which fails on every reasonable
   semantic-similarity query.
2. **Cross-deal calibration.** *(Served without vectors as of
   2026-09 — see the status note: the corpus fact table makes this a
   SQL query.)* "What's the median exit cap rate for our last 50
   garden-style multifamily deals?", weighted and filtered, over
   identity-pinned rows.
3. **Risk pattern detection.** A new deal triggers risk flag X. The
   system surfaces every prior deal that triggered X and shows the
   resolution. With ~thousands of historical deals, semantic
   retrieval beats keyword search.

These features are not in scope for v1.x or v2.0. The format and
protocol must, however, leave room for them — specifically by NOT
freezing the textual representation of a block in a way that makes
later embedding extraction lossy.

## Proposed change

### Embeddable sections

Not every section is worth embedding. The spec declares a registry
of embeddable sections (initially in `protocol.ts`):

```ts
export const EMBEDDABLE_SECTIONS: Record<string, EmbeddableSectionSpec> = {
  market_analysis: { granularity: 'block' },
  risk_assessment: { granularity: 'block' },
  borrower_sponsor: { granularity: 'block' },
  property:        { granularity: 'block' },
  // financial sections excluded — embeddings of numeric tables are
  // dominated by the schema rather than the values, and exact lookup
  // serves them better.
};

interface EmbeddableSectionSpec {
  granularity: 'block' | 'paragraph';
  /** Derive the embedder input string from the parsed block. */
  toEmbeddingInput?(block: ParsedBlock): string;
}
```

The default `toEmbeddingInput` is:

> Concatenate, in order: section name, all string-valued fields from
> the block content (depth-first, with field path prefixes for
> disambiguation), and any `notes` from `_meta`. Skip numbers and
> booleans. Normalize whitespace.

This is intentionally simple; adopters can override per section.

### Sidecar file format

```
deal-2026-0042.uwx.md
deal-2026-0042.embeddings.json    ← sidecar
```

`deal-2026-0042.embeddings.json`:

```jsonc
{
  "uw_version": "2.0",
  "deal_id": "DEAL-2026-0042",
  "embedder": {
    "model": "text-embedding-3-large",
    "dim": 3072,
    "input_format": "default-v1",      // matches toEmbeddingInput
  },
  "generated_at": "2026-04-27T15:00:00Z",
  "blocks": [
    {
      "section": "market_analysis",
      "content_hash": "<sha256>",       // the EXISTING canonical block hash — see status note
      "vector": [0.012, -0.453, …]
    },
    /* …one entry per embeddable block… */
  ]
}
```

The sidecar is **not** embedded in the file itself for three reasons:

1. **Binary-ish payload.** A 3072-dim float32 vector at 4 bytes each
   is 12KB per block; a deal with 10 embeddable blocks adds 120KB to
   a file that's currently 10–50KB. The sidecar keeps the human-
   readable file readable.
2. **Provider-dependent.** Different adopters use different embedding
   models. The sidecar is recomputable at any time from the source
   file; embedding it would freeze a model choice into the canonical
   document.
3. **Privacy.** Some operators do not want vectors leaving their
   infrastructure even when the underlying content does (e.g.
   sharing redacted files externally).

### Index API

> **Revision note (2026-09-03):** likely to drop to non-normative
> future work at acceptance — query APIs and storage are operator
> infrastructure, not interchange ("backbone, not the lake"). The
> `CorpusFilter` *vocabulary* may stay normative since it is deal
> metadata the format already defines. Kept below as the design
> record.

`@uwmd/corpus-retrieval` (new package, deferred) exposes:

```ts
export interface CorpusIndex {
  add(file: ParsedUWFile, embeddings: SidecarEmbeddings): Promise<void>;
  query(text: string | number[], k?: number, filters?: CorpusFilter): Promise<CorpusHit[]>;
  remove(deal_id: string): Promise<void>;
}

export interface CorpusFilter {
  asset_class?: string | string[];
  geo?: { state?: string; metro?: string };
  size_units_range?: [number, number];
  date_range?: [string, string];
}

export interface CorpusHit {
  deal_id: string;
  section: string;
  content_hash: string;
  score: number;
  excerpt?: string;
}
```

The reference implementation MAY back the index with whatever
operators have on hand (Postgres + pgvector, SQLite + sqlite-vec,
LanceDB, an in-memory ANN index for prototyping). The spec defines
the **API**, not the storage backend.

### Protocol additions

A new protocol section "Corpus retrieval (optional)" (number assigned
at acceptance) in `spec/UW_PROTOCOL_v1.md` defines:

- The embedding sidecar file shape.
- The `EMBEDDABLE_SECTIONS` registry contract (with the
  understanding that implementations MAY override the registry).
- The `content_hash` pinning rule: a sidecar entry is invalidated
  when the corresponding block's `content_hash` changes (per RFC's
  Phase 3 work). Adopters re-embed the affected block.
- A normative MUST: producers of sidecars MUST pin every entry to a
  `content_hash`. Sidecars without pins are non-conformant — they
  drift silently as files evolve.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected.
- **Tier-1/2/3/4 implementations** — fully unaffected. Sidecar files
  are out-of-band.
- **Modules** — unaffected. A future RFC could allow modules to
  declare embedding overrides for their own sections; not in scope
  here.
- **Format spec versions** — sidecar format is independently
  versioned via the `embedder.input_format` field; the file's
  `uw_version` is not coupled to retrieval support.

No deprecation path. Additive and out-of-band.

## Conformance impact

A new optional capability `corpus-retrieval` for Tier-2+. Adopters
claiming it pass:

- `corpus-fixtures/01-sidecar-roundtrip/` — produce a sidecar from a
  fixture file and verify the schema. The actual vector values are
  not byte-compared (model-dependent); only the structure is.
- `corpus-fixtures/02-stale-sidecar/` — modify a block's content,
  re-validate the sidecar; expects the entry to be marked
  `stale: true` because `content_hash` no longer matches.
- `corpus-fixtures/03-default-input-format/` — produces deterministic
  string from a fixture block under the `default-v1` input format.
  Expected output recorded in `expected-input.txt` (text comparison,
  not vector).

This is the first conformance capability that explicitly does NOT
test vector values, only shape — because vectors are model-dependent
and we don't ship a model.

## Reference implementation

Reference implementation is gated on demand, not a version number: it
lands when an adopter needs semantic retrieval at portfolio scale.
Files affected when it does:

- `packages/uwmd-core/src/embedding-input.ts` — the `default-v1`
  input format derivation.
- `packages/uwmd-core/src/protocol.ts` — `EMBEDDABLE_SECTIONS`,
  sidecar types.
- `packages/uwmd-corpus-retrieval/` (new package, deferred) —
  reference index.
- `spec/schemas/embedding-sidecar.schema.json` (new).
- `spec/UW_PROTOCOL_v1.md` §XII.

API surface deferred until implementation; types only land in the
protocol module today so adopters experimenting privately have a
common vocabulary.

## Alternatives considered

1. **Embed vectors in `_meta`.** Rejected on size grounds (12KB per
   vector × N blocks × M models × evolving model versions explodes
   file size).

2. **Store vectors in a separate index database keyed by file path.**
   Functionally similar to the sidecar approach; the difference is
   the sidecar is portable with the file (sponsor exports a deal
   folder, embeddings come along) whereas an external DB is bound to
   one operator's infrastructure. The sidecar wins for portability.

3. **Adopt OpenAI's "vector store" file format.** Tied to a single
   vendor. Rejected; we want multiple embedding providers
   substitutable.

4. **Make embedding generation a Tier-3 calc-host responsibility.**
   Tier-3 is for pure deterministic numeric calcs; embeddings are
   neither pure (model upgrades change them) nor numeric in the calc
   sense. Wrong tier.

5. **Embed at paragraph granularity universally instead of
   block-level.** More retrieval flexibility, but the document's
   chunking unit is the block. Embedding at block granularity
   matches how content evolves (supersede a block → re-embed one
   vector). Paragraph granularity would force heuristic chunking on
   blocks that aren't naturally paragraphed. Block-level is the
   default; per-section override permits paragraph mode where it
   pays.

6. **Store the input string used for embedding (not just the hash).**
   Reproducibility argument — the verifier could regenerate the
   vector from the stored string. Rejected because the input string
   is itself reproducible from the block + format version; storing
   it is duplicative.

## Unresolved questions

- **Numeric fields in `default-v1` (added 2026-09-03).** The draft
  derivation skips numbers and booleans, but for CRE similarity some
  numbers are semantic — "30-unit garden-style, 1995 build" is the
  profile a find-similar query means. The derivation likely needs a
  per-section allow-list of semantically meaningful numeric fields
  rendered into the input string, decided when the first real
  embedder's retrieval quality can be measured.
- **Receipts and signing interaction (added 2026-09-03).** A sidecar
  is derived data. Whether a sidecar should be attestable — "these
  vectors were derived from blocks with these canonical hashes under
  input format `default-v1`," signable like a receipt (RFC 0016/0010
  machinery) — is deferred, but the sidecar shape must not foreclose
  adding an attestation envelope around it.
- **Versioning the input-format derivation.** When `default-v1`
  changes (it will), adopters with old sidecars need to know they're
  stale. The `embedder.input_format` field handles this but the
  upgrade story (re-embed entire corpus) is non-trivial. Reasonable
  to ignore until v3 implementation.
- **Cross-language input-format parity.** A Python adopter and a
  TypeScript adopter must derive the same string from the same
  block under `default-v1`. Achievable but needs a normative test
  vector, which we don't have today.
- **Encrypted-at-rest vectors.** Some operators encrypt their
  knowledge base. The sidecar format is plaintext JSON; an
  encrypted variant is layer-on, not spec.
- **Real-time vs. batch indexing.** The API above is synchronous;
  high-throughput operators want async ingest. Spec defers; library
  implementations choose.
- **Whose model wins.** If a portfolio is built across multiple
  embedding-model versions (the team upgraded mid-2026), the index
  needs migration tooling. Out of scope here; flagged for the
  reference package.

## Prior art

- **pgvector** — mature, simple, widely used for "embeddings + SQL
  filters" workflows. Likely the default reference backend.
- **LanceDB / Chroma / Qdrant** — purpose-built vector DBs. Adopters
  with no existing Postgres pick these.
- **OpenAI Assistants File Search** — same shape: per-document
  embeddings, retrieval API, citation back to source spans. Not
  spec-compatible because it's vendor-bound.
- **Anthropic's Contextual Retrieval blog post (2024)** — argues for
  prepending document-level context before each chunk to improve
  retrieval quality. Worth incorporating as an option in
  `default-v2` when that arrives.
- **Linkerd's per-namespace retrieval contracts** — non-CRE prior art
  for "tenants embed their own data with their own model under a
  shared API."
