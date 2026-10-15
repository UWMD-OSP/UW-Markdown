// Runs each examples/verification script as a user would and checks it exits
// 0, which each script does only when the verifier reports the verdicts its
// scenario documents. The scripts import the built packages, so build first.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dir = fileURLToPath(new URL('../examples/verification/', import.meta.url));
const scripts = readdirSync(dir).filter((name) => /^\d\d-.*\.mjs$/.test(name)).sort();

test('the four verification scenarios are present', () => {
  assert.deepEqual(scripts, [
    '01-valid-document.mjs',
    '02-incorrect-stated-metric.mjs',
    '03-tampered-receipt.mjs',
    '04-document-signature-failure.mjs',
  ]);
});

for (const script of scripts) {
  test(`${script} reports its documented verdicts`, () => {
    const run = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, `${script} exited ${run.status}\n${run.stdout}\n${run.stderr}`);
    assert.equal(run.stderr, '');
  });
}
