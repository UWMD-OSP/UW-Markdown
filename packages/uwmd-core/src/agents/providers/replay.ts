// Recorded-replay provider — deterministic Tier-4 runs with no network and no
// API key.
//
// Tier-4 conformance was shape-and-lint only: fixtures were parsed and their
// expected-shape JSON was validated, but no agent ever ran, so nothing checked
// that a host actually writes what the protocol says it writes. Live-LLM
// conformance is not an option — it is non-deterministic, costs money, and
// cannot run in CI.
//
// A cassette closes that gap. Record real exchanges once with
// `createRecordingProvider`, then replay them forever with
// `createReplayProvider`. The replayed run exercises the *whole* Tier-4 write
// path — context assembly, tool-call extraction, supersede semantics, `_meta`
// ownership, pipeline-log append — against a frozen expected document.
//
// The interesting property is that replay is **strict**: each exchange records
// the request it answered, and a replay whose request differs is a typed error
// rather than a silently wrong answer. So a cassette does double duty as a
// prompt-drift detector — change `buildAgentPrompt` and the cassettes tell you,
// instead of a stale recording quietly answering a question nobody asked.
//
// No vendor SDK, no node built-ins: this file is safe wherever core runs.

import { canonicalizeExact } from '../../integrity-canonical.js';
import {
  AgentProviderError,
  type AgentCompletion,
  type AgentProvider,
  type AgentRequest,
} from '../provider.js';

export const CASSETTE_VERSION = '1.0' as const;

export interface RecordedExchange {
  /** The request this exchange answers. Compared canonically on replay. */
  request: AgentRequest;
  completion: AgentCompletion;
}

export interface AgentCassette {
  cassette_version: typeof CASSETTE_VERSION;
  /** Which provider produced the recording, e.g. `anthropic`. */
  recorded_from: string;
  /** ISO-8601. Informational — replay never reads it. */
  recorded_at: string;
  exchanges: RecordedExchange[];
}

/**
 * Which parts of a request must match for a cassette to be considered current.
 *
 * `max_tokens` and `temperature` are deliberately excluded: they change the
 * sampling budget, not the question, and pinning them would force a re-record
 * for a knob that does not alter what the model was asked. Everything that
 * changes the *question* — model, system prompt, messages, tool schemas,
 * tool_choice — is compared.
 */
function comparableRequest(request: AgentRequest): unknown {
  return {
    model: request.model,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
    tool_choice: request.tool_choice,
  };
}

/** Stable fingerprint of a request, used for comparison and error messages. */
export function agentRequestFingerprint(request: AgentRequest): string {
  return canonicalizeExact(comparableRequest(request));
}

/**
 * Replay a cassette. Exchanges are consumed in order: the Nth call must match
 * the Nth recording.
 *
 * Sequential rather than keyed matching is deliberate. A keyed cassette would
 * happily answer a *reordered* run, hiding a change in how many calls a layer
 * makes or in what order — which is exactly the kind of regression a Tier-4
 * conformance suite exists to catch.
 */
export function createReplayProvider(cassette: AgentCassette): AgentProvider {
  if (cassette.cassette_version !== CASSETTE_VERSION) {
    throw new AgentProviderError(
      'AGENT_PROVIDER_REPLAY',
      `Unsupported cassette_version "${cassette.cassette_version}" (expected ${CASSETTE_VERSION}).`,
    );
  }

  let cursor = 0;

  const next = (request: AgentRequest): AgentCompletion => {
    const exchange = cassette.exchanges[cursor];
    if (!exchange) {
      throw new AgentProviderError(
        'AGENT_PROVIDER_REPLAY',
        `Cassette exhausted: the run asked for exchange ${cursor + 1} but only ${cassette.exchanges.length} were recorded. The run makes more provider calls than when it was recorded — re-record the cassette.`,
      );
    }

    const expected = agentRequestFingerprint(exchange.request);
    const actual = agentRequestFingerprint(request);
    if (expected !== actual) {
      throw new AgentProviderError(
        'AGENT_PROVIDER_REPLAY',
        `Cassette is stale at exchange ${cursor + 1}: the request no longer matches what was recorded ` +
          `(${describeDrift(exchange.request, request)}). Re-record the cassette.`,
      );
    }

    cursor++;
    return exchange.completion;
  };

  return {
    id: 'replay',
    async complete(request) {
      return next(request);
    },
    async stream(request) {
      // A cassette has no notion of streaming; the final message is all that
      // was ever recorded, and it is what the runner consumes.
      return next(request);
    },
  };
}

