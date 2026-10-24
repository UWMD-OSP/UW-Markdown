import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { candidate } from './build-runtime.mjs';
import { digest, stamp, preimage } from './model.mjs';
import { encodeXML, decodeXML } from './xml.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = resolve(root, 'node_modules/.cache/rfc0089-evidence');
mkdirSync(folder, { recursive: true });
const packet = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(packet.source_cases[0].expected_model);

test('F5 all candidate stamping entry points admit descriptors before copies, including volatile getters', async () => {
  const observations = [];
  for (const [api, fn] of [['generated-public-stamp', candidate.envelope.stampEnvelopeDigest], ['carrier-stamp', stamp]]) {
    for (const key of ['outer', 'generator', 'generated_at', 'semantic_digest']) for (const deletes of [false, true]) {
      const model = fresh(); let calls = 0;
      Object.defineProperty(model, key, { enumerable: true, configurable: true, get() {
        calls++; if (deletes) delete model[key]; return 'synthetic-getter-value';
      } });
      await assert.rejects(async () => fn(model), /JSON|descriptor/);
      assert.equal(calls, 0);
      assert.equal(typeof Object.getOwnPropertyDescriptor(model, key).get, 'function');
      observations.push({ api, key, self_deleting: deletes, result: 'refused', getter_calls: calls });
    }
    for (const frozen of [false, true]) {
      const model = fresh(); model.outer = [null, { synthetic: true }];
      if (frozen) { Object.freeze(model.outer[1]); Object.freeze(model.outer); Object.freeze(model); }
      const before = preimage(model); const result = await fn(model);
      assert.notEqual(result, model); assert.equal(preimage(result), before);
      assert.equal(result.semantic_digest, digest(result));
      observations.push({ api, frozen, result: 'admitted', returned_stamp_matches_returned_model: true });
    }
  }
  writeFileSync(resolve(folder, 'remaining-stamping.json'), `${JSON.stringify({ platform: process.platform, node: process.version,
    observations, limits: 'Plain/frozen JSON and tested own descriptors; no universal hostile-Proxy guarantee. Native production paths inspected but unchanged; coordinated admission/stamp integration follows acceptance.' }, null, 2)}\n`);
});

test('F2 Fifth Edition prefix boundary and lexical values agree with the separate Python reader', () => {
  const model = fresh();
  model.outer = { 'quote>and-prefix:uw': 'uw:value xmlns:uw= literal &quot; &#0; \u0000\ufffe' };
  const xml = encodeXML(model); const expected = preimage(model);
  const cases = [];
  const rename = prefix => xml.replace('xmlns:uw=', `xmlns:${prefix}=`).replace(/(<\/?)(?:uw:)/g, `$1${prefix}:`);
  for (const prefix of ['p', '\u0370', '\u037d', '\u037f', '\u200c', '\ud7ff', '\uf900', '\ufdcf', '\ufdf0', '\ufffd', '\u{10000}', '\u{effff}', 'p0', 'p-', 'p.', 'p\u0300', 'p\u203f']) {
    cases.push({ name: `valid-prefix-${JSON.stringify(prefix)}`, text: rename(prefix), expected: 'equal', preimage: expected });
  }
  for (const prefix of ['0', '-', '\u037e', '\u200b', '\ue000', '\u{f0000}', 'p:q']) {
    cases.push({ name: `invalid-prefix-${JSON.stringify(prefix)}`, text: rename(prefix), expected: 'refused' });
  }
  cases.push({ name: 'different-raw-end-prefix-same-uri', text: xml.replace('<uw:document ', '<uw:document xmlns:p="https://uwmd.org/ns/document/2" ').replace('</uw:document>', '</p:document>'), expected: 'refused' });
  cases.push({ name: 'injective-prefix-renaming', text: xml.replace('<uw:document ', '<uw:document xmlns:n75_77="https://uwmd.org/ns/document/2" ').replace('<uw:value type="object">', '<n75_77:value type="object">').replace('</uw:value></uw:document>', '</n75_77:value></uw:document>'), expected: 'equal', preimage: expected });
  for (const item of cases) {
    if (item.expected === 'equal') assert.equal(preimage(decodeXML(item.text)), item.preimage, item.name);
    else assert.throws(() => decodeXML(item.text), undefined, item.name);
  }
  writeFileSync(resolve(folder, 'remaining-xml-cases.json'), JSON.stringify(cases));
  const result = spawnSync('python', ['-B', fileURLToPath(new URL('./remaining_xml.py', import.meta.url))], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('preserved independent re-review expectations retain F1/F3 and challenge F2/F4/F5', () => {
  for (const name of ['rereview-boundaries.mjs', 'rereview-admission-csv.mjs']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`./rereviewer/${name}`, import.meta.url))], { cwd: root, encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
  for (const name of ['rereview-xml-cases.json', 'rereview-csv-cases.json']) {
    const received = JSON.parse(readFileSync(new URL(`./rereviewer/${name}`, import.meta.url), 'utf8'));
    const emitted = JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
    assert.deepEqual(emitted, received, `independent explicit input/expectation drift: ${name}`);
  }
  const result = spawnSync('python', ['-B', fileURLToPath(new URL('./rereviewer/rereview-python.py', import.meta.url))], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const [name, count] of [['rereview-boundary-results.json', 169], ['rereview-admission-csv-results.json', 22], ['rereview-python-results.json', 62]]) {
    const report = JSON.parse(readFileSync(resolve(folder, name), 'utf8'));
    assert.equal(report.probes.length, count);
    assert.deepEqual(report.probes.filter(item => !(item.pass ?? item.passed)), [], name);
  }
});
