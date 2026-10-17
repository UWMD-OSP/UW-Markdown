import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { decodeCsv, decodeXml, decodeZip, descriptors, jcs, sha, sourceAccounting, subject } from './independent.mjs';
const here = new URL('./', import.meta.url);
const read = name => readFileSync(new URL(name, here));
const json = name => JSON.parse(read(name));
const plain = value => JSON.parse(JSON.stringify(value));
const matrix = json('fixtures/manifest.json');
function filesFor(name) {
  return Object.fromEntries(readdirSync(new URL(`fixtures/${name}/csv/`, here)).map(path => [path, read(`fixtures/${name}/csv/${path}`).toString('utf8')]));
}
function refresh(files) {
  const manifest = JSON.parse(files['manifest.json']);
  for (const item of manifest.inventory) { const raw = Buffer.from(files[item.path]); item.bytes = raw.length; item.sha256 = sha(raw); }
  files['manifest.json'] = JSON.stringify(manifest); return files;
}
test('all frozen bytes, independent JCS subjects and complete crosscodec values agree', () => {
  assert.equal(sha(read('../codec-examples/matrix.json')), matrix.preserved_original_matrix_sha256);
  for (const row of matrix.cases) {
    for (const item of row.artifacts) { const raw = read(`fixtures/${row.case}/${item.path}`); assert.equal(raw.length, item.bytes); assert.equal(sha(raw), item.sha256); }
    const model = json(`fixtures/${row.case}/model.json`);
    assert.equal(subject(model), row.semantic_digest);
    const semantic = Object.fromEntries(Object.entries(model).filter(([key]) => !['generated_at', 'generator', 'semantic_digest'].includes(key)));
    assert.equal(jcs(semantic), read(`fixtures/${row.case}/subject.jcs`).toString('utf8'));
    assert.deepEqual(plain(decodeCsv(filesFor(row.case))), model);
    assert.deepEqual(plain(decodeZip(read(`fixtures/${row.case}/bundle.zip`))), model);
    assert.deepEqual(plain(decodeXml(read(`fixtures/${row.case}/document.xml`).toString('utf8'))), model);
    assert.equal(descriptors(model).length, 10);
    assert.deepEqual(model.extensions.x_review.blocks.map(record => record.variant), [null, 'default']);
    assert.notEqual(model.extensions.x_review.blocks[0].block.content._role, undefined);
  }
});
test('CSV duplicate/ref/mode/scope/overlap/digest mutations refuse after valid disposable inventories', () => {
  const original = filesFor('all-block-extras');
  const changes = [
    ['block_values.csv', text => text.replaceAll('"block-extra"', '"unknown-scope"')],
    ['block_values.csv', text => text.replace('"/x_extra"', '"/annotation"')],
    ['blocks.csv', text => text.replace('"default""', '"other""')],
    ['blocks.csv', text => text.replace('"variants"', '"single"')],
    ['blocks.csv', text => text.replace('/blocks/0/block', '/blocks/2/block')],
    ['block_values.csv', text => `${text}${text.split('\r\n')[1]}\r\n`],
    ['document.csv', text => text.replace('E_NEXT', 'unsupported')],
    ['document.csv', text => text.replace(/sha256:[a-f0-9]{64}/, `sha256:${'0'.repeat(64)}`)],
  ];
  for (const [name, mutate] of changes) { const files = { ...original, [name]: mutate(original[name]) }; assert.notEqual(files[name], original[name]); assert.throws(() => decodeCsv(refresh(files))); }
});
test('XML lexical controls carry NUL/noncharacters/paired Unicode and reject sanitization/aliases/DTD', () => {
  const text = read('fixtures/xml-lexical-domain/document.xml').toString('utf8');
  const model = decodeXml(text);
  assert.equal(model.x_outer['nul\u0000name'], 'NUL\u0000 U+FFFE\ufffe U+FFFF\uffff pair😀');
  assert(!text.includes('\u0000'));
  const mutations = [
    text.replace('\\u0000', '\\u0001'), text.replace('\\ufffe', '\\uFFFE'),
    text.replace('type="string"', 'type="unknown"'), text.replace('xmlns:uw="', 'xmlns:other="'),
    text.replace('<?xml', '<!DOCTYPE value><?xml'), text.replace('\\ud83d\\ude00', '\\ud800'),
  ];
  for (const mutated of mutations) { assert.notEqual(mutated, text); assert.throws(() => decodeXml(mutated)); }
});
test('actual ZIP local/central security and bounded STORE profile refuse mutations', () => {
  const raw = read('fixtures/all-block-extras/bundle.zip');
  const changes = [bytes => { bytes[6] |= 1; }, bytes => { bytes[8] = 8; }, bytes => { bytes[45] ^= 1; }, bytes => { bytes[14] ^= 1; }];
  for (const mutate of changes) { const bytes = Buffer.from(raw); mutate(bytes); assert.throws(() => decodeZip(bytes)); }
  assert.throws(() => decodeZip(Buffer.concat([raw, Buffer.from('X')])));
});
test('independent source scanner preserves every physical current/history identity and exact body bytes', () => {
  for (const name of ['mixed-null-default', 'ordered-history']) {
    const raw = read(`../codec-examples/${name}/original.uwx.md`);
    const expected = json(`../codec-examples/${name}/reissuance-plan.json`);
    assert.equal(sha(raw), expected.original_sha256);
    assert.deepEqual(sourceAccounting(raw), expected.source_accounting);
  }
});
