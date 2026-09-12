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
//   2. The RFC index links must name files in the dynamically discovered
//      docs-site copy plan. New Markdown files are copied automatically;
//      unindexed RFCs are reported as orphan pages without failing.
//
// Run: npm run verify-indexes

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rfcCopies } from './docs-site-sources.mjs';

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
const rfcIndex = read(RFC_INDEX);

// Every RFC the index table links. Table rows start `| [0021](./0021-....md)`.
const linkedRfcs = [
  ...rfcIndex.matchAll(/^\|\s*\[\d{4}\]\(\.\/(\d{4}-[a-z0-9-]+\.md)\)/gm),
].map((m) => m[1]);

// Use the same discovery as prebuild, preserving index/template routing.
const copiedRfcs = new Set(rfcCopies(root).map((copy) => copy.from.slice('docs/rfcs/'.length)));

for (const rfc of linkedRfcs) {
  if (!copiedRfcs.has(rfc)) {
    failures.push(
      `${RFC_INDEX} links ${rfc} but it is not in the discovered copy plan — the generated index will dead-link and the site build will fail.`,
    );
  }
  if (!existsSync(resolve(root, 'docs/rfcs', rfc))) {
    failures.push(`${RFC_INDEX}: links ${rfc}, which does not exist.`);
  }
}
if (linkedRfcs.length > 0) {
  checks.push(`${linkedRfcs.length} RFCs linked from ${RFC_INDEX} are all discovered for the site`);
}

// A copied-but-unlinked RFC is an orphan page, not a break — 0000-template.md
// is deliberately one — so it is reported without failing.
const orphans = [...copiedRfcs].filter((r) => !linkedRfcs.includes(r) && r !== '0000-template.md' && r !== 'README.md');
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
