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

const GENERATED_DIRS = ['spec', 'conformance', 'about'];

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
  { from: 'spec/UW_PROTOCOL_v1.md',      to: 'spec/protocol.md', title: 'UW Protocol Specification (v1.0)' },
  { from: 'spec/schemas/README.md',      to: 'spec/schemas/index.md', title: 'JSON Schemas' },

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

  // RFCs
  { from: 'docs/rfcs/README.md',       to: 'about/rfcs/index.md', title: 'RFC Process' },
  { from: 'docs/rfcs/0000-template.md', to: 'about/rfcs/template.md', title: 'RFC Template' },
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
  ['LICENSE', 'https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0/blob/main/LICENSE'],

  // Spec
  ['spec/UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['spec/UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['UW_FORMAT_SPEC_v1.md', '/spec/format'],
  ['UW_PROTOCOL_v1.md', '/spec/protocol'],
  ['spec/schemas/', '/spec/schemas/'],
  ['spec/schemas/README.md', '/spec/schemas/'],
  ['schemas/', '/spec/schemas/'],
  ['schemas/README.md', '/spec/schemas/'],

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

const GITHUB_BLOB = 'https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0/blob/main';

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
  await writeFile(dst, md, 'utf8');
  console.log(`[copy]  ${c.from}  →  ${relative(SITE_ROOT, dst)}`);
  count++;
}

console.log(`\nCopied ${count} files.`);
