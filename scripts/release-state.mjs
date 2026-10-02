// The commit a release tag lands on must already describe that release as
// released.
//
// StackUW's re-vendor of v2.15.0 found that it did not (its UPSTREAM-020). At
// both v2.14.0 and v2.15.0, the tagged tree's own VERSIONS.md still read
// Protocol "(accepted, unreleased)" and core/CLI, signing and batch
// "(candidate; published <previous>)". The protocol status line said
// "unreleased", and the CHANGELOG section carried an "(…, unreleased)" contract
// heading and no `### Released`. The owner tags the one-commit release record,
// and that commit only dated the CHANGELOG heading. Every "released" flip waited
// for the post-publication reconciliation, a later commit the tag never sees.
//
// Nothing went red, because nothing read those words: verify-versions compares
// the version numbers in the matrix and ignores annotations, verify-release
// compares `### Released` sections to tags, and release.yml compares the tag to
// the manifests.
//
// The rule: once the current core version's CHANGELOG heading carries a date —
// which is what the release commit does — the version records must say
// released:
//
//   1. that CHANGELOG section has a `### Released` block and no `###` heading
//      calling anything in it unreleased, a candidate or unpublished;
//   2. the VERSIONS.md "Current matrix" rows for the four packages release.yml
//      publishes carry no candidate/unreleased/unpublished annotation, and the
//      section says "candidate" nowhere;
//   3. when the core row pairs with the matrix's Protocol version, that row
//      and the protocol document's status line do not call it unreleased.
//
// Rule 3 is conditional because source may legitimately move ahead of the
// published packages. After 2.15.0, RFC 0069 took the source contract to an
// unreleased Protocol 2.20.0 while core 2.15.0 still pairs with 2.19.0.
//
// With `tag` (release.yml passes the pushed tag; the owner can pass the tag
// about to be pushed), the check applies whether or not the heading is dated.
// The tag must name the core version, the heading must be dated, and the core
// row must pair with PROTOCOL_VERSION, because a package built from this tree
// reports exactly that protocol.
//
// What stays out, because only publication can establish it: the release run,
// registry dist-tags and gitHead, signatures and tarball integrity, SLSA
// provenance and Rekor indexes, and RFC status `implemented`, which the owner's
// process records only once the published packages are verified. The
// post-publication reconciliation adds those; it no longer flips rows.

const PUBLISHED_ROWS = ['@uwmd/core', '@uwmd/cli (CLI)', '@uwmd/signing', '@uwmd/batch'];
const NOT_RELEASED = /\b(candidate|unreleased|unpublished)\b/i;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Strip markdown decoration so `**2.15.0**` and `` `@uwmd/core` `` compare cleanly. */
const plain = (cell) => cell.replaceAll('*', '').replaceAll('`', '').trim();

