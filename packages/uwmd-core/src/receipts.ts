// Verification receipts — RFC 0016 / `spec/UW_RECEIPT_v1.md`.
//
// A receipt is a small, detached JSON document that binds a canonical digest of
// an underwriting record to the deterministic outputs a named calc pack produced
// from it. It lets a party who did not run the calculation confirm, offline,
// that a stated set of numbers follows from a stated set of inputs.
//
// It deliberately attests NOTHING about whether those inputs are true. A record
// asserting a fabricated NOI can carry a perfectly valid receipt. See the
// assurance boundary in `spec/UW_RECEIPT_v1.md` §6 — consumers MUST NOT render a
// `verified` verdict as an unqualified checkmark.
//
// Layering: unsigned issuance and verification live here because core already
// has SHA-256 via `integrity.sha256TextHex` with no external dependency.
// Signature creation and validation belong to the separate signing package
// RFC 0010 proposes; a verifier without one returns `unverifiable` for a signed
// receipt rather than silently ignoring the signature.

import { evaluateCalc } from './calc/index.js';
import {
  canonicalizeUWEnvelope,
  fromUWEnvelope,
  toUWEnvelope,
  type UWDocumentEnvelope,
} from './envelope.js';
import { canonicalizeExact } from './integrity-canonical.js';
import { sha256TextHex } from './integrity.js';
import { canonicalizeUWLiteFinancial, parseUWLite } from './lite.js';
import { compileUWLite } from './lite-bridge.js';
import { getPackForAssetClass } from './packs/index.js';
import { parseUWFile } from './parser.js';
import { PROTOCOL_VERSION } from './protocol.js';
import type { CalcEvaluationContext, ModuleManifest } from './protocol.js';
import {
  detectUWSourceRepresentation,
  UW_LITE_REPRESENTATION_ID,
  UW_LITE_REPRESENTATION_VERSION,
  UWX_REPRESENTATION_ID,
  UWX_REPRESENTATION_VERSION,
  type UWSourceRepresentation,
} from './source-representation.js';
import type { ParsedUWFile } from './types.js';
import { validateUWFile } from './validator.js';
import { CORE_PACKAGE_NAME, CORE_VERSION } from './version.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Receipt format version.
 *
 * **1.1 covers two RFCs, and bumps only once.** RFC 0021 (rollup verification)
 * and RFC 0022 (`inputs_provenance`) were accepted the same day and both amend
 * the format RFC 0016 owns. Each RFC records the same rule — whichever is
 * implemented first establishes the extension section, the second amends it —
 * because two independent bumps for two simultaneously-accepted RFCs would make
 * the version number meaningless. RFC 0022 landed first; RFC 0021's rollup
 * entries are additive within the section established here and MUST NOT bump
 * this again. See `UW_RECEIPT_v1.md` §10.
 */
export const UW_RECEIPT_VERSION = '1.1' as const;

/**
 * Receipt versions this verifier can read. A 1.0 receipt is still valid: every
 * 1.1 addition is optional, so absence means "the issuer stated nothing", not
 * "non-conforming".
 */
export const SUPPORTED_RECEIPT_VERSIONS: readonly string[] = Object.freeze(['1.0', '1.1']);

/** Canonicalization used for the Lite representation (UW_LITE_SPEC §6). */
export const UW_LITE_CANONICALIZATION = 'uw-lite-financial' as const;

/**
 * Version of the *canonicalization rules*, which is not the version of the Lite
 * *grammar* — the two move independently, and this field previously carried
 * `UW_LITE_REPRESENTATION_VERSION`, which conflated them. RFC 0025 changed how a
 * percent display normalizes without changing a single production of the
 * grammar: `5.51%` parsed before and parses now, it just canonicalizes to a
 * different double. Stamping the grammar version would have claimed a source
 * change that did not happen, and left the change that *did* happen unstamped.
 * `UWX_CANONICALIZATION_VERSION` is separate for the same reason.
 */
export const UW_LITE_CANONICALIZATION_VERSION = '1.1' as const;
export const UWX_CANONICALIZATION_VERSION = '1.0' as const;
/** Canonicalization used for structured records (Document Envelope 1.0). */
export const UWX_CANONICALIZATION = 'uw-envelope-semantic' as const;

/**
 * Tolerance for comparing a stated numeric result against recomputation.
 * Relative for large magnitudes, absolute near zero.
 *
 * Since §VIII.5, a *conforming* issuer can never need this: both sides quantize
 * before comparison, so they agree exactly or disagree materially. It is kept as
 * defence-in-depth against a third-party issuer running an alternate precision
 * routine — that lands as a clean `RCP-03` naming the calc rather than an
 * `RCP-04` digest mismatch that reads as corruption.
 */
export const RECEIPT_RESULT_TOLERANCE = 1e-6;

/** The policy set a receipt names when the host applies core's built-in rules. */
export const BUILTIN_POLICY_SET = 'builtin' as const;
export const BUILTIN_POLICY_SET_VERSION = '1.0' as const;

