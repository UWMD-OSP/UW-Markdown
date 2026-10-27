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
import { rfcCopies, docsSiteVersions } from '../../../scripts/docs-site-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..', '..');
const SITE_VERSIONS = docsSiteVersions(REPO_ROOT);

const GENERATED_DIRS = ['spec', 'conformance', 'about', 'guide', 'starter', 'public'];

if (process.argv.includes('--clean')) {
  for (const d of GENERATED_DIRS) {
    const p = join(SITE_ROOT, d);
    if (existsSync(p)) await rm(p, { recursive: true, force: true });
    console.log(`[clean] removed ${d}/`);
  }
  process.exit(0);
}

// Remove generated launch-cleanup pages from reused build workspaces too.
// Authored guide pages and public assets remain outside this bounded list.
for (const retired of ['about/reviews', 'about/releases', 'about/roadmap-history.md',
  'about/period-consumers.md', 'about/element-package-validation.md',
  'about/standalone-documents-and-lake.md']) {
  const target = resolve(SITE_ROOT, retired);
  if (relative(SITE_ROOT, target).startsWith('..')) throw new TypeError('Retired page escaped the site root');
  await rm(target, { recursive: true, force: true });
}

// ─── Copy plan ────────────────────────────────────────────────────────────────
// Each entry: { from: repo-relative path, to: site-relative path, transform?: fn }


// The non-normative starter products guide (RFC 0078). Listed rather than
// discovered so each page carries a site title, like the other copies.
const STARTER_PAGES = [
  ['README.md', 'Starter products'],
  ['display.md', 'Starter products: display conventions'],
  ['view-models.md', 'Starter products: view models'],
  ['editing.md', 'Starter products: editing'],
  ['defaults-and-cascade.md', 'Starter products: defaults and the fallback cascade'],
  ['refinement-and-workbooks.md', 'Starter products: refinement and workbook bindings'],
  ['ai-host.md', 'Starter products: agent writers and context profiles'],
  ['capability-tokens.md', 'Starter products: capability tokens'],
  ['cli.md', 'Starter products: CLI reference'],
  ['rendering.md', 'Starter products: renderer reference'],
];

const FOUNDATION_GUIDES = [
  ['FOUNDATION.md', 'foundation', 'The UWMD foundation'],
  ['HOW-UWMD-GROWS.md', 'how-uwmd-grows', 'How UWMD grows'],
  ['document-types.md', 'document-types', 'Document types'],
  ['document-facts.md', 'document-facts', 'Source-fact profiles'],
  ['KNOWN-LIMITS.md', 'known-limits', 'Known limits'],
];

