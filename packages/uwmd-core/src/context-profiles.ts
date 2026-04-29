// Context Profiles — normative views of a .uw.md for AI consumption
// Spec: UW_PROTOCOL_v1.md §XI ("Context Profiles")
//
// Five profiles: summary | live | compact | full | relevant
//
// Design intent:
//   - `summary`   — chat agents and orchestration heuristics. ~600 tokens.
//   - `live`      — calc-aware editors. All non-superseded sections, full prose.
//   - `compact`   — LLMs at scale. Stable-first ordering for prompt-cache hits.
//   - `full`      — archival / forensic. Whole file, untouched.
//   - `relevant`  — Bancroft-style filter to a caller-named subset of sections.
//
// Token estimates use the chars/4 approximation. See FEEDING-UWMD-TO-AN-LLM
// docs page for cache-strategy guidance.

import type { ParsedUWFile, UWBlock } from './types.js';
import { compact } from './compactor.js';

export type ContextProfile = 'summary' | 'live' | 'compact' | 'full' | 'relevant';

export interface BuildContextOptions {
  /** For `relevant`: which sections to include. Ignored by other profiles. */
  sections?: string[];
  /** Soft target. The emitter MAY truncate prose first, then sections. */
  maxTokens?: number;
  /** Force minified JSON output where applicable. */
  minify?: boolean;
  /** Include superseded blocks. Default: only `full`. */
  includeSuperseded?: boolean;
  /** Strip every block's _meta to shave bytes. Default: true (preserve _meta). */
  includeMeta?: boolean;
}

export interface ContextResult {
  content: string;
  /** chars/4 approximation. Documented as ±5% off true tokenizer cost. */
  tokenEstimate: number;
  profile: ContextProfile;
  sectionsIncluded: string[];
  truncated: boolean;
}

/**
 * Stable-first section ordering for `compact`. Sections that rarely change in
 * underwriting (property facts, ownership) come first so prompt-cache hits
 * survive frequent edits to volatile downstream sections (rent_roll, dcf).
 */
const COMPACT_ORDER: readonly string[] = Object.freeze([
  'property',
  'ownership',
  'borrower_sponsor',
  'debt_structure',
  'sources_uses',
  'valuation',
  'rent_roll',
  'operating_statement',
  'noi_model',
  'market_analysis',
  'compliance',
  'risk_assessment',
  'dcf',
  'stress_tests',
  'custom_calculations',
  'gaps',
  'extensions',
]);

/** Sections that fit in `summary`. Anything bigger blows the token budget. */
const SUMMARY_SECTIONS: readonly string[] = Object.freeze([
  'gaps',
]);

export function buildContext(
  parsed: ParsedUWFile,
  profile: ContextProfile,
  opts: BuildContextOptions = {},
): ContextResult {
  switch (profile) {
    case 'summary':
      return buildSummary(parsed, opts);
    case 'live':
      return buildLive(parsed, opts);
    case 'compact':
      return buildCompact(parsed, opts);
    case 'full':
      return buildFull(parsed, opts);
    case 'relevant':
      return buildRelevant(parsed, opts);
    default: {
      const _exhaustive: never = profile;
      void _exhaustive;
      throw new Error(`buildContext: unknown profile '${profile as string}'`);
    }
  }
}

// ─── Profile implementations ─────────────────────────────────────────────────

function buildSummary(parsed: ParsedUWFile, opts: BuildContextOptions): ContextResult {
  const minify = opts.minify ?? true;
  const payload: Record<string, unknown> = {
    frontmatter: pickFrontmatter(parsed),
    pipeline_state: parsed.frontmatter.pipeline_state ?? null,
    quick_metrics: parsed.frontmatter.quick_metrics ?? null,
  };
  const sectionsIncluded: string[] = [];
  for (const id of SUMMARY_SECTIONS) {
    const block = headBlock(parsed, id);
    if (!block) continue;
    payload[id] = stripBlockMeta(block, opts.includeMeta);
    sectionsIncluded.push(id);
  }
  const content = serialize(payload, minify);
  return finalize(content, 'summary', sectionsIncluded, opts);
}

function buildLive(parsed: ParsedUWFile, opts: BuildContextOptions): ContextResult {
  const minify = opts.minify ?? false;
  const sectionsIncluded: string[] = [];
  const payload: Record<string, unknown> = {
    frontmatter: pickFrontmatter(parsed),
  };
  for (const id of allSectionIds(parsed)) {
    const block = headBlock(parsed, id);
    if (!block) continue;
    payload[id] = {
      content: stripBlockMeta(block, opts.includeMeta),
      prose: parsed.prose[id] ?? '',
    };
    sectionsIncluded.push(id);
  }
  const content = serialize(payload, minify);
  return finalize(content, 'live', sectionsIncluded, opts);
}

