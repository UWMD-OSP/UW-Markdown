---
rfc: 0011
title: Capability tokens for write authorization
status: draft
author: jaredmaxey
created: 2026-04-27
revised: 2026-09-01
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0011: Capability tokens for write authorization

> **Revised 2026-09-01** against everything implemented since the April
> draft. The mechanism survives intact — a short-lived, scope-limited JWT the
> editor verifies before accepting a write. What changed: the token's `sub`
> now binds to **`_meta.source` under the RFC 0031 actor grammar** (the
> draft's `agent/L2/instance-abc-123` has two slashes and is outside the
> grammar; instance identity fits the id charset as `agent/L2.instance-abc-123`,
> and free-form `_meta.actor` is display, not authorization); tokens are
> normatively **AND with static edit policy, never an escalation** — which
> also answers the `institution/*` question RFC 0031's catch-all surfaced;
> the verifier is **injected on the `ReceiptSignatureVerifier` precedent**
> (RFC 0016) and its reference implementation lives in **`@uwmd/signing`**
> (which did not exist in April and is now the crypto companion — no new
> package, no crypto in core); enforcement is honored by **`applyEditAsync`
> only**, like `integrity:` (verification is async crypto), and a configured
> verifier on the sync path refuses rather than silently skipping; the
> proposed spec home moves to **Protocol §XIV** (the draft's §XI is now the
> error taxonomy); conformance uses the **RFC 0030 capability mechanism**
> (`capability-verify` in `ViewerCapability`, a named `capability` suite)
> instead of the draft's ad-hoc "capability-aware tier"; and the draft's
> fixture 05 expected a `reason` (`actor_mismatch`) missing from its own
> union — the union now carries `sub_mismatch`.

## Summary

Define an optional contract by which a write to a `.uw.md` file carries a
short-lived, scope-limited capability token. The token declares "this writer
is authorized to write section X at stage Y for deal Z, until time T," signed
by a coordinator service. `applyEditAsync` gains an optional
`EditContext.capability_token` field and an injected `CapabilityVerifier`;
the editor verifies the token before accepting the write. This is **opt-in,
not part of the open standard's everyday flow** — it exists for
orchestrator-bound deployments (lending platforms, agent fleets) where
authorization has to be enforced at the file API layer rather than at the
network layer.

## Motivation

The default UW Markdown trust model is "the file is the protocol." Any party
with the file can write any section, with the supersede chain providing audit
history. The static policy table (`BUILTIN_EDIT_POLICIES`, protocol §V.3)
classifies writers by `_meta.source` pattern and `POL-01`/`POL-02` catch
authority and supersede violations.

That model breaks down in three concrete deployments:

1. **Multi-tenant agent host.** A platform runs hundreds of `agent/L2`
   instances against thousands of deals. The static policy table says
   "namespaced `agent/*` writes supersede," but cannot say "this specific
   agent instance may write deal D's noi_model and no other deal's." Today
   the host enforces that out-of-band — via API auth at the network layer.
   The file itself has no visible record of the authorization decision.
2. **Sponsor / lender / appraiser hand-off.** Three external parties each get
   write access to one section of a file for a 24-hour window. The current
   spec has no way to encode that scope. Either each party is fully trusted
   (insecure) or the orchestrator reassembles writes from sidecar files
   (loses the single-file-is-the-protocol property).
3. **Forensic reconstruction.** When something goes wrong — a wrong value
   lands in a file, or an unauthorized actor writes — the investigator wants
   to know "who authorized this write, and was the authorization in scope?"
   `_meta.source` says who claims to have written it; a capability token says
   who authorized it.

Without a spec-defined capability token shape, every adopter that needs this
builds their own, breaking interop and complicating forensic tools.

## Proposed change

### Tokens narrow, never widen (the policy interaction rule)

A capability token is **a second gate ANDed with static edit policy, never an
escalation past it**. Verification runs *after* the §V.3 authority check: a
write the static table refuses (e.g. an agent writing a `system/*`-sourced
block, `POL-01`) stays refused no matter what a token claims, and a write the
table permits additionally needs an in-scope token once a verifier is
configured.

