import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Tracked-content policy; patterns are assembled so the policy can scan itself.
export const identityRules = [
  ['owner-name', ['Ja', 'red'].join('')],
  ['public-handle', ['ja', 'redmaxey'].join('')],
  ['private-repository', ['underwriter', '-app'].join('')],
  ['private-task', ['TA', 'SK-'].join('') + String.raw`\d`],
  ['private-upstream', ['UP', 'STREAM-'].join('') + String.raw`\d`],
  ['private-corpus', ['Golden', ' Deal'].join('')],
  ['personal-path', String.raw`C:\\+Users`],
  ['session-branch-a', ['co', 'dex/'].join('')],
  ['session-branch-b', ['clau', 'de/'].join('')],
  ['retired-product', ['Banc', 'roft'].join('')],
].map(([id, source]) => ({
  id,
  pattern: new RegExp(
    id === 'owner-name' ? String.raw`\b${source}\b` : source,
    id === 'owner-name' || id === 'public-handle' ? 'gi' : 'g',
  ),
}));

export function publicIdentityFindings(path, text) {
  const findings = [];
  for (const { id, pattern } of identityRules) {
    for (const match of text.matchAll(pattern)) {
      findings.push({ path, rule: id, line: text.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

export function trackedPublicIdentityFindings(root) {
  const files = execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '-z'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter(Boolean);
  return files.flatMap(path => publicIdentityFindings(path, readFileSync(resolve(root, path), 'utf8')));
}
