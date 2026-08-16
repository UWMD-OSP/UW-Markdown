// The agent-provider contract — the narrow waist between the Bancroft runner
// and whatever model actually answers.
//
// Protocol §IX describes a Tier-4 host as provider-neutral. Until this file
// existed that was an aspiration: `bancroft.ts` imported `@anthropic-ai/sdk`
// directly, so "provider-neutral" could not be demonstrated, let alone tested.
//
// Everything a provider needs is here, and **nothing in this file imports a
// vendor SDK**. A host can implement `AgentProvider` against any backend — a
// different vendor, a local model, a gateway, or a recorded cassette (see
// `providers/replay.ts`) — without touching the runner.
//
// The types mirror the shape of a tool-calling chat request rather than any one
// vendor's spelling of it. They are deliberately snake_case, matching
// `ToolOutput` in `schemas.ts`, because they describe a wire payload rather
// than a TypeScript options bag.

/**
 * A tool the model may call. Structurally the JSON-Schema subset every
 * tool-calling API accepts, so a provider can usually pass it through with a
 * cast rather than a translation.
 */
export interface AgentToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: AgentMessage[];
  tools: AgentToolSchema[];
  /** `any` forces some tool call; `auto` lets the model decide. */
  tool_choice: 'any' | 'auto';
}

export interface AgentToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * What the runner needs back. Deliberately *not* the vendor's message object:
 * the runner only ever reads tool calls and token usage, so widening this to
 * carry a raw response would re-couple it to a vendor's response shape.
 */
export interface AgentCompletion {
  tool_calls: AgentToolCall[];
  usage: { input_tokens: number; output_tokens: number };
}

export interface AgentProvider {
  /** Stable identifier, e.g. `anthropic` or `replay`. Recorded in cassettes. */
  readonly id: string;
  complete(request: AgentRequest): Promise<AgentCompletion>;
  /**
   * Optional streaming variant. A provider that cannot stream omits it, and
   * `runBancroftAgentStreaming` falls back to `complete()` rather than failing —
   * streaming is a latency optimisation, not a semantic difference.
   */
  stream?(request: AgentRequest): Promise<AgentCompletion>;
}

/** Typed error for provider selection and transport failures. */
export class AgentProviderError extends Error {
  constructor(
    readonly code:
      | 'AGENT_PROVIDER_MISSING'
      | 'AGENT_PROVIDER_SDK_MISSING'
      | 'AGENT_PROVIDER_TRANSPORT'
      | 'AGENT_PROVIDER_REPLAY',
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentProviderError';
  }
}
