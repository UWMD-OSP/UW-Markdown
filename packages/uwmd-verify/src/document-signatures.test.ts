import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseUWFile } from './parser.js';
import { verifyChain } from './integrity.js';
import {
  DocumentSigningError, documentSigningPayload, resolveDocumentSigningSubject, verifyDocumentSignature,
  type UWDocumentSignature, type DocumentSignatureVerifier,
} from './document-signatures.js';

const FRONT = '---\nuw_version: "3.0"\ndeal_name: Synthetic authentication fixture\n---\n';
function section(id = 'property', annotation = '', superseded = false, value = 100): string {
  return `\nNarrative for ${id}.\n\`\`\`json uw:section=${id}${annotation}\n${JSON.stringify({
    _meta: { section: id, lifecycle: { revision: 1, superseded } }, value,
  })}\n\`\`\`\n`;
}
const SOURCE = FRONT + section();
const backend: DocumentSignatureVerifier = { verify: async () => ({ ok: true }) };
async function artifact(source = SOURCE): Promise<UWDocumentSignature> {
  return { kind: 'uwmd-document-signature', signature_version: '1', subject: await resolveDocumentSigningSubject(source),
    alg: 'ed25519', kid: 'test-key', signed_at: '2026-10-14T00:00:00Z', sig: 'A'.repeat(86) };
}

