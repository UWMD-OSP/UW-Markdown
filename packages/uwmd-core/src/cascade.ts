// Fallback cascade resolver — Protocol §V.7
//
// Walks the eight cascade steps in order (seven before RFC 0021 §5 added
// `inherited_assumption` at protocol 1.5.0); first hit wins. The producer that
// uses this stamps the resulting `_meta.source` with the cascade step that
// produced the value. See FORMAT_SPEC §3.4 (provisional flag) and §2.6
// (source tags).

import type { CascadeStep } from './protocol.js';
import { getAssetClassDefaults, type DefaultRange } from './defaults.js';
import { blockPayload, deepGet } from './parser.js';
import { resolveSectionBlock, type SectionSelectionOptions } from './section-resolution.js';
import type { BlockRole, ParsedUWFile, SourceTag, UWBlock, UWFieldOverride } from './types.js';

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
  ): {
    value: unknown;
    range?: { low: number; central: number; high: number };
    /**
     * Optional identity of the observation set this value came from, surfaced
     * as `ResolvedValue.resolved_from`. Added by RFC 0022 so a market-derived
     * value can say *which* set produced it — the gap that made receipts over
     * market data irreproducible. Optional, so a host returning the original
     * `{ value, range }` shape is unaffected.
     */
    source_id?: string;
  } | null;
  /** How long an observation remains usable, for staleness checks downstream. */
  staleness_seconds: number;
}

/**
 * Assumptions one ancestor asserts for its descendants (RFC 0021 §5).
 *
 * Callers build these by walking the composition DAG; this module does not
 * discover them, because there is deliberately no ambient assumption scope —
 * a document not reachable as an ancestor contributes nothing.
 */
export interface InheritedAssumptions {
  /** The ancestor asserting these values. */
  document_id: string;
  /** `sha256:<64 lowercase hex>` over the ancestor's canonical form. */
  digest: string;
  /** Hops up the DAG from the resolving document; 1 is the immediate parent. */
  distance: number;
  /** Field-path → value. */
  values: Record<string, unknown>;
}

/**
 * Raised when two equidistant ancestors assert the same field. Diamond
 * inheritance resolves explicitly or not at all — silently picking one would
 * make the answer depend on graph traversal order, which is the class of bug
 * this whole RFC is written to avoid.
 */
export class AmbiguousInheritanceError extends Error {
  readonly code = 'COMP-AMBIGUOUS-INHERIT' as const;
  readonly field_path: string;
  readonly ancestors: string[];

  constructor(field_path: string, ancestors: string[]) {
    super(
      `[COMP-AMBIGUOUS-INHERIT] Equidistant ancestors ${ancestors
        .map((a) => `'${a}'`)
        .join(' and ')} both assert '${field_path}'. Resolve which is authoritative rather than letting traversal order decide.`,
    );
    this.name = 'AmbiguousInheritanceError';
    this.field_path = field_path;
    this.ancestors = ancestors;
  }
}

/**
 * Select the inherited value for `field_path`: the nearest ancestor wins.
 *
 * Exported because a host often needs the winning ancestor's identity to stamp
 * `_meta.inherited_from`, not merely the value.
 */
