import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync } from 'fflate';
import { sha, readJSON, validateModel } from './model.mjs';
import { encodeXML, decodeXML } from './xml.mjs';
import { DOC, VALUE, BLOCK, readCSV, writeCSV, encodeCSV, decodeCSV, encodeZIP, decodeZIP } from './csv.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = resolve(root, 'node_modules/.cache/rfc0089-evidence');
mkdirSync(folder, { recursive: true });
const model = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url))).direct_models[0].expected_model;
const cases = [];
const add = (name, kind, value, layer, pattern, options) => cases.push({ name, kind, value, layer, pattern, options });
const inventory = files => {
  const manifest = JSON.parse(files['manifest.json']);
  for (const row of manifest.files) { row.bytes = Buffer.byteLength(files[row.path]); row.sha256 = sha(Buffer.from(files[row.path])); }
  files['manifest.json'] = JSON.stringify(manifest); return files;
};
for (const value of ['{"a":0,"\\u0061":0}', '{"x":[{"a":0,"a":0}]}']) add(`duplicate-${cases.length}`, 'json', value, 'raw-json', 'duplicate');
add('nonfinite', 'json', '{"x":1e400}', 'raw-json', 'finite');
add('surrogate', 'json', '{"x":"\\ud800"}', 'raw-json', 'surrogate|Unicode');
const xml = encodeXML(model);
for (const [name, value, pattern] of [
  ['namespace', xml.replace('https://uwmd.org/ns/document/2', 'urn:wrong'), 'namespace|root'],
  ['attribute', xml.replace('envelope-version=', 'unexpected="x" envelope-version='), 'attribute'],
  ['mixed', xml.replace('<uw:value type="object">', '<uw:value type="object">mixed'), 'mixed|text'],
  ['lexical', xml.replace('\\u000a', '\\n'), 'lexical|canonical'],
  ['truncated', xml.replace('</uw:document>', ''), 'XML|xml|element|tag'],
]) add(name, 'xml', value, 'xml-grammar', pattern);
for (const name of ['duplicate-pointer', 'ordinal-alias', 'block-extra-overlap', 'duplicate-cell']) {
  const files = encodeCSV(model);
  const rows = readCSV(files['block_values.csv'], VALUE);
  if (name === 'duplicate-pointer') rows.push(rows[0]);
  if (name === 'ordinal-alias') rows.find(row => row[2] === '/strings/0')[2] = '/strings/00';
  if (name === 'block-extra-overlap') rows.push([rows[0][0], 'block-extra', '/annotation', 'null', 'null']);
  if (name === 'duplicate-cell') {
    const doc = readCSV(files['document.csv'], DOC); doc[0][7] = '{"x":0,"\\u0078":0}';
    files['document.csv'] = writeCSV([DOC, ...doc]);
  }
  files['block_values.csv'] = writeCSV([VALUE, ...rows]);
  add(name, 'csv', inventory(files), name === 'duplicate-cell' ? 'raw-json' : 'csv-grammar', name === 'ordinal-alias' ? 'gap|alias' : name === 'block-extra-overlap' ? 'overlap' : 'duplicate');
}
for (const level of [0, 6]) {
  const bytes = encodeZIP(model, level); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 0; at < bytes.length - 46; at++) {
    if (view.getUint32(at, true) === 0x04034b50) view.setUint32(at + 14, 0, true);
    if (view.getUint32(at, true) === 0x02014b50) view.setUint32(at + 16, 0, true);
  }
  add(`crc-${level}`, 'zip', Buffer.from(bytes).toString('base64'), 'zip-integrity', 'CRC|ZIP_INVALID');
}
const renamed = encodeZIP(model, 0); renamed[30] ^= 1;
add('local-name', 'zip', Buffer.from(renamed).toString('base64'), 'zip-integrity', 'name|ZIP_INVALID');
const zipCase = (name, bytes, pattern, layer = 'zip-security') => add(name, 'zip', Buffer.from(bytes).toString('base64'), layer, pattern);
const headers = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  const central = view.getUint32(end + 16, true);
  return { view, end, central };
};
const sample = () => zipSync({ 'sample.txt': Buffer.from('synthetic transport payload') }, { level: 0 });
zipCase('unsafe-path', zipSync({ '../unsafe': Buffer.from('x') }), 'path|PATH_UNSAFE');
const encrypted = sample(); const encryptedHeader = headers(encrypted);
encryptedHeader.view.setUint16(6, 1, true); encryptedHeader.view.setUint16(encryptedHeader.central + 8, 1, true);
zipCase('encrypted', encrypted, 'encryption|ZIP_ENCRYPTED');
const symlink = sample(); const symlinkHeader = headers(symlink);
symlink[symlinkHeader.central + 5] = 3;
symlinkHeader.view.setUint32(symlinkHeader.central + 38, 0xa1ff0000, true);
zipCase('symlink', symlink, 'symlink|ZIP_SYMLINK');
const invalidName = sample(); const invalidNameHeader = headers(invalidName);
invalidName[30] = 255; invalidName[invalidNameHeader.central + 46] = 255;
zipCase('invalid-utf8-name', invalidName, 'utf-8|UTF8|ZIP_FILENAME_UTF8');
const duplicateName = zipSync({ 'first.txt': Buffer.from('a'), 'other.txt': Buffer.from('b') }, { level: 0 });
const duplicateHeader = headers(duplicateName);
const secondCentral = duplicateHeader.central + 46 + 9;
const secondLocal = duplicateHeader.view.getUint32(secondCentral + 42, true);
duplicateName.set(Buffer.from('first.txt'), secondLocal + 30); duplicateName.set(Buffer.from('first.txt'), secondCentral + 46);
zipCase('duplicate-member', duplicateName, 'duplicate|ZIP_DUPLICATE');
for (const [name, offset, centralOffset] of [['local-flags', 6, 8], ['local-method', 8, 10], ['local-crc', 14, 16], ['local-size', 22, 24]]) {
  const value = sample(); const h = headers(value); value[offset] ^= 1;
  assert.notEqual(value[offset], value[h.central + centralOffset]);
  zipCase(name, value, 'local/central|ZIP_INVALID', 'zip-integrity');
}
for (const level of [0, 6]) {
  const value = encodeZIP(model, level); const h = headers(value);
  h.view.setUint32(22, 1, true); h.view.setUint32(h.central + 24, 1, true);
  zipCase(`forged-expanded-${level}`, value, 'size|limit|ZIP_INVALID', 'zip-integrity');
}
const malformed = zipSync({ 'sample.txt': Buffer.from('synthetic '.repeat(100)) }, { level: 6 });
const malformedHeader = headers(malformed);
malformed[30 + malformedHeader.view.getUint16(26, true) + malformedHeader.view.getUint16(28, true)] = 255;
zipCase('malformed-deflate', malformed, 'invalid|error|DEFLATE|ZIP_INVALID', 'zip-integrity');
zipCase('ratio-limit', zipSync({ 'ratio.txt': Buffer.alloc(2 * 1024 * 1024) }, { level: 6 }), 'ratio|ZIP_RATIO_LIMIT', 'resource');
const files = encodeCSV(model);
const raw = Object.fromEntries(Object.entries(files).map(([path, value]) => [path, Buffer.from(value)]));
raw['frontmatter.csv'] = Buffer.concat([Buffer.from([239, 187, 191]), raw['frontmatter.csv']]);
add('uninventoried-bom', 'zip', Buffer.from(zipSync(raw)).toString('base64'), 'inventory', 'inventory|byte count');
for (const [name, options, pattern] of [['file-limit', { maxFiles: 0 }, 'file count|FILE_LIMIT'], ['expanded-limit', { maxUncompressedBytes: 1 }, 'limit|SIZE_LIMIT'], ['compressed-limit', { maxCompressedBytes: 1 }, 'limit|ZIP_SIZE_LIMIT']]) {
  add(name, 'zip', Buffer.from(encodeZIP(model)).toString('base64'), 'resource', pattern, options);
}
// Positive arbitrary-row-order control is also decoded by the independent implementation.
const reordered = encodeCSV(model);
for (const [name, header] of [['blocks.csv', BLOCK], ['block_values.csv', VALUE]]) {
  const rows = readCSV(reordered[name], header).reverse();
  if (name === 'blocks.csv') for (const row of rows) row[2] = row[2].replace('property', '\\u0070roperty');
  reordered[name] = writeCSV([header, ...rows]);
}
cases.push({ name: 'reordered-positive', kind: 'csv', value: inventory(reordered), layer: 'accepted', digest: encodeCSV(model)['manifest.json'] });

test('independent refusal agreement preserves the failing boundary', () => {
  const observations = [];
  for (const item of cases) {
    const run = () => item.kind === 'json' ? readJSON(item.value) : item.kind === 'xml' ? decodeXML(item.value) : item.kind === 'csv' ? decodeCSV(item.value) : decodeZIP(Buffer.from(item.value, 'base64'), item.options);
    if (item.layer === 'accepted') validateModel(run(), true);
    else assert.throws(run, new RegExp(item.pattern, 'i'), item.name);
    observations.push({ name: item.name, layer: item.layer, result: 'pass' });
  }
  writeFileSync(resolve(folder, 'refusal-cases.json'), JSON.stringify(cases));
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', fileURLToPath(new URL('./refusals.py', import.meta.url)), folder], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  writeFileSync(resolve(folder, 'node-refusals.json'), JSON.stringify({ platform: process.platform, observations }, null, 2));
});
