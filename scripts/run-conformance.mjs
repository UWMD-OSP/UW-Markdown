#!/usr/bin/env node
// Conformance runner — exercises every fixture against the @uwmd/core
// reference library and reports pass/fail per scenario.
//
// Usage:
//   node scripts/run-conformance.mjs [--tier=1,2,3,4] [--update] [--json]
//
//   --tier=...   Comma-separated tier numbers to run. Default: 1,2,3.
//                Tier 4 requires --tier=4 explicitly because it is shape-only
//                and assumes a deterministic-replay scenario; live LLM calls
//                are out of scope for CI.
//   --update     Regenerate expected/* files from current library output.
//                Use carefully — this overwrites the baseline.
//   --json       Emit machine-readable JSON summary to stdout.
//
// Exit codes: 0 = all passed, 1 = at least one failure.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const TIERS = (flagVal('tier') ?? '1,2,3').split(',').map((s) => s.trim()).filter(Boolean);
const UPDATE = flag('update');
const JSON_OUT = flag('json');

// ─── Result accumulator ───────────────────────────────────────────────────────

const results = []; // { tier, scenario, status: 'pass'|'fail'|'updated', message?: string }

function record(tier, scenario, status, message) {
  results.push({ tier, scenario, status, ...(message ? { message } : {}) });
  if (!JSON_OUT) {
    const tag = status === 'pass' ? 'PASS' : status === 'updated' ? 'UPDT' : 'FAIL';
    const symbol = status === 'pass' ? ' ✓' : status === 'updated' ? ' ↻' : ' ✗';
    console.log(`[${tag}]${symbol} tier-${tier}/${scenario}${message ? ` — ${message}` : ''}`);
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

// ─── Main ────────────────────────────────────────────────────────────────────

const dispatch = {
  '1': async () => { runTier1(); await runTier1Malformed(); },
  '2': async () => { await runTier2(); },
  '3': async () => { runTier3(); await runTier3Refinement(); },
  '4': async () => { runTier4(); await runTier4Profile(); },
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
