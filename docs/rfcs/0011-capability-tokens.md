---
rfc: 0011
title: Capability tokens for write authorization
status: draft
author: jaredmaxey
created: 2026-04-27
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0011: Capability tokens for write authorization

## Summary

Define an optional contract by which a write to a `.uw.md` file
carries a short-lived, scope-limited capability token. The token
declares "this writer is authorized to write section X at stage Y for
deal Z, until time T," signed by a coordinator service. The
`applyEdit` API gains an optional `EditContext.capability_token`
field; the editor verifies the token before accepting the write. This
is **opt-in, not part of the open standard's everyday flow** — it
exists for orchestrator-bound deployments (lending platforms, agent
fleets) where authorization has to be enforced at the file API layer
rather than at the network layer.

## Motivation

The default UW Markdown trust model is "the file is the protocol."
Any party with the file can write any section, with the supersede
chain providing audit history. POL-NN codes from RFC's Phase 3 catch
mismatches between `_meta.actor` and a per-section policy table.

That model breaks down in three concrete deployments:

1. **Multi-tenant agent host.** A platform runs hundreds of `agent/L2`
   instances against thousands of deals. The static policy table says
   "agent/L2 may write `noi_model`," but cannot say "this specific
   agent/L2 instance may write deal D's noi_model and no other deal's."
   Today the host enforces that out-of-band — via API auth at the
   network layer. The file itself has no visible record of the
   authorization decision.
2. **Sponsor / lender / appraiser hand-off.** Three external parties
   each get write access to one section of a file for a 24-hour
   window. The current spec has no way to encode that scope. Either
   each party is fully trusted (insecure) or the orchestrator
   reassembles writes from sidecar files (loses the
   single-file-is-the-protocol property).
3. **Forensic reconstruction.** When something goes wrong — a wrong
   value lands in a file, or an unauthorized actor writes — the
   investigator wants to know "who authorized this write, and was the
   authorization in scope?" `_meta.actor` says who claims to have
   written it; a capability token says who authorized it.

Without a spec-defined capability token shape, every adopter that
needs this builds their own, breaking interop and complicating
forensic tools.

## Proposed change

### Token shape

A capability token is a small JWS-Compact encoded object:

```jsonc
// Decoded JWT payload
{
  "iss": "https://coordinator.example.com",   // issuer
  "sub": "agent/L2/instance-abc-123",          // who is authorized
  "aud": "uwmd-edit",                          // audience scope
  "deal": "DEAL-2026-0042",                    // deal_id binding
  "sections": ["noi_model", "debt_structure"], // sections allowed to write
  "stages": ["screening", "term_sheet"],       // stages the token is valid at
  "ops": ["section_supersede", "frontmatter_set"], // edit ops permitted
  "iat": 1745798400,                            // issued at (unix seconds)
  "exp": 1745802000,                            // expiry (unix seconds)
  "jti": "01J9XYZ7K3M2…"                       // unique token id (for revocation tracking)
}
```

Header:

```jsonc
{ "alg": "ed25519", "kid": "coord-2026-04", "typ": "JWT" }
```

Signed with the coordinator's private key (Ed25519 default; ES256
permitted). Verifier holds the coordinator's public key in a
configured `KeyStore` (same shape as RFC 0010).

### `applyEdit` integration

The `EditContext` interface gains:

```ts
interface EditContext {
  // existing fields…

  /** A capability token authorizing this edit. Required only when
   *  the editor is configured with a `capabilityVerifier`. */
  capability_token?: string;
}

interface ApplyEditOptions {
  // existing fields…

  /** When supplied, every write MUST present a token that the
   *  verifier accepts. Edits without a token, or with a rejected
   *  token, fail with EditError code POL-03. */
  capabilityVerifier?: CapabilityVerifier;
}

interface CapabilityVerifier {
  verify(token: string, ctx: { deal_id: string; section: string; stage: DealStage; op: EditOperation['kind'] }): Promise<{
    ok: true;
    sub: string;            // matched against _meta.actor
    jti: string;
  } | {
    ok: false;
    reason: 'expired' | 'wrong_audience' | 'wrong_deal' | 'wrong_section' |
            'wrong_stage' | 'wrong_op' | 'bad_signature' | 'unknown_kid' | 'malformed';
  }>;
}
```

Verification rules:

1. The token's `exp` must be in the future at edit time.
2. The token's `deal` must equal the file's `deal_id` frontmatter.
3. The target section must appear in `sections`.
4. The current `deal_stage` must appear in `stages`.
5. The edit's operation kind must appear in `ops`.
6. The token's `sub` must match the prospective `_meta.actor`.
7. The signature must verify against the configured public key for
   `kid`.

### Token persistence

By default the token itself is **not** stored in the resulting block —
only its `jti` is recorded in `_meta.notes` (or, post-RFC-0009, in
`_meta.provenance.notes`) using the convention
`"capability:<jti>"`. Adopters who want full forensic recall MAY
configure the editor to persist the entire token in a sidecar audit
log (`<file>.audit.jsonl`), but the token is intentionally NOT
embedded in the file because it would expose information about the
coordinator service.

### New error code

