// What a release's records may say about it, and when.
//
// StackUW's re-vendor of v2.15.0 found (its UPSTREAM-020) that the v2.14.0 and
// v2.15.0 tags carry trees that still call their own generation a candidate:
//
//   - VERSIONS.md reads "(candidate; published <previous>)" on core/CLI,
//     signing and batch, and "(accepted, unreleased)" on the Protocol;
//   - the protocol status line says "unreleased";
//   - the dated CHANGELOG section keeps an "(…, unreleased)" contract heading.
//
// The owner tags the one-commit release record, and that commit only dated the
// heading. The rest waited for the post-publication reconciliation, a commit
// the tag never contains. Nothing read those words: verify-versions compares
// version numbers and ignores annotations, and release.yml compares the tag
// with the manifests.
//
// A generation passes through three states. Each record belongs to the first
// state in which it is true, and a tag is immutable:
//
//   1. Candidate. `## [X.Y.Z] - release candidate (unpublished)`, matrix rows
//      "(candidate; published <previous>)", and the protocol it carries
//      "(accepted, unreleased)". Nothing here checks a candidate.
//   2. Release-prepared: the release commit the owner tags. Its records are
//      final and publication-neutral, true before and after the release
//      workflow runs:
//      - the CHANGELOG heading is dated;
//      - nothing describing the generation says candidate, unreleased,
//        unpublished or "published <previous>";
//      - the protocol it carries is stated without "unreleased", for example
//        "Accepted release contract".
//      It claims no publication: no `### Released`, and the RFC stays
//      `accepted`.
//   3. Released and verified: the post-publication reconciliation, after the
//      tag exists and the workflow has published. It adds `### Released`, the
//      publication statements, the run, registry, provenance and Rekor
//      evidence, and the RFC's move to `implemented`.
//
// `checkReleaseState` enforces state 2's records once the heading is dated,
// since states 2 and 3 share them. Source may move ahead of the published
// packages between releases: after 2.15.0, RFC 0069 took the source contract
// to an unreleased Protocol 2.20.0 while core 2.15.0 still pairs with 2.19.0.
// The protocol rules therefore apply only while the core row pairs with the
// matrix Protocol.
//
// With `tag` (release.yml passes the pushed tag; the owner can pass the tag
// about to be pushed), the tree is checked as that release:
//   - the tag names core/CLI;
//   - the CLI pins core exactly;
//   - the core row pairs with PROTOCOL_VERSION, the protocol a package built
//     from this tree reports;
//   - the heading is dated;
//   - the generation's own section carries no `### Released`, because nothing
//     has published yet;
//   - `## [Unreleased]` holds no entries. The release-prepared commit moves
//     every entry into the dated section, so a tree with unreleased entries is
//     a later commit. After 2.18.0 was prepared at 4e0a8c1, RFCs 0075–0077
//     merged to main under `[Unreleased]`, and the tag-mode check passed
//     main as v2.18.0: tagging the wrong commit would have published them
//     under a version whose records omit them, and an npm version cannot be
//     republished. Every v2.* tag through v2.17.0 has an empty `[Unreleased]`.
//
// `checkReleasedTags` enforces state 3's precondition: every section with
// `### Released` has its tag, with no exception. The 1.4.0 release is the
// precedent. Its CHANGELOG said Released, its tag was never pushed, and no 1.4.0
// of any package exists.

import { OFFICIAL_MODULE_PACKAGES, releasePackagesForGeneration } from './release-packages.mjs';
/** Wording that describes a generation as not yet final. */
const NOT_FINAL = /\b(candidate|unreleased|unpublished)\b/i;
/** A row annotation that names a publication, e.g. the stale "published 2.14.0". */
const NAMES_PUBLICATION = /\bpublished\s+v?\d+\.\d+\.\d+\b/i;
const RELEASED = /^### Released\s*$/m;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Strip markdown decoration so `**2.15.0**` and `` `@uwmd/core` `` compare cleanly. */
const plain = (cell) => cell.replaceAll('*', '').replaceAll('`', '').trim();
const isTableLine = (line) => line.trimStart().startsWith('|');

/** Every `## [X.Y.Z]` section of the changelog, heading included. */
export function changelogReleaseSections(changelog) {
  const headings = [...changelog.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)];
  return headings
    .map((heading, i) => ({
      version: heading[1],
      heading: heading[0],
      body: changelog.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? changelog.length),
    }))
    .filter((section) => /^\d+\.\d+\.\d+$/.test(section.version));
}

/**
 * The substantive lines under every `## [Unreleased]` heading, trimmed.
 *
 * A section runs to the next level-1 or level-2 heading. HTML comments, blank
 * lines, headings (`### Added` with nothing under it is a template, not an
 * entry), thematic breaks and link reference definitions are not entries. Any
 * other line is, including prose and code: this fails closed.
 *
 * @param {string} changelog
 * @returns {string[]}
 */
