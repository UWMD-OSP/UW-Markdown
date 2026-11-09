import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  identityRules, parsePersonalIdentityConfig, personalConfigFile,
  publicIdentityFindings, trackedPublicIdentityFindings,
} from './public-identity.mjs';

const subject = 'SyntheticSubjectQ';
const handle = 'synthetic-handle-q';
const config = { version: 1, rules: [
  { id: 'private-name', pattern: subject, flags: 'i', boundary: 'word' },
  { id: 'private-handle', pattern: handle, flags: 'i', boundary: 'none' },
] };
const configuredRules = [...identityRules, ...parsePersonalIdentityConfig(JSON.stringify(config))];
const script = fileURLToPath(new URL('./public-identity.mjs', import.meta.url));
const root = resolve(dirname(script), '..');

function withRepository(run) {
  const repo = mkdtempSync(join(tmpdir(), 'uwmd-identity-'));
  try {
    execFileSync('git', ['init', '-q', repo]);
    writeFileSync(join(repo, '.gitignore'), `${personalConfigFile}\nignored.md\n`);
    writeFileSync(join(repo, 'tracked-λ.md'), 'safe');
    execFileSync('git', ['-C', repo, 'add', '--', 'tracked-λ.md', '.gitignore']);
    run(repo);
  } finally {
    assert.equal(dirname(resolve(repo)), resolve(tmpdir()));
    rmSync(repo, { recursive: true, force: true });
  }
}

function putConfig(repo, value = config) {
  writeFileSync(join(repo, personalConfigFile), JSON.stringify(value));
}

function runCLI(repo, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8' });
}

test('generic patterns retain useful locations without personal values in source', () => {
  const samples = [['underwriter', '-app'].join(''), ['TA', 'SK-123'].join(''),
    ['UP', 'STREAM-4'].join(''), ['Golden', ' Deal'].join(''),
    `C:${String.fromCharCode(92)}Users`, ['co', 'dex/topic'].join(''),
    ['clau', 'de/topic'].join(''), ['Banc', 'roft'].join('')];
  for (const sample of samples) {
    const findings = publicIdentityFindings('docs/example.md', `safe\n${sample}\n`);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 2);
  }
  assert.equal(publicIdentityFindings('example.json', `C:${String.fromCharCode(92).repeat(2)}Users`).length, 1);
});

test('configured case and word boundaries apply to every tracked file without exemptions', () => {
  for (const path of ['MAINTAINERS.md', '.github/CODEOWNERS', 'README.md', 'CODEOWNERS', 'docs/MAINTAINERS.md']) {
    for (const sample of [subject, subject.toLowerCase(), subject.toUpperCase(), handle, handle.toUpperCase()]) {
      assert.equal(publicIdentityFindings(path, sample, configuredRules).length, 1);
    }
    assert.deepEqual(publicIdentityFindings(path, `prefix${subject}suffix`, configuredRules), []);
  }
  assert.deepEqual(publicIdentityFindings('README.md', `${subject}\n${subject}`, configuredRules).map(x => x.line), [1, 2]);
  assert.deepEqual(publicIdentityFindings('README.md', 'UWMD maintainers', configuredRules), []);
});

test('schema rejects empty, malformed, unknown properties, missing fields and unsupported flags without values', () => {
  const invalid = ['', '{', 'null', '[]', '{}', JSON.stringify({ version: 2, rules: config.rules }),
    JSON.stringify({ version: 1, rules: [] }), JSON.stringify({ ...config, extra: subject }),
    ...[
      { ...config.rules[0], extra: subject }, { id: 'missing-fields' },
      { ...config.rules[0], pattern: '' }, { ...config.rules[0], flags: 'g' },
      { ...config.rules[0], boundary: 'unknown' }, { ...config.rules[0], id: 'unsafe id' },
    ].map(rule => JSON.stringify({ version: 1, rules: [rule] }))];
  for (const text of invalid) {
    assert.throws(() => parsePersonalIdentityConfig(text), error => {
      assert.match(error.message, /Personal identity configuration/);
      assert.ok(!error.message.includes(subject));
      return true;
    });
  }
});

test('invalid regex and duplicate or reserved IDs fail closed without leaking patterns', () => {
  for (const rules of [
    [{ ...config.rules[0], pattern: `[${subject}` }],
    [config.rules[0], config.rules[0]],
    [{ ...config.rules[0], id: identityRules[0].id }],
  ]) {
    assert.throws(() => parsePersonalIdentityConfig(JSON.stringify({ version: 1, rules })), error => {
      assert.ok(!error.message.includes(subject));
      return true;
    });
  }
});

