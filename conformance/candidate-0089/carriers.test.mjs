import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync } from 'fflate';
import { VERSION, NAMESPACE, jcs, readJSON, validateModel, projectSource, portable, preimage, digest, stamp, toMarkdown, sha } from './model.mjs';
import { lexical, encodeXML, decodeXML } from './xml.mjs';
import { DOC, BLOCK, VALUE, readCSV, writeCSV, flatten, encodeCSV, decodeCSV, encodeZIP, decodeZIP } from './csv.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const evidence = resolve(root, 'node_modules/.cache/rfc0089-evidence');
mkdirSync(evidence, { recursive: true });
const packet = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const cases = [...packet.source_cases, ...packet.direct_models];
const model = packet.direct_models[0].expected_model;
const json = value => validateModel(readJSON(value), true);
const equal = (actual, expected) => assert.equal(jcs(actual), jcs(expected));
const inventory = files => {
  const manifest = JSON.parse(files['manifest.json']);
  for (const entry of manifest.files) { entry.bytes = Buffer.byteLength(files[entry.path]); entry.sha256 = sha(Buffer.from(files[entry.path])); }
  files['manifest.json'] = JSON.stringify(manifest); return files;
};

test('D1/D2 exact source models, occurrences, independent frozen preimages', () => {
  for (const item of packet.source_cases) {
    const actual = projectSource(item.source);
    equal(actual.model, item.expected_model);
    assert.equal(actual.physical_count, item.physical_count);
    assert.equal(actual.accounted_count, item.physical_count);
    assert.equal(preimage(actual.model), item.expected_preimage);
    assert.equal(digest(actual.model), item.expected_digest);
  }
});

test('D1/D3 one-peer mode survives; Markdown refuses a mode it cannot reproduce', () => {
  const direct = packet.direct_models.find(item => item.name === 'direct-one-peer-no-role').expected_model;
  const singleton = structuredClone(direct);
  singleton.extensions.x_probe = { mode: 'single', block: direct.extensions.x_probe.blocks[0].block };
  equal(projectSource(toMarkdown(singleton)).model.extensions, singleton.extensions);
  assert.throws(() => toMarkdown(direct), /reprojection/);
  const plain = structuredClone(singleton);
  delete plain.extensions.x_probe.block.annotation.variant;
  equal(portable(singleton), portable(plain));
  assert.notEqual(digest(singleton), digest(plain));
});

test('D3 complete subject changes for values omitted by the portable minimum', () => {
  const base = packet.direct_models[1].expected_model;
  const mutations = [
    value => { value.extensions.x_probe.blocks[0].block.content._notes = 'notes'; },
    value => { value.extensions.x_probe.blocks[0].block.prose = ''; },
    value => { value.extensions.x_probe.blocks[0].block.annotation.source = 'manual'; },
    value => { value.extensions.x_probe.blocks[0].block.extra = null; },
    value => { value.outer = {}; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(base); mutate(changed);
    validateModel(changed);
    equal(portable(changed), portable(base));
    assert.notEqual(digest(changed), digest(base));
  }
  const nullValue = structuredClone(base); nullValue.outer = null;
  const emptyValue = structuredClone(base); emptyValue.outer = {};
  assert.notEqual(digest(nullValue), digest(emptyValue));
});

test('D4 complete JSON/XML/CSV and actual STORE/DEFLATE; no prototype pollution', () => {
  for (const item of cases) {
    const expected = { ...item.expected_model, semantic_digest: item.expected_digest };
    assert.equal(preimage(expected), item.expected_preimage);
    const actual = [json(JSON.stringify(expected)), decodeXML(encodeXML(expected)), decodeCSV(encodeCSV(expected)),
      decodeZIP(encodeZIP(expected, 0)), decodeZIP(encodeZIP(expected, 6))];
    for (const value of actual) equal(value, expected);
    assert.deepEqual(encodeZIP(expected), encodeZIP(expected));
    const folder = resolve(evidence, item.name); mkdirSync(folder, { recursive: true });
    writeFileSync(resolve(folder, 'node.json'), JSON.stringify(expected));
    writeFileSync(resolve(folder, 'node.xml'), encodeXML(expected));
    writeFileSync(resolve(folder, 'node-csv.json'), JSON.stringify(encodeCSV(expected)));
    writeFileSync(resolve(folder, 'node-store.zip'), encodeZIP(expected, 0));
    writeFileSync(resolve(folder, 'node-deflate.zip'), encodeZIP(expected, 6));
    writeFileSync(resolve(folder, 'expected-preimage.txt'), item.expected_preimage);
    if (item.source) writeFileSync(resolve(folder, 'source.uwx.md'), item.source);
  }
  assert.equal({}.safe, undefined);
});

test('D4 separate Python projector and both codec directions against the same frozen values', () => {
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', fileURLToPath(new URL('./interop.py', import.meta.url)), evidence],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const item of cases) {
    const folder = resolve(evidence, item.name);
    const expected = { ...item.expected_model, semantic_digest: item.expected_digest };
    const actual = [json(readFileSync(resolve(folder, 'python.json'), 'utf8')),
      decodeXML(readFileSync(resolve(folder, 'python.xml'), 'utf8')),
      decodeCSV(JSON.parse(readFileSync(resolve(folder, 'python-csv.json'), 'utf8'))),
      decodeZIP(readFileSync(resolve(folder, 'python-store.zip'))), decodeZIP(readFileSync(resolve(folder, 'python-deflate.zip')))];
    for (const value of actual) equal(value, expected);
  }
});

