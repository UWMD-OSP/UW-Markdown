import type { UWMeta } from './types.js';

/** Write the single Format 3.0 shape, with _meta first (Format §3). */
export function stampMetaIntoBlockContent(content: Record<string, unknown>, meta: UWMeta): void {
  const payload = { ...content };
  delete payload['_meta'];
  for (const key of Object.keys(content)) delete content[key];
  content['_meta'] = meta;
  Object.assign(content, payload);
}

export function bumpRawMetaVersion(meta: UWMeta, now: string): number {
  meta.lifecycle.revision += 1;
  meta.provenance.timestamp = now;
  return meta.lifecycle.revision;
}
