#!/usr/bin/env node
// Conformance runner — exercises every fixture against the @uwmd/core
// reference library and reports pass/fail per scenario.
//
// Usage:
//   node scripts/run-conformance.mjs [--tier=1,2,3,4] [--update] [--json]
//
//   --tier=...   Comma-separated tiers to run. Default: 1,2,3,4-replay,lite,
//                receipts,market-data,modules,packages,composition,capital-stack,
//                lease-up,cash-flow,size-intensive,signing,sensitivity,stochastic,source.
//                Tier 4 requires --tier=4 explicitly because it is shape-only
//                and assumes a deterministic-replay scenario; live LLM calls
//                are out of scope for CI.
//                `lite` is a representation-level suite (UW Lite parse,
//                canonicalization, rendering, and the deal-summary-v1 bridge)
//                and `receipts` is an artifact-level suite (RFC 0016 issuance,
//                verification, and refusal) — neither is a protocol tier, so
//                both are named rather than numbered. `market-data`,
//                `packages`, and `composition` are named for the same reason.
//   --update     Regenerate expected/* files from current library output.
//                Use carefully — this overwrites the baseline.
//   --json       Emit machine-readable JSON summary to stdout.
//
// Exit codes: 0 = all passed, 1 = at least one failure.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  parseUWFile,
  applyEdit,
  applyEditAsync,
  getSection,
  evaluateCalc,
  evaluateSensitivity,
  evaluateStochastic,
  render,
  validateUWFile,
  verifyChain,
  verifyProvenance,
  extractDependencyGraph,
  rankGaps,
  buildContext,
  BANCROFT_LAYERS,
  parseUWLite,
  canonicalizeUWLiteFinancial,
  renderCanonicalUWLite,
  compileUWLite,
  projectUWEnvelopeToLite,
  stringifyUWX,
  issueReceipt,
  verifyReceipt,
  assertUWReceipt,
  runBancroftAgent,
  createReplayProvider,
  parseAgentCassette,
  loadModuleManifest,
  loadModuleManifestAsync,
  createModuleRegistry,
  evaluateModuleCalculations,
  validateAgainstModules,
  resolveAssetClass,
  verifyModuleSignature,
  validateUWDealPackageManifest,
  encodeUWDealPackageZip,
  decodeUWDealPackageZip,
  verifyUWDealPackage,
  projectUWDealPackageContext,
  validateUWDealPackageContext,
  projectPackageLinksToEntityEdges,
  sha256BytesHex,
  parseMarketDataDocument,
  createDocumentMarketData,
  selectCurrentMarketData,
  promoteMarketObservation,
  resolveValue,
  parseUWPart,
  resolveComposition,
  resolveComposite,
  selectInheritedAssumption,
  verifyRollup,
  verifyCapitalStack,
  verifyLeaseUpSchedule,
  leaseUpContext,
  MULTIFAMILY_PACK,
  toUWEnvelope,
  canonicalizeUWEnvelope,
  computeEnvelopeDigest,
  SIZE_INTENSIVES,
  SUPPORTED_LOCALES,
  getSizeIntensive,
  resolveDealSize,
  getPackForAssetClass,
  renderReportHtml,
  computeBlockHash,
  canonicalV2BlockContent,
  canonicalizeV2,
  migrateToV2,
  verifyCashFlowSeries,
  evaluateCashFlowMetrics,
} from '../packages/uwmd-core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFORMANCE_DIR = join(ROOT, 'conformance');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagVal = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
};
const TIERS = (flagVal('tier') ?? '1,2,3,4-replay,lite,receipts,market-data,modules,packages,composition,capital-stack,lease-up,cash-flow,capability,locale,size-intensive,signing,sensitivity,stochastic,source,meta-v2,migrate').split(',').map((s) => s.trim()).filter(Boolean);
const UPDATE = flag('update');
const JSON_OUT = flag('json');

// ─── Result accumulator ───────────────────────────────────────────────────────

const results = []; // { tier, scenario, status: 'pass'|'fail'|'updated', message?: string }

function record(tier, scenario, status, message) {
  results.push({ tier, scenario, status, ...(message ? { message } : {}) });
  if (!JSON_OUT) {
    const tag = status === 'pass' ? 'PASS' : status === 'updated' ? 'UPDT' : 'FAIL';
    const symbol = status === 'pass' ? ' ✓' : status === 'updated' ? ' ↻' : ' ✗';
    // Numbered protocol tiers render as `tier-N`; named suites (e.g. `lite`)
    // stand alone.
    const label = /^\d/.test(String(tier)) ? `tier-${tier}` : String(tier);
    console.log(`[${tag}]${symbol} ${label}/${scenario}${message ? ` — ${message}` : ''}`);
  }
}

// ─── Canonical projection of ParsedUWFile for diffing ────────────────────────

function canonicalParsed(parsed) {
  return {
    frontmatter: parsed.frontmatter,
    sections: Object.fromEntries(
      Object.entries(parsed.sections).map(([id, entry]) => {
        if (isMultiVariant(entry)) {
          return [id, Object.fromEntries(
            Object.entries(entry).map(([v, b]) => [v, projectBlock(b)])
          )];
        }
        return [id, projectBlock(entry)];
      })
    ),
    prose: parsed.prose,
    pipeline_log: parsed.pipeline_log.map((b) => b.content),
    custom_calculations: parsed.custom_calculations.map(projectBlock),
    custom_scenarios: parsed.custom_scenarios.map(projectBlock),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([id, b]) => [id, projectBlock(b)])
    ),
    superseded: Object.fromEntries(
      Object.entries(parsed.superseded).map(([id, blocks]) => [id, blocks.map(projectBlock)])
    ),
  };
}

// The **parse conformance projection** (protocol II.6a.6, RFC 0030).
//
// Deliberately smaller than `ParsedUWFile`. What is NOT here, and why:
//
//   annotation           recoverable from `meta` — it is the fence annotation.
//   lineStart / lineEnd  byte offsets into one reader's tokenization.
//   prose (per block)    recoverable from the document.
//
// Those four are artifacts of how @uwmd/core reads a file, not facts about the
// file. Freezing them as a baseline made a TypeScript interface a protocol
// surface: renaming a field became a breaking protocol change, and an adopter
// with a different in-memory model had to mimic ours to pass tier 1.
function projectBlock(b) {
  if (!b) return null;
  return { meta: projectMeta(b), content: b.content };
}

// `_meta` carries only the keys the *document* carried. The parser fills every
// optional field with null, so projecting `b.meta` wholesale would require an
// implementation to emit `"agent_id": null` for a document that never mentioned
// agent_id — asserting a distinction the source does not make. Absent and
// explicit-null ARE distinguishable in the source, so the original key set is
// read back from the raw block JSON and used to decide presence; values still
// come from the parsed meta, which is normalized.
function projectMeta(b) {
  if (!b.rawJson) return b.meta;
  let declared;
  try {
    declared = JSON.parse(b.rawJson)?._meta;
  } catch {
    return b.meta;
  }
  if (!declared || typeof declared !== 'object') return b.meta;
  const out = {};
  for (const key of Object.keys(b.meta)) {
    if (key in declared) out[key] = b.meta[key];
  }
  return out;
}

function isMultiVariant(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return !('content' in entry) && !('rawJson' in entry);
}

// ─── String normalization for byte-comparison tests ──────────────────────────

