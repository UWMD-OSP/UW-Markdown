// Gaps inference + summarization — Format Spec §4.22
//
// A "gap" is an open data deficiency that may block stage advancement or
// carry a provisional default. This module:
//   - Walks the parsed file looking for missing-required, partial, or
//     provisional state and emits a normalized GapItem per finding.
//   - Merges with an existing `gaps` section (deduping by section + path).
//   - Summarizes the resulting list relative to a current stage.

import { STAGE_REQUIREMENTS } from './validator.js';
import { deepGet, getSection } from './parser.js';
import type { DealStage, ParsedUWFile, UWBlock } from './types.js';

export type GapReason =
  | 'missing'
  | 'illegible'
  | 'out_of_scope'
  | 'deferred'
  | 'blocked_by_dependency'
  | 'awaiting_external';

export interface GapItem {
  section: string;
  field_path?: string;
  reason: GapReason;
  blocks_stage?: DealStage;
  first_seen?: string;
  last_checked?: string;
  owner?: string;
  note?: string;
}

export interface GapSummary {
  total_open: number;
  blocking_current_stage: number;
  blocking_next_stage: number;
}

export interface GapsContent {
  items: GapItem[];
  summary?: GapSummary;
}

// ─── Stage helpers ───────────────────────────────────────────────────────────

const STAGE_ORDER: readonly DealStage[] = [
  'scope',
  'screening',
  'term_sheet',
  'full_underwrite',
  'credit_approval',
  'closing',
  'monitoring',
];

function nextStage(stage: DealStage): DealStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function blocksAtOrBefore(item: GapItem, stage: DealStage): boolean {
  if (!item.blocks_stage) return false;
  const itemIdx = STAGE_ORDER.indexOf(item.blocks_stage);
  const stageIdx = STAGE_ORDER.indexOf(stage);
  return itemIdx !== -1 && stageIdx !== -1 && itemIdx <= stageIdx;
}

// ─── Inference ───────────────────────────────────────────────────────────────

export interface InferGapsOptions {
  /** Stage to evaluate readiness against. Defaults to file's deal_stage,
   *  falling back to 'scope'. */
  stage?: DealStage;
  /** When true, merge with the existing `gaps` section instead of returning
   *  inferred items only. Dedup key = `(section, field_path ?? '')`. */
  mergeWithExisting?: boolean;
  /** Timestamp to stamp on `first_seen` / `last_checked` for newly inferred
   *  items. Defaults to `new Date().toISOString()`. */
  now?: string;
  /** When true, the item's `owner` is left undefined; when false (default),
   *  inferred items are assigned `agent/gaps-inferrer` as a provenance hint. */
  unattributed?: boolean;
}

function blockOf(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if ('annotation' in (entry as object)) return entry as UWBlock;
  // Multi-variant sections: take the first variant for inference purposes.
  // Variant-specific gap inference is left to RFC 0009.
  const variants = Object.values(entry as Record<string, UWBlock>);
  return variants[0] ?? null;
}

function pathExistsInSection(parsed: ParsedUWFile, sectionId: string, rest: string): boolean {
  const block = blockOf(parsed, sectionId);
  if (!block) return false;
  return deepGet(block.content, rest) !== undefined;
}

function splitFieldPath(field_path: string): { sectionId: string; rest: string } | null {
  const dot = field_path.indexOf('.');
  if (dot === -1) return null;
  return { sectionId: field_path.slice(0, dot), rest: field_path.slice(dot + 1) };
}

function findStageThatRequires(field_path: string, currentStage: DealStage): DealStage | undefined {
  const split = splitFieldPath(field_path);
  for (const stage of STAGE_ORDER) {
    const req = STAGE_REQUIREMENTS[stage];
    if (req.required_field_paths?.includes(field_path)) return stage;
    // If a section is required but the field is inside it, attribute to that stage.
    if (split && req.required_sections.includes(split.sectionId)) return stage;
  }
  return currentStage;
}

/**
 * Walk the parsed file and produce a normalized list of GapItems by inspecting:
 *   - STAGE_REQUIREMENTS: required sections / field paths missing at the
 *     evaluated stage produce reason='missing'.
 *   - `_meta.provisional`: produces reason='deferred' (placeholder block).
 *   - `_meta.partial`: produces reason='missing' for the section as a whole,
 *     unless `field_overrides` enumerate specific paths (then one item per
 *     override with `reason='illegible'` for illegible, else 'missing').
 *   - `_meta.field_overrides[]` with reason='missing'|'illegible': one
 *     GapItem per entry.
 *
 * When `mergeWithExisting` is set, the existing `gaps` section is read and
 * merged. Existing items win on dedup (their `first_seen`, `owner`, `note`
 * are preserved); the inferrer only refreshes `last_checked`.
 */
