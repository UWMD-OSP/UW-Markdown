// Verify that every version the CHANGELOG says was released actually was.
//
// The 1.4.0 release is why this exists. Every manifest was bumped, `CORE_VERSION`
// was updated, `VERSIONS.md` was brought in line, and the CHANGELOG grew a
// `## [1.4.0]` section with a `### Released` block naming `@uwmd/core` 1.4.0 and
// `@uwmd/cli` 1.4.0. Then the `v1.4.0` tag was never pushed. `release.yml`
// triggers on `v*` only, so the publish job never ran, and npm went from 1.3.0
// straight to 1.5.0 without a 1.4.0 of any package ever existing.
//
// Nothing went red, and nothing could have. `verify-versions` compares
// VERSIONS.md to the manifests; `verify-lockfile` compares pins to declared
// versions. All three agreed — on a version nobody had published. Agreement
// between files is exactly what they check, and the missing artifact was outside
// all of them. `release.yml` does verify the tag against the manifests, but only
// once a tag exists; the failure here was a tag that never came.
//
// The cost was a published CHANGELOG telling readers to install something that
// would 404, and RFC 0025's decimal-exactness fix sitting unshipped for three
// days while the repo believed it had gone out.
//
// Checks:
//
//   1. Every `## [X.Y.Z]` section carrying a `### Released` block has a matching
//      `vX.Y.Z` tag — except the version currently in the core manifest, whose
//      tag is pushed after the release commit merges. That exception is what
//      makes the guard usable during a release rather than permanently red, and
//      it is why a version being prepared must either get its tag or have its
//      section relabelled once the next release supersedes it.
//   2. The core manifest version has a CHANGELOG section, so a bump cannot ship
//      undocumented.
//
// Deliberately NOT checked: whether the version exists on the npm registry. That
// would need the network, which no other guard here does, and it would fail in
// exactly the offline and fork cases where CI must still work. The tag is the
// trigger, so the tag is the honest local proxy.
//
// Run: npm run verify-release

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const changelog = read('CHANGELOG.md');
const coreVersion = JSON.parse(read('packages/uwmd-core/package.json')).version;

// ── Tags ─────────────────────────────────────────────────────────────────────
// A shallow clone has no tags, and a guard that passes because it could not see
// anything is worse than no guard: it reports success over an empty set. Treat
// "no tags at all" as a failure with the fix in the message, since the cause is
// always a checkout that did not fetch them.
let tags = [];
try {
  tags = execFileSync('git', ['tag', '--list', 'v*'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
} catch (e) {
  failures.push(`could not list git tags: ${e.message}`);
}

if (failures.length === 0 && tags.length === 0) {
  failures.push(
    'no v* tags are present. This guard compares released versions against tags, so an '
      + 'empty tag list makes it vacuous. In CI, checkout needs `fetch-tags: true` '
      + '(or `fetch-depth: 0`).',
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────
// Every `## [` heading bounds a section; only the semver ones are releases, so
// `[Unreleased]` bounds its neighbour without being treated as one itself.
const headings = [...changelog.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)];
const sections = headings
  .map((heading, i) => ({
    version: heading[1],
    body: changelog.slice(heading.index, headings[i + 1]?.index ?? changelog.length),
  }))
  .filter((section) => /^\d+\.\d+\.\d+$/.test(section.version));

if (sections.length === 0) failures.push('CHANGELOG.md has no `## [X.Y.Z]` release sections.');

// ── 1. Released sections have tags ───────────────────────────────────────────
// The claim being checked is the `### Released` heading specifically. A section
// relabelled `### Not released` is making the opposite claim and is exempt —
// that is the escape hatch for a version that was prepared and superseded.
let released = 0;
for (const { version, body } of sections) {
  if (!/^### Released$/m.test(body)) continue;
  released += 1;
  if (version === coreVersion) {
    checks.push(`[SKIP] ${version} is the version being released; its tag comes after merge`);
    continue;
  }
  if (!tags.includes(`v${version}`)) {
    failures.push(
      `CHANGELOG says ${version} was released, but there is no v${version} tag. Either push the tag, or relabel the section \`### Not released\` and say what superseded it.`,
    );
  }
}
if (released > 0 && tags.length > 0) {
  checks.push(`[PASS] ${released} released section(s) checked against ${tags.length} tag(s)`);
}

// ── 2. The prepared version is documented ────────────────────────────────────
if (!sections.some((s) => s.version === coreVersion)) {
  failures.push(
    `@uwmd/core is at ${coreVersion} but CHANGELOG.md has no \`## [${coreVersion}]\` section.`,
  );
} else {
  checks.push(`[PASS] @uwmd/core ${coreVersion} has a CHANGELOG section`);
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const line of checks) console.log(line);
if (failures.length > 0) {
  console.error('');
  for (const f of failures) console.error(`[FAIL] ${f}`);
  console.error(`\nSummary: ${failures.length} release-record problem(s).`);
  process.exit(1);
}
console.log('\nSummary: every released version in the CHANGELOG has a tag.');
