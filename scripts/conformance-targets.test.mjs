// Historical tier names below are intentionally refused negative inputs.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { corpus, index, key, suiteFamily, indexCases, selection, assertCoverage, assertDispatch, portableOwner, portableVocabulary } from './conformance-targets.mjs';
import { CONFORMANCE_TARGETS } from '../packages/uwmd-core/dist/protocol.js';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cases = readdirSync(new URL('../conformance/runner/cases/', import.meta.url)).filter(f => f.endsWith('.case.json')).map(f => json(`../conformance/runner/cases/${f}`));
test('every reference and portable case has exactly one owner', () => {
  assert.equal(index.size, corpus.cases.length);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  // A portable case id is `<owner>__<suite>__<scenario>__<operation>`; its owner is the corpus case's.
  for (const c of cases) assert.equal(c.target, portableOwner(...c.id.split('__').slice(1)), c.id);
  assert.deepEqual(new Set(corpus.cases.map(c => c.target)), new Set(CONFORMANCE_TARGETS));
});
test('case and ownership schemas mirror protocol closed vocabularies', () => {
  const ajv = new Ajv({ strict: false });
  const schema = json('../spec/schemas/conformance-case.schema.json');
  const corpusSchema = json('../spec/schemas/conformance-corpus.schema.json');
  assert.deepEqual(schema.properties.target.enum, [...CONFORMANCE_TARGETS]);
  assert.deepEqual(corpusSchema.properties.cases.items.properties.target.enum, [...CONFORMANCE_TARGETS]);
  ajv.addSchema(json('../spec/schemas/implementation-manifest.schema.json'));
  const validate = ajv.compile(schema);
  for (const c of cases) assert.ok(validate(c), `${c.id}: ${JSON.stringify(validate.errors)}`);
  const validateCorpus = ajv.compile(corpusSchema);
  assert.ok(validateCorpus(corpus), JSON.stringify(validateCorpus.errors));
  assert.equal(validate({ ...cases[0], requires_capabilities: ['unknown-capability'] }), false);
  assert.equal(validate({ ...cases[0], target: 'unknown' }), false);
  assert.equal(validate({ ...cases[0], target: 'tier-1-reader' }), false);
});
test('coverage fails closed on omitted, duplicate, unexpected or unclassified cases', () => {
  const one = [corpus.cases[0]];
  assert.throws(() => assertCoverage(one, []), /Missing/);
  assert.throws(() => assertCoverage(one, [...one, ...one]), /Duplicate/);
  assert.throws(() => assertCoverage(one, [corpus.cases[1]]), /Unexpected/);
  assert.throws(() => indexCases([...one, ...one]), /Duplicate/);
  assert.throws(() => indexCases([{ ...one[0], target: 'unknown' }]), /Unknown/);
});
test('Verifier includes Reader without profiles or starter checks', () => {
  const reader = selection(['--tier=reader']);
  assert.deepEqual(reader, selection(['--tier', 'reader']));
  assert.deepEqual(selection(['--profile', 'module']), selection(['--profile=module']));
  assert.throws(() => selection(['--tier']), /Missing value/);
  const verifier = selection(['--tier=verifier']);
  assert.ok(reader.length && verifier.length > reader.length);
  assert.ok(reader.every(c => c.target === 'reader'));
  assert.ok(verifier.every(c => ['reader', 'verifier'].includes(c.target)));
  assert.ok(reader.every(c => verifier.includes(c)));
  assert.ok(selection(['--profile=module']).every(c => c.target === 'module'));
  assert.ok(selection(['--starter-products']).every(c => c.target === 'starter-products'));
});
test('the Python driver reads the generated closed vocabulary', () => {
  assert.deepEqual(json('../conformance/runner/vocabulary.json'), portableVocabulary);
  assert.deepEqual(portableVocabulary.tiers, ['reader', 'verifier']);
});
test('unknown selectors and unsafe filtered updates are refused', () => {
  for (const args of [['--tier=unknown'], ['--profile=unknown'], ['--suite=unknown'], ['--tier=reader', '--update'], ['--profile=module', '--update']]) assert.throws(() => selection(args));
  assert.ok(selection(['--suite=metrics', '--update']).length);
  assert.ok(selection(['--suite=calc', '--update']).some(c => c.suite === 'starter-refinement'));
  assert.ok(selection(['--suite=starter-agent']).some(c => c.suite === 'starter-agent-profile'));
  assert.throws(() => selection(['--suite=starter-refinement', '--update']), /entire suite family/);
  assert.throws(() => selection(['--suite=starter-agent-profile', '--update']), /entire suite family/);
});
test('validate-only Verifier projections of mixed starter checks keep both owners', () => {
  const projections = [
    'documents/malformed/06-wrong-actor [validate]',
    'documents/malformed/07-replace-where-supersede-required [validate]',
    'currency/malformed [validate]',
    'locale/unsupported-locale-refuses [validate]',
    'source/04-colon-form-rejected [validate]',
  ].map((id) => { const slash = id.indexOf('/'); return index.get(key(id.slice(0, slash), id.slice(slash + 1))); });
  for (const c of projections) {
    assert.equal(c.target, 'verifier');
    // The mixed source check keeps all of its assertions and its starter owner.
    assert.equal(index.get(key(c.suite, c.scenario.replace(/ \[validate\]$/, ''))).target, 'starter-products');
  }
});
test('--tier reads only reader or verifier: no retired name, numeric short or suite (RFC 0081 §8)', () => {
  for (const value of ['tier-1-reader', 'tier-2-editor', 'tier-3-calc-host', 'tier-4-agent-host', '1', '3', 'documents', 'calc', 'metrics', 'Reader']) {
    assert.throws(() => selection([`--tier=${value}`]), /Unknown tier/, value);
  }
});
test('runner suites without index rows, and indexed suites without a runner, fail closed', () => {
  const families = [...new Set(corpus.cases.map(c => suiteFamily(c.suite)))];
  assert.doesNotThrow(() => assertDispatch(families));
  assert.throws(() => assertDispatch([...families, 'ghost-suite']), /no corpus index rows: ghost-suite/);
  assert.throws(() => assertDispatch(families.filter(f => f !== 'metrics')), /no runner: metrics/);
  assert.throws(() => assertDispatch(['metrics'], []), /no corpus index rows/);
});
test('standard reproduction, custom formula checks and starter behavior stay distinct', () => {
  assert.equal(index.get(key('calc', 'revpar-basic')).target, 'module');
  // Protocol §II.2: IRR procedure (3), expression grammar and builtins (6),
  // dictionary reproduction (2) and the resolution its section_roles use.
  for (const c of corpus.cases.filter(c => c.suite === 'calc' && c.scenario !== 'revpar-basic')) assert.equal(c.target, 'verifier', c.scenario);
  for (const id of ['no-stack-single-loan', 'gd05-total-equity']) assert.equal(index.get(key('capital-stack', id)).target, 'verifier');
  for (const c of corpus.cases.filter(c => c.suite === 'lite' && (/\[(compile-report|uwx)\]$/.test(c.scenario) || c.scenario.startsWith('compile/')))) assert.equal(c.target, 'representations', c.scenario);
  for (const id of ['context-valid', 'context-omits-source-bytes', 'deterministic-encoding']) assert.equal(index.get(key('packages', `invariant/${id}`)).target, 'representations');
  assert.equal(corpus.cases.find(c => c.suite === 'starter-refinement').target, 'starter-products');
  assert.ok(corpus.cases.filter(c => c.suite === 'metrics').every(c => c.target === 'verifier'));
  for (const c of corpus.cases.filter(c => ['starter-editor', 'starter-agent', 'starter-agent-profile', 'starter-agent-replay', 'capability'].includes(c.suite))) assert.equal(c.target, 'starter-products');
});


test('the actual CLI selects Reader-only JSON for --tier=reader and refuses a retired name', () => {
  const run = (tier) => spawnSync(process.execPath, [fileURLToPath(new URL('./run-conformance.mjs', import.meta.url)), `--tier=${tier}`, '--json'], { encoding: 'utf8', timeout: 60000 });
  const proc = run('reader');
  assert.equal(proc.status, 0, proc.stderr);
  const report = JSON.parse(proc.stdout);
  const readers = corpus.cases.filter(c => c.target === 'reader').length;
  assert.deepEqual(report.summary, { pass: readers, fail: 0, updated: 0 });
  assert.ok(report.results.every(r => r.target === 'reader' && r.tier === 'reader' && !r.profile && !r.starter_product));
  const retired = run('tier-2-editor');
  assert.equal(retired.status, 2);
  assert.match(retired.stderr, /Unknown tier: tier-2-editor/);
});
