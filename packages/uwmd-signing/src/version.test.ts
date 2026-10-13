import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SIGNING_PACKAGE_NAME, SIGNING_VERSION } from './index.js';

describe('version', () => {
  it('equals the package manifest', () => {
    const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name: string; version: string };
    expect(SIGNING_PACKAGE_NAME).toBe(manifest.name);
    expect(SIGNING_VERSION).toBe(manifest.version);
  });
});