test('D4 raw JSON duplicate names, escaped aliases, finite binary64 and Unicode refusals', () => {
  for (const text of ['{"a":1,"\\u0061":1}', '{"x":[{"a":1,"a":1}]}', '{"x":1e400}', '{"x":"\\ud800"}', '{"\\udc00":1}', '{"x":01}', '{}{}']) {
    assert.throws(() => readJSON(text));
  }
  equal(readJSON('{"unique\\u0000":"\\ufffe\\ud800\\udc00"}'), { 'unique\0': '\ufffe\u{10000}' });
});

test('D4 ASCII lexical spelling and expanded XML namespace rules', () => {
  assert.equal(lexical('\n\t\r\b\f\x7f\ufffe\u{10000}'), '"\\u000a\\u0009\\u000d\\u0008\\u000c\\u007f\\ufffe\\ud800\\udc00"');
  const text = encodeXML(model);
  assert.ok([...text].every(char => char.codePointAt(0) < 128));
  const prefixed = text.replaceAll('xmlns:uw=', 'xmlns:renamed=').replace(/(<\/?)(?:uw:)/g, '$1renamed:');
  const unprefixed = text.replaceAll('xmlns:uw=', 'xmlns=').replace(/(<\/?)(?:uw:)/g, '$1');
  equal(decodeXML(prefixed), stamp(model)); equal(decodeXML(unprefixed), stamp(model));
  const negatives = [
    text.replace('\\u000a', '\\n'),
    text.replace('envelope-version=', 'unexpected="x" envelope-version='),
    text.replace('<uw:value type="object">', `<uw:value xmlns:uw="urn:wrong" type="object">`),
    text.replace(' type="object"', ' uw:type="object"'),
    text.replace('name-json=', 'type="string" name-json='),
    text.replace('</uw:document>', ''), `${text}${text}`, `${text}tail`,
    text.replace(`xmlns:uw="${NAMESPACE}"`, ''), `<!DOCTYPE x [<!ENTITY y "z">]>${text}`,
    text.replace('<uw:value type="object">', '<uw:value type="object">mixed'),
    text.replace('<uw:value type="null"/>', '<uw:value type="null"> </uw:value>'),
  ];
  for (const bad of negatives) assert.throws(() => decodeXML(bad));
});

test('D4 embedded JSON duplicate aliases are rejected before semantic comparison', () => {
  const duplicate = value => {
    const key = Object.keys(value)[0]; const alias = `\\u${key.charCodeAt(0).toString(16).padStart(4, '0')}${key.slice(1)}`;
    return `{"${alias}":${jcs(value[key])},${jcs(value).slice(1)}`;
  };
  for (const cell of [7, 8]) {
    const files = encodeCSV(model); const rows = readCSV(files['document.csv'], DOC); const value = JSON.parse(rows[0][cell]);
    rows[0][cell] = cell === 7 ? duplicate(value) : `[${duplicate(value[0])}]`;
    files['document.csv'] = writeCSV([DOC, ...rows]); inventory(files);
    assert.throws(() => decodeCSV(files), /duplicate decoded JSON name/);
  }
  const files = encodeCSV(model);
  files['manifest.json'] = duplicate(JSON.parse(files['manifest.json']));
  assert.throws(() => decodeCSV(files), /duplicate decoded JSON name/);
});

test('D4 CSV typed paths, gaps and reserved scope overlaps refuse without hidden reconstruction', () => {
  const duplicate = encodeCSV(model); const original = readCSV(duplicate['block_values.csv'], VALUE);
  duplicate['block_values.csv'] = writeCSV([VALUE, ...original, original[0]]); inventory(duplicate);
  assert.throws(() => decodeCSV(duplicate), /duplicate/);
  const gap = encodeCSV(model); const gapRows = readCSV(gap['block_values.csv'], VALUE);
  const index = gapRows.findIndex(row => row[1] === 'content' && row[2] === '/strings/0');
  assert.ok(index >= 0); gapRows[index][2] = '/strings/00';
  gap['block_values.csv'] = writeCSV([VALUE, ...gapRows]); inventory(gap);
  assert.throws(() => decodeCSV(gap), /gap\/alias/);
  const overlap = encodeCSV(model); const rows = readCSV(overlap['block_values.csv'], VALUE);
  const ref = rows[0][0]; const extra = model.sections.property;
  const keep = rows.filter(row => row[0] !== ref || row[1] !== 'block-extra');
  const injected = flatten({ x_extra: extra.x_extra, x_null: null, annotation: extra.annotation }).map(row => [ref, 'block-extra', ...row]);
  overlap['block_values.csv'] = writeCSV([VALUE, ...keep, ...injected]); inventory(overlap);
  assert.throws(() => decodeCSV(overlap), /overlap/);
});

