// RFC 0031 — `uwmd migrate --source-tags`: rewrite legacy `_meta.source`
// values into the actor / resolution split.
//
// The mapping is total over every source the corpus measurement surfaced
// (RFC 0031 §"Measured against our own corpus") and mechanical: a canonical
// SOURCE_TAGS value moves to `_meta.resolution` and the actor field is filled
// from what the block itself records (agent_id where present, `manual` for
// user-entered methods, `system/uwmd` for engine-resolved ones); retired
// colon forms swap delimiter into their namespace; bare words map per the
// table below. A source the mapping does not know is left untouched and
// reported, never guessed at.

import type { UWFieldOverride, UWMeta } from './types.js';
import { SOURCE_TAGS } from './types.js';
import { parseActorSource } from './protocol.js';

const CANONICAL: ReadonlySet<string> = new Set(SOURCE_TAGS);

/** Result of migrating one document. */
export interface SourceTagMigration {
  content: string;
  /** Number of blocks whose `_meta` changed. */
  changed: number;
  /** Sources the mapping did not recognize, left in place. */
  unmapped: string[];
}

interface ActorAndResolution {
  source: string;
  resolution?: string;
}

/** Sanitize an id into the actor grammar's id charset. */
function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return cleaned.length > 0 ? cleaned : 'unspecified';
}

/**
 * Map one legacy `_meta.source` value. Returns null when the value is already
 * well-formed (actor grammar) or unknown to the mapping.
 *
 * `agentId` — the block's `_meta.agent_id`, consulted for method-only tags
 * that an agent stamped (`ai_extracted`, `agent_computed`), so the actor is
 * recovered from the block instead of invented.
 */
export function mapLegacySource(
  source: string,
  agentId?: string | null,
): ActorAndResolution | null {
  if (parseActorSource(source).kind !== 'invalid') return null; // already well-formed

  // Canonical resolution tags in the actor field: the tag becomes
  // `resolution`; the actor is recovered from what the tag itself implies.
  if (CANONICAL.has(source)) {
    const resolution = source;
    if (source === 'user_input' || source === 'user_override') {
      return { source: 'manual', resolution };
    }
    if (source === 'ai_extracted' || source === 'agent_computed') {
      return { source: agentId ? `agent/${sanitizeId(agentId)}` : 'agent/unattributed', resolution };
    }
    // Engine-resolved methods: the reference resolver wrote the block.
    return { source: 'system/uwmd', resolution };
  }

  // Retired colon forms — delimiter swap into the owning namespace.
  const colon = /^(agent|wizard|engine|import|market|profile|scenario|user):(.*)$/.exec(source);
  if (colon) {
    const id = sanitizeId(colon[2] ?? '');
    switch (colon[1]) {
      case 'agent': return { source: `agent/${id}` };
      case 'engine': return { source: `system/${id}` };
      case 'import': return { source: `document/${id}` };
      case 'market': return { source: `system/${id}`, resolution: 'market_data' };
      case 'profile': return { source: 'system/investor-profile', resolution: 'investor_profile' };
      case 'scenario': return { source: 'system/scenarios', resolution: 'scenario_default' };
      case 'wizard': return { source: 'manual', resolution: 'user_input' };
      case 'user':
        return colon[2] === 'override'
          ? { source: 'manual', resolution: 'user_override' }
          : { source: 'manual', resolution: 'user_input' };
    }
  }

  // Bare words the corpus measurement surfaced.
  switch (source) {
    case 'user': return { source: 'manual' };
    case 'wizard': return { source: 'manual', resolution: 'user_input' };
    case 'extractor': return { source: 'system/extractor', resolution: 'ai_extracted' };
    case 'engine': return { source: 'system/engine' };
    case 'system': return { source: 'system/unspecified' };
  }

  // Bancroft layer ids stamped bare (`L6`, `L6-01`).
  if (/^L\d+(-\d+)?[a-b]?$/i.test(source)) return { source: `agent/${sanitizeId(source)}` };

  return null;
}

const FENCE_OPEN_RE = /^```json\s+uw:section=(\S+)(.*)?$/;
const FENCE_CLOSE_RE = /^```\s*$/;

/**
 * Migrate every section block of a structured `.uwx.md` / legacy `.uw.md`
 * document. Bytes outside migrated blocks are preserved exactly; a migrated
 * block is re-serialized with 2-space indentation (the corpus convention) and
 * its fence `source=` mirror updated to the new actor.
 *
 * Blocks carrying `content_hash` are refused (reported via `unmapped` as
 * `<source> [content_hash]`) rather than silently invalidating an integrity
 * chain — re-stamping a hashed chain is a deliberate act, not a codemod.
 */
export function migrateSourceTags(content: string): SourceTagMigration {
  // EOL-aware: a CRLF working copy (Windows autocrlf) would otherwise blind
  // the fence regexes — `.` and `$` refuse to cross a bare `\r` — and the
  // rewrite must give back the endings it was handed.
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\n/);
  const out: string[] = [];
  const unmapped: string[] = [];
  let changed = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = FENCE_OPEN_RE.exec(line);
    if (!fence) {
      out.push(line);
      i++;
      continue;
    }

    // Collect the block.
    const fenceLine = line;
    const jsonLines: string[] = [];
    i++;
    while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i]!)) {
      jsonLines.push(lines[i]!);
      i++;
    }
    const closed = i < lines.length;
    const rawJson = jsonLines.join('\n');

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    const meta = parsed?.['_meta'] as (UWMeta & Record<string, unknown>) | undefined;
    const mapped = meta && typeof meta.source === 'string'
      ? mapLegacySource(meta.source, meta.agent_id)
      : null;

    // Field overrides migrate independently of the block-level source.
    const overrides = (meta?.field_overrides ?? []) as (UWFieldOverride & Record<string, unknown>)[];
    const overrideMoves = overrides.filter(
      (o) => typeof o.source === 'string' && CANONICAL.has(o.source) && o.resolution === undefined,
    );

    if (!parsed || !meta || (!mapped && overrideMoves.length === 0)) {
      if (meta && typeof meta.source === 'string'
        && parseActorSource(meta.source).kind === 'invalid' && !mapped) {
        unmapped.push(meta.source);
      }
      out.push(fenceLine, ...jsonLines);
      if (closed) { out.push(lines[i]!); i++; }
      continue;
    }

    if (typeof meta.content_hash === 'string') {
      unmapped.push(`${String(meta.source)} [content_hash]`);
      out.push(fenceLine, ...jsonLines);
      if (closed) { out.push(lines[i]!); i++; }
      continue;
    }

    if (mapped) {
      // Rebuild _meta so `resolution` sits directly after `source`, keeping
      // the provenance pair adjacent in the serialized block.
      const rebuilt: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(meta)) {
        if (k === 'resolution') continue;
        rebuilt[k] = k === 'source' ? mapped.source : v;
        if (k === 'source') {
          const resolution = mapped.resolution ?? (meta['resolution'] as string | undefined);
          if (resolution !== undefined) rebuilt['resolution'] = resolution;
        }
      }
      parsed['_meta'] = rebuilt;
    }
    for (const o of overrideMoves) {
      o.resolution = o.source;
      delete o.source;
    }

    changed++;
    out.push(
      mapped ? fenceLine.replace(/\bsource=\S+/, `source=${mapped.source}`) : fenceLine,
      ...JSON.stringify(parsed, null, 2).split('\n'),
    );
    if (closed) { out.push(lines[i]!); i++; }
  }

  return { content: out.join(eol), changed, unmapped: [...new Set(unmapped)] };
}
