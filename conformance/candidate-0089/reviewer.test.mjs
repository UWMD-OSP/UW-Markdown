import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { jcs } from './model.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = resolve(root, 'node_modules/.cache/rfc0089-evidence');
const read = name => JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
test('preserved independent source, subject, ZIP and finding probes run against the repaired candidate', () => {
  for (const name of ['review-oracle', 'review-probes', 'review-subjects', 'review-zip', 'review-auth-boundaries']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./reviewer/${name}.mjs`, import.meta.url))], { cwd: root, encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, `${name}\n${result.stdout}\n${result.stderr}`);
  }
  const frozen = JSON.parse(readFileSync(new URL('./reviewer/source-oracles.json', import.meta.url), 'utf8'));
  const current = read('independent-source-oracles.json');
  assert.equal(current.records.length, 18);
  for (let index = 0; index < current.records.length; index++) {
    const record = current.records[index];
    assert.equal(record.candidate_equal, true); assert.equal(record.builder_expected_equal, true);
    for (const key of ['name', 'physical_count', 'expected_model', 'expected_preimage', 'expected_digest']) assert.equal(jcs(record[key]), jcs(frozen.records[index][key]));
  }
  const probes = read('independent-results.json'); const zip = read('independent-zip-results.json');
  assert.equal(probes.probes.length, 95); assert.ok(probes.probes.every(item => item.pass), JSON.stringify(probes.probes.filter(item => !item.pass)));
  assert.equal(zip.probes.length, 46); assert.ok(zip.probes.every(item => item.pass));
  assert.equal(read('independent-subject-results.json').results.length, 25);
  const auth = read('independent-auth-results.json'); assert.equal(auth.observations.length, 4);
  for (const item of auth.observations) {
    assert.equal(item.state ?? item.verdict, 'verified'); assert.equal(item.backend_calls, 1); assert.deepEqual(item.codes, []);
  }
  writeFileSync(resolve(folder, 'reviewer-rerun.json'), `${JSON.stringify({ platform: process.platform,
    source_oracles: 18, subject_controls: 25, probes: 95, zip_controls: 46, real_authentication: 4,
    result: 'pass', provenance: 'Existing independent expectations rerun by builder; independent re-review and finding closure remain pending' }, null, 2)}\n`);
});
