import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30_000 });

it('keeps the worker responsive and captures both streams of a nonzero exit', async () => {
  const result = runProcess(process.execPath, ['-e', `setTimeout(() => {
    process.stdout.write('out'); process.stderr.write('err'); process.exitCode = 23;
  }, 100);`], { encoding: 'utf8' });
  // Worker RPC replies and timers can run while the child is still working.
  expect(await Promise.race([
    result,
    new Promise(resolve => setImmediate(() => resolve('worker responsive'))),
  ])).toBe('worker responsive');
  expect(await result).toEqual({ status: 23, stdout: 'out', stderr: 'err' });
});

it('preserves binary output and the child working directory', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'uwmd-child-'));
  try {
    const result = await runProcess(process.execPath, ['-e',
      `process.stdout.write(Buffer.from([0, 128, 255]));
       process.stderr.write(process.cwd());`], { cwd: directory });
    expect(result.status).toBe(0);
    expect(result.stdout).toEqual(Buffer.from([0, 128, 255]));
    expect(result.stderr.toString()).toBe(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rejects and terminates a child that exceeds its deadline', async () => {
  await expect(runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
    { encoding: 'utf8', timeout: 100 })).rejects.toMatchObject({ killed: true });
});
