// The reference implementation's self-declaration (Protocol §I.4): what
// `@uwmd/core` and the `uwmd` CLI built on it claim, and what `uwmd manifest`
// prints.
//
// It names this package (`org.uwmd.core`, `CORE_VERSION`) and claims starter
// capabilities (editing, rendering), so it lives with the starter
// toolkit rather than in `@uwmd/verify` (RFC 0083). The `ImplementationManifest`
// type and the tier/profile vocabularies it uses are normative and come from
// `@uwmd/verify`.

import {
  CONFORMANCE_PROFILES,
  FORMAT_VERSION,
  PROTOCOL_VERSION,
  SUPPORTED_LOCALES,
  type ConformanceProfile,
  type ImplementationManifest,
  type ViewerCapability,
} from '@uwmd/verify';
import { CORE_VERSION } from './version.js';

/**
 * What `@uwmd/core` itself self-certifies to — the answer `uwmd manifest`
 * returns, and the reference entry in any cross-implementation report.
 *
 * A literal rather than something assembled at call time, because the
 * conformance driver treats it as the identity of the implementation under
 * test: a manifest that varied with the caller's environment would make two
 * runs of the same suite incomparable.
 */
export const REFERENCE_IMPLEMENTATION_MANIFEST: ImplementationManifest = Object.freeze({
  id: 'org.uwmd.core',
  name: '@uwmd/core reference implementation',
  version: CORE_VERSION,
  protocol_version: PROTOCOL_VERSION,
  format_version: FORMAT_VERSION,
  // RFC 0078: a Verifier with every optional profile. Editing and rendering
  // stay claimed as capabilities: they are starter-product claims now (§II.4),
  // still exercised by their fixtures. The toolkit hosts no agents, and RFC
  // 0112 removed the `agent-host` capability from the vocabulary.
  tier: 'verifier',
  profiles: Object.freeze([...CONFORMANCE_PROFILES]) as ConformanceProfile[],
  capabilities: Object.freeze([
    'parse',
    'validate',
    'render-json',
    'render-csv',
    'render-summary',
    'render-chat',
    'edit-replace',
    'edit-supersede',
    'edit-frontmatter',
    'calc-evaluate',
    'calc-deterministic',
    'calc-stochastic',
    'calc-sensitivity',
    'calc-cash-flow',
    'portfolio-relationships',
    'module-load',
    // Both are gated on the optional @uwmd/signing package being installed.
    // Claimed here because the reference *implementation* is the pair: core
    // defines the contract, signing supplies the algorithms, and an adopter
    // asking "does this implementation verify signatures" means the pair.
    'signing',
    'document-signature-verification',
    'module-signature-verification',
    // Same pairing as 'signing': @uwmd/signing supplies the token verifier
    // (RFC 0011 §XIV) behind core's injected interface.
    'capability-verify',
    'integrity',
    'refinement',
    // RFC 0115: one flag per Verifier obligation; the Verifier tier claim
    // requires every one (§II.5). `uwmd verify-*` drives each (§II.6a.1).
    'verify-metrics',
    'verify-cash-flows',
    'verify-property-cash-flows',
    'verify-waterfall',
    'verify-capital-stack',
    'verify-lease-up',
    'verify-receipts',
    'verify-reserve-accounts',
    'verify-reserve-draws',
  ]) as ViewerCapability[],
  // RFC 0001: the reference implementation supports the full first wave, so
  // its own LOC-01 fires only on unregistered tags.
  supported_locales: [...SUPPORTED_LOCALES],
  role: 'library',
  homepage: 'https://uwmd.org',
});
