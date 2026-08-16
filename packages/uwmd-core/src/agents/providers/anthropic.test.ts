// Anthropic provider tests — the translation layer, not the network.
//
// This file is the only place a vendor response shape is asserted. If the SDK
// changes how a message or usage block is spelled, exactly one test fails and
// exactly one file needs editing — which is the point of isolating it.
//
// The client is injected, so nothing here opens a socket or needs an API key.

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { createAnthropicProvider } from './anthropic.js';
import { AgentProviderError, type AgentRequest } from '../provider.js';

const REQUEST: AgentRequest = {
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  temperature: 0.1,
  system: 'system prompt',
  messages: [{ role: 'user', content: 'user message' }],
  tools: [
    {
      name: 'write_uw_section',
      description: 'write it',
      input_schema: { type: 'object', properties: { section_id: { type: 'string' } } },
    },
  ],
  tool_choice: 'any',
};

/** A stand-in for the SDK client, typed loosely at the boundary. */
function fakeClient(message: unknown, opts: { throwOn?: 'create' | 'stream' } = {}) {
  const create = vi.fn(async () => {
    if (opts.throwOn === 'create') throw new Error('network down');
    return message;
  });
  const stream = vi.fn(() => {
    if (opts.throwOn === 'stream') throw new Error('stream broke');
    return { finalMessage: async () => message };
  });
  return { messages: { create, stream } } as unknown as Anthropic & {
    messages: { create: typeof create; stream: typeof stream };
  };
}

const MESSAGE = {
  content: [
    { type: 'text', text: 'thinking out loud' },
    { type: 'tool_use', name: 'write_uw_section', input: { section_id: 'risk_assessment' } },
  ],
  usage: { input_tokens: 42, output_tokens: 7 },
};

describe('createAnthropicProvider', () => {
  it('identifies itself as anthropic', () => {
    expect(createAnthropicProvider({ apiKey: 'k', client: fakeClient(MESSAGE) }).id).toBe('anthropic');
  });

  it('maps a neutral request onto the SDK call shape', async () => {
    const client = fakeClient(MESSAGE);
    await createAnthropicProvider({ apiKey: 'k', client }).complete(REQUEST);

    const sent = client.messages.create.mock.calls[0][0] as Record<string, unknown>;
    expect(sent['model']).toBe('claude-sonnet-4-6');
    expect(sent['max_tokens']).toBe(1024);
    expect(sent['temperature']).toBe(0.1);
    expect(sent['system']).toBe('system prompt');
    expect(sent['messages']).toEqual([{ role: 'user', content: 'user message' }]);
    // tool_choice is a bare string in our contract and an object in the SDK's.
    expect(sent['tool_choice']).toEqual({ type: 'any' });
  });

  it('extracts tool calls and drops non-tool content', async () => {
    const completion = await createAnthropicProvider({
      apiKey: 'k',
      client: fakeClient(MESSAGE),
    }).complete(REQUEST);

    // The text block must not survive: the runner reads tool calls only.
    expect(completion.tool_calls).toEqual([
      { name: 'write_uw_section', input: { section_id: 'risk_assessment' } },
    ]);
    expect(completion.usage).toEqual({ input_tokens: 42, output_tokens: 7 });
  });

  it('returns an empty tool-call list rather than throwing when the model only talked', async () => {
    // The runner treats "no tool call" as a retryable outcome, so the provider
    // must report it as data, not as an exception.
    const completion = await createAnthropicProvider({
      apiKey: 'k',
      client: fakeClient({ content: [{ type: 'text', text: 'no tools for me' }], usage: { input_tokens: 1, output_tokens: 2 } }),
    }).complete(REQUEST);

    expect(completion.tool_calls).toEqual([]);
    expect(completion.usage).toEqual({ input_tokens: 1, output_tokens: 2 });
  });

  it('wraps a transport failure in a typed AgentProviderError', async () => {
    const provider = createAnthropicProvider({ apiKey: 'k', client: fakeClient(MESSAGE, { throwOn: 'create' }) });

    await expect(provider.complete(REQUEST)).rejects.toBeInstanceOf(AgentProviderError);
    await expect(provider.complete(REQUEST)).rejects.toMatchObject({
      code: 'AGENT_PROVIDER_TRANSPORT',
      message: 'network down',
    });
  });

  it('streams through finalMessage() and maps it the same way', async () => {
    const provider = createAnthropicProvider({ apiKey: 'k', client: fakeClient(MESSAGE) });
    const completion = await provider.stream?.(REQUEST);

    expect(completion?.tool_calls).toHaveLength(1);
    expect(completion?.usage).toEqual({ input_tokens: 42, output_tokens: 7 });
  });

  it('does not load the vendor SDK until a request is sent', async () => {
    // The SDK is an optional peer dependency, so a host that supplies its own
    // client must be able to construct this provider in a process where
    // @anthropic-ai/sdk is not installed at all. Constructing it must therefore
    // touch neither the module registry nor the constructor.
    const source = readFileSync(new URL('./anthropic.ts', import.meta.url), 'utf8');
    const staticImport = /^\s*import\s+(?!type\b)[^;]*from\s+['"]@anthropic-ai\/sdk['"]/m;
    expect(
      staticImport.test(source),
      'anthropic.ts must import the vendor SDK dynamically, or a type-only import',
    ).toBe(false);

    // …and index.ts re-exports this factory statically, so a static import here
    // would pull the SDK in on `import '@uwmd/core'` for every consumer.
    const index = readFileSync(new URL('../../index.ts', import.meta.url), 'utf8');
    expect(index).toContain("export { createAnthropicProvider } from './agents/providers/anthropic.js'");
  });

  it('reports a missing SDK as a packaging error, not a transport failure', async () => {
    // No `client`, so the first request must resolve the SDK. The import is
    // stubbed to fail the way an uninstalled optional peer dependency does.
    vi.doMock('@anthropic-ai/sdk', () => {
      throw new Error("Cannot find package '@anthropic-ai/sdk'");
    });
    vi.resetModules();
    const { createAnthropicProvider: freshFactory } = await import('./anthropic.js');
    const provider = freshFactory({ apiKey: 'k' });

    await expect(provider.complete(REQUEST)).rejects.toMatchObject({
      code: 'AGENT_PROVIDER_SDK_MISSING',
    });
    vi.doUnmock('@anthropic-ai/sdk');
    vi.resetModules();
  });

  it('wraps a streaming failure in the same typed error', async () => {
    const provider = createAnthropicProvider({
      apiKey: 'k',
      client: fakeClient(MESSAGE, { throwOn: 'stream' }),
    });

    await expect(provider.stream?.(REQUEST)).rejects.toMatchObject({
      code: 'AGENT_PROVIDER_TRANSPORT',
    });
  });
});
