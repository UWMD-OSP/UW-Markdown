// The `gaps` section's content (Format Spec §4.22): its types and the reader
// the validator's DQ rules use. Standard side (RFC 0083); gap inference,
// merging and stage summaries are starter tools in gaps.ts.

import { getSection } from './parser.js';
import type { DealStage, ParsedUWFile } from './types.js';

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
