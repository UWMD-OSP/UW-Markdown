import { afterEach, describe, expect, it, vi } from 'vitest';
import { subtle } from './algorithms.js';
import { SigningError } from './errors.js';

describe('subtle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the global Web Crypto provider', () => {
    expect(subtle()).toBe(globalThis.crypto.subtle);
  });

  it('refuses a runtime without global Web Crypto and names the supported floor', () => {
    // Node 18 without --experimental-global-webcrypto has no globalThis.crypto.
    vi.stubGlobal('crypto', undefined);
    let caught: unknown;
    try {
      subtle();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SigningError);
    expect((caught as SigningError).code).toBe('SIG_NO_CRYPTO');
    expect((caught as SigningError).message).toContain('Node 20 or later');
    expect((caught as SigningError).message).not.toContain('18');
  });
});
