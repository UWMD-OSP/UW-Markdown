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
  evaluateCalc,
  render,
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
    console.log(`[${tag}]${symbol} tier-${tier}/${scenario}${message ? ' — ' + message : ''}`);
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
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd() + '\n';
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
    const actualParsedStr = JSON.stringify(actualParsed, null, 2) + '\n';
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
        writeFileSync(expectedPath, renderedText.trimEnd() + '\n');
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

// ─── Tier 2: Editor ──────────────────────────────────────────────────────────

function runTier2() {
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

    if (!existsSync(beforePath) || !existsSync(opPath)) {
      record('2', scenario, 'fail', 'missing before.uw.md or operation.json');
      continue;
    }

    const beforeContent = readFileSync(beforePath, 'utf8');
    const op = JSON.parse(readFileSync(opPath, 'utf8'));
    const ctx = existsSync(ctxPath)
      ? JSON.parse(readFileSync(ctxPath, 'utf8'))
      : { actor: 'conformance', source: 'manual' };

    const parsed = parseUWFile(beforeContent);
    const result = applyEdit(beforeContent, parsed, op, ctx);
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
    .replace(/ts=\S+/g, 'ts=<volatile>');
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
    const projectedStr = JSON.stringify(projected, null, 2) + '\n';

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

const dispatch = { '1': runTier1, '2': runTier2, '3': runTier3, '4': runTier4 };
for (const t of TIERS) {
  if (!dispatch[t]) {
    console.error(`Unknown tier: ${t}`);
    process.exit(2);
  }
  dispatch[t]();
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