const COPIES = [
  ...FOUNDATION_GUIDES.map(([file, slug, title]) => ({
    from: `docs/${file}`, to: `guide/${slug}.md`, title,
  })),
  { from: 'conformance/stochastic/pcg64-reference.md', to: 'conformance/pcg64-reference.md', title: 'Independent PCG64 reference' },
  // Spec
  { from: 'spec/UW_FORMAT_SPEC.md',   to: 'spec/format.md',   title: `UW Format Specification (${SITE_VERSIONS.specFormat})` },
  { from: 'spec/UW_PROTOCOL.md',      to: 'spec/protocol.md', title: `UW Protocol — verification (${SITE_VERSIONS.specProtocol})` },
  { from: 'spec/UW_ENVELOPE.md',      to: 'spec/envelope.md', title: 'UW Document Envelope (2.0)' },
  { from: 'spec/UW_XML_MAPPING.md',   to: 'spec/xml.md',      title: 'UW XML Mapping (2.0)' },
  { from: 'spec/UW_CSV_BUNDLE.md',    to: 'spec/csv.md',      title: 'UW CSV Bundle (2.0)' },
  { from: 'spec/UW_LITE_SPEC.md',     to: 'spec/lite.md',     title: 'UW Lite Specification (v1.0)' },
  { from: 'spec/UW_RECEIPT.md',       to: 'spec/receipt.md',  title: `UW Verification Receipt (${SITE_VERSIONS.receipt})` },
  { from: 'spec/UW_COMPOSITION.md',   to: 'spec/composition.md', title: 'UW Composition Specification (v1.0)' },
  { from: 'spec/bindings/README.md', to: 'spec/bindings/index.md', title: 'Transport Bindings' },
  { from: 'spec/bindings/UW_HTTP_BINDING_v1.md', to: 'spec/http.md', title: 'UW HTTP Binding (v1.0)' },
  { from: 'spec/bindings/UW_MCP_BINDING_v1.md', to: 'spec/mcp.md', title: 'UW MCP Binding (v1.0)' },
  { from: 'spec/bindings/UW_HTTP_API_v1.openapi.json', to: 'public/spec/UW_HTTP_API_v1.openapi.json' },
  { from: 'spec/metrics/README.md', to: 'spec/metrics/index.md', title: 'Metric dictionary' },
  { from: 'spec/metrics/builtin.json', to: 'public/spec/metrics/builtin.json' },
  { from: 'spec/schemas/metric-dictionary.schema.json', to: 'public/schemas/metric-dictionary.schema.json' },
  { from: 'conformance/metrics/README.md', to: 'conformance/metrics.md', title: 'Metric verification' },
  { from: 'spec/schemas/README.md',      to: 'spec/schemas/index.md', title: 'Schemas' },
  { from: 'spec/schemas/uw-document-envelope.xsd', to: 'public/schemas/uw-document-envelope.xsd' },

  // Conformance
  { from: 'conformance/README.md',                  to: 'conformance/index.md',  title: 'Conformance Corpus' },
  { from: 'conformance/document-signatures/README.md', to: 'conformance/document-signatures.md', title: 'Document snapshot signatures' },
  { from: 'conformance/documents/README.md',    to: 'conformance/documents.md', title: 'Reader and validation fixtures' },
  { from: 'conformance/starter/editor/README.md',    to: 'conformance/starter-editor.md', title: 'Editor starter checks' },
  { from: 'conformance/calc/README.md', to: 'conformance/calc.md', title: 'Calculation fixtures' },
  { from: 'conformance/starter/refinement/README.md', to: 'conformance/starter-refinement.md', title: 'Refinement starter checks' },
  { from: 'conformance/runner/README.md',           to: 'conformance/runner.md', title: 'Language-agnostic runner' },

  // Starter products (non-normative, RFC 0078) — docs/starter/ is the source.
  ...STARTER_PAGES.map(([file, title]) => ({
    from: `docs/starter/${file}`,
    to: `starter/${file === 'README.md' ? 'index.md' : file}`,
    title,
  })),

  // Project documents
  { from: 'docs/ABOUT.md',       to: 'about/index.md', title: 'About UW Markdown' },
  { from: 'ROADMAP.md',          to: 'about/roadmap.md' },
  { from: 'GOVERNANCE.md',       to: 'about/governance.md' },
  { from: 'MAINTAINERS.md',      to: 'about/maintainers.md' },
  { from: 'SECURITY.md',         to: 'about/security.md' },
  { from: 'CONTRIBUTING.md',     to: 'about/contributing.md' },
  { from: 'docs/FEEDBACK.md',    to: 'about/feedback.md',     title: 'Reporting problems and feedback' },
  { from: 'CODE_OF_CONDUCT.md',  to: 'about/code-of-conduct.md' },
  { from: 'CHANGELOG.md',        to: 'about/changelog.md' },
  { from: 'ARCHITECTURE.md',     to: 'about/architecture.md', title: 'Architecture' },
  { from: 'VERSIONS.md',         to: 'about/versions.md',     title: 'Versions' },

  // Guide / on-ramps (source of truth in docs/)
  { from: 'docs/PROPERTY_CASH_FLOW_WORKFLOW.md', to: 'guide/property-cash-flow.md', title: 'Property cash-flow assembly' },
  { from: 'docs/LEASE_UP_CASH_FLOW_WORKFLOW.md', to: 'guide/lease-up-cash-flow.md', title: 'Lease-up cash-flow workflow' },
  { from: 'docs/CALCULATION_CONTEXT.md', to: 'guide/calculation-context.md', title: 'Calculation context files' },
  { from: 'docs/GLOSSARY.md',    to: 'guide/glossary.md', title: 'Glossary' },
  { from: 'docs/TOOLS.md',       to: 'guide/tools.md',    title: 'Tools and packages' },
  { from: 'docs/UW_LITE_AND_UWX.md', to: 'guide/lite-and-uwx.md', title: 'UW Lite and UWX' },
  { from: 'docs/UW_RECEIPTS.md',     to: 'guide/receipts.md',     title: 'Verification receipts' },
  { from: 'docs/DATA_LAKE.md',       to: 'guide/data-lake.md',    title: 'UW Markdown → data lake' },


  // Discover every docs/rfcs/*.md file, including new drafts.
  ...rfcCopies(REPO_ROOT),
];

