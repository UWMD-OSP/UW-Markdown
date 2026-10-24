// Retained independent probes; production import/parsed-entry/output paths and async API adaptation only.
// Synchronous model hash facade is documented in ../model.mjs; actual async stamps are separately tested.
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/', import.meta.url), { recursive: true });
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import * as m from '../model.mjs';
import * as x from '../xml.mjs';
import * as c from '../csv.mjs';
import { candidate } from '../build-runtime.mjs';
const p = JSON.parse(fs.readFileSync(new URL('../../cases.json', import.meta.url), 'utf8'));
const source = p.source_cases.find(i => i.name === 'named-default-single').source;
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const artifact = { kind: 'uwmd-document-signature', signature_version: '1', subject: await candidate.signing.resolveDocumentSigningSubject(source), alg: 'ed25519', kid: 'synthetic-key', signed_at: '2026-10-23T00:00:00Z', sig: '' };
artifact.sig = sign(null, Buffer.from(candidate.signing.documentSigningPayload(artifact)), privateKey).toString('base64url');
let calls = 0;
const backend = { verify: async (payload, a) => { calls++; return verify(null, Buffer.from(payload), publicKey, Buffer.from(a.sig, 'base64url')) ? { ok: true } : { ok: false, reason: 'bad_signature' }; } };
const results = [];
const base = m.projectSource(source).model;
for (const [name, mutate] of [
    ['notes', v => { v.extensions.x_probe.block.content._notes = 'synthetic notes'; }],
    ['prose', v => { v.extensions.x_probe.block.prose = 'synthetic prose'; }],
    ['empty-prose', v => { v.extensions.x_probe.block.prose = ''; }],
    ['annotation', v => { v.extensions.x_probe.block.annotation.source = 'manual'; }],
    ['block-extra', v => { v.extensions.x_probe.block.extra = null; }],
    ['outer-null', v => { v.extra = null; }], ['outer-empty-object', v => { v.extra = {}; }], ['outer-empty-array', v => { v.extra = []; }], ['outer-empty-string', v => { v.extra = ''; }],
]) {
    const changed = structuredClone(base);
    mutate(changed);
    assert.notEqual(m.digest(changed), m.digest(base));
    assert.equal(m.jcs(m.portable(base)), m.jcs(m.portable(changed)));
    for (const carrier of [await x.decodeXML(await x.encodeXML(changed)), await c.decodeCSV(await c.encodeCSV(changed))])
        assert.equal(m.preimage(carrier), m.preimage(changed));
    results.push({ name, digest_changes: true, portable_unchanged: true, carriers: 'preserved' });
}
for (const [name, modified] of [['notes', source.replace('"marker":1', '"marker":1,"_notes":"synthetic"')], ['prose', source.replace('```json', 'Synthetic preceding prose\n```json')], ['annotation', source.replace('variant=default', 'variant=default source=manual')]]) {
    calls = 0;
    const r = await candidate.signing.verifyDocumentSignature(modified, artifact, { signatureVerifier: backend });
    assert.deepEqual(r.issues.map(x => x.code), ['INT-11']);
    assert.equal(calls, 0);
    results.push({ name: `source-${name}`, codes: ['INT-11'], backend_calls: calls });
}
for (const [name, mutate] of [['parsed-notes', p => { p.extensions.x_probe.block.content._notes = 'synthetic'; }], ['parsed-prose', p => { p.extensions.x_probe.block.prose = 'synthetic'; }], ['parsed-annotation', p => { p.extensions.x_probe.block.annotation.source = 'manual'; }], ['parsed-extra', p => { candidate.parser.parsedPhysicalBlocks(p)[0].extra = null; }], ['parsed-outer', p => { p.extra = null; }]]) {
    const parsed = candidate.parser.parseUWFile(source);
    mutate(parsed);
    const r = await candidate.integrity.verifyChain(parsed, { documentSignature: artifact, documentSignatureVerifier: backend });
    assert.deepEqual(r.document_signature.issues.map(x => x.code), ['INT-15']);
    results.push({ name, codes: ['INT-15'] });
}
const direct = structuredClone(base);
direct.extensions.x_probe = { mode: 'variants', blocks: [{ variant: 'default', block: base.extensions.x_probe.block }] };
for (const roundtrip of [await x.decodeXML(await x.encodeXML(direct)), await c.decodeCSV(await c.encodeCSV(direct))])
    assert.equal(roundtrip.extensions.x_probe.mode, 'variants');
await assert.rejects(async () => m.toMarkdown(direct));
results.push({ name: 'no-role-one-peer', model_carriers: 'preserved', Markdown: 'refused' });
for (const val of [null, undefined]) {
    const v = structuredClone(base);
    if (val === undefined)
        delete v.extensions.x_probe.block.content._meta;
    else
        v.extensions.x_probe.block.content._meta = null;
    const port = m.portable(v);
    assert.equal(Object.hasOwn(port.x_probe.block, 'meta'), val !== undefined);
    await assert.rejects(async () => m.validateModel(v));
    results.push({ name: val === null ? 'null-meta' : 'absent-meta', portable: 'preserved', full: 'refused' });
}
for (const n of [126, 127]) {
    const v = structuredClone(base);
    let z = null;
    for (let k = 0; k < n; k++)
        z = { child: z };
    v.extra = z;
    let actual;
    try {
        m.validateModel(v);
        actual = 'accepted';
    }
    catch {
        actual = 'refused';
    }
    assert.equal(actual, n === 126 ? 'accepted' : 'refused');
    results.push({ name: `nesting-${n}`, actual });
}
const names = [null, '', '/', 'annotation', 'content', 'default', '~', '\u{10000}', '\ue000'];
const tagged = structuredClone(base);
tagged.extensions.x_probe = { mode: 'variants', blocks: names.map(variant => {
        const b = structuredClone(base.extensions.x_probe.block);
        delete b.annotation.variant;
        if (variant !== null)
            b.annotation.variant = variant;
        return { variant, block: b };
    }) };
for (const carrier of [await x.decodeXML(await x.encodeXML(tagged)), await c.decodeCSV(await c.encodeCSV(tagged))])
    assert.deepEqual(carrier.extensions.x_probe.blocks.map(r => r.variant), names);
results.push({ name: 'exact-special-identities-UTF16-order', identities: names, carriers: 'preserved' });
const swapped = structuredClone(tagged);
swapped.extensions.x_probe.blocks.reverse();
await assert.rejects(async () => m.validateModel(swapped));
results.push({ name: 'received-noncanonical-identity-order', actual: 'refused' });
const duplicate = structuredClone(tagged);
duplicate.extensions.x_probe.blocks.push(structuredClone(duplicate.extensions.x_probe.blocks.at(-1)));
await assert.rejects(async () => m.validateModel(duplicate));
results.push({ name: 'received-duplicate-identity', actual: 'refused' });
fs.writeFileSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/independent-subject-results.json', import.meta.url), JSON.stringify({ platform: process.platform, results }, null, 2));
console.log(JSON.stringify({ asserted_cases: results.length, passed: results.length }, null, 2));
