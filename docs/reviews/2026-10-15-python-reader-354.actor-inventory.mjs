#!/usr/bin/env node
// Read-only research inventory for the unaccepted required-actor diagnostic.
// No production import is redirected outside the explicitly supplied checkout.
// Static proposals are never reported as candidate execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = pathResolve(dirname(SELF), '../..');
const KEY = Symbol.for('uwmd.actor.inventory');
const sha = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = value => JSON.stringify(value, (_key, entry) => typeof entry === 'number' && !Number.isFinite(entry) ? { $number: String(entry) } : entry);
function state() {
  globalThis[KEY] ??= { origins: new WeakMap(), sequence: 0 };
  return globalThis[KEY];
}
function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trimEnd();
}
function fileIdentity(root, path) {
  const bytes = readFileSync(join(root, path));
  const blob = spawnSync('git', ['-C', root, 'show', `HEAD:${slash(path)}`]);
  return { path: slash(path), bytes: bytes.length, sha256: sha(bytes), git_blob_sha256: blob.status === 0 ? sha(blob.stdout) : null };
}
function identity(root) {
  const files = git(root, 'ls-files', 'packages/uwmd-verify/src', 'packages/uwmd-core/src', 'packages/uwmd-cli/bin');
  return { checkout_commit: git(root, 'rev-parse', 'HEAD'), checkout_tree: git(root, 'rev-parse', 'HEAD^{tree}'), node: process.version,
    v8: process.versions.v8, platform: process.platform, architecture: process.arch,
    implementation: files.split('\n').filter(path => !path.endsWith('.test.ts')).map(path => fileIdentity(root, path)) };
}
function emit(row) {
  const output = process.env.UWMD_ACTOR_JOURNAL;
  if (output) appendFileSync(output, `${json(row)}\n`);
}
export function remember(parsed, physical, source) {
  state().origins.set(parsed, { physical: [...physical], source_sha256: sha(source) });
}
function visibleBlocks(parsed) {
  const rows = [];
  const add = (path, block) => rows.push({ path, block });
  for (const [id, entry] of Object.entries(parsed.sections ?? {})) {
    if (object(entry) && !('annotation' in entry)) for (const [variant, block] of Object.entries(entry)) add(`sections.${id}.${variant}`, block);
    else add(`sections.${id}`, entry);
  }
  for (const [id, blocks] of Object.entries(parsed.superseded ?? {})) for (let i = 0; i < blocks.length; i++) add(`superseded.${id}[${i}]`, blocks[i]);
  for (const name of ['pipeline_log', 'custom_calculations', 'custom_scenarios']) for (const [i, block] of (parsed[name] ?? []).entries()) add(`${name}[${i}]`, block);
  for (const [id, block] of Object.entries(parsed.extensions ?? {})) add(`extensions.${id}`, block);
  return rows;
}
export function inspectModel(parsed) {
  const origin = state().origins.get(parsed);
  const visible = visibleBlocks(parsed);
  const seen = new Set();
  const rows = [];
  const add = (block, ordinal, source) => {
    if (seen.has(block)) return;
    seen.add(block);
    const content = block?.content;
    const meta = content?._meta;
    const paths = visible.filter(row => row.block === block).map(row => row.path);
    const wrapper = content !== null && content !== undefined && (Object.hasOwn(content, 'section_id') || (meta !== undefined && (!object(meta) || !object(meta.provenance) || !object(meta.lifecycle))));
    const actorPresent = object(meta?.provenance) && Object.hasOwn(meta.provenance, 'actor');
    const actor = meta?.provenance?.actor;
    const classification = wrapper ? 'existing-wrapper-precedence' : meta === undefined ? 'missing-meta-precedence'
      : typeof actor === 'string' && actor.length > 0 ? 'unchanged-valid-actor' : 'proposed-actor-error';
    rows.push({ ordinal, origin: source, section: block?.annotation?.section ?? null,
      variant: block?.annotation?.variant ?? null, variant_present: Object.hasOwn(block?.annotation ?? {}, 'variant'),
      line_start: block?.lineStart ?? null, line_end: block?.lineEnd ?? null,
      superseded_annotation: block?.annotation?.superseded === true,
      superseded_lifecycle: meta?.lifecycle?.superseded === true,
      selected_paths: paths, retained_in_model: paths.length > 0,
      raw_json_sha256: typeof block?.rawJson === 'string' ? sha(block.rawJson) : null,
      content_sha256: sha(json(content) ?? 'undefined'),
      meta_actor_present: actorPresent, actor_type: actor === null ? 'null' : typeof actor,
      actor_value: actor === undefined ? { $absent: true } : actor,
      classification, additional_wrapper_finding: wrapper && paths.length === 0 });
  };
  for (const [i, block] of (origin?.physical ?? []).entries()) add(block, i, 'parser-physical');
  for (const { block } of visible) add(block, rows.length, 'model-only');
  return { authority: origin ? 'parser-origin-plus-model-identity-union' : 'model-only-no-physical-source-claim',
    parser_source_sha256: origin?.source_sha256 ?? null,
    current_raw_sha256: typeof parsed.raw === 'string' ? sha(parsed.raw) : null,
    stale_raw: origin ? sha(parsed.raw ?? '') !== origin.source_sha256 : null,
    visible_reference_count: visible.length, unique_blocks: rows.length, blocks: rows,
    proposed_actor_errors: rows.filter(row => row.classification === 'proposed-actor-error').length,
    additional_wrapper_findings: rows.filter(row => row.additional_wrapper_finding).length };
}
export function observedValidate(fn, args, context = {}) {
  const before = inspectModel(args[0]);
  try {
    const result = fn(...args);
    emit({ kind: 'validation', sequence: state().sequence++, context, model: before,
      actual: { overall_status: result.overall_status, issues: result.issues, errors: result.errors.length,
        result_sha256: sha(json(result)) },
      proposal: { executed: false, additional_errors: before.proposed_actor_errors + before.additional_wrapper_findings,
        disposition: before.proposed_actor_errors + before.additional_wrapper_findings ? 'requires-candidate-execution-and-governed-expectation-disposition' : 'no-new-actor-or-newly-exposed-wrapper-finding' } });
    return result;
  } catch (error) {
    emit({ kind: 'validation-refusal', sequence: state().sequence++, context, model: before, actual: { name: error.name, code: error.code ?? null, message: error.message } });
    throw error;
  }
}
function replaceExactly(source, anchor, replacement) {
  assert.equal(source.split(anchor).length, 2, `Observer anchor must occur once: ${anchor.slice(0, 80)}`);
  return source.replace(anchor, replacement);
}
export function instrument(source, path, unit = false) {
  const normalized = slash(path).split('?')[0];
  const runtime = pathToFileURL(SELF).href;
  const context = unit ? '{test: __actorExpect.getState().currentTestName ?? null, test_file: __actorExpect.getState().testPath ?? null}' : '{entry: process.argv[1] ?? null}';
  let injected = false;
  if (/\/uwmd-verify\/(src\/parser\.ts|dist\/parser\.js)$/.test(normalized)) {
    const anchor = /routeBlock\(result, block, block\.annotation\.section, block\.annotation, block\.prose, roleVariantSections\);\n(\s*)return result;/g;
    assert.equal([...source.matchAll(anchor)].length, 1, 'Exactly one parser routing-complete anchor');
    source = source.replace(anchor, 'routeBlock(result, block, block.annotation.section, block.annotation, block.prose, roleVariantSections);\n$1__actorRemember(result, scanned, content);\n$1return result;');
    source = `import { remember as __actorRemember } from ${JSON.stringify(runtime)};\n${source}`;
    injected = true;
  }
  if (/\/uwmd-verify\/(src\/validator\.ts|dist\/validator\.js)$/.test(normalized)) {
    source = replaceExactly(source, 'export function validateUWFile(', 'function __actorOriginalValidateUWFile(');
    source = `import { observedValidate as __actorObserve } from ${JSON.stringify(runtime)};\n${source}\nexport function validateUWFile(...args) { return __actorObserve(__actorOriginalValidateUWFile, args, ${context}); }\n`;
    injected = true;
  }
  if (injected && unit) source = `import { expect as __actorExpect } from 'vitest';\n${source}`;
  return injected ? source : null;
}
// Node loader hooks are used only for explicit own-checkout dist imports/CLI.
let loaderRoot = ROOT;
export function initialize(data) { loaderRoot = data.root; }
export async function resolve(specifier, context, nextResolve) {
  if (/^@uwmd\//.test(specifier)) {
    const [, name, suffix] = specifier.match(/^@uwmd\/([^/]+)(?:\/(.*))?$/);
    const path = join(loaderRoot, 'packages', `uwmd-${name}`, 'dist', `${suffix ?? 'index'}.js`);
    assert(existsSync(path), `Explicit local workspace dependency unavailable: ${path}`);
    return { url: pathToFileURL(path).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (url.startsWith('file:') && result.format === 'module') {
    const source = String(result.source).replaceAll('\r\n', '\n');
    const transformed = instrument(source, fileURLToPath(url));
    if (transformed) return { ...result, source: transformed };
  }
  return result;
}
function bootstrap(root) {
  return `data:text/javascript,${encodeURIComponent(`import {register} from 'node:module'; register(${JSON.stringify(pathToFileURL(SELF).href)}, {data:{root:${JSON.stringify(root)}}});`)}`;
}
function run(root, argv, journal, cwd = root) {
  const env = { ...process.env, UWMD_ACTOR_JOURNAL: journal };
  return spawnSync(process.execPath, ['--import', bootstrap(root), ...argv], { cwd, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}
function readJournal(path) { return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []; }
function noOverwrite(path, value) { assert(!existsSync(path), `Refuse evidence overwrite: ${path}`); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function catalog(root) {
  const tracked = git(root, 'ls-files').split('\n');
  const artifacts = tracked.filter(path => path.startsWith('conformance/')).map(path => fileIdentity(root, path));
  const testPaths = tracked.filter(path => /(?:\.test\.(?:ts|mjs)|test_[^/]+\.py)$/.test(path));
  const testSources = testPaths.map(path => ({ ...fileIdentity(root, path),
    literal_api_references: [...new Set(readFileSync(join(root, path), 'utf8').match(/\b(?:parseUWFile|validateUWFile|verifyReceipt|issueReceipt|verifyDocumentSignature|toUWEnvelope|parseUWX|META-01|META_MISSING|provenance|actor)\b/g) ?? [])] }));
  return { kind: 'static-catalog-not-executed-coverage', identity: identity(root),
    indexed_cases: JSON.parse(readFileSync(join(root, 'conformance/corpus-index.json'), 'utf8')).cases,
    portable_cases: tracked.filter(path => path.startsWith('conformance/runner/cases/') && path.endsWith('.case.json')).map(path => ({ ...fileIdentity(root, path), declaration: JSON.parse(readFileSync(join(root, path), 'utf8')) })),
    artifacts, test_sources: testSources };
}
async function sourceScan(root) {
  const api = await import(pathToFileURL(join(root, 'packages/uwmd-verify/dist/index.js')).href);
  const paths = git(root, 'ls-files', 'conformance').split('\n').filter(path => /\.(?:uwx|uw)\.md$/.test(path));
  const rows = [];
  for (const path of paths) {
    const raw = readFileSync(join(root, path), 'utf8');
    const physical = [];
    try {
      const parsed = api.parseUWFile(raw, { onBlock: block => physical.push(block) });
      remember(parsed, physical, raw);
      const model = inspectModel(parsed);
      try {
        const result = api.validateUWFile(parsed);
        rows.push({ ...fileIdentity(root, path), parse: 'executed', validation: 'executed', model,
          actual: { overall_status: result.overall_status, errors: result.errors.length, issues: result.issues, result_sha256: sha(json(result)) },
          proposal_executed: false });
      } catch (error) { rows.push({ ...fileIdentity(root, path), parse: 'executed', validation: 'refused', model, error: { name: error.name, code: error.code ?? null, message: error.message } }); }
    } catch (error) { rows.push({ ...fileIdentity(root, path), parse: 'refused', observed_prefix_blocks: physical.length, error: { name: error.name, code: error.code ?? null, message: error.message } }); }
  }
  return { kind: 'direct-source-api-scan-not-corpus-driver-conformance', identity: identity(root), sources: rows };
}
async function unitObserve(root, output) {
  const { startVitest } = await import('vitest/node');
  const files = git(root, 'ls-files', 'packages/uwmd-verify/src', 'packages/uwmd-core/src').split('\n');
  const modules = new Map(files.filter(path => path.endsWith('.ts')).map(path => [path, readFileSync(join(root, path), 'utf8')]));
  const reaches = (path, seen = new Set()) => {
    if (seen.has(path)) return false;
    seen.add(path);
    if (path === 'packages/uwmd-verify/src/validator.ts') return true;
    const source = modules.get(path) ?? '';
    return [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].some(([, spec]) => {
      const dep = spec.startsWith('.') ? slash(pathResolve(dirname(join(root, path)), spec)).slice(slash(root).length + 1).replace(/\.js$/, '.ts')
        : spec === '@uwmd/verify' ? 'packages/uwmd-verify/src/index.ts' : spec === '@uwmd/core' ? 'packages/uwmd-core/src/index.ts' : '';
      return dep && reaches(dep, seen);
    });
  };
  const selected = files.filter(path => path.endsWith('.test.ts') && reaches(path));
  const allTestSources = files.filter(path => path.endsWith('.test.ts'));
  const alias = ['verify', 'core'].flatMap(name => ['browser', 'index'].map(part => ({ find: part === 'index' ? `@uwmd/${name}` : `@uwmd/${name}/${part}`, replacement: join(root, `packages/uwmd-${name}/src/${part}.ts`) })));
  const journal = `${output}.journal.jsonl`;
  assert(!existsSync(journal));
  process.env.UWMD_ACTOR_JOURNAL = journal;
  const ctx = await startVitest('test', selected, { root, config: false, watch: false, pool: 'forks', maxWorkers: 2, fileParallelism: true, passWithNoTests: false }, {
    resolve: { alias },
    plugins: [{ name: 'actor-inventory-read-only-observer', enforce: 'pre', transform(source, id) { return instrument(source.replaceAll('\r\n', '\n'), id, true); } }],
  });
  const failed = ctx?.state.getFiles().filter(file => file.result?.state === 'fail').map(file => ({ name: file.name, errors: file.result?.errors }));
  const tests = ctx?.state.getFiles().map(file => ({ path: slash(relative(root, file.filepath)), state: file.result?.state, tests: file.tasks.length }));
  await ctx?.close();
  return { kind: 'dynamic-validator-reaching-unit-observation', identity: identity(root),
    selection: { rule: 'tracked verify/core .test.ts with statically resolvable transitive import path to validator.ts; catalog-only files explicitly listed', selected, catalog_only: allTestSources.filter(path => !selected.includes(path)) },
    failed, files: tests, journal: readJournal(journal) };
}
async function cliObserve(root, output) {
  const cases = git(root, 'ls-files', 'conformance/runner/cases').split('\n').filter(path => path.endsWith('.case.json')).map(path => ({ path, declaration: JSON.parse(readFileSync(join(root, path), 'utf8')) })).filter(row => row.declaration.command === 'validate');
  const journal = `${output}.journal.jsonl`;
  assert(!existsSync(journal));
  const rows = [];
  for (const { path, declaration: entry } of cases) {
    const args = entry.args.map((arg, i) => i === 0 && entry.fixture_dir ? join(root, entry.fixture_dir, arg) : arg);
    const runResult = run(root, [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), 'validate', ...args], journal);
    let result = null;
    try { result = JSON.parse(runResult.stdout); } catch { /* Refusal output is preserved separately. */ }
    rows.push({ id: entry.id, case: fileIdentity(root, path), expected: entry.expect?.file ? fileIdentity(root, entry.expect.file) : null,
      command: ['node', 'packages/uwmd-cli/bin/uwmd.mjs', 'validate', ...entry.args],
      actual: { exit_code: runResult.status, signal: runResult.signal, stderr: runResult.stderr, stdout_sha256: sha(runResult.stdout), result }, expected_exit_code: entry.expect?.exit_code ?? null });
  }
  return { kind: 'actual-portable-validate-cli-calls-not-full-runner-comparison', identity: identity(root), cases: rows, journal: readJournal(journal) };
}
const direct = process.argv[1] && pathResolve(process.argv[1]) === SELF;
if (direct) {
  const [mode, output, suppliedRoot] = process.argv.slice(2);
  const root = suppliedRoot ? pathResolve(suppliedRoot) : ROOT;
  assert(output, 'Usage: actor-inventory.mjs catalog|sources|unit|cli OUTPUT [CHECKOUT] (never overwrites output)');
  let result;
  if (mode === 'catalog') result = catalog(root);
  else if (mode === 'sources') result = await sourceScan(root);
  else if (mode === 'unit') result = await unitObserve(root, output);
  else if (mode === 'cli') result = await cliObserve(root, output);
  else throw new Error(`Unknown mode ${mode}`);
  noOverwrite(output, result);
  console.log(JSON.stringify({ mode, output, sha256: sha(readFileSync(output)) }));
}
