// Recorded-replay provider tests.
//
// The properties worth pinning are the strict ones. A permissive cassette —
// one that answers whatever it is asked — would make Tier-4 conformance look
// green while proving nothing, which is the failure mode this whole mechanism
// exists to avoid.

import { describe, expect, it } from 'vitest';
import {
  CASSETTE_VERSION,
  agentRequestFingerprint,
  createRecordingProvider,
  createReplayProvider,
  parseAgentCassette,
  type AgentCassette,
} from './replay.js';
import { AgentProviderError, type AgentCompletion, type AgentProvider, type AgentRequest } from '../provider.js';

const REQUEST: AgentRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  temperature: 0.1,
  system: 'you are an underwriter',
  messages: [{ role: 'user', content: 'assess this deal' }],
  tools: [{ name: 'write_uw_section', description: 'write', input_schema: { type: 'object', properties: {} } }],
  tool_choice: 'any',
};

const COMPLETION: AgentCompletion = {
  tool_calls: [{ name: 'write_uw_section', input: { section_id: 'risk_assessment' } }],
  usage: { input_tokens: 10, output_tokens: 20 },
};

function cassette(exchanges: { request: AgentRequest; completion: AgentCompletion }[]): AgentCassette {
  return {
    cassette_version: CASSETTE_VERSION,
    recorded_from: 'anthropic',
    recorded_at: '2026-08-13T00:00:00.000Z',
    exchanges,
  };
}

describe('replay provider', () => {
  it('returns the recorded completion for a matching request', async () => {
    const provider = createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }]));
    await expect(provider.complete(REQUEST)).resolves.toEqual(COMPLETION);
  });

  it('identifies itself as replay, never as the recorded backend', async () => {
    // A replayed run must not be mistakable for a live one in logs or receipts.
    expect(createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }])).id).toBe('replay');
  });

  it('consumes exchanges in order', async () => {
    const second: AgentCompletion = { ...COMPLETION, usage: { input_tokens: 1, output_tokens: 2 } };
    const secondRequest = { ...REQUEST, messages: [{ role: 'user' as const, content: 'second turn' }] };
    const provider = createReplayProvider(
      cassette([
        { request: REQUEST, completion: COMPLETION },
        { request: secondRequest, completion: second },
      ]),
    );

    await expect(provider.complete(REQUEST)).resolves.toEqual(COMPLETION);
    await expect(provider.complete(secondRequest)).resolves.toEqual(second);
  });

  it('rejects a reordered run rather than answering it', async () => {
    // Sequential matching is the point: a keyed cassette would happily serve a
    // reordered run and hide a change in call order.
    const secondRequest = { ...REQUEST, messages: [{ role: 'user' as const, content: 'second turn' }] };
    const provider = createReplayProvider(
      cassette([
        { request: REQUEST, completion: COMPLETION },
        { request: secondRequest, completion: COMPLETION },
      ]),
    );

    await expect(provider.complete(secondRequest)).rejects.toMatchObject({
      code: 'AGENT_PROVIDER_REPLAY',
    });
  });

  it('detects prompt drift and names the field that changed', async () => {
    // The dual-purpose property: a cassette is also a prompt-drift detector.
    const provider = createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }]));
    const drifted = { ...REQUEST, system: 'you are a slightly different underwriter' };

    await expect(provider.complete(drifted)).rejects.toThrow(/stale.*changed: system/s);
  });

  it('ignores sampling knobs that do not change the question', async () => {
    // max_tokens and temperature alter the budget, not what was asked. Pinning
    // them would force a re-record for a knob with no bearing on the exchange.
    const provider = createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }]));
    const retuned = { ...REQUEST, max_tokens: 8192, temperature: 0.7 };

    await expect(provider.complete(retuned)).resolves.toEqual(COMPLETION);
  });

  it('reports exhaustion distinctly from drift', async () => {
    const provider = createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }]));
    await provider.complete(REQUEST);

    await expect(provider.complete(REQUEST)).rejects.toThrow(/exhausted.*only 1 were recorded/s);
  });

  it('streams from the same tape as complete()', async () => {
    const provider = createReplayProvider(cassette([{ request: REQUEST, completion: COMPLETION }]));
    await expect(provider.stream?.(REQUEST)).resolves.toEqual(COMPLETION);
  });

  it('refuses an unsupported cassette version', () => {
    const bad = { ...cassette([{ request: REQUEST, completion: COMPLETION }]), cassette_version: '2.0' };
    expect(() => createReplayProvider(bad as unknown as AgentCassette)).toThrow(AgentProviderError);
  });
});

