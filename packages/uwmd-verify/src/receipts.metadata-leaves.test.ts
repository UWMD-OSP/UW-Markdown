import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { issueReceipt, resolveReceiptSubject, verifyReceipt } from './receipts.js';

const original = readFileSync(new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url), 'utf8');
const options = { filename: 'leaf.uwx.md', issued_at: '2026-10-18T00:00:00Z' };

describe('RFC0094 receipt policy controls', () => {
  it('counts the actual new finding while preserving subject construction, financial results and verification precedence', async () => {
    const modified = original.replace(/("confidence"\s*:\s*)"[^"]*"/, '$1"verified"');
    expect(modified).not.toBe(original);
    const before = await issueReceipt(original, options);
    const after = await issueReceipt(modified, options);
    expect(after.policy.validation).toEqual({ errors: before.policy.validation.errors + 1, warnings: before.policy.validation.warnings });
    expect(after.computation).toEqual(before.computation);
    expect(after.subject).toEqual((await resolveReceiptSubject(modified, options)).subject);
    expect(after.subject.digest).not.toBe(before.subject.digest); // authored metadata differs
    expect((await verifyReceipt(after, modified, options)).verdict).toBe('verified');
    expect((await verifyReceipt(after, original, options)).verdict).toBe('failed');
    expect(readFileSync(new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url), 'utf8')).toBe(original);
  });

  it('keeps Lite on its accepted compiled-model receipt path', async () => {
    const lite = readFileSync(new URL('../../../conformance/lite/fixtures/02-full-deal-summary.uw.md', import.meta.url), 'utf8');
    const receipt = await issueReceipt(lite, { ...options, filename: 'lite.uw.md' });
    expect(receipt.subject.representation).toBe('uw-lite-markdown');
    expect((await verifyReceipt(receipt, lite, { filename: 'lite.uw.md' })).verdict).toBe('verified');
  });
});
