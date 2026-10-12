# Starter products: Capability tokens

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL.md)
> §XIV
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D10). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

## XIV. Capability Tokens (optional, RFC 0011)

An **opt-in** second gate on writes, for orchestrator-bound deployments
(lending platforms, agent fleets) where authorization must be enforced at
the file API layer rather than the network layer. Nothing in this section
applies to a host that does not configure a verifier; the everyday flow of
the open standard is unchanged.

### XIV.1 Tokens narrow, never widen

A capability token is a second condition **ANDed with the static §V.3 edit
policy, never an escalation past it**. The §V.3 authority check runs
regardless of any token: a write the policy table refuses stays refused no
matter what a token claims, and once a verifier is configured, a write the
table permits additionally needs an in-scope token.

This is deliberate. The static table is the floor every implementation can
evaluate offline from the file and this document alone; if a token could
override it, a document's policy story would depend on key material the
reader does not hold. In particular, **`institution/*` keeps
`system_only`** — a deployment wanting agent-authored institution overrides
models that as its coordinator issuing the write to a `system/*` writer it
controls, an orchestration pattern rather than a policy escalation.

### XIV.2 Token shape

A capability token is a JWS Compact–encoded JWT. Header:
`{ "alg": <JOSE name>, "kid": <key id>, "typ": "JWT" }`, where the JOSE
`alg` maps onto the §V.11 algorithm shortlist (`EdDSA` → `ed25519`,
`ES256` → `es256`, `ES384` → `es384`; Ed25519 is the default). The verifier
resolves `kid` through the same key-store contract §V.11 block signatures
use — one key-distribution story, not two.

Claims:

| Claim | Meaning |
|---|---|
| `iss` | Coordinator identity (informational). |
| `sub` | The actor being authorized — a **valid §2.6 actor source** (`manual` or `<namespace>/<id>`). Instance identity lives inside the id segment (`agent/L2.instance-abc-123`); a `sub` outside the grammar is `malformed`. |
| `aud` | MUST be `uwmd-edit`. |
| `deal` | Binds to the file's frontmatter `deal_id`. |
| `sections` | Section ids the token may write; frontmatter ops use the reserved name `_frontmatter`, pipeline-log appends `pipeline_log`. Absent = unconstrained. |
| `stages` | `deal_stage` values the token is valid at. Absent = unconstrained. |
| `ops` | `EditOperation` kinds permitted. Absent = unconstrained. |
| `iat` / `exp` | Validity window, unix seconds. Short lifetimes (default guidance: 1 hour) are the revocation story. |
| `jti` | Unique token id, recorded on the written block (§XIV.4). |

### XIV.3 Verification

When an editor is configured with a capability verifier, every write MUST
present a token, and ALL of the following MUST hold — each failure maps to
a typed reason surfaced with the `POL-03` refusal:

1. The token parses as JWS Compact, names a known `kid`, and its signature
   verifies (`malformed` / `unknown_kid` / `bad_signature`).
2. `iat ≤ now < exp` (`not_yet_valid` / `expired`).
3. `aud` is `uwmd-edit` (`wrong_audience`).
4. `deal` equals the file's `deal_id` (`wrong_deal`).
5. The target section appears in `sections` (`wrong_section`).
6. The file's declared `deal_stage` appears in `stages` (`wrong_stage`). A
   file with **no** declared stage fails a stage-constrained token — the
   token asserts a scope the file cannot demonstrate — and passes an
   unconstrained one.
7. The operation kind appears in `ops` (`wrong_op`).
8. `sub` equals the prospective block's `_meta.provenance.source` (`sub_mismatch`).
   Free-form `_meta.provenance.actor` is display metadata and takes no part in
   authorization.

A write with no token, or a token failing any rule, is refused with
**`POL-03`** (error, `POL` family §III.6a). Verification is asynchronous
(Web Crypto); a synchronous edit path with a verifier configured MUST
refuse rather than skip the check.

### XIV.4 Persistence

The token itself is NOT stored in the file — only its `jti`, appended to
the new block's `_meta.provenance.notes` as `capability:<jti>` (`; `-separated when
notes already exist). Embedding the token would disclose coordinator
infrastructure, and per §V.11.2's posture, provenance metadata is outside
any cross-producer hash-agreement guarantee — it would buy disclosure, not
verifiability. Hosts wanting full forensic recall MAY keep a sidecar audit
log (`<file>.audit.jsonl`); retention is theirs (90 days recommended,
non-normative).

### XIV.5 Conformance

Hosts that enforce tokens claim the **`capability-verify`** capability
(§II.6a); conformance cases for `POL-03` are tagged with it, so a host
that does not opt in owes nothing. Multi-issuer scenarios (sponsor's and
lender's coordinators over one file) are a key-store configuration
concern — the verifier holds several public keys — not a protocol
mechanism.
