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
const EXECUTED_OBSERVER_SHA256 = sha(readFileSync(SELF));
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
const blobMaps = new Map();
function blobHashes(root) {
  if (blobMaps.has(root)) return blobMaps.get(root);
  const paths = git(root, 'ls-files').split('\n');
  const batch = spawnSync('git', ['-C', root, 'cat-file', '--batch'], { input: paths.map(path => `HEAD:${path}\n`).join(''), maxBuffer: 512 * 1024 * 1024 });
  assert.equal(batch.status, 0, String(batch.stderr));
  const hashes = new Map();
  let offset = 0;
  for (const path of paths) {
    const end = batch.stdout.indexOf(10, offset);
    const header = batch.stdout.subarray(offset, end).toString();
    offset = end + 1;
    if (header.endsWith(' missing')) continue;
    const length = Number(header.split(' ')[2]);
    hashes.set(path, sha(batch.stdout.subarray(offset, offset + length)));
    offset += length + 1;
  }
  assert.equal(offset, batch.stdout.length);
  blobMaps.set(root, hashes);
  return hashes;
}
function fileIdentity(root, path) {
  const bytes = readFileSync(join(root, path));
  return { path: slash(path), bytes: bytes.length, sha256: sha(bytes), git_blob_sha256: blobHashes(root).get(slash(path)) ?? null };
}
function identity(root) {
  const files = git(root, 'ls-files', 'packages/uwmd-verify/src', 'packages/uwmd-core/src', 'packages/uwmd-cli/bin');
  return { checkout_commit: git(root, 'rev-parse', 'HEAD'), checkout_tree: git(root, 'rev-parse', 'HEAD^{tree}'), observer_sha256: EXECUTED_OBSERVER_SHA256, node: process.version,
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
    const anchor = 'routeBlock(result, block, block.annotation.section, block.annotation, block.prose, roleVariantSections);';
    source = replaceExactly(source, anchor, `${anchor}\n  __actorRemember(result, scanned, content);`);
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
  const paths = git(ROOT, 'ls-files', 'conformance').split('\n').filter(path => /\.(?:uwx|uw|uwpart)\.md$/.test(path));
  const rows = [];
  for (const path of paths) {
    const raw = readFileSync(join(ROOT, path), 'utf8');
    const physical = [];
    try {
      const parsed = api.parseUWFile(raw, { onBlock: block => physical.push(block) });
      remember(parsed, physical, raw);
      const model = inspectModel(parsed);
      try {
        const result = api.validateUWFile(parsed);
        rows.push({ ...fileIdentity(ROOT, path), parse: 'executed', validation: 'executed', model,
          actual: { overall_status: result.overall_status, errors: result.errors.length, issues: result.issues, result_sha256: sha(json(result)) },
          proposal_executed: false });
      } catch (error) { rows.push({ ...fileIdentity(ROOT, path), parse: 'executed', validation: 'refused', model, error: { name: error.name, code: error.code ?? null, message: error.message } }); }
    } catch (error) { rows.push({ ...fileIdentity(ROOT, path), parse: 'refused', observed_prefix_blocks: physical.length, error: { name: error.name, code: error.code ?? null, message: error.message } }); }
  }
  return { kind: 'direct-source-api-scan-not-corpus-driver-conformance', identity: identity(root), input_checkout: git(ROOT, 'rev-parse', 'HEAD'), sources: rows };
}
async function apiControls(root) {
  const api = await import(pathToFileURL(join(root, 'packages/uwmd-verify/dist/index.js')).href);
  const meta = () => ({ section: 'property', version: 1, provenance: { source: 'manual', actor: 'author' }, lifecycle: { superseded: false } });
  const fence = (section, payload, extras = '') => `\`\`\`json uw:section=${section} v=1${extras ? ` ${extras}` : ''}\n${JSON.stringify(payload)}\n\`\`\``.replaceAll('\\`', '`').replaceAll('\\n', '\n');
  const source = blocks => `---\nuw_version: "3.0"\ndeal_id: actor-inventory\nasset_class: multifamily\n---\n\n${blocks.join('\n\n')}\n`.replaceAll('\\n', '\n');
  const parse = raw => { const physical = []; const parsed = api.parseUWFile(raw, { onBlock: block => physical.push(block) }); remember(parsed, physical, raw); return parsed; };
  const bad = () => { const value = meta(); delete value.provenance.actor; return { _meta: value }; };
  const good = () => ({ _meta: meta() });
  const tests = [];
  for (const [label, value] of [['absent', undefined], ['null', null], ['empty', ''], ['number', 3], ['false', false], ['array', []], ['object', {}], ['space', ' '], ['unicode', 'Ã¤Â½Å“Ã¨â‚¬â€¦'], ['principal-not-source-tag', 'manual']]) {
    const payload = good();
    if (value === undefined) delete payload._meta.provenance.actor; else payload._meta.provenance.actor = value;
    tests.push({ id: `actor-${label}`, parsed: parse(source([fence('property', payload)])) });
  }
  for (const [id, payload] of [['whole-meta-absent', {}], ['meta-null', { _meta: null }], ['meta-flat', { _meta: { actor: '' } }], ['provenance-array', { _meta: { ...meta(), provenance: [] } }], ['lifecycle-array', { _meta: { ...meta(), lifecycle: [] } }], ['section-wrapper', { ...bad(), section_id: 'property' }]]) tests.push({ id, parsed: parse(source([fence('property', payload)])) });
  tests.push({ id: 'overwritten-current-invalid-before-valid', parsed: parse(source([fence('property', bad()), fence('property', good())])) });
  tests.push({ id: 'overwritten-extension-invalid-before-valid', parsed: parse(source([fence('x_example', bad()), fence('x_example', good())])) });
  tests.push({ id: 'superseded-annotation-invalid', parsed: parse(source([fence('property', bad(), 'superseded=true'), fence('property', good())])) });
  const history = bad(); history._meta.lifecycle.superseded = true;
  tests.push({ id: 'superseded-lifecycle-invalid', parsed: parse(source([fence('property', history), fence('property', good())])) });
  tests.push({ id: 'unselected-role-peer-invalid', parsed: parse(source([fence('property', { ...bad(), _role: { kind: 'component', component_id: 'other' } }, 'variant=unselected'), fence('property', { ...good(), _role: { kind: 'property' } }, 'variant=selected')])) });
  tests.push({ id: 'all-six-model-collections-and-history', parsed: parse(source([fence('property', bad()), fence('x_extension', bad()), fence('pipeline_log', bad()), fence('custom_calculations', bad()), fence('custom_scenarios', bad()), fence('property', bad(), 'superseded=true')])) });
  tests.push({ id: 'newly-exposed-wrapper-before-actor', parsed: parse(source([fence('x_hidden', { section_id: 'x_hidden', ...bad() }), fence('x_hidden', good()), fence('x_tail', bad())])) });
  const stale = parse(source([fence('property', bad())])); stale.raw = source([fence('property', good())]);
  tests.push({ id: 'stale-raw-does-not-repair-content', parsed: stale });
  const rawBad = parse(source([fence('property', good())])); rawBad.raw = source([fence('property', bad())]);
  tests.push({ id: 'stale-raw-does-not-inject-error', parsed: rawBad });
  const repaired = parse(source([fence('property', bad())])); repaired.sections.property.content._meta.provenance.actor = 'repaired';
  tests.push({ id: 'in-place-content-edit-is-current-authority', parsed: repaired });
  const divergent = parse(source([fence('property', bad())])); divergent.sections.property.meta = meta();
  tests.push({ id: 'convenience-meta-cannot-repair-content', parsed: divergent });
  const divergentGood = parse(source([fence('property', good())])); divergentGood.sections.property.meta = {};
  tests.push({ id: 'convenience-meta-cannot-invalidate-content', parsed: divergentGood });
  const serial = JSON.parse(JSON.stringify(parse(source([fence('x_example', bad()), fence('x_example', good())]))));
  tests.push({ id: 'serialized-model-no-recovered-physical-history', parsed: serial });
  const modelOnly = parse(source([fence('property', good())]));
  const added = parse(source([fence('x_added', bad())])).extensions.x_added;
  modelOnly.extensions.x_added = added;
  tests.push({ id: 'model-only-addition-after-physical', parsed: modelOnly });
  const duplicate = parse(source([fence('property', bad())])); duplicate.extensions.x_alias = duplicate.sections.property;
  tests.push({ id: 'same-object-model-alias-identity-dedup', parsed: duplicate });
  const replaced = parse(source([fence('property', bad())])); replaced.sections.property = parse(source([fence('property', good())])).sections.property;
  tests.push({ id: 'replaced-model-keeps-retained-physical-evidence', parsed: replaced });
  return { kind: 'actual-api-authority-precedence-controls', identity: identity(root), cases: tests.map(({ id, parsed }) => {
    const model = inspectModel(parsed);
    try { const result = api.validateUWFile(parsed); return { id, model, actual: { overall_status: result.overall_status, issues: result.issues, errors: result.errors.length } }; }
    catch (error) { return { id, model, actual: { refused: true, name: error.name, message: error.message } }; }
  }) };
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
  const originalDirectory = process.cwd();
  const originalNodeOptions = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = `${originalNodeOptions ?? ''} --import=${bootstrap(root)}`.trim();
  const failed = [];
  const tests = [];
  const flatten = tasks => tasks.flatMap(task => task.type === 'test' ? [{ name: task.name, state: task.result?.state, errors: task.result?.errors ?? [] }] : flatten(task.tasks ?? []));
  try {
    for (const pkg of ['uwmd-verify', 'uwmd-core']) {
      const packageRoot = join(root, 'packages', pkg);
      const packageSelection = selected.filter(path => path.startsWith(`packages/${pkg}/`)).map(path => join(root, path));
      process.chdir(packageRoot);
      const ctx = await startVitest('test', packageSelection, { root: packageRoot, config: false, watch: false, pool: 'forks', maxWorkers: 2, fileParallelism: true, passWithNoTests: false }, {
        resolve: { alias },
        plugins: [{ name: 'actor-inventory-read-only-observer', enforce: 'pre', transform(source, id) { return instrument(source.replaceAll('\r\n', '\n'), id, true); } }],
      });
      for (const file of ctx?.state.getFiles() ?? []) {
        const path = slash(relative(root, file.filepath));
        tests.push({ path, state: file.result?.state, tests: flatten(file.tasks) });
        if (file.result?.state === 'fail') failed.push({ name: path, errors: file.result?.errors });
      }
      await ctx?.close();
    }
  } finally {
    process.chdir(originalDirectory);
    if (originalNodeOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = originalNodeOptions;
  }
  return { kind: 'dynamic-validator-reaching-unit-observation', identity: identity(root),
    selection: { rule: 'tracked verify/core .test.ts with statically resolvable transitive import path to validator.ts; package cwd retained; explicit own-dist loader in subprocesses; catalog-only files explicitly listed', selected, catalog_only: allTestSources.filter(path => !selected.includes(path)) },
    failed, files: tests, journal: readJournal(journal) };
}
async function cliObserve(root, output) {
  const cases = git(ROOT, 'ls-files', 'conformance/runner/cases').split('\n').filter(path => path.endsWith('.case.json')).map(path => ({ path, declaration: JSON.parse(readFileSync(join(ROOT, path), 'utf8')) })).filter(row => row.declaration.command === 'validate');
  const journal = `${output}.journal.jsonl`;
  assert(!existsSync(journal));
  const rows = [];
  for (const { path, declaration: entry } of cases) {
    const args = entry.args.map((arg, i) => i === 0 && entry.fixture_dir ? join(ROOT, entry.fixture_dir, arg) : arg);
    const runResult = run(root, [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), 'validate', ...args], journal);
    let result = null;
    try { result = JSON.parse(runResult.stdout); } catch { /* Refusal output is preserved separately. */ }
    rows.push({ id: entry.id, case: fileIdentity(ROOT, path), expected: entry.expect?.file ? fileIdentity(ROOT, entry.expect.file) : null,
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
  else if (mode === 'controls') result = await apiControls(root);
  else if (mode === 'unit') result = await unitObserve(root, output);
  else if (mode === 'cli') result = await cliObserve(root, output);
  else throw new Error(`Unknown mode ${mode}`);
  noOverwrite(output, result);
  console.log(JSON.stringify({ mode, output, sha256: sha(readFileSync(output)) }));
}
