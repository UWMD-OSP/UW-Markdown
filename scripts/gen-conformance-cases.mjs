#!/usr/bin/env node
// Generate the declarative case files the RFC 0004 driver reads.
//
// The cases are derived from the fixture directories rather than hand-written,
// because a case file is a restatement of what is already on disk: which
// fixture, which command, which baseline. Hand-maintaining ~50 of those is a
// standing invitation for one to go stale silently — a case pointing at a
// fixture nobody deletes and nobody runs.
//
// Run: node scripts/gen-conformance-cases.mjs  (or `npm run gen-conformance-cases`)

import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = join(ROOT, 'conformance', 'runner', 'cases');
const CONFORMANCE = join(ROOT, 'conformance');

const cases = [];

const readFileText = (path) => readFileSync(path, 'utf8');

/** Relative POSIX path from the repo root — case files must be portable. */
const rel = (abs) => abs.slice(ROOT.length + 1).replaceAll('\\', '/');

function add(id, tier, command, args, fixtureDir, expect) {
  cases.push({ id, tier, command, args, fixture_dir: rel(fixtureDir), expect });
}

const dirs = (base) =>
  existsSync(base)
    ? readdirSync(base)
        .filter((name) => statSync(join(base, name)).isDirectory())
        .sort()
    : [];

// ── Tier 1: parse, validate, render ─────────────────────────────────────────
//
// One fixture yields four cases. The parsed and validation baselines are
// compared as JSON subsets; the two rendered baselines are text, because they
// ARE text — wrapping a rendered chat transcript in a JSON envelope to satisfy
// a protocol would mean re-baselining every one of them to gain nothing.

const T1_FIXTURES = join(CONFORMANCE, 'tier-1-reader', 'fixtures');
const T1_EXPECTED = join(CONFORMANCE, 'tier-1-reader', 'expected');
for (const file of readdirSync(T1_FIXTURES).filter((f) => f.endsWith('.uw.md')).sort()) {
  const stem = basename(file, '.uw.md');
  const baseline = (suffix) => rel(join(T1_EXPECTED, `${stem}.${suffix}`));

  if (existsSync(join(T1_EXPECTED, `${stem}.parsed.json`))) {
    add(`tier-1/${stem}/parse`, '1', 'parse', [file], T1_FIXTURES, {
      kind: 'json-subset',
      file: baseline('parsed.json'),
    });
  }
  if (existsSync(join(T1_EXPECTED, `${stem}.validation.json`))) {
    add(`tier-1/${stem}/validate`, '1', 'validate', [file, '--json'], T1_FIXTURES, {
      kind: 'json-subset',
      file: baseline('validation.json'),
      // The baseline is the deduplicated (code, severity) set, not the raw
      // issue list — pinning message wording would make every copy edit a
      // corpus change. The driver applies the same projection by name.
      project: 'issue-code-severity-set',
      // `validate` exits 1 on a file with errors; the fixtures are valid.
      exit_code: 0,
    });
  }
  for (const [view, suffix] of [['chat', 'rendered-chat.txt'], ['summary', 'rendered-summary.md']]) {
    if (existsSync(join(T1_EXPECTED, `${stem}.${suffix}`))) {
      add(`tier-1/${stem}/render-${view}`, '1', 'render', [file, '--format', view], T1_FIXTURES, {
        kind: 'text',
        file: baseline(suffix),
        // The baselines are the full RenderResult envelope despite the .txt /
        // .md extensions; the CLI prints the body. Name the field rather than
        // re-baselining every rendered fixture to make the extension honest.
        baseline_field: 'content',
      });
    }
  }
}

// ── Tier 1 malformed: the validator must REPORT, never throw ────────────────
//
// Compared as a subset of the validation response rather than by exit code: a
// malformed fixture that produced no output at all would pass an exit-code
// check, and "refused to parse" is exactly the failure these fixtures exist to
// rule out.

const T1_MALFORMED = join(CONFORMANCE, 'tier-1-reader', 'malformed');
for (const file of readdirSync(T1_MALFORMED).filter((f) => f.endsWith('.uw.md')).sort()) {
  const stem = basename(file, '.uw.md');
  const expected = join(T1_MALFORMED, `${stem}.expected.json`);
  if (!existsSync(expected)) continue;
  const wanted = JSON.parse(readFileText(expected));
  // Some malformed baselines describe integrity findings rather than validator
  // output; only the ones shaped like a ValidationResult are CLI-checkable.
  if (!Array.isArray(wanted.issues)) continue;
  add(`tier-1-malformed/${stem}`, '1', 'validate', [file, '--json'], T1_MALFORMED, {
    kind: 'json-subset',
    file: rel(expected),
    project: 'issue-code-severity-set',
    exit_code: wanted.overall_status === 'blocked' || hasError(wanted) ? 1 : 0,
  });
}

