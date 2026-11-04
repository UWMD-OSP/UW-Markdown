// Test-only bug reproductions. These assertions deliberately fail on the base
// revision; no production behavior or receipt convention is changed here.
import { createPrivateKey, createPublicKey, sign, verify as verifySignature } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  computeResultsDigest, issueReceipt, receiptSigningPayload, verifyReceipt,
  type ReceiptSignatureVerifier, type UWReceipt,
} from './receipts.js';

const source = readFileSync(new URL('../../../examples/verification/deal.uwx.md', import.meta.url), 'utf8');
const digest = `sha256:${'a'.repeat(64)}`;
const options = { filename: 'deal.uwx.md', issued_at: '2026-11-04T00:00:00Z' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('receipt input ownership regressions', () => {
  it.each(['ordinary-missing', 'constructor', 'toString', '__proto__'])
  ('keeps an unavailable %s reference indeterminate with no resolver', async document_id => {
    const receipt = await issueReceipt(source, { ...options,
      inputs_provenance: [{ source: 'child_record', document_id, digest }] });
    const result = await verifyReceipt(receipt, source);
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map(issue => issue.code)).toEqual(['RCP-11']);
    expect(result.issues[0]).not.toHaveProperty('actual');
  });

  it('does not treat a prototype-inherited matching hash as a held input', async () => {
    const receipt = await issueReceipt(source, { ...options,
      inputs_provenance: [{ source: 'child_record', document_id: 'external-child', digest }] });
    const inputs = Object.create({ 'external-child': digest }) as Record<string, string>;
    expect(Object.hasOwn(inputs, 'external-child')).toBe(false);
    const result = await verifyReceipt(receipt, source, { inputs });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map(issue => issue.code)).toEqual(['RCP-11']);
  });

  it.each(['constructor', '__proto__'])('accepts an own matching %s reference in a null-prototype map', async document_id => {
    const receipt = await issueReceipt(source, { ...options,
      inputs_provenance: [{ source: 'child_record', document_id, digest }] });
    const inputs = Object.create(null) as Record<string, string>;
    inputs[document_id] = digest;
    expect((await verifyReceipt(receipt, source, { inputs })).verdict).toBe('verified');
    inputs[document_id] = `sha256:${'b'.repeat(64)}`;
    const mismatch = await verifyReceipt(receipt, source, { inputs });
    expect(mismatch.verdict).toBe('failed');
    expect(mismatch.issues.map(issue => issue.code)).toEqual(['RCP-12']);
  });
});

describe('receipt snapshot regression across signature await', () => {
  it('cannot combine a signature on wrong results with repaired results from a later caller mutation', async () => {
    const issued = await issueReceipt(source, options);
    expect((await verifyReceipt(issued, source)).verdict).toBe('verified');
    // Public deterministic test key, also used by the existing receipt controls.
    const key = createPrivateKey({ key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex'),
    ]), format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(key);
    const receipt: UWReceipt = structuredClone(issued);
    const result = receipt.computation.results.find(row => row.computed && typeof row.value === 'number')!;
    result.value = (result.value as number) + 1;
    receipt.computation.results_digest = await computeResultsDigest(receipt.computation.results);
    receipt.signature = { algorithm: 'ed25519', key_id: 'public-test-key',
      value: sign(null, Buffer.from(receiptSigningPayload(receipt)), key).toString('base64') };
    const backend: ReceiptSignatureVerifier = { verify: async (actual, payload) =>
      verifySignature(null, Buffer.from(payload), publicKey, Buffer.from(actual.signature!.value, 'base64')) };
    const before = await verifyReceipt(structuredClone(receipt), source, { signatureVerifier: backend });
    expect(before.verdict).toBe('failed');
    expect(before.issues.map(issue => issue.code)).toEqual(['RCP-03']);

    const entered = deferred<boolean>();
    const resume = deferred<void>();
    const pending = verifyReceipt(receipt, source, { signatureVerifier: {
      verify: async (actual, payload) => {
        const valid = await backend.verify(actual, payload);
        entered.resolve(valid);
        await resume.promise;
        return valid;
      },
    } });
    const authenticatedOriginal = await entered.promise;
    // The caller mutates its own object while a genuine signature check waits.
    // The backend never repairs or changes the receipt.
    receipt.computation.results = structuredClone(issued.computation.results);
    receipt.computation.results_digest = issued.computation.results_digest;
    resume.resolve();
    const raced = await pending;
    const after = await verifyReceipt(receipt, source, { signatureVerifier: backend });
    expect(authenticatedOriginal).toBe(true);
    expect(after.verdict).toBe('failed');
    expect(after.issues.map(issue => issue.code)).toEqual(['RCP-01']);
    // Either a coherent original snapshot or rejection of mutation must fail.
    expect(raced.verdict).toBe('failed');
  });
});
