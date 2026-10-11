import { readFileSync } from 'node:fs';
import { CONFORMANCE_TARGETS, CONFORMANCE_PROFILES, readConformanceTier } from '../packages/uwmd-core/dist/protocol.js';

export const corpus = JSON.parse(readFileSync(new URL('../conformance/corpus-index.json', import.meta.url), 'utf8'));
export const suiteFamily = suite => suite === '3-refinement' ? '3' : suite === '4-profile' ? '4' : suite;
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
export const legacyNames = ['tier-1-reader', 'tier-2-editor', 'tier-3-calc-host', 'tier-4-agent-host'];
// A numeric short is exactly one digit 1-4, as the Python driver's generated
// reading table has it. Number() would also accept '3.0', '0x3', '1e0', '+3'
// and ' 3', silently widening the selector vocabulary on one side only.
export const legacyAlias = name => /^[1-4]$/.test(name) ? legacyNames[Number(name) - 1] : name;
export const tierReadings = Object.fromEntries(['reader', 'verifier', ...legacyNames, '1', '2', '3', '4'].map(value => [value, readConformanceTier(legacyAlias(value))]));
export const portableReadings = { targets: CONFORMANCE_TARGETS, profiles: CONFORMANCE_PROFILES, tiers: tierReadings };
export const publicOwner = target => ({ target, ...(target === 'reader' || target === 'verifier' ? { tier: target } : target === 'starter-products' ? { starter_product: true } : { profile: target }) });

export function selection(args, warn = message => console.error(message)) {
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
    const reading = readConformanceTier(legacyAlias(name));
    if (reading) {
      targets.add(reading.tier);
      if (reading.tier === 'verifier') targets.add('reader');
      if (reading.legacy) warn(`Deprecated tier '${name}': use '${reading.tier}'; no profiles or starter-product claims are inferred.`);
    } else if (corpus.cases.some(c => c.suite === name)) {
      suites.add(name);
      warn(`Deprecated suite selector '--tier=${name}': use '--suite=${name}'.`);
    } else throw new Error(`Unknown tier: ${name}`);
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
export function portableOwner(id) {
  let suite;
  let scenario;
  if (id.startsWith('tier-1-malformed/')) [suite, scenario] = ['1', `malformed/${id.slice('tier-1-malformed/'.length)}`];
  else if (id.startsWith('tier-1/')) {
    const [, stem, action] = id.split('/');
    [suite, scenario] = ['1', `${stem} [${action}]`];
  } else if (id.startsWith('tier-2/')) [suite, scenario] = ['2', id.slice(7)];
  else if (id.startsWith('tier-3/')) [suite, scenario] = ['3', id.slice(7)];
  else {
    const slash = id.indexOf('/');
    suite = id.slice(0, slash); scenario = id.slice(slash + 1);
    if (suite === 'replacement-funding') suite = 'hedge';
  }
  const found = index.get(key(suite, scenario));
  if (!found) throw new Error(`Portable case has no corpus owner: ${id} (${suite}/${scenario})`);
  return found.target;
}