function buildCompact(parsed: ParsedUWFile, opts: BuildContextOptions): ContextResult {
  const minify = opts.minify ?? true;
  // _meta is noise for AI consumers at scale; default to stripping in compact.
  // Callers that need provenance stay on live or pass includeMeta:true.
  const includeMeta = opts.includeMeta ?? false;
  const sectionsIncluded: string[] = [];
  const payload: Record<string, unknown> = {
    frontmatter: pickFrontmatter(parsed),
  };
  for (const id of COMPACT_ORDER) {
    const block = headBlock(parsed, id);
    if (!block) continue;
    payload[id] = stripBlockMeta(block, includeMeta);
    sectionsIncluded.push(id);
  }
  for (const id of allSectionIds(parsed)) {
    if (sectionsIncluded.includes(id)) continue;
    const block = headBlock(parsed, id);
    if (!block) continue;
    payload[id] = stripBlockMeta(block, includeMeta);
    sectionsIncluded.push(id);
  }
  const content = serialize(payload, minify);
  return finalize(content, 'compact', sectionsIncluded, opts);
}

function buildFull(parsed: ParsedUWFile, opts: BuildContextOptions): ContextResult {
  // Whole file, byte-for-byte. compactor.compact() strips superseded by default;
  // for `full` we want the raw input preserved, so use parsed.raw directly.
  const content = opts.includeSuperseded === false ? compact(parsed) : parsed.raw;
  const sectionsIncluded = allSectionIds(parsed);
  return finalize(content, 'full', sectionsIncluded, { ...opts, maxTokens: undefined });
}

function buildRelevant(parsed: ParsedUWFile, opts: BuildContextOptions): ContextResult {
  const minify = opts.minify ?? false;
  const requested = opts.sections ?? [];
  const sectionsIncluded: string[] = [];
  const payload: Record<string, unknown> = {
    frontmatter: pickFrontmatter(parsed),
  };
  for (const id of requested) {
    const block = headBlock(parsed, id);
    if (!block) continue;
    payload[id] = {
      content: stripBlockMeta(block, opts.includeMeta),
      prose: parsed.prose[id] ?? '',
    };
    sectionsIncluded.push(id);
  }
  const content = serialize(payload, minify);
  return finalize(content, 'relevant', sectionsIncluded, opts);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Estimate token count from character count. Documented approximation
 * (chars/4) — within ±5% of the true tokenizer cost on typical .uw.md content,
 * per the calibration in the FEEDING-UWMD-TO-AN-LLM docs page.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function finalize(
  content: string,
  profile: ContextProfile,
  sectionsIncluded: string[],
  opts: BuildContextOptions,
): ContextResult {
  const tokenEstimate = estimateTokens(content);
  let truncated = false;
  let final = content;
  if (opts.maxTokens != null && tokenEstimate > opts.maxTokens) {
    truncated = true;
    // Soft truncation: chop chars to fit the budget. Caller saw `truncated:true`.
    const targetChars = Math.max(0, opts.maxTokens * 4);
    final = content.slice(0, targetChars);
  }
  return {
    content: final,
    tokenEstimate: estimateTokens(final),
    profile,
    sectionsIncluded,
    truncated,
  };
}

function headBlock(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if ('annotation' in (entry as object)) return entry as UWBlock;
  // Multi-variant: pick the first variant.
  const variants = Object.values(entry as Record<string, UWBlock>);
  return variants[0] ?? null;
}

function allSectionIds(parsed: ParsedUWFile): string[] {
  return Object.keys(parsed.sections);
}

function stripBlockMeta(block: UWBlock, includeMeta: boolean | undefined): unknown {
  if (includeMeta === false) {
    // Drop _meta from the embedded content as well — content carries an
    // inlined _meta object that mirrors block.meta. For AI-consumption profiles
    // we want it gone everywhere.
    const { _meta: _drop, ...rest } = block.content as Record<string, unknown>;
    void _drop;
    return rest;
  }
  return { ...block.content, _meta: block.meta };
}

function pickFrontmatter(parsed: ParsedUWFile): Record<string, unknown> {
  // Slim subset that orientation-needing consumers always want.
  const fm = parsed.frontmatter;
  return {
    deal_id: fm.deal_id,
    deal_name: fm.deal_name,
    asset_class: fm.asset_class,
    deal_stage: fm.deal_stage,
    status: fm.status,
    recommendation: fm.recommendation,
    property_address: fm.property_address,
    city: fm.city,
    state: fm.state,
  };
}

function serialize(value: unknown, minify: boolean): string {
  return JSON.stringify(value, null, minify ? 0 : 2);
}
