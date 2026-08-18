// Verify the repo's hand-maintained indexes against what is actually on disk.
//
// Two indexes are edited by hand, are read by tooling or by adopters, and have
// each already gone stale in a way nothing caught:
//
//   1. `spec/schemas/README.md` — the schema table. Three schemas
//      (section-gaps, uw-deal-package-manifest, uw-market-data) sat on disk
//      unlisted. The README is published, so an unlisted schema is one an
//      adopter cannot find; a listed-but-absent one is a dead link on the site.
//
//   2. The RFC copy list in `tools/docs-site/scripts/prebuild.mjs`. The index
//      table in `docs/rfcs/README.md` is copied to the site and links every
//      row, so an RFC listed there but missing from the copy list is a dead
//      link and VitePress fails the build. That is exactly how RFC 0025 broke
//      main's deploys for three merges.
//
// Both failures are silent at the point of the mistake and expensive later,
// which is the case for a cheap check rather than a convention.
//
// Direction matters, and the two are not symmetric:
//   - listed but absent  → always a failure (dead link)
//   - present but unlisted → a failure for schemas (undiscoverable), and
//     tolerated for the RFC copy list, where an extra copied file is just an
//     orphan page (0000-template.md is deliberately one).
//
// Run: npm run verify-indexes

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

const read = (p) => readFileSync(resolve(root, p), 'utf8');

// ── 1. The schema index ──────────────────────────────────────────────────────

const SCHEMAS_DIR = 'spec/schemas';
const schemaReadme = read(`${SCHEMAS_DIR}/README.md`);

// Files a reader is expected to find from the table: JSON Schemas plus the XSD,
// which crosses the same integration boundary.
const schemaFiles = readdirSync(resolve(root, SCHEMAS_DIR))
  .filter((f) => f.endsWith('.schema.json') || f.endsWith('.xsd'))
  .sort();

// Rows link the file, either as `[`name`](name)` or `[name](name)`.
const listedSchemas = new Set(
  [...schemaReadme.matchAll(/\]\(([a-z0-9-]+\.(?:schema\.json|xsd))\)/g)].map((m) => m[1]),
);

for (const file of schemaFiles) {
  if (!listedSchemas.has(file)) {
    failures.push(
      `${SCHEMAS_DIR}/README.md: ${file} is on disk but has no row in the table — an adopter reading the index cannot find it.`,
    );
  }
}
for (const listed of listedSchemas) {
  if (!existsSync(resolve(root, SCHEMAS_DIR, listed))) {
    failures.push(
      `${SCHEMAS_DIR}/README.md: the table links ${listed}, which does not exist — a dead link on the published site.`,
    );
  }
}
if (schemaFiles.length > 0) {
  checks.push(`${schemaFiles.length} schemas indexed in ${SCHEMAS_DIR}/README.md`);
}

// ── 2. The RFC copy list ─────────────────────────────────────────────────────

const RFC_INDEX = 'docs/rfcs/README.md';
const PREBUILD = 'tools/docs-site/scripts/prebuild.mjs';
const rfcIndex = read(RFC_INDEX);
const prebuild = read(PREBUILD);

// Every RFC the index table links. Table rows start `| [0021](./0021-....md)`.
const linkedRfcs = [
  ...rfcIndex.matchAll(/^\|\s*\[\d{4}\]\(\.\/(\d{4}-[a-z0-9-]+\.md)\)/gm),
].map((m) => m[1]);

// Every RFC prebuild copies into the site.
const copiedRfcs = new Set(
  [...prebuild.matchAll(/from:\s*'docs\/rfcs\/(\d{4}-[a-z0-9-]+\.md)'/g)].map((m) => m[1]),
);

for (const rfc of linkedRfcs) {
  if (!copiedRfcs.has(rfc)) {
    failures.push(
      `${PREBUILD}: ${RFC_INDEX} links ${rfc} but it is not in the copy list — the generated index will dead-link and the site build will fail.`,
    );
  }
  if (!existsSync(resolve(root, 'docs/rfcs', rfc))) {
    failures.push(`${RFC_INDEX}: links ${rfc}, which does not exist.`);
  }
}
if (linkedRfcs.length > 0) {
  checks.push(`${linkedRfcs.length} RFCs linked from ${RFC_INDEX} are all in the copy list`);
}

// A copied-but-unlinked RFC is an orphan page, not a break — 0000-template.md
// is deliberately one — so it is reported without failing.
const orphans = [...copiedRfcs].filter((r) => !linkedRfcs.includes(r) && r !== '0000-template.md');
if (orphans.length > 0) {
  checks.push(`note: copied but not linked from the index table: ${orphans.join(', ')}`);
}

// ── Report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  console.error(`\nSummary: ${failures.length} index mismatch(es).`);
  process.exit(1);
}

for (const check of checks) console.log(`[PASS] ${check}`);
console.log('\nSummary: hand-maintained indexes agree with the files on disk.');