/** `sha256:<64 lowercase hex>` — the only digest spelling a receipt may carry. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

// ─── Receipt shape ───────────────────────────────────────────────────────────

export type UWReceiptCanonicalization =
  | typeof UW_LITE_CANONICALIZATION
  | typeof UWX_CANONICALIZATION;

export interface UWReceiptSubject {
  representation: UWSourceRepresentation;
  representation_version: string;
  canonicalization: UWReceiptCanonicalization;
  canonicalization_version: string;
  /** `sha256:<64 lowercase hex>` over the exact UTF-8 bytes of the canonical form. */
  digest: string;
}

export interface UWReceiptResult {
  calc_id: string;
  /** Null whenever `computed` is false. Never a hand-entered number. */
  value: number | string | boolean | null;
  unit?: string;
  /**
   * False when the pack declares this output but the record lacks the inputs to
   * produce it. The calc engine reports that as a successful evaluation to
   * `null`; a receipt must not let that read as "the pack computed null".
   */
  computed: boolean;
}

export interface UWReceiptComputation {
  /** The pack's manifest id, e.g. `org.uwmd.pack.multifamily`. */
  pack: string;
  pack_version: string;
  engine: string;
  engine_version: string;
  /**
   * The UW Protocol version the issuer computed under. Optional, because a
   * receipt issued before this field existed cannot retroactively claim one —
   * absence means "unstated", not "non-conforming".
   *
   * It exists so the question "are these numbers quantized per §VIII.5?" is
   * answerable from the receipt alone. `engine_version` cannot answer it: it
   * only means something to a reader who knows this engine's release history,
   * which is precisely the reader a third-party issuer does not have. A
   * protocol version is the one identifier every conforming issuer shares.
   */
  protocol_version?: string;
  results: UWReceiptResult[];
  /** Cheap corruption check. A verifier MUST recompute rather than trust this. */
  results_digest: string;
}

export interface UWReceiptPolicy {
  policy_set: string;
  policy_set_version: string;
  validation: { errors: number; warnings: number };
}

/** Wire shape shared with RFC 0010 block signatures. */
export interface UWReceiptSignature {
  algorithm: string;
  key_id: string;
  value: string;
}

// ─── Input provenance (receipt format 1.1) ───────────────────────────────────
//
// The extension section shared by RFC 0022 and RFC 0021. Both needed to say the
// same thing: *this receipt's validity depends on an artifact that is not the
// subject record*. RFC 0022 means a market-data observation set; RFC 0021 means
// a child record inside a composite.
//
// One section with a `source` discriminator, rather than two parallel lists,
// because the verifier's handling is identical in both cases and worth writing
// once: resolve the reference, compare the digest, and — crucially — report
// `unverifiable` rather than `failed` when the reference cannot be resolved at
// all. That distinction is the whole reason this is not just a comment field.

/**
 * What kind of artifact an entry refers to. Deliberately an open union: RFC
 * 0021 adds `child_record` without a format bump, and an unrecognized source is
 * carried and reported as unresolvable rather than rejected.
 */
export type UWReceiptInputSource = 'market_data' | 'child_record' | (string & {});

export interface UWReceiptInputProvenance {
  source: UWReceiptInputSource;
  /** Identity of the referenced artifact, e.g. a market-data `document_id`. */
  document_id: string;
  /**
   * Vintage of the referenced artifact, when it has one. Required in practice
   * for `market_data` (an unattributable observation set is refused at parse),
   * meaningless for some other sources, so optional at this layer.
   */
  as_of?: string;
  /** `sha256:<64 lowercase hex>` over the referenced artifact's canonical form. */
  digest: string;
}

/**
 * References a verifier may hold, keyed by `document_id`. Absence of a key is
 * "I do not have it" — reported as `unverifiable`. A present key whose digest
 * disagrees is a genuine mismatch, reported as `failed`.
 */
export type UWReceiptInputResolver = Readonly<Record<string, string>>;

export interface UWReceipt {
  receipt_version: string;
  subject: UWReceiptSubject;
  computation: UWReceiptComputation;
  policy: UWReceiptPolicy;
  /**
   * Artifacts beyond the subject record that the computation depended on
   * (receipt format 1.1). Optional and additive: a receipt over a deal that
   * consumed no market data and is not a composite omits it entirely, which is
   * why a 1.0 receipt stays readable.
   */
  inputs_provenance?: UWReceiptInputProvenance[];
  issued_at: string;
  issuer: string;
  signature: UWReceiptSignature | null;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export type ReceiptErrorCode =
  | 'RCP_PARSE_ERRORS'
  | 'RCP_COMPILE_FAILED'
  | 'RCP_PACK_UNRESOLVED'
  | 'RCP_PACK_UNVERSIONED'
  | 'RCP_NO_CALCULATIONS'
  | 'RCP_COMPUTATION_FAILED'
  | 'RCP_MALFORMED';

/** Typed error, consistent with `ProtocolError` / `CalcError` / `ExcelEmitError`. */
export class ReceiptError extends Error {
  readonly code: ReceiptErrorCode;

