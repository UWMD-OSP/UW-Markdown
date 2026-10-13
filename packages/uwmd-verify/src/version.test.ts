import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VERIFY_PACKAGE_NAME, VERIFY_VERSION } from './version.js';

describe('version', () => {
  it('stays in lockstep with package.json', () => {
    const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name: string;
      version: string;
    };
    expect(VERIFY_PACKAGE_NAME).toBe(manifest.name);
    expect(VERIFY_VERSION).toBe(manifest.version);
  });
});
