#!/usr/bin/env node
// Validates every JSON Schema in spec/schemas/ — well-formed under
// JSON Schema 2020-12 and that all $ref targets resolve.
//
// Run: node scripts/validate-schemas.mjs
//
// Exits 0 when every schema compiles, 1 otherwise.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(here, '..', 'spec', 'schemas');

const files = readdirSync(schemasDir).filter((f) => f.endsWith('.schema.json'));

const ajv = new Ajv({
  strict: false,                 // tolerate union types / unknown formats
  allErrors: true,
  loadSchema: async () => {      // shouldn't fire — every $ref is in this dir
    throw new Error('Remote $ref resolution is disabled.');
  },
});
addFormats.default(ajv);

const docs = files.map((f) => {
  const raw = readFileSync(join(schemasDir, f), 'utf8');
  return { file: f, schema: JSON.parse(raw) };
});

// Pre-register every schema so cross-file $refs resolve (ajv resolves by $id).
for (const { file, schema } of docs) {
  if (!schema.$id) {
    console.error(`[FAIL] ${file}: missing $id`);
    process.exitCode = 1;
    continue;
  }
  if (ajv.getSchema(schema.$id)) continue;
  ajv.addSchema(schema, schema.$id);
}

let pass = 0;
let fail = 0;
for (const { file, schema } of docs) {
  try {
    ajv.compile(schema);
    console.log(`[PASS] ${file}`);
    pass += 1;
  } catch (err) {
    console.error(`[FAIL] ${file}: ${err.message}`);
    fail += 1;
  }
}

console.log(`\nSummary: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
