// .uw.md runner — the generic write path for agent and engine outputs. The
// toolkit runs no agent itself; any host writes its records through here.
//
// Responsibilities:
//   1. Mark an existing section block as superseded (fence annotation + _meta)
//   2. Append a new versioned block with correct annotation
//   3. Append a pipeline_log entry
//   4. Update frontmatter last_modified and quick_metrics
//
// All operations are string-based (no re-serialization of the whole file).
// The runner uses exact line numbers from the parser to do targeted surgery.
// Output is always a valid .uw.md string that parseUWFile can round-trip.
//
// Spec: UW_FORMAT_SPEC.md §2.7 (update semantics), §3.6 (producer obligations)

import {
  stampMetaIntoBlockContent,
  bumpRawMetaVersion,
  buildMeta,
  type ParsedUWFile,
  type UWBlock,
  type UWMeta,
  type UWFrontmatter,
  getSection,
  getSectionVariant,
  parseUWFile,
} from '@uwmd/verify';

// `buildMeta` lives in `@uwmd/verify` (metadata.ts, RFC 0083); the runner keeps
// exporting it so `import { buildMeta } from './runner.js'` is unchanged.
export { buildMeta };

// Lightweight re-parse used only to get fresh line numbers after block insertion.
// parseUWFile is the same function — alias for clarity.
const parseUWFileForLog = parseUWFile;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AgentOutput {
  sectionId: string;
  content: Record<string, unknown>;  // must include _meta
  variant?: string;                  // for multi-variant sections
}

export interface RunOptions {
  agentId?: string;
  agentVersion?: string;
  actor?: string;
  durationMs?: number;
  inputHash?: string;
  inputSections?: string[];
  flagsRaised?: string[];
  flagsCleared?: string[];
  notes?: string;
  updateQuickMetrics?: Partial<Record<string, number | null>>;
  /**
   * Freeze the wall-clock stamp on the block and its log entry. Defaults to
   * now. Supplying it is what lets a caller reproduce a document
   * byte-for-byte — without it every run differs in `_meta.provenance.timestamp`.
   */
  timestamp?: string;
  /**
   * Freeze the pipeline-log entry id. Defaults to `log_<epoch>_<random>`, which
   * is fine for a real run and fatal for a reproducible one.
   */
  logEntryId?: string;
}

