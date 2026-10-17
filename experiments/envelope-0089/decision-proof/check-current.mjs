// Current accepted-main replay; original b2 observations/helpers remain immutable.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { observe } from './auth-current.mjs';
import { sha } from '../codec-study/independent.mjs';
const root = new URL('../../../', import.meta.url);
const here = new URL('./', import.meta.url);
const CURRENT = 'afcc615897aca301c7b5ec070bba7c0bd253e4ef';
const ORIGINAL_SHA = 'a231af9b4f46f40a25c3c1527752c50d70da65997118d8944a040cdfd361dc2b';
const args = process.argv.slice(2);
const index = args.indexOf('--verify-root');
assert(index >= 0 && args[index + 1], 'explicit --verify-root PATH required');
const create = args.includes('--create');
assert(args.length === (create || args.includes('--check') ? 3 : 2), 'only --verify-root PATH and --create/--check');
const verifyRoot = resolve(args[index + 1]);
const originalBytes = readFileSync(new URL('frozen/observations.json', here));
assert.equal(sha(originalBytes), ORIGINAL_SHA, 'original evidence bytes');
const original = JSON.parse(originalBytes);
const oldHelper = readFileSync(new URL('auth-review.mjs', here), 'utf8');
const currentHelper = readFileSync(new URL('auth-current.mjs', here), 'utf8');
assert.equal(currentHelper, oldHelper.replace("const HISTORICAL_BASE = 'b2ac5d8f';", `const HISTORICAL_BASE = '${CURRENT}';`), 'ONLY source-constant substitution; no behavioral helper changes');
const git = (...args) => execFileSync('git', args, { cwd: root });
const contracts = ['spec/UW_FORMAT_SPEC.md', 'spec/UW_PROTOCOL.md'];
const transitions = {};
for (const [path, expected] of Object.entries(original.helper_and_contract_hashes)) {
  const actual = sha(readFileSync(new URL(path, root)));
  if (contracts.includes(path)) {
    assert.equal(sha(git('show', `b2ac5d8f:${path}`)), expected, `historical contract ${path}`);
    assert.equal(sha(git('show', `${CURRENT}:${path}`)), actual, `current contract ${path}`);
    transitions[path] = { original_sha256: expected, current_sha256: actual };
  } else assert.equal(actual, expected, `unchanged original helper/contract ${path}`);
}
for (const [path, expected] of Object.entries(original.material.production.source)) assert.equal(sha(git('show', `b2ac5d8f:${path}`)), expected, `all historical production sources ${path}`);
const require = createRequire(new URL('../../../package.json', import.meta.url));
const dependencyEntry = require.resolve('fast-xml-parser');
const ownPaths = ['experiments/envelope-0089/decision-proof/auth-current.mjs', 'experiments/envelope-0089/decision-proof/check-current.mjs', 'package-lock.json'];
const identities = { original_observations_sha256: ORIGINAL_SHA, original_source_base: original.material.production.source_equivalent_to, current_source_base: CURRENT, old_and_current_contracts: transitions, closure_sha256: Object.fromEntries(ownPaths.map(path => [path, sha(readFileSync(new URL(path, root)))])), indirect_unused_xml_parser_entry_sha256: sha(readFileSync(dependencyEntry)), separately_retained_historical_production_maps: 'frozen/observations.json#/material/production', permitted_behavior_comparison_exclusions: ['material.production.source_equivalent_to', 'material.production.source', 'material.production.compiled'] };
const destination = new URL('frozen/current-main-afcc.json', here);
const expected = create ? undefined : JSON.parse(readFileSync(destination));
if (expected) assert.deepEqual(identities, expected.identities, 'exact current/historical closure');
const material = await observe(verifyRoot);
assert.deepEqual(Object.keys(material.production.source).sort(), Object.keys(original.material.production.source).sort(), 'same complete source set, no allowlist widening');
assert.deepEqual(Object.keys(material.production.compiled).sort(), Object.keys(original.material.production.compiled).sort(), 'same complete compiled set');
const { production: _oldProduction, ...oldBehavior } = original.material;
const { production: _newProduction, ...currentBehavior } = material;
assert.deepEqual(currentBehavior, oldBehavior, 'ALL actual signature/result/refusal/key/backend/source/projection fields, no ignored behavioral cells');
if (create) {
  assert(!existsSync(destination), 'refuse frozen current evidence overwrite');
  writeFileSync(destination, `${JSON.stringify({ status: 'FRESH AFCC RESEARCH REPLAY; UNAPPROVED RFC0089; NOT RELABELED HISTORICAL EVIDENCE', executed_commit: git('rev-parse', 'HEAD').toString().trim(), runtime: { node: process.version, openssl: process.versions.openssl, platform: process.platform, arch: process.arch }, build_note: 'Source maps checked against exact afcc. Initial Windows build was executed by integrator at2834a69c; verify source bytes equal afcc. Every actual compiled runtime module pinned below.', identities, material, all_behavior_fields_identical_to_original: true }, null, 2)}\n`, { flag: 'wx' });
} else assert.deepEqual(material, expected.material, 'all new current-main material, including every source and compiled hash');
console.log('PASS fresh afcc 7-model/42-mutation/14-label source+real-Ed25519 matrix; all behavior matches original; exact identities separately retained');
