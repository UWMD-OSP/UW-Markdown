import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReleasedTags, checkReleaseState } from './release-state.mjs';
import { releasePackagesForGeneration } from './release-packages.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TAGS_BEFORE = ['v2.13.0', 'v2.14.0'];
const TAGS_AFTER = [...TAGS_BEFORE, 'v2.15.0'];

// ── State 2: release-prepared, the tree the owner tags ──────────────────────
// Final and publication-neutral: every sentence is as true before the workflow
// runs as after it, and nothing claims the publish.
const PREPARED = {
  changelog: `## [Unreleased]

## [2.15.0] - 2026-10-02

### Prepared

Core/CLI **2.15.0** pair with Protocol **2.19.0** and Format **2.0**. Signing
**0.2.19** and batch **0.8.14** repin core.

### Fixed

### Accepted contract — Protocol 2.19.0 (RFC 0066)

## [2.14.0] - 2026-10-02

### Released

The \`v2.14.0\` tag published core/CLI 2.14.0.
`,
  versions: `## Current matrix

Release 2.15.0 pairs core/CLI 2.15.0 with Protocol 2.19.0 and Format 2.0.
Protocol 2.19.0 adds RFC 0066. Excel and report are **not published at their
current versions**; the reference modules have never been published.

| Surface | Version | Pairs with |
|---|---|---|
| \`.uw.md\` format spec | **2.0** | authors \`uw_version: "2.0"\` |
| UW Protocol | **2.19.0** | format ≥ 1.0; RFC 0066 calc variant resolution; carried by core/CLI 2.15.0 |
| \`@uwmd/core\` | **2.15.0** | format 2.0 (reads 1.x), protocol 2.19.0 |
| \`@uwmd/cli\` (CLI) | **2.15.0** | \`@uwmd/core\` 2.15.0 |
| \`@uwmd/excel\` | **0.9.7** (unpublished; stale \`0.3.0\` on the registry, deprecated 2026-10-02) | \`@uwmd/core\` 2.15.x |
| \`@uwmd/batch\` | **0.8.14** | \`@uwmd/core\` 2.15.x, \`.uwx.md\` collections |
| \`@uwmd/lake\` | **0.2.3** (unpublished) | \`@uwmd/core\` 2.15.x |
| \`@uwmd/signing\` | **0.2.19** | \`@uwmd/core\` 2.15.x (0.1.0 published 2026-09-01 pairs core 1.8.x) |

## Historical 1.1+ interchange release plan

| \`@uwmd/core\` | 1.1.0 | candidate |
`,
  protocolDoc:
    '# UW Protocol — v1\n\n**Status:** Accepted release contract (RFC 0066) — protocol **2.19.0**  ·  **License:** MIT\n',
  coreVersion: '2.15.0',
  protocolVersion: '2.19.0',
  cliVersion: '2.15.0',
  cliCoreDependency: '2.15.0',
};

// ── State 3: released and verified, the post-publication reconciliation ─────
const RECONCILED = {
  ...PREPARED,
  changelog: PREPARED.changelog.replace(
    '### Fixed',
    '### Released\n\nThe `v2.15.0` tag published core/CLI 2.15.0 to npm with SLSA provenance.\n\n### Fixed',
  ),
  protocolDoc: PREPARED.protocolDoc.replace('Accepted release contract (RFC 0066)', 'Stable'),
};

