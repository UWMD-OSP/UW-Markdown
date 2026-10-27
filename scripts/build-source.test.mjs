import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { buildSource, committedSource, sourceBuildIdentity } from './build-source.mjs';

const env = { ...process.env, GIT_AUTHOR_NAME: 'UWMD', GIT_AUTHOR_EMAIL: 'maintainers@uwmd.org', GIT_COMMITTER_NAME: 'UWMD', GIT_COMMITTER_EMAIL: 'maintainers@uwmd.org' };
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function fixture(withGit = true) {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-source-build-test-'));
  for (const [dir, version] of [['uwmd-core', '4.3.0'], ['uwmd-verify', '4.2.0']]) {
    mkdirSync(join(root, 'packages', dir), { recursive: true });
    writeFileSync(join(root, 'packages', dir, 'package.json'), JSON.stringify({ type: 'module', version }));
  }
  writeFileSync(join(root, '.gitignore'), 'dist\n');
  writeFileSync(join(root, 'source.txt'), 'synthetic committed input\n');
  if (withGit) { git(root, 'init', '-q'); git(root, 'add', '.'); git(root, 'commit', '-qm', 'Synthetic source fixture'); }
  return root;
}
function cleanup(root) {
  const absolute = resolve(root);
  assert.ok(absolute.startsWith(resolve(tmpdir()) + sep) && basename(absolute).startsWith('uwmd-source-build-test-'));
  rmSync(absolute, { recursive: true, force: true });
}
const metadataPath = root => join(root, 'packages/uwmd-core/dist/build-info.js');
const refusal = code => error => error.code === code;

test('a real clean Git build stamps exact commit/tree and preserves declared inputs', async () => {
  const root = fixture();
  try {
    const original = readFileSync(join(root, 'packages/uwmd-core/package.json'));
    const result = buildSource(root, { runBuild: () => {} });
    assert.equal(result.core.source_commit, git(root, 'rev-parse', 'HEAD'));
    assert.equal(result.core.source_tree, git(root, 'rev-parse', 'HEAD^{tree}'));
    assert.equal(result.core.build_version, `4.3.0+source.${result.core.source_commit}`);
    const emitted = await import(pathToFileURL(metadataPath(root)).href);
    assert.deepEqual(emitted.BUILD_INFO, result.core);
    assert.equal(emitted.BUILD_VERSION, result.core.build_version);
    assert.equal(Object.isFrozen(emitted.BUILD_INFO), true);
    assert.deepEqual(readFileSync(join(root, 'packages/uwmd-core/package.json')), original);
    assert.equal(git(root, 'status', '--porcelain'), '');
    const first = readFileSync(metadataPath(root));
    buildSource(root, { runBuild: () => {} });
    assert.deepEqual(readFileSync(metadataPath(root)), first);
  } finally { cleanup(root); }
});

for (const tracked of [true, false]) test(`dirty ${tracked ? 'tracked' : 'untracked'} input refuses before build`, () => {
  const root = fixture();
  try {
    writeFileSync(join(root, tracked ? 'source.txt' : 'new-source.txt'), 'changed input');
    let ran = false;
    assert.throws(() => buildSource(root, { runBuild: () => { ran = true; } }), refusal('BUILD_SOURCE_DIRTY'));
    assert.equal(ran, false);
  } finally { cleanup(root); }
});

test('a commit changing during the build refuses the identified result', () => {
  const root = fixture();
  try {
    assert.throws(() => buildSource(root, { runBuild: () => {
      writeFileSync(join(root, 'source.txt'), 'new committed source');
      git(root, 'add', 'source.txt'); git(root, 'commit', '-qm', 'Second synthetic source');
    } }), refusal('BUILD_SOURCE_CHANGED'));
    assert.match(readFileSync(metadataPath(root), 'utf8'), /source\.unknown/);
  } finally { cleanup(root); }
});

test('failed build clears a previous identified stamp without changing source', () => {
  const root = fixture();
  try {
    buildSource(root, { runBuild: () => {} });
    assert.throws(() => buildSource(root, { runBuild: () => { throw new Error('Synthetic build failure'); } }), /Synthetic build failure/);
    assert.match(readFileSync(metadataPath(root), 'utf8'), /source\.unknown/);
    assert.equal(git(root, 'status', '--porcelain'), '');
  } finally { cleanup(root); }
});

test('Gitless archives are explicitly unidentified', () => {
  const root = fixture(false);
  try {
    assert.equal(committedSource(root), null);
    const result = buildSource(root, { runBuild: () => {} });
    assert.equal(result.core.source_commit, null);
    assert.equal(result.core.source_tree, null);
    assert.equal(result.core.build_version, '4.3.0+source.unknown');
    assert.equal(result.verify.artifact_kind, 'unidentified-source');
  } finally { cleanup(root); }
});

test('a linked output directory cannot write outside the owned source root', () => {
  const root = fixture();
  const outside = fixture(false);
  try {
    const sentinel = join(outside, 'build-info.js'); writeFileSync(sentinel, 'unchanged');
    symlinkSync(outside, join(root, 'packages/uwmd-verify/dist'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => buildSource(root, { runBuild: () => {} }), refusal('BUILD_OUTPUT_INVALID'));
    assert.equal(readFileSync(sentinel, 'utf8'), 'unchanged');
  } finally { cleanup(root); cleanup(outside); }
});

test('partial, malformed or missing identity never becomes a full stamp', () => {
  const sha = 'a'.repeat(40);
  for (const source of [undefined, {}, { commit: sha }, { tree: sha }, { commit: 'short', tree: sha }, { commit: sha, tree: 'dirty' }]) {
    assert.throws(() => sourceBuildIdentity('4.3.0', source), refusal('BUILD_SOURCE_INVALID'));
  }
  assert.throws(() => sourceBuildIdentity('not-a-version', null), refusal('BUILD_VERSION_INVALID'));
});
