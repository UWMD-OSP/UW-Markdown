// Checks that the issue forms, the label manifest and the documents that
// describe them agree with each other.
//
// The forms used to apply three labels (`needs-triage`, `spec`,
// `needs-discussion`) that did not exist on GitHub. An issue form that names a
// missing label does not fail: GitHub drops the label without a word, so every
// report arrived unlabelled and nothing went red. The label manifest
// (.github/labels.json) is now the one list; a workflow creates those labels on
// GitHub, and this check holds the forms and docs/FEEDBACK.md to it.
//
// GitHub validates a form only when someone opens the issue page, so the
// structural rules below repeat the parts of its issue-form syntax a typo can
// break: element types, unique ids and labels, the reserved "None" option.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const FORMS_DIR = '.github/ISSUE_TEMPLATE';
export const LABELS_FILE = '.github/labels.json';
export const FEEDBACK_DOC = 'docs/FEEDBACK.md';
// Documents that link to a form by `issues/new?template=<file>`.
export const LINKING_DOCS = ['CONTRIBUTING.md', 'SECURITY.md', 'README.md', FEEDBACK_DOC];

const REPO_BLOB = 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/';
const ELEMENT_TYPES = new Set(['markdown', 'textarea', 'input', 'dropdown', 'checkboxes']);
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Returns { failures, checks } for the repository rooted at `root`. */
export function checkIssueForms(root) {
  const failures = [];
  const checks = [];
  const read = (p) => readFileSync(join(root, p), 'utf8');

  // ── Label manifest ─────────────────────────────────────────────────────────
  let labels = [];
  try {
    labels = JSON.parse(read(LABELS_FILE));
  } catch (err) {
    failures.push(`${LABELS_FILE}: cannot be read as JSON (${err.message}).`);
  }
  if (!Array.isArray(labels)) {
    failures.push(`${LABELS_FILE}: must be an array of labels.`);
    labels = [];
  }
  const labelNames = new Set();
  for (const [i, label] of labels.entries()) {
    const where = `${LABELS_FILE}[${i}]`;
    if (typeof label?.name !== 'string' || label.name.trim() === '') {
      failures.push(`${where}: needs a non-empty "name".`);
      continue;
    }
    if (labelNames.has(label.name.toLowerCase())) {
      failures.push(`${where}: "${label.name}" is listed twice (GitHub label names ignore case).`);
    }
    labelNames.add(label.name.toLowerCase());
    if (!/^[0-9a-f]{6}$/.test(label.color ?? '')) {
      failures.push(`${where}: "${label.name}" needs a six-digit lowercase hex "color" without "#".`);
    }
    if (typeof label.description !== 'string' || label.description.length > 100) {
      failures.push(`${where}: "${label.name}" needs a "description" of at most 100 characters (GitHub's limit).`);
    }
  }
  const knownLabel = (name) => labelNames.has(String(name).toLowerCase());

  // ── Forms ──────────────────────────────────────────────────────────────────
  const formFiles = existsSync(join(root, FORMS_DIR))
    ? readdirSync(join(root, FORMS_DIR))
        .filter((f) => /\.ya?ml$/.test(f) && !/^config\.ya?ml$/.test(f))
        .sort()
    : [];
  if (formFiles.length === 0) {
    failures.push(`${FORMS_DIR}: no issue forms found.`);
  }

  for (const file of formFiles) {
    const path = `${FORMS_DIR}/${file}`;
    let form;
    try {
      form = parse(read(path));
    } catch (err) {
      failures.push(`${path}: is not valid YAML (${err.message.split('\n')[0]}).`);
      continue;
    }
    for (const key of ['name', 'description']) {
      if (typeof form?.[key] !== 'string' || form[key].trim() === '') {
        failures.push(`${path}: needs a non-empty top-level "${key}".`);
      }
    }
    const formLabels = typeof form?.labels === 'string' ? form.labels.split(',').map((l) => l.trim()) : form?.labels ?? [];
    for (const label of formLabels) {
      if (!knownLabel(label)) {
        failures.push(
          `${path}: applies label "${label}", which is not in ${LABELS_FILE}. GitHub silently drops a label that does not exist.`,
        );
      }
    }
    if (!Array.isArray(form?.body) || form.body.length === 0) {
      failures.push(`${path}: needs a non-empty "body".`);
      continue;
    }
    const ids = new Set();
    const elementLabels = new Set();
    for (const [i, el] of form.body.entries()) {
      const where = `${path} body[${i}]`;
      if (!ELEMENT_TYPES.has(el?.type)) {
        failures.push(`${where}: unknown element type "${el?.type}".`);
        continue;
      }
      const attrs = el.attributes ?? {};
      if (el.id !== undefined) {
        if (!ID_PATTERN.test(String(el.id))) failures.push(`${where}: id "${el.id}" may use only letters, digits, "-" and "_".`);
        if (ids.has(el.id)) failures.push(`${where}: id "${el.id}" is used twice.`);
        ids.add(el.id);
      }
      if (el.type === 'markdown') {
        if (typeof attrs.value !== 'string' || attrs.value.trim() === '') failures.push(`${where}: markdown needs "attributes.value".`);
        if (el.validations) failures.push(`${where}: markdown elements take no "validations".`);
        checkRepoLinks(root, attrs.value, where, failures);
        continue;
      }
      if (typeof attrs.label !== 'string' || attrs.label.trim() === '') {
        failures.push(`${where}: needs "attributes.label".`);
      } else {
        if (elementLabels.has(attrs.label)) failures.push(`${where}: label "${attrs.label}" is used twice.`);
        elementLabels.add(attrs.label);
      }
      checkRepoLinks(root, attrs.description, where, failures);
      if (attrs.render !== undefined && el.type !== 'textarea') {
        failures.push(`${where}: "render" applies only to textarea elements.`);
      }
      if (el.type === 'dropdown') {
        checkOptions(attrs.options, where, failures, (o) => o, (o) => /^none$/i.test(o) && `option "${o}" is reserved by GitHub`);
      }
      if (el.type === 'checkboxes') {
        checkOptions(attrs.options, where, failures, (o) => o?.label);
      }
    }
  }
  checks.push(`${formFiles.length} issue forms apply only labels from ${LABELS_FILE}`);

  // ── Chooser configuration ─────────────────────────────────────────────────
  const configPath = `${FORMS_DIR}/config.yml`;
  if (existsSync(join(root, configPath))) {
    let config;
    try {
      config = parse(read(configPath));
    } catch (err) {
      failures.push(`${configPath}: is not valid YAML (${err.message.split('\n')[0]}).`);
    }
    if (config) {
      if (config.blank_issues_enabled !== undefined && typeof config.blank_issues_enabled !== 'boolean') {
        failures.push(`${configPath}: "blank_issues_enabled" must be true or false.`);
      }
      for (const [i, link] of (config.contact_links ?? []).entries()) {
        const where = `${configPath} contact_links[${i}]`;
        for (const key of ['name', 'url', 'about']) {
          if (typeof link?.[key] !== 'string' || link[key].trim() === '') failures.push(`${where}: needs "${key}".`);
        }
        checkRepoLinks(root, link?.url, where, failures);
      }
      checks.push(`${configPath} links resolve to files in the repository`);
    }
  }

  // ── Documents that point at the forms ─────────────────────────────────────
  for (const doc of LINKING_DOCS) {
    if (!existsSync(join(root, doc))) continue;
    for (const m of read(doc).matchAll(/issues\/new\?template=([^)\s"'&#]+)/g)) {
      if (!formFiles.includes(m[1])) {
        failures.push(`${doc}: links to issue form "${m[1]}", which does not exist in ${FORMS_DIR}.`);
      }
    }
  }

  // ── The feedback guide documents every label, and only real ones ─────────
  if (existsSync(join(root, FEEDBACK_DOC))) {
    const guide = read(FEEDBACK_DOC);
    for (const label of labels) {
      if (typeof label?.name === 'string' && !guide.includes(`\`${label.name}\``)) {
        failures.push(`${FEEDBACK_DOC}: does not explain label \`${label.name}\` from ${LABELS_FILE}.`);
      }
    }
    const section = guide.split(/^## Labels\s*$/m)[1]?.split(/^## /m)[0] ?? '';
    for (const m of section.matchAll(/^\| `([^`]+)` \|/gm)) {
      if (!knownLabel(m[1])) {
        failures.push(`${FEEDBACK_DOC}: the Labels table describes \`${m[1]}\`, which is not in ${LABELS_FILE}.`);
      }
    }
    checks.push(`${FEEDBACK_DOC} explains all ${labels.length} labels`);
  } else {
    failures.push(`${FEEDBACK_DOC}: missing — the forms link to it.`);
  }

  return { failures, checks };
}

function checkOptions(options, where, failures, labelOf, reserved = () => false) {
  if (!Array.isArray(options) || options.length === 0) {
    failures.push(`${where}: needs a non-empty "options" list.`);
    return;
  }
  const seen = new Set();
  for (const option of options) {
    const label = labelOf(option);
    if (typeof label !== 'string' || label.trim() === '') {
      failures.push(`${where}: has an empty option.`);
      continue;
    }
    if (seen.has(label)) failures.push(`${where}: option "${label}" is listed twice.`);
    seen.add(label);
    const why = reserved(label);
    if (why) failures.push(`${where}: ${why}.`);
  }
}

// A form is read on github.com, so it links with absolute URLs. Those that
// point into this repository must name a file that exists.
function checkRepoLinks(root, text, where, failures) {
  if (typeof text !== 'string') return;
  for (const m of text.matchAll(/https:\/\/github\.com\/UWMD-OSP\/UW-Markdown\/blob\/main\/([^)\s"'#]+)/g)) {
    if (!existsSync(join(root, m[1]))) {
      failures.push(`${where}: links to ${REPO_BLOB}${m[1]}, which does not exist.`);
    }
  }
}
