// Compatibility shell. Official class content is builtin in core (RFC 0080).
import type { ModuleManifest } from '@uwmd/core';
export const HOSPITALITY_MODULE_ID = 'org.uwmd.hospitality';
export const HOSPITALITY_MODULE_VERSION = '0.2.0';
const MANIFEST: ModuleManifest = {
  description: 'Official content is builtin in core; this compatibility shell declares nothing.',
  manifest_version: '1', id: HOSPITALITY_MODULE_ID, name: 'Hospitality Underwriting Module (compatibility)',
  version: HOSPITALITY_MODULE_VERSION, authors: ['UW Markdown Working Group'], license: 'MIT',
  requires_protocol: '>=2.25.0', requires_format: '>=1.1.0', requires_tier: 'tier-3-calc-host',
  sections: [], calculations: [], validations: [], view_models: [],
};
// Annotate, then freeze — as the pre-RFC 0080 manifests were.
export const HOSPITALITY_MODULE: ModuleManifest = Object.freeze(MANIFEST);
export { HOSPITALITY_VIEW_MODELS } from './view-models.js';
