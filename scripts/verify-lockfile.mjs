// Verify that every @uwmd/* reference resolves to this working tree.
//
// The failure this exists to catch is silent. If a lockfile entry for
// @uwmd/core ever carries a registry `resolved` URL instead of a workspace
// link, `npm ci` installs the *published* tarball, and the whole suite — tests,
// conformance, the tools' builds — passes against a version of the library
// nobody in this commit wrote. Green CI would then mean "the last release still
// works," which is not the question CI is being asked.
//
// It also pins the monorepo's exact-version convention: a dependent naming
// `@uwmd/core: "1.2.0"` while the workspace has moved to 1.3.0 is a repin that
// was forgotten. npm resolves it to the local workspace anyway, so nothing
// fails until publish — at which point the dependent demands a version pairing
// that was never tested together.
//
// Run: npm run verify-lockfile

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

/** Every lockfile in the repo, including the tools' own (they are not workspace members). */
const LOCKFILES = [
  'package-lock.json',
  'tools/web-editor/package-lock.json',
  'tools/vscode-uwmd/package-lock.json',
];

/** The workspace packages and the version each one currently declares. */
const WORKSPACES = [
  'packages/uwmd-core',
  'packages/uwmd-cli',
  'packages/uwmd-excel',
  'packages/uwmd-report',
  'packages/uwmd-batch',
  'packages/uwmd-signing',
  'packages/uwmd-module-hospitality',
];

const declaredVersion = new Map();
for (const dir of WORKSPACES) {
  const pkg = readJson(`${dir}/package.json`);
  declaredVersion.set(pkg.name, pkg.version);
}

// ── 1. No @uwmd/* entry may resolve to the public registry ───────────────────

for (const lockfile of LOCKFILES) {
  const lock = readJson(lockfile);
  for (const [entry, meta] of Object.entries(lock.packages ?? {})) {
    if (!entry.includes('node_modules/@uwmd/')) continue;

    if (typeof meta.resolved === 'string' && /^https?:/.test(meta.resolved)) {
      failures.push(
        `${lockfile}: ${entry} resolves to ${meta.resolved} — a published tarball, not this working tree.`,
      );
      continue;
    }
    if (meta.link !== true) {
      failures.push(
        `${lockfile}: ${entry} is not a workspace link (link: ${JSON.stringify(meta.link)}).`,
      );
    }
  }
}

// ── 2. Cross-package pins must name the version the workspace actually has ────

for (const dir of WORKSPACES) {
  const pkg = readJson(`${dir}/package.json`);
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (!declaredVersion.has(name)) continue;
      const actual = declaredVersion.get(name);
      if (range !== actual) {
        failures.push(
          `${dir}/package.json: ${field}.${name} is pinned to "${range}", but ${name} is at ${actual}.`,
        );
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  console.error(`\nSummary: ${failures.length} lockfile/pin problem(s).`);
  process.exit(1);
}

console.log(
  `[PASS] ${LOCKFILES.length} lockfiles: every @uwmd/* reference links to this working tree`,
);
console.log(`[PASS] ${WORKSPACES.length} workspaces: cross-package pins match declared versions`);
