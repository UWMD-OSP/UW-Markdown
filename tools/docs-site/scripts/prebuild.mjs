#!/usr/bin/env node
// Copies repo source-of-truth markdown into the docs-site/ tree so VitePress
// can build them. Keeps repo-root files as the single source — site copies
// are ephemeral and gitignored.
//
// Run: node scripts/prebuild.mjs           (copy)
//      node scripts/prebuild.mjs --clean   (remove generated files)

import { mkdir, copyFile, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..', '..');

const GENERATED_DIRS = ['spec', 'conformance', 'about', 'guide', 'public'];

if (process.argv.includes('--clean')) {
  for (const d of GENERATED_DIRS) {
    const p = join(SITE_ROOT, d);
    if (existsSync(p)) await rm(p, { recursive: true, force: true });
    console.log(`[clean] removed ${d}/`);
  }
  process.exit(0);
}

// ─── Copy plan ────────────────────────────────────────────────────────────────
// Each entry: { from: repo-relative path, to: site-relative path, transform?: fn }

const COPIES = [
  // Spec
  { from: 'spec/UW_FORMAT_SPEC_v1.md',   to: 'spec/format.md',   title: 'UW Format Specification (v1.1)' },
  { from: 'spec/UW_PROTOCOL_v1.md',      to: 'spec/protocol.md', title: 'UW Protocol Specification (v1.2)' },
  { from: 'spec/UW_XML_MAPPING_v1.md',   to: 'spec/xml.md',      title: 'UW XML Mapping (v1.0)' },
  { from: 'spec/UW_CSV_BUNDLE_v1.md',    to: 'spec/csv.md',      title: 'UW CSV Bundle (v1.0)' },
  { from: 'spec/UW_LITE_SPEC_v1.md',     to: 'spec/lite.md',     title: 'UW Lite Specification (v1.0)' },
  { from: 'spec/UW_RECEIPT_v1.md',       to: 'spec/receipt.md',  title: 'UW Verification Receipt (v1.0)' },
  { from: 'spec/bindings/README.md', to: 'spec/bindings/index.md', title: 'Transport Bindings' },
  { from: 'spec/bindings/UW_HTTP_BINDING_v1.md', to: 'spec/http.md', title: 'UW HTTP Binding (v1.0)' },
  { from: 'spec/bindings/UW_MCP_BINDING_v1.md', to: 'spec/mcp.md', title: 'UW MCP Binding (v1.0)' },
  { from: 'spec/bindings/UW_HTTP_API_v1.openapi.json', to: 'public/spec/UW_HTTP_API_v1.openapi.json' },
  { from: 'spec/schemas/README.md',      to: 'spec/schemas/index.md', title: 'Schemas' },
  { from: 'spec/schemas/uw-document-envelope.xsd', to: 'public/schemas/uw-document-envelope.xsd' },

  // Conformance
  { from: 'conformance/README.md',                  to: 'conformance/index.md',  title: 'Conformance Corpus' },
  { from: 'conformance/tier-1-reader/README.md',    to: 'conformance/tier-1.md', title: 'Tier 1 — Reader' },
  { from: 'conformance/tier-2-editor/README.md',    to: 'conformance/tier-2.md', title: 'Tier 2 — Editor' },
  { from: 'conformance/tier-3-calc-host/README.md', to: 'conformance/tier-3.md', title: 'Tier 3 — Calc Host' },
  { from: 'conformance/tier-4-agent-host/README.md', to: 'conformance/tier-4.md', title: 'Tier 4 — Agent Host' },

  // Project documents
  { from: 'ROADMAP.md',          to: 'about/roadmap.md' },
  { from: 'GOVERNANCE.md',       to: 'about/governance.md' },
  { from: 'MAINTAINERS.md',      to: 'about/maintainers.md' },
  { from: 'SECURITY.md',         to: 'about/security.md' },
  { from: 'CONTRIBUTING.md',     to: 'about/contributing.md' },
  { from: 'CODE_OF_CONDUCT.md',  to: 'about/code-of-conduct.md' },
  { from: 'CHANGELOG.md',        to: 'about/changelog.md' },
  { from: 'ARCHITECTURE.md',     to: 'about/architecture.md', title: 'Architecture' },
  { from: 'VERSIONS.md',         to: 'about/versions.md',     title: 'Versions' },

  // Guide / on-ramps (source of truth in docs/)
  { from: 'docs/GLOSSARY.md',    to: 'guide/glossary.md', title: 'Glossary' },
  { from: 'docs/TOOLS.md',       to: 'guide/tools.md',    title: 'Tools comparison' },
  { from: 'docs/UW_LITE_AND_UWX.md', to: 'guide/lite-and-uwx.md', title: 'UW Lite and UWX' },
  { from: 'docs/UW_RECEIPTS.md',     to: 'guide/receipts.md',     title: 'Verification receipts' },

  // RFCs
  { from: 'docs/rfcs/README.md',       to: 'about/rfcs/index.md', title: 'RFC Process' },
  { from: 'docs/rfcs/0000-template.md', to: 'about/rfcs/template.md', title: 'RFC Template' },
  { from: 'docs/rfcs/0001-locale-negotiation.md',     to: 'about/rfcs/0001-locale-negotiation.md' },
  { from: 'docs/rfcs/0002-module-signing.md',         to: 'about/rfcs/0002-module-signing.md' },
  { from: 'docs/rfcs/0003-module-asset-classes.md',   to: 'about/rfcs/0003-module-asset-classes.md' },
  { from: 'docs/rfcs/0004-conformance-runner-v2.md',  to: 'about/rfcs/0004-conformance-runner-v2.md' },
  { from: 'docs/rfcs/0005-stochastic-calculations.md', to: 'about/rfcs/0005-stochastic-calculations.md' },
  { from: 'docs/rfcs/0006-hospitality-module.md',     to: 'about/rfcs/0006-hospitality-module.md' },
  { from: 'docs/rfcs/0007-sensitivity-tables.md',     to: 'about/rfcs/0007-sensitivity-tables.md' },
  { from: 'docs/rfcs/0008-lease-up-modeling.md',      to: 'about/rfcs/0008-lease-up-modeling.md' },
  { from: 'docs/rfcs/0009-meta-v2-reorg.md',          to: 'about/rfcs/0009-meta-v2-reorg.md' },
  { from: 'docs/rfcs/0010-signed-blocks.md',          to: 'about/rfcs/0010-signed-blocks.md' },
  { from: 'docs/rfcs/0011-capability-tokens.md',      to: 'about/rfcs/0011-capability-tokens.md' },
  { from: 'docs/rfcs/0013-corpus-retrieval.md',       to: 'about/rfcs/0013-corpus-retrieval.md' },
  { from: 'docs/rfcs/0014-multi-format-interchange.md', to: 'about/rfcs/0014-multi-format-interchange.md' },
  { from: 'docs/rfcs/0015-portfolio-relationships.md', to: 'about/rfcs/0015-portfolio-relationships.md' },
  { from: 'docs/rfcs/0016-verification-receipts.md',  to: 'about/rfcs/0016-verification-receipts.md' },
  { from: 'docs/rfcs/0017-uw-lite-source-representation.md', to: 'about/rfcs/0017-uw-lite-source-representation.md' },
  { from: 'docs/rfcs/0018-document-profiles-and-deal-packages.md', to: 'about/rfcs/0018-document-profiles-and-deal-packages.md' },
  { from: 'docs/rfcs/0019-mixed-use-composition.md', to: 'about/rfcs/0019-mixed-use-composition.md' },
  { from: 'docs/rfcs/0020-uwx-terminology-alignment.md', to: 'about/rfcs/0020-uwx-terminology-alignment.md' },
  { from: 'docs/releases/1.1-plus-interchange-plan.md', to: 'about/releases/1.1-plus-interchange.md', title: '1.1+ Interchange Release Plan' },
];

// ─── Link rewriter ────────────────────────────────────────────────────────────
// Repo files use relative paths (../GOVERNANCE.md, ./packages/, etc.).
// In the rendered site, those need to become site-absolute URLs.

// Source-relative path → site URL. Keys are normalized: leading "./" and "../"
// segments are stripped before lookup, so we only list the canonical form once.
const NORMALIZED_LINK_MAP = new Map([
  // Project documents
  ['ROADMAP.md', '/about/roadmap'],
  ['GOVERNANCE.md', '/about/governance'],
  ['MAINTAINERS.md', '/about/maintainers'],
  ['SECURITY.md', '/about/security'],
  ['CONTRIBUTING.md', '/about/contributing'],
  ['CODE_OF_CONDUCT.md', '/about/code-of-conduct'],
  ['CHANGELOG.md', '/about/changelog'],
  ['ARCHITECTURE.md', '/about/architecture'],
  ['VERSIONS.md', '/about/versions'],
  ['docs/GLOSSARY.md', '/guide/glossary'],
  ['docs/TOOLS.md', '/guide/tools'],
  ['docs/UW_LITE_AND_UWX.md', '/guide/lite-and-uwx'],
  ['docs/UW_RECEIPTS.md', '/guide/receipts'],
  ['GLOSSARY.md', '/guide/glossary'],
  ['TOOLS.md', '/guide/tools'],
  ['UW_LITE_AND_UWX.md', '/guide/lite-and-uwx'],
  ['UW_RECEIPTS.md', '/guide/receipts'],
  ['docs/releases/1.1-plus-interchange-plan.md', '/about/releases/1.1-plus-interchange'],
  ['releases/1.1-plus-interchange-plan.md', '/about/releases/1.1-plus-interchange'],
  ['LICENSE', 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/LICENSE'],

  // Spec
  ['spec/UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['spec/UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['spec/UW_XML_MAPPING_v1.md', '/spec/xml'],
  ['spec/UW_CSV_BUNDLE_v1.md', '/spec/csv'],
  ['spec/UW_LITE_SPEC_v1.md', '/spec/lite'],
  ['spec/UW_RECEIPT_v1.md', '/spec/receipt'],
  ['UW_RECEIPT_v1.md', '/spec/receipt'],
  ['spec/bindings/', '/spec/bindings/'],
  ['spec/bindings/README.md', '/spec/bindings/'],
  ['bindings/', '/spec/bindings/'],
  ['bindings/README.md', '/spec/bindings/'],
  ['spec/bindings/UW_HTTP_BINDING_v1.md', '/spec/http'],
  ['spec/bindings/UW_MCP_BINDING_v1.md', '/spec/mcp'],
  ['spec/bindings/UW_HTTP_API_v1.openapi.json', '/spec/UW_HTTP_API_v1.openapi.json'],
  ['bindings/UW_HTTP_BINDING_v1.md', '/spec/http'],
  ['bindings/UW_MCP_BINDING_v1.md', '/spec/mcp'],
  ['bindings/UW_HTTP_API_v1.openapi.json', '/spec/UW_HTTP_API_v1.openapi.json'],
  ['UW_HTTP_BINDING_v1.md', '/spec/http'],
  ['UW_MCP_BINDING_v1.md', '/spec/mcp'],
  ['UW_HTTP_API_v1.openapi.json', '/spec/UW_HTTP_API_v1.openapi.json'],
  ['UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['UW_XML_MAPPING_v1.md', '/spec/xml'],
  ['UW_CSV_BUNDLE_v1.md', '/spec/csv'],
  ['UW_LITE_SPEC_v1.md', '/spec/lite'],
  ['spec/schemas/', '/spec/schemas/'],
  ['spec/schemas/README.md', '/spec/schemas/'],
  ['schemas/', '/spec/schemas/'],
  ['schemas/README.md', '/spec/schemas/'],
  ['uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],
  ['schemas/uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],
  ['spec/schemas/uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],

  // RFCs
  ['docs/rfcs/0000-template.md', '/about/rfcs/template'],
  ['docs/rfcs/README.md', '/about/rfcs/'],
  ['docs/rfcs/', '/about/rfcs/'],
  ['0000-template.md', '/about/rfcs/template'],

  // Conformance
  ['conformance/', '/conformance/'],
  ['conformance/README.md', '/conformance/'],
  ['conformance/tier-1-reader/README.md', '/conformance/tier-1'],
  ['conformance/tier-2-editor/README.md', '/conformance/tier-2'],
  ['conformance/tier-3-calc-host/README.md', '/conformance/tier-3'],
  ['conformance/tier-4-agent-host/README.md', '/conformance/tier-4'],
]);

function normalize(path) {
  return path.replace(/^(\.\.?\/)+/, '');
}

const GITHUB_BLOB = 'https://github.com/UWMD-OSP/UW-Markdown/blob/main';

function rewriteLinks(md) {
  // Markdown link: [text](url) and [text](url#frag)
  return md.replace(/\]\(([^)]+)\)/g, (full, target) => {
    // Skip absolute URLs and anchors
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('#') || target.startsWith('mailto:')) {
      return full;
    }

    const [path, frag] = splitFrag(target);
    const norm = normalize(path);

    if (NORMALIZED_LINK_MAP.has(norm)) {
      return `](${NORMALIZED_LINK_MAP.get(norm)}${frag})`;
    }

    // Numbered RFC paths all map to /about/rfcs/NNNN-slug, in each of the three
    // spellings a correct GitHub-relative link takes depending on where the
    // linking file sits: `docs/rfcs/NNNN-slug.md` from the repo root,
    // `rfcs/NNNN-slug.md` from inside docs/, and `NNNN-slug.md` from inside
    // docs/rfcs/.
    const rfcMatch = norm.match(/^(?:docs\/)?(?:rfcs\/)?(\d{4}-[a-z0-9-]+)\.md$/);
    if (rfcMatch) {
      return `](/about/rfcs/${rfcMatch[1]}${frag})`;
    }

    // Paths into source/code dirs → link out to GitHub
    if (/^(packages|scripts|examples|\.github|tools)\b/.test(norm)) {
      return `](${GITHUB_BLOB}/${norm}${frag})`;
    }

    return full;
  });
}

function splitFrag(target) {
  const i = target.indexOf('#');
  if (i === -1) return [target, ''];
  return [target.slice(0, i), target.slice(i)];
}

// ─── Frontmatter injector ─────────────────────────────────────────────────────

function withFrontmatter(md, title) {
  if (!title) return md;
  if (md.startsWith('---')) return md; // already has frontmatter
  return `---\ntitle: ${JSON.stringify(title)}\n---\n\n${md}`;
}

// ─── RFC status banner ────────────────────────────────────────────────────────
// VitePress consumes YAML frontmatter, so an RFC's `status:` never reaches the
// rendered page. That is dangerous for `draft`: a reader lands on a proposal
// with no signal that nobody has accepted it. Lift the status into a visible
// callout, keyed off the RFC's own frontmatter so it cannot drift.

const RFC_STATUS_NOTE = {
  draft: ['warning', 'Draft — not accepted. This proposal is still being iterated on and may change or be rejected. Do not implement against it.'],
  active: ['warning', 'Open for comment. Not yet accepted; details may still change.'],
  accepted: ['tip', 'Accepted — merged with intent to implement.'],
  implemented: ['tip', 'Implemented — this change has shipped.'],
  rejected: ['danger', 'Rejected. Retained as design history; do not implement.'],
  superseded: ['danger', 'Superseded by a later RFC. Retained as design history.'],
  withdrawn: ['danger', 'Withdrawn by its author. Retained as design history.'],
};

function withRfcStatusBanner(md, toPath) {
  // Only numbered RFC pages; the index and template have no status of their own.
  if (!/^about\/rfcs\/\d{4}-/.test(toPath.replace(/\\/g, '/'))) return md;
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(md);
  if (!fm) return md;
  const status = /^status:[ \t]*(\S+)/m.exec(fm[1])?.[1];
  const note = RFC_STATUS_NOTE[status];
  if (!note) return md;
  const [kind, text] = note;
  const banner = `\n::: ${kind} Status: ${status}\n${text}\n:::\n`;
  return md.slice(0, fm[0].length) + banner + md.slice(fm[0].length);
}

// ─── Run copies ───────────────────────────────────────────────────────────────

let count = 0;
for (const c of COPIES) {
  const src = join(REPO_ROOT, c.from);
  const dst = join(SITE_ROOT, c.to);

  if (!existsSync(src)) {
    console.warn(`[skip]  ${c.from} (not found)`);
    continue;
  }

  await mkdir(dirname(dst), { recursive: true });
  let md = await readFile(src, 'utf8');
  md = rewriteLinks(md);
  md = withFrontmatter(md, c.title);
  md = withRfcStatusBanner(md, c.to);
  await writeFile(dst, md, 'utf8');
  console.log(`[copy]  ${c.from}  →  ${relative(SITE_ROOT, dst)}`);
  count++;
}

console.log(`\nCopied ${count} files.`);
