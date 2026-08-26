#!/usr/bin/env node
// Re-record every tier-4 replay cassette from its scripted completion.
//
// Each scenario under conformance/tier-4-agent-host/replay/ carries a
// scripted-completion.json — the model's side of the exchange. This script
// replays the real runner against a scripted backend through the real
// createRecordingProvider (the recipe the replay README documents inline)
// and rewrites cassette.json with the freshly captured request.
//
// Run it when a deliberate change to context assembly (a new validator code,
// a prompt edit, a section added to a consumed profile) makes replay fail
// with "the request no longer matches what was recorded". That failure is
// the prompt-drift detector doing its job; this script is the acknowledged
// re-record, and the cassette diff in review is the record of what drifted.
// After re-recording, refresh the document baseline:
//   npm run conformance -- --tier=4-replay --update
//
// recorded_at is pinned to the replay clock so a re-record is a stable file,
// not a spurious one-line diff.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runBancroftAgent,
  createRecordingProvider,
} from '../packages/uwmd-core/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPLAY_DIR = join(ROOT, 'conformance', 'tier-4-agent-host', 'replay');
// Must match REPLAY_CLOCK in run-conformance.mjs.
const REPLAY_CLOCK_ISO = '2026-08-13T00:00:00.000Z';
const REPLAY_CLOCK = Date.parse(REPLAY_CLOCK_ISO);

const scenarios = readdirSync(REPLAY_DIR).filter((d) => statSync(join(REPLAY_DIR, d)).isDirectory());
let failures = 0;

for (const scenario of scenarios) {
  const dir = join(REPLAY_DIR, scenario);
  const scriptedPath = join(dir, 'scripted-completion.json');
  if (!existsSync(scriptedPath)) {
    console.log(`skip ${scenario} — no scripted-completion.json (live-recorded cassette?)`);
    continue;
  }
  const meta = JSON.parse(readFileSync(join(dir, 'scenario.json'), 'utf8'));
  const before = readFileSync(join(dir, 'before.uwx.md'), 'utf8');
  const scripted = JSON.parse(readFileSync(scriptedPath, 'utf8'));

  const backend = {
    id: 'scripted',
    complete: async () => ({
      tool_calls: scripted.tool_calls,
      usage: scripted.usage ?? { input_tokens: 0, output_tokens: 0 },
    }),
  };
  const recorder = createRecordingProvider(backend, { recordedAt: REPLAY_CLOCK_ISO });

  const result = await runBancroftAgent(before, meta.agent_id, {
    provider: recorder,
    now: () => REPLAY_CLOCK,
  });
  if (!result.success) {
    console.error(`FAIL ${scenario} — run failed: ${result.error}`);
    failures++;
    continue;
  }

  writeFileSync(join(dir, 'cassette.json'), `${JSON.stringify(recorder.cassette(), null, 2)}\n`);
  console.log(`re-recorded ${scenario} (${recorder.cassette().exchanges.length} exchange(s))`);
}

process.exit(failures > 0 ? 1 : 0);
