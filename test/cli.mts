import { execFile, type ChildProcess, type ExecFileOptions, type ExecFileOptionsWithBufferEncoding, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { afterAll, afterEach } from 'vitest';

export interface ProcessResult<T> {
  status: number;
  stdout: T;
  stderr: T;
}

const running = new Set<ChildProcess>();

// A failed or timed-out test must not leave a CLI competing with later tests.
async function stopChildren() {
  await Promise.all([...running].map(child => new Promise<void>(resolve => {
    child.once('close', () => resolve());
    child.kill();
  })));
}
afterEach(stopChildren);
afterAll(stopChildren);

export function runProcess(executable: string, args: string[], options: ExecFileOptionsWithStringEncoding): Promise<ProcessResult<string>>;
export function runProcess(executable: string, args: string[], options?: ExecFileOptionsWithBufferEncoding): Promise<ProcessResult<Buffer>>;
export function runProcess(executable: string, args: string[], options: ExecFileOptions = {}): Promise<ProcessResult<string | Buffer>> {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, {
      encoding: null,
      maxBuffer: 1024 * 1024,
      timeout: 20_000,
      windowsHide: true,
      ...options,
    }, (error, stdout, stderr) => {
      running.delete(child);
      // Nonzero exits are evidence for refusal tests. Launch errors, signals,
      // output overflow and child timeouts are harness failures, not exit codes.
      if (!error) {
        resolve({ status: 0, stdout, stderr });
      } else if (typeof error.code === 'number' && !error.killed && !error.signal) {
        resolve({ status: error.code, stdout, stderr });
      } else {
        reject(error);
      }
    });
    running.add(child);
  });
}
