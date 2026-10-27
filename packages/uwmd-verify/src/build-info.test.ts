import { describe, expect, it } from 'vitest';
import { VERIFY_BUILD_INFO, VERIFY_BUILD_VERSION } from './build-info.js';
import { VERIFY_VERSION } from './version.js';

describe('supplemental source build identity', () => {
  it('keeps a plain source compilation explicitly unidentified and immutable', () => {
    expect(VERIFY_BUILD_VERSION).toBe(`${VERIFY_VERSION}+source.unknown`);
    expect(VERIFY_BUILD_INFO).toEqual({
      package_version: VERIFY_VERSION, build_version: VERIFY_BUILD_VERSION,
      source_commit: null, source_tree: null, artifact_kind: 'unidentified-source',
    });
    expect(Object.isFrozen(VERIFY_BUILD_INFO)).toBe(true);
  });
});
