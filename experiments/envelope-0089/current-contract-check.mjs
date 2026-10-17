// READ-ONLY RFC0089 evidence: unchanged Envelope1 admission, no candidate validator.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
if (process.argv.length !== 3) throw new Error('Usage: node current-contract-check.mjs <existing-runtime-repository-root>');
const runtime = resolve(process.argv[2]);
const requireRuntime = createRequire(join(runtime, 'package.json'));
const Ajv = requireRuntime('ajv/dist/2020.js').default;
const addFormats = requireRuntime('ajv-formats').default;
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(path);
// Refuse a runtime built from a differing source contract; never copy/install/build it.
const sourceFiles = ['envelope.ts', 'uwjson.ts', 'integrity-canonical.ts', 'integrity.ts'];
for (const file of sourceFiles) assert.equal(
  hash(read(join(root, 'packages/uwmd-verify/src', file))),
  hash(read(join(runtime, 'packages/uwmd-verify/src', file))), file);
const dist = file => join(runtime, 'packages/uwmd-verify/dist', file);
const envelope = await import(pathToFileURL(dist('envelope.js')).href);
const json = await import(pathToFileURL(dist('uwjson.js')).href);
assert.equal(envelope.UW_ENVELOPE_VERSION, '1.0');
assert.equal(json.UW_JSON_REPRESENTATION_VERSION, '1.0.0');
const ajv = new Ajv({ strict: false, allErrors: true,
  loadSchema: async () => { throw new Error('Remote schema resolution is forbidden'); } });
addFormats(ajv);
const schemas = join(root, 'spec/schemas');
for (const file of readdirSync(schemas).filter(name => name.endsWith('.schema.json')).sort()) {
  const schema = JSON.parse(read(join(schemas, file)).toString('utf8'));
  if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema, schema.$id);
}
const envelopeSchema = JSON.parse(read(join(schemas, 'uw-document-envelope.schema.json')).toString('utf8'));
const validate = ajv.getSchema(envelopeSchema.$id);
assert.ok(validate);
const evidence = JSON.parse(read(join(here, 'candidate-preimages.json')).toString('utf8'));
const vectors = Object.fromEntries(evidence.vectors.map(v => [v.name, v]));
const copy = value => JSON.parse(JSON.stringify(value));
const results = [];
async function check(id, input, schemaErrors, decoderCode) {
  const value = copy(input);
  const before = JSON.stringify(value);
  const valid = validate(value);
  const actual = (validate.errors ?? []).map(e => ({ path: e.instancePath, keyword: e.keyword,
    ...(e.keyword === 'required' ? { missing: e.params.missingProperty } : {}) }));
  assert.equal(valid, schemaErrors.length === 0, id);
  assert.deepEqual(actual, schemaErrors, `${id}: exact unchanged-schema refusal`);
  let code = null;
  try { await json.parseUWJsonVerified(JSON.stringify(value)); }
  catch (error) { code = error.code; assert.equal(typeof code, 'string', id); }
  assert.equal(code, decoderCode, `${id}: unchanged verified-JSON decoder layer`);
  assert.equal(JSON.stringify(value), before, `${id}: input not mutated`);
  results.push({ id, schema: valid ? 'accepted' : 'rejected', schema_errors: actual,
    verified_json: code === null ? 'accepted' : 'rejected', decoder_code: code });
}
const old = vectors['historical-empty'];
await check('historical-empty-unsigned', old.semantic_value, [], 'JSON_DIGEST_MISSING');
await check('historical-empty-stamped', { ...old.semantic_value, semantic_digest: old.sha256 }, [], null);
await check('historical-empty-wrong-digest', { ...old.semantic_value, semantic_digest: `sha256:${'0'.repeat(64)}` }, [], 'JSON_DIGEST_MISMATCH');
const stampError = [{ path: '/envelope_version', keyword: 'const' }];
await check('candidate-stamp-only', { ...vectors['candidate-empty'].semantic_value,
  semantic_digest: vectors['candidate-empty'].sha256 }, stampError, 'ENVELOPE_UNSUPPORTED_VERSION');
for (const name of ['candidate-single', 'candidate-one-peer', 'candidate-mixed']) {
  const vector = vectors[name];
  const blockErrors = [
    { path: '/extensions/x_review', keyword: 'required', missing: 'annotation' },
    { path: '/extensions/x_review', keyword: 'required', missing: 'content' },
  ];
  await check(`${name}-new-stamp`, { ...vector.semantic_value, semantic_digest: vector.sha256 },
    [...stampError, ...blockErrors], 'ENVELOPE_UNSUPPORTED_VERSION');
  // A negative control only: relabel a disposable copy, never an issued artifact.
  // Keep its received digest deliberately inconsistent: structure must refuse first.
  await check(`${name}-pretended-1.0`, { ...vector.semantic_value,
    envelope_version: '1.0', semantic_digest: old.sha256 }, blockErrors, 'ENVELOPE_INVALID_BLOCK');
}
// Hashing a caller-provided value is NOT admission: current low-level helpers do
// not run the schema/version guards. Prove that boundary rather than calling it support.
for (const v of evidence.vectors) {
  assert.equal(envelope.canonicalizeUWEnvelope(v.semantic_value), v.canonical_utf8, v.name);
  assert.equal(await envelope.computeEnvelopeDigest(v.semantic_value), v.sha256, v.name);
}
const schemaFiles = ['uw-document-envelope.schema.json', 'uwmd-block.schema.json'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file,
  hash(read(join(root, 'packages/uwmd-verify/src', file)))]));
const schemaHashes = Object.fromEntries(schemaFiles.map(file => [file, hash(read(join(schemas, file)))]));
const runtimeHashes = Object.fromEntries(['envelope.js', 'uwjson.js', 'integrity-canonical.js', 'integrity.js']
  .map(file => [file, hash(read(dist(file)))]));
console.log(JSON.stringify({ status: 'UNACCEPTED DESIGN / CURRENT CONTRACT EVIDENCE',
  baseline: evidence.baseline, node: process.version,
  validator_versions: { ajv: requireRuntime('ajv/package.json').version,
    ajv_formats: requireRuntime('ajv-formats/package.json').version }, schema_hashes: schemaHashes,
  source_hashes: sourceHashes, built_runtime_hashes: runtimeHashes,
  low_level_hash_checks: { count: evidence.vectors.length, admission_claim: false }, results }, null, 2));
