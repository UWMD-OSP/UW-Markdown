// Verify that the VERSIONS.md compatibility matrix matches what the repo ships.
//
// VERSIONS.md calls itself "the authoritative compatibility matrix", and it is
// the file an adopter reads to decide which `@uwmd/*` versions pair with which
// spec. Nothing enforced that claim, so it drifted twice without anything going
// red: the 1.4.0 release bumped every package manifest and left the matrix
// advertising 1.3.0, and `tools/vscode-uwmd` sat at 0.1.0 in the matrix while
// the extension had moved to 0.2.0.
//
// That failure is silent by construction. The matrix is prose, so no build
// reads it, no test imported it, and a wrong row looks exactly like a right one
// until somebody installs the pairing it names and finds it does not exist.
//
// Checks, all against the "Current matrix" section only — the "Planned" tables
// below it deliberately name versions that have not shipped:
//
//   1. Each package/tool row equals that manifest's `version`.
//   2. The `UW Protocol` row equals `PROTOCOL_VERSION` in protocol.ts.
//   3. The `.uw.md format spec` row equals `FORMAT_VERSION` in protocol.ts.
//   4. Every "pairs with @uwmd/core X" note names the core version in the
//      matrix — the column that went stale at 1.3.x across four rows.
//
// `CORE_VERSION` vs the core manifest is already covered by version.test.ts and
// is deliberately not repeated here.
//
// Run: npm run verify-versions

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

// ── Isolate the "Current matrix" section ─────────────────────────────────────
// The "Planned 1.1+ interchange train" table below it lists candidate versions
// that are meant to differ from what ships, so matching rows document-wide
// would produce failures that are not failures.

const versionsDoc = read('VERSIONS.md');
const start = versionsDoc.indexOf('## Current matrix');
if (start === -1) {
  console.error(
    '[FAIL] VERSIONS.md: no "## Current matrix" heading — the matrix moved or was renamed.',
  );
  process.exit(1);
}
const end = versionsDoc.indexOf('\n## ', start + 1);
const matrix = versionsDoc.slice(start, end === -1 ? undefined : end);

// ── Parse the matrix into rows ───────────────────────────────────────────────
// Cell-wise rather than by regex over labels: the labels contain backticks,
// slashes, and parentheses, and building patterns out of them is how this kind
// of check ends up matching the wrong row.

/** Strip markdown decoration so `**1.4.0**` and `` `@uwmd/core` `` compare cleanly. */
const plain = (cell) => cell.replaceAll('*', '').replaceAll('`', '').trim();

const rows = [];
for (const line of matrix.split('\n')) {
  if (!line.trimStart().startsWith('|')) continue;
  const cells = line.split('|');
  if (cells.length < 4) continue;
  const label = plain(cells[1]);
  if (label === 'Surface' || /^-+$/.test(label)) continue; // header and rule
  rows.push({ label, version: plain(cells[2]), pairsWith: cells[3] ?? '' });
}

if (rows.length === 0) {
  console.error('[FAIL] VERSIONS.md: the "Current matrix" table parsed to zero rows.');
  process.exit(1);
}

/** The version cell for a row, or null when the row is absent. */
function statedVersion(label) {
  const row = rows.find((r) => r.label === label);
  if (!row) return null;
  // Rows may annotate the cell, e.g. "0.5.0 (private)".
  return row.version.split(/\s+/)[0];
}

// ── 1. Package and tool rows match their manifests ───────────────────────────

const MANIFEST_ROWS = [
  { label: '@uwmd/core', manifest: 'packages/uwmd-core/package.json' },
  { label: '@uwmd/cli (CLI)', manifest: 'packages/uwmd-cli/package.json' },
  { label: '@uwmd/excel', manifest: 'packages/uwmd-excel/package.json' },
  { label: '@uwmd/report', manifest: 'packages/uwmd-report/package.json' },
  { label: '@uwmd/batch', manifest: 'packages/uwmd-batch/package.json' },
  { label: '@uwmd/signing', manifest: 'packages/uwmd-signing/package.json' },
  { label: 'tools/web-editor', manifest: 'tools/web-editor/package.json' },
  { label: 'tools/vscode-uwmd', manifest: 'tools/vscode-uwmd/package.json' },
];

for (const { label, manifest } of MANIFEST_ROWS) {
  const stated = statedVersion(label);
  const actual = readJson(manifest).version;
  if (stated === null) {
    failures.push(`VERSIONS.md: no "Current matrix" row found for ${label}.`);
    continue;
  }
  if (stated !== actual) {
    failures.push(
      `VERSIONS.md: ${label} is listed as ${stated}, but ${manifest} declares ${actual}.`,
    );
    continue;
  }
  checks.push(`${label} ${actual}`);
}

// ── 2 & 3. Spec rows match the constants the library actually emits ──────────

const protocolSrc = read('packages/uwmd-core/src/protocol.ts');

/** Read `export const NAME = '...'` out of protocol.ts. */
function constant(name) {
  const match = protocolSrc.match(new RegExp(`export const ${name} = '([^']+)'`));
  return match ? match[1] : null;
}

const SPEC_ROWS = [
  { label: 'UW Protocol', name: 'PROTOCOL_VERSION' },
  { label: '.uw.md format spec', name: 'FORMAT_VERSION' },
];

for (const { label, name } of SPEC_ROWS) {
  const stated = statedVersion(label);
  const actual = constant(name);
  if (actual === null) {
    failures.push(`protocol.ts: could not read ${name} — the constant moved or changed shape.`);
    continue;
  }
  if (stated === null) {
    failures.push(`VERSIONS.md: no "Current matrix" row found for ${label}.`);
    continue;
  }
  if (stated !== actual) {
    failures.push(`VERSIONS.md: ${label} is listed as ${stated}, but ${name} is ${actual}.`);
    continue;
  }
  checks.push(`${label} ${actual}`);
}

// ── 4. "Pairs with @uwmd/core X" notes name the core version in the matrix ───
// Written as 1.4.0 on an exact pin and 1.4.x on a minor-series one; both must
// agree with core's major.minor, which is the part that went stale.

const coreVersion = readJson('packages/uwmd-core/package.json').version;
const coreSeries = coreVersion.split('.').slice(0, 2).join('.');
const PAIRS_WITH_CORE = /@uwmd\/core`?\s+(\d+\.\d+)/g;
let pairChecks = 0;

for (const row of rows) {
  for (const [, named] of row.pairsWith.matchAll(PAIRS_WITH_CORE)) {
    pairChecks += 1;
    if (named !== coreSeries) {
      failures.push(
        `VERSIONS.md: row "${row.label}" pairs with @uwmd/core ${named}.x, but core is at ${coreVersion}.`,
      );
    }
  }
}
if (pairChecks > 0) {
  checks.push(`${pairChecks} "pairs with @uwmd/core" notes at ${coreSeries}.x`);
}

// ── Report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  console.error(`\nSummary: ${failures.length} version-matrix mismatch(es).`);
  process.exit(1);
}

for (const check of checks) console.log(`[PASS] ${check}`);
console.log(
  `\nSummary: VERSIONS.md agrees with ${MANIFEST_ROWS.length} manifests and ${SPEC_ROWS.length} spec constants.`,
);
