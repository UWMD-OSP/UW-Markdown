import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { unzipSync } from 'fflate';
import { npmInvocation } from './npm-invocation.mjs';

test('the documented package command emits a self-contained VSIX with its license', { timeout: 120_000 }, () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cache = join(root, 'node_modules/.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'extension-package-'));
  const output = join(dir, 'uwmd.vsix');
  const npm = npmInvocation();
  const run = spawnSync(npm.command, [...npm.prefix, 'run', 'package', '--', '--out', output], {
    cwd: join(root, 'tools/vscode-uwmd'), encoding: 'utf8', timeout: 110_000,
  });
  assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  const zip = unzipSync(readFileSync(output));
  const names = Object.keys(zip);
  assert.ok(names.includes('extension/dist/extension.js'));
  // vsce gives the manifest license a .txt suffix in the archive.
  assert.ok(names.includes('extension/LICENSE.txt'));
  assert.deepEqual(Buffer.from(zip['extension/LICENSE.txt']), readFileSync(join(root, 'LICENSE')));
  assert.ok(names.every(name => !name.split('/').includes('..') && !name.includes('/node_modules/')), names.join('\n'));
  assert.ok(names.every(name => !name.endsWith('.map') && !name.endsWith('.ts')));
  assert.doesNotMatch(Buffer.from(zip['extension/dist/extension.js']).toString('utf8'), /require\(["']@uwmd\//);
});
