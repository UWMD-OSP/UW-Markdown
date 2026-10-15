// Scenario 4: document snapshot authentication fails (RFC 0084, Protocol §V.13).
//
// Signs `deal.uwx.md` with a throwaway Ed25519 key, then verifies the detached
// signature three ways:
//   a. the signed document, signer's key trusted -> verified
//   b. a changed document, same signature         -> failed (subject_mismatch, INT-11)
//   c. the signed document, signer's key unknown  -> unverifiable (unknown_kid, INT-13)
// Required authentication accepts only `verified`. The key is generated at run
// time and never written to disk. Exits 0 when all three states are as
// listed, 1 otherwise.
//
//   node 04-document-signature-failure.mjs [document.uwx.md] [changed-document.uwx.md]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyDocumentSignature } from '@uwmd/verify';
import { createDocumentSignatureVerifier, generateSigningKeyPair, InMemoryKeyStore, signDocument } from '@uwmd/signing';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const source = readFileSync(process.argv[2] ?? here('./deal.uwx.md'), 'utf8');
const changed = readFileSync(process.argv[3] ?? here('./deal.wrong-cap-rate.uwx.md'), 'utf8');

const { signing, verifying } = await generateSigningKeyPair('ed25519', 'example-signer');
const signature = await signDocument(source, signing);

const trusted = { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore([verifying])) };
const untrusted = { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore([])) };

const report = (label, result) => {
  console.log(`${label}: ${result.state}${result.reason ? ` (${result.reason})` : ''}`);
  return result;
};
const signed = report('Signed document, trusted key', await verifyDocumentSignature(source, signature, trusted));
const altered = report('Changed document, same signature', await verifyDocumentSignature(changed, signature, trusted));
const unknown = report('Signed document, key not trusted', await verifyDocumentSignature(source, signature, untrusted));

const ok = signed.state === 'verified'
  && altered.state === 'failed' && altered.reason === 'subject_mismatch'
  && unknown.state === 'unverifiable' && unknown.reason === 'unknown_kid';
console.log(ok ? 'As expected: only the unchanged document with a trusted key authenticates' : 'UNEXPECTED states');
process.exit(ok ? 0 : 1);
