# conformance/capability

Fixtures for capability-token write authorization (RFC 0011, Protocol §XIV):
the `POL-03` refusal, every typed rejection reason, the `jti` provenance
note, and the AND rule (a token never overrides the static §V.3 policy).
Cases are owed only by hosts claiming the **`capability-verify`** capability.

Every scenario edits the shared [`deal.uw.md`](deal.uw.md) through
`applyEditAsync` with `@uwmd/signing`'s reference verifier over
[`keys/keystore.json`](keys/keystore.json) — the same published TEST key
pair the signing suite uses; it authenticates nothing. The `token.jwt`
files are **generated** (`node scripts/gen-capability-fixtures.mjs`)
because a token's third segment is a signature over the first two; Ed25519
is deterministic, so regeneration is byte-identical (except scenario 06,
which deliberately signs with a throwaway key under the coordinator's kid).

`expected.json` fields: `op` (default: `section_supersede` on `noi_model`),
`source` (default `agent/L2.inst-A`, the tokens' `sub`), `no_token`, `ok`,
`error_code`, `message_contains`, `notes_contains`.

| Scenario | Pins |
|---|---|
| `01-valid-token-accepts` | In-scope token applies; `capability:<jti>` lands in the new head's notes. |
| `02-expired-token-rejects` | `POL-03 (expired)` — expiry is the revocation story, so it must refuse. |
| `03-wrong-section` | `POL-03 (wrong_section)` — token scopes `noi_model`, edit targets `risk_assessment`. |
| `04-wrong-deal` | `POL-03 (wrong_deal)` — a token for one deal authorizes nothing on another. |
| `05-sub-mismatch` | `POL-03 (sub_mismatch)` — `sub` binds `_meta.source`, not free-text `actor`. |
| `06-bad-signature` | `POL-03 (bad_signature)` — right kid, wrong key bytes. |
| `07-no-escalation` | `PROTO-EDIT-001` — the token verifies, the static `system_only` policy still refuses. |
| `08-missing-token` | `POL-03` — verifier configured, no token: the default is refusal. |
