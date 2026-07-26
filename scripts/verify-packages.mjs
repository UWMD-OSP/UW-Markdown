import { execFileSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const npmPrefix = npmCli ? [npmCli] : [];

function packedFiles(workspace) {
  const output = execFileSync(
    npmCommand,
    [...npmPrefix, 'pack', '--dry-run', '--json', '--workspace', workspace],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const result = JSON.parse(output);
  return new Set(result[0].files.map(({ path }) => path.replaceAll('\\', '/')));
}

function requireFiles(workspace, files, required) {
  const missing = required.filter((path) => !files.has(path));
  if (missing.length > 0) {
    throw new Error(`${workspace} package is missing: ${missing.join(', ')}`);
  }
}

const coreFiles = packedFiles('@uwmd/core');
requireFiles('@uwmd/core', coreFiles, [
  'package.json',
  'README.md',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/browser.js',
  'dist/browser.d.ts',
  'dist/cli.js',
]);

const leakedCoreFiles = [...coreFiles].filter(
  (path) => path.startsWith('src/') || /\.test\.(?:js|d\.ts)(?:\.map)?$/.test(path),
);
if (leakedCoreFiles.length > 0) {
  throw new Error(`@uwmd/core package leaks source or tests: ${leakedCoreFiles.join(', ')}`);
}

const cliFiles = packedFiles('uwmd');
requireFiles('uwmd', cliFiles, ['package.json', 'README.md', 'bin/uwmd.mjs']);

console.log(`[PASS] @uwmd/core package: ${coreFiles.size} files, production artifacts present`);
console.log(`[PASS] uwmd package: ${cliFiles.size} files, CLI wrapper present`);
