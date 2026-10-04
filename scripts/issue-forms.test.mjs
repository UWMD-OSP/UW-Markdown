import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkIssueForms } from './issue-forms.mjs';

const LABELS = [
  { name: 'bug', color: 'd73a4a', description: 'Implementation departs from specified behavior' },
  { name: 'needs-triage', color: 'fbca04', description: 'Received' },
];

const FORM = `name: Bug
description: A defect.
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: See https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/FEEDBACK.md
  - type: dropdown
    id: kind
    attributes:
      label: Kind
      options: ["A", "B"]
  - type: textarea
    id: repro
    attributes:
      label: Reproduction
      render: json
`;

const GUIDE = `# Feedback

[Report](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=bug.yml)

## Labels

| Label | Meaning |
|---|---|
| \`bug\` | Defect |
| \`needs-triage\` | New |

## Next
`;

// Builds a minimal repository that passes, then applies `edits` (path → text).
function withRepo(edits, fn) {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-forms-'));
  try {
    const files = {
      '.github/labels.json': JSON.stringify(LABELS),
      '.github/ISSUE_TEMPLATE/bug.yml': FORM,
      'docs/FEEDBACK.md': GUIDE,
      ...edits,
    };
    for (const [path, text] of Object.entries(files)) {
      if (text === null) continue;
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return fn(checkIssueForms(root));
  } finally {
    // root is the exact directory returned by mkdtempSync, under the OS temp directory.
    rmSync(root, { recursive: true, force: true });
  }
}

const failuresMatching = (result, pattern) => result.failures.filter((f) => pattern.test(f));

test('a consistent repository passes', () => {
  withRepo({}, (result) => assert.deepEqual(result.failures, []));
});

test('a form that applies a label missing from the manifest fails (the original drift)', () => {
  // Exactly what main shipped: bug.yml applied needs-triage, which GitHub
  // did not have, so it was dropped without an error.
  withRepo({ '.github/labels.json': JSON.stringify([LABELS[0]]) }, (result) => {
    assert.equal(failuresMatching(result, /applies label "needs-triage"/).length, 1);
  });
});

test('unparseable YAML fails instead of being skipped', () => {
  const broken = FORM.replace('label: Kind', 'label: Kind\n      description: e.g. asset_class: office');
  withRepo({ '.github/ISSUE_TEMPLATE/bug.yml': broken }, (result) => {
    assert.equal(failuresMatching(result, /is not valid YAML/).length, 1);
  });
});

test('structural mistakes GitHub would reject are caught', () => {
  const bad = FORM.replace('id: repro', 'id: kind')
    .replace('options: ["A", "B"]', 'options: ["A", "None", "A"]')
    .replace('  - type: textarea\n    id: kind\n    attributes:\n      label: Reproduction\n      render: json',
      '  - type: input\n    id: kind\n    attributes:\n      label: Reproduction\n      render: json');
  withRepo({ '.github/ISSUE_TEMPLATE/bug.yml': bad }, (result) => {
    assert.equal(failuresMatching(result, /id "kind" is used twice/).length, 1);
    assert.equal(failuresMatching(result, /option "None" is reserved/).length, 1);
    assert.equal(failuresMatching(result, /option "A" is listed twice/).length, 1);
    assert.equal(failuresMatching(result, /"render" applies only to textarea/).length, 1);
  });
});

test('a document linking to a form that does not exist fails', () => {
  withRepo({ 'CONTRIBUTING.md': '[Bug](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=bug-report.yml)' }, (result) => {
    assert.equal(failuresMatching(result, /CONTRIBUTING\.md: links to issue form "bug-report\.yml"/).length, 1);
  });
});

test('the guide must explain every label and describe only real ones', () => {
  const guide = GUIDE.replace('| `needs-triage` | New |', '| `needs-discussion` | Old |');
  withRepo({ 'docs/FEEDBACK.md': guide }, (result) => {
    assert.equal(failuresMatching(result, /does not explain label `needs-triage`/).length, 1);
    assert.equal(failuresMatching(result, /describes `needs-discussion`, which is not in/).length, 1);
  });
});

test('repository links in forms and the chooser config must resolve', () => {
  const config = `blank_issues_enabled: false
contact_links:
  - name: Security
    url: https://github.com/UWMD-OSP/UW-Markdown/blob/main/SECURITY.md
    about: Email us.
`;
  withRepo({ '.github/ISSUE_TEMPLATE/config.yml': config, 'docs/FEEDBACK.md': null }, (result) => {
    assert.equal(failuresMatching(result, /contact_links\[0\]: links to .*SECURITY\.md, which does not exist/).length, 1);
    assert.equal(failuresMatching(result, /body\[0\]: links to .*docs\/FEEDBACK\.md, which does not exist/).length, 1);
    // config.yml is the chooser, not a form, so it is not held to the form rules.
    assert.equal(failuresMatching(result, /config\.yml: needs a non-empty top-level/).length, 0);
  });
});

test('label manifest entries must be valid GitHub labels', () => {
  const labels = [...LABELS, { name: 'BUG', color: '#d73a4a', description: 'x'.repeat(101) }];
  withRepo({ '.github/labels.json': JSON.stringify(labels) }, (result) => {
    assert.equal(failuresMatching(result, /"BUG" is listed twice/).length, 1);
    assert.equal(failuresMatching(result, /six-digit lowercase hex/).length, 1);
    assert.equal(failuresMatching(result, /at most 100 characters/).length, 1);
  });
});
