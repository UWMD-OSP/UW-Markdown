// Frozen, read-only replay by default; --create is first creation only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observe } from './auth-review.mjs';
import { sha } from '../codec-study/independent.mjs';
const here = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--verify-root');
assert(rootIndex >= 0 && args[rootIndex + 1], 'explicit --verify-root is required; no workspace alias fallback');
const verifyRoot = resolve(args[rootIndex + 1]);
const create = args.includes('--create');
assert(args.length === (create || args.includes('--check') ? 3 : 2), 'only --verify-root PATH and --create/--check are accepted');
const paths = ['experiments/envelope-0089/decision-proof/auth-review.mjs', 'experiments/envelope-0089/decision-proof/projection.mjs', 'experiments/envelope-0089/decision-proof/check.mjs', 'experiments/envelope-0089/codec-study/independent.mjs', 'spec/UW_FORMAT_SPEC.md', 'spec/UW_PROTOCOL.md', 'spec/UW_RECEIPT.md', 'spec/schemas/uw-envelope.schema.json', 'spec/schemas/uw-document-signature.schema.json', 'spec/schemas/uw-receipt.schema.json'];
const hashes = Object.fromEntries(paths.map(path => [path, sha(readFileSync(new URL(path, root)))]));
const destination = new URL('frozen/observations.json', here);
let expected;
if (!create) {
  expected = JSON.parse(readFileSync(destination));
  assert.deepEqual(hashes, expected.helper_and_contract_hashes, 'recorded helper/contract bytes');
}
const result = await observe(verifyRoot);
assert.deepEqual(Object.fromEntries(paths.map(path => [path, sha(readFileSync(new URL(path, root)))])), hashes, 'helper and contract bytes unchanged during execution');
const summary = {
  candidate_models: result.cases.length,
  real_ed25519_mutation_pairs: result.cases.reduce((sum, row) => sum + row.mutations.length, 0),
  real_ed25519_label_pairs: result.cases.reduce((sum, row) => sum + row.label_mutations.length, 0),
  supplied_sources: result.cases.filter(row => row.source.supplied).length,
  admitted_source_controls: result.cases.filter(row => row.source.admission?.allowed).length,
  refused_source_controls: result.cases.filter(row => row.source.admission && !row.source.admission.allowed).length,
  missing_source_controls: result.cases.filter(row => !row.source.supplied).length,
};
assert.deepEqual(summary, { candidate_models: 7, real_ed25519_mutation_pairs: 42, real_ed25519_label_pairs: 14, supplied_sources: 4, admitted_source_controls: 2, refused_source_controls: 2, missing_source_controls: 3 });
if (create) {
  assert(!existsSync(destination), 'refusing to overwrite frozen auth evidence');
  const record = { status: 'UNAPPROVED RFC0089 DECISION EVIDENCE; NOT PRODUCTION ACCEPTANCE OR COMPLETE VERIFIER CLAIM', source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), source_tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root, encoding: 'utf8' }).trim(), runtime: { node: process.version, openssl: process.versions.openssl, platform: process.platform, arch: process.arch }, explicit_file_url_production_import: true, helper_and_contract_hashes: hashes, command: ['node', 'experiments/envelope-0089/decision-proof/check.mjs', '--verify-root', '<explicit fresh source-pinned verifier checkout>', '--create'], summary, material: result };
  mkdirSync(new URL('frozen/', here), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
} else {
  assert.deepEqual(result, expected.material, 'all frozen cryptographic, projection, source-admission and public API results');
  assert.deepEqual(summary, expected.summary);
}
console.log(`PASS ${JSON.stringify(summary)}; original source/model/helper bytes preserved; real Ed25519 is not source/financial certification`);
