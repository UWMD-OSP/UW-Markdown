import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
});
