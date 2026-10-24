import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { candidate } from './build-runtime.mjs';
import { digest, stamp, preimage } from './model.mjs';

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