/** The `## [version]` section of the changelog, heading included, or null. */
function changelogSection(changelog, version) {
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\][^\\n]*$`, 'm').exec(changelog);
  if (!heading) return null;
  const rest = changelog.slice(heading.index + heading[0].length);
  const next = rest.search(/^## \[/m);
  return {
    heading: heading[0],
    body: next === -1 ? rest : rest.slice(0, next),
  };
}

/** The "## Current matrix" section of VERSIONS.md and its table rows. */
function currentMatrix(versions) {
  const start = versions.indexOf('## Current matrix');
  if (start === -1) return null;
  const end = versions.indexOf('\n## ', start + 1);
  const text = versions.slice(start, end === -1 ? undefined : end);
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line.split('|');
    if (cells.length < 4) continue;
    const label = plain(cells[1]);
    if (label === 'Surface' || /^-+$/.test(label)) continue;
    const [version = '', ...annotation] = plain(cells[2]).split(/\s+/);
    rows.push({ label, version, annotation: annotation.join(' '), pairsWith: plain(cells[3] ?? '') });
  }
  return { text, rows };
}

/**
 * Check that the release records describe the current core version as
 * released. Returns `applies: false` when nothing claims a release yet.
 *
 * @param {object} input
 * @param {string} input.changelog     CHANGELOG.md
 * @param {string} input.versions      VERSIONS.md
 * @param {string} input.protocolDoc   spec/UW_PROTOCOL_v1.md
 * @param {string} input.coreVersion   packages/uwmd-core/package.json version
 * @param {string|null} input.protocolVersion  PROTOCOL_VERSION in protocol.ts
 * @param {string} [input.tag]         the release tag, e.g. `v2.16.0`
 * @returns {{ applies: boolean, checks: string[], failures: string[] }}
 */
export function checkReleaseState({ changelog, versions, protocolDoc, coreVersion, protocolVersion, tag }) {
  const checks = [];
  const failures = [];
  const section = changelogSection(changelog, coreVersion);
  const dated = section !== null && /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}\s*$/.test(section.heading);

  if (tag !== undefined) {
    if (tag !== `v${coreVersion}`) {
      failures.push(`tag ${tag} does not name @uwmd/core ${coreVersion}; the release tag is v${coreVersion}.`);
    }
    if (!dated) {
      failures.push(
        `CHANGELOG.md: the release commit for ${tag} must date its heading as \`## [${coreVersion}] - YYYY-MM-DD\`; found ${
          section ? `\`${section.heading}\`` : 'no section'
        }.`,
      );
    }
  }
  if (!dated && tag === undefined) return { applies: false, checks, failures };
  if (section === null) return { applies: true, checks, failures };

  // ── 1. The changelog section says released ────────────────────────────────
  if (!/^### Released\s*$/m.test(section.body)) {
    failures.push(
      `CHANGELOG.md: [${coreVersion}] is dated for release but has no \`### Released\` block. The commit the tag lands on states the release; the post-publication reconciliation only adds its evidence.`,
    );
  }
  for (const [heading] of section.body.matchAll(/^### [^\n]*$/gm)) {
    if (NOT_RELEASED.test(heading)) {
      failures.push(`CHANGELOG.md: [${coreVersion}] is dated for release but keeps \`${heading.trim()}\`.`);
    }
  }

  // ── 2. The matrix rows say released ───────────────────────────────────────
  const matrix = currentMatrix(versions);
  if (matrix === null) {
    failures.push('VERSIONS.md: no "## Current matrix" section.');
    return { applies: true, checks, failures };
  }
  const row = (label) => matrix.rows.find((r) => r.label === label);
  for (const label of PUBLISHED_ROWS) {
    const found = row(label);
    if (!found) {
      failures.push(`VERSIONS.md: no "Current matrix" row for ${label}.`);
    } else if (NOT_RELEASED.test(found.annotation)) {
      failures.push(
        `VERSIONS.md: ${label} ${found.version} is still annotated "${found.annotation}" in the release of ${coreVersion}.`,
      );
    }
  }
  for (const line of matrix.text.split('\n')) {
    const label = line.trimStart().startsWith('|') ? plain(line.split('|')[1] ?? '') : null;
    if (PUBLISHED_ROWS.includes(label)) continue; // reported per row above
    if (/\bcandidate\b/i.test(line)) {
      failures.push(
        `VERSIONS.md: the current matrix still describes a candidate in the release of ${coreVersion}: "${line.trim().slice(0, 120)}".`,
      );
    }
  }

  // ── 3. The paired protocol says released ──────────────────────────────────
  const paired = row('@uwmd/core')?.pairsWith.match(/\bprotocol\s+(\d+\.\d+\.\d+)\b/)?.[1] ?? null;
  const protocolRow = row('UW Protocol');
  if (paired === null) {
    failures.push('VERSIONS.md: the @uwmd/core row names no "protocol X.Y.Z" pairing.');
  } else if (tag !== undefined && paired !== protocolVersion) {
    failures.push(
      `VERSIONS.md: @uwmd/core ${coreVersion} pairs with protocol ${paired}, but a package built from this tree reports PROTOCOL_VERSION ${protocolVersion}.`,
    );
  }
  if (paired !== null && protocolRow && paired === protocolRow.version) {
    if (NOT_RELEASED.test(protocolRow.annotation)) {
      failures.push(
        `VERSIONS.md: UW Protocol ${protocolRow.version} ships with @uwmd/core ${coreVersion} but is still annotated "${protocolRow.annotation}".`,
      );
    }
    const status = protocolDoc.match(/^\*\*Status:\*\* ([^\r\n]*?) — protocol \*\*([^*]+)\*\*/m);
    if (!status) {
      failures.push('spec/UW_PROTOCOL_v1.md: could not read the status line.');
    } else if (NOT_RELEASED.test(status[1])) {
      failures.push(
        `spec/UW_PROTOCOL_v1.md: the status line calls protocol ${status[2]} "${status[1]}", but it ships with @uwmd/core ${coreVersion}.`,
      );
    }
  }

  if (failures.length === 0) {
    const protocol = paired === protocolRow?.version
      ? ` with protocol ${paired}`
      : `; source protocol ${protocolRow?.version} is ahead of the paired ${paired}`;
    checks.push(`${tag ?? `@uwmd/core ${coreVersion}`}: the release records describe ${coreVersion} as released${protocol}`);
  }
  return { applies: true, checks, failures };
}