test('D4 empty builtin variants and null metadata stay invalid despite carrier capacity', () => {
  const empty = structuredClone(model); empty.sections.invalid_empty = {};
  assert.throws(() => encodeXML(empty), /shape/);
  assert.throws(() => encodeCSV(empty), /shape/);
  const missing = structuredClone(model); delete missing.sections.property.content._meta;
  const nullable = structuredClone(model); nullable.sections.property.content._meta = null;
  for (const bad of [missing, nullable]) assert.throws(() => validateModel(bad), /shape/);
});

test('D4 CSV table order is independent of semantic ordinals and JSON token spelling', () => {
  const files = encodeCSV(model);
  for (const [name, header] of [['blocks.csv', BLOCK], ['block_values.csv', VALUE]]) {
    const rows = readCSV(files[name], header).reverse();
    if (name === 'blocks.csv') for (const row of rows) row[2] = row[2].replace('property', '\\u0070roperty');
    files[name] = writeCSV([header, ...rows]);
  }
  equal(decodeCSV(inventory(files)), stamp(model));
});

test('D4 direct model admission cannot silently erase non-JSON values', () => {
  for (const value of [undefined, NaN, Infinity, new Date(), [undefined], Array(1), () => 1]) {
    const changed = structuredClone(model); changed.outer = value;
    assert.throws(() => validateModel(changed));
  }
  const cyclic = structuredClone(model); cyclic.outer = cyclic;
  assert.throws(() => validateModel(cyclic), /cyclic/);
});

test('D4 actual ZIP CRC/header/BOM and resource controls independent of semantic digest', () => {
  for (const level of [0, 6]) {
    const bytes = encodeZIP(model, level); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let at = 0; at < bytes.length - 46; at++) {
      if (view.getUint32(at, true) === 0x04034b50) view.setUint32(at + 14, 0, true);
      if (view.getUint32(at, true) === 0x02014b50) view.setUint32(at + 16, 0, true);
    }
    assert.throws(() => decodeZIP(bytes), /ZIP_INVALID/);
    const files = encodeCSV(model);
    const raw = Object.fromEntries(Object.entries(files).map(([path, value]) => [path, Buffer.from(value)]));
    raw['frontmatter.csv'] = Buffer.concat([Buffer.from([239, 187, 191]), raw['frontmatter.csv']]);
    assert.throws(() => decodeZIP(zipSync(raw, { level })), /byte count/);
    const manifest = JSON.parse(files['manifest.json']);
    const entry = manifest.files.find(file => file.path === 'frontmatter.csv');
    entry.bytes = raw['frontmatter.csv'].length; entry.sha256 = sha(raw['frontmatter.csv']);
    raw['manifest.json'] = Buffer.from(JSON.stringify(manifest));
    equal(decodeZIP(zipSync(raw, { level })), stamp(model));
  }
  const mismatch = encodeZIP(model, 0); const view = new DataView(mismatch.buffer, mismatch.byteOffset, mismatch.byteLength);
  const nameLength = view.getUint16(26, true); assert.ok(nameLength > 0); mismatch[30] ^= 1;
  assert.throws(() => decodeZIP(mismatch), /ZIP_INVALID/);
  const valid = encodeZIP(model);
  assert.throws(() => decodeZIP(valid, { maxFiles: 0 }), /FILE_LIMIT/);
  assert.throws(() => decodeZIP(valid, { maxUncompressedBytes: 1 }), /SIZE_LIMIT/);
  assert.throws(() => decodeZIP(valid, { maxCompressedBytes: valid.length - 1 }), /ZIP_SIZE_LIMIT/);
});

test('candidate evidence records platform and exact commitments without an acceptance claim', () => {
  writeFileSync(resolve(evidence, 'node-results.json'), `${JSON.stringify({ platform: process.platform, node: process.version,
    source_cases: packet.source_cases.length, direct_models: packet.direct_models.length,
    cases: cases.map(item => ({ name: item.name, digest: item.expected_digest, preimage_sha256: sha(Buffer.from(item.expected_preimage)), source_sha256: item.source ? sha(Buffer.from(item.source)) : null })),
    status: 'candidate execution only; independent finding closure not claimed', version: VERSION }, null, 2)}\n`);
});