// ── The v2.15.0 tag's tree, verbatim excerpts: the shape UPSTREAM-020 found ──
const TAGGED_2_15_0 = {
  changelog: `## [Unreleased]

## [2.15.0] - 2026-10-02

### Prepared

Core/CLI **2.15.0** pair with accepted Protocol **2.19.0** and unchanged
Format **2.0**. The heading is dated for the \`v2.15.0\` tag, which
the owner authorizes separately.

### Fixed

### Conformance

### Accepted contract — Protocol 2.19.0 (RFC 0066, unreleased)

## [2.14.0] - 2026-10-02

### Released
`,
  versions: `## Current matrix

**Accepted, unreleased source contract:** Protocol **2.19.0** adds
RFC 0066. Release-candidate manifests now pair core/CLI
**2.15.0** with Protocol 2.19.0; published core/CLI 2.14.0 implement Protocol
2.18.0. Protocol 2.19.0 and the 2.15.0 candidate have no release tag or package
publication yet.

| Surface | Version | Pairs with |
|---|---|---|
| \`.uw.md\` format spec | **2.0** | authors \`uw_version: "2.0"\`; reads \`"1.0"\` / \`"1.1"\` / \`"2.0"\` (format v2 §1.2) |
| UW Protocol | **2.19.0** (accepted, unreleased) | format ≥ 1.0; RFC 0066 calc variant resolution on 2.18.0 (RFC 0063 boundary opt-in plus RFC 0062 2.17.1 errata); candidate core/CLI 2.15.0; published core/CLI 2.14.0 implement 2.18.0 |
| \`@uwmd/core\` | **2.15.0** (candidate; published 2.14.0) | format 2.0 (reads 1.x), protocol 2.19.0 |
| \`@uwmd/cli\` (CLI) | **2.15.0** (candidate; published 2.14.0) | \`@uwmd/core\` 2.15.0 |
| \`@uwmd/excel\` | **0.9.7** (unpublished; stale \`0.3.0\` on the registry, deprecated 2026-10-02) | \`@uwmd/core\` 2.15.x, format 2.0, explicit contextual calculations |
| \`@uwmd/batch\` | **0.8.14** (candidate; published 0.8.13) | \`@uwmd/core\` 2.15.x, \`.uwx.md\` collections + corpus fact table (first published at 0.8.0, 2026-09-03) |
| \`@uwmd/lake\` | **0.2.3** (unpublished) | \`@uwmd/core\` 2.15.x, RFC 0049 warehouse projection |
| \`@uwmd/signing\` | **0.2.19** (candidate; published 0.2.18) | \`@uwmd/core\` 2.15.x, protocol §V.11 + §XIV capability tokens (0.1.0 published 2026-09-01 pairs core 1.8.x) |
`,
  protocolDoc:
    '# UW Protocol — v1\n\n**Status:** Accepted source contract (RFC 0066; unreleased) — protocol **2.19.0**  ·  **License:** MIT\n',
  coreVersion: '2.15.0',
  protocolVersion: '2.19.0',
  cliVersion: '2.15.0',
  cliCoreDependency: '2.15.0',
};

