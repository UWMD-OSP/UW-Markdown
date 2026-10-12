// Compatibility shell. Official class content is builtin in core (RFC 0080).
import type { ModuleManifest } from '@uwmd/core';
export const DATA_CENTER_MODULE_ID = 'org.uwmd.datacenters';
export const DATA_CENTER_MODULE_VERSION = '0.2.0';
/** @deprecated Use builtin data_center; the legacy identity still reads. */
export const DATA_CENTER_ASSET_CLASS = 'org.uwmd.data_center';
const MANIFEST: ModuleManifest = {
  description: 'Official content is builtin in core; this compatibility shell declares nothing.',
  manifest_version: '1', id: DATA_CENTER_MODULE_ID, name: 'Data Center Underwriting Module (compatibility)',
  version: DATA_CENTER_MODULE_VERSION, authors: ['UW Markdown Working Group'], license: 'MIT',
  requires_protocol: '^4.0.0', requires_format: '^3.0', requires_conformance: 'verifier',
  sections: [], calculations: [], validations: [], view_models: [],
};
// Annotate, then freeze — as the pre-RFC 0080 manifests were.
export const DATA_CENTER_MODULE: ModuleManifest = Object.freeze(MANIFEST);
export { DATA_CENTER_VIEW_MODELS } from './view-models.js';
