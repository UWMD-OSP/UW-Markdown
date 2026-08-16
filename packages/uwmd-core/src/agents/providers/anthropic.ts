// The Anthropic provider — the reference implementation of `AgentProvider`.
//
// **This is the only file in the library that touches `@anthropic-ai/sdk`, and
// it touches it only at runtime.** The SDK is an optional peer dependency: a
// host that brings its own provider, or uses none, must not be made to install
// a vendor SDK to get a parser. So the import here is dynamic and deferred to
// the first request — `index.ts` re-exports this module's factory statically,
// and a static SDK import would make merely importing `@uwmd/core` load the
// vendor SDK, defeating the dynamic import in `bancroft.ts`.
//
// The type import below is erased at compile time and costs a consumer nothing
// at runtime.
//
// The layering rule from CLAUDE.md still applies: nothing re-exported by
// `browser.ts` may reach this file.

import type Anthropic from '@anthropic-ai/sdk';
import {
  AgentProviderError,
  type AgentCompletion,
  type AgentProvider,
  type AgentRequest,
} from '../provider.js';

type AnthropicConstructor = typeof import('@anthropic-ai/sdk').default;

/**
 * Load the vendor SDK, once, on demand. An absent SDK is a packaging problem
 * with a one-line fix, so it gets its own code and says so — rather than
 * surfacing as a module-resolution stack trace from inside a provider call.
 */
let sdk: Promise<AnthropicConstructor> | undefined;
async function loadSdk(): Promise<AnthropicConstructor> {
  sdk ??= import('@anthropic-ai/sdk')
    .then((mod) => mod.default)
    .catch((err) => {
      // Do not cache the failure: an install can fix it without a restart.
      sdk = undefined;
      throw new AgentProviderError(
        'AGENT_PROVIDER_SDK_MISSING',
        'The Anthropic provider requires the optional peer dependency ' +
          '@anthropic-ai/sdk. Install it, or pass your own `provider` ' +
          'implementing AgentProvider.',
        err,
      );
    });
  return sdk;
}

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
  // Constructing the client is what needs the SDK, so it happens on the first
  // request rather than here. `createAnthropicProvider()` stays synchronous and
  // stays callable in a process that never sends one.
  let pending: Promise<Anthropic> | undefined;
  const getClient = async (): Promise<Anthropic> => {
    if (opts.client) return opts.client;
    pending ??= loadSdk().then((Ctor) => new Ctor({ apiKey: opts.apiKey }));
    return pending;
  };

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
        const client = await getClient();
        return fromSdkMessage(await client.messages.create(toSdkRequest(request)));
      } catch (err) {
        // A missing SDK is not a transport failure and must not be relabelled
        // as one — the fix is an install, not a retry.
        if (err instanceof AgentProviderError) throw err;
        throw new AgentProviderError(
          'AGENT_PROVIDER_TRANSPORT',
          err instanceof Error ? err.message : String(err),
          err,
        );
      }
    },

    async stream(request) {
      try {
        const client = await getClient();
        const stream = client.messages.stream(toSdkRequest(request));
        return fromSdkMessage(await stream.finalMessage());
      } catch (err) {
        // A missing SDK is not a transport failure and must not be relabelled
        // as one — the fix is an install, not a retry.
        if (err instanceof AgentProviderError) throw err;
        throw new AgentProviderError(
          'AGENT_PROVIDER_TRANSPORT',
          err instanceof Error ? err.message : String(err),
          err,
        );
      }
    },
  };
}