describe('recording provider', () => {
  const backend: AgentProvider = {
    id: 'anthropic',
    async complete() {
      return COMPLETION;
    },
  };

  it('captures each exchange and records which backend produced it', async () => {
    const recorder = createRecordingProvider(backend, { recordedAt: '2026-08-13T00:00:00.000Z' });
    await recorder.complete(REQUEST);

    const tape = recorder.cassette();
    expect(tape.cassette_version).toBe(CASSETTE_VERSION);
    expect(tape.recorded_from).toBe('anthropic');
    expect(tape.recorded_at).toBe('2026-08-13T00:00:00.000Z');
    expect(tape.exchanges).toHaveLength(1);
    expect(tape.exchanges[0]?.completion).toEqual(COMPLETION);
  });

  it('marks itself as a recording wrapper', () => {
    expect(createRecordingProvider(backend).id).toBe('recording:anthropic');
  });

  it('produces a cassette that replays cleanly — the round trip', async () => {
    // The contract that matters end to end: whatever recording captures,
    // replay must accept.
    const recorder = createRecordingProvider(backend, { recordedAt: '2026-08-13T00:00:00.000Z' });
    await recorder.complete(REQUEST);

    const replay = createReplayProvider(recorder.cassette());
    await expect(replay.complete(REQUEST)).resolves.toEqual(COMPLETION);
  });

  it('falls back to complete() when the wrapped backend cannot stream', async () => {
    const recorder = createRecordingProvider(backend);
    await expect(recorder.stream?.(REQUEST)).resolves.toEqual(COMPLETION);
    expect(recorder.cassette().exchanges).toHaveLength(1);
  });
});

describe('parseAgentCassette', () => {
  it('accepts a well-formed cassette', () => {
    const raw = JSON.stringify(cassette([{ request: REQUEST, completion: COMPLETION }]));
    expect(parseAgentCassette(raw).exchanges).toHaveLength(1);
  });

  it('rejects malformed JSON, a bad version, an empty tape, and a partial exchange', () => {
    expect(() => parseAgentCassette('{not json')).toThrow(AgentProviderError);
    expect(() => parseAgentCassette(JSON.stringify({ cassette_version: '9.9', exchanges: [] }))).toThrow(
      /unsupported cassette_version/i,
    );
    expect(() =>
      parseAgentCassette(JSON.stringify({ ...cassette([]), exchanges: [] })),
    ).toThrow(/non-empty exchanges/i);
    expect(() =>
      parseAgentCassette(
        JSON.stringify({ ...cassette([]), exchanges: [{ request: REQUEST }] }),
      ),
    ).toThrow(/missing its request or completion/i);
  });
});

describe('agentRequestFingerprint', () => {
  it('is stable across key order and blind to sampling knobs', () => {
    const reordered: AgentRequest = {
      tool_choice: 'any',
      tools: REQUEST.tools,
      messages: REQUEST.messages,
      system: REQUEST.system,
      temperature: 0.9,
      max_tokens: 99,
      model: REQUEST.model,
    };
    expect(agentRequestFingerprint(reordered)).toBe(agentRequestFingerprint(REQUEST));
  });

  it('changes when the question changes', () => {
    expect(agentRequestFingerprint({ ...REQUEST, model: 'other-model' })).not.toBe(
      agentRequestFingerprint(REQUEST),
    );
  });
});
