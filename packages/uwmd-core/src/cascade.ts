// Fallback cascade resolver — Protocol §V.7
//
// Walks the seven cascade steps in order; first hit wins. The producer that
// uses this stamps the resulting `_meta.source` with the cascade step that
// produced the value. See FORMAT_SPEC §3.4 (provisional flag) and §2.6
// (source tags).

import type { CascadeStep } from './protocol.js';
import { getAssetClassDefaults, type DefaultRange } from './defaults.js';
import { deepGet } from './parser.js';
import type { ParsedUWFile, SourceTag, UWBlock, UWFieldOverride } from './types.js';

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface MarketDataLookup {
  /**
   * Resolve `field_path` against an external market-data source. Adopters
   * implement this against CoStar, Yardi, RCA, or an internal warehouse.
   * Returning null means "no observation available" — the cascade falls
   * through to asset_class_default.
   */
  resolve(
    field_path: string,
    context: { asset_class: string; geo?: string },
  ): { value: unknown; range?: { low: number; central: number; high: number } } | null;
  /** How long an observation remains usable, for staleness checks downstream. */
  staleness_seconds: number;
}

export interface InvestorProfile {
  /** Field-path → preferred value map. */
  values: Record<string, unknown>;
  /** Identifier of the profile (institution + investor + version). */
  source_id: string;
}

export interface GlobalDefaults {
  /** Field-path → scalar value. Used after asset-class defaults are exhausted. */
  values: Record<string, unknown>;
}

export interface SystemDefaults {
  /** Hardcoded floors of last resort. Producers SHOULD avoid relying on this layer. */
  values: Record<string, unknown>;
}

export interface CascadeContext {
  /** Asset class drives which default table is consulted. Defaults to the
   *  file's `frontmatter.asset_class` when omitted. */
  asset_class?: string;
  /** Optional geography hint passed to the market-data resolver. */
  geo?: string;
  profile?: InvestorProfile;
  market?: MarketDataLookup;
  global?: GlobalDefaults;
  system?: SystemDefaults;
}

// ─── Output ──────────────────────────────────────────────────────────────────

