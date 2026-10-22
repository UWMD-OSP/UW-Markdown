import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npmInvocation } from './npm-invocation.mjs';

test('npm-provided entry path wins and stays an argv value, including spaces', () => {
  assert.deepEqual(npmInvocation({ executable: 'node path', npmExecPath: 'npm path/cli.js' }),
    { command: 'node path', prefix: ['npm path/cli.js'] });
});
test('direct Windows invocation uses the sibling npm JS entry without a shell', () => {
  const executable = String.raw`C:\Program Files\nodejs\node.exe`;
  const cli = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`;
  assert.deepEqual(npmInvocation({ platform: 'win32', executable, npmExecPath: '',
    searchPath: '', exists: path => path === cli }), { command: executable, prefix: [cli] });
});
test('Windows finds an npm installation on quoted PATH and refuses a missing CLI', () => {
  const executable = String.raw`C:\runtime\node.exe`;
  const cli = String.raw`D:\Package Tools\node_modules\npm\bin\npm-cli.js`;
  const options = { platform: 'win32', executable, npmExecPath: '',
    searchPath: String.raw`C:\other;"D:\Package Tools"` };
  assert.deepEqual(npmInvocation({ ...options, exists: path => path === cli }),
    { command: executable, prefix: [cli] });
  assert.throws(() => npmInvocation({ ...options, exists: () => false }), /Cannot locate npm CLI/);
});
test('POSIX direct invocation retains the executable npm command', () => {
  assert.deepEqual(npmInvocation({ platform: 'linux', npmExecPath: '' }), { command: 'npm', prefix: [] });
});
