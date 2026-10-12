// Block/file fixtures shared by this package's tests.
//
// Not exported from `index.ts`: these are test scaffolding, and shipping a
// block factory in the public API would invite production code to build blocks
// that never went through the parser.

import { computeBlockHash, type ParsedUWFile, type UWBlock, type UWIntegrity } from '@uwmd/core';

export function makeBlock(
  sectionId: string,
  content: Record<string, unknown>,
  integrity?: UWIntegrity,
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content,
    meta: {
      section: sectionId,
      provenance: { source: 'manual', actor: 'human/jared', agent_id: null, agent_version: null, timestamp: '2026-08-27T00:00:00Z', notes: null },
      quality: { confidence: 'medium', human_review_required: false, flags: [] },
      lifecycle: { revision: 1, superseded: false },
      ...(integrity ? { integrity } : {}),
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
  integrity?: UWIntegrity,
): Promise<UWBlock> {
  const block = makeBlock(sectionId, content, integrity);
  return { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, content_hash: await computeBlockHash(block) } } };
}

export function makeFile(
  sections: Record<string, UWBlock>,
  superseded: Record<string, UWBlock[]> = {},
): ParsedUWFile {
  return {
    frontmatter: { uw_version: '3.0', asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
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
