// Bancroft agent runner — asks a model for structured section output and writes
// it back to the deal file.
//
// Flow:
//   1. Build curated context for the requested agent layer
//   2. Ask the provider for a completion, with the structured-output tool
//   3. Parse the tool call into section content
//   4. Write each output section via writeAgentBlock (supersedes prior versions)
//   5. Return the updated file content + run metadata
//
// Uses tool calling for guaranteed JSON output. The model must call
// write_uw_section (or write_multiple_uw_sections for multi-section layers);
// if it doesn't, we retry up to maxRetries before writing an error log entry.
//
// **This module does not import a vendor SDK.** The default Anthropic provider
// is loaded through a dynamic import only when no `provider` is supplied, so a
// host that brings its own never pulls the SDK into its graph. `bancroft.test.ts`
// asserts the absence of a static import, because "provider-neutral" is a claim
// worth testing rather than trusting.

import type { ParsedUWFile } from '../types.js';
import { parseUWFile } from '../parser.js';
import { writeAgentBlock, writeErrorEntry, buildMeta } from '../runner.js';
import { buildAgentContext, buildAgentPrompt, isContextReady, BANCROFT_LAYERS } from '../context.js';
import {
  WRITE_UW_SECTION_TOOL,
  WRITE_MULTIPLE_SECTIONS_TOOL,
  MULTI_SECTION_LAYERS,
  type ToolOutput,
} from './schemas.js';
import {
  AgentProviderError,
  type AgentCompletion,
  type AgentProvider,
  type AgentRequest,
} from './provider.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BancroftRunOptions {
  /**
   * API key for the built-in Anthropic provider. Ignored when `provider` is
   * supplied. Optional so a host can run entirely on its own backend — but one
   * of the two MUST be present.
   */
  apiKey?: string;
  /**
   * Bring your own backend: another vendor, a local model, a gateway, or a
   * recorded cassette. When set, no vendor SDK is loaded.
   */
  provider?: AgentProvider;
  model?: string;
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
  userInstructions?: string;
  /** Called on each status update during the run */
  onProgress?: (event: ProgressEvent) => void;
  /**
   * Injectable clock, defaulting to `Date.now`. Supplying a **constant** clock
   * makes a run byte-reproducible: `_meta.timestamp` freezes, `duration_ms`
   * collapses to 0, and the pipeline-log entry id becomes derivable instead of
   * random. That is what lets a replayed run be compared against a frozen
   * expected document (see `providers/replay.ts`).
   *
   * Real runs should leave it unset.
   */
  now?: () => number;
}

/**
 * Resolve the provider for a run: an explicit one wins, otherwise the built-in
 * Anthropic provider is loaded lazily from an API key.
 */
async function resolveProvider(opts: BancroftRunOptions): Promise<AgentProvider> {
  if (opts.provider) return opts.provider;
  if (!opts.apiKey) {
    throw new AgentProviderError(
      'AGENT_PROVIDER_MISSING',
      'runBancroftAgent requires either `provider` or `apiKey`.',
    );
  }
  const { createAnthropicProvider } = await import('./providers/anthropic.js');
  return createAnthropicProvider({ apiKey: opts.apiKey });
}

/** Assemble the neutral request shared by the buffered and streaming paths. */
function buildRequest(
  opts: BancroftRunOptions,
  model: string,
  systemPrompt: string,
  userMessage: string,
  isMultiSection: boolean,
): AgentRequest {
  return {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.1,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: isMultiSection ? [WRITE_MULTIPLE_SECTIONS_TOOL] : [WRITE_UW_SECTION_TOOL],
    tool_choice: 'any',
  };
}

export interface ProgressEvent {
  stage: 'context_built' | 'calling_claude' | 'parsing_output' | 'writing_block' | 'complete' | 'error';
  message: string;
  agentId: string;
  sectionId?: string;
}

