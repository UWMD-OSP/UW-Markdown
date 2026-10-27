import { describe, expect, it } from 'vitest';
import { BUILD_INFO, BUILD_VERSION } from './build-info.js';
import { CORE_VERSION } from './version.js';

describe('supplemental source build identity', () => {
  it('keeps a plain source compilation explicitly unidentified and immutable', () => {
    expect(BUILD_VERSION).toBe(`${CORE_VERSION}+source.unknown`);
    expect(BUILD_INFO).toEqual({
      package_version: CORE_VERSION, build_version: BUILD_VERSION,
      source_commit: null, source_tree: null, artifact_kind: 'unidentified-source',
    });
    expect(Object.isFrozen(BUILD_INFO)).toBe(true);
  });
});
