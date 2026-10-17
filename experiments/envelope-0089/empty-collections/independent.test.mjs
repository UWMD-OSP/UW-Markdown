// Independent Node reconstruction of Python-written research artifacts, not a third independent codec lineage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { csv, decodeCsv, decodeZip, jcs, sha } from './independent.mjs';
const here = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('fixtures/manifest.json', here)));
const docHeader = ['envelope_version', 'format_version', 'generated_at_json', 'generator_json', 'semantic_digest', 'deal_id_json', 'deal_name_json', 'extra_json', 'empty_collections_json'];
const table = (header, rows) => `${[header, ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
function input(name) {
  return Object.fromEntries(['block_values.csv', 'blocks.csv', 'document.csv', 'frontmatter.csv', 'manifest.json', 'prose.csv'].map(file => [file, readFileSync(new URL(`fixtures/${name}/csv/${file}`, here), 'utf8')]));
}
function changed(files, entries) {
  const output = { ...files };
  const row = csv(output['document.csv'], docHeader)[0];
  row[8] = jcs(entries);
  output['document.csv'] = table(docHeader, [row]);
  const inventory = Object.entries(output).filter(([name]) => name !== 'manifest.json').sort(([a], [b]) => a < b ? -1 : 1).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) }));
  output['manifest.json'] = JSON.stringify({ ...JSON.parse(output['manifest.json']), inventory });
  return output;
}
test('all 28 frozen artifacts and 3 complete JSON/CSV/ZIP reconstructions', () => {
  let count = 1;
  for (const row of manifest.cases) {
    const model = JSON.parse(readFileSync(new URL(`fixtures/${row.case}/model.json`, here)));
    for (const item of row.artifacts) {
      const bytes = readFileSync(new URL(`fixtures/${row.case}/${item.path}`, here));
      assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256); count++;
    }
    assert.equal(jcs(decodeCsv(input(row.case))), jcs(model));
    assert.equal(jcs(decodeZip(readFileSync(new URL(`fixtures/${row.case}/bundle.zip`, here)))), jcs(model));
    assert.equal(model.semantic_digest, row.semantic_digest);
  }
  assert.equal(count, 28);
});
test('exact empty carrier paths, no absent/empty collapse', () => {
  const absent = decodeCsv(input('absent-slots'));
  const empty = decodeCsv(input('empty-slots'));
  assert.notEqual(absent.semantic_digest, empty.semantic_digest);
  assert.equal(Object.hasOwn(absent.sections, 'valuation'), false);
  assert.equal(jcs(empty.sections.valuation), '{}');
  assert.equal(jcs(empty.superseded.x_history), '[]');
  assert.equal(jcs(empty.sections['literal/~slot']), '{}');
});
test('closed carrier kind/location/duplicate/order/escape/overlap refusals after renewed inventory', () => {
  const files = input('mixed-complete-blocks');
  const good = JSON.parse(csv(files['document.csv'], docHeader)[0][8]);
  for (const [value, reason] of [[null, /empty carrier array/], [{}, /empty carrier array/], [[good[0], good[0]], /empty carrier overlap/], [[...good].reverse(), /empty carrier duplicate\/order/], [[{ path: '/sections/valuation', kind: 'array' }], /empty carrier kind/], [[{ path: '/superseded/valuation', kind: 'object' }], /empty carrier kind/], [[{ path: '/extensions/x_empty', kind: 'object' }], /empty carrier location/], [[{ path: '/sections/property', kind: 'object' }], /empty carrier overlap/], [[{ path: '/superseded/x_review', kind: 'array' }], /empty carrier overlap/], [[{ path: '/sections/bad~2', kind: 'object' }], /pointer escape/], [[{ path: '/sections/valuation/deep', kind: 'object' }], /empty carrier location/], [[{ path: '/sections/valuation', kind: 'object', extra: true }], /empty carrier members/]]) assert.throws(() => decodeCsv(changed(files, value)), reason);
});
test('omitting an empty declaration cannot retain the original semantic subject', () => {
  assert.throws(() => decodeCsv(changed(input('empty-slots'), [])), /semantic digest/);
});
