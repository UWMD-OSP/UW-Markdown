import { existsSync } from 'node:fs';
import { win32 } from 'node:path';

/** Resolve npm to a JS entry on Windows; never hand a command shim to execFile. */
export function npmInvocation({
  platform = process.platform,
  executable = process.execPath,
  npmExecPath = process.env.npm_execpath,
  searchPath = process.env.PATH ?? process.env.Path ?? '',
  exists = existsSync,
} = {}) {
  if (npmExecPath) return { command: executable, prefix: [npmExecPath] };
  if (platform !== 'win32') return { command: 'npm', prefix: [] };
  const directories = [win32.dirname(executable), ...searchPath.split(';')
    .filter(Boolean).map(path => path.replace(/^"(.*)"$/, '$1'))];
  const cli = directories.map(path => win32.join(path, 'node_modules', 'npm', 'bin', 'npm-cli.js'))
    .find(path => exists(path));
  if (!cli) throw new Error('Cannot locate npm CLI. Run npm run verify-packages, or install npm alongside Node or on PATH.');
  return { command: executable, prefix: [cli] };
}
