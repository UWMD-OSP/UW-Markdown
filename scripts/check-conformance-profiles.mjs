#!/usr/bin/env node
// Verifies the RFC 0030 capability-skip mechanism end to end.
//
// The driver decides which cases to skip in Python. This script recomputes the
// same decision in JavaScript, straight from the case files, and compares. Two
// independent implementations of one rule is the point: a single implementation
// checked against its own output would pass even when the rule is wrong.
//
// What it asserts, per profile:
//   1. The set of skipped case ids equals the set this script derives.
//   2. Nothing failed — the stubs delegate to the reference implementation, so
//      any failure is the driver skipping the wrong case, not a bad answer.
//   3. passed + skipped === total. A skip is never counted as a pass.
//   4. `--no-skip` exits non-zero where a capability is unclaimed, and zero
//      where every capability is claimed.
//
// Requires python3. CI runs it in the job that already sets up Python.

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = join(ROOT, 'conformance', 'runner', 'cases');
const RUNNER = join(ROOT, 'conformance', 'runner', 'runner.py');

/** Each profile's claim must match the capability list in its impl.mjs. */
const PROFILES = [
  { dir: '01-reader-only', claims: ['parse'] },
  {
    dir: '02-calc-no-edit',
    claims: ['parse', 'validate', 'render-summary', 'render-chat', 'calc-evaluate'],
  },
  // `claims: null` means the manifest omits the key. Everything must run.
  { dir: '03-absent-capabilities', claims: null },
];

const cases = readdirSync(CASES)
  .filter((f) => f.endsWith('.case.json'))
  .map((f) => JSON.parse(readFileSync(join(CASES, f), 'utf8')));

const failures = [];
const tmp = mkdtempSync(join(tmpdir(), 'uwmd-profiles-'));

function runDriver(implPath, extraArgs = []) {
  const out = join(tmp, `report-${Math.abs(hash(implPath + extraArgs.join()))}.json`);
  const proc = spawnSync(
    'python3',
    [RUNNER, '--impl', `node ${implPath}`, '--manifest-out', out, ...extraArgs],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (proc.error) {
    console.error(`python3 could not be run: ${proc.error.message}`);
    process.exit(2);
  }
  return { status: proc.status, report: JSON.parse(readFileSync(out, 'utf8')) };
}

const hash = (s) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
};

for (const profile of PROFILES) {
  const impl = `conformance/profiles/${profile.dir}/impl.mjs`;

  // The independent computation. `null` claims => nothing is skippable.
  const expectedSkips = new Set(
    profile.claims === null
      ? []
      : cases
          .filter((c) => (c.requires_capabilities ?? []).some((r) => !profile.claims.includes(r)))
          .map((c) => c.id),
  );

  const { report } = runDriver(impl);
  const actualSkips = new Set(report.results.filter((r) => r.skipped).map((r) => r.id));

  for (const id of expectedSkips) {
    if (!actualSkips.has(id)) failures.push(`${profile.dir}: expected a skip for ${id}, it ran`);
  }
  for (const id of actualSkips) {
    if (!expectedSkips.has(id)) failures.push(`${profile.dir}: ${id} was skipped unexpectedly`);
  }

  const { total, passed, failed, skipped } = report.summary;
  if (failed !== 0) {
    failures.push(`${profile.dir}: ${failed} case(s) failed; the stub delegates, so none should`);
  }
  if (passed + skipped !== total) {
    const sums = `passed(${passed}) + skipped(${skipped}) !== total(${total})`;
    failures.push(`${profile.dir}: ${sums} — a skip is being counted as a pass`);
  }
  if (skipped !== expectedSkips.size) {
    failures.push(`${profile.dir}: reported ${skipped} skips, derived ${expectedSkips.size}`);
  }

  // --no-skip: unclaimed capabilities become failures.
  const strict = runDriver(impl, ['--no-skip']);
  const shouldFail = expectedSkips.size > 0;
  if (shouldFail && strict.status === 0) {
    failures.push(`${profile.dir}: --no-skip exited 0 despite ${expectedSkips.size} unclaimed`);
  }
  if (!shouldFail && strict.status !== 0) {
    failures.push(`${profile.dir}: --no-skip exited ${strict.status} with every capability claimed`);
  }

  const note = profile.claims === null ? 'claims omitted' : profile.claims.join(', ');
  console.log(
    `[ok] ${profile.dir.padEnd(24)} ${String(passed).padStart(3)} passed, ` +
      `${String(skipped).padStart(2)} skipped  (${note})`,
  );
}

rmSync(tmp, { recursive: true, force: true });

if (failures.length > 0) {
  console.error('\nconformance profiles: the capability-skip mechanism is wrong.');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n[PASS] ${PROFILES.length} conformance profiles behave as RFC 0030 specifies.`);
