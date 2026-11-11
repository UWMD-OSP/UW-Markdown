import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const wiki = read('docs/wiki/11-build-release-governance.md');
const orientation = read('docs/wiki/README.md');
const governance = read('GOVERNANCE.md');
const compact = text => text.replace(/\s+/g, ' ');

function requireClaims(text, claims) {
  const normalized = compact(text);
  for (const [category, pattern] of claims) {
    // Failures identify the contract without echoing document contents.
    assert.ok(pattern.test(normalized), category);
  }
}

test('wiki routes through neutral maintainer sources and retains generic tracked coverage', () => {
  for (const guide of [wiki, orientation]) {
    requireClaims(guide, [
      ['maintainer source', /MAINTAINERS\.md/],
      ['ownership source', /\.github\/CODEOWNERS/],
      ['neutral routing', /neutral maintainer ownership/],
    ]);
  }
  requireClaims(wiki, [
    ['routing reflects pointer-only ownership file', /It contains no active path assignments/],
    ['all tracked content is scanned', /scans every tracked file, including `MAINTAINERS\.md` and `\.github\/CODEOWNERS`, without file exemptions/],
  ]);
  const ownership = read('.github/CODEOWNERS');
  assert.ok(ownership.includes('MAINTAINERS.md'), 'ownership points to maintainer source');
  assert.ok(ownership.split(/\r?\n/).every(line => !line.trim() || line.trim().startsWith('#')),
    'ownership has no active path assignments');
  assert.ok(read('MAINTAINERS.md').includes('[UWMD-OSP]'), 'neutral maintainer organization');
});

test('wiki follows the adopted arrival trigger and preserves governance definitions', () => {
  requireClaims(governance, [
    ['adopted arrival trigger', /first RFC or pull request from an outside contributor arrives/],
    ['owner announcement', /announces the change here, under "Mode", with the date and the contribution/],
    ['comment minimum', /public comment period of at least 14 days/],
    ['contributor definition remains distinct from activation', /A contributor is anyone whose external pull request has been merged/],
  ]);
  requireClaims(wiki, [
    ['arrival activates collaborative rules', /first RFC or pull request from an outside contributor arrives.*Arrival starts the collaborative rules/],
    ['announcement and earlier start', /announces the date and triggering contribution.*"Mode".*may announce collaborative mode earlier/],
    ['external review in either mode', /External PRs require owner review in either mode/],
    ['owner-led comment behavior', /In owner-led mode.*without a mandatory public comment period/],
    ['collaborative normative protections', /In collaborative mode normative changes require an RFC, a public comment period of at least 14 days, project-owner approval and a reference implementation in the same PR or a linked follow-up/],
    ['security exception and extension', /owner may extend the comment period; emergency security fixes may merge immediately and be documented afterward/],
    ['editorial approval', /Editorial and implementation changes require a PR, passing applicable automated checks and one maintainer approval/],
  ]);
  requireClaims(orientation, [
    ['orientation arrival trigger', /first outside RFC or PR arrives/],
    ['orientation comment window', /at least 14 days of public comment/],
  ]);
  for (const guide of [wiki, orientation]) {
    requireClaims(guide, [['no merge prerequisite', /contribution does not need to merge/]]);
    assert.ok(!/after the first external\s+PR merges/i.test(guide), 'arrival must not be delayed until merge');
  }
});

test('guidance follows retired personal clearance and default generic checks', () => {
  for (const guide of [wiki, orientation]) {
    requireClaims(guide, [
      ['personal clearance retired', /[Cc]onfigured personal-identity clearance is retired/],
      ['personal identities allowed', /Personal names, handles and email addresses are allowed/],
      ['generic rules retained', /eight generic/],
      ['credential protections unchanged', /credential\/secret protections remain unchanged/],
    ]);
    assert.ok(!/PUBLIC_IDENTITY_CONFIG_JSON|PUBLIC_IDENTITY_MODE|configured-public-identity-checks|identity-scan exemption/.test(guide),
      'no obsolete provisioning instructions or anchor');
  }
  requireClaims(wiki, [
    ['default index and scanner', /rules remain enforced by \x60npm run verify-indexes\x60 and by the scanner's default CLI invocation/],
    ['no personal setup', /No personal patterns, environment configuration, secret setup or separate configured CI scan is required/],
    ['required index CI', /required index CI job runs the default generic checks for every PR/],
    ['local merge and release requirements', /Local merge identity, review, release approval and publication requirements above remain in force/],
  ]);
  assert.ok(orientation.includes('11-build-release-governance.md#generic-tracked-content-checks'),
    'orientation points to current generic checks section');
});

test('guidance controls reject synthetic arrival and comment-window regressions', () => {
  const claim = [['synthetic arrival contract', /first outside RFC or PR arrives/]];
  assert.doesNotThrow(() => requireClaims('The first outside RFC or PR arrives.', claim));
  assert.throws(() => requireClaims('The first outside PR merges.', claim), /synthetic arrival contract/);
  const window = [['synthetic comment window', /at least 14 days of public comment/]];
  assert.doesNotThrow(() => requireClaims('Allow at least 14 days of public comment.', window));
  assert.throws(() => requireClaims('Allow seven days of public comment.', window), /synthetic comment window/);
});
