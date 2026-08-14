---
rfc: 0018
title: Define composable document profiles and deal packages
status: implemented
author: jaredmaxey
created: 2026-08-11
accepted: 2026-08-13
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0018: Define composable document profiles and deal packages

## Summary

Define optional, independently versioned UW document profiles and a deterministic
UW Deal Package model with ZIP and JSON encodings. The first profile,
`lease-abstract-v1`, makes a lease abstract a portable, attributable UW document
that can stand alone or contribute to an underwriting record. A package manifest
inventories its member documents, source evidence, semantic digests, and typed
links. Its JSON context form is designed for AI connector tools: readable UW
text stays text, while source evidence is represented only by its manifest
identity, digest, and optional reference. It does not turn arbitrary files into
underwriting facts, define a database, or allow an AI to calculate financial
results.

## Motivation

The current format is a deal-underwriting record. Its `rent_roll` section can
hold lease facts, and extension sections can prototype lease-negotiation data,
but neither creates a reusable lease abstract with its own identity, coverage,
source locators, and lifecycle. Users therefore either duplicate lease terms in
each deal file or hold them in non-portable Word, PDF, or spreadsheet artifacts.

RFC 0014's UW CSV Bundle is a model encoding for one `UWDocumentEnvelope`; it
is not a package of related records. RFC 0015 proposes relationship sidecars,
but intentionally defers a transport representation. A common ZIP convention is
needed for a deal's underwriting record, lease abstracts, source documents, and
other contextual UW documents to travel together without conflating source
evidence with extracted facts. Connector tools commonly accept structured JSON
or text resources but make ZIP attachments opaque or unavailable, so a ZIP-only
package would unnecessarily prevent an agent from receiving the authoritative
textual context and relationship graph.

## Proposed change

### 1. Document profiles

Add an optional `document_profile` identifier to a UW source document and its
Document Envelope. A profile is a versioned contract for the *purpose and
permitted sections* of one document; it is not a new filename extension,
asset-class, pipeline stage, or calculation pack. A document without a profile
remains the existing full underwriting record.

The initial registry is:

| Profile | Purpose | Required identity | Financial role |
|---|---|---|---|
| `deal-underwriting-v1` | Complete or partial underwriting record | `deal_id` | Existing sections and deterministic packs apply. |
| `lease-abstract-v1` | One executed lease and its amendments | `document_id`, `lease_id` | Descriptive facts only; no financial calculation is introduced. |
| `source-note-v1` | Attributable transcription, summary, or diligence note | `document_id` | Evidence/context only. |

Profile identifiers are opaque, lowercase ASCII tokens. Producers MUST preserve
unknown profiles and MUST NOT interpret one as a deal-underwriting document
unless they implement that profile. A profile MAY be represented in Lite
frontmatter as `document_profile`; UWX and envelope mappings carry the same
value. Existing documents that omit it remain valid and are interpreted as
`deal-underwriting-v1` only where an existing API already expects a deal.

### 2. Lease abstract profile

`lease-abstract-v1` MUST identify the lease, the tenant, the premises, and the
source artifact(s) from which facts were read. It MUST distinguish an executed
lease from a proposal, amendment, guaranty, estoppel, or other related artifact.
All extracted material terms MUST be source-locatable; an extractor MUST report
an absent or ambiguous term rather than infer it.

The profile has these logical groups, rendered as readable UW Markdown and
carried in structured blocks/anchors:

1. `lease_context` — lease ID, status, effective date, landlord, tenant,
   premises, suite/unit, and governing-document list.
2. `lease_term` — commencement, expiration, options, termination rights,
   possession, renewal, and extension terms.
3. `lease_economics` — base-rent schedule, free rent, escalations, percentage
   rent, reimbursements/recoveries, deposits, TI, commissions, and concessions.
4. `lease_obligations` — use/exclusivity, maintenance, insurance, taxes,
   utilities, assignment/subletting, reporting, and compliance obligations.
5. `lease_credit` — guaranties, letters of credit, deposits, defaults, remedies,
   bankruptcy/recapture clauses, and material consent rights.
6. `lease_abstract_findings` — plain-language summary, open questions,
   conflicts between documents, and review flags.

Every asserted material term MUST carry a `source_ref` that resolves to a
package member or an external immutable source identifier plus a human-readable
`locator` (for example, `§3.2, p. 14`). A term MAY be `null` only with an
explicit status such as `not_stated`, `ambiguous`, or `not_reviewed`; `null`
MUST NOT mean that an agent guessed no obligation exists. Human review flags and
block provenance retain their existing append-only behavior.