export function inferGaps(parsed: ParsedUWFile, opts: InferGapsOptions = {}): GapItem[] {
  const stage: DealStage = opts.stage ?? parsed.frontmatter.deal_stage ?? 'scope';
  const now = opts.now ?? new Date().toISOString();
  const owner = opts.unattributed ? undefined : 'agent/gaps-inferrer';

  const inferred: GapItem[] = [];
  const seen = new Set<string>();
  const keyOf = (sectionId: string, fieldPath?: string) => `${sectionId}::${fieldPath ?? ''}`;
  const push = (item: GapItem) => {
    const k = keyOf(item.section, item.field_path);
    if (seen.has(k)) return;
    seen.add(k);
    inferred.push(item);
  };

  // 1) Stage-required sections that are absent
  const req = STAGE_REQUIREMENTS[stage];
  for (const sectionId of req.required_sections) {
    if (!parsed.sections[sectionId]) {
      push({
        section: sectionId,
        reason: 'missing',
        blocks_stage: stage,
        first_seen: now,
        last_checked: now,
        owner,
        note: `Required section for stage '${stage}' is absent.`,
      });
    }
  }

  // 2) Stage-required field paths that are absent
  if (req.required_field_paths) {
    for (const fp of req.required_field_paths) {
      const split = splitFieldPath(fp);
      if (!split) continue;
      if (!pathExistsInSection(parsed, split.sectionId, split.rest)) {
        push({
          section: split.sectionId,
          field_path: split.rest,
          reason: 'missing',
          blocks_stage: stage,
          first_seen: now,
          last_checked: now,
          owner,
          note: `Required field for stage '${stage}'.`,
        });
      }
    }
  }

  // 3) required_one_of: at least one path of each group must exist
  if (req.required_one_of) {
    for (const group of req.required_one_of) {
      const anyPresent = group.some((fp) => {
        const split = splitFieldPath(fp);
        if (!split) return false;
        return pathExistsInSection(parsed, split.sectionId, split.rest);
      });
      if (!anyPresent) {
        const first = splitFieldPath(group[0]);
        if (first) {
          push({
            section: first.sectionId,
            field_path: first.rest,
            reason: 'missing',
            blocks_stage: stage,
            first_seen: now,
            last_checked: now,
            owner,
            note: `One of [${group.join(', ')}] required for stage '${stage}'.`,
          });
        }
      }
    }
  }

  // 4) Walk every present section's _meta
  for (const sectionId of Object.keys(parsed.sections)) {
    const block = blockOf(parsed, sectionId);
    if (!block) continue;
    const m = block.meta;

    if (m.provisional) {
      push({
        section: sectionId,
        reason: 'deferred',
        blocks_stage: findStageThatRequires(`${sectionId}.`, stage),
        first_seen: now,
        last_checked: now,
        owner,
        note: 'Block is provisional — derived from defaults rather than observed data.',
      });
    }

    const overrides = m.field_overrides ?? [];
    const missingOverrides = overrides.filter(
      (o) => o.reason === 'missing' || o.reason === 'illegible',
    );

    if (missingOverrides.length > 0) {
      for (const o of missingOverrides) {
        push({
          section: sectionId,
          field_path: o.path,
          reason: o.reason === 'illegible' ? 'illegible' : 'missing',
          blocks_stage: findStageThatRequires(`${sectionId}.${o.path}`, stage),
          first_seen: now,
          last_checked: now,
          owner,
          note: o.note,
        });
      }
    } else if (m.partial) {
      // partial=true but no field_overrides enumeration; record the section.
      push({
        section: sectionId,
        reason: 'missing',
        blocks_stage: findStageThatRequires(`${sectionId}.`, stage),
        first_seen: now,
        last_checked: now,
        owner,
        note: 'Block flagged partial without field-level enumeration.',
      });
    }
  }

  if (!opts.mergeWithExisting) return inferred;

  // ── Merge with existing gaps section ───────────────────────────────────────
  const existing = readGapsContent(parsed);
  if (!existing) return inferred;

  const out: GapItem[] = [];
  const existingByKey = new Map<string, GapItem>();
  for (const e of existing.items) existingByKey.set(keyOf(e.section, e.field_path), e);

  for (const inf of inferred) {
    const k = keyOf(inf.section, inf.field_path);
    const prior = existingByKey.get(k);
    if (prior) {
      out.push({
        ...prior,
        last_checked: now,
        // Preserve prior `reason`, `owner`, `first_seen`, `note`; refresh
        // `blocks_stage` from inference (the stage may have advanced).
        blocks_stage: inf.blocks_stage ?? prior.blocks_stage,
      });
      existingByKey.delete(k);
    } else {
      out.push(inf);
    }
  }
  // Carry over prior items the inference run didn't re-discover, untouched.
  for (const remaining of existingByKey.values()) out.push(remaining);
  return out;
}

// ─── Summarization ───────────────────────────────────────────────────────────

/**
 * Aggregate counts for fast pipeline routing. Mirrors the `summary` object in
 * the gaps section schema (spec/schemas/section-gaps.schema.json).
 */
export function summarizeGaps(items: readonly GapItem[], currentStage: DealStage): GapSummary {
  const next = nextStage(currentStage);
  let blocking_current = 0;
  let blocking_next = 0;
  for (const item of items) {
    if (blocksAtOrBefore(item, currentStage)) blocking_current++;
    else if (next && blocksAtOrBefore(item, next)) blocking_next++;
  }
  return {
    total_open: items.length,
    blocking_current_stage: blocking_current,
    blocking_next_stage: blocking_next,
  };
}

// ─── Reading the existing gaps section ───────────────────────────────────────

/**
 * Pull the typed content out of the file's `gaps` section. Returns null when
 * the section is absent or malformed.
 */
export function readGapsContent(parsed: ParsedUWFile): GapsContent | null {
  const block = getSection(parsed, 'gaps');
  if (!block) return null;
  const c = block.content as Partial<GapsContent> | null;
  if (!c || !Array.isArray(c.items)) return null;
  return { items: c.items as GapItem[], summary: c.summary };
}