describe('document source accounting', () => {
  it('accepts incomplete standalone records without financial validation or a pack', async () => {
    expect((await resolveDocumentSigningSubject(SOURCE)).digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await resolveDocumentSigningSubject(SOURCE.replaceAll('\n', '\r\n'))).toEqual(await resolveDocumentSigningSubject(SOURCE));
  });
  it('accounts for every collection and superseded block; retained prose is signed', async () => {
    const all = FRONT + section() + section('property', ' superseded=true', true)
      + section('pipeline_log') + section('pipeline_log') + section('custom_calculations')
      + section('custom_scenarios') + section('x_synthetic') + section('unknown_future_section');
    const digest = (await resolveDocumentSigningSubject(all)).digest;
    for (const id of ['pipeline_log', 'custom_calculations', 'custom_scenarios', 'x_synthetic', 'unknown_future_section']) {
      expect((await resolveDocumentSigningSubject(all.replace(`Narrative for ${id}.`, 'Edited narrative.'))).digest).not.toBe(digest);
    }
    expect((await resolveDocumentSigningSubject(`${all}Outside trailing prose.`)).digest).toBe(digest);
    expect((await resolveDocumentSigningSubject(all.replace(section('property', ' superseded=true', true), ''))).digest).not.toBe(digest);
  });
  it('allows explicit statement variants while refusing duplicate active keys', async () => {
    await expect(resolveDocumentSigningSubject(FRONT + section('operating_statement', ' variant=t12') + section('operating_statement', ' variant=budget'))).resolves.toBeDefined();
    await expect(resolveDocumentSigningSubject(FRONT + section('operating_statement', ' variant=t12') + section('operating_statement', ' variant=t12 v=9'))).rejects.toThrow(/Duplicate active/);
    await expect(resolveDocumentSigningSubject(SOURCE + section('property', ' variant=other'))).rejects.toThrow(/Duplicate active/);
  });
  it.each([
    SOURCE + section('x_synthetic') + section('x_synthetic'),
    SOURCE.replace('"section":"property"', '"section":"rent_roll"'),
    SOURCE.replace('"superseded":false', '"superseded":"false"'),
    SOURCE.replace('section=property', 'section=property superseded=true'),
    SOURCE.replace('section=property', 'section=property variant=a variant=b'),
    SOURCE.replace('section=property', 'section=property section=rent_roll'),
    SOURCE.replace('section=property', 'section=property superseded=maybe'),
    SOURCE.replace('section=property', 'section=property v=1junk'),
    SOURCE.replace('section=property', 'section=property ignored-token'),
    SOURCE.replace('section=property', 'section=property constructor=x'),
    SOURCE.replace('section=property', 'section=__proto__').replace('"section":"property"', '"section":"__proto__"'),
    FRONT + section('operating_statement', ' variant=constructor'),
    FRONT + section('operating_statement', ' variant=annotation') + section('operating_statement', ' variant=t12'),
    SOURCE.replace('"value":100', '"value":100,"value":200'),
    SOURCE.replace('"value":100', '"nested":{"a":1,"\\u0061":2}'),
    SOURCE.replace('"value":100', '"nested":[{"a":1,"a":2}]'),
    SOURCE.replace('"value":100', '"value":1e999'),
    SOURCE.replace('"value":100', '"value":'),
    SOURCE.replace('uw_version: "3.0"', 'uw_version: "3.0"\ndeal_name: duplicate'),
    SOURCE.replace('deal_name:', 'details:\n  name: a\n  name: b\ndeal_name:'),
    SOURCE.replace('deal_name:', '__proto__: hidden\ndeal_name:'),
    SOURCE.replace('deal_name:', 'a.b: first\na.b: second\ndeal_name:'),
    SOURCE.replace('deal_name:', 'two words: first\ntwo words: second\ndeal_name:'),
    SOURCE.replace('deal_name:', 'details:\n  name: a\n    name: b\ndeal_name:'),
    SOURCE.replace('deal_name:', 'details:\n  a.__proto__: hidden\ndeal_name:'),
    SOURCE.replace('"lifecycle":{"revision":1,"superseded":false}', '"lifecycle":null'),
    SOURCE.replace('"3.0"', '"2.1"'),
    SOURCE.slice(0, SOURCE.lastIndexOf('```')),
    FRONT + section('x_synthetic', ' superseded=true', true),
    SOURCE.replace('"value":100', '"_raw":"hidden"'),
  ])('refuses malformed or ambiguous source (%#)', async source => {
    await expect(resolveDocumentSigningSubject(source)).rejects.toBeInstanceOf(DocumentSigningError);
  });
  it('binds equivalent quoted and unquoted string keys to the same semantic subject', async () => {
    const plain = SOURCE.replace('deal_name:', 'custom_label: kept\npipeline_state:\n  L0: complete\ndeal_name:');
    expect(await resolveDocumentSigningSubject(SOURCE.replace('deal_name:', 'a:b: kept\ndeal_name:')))
      .toEqual(await resolveDocumentSigningSubject(SOURCE.replace('deal_name:', '"a:b": kept\ndeal_name:')));
    const quoted = plain.replace('custom_label:', '"custom_label":').replace('pipeline_state:', "'pipeline_state':").replace('  L0:', '  "L0":');
    expect(await resolveDocumentSigningSubject(quoted)).toEqual(await resolveDocumentSigningSubject(plain));
  });
  it.each([
    'custom_label: first\n"custom_label": second',
    '"custom_label": first\n"\\u0063ustom_label": second',
    'details:\n  name: first\n  "name": second',
    '"__proto__": hidden',
    'details:\n  "constructor": hidden',
  ])('refuses decoded duplicate or unsafe quoted source keys (%#)', async rows => {
    await expect(resolveDocumentSigningSubject(SOURCE.replace('deal_name:', `${rows}\ndeal_name:`)))
      .rejects.toBeInstanceOf(DocumentSigningError);
  });
  it('does not confuse braces/quotes in strings or arrays with object keys', async () => {
    const source = SOURCE.replace('"value":100', '"text":"\\\"a\\\":{[}","array":[{"a":1},{"a":2}]');
    await expect(resolveDocumentSigningSubject(source)).resolves.toBeDefined();
  });
  it('resets nested frontmatter member scopes under a new parent', async () => {
    await expect(resolveDocumentSigningSubject(SOURCE.replace('deal_name:', 'one:\n  name: a\ntwo:\n  name: b\ndeal_name:'))).resolves.toBeDefined();
  });
});

