// RFC 0081 Phase 4: delete with the retiring compatibility tests.
// Authored fixtures stay Format 3.0. Old reader/migrator tests synthesize their
// old inputs rather than retaining old on-disk corpus documents.
import { reshapeMetaV2toV1 } from '../packages/uwmd-core/src/meta-shape.js';
import type { UWMetaV2 } from '../packages/uwmd-core/src/meta-shape.js';
export function legacyDocument(source: string, version = [1, 1].join('.')): string {
  return source.replace(/^uw_version:.*$/m, `uw_version: "${version}"`).replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (match, section, annotations, raw) => {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const meta = body._meta as UWMetaV2 | undefined;
    if (meta?.provenance) body._meta = reshapeMetaV2toV1(meta);
    return '```json uw:section='+section+annotations+'\n'+JSON.stringify(body,null,2)+'\n```';
  });
}
export function setFixtureMeta(source: string, section: string, fields: Record<string, unknown>): string {
  return source.replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (match, id, annotations, raw) => {
    if (id !== section) return match;
    const body = JSON.parse(raw) as { _meta: Record<string, unknown> };
    Object.assign(body._meta, fields);
    return '```json uw:section='+id+annotations+'\n'+JSON.stringify(body,null,2)+'\n```';
  });
}
