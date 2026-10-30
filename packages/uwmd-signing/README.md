# @uwmd/signing

Block, receipt, and module-manifest signatures for
[UW Markdown](https://uwmd.org) — the implementation of **protocol §V.11**
([RFC 0010](../../docs/rfcs/0010-signed-blocks.md)) and **§X.1**
([RFC 0002](../../docs/rfcs/0002-module-signing.md)).

## Why this is a separate package

`@uwmd/verify` and `@uwmd/core` are deliberately zero-cryptography. Reading, validating, editing,
and computing over a `.uw.md` file requires no crypto, and the overwhelming
majority of adopters should never take a crypto dependency to do any of it.

Signed blocks are for the deployments that genuinely need chain of custody:
regulated lender data rooms, multi-party deal flow where sponsor, lender, and
appraiser each sign their own sections, and agent-host accountability where a
signature proves *which* agent instance wrote a block rather than merely what
the `actor` field claims.

`@uwmd/verify` (re-exported by `@uwmd/core`) owns the normative, crypto-free
half: the wire shape (`_meta.integrity.signature`) and the canonical signing
input. This package owns the algorithms. Two seams
connect them:

```ts
verifyChain(parsed, { signatureVerifier })   // blocks
verifyReceipt(receipt, source, { signatureVerifier })  // receipts (RFC 0016)
```

Without a `signatureVerifier`, `verifyChain` and `verifyReceipt` report
signatures as **present and unchecked**, never as valid.

## Install

```bash
npm install @uwmd/signing
```

Needs Web Crypto with Ed25519 as `globalThis.crypto`: Node 20 or later
(`engines` from 0.6.0; Node 18 has no global Web Crypto by default and is not
supported) or a modern browser. A
browser bundler must treat `node:crypto` and `node:fs` as external; both are
reached only by guarded dynamic imports that never run in a browser. `ed25519`,
`es256`, and `es384` are the admitted algorithms. It depends on `@uwmd/verify`
for the signing payloads and verifier seams, and on `@uwmd/core` for the
capability-token types, a starter product (RFC 0083); the examples below import
from `@uwmd/core`, which re-exports everything `@uwmd/verify` exports.

## Signing a block

```ts
import { computeBlockHash, parseUWFile } from '@uwmd/core';
import { generateSigningKeyPair, signBlock, stampBlockSignature } from '@uwmd/signing';

const { signing, verifying } = await generateSigningKeyPair('ed25519', 'sponsor-2026');

const parsed = parseUWFile(source);
const block = parsed.sections.rent_roll;

// A block must already carry `content_hash`: a signature over an absent hash
// commits to nothing, and validates as INT-05.
const signature = await signBlock(block, signing);
const signed = stampBlockSignature(block, signature);
```

`signBlock` does not mutate the block, and `generateSigningKeyPair` is for
tests and local development — production keys belong in an HSM or cloud KMS
behind a custom `KeyStore`.

## Verifying

Signature bytes must use canonical unpadded base64url. Verifiers refuse
padding, non-zero unused bits, impossible encoded lengths and wrong decoded
widths as malformed (`INT-07` for blocks). Ed25519 and ES256 signatures are
64 bytes; ES384 signatures are 96 bytes. Receipt and module verification use
the same check. Key import separately accepts padded base64.

```ts
import { verifyChain } from '@uwmd/core';
import { createBlockSignatureVerifier, loadKeyStoreFile } from '@uwmd/signing';

const store = await loadKeyStoreFile('./keystore.json');
const result = await verifyChain(parsed, {
  signatureVerifier: createBlockSignatureVerifier(store),
});

result.signatures_present;   // how many blocks carry a signature
result.signatures_verified;  // how many actually verified
```

Or from the CLI:

```bash
uwmd verify deal.uwx.md --signing --keystore=./keystore.json
```

### What each code means

| Code | Severity | Trigger |
|---|---|---|
| `INT-05` | error | `signature` present with no `content_hash`. |
| `INT-06` | error | `kid` names a key the store does not hold. |
| `INT-07` | error | The signature does not verify, the algorithm is unadmitted, or the stamped `content_hash` no longer recomputes. |
| `INT-08` | warning | The algorithm is in the deployment's deprecation list. |

`INT-06` and `INT-07` are deliberately distinct. "I cannot check this" and
"this is forged" call for opposite responses — load a key versus reject the
document — and a verifier that merges them tells an operator to re-sign when
the real fix is to configure their key store.

## Key store format

### Getting trusted producer public keys

UWMD does not discover keys or decide which producer your organization trusts.
Provision the verifier's key store before relying on signature results:

1. Ask the producer's signing contact for its public key, `kid` and algorithm
   through an independently authenticated channel: for example, an established
   producer portal or a contact your organization has already verified. A key
   included beside the deal or named by its signature is a candidate, not a
   trust anchor. Confirm who controls that key and which producer it represents.
2. Confirm the full public key or its fingerprint through that trusted channel.
   For a PEM public key, agree on SHA-256 over DER SubjectPublicKeyInfo bytes;
   this command produces that fingerprint:

   ```bash
   openssl pkey -pubin -in producer-public.pem -outform DER | openssl dgst -sha256
   ```

3. Add the approved public key to a verifier-controlled `keystore.json` in the
   reference format below. Use the exact signature `kid` and algorithm; store
   either its public JWK or base64 DER SPKI. To obtain the latter from PEM:

   ```bash
   openssl pkey -pubin -in producer-public.pem -outform DER | openssl base64 -A
   ```

   Put that output in `public_key_spki`. The verifier needs no producer private
   key. Public-key import checks key material; it does not authenticate the
   producer's identity. Protect the local trust configuration from unapproved
   changes and update it through the same authenticated process for key changes.
4. Choose the signature scope to check:

   ```bash
   # Embedded block attribution only
   uwmd verify deal.uwx.md --integrity --signing --keystore=keystore.json
   # Require a detached signature over the complete document snapshot
   uwmd verify deal.uwx.md --integrity --document-signature=deal.signature.json --keystore=keystore.json
   # Check both scopes
   uwmd verify deal.uwx.md --integrity --signing --document-signature=deal.signature.json --keystore=keystore.json --json
   ```

`--signing` checks `_meta.integrity.signature` on embedded blocks. It does not
authenticate the assembled document snapshot. `--document-signature` checks the
supplied detached artifact against that snapshot; it does not request embedded
block verification. Hash-chain success alone performs neither authentication.

Text output labels both scopes. JSON `signature_checks.embedded_blocks` reports
`requested`, `state`, `present` and `verified` when integrity runs;
`signature_checks.detached_document` reports `requested`, `state` and an
available refusal `reason`. A skipped scope is `not_checked`, never verified.
Unknown trusted keys leave signatures present but `unverifiable`; a demonstrated
bad signature is `failed`. Required detached authentication accepts only
`verified`. A cryptographic success establishes control of the approved key and
the signed commitment, not the truth of financial inputs.

Key *distribution* is out of scope: a public key that travels inside the
document it authenticates proves nothing. The file format below is a
**reference**, not a normative one — back a `KeyStore` with an HSM and never
touch it.

```json
{
  "keystore_version": "1",
  "keys": [
    {
      "kid": "sponsor-2026",
      "alg": "ed25519",
      "public_key_jwk": { "kty": "OKP", "crv": "Ed25519", "x": "..." }
    },
    {
      "kid": "lender-2026",
      "alg": "es256",
      "public_key_spki": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..."
    }
  ]
}
```

Exactly one of `public_key_jwk` / `public_key_spki` per entry. Every key is
imported eagerly at load time, so a typo fails once, loudly, instead of
appearing later as a per-block `INT-07` that reads like tampering.

**Rotation** is "issue new blocks under a new `kid` and keep the old key
loaded". A `kid` names one key and MUST NOT be reused; blocks signed under a
retired `kid` stay verifiable for as long as the store retains it.

## Module manifests

Module signing (RFC 0002, protocol §X.1) uses the same keys and the same
verifier. The signed bytes are the RFC 8785 canonical manifest with `signature`
removed.

```ts
import { loadModuleManifestAsync } from '@uwmd/core';
import { createModuleSignatureVerifier, signModule, stampModuleSignature } from '@uwmd/signing';

const signed = stampModuleSignature(
  manifest,
  await signModule(manifest, signing, { identity: 'modules@example.org' }),
);

const result = await loadModuleManifestAsync(signed, {
  signaturePolicy: 'require',           // or 'verify-if-present' / 'ignore'
  signatureVerifier: createModuleSignatureVerifier(store),
});
```

The three policies are `ignore` (default), `verify-if-present` (an unsigned
module loads, a broken signature refuses), and `require`. Both checking
policies refuse when the key store lacks the `kid` — a host that cannot check a
signature has established nothing about the module.

`identity` is **advisory**. A signature proves the key holder asserted it,
never that the assertion is true; an `allowedIdentities` allow-list is worth
only as much as your decision to bind that `kid` to that identity.

## Receipts

Receipt signing (RFC 0016) uses the same keys:

```ts
import { verifyReceipt } from '@uwmd/core';
import { createReceiptSignatureVerifier, signReceipt, stampReceiptSignature } from '@uwmd/signing';

const signed = stampReceiptSignature(receipt, await signReceipt(receipt, signing));

const verdict = await verifyReceipt(signed, source, {
  signatureVerifier: createReceiptSignatureVerifier(store),
});
```

Without a verifier, a signed receipt verifies as `unverifiable` with `RCP-08`.

## Limits

- **`signed_at` is self-asserted.** Audit-grade non-repudiation needs a
  timestamping authority countersignature, which the Protocol does not define.
- **No selective disclosure.** Signing a redacted block would need Merkle
  commitments over fields; the current design has none.
- **Re-rooting a chain requires re-signing.** `content_hash` covers `_meta`,
  and `parent_hash` lives there — see the erratum in RFC 0010.
- **No Sigstore.** Keyless signing needs a Fulcio trust root and a Rekor
  inclusion proof — a vendored snapshot that fails closed when stale, or
  network access at verify time. `scheme: "sigstore"` is reserved in §X.1.2 so
  adding it later stays additive.

## Authenticating a document snapshot

Block signatures identify the authors of individual payloads. Authenticate the
assembled structured document with RFC 0084's detached document signature:

```ts
import { signDocument, createDocumentSignatureVerifier } from '@uwmd/signing';
import { verifyDocumentSignature } from '@uwmd/verify';

const signature = await signDocument(source, signingKey);
const result = await verifyDocumentSignature(source, signature, {
  signatureVerifier: createDocumentSignatureVerifier(trustedKeyStore),
});
if (result.state !== 'verified') throw new Error('Required snapshot authentication refused');
```

The verifier freshly parses source, accounts for every block (including history)
and compares the semantic envelope digest before verifying cryptography. It
refuses ambiguous active keys, repeated or historical extension blocks,
inconsistent metadata, duplicate JSON/YAML members and lossy projections.
It needs no calculation pack or financial inputs. Its four states are
`verified`, `failed`, `unverifiable` and `unsigned`; required authentication
accepts only `verified`. Block attribution counts remain separate.

```bash
uwmd sign-document deal.uwx.md --key=signer.json --out=deal.signature.json
uwmd verify deal.uwx.md --integrity --document-signature=deal.signature.json --keystore=trusted-keys.json
```

The CLI loads this package on demand, so install it beside the CLI
(`npm i @uwmd/cli @uwmd/signing`), or run
`npx -p @uwmd/cli -p @uwmd/signing uwmd …`. A verified snapshot prints
`Document snapshot authentication: verified` and exits 0. A changed document
prints `failed` with `INT-11`, and a key missing from the trust store prints
`unverifiable` with `INT-13`; both exit 1, because the flag requires
authentication.

For local testing, this script writes a throwaway Ed25519 `signer.json` and
the matching `trusted-keys.json`. `signer.json` holds a private key; keep real
keys in a KMS or HSM behind your own `SigningKey`.

```js
// make-keys.mjs: a throwaway Ed25519 signer and trust store for local testing.
import { writeFileSync } from 'node:fs';

const { privateKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const { kty, crv, x, d } = await crypto.subtle.exportKey('jwk', privateKey);
writeFileSync('signer.json', JSON.stringify({ kid: 'local-test', alg: 'ed25519', private_key_jwk: { kty, crv, x, d } }));
writeFileSync('trusted-keys.json', JSON.stringify({
  keystore_version: '1',
  keys: [{ kid: 'local-test', alg: 'ed25519', public_key_jwk: { kty, crv, x } }],
}));
```

The CLI signer file is a local reference format with `kid`, `alg` and exactly
one of `private_key_jwk` or `private_key_pkcs8`. `loadDocumentSigningKey` imports
that document; production hosts may supply their own `SigningKey` directly.
The output must be a new file, distinct from source and key. The signature
artifact contains no private key. Supply `--signed-at=<ISO instant>` to pin
signing time for reproducible vectors.

This signs semantic collections, frontmatter, inline metadata, existing block
signatures and retained section prose. Cosmetic serialization preserving that
projection may retain the signature. Trailing Markdown outside the envelope is
excluded; this is not a signature over every original byte. Editing lifecycle,
variant labels, membership or history requires a new document signature, while
prior block authorship remains independently verifiable. The CLI refuses
`--resolved` together with document authentication: it checks supplied source.

MIT. Part of the [UW Markdown](https://github.com/UWMD-OSP/UW-Markdown) monorepo.