function normalize(text) {
  return `${text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}

// ─── Tier 1: Reader ──────────────────────────────────────────────────────────

function runTier1() {
  const fixturesDir = join(CONFORMANCE_DIR, 'tier-1-reader', 'fixtures');
  const expectedDir = join(CONFORMANCE_DIR, 'tier-1-reader', 'expected');
  if (!existsSync(fixturesDir)) {
    record('1', '(none)', 'pass', 'no fixtures');
    return;
  }
  const fixtures = readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.uwx.md'))
    .sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uwx\.md$/, '');
    const fixturePath = join(fixturesDir, fixture);
    const fixtureContent = readFileSync(fixturePath, 'utf8');

    let parsed;
    try {
      parsed = parseUWFile(fixtureContent);
    } catch (e) {
      record('1', id, 'fail', `parse threw: ${e.message}`);
      continue;
    }

    // Compare canonical parsed JSON.
    const actualParsed = canonicalParsed(parsed);
    const actualParsedStr = `${JSON.stringify(actualParsed, null, 2)}\n`;
    const expectedParsedPath = join(expectedDir, `${id}.parsed.json`);

    if (UPDATE) {
      writeFileSync(expectedParsedPath, actualParsedStr);
      record('1', `${id} [parse]`, 'updated');
    } else if (!existsSync(expectedParsedPath)) {
      record('1', `${id} [parse]`, 'fail', `missing baseline: ${basename(expectedParsedPath)}`);
    } else {
      const expected = readFileSync(expectedParsedPath, 'utf8');
      if (normalize(expected) === normalize(actualParsedStr)) {
        record('1', `${id} [parse]`, 'pass');
      } else {
        record('1', `${id} [parse]`, 'fail', 'parsed JSON differs from baseline');
      }
    }

    // Validation verdict. Valid fixtures used to assert nothing about
    // validation, so a rule escalation (warning → error) could flip
    // `uwmd validate` to exit 1 on a fixture with the suite still green —
    // the gap RFC 0027 Appendix A documented. The baseline freezes the
    // overall status and every (code, severity) pair, so both a new code
    // and a severity flip on an existing one are visible diffs.
    let validation;
    try {
      validation = validateUWFile(parsed);
    } catch (e) {
      record('1', `${id} [validate]`, 'fail', `validateUWFile threw: ${e.message}`);
      continue;
    }
    const issuePairs = [...new Map(
      (validation.issues ?? []).map((i) => [`${i.code} ${i.severity}`, { code: i.code, severity: i.severity }])
    ).values()].sort((a, b) => a.code.localeCompare(b.code) || a.severity.localeCompare(b.severity));
    const actualValidationStr = `${JSON.stringify({ overall_status: validation.overall_status, issues: issuePairs }, null, 2)}\n`;
    const expectedValidationPath = join(expectedDir, `${id}.validation.json`);

    if (UPDATE) {
      writeFileSync(expectedValidationPath, actualValidationStr);
      record('1', `${id} [validate]`, 'updated');
    } else if (!existsSync(expectedValidationPath)) {
      record('1', `${id} [validate]`, 'fail', `missing baseline: ${basename(expectedValidationPath)}`);
    } else {
      const expected = readFileSync(expectedValidationPath, 'utf8');
      if (normalize(expected) === normalize(actualValidationStr)) {
        record('1', `${id} [validate]`, 'pass');
      } else {
        record('1', `${id} [validate]`, 'fail', firstDifference(normalize(expected), normalize(actualValidationStr)));
      }
    }

    // Render comparisons (chat + summary).
    for (const fmt of ['chat', 'summary']) {
      let rendered;
      try {
        rendered = render(parsed, { format: fmt });
      } catch (e) {
        record('1', `${id} [render-${fmt}]`, 'fail', `render threw: ${e.message}`);
        continue;
      }
      const ext = fmt === 'chat' ? 'txt' : 'md';
      const expectedPath = join(expectedDir, `${id}.rendered-${fmt}.${ext}`);
      const renderedText = typeof rendered === 'string'
        ? rendered
        : rendered.text ?? JSON.stringify(rendered, null, 2);

      if (UPDATE) {
        writeFileSync(expectedPath, `${renderedText.trimEnd()}\n`);
        record('1', `${id} [render-${fmt}]`, 'updated');
      } else if (!existsSync(expectedPath)) {
        record('1', `${id} [render-${fmt}]`, 'fail', `missing baseline: ${basename(expectedPath)}`);
      } else {
        const expected = readFileSync(expectedPath, 'utf8');
        if (normalize(expected) === normalize(renderedText)) {
          record('1', `${id} [render-${fmt}]`, 'pass');
        } else {
          record('1', `${id} [render-${fmt}]`, 'fail', `render-${fmt} differs from baseline`);
        }
      }
    }
  }
}

// ─── Tier 1: Malformed (negative tests) ──────────────────────────────────────
// Fixtures here are intentionally broken in a way the validator must catch.
// Each <id>.uwx.md has a sibling <id>.expected.json declaring the validator
// codes that MUST appear in the validation result. Extra codes are allowed.

async function runTier1Malformed() {
  const malformedDir = join(CONFORMANCE_DIR, 'tier-1-reader', 'malformed');
  if (!existsSync(malformedDir)) return;

  const fixtures = readdirSync(malformedDir)
    .filter((f) => f.endsWith('.uwx.md'))
    .sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uwx\.md$/, '');
    const fixturePath = join(malformedDir, fixture);
    const expectedPath = join(malformedDir, `${id}.expected.json`);

    if (!existsSync(expectedPath)) {
      record('1', `malformed/${id}`, 'fail', `missing ${id}.expected.json`);
      continue;
    }

    const fixtureContent = readFileSync(fixturePath, 'utf8');
    let expected;
    try {
      expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    } catch (e) {
      record('1', `malformed/${id}`, 'fail', `expected.json is not valid JSON: ${e.message}`);
      continue;
    }

    const mustParse = expected.must_parse !== false;
    const expectedCodes = Array.isArray(expected.expected_codes) ? expected.expected_codes : [];
    if (expectedCodes.length === 0) {
      record('1', `malformed/${id}`, 'fail', 'expected.json has no expected_codes');
      continue;
    }

    let parsed;
    try {
      parsed = parseUWFile(fixtureContent);
    } catch (e) {
      if (mustParse) {
        record('1', `malformed/${id}`, 'fail', `expected parse to succeed but threw: ${e.message}`);
      } else {
        record('1', `malformed/${id}`, 'pass', 'parse threw as expected');
      }
      continue;
    }

    if (!mustParse) {
      record('1', `malformed/${id}`, 'fail', 'expected parse to throw, but it succeeded');
      continue;
    }

    let validation;
    try {
      validation = validateUWFile(parsed);
    } catch (e) {
      record('1', `malformed/${id}`, 'fail', `validateUWFile threw: ${e.message}`);
      continue;
    }

    const actualCodes = new Set((validation.issues ?? []).map((m) => m.code));

    // If any expected code is INT-* or POL-*, also exercise the integrity
    // module (verifyChain is async; verifyProvenance is sync). Failures from
    // these checks are added to the actualCodes set so they count toward the
    // expected_codes match.
    const wantsIntegrity = expectedCodes.some((c) => c.startsWith('INT-'));
    const wantsPolicy    = expectedCodes.some((c) => c.startsWith('POL-'));
    if (wantsIntegrity) {
      try {
        const ir = await verifyChain(parsed);
        for (const i of ir.issues ?? []) actualCodes.add(i.code);
      } catch (e) {
        record('1', `malformed/${id}`, 'fail', `verifyChain threw: ${e.message}`);
        continue;
      }
    }
    if (wantsPolicy) {
      try {
        // Optional sibling policies.json — used when default policies don't
        // naturally trigger the targeted POL-* code (e.g. POL-01 needs an
        // authority restriction not present in the builtin set).
        const policiesPath = join(malformedDir, `${id}.policies.json`);
        const policies = existsSync(policiesPath)
          ? JSON.parse(readFileSync(policiesPath, 'utf8'))
          : undefined;
        const pr = verifyProvenance(parsed, policies);
        for (const i of pr.issues ?? []) actualCodes.add(i.code);
      } catch (e) {
        record('1', `malformed/${id}`, 'fail', `verifyProvenance threw: ${e.message}`);
        continue;
      }
    }

    const missing = expectedCodes.filter((c) => !actualCodes.has(c));
    if (missing.length > 0) {
      const seen = Array.from(actualCodes).sort().join(', ') || '(none)';
      record(
        '1',
        `malformed/${id}`,
        'fail',
        `validator did not surface ${missing.join(', ')} — saw: [${seen}]`,
      );
    } else {
      record('1', `malformed/${id}`, 'pass');
    }
  }
}

// ─── Tier 2: Editor ──────────────────────────────────────────────────────────

async function runTier2() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-2-editor', 'fixtures');
  if (!existsSync(baseDir)) {
    record('2', '(none)', 'pass', 'no fixtures');
    return;
  }
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());

  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const beforePath = join(dir, 'before.uwx.md');
    const opPath = join(dir, 'operation.json');
    const afterPath = join(dir, 'after.uwx.md');
    const ctxPath = join(dir, 'context.json');
    const optionsPath = join(dir, 'options.json');
    const expectedErrorPath = join(dir, 'expected-error.json');

    if (!existsSync(beforePath) || !existsSync(opPath)) {
      record('2', scenario, 'fail', 'missing before.uwx.md or operation.json');
      continue;
    }

    const beforeContent = readFileSync(beforePath, 'utf8');
    const op = JSON.parse(readFileSync(opPath, 'utf8'));
    const ctx = existsSync(ctxPath)
      ? JSON.parse(readFileSync(ctxPath, 'utf8'))
      : { actor: 'conformance', source: 'manual' };
    const options = existsSync(optionsPath)
      ? JSON.parse(readFileSync(optionsPath, 'utf8'))
      : {};

    const parsed = parseUWFile(beforeContent);
    // When the fixture exercises hash-stamping, applyEditAsync is required.
    const result = options.integrity
      ? await applyEditAsync(beforeContent, parsed, op, ctx, undefined, options)
      : applyEdit(beforeContent, parsed, op, ctx, undefined, options);

    // Negative-path scenario: expected-error.json declares the code/category
    // that applyEdit must fail with.
    if (existsSync(expectedErrorPath)) {
      const expectedErr = JSON.parse(readFileSync(expectedErrorPath, 'utf8'));
      if (result.ok) {
        record('2', scenario, 'fail', `expected error '${expectedErr.code}' but applyEdit succeeded`);
      } else if (result.error?.code !== expectedErr.code) {
        record('2', scenario, 'fail', `expected error '${expectedErr.code}', got '${result.error?.code}'`);
      } else {
        record('2', scenario, 'pass');
      }
      continue;
    }

    if (!result.ok) {
      record('2', scenario, 'fail', `applyEdit returned error: [${result.error?.code}] ${result.error?.message}`);
      continue;
    }

    // Strip volatile timestamps before comparison so the baseline is stable.
    const after = stripVolatileFields(result.content);

    if (UPDATE) {
      writeFileSync(afterPath, after);
      record('2', scenario, 'updated');
    } else if (!existsSync(afterPath)) {
      record('2', scenario, 'fail', 'missing after.uwx.md baseline');
    } else {
      const expected = stripVolatileFields(readFileSync(afterPath, 'utf8'));
      if (normalize(expected) === normalize(after)) {
        record('2', scenario, 'pass');
      } else {
        record('2', scenario, 'fail', 'output differs from after.uwx.md (with volatile fields stripped)');
      }
    }
  }
}

// Strip timestamps and other run-time-volatile values so byte comparisons
// against the after.uwx.md baseline are deterministic.
function stripVolatileFields(text) {
  return text
    .replace(/last_modified:\s*"[^"]*"/g, 'last_modified: "<volatile>"')
    .replace(/"timestamp":\s*"[^"]*"/g, '"timestamp": "<volatile>"')
    .replace(/ts=\S+/g, 'ts=<volatile>')
    // content_hash is computed from a canonicalization that includes the
    // (volatile) timestamp, so it is itself volatile across runs. parent_hash
    // is stamped from the prior head's content_hash, which is fixture-known
    // and therefore stable — leave it intact.
    .replace(/"content_hash":\s*"[0-9a-f]{64}"/g, '"content_hash": "<volatile>"');
}

// ─── Tier 3: Calc Host ───────────────────────────────────────────────────────

function runTier3() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-3-calc-host', 'fixtures');
  if (!existsSync(baseDir)) {
    record('3', '(none)', 'pass', 'no fixtures');
    return;
  }
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());

  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const dealPath = join(dir, 'deal.uwx.md');
    const calcPath = join(dir, 'calc.json');
    const expectedPath = join(dir, 'expected-result.json');

    if (!existsSync(dealPath) || !existsSync(calcPath)) {
      record('3', scenario, 'fail', 'missing deal.uwx.md or calc.json');
      continue;
    }

    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const decl = JSON.parse(readFileSync(calcPath, 'utf8'));
    const result = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' });

    // Strip transient fields (display formatting may vary across locale extensions).
    const projected = {
      calc_id: result.calc_id,
      ok: result.ok,
      value: result.value,
      ...(result.unit ? { unit: result.unit } : {}),
      ...(result.error ? { error: { code: result.error.code, category: result.error.category } } : {}),
    };
    const projectedStr = `${JSON.stringify(projected, null, 2)}\n`;

    if (UPDATE) {
      writeFileSync(expectedPath, projectedStr);
      record('3', scenario, 'updated');
    } else if (!existsSync(expectedPath)) {
      record('3', scenario, 'fail', 'missing expected-result.json');
    } else {
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
      if (deepEqual(expected, projected)) {
        record('3', scenario, 'pass');
      } else {
        record('3', scenario, 'fail', `result differs: ${JSON.stringify(projected)} vs ${JSON.stringify(expected)}`);
      }
    }
  }
}

// ─── Tier 3 (refinement mode): dependency graph extraction ───────────────────
// Each fixture lives in a directory with `deal.uwx.md` and a sibling
// `expected-graph.json` declaring the canonical projection of
// `extractDependencyGraph(parsed)`. Only Map-typed fields are projected (sets
// become sorted arrays).
//
// CAPABILITY: `refinement`. **No tier requires this** — protocol II.3 lists
// four requirements for a Tier-3 Calc Host and a dependency graph is not among
// them. These fixtures live under tier-3-calc-host/ for discoverability, and
// II.6 is explicit that directory membership is not a normative signal: a calc
// host that does not project a dependency graph is still a conforming calc
// host. The RFC 0004 driver agrees, generating zero cases here.

async function runTier3Refinement() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-3-calc-host', 'refinement');
  if (!existsSync(baseDir)) return;
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());
  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const dealPath = join(dir, 'deal.uwx.md');
    const expectedPath = join(dir, 'expected-graph.json');
    if (!existsSync(dealPath)) {
      record('3-refinement', scenario, 'fail', 'missing deal.uwx.md');
      continue;
    }
    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const graph = extractDependencyGraph(parsed);
    const projected = projectGraph(graph);
    const projectedStr = `${JSON.stringify(projected, null, 2)}\n`;
    if (UPDATE) {
      writeFileSync(expectedPath, projectedStr);
      record('3-refinement', scenario, 'updated');
    } else if (!existsSync(expectedPath)) {
      record('3-refinement', scenario, 'fail', 'missing expected-graph.json');
    } else {
      const expected = readFileSync(expectedPath, 'utf8');
      if (normalize(expected) === normalize(projectedStr)) {
        record('3-refinement', scenario, 'pass');
      } else {
        record('3-refinement', scenario, 'fail', 'extracted graph differs from baseline');
      }
    }
  }
}

function projectGraph(graph) {
  const sortKeys = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
  const outputs = sortKeys(Object.fromEntries(
    [...graph.outputs.entries()].map(([id, set]) => [id, [...set].sort()]),
  ));
  const inputs = sortKeys(Object.fromEntries(
    [...graph.inputs.entries()].map(([path, set]) => [path, [...set].sort()]),
  ));
  const formulas = sortKeys(Object.fromEntries(graph.formulas.entries()));
  return { outputs, inputs, formulas };
}

// ─── Tier 4 (profile mode): consumer-profile contract ────────────────────────
// Each Bancroft layer must declare a `consumed_profile`. The fixture's
// `expected-layer-profiles.json` is a {layerId: profile} map; mismatch fails.

async function runTier4Profile() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-4-agent-host', 'profile');
  if (!existsSync(baseDir)) return;
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());
  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const expectedPath = join(dir, 'expected-layer-profiles.json');
    const actual = Object.fromEntries(
      [...BANCROFT_LAYERS]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((l) => [l.id, l.consumed_profile]),
    );
    const actualStr = `${JSON.stringify(actual, null, 2)}\n`;
    if (UPDATE) {
      writeFileSync(expectedPath, actualStr);
      record('4-profile', scenario, 'updated');
    } else if (!existsSync(expectedPath)) {
      record('4-profile', scenario, 'fail', 'missing expected-layer-profiles.json');
    } else {
      const expected = readFileSync(expectedPath, 'utf8');
      if (normalize(expected) === normalize(actualStr)) {
        record('4-profile', scenario, 'pass');
      } else {
        record('4-profile', scenario, 'fail', 'layer→profile mapping differs from baseline');
      }
    }
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
  return ak.every((k) => deepEqual(a[k], b[k]));
}

// ─── Tier 4: Agent Host (shape-only) ─────────────────────────────────────────
// Tier 4 is gated behind --tier=4 because it requires either a live LLM call
// or a recorded replay. CI runs the other tiers; tier-4 is operator-driven.

function runTier4() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-4-agent-host', 'fixtures');
  if (!existsSync(baseDir)) {
    record('4', '(none)', 'pass', 'no fixtures');
    return;
  }
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());
  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const beforePath = join(dir, 'before.uwx.md');
    const shapePath = join(dir, 'expected-after-shape.json');
    if (!existsSync(beforePath) || !existsSync(shapePath)) {
      record('4', scenario, 'fail', 'missing before.uwx.md or expected-after-shape.json');
      continue;
    }
    // Lint-only: parse the shape JSON and the before file. Live runs are
    // operator-driven; we don't have a replay store yet (deferred to v2).
    try {
      JSON.parse(readFileSync(shapePath, 'utf8'));
      parseUWFile(readFileSync(beforePath, 'utf8'));
      record('4', scenario, 'pass', 'shape file lint only — live run not exercised');
    } catch (e) {
      record('4', scenario, 'fail', `lint failed: ${e.message}`);
    }
  }
}

// ─── Tier 4 replay: deterministic agent runs from a recorded cassette ────────
// Unlike the shape-only fixtures above, these actually run the Tier-4 write
// path. A cassette supplies the model's side of the conversation, so the run
// needs no network and no API key and can gate CI.
//
// Each scenario freezes an expected output document and is compared BYTE FOR
// BYTE — not by shape. That is what makes it a real conformance assertion: it
// pins supersede semantics, `_meta` ownership, pipeline-log append, and
// frontmatter updates all at once. Determinism comes from injecting a constant
// clock, which freezes `_meta.timestamp`, collapses `duration_ms` to 0, and
// makes the log entry id derivable instead of random.

const REPLAY_CLOCK = Date.parse('2026-08-13T00:00:00.000Z');

async function runTier4Replay() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-4-agent-host', 'replay');
  if (!existsSync(baseDir)) {
    record('4-replay', '(none)', 'pass', 'no replay scenarios');
    return;
  }
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());

  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const meta = JSON.parse(readFileSync(join(dir, 'scenario.json'), 'utf8'));
    const before = readFileSync(join(dir, 'before.uwx.md'), 'utf8');
    const expectedPath = join(dir, 'after.uwx.md');

    let result;
    try {
      const cassette = parseAgentCassette(readFileSync(join(dir, 'cassette.json'), 'utf8'));
      result = await runBancroftAgent(before, meta.agent_id, {
        provider: createReplayProvider(cassette),
        now: () => REPLAY_CLOCK,
      });
    } catch (e) {
      record('4-replay', `${scenario}/run`, 'fail', e.message);
      continue;
    }

    if (!result.success) {
      record('4-replay', `${scenario}/run`, 'fail', `run failed: ${result.error}`);
      continue;
    }

    // The sections the layer claims to have written.
    const expectedSections = meta.sections_written ?? [];
    if (JSON.stringify(result.sectionsWritten) !== JSON.stringify(expectedSections)) {
      record(
        '4-replay',
        `${scenario}/sections`,
        'fail',
        `wrote [${result.sectionsWritten}] expected [${expectedSections}]`,
      );
    } else {
      record('4-replay', `${scenario}/sections`, 'pass', `wrote ${expectedSections.join(', ')}`);
    }

    baselineCompare('4-replay', `${scenario}/document`, expectedPath, result.updatedContent);
  }
}

// A replayed run must reproduce the frozen document exactly. `--update`
// refreshes the baseline the same way every other suite does.
function baselineCompare(tier, name, expectedPath, actual) {
  if (!existsSync(expectedPath)) {
    if (UPDATE) {
      writeFileSync(expectedPath, actual, 'utf8');
      record(tier, name, 'updated', 'baseline created');
    } else {
      record(tier, name, 'fail', `missing baseline: ${basename(expectedPath)}`);
    }
    return;
  }
  const expected = readFileSync(expectedPath, 'utf8');
  if (expected === actual) {
    record(tier, name, 'pass', 'byte-identical to baseline');
    return;
  }
  if (UPDATE) {
    writeFileSync(expectedPath, actual, 'utf8');
    record(tier, name, 'updated', 'baseline refreshed');
    return;
  }
  record(tier, name, 'fail', firstDifference(expected, actual));
}

function firstDifference(expected, actual) {
  const e = expected.split('\n');
  const a = actual.split('\n');
  for (let i = 0; i < Math.max(e.length, a.length); i++) {
    if (e[i] !== a[i]) {
      return `line ${i + 1}: expected ${JSON.stringify(e[i] ?? '<eof>')} got ${JSON.stringify(a[i] ?? '<eof>')}`;
    }
  }
  return 'documents differ but no line-level difference found';
}

// ─── Lite: parse → canonicalize → render → compile → project ─────────────────
// UW Lite (`spec/UW_LITE_SPEC_v1.md`) is a source representation rather than a
// protocol tier, so it runs under the name `lite`. Each fixture in `fixtures/`
// must parse cleanly and then freeze five artifacts: the RFC 8785 financial
// canonical form, its SHA-256 digest, the canonical rendering, the
// deal-summary-v1 compilation report plus UWX serialization, and the UWX→Lite
// projection. `malformed/` covers parse-time errors, `compile/` covers
// bridge-time errors, and `equivalence.json` asserts that fixtures differing
// only along spec §6 excluded axes share one digest.

const LITE_DIR = join(CONFORMANCE_DIR, 'lite');

// Computed with stock node:crypto rather than the library's own hash helper,
// so a frozen digest means something to a third-party implementer.
function liteDigest(canonical) {
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function liteBaseline(scenario, file, actual) {
  const expectedDir = join(LITE_DIR, 'expected');
  if (!existsSync(expectedDir)) mkdirSync(expectedDir, { recursive: true });
  const path = join(expectedDir, file);
  if (UPDATE) {
    writeFileSync(path, actual);
    record('lite', scenario, 'updated');
  } else if (!existsSync(path)) {
    record('lite', scenario, 'fail', `missing baseline: ${file}`);
  } else if (normalize(readFileSync(path, 'utf8')) === normalize(actual)) {
    record('lite', scenario, 'pass');
  } else {
    record('lite', scenario, 'fail', `output differs from ${file}`);
  }
}

function errorCodes(issues) {
  return (issues ?? []).filter((i) => i.severity === 'error').map((i) => i.code);
}

function runLiteFixtures() {
  const dir = join(LITE_DIR, 'fixtures');
  if (!existsSync(dir)) return;
  const fixtures = readdirSync(dir).filter((f) => f.endsWith('.uw.md')).sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uw\.md$/, '');
    const source = readFileSync(join(dir, fixture), 'utf8');

    let parsed;
    try {
      parsed = parseUWLite(source);
    } catch (e) {
      record('lite', `${id} [parse]`, 'fail', `parse threw: ${e.message}`);
      continue;
    }
    const parseErrors = errorCodes(parsed.issues);
    if (parseErrors.length > 0) {
      record('lite', `${id} [parse]`, 'fail', `expected a clean parse, saw: ${parseErrors.join(', ')}`);
      continue;
    }
    record('lite', `${id} [parse]`, 'pass');

    let canonical;
    try {
      canonical = canonicalizeUWLiteFinancial(parsed);
    } catch (e) {
      record('lite', `${id} [canonical]`, 'fail', `canonicalization threw: ${e.message}`);
      continue;
    }
    liteBaseline(`${id} [canonical]`, `${id}.canonical.json`, `${canonical}\n`);
    liteBaseline(`${id} [digest]`, `${id}.digest.txt`, `${liteDigest(canonical)}\n`);

    const rendered = renderCanonicalUWLite(parsed);
    liteBaseline(`${id} [render]`, `${id}.rendered.uw.md`, `${rendered.trimEnd()}\n`);

    // Spec §7: parsing a canonical rendering must yield the same financial
    // canonical form as the source. An invariant, so it carries no baseline.
    try {
      const reparsed = parseUWLite(rendered);
      const reErrors = errorCodes(reparsed.issues);
      if (reErrors.length > 0) {
        record('lite', `${id} [render-roundtrip]`, 'fail', `canonical rendering does not re-parse cleanly: ${reErrors.join(', ')}`);
      } else if (canonicalizeUWLiteFinancial(reparsed) !== canonical) {
        record('lite', `${id} [render-roundtrip]`, 'fail', 'canonical rendering yields a different financial canonical form');
      } else {
        record('lite', `${id} [render-roundtrip]`, 'pass');
      }
    } catch (e) {
      record('lite', `${id} [render-roundtrip]`, 'fail', `re-parse of canonical rendering threw: ${e.message}`);
    }

    const compiled = compileUWLite(parsed);
    liteBaseline(
      `${id} [compile-report]`,
      `${id}.compile.json`,
      `${JSON.stringify({ ok: compiled.ok, report: compiled.report }, null, 2)}\n`,
    );
    if (!compiled.ok) {
      record('lite', `${id} [compile]`, 'fail', `fixtures/ documents must compile; saw: ${errorCodes(compiled.report.issues).join(', ')}`);
      continue;
    }
    liteBaseline(`${id} [uwx]`, `${id}.uwx.md`, `${stringifyUWX(compiled.envelope).trimEnd()}\n`);

    const projection = projectUWEnvelopeToLite(compiled.envelope);
    liteBaseline(
      `${id} [projection-report]`,
      `${id}.projection.json`,
      `${JSON.stringify(projection.report, null, 2)}\n`,
    );
    liteBaseline(`${id} [projection]`, `${id}.projected.uw.md`, `${projection.content.trimEnd()}\n`);
  }
}

// Parse-time negative tests. Each <id>.uw.md has an <id>.expected.json naming
// the codes that MUST appear; extras are allowed. `must_parse: false` means
// parseUWLite is required to throw a UWLiteError with a listed code.
function runLiteMalformed() {
  const dir = join(LITE_DIR, 'malformed');
  if (!existsSync(dir)) return;
  const fixtures = readdirSync(dir).filter((f) => f.endsWith('.uw.md')).sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uw\.md$/, '');
    const expectedPath = join(dir, `${id}.expected.json`);
    if (!existsSync(expectedPath)) {
      record('lite', `malformed/${id}`, 'fail', `missing ${id}.expected.json`);
      continue;
    }
    let expected;
    try {
      expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    } catch (e) {
      record('lite', `malformed/${id}`, 'fail', `expected.json is not valid JSON: ${e.message}`);
      continue;
    }
    const expectedCodes = Array.isArray(expected.expected_codes) ? expected.expected_codes : [];
    if (expectedCodes.length === 0) {
      record('lite', `malformed/${id}`, 'fail', 'expected.json has no expected_codes');
      continue;
    }
    const mustParse = expected.must_parse !== false;
    const source = readFileSync(join(dir, fixture), 'utf8');

    let parsed;
    try {
      parsed = parseUWLite(source);
    } catch (e) {
      if (mustParse) {
        record('lite', `malformed/${id}`, 'fail', `expected parse to succeed but threw: ${e.message}`);
      } else if (!expectedCodes.includes(e.code)) {
        record('lite', `malformed/${id}`, 'fail', `threw ${e.code ?? '(no code)'}, expected one of ${expectedCodes.join(', ')}`);
      } else {
        record('lite', `malformed/${id}`, 'pass');
      }
      continue;
    }
    if (!mustParse) {
      record('lite', `malformed/${id}`, 'fail', 'expected parse to throw, but it succeeded');
      continue;
    }

    const actual = new Set((parsed.issues ?? []).map((i) => i.code));
    const missing = expectedCodes.filter((c) => !actual.has(c));
    if (missing.length > 0) {
      const seen = [...actual].sort().join(', ') || '(none)';
      record('lite', `malformed/${id}`, 'fail', `parser did not surface ${missing.join(', ')} — saw: [${seen}]`);
    } else {
      record('lite', `malformed/${id}`, 'pass');
    }
  }
}

// Bridge-time negative tests: these documents parse cleanly but must be
// rejected by compileUWLite with the declared codes.
function runLiteCompile() {
  const dir = join(LITE_DIR, 'compile');
  if (!existsSync(dir)) return;
  const fixtures = readdirSync(dir).filter((f) => f.endsWith('.uw.md')).sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uw\.md$/, '');
    const expectedPath = join(dir, `${id}.expected.json`);
    if (!existsSync(expectedPath)) {
      record('lite', `compile/${id}`, 'fail', `missing ${id}.expected.json`);
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const expectedCodes = Array.isArray(expected.expected_codes) ? expected.expected_codes : [];
    if (expectedCodes.length === 0) {
      record('lite', `compile/${id}`, 'fail', 'expected.json has no expected_codes');
      continue;
    }

    let parsed;
    try {
      parsed = parseUWLite(readFileSync(join(dir, fixture), 'utf8'));
    } catch (e) {
      record('lite', `compile/${id}`, 'fail', `parse threw: ${e.message}`);
      continue;
    }
    const parseErrors = errorCodes(parsed.issues);
    if (parseErrors.length > 0) {
      record('lite', `compile/${id}`, 'fail', `compile fixtures must parse cleanly (move to malformed/); saw: ${parseErrors.join(', ')}`);
      continue;
    }

    const compiled = compileUWLite(parsed);
    if (compiled.ok) {
      record('lite', `compile/${id}`, 'fail', `expected compilation to fail with ${expectedCodes.join(', ')}, but it succeeded`);
      continue;
    }
    const actual = new Set((compiled.report.issues ?? []).map((i) => i.code));
    const missing = expectedCodes.filter((c) => !actual.has(c));
    if (missing.length > 0) {
      const seen = [...actual].sort().join(', ') || '(none)';
      record('lite', `compile/${id}`, 'fail', `compiler did not surface ${missing.join(', ')} — saw: [${seen}]`);
    } else {
      record('lite', `compile/${id}`, 'pass');
    }
  }
}

// Spec §6 excludes labels, headings, prose, field order, bullet character,
// whitespace, comma grouping, and equivalent numeric spellings from the
// canonical form. Fixtures in one group differ only along those axes and so
// must share a single digest.
function runLiteEquivalence() {
  const manifestPath = join(LITE_DIR, 'equivalence.json');
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const group of manifest.groups ?? []) {
    const digests = new Map();
    let broken = false;
    for (const id of group.fixtures ?? []) {
      const path = join(LITE_DIR, 'fixtures', `${id}.uw.md`);
      if (!existsSync(path)) {
        record('lite', `equivalence/${group.id}`, 'fail', `missing fixture ${id}.uw.md`);
        broken = true;
        break;
      }
      try {
        digests.set(id, liteDigest(canonicalizeUWLiteFinancial(parseUWLite(readFileSync(path, 'utf8')))));
      } catch (e) {
        record('lite', `equivalence/${group.id}`, 'fail', `${id} failed to canonicalize: ${e.message}`);
        broken = true;
        break;
      }
    }
    if (broken) continue;
    if (digests.size < 2) {
      record('lite', `equivalence/${group.id}`, 'fail', 'an equivalence group needs at least two fixtures');
      continue;
    }
    if (new Set(digests.values()).size === 1) {
      record('lite', `equivalence/${group.id}`, 'pass');
    } else {
      const detail = [...digests].map(([id, d]) => `${id}=${d.slice(0, 23)}…`).join(', ');
      record('lite', `equivalence/${group.id}`, 'fail', `expected one shared digest, got ${detail}`);
    }
  }
}

// ─── Receipts: issue → verify → refuse ───────────────────────────────────────
// Verification receipts (`spec/UW_RECEIPT_v1.md`, RFC 0016) are a detached
// artifact rather than a protocol tier, so like `lite` this suite is named.
//
//   issue/<scenario>/    deal.{uw,uwx}.md + expected-receipt.json (issued_at stubbed)
//   verify/<scenario>/   deal.* + receipt.json + expected-verdict.json
//   refuse/<scenario>/   deal.* + expected.json naming the ReceiptError code
//
// Two invariants are asserted without a baseline, so they bind any
// implementation regardless of our frozen output: re-issuance over an
// unmodified record reproduces the same subject digest and results, and a
// verifier always lands on exactly one of the three verdicts.

const RECEIPTS_DIR = join(CONFORMANCE_DIR, 'receipts');
const RECEIPT_ISSUED_AT = '2026-08-09T00:00:00Z';
const RECEIPT_ISSUER = 'conformance';

function receiptScenarios(kind) {
  const dir = join(RECEIPTS_DIR, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()
    .map((name) => ({ id: name, dir: join(dir, name) }));
}

function receiptDeal(scenarioDir) {
  const file = readdirSync(scenarioDir).find((f) => f.endsWith('.uw.md') || f.endsWith('.uwx.md'));
  if (!file) return null;
  return { path: join(scenarioDir, file), source: readFileSync(join(scenarioDir, file), 'utf8') };
}

function receiptBaseline(scenario, path, actual) {
  if (UPDATE) {
    writeFileSync(path, actual);
    record('receipts', scenario, 'updated');
  } else if (!existsSync(path)) {
    record('receipts', scenario, 'fail', `missing baseline: ${basename(path)}`);
  } else if (normalize(readFileSync(path, 'utf8')) === normalize(actual)) {
    record('receipts', scenario, 'pass');
  } else {
    record('receipts', scenario, 'fail', `output differs from ${basename(path)}`);
  }
}

async function runReceiptIssue() {
  for (const { id, dir } of receiptScenarios('issue')) {
    const deal = receiptDeal(dir);
    if (!deal) {
      record('receipts', `issue/${id}`, 'fail', 'no deal.uw.md or deal.uwx.md in scenario');
      continue;
    }

    let receipt;
    try {
      receipt = await issueReceipt(deal.source, {
        filename: deal.path,
        issued_at: RECEIPT_ISSUED_AT,
        issuer: RECEIPT_ISSUER,
      });
    } catch (e) {
      record('receipts', `issue/${id}`, 'fail', `issuance threw: ${e.message}`);
      continue;
    }

    receiptBaseline(
      `issue/${id}`,
      join(dir, 'expected-receipt.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );

    // §4 re-issuance stability — asserted directly, not against a baseline.
    try {
      const again = await issueReceipt(deal.source, {
        filename: deal.path,
        issued_at: '2027-01-01T00:00:00Z',
        issuer: RECEIPT_ISSUER,
      });
      const stable =
        again.subject.digest === receipt.subject.digest &&
        JSON.stringify(again.computation.results) === JSON.stringify(receipt.computation.results);
      record(
        'receipts',
        `issue/${id} [re-issuance stable]`,
        stable ? 'pass' : 'fail',
        stable ? undefined : 're-issuance changed the subject digest or the results',
      );
    } catch (e) {
      record('receipts', `issue/${id} [re-issuance stable]`, 'fail', `re-issuance threw: ${e.message}`);
    }
  }
}

async function runReceiptVerify() {
  for (const { id, dir } of receiptScenarios('verify')) {
    const deal = receiptDeal(dir);
    const receiptPath = join(dir, 'receipt.json');
    const expectedPath = join(dir, 'expected-verdict.json');
    if (!deal) {
      record('receipts', `verify/${id}`, 'fail', 'no deal document in scenario');
      continue;
    }
    if (!existsSync(receiptPath) || !existsSync(expectedPath)) {
      record('receipts', `verify/${id}`, 'fail', 'missing receipt.json or expected-verdict.json');
      continue;
    }

    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

    // Optional sibling inputs.json — the referenced-input digests this verifier
    // is meant to hold (receipt format 1.1, UW_RECEIPT_v1 §10). Absent means
    // "holds none", which is the market-data-absent scenario rather than a
    // fixture defect, so its absence is deliberately not an error.
    const inputsPath = join(dir, 'inputs.json');
    const inputs = existsSync(inputsPath)
      ? JSON.parse(readFileSync(inputsPath, 'utf8'))
      : undefined;

    let result;
    try {
      assertUWReceipt(receipt);
      result = await verifyReceipt(receipt, deal.source, {
        filename: deal.path,
        ...(inputs ? { inputs } : {}),
      });
    } catch (e) {
      record('receipts', `verify/${id}`, 'fail', `verification threw: ${e.message}`);
      continue;
    }

    if (!['verified', 'failed', 'unverifiable'].includes(result.verdict)) {
      record('receipts', `verify/${id}`, 'fail', `verdict outside the three-state set: ${result.verdict}`);
      continue;
    }
    if (result.verdict !== expected.verdict) {
      record('receipts', `verify/${id}`, 'fail', `expected ${expected.verdict}, got ${result.verdict}`);
      continue;
    }

    const seen = new Set(result.issues.map((i) => i.code));
    const missing = (expected.expected_codes ?? []).filter((c) => !seen.has(c));
    if (missing.length > 0) {
      const list = [...seen].sort().join(', ') || '(none)';
      record('receipts', `verify/${id}`, 'fail', `did not surface ${missing.join(', ')} — saw: [${list}]`);
    } else {
      record('receipts', `verify/${id}`, 'pass');
    }
  }
}

async function runReceiptRefuse() {
  for (const { id, dir } of receiptScenarios('refuse')) {
    const deal = receiptDeal(dir);
    const expectedPath = join(dir, 'expected.json');
    if (!deal || !existsSync(expectedPath)) {
      record('receipts', `refuse/${id}`, 'fail', 'missing deal document or expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

    try {
      await issueReceipt(deal.source, { filename: deal.path, issued_at: RECEIPT_ISSUED_AT });
      record('receipts', `refuse/${id}`, 'fail', 'issuance succeeded where it must refuse');
    } catch (e) {
      if (e.code === expected.expected_code) {
        record('receipts', `refuse/${id}`, 'pass');
      } else {
        record('receipts', `refuse/${id}`, 'fail', `threw ${e.code ?? '(no code)'}, expected ${expected.expected_code}`);
      }
    }
  }
}

// ─── Market-data suite (RFC 0022) ────────────────────────────────────────────
//
//   valid/<scenario>/     doc.uwx.md + expected.json (identity + observations)
//   reject/<scenario>/    doc.uwx.md + expected.json naming the MD-* code
//   resolve/<scenario>/   docs/*.uwx.md + case.json + expected.json
//   promote/<scenario>/   doc.uwx.md + case.json + expected.json
//
// The attribution requirements are each proved to *fail* rather than store a
// blank, because the failure mode this profile exists to prevent is a number
// sitting in a file that nothing can trace.

const MARKET_DATA_DIR = join(CONFORMANCE_DIR, 'market-data');

function readMarketDoc(path) {
  return parseMarketDataDocument(parseUWFile(readFileSync(path, 'utf8'), { filename: path }));
}

function marketScenarios(kind) {
  const dir = join(MARKET_DATA_DIR, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(dir, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function runMarketData() {
  if (!existsSync(MARKET_DATA_DIR)) {
    record('market-data', '(none)', 'pass', 'no market-data fixtures');
    return;
  }

  for (const { id, dir } of marketScenarios('valid')) {
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    try {
      const doc = readMarketDoc(join(dir, 'doc.uwx.md'));
      const actual = {
        document_id: doc.document_id,
        as_of: doc.as_of,
        provider: doc.provider,
        geo: doc.geo,
        observation_count: doc.observations.length,
      };
      const diff = Object.entries(expected).find(([k, v]) => JSON.stringify(actual[k]) !== JSON.stringify(v));
      if (diff) {
        record('market-data', `valid/${id}`, 'fail', `${diff[0]}: expected ${JSON.stringify(diff[1])}, got ${JSON.stringify(actual[diff[0]])}`);
      } else {
        record('market-data', `valid/${id}`, 'pass');
      }
    } catch (e) {
      record('market-data', `valid/${id}`, 'fail', `parse threw: ${e.message}`);
    }
  }

  for (const { id, dir } of marketScenarios('reject')) {
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    try {
      readMarketDoc(join(dir, 'doc.uwx.md'));
      record('market-data', `reject/${id}`, 'fail', 'parsed where it must refuse');
    } catch (e) {
      if (e.code === expected.expected_code) {
        record('market-data', `reject/${id}`, 'pass', `${e.code}`);
      } else {
        record('market-data', `reject/${id}`, 'fail', `threw ${e.code ?? '(no code)'}, expected ${expected.expected_code}`);
      }
    }
  }

  for (const { id, dir } of marketScenarios('resolve')) {
    const testCase = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    const docsDir = join(dir, 'docs');
    const docs = readdirSync(docsDir)
      .filter((f) => f.endsWith('.uwx.md'))
      .sort()
      .map((f) => readMarketDoc(join(docsDir, f)));

    // `now` is pinned per fixture: a staleness assertion that depended on the
    // wall clock would pass today and fail in three months.
    const now = new Date(testCase.now);

    let selected;
    try {
      selected = selectCurrentMarketData(docs);
    } catch (e) {
      if (expected.expected_code && e.code === expected.expected_code) {
        record('market-data', `resolve/${id}`, 'pass', `${e.code}`);
      } else {
        record('market-data', `resolve/${id}`, 'fail', `selection threw ${e.code ?? e.message}`);
      }
      continue;
    }
    if (expected.expected_code) {
      record('market-data', `resolve/${id}`, 'fail', `expected ${expected.expected_code}, selection succeeded`);
      continue;
    }

    if (expected.selected_document_id && selected.document_id !== expected.selected_document_id) {
      record('market-data', `resolve/${id}`, 'fail', `selected ${selected.document_id}, expected ${expected.selected_document_id}`);
      continue;
    }

    const deal = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
    const resolved = resolveValue(testCase.field_path, deal, {
      market: createDocumentMarketData(selected, { now }),
    });
    if (resolved.step !== expected.step) {
      record('market-data', `resolve/${id}`, 'fail', `step ${resolved.step}, expected ${expected.step}`);
      continue;
    }
    if ('value' in expected && JSON.stringify(resolved.value) !== JSON.stringify(expected.value)) {
      record('market-data', `resolve/${id}`, 'fail', `value ${JSON.stringify(resolved.value)}, expected ${JSON.stringify(expected.value)}`);
      continue;
    }
    record('market-data', `resolve/${id}`, 'pass', `${resolved.step}`);
  }

  for (const { id, dir } of marketScenarios('promote')) {
    const testCase = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    const doc = readMarketDoc(join(dir, 'doc.uwx.md'));

    let promoted;
    try {
      promoted = promoteMarketObservation({
        document: doc,
        field_path: testCase.field_path,
        digest: testCase.digest,
        ...(testCase.rationale ? { rationale: testCase.rationale } : {}),
      });
    } catch (e) {
      record('market-data', `promote/${id}`, 'fail', `promotion threw: ${e.message}`);
      continue;
    }

    // The load-bearing assertion of §4: never user_input.
    if (promoted.source !== 'market_data_accepted') {
      record('market-data', `promote/${id}`, 'fail', `source ${promoted.source}, expected market_data_accepted`);
      continue;
    }
    if (promoted.market_data_ref.document_id !== doc.document_id ||
        promoted.market_data_ref.as_of !== doc.as_of ||
        promoted.market_data_ref.digest !== testCase.digest) {
      record('market-data', `promote/${id}`, 'fail', 'market_data_ref does not name the observation set, vintage, and digest');
      continue;
    }
    if (expected.confidence !== undefined && promoted.confidence !== expected.confidence) {
      record('market-data', `promote/${id}`, 'fail', `confidence ${promoted.confidence}, expected ${expected.confidence} (promotion must not upgrade it)`);
      continue;
    }
    record('market-data', `promote/${id}`, 'pass');

    // A promoted field leaves the gap ranking while keeping its origin tag.
    if (expected.resolves_from_document) {
      const deal = parseUWFile(readFileSync(join(dir, 'deal-after-promotion.uwx.md'), 'utf8'));
      const resolved = resolveValue(testCase.field_path, deal);
      const ok = resolved.source === 'market_data_accepted' && resolved.step === 'user_input';
      record('market-data', `promote/${id} [resolves as input of record]`, ok ? 'pass' : 'fail',
        ok ? 'market_data_accepted @ user_input' : `got ${resolved.source} @ ${resolved.step}`);
    }
  }
}

// ─── Modules suite ───────────────────────────────────────────────────────────
//
// Two assertions per fixture:
//
//   1. the loader's verdict matches the fixture's declared expectation, and for
//      reject fixtures every listed PROTO-MOD code is actually emitted; and
//   2. the loader agrees with `spec/schemas/module-manifest.schema.json`.
//
// (2) is the drift guard. `@uwmd/core` cannot depend on a JSON Schema validator
// — the layering invariant admits only the Anthropic SDK — so the loader is
// hand-written and had silently diverged from the normative schema on seven of
// eight probes before this suite existed. ajv is a root devDependency and this
// runner is a root script, so the cross-check costs nothing at runtime.
//
// A reject fixture may declare `schema_divergence` when the loader is
// deliberately stricter than JSON Schema can express (requiring
// `deterministic: true`, parsing the safe-expression grammar). Those are the
// only permitted disagreements, and each one has to say why in the fixture.

const MODULES_DIR = join(CONFORMANCE_DIR, 'modules');

async function runModules() {
  if (!existsSync(MODULES_DIR)) {
    record('modules', '(none)', 'pass', 'no module fixtures');
    return;
  }

  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const readSchema = (name) =>
    JSON.parse(readFileSync(join(ROOT, 'spec', 'schemas', name), 'utf8'));
  const ajv = new Ajv2020({ strict: false });
  // The manifest schema $refs the signature schema by absolute $id (RFC 0002),
  // so the referenced schema has to be registered before compiling — ajv will
  // not fetch it, and should not.
  ajv.addSchema(readSchema('module-signature.schema.json'));
  const schemaCheck = ajv.compile(readSchema('module-manifest.schema.json'));

  const readFixtures = (kind) => {
    const dir = join(MODULES_DIR, kind);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.module.json'))
      .sort()
      .map((f) => ({
        id: basename(f, '.module.json'),
        manifest: JSON.parse(readFileSync(join(dir, f), 'utf8')),
        expectedPath: join(dir, `${basename(f, '.module.json')}.expected.json`),
      }));
  };

  const parity = (id, manifest, loaderOk, divergence) => {
    const schemaOk = schemaCheck(manifest);
    if (schemaOk === loaderOk) {
      record('modules', `${id} [schema-parity]`, 'pass');
    } else if (divergence && loaderOk === false && schemaOk === true) {
      record('modules', `${id} [schema-parity]`, 'pass', `declared divergence: ${divergence}`);
    } else {
      record(
        'modules',
        `${id} [schema-parity]`,
        'fail',
        `loader ${loaderOk ? 'accepts' : 'rejects'} but schema ${schemaOk ? 'accepts' : 'rejects'}` +
          `${schemaOk ? '' : ` (${(schemaCheck.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join('; ')})`}`,
      );
    }
  };

  // Accept fixtures load against the maximal host, so they assert manifest
  // validity rather than host capability. Tier gating has its own reject
  // fixture and unit tests.
  const MAX_HOST = { hostTier: 'tier-4-agent-host' };

  for (const { id, manifest } of readFixtures('accept')) {
    let result;
    try {
      result = loadModuleManifest(manifest, MAX_HOST);
    } catch (e) {
      record('modules', `accept/${id}`, 'fail', `loader threw: ${e.message}`);
      continue;
    }
    if (result.ok) {
      record('modules', `accept/${id}`, 'pass');
    } else {
      record(
        'modules',
        `accept/${id}`,
        'fail',
        `expected acceptance, got: ${result.errors.map((e) => e.code).join(', ')}`,
      );
    }
    parity(`accept/${id}`, manifest, result.ok, null);
  }

  for (const { id, manifest, expectedPath } of readFixtures('reject')) {
    if (!existsSync(expectedPath)) {
      record('modules', `reject/${id}`, 'fail', 'missing .expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    let result;
    try {
      result = loadModuleManifest(manifest);
    } catch (e) {
      record('modules', `reject/${id}`, 'fail', `loader threw instead of reporting: ${e.message}`);
      continue;
    }
    if (result.ok) {
      record('modules', `reject/${id}`, 'fail', 'expected refusal, manifest loaded');
    } else {
      const emitted = new Set(result.errors.map((e) => e.code));
      const missing = expected.expected_codes.filter((c) => !emitted.has(c));
      if (missing.length > 0) {
        record(
          'modules',
          `reject/${id}`,
          'fail',
          `refused, but without ${missing.join(', ')} (emitted ${[...emitted].join(', ')})`,
        );
      } else {
        record('modules', `reject/${id}`, 'pass', expected.expected_codes.join(', '));
      }
    }
    parity(`reject/${id}`, manifest, result.ok, expected.schema_divergence ?? null);
  }
}


/**
 * Module runtime (RFC 0006) — the module system with an actual consumer.
 *
 * Every other module fixture in this corpus checks that a manifest *loads*.
 * These check that a loaded module *does something*: its calculations compute,
 * its validation rules fire and stay silent in the right places, and its
 * required sections are enforced.
 *
 * The module under test is `@uwmd/module-hospitality`, imported the way any
 * host would import it. If a scenario's `module` names something else, it is
 * skipped rather than silently passing.
 */
async function runModuleRuntime() {
  const dir = join(MODULES_DIR, 'runtime');
  if (!existsSync(dir)) return;

  let hospitality;
  try {
    hospitality = await import('@uwmd/module-hospitality');
  } catch {
    record('modules', 'runtime', 'fail', '@uwmd/module-hospitality is not built — run npm run build first');
    return;
  }
  const registry = createModuleRegistry({
    modules: [hospitality.HOSPITALITY_MODULE],
    hostTier: 'tier-4-agent-host',
  });

  const scenarios = readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();

  for (const id of scenarios) {
    const scenarioDir = join(dir, id);
    const dealPath = join(scenarioDir, 'deal.uwx.md');
    const expectedPath = join(scenarioDir, 'expected.json');
    if (!existsSync(dealPath) || !existsSync(expectedPath)) {
      record('modules', `runtime/${id}`, 'fail', 'scenario needs deal.uwx.md and expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    if (expected.module !== '@uwmd/module-hospitality') {
      record('modules', `runtime/${id}`, 'fail', `unknown module under test: ${expected.module}`);
      continue;
    }

    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const problems = [];

    const computed = Object.fromEntries(
      evaluateModuleCalculations(parsed, registry).map(({ result }) => [result.calc_id, result.value]),
    );
    for (const [calcId, want] of Object.entries(expected.expected_calcs ?? {})) {
      if (!(calcId in computed)) {
        problems.push(`${calcId}: not computed`);
      } else if (computed[calcId] !== want) {
        problems.push(`${calcId}: ${computed[calcId]} != ${want}`);
      }
    }

    const codes = [...new Set(validateAgainstModules(parsed, registry).map((i) => i.code))].sort();
    const wanted = [...expected.expected_codes].sort();
    if (codes.join(',') !== wanted.join(',')) {
      problems.push(`codes [${codes.join(', ')}] != [${wanted.join(', ')}]`);
    }

    record('modules', `runtime/${id}`, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }
}


/**
 * Module-declared asset classes (RFC 0003, protocol §X.2).
 *
 * Three of the four scenarios are the SAME BYTES with a different host: module
 * loaded, module absent but the declaration known, and neither. The verdict
 * has to change because the *reader* changed, and never because the document
 * is ambiguous — that is the property that makes an open extension point safe,
 * and it is not observable from any one scenario alone.
 */
async function runAssetClasses() {
  const dir = join(MODULES_DIR, 'asset-classes');
  if (!existsSync(dir)) return;

  const scenarios = readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();

  for (const id of scenarios) {
    const scenarioDir = join(dir, id);
    const dealPath = join(scenarioDir, 'deal.uwx.md');
    const modulePath = join(scenarioDir, 'module.json');
    const expectedPath = join(scenarioDir, 'expected.json');
    if (!existsSync(dealPath) || !existsSync(modulePath) || !existsSync(expectedPath)) {
      record('modules', `asset-classes/${id}`, 'fail', 'scenario needs deal.uwx.md, module.json and expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const manifest = JSON.parse(readFileSync(modulePath, 'utf8'));
    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const problems = [];

    // The manifest must load on its own before any scenario means anything.
    const loaded = loadModuleManifest(manifest, { hostTier: 'tier-4-agent-host' });
    if (!loaded.ok) {
      record('modules', `asset-classes/${id}`, 'fail', `fixture module does not load: ${loaded.errors.map((e) => e.code).join(', ')}`);
      continue;
    }

    const registry = createModuleRegistry({
      modules: expected.load_module ? [manifest] : [],
      hostTier: 'tier-4-agent-host',
    });
    const options = expected.known_declarations
      ? { knownDeclarations: manifest.declares_asset_classes }
      : {};

    const resolution = resolveAssetClass(parsed.frontmatter.asset_class, registry, options);
    if (resolution.status !== expected.expected_status) {
      problems.push(`status ${resolution.status} != ${expected.expected_status}`);
    }
    if (expected.expected_kind && resolution.kind !== expected.expected_kind) {
      problems.push(`kind ${resolution.kind} != ${expected.expected_kind}`);
    }
    if (expected.expected_display_name && resolution.declaration?.display_name !== expected.expected_display_name) {
      problems.push(`display_name ${resolution.declaration?.display_name} != ${expected.expected_display_name}`);
    }
    if (expected.expected_fallback && resolution.fallback !== expected.expected_fallback) {
      problems.push(`fallback ${resolution.fallback} != ${expected.expected_fallback}`);
    }
    if (expected.expected_issue_code && resolution.issue?.code !== expected.expected_issue_code) {
      problems.push(`issue ${resolution.issue?.code} != ${expected.expected_issue_code}`);
    }

    // Validation is host-independent by construction — it never consults a
    // registry — so its codes are asserted once, not per scenario.
    const codes = validateUWFile(parsed)
      .issues.map((i) => i.code)
      .filter((c) => c.startsWith('INVALID-ASSET-CLASS') || c === 'MOD-DEPENDENCY-UNDECLARED')
      .sort();
    const wanted = [...expected.expected_validation_codes].sort();
    if (codes.join(',') !== wanted.join(',')) {
      problems.push(`validation [${codes.join(', ')}] != [${wanted.join(', ')}]`);
    }

    record('modules', `asset-classes/${id}`, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // Cross-scenario invariant, asserted without a baseline: the three scenarios
  // that share a document must share its bytes. If someone "fixes" a failing
  // scenario by editing its deal file, the whole demonstration is void.
  const bytes = ['01-module-loaded', '02-fallback-degraded', '03-unresolved']
    .map((s) => join(dir, s, 'deal.uwx.md'))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, 'utf8'));
  if (bytes.length === 3) {
    const identical = bytes.every((b) => b === bytes[0]);
    record(
      'modules',
      'asset-classes/same-document-across-hosts',
      identical ? 'pass' : 'fail',
      identical ? undefined : 'the three resolution scenarios no longer share one document',
    );
  }
}


// ─── Packages suite (RFC 0018) ───────────────────────────────────────────────
//
// Manifest fixtures checked against the validator AND the normative schema, on
// the same reasoning as the modules suite: `@uwmd/core` cannot carry a JSON
// Schema validator, so the hand-written one needs an external referee.
//
// Parity here is asserted in ONE direction. The schema is deliberately more
// permissive — it cannot express dangling-link or wrong-layer rules — so the
// invariant is: anything the validator accepts, the schema must also accept.

const PACKAGES_DIR = join(CONFORMANCE_DIR, 'packages');

async function runPackages() {
  if (!existsSync(PACKAGES_DIR)) {
    record('packages', '(none)', 'pass', 'no package fixtures');
    return;
  }
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const schema = JSON.parse(
    readFileSync(join(ROOT, 'spec', 'schemas', 'uw-deal-package-manifest.schema.json'), 'utf8'),
  );
  const schemaCheck = new Ajv2020({ strict: false }).compile(schema);

  const read = (kind) => {
    const dir = join(PACKAGES_DIR, kind);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.manifest.json'))
      .sort()
      .map((f) => {
        const id = basename(f, '.manifest.json');
        const expectedPath = join(dir, `${id}.expected.json`);
        return {
          id,
          manifest: JSON.parse(readFileSync(join(dir, f), 'utf8')),
          expected: existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, 'utf8')) : null,
        };
      });
  };

  for (const { id, manifest } of read('accept')) {
    const errors = validateUWDealPackageManifest(manifest);
    if (errors.length === 0) {
      record('packages', `accept/${id}`, 'pass');
    } else {
      record('packages', `accept/${id}`, 'fail', `expected acceptance, got ${errors.map((e) => e.code).join(', ')}`);
    }
    if (errors.length === 0 && !schemaCheck(manifest)) {
      record('packages', `accept/${id} [schema]`, 'fail',
        (schemaCheck.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join('; '));
    } else {
      record('packages', `accept/${id} [schema]`, 'pass');
    }
  }

  for (const { id, manifest, expected } of read('reject')) {
    if (!expected) { record('packages', `reject/${id}`, 'fail', 'missing .expected.json'); continue; }
    const errors = validateUWDealPackageManifest(manifest);
    if (errors.length === 0) {
      record('packages', `reject/${id}`, 'fail', 'expected refusal, manifest validated');
      continue;
    }
    const emitted = new Set(errors.map((e) => e.code));
    const missing = expected.expected_codes.filter((c) => !emitted.has(c));
    if (missing.length > 0) {
      record('packages', `reject/${id}`, 'fail',
        `refused without ${missing.join(', ')} (got ${[...emitted].join(', ')})`);
    } else {
      record('packages', `reject/${id}`, 'pass', expected.expected_codes.join(', '));
    }
  }

  // Invariants, asserted without baselines so they bind any implementation.
  const encoder = new TextEncoder();
  const dealText = '---\nuw_version: "1.1"\ndeal_id: rt\n---\n';
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00, 0x80]);
  try {
    const manifest = {
      package_version: '1.0',
      package_id: 'pkg:roundtrip:1',
      members: [
        { id: 'deal:rt', path: 'records/rt.uwx.md', role: 'underwriting',
          media_type: 'text/vnd.uwmd.extended+markdown',
          sha256: `sha256:${await sha256BytesHex(encoder.encode(dealText))}` },
        { id: 'src:rt', path: 'sources/rt.pdf', role: 'source_evidence',
          media_type: 'application/pdf',
          sha256: `sha256:${await sha256BytesHex(pdf)}` },
      ],
      links: [{ type: 'abstracts', from: 'deal:rt', to: 'src:rt' }],
    };
    const payloads = { 'records/rt.uwx.md': encoder.encode(dealText), 'sources/rt.pdf': pdf };

    const a = await encodeUWDealPackageZip({ manifest, payloads });
    const b = await encodeUWDealPackageZip({ manifest, payloads });
    const identical = a.length === b.length && a.every((v, i) => v === b[i]);
    record('packages', 'invariant/deterministic-encoding', identical ? 'pass' : 'fail',
      identical ? undefined : 'two encodings of one package differ');

    const decoded = decodeUWDealPackageZip(a);
    const back = decoded.payloads['sources/rt.pdf'];
    const binaryOk = back.length === pdf.length && back.every((v, i) => v === pdf[i]);
    record('packages', 'invariant/binary-roundtrip', binaryOk ? 'pass' : 'fail',
      binaryOk ? 'high bytes preserved' : 'binary member corrupted');

    const verified = await verifyUWDealPackage(decoded);
    record('packages', 'invariant/verify-clean', verified.status === 'verified' ? 'pass' : 'fail', verified.status);

    decoded.payloads['records/rt.uwx.md'] = encoder.encode('tampered\n');
    const tampered = await verifyUWDealPackage(decoded);
    record('packages', 'invariant/verify-tampered', tampered.status === 'failed' ? 'pass' : 'fail', tampered.status);

    const ctx = projectUWDealPackageContext(manifest, {
      contents: { 'deal:rt': dealText, 'src:rt': 'MUST NOT APPEAR' },
    });
    const clean = !JSON.stringify(ctx).includes('MUST NOT APPEAR') && ctx.contents['src:rt'] === undefined;
    record('packages', 'invariant/context-omits-source-bytes', clean ? 'pass' : 'fail',
      clean ? 'source evidence described, never embedded' : 'source bytes leaked into the context view');

    const ctxErrors = validateUWDealPackageContext(ctx);
    record('packages', 'invariant/context-valid', ctxErrors.length === 0 ? 'pass' : 'fail',
      ctxErrors.map((e) => e.code).join(', '));

    const edges = projectPackageLinksToEntityEdges(manifest);
    record('packages', 'invariant/no-member-only-projection', edges.length === 0 ? 'pass' : 'fail',
      edges.length === 0 ? 'abstracts correctly has no entity-layer meaning' : 'member-only type projected');
  } catch (e) {
    record('packages', 'invariant/(setup)', 'fail', e.message);
  }
}

// ─── Composition (RFC 0021) ──────────────────────────────────────────────────
// I-1 is the assertion this suite exists to prove: an externalized record and
// its inline twin must produce identical canonical forms and identical semantic
// digests. Everything else here guards a way that can silently stop being true.

const COMPOSITION_DIR = join(CONFORMANCE_DIR, 'composition');

function compositionScenarios(kind) {
  const dir = join(COMPOSITION_DIR, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(dir, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Load a scenario's fragments. Returns `{ parts }` or `{ error }` — a fragment
 * that refuses to parse is a result, not a crash: several reject fixtures are
 * refused at exactly this point.
 */
function loadParts(dir) {
  const partsDir = join(dir, 'parts');
  const parts = new Map();
  if (!existsSync(partsDir)) return { parts };
  for (const file of readdirSync(partsDir).filter((f) => f.endsWith('.uwpart.md')).sort()) {
    const path = join(partsDir, file);
    try {
      const part = parseUWPart(parseUWFile(readFileSync(path, 'utf8'), { filename: path }), { filename: file });
      parts.set(part.part_id, part);
    } catch (e) {
      return { parts, error: e };
    }
  }
  return { parts };
}

const readCase = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));

/** Every issue code a resolution reported, for matching against a fixture. */
const issueCodes = (resolution) => resolution.issues.map((i) => i.code);

async function runComposition() {
  if (!existsSync(COMPOSITION_DIR)) {
    record('composition', '(none)', 'pass', 'no composition fixtures');
    return;
  }

  // ── resolve/ — I-1 itself ──────────────────────────────────────────────────
  for (const { id, dir } of compositionScenarios('resolve')) {
    const expected = readCase(dir, 'expected.json');
    const { parts, error } = loadParts(dir);
    if (error) {
      record('composition', `resolve/${id}`, 'fail', `fragment failed to parse: ${error.message}`);
      continue;
    }
    const parsed = parseUWFile(readFileSync(join(dir, 'record.uwx.md'), 'utf8'));
    const resolution = resolveComposition(parsed, { parts });

    if (resolution.status !== expected.status) {
      record('composition', `resolve/${id}`, 'fail', `status ${resolution.status}, expected ${expected.status}: ${issueCodes(resolution).join(', ')}`);
      continue;
    }
    if (expected.externalized && JSON.stringify(resolution.externalized) !== JSON.stringify(expected.externalized)) {
      record('composition', `resolve/${id}`, 'fail', `externalized ${JSON.stringify(resolution.externalized)}, expected ${JSON.stringify(expected.externalized)}`);
      continue;
    }

    if (expected.matches_inline) {
      const inline = parseUWFile(readFileSync(join(dir, 'inline.uwx.md'), 'utf8'));
      // Compared on the canonical form and the digest, never on source bytes:
      // source bytes differ by construction, and that is the point of I-1.
      const got = canonicalizeUWEnvelope(toUWEnvelope(resolution.document));
      const want = canonicalizeUWEnvelope(toUWEnvelope(inline));
      if (got !== want) {
        record('composition', `resolve/${id} [canonical]`, 'fail', 'resolved canonical form differs from the inline twin');
        continue;
      }
      record('composition', `resolve/${id} [canonical]`, 'pass');

      const gotDigest = await computeEnvelopeDigest(toUWEnvelope(resolution.document));
      const wantDigest = await computeEnvelopeDigest(toUWEnvelope(inline));
      if (gotDigest !== wantDigest) {
        record('composition', `resolve/${id} [digest]`, 'fail', `${gotDigest} != ${wantDigest}`);
        continue;
      }
      record('composition', `resolve/${id} [digest]`, 'pass');
    } else {
      record('composition', `resolve/${id}`, 'pass');
    }
  }

  // ── reject/ — one fixture per refusal ──────────────────────────────────────
  for (const { id, dir } of compositionScenarios('reject')) {
    const expected = readCase(dir, 'expected.json');
    const { parts, error } = loadParts(dir);

    // A fragment may be refused at parse time (malformed, section mismatch) or
    // the directive may be refused during resolution. Both are the same result.
    if (error) {
      if (error.code === expected.expected_code) {
        record('composition', `reject/${id}`, 'pass', error.code);
      } else {
        record('composition', `reject/${id}`, 'fail', `fragment threw ${error.code ?? error.message}, expected ${expected.expected_code}`);
      }
      continue;
    }

    const parsed = parseUWFile(readFileSync(join(dir, 'record.uwx.md'), 'utf8'));
    const resolution = resolveComposition(parsed, { parts });
    const codes = issueCodes(resolution);
    if (resolution.status === 'resolved') {
      record('composition', `reject/${id}`, 'fail', 'resolved where it must refuse');
    } else if (codes.includes(expected.expected_code)) {
      record('composition', `reject/${id}`, 'pass', expected.expected_code);
    } else {
      record('composition', `reject/${id}`, 'fail', `reported ${codes.join(', ') || '(none)'}, expected ${expected.expected_code}`);
    }
  }

  // ── unresolved/ — a missing part is never a smaller collection ─────────────
  for (const { id, dir } of compositionScenarios('unresolved')) {
    const expected = readCase(dir, 'expected.json');
    const { parts } = loadParts(dir);
    const parsed = parseUWFile(readFileSync(join(dir, 'record.uwx.md'), 'utf8'));
    const resolution = resolveComposition(parsed, { parts });

    if (resolution.status !== expected.status) {
      record('composition', `unresolved/${id}`, 'fail', `status ${resolution.status}, expected ${expected.status}`);
      continue;
    }
    if (!issueCodes(resolution).includes(expected.expected_code)) {
      record('composition', `unresolved/${id}`, 'fail', `reported ${issueCodes(resolution).join(', ')}, expected ${expected.expected_code}`);
      continue;
    }

    // The assertion that matters: the section must still be externalized, not
    // silently merged from the parts that happened to resolve.
    if (expected.section_remains_externalized) {
      const section = resolution.document.sections[expected.section_remains_externalized];
      const block = section && 'annotation' in section ? section : Object.values(section ?? {})[0];
      const stillExternal = Boolean(block?.content?.external);
      if (!stillExternal) {
        record('composition', `unresolved/${id}`, 'fail', 'section was partially merged — under-resolution must never produce a smaller collection');
        continue;
      }
    }
    record('composition', `unresolved/${id}`, 'pass', expected.expected_code);
  }

  // ── composite/ — graph shape, bounds, staleness ────────────────────────────
  for (const { id, dir } of compositionScenarios('composite')) {
    const testCase = readCase(dir, 'case.json');
    const expected = readCase(dir, 'expected.json');
    const resolution = resolveComposite({
      members: testCase.members,
      links: testCase.links,
      ...(testCase.maxDepth ? { maxDepth: testCase.maxDepth } : {}),
      ...(testCase.maxMembers ? { maxMembers: testCase.maxMembers } : {}),
      ...(testCase.recordedDigests ? { recordedDigests: new Map(Object.entries(testCase.recordedDigests)) } : {}),
      ...(testCase.actualDigests ? { actualDigests: new Map(Object.entries(testCase.actualDigests)) } : {}),
    });

    if (resolution.status !== expected.status) {
      record('composition', `composite/${id}`, 'fail', `status ${resolution.status}, expected ${expected.status}: ${issueCodes(resolution).join(', ')}`);
      continue;
    }
    if (expected.expected_code && !issueCodes(resolution).includes(expected.expected_code)) {
      record('composition', `composite/${id}`, 'fail', `reported ${issueCodes(resolution).join(', ') || '(none)'}, expected ${expected.expected_code}`);
      continue;
    }
    if (expected.depth !== undefined && resolution.depth !== expected.depth) {
      record('composition', `composite/${id}`, 'fail', `depth ${resolution.depth}, expected ${expected.depth}`);
      continue;
    }
    if (expected.member_count !== undefined && resolution.member_count !== expected.member_count) {
      record('composition', `composite/${id}`, 'fail', `member_count ${resolution.member_count}, expected ${expected.member_count}`);
      continue;
    }
    if (expected.order_leaves_first) {
      // A parent's digest is a function of its children's, so every child must
      // appear before any parent that names it.
      const position = new Map(resolution.order.map((memberId, i) => [memberId, i]));
      const violation = testCase.links.find((l) => position.get(l.from) > position.get(l.to));
      if (violation) {
        record('composition', `composite/${id}`, 'fail', `child '${violation.from}' ordered after parent '${violation.to}'`);
        continue;
      }
    }
    if (expected.stale) {
      const got = resolution.stale.map((s) => `${s.parent}::${s.child}`).sort();
      const want = expected.stale.map((s) => `${s.parent}::${s.child}`).sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        record('composition', `composite/${id}`, 'fail', `stale ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
        continue;
      }
    }
    record('composition', `composite/${id}`, 'pass', expected.expected_code ?? expected.status);
  }

  // ── inherit/ — nearest ancestor wins; equidistant is an error ──────────────
  for (const { id, dir } of compositionScenarios('inherit')) {
    const testCase = readCase(dir, 'case.json');
    const expected = readCase(dir, 'expected.json');
    try {
      const selected = selectInheritedAssumption(testCase.field_path, testCase.inherited);
      if (expected.expected_error) {
        record('composition', `inherit/${id}`, 'fail', `selected ${selected?.document_id ?? 'null'} where it must refuse`);
        continue;
      }
      if (selected?.document_id !== expected.document_id) {
        record('composition', `inherit/${id}`, 'fail', `selected ${selected?.document_id ?? 'null'}, expected ${expected.document_id}`);
        continue;
      }
      if (expected.distance !== undefined && selected.distance !== expected.distance) {
        record('composition', `inherit/${id}`, 'fail', `distance ${selected.distance}, expected ${expected.distance}`);
        continue;
      }
      if (expected.value !== undefined && selected.values[testCase.field_path] !== expected.value) {
        record('composition', `inherit/${id}`, 'fail', `value ${selected.values[testCase.field_path]}, expected ${expected.value}`);
        continue;
      }
      record('composition', `inherit/${id}`, 'pass', `${selected.document_id} @ ${selected.distance}`);
    } catch (e) {
      if (expected.expected_error && e.constructor.name === expected.expected_error) {
        record('composition', `inherit/${id}`, 'pass', expected.expected_error);
      } else {
        record('composition', `inherit/${id}`, 'fail', `threw ${e.constructor.name}: ${e.message}`);
      }
    }
  }

  // ── rollup/ — two-stage verification ───────────────────────────────────────
  for (const { id, dir } of compositionScenarios('rollup')) {
    const testCase = readCase(dir, 'case.json');
    const expected = readCase(dir, 'expected.json');
    const verification = verifyRollup(testCase.aggregates, testCase.members);

    if (verification.verdict !== expected.verdict) {
      record('composition', `rollup/${id}`, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}`);
      continue;
    }
    if (expected.expected_code && !verification.issues.some((i) => i.code === expected.expected_code)) {
      record('composition', `rollup/${id}`, 'fail', `issues ${verification.issues.map((i) => i.code).join(', ') || '(none)'}, expected ${expected.expected_code}`);
      continue;
    }
    if (expected.decided_before_arithmetic) {
      // A total over a child that failed its own receipt must not be reported
      // as agreeing, even when the numbers happen to add up.
      const arithmetic = verification.aggregates.some((a) => a.recomputed !== null);
      if (arithmetic) {
        record('composition', `rollup/${id}`, 'fail', 'aggregates were recomputed despite a failed child');
        continue;
      }
    }
    record('composition', `rollup/${id}`, 'pass', expected.verdict);
  }

  // ── lite-projection/ — §3: the projection names what it could not see ──────
  for (const { id, dir } of compositionScenarios('lite-projection')) {
    const expected = readCase(dir, 'expected.json');
    const scenario = `lite-projection/${id}`;
    const projection = projectUWEnvelopeToLite(
      toUWEnvelope(parseUWFile(readFileSync(join(dir, 'record.uwx.md'), 'utf8'))),
    );
    const report = projection.report;

    if (JSON.stringify(report.externalized_sections) !== JSON.stringify(expected.externalized_sections)) {
      record('composition', scenario, 'fail', `externalized_sections ${JSON.stringify(report.externalized_sections)}, expected ${JSON.stringify(expected.externalized_sections)}`);
      continue;
    }
    if (expected.lossy !== undefined && report.lossy !== expected.lossy) {
      record('composition', scenario, 'fail', `lossy ${report.lossy}, expected ${expected.lossy}`);
      continue;
    }

    // The regression this suite exists to hold: the directive's own keys must
    // never stand in for the contents they point at. Reporting `external.parts`
    // as omitted data made an externalized record look *less* lossy than its
    // inline twin.
    if (expected.omits_no_directive_paths) {
      const leaked = report.omitted_paths.filter((p) => p.includes('.external.'));
      if (leaked.length > 0) {
        record('composition', scenario, 'fail', `directive keys leaked into omitted_paths: ${leaked.join(', ')}`);
        continue;
      }
    }

    // I-1, one layer up: externalization is packaging, so the projected Lite
    // document is unchanged by it. Only the report may differ.
    if (expected.matches_inline_projection) {
      const inline = projectUWEnvelopeToLite(
        toUWEnvelope(parseUWFile(readFileSync(join(dir, 'inline.uwx.md'), 'utf8'))),
      );
      if (projection.content !== inline.content) {
        record('composition', `${scenario} [content]`, 'fail', 'projected Lite document differs from the inline twin');
        continue;
      }
      record('composition', `${scenario} [content]`, 'pass');
    }
    record('composition', scenario, 'pass', report.externalized_sections.join(', '));
  }
}

// ─── Capital stack (RFC 0026) ────────────────────────────────────────────────
//
// Scenario kind is dispatched by the files a directory carries, not by its id:
//   case.json + expected.json ("verdict")      → verifyCapitalStack three-state
//   case.json with "variants"                  → the pref cash-vs-accrued contrast
//   agree.uwx.md + mismatch.uwx.md               → generalized CC-03, both directions
//   deal.uwx.md + expected.json                 → validator refusal (typed codes)
//   deal.uwx.md + expected-metrics.json         → the no-stack single-loan pin

const CAPITAL_STACK_DIR = join(CONFORMANCE_DIR, 'capital-stack');

async function runCapitalStack() {
  if (!existsSync(CAPITAL_STACK_DIR)) {
    record('capital-stack', '(none)', 'pass', 'no capital-stack fixtures');
    return;
  }
  const scenarios = readdirSync(CAPITAL_STACK_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(CAPITAL_STACK_DIR, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const validatorCodes = (path) =>
    validateUWFile(parseUWFile(readFileSync(path, 'utf8'))).issues.map((i) => i.code);

  for (const { id, dir } of scenarios) {
    // ── The no-stack single-loan pin ─────────────────────────────────────────
    if (existsSync(join(dir, 'expected-metrics.json'))) {
      const expected = readCase(dir, 'expected-metrics.json');
      const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
      const codes = validateUWFile(parsed).issues.map((i) => i.code);
      const tripped = codes.filter((c) =>
        (expected.no_codes_with_prefix ?? []).some((p) => c.startsWith(p)));
      if (tripped.length) {
        record('capital-stack', id, 'fail', `stack rules fired on a stack-less document: ${tripped.join(', ')}`);
        continue;
      }
      const ctx = { parsed, prior_results: {}, locale: 'en-US' };
      let bad = null;
      for (const [metricId, want] of Object.entries(expected.metrics)) {
        const decl = (MULTIFAMILY_PACK.calculations ?? []).find((d) => d.id === metricId);
        const r = decl ? evaluateCalc(decl, ctx) : null;
        if (!decl || !r.ok || r.value !== want) {
          bad = `${metricId} = ${r?.ok ? r.value : 'error'}, pinned ${want}`;
          break;
        }
      }
      if (bad) {
        record('capital-stack', id, 'fail', `single-loan metric drifted: ${bad}`);
        continue;
      }
      record('capital-stack', id, 'pass', `${Object.keys(expected.metrics).length} metrics pinned`);
      continue;
    }

    // ── Generalized CC-03, both directions ───────────────────────────────────
    if (existsSync(join(dir, 'agree.uwx.md'))) {
      const expected = readCase(dir, 'expected.json');
      const agree = validatorCodes(join(dir, 'agree.uwx.md'));
      const mismatch = validatorCodes(join(dir, 'mismatch.uwx.md'));
      if (agree.length !== (expected.agree_codes ?? []).length ||
          !(expected.agree_codes ?? []).every((c) => agree.includes(c))) {
        record('capital-stack', id, 'fail', `agree document emitted [${agree.join(', ')}], expected [${(expected.agree_codes ?? []).join(', ')}]`);
        continue;
      }
      const missing = (expected.mismatch_codes ?? []).filter((c) => !mismatch.includes(c));
      if (missing.length) {
        record('capital-stack', id, 'fail', `mismatch document emitted [${mismatch.join(', ')}], missing ${missing.join(', ')}`);
        continue;
      }
      record('capital-stack', id, 'pass', `agree clean, mismatch ${expected.mismatch_codes.join(', ')}`);
      continue;
    }

    // ── Validator refusal (typed codes on a full document) ───────────────────
    if (existsSync(join(dir, 'deal.uwx.md'))) {
      const expected = readCase(dir, 'expected.json');
      const codes = validatorCodes(join(dir, 'deal.uwx.md'));
      const minOccurrences = expected.min_occurrences ?? 1;
      const short = (expected.expected_codes ?? []).filter(
        (c) => codes.filter((x) => x === c).length < minOccurrences);
      if (short.length) {
        record('capital-stack', id, 'fail', `emitted [${codes.join(', ')}], expected ${short.join(', ')} ×${minOccurrences}`);
        continue;
      }
      record('capital-stack', id, 'pass', expected.expected_codes.join(', '));
      continue;
    }

    const testCase = readCase(dir, 'case.json');
    const expected = readCase(dir, 'expected.json');

    // ── The pref cash-vs-accrued contrast ────────────────────────────────────
    if (testCase.variants) {
      const cash = verifyCapitalStack(testCase.variants.cash, testCase.context);
      const accrued = verifyCapitalStack(testCase.variants.accrued, testCase.context);
      if (cash.verdict !== expected.both_verdicts || accrued.verdict !== expected.both_verdicts) {
        record('capital-stack', id, 'fail', `verdicts ${cash.verdict}/${accrued.verdict}, expected both ${expected.both_verdicts}`);
        continue;
      }
      const sizingOf = (v, figId) => v.sizing.find((s) => s.id === figId);
      const blendedCash = sizingOf(cash, expected.blended_figure_id)?.recomputed;
      const blendedAccrued = sizingOf(accrued, expected.blended_figure_id)?.recomputed;
      if (expected.blended_direction === 'accrued_higher' && !(blendedAccrued > blendedCash)) {
        record('capital-stack', id, 'fail', `blended coverage ${blendedAccrued} (accrued) is not above ${blendedCash} (cash)`);
        continue;
      }
      const dyCash = sizingOf(cash, expected.debt_yield_figure_id)?.recomputed;
      const dyAccrued = sizingOf(accrued, expected.debt_yield_figure_id)?.recomputed;
      if (expected.debt_yield_equal && dyCash !== dyAccrued) {
        record('capital-stack', id, 'fail', `debt yield ${dyCash} (cash) != ${dyAccrued} (accrued); balance must count regardless of accrual`);
        continue;
      }
      record('capital-stack', id, 'pass', `blended ${blendedCash} → ${blendedAccrued}, debt yield stable`);
      continue;
    }

    // ── verifyCapitalStack three-state ───────────────────────────────────────
    const verification = verifyCapitalStack(testCase.stack, testCase.context);
    if (verification.verdict !== expected.verdict) {
      record('capital-stack', id, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}: ${verification.issues.map((i) => i.code).join(', ') || '(none)'}`);
      continue;
    }
    if (expected.expected_code && !verification.issues.some((i) => i.code === expected.expected_code)) {
      record('capital-stack', id, 'fail', `issues ${verification.issues.map((i) => i.code).join(', ') || '(none)'}, expected ${expected.expected_code}`);
      continue;
    }
    record('capital-stack', id, 'pass', expected.verdict);
  }
}

