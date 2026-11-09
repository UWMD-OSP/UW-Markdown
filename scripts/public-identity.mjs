import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const personalConfigEnvironment = 'PUBLIC_IDENTITY_CONFIG_JSON';

// Generic tracked-content rules contain no personal patterns.
export const identityRules = [
  ['private-repository', ['underwriter', '-app'].join('')],
  ['private-task', ['TA', 'SK-'].join('') + String.raw`\d`],
  ['private-upstream', ['UP', 'STREAM-'].join('') + String.raw`\d`],
  ['private-corpus', ['Golden', ' Deal'].join('')],
  ['personal-path', String.raw`C:\\+Users`],
  ['session-branch-a', ['co', 'dex/'].join('')],
  ['session-branch-b', ['clau', 'de/'].join('')],
  ['retired-product', ['Banc', 'roft'].join('')],
].map(([id, source]) => ({ id, pattern: new RegExp(source, 'g') }));

function configError(reason) {
  // Never include parser/RegExp error text, input values, or file contents.
  return new Error(`Personal identity configuration ${reason}; provide ${personalConfigEnvironment} privately in memory.`);
}

export function parsePersonalIdentityConfig(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw configError('is absent, empty or malformed'); }
  if (!value || Array.isArray(value) || typeof value !== 'object'
      || Object.keys(value).sort().join(',') !== 'rules,version'
      || value.version !== 1 || !Array.isArray(value.rules) || value.rules.length === 0) {
    throw configError('must contain version 1 and a nonempty rules array');
  }
  const ids = new Set(identityRules.map(rule => rule.id));
  return value.rules.map(rule => {
    if (!rule || Array.isArray(rule) || typeof rule !== 'object'
        || Object.keys(rule).sort().join(',') !== 'boundary,flags,id,pattern'
        || typeof rule.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(rule.id)
        || typeof rule.pattern !== 'string' || rule.pattern.trim().length === 0
        || !['', 'i'].includes(rule.flags) || !['word', 'none'].includes(rule.boundary)) {
      throw configError('contains an invalid rule schema');
    }
    if (ids.has(rule.id)) throw configError('contains duplicate or reserved rule IDs');
    ids.add(rule.id);
    try {
      const source = rule.boundary === 'word' ? String.raw`\b(?:${rule.pattern})\b` : rule.pattern;
      return { id: rule.id, pattern: new RegExp(source, `g${rule.flags}`) };
    } catch { throw configError('contains an invalid regular expression'); }
  });
}

export function publicIdentityFindings(path, text, rules = identityRules) {
  const findings = [];
  for (const { id, pattern } of rules) {
    for (const match of text.matchAll(pattern)) {
      findings.push({ path, rule: id, line: text.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

export function trackedPublicIdentityFindings(root, {
  mode = 'required', configJSON = process.env[personalConfigEnvironment],
} = {}) {
  if (!['required', 'generic'].includes(mode)) throw new Error('Identity scan mode must be required or generic.');
  const rules = mode === 'required' ? [...identityRules, ...parsePersonalIdentityConfig(configJSON)] : identityRules;
  const files = execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '-z'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter(Boolean);
  return files.flatMap(path => publicIdentityFindings(path, readFileSync(resolve(root, path), 'utf8'), rules));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => !['--required', '--generic'].includes(arg))
        || process.argv.slice(2).length > 1) throw new Error('Use --required or --generic.');
    const mode = process.argv.includes('--generic') ? 'generic' : 'required';
    const findings = trackedPublicIdentityFindings(process.cwd(), { mode });
    for (const { path, line, rule } of findings) console.error(`${path}:${line}: public identity policy (${rule})`);
    if (findings.length > 0) process.exitCode = 1;
    else console.log(mode === 'required'
      ? 'Required configured personal and generic tracked-content scans passed.'
      : 'Generic tracked-content scan passed; personal scan NOT performed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}