describe('document authentication states', () => {
  it('distinguishes unsigned, unchecked and verified; payload binds every metadata field', async () => {
    const signed = await artifact();
    expect(documentSigningPayload(signed)).not.toContain('"sig":');
    expect(documentSigningPayload(signed)).toContain('"kid":"test-key"');
    expect((await verifyDocumentSignature(SOURCE, null)).state).toBe('unsigned');
    expect((await verifyDocumentSignature(SOURCE, undefined)).state).toBe('unsigned');
    expect(await verifyDocumentSignature(SOURCE, signed)).toMatchObject({ state: 'unverifiable', reason: 'no_backend' });
    expect(await verifyDocumentSignature(SOURCE, signed, { signatureVerifier: backend })).toMatchObject({ state: 'verified', kid: signed.kid });
  });
  it('refuses a changed subject even with a backend that would accept the artifact', async () => {
    expect(await verifyDocumentSignature(SOURCE.replace('100', '200'), await artifact(), { signatureVerifier: backend }))
      .toMatchObject({ state: 'failed', reason: 'subject_mismatch' });
    expect(await verifyDocumentSignature('malformed source', await artifact(), { signatureVerifier: backend }))
      .toMatchObject({ state: 'failed', reason: 'malformed_source' });
  });
  it.each(['unknown_kid', 'bad_signature', 'algorithm_mismatch', 'malformed'] as const)('retains backend refusal %s', async reason => {
    expect(await verifyDocumentSignature(SOURCE, await artifact(), { signatureVerifier: { verify: async () => ({ ok: false, reason }) } }))
      .toMatchObject({ state: reason === 'unknown_kid' ? 'unverifiable' : 'failed', reason });
  });
  it('treats backend errors as unchecked rather than successful authentication', async () => {
    expect(await verifyDocumentSignature(SOURCE, await artifact(), { signatureVerifier: { verify: async () => { throw new Error('offline'); } } }))
      .toMatchObject({ state: 'unverifiable', reason: 'backend_error' });
  });
  it.each([
    { signature_version: '2' }, { subject: { representation: 'uw-lite-markdown' } },
    { subject: { representation_version: '2' } }, { subject: { canonicalization: 'other' } },
    { subject: { canonicalization_version: '2' } },
  ])('does not authenticate unsupported versions (%#)', async change => {
    const base = await artifact();
    const changed = { ...base, ...change, subject: { ...base.subject, ...change.subject } };
    expect(await verifyDocumentSignature(SOURCE, changed, { signatureVerifier: backend })).toMatchObject({ state: 'unverifiable', reason: 'unsupported_version' });
  });
  it.each([
    [], 'signature', {}, { extra: true }, { kind: 'other' }, { signature_version: 1 },
    { subject: null }, { subject: { extra: true } }, { subject: { digest: 'invalid' } },
    { subject: { digest: 123 } }, { kid: '' }, { alg: 'unknown' }, { signed_at: 'yesterday' },
    { signed_at: '2026-99-99T00:00:00Z' }, { signed_at: '2026-02-30T00:00:00Z' }, { sig: 'A'.repeat(85) }, { sig: `${'A'.repeat(86)}=` },
    { sig: `${'A'.repeat(85)}B` }, { sig: '!'.repeat(86) }, { alg: 'es384', sig: 'A'.repeat(86) },
  ])('fails malformed artifacts (%#)', async change => {
    const base = await artifact();
    const changed = typeof change !== 'object' || Array.isArray(change) || Object.keys(change).length === 0 ? change
      : { ...base, ...change, subject: 'subject' in change && change.subject === null ? null : { ...base.subject, ...('subject' in change ? change.subject : {}) } };
    expect(await verifyDocumentSignature(SOURCE, changed, { signatureVerifier: backend })).toMatchObject({ state: 'failed', reason: 'malformed' });
  });
  it('requires verified authentication without changing default block counts', async () => {
    const parsed = parseUWFile(SOURCE);
    expect(await verifyChain(parsed)).not.toHaveProperty('document_signature');
    expect(await verifyChain(parsed, { requireDocumentSignature: true })).toMatchObject({ ok: false, document_signature: { state: 'unsigned' } });
    expect(await verifyChain(parsed, { documentSignature: await artifact() })).toMatchObject({ ok: true, document_signature: { state: 'unverifiable' } });
    expect(await verifyChain(parsed, { documentSignature: { ...await artifact(), sig: 'bad' } }))
      .toMatchObject({ ok: false, document_signature: { state: 'failed' } });
    expect(await verifyChain(parsed, { documentSignature: await artifact(), documentSignatureVerifier: backend, requireDocumentSignature: true }))
      .toMatchObject({ ok: true, signatures_present: 0, signatures_verified: 0, document_signature: { state: 'verified' } });
    parsed.frontmatter.deal_name = 'Filtered object mutation is not supplied source';
    expect(await verifyChain(parsed, { documentSignature: await artifact(), documentSignatureVerifier: backend, requireDocumentSignature: true }))
      .toMatchObject({ ok: false, document_signature: { state: 'failed', reason: 'malformed_source' } });
    parsed.frontmatter.deal_name = 'Synthetic authentication fixture';
    parsed.frontmatter.extra = 1n as unknown as string;
    expect(await verifyChain(parsed, { documentSignature: await artifact(), documentSignatureVerifier: backend }))
      .toMatchObject({ ok: false, document_signature: { state: 'failed', reason: 'malformed_source' } });
  });
});


