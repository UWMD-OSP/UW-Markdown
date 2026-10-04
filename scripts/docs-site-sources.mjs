// Build-time sources shared by the docs site and its index verifier.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { releasePackagesForGeneration } from './release-packages.mjs';
import { changelogReleaseSections } from './release-state.mjs';

export function rfcCopies(repoRoot) {
  return readdirSync(join(repoRoot, 'docs/rfcs'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const isIndex = name === 'README.md';
      const isTemplate = name === '0000-template.md' || name === 'template.md';
      return {
        from: `docs/rfcs/${name}`,
        to: `about/rfcs/${isIndex ? 'index.md' : isTemplate ? 'template.md' : name}`,
        ...(isIndex ? { title: 'RFC Process' }
          : isTemplate ? { title: 'RFC Template' } : {}),
      };
    });
}

export function docsVersions(repoRoot) {
  const protocol = readFileSync(join(repoRoot, 'packages/uwmd-core/src/protocol.ts'), 'utf8');
  const constant = (name) => {
    const value = new RegExp(`export const ${name} = '([^']+)'`).exec(protocol)?.[1];
    if (!value) throw new TypeError(`Cannot read ${name} for the docs site`);
    return value;
  };
  const core = JSON.parse(readFileSync(join(repoRoot, 'packages/uwmd-core/package.json'), 'utf8')).version;
  return { format: constant('FORMAT_VERSION'), protocol: constant('PROTOCOL_VERSION'), core };
}

// Packages actually on npm, for the home release card and Downloads page.
//
// The core manifest version is not publication truth: a release-prepared tree
// already carries the next version before anything is published, and that
// generation's release scope may be wider (2.17.1+ adds the official modules).
// A CHANGELOG section gains `### Released` only in the post-publication
// reconciliation (release-state.mjs, state 3), so the newest such section is the
// published generation, and its release scope is what is on npm.
export function docsPublishedGeneration(repoRoot) {
  const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8');
  const released = changelogReleaseSections(changelog).find((section) => /^### Released\s*$/m.test(section.body));
  if (!released) throw new TypeError('Cannot find a released generation in CHANGELOG.md for the docs site');
  return released.version;
}

export function docsNpmPackages(repoRoot) {
  return releasePackagesForGeneration(docsPublishedGeneration(repoRoot)).map((pkg) => pkg.name);
}

// Everything the home version card and Downloads page show, written by prebuild
// to about/versions.json. `format`, `protocol` and `core` are source-tree values;
// `published` and `npm` are publication state. `unpublishedSource` is true while
// a release-prepared core version has not been published, so the UI can say so
// instead of placing that version beside the npm list.
export function docsSiteVersions(repoRoot) {
  const source = docsVersions(repoRoot);
  const published = docsPublishedGeneration(repoRoot);
  return {
    ...source,
    published,
    npm: releasePackagesForGeneration(published).map((pkg) => pkg.name),
    unpublishedSource: source.core !== published,
  };
}
