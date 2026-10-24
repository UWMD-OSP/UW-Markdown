// Protocol II.6a.6 minimum parse projection. This is a view, not a whole-model
// subject, source attribution certificate or carrier admission operation.
import { hasBlockShape } from './block-kind.js';
import { mapExtensionEntry } from './extension-entry.js';
import type { ParsedUWFile, UWBlock } from './types.js';
export interface UWPortableBlock { meta?: unknown; content: Record<string, unknown>; }
export function projectPortableBlock(block: Pick<UWBlock, 'content'>): UWPortableBlock {
  const { _meta, _notes, ...content } = block.content;
  return { ...(Object.hasOwn(block.content, '_meta') ? { meta: _meta } : {}), content };
}
export function projectUWParse(parsed: ParsedUWFile) {
  const entry = (value: UWBlock | Record<string,UWBlock>) => hasBlockShape(value)
    ? projectPortableBlock(value as UWBlock)
    : Object.fromEntries(Object.entries(value as Record<string,UWBlock>).map(([key,block])=>[key,projectPortableBlock(block)]));
  return {
    frontmatter: parsed.frontmatter,
    sections: Object.fromEntries(Object.entries(parsed.sections).map(([id,value])=>[id,entry(value)])),
    prose: parsed.prose,
    pipeline_log: parsed.pipeline_log.map(block=>block.content),
    custom_calculations: parsed.custom_calculations,
    custom_scenarios: parsed.custom_scenarios,
    extensions: Object.fromEntries(Object.entries(parsed.extensions).map(([id,value])=>[id,mapExtensionEntry(value,projectPortableBlock)])),
    superseded: Object.fromEntries(Object.entries(parsed.superseded).map(([id,blocks])=>[id,blocks.map(projectPortableBlock)])),
  };
}