| Code | Severity | Trigger |
|---|---|---|
| `POL-03` | error | Capability verifier rejected the token. The `reason` from `verify()` is included in the issue's `details`. |

### CLI

`uwmd edit` gains:

```
uwmd edit <file> <op-spec> --capability-token=<jwt> [--coord-key=<keyfile>]
```

Where `--coord-key` points at the coordinator's public key for
verification. Default behavior (no flag) is the existing model — no
capability check.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected.
- **Tier-1/2/3/4 implementations** — capability checking is opt-in. An
  implementation that doesn't enable it behaves exactly as today.
- **Tier-2 editors that opt in** — gain a hard dependency on a
  coordinator service and a public key for verification.
- **Modules** — unaffected.

This RFC adds a new conformance capability tier: `capability-aware`.
Hosts claiming this MUST pass the capability fixtures.

No deprecation path. Additive.

## Conformance impact

New fixtures (under
`conformance/tier-2-editor/capability-fixtures/`):

- `01-valid-token-accepts/` — well-formed token; edit accepted.
- `02-expired-token-rejects/` — `exp` in past; expects `POL-03 (expired)`.
- `03-wrong-section/` — token scopes `noi_model`; edit targets
  `risk_assessment`; expects `POL-03 (wrong_section)`.
- `04-wrong-deal/` — token's `deal` doesn't match file's `deal_id`;
  expects `POL-03 (wrong_deal)`.
- `05-actor-mismatch/` — token's `sub` is `agent/L2/inst-A`; edit's
  `_meta.actor` is `agent/L2/inst-B`; expects `POL-03 (actor_mismatch)`.
- `06-bad-signature/` — token signed with a different key; expects
  `POL-03 (bad_signature)`.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/protocol.ts` — `CapabilityVerifier`,
    `EditContext.capability_token`, `POL-03`.
  - `packages/uwmd-core/src/editor.ts` — capability check before
    every write.
  - `packages/uwmd-capability/` (new package, optional) — reference
    `CapabilityVerifier` implementation backed by Web Crypto / Node
    crypto, JWT decoder, file-based public-key store.
  - `packages/uwmd-core/src/cli.ts` — `--capability-token` /
    `--coord-key` flags.
  - `spec/UW_PROTOCOL_v1.md` — new §XI "Capability tokens (optional)."
- **API surface:** additive. Default-imported `@uwmd/core` does not
  depend on capability code.
- **Test plan:** sign a token with a known Ed25519 key fixture,
  verify under each rejection branch, property-test that "any
  permutation of token claims that diverges from edit context yields
  a specific `reason`."

## Alternatives considered

1. **Network-layer auth only (status quo).** Rejected because it
   leaves no record in the file of authorization decisions. A file
   exported from one platform to another loses its provenance record.

2. **Embed full token in `_meta.signature` per RFC 0010.** Conflates
   "who signed the content" with "who was authorized to write." Two
   different concerns (one is non-repudiation of authorship; the
   other is policy enforcement at write time) deserve two
   mechanisms.

3. **Inline a token field in `_meta` itself.** Rejected on disclosure
   grounds — tokens often encode coordinator infrastructure that
   shouldn't travel with the file.

4. **Use full OAuth 2 token introspection at edit time.** Far too
   heavy. Self-contained JWT-style tokens with offline verification
   are the right shape; the coordinator is the issuer, not a
   per-edit gatekeeper.

5. **Macaroon-style tokens with caveats.** Macaroons are arguably a
   better fit (the "ops" / "sections" caveats compose naturally), but
   the ecosystem support is thin and JWT is what every adopter
   already knows.

## Unresolved questions

- **Revocation.** JWTs are notoriously hard to revoke. A short `exp`
  (default proposal: 1 hour) makes revocation a non-issue most of
  the time, but agents writing a long sequence of edits need a
  refresh story. Probably: the coordinator issues a fresh token every
  N edits or M minutes, the agent's edit loop refreshes
  transparently. Not part of the spec; coordinator-implementation
  detail.
- **Token storage policy.** When operators enable persistent tokens
  (sidecar audit log), retention is on them. Spec recommends 90 days
  default but does not normatively require any retention.
- **Multi-issuer scenarios.** A file could be edited under tokens
  from different coordinators (sponsor's, lender's). The verifier
  must hold all relevant public keys. No spec change needed; just a
  configuration concern. Worth a non-normative note.
- **Token binding to a specific block content_hash.** Stronger
  guarantee: "this token authorizes edit producing exactly this hash."
  Rejected for v1 — too rigid; agent retries become impossible. May
  revisit if a deployment specifically asks.

## Prior art

- **JWT (RFC 7519)** — the obvious base layer. We use it.
- **Biscuit tokens** ([biscuitsec.org](https://www.biscuitsec.org)) —
  attenuable capability tokens. Considered for the "agent gets a
  short-lived token, attenuates further before passing to a sub-agent"
  pattern; deferred as more complexity than needed for v1.
- **GitHub fine-grained PATs** — same shape: scoped to a resource,
  scoped to operations, time-limited. Inspired our claim choice.
- **AWS STS session tokens** — similar shape with role assumption.
  We don't model role assumption explicitly; the coordinator
  encapsulates it.