const section = (changelog, version) => changelog.slice(changelog.indexOf(`## [${version}]`)).split(/\n## \[/)[0];

test('1. a release-prepared generation passes ordinary CI before its tag exists, and claims no release', () => {
  assert.doesNotMatch(section(PREPARED.changelog, '2.15.0'), /^### Released/m);
  const state = checkReleaseState(PREPARED);
  assert.deepEqual(state.failures, []);
  assert.equal(state.applies, true);
  assert.match(state.checks[0], /2\.15\.0 records are final and publication-neutral with protocol 2\.19\.0/);
  // No tag yet, and nothing needs one: only 2.14.0 says Released.
  assert.deepEqual(checkReleasedTags({ changelog: PREPARED.changelog, tags: TAGS_BEFORE }), {
    checks: ['1 released section(s) checked against 2 tag(s)'],
    failures: [],
  });
});

test('2. the same generation passes as its tag', () => {
  assert.deepEqual(checkReleaseState({ ...PREPARED, tag: 'v2.15.0' }).failures, []);
  assert.deepEqual(checkReleasedTags({ changelog: PREPARED.changelog, tags: TAGS_AFTER }).failures, []);
});

test('3. the v2.15.0 tag tree fails tag mode and ordinary CI, and is never asked for `### Released`', () => {
  for (const tag of [undefined, 'v2.15.0']) {
    const failures = checkReleaseState({ ...TAGGED_2_15_0, tag }).failures.join('\n');
    assert.match(failures, /keeps `### Accepted contract — Protocol 2\.19\.0 \(RFC 0066, unreleased\)`/);
    for (const row of ['@uwmd/core 2.15.0', '@uwmd/cli (CLI) 2.15.0', '@uwmd/signing 0.2.19', '@uwmd/batch 0.8.14']) {
      assert.match(failures, new RegExp(`${row.replace(/[.()]/g, '\\$&')} is still annotated "\\(candidate; published`));
    }
    assert.match(failures, /UW Protocol 2\.19\.0 is carried by @uwmd\/core 2\.15\.0 but is still annotated "\(accepted, unreleased\)"/);
    assert.match(failures, /status line calls protocol 2\.19\.0 "Accepted source contract \(RFC 0066; unreleased\)"/);
    assert.match(failures, /Accepted, unreleased source contract/);
    assert.match(failures, /the 2\.15\.0 candidate have no release tag/);
    assert.doesNotMatch(failures, /has no `### Released`|requires `### Released`/);
  }
});

test('4. `### Released` requires a real tag, including for the version being prepared', () => {
  // The reconciliation shape before its tag: no exemption for the core version.
  assert.deepEqual(checkReleasedTags({ changelog: RECONCILED.changelog, tags: TAGS_BEFORE }).failures, [
    'CHANGELOG says 2.15.0 was released, but there is no v2.15.0 tag. `### Released` belongs to the post-publication reconciliation, after the tag exists. Push the tag, or relabel the section `### Not released` and say what superseded it.',
  ]);
  assert.deepEqual(checkReleasedTags({ changelog: RECONCILED.changelog, tags: TAGS_AFTER }).failures, []);
  // An older section is held to the same rule: the 1.4.0 shape.
  assert.match(checkReleasedTags({ changelog: PREPARED.changelog, tags: ['v2.13.0'] }).failures.join('\n'), /2\.14\.0 was released, but there is no v2\.14\.0 tag/);
  // `### Not released` makes the opposite claim and needs no tag.
  const superseded = RECONCILED.changelog.replace('### Released', '### Not released');
  assert.deepEqual(checkReleasedTags({ changelog: superseded, tags: TAGS_BEFORE }).failures, []);
  // A tree being tagged cannot already claim the release it is about to publish.
  assert.deepEqual(checkReleaseState({ ...RECONCILED, tag: 'v2.15.0' }).failures, [
    'CHANGELOG.md: [2.15.0] claims `### Released` in the tree being tagged. Nothing has published yet; the post-publication reconciliation adds it.',
  ]);
  // Once tagged and reconciled, ordinary CI accepts it.
  assert.deepEqual(checkReleaseState(RECONCILED).failures, []);
});

test('5. source protocol may run ahead of the published core between releases, but that tree cannot be tagged', () => {
  // After 2.15.0, RFC 0069 moved the source contract to an unreleased 2.20.0.
  const ahead = {
    ...RECONCILED,
    versions: RECONCILED.versions
      .replace('Release 2.15.0 pairs', '**Accepted, unreleased source contract:** Protocol **2.20.0** adds RFC 0069.\n\nRelease 2.15.0 pairs')
      .replace('| UW Protocol | **2.19.0** |', '| UW Protocol | **2.20.0** (accepted, unreleased) |'),
    protocolDoc: RECONCILED.protocolDoc.replace('Stable — protocol **2.19.0**', 'Accepted source contract (RFC 0069; unreleased) — protocol **2.20.0**'),
    protocolVersion: '2.20.0',
  };
  const state = checkReleaseState(ahead);
  assert.deepEqual(state.failures, []);
  assert.match(state.checks[0], /source protocol 2\.20\.0 is ahead of the paired 2\.19\.0/);
  const tagged = checkReleaseState({ ...ahead, tag: 'v2.15.0' }).failures.join('\n');
  assert.match(tagged, /@uwmd\/core 2\.15\.0 pairs with protocol 2\.19\.0, but a package built from this tree reports PROTOCOL_VERSION 2\.20\.0/);
});

test('a candidate with an undated heading is not checked yet, but cannot be tagged', () => {
  const candidate = {
    ...TAGGED_2_15_0,
    changelog: TAGGED_2_15_0.changelog.replace('## [2.15.0] - 2026-10-02', '## [2.15.0] - release candidate (unpublished)'),
  };
  assert.deepEqual(checkReleaseState(candidate), { applies: false, checks: [], failures: [] });
  const tagged = checkReleaseState({ ...candidate, tag: 'v2.15.0' }).failures.join('\n');
  assert.match(tagged, /must date its heading as `## \[2\.15\.0\] - YYYY-MM-DD`; found `## \[2\.15\.0\] - release candidate \(unpublished\)`/);
  assert.match(tagged, /@uwmd\/core 2\.15\.0 is still annotated/);
});

test('tag mode holds the tag, core and CLI to one exact pairing', () => {
  assert.deepEqual(checkReleaseState({ ...PREPARED, tag: 'v2.16.0' }).failures, [
    'tag v2.16.0 does not name @uwmd/core 2.15.0; the release tag is v2.15.0.',
  ]);
  assert.deepEqual(checkReleaseState({ ...PREPARED, cliVersion: '2.14.0', cliCoreDependency: '^2.15.0', tag: 'v2.15.0' }).failures, [
    '@uwmd/cli is 2.14.0 but @uwmd/core is 2.15.0; core and CLI release in lockstep.',
    '@uwmd/cli depends on @uwmd/core ^2.15.0, not exactly 2.15.0.',
  ]);
  const cliRow = { ...PREPARED, versions: PREPARED.versions.replace('| `@uwmd/core` 2.15.0 |', '| `@uwmd/core` 2.15.x |') };
  assert.deepEqual(checkReleaseState({ ...cliRow, tag: 'v2.15.0' }).failures, [
    'VERSIONS.md: the @uwmd/cli row pairs with "@uwmd/core 2.15.x", not exactly @uwmd/core 2.15.0.',
  ]);
  // A row may not keep naming the previous publication, with or without "candidate".
  const stale = { ...PREPARED, versions: PREPARED.versions.replace('| **0.8.14** |', '| **0.8.14** (published 0.8.13) |') };
  assert.match(checkReleaseState(stale).failures.join('\n'), /@uwmd\/batch 0\.8\.14 is still annotated "\(published 0\.8\.13\)"/);
});

test('6. the historical v2.14.0 and v2.15.0 tags stay where they were, with their known-stale records', (t) => {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  let tags;
  try {
    tags = git('tag', '--list', 'v2.14.0', 'v2.15.0').split('\n').filter(Boolean);
  } catch {
    tags = [];
  }
  if (tags.length < 2) {
    // verify-release itself fails on a checkout without tags, so this skip
    // cannot hide a pass in CI.
    t.skip('this checkout has no v2.14.0/v2.15.0 tags');
    return;
  }
  // Owner decision, 2026-10-02: fix future tags, cut no v2.15.1 and move no tag.
  assert.equal(git('rev-parse', 'v2.14.0^{commit}'), '641554de8001516d20f6ae1247f832faec189b51');
  assert.equal(git('rev-parse', 'v2.15.0^{commit}'), 'aaa9ec3985fe9d7077a418b7d581f42a3d7a45a5');
  for (const [tag, problems] of [['v2.14.0', 13], ['v2.15.0', 11]]) {
    const show = (path) => git('show', `${tag}:${path}`);
    const cli = JSON.parse(show('packages/uwmd-cli/package.json'));
    const failures = checkReleaseState({
      changelog: show('CHANGELOG.md'),
      versions: show('VERSIONS.md'),
      protocolDoc: show('spec/UW_PROTOCOL_v1.md'),
      coreVersion: JSON.parse(show('packages/uwmd-core/package.json')).version,
      protocolVersion: show('packages/uwmd-core/src/protocol.ts').match(/export const PROTOCOL_VERSION = '([^']+)'/)[1],
      cliVersion: cli.version,
      cliCoreDependency: cli.dependencies['@uwmd/core'],
      tag,
    }).failures;
    assert.equal(failures.length, problems, `${tag}: ${failures.join('\n')}`);
  }
});


// Hypothetical fixture versions exercise the boundary; they select no next release.
const NEXT_PREPARED = {
  ...PREPARED,
  changelog: PREPARED.changelog.replaceAll('2.15.0', '2.17.1'),
  versions: PREPARED.versions.replaceAll('2.15.0', '2.17.1').replaceAll('2.15.x', '2.17.x')
    .replace('## Historical 1.1+', '| `@uwmd/module-hospitality` | **0.1.10** | `@uwmd/core` 2.17.1 |\n| `@uwmd/module-data-center` | **0.1.10** | `@uwmd/core` 2.17.1 |\n\n## Historical 1.1+'),
  coreVersion: '2.17.1',
  cliVersion: '2.17.1',
  cliCoreDependency: '2.17.1',
};

test('publication scope expands only after the verified four-package 2.17.0 generation', () => {
  for (const version of ['1.8.0', '2.16.0', '2.17.0', '2.17.0-rc.1']) {
    assert.equal(releasePackagesForGeneration(version).length, 4);
  }
  for (const version of ['2.17.1', '2.17.1-rc.1', '2.18.0', '3.0.0']) {
    assert.deepEqual(releasePackagesForGeneration(version).map((pkg) => pkg.name), [
      '@uwmd/core', '@uwmd/cli', '@uwmd/signing', '@uwmd/batch', '@uwmd/module-hospitality', '@uwmd/module-data-center',
    ]);
  }
  assert.throws(() => releasePackagesForGeneration('not-a-version'), /Invalid release generation/);
});

test('future prepared/tagged generations require both official module rows and exact core pairings', () => {
  for (const tag of [undefined, 'v2.17.1']) {
    assert.deepEqual(checkReleaseState({ ...NEXT_PREPARED, tag }).failures, []);
    for (const name of ['@uwmd/module-hospitality', '@uwmd/module-data-center']) {
      const row = `| \`${name}\` | **0.1.10** | \`@uwmd/core\` 2.17.1 |`;
      const missing = NEXT_PREPARED.versions.replace(row, '');
      assert.match(checkReleaseState({ ...NEXT_PREPARED, versions: missing, tag }).failures.join('\n'), /no "Current matrix" row/);
      for (const annotation of ['(candidate)', '(unpublished)', '(source only)', '(source-only)', '(published 0.1.9)']) {
        const stale = NEXT_PREPARED.versions.replace(row, row.replace('**0.1.10**', `**0.1.10** ${annotation}`));
        assert.match(checkReleaseState({ ...NEXT_PREPARED, versions: stale, tag }).failures.join('\n'), /is still annotated/);
      }
      const wrongPin = NEXT_PREPARED.versions.replace(row, row.replace('2.17.1 |', '2.17.x |'));
      assert.match(checkReleaseState({ ...NEXT_PREPARED, versions: wrongPin, tag }).failures.join('\n'), /not exactly @uwmd\/core 2\.17\.1/);
    }
  }
});

test('actual 2.16.0 and 2.17.0 tag trees remain valid with their four-package source-only module scope', () => {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const tag of ['v2.16.0', 'v2.17.0']) {
    const show = (path) => git('show', `${tag}:${path}`);
    const cli = JSON.parse(show('packages/uwmd-cli/package.json'));
    const state = checkReleaseState({
      changelog: show('CHANGELOG.md'), versions: show('VERSIONS.md'), protocolDoc: show('spec/UW_PROTOCOL_v1.md'),
      coreVersion: JSON.parse(show('packages/uwmd-core/package.json')).version,
      protocolVersion: show('packages/uwmd-core/src/protocol.ts').match(/export const PROTOCOL_VERSION = '([^']+)'/)[1],
      cliVersion: cli.version, cliCoreDependency: cli.dependencies['@uwmd/core'], tag,
    });
    assert.deepEqual(state.failures, [], `${tag}: ${state.failures.join('\n')}`);
    assert.match(show('VERSIONS.md'), /module-hospitality/);
    assert.match(show('VERSIONS.md'), /source only/);
  }
});