export interface BancroftRunResult {
  success: boolean;
  updatedContent: string;
  sectionsWritten: string[];
  tokensUsed: { input: number; output: number };
  durationMs: number;
  logEntryIds: string[];
  error?: string;
  retries: number;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runBancroftAgent(
  fileContent: string,
  agentId: string,
  opts: BancroftRunOptions,
): Promise<BancroftRunResult> {
  const startMs = (opts.now ?? Date.now)();
  const model = opts.model ?? 'claude-sonnet-4-6';
  const maxRetries = opts.maxRetries ?? 2;
  const emit = opts.onProgress ?? (() => undefined);

  const provider = await resolveProvider(opts);
  const layerPrefix = agentId.match(/^(L\d+)/)?.[1] ?? 'L7';
  const isMultiSection = MULTI_SECTION_LAYERS.has(layerPrefix);
  const toolName = isMultiSection ? 'write_multiple_uw_sections' : 'write_uw_section';

  let currentContent = fileContent;
  const currentParsed = parseUWFile(fileContent);

  // ── Context check ──────────────────────────────────────────────────────────
  const ctx = buildAgentContext(currentParsed, agentId);
  emit({ stage: 'context_built', agentId, message: `Context ready: ${isContextReady(ctx)}, sections: ${Object.keys(ctx.sections).join(', ')}` });

  if (!isContextReady(ctx)) {
    const reason = ctx.blockingFlags.length
      ? `blocking flags: ${ctx.blockingFlags.join(', ')}`
      : `missing required sections: ${ctx.missingRequired.join(', ')}`;
    return {
      success: false,
      updatedContent: fileContent,
      sectionsWritten: [],
      tokensUsed: { input: 0, output: 0 },
      durationMs: (opts.now ?? Date.now)() - startMs,
      logEntryIds: [],
      error: `Context not ready — ${reason}`,
      retries: 0,
    };
  }

  // ── Claude call with retry ─────────────────────────────────────────────────
  const { systemPrompt, userMessage } = buildAgentPrompt(ctx, opts.userInstructions);
  let lastError = '';
  let retries = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let toolOutputs: ToolOutput[] = [];
  const request = buildRequest(opts, model, systemPrompt, userMessage, isMultiSection);

  while (retries <= maxRetries) {
    emit({ stage: 'calling_claude', agentId, message: `Calling ${model} via ${provider.id} (attempt ${retries + 1}/${maxRetries + 1})` });

    try {
      const completion = await provider.complete(request);

      totalInput += completion.usage.input_tokens;
      totalOutput += completion.usage.output_tokens;

      toolOutputs = extractToolOutputs(completion, toolName);

      if (toolOutputs.length === 0) {
        lastError = `The model did not call the ${toolName} tool`;
        retries++;
        continue;
      }

      break; // success
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      emit({ stage: 'error', agentId, message: `API error: ${lastError}` });
      retries++;
      if (retries > maxRetries) break;
      await sleep(1000 * retries); // simple backoff
    }
  }

  // ── Handle failure ────────────────────────────────────────────────────────
  if (toolOutputs.length === 0) {
    currentContent = writeErrorEntry(
      currentContent,
      currentParsed,
      agentId,
      'unknown',
      'AGENT_NO_TOOL_CALL',
      lastError,
      { agentId, durationMs: Date.now() - startMs },
    );
    return {
      success: false,
      updatedContent: currentContent,
      sectionsWritten: [],
      tokensUsed: { input: totalInput, output: totalOutput },
      durationMs: (opts.now ?? Date.now)() - startMs,
      logEntryIds: [],
      error: lastError,
      retries,
    };
  }

  // ── Write each section block ───────────────────────────────────────────────
  const { logEntryIds, sectionsWritten, content: finalContent } = writeSectionOutputs(
    currentContent,
    agentId,
    layerPrefix,
    toolOutputs,
    ctx.layer.reads,
    startMs,
    emit,
    opts.now,
  );
  currentContent = finalContent;

  emit({ stage: 'complete', agentId, message: `Wrote ${sectionsWritten.join(', ')} — ${totalInput + totalOutput} tokens` });

  return {
    success: true,
    updatedContent: currentContent,
    sectionsWritten,
    tokensUsed: { input: totalInput, output: totalOutput },
    durationMs: (opts.now ?? Date.now)() - startMs,
    logEntryIds,
    retries,
  };
}

// ─── Parse the provider's tool calls ─────────────────────────────────────────

function extractToolOutputs(completion: AgentCompletion, toolName: string): ToolOutput[] {
  const toolUseBlocks = completion.tool_calls.filter((call) => call.name === toolName);

  if (toolUseBlocks.length === 0) return [];

  const results: ToolOutput[] = [];

  for (const block of toolUseBlocks) {
    const input = block.input;

    if (toolName === 'write_multiple_uw_sections') {
      // Multi-section tool: input.sections is an array of section outputs
      const sections = (input['sections'] as ToolOutput[] | undefined) ?? [];
      results.push(...sections);
    } else {
      // Single-section tool
      results.push({
        section_id: input['section_id'] as string,
        confidence: input['confidence'] as 'high' | 'medium' | 'low',
        human_review_required: input['human_review_required'] as boolean,
        flags: (input['flags'] as string[]) ?? [],
        section_data: (input['section_data'] as Record<string, unknown>) ?? {},
        notes: input['notes'] as string | undefined,
      });
    }
  }

  return results;
}

// ─── Streaming variant ────────────────────────────────────────────────────────
// Same as runBancroftAgent but uses streaming so progress events arrive in real time.
// Useful for UI integrations (underwriter.cc wizard).

export async function runBancroftAgentStreaming(
  fileContent: string,
  agentId: string,
  opts: BancroftRunOptions,
): Promise<BancroftRunResult> {
  const startMs = (opts.now ?? Date.now)();
  const model = opts.model ?? 'claude-sonnet-4-6';
  const emit = opts.onProgress ?? (() => undefined);

  const provider = await resolveProvider(opts);
  const layerPrefix = agentId.match(/^(L\d+)/)?.[1] ?? 'L7';
  const isMultiSection = MULTI_SECTION_LAYERS.has(layerPrefix);
  const toolName = isMultiSection ? 'write_multiple_uw_sections' : 'write_uw_section';

  const currentParsed = parseUWFile(fileContent);
  const ctx = buildAgentContext(currentParsed, agentId);

  if (!isContextReady(ctx)) {
    const reason = ctx.blockingFlags.length
      ? `blocking flags: ${ctx.blockingFlags.join(', ')}`
      : `missing required sections: ${ctx.missingRequired.join(', ')}`;
    return {
      success: false,
      updatedContent: fileContent,
      sectionsWritten: [],
      tokensUsed: { input: 0, output: 0 },
      durationMs: (opts.now ?? Date.now)() - startMs,
      logEntryIds: [],
      error: reason,
      retries: 0,
    };
  }

  const { systemPrompt, userMessage } = buildAgentPrompt(ctx, opts.userInstructions);
  const request = buildRequest(opts, model, systemPrompt, userMessage, isMultiSection);

  emit({ stage: 'calling_claude', agentId, message: `Streaming ${model} via ${provider.id}` });

  let totalInput = 0;
  let totalOutput = 0;
  let toolOutputs: ToolOutput[] = [];

  try {
    // A provider that cannot stream falls back to the buffered path. Streaming
    // is a latency optimisation; refusing the run over it would be wrong.
    const completion = provider.stream
      ? await provider.stream(request)
      : await provider.complete(request);

    totalInput = completion.usage.input_tokens;
    totalOutput = completion.usage.output_tokens;
    toolOutputs = extractToolOutputs(completion, toolName);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      updatedContent: fileContent,
      sectionsWritten: [],
      tokensUsed: { input: totalInput, output: totalOutput },
      durationMs: (opts.now ?? Date.now)() - startMs,
      logEntryIds: [],
      error,
      retries: 0,
    };
  }