export interface ResolvedValue {
  value: unknown;
  source: SourceTag;
  step: CascadeStep;
  /** Range carried by the resolution (e.g. asset-class default), when available. */
  range?: { low: number; central: number; high: number };
  /** Identifier of the table or document that produced the value. */
  resolved_from?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function getBlock(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if ('annotation' in (entry as object)) return entry as UWBlock;
  // Multi-variant: walk variants and return the first that yields a value.
  // Resolution at this layer just needs a representative block; the path
  // walk that follows decides whether the value exists.
  const variants = Object.values(entry as Record<string, UWBlock>);
  return variants[0] ?? null;
}

function splitFieldPath(field_path: string): { sectionId: string; rest: string } | null {
  const dot = field_path.indexOf('.');
  if (dot === -1) return null;
  return { sectionId: field_path.slice(0, dot), rest: field_path.slice(dot + 1) };
}

/** Look up a value in `parsed.sections[section].content` for the given path. */
function readFromSection(parsed: ParsedUWFile, field_path: string): unknown {
  const split = splitFieldPath(field_path);
  if (!split) return undefined;
  const block = getBlock(parsed, split.sectionId);
  if (!block) return undefined;
  return deepGet(block.content, split.rest);
}

/**
 * If a block has a `field_overrides` entry whose path matches `rest`, return it.
 * Used to surface per-field source tags that may be more specific than the
 * block-level `_meta.source`.
 */
function findFieldOverride(block: UWBlock, rest: string): UWFieldOverride | undefined {
  return block.meta.field_overrides?.find((o) => o.path === rest);
}

/**
 * Walk the parsed sections looking for a value at `field_path` whose effective
 * source matches one of the wanted tags. Effective source = field_override.source
 * (when present for the path) → block.meta.source.
 *
 * Used to detect user_override / user_input / market_data values already
 * recorded in the file. Returns the first match; multi-variant sections check
 * every variant.
 */
function findBySource(
  parsed: ParsedUWFile,
  field_path: string,
  wanted: SourceTag[],
): { block: UWBlock; value: unknown; source: SourceTag } | null {
  const split = splitFieldPath(field_path);
  if (!split) return null;
  const entry = parsed.sections[split.sectionId];
  if (!entry) return null;

  const blocks: UWBlock[] = 'annotation' in (entry as object)
    ? [entry as UWBlock]
    : Object.values(entry as Record<string, UWBlock>);

  for (const block of blocks) {
    const value = deepGet(block.content, split.rest);
    if (value === undefined) continue;
    const override = findFieldOverride(block, split.rest);
    const effective = override?.source ?? block.meta.source;
    if (wanted.includes(effective)) {
      return { block, value, source: effective };
    }
  }
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a value for `field_path` by walking the cascade defined in protocol
 * §V.7. The first step that yields a value wins.
 *
 * Cascade order:
 *   1. user_override (in-file, source-tag match)
 *   2. user_input (in-file, source-tag match)
 *   3. investor_profile (ctx.profile)
 *   4. market_data (ctx.market)
 *   5. asset_class_default (defaults registry)
 *   6. global_default (ctx.global)
 *   7. system_default (ctx.system)
 *
 * Returns `undefined` value with step='system_default' as a sentinel only when
 * every step misses; callers SHOULD treat that as an unresolvable input and
 * record a gap.
 */
export function resolveValue(
  field_path: string,
  parsed: ParsedUWFile,
  ctx: CascadeContext = {},
): ResolvedValue {
  // Step 1: user_override
  const override = findBySource(parsed, field_path, ['user_override']);
  if (override) {
    return { value: override.value, source: 'user_override', step: 'user_override' };
  }

  // Step 2: user_input (also accept 'manual' as a synonym for typed-in values)
  const input = findBySource(parsed, field_path, ['user_input', 'manual']);
  if (input) {
    return { value: input.value, source: input.source, step: 'user_input' };
  }

  // Step 3: investor_profile
  if (ctx.profile && field_path in ctx.profile.values) {
    return {
      value: ctx.profile.values[field_path],
      source: 'investor_profile',
      step: 'investor_profile',
      resolved_from: ctx.profile.source_id,
    };
  }

  // Step 4: market_data
  const asset_class =
    ctx.asset_class ??
    (parsed.frontmatter as { asset_class?: string }).asset_class ??
    'multifamily';
  if (ctx.market) {
    const hit = ctx.market.resolve(field_path, { asset_class, geo: ctx.geo });
    if (hit) {
      return {
        value: hit.value,
        source: 'market_data',
        step: 'market_data',
        range: hit.range,
      };
    }
  }

  // Also recognize an existing market_data tag already stamped in-file.
  const inFileMarket = findBySource(parsed, field_path, ['market_data']);
  if (inFileMarket) {
    return { value: inFileMarket.value, source: 'market_data', step: 'market_data' };
  }

  // Step 5: asset_class_default
  const table = getAssetClassDefaults(asset_class);
  const range: DefaultRange | undefined = table?.fields[field_path];
  if (range) {
    return {
      value: range.central,
      source: 'asset_class_default',
      step: 'asset_class_default',
      range: { low: range.low, central: range.central, high: range.high },
      resolved_from: `${table?.asset_class}@${table?.version}`,
    };
  }

  // Step 6: global_default
  if (ctx.global && field_path in ctx.global.values) {
    return {
      value: ctx.global.values[field_path],
      source: 'global_default',
      step: 'global_default',
    };
  }

  // Step 7: system_default
  if (ctx.system && field_path in ctx.system.values) {
    return {
      value: ctx.system.values[field_path],
      source: 'system_default',
      step: 'system_default',
    };
  }

  return { value: undefined, source: 'system_default', step: 'system_default' };
}

/**
 * Read a value already present in the file at `field_path` without walking the
 * cascade. Useful when callers want to distinguish "in file" vs "resolved."
 */
export function readInFile(parsed: ParsedUWFile, field_path: string): unknown {
  return readFromSection(parsed, field_path);
}