A lease abstract MAY expose a named, explicitly lossy `rent-roll-v1`
projection. The projection maps only unambiguous, current lease facts to a
tenant/unit row. It MUST return an omission/conflict report and MUST NOT mutate
the underwriting document, calculate a rent amount, annualize a partial period,
or choose between conflicting amendments. A host can apply the resulting edit
to a deal record through the normal Tier-2 editor contract.

### 3. UW Deal Package 1.0

Define a complete ZIP package and a derived JSON context representation:

| Property | Value |
|---|---|
| Model | UW Deal Package 1.0 |
| ZIP codec ID / extension / media type | `uw-deal-package-zip` / `.uwpkg.zip` / `application/vnd.uwmd.deal-package+zip` |
| JSON context codec ID / extension / media type | `uw-deal-package-context` / `.uwpkg.context.json` / `application/vnd.uwmd.deal-package-context+json` |
| Fidelity | ZIP = `package`; JSON = `view` / connector context |

The common package model has one manifest and zero or more member payloads. It
MAY contain UW source documents, lossless UW model encodings, and immutable
source evidence under logical paths. The manifest is the authoritative inventory;
ZIP entry order and timestamps are not semantic. A canonical ZIP encoder MUST
emit entries in lexicographic path order and fixed timestamps.

```json
{
  "package_version": "1.0",
  "package_id": "pkg:parkview:2026-08-11",
  "members": [
    {
      "id": "deal:parkview",
      "path": "records/parkview.uwx.md",
      "role": "underwriting",
      "media_type": "text/vnd.uwmd.extended+markdown",
      "sha256": "sha256:<64 lowercase hex>",
      "semantic_digest": "sha256:<64 lowercase hex>",
      "document_profile": "deal-underwriting-v1"
    },
    {
      "id": "lease:anchor-tenant",
      "path": "records/anchor-tenant.uw.md",
      "role": "lease_abstract",
      "media_type": "text/vnd.uwmd.lite+markdown",
      "sha256": "sha256:<64 lowercase hex>",
      "semantic_digest": "sha256:<64 lowercase hex>",
      "document_profile": "lease-abstract-v1"
    },
    {
      "id": "source:anchor-lease",
      "path": "sources/anchor-lease.pdf",
      "role": "source_evidence",
      "media_type": "application/pdf",
      "sha256": "sha256:<64 lowercase hex>"
    }
  ],
  "links": [
    { "type": "abstracts", "from": "lease:anchor-tenant", "to": "source:anchor-lease" },
    { "type": "contributes_to", "from": "lease:anchor-tenant", "to": "deal:parkview" }
  ]
}
```

Member IDs and paths MUST be unique. Paths MUST be relative POSIX paths, contain
no traversal components, and resolve to exactly one non-symlink ZIP entry.
Every declared member MUST exist, match its byte digest, and have a recognized
or explicitly preserved media type. A UW member's semantic digest MUST verify
when the implementation supports its representation; otherwise the package is
`unverifiable`, not invalid. An evidence member's digest proves byte identity,
not authenticity, completeness, OCR quality, or legal effect.

Links are typed, directed references between member IDs. Their types are drawn
from the single canonical edge registry defined in §5; a package MUST NOT define
a parallel type registry of its own. Unknown types MUST be preserved. A later
accepted relationship profile MAY be embedded by reference, not copied into each
member's `_meta`.

Package readers MUST apply the safe ZIP restrictions already established by the
UW CSV bundle: reject traversal, duplicate entries, symlinks, encrypted entries,
ZIP64, unacceptable file/expanded-size/compression-ratio limits, and malformed
UTF-8 names. Extraction MUST be opt-in; validation and indexing MUST operate on
the archive bytes without writing untrusted files to disk.

### 4. Connector-friendly JSON context

`uw-deal-package-context` projects a ZIP package into JSON with the full
manifest, typed links, and inline UTF-8 content only for UW documents and source
notes. A connector can therefore pass the actionable underwriting context as
ordinary JSON rather than as an opaque archive. It is a view, not a second
archival encoding: source documents are never included as JSON content.

```json
{
  "package_version": "1.0",
  "package_id": "pkg:parkview:2026-08-11",
  "members": ["...full manifest, including source evidence..."],
  "links": ["...same manifest links..."],
  "contents": {
    "deal:parkview": { "kind": "utf8", "text": "---\nuw_version: \"1.1\"\n..." },
    "lease:anchor-tenant": { "kind": "utf8", "text": "---\nuw_lite_version: \"1.0\"\n..." }
  },
  "source_evidence": {
    "source:anchor-lease": { "status": "not_transferred", "uri": "https://files.example/anchor-lease.pdf" }
  }
}
```

