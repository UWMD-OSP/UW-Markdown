// Retained independent probes; production import/parsed-entry/output paths and async API adaptation only.
// Synchronous model hash facade is documented in ../model.mjs; actual async stamps are separately tested.
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/', import.meta.url), { recursive: true });
import fs from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { encodeCSV, decodeZIP } from '../csv.mjs';
import { extractZipSafely } from '../../../../packages/uwmd-verify/dist/zip-safety.js';
const model = { envelope_version: '2.0', format_version: '3.0', frontmatter: { uw_version: '3.0', deal_id: 'synthetic-zip-review', deal_name: 'Synthetic ZIP review' }, sections: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {} };
const crc = b => {
    let a = 0xffffffff;
    for (const v of b) {
        a ^= v;
        for (let j = 0; j < 8; j++)
            a = (a >>> 1) ^ ((a & 1) ? 0xedb88320 : 0);
    }
    return (a ^ 0xffffffff) >>> 0;
};
// Reviewer ZIP writer; no fflate encoder, candidate expectation or freezer.
function zip(files, method = 0, descriptor = 'none') {
    const locals = [];
    const centrals = [];
    let at = 0;
    for (const [name, payload] of Object.entries(files)) {
        const n = Buffer.from(name);
        const p = Buffer.from(payload);
        const d = method === 8 ? deflateRawSync(p) : p;
        const flags = descriptor === 'none' ? 0 : 8;
        const sum = crc(p);
        const h = Buffer.alloc(30);
        h.writeUInt32LE(0x04034b50);
        h.writeUInt16LE(20, 4);
        h.writeUInt16LE(flags, 6);
        h.writeUInt16LE(method, 8);
        h.writeUInt16LE(n.length, 26);
        if (!flags) {
            h.writeUInt32LE(sum, 14);
            h.writeUInt32LE(d.length, 18);
            h.writeUInt32LE(p.length, 22);
        }
        const tail = Buffer.alloc(descriptor === 'none' ? 0 : descriptor === 'signed' ? 16 : 12);
        if (tail.length) {
            let i = 0;
            if (descriptor === 'signed') {
                tail.writeUInt32LE(0x08074b50);
                i = 4;
            }
            tail.writeUInt32LE(sum, i);
            tail.writeUInt32LE(d.length, i + 4);
            tail.writeUInt32LE(p.length, i + 8);
        }
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50);
        c.writeUInt16LE(20, 4);
        c.writeUInt16LE(20, 6);
        c.writeUInt16LE(flags, 8);
        c.writeUInt16LE(method, 10);
        c.writeUInt32LE(sum, 16);
        c.writeUInt32LE(d.length, 20);
        c.writeUInt32LE(p.length, 24);
        c.writeUInt16LE(n.length, 28);
        c.writeUInt32LE(at, 42);
        locals.push(h, n, d, tail);
        centrals.push(c, n);
        at += h.length + n.length + d.length + tail.length;
    }
    const central = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(Object.keys(files).length, 8);
    end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(central.length, 12);
    end.writeUInt32LE(at, 16);
    return Buffer.concat([...locals, central, end]);
}
const raw = (bytes, options = {}) => extractZipSafely(bytes, options, (code, msg) => { throw Error(`${code}: ${msg}`); });
const out = [];
async function test(name, expected, fn) {
    try {
        await fn();
        out.push({ name, expected, actual: 'accepted', pass: expected === 'accepted' });
    }
    catch (e) {
        out.push({ name, expected, actual: 'refused', error: e.message, pass: expected === 'refused' });
    }
}
const files = Object.fromEntries(Object.entries(await encodeCSV(model)).map(([k, v]) => [k, Buffer.from(v)]));
const withBOM = () => { const f = { ...files }; f['frontmatter.csv'] = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), f['frontmatter.csv']]); return f; };
for (const method of [0, 8])
    for (const desc of ['none', 'signed', 'unsigned']) {
        await test(`method-${method}-${desc}`, 'accepted', async () => await decodeZIP(zip(files, method, desc)));
        const b = zip(files, method, desc);
        const central = b.readUInt32LE(b.length - 6);
        const localPayloadEnd = 30 + b.readUInt16LE(26) + b.readUInt16LE(28) + b.readUInt32LE(central + 20);
        if (desc !== 'none') {
            const bad = Buffer.from(b);
            bad[localPayloadEnd + (desc === 'signed' ? 4 : 0)] ^= 1;
            await test(`descriptor-corrupt-${method}-${desc}`, 'refused', async () => await decodeZIP(bad));
        }
    }
