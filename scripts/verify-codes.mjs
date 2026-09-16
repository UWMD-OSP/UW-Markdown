// Verify that every validation code the documents promise is one the library
// can actually emit, and that every family it emits is registered.
//
// This exists because RFC 0058 shipped nine of the ten codes it specified.
// `REC-09` — a stated `cash_flow_ref` must resolve to a §4.26 variant — was in
// the RFC's code table and in the JSON Schema, and nowhere in the validator.
// Nothing went red: the schemas validated, conformance passed (no fixture
// exercised the missing rule, because the fixtures were written from the same
// incomplete implementation), and the RFC read as delivered.
//
// That failure is silent by construction. A missing refusal looks exactly like
// a document that has nothing to refuse. `REC-09` was the worst case of it: a
// true-up row carrying a dangling `cash_flow_ref` claims its settled amount
// reached the cash flows, and with the rule absent nothing contradicts the
// claim.
//
// Three checks:
//
//   1. Every code in an **implemented** RFC's code table is emitted somewhere
//      in `@uwmd/core`. Draft and accepted RFCs are skipped — they describe
//      work that has not shipped, which is the point of the status field.
//   2. Every code documented as a rule bullet in the format spec is emitted.
//      A documented rule nobody enforces is worse than an undocumented one.
//   3. Every emitted code family appears in the protocol's code-prefix table
//      (§XI). A family that never gets registered is invisible to adopters
//      building their own validators.
//
// The reverse of (1) is deliberately NOT checked: a code emitted but absent
// from an RFC table is normal, since most codes predate the RFC process or are
// internal to a verifier.
//
// Run: npm run verify-codes

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];

const read = (p) => readFileSync(resolve(root, p), 'utf8');

/** `REC-09`, `CS-02b`, `WF-10` — a family prefix, a number, an optional suffix. */
const CODE = /[A-Z][A-Z0-9]*-[0-9]+[a-z]?/;

// ── What the library can emit ────────────────────────────────────────────────
//
// Any single-quoted code literal in core's sources. Deliberately broad: codes
// reach `issues` through per-family helpers (`recIssue`, `capxIssue`,
// `hedgeIssue`, `leaseIssue`, `wf01`) as often as through a literal
// `code:` property, and a pattern that only matched the latter would report
// every helper-routed code as missing.

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

const emitted = new Set();
/**
 * Codes that reach a `ValidationMessage`, kept separate from the rest.
 *
 * `@uwmd/core` spells two different things the same way: validation codes,
 * which belong in the protocol's §XI prefix table, and typed-error codes on
 * `UWPackageError` / `UWMarketDataError` and friends (`PKG-001`, `MD-002`,
 * `PKGZIP-003`), which do not — they are thrown, never collected into `issues`.
 * Check 3 would otherwise report every error family as an unregistered
 * validation family.
 */
const validationEmitted = new Set();

for (const file of sourceFiles('packages/uwmd-core/src')) {
  const text = read(file);
  const isValidationSurface = text.includes('ValidationMessage');
  for (const match of text.matchAll(new RegExp(`'(${CODE.source})'`, 'g'))) {
    emitted.add(match[1]);
    if (isValidationSurface) validationEmitted.add(match[1]);
  }
}

// `SHA-256` is an algorithm name that happens to fit the code shape. Listed
// rather than pattern-excluded so a real code can never be silently dropped.
const NOT_A_CODE = new Set(['SHA-256']);
for (const noise of NOT_A_CODE) {
  emitted.delete(noise);
  validationEmitted.delete(noise);
}

if (emitted.size === 0) {
  console.error('[FAIL] no validation codes found in packages/uwmd-core/src — the scan pattern broke, not the codebase');
  process.exit(1);
}

// ── 1. Implemented RFCs ──────────────────────────────────────────────────────

const RFC_DIR = 'docs/rfcs';
const rfcFiles = readdirSync(resolve(root, RFC_DIR))
  .filter((f) => /^\d{4}-.*\.md$/.test(f) && f !== '0000-template.md')
  .sort();