This is deliberate, and it resolves the question RFC 0031's catch-all left
open: **`institution/*` keeps `system_only`.** The static table is the floor
every implementation can read offline from the file and the protocol alone;
if a token could override it, the file's own policy story would depend on
key material the reader does not hold. A deployment that wants
agent-authored institution overrides models that as the coordinator issuing
the write to a `system/*` writer it controls — an orchestration pattern, not
a policy escalation.

### Token shape

A capability token is a JWS Compact–encoded JWT:

```jsonc
// Decoded payload
{
  "iss": "https://coordinator.example.com",    // issuer
  "sub": "agent/L2.instance-abc-123",           // the RFC 0031 actor source being authorized
  "aud": "uwmd-edit",                           // audience scope (fixed string)
  "deal": "DEAL-2026-0042",                     // frontmatter deal_id binding
  "sections": ["noi_model", "debt_structure"],  // section ids the token may write
  "stages": ["screening", "term_sheet"],        // DealStage values the token is valid at
  "ops": ["section_supersede", "frontmatter_set"], // EditOperation kinds permitted
  "iat": 1745798400,                            // issued at (unix seconds)
  "exp": 1745802000,                            // expiry (unix seconds)
  "jti": "01J9XYZ7K3M2…"                        // unique token id (for audit / revocation tracking)
}
```

`sub` MUST be a valid actor source under the RFC 0031 grammar (format spec
§2.6): `manual` or `<namespace>/<id>` with
`id = [A-Za-z0-9][A-Za-z0-9._-]*`. Instance identity lives inside the id
segment (`agent/L2.instance-abc-123`) — the grammar's dot/dash charset was
chosen to carry exactly this. The April draft's two-slash
`agent/L2/instance-abc-123` is outside the grammar and invalid.

Header:

```jsonc
{ "alg": "EdDSA", "kid": "coord-2026-04", "typ": "JWT" }
```

Signed with the coordinator's private key (Ed25519 default, matching RFC
0010's `UW_SIGNATURE_ALGORITHMS`; ES256 permitted). The verifier holds the
coordinator's public keys in the same `KeyStore` shape `@uwmd/signing`
already ships for block signatures — one key-distribution story, not two.

### `applyEditAsync` integration

The editor's surface follows the RFC 0016 injection precedent
(`ReceiptSignatureVerifier`): core defines the interface and the hook; the
crypto lives behind it.

```ts
interface EditContext {
  // existing fields…

  /** A capability token authorizing this edit. Required whenever the
   *  editor is configured with a `capabilityVerifier`. */
  capability_token?: string;
}

interface EditOptions {
  // existing fields (maintainGaps, integrity)…

  /** When supplied, every write MUST present a token the verifier accepts.
   *  Edits without a token, or with a rejected token, fail with POL-03.
   *  Honored by `applyEditAsync` only (verification is async crypto);
   *  `applyEdit` (sync) with this option set refuses the edit with a
   *  PROTO-level error rather than silently skipping the check. */
  capabilityVerifier?: CapabilityVerifier;
}

interface CapabilityVerifier {
  verify(token: string, ctx: {
    deal_id: string;
    section: string;
    stage: DealStage | null;
    op: EditOperation['kind'];
    /** The prospective block's `_meta.source` (RFC 0031 actor). */
    source: string;
  }): Promise<
    | { ok: true; sub: string; jti: string }
    | { ok: false; reason: CapabilityRejection }
  >;
}

type CapabilityRejection =
  | 'expired' | 'not_yet_valid' | 'wrong_audience' | 'wrong_deal'
  | 'wrong_section' | 'wrong_stage' | 'wrong_op' | 'sub_mismatch'
  | 'bad_signature' | 'unknown_kid' | 'malformed';
```

Verification rules (all MUST hold):

1. The token parses as JWS Compact with a known `kid` and the signature
   verifies (`malformed` / `unknown_kid` / `bad_signature`).
2. `iat ≤ now < exp` (`not_yet_valid` / `expired`).
3. `aud` is `uwmd-edit` (`wrong_audience`).
4. `deal` equals the file's frontmatter `deal_id` (`wrong_deal`).
5. The target section appears in `sections` (`wrong_section`). Frontmatter
   ops use the reserved name `_frontmatter`.
