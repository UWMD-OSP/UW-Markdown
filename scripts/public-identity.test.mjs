import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { publicIdentityFindings, trackedPublicIdentityFindings } from './public-identity.mjs';

const handle = ['ja', 'redmaxey'].join('');
const owner = ['Ja', 'red'].join('');
const samples = [owner, handle, ['underwriter', '-app'].join(''),
  ['TA', 'SK-123'].join(''), ['UP', 'STREAM-4'].join(''),
  ['Golden', ' Deal'].join(''), `C:${String.fromCharCode(92)}Users`,
  ['co', 'dex/topic'].join(''), ['clau', 'de/topic'].join(''), ['Banc', 'roft'].join('')];

test('every named pattern rejects tracked content with useful locations', () => {
  for (const sample of samples) {
    const found = publicIdentityFindings('docs/example.md', `safe\n${sample}\n`);
    assert.equal(found.length, 1, sample);
    assert.equal(found[0].line, 2);
  }
  const encodedPath = `C:${String.fromCharCode(92).repeat(2)}Users`;
  assert.equal(publicIdentityFindings('evidence.json', encodedPath).length, 1);
});

test('only named maintainer files exempt the public handle, never other terms', () => {
  for (const path of ['MAINTAINERS.md', '.github/CODEOWNERS']) {
    assert.deepEqual(publicIdentityFindings(path, handle), []);
    assert.equal(publicIdentityFindings(path, owner).length, 1);
  }
  for (const path of ['README.md', 'CODEOWNERS', 'docs/MAINTAINERS.md', 'other/CODEOWNERS']) {
    assert.equal(publicIdentityFindings(path, handle).length, 1);
  }
});

test('safe text stays clean and repeated findings retain their own locations', () => {
  assert.deepEqual(publicIdentityFindings('README.md', 'UWMD maintainers'), []);
  assert.deepEqual(publicIdentityFindings('README.md', `${owner}\n${owner}`).map(x => x.line), [1, 2]);
});

test('real Git inventory scans tracked bytes and Unicode paths, not ignored or untracked files', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-identity-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    writeFileSync(join(root, 'tracked λ.md'), 'safe');
    writeFileSync(join(root, 'untracked.md'), owner);
    writeFileSync(join(root, '.gitignore'), 'ignored.md');
    writeFileSync(join(root, 'ignored.md'), owner);
    execFileSync('git', ['-C', root, 'add', '--', 'tracked λ.md', '.gitignore']);
    assert.deepEqual(trackedPublicIdentityFindings(root), []);
    writeFileSync(join(root, 'tracked λ.md'), owner);
    const found = trackedPublicIdentityFindings(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, 'tracked λ.md');
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