export function changelogUnreleasedEntries(changelog) {
  const text = changelog.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const headings = [...text.matchAll(/^#{1,2}[ \t][^\n]*$/gm)];
  const entries = [];
  headings.forEach((heading, i) => {
    if (!/^##[ \t]+(?:\[unreleased\]|unreleased)(?![\w-])/i.test(heading[0])) return;
    const body = text
      .slice(heading.index + heading[0].length, headings[i + 1]?.index ?? text.length)
      .replace(/<!--[\s\S]*?-->/g, ''); // an unterminated comment stays, and counts
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (line === '') continue;
      if (/^#{1,6}(?:[ \t]|$)/.test(line)) continue; // an empty subsection heading
      if (/^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line)) continue; // thematic break
      if (/^\[[^\]]+\]:[ \t]*\S+/.test(line)) continue; // link reference definition
      entries.push(line);
    }
  });
  return entries;
}

/** The "## Current matrix" section of VERSIONS.md and its table rows. */
function currentMatrix(versions) {
  const start = versions.indexOf('## Current matrix');
  if (start === -1) return null;
  const end = versions.indexOf('\n## ', start + 1);
  const text = versions.slice(start, end === -1 ? undefined : end);
  const rows = [];
  for (const line of text.split('\n')) {
    if (!isTableLine(line)) continue;
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
 * Every CHANGELOG section with a `### Released` block has its `vX.Y.Z` tag.
 *
 * @param {{ changelog: string, tags: string[] }} input
 * @returns {{ checks: string[], failures: string[] }}
 */
export function checkReleasedTags({ changelog, tags }) {
  const checks = [];
  const failures = [];
  let released = 0;
  for (const { version, body } of changelogReleaseSections(changelog)) {
    if (!RELEASED.test(body)) continue;
    released += 1;
    if (!tags.includes(`v${version}`)) {
      failures.push(
        `CHANGELOG says ${version} was released, but there is no v${version} tag. \`### Released\` belongs to the post-publication reconciliation, after the tag exists. Push the tag, or relabel the section \`### Not released\` and say what superseded it.`,
      );
    }
  }
  if (released > 0) checks.push(`${released} released section(s) checked against ${tags.length} tag(s)`);
  return { checks, failures };
}

/**
 * Check that a dated generation's records are final and publication-neutral.
 * Returns `applies: false` for an undated candidate when no tag is given.
 *
 * @param {object} input
 * @param {string} input.changelog     CHANGELOG.md
 * @param {string} input.versions      VERSIONS.md
 * @param {string} input.protocolDoc   spec/UW_PROTOCOL_v1.md
 * @param {string} input.coreVersion   packages/uwmd-core/package.json version
 * @param {string|null} input.protocolVersion   PROTOCOL_VERSION in protocol.ts
 * @param {string} [input.cliVersion]           packages/uwmd-cli/package.json version
 * @param {string} [input.cliCoreDependency]    the CLI's `@uwmd/core` dependency
 * @param {string} [input.tag]         the release tag, e.g. `v2.16.0`
 * @returns {{ applies: boolean, checks: string[], failures: string[] }}
 */
export function checkReleaseState({
  changelog,
  versions,
  protocolDoc,
  coreVersion,
  protocolVersion,
  cliVersion,
  cliCoreDependency,
  tag,
}) {
  const checks = [];
  const failures = [];
  const tagged = tag !== undefined;
  const publishedRows = releasePackagesForGeneration(coreVersion).map((pkg) => pkg.row);
  const section = changelogReleaseSections(changelog).find((s) => s.version === coreVersion) ?? null;
  const dated = section !== null && /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}\s*$/.test(section.heading);

  // ── Tag mode: the tag, the CLI pairing and the date ────────────────────────
  if (tagged) {
    if (tag !== `v${coreVersion}`) {
      failures.push(`tag ${tag} does not name @uwmd/core ${coreVersion}; the release tag is v${coreVersion}.`);
    }
    if (cliVersion !== coreVersion) {
      failures.push(`@uwmd/cli is ${cliVersion} but @uwmd/core is ${coreVersion}; core and CLI release in lockstep.`);
    }
    if (cliCoreDependency !== coreVersion) {
      failures.push(`@uwmd/cli depends on @uwmd/core ${cliCoreDependency}, not exactly ${coreVersion}.`);
    }
    if (!dated) {
      failures.push(
        `CHANGELOG.md: the release commit for ${tag} must date its heading as \`## [${coreVersion}] - YYYY-MM-DD\`; found ${
          section ? `\`${section.heading}\`` : 'no section'
        }.`,
      );
    }
    const unreleased = changelogUnreleasedEntries(changelog);
    if (unreleased.length > 0) {
      failures.push(
        `CHANGELOG.md: [Unreleased] holds ${unreleased.length} line(s) in the tree being tagged ${tag}, starting "${unreleased[0].slice(0, 80)}". The release-prepared commit has an empty [Unreleased]; this tree is a later commit. Tag the preparation commit, or move the entries into [${coreVersion}] in a new preparation.`,
      );
    }
  }
  if (!dated && !tagged) return { applies: false, checks, failures };
  if (section === null) return { applies: true, checks, failures };

  // ── The CHANGELOG section ─────────────────────────────────────────────────
  for (const [heading] of section.body.matchAll(/^### [^\n]*$/gm)) {
    if (NOT_FINAL.test(heading)) {
      failures.push(`CHANGELOG.md: [${coreVersion}] is dated but keeps \`${heading.trim()}\`.`);
    }
  }
  if (tagged && RELEASED.test(section.body)) {
    failures.push(
      `CHANGELOG.md: [${coreVersion}] claims \`### Released\` in the tree being tagged. Nothing has published yet; the post-publication reconciliation adds it.`,
    );
  }

  // ── The matrix rows of the generation ─────────────────────────────────────
  const matrix = currentMatrix(versions);
  if (matrix === null) {
    failures.push('VERSIONS.md: no "## Current matrix" section.');
    return { applies: true, checks, failures };
  }
  const row = (label) => matrix.rows.find((r) => r.label === label);
  for (const label of publishedRows) {
    const found = row(label);
    if (!found) {
      failures.push(`VERSIONS.md: no "Current matrix" row for ${label}.`);
    } else if (NOT_FINAL.test(found.annotation) || /\bsource[ -]only\b/i.test(found.annotation) || NAMES_PUBLICATION.test(found.annotation)) {
      failures.push(
        `VERSIONS.md: ${label} ${found.version} is still annotated "${found.annotation}"; the ${coreVersion} generation's row states its version only.`,
      );
    }
  }

  for (const { row: label } of OFFICIAL_MODULE_PACKAGES) {
    if (!publishedRows.includes(label)) continue;
    const moduleRow = row(label);
    if (moduleRow && !new RegExp(`@uwmd/core\\s+${escapeRegExp(coreVersion)}(?![\\d.])`).test(moduleRow.pairsWith)) {
      failures.push(`VERSIONS.md: ${label} pairs with "${moduleRow.pairsWith}", not exactly @uwmd/core ${coreVersion}.`);
    }
  }

  // ── The protocol the generation carries ───────────────────────────────────
  const paired = row('@uwmd/core')?.pairsWith.match(/\bprotocol\s+(\d+\.\d+\.\d+)\b/)?.[1] ?? null;
  const protocolRow = row('UW Protocol');
  if (paired === null) {
    failures.push('VERSIONS.md: the @uwmd/core row names no "protocol X.Y.Z" pairing.');
  } else if (tagged && paired !== protocolVersion) {
    failures.push(
      `VERSIONS.md: @uwmd/core ${coreVersion} pairs with protocol ${paired}, but a package built from this tree reports PROTOCOL_VERSION ${protocolVersion}.`,
    );
  }
  if (tagged) {
    const cliPair = row('@uwmd/cli (CLI)')?.pairsWith ?? '';
    if (!new RegExp(`@uwmd/core\\s+${escapeRegExp(coreVersion)}(?![\\d.])`).test(cliPair)) {
      failures.push(`VERSIONS.md: the @uwmd/cli row pairs with "${cliPair}", not exactly @uwmd/core ${coreVersion}.`);
    }
  }
  // The generation carries the matrix Protocol when the core row pairs with it,
  // and always when tagged (the pairing check above holds it to PROTOCOL_VERSION).
  const carriesProtocol = tagged || (paired !== null && protocolRow !== undefined && paired === protocolRow.version);
  if (carriesProtocol && protocolRow) {
    if (NOT_FINAL.test(protocolRow.annotation)) {
      failures.push(
        `VERSIONS.md: UW Protocol ${protocolRow.version} is carried by @uwmd/core ${coreVersion} but is still annotated "${protocolRow.annotation}".`,
      );
    }
    const status = protocolDoc.match(/^\*\*Status:\*\* ([^\r\n]*?) — protocol \*\*([^*]+)\*\*/m);
    if (!status) {
      failures.push('spec/UW_PROTOCOL_v1.md: could not read the status line.');
    } else if (NOT_FINAL.test(status[1])) {
      failures.push(
        `spec/UW_PROTOCOL_v1.md: the status line calls protocol ${status[2]} "${status[1]}", but @uwmd/core ${coreVersion} carries it.`,
      );
    }
  }

  // ── The matrix prose ──────────────────────────────────────────────────────
  for (const line of matrix.text.split('\n')) {
    const label = isTableLine(line) ? plain(line.split('|')[1] ?? '') : null;
    if (publishedRows.includes(label)) continue; // reported per row above
    const stale = /\bcandidate\b/i.test(line)
      || (carriesProtocol && label === null && /\bunreleased\b|\bno release tag\b/i.test(line));
    if (stale) {
      failures.push(
        `VERSIONS.md: the current matrix still describes ${coreVersion} as unfinished: "${line.trim().slice(0, 120)}".`,
      );
    }
  }

  if (failures.length === 0) {
    const protocol = carriesProtocol
      ? ` with protocol ${paired}`
      : `; source protocol ${protocolRow?.version} is ahead of the paired ${paired}`;
    checks.push(`${tag ?? `@uwmd/core ${coreVersion}`}: the ${coreVersion} records are final and publication-neutral${protocol}`);
  }
  return { applies: true, checks, failures };
}
