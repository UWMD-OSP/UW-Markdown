import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

describe('version', () => {
  it('stays in lockstep with package.json', () => {
    const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string;
      version: string;
    };
    expect(CORE_PACKAGE_NAME).toBe(manifest.name);
    expect(CORE_VERSION).toBe(manifest.version);
  });

  it('agrees with the @uwmd/core row in VERSIONS.md too', () => {
    // This row silently went stale through the 1.4.0 release: the matrix still
    // read 1.3.0 while the package manifest said 1.4.0.
    const versions = readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../VERSIONS.md'), 'utf8');
    const row = versions.match(/^\|\s*`@uwmd\/core`\s*\|\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*/m);
    expect(row?.[1]).toBe(CORE_VERSION);
  });
});
