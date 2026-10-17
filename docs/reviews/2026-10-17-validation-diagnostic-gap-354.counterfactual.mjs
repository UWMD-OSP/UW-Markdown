// Isolated RFC0091 sensitivity only. Never part of production/CI activation.
// node --loader ./docs/reviews/2026-10-17-validation-diagnostic-gap-354.counterfactual.mjs scripts/run-conformance.mjs --json
// Reads compiled main, injects only the draft predicate in memory, writes no sources or expectations.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.endsWith('/uwmd-verify/dist/validator.js')) return result;
  const text = String(result.source);
  const anchor = '    checkProvenanceActors(parsed, issues);';
  if (text.split(anchor).length !== 2) throw new Error('Counterfactual requires the reviewed actor checkpoint');
  const injection = `
    // DRAFT-ONLY research injection: not an accepted diagnostic contract.
    {
      const seen = new Set();
      for (const block of [...parsedPhysicalBlocks(parsed), ...metaModelBlocks(parsed).map(([, b]) => b)]) {
        if (seen.has(block)) continue;
        seen.add(block);
        if (malformedMetaShape(block)) continue;
        const meta = block.content._meta;
        if (!metaObject(meta)) continue;
        for (const [parent, key, code] of [['quality', 'human_review_required', 'META-02'], ['lifecycle', 'superseded', 'META-03']]) {
          if (metaObject(meta[parent]) && typeof meta[parent][key] !== 'boolean') {
            issues.push({code, severity: 'error', section: block.annotation.section,
              field: '_meta.' + parent + '.' + key,
              message: 'Draft RFC0091 sensitivity: required boolean is absent or nonboolean.'});
          }
        }
      }
    }
`;
  return { ...result, source: text.replace(anchor, anchor + injection) };
}