  if (toolOutputs.length === 0) {
    return {
      success: false,
      updatedContent: fileContent,
      sectionsWritten: [],
      tokensUsed: { input: totalInput, output: totalOutput },
      durationMs: (opts.now ?? Date.now)() - startMs,
      logEntryIds: [],
      error: 'The model did not call the write tool',
      retries: 0,
    };
  }

  // Write sections using the shared helper (no second API call)
  const { logEntryIds, sectionsWritten, content: finalContent } = writeSectionOutputs(
    fileContent,
    agentId,
    layerPrefix,
    toolOutputs,
    ctx.layer.reads,
    startMs,
    emit,
    opts.now,
  );

  emit({ stage: 'complete', agentId, message: `Wrote ${sectionsWritten.join(', ')} — ${totalInput + totalOutput} tokens` });

  return {
    success: true,
    updatedContent: finalContent,
    sectionsWritten,
    tokensUsed: { input: totalInput, output: totalOutput },
    durationMs: (opts.now ?? Date.now)() - startMs,
    logEntryIds,
    retries: 0,
  };
}

// ─── Shared write helper ──────────────────────────────────────────────────────
// Used by both runBancroftAgent and runBancroftAgentStreaming after tool outputs
// are extracted. Iterates over tool outputs, builds _meta, calls writeAgentBlock.

