// RFC 0081 Phase 4: delete with the retiring compatibility tests.
// Authored fixtures stay Format 3.0. Old reader/migrator tests synthesize their
// old inputs rather than retaining old on-disk corpus documents.
import { reshapeMetaV2toV1, reshapeMetaV1toV2 } from '../packages/uwmd-core/src/meta-shape.js';
import type { UWMetaV2 } from '../packages/uwmd-core/src/meta-shape.js';
export function legacyDocument(source: string, version = [1, 1].join('.')): string {
  return source.replace(/^uw_version:.*$/m, `uw_version: "${version}"`).replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (_match, section, annotations, raw) => {
    const body = JSON.parse(raw) as Record<string, unknown>;
    const meta = body._meta as UWMetaV2 | undefined;
    if (meta?.provenance) body._meta = reshapeMetaV2toV1(meta);
    return `\`\`\`json uw:section=${section}${annotations}\n${JSON.stringify(body,null,2)}\n\`\`\``;
  });
}
export function setFixtureMeta(source: string, section: string, fields: Record<string, unknown>): string {
  return source.replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (match, id, annotations, raw) => {
    if (id !== section) return match;
    const body = JSON.parse(raw) as { _meta: Record<string, unknown> };
    Object.assign(body._meta, fields);
    return `\`\`\`json uw:section=${id}${annotations}\n${JSON.stringify(body,null,2)}\n\`\`\``;
  });
}

/** Serialize dynamically assembled fixtures with the canonical on-disk shape. */
export function nestedFixtureMeta(meta: Record<string, unknown>): UWMetaV2 {
  return reshapeMetaV1toV2({ section: String(meta.section), version: 1, superseded: false,
    source: 'manual', agent_id: null, agent_version: null, actor: 'test', timestamp: String(meta.timestamp ?? meta.ts ?? '2026-10-11T00:00:00Z'),
    confidence: 'high', human_review_required: false, flags: [], input_hash: null, notes: null, ...meta });
}
