// Build-time sources shared by the docs site and its index verifier.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function rfcCopies(repoRoot) {
  return readdirSync(join(repoRoot, 'docs/rfcs'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const isIndex = name === 'README.md';
      const isTemplate = name === '0000-template.md' || name === 'template.md';
      return {
        from: `docs/rfcs/${name}`,
        to: `about/rfcs/${isIndex ? 'index.md' : isTemplate ? 'template.md' : name}`,
        ...(isIndex ? { title: 'RFC Process' }
          : isTemplate ? { title: 'RFC Template' } : {}),
      };
    });
}

export function docsVersions(repoRoot) {
  const protocol = readFileSync(join(repoRoot, 'packages/uwmd-core/src/protocol.ts'), 'utf8');
  const constant = (name) => {
    const value = new RegExp(`export const ${name} = '([^']+)'`).exec(protocol)?.[1];
    if (!value) throw new TypeError(`Cannot read ${name} for the docs site`);
    return value;
  };
  const core = JSON.parse(readFileSync(join(repoRoot, 'packages/uwmd-core/package.json'), 'utf8')).version;
  return { format: constant('FORMAT_VERSION'), protocol: constant('PROTOCOL_VERSION'), core };
}
