#!/usr/bin/env node
// Regenerate conformance expected/ outputs. Run from repo root:
// `node scripts/regen-conformance.mjs`.
//
// This delegates to the conformance runner's own `--update` mode, so the
// regenerated baselines are byte-identical to what the runner compares. An
// earlier version of this script re-implemented Tier-1 generation with its
// own (divergent) canonicalization and knew nothing about the other suites —
// running it would have clobbered baselines in a shape the runner rejects.
//
// If this script changes any expected output, that's a normative change to
// the protocol — call it out in the PR and bump the protocol version.

import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const result = spawnSync(
  process.execPath,
  [join(__dirname, 'run-conformance.mjs'), '--update', ...process.argv.slice(2)],
  { cwd: repoRoot, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