export interface RunResult {
  content: string;
  newBlock: {
    sectionId: string;
    version: number;
    annotation: string;
  };
  supersededPriorBlock: boolean;
  logEntryId: string;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function writeAgentBlock(
  fileContent: string,
  parsed: ParsedUWFile,
  output: AgentOutput,
  opts: RunOptions = {},
): RunResult {
  const { sectionId, variant } = output;
  const now = opts.timestamp ?? new Date().toISOString();
  const agentId = opts.agentId ?? 'user';
  const _actor = opts.actor ?? 'system';

  // Determine the existing block (if any) for this section/variant
  let existingBlock: UWBlock | null = null;
  if (variant) {
    existingBlock = getSectionVariant(parsed, sectionId, variant);
  } else {
    existingBlock = getSection(parsed, sectionId);
  }

  const newVersion = (existingBlock?.meta?.lifecycle?.revision ?? 0) + 1;

  // ── Step 1: Mark existing block as superseded ─────────────────────────────
  let lines = fileContent.split('\n');
  let supersededPriorBlock = false;

  if (existingBlock && !existingBlock.meta?.lifecycle?.superseded) {
    lines = markBlockSuperseded(lines, existingBlock);
    supersededPriorBlock = true;
  }

  // ── Step 2: Build the new block's annotation and JSON ─────────────────────
  const variantPart = variant ? ` variant=${variant}` : '';
  // The fence `source=` mirrors the block's _meta.provenance.source (the RFC
  // 0031 actor), falling back to the raw agentId only when the caller supplied
  // no _meta.
  const outMeta = output.content['_meta'] as UWMeta | undefined;
  const annotation = `\`\`\`json uw:section=${sectionId}${variantPart} source=${outMeta?.provenance?.source ?? agentId} ts=${now} v=${newVersion} confidence=${outMeta?.quality?.confidence ?? 'medium'}`;
  const emitted: Record<string, unknown> = { ...output.content };
  // Roles belong to the trusted host. Model output cannot assign or erase them.
  delete emitted['_role'];
  // Agent output never carries `_overrides`: those entries are per-field
  // provenance the cascade honors as human overrides, so an agent-written copy
  // would forge human provenance (invariant 5). There are no agent-authored
  // gap markers either; gaps go in the `gaps` section.
  delete emitted['_overrides'];
  if (existingBlock && Object.prototype.hasOwnProperty.call(existingBlock.content, '_role')) {
    emitted['_role'] = existingBlock.content['_role'];
  }
  // _meta is written as the first member (Format §2.4).
  if (outMeta !== undefined) stampMetaIntoBlockContent(emitted, outMeta);
  const blockJson = JSON.stringify(emitted, null, 2);
  const newBlockText = `${annotation}\n${blockJson}\n\`\`\``;

  // ── Step 3: Insert before pipeline_log (or before the last section) ───────
  const insertAt = findInsertionPoint(lines, parsed);
  lines.splice(insertAt, 0, '', newBlockText, '');

  // ── Step 4: Append pipeline_log entry ─────────────────────────────────────
  // Re-parse after block insertion so pipeline_log line numbers are current.
  // The splice in step 3 shifted all subsequent line positions; stale numbers
  // would cause appendPipelineLogEntry to overwrite the wrong lines.
  const afterInsert = lines.join('\n');
  const reparsedForLog = parseUWFileForLog(afterInsert);

  const logEntryId =
    opts.logEntryId ?? `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  lines = appendPipelineLogEntry(afterInsert.split('\n'), reparsedForLog, {
    entry_id: logEntryId,
    timestamp: now,
    event_type: 'agent_run',
    agent_or_actor: agentId,
    section_affected: sectionId,
    status: 'success',
    input_sections: opts.inputSections ?? [],
    output_sections: [sectionId],
    flags_raised: opts.flagsRaised ?? [],
    flags_cleared: opts.flagsCleared ?? [],
    duration_ms: opts.durationMs ?? null,
    input_hash: opts.inputHash ?? null,
    output_hash: null,
    error_code: null,
    error_message: null,
    notes: opts.notes ?? null,
  });

  // ── Step 5: Update frontmatter fields ─────────────────────────────────────
  let result = lines.join('\n');
  result = updateFrontmatterField(result, 'last_modified', `"${now}"`);

  if (opts.updateQuickMetrics) {
    for (const [metric, value] of Object.entries(opts.updateQuickMetrics)) {
      if (value !== undefined) {
        result = updateNestedFrontmatterField(result, 'quick_metrics', metric, value === null ? 'null' : String(value));
      }
    }
  }

  return {
    content: result,
    newBlock: { sectionId, version: newVersion, annotation },
    supersededPriorBlock,
    logEntryId,
  };
}

// ─── Mark existing block as superseded ───────────────────────────────────────
// Two targeted string surgeries:
//   1. Fence annotation: add `superseded=true` to the opening ``` line
//   2. _meta JSON body: replace `"superseded": false` → `"superseded": true`

function markBlockSuperseded(lines: string[], block: UWBlock): string[] {
  const result = [...lines];

  // 1. Fence annotation (lineStart is 1-indexed → array index = lineStart - 1)
  const fenceIdx = block.lineStart - 1;
  if (fenceIdx >= 0 && fenceIdx < result.length) {
    const fenceLine = result[fenceIdx];
    if (fenceLine && !fenceLine.includes('superseded=true')) {
      // Insert superseded=true after the section annotation
      result[fenceIdx] = fenceLine.replace(
        /^(```json\s+uw:section=\S+)/,
        '$1 superseded=true',
      );
    }
  }

  // 2. _meta.lifecycle.superseded inside the JSON body
  for (let i = block.lineStart; i < block.lineEnd - 1; i++) {
    const line = result[i];
    if (line?.includes('"superseded": false')) {
      result[i] = line.replace('"superseded": false', '"superseded": true');
      break;
    }
  }

  return result;
}

// ─── Find insertion point ─────────────────────────────────────────────────────
// Insert new section blocks just before the pipeline_log section.
// Falls back to end of file if no pipeline_log exists.

function findInsertionPoint(lines: string[], parsed: ParsedUWFile): number {
  // pipeline_log blocks are at the end; find the first pipeline_log fence line
  if (parsed.pipeline_log.length > 0) {
    const firstLogBlock = parsed.pipeline_log[0];
    // lineStart is 1-indexed; we want the line BEFORE the opening fence
    // Back up past any preceding blank lines and section header
    let idx = firstLogBlock.lineStart - 2; // -1 for 0-index, -1 to be before the fence
    while (idx > 0 && lines[idx]?.trim() === '') idx--;
    // Back up past section header (## Pipeline Log)
    if (lines[idx]?.trim().startsWith('##')) idx--;
    // Back up past any blank lines before the header
    while (idx > 0 && lines[idx - 1]?.trim() === '') idx--;
    return idx + 1;
  }

  // No pipeline_log — insert at end
  return lines.length;
}

// ─── Append pipeline_log entry ────────────────────────────────────────────────
// Finds the existing pipeline_log block and adds the new entry to its entries[].
// If no pipeline_log block exists, appends a new one.

function appendPipelineLogEntry(
  lines: string[],
  parsed: ParsedUWFile,
  entry: Record<string, unknown>,
): string[] {
  if (parsed.pipeline_log.length === 0) {
    // No pipeline_log yet — append a new one at the end
    const now = (entry['timestamp'] as string) ?? new Date().toISOString();
    const newLogBlock = buildNewPipelineLogBlock(entry, now);
    return [...lines, '', newLogBlock, ''];
  }

  // Find the most recent pipeline_log block
  const lastLogBlock = parsed.pipeline_log[parsed.pipeline_log.length - 1];
  const blockLines = lines.slice(lastLogBlock.lineStart - 1, lastLogBlock.lineEnd);
  const _joinedBlock = blockLines.join('\n');

  // Parse current entries array from the JSON
  let blockContent: Record<string, unknown>;
  try {
    blockContent = JSON.parse(lastLogBlock.rawJson) as Record<string, unknown>;
  } catch {
    // Fallback: append a new pipeline_log block
    const now = (entry['timestamp'] as string) ?? new Date().toISOString();
    return [...lines, '', buildNewPipelineLogBlock(entry, now), ''];
  }

  const entries = (blockContent['entries'] as unknown[]) ?? [];
  entries.push(entry);
  blockContent['entries'] = entries;

  // Advance the log block's revision and write time.
  const meta = blockContent['_meta'] as UWMeta | undefined;
  const nowTs = (entry['timestamp'] as string) ?? new Date().toISOString();
  const nextVersion = meta?.lifecycle && meta.provenance ? bumpRawMetaVersion(meta, nowTs) : 1;

  // Rebuild the block JSON
  const updatedJson = JSON.stringify(blockContent, null, 2);
  const newAnnotation = buildUpdatedAnnotation(
    lines[lastLogBlock.lineStart - 1] ?? '',
    nextVersion,
    nowTs,
  );

  const result = [...lines];
  // Replace the block's content (lineStart through lineEnd, exclusive of fences)
  result.splice(
    lastLogBlock.lineStart - 1,
    lastLogBlock.lineEnd - lastLogBlock.lineStart + 1,
    newAnnotation,
    updatedJson,
    '```',
  );

  return result;
}

function buildNewPipelineLogBlock(
  entry: Record<string, unknown>,
  now: string,
): string {
  const meta = buildMeta('pipeline_log', 1, {
    source: 'system/uwmd',
    agentVersion: '1.0.0',
    actor: 'system',
    confidence: 'high',
    timestamp: now,
  });
  const content: Record<string, unknown> = { entries: [entry] };
  stampMetaIntoBlockContent(content, meta);
  return `\`\`\`json uw:section=pipeline_log source=system/uwmd ts=${now} v=1 confidence=high\n${JSON.stringify(content, null, 2)}\n\`\`\``;
}

function buildUpdatedAnnotation(existing: string, version: number, ts: string): string {
  // Update v= and ts= in existing annotation
  return existing
    .replace(/\bv=\d+/, `v=${version}`)
    .replace(/\bts=\S+/, `ts=${ts}`);
}

// ─── Frontmatter field updaters ───────────────────────────────────────────────
// Targeted string surgery on the frontmatter YAML block.

function updateFrontmatterField(content: string, key: string, newValue: string): string {
  // Match "key: anything" in frontmatter (between --- delimiters)
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return content;

  const fm = content.slice(0, fmEnd);
  const rest = content.slice(fmEnd);

  const pattern = new RegExp(`^(${escapeRegex(key)}:\\s*)(.+)$`, 'm');
  if (pattern.test(fm)) {
    return fm.replace(pattern, `$1${newValue}`) + rest;
  }
  return content;
}

function updateNestedFrontmatterField(
  content: string,
  parentKey: string,
  childKey: string,
  newValue: string,
): string {
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return content;

  const fm = content.slice(0, fmEnd);
  const rest = content.slice(fmEnd);

  // Match "  childKey: anything" that appears after "parentKey:" in the frontmatter
  const parentIdx = fm.indexOf(`\n${parentKey}:`);
  if (parentIdx === -1) return content;

  const pattern = new RegExp(`(\\n${escapeRegex(parentKey)}:[^\\n]*(?:\\n  [^\\n]+)*\\n  ${escapeRegex(childKey)}:\\s*)([^\\n]+)`);
  if (pattern.test(fm)) {
    return fm.replace(pattern, `$1${newValue}`) + rest;
  }
  return content;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Error block writer ───────────────────────────────────────────────────────
// Writes a failed agent run to the pipeline_log without modifying the section.

export function writeErrorEntry(
  fileContent: string,
  parsed: ParsedUWFile,
  agentId: string,
  sectionId: string,
  errorCode: string,
  errorMessage: string,
  opts: Omit<RunOptions, 'updateQuickMetrics'> = {},
): string {
  const now = opts.timestamp ?? new Date().toISOString();
  const logEntryId = opts.logEntryId ?? `log_${Date.now()}_err`;

  const lines = appendPipelineLogEntry(fileContent.split('\n'), parsed, {
    entry_id: logEntryId,
    timestamp: now,
    event_type: 'agent_run',
    agent_or_actor: agentId,
    section_affected: sectionId,
    status: 'failed',
    input_sections: opts.inputSections ?? [],
    output_sections: [],
    flags_raised: opts.flagsRaised ?? [],
    flags_cleared: [],
    duration_ms: opts.durationMs ?? null,
    input_hash: null,
    output_hash: null,
    error_code: errorCode,
    error_message: errorMessage,
    notes: opts.notes ?? null,
  });

  return updateFrontmatterField(lines.join('\n'), 'last_modified', `"${now}"`);
}