  constructor(code: ReceiptErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'ReceiptError';
    this.code = code;
  }
}

// ─── Verification result ─────────────────────────────────────────────────────

export type UWReceiptVerdict = 'verified' | 'failed' | 'unverifiable';

export type UWReceiptIssueCode =
  /** Subject digest disagrees with the document's canonical form. */
  | 'RCP-01'
  /** Stated results do not cover exactly the pack's declared outputs. */
  | 'RCP-02'
  /** A stated result disagrees with recomputation beyond tolerance. */
  | 'RCP-03'
  /** `results_digest` does not recompute — accidental corruption. */
  | 'RCP-04'
  /** The named pack is unknown to this verifier. */
  | 'RCP-05'
  /** The named pack version differs from the one this verifier holds. */
  | 'RCP-06'
  /** Results disagree and the engine version also differs. */
  | 'RCP-07'
  /** A signature is present and this verifier has no signature backend. */
  | 'RCP-08'
  /** The document could not be canonicalized (parse or compile failure). */
  | 'RCP-09'
  /** Digests disagree and the canonicalization version also differs. */
  | 'RCP-10'
  /** A referenced input is not available to this verifier. */
  | 'RCP-11'
  /** A referenced input resolved, but its digest disagrees. */
  | 'RCP-12';

export interface UWReceiptIssue {
  code: UWReceiptIssueCode;
  severity: 'failure' | 'indeterminate';
  message: string;
  calc_id?: string;
  expected?: string;
  actual?: string;
}

export interface UWReceiptVerification {
  verdict: UWReceiptVerdict;
  issues: UWReceiptIssue[];
  /** What the verifier itself computed, when it got far enough to compute. */
  recomputed?: UWReceiptResult[];
}

/** Plugged in by a signing package; absent here so core stays crypto-light. */
export interface ReceiptSignatureVerifier {
  verify(receipt: UWReceipt, signedPayload: string): Promise<boolean>;
}

// ─── Subject resolution ──────────────────────────────────────────────────────

export interface ReceiptSubjectOptions {
  /** Filename hint for representation detection. */
  filename?: string;
  /** Force a representation instead of detecting it. */
  representation?: UWSourceRepresentation;
}

export interface ReceiptSubjectResolution {
  subject: UWReceiptSubject;
  /** Exact canonical bytes the digest covers. */
  canonical: string;
  /** Structured view used for calc evaluation and validation. */
  parsed: ParsedUWFile;
  envelope: UWDocumentEnvelope;
}

/**
 * Parse, canonicalize, and digest a record. Throws a typed `ReceiptError` when
 * the document has parse-level errors — an issuer MUST NOT emit a receipt for
 * such a document (RFC 0016, extending UW_LITE_SPEC §5 to every representation).
 */
export async function resolveReceiptSubject(
  content: string,
  options: ReceiptSubjectOptions = {},
): Promise<ReceiptSubjectResolution> {
  const detection = detectUWSourceRepresentation(
    content,
    options.filename,
    options.representation,
  );

  if (detection.representation === UW_LITE_REPRESENTATION_ID) {
    const lite = parseUWLite(content);
    const blocking = lite.issues.filter((issue) => issue.severity === 'error');
    if (blocking.length > 0) {
      throw new ReceiptError(
        'RCP_PARSE_ERRORS',
        `Refusing to issue: the Lite document has ${blocking.length} parse error(s) [${blocking
          .map((issue) => issue.code)
          .join(', ')}].`,
      );
    }
    const canonical = canonicalizeUWLiteFinancial(lite);
    const compiled = compileUWLite(lite);
    if (!compiled.ok) {
      throw new ReceiptError(
        'RCP_COMPILE_FAILED',
        `Refusing to issue: the Lite document does not compile [${compiled.report.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.code)
          .join(', ')}].`,
      );
    }
    return {
      subject: {
        representation: UW_LITE_REPRESENTATION_ID,
        representation_version: UW_LITE_REPRESENTATION_VERSION,
        canonicalization: UW_LITE_CANONICALIZATION,
        canonicalization_version: UW_LITE_CANONICALIZATION_VERSION,
        digest: await digestOf(canonical),
      },
      canonical,
      parsed: fromUWEnvelope(compiled.envelope),
      envelope: compiled.envelope,
    };
  }

  let parsed: ParsedUWFile;
  try {
    parsed = parseUWFile(content);
  } catch (e) {
    throw new ReceiptError(
      'RCP_PARSE_ERRORS',
      `Refusing to issue: the structured document does not parse (${
        e instanceof Error ? e.message : String(e)
      }).`,
    );
  }
  const envelope = toUWEnvelope(parsed);
  const canonical = canonicalizeUWEnvelope(envelope);
  return {
    subject: {
      representation: UWX_REPRESENTATION_ID,
      representation_version: UWX_REPRESENTATION_VERSION,
      canonicalization: UWX_CANONICALIZATION,
      canonicalization_version: UWX_CANONICALIZATION_VERSION,
      digest: await digestOf(canonical),
    },
    canonical,
    parsed,
    envelope,
  };
}

async function digestOf(canonical: string): Promise<string> {
  return `sha256:${await sha256TextHex(canonical)}`;
}

// ─── Computation ─────────────────────────────────────────────────────────────

/**
 * Run every calc a pack declares. Throws when any one fails — a receipt states
 * the pack's complete output set or it states nothing (RFC 0016).
 */
export function computeReceiptResults(
  pack: ModuleManifest,
  parsed: ParsedUWFile,
): UWReceiptResult[] {
  const decls = pack.calculations ?? [];
  if (decls.length === 0) {
    throw new ReceiptError(
      'RCP_NO_CALCULATIONS',
      `Pack '${pack.id}' declares no calculations, so it has no outputs to attest.`,
    );
  }

  const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };
  const results: UWReceiptResult[] = [];
  const failures: string[] = [];