6. The file's declared `deal_stage` appears in `stages` (`wrong_stage`); a
   file with no declared stage fails this check unless the token's `stages`
   is absent (an absent claim means unconstrained — same posture for
   `sections` and `ops`).
7. The edit's operation kind appears in `ops` (`wrong_op`).
8. `sub` equals the prospective block's `_meta.source` (`sub_mismatch`).
   Free-form `_meta.actor` is display metadata and takes no part in
   authorization.

The static §V.3 authority check runs first; POL-01/POL-02 refusals are
unchanged and are never overridden by a token.

### Token persistence

By default the token itself is **not** stored in the resulting block — only
its `jti` is recorded in `_meta.notes` using the convention
`capability:<jti>`, appended to any existing notes with a `; ` separator.
(RFC 0009's v2 reorg slots this under `provenance.notes`; nothing here
front-runs that.) Adopters who want full forensic recall MAY configure the
editor to persist the entire token in a sidecar audit log
(`<file>.audit.jsonl`), but the token is intentionally NOT embedded in the
file: it would expose coordinator infrastructure, and per RFC 0032's
posture, provenance metadata is already outside any cross-producer
hash-agreement guarantee — adding a token would not buy verifiability,
only disclosure.

### New error code

| Code | Severity | Trigger |
|---|---|---|
| `POL-03` | error | Capability verifier rejected the token (or none was presented while a verifier is configured). The `reason` from `verify()` is included in the issue detail. |

`POL-03` is free (the registry holds POL-01/POL-02) and lands in the
already-registered `POL` family (§III.6a), owned by
`edit-replace`/`edit-supersede` — no new family needed for the error code
itself.

### Protocol and conformance registration (RFC 0030 shape)

- New **Protocol §XIV — Capability tokens (optional)**; the current §XIV
  (future work, non-normative) renumbers to §XV. The draft's proposed §XI is
  long since taken by the error taxonomy.
- New `ViewerCapability` value **`capability-verify`**, claimed by hosts
  that enforce tokens. Conformance cases for POL-03 are tagged with it, so a
  host that does not opt in owes nothing (the §II.6a.5 mechanism, exactly as
  `signature-verify` works for RFC 0010).
- New named conformance suite **`conformance/capability/`** (the
  `capital-stack`/`lease-up` precedent — a named suite, not fixtures buried
  under `tier-2-editor/`).

### CLI

`uwmd edit` gains:

```
uwmd edit <file> <op-spec> --capability-token=<jwt> [--coord-key=<keyfile>]
```

`--coord-key` points at the coordinator's public key (the `@uwmd/signing`
KeyStore file shape). Default behavior (no flag) is the existing model — no
capability check.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected; no format change at all (the
  `jti` note rides the existing free-text `notes`).
- **Tier-1/2/3/4 implementations** — capability checking is opt-in. An
  implementation that doesn't configure a verifier behaves exactly as today.
- **Tier-2 editors that opt in** — gain a dependency on a coordinator's
  public key. Core itself gains **no** crypto dependency: the interface is
  injected, the reference verifier ships in `@uwmd/signing` (which the owner
  decided 2026-09-01 to publish), preserving the layering invariant the
  same way the receipt and block-signature verifiers do.
- **Sync editing** — `applyEdit` with a configured verifier refuses rather
  than skipping; deployments that enforce tokens are async-only, which they
  already are if they use `integrity:`.
- **Modules** — unaffected.

No deprecation path. Additive. Protocol minor bump.

## Conformance impact

New named suite `conformance/capability/`, cases tagged
`capability-verify`:

- `01-valid-token-accepts/` — well-formed in-scope token; edit accepted;
  `jti` recorded in the new block's notes.
- `02-expired-token-rejects/` — `exp` in past → `POL-03 (expired)`.
- `03-wrong-section/` — token scopes `noi_model`; edit targets
  `risk_assessment` → `POL-03 (wrong_section)`.
- `04-wrong-deal/` — token's `deal` ≠ file's `deal_id` → `POL-03 (wrong_deal)`.
- `05-sub-mismatch/` — token's `sub` is `agent/L2.inst-A`; edit's
  `_meta.source` is `agent/L2.inst-B` → `POL-03 (sub_mismatch)`.
