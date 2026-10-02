import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReleaseState } from './release-state.mjs';

// Excerpts of the v2.15.0 tag's tree, verbatim: the shape StackUW's re-vendor
// found (UPSTREAM-020). The v2.14.0 tag had the same shape one generation
// earlier.
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

## Historical 1.1+ interchange release plan

| \`@uwmd/core\` | 1.1.0 | candidate |
`,
  protocolDoc:
    '# UW Protocol — v1\n\n**Status:** Accepted source contract (RFC 0066; unreleased) — protocol **2.19.0**  ·  **License:** MIT\n',
  coreVersion: '2.15.0',
  protocolVersion: '2.19.0',
};

/** The same generation as the release commit should have recorded it. */
function released(state = TAGGED_2_15_0) {
  return {
    ...state,
    changelog: state.changelog
      .replace('### Prepared', '### Prepared\n\n### Released\n\nThe `v2.15.0` tag releases core/CLI 2.15.0.')
      .replace('(RFC 0066, unreleased)', '(RFC 0066)'),
    versions: state.versions
      .replace(/\*\*Accepted, unreleased source contract:\*\*[\s\S]*?publication yet\.\n/, 'Release 2.15.0 pairs core/CLI 2.15.0 with Protocol 2.19.0.\n')
      .replaceAll(/ \(candidate; published [^)]+\)/g, '')
      .replace('**2.19.0** (accepted, unreleased)', '**2.19.0**')
      .replace('; candidate core/CLI 2.15.0; published core/CLI 2.14.0 implement 2.18.0', '; released in core/CLI 2.15.0'),
    protocolDoc: state.protocolDoc.replace('Accepted source contract (RFC 0066; unreleased)', 'Stable'),
  };
}

test('the v2.15.0 tag tree fails: its own records call 2.15.0 a candidate and 2.19.0 unreleased', () => {
  const result = checkReleaseState(TAGGED_2_15_0);
  assert.equal(result.applies, true);
  const failures = result.failures.join('\n');
  assert.match(failures, /\[2\.15\.0\] is dated for release but has no `### Released` block/);
  assert.match(failures, /keeps `### Accepted contract — Protocol 2\.19\.0 \(RFC 0066, unreleased\)`/);
  for (const row of ['@uwmd/core 2.15.0', '@uwmd/cli (CLI) 2.15.0', '@uwmd/signing 0.2.19', '@uwmd/batch 0.8.14']) {
    assert.match(failures, new RegExp(`${row.replace(/[.()]/g, '\\$&')} is still annotated "\\(candidate; published`));
  }
  assert.match(failures, /UW Protocol 2\.19\.0 ships with @uwmd\/core 2\.15\.0 but is still annotated "\(accepted, unreleased\)"/);
  assert.match(failures, /status line calls protocol 2\.19\.0 "Accepted source contract \(RFC 0066; unreleased\)"/);
  assert.match(failures, /the 2\.15\.0 candidate have no release tag/);
  // The release workflow sees the same tree and refuses it before publishing.
  assert.ok(checkReleaseState({ ...TAGGED_2_15_0, tag: 'v2.15.0' }).failures.length >= result.failures.length);
});

test('the same generation passes once the release commit records it as released, with or without the tag', () => {
  for (const tag of [undefined, 'v2.15.0']) {
    const result = checkReleaseState({ ...released(), tag });
    assert.deepEqual(result.failures, []);
    assert.equal(result.applies, true);
    assert.match(result.checks[0], /describe 2\.15\.0 as released with protocol 2\.19\.0/);
  }
});

test('unpublished optional packages and the historical plan keep their annotations', () => {
  const result = checkReleaseState(released());
  assert.deepEqual(result.failures, []);
  assert.match(released().versions, /\*\*0\.9\.7\*\* \(unpublished;/);
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

test('source may run ahead of the published packages, but that tree cannot be tagged as them', () => {
  // After 2.15.0, RFC 0069 moved the source contract to an unreleased 2.20.0.
  const ahead = released();
  ahead.versions = ahead.versions.replace('| UW Protocol | **2.19.0** |', '| UW Protocol | **2.20.0** (accepted, unreleased) |');
  ahead.protocolDoc = ahead.protocolDoc.replace('Stable — protocol **2.19.0**', 'Accepted source contract (RFC 0069; unreleased) — protocol **2.20.0**');
  ahead.protocolVersion = '2.20.0';
  const result = checkReleaseState(ahead);
  assert.deepEqual(result.failures, []);
  assert.match(result.checks[0], /source protocol 2\.20\.0 is ahead of the paired 2\.19\.0/);
  assert.deepEqual(checkReleaseState({ ...ahead, tag: 'v2.15.0' }).failures, [
    'VERSIONS.md: @uwmd/core 2.15.0 pairs with protocol 2.19.0, but a package built from this tree reports PROTOCOL_VERSION 2.20.0.',
  ]);
});

test('the tag must name the core version', () => {
  assert.deepEqual(checkReleaseState({ ...released(), tag: 'v2.16.0' }).failures, [
    'tag v2.16.0 does not name @uwmd/core 2.15.0; the release tag is v2.15.0.',
  ]);
});
