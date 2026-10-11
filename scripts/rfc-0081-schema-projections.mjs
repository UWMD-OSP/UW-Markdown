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
    if (Array.isArray(result.calculations) && result.calculations.length) result.requires_profiles = ['module'];
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
