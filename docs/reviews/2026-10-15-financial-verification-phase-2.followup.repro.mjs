// Read-only observations and an in-memory #349 proposal; never writes baselines.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(process.argv[2] ?? '.');
const core = await import(pathToFileURL(join(repo, 'packages/uwmd-core/dist/index.js')));
const rendererPath = join(repo, 'packages/uwmd-core/dist/renderer.js');
let proposalCode = readFileSync(rendererPath, 'utf8');
const oldMap = 'const flowLines = flows.slice(0, 10).map((f, i) => {';
const oldLabel = 'Yr${i + 1}: NOI=';
assert.equal(proposalCode.split(oldMap).length, 2, 'Re-review changed renderer before probing');
assert.equal(proposalCode.split(oldLabel).length, 2);
proposalCode = proposalCode.replace(oldMap, 'const flowLines = flows.slice(0, 10).map((f) => {')
  .replace(oldLabel, "Yr${val(flow['year'])}: NOI=")
  .replace(/from '(\.[^']+)'/g, (_match, path) => `from '${pathToFileURL(resolve(dirname(rendererPath), path))}'`)
  .replace("from '@uwmd/verify'", `from '${pathToFileURL(join(repo, 'packages/uwmd-verify/dist/index.js'))}'`);
const proposal = await import(`data:text/javascript;base64,${Buffer.from(proposalCode).toString('base64')}`);
const hash = text => createHash('sha256').update(text).digest('hex');
const fixturePath = 'conformance/documents/fixtures/13-period-identities.uwx.md';
const original = readFileSync(join(repo, fixturePath), 'utf8');
const originalParsed = core.parseUWFile(original);
const dcf = originalParsed.sections.dcf;
const payload = JSON.parse(dcf.rawJson);
const renderedRows = text => text.split('\n').filter(line => line.startsWith('  Yr'));
const cases = [
  ['existing duplicate/missing fixture', payload.annual_cash_flows],
  ['reordered', [{ year: 3, noi: 300 }, { year: 1, noi: 100 }]],
  ['sparse', [{ year: 2, noi: 100 }, { year: 7, noi: 101 }]],
  ['missing', [{ noi: 300 }]],
  ['duplicate', [{ year: 1, noi: 100 }, { year: 1, noi: 101 }]],
  ['sequential positive control', [{ year: 1, noi: 100 }, { year: 2, noi: 101 }]],
  ['empty positive control', []],
];
const yearLabels = [];
for (const [name, rows] of cases) {
  const source = name.startsWith('existing') ? original : original.replace(dcf.rawJson, JSON.stringify({ ...payload, annual_cash_flows: rows }, null, 2));
  const parsed = core.parseUWFile(source);
  const before = JSON.stringify(parsed);
  const validation = JSON.stringify(core.validateUWFile(parsed));
  const actual = core.render(parsed, { format: 'chat' });
  const proposed = proposal.render(parsed, { format: 'chat' });
  const actualRows = renderedRows(actual.content);
  const proposedRows = renderedRows(proposed.content);
  assert.deepEqual(actualRows.map(row => row.slice(row.indexOf(':'))), proposedRows.map(row => row.slice(row.indexOf(':'))), 'Amounts/order must stay identical');
  assert.equal(JSON.stringify(parsed), before, 'Rendering must not mutate the source representation');
  assert.equal(JSON.stringify(core.validateUWFile(parsed)), validation, 'Diagnostics must not change');
  const rest = value => { const { content: _content, estimatedTokens: _tokens, ...other } = value; return other; };
  assert.deepEqual(rest(actual), rest(proposed));
  if (name.startsWith('existing')) {
    const baseline = JSON.parse(readFileSync(join(repo, 'conformance/documents/expected/13-period-identities.rendered-chat.txt'), 'utf8'));
    assert.equal(actual.content, baseline.content);
    assert.equal(actual.estimatedTokens, baseline.estimatedTokens);
    assert.equal(proposed.content, baseline.content.replace('Yr2: NOI=$101', 'Yr1: NOI=$101').replace('Yr3: NOI=$300', 'Yrn/a: NOI=$300'));
  }
  if (name.includes('positive control')) assert.deepEqual(actual, proposed);
  yearLabels.push({ name, input_rows: rows, actual_rows: actualRows, proposed_rows: proposedRows, actual_tokens: actual.estimatedTokens, proposed_tokens: proposed.estimatedTokens, source_sha256: hash(source), source_and_diagnostics_unchanged: true });
}
const compaction = [];
for (const path of ['conformance/documents/malformed/04-broken-chain.uwx.md', 'examples/parkview-after-L6.uwx.md']) {
  const source = readFileSync(join(repo, path), 'utf8');
  const parsed = core.parseUWFile(source);
  const beforeHash = hash(parsed.raw);
  const compacted = core.compact(parsed);
  const after = core.parseUWFile(compacted);
  const chainBefore = await core.verifyChain(parsed);
  const chainAfter = await core.verifyChain(after);
  const policyBefore = core.verifyProvenance(parsed);
  const policyAfter = core.verifyProvenance(after);
  assert.equal(hash(parsed.raw), beforeHash);
  for (const [id, block] of Object.entries(parsed.sections)) assert.deepEqual(after.sections[id]?.content, block.content, `${id}: current payload drifted`);
  const logEntries = value => value.pipeline_log.flatMap(block => block.content.entries ?? []).length;
  compaction.push({ path, input_sha256: beforeHash, compacted_sha256: hash(compacted), original_source_unchanged: true, current_payloads_unchanged: true, chain_before: { ok: chainBefore.ok, issues: chainBefore.issues.map(issue => issue.code) }, chain_after: { ok: chainAfter.ok, issues: chainAfter.issues.map(issue => issue.code) }, policy_before: { ok: policyBefore.ok, issues: policyBefore.issues.map(issue => issue.code) }, policy_after: { ok: policyAfter.ok, issues: policyAfter.issues.map(issue => issue.code) }, pipeline_entries_before: logEntries(parsed), pipeline_entries_after: logEntries(after) });
}
console.log(JSON.stringify({ scope: '4.3.0 reference implementation observations; #349 label proposal only, not accepted behavior; no financial arithmetic or baseline writes', year_labels: yearLabels, compaction }, null, 2));
