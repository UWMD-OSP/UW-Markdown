---
rfc: 0084
title: Bind a document snapshot without discarding signed block attribution
status: accepted
accepted: 2026-10-14
author: UWMD maintainers
created: 2026-10-14
depends_on:
  - 0010
  - 0016
  - 0032
  - 0078
  - 0081
  - 0083
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0084: Bind a document snapshot without discarding signed block attribution

**Accepted direction (2026-10-14).** The owner authorized implementation
after reviewing the draft in PR #325. This PR carries the implementation
and addresses [issue #321](https://github.com/UWMD-OSP/UW-Markdown/issues/321);
publication remains a separate release step.

## Summary

Add an optional detached document signature over the existing Document
Envelope semantic digest. A verifier requiring document authentication must
check this signature and recompute its subject digest before reporting the
snapshot as authenticated. This binds variant labels, current/superseded
state, frontmatter and the semantic membership of all document collections.
Existing block signatures continue to establish independent block
attribution. They do not, by themselves, authenticate a document snapshot.
Signing a snapshot requires no calculation pack or financial computation.

## Motivation

Protocol §V.11.2 signs six block facts: `content_hash`, `section`, `actor`,
`timestamp`, `kid` and `signed_at`. The block hash excludes `_meta` (§V.9),
and the fence's `variant=` is outside both commitments. Format §§2.7–2.8
use variant labels and superseded state to select what a document says.

Issue #321 identifies three edits that block signatures cannot detect:

1. Relabel a signed T12 statement as the budget, or exchange their labels.
2. Reactivate a signed historical statement and supersede the current one.
3. Insert a valid signed block from a different document by the same signer.

These are document-authentication failures even when each signed payload
remains unchanged. A count of verified block signatures cannot answer
whether the signer assembled this particular document.

The reference implementation already provides the needed semantic digest:
`toUWEnvelope(parsed)` includes annotations, content, frontmatter, current
sections, extensions, custom calculations/scenarios, the pipeline log and
superseded history; `computeEnvelopeDigest` excludes only the envelope's
`generated_at`, `generator` and `semantic_digest`. Local synthetic probes
using the signing conformance key confirm that changing a variant label,
superseded state or frontmatter retains the block signature but changes
this digest. Those probes identify a reusable mechanism, not conformance
evidence for an unimplemented document verifier.

UW Receipt §3.1 already calls that canonicalization `uw-envelope-semantic`.
A signed computation receipt can bind that subject today, but issuing one
requires a pack and its computation results (§3.2). Authentication should
also work for standalone documents, incomplete underwriting records and
third-party sections that have no applicable calculation pack.

## Proposed change

### 1. Separate the two claims

Add Protocol §V.13, **Document snapshot signatures**, and clarify §V.11.2:

> A verified block signature authenticates the block signing input defined
> in §V.11.2. It MUST NOT be presented as authentication of the document's
> frontmatter, variant selection, lifecycle state or collection membership.
> A verifier claiming an authenticated document snapshot MUST verify a
> document signature under §V.13 against that document's canonical subject.

Document signing remains an optional Integrity-profile capability. Reader
and Verifier tier conformance alone implies no signer trust or signature
verification. A deployment chooses which signer keys it trusts out of band.

### 2. Detached artifact

The conventional sidecar name is `<document>.signature.json`. Transport
may instead carry the artifact alongside the document; the filename is
not part of the cryptographic commitment. It MUST NOT be embedded in the
document or its envelope, avoiding a digest/signature cycle.

Illustrative shape (the digest and signature below are placeholders):

```json
{
  "kind": "uwmd-document-signature",
  "signature_version": "1",
  "subject": {
    "representation": "uwx-markdown",
    "representation_version": "1.0",
    "canonicalization": "uw-envelope-semantic",
    "canonicalization_version": "1.0",
    "digest": "sha256:<64 lowercase hexadecimal digits>"
  },
  "alg": "ed25519",
  "kid": "document-issuer-2026",
  "signed_at": "2026-10-14T20:00:00Z",
  "sig": "<canonical unpadded base64url signature bytes>"
}
```

All displayed fields are required. Both objects are closed: unknown members
MUST refuse. The first version admits only the displayed `kind`,
`signature_version` and subject identifiers. `alg` uses §V.11.1's closed
algorithm vocabulary; `kid` MUST be nonempty; `signed_at` MUST be an
ISO 8601 instant. No key material belongs in the artifact.

Signature bytes follow §V.11.1: canonical unpadded base64url with zero
unused bits, raw Ed25519 or IEEE P1363 ECDSA, with the algorithm's exact
width. The #322 implementation fix remains applicable.

### 3. Exact signing input

The signing input MUST be the RFC 8785 canonicalization of the complete
artifact with **only `sig` removed**. Sign and verify therefore bind the
artifact kind, version, complete subject, algorithm, key identifier and
signing time. Implementations MUST NOT remove the entire signature metadata
or substitute a null value for the removed member.

The `kind` discriminator separates document-signature inputs from block,
module and receipt signing inputs. Changing `alg`, `kid` or `signed_at`
after signing invalidates the signature even if the alternate key-store
entry refers to the same public key.

### 4. Exact subject

For a Format 3.0 structured Markdown source:

1. Parse the supplied source using the current Format reader. A syntax or
   structural ambiguity preventing a faithful envelope MUST refuse signing
   and MUST prevent successful verification. Inconsistent section identity
   or lifecycle declarations cannot be silently repaired for authentication.
   Before collection reduction, scan all UW section fences. More than one
   non-superseded block for the same effective section/variant selection key
   MUST refuse; revision numbers cannot select a winner for authentication.
   Append-only collections such as `pipeline_log`, `custom_calculations` and
   `custom_scenarios` are not singleton selection keys. Repeated extension
   ids MUST refuse because the current envelope has only one slot per id.
2. Project the parsed document to the normative Document Envelope with
   superseded history included. Do not select a scenario, pack or variant,
   omit archival blocks, or filter unsupported extensions.
   Every scanned UW section block MUST appear exactly once in the projection.
   A missing, duplicated or overwritten block MUST refuse authentication.
   This accounting includes unknown sections and historical extension blocks;
   a source that the current projection cannot preserve must be refused.
3. Remove only the envelope's top-level `generated_at`, `generator` and
   `semantic_digest`. Canonicalize the remaining value using RFC 8785.
4. Compute SHA-256 over the canonical string's UTF-8 bytes and render
   `sha256:` plus 64 lowercase hexadecimal digits.

These are the existing `uw-envelope-semantic` version `1.0` rules. They
MUST be stated completely in normative text alongside the implementation,
including the Format-to-envelope projection; a verifier must not need the
starter toolkit or infer the rules from its source code. Reusing the
receipt subject identifiers does not make the artifact a computation receipt.

The canonical value covers every annotation and content member retained by
that projection, including inline `_meta`, existing block signatures,
variant-map keys and superseded-history arrays. A verifier MUST derive it
from the source actually supplied, not a caller-provided digest or filtered
parsed object. No stale `semantic_digest` may substitute for recomputation.

This is **semantic snapshot authentication**. It does not certify original
Markdown bytes or byte offsets. Serialization edits that leave the envelope
semantic value identical may preserve the signature. Section prose retained
by the envelope is bound; Markdown material outside that projection is not.
The full set of retained and excluded material must have conformance vectors
before this capability ships. UW Lite and additional source representations
are follow-ups, not accepted aliases for the first version's subject.

### 5. Verification and absence

Verification of a requested document signature is total and returns one
of four states:

| State | Meaning |
|---|---|
| `verified` | Admitted artifact, trusted key resolved, signature valid, subject recomputed and equal. |
| `failed` | Malformed admitted artifact, malformed source, invalid signature, algorithm mismatch or subject digest mismatch. |
| `unverifiable` | Signature present but backend/key unavailable, or unsupported artifact/representation/canonicalization version. |
| `unsigned` | No document-signature artifact supplied. |

A result MUST retain a structured reason rather than collapse unknown
keys, unsupported versions and changed content into a single error.

`verified` requires **both** the artifact signature and recomputed subject
digest. A valid signature over a mismatched digest authenticates an artifact
about a different snapshot and MUST report `failed` for the supplied source.

If document authentication is required, every state except `verified`
MUST refuse acceptance. In particular, deleting the sidecar, withholding the
verification backend or pointing at an unknown key cannot become a pass.
Block-signature counts MUST NOT upgrade `unsigned` or `unverifiable`.
Authentication remains distinct from financial verification and policy
acceptance: a signer can authenticate a record containing wrong numbers.

The Integrity result will expose document authentication separately from
`signatures_present` and `signatures_verified`, which continue to count
blocks. The CLI MUST display the scope of each claim explicitly; it may
say that blocks were attributed while the document is unsigned.

### 6. Lifecycle and multi-party assembly

Do **not** add `superseded` to the block signing input. Format §2.7 lets a
host supersede a prior block while preserving its author's evidence. Adding
the mutable flag would require the original signer to return whenever any
later writer appends a revision, or would leave invalid signatures in the
history that §V.11.3 requires a verifier to sweep.

The document signature binds the lifecycle state and variant labels in the
assembled snapshot. Editing either requires a new document signature. A
host may assemble blocks attributed to several parties and sign its own
assembled snapshot without impersonating any of those block authors.

Compacting history, appending a block, adding a block signature, re-rooting a
chain or changing frontmatter changes the semantic snapshot and requires
a new document signature. Existing detached artifacts remain evidence about
their original snapshots. A document signature does not assert that every
block author approved the entire assembly.

### Decisions

| Question | Proposed decision | Basis |
|---|---|---|
| Bind selection and membership where? | Whole-record signature over the semantic envelope. | Format §§2.7–2.8; issue #321's three edits. |
| Preserve block authorship after supersession? | Keep the six-field block signing input. | RFC 0010's multi-party attribution; append-only provenance. |
| Reuse existing canonicalization? | `uw-envelope-semantic` 1.0, including history. | UW Receipt §3.1 and the current envelope digest. |
| Require calculations to authenticate a record? | No; a dedicated detached artifact. | Standalone documents and verification/toolkit separation. |
| What does absent authentication mean? | Explicit `unsigned`; required authentication refuses. | Present-and-unchecked block signatures and receipt `unverifiable` precedent. |
| Reuse signer metadata without binding it? | No; include `alg`, `kid`, `signed_at` and kind/version in the payload. | One exact cryptographic claim; module payload omission precedent. |

## Compatibility analysis

The proposal is additive. Existing Format 3.0 files, block signatures and
computation receipts keep their shape and verification inputs. Readers and
the base Verifier tier gain no signature requirement. The new optional
Integrity capability must be explicitly claimed and invoked.

A consumer requiring an authenticated document will refuse records carrying
only block signatures. This is an explicit acceptance policy for a stronger
claim, not retroactive invalidation of block attribution. Consumers must
issue a document signature for the snapshot they intend to authenticate.

No compatibility reader, fallback signing input or transition period is
proposed. Module manifests and module signature inputs are unchanged;
documents with module sections can be authenticated without evaluating them.
The implementation requires an additive Protocol version change; the
release selects its exact version after other pending RFCs are reconciled.
The implementation moves the accepted, unreleased Protocol to 4.1.0.
Published package versions remain unchanged until release preparation.

## Conformance impact

Keep the existing `conformance/signing/blocks/` fixtures, including the
metadata-only edit and #322's refusal cases. Add a document-signature suite
under the optional Integrity profile with independent deterministic keys,
canonical payload bytes, subject digests, artifacts and expected verdicts.

Required positive and refusal cases:

- One authenticated document containing signed T12, budget and historical
  T12 blocks; verify both block attribution and document authentication.
- Exchange `variant=t12` and `variant=budget`: block signatures still verify;
  document subject mismatch must fail.
- Flip current and superseded flags in both metadata and annotation:
  document authentication must fail, including after a fresh parse.
- Splice a block signed by the same key from another source; delete a block;
  append a block; omit superseded history: each must fail.
- Change frontmatter, inline metadata or a retained prose field: fail.
- Change only cosmetic serialization preserving the semantic envelope: pass.
- Edit a stale stamped envelope digest: it cannot bypass recomputation.
- Alter `alg`, `kid`, `signed_at` or subject identifiers on a signed artifact:
  no successful authentication, including a second key id for the same key.
- Missing artifact, unknown key, unavailable backend, unknown version and
  missing required capability: preserve their distinct states and refuse
  when authentication is required.
- Malformed/padded/non-canonical/wrong-width signature bytes: fail.
- Ambiguous or inconsistent source declarations: refuse before signing.
- Duplicate active section/variant keys, regardless of revision ordering,
  repeated extension ids and any projection that loses a UW section block:
  refuse signing and verification. Reordering independent unambiguous
  sections may preserve the digest; changing a retained ordered collection
  must change it.
- Multiple block authors, signer not a block author, incomplete records and
  custom module sections: authenticate without requiring a calculation pack.
- Re-sign an edited snapshot: new artifact verifies; prior artifact fails
  against the edit and still verifies against its original snapshot.

Add vectors for every projection collection and for excluded Markdown
material. The corpus index, capability vocabulary, implementation manifest,
portable case generator and both reference/portable runners must agree.

## Reference implementation

Normative wire types, canonical subject/payload construction, shape checks
and the crypto-free verification seam belong in `@uwmd/verify`. Crypto and
key-store resolution remain in `@uwmd/signing`; core re-exports the verifier
surface and adds CLI plumbing only.

Proposed public API:

- `UWDocumentSignature`, `DocumentSignatureVerifier`, and a discriminated
  `DocumentSignatureResult` type in verify.
- `documentSigningPayload(artifact)` and
  `resolveDocumentSigningSubject(source)` in verify.
- `verifyDocumentSignature(source, artifact, options)` in verify; the
  signature backend is injected. Missing artifacts return `unsigned`.
- `signDocument(source, key, { signedAt })` and
  `createDocumentSignatureVerifier(store)` in signing.
- `uwmd sign-document <source> --key=<signer> --out=<artifact>` and
  `uwmd verify <source> --document-signature=<artifact> --keystore=<store>`.
  Supplying `--document-signature` requests required document authentication;
  an unreadable artifact cannot be treated as unsigned input and ignored.

Reuse the envelope canonicalizer without importing starter code. A new
verify module must enter the standard-closure inventory. Add the detached
artifact schema, register the capability and failure-code contracts, update
Protocol §V.11/§V.13 and the receipt canonicalization description together.
The latter currently says envelope receipts fail "only on financial change";
its projection also covers annotations, metadata and retained prose, so the
scope must be made accurate without silently changing canonical bytes.

Implementation touches verify's types/protocol/exports and integrity,
envelope and receipt modules; signing's sign/verify/exports; core's CLI,
reference manifest and documentation; schemas and conformance tooling.
Tests must cover raw-source reparsing, projection completeness, stale digests,
required authentication, all three admitted algorithms and multi-party
assembly. Existing block-signature and receipt tests must remain green.

## Alternatives considered

**Bind `variant` and `superseded` into each block signature.** This catches
selection edits but not insertion from another document. Binding the mutable
superseded flag also breaks historical attribution whenever a host advances
the revision without the prior author's signing key. Whole-record signing
addresses selection and membership while preserving independent authorship.

**Require a signed computation receipt for every authenticated record.** This
can bind an existing structured subject, but entangles authentication with
pack resolution and computation. Keep receipts for their arithmetic claim;
reuse their subject canonicalization in a computation-independent artifact.

**Sign a new manifest listing content hashes.** A list of payload hashes omits
frontmatter, annotations and metadata unless it grows an additional
projection. The complete semantic envelope already contains these facts and
their collection membership. A parallel projection risks inconsistent scope.

**Sign raw Markdown bytes.** This authenticates byte order and all prose, but
every harmless JSON spacing or line-ending edit requires re-signing. It is a
different claim from the existing semantic envelope; it can be proposed as
a separate canonicalization if byte-exact evidence is required.

**Clarify block-only scope without adding document authentication.** Correct
wording is necessary, but supplies no interoperable mechanism for a lender
to authenticate a complete snapshot and leaves issue #321's workflow gap.

## Unresolved questions

The source accounting guard and collection vectors pin the accepted
projection without changing `uw-envelope-semantic` 1.0. In addition to
duplicate active selection keys and repeated extension ids, historical
extension blocks refuse because the current envelope has no faithful
archive slot for them. Duplicate decoded JSON/YAML keys and ambiguous fence
attributes refuse before projection. Integrity verification also refuses
a parsed object whose semantic digest differs from its supplied raw source.

Key rotation, external timestamp authorities, byte-exact signatures, and
authentication of Lite or other representations remain separate work.
No new financial convention or external npm dependency is needed.

## Prior art

- [RFC 0010](0010-signed-blocks.md): independent block attribution and
  out-of-band key trust.
- [RFC 0016](0016-verification-receipts.md): detached artifacts and canonical
  subject digests, with financial verification as a separate claim.
- [RFC 0002](0002-module-signing.md): canonical signed objects with the
  signature member omitted.
- [RFC 0083](0083-verify-package-split.md): verification independent of
  starter products and vendor SDKs.
