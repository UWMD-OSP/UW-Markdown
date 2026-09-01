// @uwmd/signing — block and receipt signatures for UW Markdown (RFC 0010).
//
// Why this is a separate package: `@uwmd/core` is deliberately
// zero-cryptography. Signed blocks are for regulated lender data rooms and
// multi-party deal flow, not the everyday case, and the overwhelming majority
// of adopters should never take a crypto dependency to read an underwriting
// file. Core defines the wire shape and the canonical signing input (both
// normative, both crypto-free); the algorithms live here.
//
// Two seams connect them, and neither is a back door: `verifyChain(parsed,
// { signatureVerifier })` for blocks, and `verifyReceipt(..., {
// signatureVerifier })` for receipts. Without a verifier, core reports that
// signatures were *present and unchecked* rather than treating them as valid.

export { SigningError } from './errors.js';
export type { SigningErrorCode } from './errors.js';

export { toBase64Url, fromBase64Url, fromBase64Any } from './base64.js';

export { isKnownAlgorithm } from './algorithms.js';

export {
  InMemoryKeyStore,
  importPublicKey,
  importPrivateKey,
  generateSigningKeyPair,
  exportPublicKeyJwk,
} from './keys.js';
export type { KeyStore, SignerKey, SigningKey, PublicKeyMaterial } from './keys.js';

export {
  loadKeyStoreDocument,
  parseKeyStore,
  loadKeyStoreFile,
} from './keystore-file.js';
export type { KeyStoreDocument, KeyStoreEntry } from './keystore-file.js';

export { signBlock, stampBlockSignature, signReceipt, stampReceiptSignature } from './sign.js';
export type { SignBlockOptions } from './sign.js';

export {
  verifyBlockSignature,
  createBlockSignatureVerifier,
  createReceiptSignatureVerifier,
} from './verify.js';
export type { BlockVerification, SigVerifyError } from './verify.js';

export {
  createCapabilityVerifier,
  signCapabilityToken,
  CAPABILITY_AUDIENCE,
} from './capability.js';
export type { CapabilityTokenClaims, CapabilityVerifierOptions } from './capability.js';

export { signModule, stampModuleSignature, createModuleSignatureVerifier } from './modules.js';
export type { SignModuleOptions } from './modules.js';

export const SIGNING_PACKAGE_NAME = '@uwmd/signing' as const;
export const SIGNING_VERSION = '0.1.0';
