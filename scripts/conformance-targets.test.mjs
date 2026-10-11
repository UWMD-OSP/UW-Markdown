import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { corpus, index, key, suiteFamily, indexCases, selection, assertCoverage, assertDispatch, portableOwner, portableReadings } from './conformance-targets.mjs';
import { readConformanceTier, CONFORMANCE_TARGETS } from '../packages/uwmd-core/dist/protocol.js';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cases = readdirSync(new URL('../conformance/runner/cases/', import.meta.url)).filter(f => f.endsWith('.case.json')).map(f => json(`../conformance/runner/cases/${f}`));
test('every original reference and portable case has exactly one owner', () => {
  const original = corpus.cases.filter(c => !c.added);
  assert.equal(original.length, corpus.before.reference_default + corpus.before.reference_opt_in);
  assert.equal(index.size, corpus.cases.length);
  assert.equal(cases.length, corpus.before.portable);
  assert.deepEqual(cases.map(c => c.legacy_id).sort(), [...corpus.portable_legacy_ids].sort());
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const c of cases) assert.equal(c.target, portableOwner(c.legacy_id));
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
  assert.ok(ajv.compile(corpusSchema)(corpus));
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
test('legacy aliases use readConformanceTier and warn outside JSON results', () => {
  const generated = json('../conformance/runner/tier-readings.json');
  assert.deepEqual(generated, portableReadings);
  for (const [name, reading] of Object.entries(generated.tiers)) {
    const source = ['1', '2', '3', '4'].includes(name) ? reading.legacy : name;
    assert.deepEqual(reading, readConformanceTier(source));
    const warnings = [];
    assert.deepEqual(selection([`--tier=${name}`], m => warnings.push(m)), selection([`--tier=${reading.tier}`]));
    assert.equal(warnings.length, reading.legacy ? 1 : 0);
  }
});
test('unknown selectors and unsafe filtered updates are refused', () => {
  for (const args of [['--tier=unknown'], ['--profile=unknown'], ['--suite=unknown'], ['--tier=reader', '--update'], ['--profile=module', '--update']]) assert.throws(() => selection(args));
  assert.ok(selection(['--suite=metrics', '--update']).length);
  assert.ok(selection(['--suite=3', '--update']).some(c => c.suite === '3-refinement'));
  assert.ok(selection(['--suite=4']).some(c => c.suite === '4-profile'));
  assert.throws(() => selection(['--suite=3-refinement', '--update']), /entire suite family/);
  assert.throws(() => selection(['--suite=4-profile', '--update']), /entire suite family/);
});
test('cases added after the migration base are validate-only Verifier projections', () => {
  const added = corpus.cases.filter(c => c.added);
  assert.deepEqual(added.map(c => `${c.suite}/${c.scenario}`).sort(), [
    '1/malformed/06-wrong-actor [validate]',
    '1/malformed/07-replace-where-supersede-required [validate]',
    'currency/malformed [validate]',
    'locale/unsupported-locale-refuses [validate]',
    'source/04-colon-form-rejected [validate]',
  ]);
  for (const c of added) {
    assert.equal(c.target, 'verifier');
    // The mixed source check keeps all of its assertions and its starter owner.
    assert.equal(index.get(key(c.suite, c.scenario.replace(/ \[validate\]$/, ''))).target, 'starter-products');
  }
});
test('numeric legacy shorts are exactly one digit 1-4, as in the Python driver', () => {
  for (const value of ['1', '2', '3', '4']) assert.ok(selection([`--tier=${value}`], () => {}).length);
  for (const value of ['3.0', '0x3', '1e0', '+3', '03', '0', '5', '-1', 'Infinity']) {
    assert.throws(() => selection([`--tier=${value}`], () => {}), /Unknown tier/, value);
  }
  assert.deepEqual(Object.keys(portableReadings.tiers).filter(k => /^\d/.test(k)).sort(), ['1', '2', '3', '4']);
});
test('runner suites without index rows, and indexed suites without a runner, fail closed', () => {
  const families = [...new Set(corpus.cases.map(c => suiteFamily(c.suite)))];
  assert.doesNotThrow(() => assertDispatch(families));
  assert.throws(() => assertDispatch([...families, 'ghost-suite']), /no corpus index rows: ghost-suite/);
  assert.throws(() => assertDispatch(families.filter(f => f !== 'metrics')), /no runner: metrics/);
  assert.throws(() => assertDispatch(['metrics'], []), /no corpus index rows/);
});
test('standard reproduction, custom formula checks and starter behavior stay distinct', () => {
  assert.equal(index.get(key('3', 'revpar-basic')).target, 'module');
  // Protocol §II.2: IRR procedure (3), expression grammar and builtins (6),
  // dictionary reproduction (2) and the resolution its section_roles use.
  for (const c of corpus.cases.filter(c => c.suite === '3' && c.scenario !== 'revpar-basic')) assert.equal(c.target, 'verifier', c.scenario);
  for (const id of ['no-stack-single-loan', 'gd05-total-equity']) assert.equal(index.get(key('capital-stack', id)).target, 'verifier');
  for (const c of corpus.cases.filter(c => c.suite === 'lite' && (/\[(compile-report|uwx)\]$/.test(c.scenario) || c.scenario.startsWith('compile/')))) assert.equal(c.target, 'representations', c.scenario);
  for (const id of ['context-valid', 'context-omits-source-bytes', 'deterministic-encoding']) assert.equal(index.get(key('packages', `invariant/${id}`)).target, 'representations');
  assert.equal(corpus.cases.find(c => c.suite === '3-refinement').target, 'starter-products');
  assert.ok(corpus.cases.filter(c => c.suite === 'metrics').every(c => c.target === 'verifier'));
  for (const c of corpus.cases.filter(c => ['2', '4', '4-profile', '4-replay', 'migrate', 'capability'].includes(c.suite))) assert.equal(c.target, 'starter-products');
});


test('actual CLI legacy warning stays on stderr and produces Reader-only JSON', () => {
  const proc = spawnSync(process.execPath, [fileURLToPath(new URL('./run-conformance.mjs', import.meta.url)), '--tier=tier-2-editor', '--json'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stderr, /Deprecated tier/);
  const report = JSON.parse(proc.stdout);
  assert.deepEqual(report.summary, { pass: 23, fail: 0, updated: 0 });
  assert.ok(report.results.every(r => r.target === 'reader' && r.tier === 'reader' && !r.profile && !r.starter_product));
});
