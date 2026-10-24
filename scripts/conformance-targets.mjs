import { readFileSync } from 'node:fs';
import { CONFORMANCE_TARGETS, CONFORMANCE_PROFILES, isConformanceTier } from '../packages/uwmd-verify/dist/protocol.js';

export const corpus = JSON.parse(readFileSync(new URL('../conformance/corpus-index.json', import.meta.url), 'utf8'));
export const suiteFamily = suite => suite === 'starter-refinement' ? 'calc' : suite;
export const key = (suite, scenario) => JSON.stringify([String(suite), scenario]);
export function indexCases(cases) {
  const index = new Map();
  for (const c of cases) {
    if (!CONFORMANCE_TARGETS.includes(c.target)) throw new Error(`Unknown conformance target: ${c.target}`);
    const id = key(c.suite, c.scenario);
    if (index.has(id)) throw new Error(`Duplicate corpus case: ${id}`);
    index.set(id, c);
  }
  return index;
}
export const index = indexCases(corpus.cases);
// The closed vocabulary the Python driver reads (conformance/runner/vocabulary.json),
// generated from protocol.ts so the two runners never keep a second mapping.
export const portableVocabulary = {
  targets: CONFORMANCE_TARGETS,
  profiles: CONFORMANCE_PROFILES,
  tiers: CONFORMANCE_TARGETS.filter(isConformanceTier),
};
export const publicOwner = target => ({ target, ...(target === 'reader' || target === 'verifier' ? { tier: target } : target === 'starter-products' ? { starter_product: true } : { profile: target }) });

export function selection(args) {
  const value = name => {
    const equals = args.find(a => a.startsWith(`--${name}=`));
    if (equals !== undefined) return equals.slice(name.length + 3);
    const position = args.indexOf(`--${name}`);
    if (position < 0) return undefined;
    const next = args[position + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${name}`);
    return next;
  };
  const split = text => text?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const targets = new Set();
  const suites = new Set(split(value('suite')));
  for (const name of split(value('tier'))) {
    // Only the two tiers: no alias, numeric short or suite name (RFC 0081 §8).
    if (!isConformanceTier(name)) throw new Error(`Unknown tier: ${name} (use reader or verifier; select fixture families with --suite)`);
    targets.add(name);
    if (name === 'verifier') targets.add('reader');
  }
  for (const name of split(value('profile'))) {
    if (!CONFORMANCE_PROFILES.includes(name)) throw new Error(`Unknown profile: ${name}`);
    targets.add(name);
  }
  if (args.includes('--starter-products')) targets.add('starter-products');
  for (const name of suites) if (!corpus.cases.some(c => c.suite === name)) throw new Error(`Unknown suite: ${name}`);
  if (!targets.size) for (const target of CONFORMANCE_TARGETS) targets.add(target);
  if (args.includes('--update') && (value('tier') || value('profile') || args.includes('--starter-products'))) throw new Error('Baseline updates require a full run or --suite; target-filtered updates could overwrite unselected baselines.');
  const cases = corpus.cases.filter(c => targets.has(c.target) && (!suites.size || suites.has(c.suite) || suites.has(suiteFamily(c.suite))));
  if (!cases.length) throw new Error('No cases matched');
  if (args.includes('--update')) {
    const families = new Set(cases.map(c => suiteFamily(c.suite)));
    const selectedIds = new Set(cases.map(c => key(c.suite, c.scenario)));
    const outside = corpus.cases.find(c => families.has(suiteFamily(c.suite)) && !selectedIds.has(key(c.suite, c.scenario)));
    if (outside) throw new Error(`Baseline updates require the entire suite family: use --suite=${suiteFamily(outside.suite)}.`);
  }
  return cases;
}

/**
 * Every runner suite must own indexed cases, and every indexed suite family
 * must have a runner. A dispatch entry with no index rows would never be
 * selected, so its assertions would silently stop running.
 */
export function assertDispatch(dispatchKeys, cases = corpus.cases) {
  const families = new Set(cases.map(c => suiteFamily(c.suite)));
  const orphaned = [...dispatchKeys].filter(k => !families.has(k));
  if (orphaned.length) throw new Error(`Runner suites with no corpus index rows: ${orphaned.join(', ')}`);
  const keys = new Set(dispatchKeys);
  const unrun = [...families].filter(f => !keys.has(f));
  if (unrun.length) throw new Error(`Indexed suites with no runner: ${unrun.join(', ')}`);
}

export function assertCoverage(expected, observed) {
  const wanted = indexCases(expected);
  const seen = new Set();
  for (const c of observed) {
    const id = key(c.suite, c.scenario);
    if (!wanted.has(id)) throw new Error(`Unexpected corpus case: ${id}`);
    if (seen.has(id)) throw new Error(`Duplicate corpus result: ${id}`);
    seen.add(id);
  }
  const missing = [...wanted.keys()].filter(id => !seen.has(id));
  if (missing.length) throw new Error(`Missing corpus results: ${missing.join(', ')}`);
}
/** Resolve a content-based portable identity to its reference check owner. */
export function portableOwner(suite, scenario, operation) {
  const referenceScenario = suite === 'documents' || suite === 'extension-envelope'
    ? scenario.startsWith('malformed-') ? `malformed/${scenario.slice('malformed-'.length)}` : `${scenario} [${operation}]`
    // RFC 0115 D4: a portable receipt case is the pack-less Verifier check.
    : suite === 'receipts' && scenario.startsWith('verify-') ? `verify/${scenario.slice('verify-'.length)} [pack-less]`
    : suite === 'signing' && scenario.startsWith('block-') ? `blocks/${scenario.slice('block-'.length)}`
    : scenario;
  const found = index.get(key(suite, referenceScenario));
  if (!found) throw new Error(`Portable case has no corpus owner: ${suite}/${referenceScenario}`);
  return found.target;
}
