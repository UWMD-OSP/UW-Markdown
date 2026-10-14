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

Core owns the normative, crypto-free half — the wire shape (`_meta.integrity.signature`)
and the canonical signing input. This package owns the algorithms. Two seams
connect them:

```ts
verifyChain(parsed, { signatureVerifier })   // blocks
verifyReceipt(receipt, source, { signatureVerifier })  // receipts (RFC 0016)
```

Without a verifier, core reports signatures as **present and unchecked** —
never as valid.

## Install

```bash
npm install @uwmd/signing
```

Needs Node ≥ 18.4 (Ed25519 in Web Crypto) or a modern browser. `ed25519`,
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
  timestamping authority countersignature, which protocol 1.x does not define.
- **No selective disclosure.** Signing a redacted block would need Merkle
  commitments over fields; the current design has none.
- **Re-rooting a chain requires re-signing.** `content_hash` covers `_meta`,
  and `parent_hash` lives there — see the erratum in RFC 0010.
- **No Sigstore.** Keyless signing needs a Fulcio trust root and a Rekor
  inclusion proof — a vendored snapshot that fails closed when stale, or
  network access at verify time. `scheme: "sigstore"` is reserved in §X.1.2 so
  adding it later stays additive.

MIT. Part of the [UW Markdown](https://github.com/UWMD-OSP/UW-Markdown) monorepo.

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
