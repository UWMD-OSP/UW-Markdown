import type { SourceBuildInfo } from '@uwmd/verify';
import { CORE_VERSION } from './version.js';

/** Source metadata is supplemental; package/manifest/receipt identities stay declared. */
export const BUILD_INFO: Readonly<SourceBuildInfo> = Object.freeze({
  package_version: CORE_VERSION,
  build_version: `${CORE_VERSION}+source.unknown`,
  source_commit: null,
  source_tree: null,
  artifact_kind: 'unidentified-source',
});
export const BUILD_VERSION = BUILD_INFO.build_version;
