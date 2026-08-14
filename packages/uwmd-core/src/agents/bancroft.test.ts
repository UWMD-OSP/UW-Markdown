// Bancroft runner tests — driven entirely through a fake provider.
//
// Before the provider seam existed this module could not be tested at all: it
// constructed an Anthropic client at the top of every run, so exercising it
// meant a network call and an API key. That is why `agents/` sat at 0% coverage.
//
// These tests use a hand-written `AgentProvider` — which is also the point of
// the refactor. If the runner can be driven to completion by ~20 lines of fake,
// the Tier-4 host is provider-neutral in fact.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBancroftAgent, runBancroftAgentStreaming } from './bancroft.js';
import { AgentProviderError, type AgentCompletion, type AgentProvider, type AgentRequest } from './provider.js';
import { parseUWFile } from '../parser.js';

const PARKVIEW = resolve(__dirname, '../../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');
const deal = () => readFileSync(PARKVIEW, 'utf8');

/** Records what it was asked, answers with whatever it was given. */
function fakeProvider(
  completion: AgentCompletion,
  opts: { id?: string; canStream?: boolean; failWith?: Error } = {},
): AgentProvider & { requests: AgentRequest[]; streamCalls: number } {
  const requests: AgentRequest[] = [];
  const provider = {
    id: opts.id ?? 'fake',
    requests,
    streamCalls: 0,
    async complete(request: AgentRequest) {
      requests.push(request);
      if (opts.failWith) throw opts.failWith;
      return completion;
    },
  } as AgentProvider & { requests: AgentRequest[]; streamCalls: number };

  if (opts.canStream !== false) {
    provider.stream = async (request: AgentRequest) => {
      provider.streamCalls++;
      requests.push(request);
      if (opts.failWith) throw opts.failWith;
      return completion;
    };
  }
  return provider;
}

function sectionCompletion(sectionId: string, data: Record<string, unknown>): AgentCompletion {
  return {
    tool_calls: [
      {
        name: 'write_uw_section',
        input: {
          section_id: sectionId,
          confidence: 'high',
          human_review_required: false,
          flags: [],
          section_data: data,
          notes: 'from a fake provider',
        },
      },
    ],
    usage: { input_tokens: 111, output_tokens: 222 },
  };
}

describe('bancroft — provider neutrality', () => {
  it('runs to completion against a provider that is not the vendor SDK', async () => {
    const provider = fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' }));

    const result = await runBancroftAgent(deal(), 'L6-01', { provider });

    expect(result.success).toBe(true);
    expect(result.sectionsWritten).toEqual(['risk_assessment']);
    expect(result.tokensUsed).toEqual({ input: 111, output: 222 });
    // The written block is real: it parses back out of the file.
    const written = parseUWFile(result.updatedContent).sections['risk_assessment'];
    expect(written).toBeDefined();
  });

  it('never loads the vendor SDK when a provider is supplied', async () => {
    // The load-bearing assertion. `bancroft.ts` must not import
    // @anthropic-ai/sdk statically — the default provider is behind a dynamic
    // import — or "bring your own backend" would still drag the SDK in.
    const source = readFileSync(resolve(__dirname, 'bancroft.ts'), 'utf8');
    const staticImport = /^\s*import\s+[^;]*from\s+['"]@anthropic-ai\/sdk['"]/m;
    expect(staticImport.test(source), 'bancroft.ts must not statically import the vendor SDK').toBe(
      false,
    );

    // schemas.ts is exported from index.ts, so its types must be neutral too.
    const schemas = readFileSync(resolve(__dirname, 'schemas.ts'), 'utf8');
    expect(schemas).not.toContain('@anthropic-ai/sdk');
  });

  it('passes the layer tool through to the provider unchanged', async () => {
    const provider = fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'low' }));
    await runBancroftAgent(deal(), 'L6-01', { provider, model: 'some-other-model', temperature: 0.4 });

    const [request] = provider.requests;
    expect(request.model).toBe('some-other-model');
    expect(request.temperature).toBe(0.4);
    expect(request.tool_choice).toBe('any');
    expect(request.tools.map((t) => t.name)).toEqual(['write_uw_section']);
    expect(request.system.length).toBeGreaterThan(0);
  });

  it('selects the multi-section tool for a multi-section layer', async () => {
    const provider = fakeProvider({ tool_calls: [], usage: { input_tokens: 1, output_tokens: 1 } });
    await runBancroftAgent(deal(), 'L4-01', { provider, maxRetries: 0 });
    expect(provider.requests[0]?.tools.map((t) => t.name)).toEqual(['write_multiple_uw_sections']);
  });

  it('requires either a provider or an apiKey', async () => {
    await expect(runBancroftAgent(deal(), 'L6-01', {})).rejects.toBeInstanceOf(AgentProviderError);
    await expect(runBancroftAgent(deal(), 'L6-01', {})).rejects.toMatchObject({
      code: 'AGENT_PROVIDER_MISSING',
    });
  });
});

