import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Match process narration in tracked content, including source comments and data.
// Assemble policy probes so this module and its controls can scan themselves.
export const voiceRules = [
  ['private-decision', String.raw`\b${['own', 'er'].join('')}[- ](?:rulings?|directions?|words?|cards?|directed|only|held|gated?)\b`],
  ['private-record', String.raw`\b${['check', 'point'].join('')}s?\b`],
  ['private-status', ['NO', 'W.md'].join('')],
  ['handoff', String.raw`\b${['paste', 'back'].join('[- ]')}\b`],
  ['held-work', String.raw`\b${['launch', 'held'].join('[- ]')}\b`],
  ['named-session', String.raw`\b(?:${['Co', 'dex'].join('')}|${['Clau', 'de Code'].join('')}|GPT-\d[\w.-]*)\b`],
].map(([id, source]) => ({ id, pattern: new RegExp(source, 'gi') }));

// Exact file/line pairs only. These are product compatibility labels for the
// downloadable integration, rather than attribution to a development session.
export const voiceAllowlist = [
  {
    path: 'tools/docs-site/ai/index.md',
    text: ['- <a href="/downloads/ai/uwmd-skill/SKILL.md" download="SKILL.md">', 'Co', 'dex-compatible skill</a>'].join(''),
    reason: 'Identifies a supported downloadable integration.',
  },
  {
    path: 'tools/docs-site/downloads/index.md',
    text: ['- <a href="/downloads/ai/uwmd-skill/SKILL.md" download="SKILL.md">', 'Co', 'dex / agent skill (<code>SKILL.md</code>)</a>'].join(''),
    reason: 'Identifies a supported downloadable integration.',
  },
];

export function publicVoiceFindings(path, text) {
  return text.split('\n').flatMap((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (voiceAllowlist.some(entry => entry.path === path && entry.text === line)) return [];
    return voiceRules.flatMap(({ id, pattern }) =>
      [...line.matchAll(pattern)].map(() => ({ path, line: index + 1, rule: id })));
  });
}

export function trackedPublicVoiceFindings(root) {
  const paths = execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '-z'], {
    cwd: root, encoding: 'utf8',
  }).split('\0').filter(Boolean);
  return paths.flatMap(path => publicVoiceFindings(path, readFileSync(resolve(root, path), 'utf8')));
}
