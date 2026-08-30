// Block/file fixtures shared by this package's tests.
//
// Not exported from `index.ts`: these are test scaffolding, and shipping a
// block factory in the public API would invite production code to build blocks
// that never went through the parser.

import { computeBlockHash, type ParsedUWFile, type UWBlock } from '@uwmd/core';

export function makeBlock(
  sectionId: string,
  content: Record<string, unknown>,
  meta: Partial<UWBlock['meta']> = {},
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content,
    meta: {
      section: sectionId,
      version: 1,
      superseded: false,
      source: 'manual',
      agent_id: null,
      agent_version: null,
      actor: 'human/jared',
      timestamp: '2026-08-27T00:00:00Z',
      confidence: 'medium',
      human_review_required: false,
      flags: [],
      input_hash: null,
      notes: null,
      ...meta,
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

export async function hashedBlock(
  sectionId: string,
  content: Record<string, unknown>,
  meta: Partial<UWBlock['meta']> = {},
): Promise<UWBlock> {
  const block = makeBlock(sectionId, content, meta);
  return { ...block, meta: { ...block.meta, content_hash: await computeBlockHash(block) } };
}

export function makeFile(
  sections: Record<string, UWBlock>,
  superseded: Record<string, UWBlock[]> = {},
): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections,
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded,
    raw: '',
  };
}