describe('bancroft — failure handling is provider-agnostic', () => {
  it('retries when the model returns no tool call, then logs an error entry', async () => {
    const provider = fakeProvider({ tool_calls: [], usage: { input_tokens: 5, output_tokens: 5 } });

    const result = await runBancroftAgent(deal(), 'L6-01', { provider, maxRetries: 2 });

    expect(result.success).toBe(false);
    expect(result.retries).toBe(3); // initial attempt + 2 retries
    expect(provider.requests).toHaveLength(3);
    expect(result.error).toMatch(/did not call the write_uw_section tool/);
    // Usage still accrues across the failed attempts rather than being lost.
    expect(result.tokensUsed).toEqual({ input: 15, output: 15 });
  });

  it('surfaces a transport failure as a failed run, not a thrown error', async () => {
    const provider = fakeProvider(sectionCompletion('risk_assessment', {}), {
      failWith: new Error('upstream exploded'),
    });

    const result = await runBancroftAgent(deal(), 'L6-01', { provider, maxRetries: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('upstream exploded');
    expect(result.updatedContent).not.toBe('');
  });

  it('refuses to run when context is not ready, without calling the provider', async () => {
    const provider = fakeProvider(sectionCompletion('risk_assessment', {}));
    // A document with no sections cannot satisfy any layer's required reads.
    const empty = ['---', 'uw_version: "1.1"', 'deal_id: "x"', 'deal_name: "X"', 'asset_class: "multifamily"', '---', '# X'].join('\n');

    const result = await runBancroftAgent(empty, 'L6-01', { provider });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Context not ready/);
    expect(provider.requests).toHaveLength(0);
  });
});

describe('bancroft — streaming', () => {
  it('uses the provider stream when one is offered', async () => {
    const provider = fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' }));
    const result = await runBancroftAgentStreaming(deal(), 'L6-01', { provider });

    expect(result.success).toBe(true);
    expect(provider.streamCalls).toBe(1);
  });

  it('falls back to complete() for a provider that cannot stream', async () => {
    // Streaming is a latency optimisation. Refusing the run because a backend
    // lacks it would make the contract narrower than it needs to be.
    const provider = fakeProvider(
      sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' }),
      { canStream: false },
    );
    expect(provider.stream).toBeUndefined();

    const result = await runBancroftAgentStreaming(deal(), 'L6-01', { provider });

    expect(result.success).toBe(true);
    expect(provider.requests).toHaveLength(1);
  });
});

describe('bancroft — an injected clock makes a run reproducible', () => {
  // Without this, recorded replay cannot assert on a document at all: every run
  // differs in _meta.timestamp, duration_ms, and the random log-entry suffix.
  const FROZEN = Date.parse('2026-08-13T00:00:00.000Z');

  it('produces byte-identical output across runs', async () => {
    const run = () =>
      runBancroftAgent(deal(), 'L6-01', {
        provider: fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' })),
        now: () => FROZEN,
      });

    const [first, second] = [await run(), await run()];
    expect(first.updatedContent).toBe(second.updatedContent);
    expect(first.logEntryIds).toEqual(second.logEntryIds);
  });

  it('freezes the stamp and collapses the duration', async () => {
    const result = await runBancroftAgent(deal(), 'L6-01', {
      provider: fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' })),
      now: () => FROZEN,
    });

    const block = parseUWFile(result.updatedContent).sections['risk_assessment'];
    expect((block as { meta: Record<string, unknown> }).meta['timestamp']).toBe('2026-08-13T00:00:00.000Z');
    expect(result.durationMs).toBe(0);
  });

  it('leaves real runs non-frozen', async () => {
    // The default path must keep its random log-entry suffix, which is what
    // stops two runs in the same millisecond from colliding.
    const result = await runBancroftAgent(deal(), 'L6-01', {
      provider: fakeProvider(sectionCompletion('risk_assessment', { overall_risk_rating: 'moderate' })),
    });
    expect(result.logEntryIds[0]).toMatch(/^log_\d+_[a-z0-9]{4}$/);
  });
});

describe('bancroft — the host owns _meta', () => {
  it('strips any _meta and _notes the model tries to write', async () => {
    // Invariant 5: the host owns provenance. A model that returns its own _meta
    // must not be able to forge a timestamp, an actor, or a version.
    const provider = fakeProvider(
      sectionCompletion('risk_assessment', {
        overall_risk_rating: 'moderate',
        _meta: { actor: 'impostor', version: 99, timestamp: '1999-01-01T00:00:00Z' },
        _notes: 'model-supplied notes',
      }),
    );

    const result = await runBancroftAgent(deal(), 'L6-01', { provider });
    const block = parseUWFile(result.updatedContent).sections['risk_assessment'];
    const meta = (block as { meta: Record<string, unknown> }).meta;

    expect(meta['actor']).not.toBe('impostor');
    expect(meta['version']).not.toBe(99);
    expect(meta['timestamp']).not.toBe('1999-01-01T00:00:00Z');
    expect(meta['agent_id']).toBe('L6-01');
  });
});
