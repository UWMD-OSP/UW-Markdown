import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUWFile, parsedPhysicalBlocks } from './parser.js';
import { issueReceipt, resolveReceiptSubject, verifyReceipt } from './receipts.js';

const file = new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url);
const bytes = readFileSync(file);
const original = bytes.toString('utf8');
const options = { filename: 'optional.uwx.md', issued_at: '2026-10-18T00:00:00Z' };
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');

describe('RFC0095 ordinary receipt policy boundaries', () => {
  it.each(['META-05', 'META-06'])('accounts for an authored %s without changing financial or receipt verdict semantics', async code => {
    const block = parsedPhysicalBlocks(parseUWFile(original))[0]!;
    const content = JSON.parse(block.rawJson) as { _meta: { provenance: Record<string, unknown> } };
    if (code === 'META-05') content._meta.provenance.notes = false;
    else content._meta.provenance.market_data_ref = { document_id: '', as_of: '0000-01-01', digest: `sha256:${'a'.repeat(64)}` };
    const modified = original.replace(block.rawJson, JSON.stringify(content, null, 2));
    expect(modified).not.toBe(original);
    const before = await issueReceipt(original, options);
    const after = await issueReceipt(modified, options);
    expect(after.policy.validation).toEqual({ errors: before.policy.validation.errors + 1, warnings: before.policy.validation.warnings });
    expect(after.computation).toEqual(before.computation);
    expect(after.subject).toEqual((await resolveReceiptSubject(modified, options)).subject);
    expect(after.subject.digest).not.toBe(before.subject.digest);
    expect((await verifyReceipt(after, modified, options)).verdict).toBe('verified');
    expect((await verifyReceipt(after, original, options)).verdict).toBe('failed');
    expect(hash(readFileSync(file))).toBe(hash(bytes));
  });
});
