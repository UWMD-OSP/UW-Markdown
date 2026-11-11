import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityRules, publicIdentityFindings, trackedPublicIdentityFindings } from './public-identity.mjs';

const script = fileURLToPath(new URL('./public-identity.mjs', import.meta.url));
const root = resolve(dirname(script), '..');
const retiredFile = '.public-identity.local.json';
const ordinaryIdentity = 'Avery Example\navery.example@example.invalid\n@avery-example\n';
const samples = [
  ['private-repository', ['underwriter', '-app'].join('')],
  ['private-task', ['TA', 'SK-123'].join('')],
  ['private-upstream', ['UP', 'STREAM-4'].join('')],
  ['private-corpus', ['Golden', ' Deal'].join('')],
  ['personal-path', `C:${String.fromCharCode(92)}Users`],
  ['session-branch-a', ['co', 'dex/topic'].join('')],
  ['session-branch-b', ['clau', 'de/topic'].join('')],
  ['retired-product', ['Banc', 'roft'].join('')],
];

function withRepository(run) {
  const repo = mkdtempSync(join(tmpdir(), 'uwmd-identity-'));
  try {
    execFileSync('git', ['init', '-q', repo]);
    writeFileSync(join(repo, '.gitignore'), `${retiredFile}\nignored.md\n`);
    writeFileSync(join(repo, 'tracked-λ.md'), ordinaryIdentity);
    execFileSync('git', ['-C', repo, 'add', '--', 'tracked-λ.md', '.gitignore']);
    run(repo);
  } finally {
    assert.equal(dirname(resolve(repo)), resolve(tmpdir()));
    rmSync(repo, { recursive: true, force: true });
  }
}

function environment(poisoned = false) {
  const env = { ...process.env };
  delete env.PUBLIC_IDENTITY_CONFIG_JSON;
  delete env.PUBLIC_IDENTITY_MODE;
  if (poisoned) {
    env.PUBLIC_IDENTITY_CONFIG_JSON = '{invalid obsolete configuration';
    env.PUBLIC_IDENTITY_MODE = 'invalid-obsolete-mode';
  }
  return env;
}

function runNode(cwd, path, poisoned = false, args = []) {
  const result = spawnSync(process.execPath, [path, ...args], {
    cwd, env: environment(poisoned), encoding: 'utf8', timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

test('all eight generic rules retain IDs, repeated findings and exact locations', () => {
  assert.deepEqual(identityRules.map(x => x.id), samples.map(x => x[0]));
  for (const [rule, sample] of samples) {
    assert.deepEqual(publicIdentityFindings('docs/example.md', `safe\n${sample}\n${sample}`), [
      { path: 'docs/example.md', rule, line: 2 }, { path: 'docs/example.md', rule, line: 3 },
    ]);
  }
  assert.equal(publicIdentityFindings('example.json', `C:${String.fromCharCode(92).repeat(2)}Users`).length, 1);
});

test('ordinary synthetic names, emails and handles are allowed in every tracked location', () => {
  withRepository(repo => {
    mkdirSync(join(repo, '.github'));
    mkdirSync(join(repo, 'docs'));
    for (const path of ['MAINTAINERS.md', '.github/CODEOWNERS', 'README.md', 'CODEOWNERS', 'docs/MAINTAINERS.md']) {
      writeFileSync(join(repo, path), ordinaryIdentity);
      assert.deepEqual(publicIdentityFindings(path, ordinaryIdentity), []);
      execFileSync('git', ['-C', repo, 'add', '--', path]);
    }
    assert.deepEqual(trackedPublicIdentityFindings(repo), []);
    for (const poisoned of [false, true]) {
      const result = runNode(repo, script, poisoned);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'Generic tracked-content scan passed.');
      assert.equal(result.stderr, '');
    }
  });
});

test('actual CLI refuses every generic finding without printing matched content', () => {
  withRepository(repo => {
    for (const [rule, sample] of samples) {
      writeFileSync(join(repo, 'tracked-λ.md'), `safe\n${sample}\n`);
      for (const poisoned of [false, true]) {
        const result = runNode(repo, script, poisoned);
        assert.equal(result.status, 1);
        assert.equal(result.stderr.trim(), `tracked-λ.md:2: public identity policy (${rule})`);
        assert.equal(result.stdout, '');
        assert.ok(!result.stderr.includes(sample));
      }
    }
  });
});

test('generic inventory includes routing and Unicode files, excludes ignored and untracked files', () => {
  withRepository(repo => {
    const probe = samples[0][1];
    writeFileSync(join(repo, 'untracked.md'), probe);
    writeFileSync(join(repo, 'ignored.md'), probe);
    assert.deepEqual(trackedPublicIdentityFindings(repo), []);
    mkdirSync(join(repo, '.github'));
    for (const path of ['.github/CODEOWNERS', 'MAINTAINERS.md', 'tracked-λ.md']) {
      writeFileSync(join(repo, path), `safe\n${probe}`);
      execFileSync('git', ['-C', repo, 'add', '--', path]);
    }
    const expected = ['.github/CODEOWNERS', 'MAINTAINERS.md', 'tracked-λ.md'];
    assert.deepEqual(trackedPublicIdentityFindings(repo).map(x => x.path).sort(), expected);
    const result = runNode(repo, script);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim().split('\n').length, 3);
  });
});

test('obsolete configuration is neither read nor written and retired CLI arguments refuse', () => {
  withRepository(repo => {
    writeFileSync(join(repo, retiredFile), '{invalid local configuration');
    const before = readdirSync(repo).sort();
    assert.equal(runNode(repo, script, true).status, 0);
    assert.deepEqual(readdirSync(repo).sort(), before);
    assert.equal(readFileSync(join(repo, retiredFile), 'utf8'), '{invalid local configuration');
    for (const args of [['--required'], ['--generic'], ['--unknown'], ['--generic', '--required']]) {
      const result = runNode(repo, script, true, args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /accepts no arguments/);
    }
    assert.doesNotMatch(readFileSync(script, 'utf8'), /process\.env|JSON\.parse|parsePersonalIdentityConfig|writeFile|appendFile|createWriteStream/);
  });
  assert.equal(execFileSync('git', ['check-ignore', retiredFile], { cwd: root, encoding: 'utf8' }).trim(), retiredFile);
});

test('actual complete index guard works without config and ignores poisoned obsolete environment', () => {
  for (const poisoned of [false, true]) {
    const result = runNode(root, join(root, 'scripts/verify-indexes.mjs'), poisoned);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generic tracked-content policy checked/);
    assert.match(result.stdout, /Tracked public language enforced: 0 findings/);
    assert.doesNotMatch(result.stdout, /configured personal|personal coverage|required mode/i);
  }
  assert.doesNotMatch(readFileSync(join(root, 'scripts/verify-indexes.mjs'), 'utf8'), /PUBLIC_IDENTITY_/);
});

test('CI retains its exact contract after removing only the configured job and obsolete mode env', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').replaceAll('\r\n', '\n');
  // Existing workflow fingerprint with only those two deletions: pins every
  // retained job, trigger, permission, credential check and release gate.
  assert.equal(createHash('sha256').update(workflow).digest('hex'),
    '0918f3912383d69fab967ed2319f41f1da4be2f33a554d0e923858cdc7831a76');
  assert.doesNotMatch(workflow, /verify-personal-identity:|PUBLIC_IDENTITY_|pull_request_target:/);
  const indexes = workflow.split('  verify-indexes:')[1].split('\n  verify-codes:')[0];
  assert.match(indexes, /run: npm run verify-indexes/);
  assert.match(indexes, /node --test scripts\/build-source.test.mjs/);
});
