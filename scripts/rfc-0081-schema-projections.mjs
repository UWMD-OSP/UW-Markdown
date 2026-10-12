import { reshapeMetaV1toV2, reshapeMetaV2toV1 } from '../packages/uwmd-core/dist/meta-shape.js';
// Test-only projections while RFC 0081 Phases 3–4 are pending. No runtime reader
// uses these; remove them when the corpus and loader use the final contract.
// Malformed or unknown values are preserved so refusal controls remain effective.
const tiers = {
  'tier-1-reader': 'reader', 'tier-2-editor': 'reader',
  'tier-3-calc-host': 'verifier', 'tier-4-agent-host': 'verifier',
};
export function projectModuleContract(manifest) {
  const result = structuredClone(manifest);
  if (Object.hasOwn(result, 'requires_tier') && !Object.hasOwn(result, 'requires_conformance')) {
    result.requires_conformance = tiers[result.requires_tier] ?? result.requires_tier;
    delete result.requires_tier;
    if (!Object.hasOwn(result, 'requires_profiles') && Array.isArray(result.calculations) && result.calculations.length) result.requires_profiles = ['module'];
  }
  return result;
}
export function projectCaseContract(value) {
  const { legacy_id: _legacy, ...result } = value;
  return result;
}
export function projectCorpusContract(value) {
  const { migration_base: _base, before: _before, portable_legacy_ids: _portable, ...result } = value;
  return { ...result, cases: result.cases.map(({ added: _added, ...entry }) => entry) };
}

// RFC 0081 Phase 4: delete these test-only projections with the old suites.
// The authored corpus is 3.0; retiring migration/shim tests still synthesize
// their old inputs so the old code remains tested until its deletion.

export function projectCompiledLite(content) {
  return content.replace(/^uw_version:.*$/m, 'uw_version: "3.0"').replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (_match, section, annotations, raw) => {
    const block = JSON.parse(raw);
    const meta = block._meta;
    if (meta && !meta.provenance) block._meta = reshapeMetaV1toV2(meta);
    const { section_id: _old, ...rest } = block;
    return `\`\`\`json uw:section=${section}${annotations}\n${JSON.stringify(rest,null,2)}\n\`\`\``;
  });
}
export function legacyTestDocument(content, {version=[1,1].join('.'), flat=true, legacySource, manualResolution=false}={}) {
  return content.replace(/^uw_version:.*$/m, `uw_version: "${version}"`).replace(/^```json uw:section=(\S+)([^\n]*)\n([\s\S]*?)^```\s*$/gm, (_match, section, annotations, raw) => {
    const block = JSON.parse(raw); let meta = block._meta;
    if (flat && meta?.provenance) meta = reshapeMetaV2toV1(meta);
    if (legacySource && meta) { if(flat) meta.source=legacySource;else meta.provenance.source=legacySource; }
    if(manualResolution && meta) { if(flat) meta.resolution='manual';else meta.provenance.resolution='manual'; }
    if(meta) block._meta=meta;
    return `\`\`\`json uw:section=${section}${annotations}\n${JSON.stringify(block,null,2)}\n\`\`\``;
  });
}
