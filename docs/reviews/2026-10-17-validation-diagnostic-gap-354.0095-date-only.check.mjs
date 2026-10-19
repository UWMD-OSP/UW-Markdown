#!/usr/bin/env node
// Draft-only independent TS/Python/schema comparison; no production imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import Ajv2020 from 'ajv/dist/2020.js';

const stem = '2026-10-17-validation-diagnostic-gap-354.0095-date-only';
const directory = fileURLToPath(new URL('./', import.meta.url));
const source = suffix => join(directory, `${stem}${suffix}`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const vectorBytes = readFileSync(source('.vectors.json'));
assert.equal(sha(vectorBytes), 'f8d3ebc4aef8b0992edf2a333cc53fa2325b869c680ba990158225f18c6e7400');
const vectors = JSON.parse(vectorBytes);
const proposed = JSON.parse(readFileSync(source('.schema.proposed.json'), 'utf8'));
const rfc = readFileSync(new URL('../rfcs/0095-optional-metadata-and-provenance-references.md', import.meta.url), 'utf8');
const embedded = rfc.split('Proposed `$defs/MarketReferenceDate`')[1].match(/```json\n([\s\S]*?)\n```/)[1];
assert.deepEqual(JSON.parse(embedded), proposed, 'RFC and proposed schema must match');
const schema = new Ajv2020({ strict: true, validateFormats: false }).compile(proposed);
const temporary = mkdtempSync(join(tmpdir(), 'uwmd-0095-dates-'));
try {
  const compiler = ts.createProgram([source('.ts')], {
    strict: true, noEmitOnError: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [], outDir: temporary,
  });
  const diagnostics = ts.getPreEmitDiagnostics(compiler);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => directory, getNewLine: () => '\n',
  }));
  assert.equal(compiler.emit().emitSkipped, false);
  writeFileSync(join(temporary, 'package.json'), '{"type":"module"}');
  const { dateOnly } = await import(pathToFileURL(join(temporary, `${stem}.js`)));
  const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  const observed = join(temporary, 'python.json');
  const run = spawnSync(python, [source('.py'), '--vectors', source('.vectors.json'), '--output', observed], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const independent = JSON.parse(readFileSync(observed, 'utf8'));
  const dates = vectors.date_cases.map(row => {
    const actual = dateOnly(row.input);
    assert.equal(actual, row.admitted, row.id);
    assert.equal(schema(row.input), actual, `schema ${row.id}`);
    return { id: row.id, admitted: actual };
  });
  const carriers = vectors.required_as_of_carriers.map(row => {
    const present = Object.hasOwn(row.input, 'as_of');
    const actual = { field_present: present, date_evaluated: present, required_missing: !present,
      admitted: present && dateOnly(row.input.as_of) };
    for (const [key, value] of Object.entries(actual)) assert.equal(value, row[key], `${row.id} ${key}`);
    return { id: row.id, ...actual };
  });
  assert.deepEqual(dates, independent.date_observations);
  assert.deepEqual(carriers, independent.carrier_observations);
  const bits = [];
  for (let year = 1; year <= 400; year++) for (let month = 1; month <= 12; month++) for (let day = 0; day <= 32; day++) {
    const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const actual = dateOnly(value);
    assert.equal(schema(value), actual, `cycle schema ${value}`);
    bits.push(actual ? '1' : '0');
  }
  const truth = sha(bits.join(''));
  const independentCycle = JSON.parse(readFileSync(source('.cycle.json'), 'utf8'));
  assert.equal(truth, independentCycle.truth_sha256);
  assert.equal(truth, independentCycle.oracle_truth_sha256);
  // Re-execute the independently authored Python integer-component oracle.
  const beforeCycle = readFileSync(source('.cycle.json'));
  const cycleRun = spawnSync(python, [source('.cycle.py')], { encoding: 'utf8' });
  assert.equal(cycleRun.status, 0, cycleRun.stderr);
  assert.deepEqual(readFileSync(source('.cycle.json')), beforeCycle);
  assert.deepEqual(readFileSync(source('.vectors.json')), vectorBytes);
  const report = { kind: 'Draft RFC0095 research only; no production activation',
    authority_main: 'fa9a9ea37d31b918f5993eae4276b159f31719f3', node: process.version, platform: process.platform,
    typescript: ts.version, vectors_sha256: sha(vectorBytes),
    observers: Object.fromEntries(['.ts', '.py', '.cycle.py', '.schema.proposed.json', '.check.mjs'].map(suffix => [suffix, sha(readFileSync(source(suffix)))])),
    date_cases: dates.length, date_admitted: dates.filter(row => row.admitted).length,
    date_refused: dates.filter(row => !row.admitted).length, carrier_cases: carriers.length,
    cycle_cases: bits.length, cycle_admitted: bits.filter(bit => bit === '1').length,
    cycle_refused: bits.filter(bit => bit === '0').length, cycle_truth_sha256: truth,
    independent_python_observations_equal: true, independent_calendar_oracle_equal: true,
    schema_without_format_plugins_equal: true, date_observations: dates, carrier_observations: carriers };
  if (process.argv[2]) writeFileSync(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, date_observations: undefined, carrier_observations: undefined }, null, 2));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
