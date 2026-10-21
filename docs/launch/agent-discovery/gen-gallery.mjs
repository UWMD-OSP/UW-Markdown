// Regenerate examples-gallery.md from the synthetic class examples in examples/.
// Staged for the launch-day site update; not part of the site build today.
//
//   node docs/launch/agent-discovery/gen-gallery.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const REPO = 'https://github.com/UWMD-OSP/UW-Markdown/blob/main/examples';

function frontmatter(source) {
  const end = source.indexOf('\n---', 3);
  const fields = {};
  for (const line of source.slice(4, end).split('\n')) {
    const m = /^([a-z_]+):\s*"?([^"]*)"?\s*$/.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

const rows = readdirSync(join(root, 'examples'))
  // parkview-after-L6 is the Parkview record after a later pipeline stage, not another class.
  .filter((f) => f.endsWith('.uwx.md') && f !== 'parkview-after-L6.uwx.md')
  .map((file) => ({ file, ...frontmatter(readFileSync(join(root, 'examples', file), 'utf8')) }))
  .filter((r) => r.asset_class)
  .sort((a, b) => a.asset_class.localeCompare(b.asset_class) || a.file.localeCompare(b.file));

const lines = [
  '---',
  'title: Example records',
  'description: One synthetic UW Markdown record for every builtin asset class, each of which validates and verifies.',
  '---',
  '',
  '# Example records',
  '',
  'Each record below is **synthetic**: an illustration of the format, not market',
  'data, a real deal or a track record. Every one validates, and every metric it',
  'states recomputes from its own inputs. Open one in the [validator](/validate/)',
  'or read it on GitHub.',
  '',
  '| Asset class | Record | Stage | Source |',
  '|---|---|---|---|',
  ...rows.map((r) => `| \`${r.asset_class}\` | ${r.deal_name ?? r.file} | ${r.deal_stage ?? ''} | [${r.file}](${REPO}/${r.file}) |`),
  '',
  'To write your own, start from `uwmd init --asset-class <class>` or copy the',
  'closest example.',
  '',
];
writeFileSync(join(here, 'examples-gallery.md'), `${lines.join('\n')}`);
console.log(`examples-gallery.md: ${rows.length} records`);