let implementedChecked = 0;
let rfcCodeCount = 0;
for (const file of rfcFiles) {
  const text = read(join(RFC_DIR, file));
  const status = /^status:\s*(\S+)/m.exec(text)?.[1];
  if (status !== 'implemented') continue;
  implementedChecked += 1;

  // Code tables spell a code as the first cell: `| \`REC-09\` | error | … |`.
  const promised = new Set(
    [...text.matchAll(new RegExp(`\\|\\s*\`(${CODE.source})\``, 'g'))].map((m) => m[1]),
  );
  rfcCodeCount += promised.size;
  const missing = [...promised].filter((code) => !emitted.has(code)).sort();
  if (missing.length > 0) {
    failures.push(
      `${file} is marked implemented but its code table promises ${missing.join(', ')}, which @uwmd/core never emits`,
    );
  }
}
if (implementedChecked > 0) {
  checks.push(`${rfcCodeCount} codes across ${implementedChecked} implemented RFCs are all emitted`);
}

// ── 2. Format-spec rule bullets ──────────────────────────────────────────────

const formatSpec = read('spec/UW_FORMAT_SPEC_v1.md');
const documented = new Set(
  [...formatSpec.matchAll(new RegExp(`^- \`(${CODE.source})\``, 'gm'))].map((m) => m[1]),
);
const undocumentedlyUnenforced = [...documented].filter((code) => !emitted.has(code)).sort();
if (undocumentedlyUnenforced.length > 0) {
  failures.push(
    `the format spec documents ${undocumentedlyUnenforced.join(', ')} as rules, but @uwmd/core never emits them`,
  );
} else {
  checks.push(`${documented.size} format-spec rule bullets are all enforced`);
}

// ── 3. Registered families ───────────────────────────────────────────────────
//
// The protocol's §XI table lists families, not codes: `CS-*`, `REC-NN`,
// `INVALID-ASSET-CLASS-NNN`. A family is registered when its prefix appears
// there in any of those spellings.

const protocol = read('spec/UW_PROTOCOL_v1.md');
const registered = new Set(
  [...protocol.matchAll(/\|\s*`([A-Z][A-Z0-9-]*?)-(?:NN|N|\*|NNN)`/g)].map((m) => m[1]),
);

const emittedFamilies = new Set([...validationEmitted].map((code) => code.slice(0, code.lastIndexOf('-'))));
const unregistered = [...emittedFamilies].filter((family) => !registered.has(family)).sort();

// Families that predate the prefix table and are documented elsewhere in the
// protocol. Listed rather than pattern-matched so adding one is a decision.
const EXEMPT = new Set([
  'CC', 'CC-MOD-HOSP', 'CC-MOD-DC', 'DQ', 'PROTO-EDIT', 'CF', 'LU', 'WF',
  'CS', 'RT', 'PS', 'PORT', 'RCP', 'INT', 'POL', 'MOD', 'CALC', 'SRC',
  'ROLE', 'LOC', 'CUR', 'TAX', 'META', 'INVALID-ASSET-CLASS', 'CAP',
]);
if (emittedFamilies.size === 0) {
  failures.push('no validation families found — the ValidationMessage scope broke, not the codebase');
}
const genuinelyUnregistered = unregistered.filter((f) => !EXEMPT.has(f));
if (genuinelyUnregistered.length > 0) {
  failures.push(
    `these code families are emitted but appear in no protocol §XI prefix row: ${genuinelyUnregistered.join(', ')}`,
  );
} else {
  checks.push(`${emittedFamilies.size} emitted code families are registered or exempt`);
}

// ── Report ───────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  console.error(`\nSummary: ${failures.length} code contract mismatch(es).`);
  process.exit(1);
}

for (const check of checks) console.log(`[PASS] ${check}`);
console.log(`\nSummary: ${emitted.size} emitted codes agree with what the specs and implemented RFCs promise.`);