function hasError(result) {
  return (result.issues ?? []).some((i) => i.severity === 'error');
}

// ── Tier 2: edit ────────────────────────────────────────────────────────────
//
// Only the fixtures whose whole story is "apply this operation, get these
// bytes". `parent-hash-stamp` and `stale-parent-rejected` need `applyEditAsync`
// and a volatile hash, which the CLI's synchronous `edit` cannot express; they
// stay covered by the TypeScript runner and are listed in the runner README as
// a known gap rather than quietly dropped.

const T2 = join(CONFORMANCE, 'tier-2-editor', 'fixtures');
const T2_SKIP = new Set(['parent-hash-stamp', 'stale-parent-rejected']);
for (const scenario of dirs(T2)) {
  if (T2_SKIP.has(scenario) || existsSync(join(T2, scenario, 'options.json'))) continue;
  const dir = join(T2, scenario);
  if (!existsSync(join(dir, 'after.uw.md'))) continue;
  const context = JSON.parse(readFileText(join(dir, 'context.json')));
  const flags = ['--json'];
  for (const [key, flag] of [
    ['actor', '--actor'],
    ['source', '--source'],
    ['confidence', '--confidence'],
    ['agentId', '--agent-id'],
    ['agentVersion', '--agent-version'],
  ]) {
    if (context[key]) flags.push(flag, context[key]);
  }
  add(`tier-2/${scenario}`, '2', 'edit', ['before.uw.md', 'operation.json', ...flags], dir, {
    kind: 'json-field-text',
    field: 'content',
    file: 'after.uw.md',
  });
}

// ── Tier 3: calc ────────────────────────────────────────────────────────────

const T3 = join(CONFORMANCE, 'tier-3-calc-host', 'fixtures');
for (const scenario of dirs(T3)) {
  const dir = join(T3, scenario);
  if (!existsSync(join(dir, 'calc.json')) || !existsSync(join(dir, 'expected-result.json'))) continue;
  const expected = JSON.parse(readFileText(join(dir, 'expected-result.json')));
  add(`tier-3/${scenario}`, '3', 'calc', ['deal.uw.md', 'calc.json', '--json'], dir, {
    kind: 'json-subset',
    file: 'expected-result.json',
    // The CLI exits 1 when any declaration fails to evaluate; the refusal
    // fixtures are supposed to.
    exit_code: expected.ok === false ? 1 : 0,
  });
}

// ── Emit (or, under --check, compare) ───────────────────────────────────────
//
// `--check` exists because these files are generated but committed. A fixture
// added without regenerating them would silently drop out of the v2 driver's
// coverage while every suite still reported green — the exact kind of failure
// that is invisible by construction, so CI has to go looking for it.

const wanted = new Map(
  cases.map((c) => [`${c.id.replaceAll('/', '__')}.case.json`, `${JSON.stringify(c, null, 2)}\n`]),
);

if (process.argv.includes('--check')) {
  const onDisk = existsSync(CASES) ? readdirSync(CASES).filter((f) => f.endsWith('.case.json')) : [];
  const problems = [];
  for (const [name, body] of wanted) {
    if (!onDisk.includes(name)) problems.push(`missing: ${name}`);
    else if (readFileText(join(CASES, name)) !== body) problems.push(`stale: ${name}`);
  }
  for (const name of onDisk) {
    if (!wanted.has(name)) problems.push(`orphaned: ${name}`);
  }
  if (problems.length > 0) {
    console.error('conformance/runner/cases is out of date. Run: npm run gen-conformance-cases');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`[PASS] conformance/runner/cases: ${wanted.size} case files are current.`);
  process.exit(0);
}

rmSync(CASES, { recursive: true, force: true });
mkdirSync(CASES, { recursive: true });
for (const [name, body] of wanted) {
  writeFileSync(join(CASES, name), body, 'utf8');
}

const byTier = {};
for (const c of cases) byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
console.log(
  `conformance/runner/cases: wrote ${cases.length} cases (${Object.entries(byTier)
    .map(([t, n]) => `tier ${t}: ${n}`)
    .join(', ')}).`,
);
