// Block metadata helpers (Format §2.4–§2.5, RFC 0081 §3).
//
// There is one `_meta` shape on disk and in memory: the nested object of
// `uwmd-block.schema.json`. Writers stamp it as the block's first member;
// per-field exceptions live beside it in the block-level `_overrides`.

import type { UWBlock, UWFieldOverride, UWMeta } from './types.js';

/** Write `meta` into a block object as its first member (Format §2.4). */
export function stampMetaIntoBlockContent(content: Record<string, unknown>, meta: UWMeta): void {
  const payload = { ...content };
  delete payload['_meta'];
  for (const key of Object.keys(content)) delete content[key];
  content['_meta'] = meta;
  Object.assign(content, payload);
}

/**
 * Advance a block's supersede-chain position and write time in place, for an
 * append-only block (the pipeline log) that is rewritten rather than
 * superseded. Returns the new revision for the fence `v=` mirror.
 */
export function bumpRawMetaVersion(meta: UWMeta, now: string): number {
  meta.lifecycle.revision += 1;
  meta.provenance.timestamp = now;
  return meta.lifecycle.revision;
}

/** A block's per-field metadata exceptions: its `_overrides` member (Format §2.5f). */
export function blockOverrides(block: Pick<UWBlock, 'content'>): UWFieldOverride[] {
  const overrides = block.content['_overrides'];
  return Array.isArray(overrides) ? (overrides as UWFieldOverride[]) : [];
}
