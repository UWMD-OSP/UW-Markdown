import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentGuidanceFailures } from './agent-guidance.mjs';
const agents = '# AGENTS\n\nShared contributor guidance.';
const claude = '@AGENTS.md\n';
const tools = '@../AGENTS.md\n';
test('root and tool entry points import the same shared guide with either line ending', () => {
  assert.deepEqual(agentGuidanceFailures(agents, claude, tools), []);
  assert.deepEqual(agentGuidanceFailures(agents, claude.replaceAll('\n', '\r\n'), tools.replaceAll('\n', '\r\n')), []);
});
test('duplicated guidance, alternate imports and missing pointers fail', () => {
  for (const bad of ['', '@OTHER.md', `${claude}\nAdditional rules.`, `${claude}${claude}`]) {
    assert.ok(agentGuidanceFailures(agents, bad, tools).some(x => x.startsWith('CLAUDE.md')));
  }
  for (const bad of ['', '@AGENTS.md', `${tools}\nAdditional rules.`]) {
    assert.ok(agentGuidanceFailures(agents, claude, bad).some(x => x.startsWith('tools/CLAUDE.md')));
  }
});
test('entry points cannot replace an empty shared guide', () => {
  assert.ok(agentGuidanceFailures(' \r\n', claude, tools).some(x => x.startsWith('AGENTS.md')));
});