function writeSectionOutputs(
  fileContent: string,
  agentId: string,
  layerPrefix: string,
  toolOutputs: ToolOutput[],
  inputSections: string[],
  startMs: number,
  emit: (e: ProgressEvent) => void,
  clock?: () => number,
): { content: string; logEntryIds: string[]; sectionsWritten: string[] } {
  const nowMs = clock ?? Date.now;
  // Only freeze the stamps when a clock was injected. A real run keeps its
  // random log-entry suffix, which is what stops two runs in the same
  // millisecond from colliding.
  const frozen = clock !== undefined;
  const timestamp = frozen ? new Date(nowMs()).toISOString() : undefined;
  const layer = BANCROFT_LAYERS.find(l => l.id === layerPrefix);
  const pipelineStateUpdate = layer
    ? { [layer.pipelineStateKey]: 'complete' as const }
    : undefined;

  let currentContent = fileContent;
  const logEntryIds: string[] = [];
  const sectionsWritten: string[] = [];
  let sectionIndex = 0;

  for (const toolOut of toolOutputs) {
    emit({ stage: 'writing_block', agentId, sectionId: toolOut.section_id, message: `Writing ${toolOut.section_id}` });

    // Re-parse before each write so line numbers are fresh
    const currentParsed = parseUWFile(currentContent);

    const existingBlock = currentParsed.sections[toolOut.section_id];
    const existingVersion = existingBlock && 'meta' in existingBlock
      ? ((existingBlock as { meta: { version: number } }).meta?.version ?? 0)
      : 0;
    const newVersion = existingVersion + 1;

    const meta = buildMeta(toolOut.section_id, newVersion, {
      // The RFC 0031 actor grammar: a bare layer id (`L6-01`) is not an actor
      // and resolved only the catch-all policy; `agent/<id>` is what
      // BUILTIN_EDIT_POLICIES' agent/* pattern governs.
      source: `agent/${agentId}`,
      agentId,
      agentVersion: '1.0.0',
      actor: 'system',
      confidence: toolOut.confidence,
      humanReviewRequired: toolOut.human_review_required,
      flags: toolOut.flags,
      notes: toolOut.notes,
      ...(timestamp ? { timestamp } : {}),
    });

    // Strip any _meta/_notes Claude included in section_data — we own those fields.
    const { _meta: _ignoredMeta, _notes: _ignoredNotes, ...cleanSectionData } = toolOut.section_data;
    void _ignoredMeta; void _ignoredNotes;
    const sectionContent: Record<string, unknown> = {
      _meta: meta,
      _notes: toolOut.notes ?? null,
      ...cleanSectionData,
    };

    const runResult = writeAgentBlock(
      currentContent,
      currentParsed,
      { sectionId: toolOut.section_id, content: sectionContent },
      {
        agentId,
        agentVersion: '1.0.0',
        durationMs: nowMs() - startMs,
        flagsRaised: toolOut.flags,
        inputSections,
        updatePipelineState: pipelineStateUpdate,
        ...(timestamp ? { timestamp } : {}),
        // Derived from the frozen clock plus the section's position, so a
        // replayed multi-section run still gets distinct, stable ids.
        ...(frozen ? { logEntryId: `log_${nowMs()}_${agentId}_${sectionIndex}` } : {}),
      },
    );

    currentContent = runResult.content;
    logEntryIds.push(runResult.logEntryId);
    sectionsWritten.push(toolOut.section_id);
    sectionIndex++;
  }

  return { content: currentContent, logEntryIds, sectionsWritten };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
