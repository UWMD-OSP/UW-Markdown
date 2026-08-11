#!/usr/bin/env node
// Conformance runner — exercises every fixture against the @uwmd/core
// reference library and reports pass/fail per scenario.
//
// Usage:
//   node scripts/run-conformance.mjs [--tier=1,2,3,4] [--update] [--json]
//
//   --tier=...   Comma-separated tiers to run. Default: 1,2,3,lite,receipts.
//                Tier 4 requires --tier=4 explicitly because it is shape-only
//                and assumes a deterministic-replay scenario; live LLM calls
//                are out of scope for CI.
//                `lite` is a representation-level suite (UW Lite parse,
//                canonicalization, rendering, and the deal-summary-v1 bridge)
//                and `receipts` is an artifact-level suite (RFC 0016 issuance,
//                verification, and refusal) — neither is a protocol tier, so
//                both are named rather than numbered.
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
  evaluateCalc,
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
const TIERS = (flagVal('tier') ?? '1,2,3,lite,receipts').split(',').map((s) => s.trim()).filter(Boolean);
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

function projectBlock(b) {
  if (!b) return null;
  return {
    annotation: b.annotation,
    meta: b.meta,
    content: b.content,
    prose: b.prose,
    lineStart: b.lineStart,
    lineEnd: b.lineEnd,
  };
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
    .filter((f) => f.endsWith('.uw.md'))
    .sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uw\.md$/, '');
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
// Each <id>.uw.md has a sibling <id>.expected.json declaring the validator
// codes that MUST appear in the validation result. Extra codes are allowed.

async function runTier1Malformed() {
  const malformedDir = join(CONFORMANCE_DIR, 'tier-1-reader', 'malformed');
  if (!existsSync(malformedDir)) return;

  const fixtures = readdirSync(malformedDir)
    .filter((f) => f.endsWith('.uw.md'))
    .sort();

  for (const fixture of fixtures) {
    const id = fixture.replace(/\.uw\.md$/, '');
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
    const beforePath = join(dir, 'before.uw.md');
    const opPath = join(dir, 'operation.json');
    const afterPath = join(dir, 'after.uw.md');
    const ctxPath = join(dir, 'context.json');
    const optionsPath = join(dir, 'options.json');
    const expectedErrorPath = join(dir, 'expected-error.json');

    if (!existsSync(beforePath) || !existsSync(opPath)) {
      record('2', scenario, 'fail', 'missing before.uw.md or operation.json');
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
      record('2', scenario, 'fail', 'missing after.uw.md baseline');
    } else {
      const expected = stripVolatileFields(readFileSync(afterPath, 'utf8'));
      if (normalize(expected) === normalize(after)) {
        record('2', scenario, 'pass');
      } else {
        record('2', scenario, 'fail', 'output differs from after.uw.md (with volatile fields stripped)');
      }
    }
  }
}

// Strip timestamps and other run-time-volatile values so byte comparisons
// against the after.uw.md baseline are deterministic.
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
    const dealPath = join(dir, 'deal.uw.md');
    const calcPath = join(dir, 'calc.json');
    const expectedPath = join(dir, 'expected-result.json');

    if (!existsSync(dealPath) || !existsSync(calcPath)) {
      record('3', scenario, 'fail', 'missing deal.uw.md or calc.json');
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
// Each fixture lives in a directory with `deal.uw.md` and a sibling
// `expected-graph.json` declaring the canonical projection of
// `extractDependencyGraph(parsed)`. Only Map-typed fields are projected (sets
// become sorted arrays).

async function runTier3Refinement() {
  const baseDir = join(CONFORMANCE_DIR, 'tier-3-calc-host', 'refinement');
  if (!existsSync(baseDir)) return;
  const scenarios = readdirSync(baseDir).filter((d) => statSync(join(baseDir, d)).isDirectory());
  for (const scenario of scenarios) {
    const dir = join(baseDir, scenario);
    const dealPath = join(dir, 'deal.uw.md');
    const expectedPath = join(dir, 'expected-graph.json');
    if (!existsSync(dealPath)) {
      record('3-refinement', scenario, 'fail', 'missing deal.uw.md');
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
    const beforePath = join(dir, 'before.uw.md');
    const shapePath = join(dir, 'expected-after-shape.json');
    if (!existsSync(beforePath) || !existsSync(shapePath)) {
      record('4', scenario, 'fail', 'missing before.uw.md or expected-after-shape.json');
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

    let result;
    try {
      assertUWReceipt(receipt);
      result = await verifyReceipt(receipt, deal.source, { filename: deal.path });
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

// ─── Main ────────────────────────────────────────────────────────────────────

const dispatch = {
  '1': async () => { runTier1(); await runTier1Malformed(); },
  '2': async () => { await runTier2(); },
  '3': async () => { runTier3(); await runTier3Refinement(); },
  '4': async () => { runTier4(); await runTier4Profile(); },
  'lite': async () => { runLiteFixtures(); runLiteMalformed(); runLiteCompile(); runLiteEquivalence(); },
  'receipts': async () => { await runReceiptIssue(); await runReceiptVerify(); await runReceiptRefuse(); },
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
