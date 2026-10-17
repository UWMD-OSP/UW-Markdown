#!/usr/bin/env node
// Read-only research inventory for the unaccepted required-actor diagnostic.
// No production import is redirected outside the explicitly supplied checkout.
// Static proposals are never reported as candidate execution.
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
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
  globalThis[KEY].pending ??= [];
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
  if (row.kind !== 'indexed-case') state().pending.push(row.sequence);
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
export async function observedAPI(name, fn, args, context = {}) {
  const input = { arguments_sha256: sha(json(args)), source_sha256: typeof args[0] === 'string' ? sha(args[0]) : null };
  try {
    const result = await fn(...args);
    emit({ kind: 'consumer-api', sequence: state().sequence++, name, context, input, actual: { result, result_sha256: sha(json(result)) } });
    return result;
  } catch (error) {
    emit({ kind: 'consumer-api-refusal', sequence: state().sequence++, name, context, input, actual: { name: error.name, code: error.code ?? null, message: error.message } });
    throw error;
  }
}
export function observedCase(suite, scenario, status, message) {
  const related_events = state().pending.splice(0);
  emit({ kind: 'indexed-case', sequence: state().sequence++, suite, scenario, status, message: message ?? null, related_events });
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
  if (normalized.includes('/uwmd-verify/') && ['src/receipts.ts', 'dist/receipts.js', 'src/document-signatures.ts', 'dist/document-signatures.js'].some(suffix => normalized.endsWith(suffix))) {
    for (const name of normalized.includes('/receipts.') ? ['issueReceipt', 'verifyReceipt'] : ['verifyDocumentSignature']) {
      source = replaceExactly(source, `export async function ${name}(`, `async function __actorOriginal_${name}(`);
      source += `
export async function ${name}(...args) { return __actorObserveAPI(${JSON.stringify(name)}, __actorOriginal_${name}, args, ${context}); }
`;
    }
    source = `import { observedAPI as __actorObserveAPI } from ${JSON.stringify(runtime)};
${source}`;
    injected = true;
  }
  if (normalized.endsWith('/scripts/run-conformance.mjs')) {
    source = replaceExactly(source, 'function record(suite, scenario, status, message) {', 'function record(suite, scenario, status, message) {\n  __actorObservedCase(suite, scenario, status, message);');
    source = `import { observedCase as __actorObservedCase } from ${JSON.stringify(runtime)};
${source}`;
    // Preserve a shebang as the first line when prepending imports.
    source = source.replace('#!/usr/bin/env node', '');
    injected = true;
  }
  if (injected && unit) source = `import { expect as __actorExpect } from 'vitest';\n${source}`;
  return injected ? source : null;
}
// Node loader hooks bind explicit checkout dist imports/CLI; shared workspace aliases are never trusted.
let loaderRoot = ROOT;
export function initialize(data) { loaderRoot = data.root; }
export async function resolve(specifier, context, nextResolve) {
  if (/^@uwmd\//.test(specifier)) {
    const [, name, suffix] = specifier.match(/^@uwmd\/([^/]+)(?:\/(.*))?$/);
    const path = join(loaderRoot, 'packages', `uwmd-${name}`, 'dist', `${suffix ?? 'index'}.js`);
    assert(existsSync(path), `Explicit local workspace dependency unavailable: ${path}`);
    return { url: pathToFileURL(path).href, shortCircuit: true };
  }
  const result = await nextResolve(specifier, context);
  if (result.url.startsWith('file:')) {
    const match = slash(fileURLToPath(result.url)).match(/\/packages\/(uwmd-[^/]+)\/dist\/(.*)$/);
    if (match) return { url: pathToFileURL(join(loaderRoot, 'packages', match[1], 'dist', match[2])).href, shortCircuit: true };
  }
  return result;
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
  for (const [label, value] of [['absent', undefined], ['null', null], ['empty', ''], ['number', 3], ['false', false], ['array', []], ['object', {}], ['space', ' '], ['unicode', '\u4f5c\u8005'], ['principal-not-source-tag', 'manual']]) {
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
    const fixture = join(ROOT, entry.fixture_dir ?? '');
    const args = entry.args.map(arg => entry.path_args !== false && existsSync(join(fixture, arg)) ? join(fixture, arg) : arg);
    const expectedPath = entry.expect?.file ? entry.expect.file.includes('/') ? entry.expect.file : slash(relative(ROOT, join(fixture, entry.expect.file))) : null;
    const runResult = run(root, [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), 'validate', ...args], journal);
    let result = null;
    try { result = JSON.parse(runResult.stdout); } catch { /* Refusal output is preserved separately. */ }
    rows.push({ id: entry.id, case: fileIdentity(ROOT, path), expected: expectedPath ? fileIdentity(ROOT, expectedPath) : null,
      command: ['node', 'packages/uwmd-cli/bin/uwmd.mjs', 'validate', ...entry.args],
      actual: { exit_code: runResult.status, signal: runResult.signal, stderr: runResult.stderr, stdout_sha256: sha(runResult.stdout), result }, expected_exit_code: entry.expect?.exit_code ?? null });
  }
  return { kind: 'actual-portable-validate-cli-calls-not-full-runner-comparison', identity: identity(root), cases: rows, journal: readJournal(journal) };
}
async function receiptProbe(candidateRoot) {
  const originalPath = 'examples/Parkview-Apts-Glendale-AZ.uwx.md';
  const original = readFileSync(join(ROOT, originalPath), 'utf8');
  const removed = '      "actor": "jared",\n'.replaceAll('\\n', '\n');
  const position = original.indexOf(removed);
  assert(position >= 0, 'Exact authored actor line must exist');
  const actorAbsent = original.slice(0, position) + original.slice(position + removed.length);
  const options = { filename: originalPath, issued_at: '2026-10-17T00:00:00.000Z', issuer: 'unaccepted-actor-inventory' };
  const engines = {};
  const apis = {};
  for (const [name, root] of [['baseline', ROOT], ['candidate', candidateRoot]]) {
    const api = await import(pathToFileURL(join(root, 'packages/uwmd-verify/dist/index.js')).href);
    apis[name] = api;
    const receipts = {};
    for (const [label, source] of [['authored', original], ['actor_absent', actorAbsent]]) {
      const issued = await api.issueReceipt(source, options);
      const payload = api.receiptSigningPayload(issued);
      receipts[label] = { issued, signing_payload_sha256: sha(payload), signing_payload_bytes: Buffer.byteLength(payload),
        verified_by_same_engine: await api.verifyReceipt(issued, source, { filename: originalPath }) };
    }
    engines[name] = { identity: identity(root), receipts };
  }
  const baseline = engines.baseline.receipts.actor_absent;
  const candidate = engines.candidate.receipts.actor_absent;
  assert.deepEqual(baseline.issued.subject, candidate.issued.subject);
  assert.deepEqual(baseline.issued.computation, candidate.issued.computation);
  assert.equal(candidate.issued.policy.validation.errors, baseline.issued.policy.validation.errors + 1);
  const adjusted = structuredClone(baseline.issued);
  adjusted.policy.validation.errors++;
  assert.deepEqual(adjusted, candidate.issued);
  assert.notEqual(baseline.signing_payload_sha256, candidate.signing_payload_sha256);
  const cross = {
    baseline_checks_candidate_receipt: await apis.baseline.verifyReceipt(candidate.issued, actorAbsent, { filename: originalPath }),
    candidate_checks_baseline_receipt: await apis.candidate.verifyReceipt(baseline.issued, actorAbsent, { filename: originalPath }),
  };
  for (const result of [baseline.verified_by_same_engine, candidate.verified_by_same_engine, ...Object.values(cross)]) assert.equal(result.verdict, 'verified');
  return { kind: 'actual-same-bytes-actor-absent-receipt-boundary', source: fileIdentity(ROOT, originalPath),
    transformation: { removed_exact_utf8_line: removed, first_character_offset: position, count: 1, original_sha256: sha(original), actor_absent_sha256: sha(actorAbsent) },
    options, engines, cross_verification: cross,
    conclusion: { same_input_subject_and_computation: true, candidate_policy_errors_delta: 1, signing_payload_changed_only_by_policy_error_count: true,
      unsigned_same_and_cross_verification: 'verified', cryptographic_signature_exercised: false,
      limits: 'Policy count is receipt evidence, not a new receipt refusal or document-signature admission rule. No real financial receipt signature/backend proof is claimed.' } };
}
async function nativeObserve(root, output) {
  const journal = `${output}.journal.jsonl`;
  assert(!existsSync(journal));
  const result = run(root, [join(ROOT, 'scripts/run-conformance.mjs'), '--json'], journal, ROOT);
  let report = null;
  try { report = JSON.parse(result.stdout); } catch { /* Preserve raw output and refusal separately. */ }
  return { kind: 'actual-original-indexed-corpus-driver-observation', identity: identity(root), input_checkout: git(ROOT, 'rev-parse', 'HEAD'),
    driver: fileIdentity(ROOT, 'scripts/run-conformance.mjs'), original_corpus_index: fileIdentity(ROOT, 'conformance/corpus-index.json'),
    actual: { exit_code: result.status, signal: result.signal, stderr: result.stderr, stdout: result.stdout, report }, journal: readJournal(journal) };
}
function unpackInventory(inventory) {
  const table = inventory.catalog_tables;
  assert.equal(table.encoding, 'gzip+base64');
  const compressed = Buffer.from(table.data, 'base64');
  assert.equal(compressed.length, table.gzip_bytes);
  assert.equal(sha(compressed), table.gzip_sha256);
  const decoded = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
  assert.equal(decoded.length, table.decoded_bytes);
  assert.equal(sha(decoded), table.decoded_sha256);
  const tables = JSON.parse(decoded.toString('utf8'));
  assert.deepEqual(Object.keys(tables), table.keys);
  const { catalog_tables: _table, ...rest } = inventory;
  for (const key of table.keys) assert(!Object.hasOwn(rest, key));
  return { ...rest, ...tables };
}
function checkInventory(path) {
  const inventory = unpackInventory(JSON.parse(readFileSync(path, 'utf8')));
  assert.equal(inventory.kind, 'complete-original-actor-case-inventory');
  assert.equal(inventory.sources.length, 798);
  assert.equal(inventory.indexed_cases.length, 1089);
  assert.equal(inventory.original_artifacts.length, 2636);
  assert.equal(inventory.portable_validate.length, 111);
  const originals = inventory.original_artifacts;
  const batch = spawnSync('git', ['-C', ROOT, 'cat-file', '--batch'], { input: originals.map(row => `${row.git_blob_oid}\n`).join(''), maxBuffer: 256 * 1024 * 1024 });
  assert.equal(batch.status, 0, String(batch.stderr));
  let offset = 0;
  for (const row of originals) {
    const end = batch.stdout.indexOf(10, offset);
    const header = batch.stdout.subarray(offset, end).toString();
    assert(!header.endsWith(' missing'), row.path);
    const length = Number(header.split(' ')[2]);
    offset = end + 1;
    assert.equal(sha(batch.stdout.subarray(offset, offset + length)), row.git_blob_sha256 ?? row.sha256, row.path);
    offset += length + 1;
  }
  assert.equal(offset, batch.stdout.length);
  for (const row of inventory.raw_evidence) {
    const bytes = readFileSync(row.absolute_path);
    assert.equal(bytes.length, row.bytes, row.name);
    assert.equal(sha(bytes), row.sha256, row.name);
  }
  const raw = name => JSON.parse(readFileSync(inventory.raw_evidence.find(row => row.name === name).absolute_path, 'utf8'));
  const before = raw('baseline-sources-v2.json').sources;
  const after = raw('candidate-sources.json').sources;
  for (let i = 0; i < before.length; i++) {
    assert.equal(before[i].sha256, after[i].sha256);
    if (!before[i].actual) continue;
    assert.deepEqual(after[i].actual.issues.filter(issue => !(issue.code === 'META-01' && issue.field === '_meta.provenance.actor')), before[i].actual.issues);
  }
  const baseNative = raw('baseline-native.json');
  const candidateNative = raw('candidate-native.json');
  assert.deepEqual(baseNative.actual.report.summary, { pass: 1089, fail: 0, updated: 0 });
  assert.deepEqual(candidateNative.actual.report.summary, { pass: 1052, fail: 37, updated: 0 });
  const consumers = data => data.journal.filter(row => row.kind.startsWith('consumer')).map(row => ({ kind: row.kind, name: row.name, input: row.input, actual: row.actual }));
  assert.deepEqual(consumers(baseNative), consumers(candidateNative));
  assert.equal(consumers(baseNative).length, 32);
  assert.equal(inventory.portable_validate.filter(row => row.baseline_exit === 0 && row.candidate_exit === 1).length, 8);
  assert.equal(inventory.unit_and_api.exact_input_result_changed_calls, 173);
  assert.equal(inventory.unit_and_api.unpaired_cli_subprocess_input_result_multisets_identical, true);
  const receipt = raw('same-input-receipt.json');
  const baselineReceipt = receipt.engines.baseline.receipts.actor_absent.issued;
  const candidateReceipt = receipt.engines.candidate.receipts.actor_absent.issued;
  assert.deepEqual(baselineReceipt.subject, candidateReceipt.subject);
  assert.deepEqual(baselineReceipt.computation, candidateReceipt.computation);
  const adjusted = structuredClone(baselineReceipt);
  adjusted.policy.validation.errors++;
  assert.deepEqual(adjusted, candidateReceipt);
  return { original_blobs_verified: originals.length, preserved_raw_files_verified: inventory.raw_evidence.length,
    original_indexed_cases: 1089, original_expected_mismatches: 37, actual_validate_commands_each: 111,
    source_inputs: 798, paired_consumer_events: 32, same_input_receipt_policy_delta: 1 };
}
const direct = process.argv[1] && pathResolve(process.argv[1]) === SELF;
if (direct) {
  const [mode, output, suppliedRoot] = process.argv.slice(2);
  const root = suppliedRoot ? pathResolve(suppliedRoot) : ROOT;
  assert(output, 'Usage: actor-inventory.mjs catalog|sources|unit|cli OUTPUT [CHECKOUT] (never overwrites output)');
  let result;
  if (mode === 'unpack-inventory') {
    assert(suppliedRoot, 'Supply a new output path for unpack-inventory');
    noOverwrite(pathResolve(suppliedRoot), unpackInventory(JSON.parse(readFileSync(output, 'utf8'))));
    process.exit(0);
  }
  if (mode === 'check-inventory') {
    console.log(JSON.stringify(checkInventory(output)));
    process.exit(0);
  }
  if (mode === 'catalog') result = catalog(root);
  else if (mode === 'sources') result = await sourceScan(root);
  else if (mode === 'controls') result = await apiControls(root);
  else if (mode === 'unit') result = await unitObserve(root, output);
  else if (mode === 'receipt-probe') result = await receiptProbe(root);
  else if (mode === 'native') result = await nativeObserve(root, output);
  else if (mode === 'cli') result = await cliObserve(root, output);
  else throw new Error(`Unknown mode ${mode}`);
  noOverwrite(output, result);
  console.log(JSON.stringify({ mode, output, sha256: sha(readFileSync(output)) }));
}