A `contents` entry MUST reference a manifest member with a UW document profile
or `source-note-v1`, and `kind: "utf8"` MUST encode that member's exact UTF-8
bytes. A contents entry for `source_evidence`, `application/pdf`, DOCX, image,
or any other source-file member is forbidden. The JSON representation MUST
contain at most one content entry per eligible member, MUST NOT contain an
unlisted content key, and MUST verify every inline payload against the declared
byte digest before returning it.

Every source-evidence member in the manifest MUST appear in `source_evidence`
with `status: "not_transferred"` or `status: "reference"`. Naming a source does
not make it available to the recipient. The context view MUST identify itself as
incomplete evidence context and MUST NOT be represented as a complete archival
package, proof that the source was read, or a substitute for validating the ZIP
package.

#### Reference handles

A `reference` carries one or more typed, namespaced descriptors rather than a
bare string, so that a handle minted by one connector cannot be silently
misread by another:

```json
"source_evidence": {
  "source:anchor-lease": {
    "status": "reference",
    "refs": [
      { "scheme": "uri", "value": "https://files.example/anchor-lease.pdf" },
      { "scheme": "connector", "authority": "vendor.example", "value": "<opaque>" }
    ]
  }
}
```

The normative rules are:

- A descriptor MUST carry a `scheme` and a `value`. `refs` MAY hold several
  descriptors for one member — a URI and a connector handle are alternative
  routes to the same bytes, not different evidence.
- `scheme: "uri"` — `value` MUST be an absolute URI. A recipient MUST NOT assume
  it is dereferenceable, still live, or that the recipient is authorized to
  fetch it.
- `scheme: "connector"` — the descriptor MUST carry an `authority` naming the
  issuing connector namespace. **A consumer whose own authority does not match
  MUST treat the handle as unresolvable and MUST NOT attempt to resolve it.**
  This is the rule that makes handles interoperable: an opaque token is scoped
  to the namespace that minted it, so cross-connector confusion is a validation
  error rather than a silent mis-fetch.
- Unknown schemes MUST be preserved and treated as unresolvable.
- **A handle is never identity.** The member's `sha256` in the manifest is the
  only identity. If a resolved handle returns bytes whose digest does not match
  the manifest, the consumer MUST report a verification failure and MUST NOT use
  the bytes. A handle that cannot be resolved yields `unverifiable`, never
  `failed` — an unreachable connector is not evidence of tampering, the same
  three-state distinction the receipt verifier already draws.
- Resolving a handle is an explicit, opt-in host action. Nothing in validating a
  package or projecting a context view may perform network or connector I/O.

This keeps the assurance boundary intact: a reference says where bytes might be
obtained and what they must hash to, and says nothing about whether anyone read
them.

Base64 of source documents—and Base64 of the entire ZIP—is deliberately outside
this representation. It is larger, opaque to model tools, and would defeat the
boundary between portable context and the evidence-bearing archive. A host MAY
transfer a validated ZIP as a separate attachment using its connector's file
mechanism, but that attachment is not part of the JSON context payload.

The JSON context is not a prompt format. A host MAY derive a smaller named
`deal-context` view for token-limited models, but that view MUST identify omitted
UW document members and MUST NOT claim package fidelity.

### 5. One canonical edge vocabulary

RFC 0015 defines provenance-backed edges between *portfolio entities*
(`owns`, `borrows_against`, `secures`, `guarantees`, `supports`, `related_to`).
This RFC needs typed links between *package members*. Left alone, that produces
exactly the failure the two drafts must avoid: two registries that both contain
`guarantees` and `supports`, drifting apart until the same token means two
different things depending on which document a reader happens to hold.

The resolution is **one registry with two layers**, defined normatively in the
protocol spec and referenced by both RFCs rather than restated in either:

- The **entity layer** relates business entities — a borrower, a loan, a
  property. This is RFC 0015's domain.
- The **member layer** relates documents inside a package — an abstract, a
  guaranty PDF, an amendment. This is RFC 0018's domain.

Every edge type declares the layer(s) it is valid on, the endpoint kinds it
accepts, and whether provenance is required:

| Type | Layer | From → To | Provenance | Meaning |
|---|---|---|---|---|
| `owns` | entity | borrower → property | required | Ownership of the asset. |
| `borrows_against` | entity | borrower → property | required | Borrowing secured by the asset. |
| `secures` | entity | property → loan | required | The asset secures the loan. |
| `related_to` | entity | any → any | required | Untyped association; the fallback. |
| `abstracts` | member | UW doc → source evidence | manifest | This document is an extraction of that source. |
| `amends` | member | doc → doc | manifest | Modifies the terms of the target. |
| `supersedes` | member | doc → doc | manifest | Replaces the target wholesale. |
| `contributes_to` | member | doc → underwriting doc | manifest | Feeds the target underwriting record. |
| `guarantees` | **both** | guaranty doc → lease doc / borrower → loan | required / manifest | Credit support for the target. |
| `supports` | **both** | evidence → any / document → entity | required / manifest | Evidentiary support, weaker than `abstracts`. |

