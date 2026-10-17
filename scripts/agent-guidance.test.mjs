import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentGuidanceFailures } from './agent-guidance.mjs';
const block = '<!-- owner-rule:start -->\n## Owner rule\n\nLaunch together; no prelaunch compatibility.\n<!-- owner-rule:end -->';
const agents = `# AGENTS\n\n${block}\n\nFull shared guidance.`;
const claude = `# CLAUDE\n\n${block}\n\n@AGENTS.md\n`;
test('the matching near-top rule is allowed while CLAUDE still imports shared guidance', () => {
  assert.deepEqual(agentGuidanceFailures(agents, claude), []);
  assert.deepEqual(agentGuidanceFailures(agents, claude.replaceAll('\n', '\r\n')), []);
});
test('one-sided policy drift, missing or duplicate blocks and hidden late rules fail', () => {
  for (const bad of [claude.replace('Launch together', 'Launch separately'), claude.replace(block, ''), `${claude}\n${block}`, `# CLAUDE\n${'x'.repeat(120)}\n${block}\n@AGENTS.md`]) assert.ok(agentGuidanceFailures(agents, bad).length);
  assert.ok(agentGuidanceFailures('# AGENTS', claude).some(x => x.startsWith('AGENTS.md')));
});
test('the owner-rule exception does not admit unrelated duplicated guidance or remove the import', () => {
  assert.ok(agentGuidanceFailures(agents, `${claude}\n## Other rules\nDo something else.`).length);
  assert.ok(agentGuidanceFailures(agents, claude.replace('@AGENTS.md', '')).length);
});