test('configured inventory scans tracked bytes including neutral routing files, not local or untracked files', () => {
  withRepository(repo => {
    putConfig(repo);
    writeFileSync(join(repo, 'untracked.md'), subject);
    writeFileSync(join(repo, 'ignored.md'), subject);
    assert.deepEqual(trackedPublicIdentityFindings(repo), []);
    mkdirSync(join(repo, '.github'));
    writeFileSync(join(repo, '.github/CODEOWNERS'), subject);
    writeFileSync(join(repo, 'MAINTAINERS.md'), handle);
    execFileSync('git', ['-C', repo, 'add', '--', '.github/CODEOWNERS', 'MAINTAINERS.md']);
    assert.deepEqual(trackedPublicIdentityFindings(repo).map(x => x.path).sort(), ['.github/CODEOWNERS', 'MAINTAINERS.md']);
    writeFileSync(join(repo, 'tracked-λ.md'), subject);
    const found = trackedPublicIdentityFindings(repo);
    assert.equal(found.length, 3);
    assert.ok(found.some(x => x.path === 'tracked-λ.md'));
    assert.ok(!JSON.stringify(found).includes(subject));
  });
});

test('required CLI refuses missing, empty, malformed and invalid config; generic mode never claims personal coverage', () => {
  withRepository(repo => {
    for (const text of [undefined, '', '{', JSON.stringify({ version: 1, rules: [] })]) {
      if (text !== undefined) writeFileSync(join(repo, personalConfigFile), text);
      const result = runCLI(repo, '--required');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Personal identity configuration/);
      assert.ok(!result.stdout.includes('passed'));
    }
    const generic = runCLI(repo, '--generic');
    assert.equal(generic.status, 0);
    assert.match(generic.stdout, /personal scan NOT performed/);
    assert.throws(() => trackedPublicIdentityFindings(repo, { mode: 'unknown' }), /mode/);
    assert.equal(runCLI(repo, '--unknown').status, 1);
    assert.equal(runCLI(repo, '--generic', '--required').status, 1);
  });
});

test('configured CLI reports only rule IDs, tracked paths and lines', () => {
  withRepository(repo => {
    putConfig(repo);
    assert.equal(runCLI(repo, '--required').status, 0);
    writeFileSync(join(repo, 'tracked-λ.md'), `safe\n${subject}\n`);
    const result = runCLI(repo, '--required');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /tracked-λ\.md:2: public identity policy \(private-name\)/);
    assert.ok(!result.stderr.includes(subject));
    assert.ok(!result.stderr.includes(handle));
  });
});

test('local configuration path is ignored by the actual Git repository', () => {
  assert.equal(execFileSync('git', ['check-ignore', personalConfigFile], { cwd: root, encoding: 'utf8' }).trim(), personalConfigFile);
});

test('CI separates generic checks from the required trusted scan and never delivers configuration to forks', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
  const generic = workflow.split('  verify-indexes:')[1].split('\n  verify-personal-identity:')[0];
  assert.match(generic, /PUBLIC_IDENTITY_MODE: generic/);
  const required = workflow.split('  verify-personal-identity:')[1].split('\n  verify-codes:')[0];
  const condition = /if: \$\{\{ (.+) \}\}/.exec(required)[1];
  // Evaluate the exact YAML trust refusal expression against synthetic GitHub events.
  const refuses = github => Function('github', `return (${condition})`)(github);
  for (const [event, headRepo, actor, expected] of [
    ['pull_request', 'other/project', 'contributor', true],
    ['pull_request', 'org/project', 'dependabot[bot]', true],
    ['pull_request', 'org/project', 'maintainer', false],
    ['push', undefined, 'maintainer', false],
    ['workflow_dispatch', undefined, 'maintainer', false],
  ]) {
    assert.equal(refuses({ event_name: event, repository: 'org/project', actor,
      event: { pull_request: { head: { repo: { full_name: headRepo } } } } }), expected);
  }
  assert.match(required, /Fork and automated PRs require a reviewed trusted branch; no private configuration was delivered\.[\s\S]*exit 1[\s\S]*uses: actions\/checkout/);
  assert.ok(required.indexOf('exit 1') < required.indexOf('secrets.PUBLIC_IDENTITY_CONFIG_JSON'));
  assert.equal((workflow.match(/secrets\.PUBLIC_IDENTITY_CONFIG_JSON/g) ?? []).length, 1);
  assert.match(required, /node scripts\/public-identity\.mjs --required/);
  assert.match(required, /if: always\(\)[\s\S]*unlinkSync/);
  assert.ok(!workflow.includes('pull_request_target:'));
});