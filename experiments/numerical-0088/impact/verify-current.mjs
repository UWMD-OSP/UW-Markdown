// Read-only current numerical-impact evidence verification; no corpus execution.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const base = new URL('./current-evidence/', import.meta.url);
const load = name => readFileSync(new URL(name, base));
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(load('observed-impact.json'));
const restore = descriptor => {
  const raw = load(descriptor.path); assert.equal(sha(raw), descriptor.sha256);
  const rows = raw.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, descriptor.count); return rows;
};
const cases = restore(manifest.case_artifact);
const changes = restore(manifest.primitive_changes_artifact);
const streams = {};
for (const a of manifest.evidence_artifacts) {
  const packed = load(a.path); assert.equal(sha(packed), a.gzip_sha256); assert.equal(packed.length, a.gzip_bytes);
  const raw = gunzipSync(packed); assert.equal(sha(raw), a.raw_sha256); assert.equal(raw.length, a.raw_bytes);
  streams[a.path.split('/').at(-1).replace(/\.gz$/, '')] = raw;
}
const index = JSON.parse(readFileSync(new URL('../../../conformance/corpus-index.json', import.meta.url)));
const key = row => JSON.stringify([String(row.suite), row.scenario]);
assert.deepEqual(new Set(cases.map(row => row.id)), new Set(index.cases.map(key)));
assert.equal(cases.length, 1106); assert.equal(new Set(cases.map(row => row.id)).size, 1106);
const captured = {};
const primitives = {};
for (const mode of ['baseline', 'candidate']) {
  const report = JSON.parse(streams[`${mode}.stdout.json`]);
  assert.deepEqual(report.summary, {pass:1106,fail:0,updated:0});
  const events = streams[`${mode}.events.ndjson`].toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const rows = events.filter(row => row.kind === 'case');
  assert.equal(rows.length, 1106); assert.equal(new Set(rows.map(key)).size, 1106);
  assert.ok(rows.every(row => row.capture_errors.length === 0));
  captured[mode] = new Map(rows.map(row => [key(row), row]));
  primitives[mode] = events.filter(row => row.kind === 'primitive');
  assert.equal(primitives[mode].length, 14145);
  assert.equal(sha(streams[`${mode}.events.ndjson`]), manifest.runs[mode].events_sha256);
  assert.equal(sha(streams[`${mode}.transforms.ndjson`]), manifest.runs[mode].transforms_sha256);
}
let different = 0;
for (const row of cases) {
  assert.equal(row.baseline_status, 'pass'); assert.equal(row.candidate_status, 'pass');
  assert.ok(row.observed_binding_names.length > 0); assert.equal(row.exact_whole_result_proof, false);
  const observations = {};
  for (const mode of ['baseline','candidate']) {
    const snapshot = captured[mode].get(row.id).snapshot;
    const values = Object.fromEntries(row.observed_binding_names.map(name => {
      assert.ok(Object.hasOwn(snapshot,name));
      assert.ok(!['not-initialized','function'].includes(snapshot[name]?.type));
      return [name,snapshot[name]];
    }));
    observations[mode] = values;
    assert.equal(sha(JSON.stringify(values)),row[`${mode}_observation_sha256`]);
  }
  if (JSON.stringify(observations.baseline) !== JSON.stringify(observations.candidate)) {
    different++;
    assert.ok(row.observed_changes.length > 0);
    assert.ok(row.observed_changes.every(change => change.classification === 'volatile_timestamp_only'));
  } else assert.equal(row.observed_changes.length, 0);
}
assert.equal(different, 6);
const primitiveChanges = [];
for (let i=0;i<primitives.baseline.length;i++) {
  const a=primitives.baseline[i];
  const b=primitives.candidate[i];
  assert.equal(a.op,b.op); assert.equal(a.site,b.site); assert.deepEqual(a.args,b.args);
  if (JSON.stringify(a.result??a.error)!==JSON.stringify(b.result??b.error)) primitiveChanges.push(i);
}
assert.deepEqual(primitiveChanges,changes.map(row=>row.ordinal)); assert.equal(changes.length,671);
assert.equal(manifest.summary.incomplete_visible_observations,0);
assert.equal(manifest.summary.cases_with_observed_numeric_changes,0);
assert.equal(manifest.summary.cases_with_observed_state_or_refusal_changes,0);
assert.equal(manifest.summary.whole_result_proof_claim,false);
console.log('PASS current1106-case evidence: exact streams/observation hashes,0missing captures,671 primitive changes,6 timestamp-only cases; no whole-result proof claimed.');
