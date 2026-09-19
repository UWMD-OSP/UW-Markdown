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

// The table's status column and the RFC's own frontmatter are maintained by
// hand in two places. RFC 0054 shipped accepted in its frontmatter and draft in
// the table, and nothing noticed.
// The allowed status set, mirroring "## Status values" in docs/rfcs/README.md.
// An unknown status is how vocabulary drifts: two sections once documented
// overlapping sets, and a typo in frontmatter would have gone unnoticed.
const ALLOWED_STATUSES = new Set([
  'draft',
  'active',
  'accepted',
  'decided',
  'implemented',
  'rejected',
  'superseded',
  'withdrawn',
]);

const indexedStatus = new Map(
  [...rfcIndex.matchAll(/^\|\s*\[\d{4}\]\(\.\/(\d{4}-[a-z0-9-]+\.md)\)\s*\|[^|]*\|\s*([a-z]+)\s*\|/gm)]
    .map((m) => [m[1], m[2]]),
);

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

// ── 2b. RFC frontmatter must be parseable YAML ───────────────────────────────
// The site copies each RFC verbatim, so an unquoted plain scalar carrying a
// `: ` sequence is a YAML error that surfaces only as a failed Vercel build.
// RFC 0051's title ("hurdle_mode: \"any\"") was the first to hit it.

for (const rfc of copiedRfcs) {
  // The index is copied alongside the RFCs but is not one, so by design it
  // carries no frontmatter.
  if (rfc === 'README.md') continue;
  const path = join('docs/rfcs', rfc);
  if (!existsSync(resolve(root, path))) continue;
  const text = read(path).replace(/^\uFEFF/, '');
  // RFC 0054 was committed at zero bytes and every gate stayed green: this loop
  // used to skip any file that did not open with `---`, and an empty markdown
  // page builds fine. Emptiness has to fail here, because nothing downstream
  // can see it.
  if (text.trim().length === 0) {
    failures.push(`${path}: the file is empty. An RFC with no content passes the site build and every other check silently.`);
    continue;
  }
  if (!text.startsWith('---')) {
    failures.push(`${path}: an RFC must open with a YAML frontmatter block.`);
    continue;
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    failures.push(`${path}: frontmatter opens with --- but is never closed.`);
    continue;
  }
  if (text.slice(end + 4).trim().length === 0) {
    failures.push(`${path}: the frontmatter is closed but the RFC has no body.`);
    continue;
  }
  // The table's status column must agree with the RFC's own frontmatter.
  const declared = /^status:\s*(\S+)\s*$/m.exec(text.slice(3, end))?.[1];
  const tabled = indexedStatus.get(rfc);
  if (declared && tabled && declared !== tabled) {
    failures.push(`${path}: frontmatter says status "${declared}" but the index table says "${tabled}" — the two are maintained by hand and have drifted.`);
  }
  if (declared && !ALLOWED_STATUSES.has(declared)) {
    failures.push(`${path}: status "${declared}" is not one of ${[...ALLOWED_STATUSES].join(', ')} — see "## Status values" in docs/rfcs/README.md.`);
  }
  for (const line of text.slice(3, end).split('\n')) {
    const field = /^([A-Za-z_][\w-]*):\s+(\S.*)$/.exec(line.trim());
    if (!field) continue;
    const [, key, value] = field;
    const quoted = (value.startsWith("'") && value.endsWith("'"))
      || (value.startsWith('"') && value.endsWith('"'));
    if (!quoted && value.includes(': ')) {
      failures.push(
        `${path}: frontmatter \`${key}\` contains ": " but is unquoted — YAML reads it as a nested mapping and the site build fails. Wrap the value in single quotes.`,
      );
    }
  }
}
if (!failures.some((f) => f.includes('rfcs'))) {
  checks.push(`${copiedRfcs.size - 1} RFCs have a body and frontmatter that parses as YAML scalars`);
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
