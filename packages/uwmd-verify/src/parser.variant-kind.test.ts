import { describe, expect, it } from 'vitest';
import { parseUWFile, getSection, getSectionVariant } from './parser.js';
import { buildMeta } from './metadata.js';
import { toUWEnvelope, fromUWEnvelope, assertUWEnvelope, computeEnvelopeDigest, UWEnvelopeError } from './envelope.js';
import { resolveReceiptSubject } from './receipts.js';
import { resolveDocumentSigningSubject, verifyDocumentSignature, DocumentSigningError, type UWDocumentSignature } from './document-signatures.js';
import { resolveSectionBlock } from './section-resolution.js';
import { validateUWFile } from './validator.js';
import { parseUWPart } from './composition.js';
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
  it.each(['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'].flatMap(variant =>
    [false, true].map(reverse => ({ variant, reverse }))))('keeps own prototype-named variant $variant in both source orders (reverse=$reverse)', async ({ variant, reverse }) => {
    const peers = [section('annotation', 111), section(variant, 222)];
    const raw = FRONT + (reverse ? peers.reverse() : peers).join('');
    const parsed = parseUWFile(raw);
    expect(Object.keys(parsed.sections.operating_statement).sort()).toEqual(['annotation', variant].sort());
    expect(getSectionVariant(parsed, 'operating_statement', variant)?.content.value).toBe(222);
    expect(resolveSectionBlock(parsed, 'operating_statement', { sectionVariants: { operating_statement: variant } })?.content.value).toBe(222);
    expect(parsed.superseded).toEqual({});
    const changed = raw.replace('"value":222', '"value":223');
    expect((await resolveReceiptSubject(changed)).subject.digest).not.toBe((await resolveReceiptSubject(raw)).subject.digest);
    expect((await resolveDocumentSigningSubject(changed)).digest).not.toBe((await resolveDocumentSigningSubject(raw)).digest);
    // Format 2.7: a later non-superseded block with the same key is canonical;
    // the one it overwrites stays retained.
    const duplicated = parseUWFile(raw + section(variant, 333));
    expect(getSectionVariant(duplicated, 'operating_statement', variant)?.content.value).toBe(333);
    expect(duplicated.superseded.operating_statement.map(block => block.content.value)).toEqual([222]);
    await expect(resolveDocumentSigningSubject(raw + section(variant, 333))).rejects.toThrow(/Duplicate active/);
    expect(parsed.raw).toBe(raw);
  });
  it.each(['__proto__', 'constructor', 'prototype'].flatMap(variant =>
    [false, true].map(reverse => ({ variant, reverse }))))('keeps blocked-segment variant $variant as an own peer in both source orders (reverse=$reverse)', async ({ variant, reverse }) => {
    const peers = [section('z', 111), section(variant, 222)];
    const raw = FRONT + (reverse ? peers.reverse() : peers).join('');
    const parsed = parseUWFile(raw);
    const map = parsed.sections.operating_statement as Record<string, UWBlock>;
    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
    expect(Object.keys(map).sort()).toEqual([variant, 'z'].sort());
    expect(getSectionVariant(parsed, 'operating_statement', variant)?.content.value).toBe(222);
    expect(parsed.superseded).toEqual({});
    const changed = raw.replace('"value":222', '"value":223');
    expect((await resolveReceiptSubject(changed)).subject.digest).not.toBe((await resolveReceiptSubject(raw)).subject.digest);
    // Signing keeps refusing these selection keys outright.
    await expect(resolveDocumentSigningSubject(raw)).rejects.toThrow(/Unsafe section or variant selection key/);
  });
  it('selects only own variant peers', () => {
    const parsed = parseUWFile(source());
    for (const absent of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(getSectionVariant(parsed, 'operating_statement', absent)).toBeNull();
    }
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
    const backend = { verify: async () => ({ ok: true as const }) };
    expect((await verifyDocumentSignature(original, signature, { signatureVerifier: backend })).state).toBe('verified');
    expect((await verifyDocumentSignature(changed, signature, { signatureVerifier: backend })).state).toBe('failed');
    expect(before.parsed.raw).toBe(original);
    expect(after.parsed.raw).toBe(changed);
  });
  it('classifies annotation/content peers with lawful block extras', async () => {
    const parsed = parseUWFile(FRONT.replace('asset_class: multifamily', 'asset_class: multifamily\ndeal_id: synthetic-variant-key') + section('annotation', 1) + section('content', 2));
    const envelope = toUWEnvelope(parsed);
    const peers = envelope.sections.operating_statement as unknown as Record<string, { [key: string]: unknown }>;
    peers.annotation!.section = 'spoof';
    peers.annotation!.meta = { lawfulExtra: true };
    expect(() => assertUWEnvelope(envelope)).not.toThrow();
    const digest = await computeEnvelopeDigest(envelope);
    peers.annotation!.meta = { lawfulExtra: false };
    expect(await computeEnvelopeDigest(envelope)).not.toBe(digest);
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
  it('accounts for current peers when reading a part rather than interpreting annotation as wrapper', () => {
    const raw = source().replace('asset_class: multifamily', 'uwpart_version: "1.0"\npart_id: statement-peers\nsection: operating_statement');
    const parsed = parseUWFile(raw);
    const part = parseUWPart(parsed);
    expect(part.blocks.map(block => block.annotation.variant).sort()).toEqual(['annotation', 'z']);
    expect(part.blocks.map(block => block.content.value)).toEqual([111, 222]);
    expect(parsed.raw).toBe(raw);
  });
  it('continues to refuse malformed Envelope blocks through typed boundaries', () => {
    for (const annotation of [null, [], { section: 3 }, { section: 'property', malformed: {} }]) {
      const envelope = toUWEnvelope(parseUWFile(source()));
      envelope.sections.property = { annotation, content: {} } as never;
      expect(() => fromUWEnvelope(envelope)).toThrow(UWEnvelopeError);
    }
  });
});
