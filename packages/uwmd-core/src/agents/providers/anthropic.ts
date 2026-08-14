// The Anthropic provider — the reference implementation of `AgentProvider`.
//
// **This is the only file in the library that imports `@anthropic-ai/sdk`.**
// Keeping the dependency here is what makes the Tier-4 host provider-neutral in
// fact rather than in claim: `bancroft.ts` reaches this module through a
// dynamic import, so a host that supplies its own provider never loads the SDK
// at all. `agents/bancroft.test.ts` asserts that property directly.
//
// The layering rule from CLAUDE.md still applies: nothing re-exported by
// `browser.ts` may reach this file.

import Anthropic from '@anthropic-ai/sdk';
import {
  AgentProviderError,
  type AgentCompletion,
  type AgentProvider,
  type AgentRequest,
} from '../provider.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  /**
   * Inject a pre-built client — a custom base URL, a gateway, a proxy with
   * different retry behaviour. Tests use it to avoid constructing a real one.
   */
  client?: Anthropic;
}

/**
 * Translate a neutral `AgentRequest` into an SDK call and the SDK's reply back
 * into an `AgentCompletion`.
 *
 * The translation is deliberately total: everything the runner reads — tool
 * calls and token usage — is mapped explicitly, so a change in the SDK's
 * message shape surfaces here and nowhere else.
 */
export function createAnthropicProvider(opts: AnthropicProviderOptions): AgentProvider {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });

  const toSdkRequest = (request: AgentRequest) => ({
    model: request.model,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    system: request.system,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    // Our AgentToolSchema is the JSON-Schema subset the SDK's Tool expects.
    tools: request.tools as unknown as Anthropic.Tool[],
    tool_choice: { type: request.tool_choice } as Anthropic.ToolChoice,
  });

  const fromSdkMessage = (message: Anthropic.Message): AgentCompletion => ({
    tool_calls: message.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map((block) => ({ name: block.name, input: block.input as Record<string, unknown> })),
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  });

  return {
    id: 'anthropic',

    async complete(request) {
      try {
        return fromSdkMessage(await client.messages.create(toSdkRequest(request)));
      } catch (err) {
        throw new AgentProviderError(
          'AGENT_PROVIDER_TRANSPORT',
          err instanceof Error ? err.message : String(err),
          err,
        );
      }
    },

    async stream(request) {
      try {
        const stream = client.messages.stream(toSdkRequest(request));
        return fromSdkMessage(await stream.finalMessage());
      } catch (err) {
        throw new AgentProviderError(
          'AGENT_PROVIDER_TRANSPORT',
          err instanceof Error ? err.message : String(err),
          err,
        );
      }
    },
  };
}
