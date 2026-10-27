#!/usr/bin/env node
// Explicit committed-source build. Does not change any package/version/pin.
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { npmInvocation } from './npm-invocation.mjs';

export class SourceBuildError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceBuildError'; this.code = code; }
}
const refuse = (code, message) => { throw new SourceBuildError(code, message); };
const SHA = /^[0-9a-f]{40}$/;
export function sourceBuildIdentity(version, source) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) refuse('BUILD_VERSION_INVALID', 'Invalid declared package version.');
  if (source !== null && (!source || !SHA.test(source.commit ?? '') || !SHA.test(source.tree ?? ''))) refuse('BUILD_SOURCE_INVALID', 'Full source commit and tree are required together.');
  return {
    package_version: version,
    build_version: `${version}+source.${source === null ? 'unknown' : source.commit}`,
    source_commit: source?.commit ?? null,
    source_tree: source?.tree ?? null,
    artifact_kind: source === null ? 'unidentified-source' : 'committed-source',
  };
}
function git(root, ...args) {
  return execFileSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function committedSource(root) {
  const probe = spawnSync('git', ['--no-optional-locks', '-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true });
  if (probe.error?.code === 'ENOENT' || probe.status === 128) return null;
  if (probe.error || probe.status !== 0) refuse('BUILD_GIT_FAILED', 'Cannot inspect source identity.');
  if (realpathSync(probe.stdout.trim()) !== realpathSync(root)) refuse('BUILD_ROOT_INVALID', 'Build from the repository root.');
  if (git(root, 'status', '--porcelain', '--untracked-files=all')) refuse('BUILD_SOURCE_DIRTY', 'Commit source changes before creating an identified build.');
  return { commit: git(root, 'rev-parse', 'HEAD^{commit}'), tree: git(root, 'rev-parse', 'HEAD^{tree}') };
}
const outputs = [
  { dir: 'packages/uwmd-verify', info: 'VERIFY_BUILD_INFO', version: 'VERIFY_BUILD_VERSION' },
  { dir: 'packages/uwmd-core', info: 'BUILD_INFO', version: 'BUILD_VERSION' },
];
function writeMetadata(root, source) {
  for (const output of outputs) {
    const folder = resolve(root, output.dir, 'dist');
    mkdirSync(folder, { recursive: true });
    const where = relative(realpathSync(root), realpathSync(folder));
    if (where === '..' || where.startsWith(`..${sep}`) || resolve(root, where) !== realpathSync(folder)) refuse('BUILD_OUTPUT_INVALID', 'Build output must stay within the source root.');
    const declared = JSON.parse(readFileSync(resolve(root, output.dir, 'package.json'), 'utf8')).version;
    const info = sourceBuildIdentity(declared, source);
    const outputFile = resolve(folder, 'build-info.js');
    if (lstatSync(outputFile, { throwIfNoEntry: false })?.isSymbolicLink()) refuse('BUILD_OUTPUT_INVALID', 'Build metadata must not follow an output link.');
    writeFileSync(outputFile, `// Generated supplemental source identity.\nexport const ${output.info} = Object.freeze(${JSON.stringify(info, null, 2)});\nexport const ${output.version} = ${output.info}.build_version;\n`);
  }
}
export function buildSource(root, { runBuild } = {}) {
  root = realpathSync(resolve(root));
  const before = committedSource(root);
  // A failed build cannot leave a prior identified stamp on partially rebuilt outputs.
  writeMetadata(root, null);
  if (runBuild) runBuild(root);
  else {
    const npm = npmInvocation();
    execFileSync(npm.command, [...npm.prefix, 'run', 'build'], { cwd: root, stdio: 'inherit', windowsHide: true });
  }
  const after = committedSource(root);
  if (JSON.stringify(before) !== JSON.stringify(after)) refuse('BUILD_SOURCE_CHANGED', 'Source identity changed during the build.');
  writeMetadata(root, after);
  return { core: sourceBuildIdentity(JSON.parse(readFileSync(resolve(root, 'packages/uwmd-core/package.json'), 'utf8')).version, after), verify: sourceBuildIdentity(JSON.parse(readFileSync(resolve(root, 'packages/uwmd-verify/package.json'), 'utf8')).version, after) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) refuse('BUILD_ARGUMENTS_INVALID', 'Usage: node scripts/build-source.mjs');
    const result = buildSource(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`${error.code ?? 'BUILD_FAILED'}: ${error.message}`);
    process.exitCode = 1;
  }
}
