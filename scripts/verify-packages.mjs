import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_PACKAGES } from './release-packages.mjs';
import { npmInvocation } from './npm-invocation.mjs';

const ts = createRequire(new URL('../packages/uwmd-core/package.json', import.meta.url))('typescript');
const { command: npmCommand, prefix: npmPrefix } = npmInvocation();

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

// @uwmd/verify (RFC 0083) is the bottom of the graph: core depends on it, and
// it depends on no @uwmd/* package.
const verifyFiles = packedFiles('@uwmd/verify');
requireFiles('@uwmd/verify', verifyFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/browser.js', 'dist/browser.d.ts']);
rejectSourceOrTests('@uwmd/verify', verifyFiles);

const coreFiles = packedFiles('@uwmd/core');
requireFiles('@uwmd/core', coreFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/browser.js', 'dist/browser.d.ts', 'dist/cli.js']);
rejectSourceOrTests('@uwmd/core', coreFiles);

/** Copy a package's packed files into a consumer's node_modules. */
function install(consumer, name, dir, files) {
  const destinationRoot = join(consumer, 'node_modules', name);
  for (const file of files) {
    const destination = join(destinationRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(resolve(dir, file), destination);
  }
}

/**
 * Copy the third-party packages a consumer needs from this checkout's hoisted
 * node_modules: verify's runtime dependencies with everything they depend on
 * (the smoke run below loads them), and the Node types for the compile.
 */
function installThirdParty(consumer) {
  const pending = ['fflate', 'fast-xml-parser', '@types/node', 'undici-types'];
  const copied = new Set();
  while (pending.length > 0) {
    const dependency = pending.pop();
    if (copied.has(dependency)) continue;
    copied.add(dependency);
    cpSync(resolve('node_modules', dependency), join(consumer, 'node_modules', dependency), { recursive: true });
    const manifest = JSON.parse(readFileSync(resolve('node_modules', dependency, 'package.json'), 'utf8'));
    pending.push(...Object.keys(manifest.dependencies ?? {}));
  }
}

/** Strict-compile `source` in `consumer`, against only what it has installed. */
function compileConsumer(consumer, source) {
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ type: 'module', private: true }));
  const consumerSource = join(consumer, 'consumer.ts');
  writeFileSync(consumerSource, source);
  const program = ts.createProgram([consumerSource], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: ['node'],
    typeRoots: [join(consumer, 'node_modules/@types')],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => consumer,
    getNewLine: () => '\n',
  }));
}

// Compile the package's actual delivered files outside the workspace, where
// optional peers cannot be found accidentally through ancestor node_modules.
//
// First a consumer of @uwmd/verify alone: the lender's boundary test (RFC 0078,
// RFC 0083) as a package, with no @uwmd/core anywhere to fall back on.
const verifyConsumer = mkdtempSync(join(tmpdir(), 'uwmd-verify-types-'));
try {
  install(verifyConsumer, '@uwmd/verify', 'packages/uwmd-verify', verifyFiles);
  installThirdParty(verifyConsumer);
  assert.equal(existsSync(join(verifyConsumer, 'node_modules/@uwmd/core')), false);
  assert.equal(existsSync(join(verifyConsumer, 'node_modules/@anthropic-ai/sdk')), false);
  compileConsumer(verifyConsumer, [
    "import { parseUWFile, validateUWFile, verifyStatedMetrics, verifyReceipt, type UWReceipt } from '@uwmd/verify';",
    "import { verifyChain, parseUWFile as parseBrowser } from '@uwmd/verify/browser';",
    'export const verifiers = [parseUWFile, validateUWFile, verifyStatedMetrics, verifyReceipt, verifyChain, parseBrowser];',
    'export type Receipt = UWReceipt;',
    '',
  ].join('\n'));
  // And it runs: both entries load from the delivered files and the two
  // runtime dependencies alone.
  writeFileSync(join(verifyConsumer, 'smoke.mjs'), [
    "import * as verify from '@uwmd/verify';",
    "import * as browser from '@uwmd/verify/browser';",
    `const doc = ${JSON.stringify('---\nuw_version: "3.0"\ndeal_id: smoke\nasset_class: multifamily\n---\n')};`,
    "if (verify.parseUWFile(doc).frontmatter.deal_id !== 'smoke') throw new Error('parseUWFile');",
    "if (typeof verify.verifyStatedMetrics !== 'function' || browser.verifyChain !== verify.verifyChain) throw new Error('surface');",
    '',
  ].join('\n'));
  execFileSync(process.execPath, [join(verifyConsumer, 'smoke.mjs')], { cwd: verifyConsumer, stdio: ['ignore', 'pipe', 'inherit'] });
  console.log('[PASS] @uwmd/verify strict root/browser declarations compile, and both entries run, with no other @uwmd/* package installed');
} finally {
  assert.equal(dirname(resolve(verifyConsumer)), resolve(tmpdir()));
  rmSync(verifyConsumer, { recursive: true, force: true });
}

// Then core, with its exact @uwmd/verify dependency beside it.
const typeConsumer = mkdtempSync(join(tmpdir(), 'uwmd-package-types-'));
try {
  install(typeConsumer, '@uwmd/core', 'packages/uwmd-core', coreFiles);
  install(typeConsumer, '@uwmd/verify', 'packages/uwmd-verify', verifyFiles);
  installThirdParty(typeConsumer);
  assert.equal(existsSync(join(typeConsumer, 'node_modules/@anthropic-ai/sdk')), false);
  assert.equal(existsSync(join(typeConsumer, 'node_modules/@uwmd/signing')), false);
  compileConsumer(typeConsumer, `import { parseUWFile, writeAgentBlock, type RunResult } from '@uwmd/core';
import { parseUWFile as parseBrowser, writeAgentBlock as writeBrowser } from '@uwmd/core/browser';
export const parsers = [parseUWFile, parseBrowser];
export const writers = [writeAgentBlock, writeBrowser];
export type Written = RunResult;
`);
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

const signingFiles = packedFiles('@uwmd/signing');
requireFiles('@uwmd/signing', signingFiles, ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts', 'dist/keystore-file.js']);
rejectSourceOrTests('@uwmd/signing', signingFiles);

// Every package the release workflow publishes (eight from 4.1.0) must
// install outside this repository: no
// workspace-only dependency specifier, exact @uwmd/* pins, public metadata,
// and every export and bin target inside the tarball it ships.
const packedByName = new Map([
  ['@uwmd/verify', verifyFiles], ['@uwmd/core', coreFiles], ['@uwmd/cli', cliFiles], ['@uwmd/batch', batchFiles], ['@uwmd/lake', lakeFiles],
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

console.log(`[PASS] @uwmd/verify package: ${verifyFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/core package: ${coreFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/cli package: ${cliFiles.size} files, CLI wrapper present`);
console.log(`[PASS] @uwmd/batch package: ${batchFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/lake package: ${lakeFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/excel package: ${excelFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/report package: ${reportFiles.size} files, production artifacts present`);
console.log(`[PASS] @uwmd/signing package: ${signingFiles.size} files, production artifacts present`);
