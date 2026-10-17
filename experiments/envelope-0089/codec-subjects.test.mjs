// Independent serialization/hash check of NEW candidate codec artifacts only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const base = new URL('./codec-examples/', import.meta.url);
const read = path => readFileSync(new URL(path, base));
const hash = value => createHash('sha256').update(value).digest('hex');
const matrix = JSON.parse(read('matrix.json'));
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
}
test('five independently reconstructed candidate JCS subjects and all frozen artifact hashes', () => {
  assert.equal(matrix.cases.length, 5);
  let artifacts = 0;
  for (const example of matrix.cases) {
    const prefix = example.case + '/';
    const model = JSON.parse(read(prefix + 'document.uw.json'));
    const {generated_at, generator, semantic_digest, ...semantic} = model;
    const text = JSON.stringify(sorted(semantic));
    assert.equal(text, read(prefix + 'subject.jcs').toString('utf8'), example.case);
    assert.equal('sha256:' + hash(Buffer.from(text, 'utf8')), semantic_digest, example.case);
    assert.equal(semantic_digest, example.semantic_digest);
    for (const artifact of example.artifacts) {
      const raw = read(prefix + artifact.path);
      assert.equal(raw.length, artifact.bytes);
      assert.equal(hash(raw), artifact.sha256);
      artifacts += 1;
    }
    if (example.source_available) {
      const plan = JSON.parse(read(prefix + 'reissuance-plan.json'));
      assert.equal(plan.original_sha256, hash(read(prefix + 'original.uwx.md')));
      assert.equal(plan.new_source_digest, semantic_digest);
    }
  }
  assert.equal(artifacts, 59);
});
test('frozen mixed identity and historical evidence remain distinct and complete', () => {
  const mixed = JSON.parse(read('mixed-null-default/document.uw.json'));
  const records = mixed.extensions.x_review.blocks;
  assert.deepEqual(records.map(record => record.variant), [null, 'default']);
  assert.equal(Object.hasOwn(records[0].block.annotation, 'variant'), false);
  assert.equal(records[1].block.annotation.variant, 'default');
  assert.deepEqual(records[0].block.content._meta.x_unknown_metadata, {retained:[null,'',{'a/~b':true}]});
  const history = JSON.parse(read('ordered-history/document.uw.json'));
  assert.deepEqual(history.superseded.x_review.map(block => block.content._meta.lifecycle.revision), [1,2]);
  assert.equal(history.extensions.x_review.blocks[0].block.content._meta.lifecycle.revision, 3);
});