/** Name the fields that differ, so a stale cassette says *what* changed. */
function describeDrift(recorded: AgentRequest, actual: AgentRequest): string {
  const fields: (keyof ReturnType<typeof asRecord>)[] = [
    'model',
    'system',
    'messages',
    'tools',
    'tool_choice',
  ];
  const a = asRecord(recorded);
  const b = asRecord(actual);
  const changed = fields.filter((f) => canonicalizeExact(a[f]) !== canonicalizeExact(b[f]));
  return changed.length ? `changed: ${changed.join(', ')}` : 'no field-level difference found';
}

function asRecord(request: AgentRequest) {
  return {
    model: request.model as unknown,
    system: request.system as unknown,
    messages: request.messages as unknown,
    tools: request.tools as unknown,
    tool_choice: request.tool_choice as unknown,
  };
}

export interface RecordingProvider extends AgentProvider {
  /** The cassette captured so far. Safe to call mid-run. */
  cassette(): AgentCassette;
}

/**
 * Wrap a live provider and capture every exchange.
 *
 * Intended for an operator running once against a real backend to refresh a
 * fixture — never for CI, which has no key and must not make network calls.
 *
 * `recordedAt` is injectable so a re-recording produces a stable file rather
 * than a spurious one-line diff on every run.
 */
export function createRecordingProvider(
  inner: AgentProvider,
  opts: { recordedAt?: string } = {},
): RecordingProvider {
  const exchanges: RecordedExchange[] = [];

  const capture = async (
    request: AgentRequest,
    call: (r: AgentRequest) => Promise<AgentCompletion>,
  ): Promise<AgentCompletion> => {
    const completion = await call(request);
    exchanges.push({ request, completion });
    return completion;
  };

  return {
    id: `recording:${inner.id}`,
    complete: (request) => capture(request, (r) => inner.complete(r)),
    stream: (request) =>
      capture(request, (r) => (inner.stream ? inner.stream(r) : inner.complete(r))),
    cassette: () => ({
      cassette_version: CASSETTE_VERSION,
      recorded_from: inner.id,
      recorded_at: opts.recordedAt ?? new Date().toISOString(),
      exchanges,
    }),
  };
}

/** Parse and validate a cassette read from disk. */
export function parseAgentCassette(raw: string): AgentCassette {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new AgentProviderError('AGENT_PROVIDER_REPLAY', 'Cassette is not valid JSON.', err);
  }

  const c = value as Partial<AgentCassette>;
  if (c?.cassette_version !== CASSETTE_VERSION) {
    throw new AgentProviderError(
      'AGENT_PROVIDER_REPLAY',
      `Cassette is missing or has an unsupported cassette_version (expected ${CASSETTE_VERSION}).`,
    );
  }
  if (!Array.isArray(c.exchanges) || c.exchanges.length === 0) {
    throw new AgentProviderError(
      'AGENT_PROVIDER_REPLAY',
      'Cassette must contain a non-empty exchanges array.',
    );
  }
  for (const [i, exchange] of c.exchanges.entries()) {
    if (!exchange?.request || !exchange?.completion) {
      throw new AgentProviderError(
        'AGENT_PROVIDER_REPLAY',
        `Cassette exchange ${i + 1} is missing its request or completion.`,
      );
    }
  }
  return c as AgentCassette;
}
