import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDocumentFactsPackage } from './document-facts-package.js';
import { parseDocumentFactsUWX, projectDocumentFacts } from './document-facts.js';
import { buildMeta } from './metadata.js';
import { encodeUWDealPackageZip, decodeUWDealPackageZip, type UWDealPackageDecoded } from './deal-package-zip.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import { sha256BytesHex } from './integrity.js';

const encoder = new TextEncoder();
const quote = JSON.parse(readFileSync(new URL('../../../conformance/document-facts/loan-quote.json', import.meta.url), 'utf8'));
const uwx = (doc: typeof quote, extra = '') => `---\nuw_version: "3.0"\ndocument_profile: loan-quote-v1\ndocument_id: ${doc.document_id}\n${extra}---\n\n\`\`\`json uw:section=document_facts\n${JSON.stringify({ _meta: buildMeta('document_facts', 1, { source: 'manual', actor: 'uwmd-fixture', timestamp: '2026-10-01T00:00:00Z' }), ...doc })}\n\`\`\`\n`;
async function packet(history = false, carrier = false): Promise<UWDealPackageDecoded> {
  const manifest: UWDealPackageDecoded['manifest'] = { package_version: '1.0', package_id: 'qa:fact-package', members: [], links: [] };
  const payloads: Record<string, Uint8Array> = {};
  const source = encoder.encode('Synthetic quote evidence: amount1000000USD; fixed0.06; maximum LTV0.65.\n');
  payloads['source.txt'] = source;
  manifest.members.push({ id: 'source:qa-quote', path: 'source.txt', role: 'source_evidence', media_type: 'text/plain', sha256: `sha256:${await sha256BytesHex(source)}` });
  for (const prior of history ? [true, false] : [false]) {
    const doc = structuredClone(quote);
    doc.document_id = prior ? 'quote:qa-prior' : quote.document_id;
    if (history && !prior) { doc.supersedes = 'quote:qa-prior'; doc.artifact_kind = 'amendment'; }
    const id = prior ? 'prior' : 'current';
    const path = `${id}.uwx.md`;
    const raw = uwx(doc, carrier ? 'deal_id: qa-fact-carrier\ndeal_name: QA fact carrier\n' : '');
    const bytes = encoder.encode(raw); payloads[path] = bytes;
    manifest.members.push({ id, path, role: 'source_note', document_profile: 'loan-quote-v1', media_type: 'text/markdown', sha256: `sha256:${await sha256BytesHex(bytes)}`,
      ...(carrier ? { semantic_digest: await computeEnvelopeDigest(toUWEnvelope(parseUWFile(raw))) } : {}) });
    manifest.links!.push({ type: 'abstracts', from: id, to: 'source:qa-quote' });
  }
  if (history) manifest.links!.push({ type: 'supersedes', from: 'current', to: 'prior' });
  return { manifest, payloads };
}

describe('document facts packages', () => {
  it('round-trips exact source/member bytes, typed links and complete source facts', async () => {
    const input = await packet();
    const before = structuredClone(input);
    const bytes = await encodeUWDealPackageZip(input);
    const decoded = decodeUWDealPackageZip(bytes);
    const result = await readDocumentFactsPackage(decoded, 'current', []);
    expect(result.verification.status).toBe('verified'); expect(result.document).toEqual(quote);
    expect(result.source_inventory.source_ids).toEqual(['source:qa-quote', 'current']);
    expect(decoded.payloads).toEqual(input.payloads); expect(input).toEqual(before);
    expect(parseDocumentFactsUWX(new TextDecoder().decode(decoded.payloads['current.uwx.md']), result.source_inventory).document).toEqual(quote);
  });
  it('keeps caller mutation after the async boundary out of the verified snapshot', async () => {
    const input = await packet(); const promise = readDocumentFactsPackage(input, 'current', []);
    input.payloads['current.uwx.md'].fill(0); input.manifest.members[1].document_profile = 'unknown-v1';
    expect((await promise).document).toEqual(quote);
  });
  it('retains predecessor documents and sources but never projects an amendment automatically', async () => {
    const input = await packet(true);
    const result = await readDocumentFactsPackage(input, 'current', []);
    expect(result.document.supersedes).toBe('quote:qa-prior'); expect(input.payloads['prior.uwx.md']).toBeDefined();
    const projected = projectDocumentFacts(result.profile, result.document, parseUWFile('---\nuw_version: "3.0"\ndeal_id: qa\n---\n'), { source_inventory: result.source_inventory, destinations: [] });
    expect(projected.edits).toEqual([]); expect(projected.report.conflicts[0].reason).toContain('Amendments');
    input.manifest.links = input.manifest.links!.filter(link => link.type !== 'supersedes');
    await expect(readDocumentFactsPackage(input, 'current', [])).rejects.toMatchObject({ code: 'DF-014' });
  });
  it('refuses missing predecessor/source bytes, source tamper and wrong logical descriptors', async () => {
    const missing = await packet(true); delete missing.payloads['prior.uwx.md'];
    await expect(readDocumentFactsPackage(missing, 'current', [])).rejects.toMatchObject({ code: 'DF-013' });
    const tamper = await packet(); tamper.payloads['source.txt'][0] = 0;
    await expect(readDocumentFactsPackage(tamper, 'current', [])).rejects.toMatchObject({ code: 'PKGVER-002' });
    const descriptor = await packet(); descriptor.manifest.members[1].document_profile = 'appraisal-abstract-v1';
    await expect(readDocumentFactsPackage(descriptor, 'current', [])).rejects.toMatchObject({ code: 'DF-011' });
    const unknown = await packet();
    await expect(readDocumentFactsPackage(unknown, 'not-a-member', [])).rejects.toMatchObject({ code: 'DF-001' });
    await expect(readDocumentFactsPackage(unknown, 'current', ['foreign'])).rejects.toMatchObject({ code: 'DF-005' });
  });
  it('verifies admitted semantic digests and refuses both tamper and unverifiable claims', async () => {
    const input = await packet(false, true);
    expect((await readDocumentFactsPackage(input, 'current', [])).verification.status).toBe('verified');
    input.manifest.members[1].semantic_digest = `sha256:${'0'.repeat(64)}`;
    await expect(readDocumentFactsPackage(input, 'current', [])).rejects.toMatchObject({ code: 'PKGVER-003' });
    const unsupported = await packet(); unsupported.payloads['current.uwx.md'] = encoder.encode('Not an admitted UWX source.');
    unsupported.manifest.members[1].sha256 = `sha256:${await sha256BytesHex(unsupported.payloads['current.uwx.md'])}`;
    unsupported.manifest.members[1].semantic_digest = `sha256:${'0'.repeat(64)}`;
    await expect(readDocumentFactsPackage(unsupported, 'current', [])).rejects.toMatchObject({ code: 'DF-013' });
  });
  it('refuses non-UTF8 fact bytes and descriptor accessors without invoking them', async () => {
    const input = await packet(); input.payloads['current.uwx.md'] = new Uint8Array([0xff]);
    input.manifest.members[1].sha256 = `sha256:${await sha256BytesHex(input.payloads['current.uwx.md'])}`;
    await expect(readDocumentFactsPackage(input, 'current', [])).rejects.toMatchObject({ code: 'DF-013' });
    const accessor = await packet(); let reads = 0;
    Object.defineProperty(accessor.payloads, 'current.uwx.md', { get() { reads++; return new Uint8Array(); } });
    await expect(readDocumentFactsPackage(accessor, 'current', [])).rejects.toMatchObject({ code: 'DF-013' }); expect(reads).toBe(0);
  });
});
