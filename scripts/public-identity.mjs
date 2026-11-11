import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function publicIdentityFindings(path, text, rules = identityRules) {
  const findings = [];
  for (const { id, pattern } of rules) {
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('This scanner accepts no arguments.');
    const findings = trackedPublicIdentityFindings(process.cwd());
    for (const { path, line, rule } of findings) console.error(`${path}:${line}: public identity policy (${rule})`);
    if (findings.length > 0) process.exitCode = 1;
    else console.log('Generic tracked-content scan passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}