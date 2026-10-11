import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OFFICIAL_MODULE_PACKAGES, RELEASE_PACKAGES, moduleMetadataFromSource } from './release-packages.mjs';

const ts = createRequire(new URL('../packages/uwmd-core/package.json', import.meta.url))('typescript');
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

// Compile the package's actual delivered files outside the workspace, where
// optional peers cannot be found accidentally through ancestor node_modules.
const typeConsumer = mkdtempSync(join(tmpdir(), 'uwmd-package-types-'));
try {
  const coreDestination = join(typeConsumer, 'node_modules/@uwmd/core');
  for (const file of coreFiles) {
    const destination = join(coreDestination, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve('packages/uwmd-core', file), destination);
  }
  for (const dependency of ['fflate', 'fast-xml-parser', '@types/node', 'undici-types']) {
    cpSync(resolve('node_modules', dependency), join(typeConsumer, 'node_modules', dependency), { recursive: true });
  }
  assert.equal(existsSync(join(typeConsumer, 'node_modules/@anthropic-ai/sdk')), false);
  assert.equal(existsSync(join(typeConsumer, 'node_modules/@uwmd/signing')), false);
  writeFileSync(join(typeConsumer, 'package.json'), JSON.stringify({ type: 'module', private: true }));
  const consumerSource = join(typeConsumer, 'consumer.ts');
  writeFileSync(consumerSource, `import { parseUWFile, createAnthropicProvider } from '@uwmd/core';
import { parseUWFile as parseBrowser } from '@uwmd/core/browser';
export const parsers = [parseUWFile, parseBrowser];
createAnthropicProvider({
  apiKey: 'unused',
  client: { messages: {
    create: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }),
    stream: () => ({ finalMessage: async () => ({ content: [], usage: { input_tokens: 0, output_tokens: 0 } }) }),
  } },
});
`);
  const program = ts.createProgram([consumerSource], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: ['node'],
    typeRoots: [join(typeConsumer, 'node_modules/@types')],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => typeConsumer,
    getNewLine: () => '\n',
  }));
  console.log('[PASS] @uwmd/core strict root/browser declarations compile without optional peers');
} finally {
  assert.equal(dirname(resolve(typeConsumer)), resolve(tmpdir()));
  rmSync(typeConsumer, { recursive: true, force: true });
}

const cliFiles = packedFiles('@uwmd/cli');
requireFiles('@uwmd/cli', cliFiles, ['package.json', 'README.md', 'bin/uwmd.mjs']);

const batchFiles = packedFiles('@uwmd/batch');
requireFiles('@uwmd/batch', batchFiles, ['package.json', 'README.md', 'bin/uwmd-batch.mjs', 'dist/index.js', 'dist/index.d.ts']);
rejectSourceOrTests('@uwmd/batch', batchFiles);

// @uwmd/lake packs like any other workspace (published from 3.0.0); leaving it out
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

// Every package the release workflow publishes (nine since Excel, report and
// lake joined after 2.21.x) must install outside this repository: no
// workspace-only dependency specifier, exact @uwmd/* pins, public metadata,
// and every export and bin target inside the tarball it ships.
const packedByName = new Map([
  ['@uwmd/core', coreFiles], ['@uwmd/cli', cliFiles], ['@uwmd/batch', batchFiles], ['@uwmd/lake', lakeFiles],
  ['@uwmd/excel', excelFiles], ['@uwmd/report', reportFiles], ['@uwmd/signing', signingFiles],
]);
for (const pkg of RELEASE_PACKAGES) {
  const files = packedByName.get(pkg.name) ?? packedFiles(pkg.name);
  const manifest = JSON.parse(readFileSync(resolve(pkg.dir, 'package.json'), 'utf8'));
  assert.notStrictEqual(manifest.private, true, `${pkg.name}: a published package cannot be private`);
  assert.ok(manifest.license, `${pkg.name}: license metadata is required`);
  assert.strictEqual(manifest.repository?.directory, pkg.dir, `${pkg.name}: repository.directory must be ${pkg.dir}`);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dependency, spec] of Object.entries(manifest[field] ?? {})) {
      assert.ok(!/^(?:file|link|workspace|portal):/.test(spec), `${pkg.name}: ${field}.${dependency} uses workspace-only specifier ${spec}`);
      if (dependency.startsWith('@uwmd/')) {
        assert.match(spec, /^\d+\.\d+\.\d+$/, `${pkg.name}: ${field}.${dependency} must pin an exact version, not ${spec}`);
      }
    }
  }
  const targets = [];
  const collect = (target) => {
    if (typeof target === 'string') targets.push(target);
    else if (target && typeof target === 'object') Object.values(target).forEach(collect);
  };
  collect(manifest.exports);
  collect(typeof manifest.bin === 'string' ? [manifest.bin] : manifest.bin);
  for (const target of [manifest.main, manifest.types, ...targets].filter(Boolean)) {
    const path = target.replace(/^\.\//, '');
    assert.ok(files.has(path), `${pkg.name}: ${target} is declared but not in the packed tarball`);
  }
}
console.log(`[PASS] ${RELEASE_PACKAGES.length} published packages: no workspace-only dependencies, exact @uwmd/* pins, export and bin targets packed`);

console.log(`[PASS] @uwmd/core package: ${coreFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/cli package: ${cliFiles.size} files, CLI wrapper present`);
console.log(`[PASS] @uwmd/batch package: ${batchFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/lake package: ${lakeFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/excel package: ${excelFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/report package: ${reportFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/signing package: ${signingFiles.size} files, production artifacts present`);
