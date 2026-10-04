// Verify the issue forms, .github/labels.json and docs/FEEDBACK.md agree.
// The rules and their rationale live in issue-forms.mjs.
//
// Run: npm run verify-issue-forms

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkIssueForms } from './issue-forms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { failures, checks } = checkIssueForms(root);

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  console.error(`\nSummary: ${failures.length} issue-form mismatch(es).`);
  process.exit(1);
}

for (const check of checks) console.log(`[PASS] ${check}`);
console.log('\nSummary: issue forms, labels and the feedback guide agree.');