for (const method of [0, 8]) {
    await test(`BOM-old-inventory-${method}`, 'refused', async () => await decodeZIP(zip(withBOM(), method)));
    const f = withBOM();
    const manifest = JSON.parse(f['manifest.json']);
    const item = manifest.files.find(x => x.path === 'frontmatter.csv');
    item.bytes = f[item.path].length;
    item.sha256 = `sha256:${createHash('sha256').update(f[item.path]).digest('hex')}`;
    f['manifest.json'] = Buffer.from(JSON.stringify(manifest));
    await test(`BOM-correct-inventory-${method}`, 'accepted', async () => await decodeZIP(zip(f, method)));
    for (const delta of [-1, 1]) {
        const b = zip(files, method);
        const c = b.readUInt32LE(b.length - 6);
        const size = b.readUInt32LE(22);
        b.writeUInt32LE(size + delta, 22);
        b.writeUInt32LE(size + delta, c + 24);
        await test(`actual-size-${method}-${delta}`, 'refused', async () => await decodeZIP(b));
    }
    const b = zip(files, method);
    const c = b.readUInt32LE(b.length - 6);
    b.writeUInt32LE(0, 14);
    b.writeUInt32LE(0, c + 16);
    await test(`both-crc-wrong-${method}`, 'refused', async () => await decodeZIP(b));
}
for (const [name, change] of [
    ['name', b => { b[30] ^= 1; }], ['flags', b => b.writeUInt16LE(8, 6)], ['method', b => b.writeUInt16LE(8, 8)], ['crc', b => { b[14] ^= 1; }], ['size', b => { b[22] ^= 1; }],
    ['encryption', b => { const c = b.readUInt32LE(b.length - 6); b.writeUInt16LE(1, 6); b.writeUInt16LE(1, c + 8); }],
    ['symlink', b => { const c = b.readUInt32LE(b.length - 6); b.writeUInt32LE(0xa1ff0000, c + 38); }],
    ['invalid-name-utf8', b => { const c = b.readUInt32LE(b.length - 6); b[30] = 255; b[c + 46] = 255; }],
]) {
    const b = zip(files);
    change(b);
    await test(`ZIP-${name}`, 'refused', async () => await decodeZIP(b));
}
for (const name of ['../escape', '/absolute', 'C:/drive', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'a\0b'])
    await test(`path-${JSON.stringify(name)}`, 'refused', () => raw(zip({ [name]: Buffer.from('x') })));
const dup = zip({ 'a.txt': Buffer.from('a'), 'b.txt': Buffer.from('b') });
const central = dup.readUInt32LE(dup.length - 6);
const c2 = central + 46 + 5;
const l2 = dup.readUInt32LE(c2 + 42);
dup.set(Buffer.from('a.txt'), l2 + 30);
dup.set(Buffer.from('a.txt'), c2 + 46);
await test('duplicate-name', 'refused', () => raw(dup));
const valid = zip(files);
const total = Object.values(files).reduce((s, b) => s + b.length, 0);
const count = Object.keys(files).length;
for (const [key, n] of [['maxCompressedBytes', valid.length], ['maxUncompressedBytes', total], ['maxFiles', count]])
    for (const delta of [0, -1])
        await test(`${key}-${delta}`, delta === 0 ? 'accepted' : 'refused', async () => await decodeZIP(valid, { [key]: n + delta }));
for (const n of [1048576, 1048577])
    await test(`ratio-zero-slack-${n}`, n === 1048576 ? 'accepted' : 'refused', () => raw(zip({ 'synthetic.txt': Buffer.alloc(n) }, 8), { maxCompressionRatio: 0 }));
const nested = zip({ 'b': Buffer.from('inner') });
const nestedCentral = nested.readUInt32LE(nested.length - 6);
const innerLocal = nested.subarray(0, nestedCentral);
let overlap = zip({ 'a': innerLocal });
const _outerCentral = overlap.readUInt32LE(overlap.length - 6);
const innerC = Buffer.from(nested.subarray(nestedCentral, nested.length - 22));
innerC.writeUInt32LE(31, 42);
const end = Buffer.from(overlap.subarray(-22));
end.writeUInt16LE(2, 8);
end.writeUInt16LE(2, 10);
end.writeUInt32LE(end.readUInt32LE(12) + innerC.length, 12);
overlap = Buffer.concat([overlap.subarray(0, -22), innerC, end]);
await test('overlapping-local-ranges', 'refused', () => raw(overlap));
fs.writeFileSync(new URL('../../../../node_modules/.cache/rfc0089-production-evidence/independent-zip-results.json', import.meta.url), JSON.stringify({ platform: process.platform, node: process.version, writer: 'reviewer local ZIP headers, node:zlib raw DEFLATE, polynomial CRC', probes: out }, null, 2));
console.log(JSON.stringify({ total: out.length, pass: out.filter(x => x.pass).length, failures: out.filter(x => !x.pass) }, null, 2));
