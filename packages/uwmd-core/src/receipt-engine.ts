// Receipts issued through `@uwmd/core` (RFC 0083).
//
// A receipt names two identities. `computation.engine`/`engine_version` is the
// code that computed the results, and a verifier compares it with its own to
// decide whether a disagreement is attributable to the record (UW Receipt §5.3,
// `RCP-07`). That code is `@uwmd/verify`'s for every receipt, whether issued
// directly or through core, so core does not override it: a lender holding only
// `@uwmd/verify` then reports a tampered core-issued receipt as `failed`, not
// `unverifiable` (the RFC 0078 boundary test). `issuer` is the tool that issued
// the receipt, and through core that is `@uwmd/core@<CORE_VERSION>`, so the
// `issueReceipt` core exports defaults it. `verifyReceipt` needs no wrapper:
// core re-exports verify's. An explicit `issuer` still wins.

import {
  issueReceipt as issueReceiptStandard,
  type ReceiptIssuanceOptions,
  type UWReceipt,
} from '@uwmd/verify';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

/**
 * Issue an unsigned receipt for a record. Either returns a receipt or throws a
 * typed `ReceiptError` — never a caveated or partial receipt. The issuer
 * defaults to `@uwmd/core@<CORE_VERSION>`; the engine is `@uwmd/verify`'s.
 */
export async function issueReceipt(content: string, options: ReceiptIssuanceOptions = {}): Promise<UWReceipt> {
  return issueReceiptStandard(content, {
    ...options,
    issuer: options.issuer ?? `${CORE_PACKAGE_NAME}@${CORE_VERSION}`,
  });
}