  for (const decl of decls) {
    const result = evaluateCalc(decl, ctx);
    if (!result.ok) {
      failures.push(`${decl.id} (${result.error?.code ?? 'unknown'})`);
      continue;
    }
    // The engine reports "inputs absent" as a successful evaluation to null.
    // A receipt records that as an uncomputed output, not as a computed null.
    const computed = result.value !== null;
    results.push({
      calc_id: result.calc_id,
      value: computed ? result.value : null,
      ...(decl.unit ? { unit: decl.unit } : {}),
      computed,
    });
  }

  if (failures.length > 0) {
    throw new ReceiptError(
      'RCP_COMPUTATION_FAILED',
      `Refusing to issue: ${failures.length} of ${decls.length} pack calculations did not evaluate [${failures.join(', ')}].`,
    );
  }

  // Deterministic order regardless of declaration order, so re-issuance over an
  // unmodified record reproduces byte-identical results.
  return results.sort((left, right) => left.calc_id.localeCompare(right.calc_id));
}

/** SHA-256 over the RFC 8785 canonicalization of the result set. */
export async function computeResultsDigest(results: readonly UWReceiptResult[]): Promise<string> {
  return digestOf(canonicalizeExact(results));
}

// ─── Issuance ────────────────────────────────────────────────────────────────

export interface ReceiptIssuanceOptions extends ReceiptSubjectOptions {
  /** Pack override. Defaults to the built-in pack for `frontmatter.asset_class`. */
  pack?: ModuleManifest;
  /** Identity of the issuing tool, e.g. `uwmd-cli@1.1.3`. */
  issuer?: string;
  /** ISO 8601 instant. Supply explicitly for reproducible fixtures. */
  issued_at?: string;
  policy_set?: string;
  policy_set_version?: string;
  engine?: string;
  engine_version?: string;
  /** Protocol version to state. Defaults to the `PROTOCOL_VERSION` this build targets. */
  protocol_version?: string;
  /**
   * Artifacts beyond this record that the computation depended on — a
   * market-data observation set, a composite's child records (receipt format
   * 1.1).
   *
   * The host supplies these rather than the issuer deriving them, because only
   * the host knows what it actually resolved against. Deriving them here would
   * mean guessing, and a guessed provenance entry is worse than none: it would
   * make a receipt claim an input it never used.
   */
  inputs_provenance?: readonly UWReceiptInputProvenance[];
}

/**
 * Issue an unsigned receipt for a record. Either returns a receipt or throws a
 * typed `ReceiptError` — never a caveated or partial receipt.
 */
export async function issueReceipt(
  content: string,
  options: ReceiptIssuanceOptions = {},
): Promise<UWReceipt> {
  const resolved = await resolveReceiptSubject(content, options);
  const pack = resolvePack(resolved.parsed, options.pack);
  const results = computeReceiptResults(pack, resolved.parsed);
  const validation = validateUWFile(resolved.parsed);

  return {
    receipt_version: UW_RECEIPT_VERSION,
    subject: resolved.subject,
    computation: {
      pack: pack.id,
      pack_version: pack.version,
      engine: options.engine ?? CORE_PACKAGE_NAME,
      engine_version: options.engine_version ?? CORE_VERSION,
      protocol_version: options.protocol_version ?? PROTOCOL_VERSION,
      results,
      results_digest: await computeResultsDigest(results),
    },
    policy: {
      policy_set: options.policy_set ?? BUILTIN_POLICY_SET,
      policy_set_version: options.policy_set_version ?? BUILTIN_POLICY_SET_VERSION,
      validation: {
        errors: validation.errors.length,
        warnings: validation.warnings.length,
      },
    },
    // Sorted by document_id so re-issuance over an unchanged record reproduces
    // byte-identical bytes regardless of the order the host listed them in —
    // the re-issuance-stability invariant the conformance suite asserts.
    ...(options.inputs_provenance && options.inputs_provenance.length > 0
      ? {
          inputs_provenance: [...options.inputs_provenance].sort((a, b) =>
            a.document_id < b.document_id ? -1 : a.document_id > b.document_id ? 1 : 0,
          ),
        }
      : {}),
    issued_at: options.issued_at ?? new Date().toISOString(),
    issuer: options.issuer ?? `${CORE_PACKAGE_NAME}@${CORE_VERSION}`,
    signature: null,
  };
}