The two shared types are not a collision to be renamed apart. They are the same
relation observed at two layers: a guaranty *document* is the member-layer
evidence for the entity-layer fact that a borrower guarantees a loan. Modelling
them as one type with a declared projection is what keeps the vocabulary
canonical.

**Provenance.** RFC 0015 requires a non-empty `provenance` array on every edge.
Package links carry no such array, and should not: within a package the manifest
*is* the provenance, because every member is content-addressed by digest. The
rule is therefore that a member-layer link's provenance is the package manifest
itself, and **when a member-layer link is projected to an entity-layer edge, the
projection MUST synthesize a provenance entry naming the `package_id` and the
member IDs it came from.** No edge ever reaches the entity layer without
attributable provenance, and no package is forced to duplicate what its digests
already prove.

**Projection is one-directional and explicit.** A host MAY project member links
into entity edges; nothing may do it implicitly, and an entity edge MUST NOT be
projected back down into a package. A package remains a self-contained,
verifiable artifact rather than a partial view of somebody's portfolio graph.

**A naming caution.** `supersedes` at the member layer relates two whole
documents in a package. It is *not* the block-level supersede in `_meta`, which
is append-only within a single document and is untouched by this RFC. The specs
must not let a reader conflate them.

**Registry ownership.** This RFC contributes the member-layer rows; RFC 0015
contributes the entity-layer rows. Whichever is accepted first establishes the
registry section in the protocol spec, and the second amends it rather than
starting a second table. If RFC 0015 is accepted after this one, its edge list
is superseded by that section — same tokens, same meanings, one home. Extension
types remain permitted at both layers and MUST be preserved by consumers that
cannot interpret them.

### 6. Conformance and assurance boundary

Add a named `packages` conformance suite. It is separate from Tiers 1–4 because
it validates a container and profiles, not a new underwriting pipeline tier.
The suite freezes manifests, deterministic ZIP bytes, and canonical JSON context
where an encoder is in scope. It MUST prove that the context preserves the ZIP
package manifest, links, UW-document bytes, and source-evidence descriptors while
omitting every source-file byte; include valid standalone lease abstracts; package
integrity and links; safe-ZIP and invalid-inline-payload negative cases;
profile/locator failures; reference-only source descriptors; and rent-roll
projection omissions/conflicts. AI extraction quality is outside conformance:
the suite tests explicit source references and deterministic transformations,
not whether a model read a legal document correctly.

## Compatibility analysis

Existing Lite, UWX, envelope, and CSV bundle files remain valid. The new
frontmatter/envelope field is optional and unknown profiles are preserved. Tier
1–4 implementations remain conforming unless they advertise the new profile or
package capability. Existing ZIP support is not reinterpreted: `.uw.csv.zip`
continues to encode exactly one UW envelope, while `.uwpkg.zip` is the package
encoding and `.uwpkg.context.json` is a separate, source-file-free context view.
No existing module manifest, calculation pack, or `_meta` ownership rule changes.

## Conformance impact

No current fixture changes are required. The implementation will add:

- `conformance/profiles/lease-abstract/valid.uw.md` plus canonical parse,
  compilation, and projection expectations;
- `conformance/profiles/lease-abstract/missing-locator.*` and
  `ambiguous-term.*` negative cases;
- `conformance/packages/valid-deal-with-lease/` with deterministic manifest,
  member hashes, semantic digests, links, ZIP bytes, and JSON encoding;
- `conformance/packages/json-context-reference/` and
  `json-source-omitted/` to prove source members are described but never embedded
  in the context payload;
- `conformance/packages/tampered-member/`, `dangling-link/`, `duplicate-path/`,
  `zip-traversal/`, `zip-symlink/`, `json-source-inline/`,
  `json-unknown-content/`, `json-digest-mismatch/`, and `unsupported-uw-member/`
  cases;
- `conformance/packages/edge-vocabulary/` — a link whose type is valid at the
  entity layer but not the member layer is rejected; an extension type survives
  a round trip byte-for-byte; a member-layer `supersedes` is proven distinct
  from block-level `_meta` supersede;
- `conformance/packages/link-projection/` — projecting member links to entity
  edges synthesizes provenance naming the `package_id` and member IDs, and the
  reverse projection is refused;