// ─── Lease-up schedule (RFC 0008) ────────────────────────────────────────────
//
// Scenario kind is dispatched by the files a directory carries:
//   case.json + expected.json ("verdict")  → verifyLeaseUpSchedule three-state
//   deal.uwx.md + expected.json             → validator codes and/or a full-document
//                                            verdict through leaseUpContext:
//       expected_codes[]        each must appear (× min_occurrences)
//       absent_code_prefixes[]  none may appear
//       verdict                 base/default variant verified end-to-end

const LEASE_UP_DIR = join(CONFORMANCE_DIR, 'lease-up');

async function runLeaseUp() {
  if (!existsSync(LEASE_UP_DIR)) {
    record('lease-up', '(none)', 'pass', 'no lease-up fixtures');
    return;
  }
  const scenarios = readdirSync(LEASE_UP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(LEASE_UP_DIR, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const { id, dir } of scenarios) {
    const expected = readCase(dir, 'expected.json');

    // ── Full document: validator codes and/or an end-to-end verdict ──────────
    if (existsSync(join(dir, 'deal.uwx.md'))) {
      const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
      const codes = validateUWFile(parsed).issues.map((i) => i.code);

      const minOccurrences = expected.min_occurrences ?? 1;
      const short = (expected.expected_codes ?? []).filter(
        (c) => codes.filter((x) => x === c).length < minOccurrences);
      if (short.length) {
        record('lease-up', id, 'fail', `emitted [${codes.join(', ')}], expected ${short.join(', ')} ×${minOccurrences}`);
        continue;
      }
      const tripped = codes.filter((c) =>
        (expected.absent_code_prefixes ?? []).some((p) => c.startsWith(p)));
      if (tripped.length) {
        record('lease-up', id, 'fail', `forbidden codes emitted: ${tripped.join(', ')}`);
        continue;
      }
      if (expected.verdict) {
        const entry = parsed.sections['lease_up_schedule'];
        const block = entry && !('annotation' in entry) ? (entry['base'] ?? entry['default']) : entry;
        if (!block) {
          record('lease-up', id, 'fail', 'expected a verdict but the document has no lease_up_schedule base/default variant');
          continue;
        }
        const verification = verifyLeaseUpSchedule(block.content, leaseUpContext(parsed));
        if (verification.verdict !== expected.verdict) {
          record('lease-up', id, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}: ${verification.issues.map((i) => i.code).join(', ') || '(none)'}`);
          continue;
        }
      }
      record('lease-up', id, 'pass', [
        ...(expected.expected_codes ?? []),
        ...(expected.verdict ? [expected.verdict] : []),
      ].join(', ') || 'clean');
      continue;
    }

    // ── verifyLeaseUpSchedule three-state over a bare payload ────────────────
    const testCase = readCase(dir, 'case.json');
    const verification = verifyLeaseUpSchedule(testCase.schedule, testCase.context);
    if (verification.verdict !== expected.verdict) {
      record('lease-up', id, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}: ${verification.issues.map((i) => i.code).join(', ') || '(none)'}`);
      continue;
    }
    if (expected.expected_code && !verification.issues.some((i) => i.code === expected.expected_code)) {
      record('lease-up', id, 'fail', `issues ${verification.issues.map((i) => i.code).join(', ') || '(none)'}, expected ${expected.expected_code}`);
      continue;
    }
    record('lease-up', id, 'pass', expected.verdict);
  }
}


// ─── Cash-flow series (RFC 0034, Protocol §VIII.9) ───────────────────────────
//
// Three scenario kinds, dispatched by the files a directory carries:
//   case.json + expected.json               → verifyCashFlowSeries over a bare payload
//   deal.uwx.md + decl.json + expected.json → evaluateCashFlowMetrics over the doc
//   deal.uwx.md + expected.json             → validator codes and/or an end-to-end verdict

const CASH_FLOW_DIR = join(CONFORMANCE_DIR, 'cash-flow');

async function runCashFlow() {
  if (!existsSync(CASH_FLOW_DIR)) {
    record('cash-flow', '(none)', 'pass', 'no cash-flow fixtures');
    return;
  }
  const scenarios = readdirSync(CASH_FLOW_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(CASH_FLOW_DIR, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const { id, dir } of scenarios) {
    const expected = readCase(dir, 'expected.json');

    // ── Declaration evaluation over a full document ──────────────────────────
    if (existsSync(join(dir, 'decl.json'))) {
      const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
      const declCase = readCase(dir, 'decl.json');
      const ctx = {
        parsed,
        prior_results: {},
        ...(declCase.overrides ? { overrides: declCase.overrides } : {}),
        locale: 'en-US',
      };
      const results = evaluateCashFlowMetrics(declCase.decls, ctx);
      let bad = null;
      for (let i = 0; i < expected.results.length; i++) {
        const want = expected.results[i];
        const got = results[i];
        if (!got || got.calc_id !== want.calc_id || got.ok !== want.ok) {
          bad = `result ${i}: got ${got ? `${got.calc_id} ok=${got.ok}` : '(missing)'}, expected ${want.calc_id} ok=${want.ok}`;
          break;
        }
        if (want.ok && got.value !== want.value) {
          bad = `${want.calc_id}: value ${got.value}, expected ${want.value}`;
          break;
        }
        if (want.unit !== undefined && got.unit !== want.unit) { bad = `${want.calc_id}: unit ${got.unit}`; break; }
        if (want.round_to !== undefined && got.round_to !== want.round_to) { bad = `${want.calc_id}: round_to ${got.round_to}`; break; }
        if (!want.ok && got.error?.code !== want.error_code) {
          bad = `${want.calc_id}: error ${got.error?.code}, expected ${want.error_code}`;
          break;
        }
      }
      record('cash-flow', id, bad ? 'fail' : 'pass', bad ?? `${expected.results.length} decl result(s)`);
      continue;
    }

    // ── Full document: validator codes and/or an end-to-end verdict ──────────
    if (existsSync(join(dir, 'deal.uwx.md'))) {
      const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
      const codes = validateUWFile(parsed).issues.map((i) => i.code);
      const short = (expected.expected_codes ?? []).filter((c) => !codes.includes(c));
      if (short.length) {
        record('cash-flow', id, 'fail', `emitted [${codes.join(', ')}], expected ${short.join(', ')}`);
        continue;
      }
      const tripped = codes.filter((c) =>
        (expected.absent_code_prefixes ?? []).some((p) => c.startsWith(p)));
      if (tripped.length) {
        record('cash-flow', id, 'fail', `forbidden codes emitted: ${tripped.join(', ')}`);
        continue;
      }
      if (expected.verdict) {
        const entry = parsed.sections['cash_flow_series'];
        const block = entry && !('annotation' in entry) ? (entry['base'] ?? entry['default']) : entry;
        if (!block) {
          record('cash-flow', id, 'fail', 'expected a verdict but the document has no cash_flow_series base/default variant');
          continue;
        }
        const verification = verifyCashFlowSeries(block.content);
        if (verification.verdict !== expected.verdict) {
          record('cash-flow', id, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}: ${verification.issues.map((i) => i.code).join(', ') || '(none)'}`);
          continue;
        }
      }
      record('cash-flow', id, 'pass', [
        ...(expected.expected_codes ?? []),
        ...(expected.verdict ? [expected.verdict] : []),
      ].join(', ') || 'clean');
      continue;
    }

    // ── verifyCashFlowSeries three-state over a bare payload ─────────────────
    const testCase = readCase(dir, 'case.json');
    const verification = verifyCashFlowSeries(testCase.series);
    if (verification.verdict !== expected.verdict) {
      record('cash-flow', id, 'fail', `verdict ${verification.verdict}, expected ${expected.verdict}: ${verification.issues.map((i) => i.code).join(', ') || '(none)'}`);
      continue;
    }
    if (expected.expected_code && !verification.issues.some((i) => i.code === expected.expected_code)) {
      record('cash-flow', id, 'fail', `issues ${verification.issues.map((i) => i.code).join(', ') || '(none)'}, expected ${expected.expected_code}`);
      continue;
    }
    record('cash-flow', id, 'pass', expected.verdict);
  }
}

// ─── Display locales (RFC 0001, Protocol §III.1a) ────────────────────────────
//
// All scenarios share deal.uwx.md; the runner injects `locale: <tag>` into the
// frontmatter so canonical content is byte-identical across locales by
// construction. See conformance/locale/README.md for expected.json fields.

const LOCALE_DIR = join(CONFORMANCE_DIR, 'locale');

async function runLocale() {
  if (!existsSync(LOCALE_DIR)) {
    record('locale', '(none)', 'pass', 'no locale fixtures');
    return;
  }
  const base = readFileSync(join(LOCALE_DIR, 'deal.uwx.md'), 'utf8');
  const withLocale = (tag) =>
    tag === 'en-US' ? base : base.replace('uw_version: "1.1"', `uw_version: "1.1"\nlocale: ${tag}`);

  const scenarios = readdirSync(LOCALE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: join(LOCALE_DIR, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const { id, dir } of scenarios) {
    const expected = readCase(dir, 'expected.json');

    // ── Calc invariance across every registered locale ───────────────────────
    if (expected.formula) {
      const parsed = parseUWFile(base);
      const decl = { id: 'loc-invariant', label: 'loc', formula: expected.formula, deterministic: true };
      const values = SUPPORTED_LOCALES.map((locale) => {
        const r = evaluateCalc(decl, { parsed, prior_results: {}, locale });
        return r.ok ? r.value : `error:${r.error?.code}`;
      });
      const distinct = [...new Set(values.map((v) => JSON.stringify(v)))];
      if (distinct.length !== 1 || values[0] !== expected.expected_value) {
        record('locale', id, 'fail', `values ${values.join(', ')}, expected all ${expected.expected_value}`);
        continue;
      }
      record('locale', id, 'pass', `${expected.expected_value} under ${SUPPORTED_LOCALES.length} locales`);
      continue;
    }

    // ── CSV byte identity across locales ─────────────────────────────────────
    if (expected.compare_locales) {
      const [a, b] = expected.compare_locales;
      const csvA = render(parseUWFile(withLocale(a)), { format: 'csv' }).content;
      const csvB = render(parseUWFile(withLocale(b)), { format: 'csv' }).content;
      if (csvA !== csvB) {
        record('locale', id, 'fail', `csv render differs between ${a} and ${b}`);
        continue;
      }
      record('locale', id, 'pass', `${a} ≡ ${b}`);
      continue;
    }

    const parsed = parseUWFile(withLocale(expected.locale));

    // ── Unregistered locale: display refuses, machines keep working ──────────
    if (expected.render_refuses) {
      const codes = validateUWFile(parsed).issues.map((i) => i.code);
      const missing = (expected.validator_codes ?? []).filter((c) => !codes.includes(c));
      if (missing.length) {
        record('locale', id, 'fail', `validator missing ${missing.join(', ')}: emitted [${codes.join(', ')}]`);
        continue;
      }
      let threw = false;
      try { render(parsed, { format: 'summary' }); } catch { threw = true; }
      if (!threw) {
        record('locale', id, 'fail', 'summary render of an unregistered locale did not refuse');
        continue;
      }
      if (expected.machine_renders_work) {
        const json = render(parsed, { format: 'json' }).content;
        const csv = render(parsed, { format: 'csv' }).content;
        if (!json.length || !csv.length) {
          record('locale', id, 'fail', 'machine render produced no output');
          continue;
        }
      }
      record('locale', id, 'pass', `${(expected.validator_codes ?? []).join(', ')} + display refusal`);
      continue;
    }

    // ── Per-locale rendering pins ────────────────────────────────────────────
    const summary = render(parsed, { format: 'summary' }).content;
    const missing = (expected.summary_contains ?? []).filter((s) => !summary.includes(s));
    if (missing.length) {
      record('locale', id, 'fail', `summary lacks ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
      continue;
    }
    record('locale', id, 'pass', (expected.summary_contains ?? []).join(' · '));
  }
}

// ─── Capability tokens (RFC 0011, Protocol §XIV) ─────────────────────────────
//
// Each scenario edits the shared deal.uwx.md under a token (generated by
// scripts/gen-capability-fixtures.mjs with the published TEST key), through
// the reference verifier over conformance/capability/keys/keystore.json.
//
//   <scenario>/expected.json:
//     op                default: section_supersede noi_model
//     source            default: agent/L2.inst-A (the tokens' sub)
//     no_token          true → the edit presents no token (08)
//     ok                whether the edit must apply
//     error_code        pinned refusal code when !ok
//     message_contains  substring of the refusal message (the typed reason)
//     notes_contains    substring of the new head's _meta.notes when ok (the jti)

const CAPABILITY_DIR = join(CONFORMANCE_DIR, 'capability');

async function runCapability() {
  if (!existsSync(CAPABILITY_DIR)) {
    record('capability', '(none)', 'pass', 'no capability fixtures');
    return;
  }
  let signing;
  try {
    signing = await import('@uwmd/signing');
  } catch {
    record('capability', 'suite', 'fail', '@uwmd/signing is not built — run npm run build first');
    return;
  }
  const store = await signing.loadKeyStoreFile(join(CAPABILITY_DIR, 'keys', 'keystore.json'));
  const capabilityVerifier = signing.createCapabilityVerifier(store);
  const fileContent = readFileSync(join(CAPABILITY_DIR, 'deal.uwx.md'), 'utf8');
  const parsed = parseUWFile(fileContent);

  const scenarios = readdirSync(CAPABILITY_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'keys')
    .map((e) => ({ id: e.name, dir: join(CAPABILITY_DIR, e.name) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const { id, dir } of scenarios) {
    const expected = readCase(dir, 'expected.json');
    const op = expected.op ?? {
      kind: 'section_supersede',
      section_id: 'noi_model',
      content: { net_operating_income: 495000 },
      meta: {},
    };
    const ctx = {
      actor: 'conformance',
      source: expected.source ?? 'agent/L2.inst-A',
    };
    if (!expected.no_token) {
      ctx.capability_token = readFileSync(join(dir, 'token.jwt'), 'utf8').trim();
    }
    const result = await applyEditAsync(fileContent, parsed, op, ctx, undefined, { capabilityVerifier });

    if (result.ok !== expected.ok) {
      record('capability', id, 'fail', `ok ${result.ok}, expected ${expected.ok}: [${result.error?.code}] ${result.error?.message ?? ''}`);
      continue;
    }
    if (!expected.ok) {
      if (result.error?.code !== expected.error_code) {
        record('capability', id, 'fail', `error ${result.error?.code}, expected ${expected.error_code}`);
        continue;
      }
      if (expected.message_contains && !String(result.error?.message ?? '').includes(expected.message_contains)) {
        record('capability', id, 'fail', `message lacks "${expected.message_contains}": ${result.error?.message}`);
        continue;
      }
      record('capability', id, 'pass', `${expected.error_code} (${expected.message_contains ?? ''})`);
      continue;
    }
    if (expected.notes_contains) {
      const head = getSection(parseUWFile(result.content), op.section_id);
      const notes = head?.meta?.notes ?? '';
      if (!String(notes).includes(expected.notes_contains)) {
        record('capability', id, 'fail', `notes "${notes}" lacks "${expected.notes_contains}"`);
        continue;
      }
    }
    record('capability', id, 'pass', expected.notes_contains ?? 'applied');
  }
}

// ─── Size intensives (RFC 0027, Protocol §XIII) ──────────────────────────────

const SIZE_INTENSIVE_DIR = join(CONFORMANCE_DIR, 'size-intensive');
const EXAMPLES_DIR = join(CONFORMANCE_DIR, '..', 'examples');

// csv cells contain quoted strings with embedded commas (deal names,
// addresses), so header-index lookups need a quote-aware split.
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; cur += ch; }
    else if (ch === ',' && !quoted) { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

async function runSizeIntensive() {
  if (!existsSync(SIZE_INTENSIVE_DIR)) {
    record('size-intensive', '(none)', 'pass', 'no size-intensive fixtures');
    return;
  }
  const parseExample = (name) => parseUWFile(readFileSync(join(EXAMPLES_DIR, name), 'utf8'));

  // ── 1. registry-covers-every-class — pins §XIII.1 / §XIII.2 / §XIII.3 ──────
  {
    const expected = readCase(join(SIZE_INTENSIVE_DIR, 'registry-covers-every-class'), 'expected.json');
    let bad = null;
    for (const [cls, primary] of Object.entries(expected.primaries)) {
      const entry = getSizeIntensive(cls);
      if (entry?.path !== primary) { bad = `${cls}: primary ${entry?.path ?? 'null'}, pinned ${primary}`; break; }
    }
    for (const cls of expected.no_primary) {
      if (!bad && getSizeIntensive(cls) !== null) bad = `${cls}: expected no primary size field`;
    }
    const extras = Object.keys(SIZE_INTENSIVES).filter((c) => !(c in expected.primaries));
    if (!bad && extras.length) bad = `registry carries unpinned classes: ${extras.join(', ')}`;
    record('size-intensive', 'registry-covers-every-class', bad ? 'fail' : 'pass',
      bad ?? `${Object.keys(expected.primaries).length} primaries + ${expected.no_primary.length} null pinned`);
  }

  // ── 2. pack-agreement — the registry may never drift from the packs ────────
  {
    let bad = null;
    for (const [cls, entry] of Object.entries(SIZE_INTENSIVES)) {
      const source = JSON.stringify(getPackForAssetClass(cls));
      if (!source.includes(`property.${entry.path}`)) {
        bad = `${cls}: pack never reads primary property.${entry.path}`; break;
      }
      const known = new Set([entry.path, ...entry.secondary]);
      const packPaths = [...source.matchAll(/property\.([a-z_]+)/g)].map((m) => m[1]);
      const stray = [...new Set(packPaths)].filter((p) => !known.has(p));
      if (stray.length) { bad = `${cls}: pack reads property.${stray[0]} missing from the registry entry`; break; }
    }
    record('size-intensive', 'pack-agreement', bad ? 'fail' : 'pass',
      bad ?? 'both coverage directions hold for all nine classes');
  }

  // ── 3. csv-exports-size-for-every-class — plus the total_units pin ─────────
  {
    const expected = readCase(join(SIZE_INTENSIVE_DIR, 'csv-exports-size-for-every-class'), 'expected.json');
    let bad = null;
    for (const [example, want] of Object.entries(expected.examples)) {
      const [header, row] = render(parseExample(example), { format: 'csv' }).content.split('\n');
      const headers = splitCsvLine(header);
      const cells = splitCsvLine(row);
      const got = Object.fromEntries(['size_basis', 'size_quantity', 'total_units']
        .map((c) => [c, cells[headers.indexOf(c)]]));
      const off = Object.keys(want).find((k) => got[k] !== want[k]);
      if (off) { bad = `${example}: ${off} = "${got[off]}", pinned "${want[off]}"`; break; }
    }
    record('size-intensive', 'csv-exports-size-for-every-class', bad ? 'fail' : 'pass',
      bad ?? `${Object.keys(expected.examples).length} examples pinned (nine sized, mixed_use empty)`);
  }

  // ── 4. report-cover-states-size ────────────────────────────────────────────
  {
    const expected = readCase(join(SIZE_INTENSIVE_DIR, 'report-cover-states-size'), 'expected.json');
    let bad = null;
    for (const { example, label, value } of expected.covers) {
      const { html } = renderReportHtml(parseExample(example), { tier: 'screener' });
      if (!html.includes(`<span>${label}</span><strong>${value}</strong>`)) {
        bad = `${example}: cover missing ${label} ${value}`; break;
      }
    }
    if (!bad && expected.no_drift) {
      const { html } = renderReportHtml(parseExample(expected.no_drift.example), { tier: 'screener' });
      const leaked = expected.no_drift.absent_labels.find((l) => html.includes(`<span>${l}</span>`));
      if (leaked) bad = `${expected.no_drift.example}: multifamily cover gained a ${leaked} fact`;
    }
    record('size-intensive', 'report-cover-states-size', bad ? 'fail' : 'pass',
      bad ?? expected.covers.map((c) => `${c.label} ${c.value}`).join(', '));
  }

  // ── 5. lite-round-trip-non-multifamily ─────────────────────────────────────
  {
    const expected = readCase(join(SIZE_INTENSIVE_DIR, 'lite-round-trip-non-multifamily'), 'expected.json');
    let bad = null;
    const projection = projectUWEnvelopeToLite(toUWEnvelope(parseExample(expected.example)));
    if (!projection.content.includes(`<!-- uw:${expected.anchor} -->`)) {
      bad = `projection carries no ${expected.anchor} anchor`;
    } else {
      const back = compileUWLite(parseUWLite(projection.content));
      const value = back.ok
        ? back.envelope.sections['property']?.content?.[expected.anchor.split('.')[1]]
        : undefined;
      if (value !== expected.value) bad = `round-trip value ${value}, pinned ${expected.value}`;
    }
    record('size-intensive', 'lite-round-trip-non-multifamily', bad ? 'fail' : 'pass',
      bad ?? `${expected.anchor} = ${expected.value} both directions`);
  }

  // ── 6. cc-13-warns-and-does-not-refuse ─────────────────────────────────────
  {
    const dir = join(SIZE_INTENSIVE_DIR, 'cc-13-warns-and-does-not-refuse');
    const expected = readCase(dir, 'expected.json');
    const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
    const validation = validateUWFile(parsed);
    const hits = validation.issues.filter((i) => i.code === expected.expected_code);
    let bad = null;
    if (hits.length !== 1) bad = `${expected.expected_code} fired ${hits.length} times, expected once`;
    else if (hits[0].severity !== expected.severity) bad = `severity ${hits[0].severity}, expected ${expected.severity}`;
    else if (hits[0].field !== expected.field) bad = `field ${hits[0].field}, expected ${expected.field}`;
    else if (validation.overall_status === expected.overall_status_not) bad = `overall_status is ${validation.overall_status} — CC-13 must never refuse`;
    else {
      const spec = expected.calc_still_computes;
      const decl = (getPackForAssetClass(spec.pack)?.calculations ?? []).find((d) => d.id === spec.calc_id);
      const r = decl ? evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' }) : null;
      if (!r?.ok || r.value !== spec.value) bad = `${spec.calc_id} = ${r?.ok ? r.value : 'error'}, pinned ${spec.value}`;
    }
    record('size-intensive', 'cc-13-warns-and-does-not-refuse', bad ? 'fail' : 'pass',
      bad ?? `warning on ${expected.field}, cap_rate still computes`);
  }

  // ── 7. cc-13-silent-for-mixed-use ──────────────────────────────────────────
  {
    const dir = join(SIZE_INTENSIVE_DIR, 'cc-13-silent-for-mixed-use');
    const expected = readCase(dir, 'expected.json');
    const parsed = parseUWFile(readFileSync(join(dir, 'deal.uwx.md'), 'utf8'));
    const codes = validateUWFile(parsed).issues.map((i) => i.code);
    const leaked = expected.absent_codes.filter((c) => codes.includes(c));
    let bad = leaked.length ? `emitted ${leaked.join(', ')} on a mixed_use document` : null;
    if (!bad && resolveDealSize(parsed) !== expected.resolve_deal_size) {
      bad = 'resolveDealSize synthesized a size for mixed_use';
    }
    record('size-intensive', 'cc-13-silent-for-mixed-use', bad ? 'fail' : 'pass',
      bad ?? 'no CC-13, resolveDealSize null');
  }
}

// ─── Signing suite (RFC 0010) ────────────────────────────────────────────────
//
// Block signatures are an optional capability, so this is a named suite rather
// than a tier: an implementation that does not claim `signing` skips it and is
// still conformant. It runs by default here because the reference
// implementation does claim it.
//
//   blocks/<scenario>/deal.uwx.md + expected.json
//     { keystore, ok, signatures_present, signatures_verified, expected_codes }
//   modules/<scenario>/module.json + expected.json
//     { keystore, policies: { <policy>: { ok, expected_codes } }, verdict }
//
// `keystore: null` means "verify with no signature backend" — the scenario that
// pins the distinction between a signature that passed and one nobody checked.
//
// The fixtures are generated (`scripts/gen-signing-fixtures.mjs`) because a
// signature over a hash of the file it lives in cannot be hand-authored.

const SIGNING_DIR = join(CONFORMANCE_DIR, 'signing');

async function runSigning() {
  if (!existsSync(SIGNING_DIR)) return;

  let signing;
  try {
    signing = await import('@uwmd/signing');
  } catch {
    record('signing', 'suite', 'fail', '@uwmd/signing is not built — run npm run build first');
    return;
  }

  await runSigningBlocks(signing);
  await runSigningModules(signing);
}

async function runSigningBlocks(signing) {
  const BLOCKS_DIR = join(SIGNING_DIR, 'blocks');
  if (!existsSync(BLOCKS_DIR)) return;

  const scenarios = readdirSync(BLOCKS_DIR)
    .filter((name) => statSync(join(BLOCKS_DIR, name)).isDirectory())
    .sort();

  for (const id of scenarios) {
    const dir = join(BLOCKS_DIR, id);
    const dealPath = join(dir, 'deal.uwx.md');
    const expectedPath = join(dir, 'expected.json');
    if (!existsSync(dealPath) || !existsSync(expectedPath)) {
      record('signing', `blocks/${id}`, 'fail', 'scenario needs deal.uwx.md and expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));

    let options = {};
    if (expected.keystore) {
      const store = await signing.loadKeyStoreFile(join(BLOCKS_DIR, expected.keystore));
      options = { signatureVerifier: signing.createBlockSignatureVerifier(store) };
    }

    let result;
    try {
      result = await verifyChain(parseUWFile(readFileSync(dealPath, 'utf8')), options);
    } catch (e) {
      record('signing', `blocks/${id}`, 'fail', `verifyChain threw: ${e.message}`);
      continue;
    }

    const codes = [...new Set(result.issues.map((i) => i.code))].sort();
    const wanted = [...expected.expected_codes].sort();
    const mismatches = [];
    if (result.ok !== expected.ok) mismatches.push(`ok ${result.ok} != ${expected.ok}`);
    if (result.signatures_present !== expected.signatures_present) {
      mismatches.push(`signatures_present ${result.signatures_present} != ${expected.signatures_present}`);
    }
    if (result.signatures_verified !== expected.signatures_verified) {
      mismatches.push(`signatures_verified ${result.signatures_verified} != ${expected.signatures_verified}`);
    }
    if (codes.join(',') !== wanted.join(',')) {
      mismatches.push(`codes [${codes.join(', ')}] != [${wanted.join(', ')}]`);
    }
    record('signing', `blocks/${id}`, mismatches.length ? 'fail' : 'pass', mismatches.join('; ') || undefined);
  }

  // Cross-scenario invariant, asserted without a baseline so it binds any
  // implementation: the same bytes verified with and without a backend must
  // agree on how many signatures are *present*. Only `signatures_verified` and
  // the issue list may differ.
  const withBackend = join(BLOCKS_DIR, '01-signed-valid', 'deal.uwx.md');
  const without = join(BLOCKS_DIR, '05-signed-no-backend', 'deal.uwx.md');
  if (existsSync(withBackend) && existsSync(without)) {
    const a = await verifyChain(parseUWFile(readFileSync(withBackend, 'utf8')));
    const b = await verifyChain(parseUWFile(readFileSync(without, 'utf8')));
    const agrees = a.signatures_present === b.signatures_present;
    record(
      'signing',
      'blocks/present-count is backend-independent',
      agrees ? 'pass' : 'fail',
      agrees ? undefined : `${a.signatures_present} != ${b.signatures_present}`,
    );
  }
}


/**
 * Module manifest signatures (RFC 0002, protocol §X.1).
 *
 * Every scenario is run under all three host policies, not just the
 * interesting one. The policy table IS the feature: `04-unsigned` loading under
 * `verify-if-present` and refusing under `require` is the whole distinction,
 * and asserting only one half would let the two collapse into each other
 * unnoticed.
 */
async function runSigningModules(signing) {
  const MODULES_SIG_DIR = join(SIGNING_DIR, 'modules');
  if (!existsSync(MODULES_SIG_DIR)) return;

  const scenarios = readdirSync(MODULES_SIG_DIR)
    .filter((name) => statSync(join(MODULES_SIG_DIR, name)).isDirectory())
    .sort();

  for (const id of scenarios) {
    const dir = join(MODULES_SIG_DIR, id);
    const manifestPath = join(dir, 'module.json');
    const expectedPath = join(dir, 'expected.json');
    if (!existsSync(manifestPath) || !existsSync(expectedPath)) {
      record('signing', `modules/${id}`, 'fail', 'scenario needs module.json and expected.json');
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const store = await signing.loadKeyStoreFile(join(MODULES_SIG_DIR, expected.keystore));
    const verifier = signing.createModuleSignatureVerifier(store);

    const problems = [];

    for (const [policy, want] of Object.entries(expected.policies)) {
      let result;
      try {
        result = await loadModuleManifestAsync(manifest, {
          hostTier: 'tier-4-agent-host',
          signaturePolicy: policy,
          signatureVerifier: verifier,
        });
      } catch (e) {
        problems.push(`${policy}: loader threw ${e.message}`);
        continue;
      }
      if (result.ok !== want.ok) {
        const saw = result.ok ? '' : ` (${result.errors.map((e) => e.code).join(', ')})`;
        problems.push(`${policy}: ok ${result.ok} != ${want.ok}${saw}`);
        continue;
      }
      const emitted = new Set(result.errors.map((e) => e.code));
      for (const code of want.expected_codes ?? []) {
        if (!emitted.has(code)) problems.push(`${policy}: missing ${code}`);
      }
    }

    // The verdict is asserted separately from the policies because a host may
    // want the reason without delegating the decision.
    const verdict = await verifyModuleSignature(manifest, { verifier });
    if (verdict.ok !== expected.verdict.ok) {
      problems.push(`verdict ok ${verdict.ok} != ${expected.verdict.ok}`);
    } else if (verdict.ok) {
      if (verdict.kid !== expected.verdict.kid) {
        problems.push(`verdict kid ${verdict.kid} != ${expected.verdict.kid}`);
      }
      if ((verdict.identity ?? null) !== (expected.verdict.identity ?? null)) {
        problems.push(`verdict identity ${verdict.identity} != ${expected.verdict.identity}`);
      }
    } else if (verdict.reason !== expected.verdict.reason) {
      problems.push(`verdict reason ${verdict.reason} != ${expected.verdict.reason}`);
    }

    record('signing', `modules/${id}`, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }
}


// ─── Sensitivity suite (RFC 0007) ────────────────────────────────────────────
//
// A named suite rather than a tier-3 fixture family: a sensitivity declaration
// is not a `ModuleCalcDecl`, its result is not a `CalcResult`, and filing it
// under tier-3 would mean the tier-3 runner (and the RFC 0004 case generator
// that reads the same directory) had to branch on fixture shape.
//
//   <scenario>/{deal.uwx.md, sensitivity.json, expected.json}
//
// `expected.grid` is a plain 2-D array of values with `null` for a failed
// cell, which reads far better in a diff than the cell union does. Cell errors
// are asserted separately, by coordinate and code.

const SENSITIVITY_DIR = join(CONFORMANCE_DIR, 'sensitivity');

async function runSensitivity() {
  if (!existsSync(SENSITIVITY_DIR)) return;

  const scenarios = readdirSync(SENSITIVITY_DIR)
    .filter((name) => statSync(join(SENSITIVITY_DIR, name)).isDirectory())
    .sort();

  for (const id of scenarios) {
    const dir = join(SENSITIVITY_DIR, id);
    const dealPath = join(dir, 'deal.uwx.md');
    const declPath = join(dir, 'sensitivity.json');
    const expectedPath = join(dir, 'expected.json');
    if (!existsSync(dealPath) || !existsSync(declPath) || !existsSync(expectedPath)) {
      record('sensitivity', id, 'fail', 'scenario needs deal.uwx.md, sensitivity.json and expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const decl = JSON.parse(readFileSync(declPath, 'utf8'));
    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const ctx = { parsed, prior_results: {}, locale: 'en-US' };
    const problems = [];

    let result;
    try {
      result = evaluateSensitivity(decl, ctx);
    } catch (e) {
      record('sensitivity', id, 'fail', `evaluateSensitivity threw: ${e.message}`);
      continue;
    }

    if (result.ok !== expected.ok) {
      problems.push(`ok ${result.ok} != ${expected.ok}${result.ok ? '' : ` (${result.error?.code})`}`);
    } else if (!expected.ok) {
      if (result.error?.code !== expected.expected_code) {
        problems.push(`code ${result.error?.code} != ${expected.expected_code}`);
      }
    } else {
      if (result.failed_cells !== expected.failed_cells) {
        problems.push(`failed_cells ${result.failed_cells} != ${expected.failed_cells}`);
      }
      if (expected.round_to !== undefined && result.round_to !== expected.round_to) {
        problems.push(`round_to ${result.round_to} != ${expected.round_to}`);
      }
      const actualGrid = (result.grid ?? []).map((row) =>
        row.map((cell) => (cell.ok ? cell.value : null)),
      );
      if (JSON.stringify(actualGrid) !== JSON.stringify(expected.grid)) {
        problems.push(`grid ${JSON.stringify(actualGrid)} != ${JSON.stringify(expected.grid)}`);
      }
      for (const want of expected.expected_cell_errors ?? []) {
        const cell = result.grid?.[want.row]?.[want.col];
        if (cell?.ok !== false) {
          problems.push(`cell [${want.row}][${want.col}] did not fail`);
        } else if (cell.error.code !== want.code) {
          problems.push(`cell [${want.row}][${want.col}] ${cell.error.code} != ${want.code}`);
        }
      }
      // A sweep that edited the document would silently change the deal, and
      // nothing else in the suite would notice.
      for (const [path, value] of Object.entries(expected.assert_unchanged ?? {})) {
        const after = evaluateCalc(
          { id: 'probe', label: 'probe', formula: path, deterministic: true },
          ctx,
        );
        if (after.value !== value) {
          problems.push(`document mutated: ${path} is ${after.value}, expected ${value}`);
        }
      }
    }

    record('sensitivity', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }
}


// ─── Stochastic suite (RFC 0005) ─────────────────────────────────────────────
//
// What this suite pins is NOT the shape of a distribution — that is a
// statistics question with no single right answer — but that the same seed
// produces the same numbers. A stochastic calc two hosts disagree about is not
// a model, it is a rumor.
//
//   <scenario>/{deal.uwx.md, stochastic.json, expected.json}
//
// `expected.summary` is the frozen baseline, minted with --update. Scenarios
// declare their own `exactness`: `exact` for uniform and triangular, which use
// only arithmetic and sqrt, and `tolerance` for normal, whose inverse-CDF tails
// call log() — a function no standard requires to be correctly rounded. Saying
// which is which beats a blanket tolerance that hides the difference.

const STOCHASTIC_DIR = join(CONFORMANCE_DIR, 'stochastic');

function summariesAgree(actual, expected, exactness, relTolerance) {
  const keys = [...new Set([...Object.keys(actual ?? {}), ...Object.keys(expected ?? {})])];
  const problems = [];
  for (const key of keys) {
    const a = actual?.[key];
    const b = expected?.[key];
    if (a === null || b === null || a === undefined || b === undefined) {
      if (a !== b) problems.push(`${key}: ${a} != ${b}`);
      continue;
    }
    if (exactness === 'exact') {
      if (a !== b) problems.push(`${key}: ${a} != ${b}`);
      continue;
    }
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    if (Math.abs(a - b) / scale > (relTolerance ?? 1e-9)) {
      problems.push(`${key}: ${a} != ${b} beyond tolerance`);
    }
  }
  return problems;
}

async function runStochastic() {
  if (!existsSync(STOCHASTIC_DIR)) return;

  const scenarios = readdirSync(STOCHASTIC_DIR)
    .filter((name) => statSync(join(STOCHASTIC_DIR, name)).isDirectory())
    .sort();
  const summaries = new Map();

  for (const id of scenarios) {
    const dir = join(STOCHASTIC_DIR, id);
    const dealPath = join(dir, 'deal.uwx.md');
    const declPath = join(dir, 'stochastic.json');
    const expectedPath = join(dir, 'expected.json');
    if (!existsSync(dealPath) || !existsSync(declPath) || !existsSync(expectedPath)) {
      record('stochastic', id, 'fail', 'scenario needs deal.uwx.md, stochastic.json and expected.json');
      continue;
    }
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    const decl = JSON.parse(readFileSync(declPath, 'utf8'));
    const parsed = parseUWFile(readFileSync(dealPath, 'utf8'));
    const ctx = { parsed, prior_results: {}, locale: 'en-US' };
    const problems = [];

    let result;
    try {
      result = evaluateStochastic(decl, ctx);
    } catch (e) {
      record('stochastic', id, 'fail', `evaluateStochastic threw: ${e.message}`);
      continue;
    }

    if (result.ok !== expected.ok) {
      problems.push(`ok ${result.ok} != ${expected.ok}${result.ok ? '' : ` (${result.error?.code})`}`);
      record('stochastic', id, 'fail', problems.join('; '));
      continue;
    }

    if (!expected.ok) {
      if (result.error?.code !== expected.expected_code) {
        problems.push(`code ${result.error?.code} != ${expected.expected_code}`);
      }
      record('stochastic', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
      continue;
    }

    summaries.set(id, result.summary);

    // Reproducibility is asserted in-process, without any baseline: re-running
    // must return the identical object. This binds any implementation, not just
    // one that happens to match our frozen numbers.
    if (expected.assert_reproducible) {
      const again = evaluateStochastic(decl, ctx);
      if (JSON.stringify(again.summary) !== JSON.stringify(result.summary)) {
        problems.push('re-running the same declaration produced a different summary');
      }
    }

    if (expected.expected_sampled) {
      if (JSON.stringify(result.sampled) !== JSON.stringify(expected.expected_sampled)) {
        problems.push(`sampled ${JSON.stringify(result.sampled)} != ${JSON.stringify(expected.expected_sampled)}`);
      }
    }

    for (const [stat, [lo, hi]] of Object.entries(expected.assert_within ?? {})) {
      const value = result.summary?.[stat];
      if (typeof value !== 'number' || value < lo || value > hi) {
        problems.push(`${stat} ${value} outside [${lo}, ${hi}]`);
      }
    }

    if (UPDATE) {
      expected.summary = result.summary;
      writeFileSync(expectedPath, `${JSON.stringify(expected, null, 2)}
`);
      record('stochastic', id, 'updated');
      continue;
    }
    if (!expected.summary) {
      record('stochastic', id, 'fail', 'missing frozen summary — run with --update');
      continue;
    }
    problems.push(
      ...summariesAgree(result.summary, expected.summary, expected.exactness, expected.relative_tolerance),
    );

    record('stochastic', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // A seed that did not change the stream would make the field decorative and
  // reproducibility accidental — so a scenario can name one it must differ from.
  for (const id of scenarios) {
    const expectedPath = join(STOCHASTIC_DIR, id, 'expected.json');
    if (!existsSync(expectedPath)) continue;
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    if (!expected.differs_from) continue;
    const mine = summaries.get(id);
    const theirs = summaries.get(expected.differs_from);
    if (mine === undefined || theirs === undefined) continue;
    const same = JSON.stringify(mine) === JSON.stringify(theirs);
    record(
      'stochastic',
      `${id} [differs from ${expected.differs_from}]`,
      same ? 'fail' : 'pass',
      same ? 'a different seed produced an identical summary' : undefined,
    );
  }
}


// ─── Source vocabulary (RFC 0031) ────────────────────────────────────────────
//
// `_meta.source` is actor-only; resolution methods live in `_meta.resolution`.
// Five scenarios: the split round-trips, a legacy tag is read-time-interpreted
// (and never rewritten into the raw bytes), an unmatched source supersedes
// instead of replacing (the unpoliced-write regression), the retired colon
// form is neither well-formed nor a human write, and a caller-supplied policy
// list with no coverage refuses rather than grants.

const SOURCE_DIR = join(CONFORMANCE_DIR, 'source');

async function runSource() {
  if (!existsSync(SOURCE_DIR)) return;

  const load = (id, file = 'deal.uwx.md') => {
    const content = readFileSync(join(SOURCE_DIR, id, file), 'utf8');
    return { content, parsed: parseUWFile(content) };
  };
  const expectedOf = (id) => JSON.parse(readFileSync(join(SOURCE_DIR, id, 'expected.json'), 'utf8'));
  const srcCodes = (parsed) =>
    [...new Set(validateUWFile(parsed).issues.filter((i) => i.code.startsWith('SRC-')).map((i) => i.code))].sort();

  // 01 — both fields present and distinct; they round-trip independently.
  {
    const id = '01-actor-and-resolution';
    const expected = expectedOf(id);
    const { parsed } = load(id);
    const meta = parsed.sections.property?.meta;
    const problems = [];
    if (meta?.source !== expected.source) problems.push(`source ${meta?.source} != ${expected.source}`);
    if (meta?.resolution !== expected.resolution) problems.push(`resolution ${meta?.resolution} != ${expected.resolution}`);
    const leaf = meta?.field_overrides?.find((o) => o.path === 'year_built');
    if (leaf?.resolution !== expected.override_resolution) {
      problems.push(`override resolution ${leaf?.resolution} != ${expected.override_resolution}`);
    }
    const codes = srcCodes(parsed);
    if (codes.join(',') !== [...expected.src_codes].sort().join(',')) {
      problems.push(`SRC codes [${codes.join(', ')}] != [${expected.src_codes.join(', ')}]`);
    }
    record('source', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 02 — a canonical tag in the actor field: interpreted as resolution,
  // SRC-02 warned, raw block bytes untouched.
  {
    const id = '02-legacy-tag-in-source';
    const expected = expectedOf(id);
    const { parsed } = load(id);
    const block = parsed.sections.property;
    const problems = [];
    if (block?.meta?.source !== expected.raw_source) problems.push(`raw source ${block?.meta?.source} != ${expected.raw_source}`);
    if (block?.meta?.resolution !== expected.interpreted_resolution) {
      problems.push(`interpreted resolution ${block?.meta?.resolution} != ${expected.interpreted_resolution}`);
    }
    const rawMeta = block?.content?._meta;
    const untouched = rawMeta && !('resolution' in rawMeta);
    if (untouched !== expected.content_meta_untouched) {
      problems.push('content._meta was rewritten by the reader — it feeds digests and must never be');
    }
    const codes = srcCodes(parsed);
    if (codes.join(',') !== [...expected.src_codes].sort().join(',')) {
      problems.push(`SRC codes [${codes.join(', ')}] != [${expected.src_codes.join(', ')}]`);
    }
    record('source', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 03 — the unpoliced-write regression: catch-all-governed blocks supersede.
  {
    const id = '03-unmatched-supersedes';
    const expected = expectedOf(id);
    const { content, parsed } = load(id);
    const problems = [];

    const replace = applyEdit(content, parsed, {
      kind: 'section_replace', section_id: 'property',
      content: { total_units: 999 }, meta: {},
    }, { actor: 'analyst', source: 'manual' });
    if (replace.ok || replace.error?.code !== expected.replace_error) {
      problems.push(`replace ${replace.ok ? 'succeeded' : replace.error?.code} != refused ${expected.replace_error}`);
    }

    const supersede = applyEdit(content, parsed, {
      kind: 'section_supersede', section_id: 'property',
      content: { total_units: 999 }, meta: {},
    }, { actor: 'analyst', source: 'manual' });
    if (supersede.ok !== expected.supersede_ok) {
      problems.push(`supersede ok ${supersede.ok} != ${expected.supersede_ok}`);
    } else if (supersede.ok) {
      const after = parseUWFile(supersede.content);
      const preserved = (after.superseded.property?.length ?? 0) > 0;
      if (preserved !== expected.prior_preserved) problems.push('prior block was not preserved');
    }

    const replaced = load(id, 'replaced-in-place.uwx.md');
    const provenance = verifyProvenance(replaced.parsed);
    const codes = [...new Set(provenance.issues.map((i) => i.code))].sort();
    const wanted = [...expected.replaced_in_place_codes].sort();
    if (codes.join(',') !== wanted.join(',')) {
      problems.push(`replaced-in-place codes [${codes.join(', ')}] != [${wanted.join(', ')}]`);
    }
    record('source', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 04 — the retired colon form: SRC-01, and never classified as human.
  {
    const id = '04-colon-form-rejected';
    const expected = expectedOf(id);
    const { content, parsed } = load(id);
    const problems = [];
    const codes = srcCodes(parsed);
    if (codes.join(',') !== [...expected.src_codes].sort().join(',')) {
      problems.push(`SRC codes [${codes.join(', ')}] != [${expected.src_codes.join(', ')}]`);
    }
    // A human_only policy over the manual-sourced property block: an actor
    // writing as `agent:L0-01` must be refused, not classified as human.
    const humanOnly = [
      { source_pattern: 'manual', authority: 'human_only', supersede_on_edit: true },
      { source_pattern: '*', authority: 'human_only', supersede_on_edit: true },
    ];
    const edit = applyEdit(content, parsed, {
      kind: 'section_supersede', section_id: 'property',
      content: { total_units: 999 }, meta: {},
    }, { actor: 'system', source: 'agent:L0-01' }, humanOnly);
    if (edit.ok || edit.error?.code !== expected.human_only_edit_refused) {
      problems.push(`colon-form edit ${edit.ok ? 'succeeded' : edit.error?.code} != refused ${expected.human_only_edit_refused}`);
    }
    record('source', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 05 — a policy list that does not cover the source refuses, never grants.
  {
    const id = '05-custom-policies-no-catchall';
    const expected = expectedOf(id);
    const { content, parsed } = load(id);
    const partial = [
      { source_pattern: 'agent/*', authority: 'either', supersede_on_edit: true },
    ];
    const edit = applyEdit(content, parsed, {
      kind: 'section_supersede', section_id: 'property',
      content: { total_units: 999 }, meta: {},
    }, { actor: 'analyst', source: 'manual' }, partial);
    const ok = !edit.ok && edit.error?.code === expected.edit_refused;
    record('source', id, ok ? 'pass' : 'fail',
      ok ? undefined : `edit ${edit.ok ? 'succeeded' : edit.error?.code} != refused ${expected.edit_refused}`);
  }
}

// ─── meta-v2 (RFC 0009) — nested _meta shape, shim, versioned digests ────────

const META_V2_DIR = join(CONFORMANCE_DIR, 'tier-1-reader', 'v2-fixtures');

async function runMetaV2() {
  if (!existsSync(META_V2_DIR)) return;

  const load = (file) => {
    const content = readFileSync(join(META_V2_DIR, file), 'utf8');
    return parseUWFile(content);
  };
  const metaCodes = (parsed) =>
    validateUWFile(parsed).issues.filter((i) => i.code.startsWith('META-V')).map((i) => i.code).sort();

  // 01 — minimal v2-shape file: parses to the flat view, no META-V codes.
  {
    const id = '01-nested-meta';
    const parsed = load(`${id}.uwx.md`);
    const block = parsed.sections.property;
    const problems = [];
    if (block?.meta_shape !== 'v2') problems.push(`meta_shape ${block?.meta_shape} != v2`);
    if (block?.meta?.version !== 1) problems.push(`flat view version ${block?.meta?.version} != 1`);
    if (block?.meta?.source !== 'manual') problems.push(`flat view source ${block?.meta?.source} != manual`);
    const codes = metaCodes(parsed);
    if (codes.length !== 0) problems.push(`unexpected META-V codes: ${codes.join(', ')}`);
    record('meta-v2', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 02 — nested _meta in a 1.x file is META-V2-IN-V1.
  {
    const id = '02-mixed-shape';
    const codes = metaCodes(load(`${id}.uwx.md`));
    const ok = codes.length === 1 && codes[0] === 'META-V2-IN-V1';
    record('meta-v2', id, ok ? 'pass' : 'fail', ok ? undefined : `codes [${codes.join(', ')}] != [META-V2-IN-V1]`);
  }

  // 03 — the v1→v2 reshape is byte-identical to the recorded output.
  {
    const id = '03-shim-roundtrip';
    const parsed = load(`${id}.uwx.md`);
    const block = parsed.sections.property;
    const reshaped = canonicalV2BlockContent({ ...block.content, _meta: block.meta });
    const got = `${JSON.stringify(reshaped, null, 2)}\n`;
    const expectedPath = join(META_V2_DIR, `${id}.expected-shim-output.json`);
    if (UPDATE && !existsSync(expectedPath)) {
      writeFileSync(expectedPath, got, 'utf8');
      record('meta-v2', id, 'updated', 'baseline written');
    } else {
      const expected = normalize(readFileSync(expectedPath, 'utf8'));
      const ok = normalize(got) === expected;
      record('meta-v2', id, ok ? 'pass' : 'fail', ok ? undefined : 'reshape differs from recorded baseline');
    }
  }

  // 04 — a legacy tag survives the shape change per the RFC 0031 rule:
  // resolution set, provenance.source ABSENT (never invented).
  {
    const id = '04-legacy-tag-through-shim';
    const parsed = load(`${id}.uwx.md`);
    const block = parsed.sections.property;
    const reshaped = canonicalV2BlockContent({ ...block.content, _meta: block.meta });
    const provenance = reshaped._meta?.provenance ?? {};
    const problems = [];
    if (provenance.resolution !== 'market_data') problems.push(`resolution ${provenance.resolution} != market_data`);
    if ('source' in provenance) problems.push(`provenance.source '${provenance.source}' was invented from a legacy tag`);
    record('meta-v2', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 05 — flat _meta in a v2 file is META-V1-IN-V2 (the mirror of 02).
  {
    const id = '05-flat-in-v2';
    const codes = metaCodes(load(`${id}.uwx.md`));
    const ok = codes.length === 1 && codes[0] === 'META-V1-IN-V2';
    record('meta-v2', id, ok ? 'pass' : 'fail', ok ? undefined : `codes [${codes.join(', ')}] != [META-V1-IN-V2]`);
  }

  // 06 — the same block in both accepted shapes yields the identical v2
  // digest (canonicalization step 1 is normalization).
  {
    const id = '06-digest-shape-insensitive';
    const flat = parseUWFile(readFileSync(join(META_V2_DIR, id, 'flat.uwx.md'), 'utf8'));
    const nested = parseUWFile(readFileSync(join(META_V2_DIR, id, 'nested.uwx.md'), 'utf8'));
    const a = await computeBlockHash(flat.sections.property, { shape: 'v2' });
    const b = await computeBlockHash(nested.sections.property, { shape: 'v2' });
    const ok = a === b;
    record('meta-v2', id, ok ? 'pass' : 'fail', ok ? undefined : `flat ${a} != nested ${b}`);
  }

  // 07 — spelling out the defaulted integrity.algorithm moves no digest.
  {
    const id = '07-defaulted-algorithm';
    const digestOf = (file) => {
      const parsed = parseUWFile(readFileSync(join(META_V2_DIR, id, file), 'utf8'));
      const block = parsed.sections.property;
      // Hash the raw nested content directly: the flat view drops `algorithm`,
      // and this scenario exists to pin what happens when it is PRESENT.
      return canonicalizeV2(canonicalV2BlockContent(block.content));
    };
    const a = digestOf('implicit.uwx.md');
    const b = digestOf('explicit.uwx.md');
    const ok = a === b && a.length > 0;
    record('meta-v2', id, ok ? 'pass' : 'fail', ok ? undefined : 'explicit sha256 algorithm moved the digest');
  }
}

// ─── migrate (RFC 0009) — uwmd migrate --to-v2 scenarios ─────────────────────

const MIGRATE_DIR = join(CONFORMANCE_DIR, 'migrate');

async function runMigrate() {
  if (!existsSync(MIGRATE_DIR)) return;

  const contentOf = (id) => readFileSync(join(MIGRATE_DIR, id, 'deal.uwx.md'), 'utf8');
  const expectedOf = (id) => JSON.parse(readFileSync(join(MIGRATE_DIR, id, 'expected.json'), 'utf8'));

  // 01 — a signed block refuses migration by default: the signature commits
  // to the v1 digest and only the key holder decides what happens to it.
  {
    const id = '01-signed-refused';
    const expected = expectedOf(id);
    const result = await migrateToV2(contentOf(id));
    const problems = [];
    if (result.ok !== expected.ok) problems.push(`ok ${result.ok} != ${expected.ok}`);
    if (result.content !== null) problems.push('refused migration still produced content');
    const refusal = result.refusals.join(' ');
    if (!refusal.includes(expected.refusal_contains)) problems.push(`refusal missing '${expected.refusal_contains}'`);
    if (!refusal.includes(expected.refusal_names_section)) problems.push(`refusal does not name '${expected.refusal_names_section}'`);
    record('migrate', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 02 — --strip-signatures removes the signature, records the removal in
  // provenance.notes, and the re-stamped chain verifies under the v2 rule.
  {
    const id = '02-strip-signatures';
    const expected = expectedOf(id);
    const result = await migrateToV2(contentOf(id), { stripSignatures: true });
    const problems = [];
    if (result.ok !== expected.ok) problems.push(`ok ${result.ok} != ${expected.ok}`);
    if (result.ok) {
      const parsed = parseUWFile(result.content);
      const block = parsed.sections.property;
      if (parsed.frontmatter.uw_version !== expected.uw_version) problems.push(`uw_version ${parsed.frontmatter.uw_version} != ${expected.uw_version}`);
      if ((block?.meta?.signature === undefined) !== expected.signature_absent) problems.push('signature survived --strip-signatures');
      if (!(block?.meta?.notes ?? '').includes(expected.note_contains)) problems.push(`notes missing '${expected.note_contains}'`);
      const chain = await verifyChain(parsed);
      if (chain.ok !== expected.chain_verifies) problems.push(`migrated chain ok ${chain.ok} != ${expected.chain_verifies}`);
    }
    record('migrate', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }

  // 03 — resolution 'manual' leaves the vocabulary at 2.0: rewritten to
  // 'user_input' with the rewrite recorded in provenance.notes.
  {
    const id = '03-manual-resolution';
    const expected = expectedOf(id);
    const result = await migrateToV2(contentOf(id));
    const problems = [];
    if (result.ok !== expected.ok) problems.push(`ok ${result.ok} != ${expected.ok}`);
    if (result.ok) {
      const parsed = parseUWFile(result.content);
      const block = parsed.sections.property;
      if (parsed.frontmatter.uw_version !== expected.uw_version) problems.push(`uw_version ${parsed.frontmatter.uw_version} != ${expected.uw_version}`);
      if (block?.meta?.resolution !== expected.resolution) problems.push(`resolution ${block?.meta?.resolution} != ${expected.resolution}`);
      if (!(block?.meta?.notes ?? '').includes(expected.note_contains)) problems.push(`notes missing '${expected.note_contains}'`);
    }
    record('migrate', id, problems.length ? 'fail' : 'pass', problems.join('; ') || undefined);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const dispatch = {
  '1': async () => { runTier1(); await runTier1Malformed(); },
  '2': async () => { await runTier2(); },
  '3': async () => { runTier3(); await runTier3Refinement(); },
  '4': async () => { runTier4(); await runTier4Profile(); },
  // Runs by default: deterministic, no network, no API key.
  '4-replay': async () => { await runTier4Replay(); },
  'lite': async () => { runLiteFixtures(); runLiteMalformed(); runLiteCompile(); runLiteEquivalence(); },
  'receipts': async () => { await runReceiptIssue(); await runReceiptVerify(); await runReceiptRefuse(); },
  'market-data': async () => { await runMarketData(); },
  'modules': async () => { await runModules(); await runModuleRuntime(); await runAssetClasses(); },
  'packages': async () => { await runPackages(); },
  'composition': async () => { await runComposition(); },
  'capital-stack': async () => { await runCapitalStack(); },
  'lease-up': async () => { await runLeaseUp(); },
  'cash-flow': async () => { await runCashFlow(); },
  'capability': async () => { await runCapability(); },
  'locale': async () => { await runLocale(); },
  'size-intensive': async () => { await runSizeIntensive(); },
  'signing': async () => { await runSigning(); },
  'sensitivity': async () => { await runSensitivity(); },
  'stochastic': async () => { await runStochastic(); },
  'source': async () => { await runSource(); },
  'meta-v2': async () => { await runMetaV2(); },
  'migrate': async () => { await runMigrate(); },
};
for (const t of TIERS) {
  if (!dispatch[t]) {
    console.error(`Unknown tier: ${t}`);
    process.exit(2);
  }
  await dispatch[t]();
}

const failures = results.filter((r) => r.status === 'fail');
const updates = results.filter((r) => r.status === 'updated');
const passes = results.filter((r) => r.status === 'pass');

if (JSON_OUT) {
  console.log(JSON.stringify({ results, summary: { pass: passes.length, fail: failures.length, updated: updates.length } }, null, 2));
} else {
  console.log('');
  console.log(`Summary: ${passes.length} pass, ${failures.length} fail${updates.length ? `, ${updates.length} updated` : ''}`);
}

process.exit(failures.length > 0 ? 1 : 0);
