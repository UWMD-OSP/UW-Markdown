import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SIGNING_PACKAGE_NAME, SIGNING_VERSION } from './index.js';

describe('version', () => {
  it('equals the package manifest', () => {
    const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name: string; version: string };
    expect(SIGNING_PACKAGE_NAME).toBe(manifest.name);
    expect(SIGNING_VERSION).toBe(manifest.version);
  });

  it('keeps the package loadable in a browser: no static node: import', () => {
    // 0.3.1 read the manifest through `createRequire` from `node:module`, a
    // static import no browser can resolve, while the README promised browser
    // use. Web Crypto covers every algorithm; the file-backed key store's
    // `node:fs` is a guarded dynamic import.
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const file of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'test-helpers.ts')) {
      const source = readFileSync(`${dir}/${file}`, 'utf8');
      expect(source, file).not.toMatch(/^import .* from 'node:/m);
    }
  });
});
