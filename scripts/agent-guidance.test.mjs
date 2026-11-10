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

test('wiki routes through neutral maintainer sources without promising personal exemptions', () => {
  for (const guide of [wiki, orientation]) {
    requireClaims(guide, [
      ['maintainer source', /MAINTAINERS\.md/],
      ['ownership source', /\.github\/CODEOWNERS/],
      ['neutral routing', /neutral maintainer ownership/],
      ['uniform identity coverage', /[Pp]ersonal handles have no identity-scan exemption/],
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

test('identity guidance requires private environment delivery and distinguishes CI from protection', () => {
  requireClaims(wiki, [
    ['environment-only parsing', /only through the process environment variable `PUBLIC_IDENTITY_CONFIG_JSON` and parsed in memory/],
    ['no file delivery', /Never write real personal patterns to a file, including an ignored file, runtime file, shell history/],
    ['history remains', /Current-tree cleanup does not remove historical Git content/],
    ['required default', /`npm run verify-indexes` defaults to the required configured personal scan plus generic rules/],
    ['fail-closed configuration', /Missing, empty, malformed or invalid configuration fails with a value-free diagnostic/],
    ['generic CI coverage', /Verify hand-maintained indexes.*PUBLIC_IDENTITY_MODE=generic.*does not claim personal coverage/],
    ['configured job delivery', /secret `PUBLIC_IDENTITY_CONFIG_JSON` directly into the scanner step's process environment.*--required/],
    ['fork safety', /Fork and automated dependency PRs fail the required job before checkout or configuration delivery/],
    ['scanner mode differs from protection', /Required scanner mode is a fail-closed configuration contract, separate from branch-protection required checks/],
    ['current protection state', /configured identity job is not currently a required branch check/],
    ['existing checks remain applicable', /existing required branch checks remain applicable/],
    ['owner provisions real secret', /owner personally provisions the real `PUBLIC_IDENTITY_CONFIG_JSON` repository secret in GitHub/],
    ['scan before protection proposal', /reruns the configured scan on main and fixes any findings\. Only after that scan passes should making the configured job a required branch check be proposed/],
    ['synthetic controls are bounded evidence', /synthetic unit control proves only fixture behavior, not real configuration coverage/],
    ['no synthetic CI configuration', /Do not persist configuration, supply synthetic configuration to CI, or disable required mode/],
  ]);
  requireClaims(orientation, [
    ['orientation forbids ignored runtime delivery', /Real personal patterns must never be written to any file, including ignored runtime files/],
    ['orientation bounds fixture evidence', /synthetic tests do not establish real configured coverage/],
  ]);
});

test('guidance controls reject synthetic regressions without identity probes', () => {
  const claim = [['synthetic arrival contract', /first outside RFC or PR arrives/]];
  assert.doesNotThrow(() => requireClaims('The first outside RFC or PR arrives.', claim));
  assert.throws(() => requireClaims('The first outside PR merges.', claim), /synthetic arrival contract/);
  const uniform = [['synthetic uniform coverage', /Personal handles have no identity-scan exemption/]];
  assert.throws(() => requireClaims('Synthetic canary handles are exempt.', uniform), /synthetic uniform coverage/);
  const environment = [['synthetic environment contract', /environment-only, in-memory/]];
  assert.throws(() => requireClaims('Synthetic canary configuration uses a runtime file.', environment), /synthetic environment contract/);
});
