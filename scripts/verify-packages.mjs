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
  if (missing.length > 0) throw new Error(`${workspace} package is missing: ${missing.join(', ')}`);
}

function rejectSourceOrTests(workspace, files) {
  const leakedFiles = [...files].filter((path) => path.startsWith('src/') || /\.test\.(?:js|d\.ts)(?:\.map)?$/.test(path));
  if (leakedFiles.length > 0) throw new Error(`${workspace} package leaks source or tests: ${leakedFiles.join(', ')}`);
}

const coreFiles = packedFiles('@uwmd/core');
requireFiles('@uwmd/core', coreFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/browser.js', 'dist/browser.d.ts', 'dist/cli.js']);
rejectSourceOrTests('@uwmd/core', coreFiles);

const cliFiles = packedFiles('@uwmd/cli');
requireFiles('@uwmd/cli', cliFiles, ['package.json', 'README.md', 'bin/uwmd.mjs']);

const batchFiles = packedFiles('@uwmd/batch');
requireFiles('@uwmd/batch', batchFiles, ['package.json', 'README.md', 'bin/uwmd-batch.mjs', 'dist/index.js', 'dist/index.d.ts']);
rejectSourceOrTests('@uwmd/batch', batchFiles);

// @uwmd/excel and @uwmd/report were not covered here, and the gap had teeth:
// excel's tsconfig included `src/**/*` with no exclude, so `npm run build`
// compiled its three test files into dist/, and a `files` field of
// ["bin", "dist", "README.md"] — none of core's `!dist/**/*.test.*` guards —
// shipped them. Every publishable workspace is checked now.
const excelFiles = packedFiles('@uwmd/excel');
requireFiles('@uwmd/excel', excelFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts']);
rejectSourceOrTests('@uwmd/excel', excelFiles);

const reportFiles = packedFiles('@uwmd/report');
requireFiles('@uwmd/report', reportFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts']);
rejectSourceOrTests('@uwmd/report', reportFiles);

console.log(`[PASS] @uwmd/core package: ${coreFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/cli package: ${cliFiles.size} files, CLI wrapper present`);
console.log(`[PASS] @uwmd/batch package: ${batchFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/excel package: ${excelFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/report package: ${reportFiles.size} files, production artifacts present`);
