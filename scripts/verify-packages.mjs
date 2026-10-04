import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OFFICIAL_MODULE_PACKAGES, moduleMetadataFromSource } from './release-packages.mjs';

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

// @uwmd/lake is unpublished but packs like any other workspace; leaving it out
// of this check is how a test file reaches a tarball unnoticed.
const lakeFiles = packedFiles('@uwmd/lake');
requireFiles('@uwmd/lake', lakeFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts']);
rejectSourceOrTests('@uwmd/lake', lakeFiles);

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

for (const pkg of OFFICIAL_MODULE_PACKAGES) {
  const files = packedFiles(pkg.name);
  requireFiles(pkg.name, files, ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts', 'dist/view-models.js', 'dist/view-models.d.ts', 'dist/manifest.json']);
  rejectSourceOrTests(pkg.name, files);
  const emitted = JSON.parse(readFileSync(resolve(pkg.dir, 'dist/manifest.json'), 'utf8'));
  const built = (await import(pathToFileURL(resolve(pkg.dir, 'dist/index.js')).href))[pkg.manifestExport];
  assert.deepStrictEqual(emitted, JSON.parse(JSON.stringify(built)), `${pkg.name}: emitted JSON differs from typed manifest build`);
  const sourceMetadata = moduleMetadataFromSource(readFileSync(resolve(pkg.dir, 'src/index.ts'), 'utf8'), pkg.constantPrefix);
  for (const [field, expected] of Object.entries(sourceMetadata)) {
    assert.strictEqual(emitted[field], expected, `${pkg.name}: emitted ${field} differs from typed source`);
  }
  assert.strictEqual(readFileSync(resolve(pkg.dir, 'LICENSE'), 'utf8'), readFileSync('LICENSE', 'utf8'), `${pkg.name}: packaged license differs from repository notice`);
  console.log(`[PASS] ${pkg.name} package: ${files.size} files, license and manifest/source parity verified`);
}

const signingFiles = packedFiles('@uwmd/signing');
requireFiles('@uwmd/signing', signingFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/keystore-file.js']);
rejectSourceOrTests('@uwmd/signing', signingFiles);

console.log(`[PASS] @uwmd/core package: ${coreFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/cli package: ${cliFiles.size} files, CLI wrapper present`);
console.log(`[PASS] @uwmd/batch package: ${batchFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/lake package: ${lakeFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/excel package: ${excelFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/report package: ${reportFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/signing package: ${signingFiles.size} files, production artifacts present`);