function resolvePack(parsed: ParsedUWFile, override?: ModuleManifest): ModuleManifest {
  const assetClass = parsed.frontmatter.asset_class;
  const pack = override ?? (assetClass ? getPackForAssetClass(assetClass) : null);
  if (!pack) {
    throw new ReceiptError(
      'RCP_PACK_UNRESOLVED',
      `No calc pack is registered for asset class '${assetClass ?? '(unset)'}'; pass one explicitly to issue a receipt.`,
    );
  }
  if (!pack.version) {
    throw new ReceiptError(
      'RCP_PACK_UNVERSIONED',
      `Pack '${pack.id}' declares no version; an unversioned pack cannot be named in a receipt.`,
    );
  }
  return pack;
}

/**
 * The RFC 8785 canonicalization a signature covers: the receipt with
 * `signature` set to null.
 */
export function receiptSigningPayload(receipt: UWReceipt): string {
  return canonicalizeExact({ ...receipt, signature: null });
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface ReceiptVerificationOptions extends ReceiptSubjectOptions {
  /** Packs available to this verifier, keyed by manifest id. Defaults to built-ins. */
  packs?: readonly ModuleManifest[];
  /** Supplied by a signing package. Absent → a signed receipt is `unverifiable`. */
  signatureVerifier?: ReceiptSignatureVerifier;
  /** Engine identity of this verifier. Defaults to this package. */
  engine?: string;
  engine_version?: string;
  /**
   * Digests of referenced inputs this verifier holds, keyed by `document_id`
   * (receipt format 1.1). A reference absent from this map is one the verifier
   * cannot check, which is `unverifiable` — not evidence of tampering.
   *
   * Omitting the option entirely means "I hold none of them", so a receipt with
   * `inputs_provenance` verifies as `unverifiable` rather than silently
   * ignoring the references it names.
   */
  inputs?: UWReceiptInputResolver;
}

/**
 * Verify a receipt against a record.
 *
 * Reports exactly one of three verdicts and never collapses `unverifiable` into
 * either of the others. Precedence:
 *
 *   1. A digest mismatch is decisive — the record changed. `failed` — unless the
 *      receipt was canonicalized under different rules than this verifier
 *      applies, in which case the two digests were never comparable and the
 *      disagreement is attributable to the rules rather than to the record:
 *      `unverifiable` (RCP-10). This mirrors the engine-identity carve-out at
 *      step 3, and exists for the same reason RFC 0023 gave — a verifier must
 *      not report corruption when the only thing that changed is its own
 *      arithmetic. See RFC 0025.
 *   2. A referenced input that resolves but whose digest disagrees is also
 *      decisive — the observation set or child record changed after issuance.
 *      `failed` (RCP-12). Placed here, above the indeterminate group, because a
 *      reference the verifier *does* hold and *can* compare is real evidence,
 *      and burying it under a later step would let an unknown pack mask it.
 *   3. Otherwise, anything this verifier cannot decide (unknown pack, pack
 *      version it does not hold, a signature with no backend, or a referenced
 *      input it does not hold — RCP-11) → `unverifiable`.
 *   4. Otherwise, recomputation disagreement → `failed`, unless the issuing
 *      engine identity (name *and* version) differs from this verifier's, in
 *      which case the disagreement is attributable to the engine and the
 *      verdict is `unverifiable` (RFC 0016 open question, resolved in
 *      `spec/UW_RECEIPT_v1.md` §5).
 *   5. Otherwise `verified`.
 *
 * The verifier always recomputes; `results_digest` is checked only as a cheap
 * corruption signal and never authorizes skipping the recomputation.
 */
export async function verifyReceipt(
  receipt: UWReceipt,
  content: string,
  options: ReceiptVerificationOptions = {},
): Promise<UWReceiptVerification> {
  assertUWReceipt(receipt);

  const issues: UWReceiptIssue[] = [];

  // The document must canonicalize before anything can be compared to it.
  let resolved: ReceiptSubjectResolution;
  try {
    resolved = await resolveReceiptSubject(content, {
      filename: options.filename,
      representation: options.representation ?? receipt.subject.representation,
    });
  } catch (e) {
    return {
      verdict: 'unverifiable',
      issues: [
        {
          code: 'RCP-09',
          severity: 'indeterminate',
          message: `The record could not be canonicalized for comparison: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
      ],
    };
  }

  // 1 — digest. Decisive on mismatch, but only between comparable digests: two
  // canonicalization versions can disagree about a document neither side
  // touched, so the version is checked before the mismatch is attributed.
  if (resolved.subject.digest !== receipt.subject.digest) {
    if (resolved.subject.canonicalization_version !== receipt.subject.canonicalization_version) {
      return {
        verdict: 'unverifiable',
        issues: [
          {
            code: 'RCP-10',
            severity: 'indeterminate',
            message: `The receipt was canonicalized under '${receipt.subject.canonicalization}' version ${receipt.subject.canonicalization_version}; this verifier applies version ${resolved.subject.canonicalization_version}. The digests are not comparable, so this is not evidence the record changed.`,
            expected: receipt.subject.digest,
            actual: resolved.subject.digest,
          },
        ],
      };
    }
    return {
      verdict: 'failed',
      issues: [
        {
          code: 'RCP-01',
          severity: 'failure',
          message:
            'The record\'s canonical financial content has changed since the receipt was issued.',
          expected: receipt.subject.digest,
          actual: resolved.subject.digest,
        },
      ],
    };
  }

  // 2 — referenced inputs (receipt format 1.1). A reference we hold and can
  // compare is decisive; one we do not hold is indeterminate, and the two must
  // not be collapsed. Held references are checked first so a mutated
  // observation set is not masked by an unrelated missing one.
  const references = receipt.inputs_provenance ?? [];
  const held = options.inputs ?? {};
  const unresolved: UWReceiptInputProvenance[] = [];
  for (const reference of references) {
    const actual = held[reference.document_id];
    if (actual === undefined) {
      unresolved.push(reference);
      continue;
    }
    if (actual !== reference.digest) {
      return {
        verdict: 'failed',
        issues: [
          {
            code: 'RCP-12',
            severity: 'failure',
            message: `The ${reference.source} input '${reference.document_id}'${
              reference.as_of ? ` (as of ${reference.as_of})` : ''
            } has changed since the receipt was issued, so the stated results no longer follow from the inputs named.`,
            expected: reference.digest,
            actual,
          },
        ],
      };
    }
  }
  for (const reference of unresolved) {
    issues.push({
      code: 'RCP-11',
      severity: 'indeterminate',
      message: `This verifier does not hold the ${reference.source} input '${reference.document_id}'${
        reference.as_of ? ` (as of ${reference.as_of})` : ''
      }, so it cannot confirm the inputs the computation used. This is not evidence the record changed.`,
      expected: reference.digest,
    });
  }

  // 3 — can this verifier decide at all?
  const pack = lookupPack(receipt.computation.pack, options.packs);
  if (!pack) {
    issues.push({
      code: 'RCP-05',
      severity: 'indeterminate',
      message: `This verifier does not hold pack '${receipt.computation.pack}', so it cannot recompute the stated results.`,
    });
  } else if (pack.version !== receipt.computation.pack_version) {
    issues.push({
      code: 'RCP-06',
      severity: 'indeterminate',
      message: `This verifier holds pack '${pack.id}' at version ${pack.version}; the receipt names ${receipt.computation.pack_version}.`,
      expected: receipt.computation.pack_version,
      actual: pack.version,
    });
  }

  if (receipt.signature && !options.signatureVerifier) {
    issues.push({
      code: 'RCP-08',
      severity: 'indeterminate',
      message:
        'The receipt is signed and this verifier has no signature backend; the signature was not ignored, it was not checked.',
    });
  }

  if (issues.some((issue) => issue.severity === 'indeterminate')) {
    return { verdict: 'unverifiable', issues };
  }

  // 4 — recompute. `pack` is non-null here: a null pack produced RCP-05 above.
  const resolvedPack = pack as ModuleManifest;
  let recomputed: UWReceiptResult[];
  try {
    recomputed = computeReceiptResults(resolvedPack, resolved.parsed);
  } catch (e) {
    return {
      verdict: 'failed',
      issues: [
        {
          code: 'RCP-03',
          severity: 'failure',
          message: `Recomputation did not produce the pack's declared outputs: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
      ],
      recomputed: [],
    };
  }

  // Engine identity is the pair, not the version alone. A version string only
  // means something within one engine's release history: `2.1.0` of some other
  // vendor's engine is not a later or earlier build of this one, it is an
  // unrelated implementation that happens to have reached the same number. So a
  // disagreement is attributable to the record only when both halves match.
  const verifierEngine = options.engine ?? CORE_PACKAGE_NAME;
  const verifierEngineVersion = options.engine_version ?? CORE_VERSION;
  const engineMatches =
    receipt.computation.engine === verifierEngine &&
    receipt.computation.engine_version === verifierEngineVersion;

  if (receipt.signature && options.signatureVerifier) {
    const valid = await options.signatureVerifier.verify(receipt, receiptSigningPayload(receipt));
    if (!valid) {
      return {
        verdict: 'failed',
        issues: [
          {
            code: 'RCP-01',
            severity: 'failure',
            message: 'The receipt signature did not validate.',
          },
        ],
        recomputed,
      };
    }
  }

  const disagreements = compareResults(receipt.computation.results, recomputed);
  if (disagreements.length > 0) {
    if (!engineMatches) {
      return {
        verdict: 'unverifiable',
        issues: [
          {
            code: 'RCP-07',
            severity: 'indeterminate',
            message: `Results disagree, but the receipt was issued by engine ${receipt.computation.engine}@${receipt.computation.engine_version} and this verifier runs ${verifierEngine}@${verifierEngineVersion}. The disagreement cannot be attributed to the record.`,
            expected: `${receipt.computation.engine}@${receipt.computation.engine_version}`,
            actual: `${verifierEngine}@${verifierEngineVersion}`,
          },
          ...disagreements,
        ],
        recomputed,
      };
    }
    return { verdict: 'failed', issues: disagreements, recomputed };
  }

  // Corruption check, reported but not decisive on its own — recomputation
  // already agreed, so a stale digest here means the field, not the numbers.
  const expectedResultsDigest = await computeResultsDigest(receipt.computation.results);
  if (expectedResultsDigest !== receipt.computation.results_digest) {
    return {
      verdict: 'failed',
      issues: [
        {
          code: 'RCP-04',
          severity: 'failure',
          message: 'results_digest does not recompute over the stated results.',
          expected: expectedResultsDigest,
          actual: receipt.computation.results_digest,
        },
      ],
      recomputed,
    };
  }

  return { verdict: 'verified', issues: [], recomputed };
}

function lookupPack(id: string, packs?: readonly ModuleManifest[]): ModuleManifest | null {
  if (packs) return packs.find((pack) => pack.id === id) ?? null;
  for (const assetClass of [
    'multifamily',
    'office',
    'retail',
    'industrial',
    'self_storage',
  ] as const) {
    const pack = getPackForAssetClass(assetClass);
    if (pack?.id === id) return pack;
  }
  return null;
}

function compareResults(
  stated: readonly UWReceiptResult[],
  recomputed: readonly UWReceiptResult[],
): UWReceiptIssue[] {
  const issues: UWReceiptIssue[] = [];
  const statedById = new Map(stated.map((result) => [result.calc_id, result]));
  const recomputedById = new Map(recomputed.map((result) => [result.calc_id, result]));

  for (const result of recomputed) {
    if (!statedById.has(result.calc_id)) {
      issues.push({
        code: 'RCP-02',
        severity: 'failure',
        calc_id: result.calc_id,
        message: `The receipt omits '${result.calc_id}', which the pack declares as an output.`,
      });
    }
  }
  for (const result of stated) {
    if (!recomputedById.has(result.calc_id)) {
      issues.push({
        code: 'RCP-02',
        severity: 'failure',
        calc_id: result.calc_id,
        message: `The receipt states '${result.calc_id}', which the pack does not compute.`,
      });
    }
  }

  for (const statedResult of stated) {
    const actual = recomputedById.get(statedResult.calc_id);
    if (!actual) continue;
    if (statedResult.computed !== actual.computed) {
      issues.push({
        code: 'RCP-03',
        severity: 'failure',
        calc_id: statedResult.calc_id,
        message: statedResult.computed
          ? `The receipt states a computed '${statedResult.calc_id}', but the record lacks the inputs to produce it.`
          : `The receipt marks '${statedResult.calc_id}' uncomputed, but the record does produce it.`,
        expected: statedResult.computed ? 'computed' : 'uncomputed',
        actual: actual.computed ? 'computed' : 'uncomputed',
      });
      continue;
    }
    if (!statedResult.computed) continue;
    if (!valuesAgree(statedResult.value, actual.value)) {
      issues.push({
        code: 'RCP-03',
        severity: 'failure',
        calc_id: statedResult.calc_id,
        message: `Stated '${statedResult.calc_id}' does not follow from the record.`,
        expected: String(statedResult.value),
        actual: String(actual.value),
      });
    }
  }

  return issues;
}

function valuesAgree(stated: unknown, actual: unknown): boolean {
  if (typeof stated === 'number' && typeof actual === 'number') {
    if (Number.isNaN(stated) || Number.isNaN(actual)) return false;
    if (stated === actual) return true;
    const scale = Math.max(1, Math.abs(stated), Math.abs(actual));
    return Math.abs(stated - actual) <= RECEIPT_RESULT_TOLERANCE * scale;
  }
  return stated === actual;
}

// ─── Shape validation ────────────────────────────────────────────────────────

/** Structural check mirroring `spec/schemas/uw-receipt.schema.json`. */
export function assertUWReceipt(value: unknown): asserts value is UWReceipt {
  const fail = (message: string): never => {
    throw new ReceiptError('RCP_MALFORMED', message);
  };
  if (typeof value !== 'object' || value === null) fail('A receipt must be an object.');
  const receipt = value as Record<string, unknown>;

  // Accepts every supported version, not just the current one: each 1.1
  // addition is optional, so a 1.0 receipt is still a valid receipt and
  // refusing to read it would strand every receipt issued before this release.
  if (
    typeof receipt['receipt_version'] !== 'string' ||
    !SUPPORTED_RECEIPT_VERSIONS.includes(receipt['receipt_version'])
  ) {
    fail(
      `Unsupported receipt_version '${String(receipt['receipt_version'])}' (supported: ${SUPPORTED_RECEIPT_VERSIONS.join(', ')}).`,
    );
  }

  const subject = receipt['subject'];
  if (typeof subject !== 'object' || subject === null) fail('receipt.subject must be an object.');
  const s = subject as Record<string, unknown>;
  for (const key of [
    'representation',
    'representation_version',
    'canonicalization',
    'canonicalization_version',
    'digest',
  ]) {
    if (typeof s[key] !== 'string') fail(`receipt.subject.${key} must be a string.`);
  }
  if (!DIGEST_PATTERN.test(s['digest'] as string)) {
    fail('receipt.subject.digest must be sha256 followed by 64 lowercase hex characters.');
  }

  const computation = receipt['computation'];
  if (typeof computation !== 'object' || computation === null) {
    fail('receipt.computation must be an object.');
  }
  const c = computation as Record<string, unknown>;
  for (const key of ['pack', 'pack_version', 'engine', 'engine_version', 'results_digest']) {
    if (typeof c[key] !== 'string') fail(`receipt.computation.${key} must be a string.`);
  }
  if (!Array.isArray(c['results'])) fail('receipt.computation.results must be an array.');
  for (const entry of c['results'] as unknown[]) {
    if (typeof entry !== 'object' || entry === null) fail('Each result must be an object.');
    const r = entry as Record<string, unknown>;
    if (typeof r['calc_id'] !== 'string') fail('Each result needs a string calc_id.');
    if (!['number', 'string', 'boolean'].includes(typeof r['value']) && r['value'] !== null) {
      fail(`Result '${String(r['calc_id'])}' has a non-scalar value.`);
    }
    if (typeof r['computed'] !== 'boolean') {
      fail(`Result '${String(r['calc_id'])}' must declare a boolean 'computed'.`);
    }
    if (r['computed'] === false && r['value'] !== null) {
      fail(`Result '${String(r['calc_id'])}' is marked uncomputed but carries a value.`);
    }
  }

  const policy = receipt['policy'];
  if (typeof policy !== 'object' || policy === null) fail('receipt.policy must be an object.');
  const p = policy as Record<string, unknown>;
  if (typeof p['policy_set'] !== 'string') fail('receipt.policy.policy_set must be a string.');
  if (typeof p['policy_set_version'] !== 'string') {
    fail('receipt.policy.policy_set_version must be a string.');
  }
  const validation = p['validation'];
  if (typeof validation !== 'object' || validation === null) {
    fail('receipt.policy.validation must be an object.');
  }
  const v = validation as Record<string, unknown>;
  for (const key of ['errors', 'warnings']) {
    if (typeof v[key] !== 'number' || !Number.isInteger(v[key])) {
      fail(`receipt.policy.validation.${key} must be an integer.`);
    }
  }

  // inputs_provenance (1.1). Optional, but malformed-if-present: a reference
  // with no digest cannot be checked, and silently dropping it would turn an
  // unverifiable receipt into an apparently clean one.
  const provenance = receipt['inputs_provenance'];
  if (provenance !== undefined) {
    if (!Array.isArray(provenance)) fail('receipt.inputs_provenance must be an array.');
    const seen = new Set<string>();
    for (const [i, raw] of (provenance as unknown[]).entries()) {
      if (typeof raw !== 'object' || raw === null) {
        fail(`receipt.inputs_provenance[${i}] must be an object.`);
      }
      const ref = raw as Record<string, unknown>;
      for (const key of ['source', 'document_id', 'digest']) {
        if (typeof ref[key] !== 'string' || (ref[key] as string).length === 0) {
          fail(`receipt.inputs_provenance[${i}].${key} must be a non-empty string.`);
        }
      }
      if (!DIGEST_PATTERN.test(ref['digest'] as string)) {
        fail(`receipt.inputs_provenance[${i}].digest must be 'sha256:<64 lowercase hex>'.`);
      }
      if (ref['as_of'] !== undefined && typeof ref['as_of'] !== 'string') {
        fail(`receipt.inputs_provenance[${i}].as_of must be a string when present.`);
      }
      // Two entries for one id would make the digest check order-dependent.
      const id = ref['document_id'] as string;
      if (seen.has(id)) fail(`receipt.inputs_provenance names '${id}' more than once.`);
      seen.add(id);
    }
  }

  if (typeof receipt['issued_at'] !== 'string') fail('receipt.issued_at must be a string.');
  if (typeof receipt['issuer'] !== 'string') fail('receipt.issuer must be a string.');

  const signature = receipt['signature'];
  if (signature !== null && signature !== undefined) {
    if (typeof signature !== 'object') fail('receipt.signature must be an object or null.');
    const sig = signature as Record<string, unknown>;
    for (const key of ['algorithm', 'key_id', 'value']) {
      if (typeof sig[key] !== 'string') fail(`receipt.signature.${key} must be a string.`);
    }
  }
}
