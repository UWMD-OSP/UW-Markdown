// Bancroft agent runner — calls Claude API and writes output back to .uw.md
//
// Flow:
//   1. Build curated context for the requested agent layer
//   2. Call Claude with the context + structured output tool
//   3. Parse the tool_use response into section content
//   4. Write each output section via writeAgentBlock (supersedes prior versions)
//   5. Return the updated file content + run metadata
//
// Uses Claude's tool_use mechanism for guaranteed JSON output. Claude must call
// write_uw_section (or write_multiple_uw_sections for multi-section layers);
// if it doesn't, we retry up to maxRetries before writing an error log entry.

import Anthropic from '@anthropic-ai/sdk';
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

// ─── Public types ─────────────────────────────────────────────────────────────

export interface BancroftRunOptions {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  maxTokens?: number;
  temperature?: number;
  userInstructions?: string;
  /** Called on each status update during the run */
  onProgress?: (event: ProgressEvent) => void;
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
  const startMs = Date.now();
  const model = opts.model ?? 'claude-sonnet-4-6';
  const maxRetries = opts.maxRetries ?? 2;
  const emit = opts.onProgress ?? (() => undefined);

  const client = new Anthropic({ apiKey: opts.apiKey });
  const layerPrefix = agentId.match(/^(L\d+)/)?.[1] ?? 'L7';
  const isMultiSection = MULTI_SECTION_LAYERS.has(layerPrefix);
  const tools: Anthropic.Tool[] = isMultiSection
    ? [WRITE_MULTIPLE_SECTIONS_TOOL]
    : [WRITE_UW_SECTION_TOOL];
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
      durationMs: Date.now() - startMs,
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
  let rawResponse: Anthropic.Message | null = null;

  while (retries <= maxRetries) {
    emit({ stage: 'calling_claude', agentId, message: `Calling ${model} (attempt ${retries + 1}/${maxRetries + 1})` });

    try {
      rawResponse = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools,
        tool_choice: { type: 'any' },
      });

      totalInput += rawResponse.usage.input_tokens;
      totalOutput += rawResponse.usage.output_tokens;

      toolOutputs = extractToolOutputs(rawResponse, toolName);

      if (toolOutputs.length === 0) {
        lastError = `Claude did not call the ${toolName} tool`;
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
      durationMs: Date.now() - startMs,
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
  );
  currentContent = finalContent;

  emit({ stage: 'complete', agentId, message: `Wrote ${sectionsWritten.join(', ')} — ${totalInput + totalOutput} tokens` });

  return {
    success: true,
    updatedContent: currentContent,
    sectionsWritten,
    tokensUsed: { input: totalInput, output: totalOutput },
    durationMs: Date.now() - startMs,
    logEntryIds,
    retries,
  };
}

// ─── Parse Claude's tool_use response ────────────────────────────────────────

function extractToolOutputs(response: Anthropic.Message, toolName: string): ToolOutput[] {
  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  );

  if (toolUseBlocks.length === 0) return [];

  const results: ToolOutput[] = [];

  for (const block of toolUseBlocks) {
    const input = block.input as Record<string, unknown>;

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
  const startMs = Date.now();
  const model = opts.model ?? 'claude-sonnet-4-6';
  const emit = opts.onProgress ?? (() => undefined);

  const client = new Anthropic({ apiKey: opts.apiKey });
  const layerPrefix = agentId.match(/^(L\d+)/)?.[1] ?? 'L7';
  const isMultiSection = MULTI_SECTION_LAYERS.has(layerPrefix);
  const tools: Anthropic.Tool[] = isMultiSection
    ? [WRITE_MULTIPLE_SECTIONS_TOOL]
    : [WRITE_UW_SECTION_TOOL];
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
      durationMs: Date.now() - startMs,
      logEntryIds: [],
      error: reason,
      retries: 0,
    };
  }

  const { systemPrompt, userMessage } = buildAgentPrompt(ctx, opts.userInstructions);

  emit({ stage: 'calling_claude', agentId, message: `Streaming ${model}` });

  let totalInput = 0;
  let totalOutput = 0;
  let toolOutputs: ToolOutput[] = [];

  try {
    // Collect the full streamed response before processing
    const stream = await client.messages.stream({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      tools,
      tool_choice: { type: 'any' },
    });

    const response = await stream.finalMessage();
    totalInput = response.usage.input_tokens;
    totalOutput = response.usage.output_tokens;
    toolOutputs = extractToolOutputs(response, toolName);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      updatedContent: fileContent,
      sectionsWritten: [],
      tokensUsed: { input: totalInput, output: totalOutput },
      durationMs: Date.now() - startMs,
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
      durationMs: Date.now() - startMs,
      logEntryIds: [],
      error: 'Claude did not call the write tool',
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
  );

  emit({ stage: 'complete', agentId, message: `Wrote ${sectionsWritten.join(', ')} — ${totalInput + totalOutput} tokens` });

  return {
    success: true,
    updatedContent: finalContent,
    sectionsWritten,
    tokensUsed: { input: totalInput, output: totalOutput },
    durationMs: Date.now() - startMs,
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
): { content: string; logEntryIds: string[]; sectionsWritten: string[] } {
  const layer = BANCROFT_LAYERS.find(l => l.id === layerPrefix);
  const pipelineStateUpdate = layer
    ? { [layer.pipelineStateKey]: 'complete' as const }
    : undefined;

  let currentContent = fileContent;
  const logEntryIds: string[] = [];
  const sectionsWritten: string[] = [];

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
      source: agentId,
      agentId,
      agentVersion: '1.0.0',
      actor: 'system',
      confidence: toolOut.confidence,
      humanReviewRequired: toolOut.human_review_required,
      flags: toolOut.flags,
      notes: toolOut.notes,
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
        durationMs: Date.now() - startMs,
        flagsRaised: toolOut.flags,
        inputSections,
        updatePipelineState: pipelineStateUpdate,
      },
    );

    currentContent = runResult.content;
    logEntryIds.push(runResult.logEntryId);
    sectionsWritten.push(toolOut.section_id);
  }

  return { content: currentContent, logEntryIds, sectionsWritten };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
