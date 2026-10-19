import { describe, expect, it } from 'vitest';
import { parseUWFile, getSection, getSectionVariant } from './parser.js';
import { buildMeta } from './metadata.js';
import { toUWEnvelope, fromUWEnvelope, assertUWEnvelope, computeEnvelopeDigest, UWEnvelopeError } from './envelope.js';
import { resolveReceiptSubject } from './receipts.js';
import { resolveDocumentSigningSubject, verifyDocumentSignature, DocumentSigningError, type UWDocumentSignature } from './document-signatures.js';
import { resolveSectionBlock } from './section-resolution.js';
import { validateUWFile } from './validator.js';
import { verifyChain } from './integrity.js';
import type { UWBlock } from './types.js';

const FRONT = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_name: Variant key accounting\n---\n';
function section(variant: string, value: number, history = false, sectionId = 'operating_statement', role?: string): string {
  const meta = buildMeta(sectionId, 1, { source: 'manual', actor: 'test', timestamp: '2026-10-19T00:00:00Z' });
  meta.lifecycle.superseded = history;
  return `\n\`\`\`json uw:section=${sectionId} variant=${variant}${history ? ' superseded=true' : ''}\n${JSON.stringify({ _meta: meta, ...(role ? { _role: role } : {}), value })}\n\`\`\`\n`;
}
function source(reverse = false, value = 111): string {
  const peers = [section('annotation', value), section('z', 222)];
  return FRONT + (reverse ? peers.reverse() : peers).join('');
}

describe('lawful variant labels and complete subject accounting', () => {
  it.each([false, true])('retains both source peers, exact selection and source bytes (reverse=%s)', reverse => {
    const raw = source(reverse);
    const scanned: UWBlock[] = [];
    const parsed = parseUWFile(raw, { onBlock: block => scanned.push(block) });
    expect(parsed.raw).toBe(raw);
    expect(Object.keys(parsed.sections.operating_statement).sort()).toEqual(['annotation', 'z']);
    expect(getSection(parsed, 'operating_statement')).toBeNull();
    expect(getSectionVariant(parsed, 'operating_statement', 'annotation')?.content.value).toBe(111);
    expect(resolveSectionBlock(parsed, 'operating_statement', { sectionVariants: { operating_statement: 'annotation' } })?.content.value).toBe(111);
    expect(() => resolveSectionBlock(parsed, 'operating_statement')).toThrow(/CALC-RESOLVE-002/);
    expect(scanned).toHaveLength(2);
    expect(parsed.superseded).toEqual({});
    expect(() => validateUWFile(parsed)).not.toThrow();
    expect(parsed.raw).toBe(raw);
  });
  it('preserves same-key superseded history and concurrent current peers', async () => {
    const raw = FRONT + section('annotation', 1, true) + section('annotation', 2) + section('annotation', 3) + section('z', 4);
    const parsed = parseUWFile(raw);
    expect(getSectionVariant(parsed, 'operating_statement', 'annotation')?.content.value).toBe(3);
    expect(parsed.superseded.operating_statement.map(b => b.content.value)).toEqual([1, 2]);
    const envelope = toUWEnvelope(parsed);
    expect(envelope.superseded.operating_statement).toHaveLength(2);
    expect(await computeEnvelopeDigest(envelope)).not.toBe(await computeEnvelopeDigest(toUWEnvelope(parseUWFile(raw.replace('"value":1', '"value":9')))));
    // Duplicate current source keys remain a signing refusal, even though parser history retains them.
    await expect(resolveDocumentSigningSubject(raw)).rejects.toBeInstanceOf(DocumentSigningError);
    expect(parsed.raw).toBe(raw);
  });
  it.each([false, true])('changes receipt and signature subjects when annotation peer changes (reverse=%s)', async reverse => {
    const original = source(reverse);
    const changed = source(reverse, 112);
    const before = await resolveReceiptSubject(original);
    const after = await resolveReceiptSubject(changed);
    expect(after.subject.digest).not.toBe(before.subject.digest);
    const signed = await resolveDocumentSigningSubject(original);
    expect((await resolveDocumentSigningSubject(changed)).digest).not.toBe(signed.digest);
    const signature: UWDocumentSignature = { kind: 'uwmd-document-signature', signature_version: '1', subject: signed, alg: 'ed25519', kid: 'test', signed_at: '2026-10-19T00:00:00Z', sig: 'A'.repeat(86) };
    const backend = { verify: async () => ({ ok: true }) };
    expect((await verifyDocumentSignature(original, signature, { signatureVerifier: backend })).state).toBe('verified');
    expect((await verifyDocumentSignature(changed, signature, { signatureVerifier: backend })).state).toBe('failed');
    expect(before.parsed.raw).toBe(original);
    expect(after.parsed.raw).toBe(changed);
  });
  it('round-trips annotation/content peers including lawful block extras', async () => {
    const parsed = parseUWFile(FRONT + section('annotation', 1) + section('content', 2));
    const envelope = toUWEnvelope(parsed);
    const peers = envelope.sections.operating_statement as Record<string, { [key: string]: unknown }>;
    peers.annotation!.section = 'spoof';
    peers.annotation!.meta = { lawfulExtra: true };
    expect(() => assertUWEnvelope(envelope)).not.toThrow();
    const restored = fromUWEnvelope(envelope);
    expect(getSectionVariant(restored, 'operating_statement', 'annotation')?.content.value).toBe(1);
    expect(getSectionVariant(restored, 'operating_statement', 'content')?.content.value).toBe(2);
    expect((toUWEnvelope(restored).sections.operating_statement as Record<string, { content: Record<string, unknown> }>).content!.content.value).toBe(2);
    expect(await verifyChain(parsed)).toBeDefined();
  });
  it('handles role-opted maps without reserving annotation outside built-in variant sections', () => {
    const parsed = parseUWFile(FRONT + section('annotation', 1, false, 'property', 'primary') + section('z', 2, false, 'property', 'component'));
    expect(Object.keys(parsed.sections.property).sort()).toEqual(['annotation', 'z']);
    expect(resolveSectionBlock(parsed, 'property')?.content.value).toBe(1);
    expect(() => validateUWFile(parsed)).not.toThrow();
  });
  it('continues to refuse malformed Envelope blocks through typed boundaries', () => {
    for (const annotation of [null, [], { section: 3 }, { section: 'property', malformed: {} }]) {
      const envelope = toUWEnvelope(parseUWFile(source()));
      envelope.sections.property = { annotation, content: {} } as never;
      expect(() => fromUWEnvelope(envelope)).toThrow(UWEnvelopeError);
    }
  });
});
