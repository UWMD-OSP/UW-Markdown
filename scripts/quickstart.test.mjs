import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('the quickstart pins one synthetic record and the published CLI for every main-path command', () => {
  const guide = readFileSync(new URL('../tools/docs-site/tutorials/quickstart.md', import.meta.url), 'utf8');
  const commands = [...guide.matchAll(/^npx [^\n]+/gm)].map(match => match[0]);
  assert.ok(commands.length >= 6);
  for (const command of commands) assert.match(command, /^npx --yes @uwmd\/cli@4\.3\.0 /);
  assert.doesNotMatch(guide, /raw\.githubusercontent\.com\/UWMD-OSP\/UW-Markdown\/main\//);
  assert.match(guide, /Exit 0 means no validation errors under the selected policy/);
  assert.match(guide, /quickstart\.uwx\.md/);
  assert.doesNotMatch(guide, /use a fresh scaffold for this conversion exercise/);
});