- `06-bad-signature/` — signed with a different key → `POL-03 (bad_signature)`.
- `07-no-escalation/` — a token naming a `system/*`-sourced section's write
  for an `agent/*` sub; static POL-01 still refuses — the AND rule pinned.
- `08-missing-token/` — verifier configured, no token presented → `POL-03`.

Deterministic Ed25519 key fixtures reuse the `conformance/signing/` key
material where possible.

## Reference implementation

- `packages/uwmd-core/src/protocol.ts` — `CapabilityVerifier`,
  `CapabilityRejection`, `POL-03` remediation, `capability-verify` in
  `ViewerCapability`.
- `packages/uwmd-core/src/editor.ts` — the gate in `applyEditAsync` (after
  checkAuthority, before the write); the sync-path refusal.
- `packages/uwmd-signing/` — the reference `CapabilityVerifier` (JWT decode +
  Ed25519/ES256 verify over the existing KeyStore), exported alongside the
  block-signature machinery. **No new package** — the April draft's
  `@uwmd/capability` predates `@uwmd/signing`'s existence.
- `packages/uwmd-core/src/cli.ts` — `--capability-token` / `--coord-key`.
- `spec/UW_PROTOCOL_v1.md` — new §XIV; §XIV→§XV renumber; §III.6a note on
  POL-03's trigger; §II.6a capability row.
- Protocol version: minor bump.
- Test plan: sign with a known Ed25519 key fixture, hit every rejection
  branch, and property-test that any single claim divergence from the edit
  context yields its specific `reason`.

## Alternatives considered

1. **Network-layer auth only (status quo).** Rejected: leaves no record in
   the file of authorization decisions; a file exported across platforms
   loses that history.
2. **Embed the token in `_meta.signature` (RFC 0010).** Conflates
   non-repudiation of authorship with policy enforcement at write time —
   two mechanisms on purpose. (Post-0010 this is now concrete: a signature
   covers canonical block bytes after the write; a capability is checked
   before it.)
3. **Inline a token field in `_meta`.** Rejected on disclosure grounds, and
   post-RFC-0032 it demonstrably buys nothing: provenance metadata is
   outside cross-producer hash agreement anyway.
4. **Full OAuth 2 introspection at edit time.** Too heavy; offline-verifiable
   self-contained tokens are the right shape.
5. **Macaroons / Biscuit attenuation.** Better theory, thinner ecosystem;
   JWT is what every adopter already runs. Attenuation (agent hands a
   narrower token to a sub-agent) is deferred with them.
6. **Tokens that can escalate past static policy.** Rejected — see "Tokens
   narrow, never widen." This was the open `institution/*` question and it
   is resolved by this rule, not by loosening the table.

## Unresolved questions

- **Revocation.** Short `exp` (default 1 hour) makes revocation mostly moot;
  long-running agents refresh via the coordinator (issue a fresh token every
  N edits or M minutes). Coordinator-implementation detail, not spec.
- **Token storage retention.** Sidecar audit-log retention is on the
  operator; the spec recommends 90 days, non-normatively.
- **Multi-issuer scenarios.** A file edited under sponsor's and lender's
  coordinators means the verifier holds several public keys — a KeyStore
  configuration concern, worth a non-normative note in §XIV, no mechanism.
- **Binding a token to a specific `content_hash`.** "This token authorizes
  exactly this bytes-result" is stronger but breaks agent retries. Rejected
  for v1; revisit on a deployment's concrete ask.

## Prior art

- **JWT (RFC 7519)** — the base layer; used as-is.
- **RFC 0010/0016 in-repo** — the KeyStore, Ed25519 defaults, and the
  injected-verifier pattern this RFC now rides instead of reinventing.
- **Biscuit tokens** (biscuitsec.org) — attenuable capabilities; deferred.
- **GitHub fine-grained PATs** — resource-scoped, operation-scoped,
  time-limited; inspired the claim choice.
- **AWS STS session tokens** — similar shape; role assumption not modeled
  (the coordinator is the policy engine).
