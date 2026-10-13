import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_PACKAGE, EDITOR_VERSION } from './version.js';

describe('editor version', () => {
  it('is the package manifest version, not a hard-coded copy', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(EDITOR_PACKAGE).toBe('@uwmd/web-editor');
    expect(EDITOR_VERSION).toBe(manifest.version);
  });
});