describe('JCS Unicode admission at document authentication boundaries', () => {
  it.each([
    { text: '\ud800', key: false }, { text: '\ud801', key: false }, { text: '\udc00', key: false },
    { text: '\ud800', key: true }, { text: '\ud801', key: true }, { text: '\udc00', key: true },
  ])('refuses invalid Unicode before signature backend execution (%#)', async ({ text, key }) => {
    const field = (value: string): string => JSON.stringify(key ? { [value]: 'kept' } : { value }).slice(1, -1);
    const invalid = SOURCE.replace('"value":100', field(text));
    const signed = await artifact(SOURCE.replace('"value":100', field('\ufffd')));
    const before = JSON.stringify(signed);
    let calls = 0;
    const recording: DocumentSignatureVerifier = { verify: async () => { calls++; return { ok: true }; } };
    await expect(resolveDocumentSigningSubject(invalid)).rejects.toBeInstanceOf(DocumentSigningError);
    const result = await verifyDocumentSignature(invalid, signed, { signatureVerifier: recording });
    expect(result).toMatchObject({ state: 'failed', reason: 'malformed_source' });
    expect(result.issues.map(issue => issue.code)).toEqual(['INT-15']);
    expect(calls).toBe(0);
    // Existing unsupported-version precedence stays ahead of source admission.
    const unsupported = { ...signed, subject: { ...signed.subject, canonicalization_version: 'unsupported' } };
    expect((await verifyDocumentSignature(invalid, unsupported, { signatureVerifier: recording })).issues.map(issue => issue.code)).toEqual(['INT-14']);
    expect(calls).toBe(0);
    expect(JSON.stringify(signed)).toBe(before);
  });

  it('preserves the frozen valid document-signature subject', async () => {
    const fixture = resolve(__dirname, '../../../conformance/document-signatures/01-valid');
    const raw = await readFile(resolve(fixture, 'deal.uwx.md'), 'utf8');
    const expected = JSON.parse(await readFile(resolve(fixture, 'signature.json'), 'utf8')) as UWDocumentSignature;
    expect(await resolveDocumentSigningSubject(raw)).toEqual(expected.subject);
  });
});