- `conformance/packages/reference-foreign-authority/` — a `connector` handle
  whose `authority` does not match the consumer is reported unresolvable and no
  resolution is attempted;
- `conformance/packages/reference-digest-mismatch/` — bytes obtained from a
  resolved handle that do not match the member digest produce a verification
  failure, while an unreachable handle produces `unverifiable`; and
- a Tier-2 scenario proving a host-applied rent-roll projection changes only the
  selected deal region and preserves every other byte.

## Reference implementation

The initial reference implementation is browser-safe for parsing, validation,
hashing, in-memory ZIP creation, and JSON transport. Files expected to change are
`spec/UW_LITE_SPEC_v1.md`, the structured format/protocol and envelope schemas,
`packages/uwmd-core/src/types.ts`, `protocol.ts`, `envelope.ts`, `index.ts`,
`browser.ts`, and new `lease-abstract.ts`, `deal-package.ts`, and test files.
The CLI will add `uwmd lease validate|project` and `uwmd package create|verify|list|to-context|from-context`.

The public API will add additive `LeaseAbstract`, `LeaseTerm`, `SourceRef`,
`validateLeaseAbstract()`, `projectLeaseAbstractToRentRoll()`, `UWDealPackage`,
`validateUWDealPackage()`, `encodeUWDealPackageZip()`,
`decodeUWDealPackageZip()`, `projectUWDealPackageContext()`, and
`parseUWDealPackageContext()` exports, plus `UWEdgeType`, `UWPackageLink`,
`UWSourceReference`, and `projectPackageLinksToEntityEdges()` for §5's registry
and its one-directional projection. The edge registry itself lives in
`protocol.ts` alongside the other `BUILTIN_*` tables, so it stays the executable
mirror of the protocol spec rather than a second copy. No automatic write from
an abstract to a deal will exist, and no reference-handle resolution will occur
inside validation or projection. Tests cover source locator resolution, null/unknown status
rules, projections, digest verification, archive safety, source-file-free JSON
context semantics, unknown preservation, and determinism.

## Alternatives considered

1. **Put every lease in the existing `rent_roll`.** This makes the facts
   underwriting-local, loses clause-level provenance and amendments, and cannot
   support a reusable standalone lease abstract.
2. **Use only `x_lease_abstract` extension sections.** This is a useful private
   prototype path, but an unvalidated extension cannot provide portable field
   meaning, source-locator rules, or conformance.
3. **Treat a ZIP directory layout as the contract.** Layout-only archives cannot
   prove completeness, byte identity, member roles, or the graph between files.
4. **Embed source PDFs inside each abstract.** This duplicates large evidence,
   makes amendments hard to relate, and destroys package-level deduplication.
5. **Embed source documents in the text context.** This blurs evidence and
   interpretation, wastes connector context, and invites tools to treat a source
   attachment as if it had been reviewed.
6. **Make all contextual documents canonical underwriting records.** A source
   document, extraction note, and signed lease have different assurance levels;
   forcing them into one semantic type would misrepresent evidence as fact.

## Resolved before acceptance

Two questions were previously listed as blocking acceptance. Both are now
settled in the text above:

1. **Relationship of package links to RFC 0015's profile.** Resolved in §5 as
   one registry with an entity layer and a member layer, owned by the protocol
   spec and referenced by both RFCs. The shared `guarantees` and `supports`
   tokens are kept as single types observed at two layers, with an explicit
   one-directional projection that synthesizes provenance on the way up.
2. **Connector-native reference-handle interoperability.** Resolved in §4 as
   typed, namespaced descriptors: a `connector` handle is scoped to the
   `authority` that minted it and is unresolvable to anyone else, identity stays
   anchored to the manifest digest rather than the handle, and resolution is an
   opt-in host action that never happens during validation.

## Unresolved questions

The exact legal-term vocabulary, amendment consolidation rules, support for
multi-tenant/master leases, package signing, encryption, and a full-text/OCR
source profile are intentionally deferred. The profile does not decide legal
enforceability or replace legal review.

Two smaller questions are deferred to implementation rather than blocking
acceptance: whether the entity-layer registry should permit endpoint kinds
beyond RFC 0015's five entity types, and whether a future `deal-context` view
needs its own conformance fixtures or is adequately covered by the requirement
that it declare omitted members.

## Prior art

BagIt manifests, OCI image manifests, and SPDX inventories inform the content
addressed package design. W3C PROV and the draft RFC 0015 relationship model
inform attributable links. The existing UW CSV Bundle safe-ZIP implementation
provides the security baseline for archive handling.
