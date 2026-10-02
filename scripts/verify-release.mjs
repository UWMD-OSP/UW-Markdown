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
//      `vX.Y.Z` tag, with no exception. `### Released` is written only by the
//      post-publication reconciliation, after the tag exists, so the version
//      being prepared never needs one. Until UPSTREAM-020 the current core
//      version was exempt, because its block went in before its tag. That
//      exemption is gone, and with it the window in which `main` could claim a
//      release that had no tag.
//   2. The core manifest version has a CHANGELOG section, so a bump cannot ship
//      undocumented.
//   3. Once that section's heading is dated, the generation's records are final
//      and publication-neutral (`release-state.mjs`). v2.14.0 and v2.15.0 were
//      tagged on commits whose VERSIONS.md still called their own packages
//      candidates and their protocol unreleased; that is why this exists.
//
// `--tag vX.Y.Z` checks the tree as that release. The tag must name core/CLI,
// the CLI must pin core exactly, the heading must be dated, the core row must
// pair with PROTOCOL_VERSION, check 3 applies unconditionally, and the version's
// own section must not yet claim `### Released`. release.yml passes the pushed
// tag before it installs or publishes anything; the owner can pass the tag about
// to be pushed.
//
// Deliberately NOT checked: whether the version exists on the npm registry. That
// would need the network, which no other guard here does, and it would fail in
// exactly the offline and fork cases where CI must still work. The tag is the
// trigger, so the tag is the honest local proxy.
//
// Run: npm run verify-release
//      node scripts/verify-release.mjs --tag v2.16.0

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changelogReleaseSections, checkReleasedTags, checkReleaseState } from './release-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

const args = process.argv.slice(2);
const tagIndex = args.findIndex((arg) => arg === '--tag' || arg.startsWith('--tag='));
const tag = tagIndex === -1 ? undefined : args[tagIndex].includes('=') ? args[tagIndex].slice('--tag='.length) : args[tagIndex + 1];
if (tagIndex !== -1 && !tag) {
  console.error('[FAIL] --tag needs a value, e.g. --tag v2.16.0');
  process.exit(1);
}

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const changelog = read('CHANGELOG.md');
const coreVersion = JSON.parse(read('packages/uwmd-core/package.json')).version;
const cli = JSON.parse(read('packages/uwmd-cli/package.json'));

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

// ── 1. Released sections have tags ───────────────────────────────────────────
// The claim being checked is the `### Released` heading specifically. A section
// relabelled `### Not released` is making the opposite claim and is exempt —
// that is the escape hatch for a version that was prepared and superseded.
const sections = changelogReleaseSections(changelog);
if (sections.length === 0) failures.push('CHANGELOG.md has no `## [X.Y.Z]` release sections.');
if (tags.length > 0) {
  const released = checkReleasedTags({ changelog, tags });
  checks.push(...released.checks.map((check) => `[PASS] ${check}`));
  failures.push(...released.failures);
}

// ── 2. The prepared version is documented ────────────────────────────────────
if (!sections.some((s) => s.version === coreVersion)) {
  failures.push(
    `@uwmd/core is at ${coreVersion} but CHANGELOG.md has no \`## [${coreVersion}]\` section.`,
  );
} else {
  checks.push(`[PASS] @uwmd/core ${coreVersion} has a CHANGELOG section`);
}

// ── 3. A dated generation's records are final and publication-neutral ────────
const state = checkReleaseState({
  changelog,
  versions: read('VERSIONS.md'),
  protocolDoc: read('spec/UW_PROTOCOL_v1.md'),
  coreVersion,
  protocolVersion:
    read('packages/uwmd-core/src/protocol.ts').match(/export const PROTOCOL_VERSION = '([^']+)'/)?.[1] ?? null,
  cliVersion: cli.version,
  cliCoreDependency: cli.dependencies?.['@uwmd/core'],
  tag,
});
if (!state.applies) {
  checks.push(`[SKIP] [${coreVersion}] is an undated candidate; its records may say so until the release commit`);
}
checks.push(...state.checks.map((check) => `[PASS] ${check}`));
failures.push(...state.failures);

// ── Report ───────────────────────────────────────────────────────────────────
for (const line of checks) console.log(line);
if (failures.length > 0) {
  console.error('');
  for (const f of failures) console.error(`[FAIL] ${f}`);
  console.error(`\nSummary: ${failures.length} release-record problem(s).`);
  process.exit(1);
}
console.log(
  `\nSummary: every released version in the CHANGELOG has a tag${state.applies ? `, and ${coreVersion}'s records are final and publication-neutral` : ''}.`,
);
