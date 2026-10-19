import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUWFile, parsedPhysicalBlocks } from './parser.js';
import { issueReceipt, resolveReceiptSubject, verifyReceipt } from './receipts.js';

const file = new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url);
const original = readFileSync(file, 'utf8');
const options = { filename: 'exact-source.uwx.md', issued_at: '2026-10-18T00:00:00Z' };

describe('RFC0031 whole source grammar ordinary receipt policy', () => {
  it('counts the canonical SRC-01 error without changing computation or subject construction', async () => {
    const physical = parsedPhysicalBlocks(parseUWFile(original))[0]!;
    const body = JSON.parse(physical.rawJson) as { _meta: { provenance: Record<string, unknown> } };
    body._meta.provenance.source = 'agent/x';
    body._meta.provenance.agent_id = 'synthetic';
    const valid = original.replace(physical.rawJson, JSON.stringify(body, null, 2));
    body._meta.provenance.source = 'agent/x\n';
    const invalid = original.replace(physical.rawJson, JSON.stringify(body, null, 2));
    const before = await issueReceipt(valid, options);
    const after = await issueReceipt(invalid, options);
    expect(after.policy.validation).toEqual({ errors: before.policy.validation.errors + 1, warnings: before.policy.validation.warnings });
    expect(after.computation).toEqual(before.computation);
    expect(after.subject).toEqual((await resolveReceiptSubject(invalid, options)).subject);
    expect(after.subject.digest).not.toBe(before.subject.digest);
    expect((await verifyReceipt(after, invalid, options)).verdict).toBe('verified');
    expect((await verifyReceipt(after, valid, options)).verdict).toBe('failed');
    expect(readFileSync(file, 'utf8')).toBe(original);
  });
});
