// The receipt API with `@uwmd/core`'s engine identity (RFC 0083).
//
// `@uwmd/verify` issues and verifies receipts under its own identity
// (`@uwmd/verify`, `VERIFY_VERSION`) unless the caller names another. A receipt
// issued through `@uwmd/core` has always recorded `@uwmd/core@<CORE_VERSION>`,
// and verification compares the receipt's engine with the verifier's own
// (`RCP-07`), so the `issueReceipt` and `verifyReceipt` that `@uwmd/core`
// exports are these wrappers: they default the engine identity to core's and
// otherwise call the standard functions unchanged. An explicit `engine`,
// `engine_version` or `issuer` still wins, exactly as before.

import {
  issueReceipt as issueReceiptStandard,
  verifyReceipt as verifyReceiptStandard,
  type ReceiptIssuanceOptions,
  type ReceiptVerificationOptions,
  type UWReceipt,
  type UWReceiptVerification,
} from '@uwmd/verify';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

/**
 * Issue an unsigned receipt for a record. Either returns a receipt or throws a
 * typed `ReceiptError` — never a caveated or partial receipt. The engine and
 * issuer default to `@uwmd/core@<CORE_VERSION>`.
 */
export async function issueReceipt(content: string, options: ReceiptIssuanceOptions = {}): Promise<UWReceipt> {
  return issueReceiptStandard(content, {
    ...options,
    engine: options.engine ?? CORE_PACKAGE_NAME,
    engine_version: options.engine_version ?? CORE_VERSION,
    issuer: options.issuer ?? `${CORE_PACKAGE_NAME}@${CORE_VERSION}`,
  });
}

/**
 * Verify a receipt against its record (UW Receipt §5). This verifier's engine
 * identity defaults to `@uwmd/core@<CORE_VERSION>`.
 */
export async function verifyReceipt(
  receipt: UWReceipt,
  content: string,
  options: ReceiptVerificationOptions = {},
): Promise<UWReceiptVerification> {
  return verifyReceiptStandard(receipt, content, {
    ...options,
    engine: options.engine ?? CORE_PACKAGE_NAME,
    engine_version: options.engine_version ?? CORE_VERSION,
  });
}