export function selectInheritedAssumption(
  field_path: string,
  inherited: readonly InheritedAssumptions[],
): InheritedAssumptions | null {
  const holders = inherited.filter((a) => Object.hasOwn(a.values, field_path));
  if (holders.length === 0) return null;

  let nearest = holders[0]!;
  for (const candidate of holders.slice(1)) {
    if (candidate.distance < nearest.distance) nearest = candidate;
  }

  const tied = holders.filter(
    (a) => a.distance === nearest.distance && a.document_id !== nearest.document_id,
  );
  if (tied.length > 0) {
    throw new AmbiguousInheritanceError(
      field_path,
      [nearest, ...tied].map((a) => a.document_id).sort(),
    );
  }
  return nearest;
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
  /**
   * Assumptions from ancestors in the composition DAG (RFC 0021 §5). Supplied
   * by the caller after resolving the graph; absent for a standalone record,
   * which is why no pre-0021 document can resolve at this step.
   */
  inherited?: readonly InheritedAssumptions[];
  market?: MarketDataLookup;
  global?: GlobalDefaults;
  system?: SystemDefaults;
  /**
   * Exact variant per section for the in-file steps, as in
   * `CalcEvaluationContext.sectionVariants` (§VIII.2, RFC 0066).
   */
  sectionVariants?: Readonly<Record<string, string>>;
  /** Role preference per section, as the consuming calculations declare it. */
  sectionRoles?: Readonly<Record<string, Exclude<BlockRole, 'component'>>>;
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

/**
 * The one block an in-file read consults (§VIII.2, RFC 0066): the same
 * selection the calc evaluator makes, never the first fence. An ambiguous
 * variant map throws `CALC-RESOLVE-002` rather than letting fence order choose,
 * as `AmbiguousInheritanceError` does for equidistant ancestors.
 */
function getBlock(parsed: ParsedUWFile, sectionId: string, ctx: CascadeContext = {}): UWBlock | null {
  const selection: SectionSelectionOptions = {
    ...(ctx.sectionVariants ? { sectionVariants: ctx.sectionVariants } : {}),
    ...(ctx.sectionRoles ? { sectionRoles: ctx.sectionRoles } : {}),
  };
  return resolveSectionBlock(parsed, sectionId, selection);
}

function splitFieldPath(field_path: string): { sectionId: string; rest: string } | null {
  const dot = field_path.indexOf('.');
  if (dot === -1) return null;
  return { sectionId: field_path.slice(0, dot), rest: field_path.slice(dot + 1) };
}

/** Look up a value in `parsed.sections[section].content` for the given path. */
function readFromSection(parsed: ParsedUWFile, field_path: string, ctx: CascadeContext = {}): unknown {
  const split = splitFieldPath(field_path);
  if (!split) return undefined;
  const block = getBlock(parsed, split.sectionId, ctx);
  if (!block) return undefined;
  return deepGet(blockPayload(block), split.rest);
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
 * resolution tag matches one of the wanted tags. Effective tag, per RFC 0031:
 * field_override.resolution → field_override.source → block.meta.resolution →
 * block.meta.source, most specific first. The two `source` fallbacks carry the
 * pre-split spelling (a tag in the actor field), which §2.6 read-time
 * interpretation keeps meaningful; a properly-split file matches on
 * `resolution` and its actor never collides with a tag.
 *
 * Used to detect user_override / user_input / market_data values already
 * recorded in the file. A variant-map section consults only the block §VIII.2
 * selects (RFC 0066).
 */
function findBySource(
  parsed: ParsedUWFile,
  field_path: string,
  wanted: SourceTag[],
  ctx: CascadeContext,
): { block: UWBlock; value: unknown; source: SourceTag } | null {
  const split = splitFieldPath(field_path);
  if (!split) return null;
  // Only the selected block's value is in the file for this read. Another
  // variant's tagged value belongs to a different statement (another tranche,
  // another scenario) and never stands in for it. The value is read from the
  // block's payload, as the calc evaluator reads it (§VIII.2).
  const block = getBlock(parsed, split.sectionId, ctx);
  if (!block) return null;
  const value = deepGet(blockPayload(block), split.rest);
  if (value === undefined) return null;
  const override = findFieldOverride(block, split.rest);
  const effective =
    override?.resolution ?? override?.source ?? block.meta.resolution ?? block.meta.source;
  return effective !== undefined && wanted.includes(effective)
    ? { block, value, source: effective }
    : null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a value for `field_path` by walking the cascade defined in protocol
 * §V.7. The first step that yields a value wins.
 *
 * Cascade order:
 *   1. user_override (in-file, source-tag match)
 *   2. user_input (in-file, source-tag match; also market_data_accepted)
 *   3. inherited_assumption (ctx.inherited — composition DAG only)
 *   4. investor_profile (ctx.profile)
 *   5. market_data (ctx.market)
 *   6. asset_class_default (defaults registry)
 *   7. global_default (ctx.global)
 *   8. system_default (ctx.system)
 *
 * Throws `AmbiguousInheritanceError` when two equidistant ancestors assert the
 * same field, and a `CalcError` `CALC-RESOLVE-002` when the field's section is
 * a variant map §VIII.2 cannot select from (RFC 0066). Resolution refuses
 * rather than choosing in both cases.
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
  const override = findBySource(parsed, field_path, ['user_override'], ctx);
  if (override) {
    return { value: override.value, source: 'user_override', step: 'user_override' };
  }

  // Step 2: user_input ('manual' is a synonym for typed-in values).
  //
  // `market_data_accepted` resolves here too (RFC 0022 §4). It is an in-file
  // value of record, not a fallback: the analyst accepted one observation of
  // one vintage, and a later live lookup MUST NOT silently replace it. Placing
  // it here rather than at step 4 is what makes promotion stop the field being
  // ranked as an unresolved gap.
  //
  // The returned `source` is the tag found, so `market_data_accepted` survives
  // resolution rather than being flattened into `user_input`. Only the *step*
  // is shared — the cascade is normatively ordered and a producer must not
  // reorder it (protocol §IX), so a promoted value is a distinctly tagged value
  // resolved at an existing step rather than a step of its own. Extending the
  // cascade is a protocol change, which is what RFC 0021 §5 did for
  // `inherited_assumption`; RFC 0022 deliberately did not need one.
  const input = findBySource(parsed, field_path, ['user_input', 'manual', 'market_data_accepted'], ctx);
  if (input) {
    return { value: input.value, source: input.source, step: 'user_input' };
  }

  // Step 3: inherited_assumption (RFC 0021 §5).
  //
  // Below `user_input`, so a value entered on the deal always wins —
  // inheritance supplies defaults, never overrides. Above `investor_profile`,
  // because a named ancestor in this deal's own composition DAG is more
  // specific than an institution-wide preference set.
  if (ctx.inherited && ctx.inherited.length > 0) {
    // Throws on equidistant ancestors rather than picking one. Deliberate: a
    // silent pick would make the answer depend on traversal order.
    const ancestor = selectInheritedAssumption(field_path, ctx.inherited);
    if (ancestor) {
      return {
        value: ancestor.values[field_path],
        source: 'inherited_assumption',
        step: 'inherited_assumption',
        resolved_from: ancestor.document_id,
      };
    }
  }

  // Step 4: investor_profile
  if (ctx.profile && field_path in ctx.profile.values) {
    return {
      value: ctx.profile.values[field_path],
      source: 'investor_profile',
      step: 'investor_profile',
      resolved_from: ctx.profile.source_id,
    };
  }

  // Step 5: market_data
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
        ...(hit.source_id ? { resolved_from: hit.source_id } : {}),
      };
    }
  }

  // Also recognize an existing market_data tag already stamped in-file.
  const inFileMarket = findBySource(parsed, field_path, ['market_data'], ctx);
  if (inFileMarket) {
    return { value: inFileMarket.value, source: 'market_data', step: 'market_data' };
  }

  // Step 6: asset_class_default
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

  // Step 7: global_default
  if (ctx.global && field_path in ctx.global.values) {
    return {
      value: ctx.global.values[field_path],
      source: 'global_default',
      step: 'global_default',
    };
  }

  // Step 8: system_default
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
 * A variant-map section is read through the same selection as the cascade.
 */
export function readInFile(parsed: ParsedUWFile, field_path: string, ctx: CascadeContext = {}): unknown {
  return readFromSection(parsed, field_path, ctx);
}
