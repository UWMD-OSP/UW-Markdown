import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { publicVoiceFindings, trackedPublicVoiceFindings, voiceAllowlist } from './public-voice.mjs';

test('process narration is caught in prose, source comments and data with line numbers', () => {
  const probes = [
    ['own', 'er ruling'].join(''), ['own', 'er direction'].join(''),
    ['check', 'point'].join(''), ['Co', 'dex'].join(''),
    ['paste', 'back'].join('-'), ['NO', 'W.md'].join(''), ['launch', 'held'].join('-'),
  ];
  for (const path of ['docs/rfcs/example.md', 'packages/example.ts', 'conformance/example.json']) {
    for (const probe of probes) {
      const found = publicVoiceFindings(path, `safe\n${probe}\n`);
      assert.equal(found.length, 1);
      assert.equal(found[0].line, 2);
      assert.equal(found[0].path, path);
      assert.equal(publicVoiceFindings(path, probe.toUpperCase()).length, 1);
    }
  }
});

test('allowance is limited to the exact integration label at its exact path', () => {
  for (const entry of voiceAllowlist) {
    assert.deepEqual(publicVoiceFindings(entry.path, entry.text), []);
    assert.ok(publicVoiceFindings('other.md', entry.text).length > 0);
    assert.ok(publicVoiceFindings(entry.path, `${entry.text} extra`).length > 0);
    assert.ok(entry.reason.length > 0);
  }
  assert.deepEqual(publicVoiceFindings('README.md', 'UWMD maintainers accepted the resolution.'), []);
});

test('tracked inventory includes Unicode names and excludes ignored and untracked files', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-voice-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const probe = ['own', 'er ruling'].join('');
    writeFileSync(join(root, 'tracked λ.md'), probe);
    writeFileSync(join(root, 'untracked.md'), probe);
    writeFileSync(join(root, '.gitignore'), 'ignored.md');
    writeFileSync(join(root, 'ignored.md'), probe);
    execFileSync('git', ['-C', root, 'add', '--', 'tracked λ.md', '.gitignore']);
    assert.deepEqual(trackedPublicVoiceFindings(root), [{ path: 'tracked λ.md', line: 1, rule: 'private-decision' }]);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
