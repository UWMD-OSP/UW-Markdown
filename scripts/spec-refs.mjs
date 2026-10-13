// Spec cross-reference check. Every `§` target that the Format or Protocol spec
// or a `spec_ref` in protocol.ts names must exist as a heading in the document
// it points at, and every relative markdown link from a spec into spec/ or the
// starter guide must land on a real file and anchor.
//
// Why: RFC 0081 Phase 2 deleted the protocol's starter stubs and merged two
// format specs. References to the removed sections kept pointing at nothing,
// and no gate noticed (PR #308 review, finding S3).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FORMAT = 'spec/UW_FORMAT_SPEC.md';
export const PROTOCOL = 'spec/UW_PROTOCOL.md';
const ROMAN = /^(?:X{0,3})(?:IX|IV|V?I{0,3})$/;
const LABEL = String.raw`(?:[IVX]+|\d+)(?:\.[0-9a-z]+)*`;
const FENCE_OPEN = /^```/;
const FENCE_CLOSE = /^```\s*$/;

/** GitHub-style heading slug: lowercase, drop punctuation, spaces to hyphens. */
export function slug(title) {
  return title
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** VitePress (docs-site) heading slug, the other style links in this repo use. */
export function siteSlug(title) {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}

const isRoman = (label) => !/^\d/.test(label) && ROMAN.test(label.split('.')[0]);

/** Section labels and link anchors declared by a markdown file. */
export function headingIndex(text) {
  const labels = new Set();
  const anchors = new Set();
  let fenced = false;
  let parent = null; // the labelled heading a "#### 4. Reserve treatment" item sits under
  for (const line of text.split('\n')) {
    if (fenced ? FENCE_CLOSE.test(line) : FENCE_OPEN.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    for (const m of line.matchAll(/<a id="([^"]+)"/g)) anchors.add(m[1]);
    const h = line.match(/^(#{1,6})\s+(.*?)\s*(?:\{#([^}]+)\})?$/);
    if (!h) continue;
    const [, hashes, title, explicit] = h;
    if (explicit) anchors.add(explicit);
    anchors.add(slug(title));
    anchors.add(siteSlug(title));
    // "§ 4.4 — Operating", "4.29 Capacity", "V.9 Canonical", "X. Module", "2.5f The"
    const label = title.match(new RegExp(`^(?:§\\s*)?(${LABEL})\\.?(?:\\s|$)`))?.[1];
    if (label && (/^\d/.test(label) || isRoman(label))) {
      labels.add(label);
      if (/^\d+$/.test(label) && parent && hashes.length > parent.depth && isRoman(parent.label)) {
        labels.add(`${parent.label}.${label}`); // "#### 4." under "### VIII.9.6" is §VIII.9.6.4
      } else {
        parent = { label, depth: hashes.length };
      }
    }
    const part = title.match(/^(Part [IVX]+|Appendix [A-Z])\b/);
    if (part) labels.add(part[1]);
  }
  return { labels, anchors };
}

/** The executable protocol, whose spec_ref values this checks (in `@uwmd/verify`, RFC 0083). */
export const PROTOCOL_TS = 'packages/uwmd-verify/src/protocol.ts';

/** "V.7-§V.8" and "2.4–§2.5" name both endpoints. */
const endpoints = (target) => target.split(/\s*[-–]\s*§?\s*/).filter(Boolean);

/**
 * Collect problems. `files` maps a repo-relative path to its text: every
 * spec/**.md, every docs/starter/*.md, and packages/uwmd-verify/src/protocol.ts.
 */
export function collectSpecRefProblems(files) {
  const problems = [];
  const idx = {};
  for (const [path, text] of Object.entries(files)) if (path.endsWith('.md')) idx[path] = headingIndex(text);
  const named = {
    'UW_FORMAT_SPEC.md': FORMAT, UW_FORMAT_SPEC: FORMAT, 'format spec': FORMAT, format: FORMAT, Format: FORMAT,
    'UW_PROTOCOL.md': PROTOCOL, UW_PROTOCOL: PROTOCOL, protocol: PROTOCOL, Protocol: PROTOCOL,
  };
  const check = (where, doc, label) => {
    if (!idx[doc]) { problems.push(`${where}: unknown document ${doc}`); return; }
    for (const end of endpoints(label)) {
      if (!idx[doc].labels.has(end)) problems.push(`${where}: §${end} does not exist in ${doc}`);
    }
  };

  // 1. spec_ref values in protocol.ts (remediations and registries).
  const protocolTs = files[PROTOCOL_TS];
  if (protocolTs) {
    for (const m of protocolTs.matchAll(/spec_ref:\s*'([^']*)'/g)) {
      const ref = m[1];
      const where = `protocol.ts:${protocolTs.slice(0, m.index).split('\n').length} spec_ref '${ref}'`;
      let doc = FORMAT; // a bare "§5.2" in a remediation names the Format spec
      for (const piece of ref.split(/\s+\/\s+|\s*,\s*/)) {
        const file = piece.match(/^(docs\/starter\/[\w-]+\.md|UW_[A-Z_]+\.md)\b/)?.[1];
        if (file) doc = file.startsWith('docs/') ? file : `spec/${file}`;
        if (/^RFC \d{4}/.test(piece)) continue;
        const appendix = piece.match(/Appendix [A-Z]/)?.[0];
        const section = piece.match(new RegExp(`§\\s*(${LABEL}(?:\\s*[-–]\\s*§?\\s*${LABEL})?)`))?.[1];
        if (appendix) check(where, doc, appendix);
        else if (section) check(where, doc, section);
        else if (!file) problems.push(`${where}: unrecognized reference "${piece}"`);
      }
    }
  }

  // 2. Section references in the Format and Protocol specs. A qualifier names the
  // document; a bare Roman label is the Protocol, a bare Arabic label the Format.
  // References qualified by another document (an RFC, the starter guide) are skipped.
  const ref = new RegExp(
    String.raw`(?:(UW_FORMAT_SPEC(?:\.md)?|UW_PROTOCOL(?:\.md)?|format spec|[Ff]ormat|[Pp]rotocol|[Ss]tarter guide|RFC \d{4}(?:'s)?|UW_[A-Z_]+(?:\.md)?|[Ss]chema|[Ss]pec)\s+)?§\s?(${LABEL}(?:\s*[-–]\s*§?\s?${LABEL})?)`,
    'g',
  );
  // Other spec files and the JSON Schemas number their own sections, so only
  // their Format- or Protocol-qualified references are checked.
  for (const doc of Object.keys(files).filter((path) => path.startsWith('spec/'))) {
    const primary = doc === FORMAT || doc === PROTOCOL;
    let fenced = false;
    files[doc].split('\n').forEach((line, i) => {
      if (doc.endsWith('.md') && (fenced ? FENCE_CLOSE.test(line) : FENCE_OPEN.test(line))) { fenced = !fenced; return; }
      if (fenced) return;
      // "[`UW_PROTOCOL.md`](UW_PROTOCOL.md) §V.9" qualifies the reference by the
      // linked file; any other link is dropped, text included (step 3 checks it).
      const prose = line
        .replace(/\[[^\]]*\]\((?:[^)]*\/)?(UW_[A-Z_]+\.md)\)\s*(?=§)/g, '$1 ')
        .replace(/\[[^\]]*\]\([^)]*\)/g, '');
      for (const m of prose.matchAll(ref)) {
        const [, qualifier, raw] = m;
        if (qualifier ? !named[qualifier] : !primary) continue;
        const label = raw.replace(/\.$/, '');
        check(`${doc}:${i + 1}`, qualifier ? named[qualifier] : isRoman(label) ? PROTOCOL : FORMAT, label);
      }
    });
  }

  // 3. Relative markdown links from spec/**.md into spec/ or docs/starter/.
  for (const [path, text] of Object.entries(files)) {
    if (!path.startsWith('spec/') || !path.endsWith('.md')) continue;
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+?\.md)(#[^)\s]+)?\)/g)) {
        const target = join(dirname(path), m[1]).replace(/\\/g, '/');
        if (!target.startsWith('spec/') && !target.startsWith('docs/starter/')) continue;
        const where = `${path}:${i + 1}`;
        if (!(target in files)) problems.push(`${where}: link to missing file ${target}`);
        else if (m[2] && !idx[target].anchors.has(decodeURIComponent(m[2].slice(1)))) {
          problems.push(`${where}: link anchor ${m[2]} does not exist in ${target}`);
        }
      }
    });
  }
  return problems;
}

/** Read the documents the check needs from a repository root. */
export function loadSpecRefFiles(root) {
  const files = {};
  const add = (rel) => { files[rel] = readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n'); };
  for (const dir of ['spec', 'docs/starter']) {
    for (const entry of readdirSync(join(root, dir), { recursive: true })) {
      const name = String(entry).replace(/\\/g, '/');
      if (name.endsWith('.md') || (dir === 'spec' && name.endsWith('.schema.json'))) add(`${dir}/${name}`);
    }
  }
  if (existsSync(join(root, PROTOCOL_TS))) add(PROTOCOL_TS);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const problems = collectSpecRefProblems(loadSpecRefFiles(root));
  for (const problem of problems) console.error(problem);
  console.log(problems.length ? `${problems.length} dangling spec reference(s)` : 'spec references: every target exists');
  process.exitCode = problems.length ? 1 : 0;
}