// ─── Link rewriter ────────────────────────────────────────────────────────────
// Repo files use relative paths (../GOVERNANCE.md, ./packages/, etc.).
// In the rendered site, those need to become site-absolute URLs.

// Source-relative path → site URL. Keys are normalized: leading "./" and "../"
// segments are stripped before lookup, so we only list the canonical form once.
const NORMALIZED_LINK_MAP = new Map([
  ...['.py', '.ts', '.vectors.json', '.cycle.json', '.cycle.py', '.schema.proposed.json', '.check.mjs'].map(suffix => {
    const path = `conformance/metadata-dates/2026-10-17-validation-diagnostic-gap-354.0095-date-only${suffix}`;
    return [path, `https://github.com/UWMD-OSP/UW-Markdown/blob/main/${path}`];
  }),
  ['conformance/stochastic/pcg64-reference.md', '/conformance/pcg64-reference'],
  ['docs/PROPERTY_CASH_FLOW_WORKFLOW.md', '/guide/property-cash-flow'],
  ['PROPERTY_CASH_FLOW_WORKFLOW.md', '/guide/property-cash-flow'],
  ['docs/LEASE_UP_CASH_FLOW_WORKFLOW.md', '/guide/lease-up-cash-flow'],
  ['LEASE_UP_CASH_FLOW_WORKFLOW.md', '/guide/lease-up-cash-flow'],
  ['docs/CALCULATION_CONTEXT.md', '/guide/calculation-context'],
  ['CALCULATION_CONTEXT.md', '/guide/calculation-context'],
  // Project documents
  ['ROADMAP.md', '/about/roadmap'],
  // The review links its sibling reproduction script, which is code, not a page.
  // Repository documents the site does not render link their GitHub source.
  ['docs/playbooks/README.md', 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/playbooks/README.md'],
  ['GOVERNANCE.md', '/about/governance'],
  ['MAINTAINERS.md', '/about/maintainers'],
  ['SECURITY.md', '/about/security'],
  ['CONTRIBUTING.md', '/about/contributing'],
  ['docs/FEEDBACK.md', '/about/feedback'],
  ['FEEDBACK.md', '/about/feedback'],
  ['CODE_OF_CONDUCT.md', '/about/code-of-conduct'],
  ['CHANGELOG.md', '/about/changelog'],
  ['ARCHITECTURE.md', '/about/architecture'],
  ['docs/ABOUT.md', '/about/'],
  ['ABOUT.md', '/about/'],
  ['VERSIONS.md', '/about/versions'],
  ['docs/GLOSSARY.md', '/guide/glossary'],
  ['docs/TOOLS.md', '/guide/tools'],
  ['docs/UW_LITE_AND_UWX.md', '/guide/lite-and-uwx'],
  ['docs/UW_RECEIPTS.md', '/guide/receipts'],
  ['docs/DATA_LAKE.md', '/guide/data-lake'],
  ['GLOSSARY.md', '/guide/glossary'],
  ['TOOLS.md', '/guide/tools'],
  ['UW_LITE_AND_UWX.md', '/guide/lite-and-uwx'],
  ['UW_RECEIPTS.md', '/guide/receipts'],
  ['DATA_LAKE.md', '/guide/data-lake'],
  ['LICENSE', 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/LICENSE'],

  // Starter products guide (RFC 0078)
  ['docs/starter/', '/starter/'],
  ['docs/starter/README.md', '/starter/'],
  ['starter/README.md', '/starter/'],
  ...STARTER_PAGES.filter(([file]) => file !== 'README.md').flatMap(([file]) => [
    [`docs/starter/${file}`, `/starter/${file.replace(/\.md$/, '')}`],
    [`starter/${file}`, `/starter/${file.replace(/\.md$/, '')}`],
  ]),

  // Historical RFC/release conformance links (RFC 0081 §8), not routes or redirects.
  ['conformance/tier-1-reader/README.md', '/conformance/documents'],
  ['conformance/tier-2-editor/README.md', '/conformance/starter-editor'],
  ['conformance/tier-3-calc-host/README.md', '/conformance/calc'],
  // The layer-profile starter check left with the layer registry (RFC 0112).
  ['conformance/tier-4-agent-host/README.md', '/conformance/'],

  // Historical RFC/release filenames (RFC 0081 §2), not redirects.
  ['UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['spec/UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['UW_FORMAT_SPEC_v2.md', '/spec/format'],
  ['spec/UW_FORMAT_SPEC_v2.md', '/spec/format'],
  ['UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['spec/UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['UW_LITE_SPEC_v1.md', '/spec/lite'],
  ['spec/UW_LITE_SPEC_v1.md', '/spec/lite'],
  ['UW_RECEIPT_v1.md', '/spec/receipt'],
  ['spec/UW_RECEIPT_v1.md', '/spec/receipt'],
  ['UW_XML_MAPPING_v1.md', '/spec/xml'],
  ['spec/UW_XML_MAPPING_v1.md', '/spec/xml'],
  ['UW_CSV_BUNDLE_v1.md', '/spec/csv'],
  ['spec/UW_CSV_BUNDLE_v1.md', '/spec/csv'],
  ['UW_COMPOSITION_v1.md', '/spec/composition'],
  ['spec/UW_COMPOSITION_v1.md', '/spec/composition'],

  // Spec
  ['schemas/uwmd-block-v2.schema.json', 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/spec/schemas/uwmd-block.schema.json'],
  ['spec/schemas/uwmd-block-v2.schema.json', 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/spec/schemas/uwmd-block.schema.json'],
  ['spec/UW_FORMAT_SPEC.md', '/spec/format'],
  ['spec/UW_PROTOCOL.md', '/spec/protocol'],
  ['spec/UW_ENVELOPE.md', '/spec/envelope'],
  ['UW_ENVELOPE.md', '/spec/envelope'],
  ['spec/UW_XML_MAPPING.md', '/spec/xml'],
  ['spec/UW_CSV_BUNDLE.md', '/spec/csv'],
  ['spec/UW_LITE_SPEC.md', '/spec/lite'],
  ['spec/UW_RECEIPT.md', '/spec/receipt'],
  ['spec/UW_COMPOSITION.md', '/spec/composition'],
  ['UW_RECEIPT.md', '/spec/receipt'],
  ['UW_COMPOSITION.md', '/spec/composition'],
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
  ['UW_FORMAT_SPEC.md', '/spec/format'],
  ['UW_PROTOCOL.md', '/spec/protocol'],
  ['UW_XML_MAPPING.md', '/spec/xml'],
  ['UW_CSV_BUNDLE.md', '/spec/csv'],
  ['UW_LITE_SPEC.md', '/spec/lite'],
  ['spec/metrics/README.md', '/spec/metrics/'],
  ['metrics/README.md', '/spec/metrics/'],
  ['builtin.json', '/spec/metrics/builtin.json'],
  ['metric-dictionary.schema.json', '/schemas/metric-dictionary.schema.json'],
  ['schemas/metric-dictionary.schema.json', '/schemas/metric-dictionary.schema.json'],
  ['conformance/metrics/README.md', '/conformance/metrics'],
  ['spec/schemas/', '/spec/schemas/'],
  ['spec/schemas/README.md', '/spec/schemas/'],
  ['schemas/', '/spec/schemas/'],
  ['schemas/README.md', '/spec/schemas/'],
  ['uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],
  ['schemas/uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],
  ['spec/schemas/uw-document-envelope.xsd', '/schemas/uw-document-envelope.xsd'],

  // RFCs
  ['docs/rfcs/0000-template.md', '/about/rfcs/template'],
  ['docs/rfcs/template.md', '/about/rfcs/template'],
  ['docs/rfcs/README.md', '/about/rfcs/'],
  ['docs/rfcs/', '/about/rfcs/'],
  ['0000-template.md', '/about/rfcs/template'],
  ['template.md', '/about/rfcs/template'],

  // Conformance
  ['conformance/', '/conformance/'],
  ['conformance/README.md', '/conformance/'],
  ['conformance/document-signatures/README.md', '/conformance/document-signatures'],
  ['document-signatures/README.md', '/conformance/document-signatures'],
  ['conformance/documents/README.md', '/conformance/documents'],
  ['conformance/starter/editor/README.md', '/conformance/starter-editor'],
  ['conformance/calc/README.md', '/conformance/calc'],
  ['conformance/starter/agent/README.md', '/conformance/'],
  ['starter/refinement/README.md', '/conformance/starter-refinement'],
  ['conformance/starter/refinement/README.md', '/conformance/starter-refinement'],
  ['conformance/runner/README.md', '/conformance/runner'],
  ['conformance/runner/', '/conformance/runner'],
]);

function normalize(path) {
  return path.replace(/^(\.\.?\/)+/, '');
}

const GITHUB_BLOB = 'https://github.com/UWMD-OSP/UW-Markdown/blob/main';

for (const [file, slug] of FOUNDATION_GUIDES) {
  NORMALIZED_LINK_MAP.set(`docs/${file}`, `/guide/${slug}`);
  NORMALIZED_LINK_MAP.set(file, `/guide/${slug}`);
}
// Playbooks remain public source documents; copied guide/RFC pages link to
// their canonical source instead of a nonexistent relative site directory.
for (const file of await readdir(join(REPO_ROOT, 'docs/playbooks'))) {
  if (!file.endsWith('.md')) continue;
  const url = `${GITHUB_BLOB}/docs/playbooks/${file}`;
  NORMALIZED_LINK_MAP.set(`docs/playbooks/${file}`, url);
  NORMALIZED_LINK_MAP.set(`playbooks/${file}`, url);
  if (file !== 'README.md') NORMALIZED_LINK_MAP.set(file, url);
}


function rewriteLinks(md) {
  // Markdown link: [text](url) and [text](url#frag)
  return md.replace(/\]\(([^)]+)\)/g, (full, target) => {
    // Skip absolute URLs and anchors
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('#') || target.startsWith('mailto:')) {
      return full;
    }

    const [path, originalFrag] = splitFrag(target);
    // Historical RFC/release anchor spellings resolve to current headings.
    const historicalAnchors = {
      '#ii1-tier-1--reader': '#ii-1-reader',
      '#ii3-tier-3--calc-host': '#ii-2-verifier',
      '#ii2-tier-2--editor': '#ii-4-starter-product-claims',
      '#ii4-tier-4--agent-host': '#ii-4-starter-product-claims',
      '#appendix-d--worked-example-tier-1-reader-in-500-loc': '#appendix-d-worked-example-a-reader-in-500-loc',
      '#ix-ai-host-contract-tier-4': '#ix-ai-host-contract',
    };
    const frag = historicalAnchors[originalFrag] ?? originalFrag;
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

    // Corpus ownership and its schemas are source artifacts, not site pages.
    // Keep their new links usable without changing the site's navigation.
    if (/^(?:conformance\/)?corpus-index\.json$/.test(norm)) {
      return `](${GITHUB_BLOB}/conformance/corpus-index.json${frag})`;
    }
    const corpusSchema = norm.match(/^(?:(?:spec\/)?schemas\/)?(conformance-(?:case|corpus)\.schema\.json)$/);
    if (corpusSchema) {
      return `](${GITHUB_BLOB}/spec/schemas/${corpusSchema[1]}${frag})`;
    }

    // JSON Schemas are not site pages; the starter guide links them by repo
    // path (../../spec/schemas/...), so send those to GitHub too.
    if (/^spec\/schemas\/[^/]+\.json$/.test(norm)) {
      return `](${GITHUB_BLOB}/${norm}${frag})`;
    }

    // Paths into source/code dirs → link out to GitHub.
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

// Do not let a retired generated page mask dead links in an incremental build.
await rm(join(SITE_ROOT, 'spec', 'format-v2.md'), { force: true });
// This directory contains only generated corpus pages. Clear it before copies
// so removed pages cannot survive an incremental build as unintended routes.
const generatedCorpus = resolve(SITE_ROOT, 'conformance');
if (relative(SITE_ROOT, generatedCorpus) !== 'conformance') throw new TypeError('Generated corpus path escaped site root');
await rm(generatedCorpus, { recursive: true, force: true });

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

// The version card uses the same source constants as the generated spec title,
// plus the published generation and its npm scope, kept as separate fields.
await mkdir(join(SITE_ROOT, 'about'), { recursive: true });
await writeFile(join(SITE_ROOT, 'about/versions.json'), JSON.stringify(SITE_VERSIONS), 'utf8');
