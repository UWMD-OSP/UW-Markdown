import { VERIFY_VERSION } from './version.js';

/** Supplemental source identity; never a receipt engine or package version. */
export interface SourceBuildInfo {
  package_version: string;
  build_version: string;
  source_commit: string | null;
  source_tree: string | null;
  artifact_kind: 'committed-source' | 'unidentified-source';
}

// Plain tsc and source archives are deliberately unidentified. The explicit
// committed-source builder replaces only this emitted module after success.
export const VERIFY_BUILD_INFO: Readonly<SourceBuildInfo> = Object.freeze({
  package_version: VERIFY_VERSION,
  build_version: `${VERIFY_VERSION}+source.unknown`,
  source_commit: null,
  source_tree: null,
  artifact_kind: 'unidentified-source',
});
export const VERIFY_BUILD_VERSION = VERIFY_BUILD_INFO.build_version;
