// Receipts — RFC 0016 / `spec/UW_RECEIPT.md`.
//
// The behaviours worth pinning: issuance is total (a receipt or a typed error,
// never something in between), re-issuance over an unmodified record is stable,
// and the verifier keeps `unverifiable` genuinely distinct from `failed`.

import { describe, expect, it } from 'vitest';
import {createPrivateKey, createPublicKey, sign, verify as verifyEd25519} from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertUWReceipt,
  computeReceiptResults,
  computeResultsDigest,
  issueReceipt,
  ReceiptError,
  receiptSigningPayload,
  resolveReceiptSubject,
  UW_LITE_CANONICALIZATION,
  UWX_CANONICALIZATION,
  verifyReceipt,
  verifyRollup,
  validateRollupAggregate,
  ROLLUP_FUNCTIONS,
  type UWReceipt,
  type UWReceiptVerdict,
  type UWRollupAggregate,
  type RollupFn,
  type RollupMember,
} from './receipts.js';
import { quantizeDecimal, resolveRoundTo } from './calc/quantize.js';
import { PROTOCOL_VERSION } from './protocol.js';
import { MULTIFAMILY_PACK } from './builtin-packs/multifamily.js';
import { OFFICE_PACK } from './builtin-packs/office.js';
import { VERIFY_PACKAGE_NAME, VERIFY_VERSION } from './version.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { InvalidUnicodeError } from './integrity-canonical.js';

const PARKVIEW = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');

/**
 * A deliberately synthetic asset class that is not — and must never become — a
 * member of the `AssetClass` union. Swapping it in is how these tests reach the
 * "no pack is registered for this class" path without depending on some real
 * class staying packless.
 */
const UNREGISTERED_CLASS = '__unregistered_test_class__';
const LITE_DEAL = resolve(
  __dirname,
  '../../../conformance/lite/fixtures/02-full-deal-summary.uw.md',
);

const ISSUED_AT = '2026-08-09T00:00:00Z';

async function parkview(): Promise<string> {
  return readFile(PARKVIEW, 'utf8');
}
async function liteDeal(): Promise<string> {
  return readFile(LITE_DEAL, 'utf8');
}

function clone(receipt: UWReceipt): UWReceipt {
  return JSON.parse(JSON.stringify(receipt)) as UWReceipt;
}

describe('resolveReceiptSubject', () => {
  it('binds a Lite record to its financial canonical form', async () => {
    const resolved = await resolveReceiptSubject(await liteDeal(), { filename: LITE_DEAL });
    expect(resolved.subject.representation).toBe('uw-lite-markdown');
    expect(resolved.subject.canonicalization).toBe(UW_LITE_CANONICALIZATION);
    expect(resolved.subject.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('binds a structured record to the envelope semantic canonical form', async () => {
    const resolved = await resolveReceiptSubject(await parkview(), { filename: PARKVIEW });
    expect(resolved.subject.representation).toBe('uwx-markdown');
    expect(resolved.subject.canonicalization).toBe(UWX_CANONICALIZATION);
  });

  it('ignores cosmetic reformatting that leaves financial content unchanged', async () => {
    const raw = await liteDeal();
    const reformatted = raw.replace(/\n/g, '\r\n');
    const a = await resolveReceiptSubject(raw, { filename: LITE_DEAL });
    const b = await resolveReceiptSubject(reformatted, { filename: LITE_DEAL });
    expect(b.subject.digest).toBe(a.subject.digest);
  });

  it('refuses a document with parse errors', async () => {
    const broken = '---\nuw_lite_version: 1.0\n---\n\n- Purchase price: $1 <!-- uw: -->\n';
    await expect(
      resolveReceiptSubject(broken, { filename: 'broken.uw.md' }),
    ).rejects.toBeInstanceOf(ReceiptError);
  });
});

describe('issueReceipt', () => {
  it('issues a complete receipt for a structured multifamily record', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });

    expect(receipt.receipt_version).toBe('1.1');
    expect(receipt.computation.pack).toBe(MULTIFAMILY_PACK.id);
    expect(receipt.computation.pack_version).toBe(MULTIFAMILY_PACK.version);
    expect(receipt.computation.engine).toBe(VERIFY_PACKAGE_NAME);
    expect(receipt.computation.engine_version).toBe(VERIFY_VERSION);
    expect(receipt.issuer).toBe(`${VERIFY_PACKAGE_NAME}@${VERIFY_VERSION}`);
    expect(receipt.issued_at).toBe(ISSUED_AT);
    expect(receipt.signature).toBeNull();

    const ids = receipt.computation.results.map((r) => r.calc_id).sort();
    expect(ids).toEqual((MULTIFAMILY_PACK.calculations ?? []).map((c) => c.id).sort());
  });

  it('records RFC0090 actor errors without inventing a receipt refusal', async () => {
    const original = await parkview();
    // Disposable input only: the authored fixture and historical receipts stay intact.
    const actorAbsent = original.replace('      "actor": "jared",\n', '');
    expect(actorAbsent).not.toBe(original);
    const options = { filename: PARKVIEW, issued_at: ISSUED_AT };
    const before = await issueReceipt(original, options);
    const after = await issueReceipt(actorAbsent, options);
    expect(after.policy.validation).toEqual({
      errors: before.policy.validation.errors + 1,
      warnings: before.policy.validation.warnings,
    });
    expect(after.computation).toEqual(before.computation);
    // Editing actor content changes the semantic subject; diagnostic allocation alone
    // never rewrites an existing subject or historical signed receipt.
    expect(after.subject.digest).not.toBe(before.subject.digest);
    expect(receiptSigningPayload(after)).not.toBe(receiptSigningPayload(before));
    const verified = await verifyReceipt(after, actorAbsent, { filename: PARKVIEW });
    expect(verified.verdict).toBe('verified');
    expect(verified.issues).toEqual([]);
  });

  it('uses exact fresh structured source order for RFC0093 receipt policy counts', async () => {
    const original = await parkview();
    // Same values and subject, different authored lexical order. Integer-index
    // enumeration would erase this distinction, so a model check is insufficient.
    const first = original.replace(/(\`\`\`json uw:section=property[^\n]*\n\s*\{)/, '$1"0":1,');
    expect(first).not.toBe(original);
    const parsed = parseUWFile(first);
    const options = { filename: PARKVIEW, issued_at: ISSUED_AT };
    const issued = await issueReceipt(first, options);
    const modelCount = validateUWFile(parsed).errors.length;
    expect(issued.policy.validation.errors).toBe(modelCount + 1);
    expect((await resolveReceiptSubject(first, options)).subject).toEqual(issued.subject);
    expect((await verifyReceipt(issued, first, options)).verdict).toBe('verified');
    expect(first).toContain('"0":1,');
  });

  it('records every declared output and no others', async () => {
    const receipt = await issueReceipt(await liteDeal(), {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
    });
    const declared = new Set((receipt.computation.results ?? []).map((r) => r.calc_id));
    expect(declared.size).toBe(receipt.computation.results.length);
  });

  it('marks outputs the record cannot support as uncomputed rather than null-valued', async () => {
    const receipt = await issueReceipt(await liteDeal(), {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
    });
    const uncomputed = receipt.computation.results.filter((r) => !r.computed);
    expect(uncomputed.length).toBeGreaterThan(0);
    for (const result of uncomputed) expect(result.value).toBeNull();
    for (const result of receipt.computation.results.filter((r) => r.computed)) {
      expect(result.value).not.toBeNull();
    }
  });

  it('reproduces the same subject digest and results on re-issuance', async () => {
    const raw = await parkview();
    const first = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const second = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    expect(second.subject.digest).toBe(first.subject.digest);
    expect(second.computation.results).toEqual(first.computation.results);
    expect(second.computation.results_digest).toBe(first.computation.results_digest);
  });

  it('refuses when no pack is registered for the asset class', async () => {
    const raw = (await parkview()).replace('asset_class: "multifamily"', `asset_class: "${UNREGISTERED_CLASS}"`);
    await expect(issueReceipt(raw, { filename: PARKVIEW })).rejects.toThrow(/RCP_PACK_UNRESOLVED/);
  });

  it('is total — every input either yields a receipt or a typed ReceiptError', async () => {
    const raw = await parkview();
    const mutations = [
      raw,
      raw.slice(0, Math.floor(raw.length / 2)),
      raw.replace('asset_class: "multifamily"', `asset_class: "${UNREGISTERED_CLASS}"`),
      raw.replace(/```uwmd/g, '```'),
      '',
      '---\nuw_lite_version: 1.0\n---\n',
    ];
    for (const candidate of mutations) {
      try {
        const receipt = await issueReceipt(candidate, { filename: PARKVIEW });
        assertUWReceipt(receipt);
      } catch (e) {
        expect(
          e instanceof ReceiptError || (e as Error).name === 'UWSourceRepresentationError',
          `unexpected error type: ${(e as Error).name}: ${(e as Error).message}`,
        ).toBe(true);
      }
    }
  });
});

describe('verifyReceipt', () => {
  it('verifies a freshly issued receipt', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const result = await verifyReceipt(receipt, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('verified');
    expect(result.issues).toEqual([]);
  });

  it('fails when the record changed after issuance', async () => {
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    const mutated = raw.replace('$1,653,125', '$1,700,000');
    expect(mutated).not.toBe(raw);

    const result = await verifyReceipt(receipt, mutated, { filename: LITE_DEAL });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-01');
  });

  it('is unverifiable, not failed, when the canonicalization version differs (RCP-10)', async () => {
    // A receipt issued before RFC 0025 carries a digest computed under rules
    // this verifier no longer applies. The record is untouched, so reporting
    // `failed` would accuse it of a change that never happened.
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    const stale = clone(receipt);
    stale.subject.canonicalization_version = '1.0';
    stale.subject.digest = `sha256:${'0'.repeat(64)}`;

    const result = await verifyReceipt(stale, raw, { filename: LITE_DEAL });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-10');
    expect(result.issues.map((i) => i.code)).not.toContain('RCP-01');
  });

  it('still fails a genuine mutation when the canonicalization version matches', async () => {
    // The carve-out above must not become a way to launder a real change: same
    // version, different digest, still decisive.
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    expect(receipt.subject.canonicalization_version).toBe('1.1');
    const mutated = raw.replace('$1,653,125', '$1,700,000');
    expect(mutated).not.toBe(raw);

    const result = await verifyReceipt(receipt, mutated, { filename: LITE_DEAL });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-01');
  });

  it('is unverifiable when it cannot resolve a referenced input (RCP-11)', async () => {
    // The reference names an observation set this verifier does not hold. It
    // has not checked something the receipt says the computation depended on,
    // so it may not say `verified` — and an absent set is not tampering, so it
    // may not say `failed` either.
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: [
        {
          source: 'market_data',
          document_id: 'md:phx-multifamily:2026-Q2',
          as_of: '2026-06-30',
          digest: `sha256:${'a'.repeat(64)}`,
        },
      ],
    });
    expect(receipt.receipt_version).toBe('1.1');

    const result = await verifyReceipt(receipt, raw, { filename: LITE_DEAL });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-11');
  });

  it('verifies when the referenced input resolves and matches', async () => {
    const raw = await liteDeal();
    const digest = `sha256:${'a'.repeat(64)}`;
    const receipt = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: [
        { source: 'market_data', document_id: 'md:phx', as_of: '2026-06-30', digest },
      ],
    });

    const result = await verifyReceipt(receipt, raw, {
      filename: LITE_DEAL,
      inputs: { 'md:phx': digest },
    });
    expect(result.verdict).toBe('verified');
    expect(result.issues).toEqual([]);
  });

  it('fails when a referenced input resolved but changed (RCP-12)', async () => {
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: [
        {
          source: 'market_data',
          document_id: 'md:phx',
          as_of: '2026-06-30',
          digest: `sha256:${'a'.repeat(64)}`,
        },
      ],
    });

    const result = await verifyReceipt(receipt, raw, {
      filename: LITE_DEAL,
      inputs: { 'md:phx': `sha256:${'b'.repeat(64)}` },
    });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-12');
  });

  it('does not let a missing reference mask a mutated one', async () => {
    // RCP-12 is checked across all held references before any RCP-11 is
    // recorded, so an unrelated absent set cannot downgrade a real mismatch
    // from `failed` to `unverifiable`.
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: [
        { source: 'market_data', document_id: 'md:absent', digest: `sha256:${'a'.repeat(64)}` },
        { source: 'market_data', document_id: 'md:mutated', digest: `sha256:${'b'.repeat(64)}` },
      ],
    });

    const result = await verifyReceipt(receipt, raw, {
      filename: LITE_DEAL,
      inputs: { 'md:mutated': `sha256:${'c'.repeat(64)}` },
    });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-12');
  });

  it('emits provenance sorted by document_id so re-issuance is stable', async () => {
    const raw = await liteDeal();
    const entries = [
      { source: 'market_data' as const, document_id: 'md:zulu', digest: `sha256:${'a'.repeat(64)}` },
      { source: 'market_data' as const, document_id: 'md:alpha', digest: `sha256:${'b'.repeat(64)}` },
    ];
    const first = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: entries,
    });
    const second = await issueReceipt(raw, {
      filename: LITE_DEAL,
      issued_at: ISSUED_AT,
      inputs_provenance: [...entries].reverse(),
    });

    expect(first.inputs_provenance!.map((e) => e.document_id)).toEqual(['md:alpha', 'md:zulu']);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('omits the section entirely when there is no external input', async () => {
    // What keeps a 1.0 receipt readable: every 1.1 addition is optional.
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    expect(receipt.inputs_provenance).toBeUndefined();
    expect('inputs_provenance' in receipt).toBe(false);
  });

  it('refuses any receipt_version but 1.1 (RFC 0081 §7)', async () => {
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    for (const version of ['1.0', '1.2', '2.0']) {
      const other = clone(receipt);
      other.receipt_version = version as typeof receipt.receipt_version;
      expect(() => assertUWReceipt(other)).toThrow(/RCP_MALFORMED/);
    }
    expect(() => assertUWReceipt(receipt)).not.toThrow();
  });

  it('fails when a stated result does not follow from the record', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const tampered = clone(receipt);
    const dscr = tampered.computation.results.find((r) => r.calc_id === 'dscr');
    expect(dscr).toBeDefined();
    dscr!.value = 9.99;
    tampered.computation.results_digest = await computeResultsDigest(
      tampered.computation.results,
    );

    const result = await verifyReceipt(tampered, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-03');
  });

  it('reports unverifiable — not failed — for an unknown pack', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const foreign = clone(receipt);
    foreign.computation.pack = 'com.example.pack.unknown';

    const result = await verifyReceipt(foreign, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-05');
  });

  it('reports unverifiable when it holds a different version of the named pack', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const older = clone(receipt);
    older.computation.pack_version = '0.9.0';

    const result = await verifyReceipt(older, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-06');
  });

  it('reports unverifiable for a signed receipt with no signature backend', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const signed = clone(receipt);
    signed.signature = { algorithm: 'ed25519', key_id: 'k1', value: 'AAAA' };

    const result = await verifyReceipt(signed, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-08');
  });

  it('fails a signed receipt whose signature does not validate', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const signed = clone(receipt);
    signed.signature = { algorithm: 'ed25519', key_id: 'k1', value: 'AAAA' };

    const result = await verifyReceipt(signed, raw, {
      filename: PARKVIEW,
      signatureVerifier: { verify: async () => false },
    });
    expect(result.verdict).toBe('failed');
  });

  it('attributes a disagreement to the engine when the engine version differs', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
      engine_version: '0.0.1-ancient',
    });
    const tampered = clone(receipt);
    tampered.computation.results.find((r) => r.calc_id === 'ltv')!.value = 0.42;

    const result = await verifyReceipt(tampered, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-07');
  });

  it('attributes a disagreement to the engine when only the engine name differs', async () => {
    // The version strings are identical here on purpose. Comparing versions
    // alone would read that as "same engine, so blame the record" — but these
    // are two unrelated implementations that both happen to be at VERIFY_VERSION.
    const raw = await parkview();
    const receipt = await issueReceipt(raw, {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
      engine: 'other-vendor-engine',
    });
    expect(receipt.computation.engine_version).toBe(VERIFY_VERSION);
    const tampered = clone(receipt);
    tampered.computation.results.find((r) => r.calc_id === 'ltv')!.value = 0.42;

    const result = await verifyReceipt(tampered, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-07');
  });

  it('holds the record responsible when the full engine identity matches', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
      engine: 'other-vendor-engine',
    });
    const tampered = clone(receipt);
    tampered.computation.results.find((r) => r.calc_id === 'ltv')!.value = 0.42;

    // Same verifier identity as the issuer: nothing else can explain the gap.
    const result = await verifyReceipt(tampered, raw, {
      filename: PARKVIEW,
      engine: 'other-vendor-engine',
    });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).not.toContain('RCP-07');
  });

  it.each([['dscr', 0.0000001], ['price_per_unit', 0.01]])('refuses a rehashed %s change smaller than the obsolete relative tolerance', async (id, delta) => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const tampered = clone(receipt);
    const stated = tampered.computation.results.find(r => r.calc_id === id)!;
    stated.value = (stated.value as number) + delta;
    tampered.computation.results_digest = await computeResultsDigest(tampered.computation.results);
    const result = await verifyReceipt(tampered, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('failed');
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'RCP-03', calc_id: id }));
  });

  it('flags a corrupted results_digest even when the numbers agree', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const corrupted = clone(receipt);
    corrupted.computation.results_digest = `sha256:${'0'.repeat(64)}`;

    const result = await verifyReceipt(corrupted, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-04');
  });

  it('reports unverifiable when the record itself cannot be canonicalized', async () => {
    const raw = await liteDeal();
    const receipt = await issueReceipt(raw, { filename: LITE_DEAL, issued_at: ISSUED_AT });
    // The record on hand has parse errors, so it has no canonical form to
    // compare against. That is a "cannot decide", not a negative result.
    const unparseable = raw.replace('<!-- uw:debt.loan_amount -->', '<!-- uw: -->');
    expect(unparseable).not.toBe(raw);

    const result = await verifyReceipt(receipt, unparseable, { filename: LITE_DEAL });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map((i) => i.code)).toContain('RCP-09');
  });

  it('fails a receipt that omits a declared output', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const partial = clone(receipt);
    partial.computation.results = partial.computation.results.slice(1);
    partial.computation.results_digest = await computeResultsDigest(partial.computation.results);

    const result = await verifyReceipt(partial, raw, { filename: PARKVIEW });
    expect(result.verdict).toBe('failed');
    expect(result.issues.map((i) => i.code)).toContain('RCP-02');
  });

  it('never returns a verdict outside the three-state set', async () => {
    const raw = await parkview();
    const receipt = await issueReceipt(raw, { filename: PARKVIEW, issued_at: ISSUED_AT });
    const variants: UWReceipt[] = [receipt];
    for (const mutate of [
      (r: UWReceipt) => {
        r.computation.pack = 'nope';
      },
      (r: UWReceipt) => {
        r.subject.digest = `sha256:${'1'.repeat(64)}`;
      },
      (r: UWReceipt) => {
        r.computation.results = [];
      },
      (r: UWReceipt) => {
        r.computation.engine_version = 'other';
      },
      (r: UWReceipt) => {
        r.inputs_provenance = [
          { source: 'market_data', document_id: 'md:x', digest: `sha256:${'9'.repeat(64)}` },
        ];
      },
      (r: UWReceipt) => {
        r.inputs_provenance = [
          { source: 'some_future_source', document_id: 'md:y', digest: `sha256:${'8'.repeat(64)}` },
        ];
      },
    ]) {
      const variant = clone(receipt);
      mutate(variant);
      variants.push(variant);
    }
    for (const variant of variants) {
      const result = await verifyReceipt(variant, raw, { filename: PARKVIEW });
      expect(['verified', 'failed', 'unverifiable']).toContain(result.verdict);
    }
  });
});

describe('rollup receipts (RFC 0021 §6)', () => {
  const NOI = 'noi_model.net_operating_income';
  const agg = (over: Partial<UWRollupAggregate> = {}): UWRollupAggregate => ({
    id: 'portfolio_noi',
    fn: 'sum',
    over: NOI,
    members: ['deal:parkview', 'deal:riverside'],
    value: 1_049_823,
    ...over,
  });
  const member = (
    document_id: string,
    value: number | null,
    verdict: UWReceiptVerdict = 'verified',
    weight?: number | null,
  ): RollupMember => ({ document_id, value, verdict, ...(weight === undefined ? {} : { weight }) });

  it('verifies a stated sum over its named children', () => {
    const r = verifyRollup(
      [agg()],
      [member('deal:parkview', 612_400), member('deal:riverside', 437_423)],
    );
    expect(r.verdict).toBe('verified');
    expect(r.aggregates[0]).toMatchObject({ stated: 1_049_823, recomputed: 1_049_823, agrees: true });
  });

  it('fails when the stated total disagrees with recomputation', () => {
    const r = verifyRollup(
      [agg({ value: 1_200_000 })],
      [member('deal:parkview', 612_400), member('deal:riverside', 437_423)],
    );
    expect(r.verdict).toBe('failed');
    expect(r.issues.map((i) => i.code)).toContain('COMP-ROLLUP-DISAGREES');
  });

  it('fails the parent when a child failed its own receipt', () => {
    // Stage 1 decides before any arithmetic: a total over a failed child is not
    // worth reporting as agreeing even when the numbers happen to add up.
    const r = verifyRollup(
      [agg()],
      [member('deal:parkview', 612_400, 'failed'), member('deal:riverside', 437_423)],
    );
    expect(r.verdict).toBe('failed');
    expect(r.aggregates).toEqual([]);
  });

  it('is unverifiable when a child is unverifiable, even if the sum agrees', () => {
    const r = verifyRollup(
      [agg()],
      [member('deal:parkview', 612_400, 'unverifiable'), member('deal:riverside', 437_423)],
    );
    expect(r.verdict).toBe('unverifiable');
  });

  it('is unverifiable when a named member is absent, never a smaller total', () => {
    // The dangerous alternative: summing what is present would produce a
    // confident portfolio figure over a portfolio the verifier never saw.
    const r = verifyRollup([agg()], [member('deal:parkview', 612_400)]);
    expect(r.verdict).toBe('unverifiable');
    expect(r.issues.map((i) => i.code)).toContain('RCP-11');
    expect(r.aggregates[0]!.recomputed).toBeNull();
  });

  it('treats an unreadable member value as unevaluable, not as zero', () => {
    const r = verifyRollup(
      [agg()],
      [member('deal:parkview', 612_400), member('deal:riverside', null)],
    );
    expect(r.verdict).toBe('unverifiable');
    expect(r.aggregates[0]!.recomputed).toBeNull();
  });

  it('does not exempt count from the missing-member rule', () => {
    // A count over members whose values could not be read would report a count
    // over a set the verifier never actually saw.
    const r = verifyRollup(
      [agg({ id: 'deal_count', fn: 'count', value: 2 })],
      [member('deal:parkview', 612_400), member('deal:riverside', null)],
    );
    expect(r.verdict).toBe('unverifiable');
  });

  it('evaluates min, max, and count', () => {
    const members = [member('deal:parkview', 612_400), member('deal:riverside', 437_423)];
    expect(verifyRollup([agg({ id: 'a', fn: 'min', value: 437_423 })], members).verdict).toBe('verified');
    expect(verifyRollup([agg({ id: 'b', fn: 'max', value: 612_400 })], members).verdict).toBe('verified');
    expect(verifyRollup([agg({ id: 'c', fn: 'count', value: 2 })], members).verdict).toBe('verified');
  });

  it('evaluates a weighted average', () => {
    const r = verifyRollup(
      [agg({ id: 'wa', fn: 'weighted_average', weight_by: 'property.total_units', value: 0.055 })],
      [
        member('deal:parkview', 0.05, 'verified', 100),
        member('deal:riverside', 0.06, 'verified', 100),
      ],
    );
    expect(r.verdict).toBe('verified');
  });

  it('refuses a weighted average with zero total weight rather than dividing', () => {
    // `failed`, not `unverifiable`, and the distinction is the point: the
    // verifier holds every value it needs. Weights summing to zero make the
    // stated average an assertion that cannot be well-defined, which is a
    // defect in the record rather than a gap in the verifier. Contrast the
    // absent-member case above, where the verifier genuinely cannot see.
    const r = verifyRollup(
      [agg({ id: 'wa', fn: 'weighted_average', weight_by: 'property.total_units', value: 0 })],
      [member('deal:parkview', 0.05, 'verified', 0), member('deal:riverside', 0.06, 'verified', 0)],
    );
    expect(r.verdict).toBe('failed');
    expect(r.aggregates[0]!.recomputed).toBeNull();
    expect(r.issues.map((i) => i.code)).toContain('COMP-ROLLUP-DISAGREES');
  });

  it('rejects an fn outside the fixed vocabulary', () => {
    // The vocabulary is closed by design: nothing lets a document author
    // introduce a new aggregation, and nothing makes the Tier-3 engine iterate.
    const r = verifyRollup([agg({ fn: 'median' as RollupFn })], []);
    expect(r.verdict).toBe('failed');
  });

  it('rejects a member named twice, which would inflate a sum', () => {
    const errors = validateRollupAggregate(
      agg({ members: ['deal:parkview', 'deal:parkview'] }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires weight_by for weighted_average and forbids it elsewhere', () => {
    expect(validateRollupAggregate(agg({ fn: 'weighted_average' })).length).toBeGreaterThan(0);
    expect(validateRollupAggregate(agg({ fn: 'sum', weight_by: 'x' })).length).toBeGreaterThan(0);
  });

  it('exposes exactly the five permitted functions', () => {
    expect([...ROLLUP_FUNCTIONS]).toEqual(['sum', 'count', 'min', 'max', 'weighted_average']);
  });
});

describe('assertUWReceipt', () => {
  it('accepts an issued receipt', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    expect(() => assertUWReceipt(receipt)).not.toThrow();
  });

  it.each([
    ['a non-object', 42],
    ['a wrong version', { receipt_version: '2.0' }],
    ['a malformed digest', { receipt_version: '1.0', subject: { digest: 'nope' } }],
  ])('rejects %s', (_label, value) => {
    expect(() => assertUWReceipt(value)).toThrow(ReceiptError);
  });

  it('rejects an uncomputed result that still carries a value', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    const bad = clone(receipt);
    bad.computation.results[0] = { calc_id: 'x', value: 1, computed: false };
    expect(() => assertUWReceipt(bad)).toThrow(/uncomputed but carries a value/);
  });

  describe('inputs_provenance', () => {
    const withProvenance = async (entries: unknown): Promise<unknown> => {
      const receipt = await issueReceipt(await parkview(), {
        filename: PARKVIEW,
        issued_at: ISSUED_AT,
      });
      const copy = clone(receipt) as unknown as Record<string, unknown>;
      copy['inputs_provenance'] = entries;
      return copy;
    };

    it('accepts a well-formed entry', async () => {
      const ok = await withProvenance([
        { source: 'market_data', document_id: 'md:x', as_of: '2026-06-30', digest: `sha256:${'a'.repeat(64)}` },
      ]);
      expect(() => assertUWReceipt(ok)).not.toThrow();
    });

    it('accepts an unregistered source — the union is open by design', async () => {
      const ok = await withProvenance([
        { source: 'child_record', document_id: 'deal:child-1', digest: `sha256:${'a'.repeat(64)}` },
      ]);
      expect(() => assertUWReceipt(ok)).not.toThrow();
    });

    it('rejects a malformed digest rather than carrying an uncheckable reference', async () => {
      const bad = await withProvenance([
        { source: 'market_data', document_id: 'md:x', digest: 'nope' },
      ]);
      expect(() => assertUWReceipt(bad)).toThrow(/digest/);
    });

    it('rejects a duplicate document_id', async () => {
      const digest = `sha256:${'a'.repeat(64)}`;
      const bad = await withProvenance([
        { source: 'market_data', document_id: 'md:x', digest },
        { source: 'market_data', document_id: 'md:x', digest },
      ]);
      expect(() => assertUWReceipt(bad)).toThrow(/more than once/);
    });

    it('rejects a missing required key', async () => {
      const bad = await withProvenance([{ source: 'market_data', digest: `sha256:${'a'.repeat(64)}` }]);
      expect(() => assertUWReceipt(bad)).toThrow(/document_id/);
    });

    it('rejects a non-array', async () => {
      expect(() => assertUWReceipt(withProvenance)).toThrow(ReceiptError);
      const bad = await withProvenance({ source: 'market_data' });
      expect(() => assertUWReceipt(bad)).toThrow(/must be an array/);
    });
  });
});

describe('computeReceiptResults', () => {
  it('refuses a pack with no declared calculations', async () => {
    const parsed = parseUWFile(await parkview());
    expect(() => computeReceiptResults({ ...MULTIFAMILY_PACK, calculations: [] }, parsed)).toThrow(
      /RCP_NO_CALCULATIONS/,
    );
  });

  it('throws rather than silently dropping a calc that cannot evaluate', async () => {
    const parsed = parseUWFile(await parkview());
    expect(() =>
      computeReceiptResults(
        {
          ...MULTIFAMILY_PACK,
          calculations: [
            { id: 'bad', label: 'bad', formula: 'this is not ) valid', deterministic: true },
          ],
        },
        parsed,
      ),
    ).toThrow(/RCP_COMPUTATION_FAILED/);
  });

  it('honours an explicit pack override', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
      pack: OFFICE_PACK,
    });
    expect(receipt.computation.pack).toBe(OFFICE_PACK.id);
  });

  // The defect RFC 0023 closes. A receipt runs two checks over the same
  // numbers: result comparison and digests now use the same quantized values at
  // their effective precision, while `results_digest` hashes them bit-exactly. Before quantization
  // those could disagree — a last-ULP difference passed the tolerant check and
  // failed the exact one, and the verdict said *corruption*. Quantized results
  // carry no tail for the two to disagree about.
  it('states only quantized values, shared by exact comparison and digests', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    const byId = new Map(receipt.computation.results.map((r) => [r.calc_id, r]));

    for (const decl of MULTIFAMILY_PACK.calculations ?? []) {
      const stated = byId.get(decl.id);
      expect(stated, decl.id).toBeDefined();
      if (typeof stated?.value !== 'number') continue;
      const places = resolveRoundTo(decl);
      expect(quantizeDecimal(stated.value, places), decl.id).toBe(stated.value);
      // No stated value may carry more decimals than its contract allows.
      const decimals = (String(stated.value).split('.')[1] ?? '').length;
      expect(decimals, `${decl.id} has ${decimals} decimals, contract is ${places}`)
        .toBeLessThanOrEqual(places);
    }
  });

  // §VIII.5 / receipt spec §5.2.1. `engine_version` only means something to a
  // reader who knows that engine's release history, which a third-party
  // issuer's verifier does not have. `protocol_version` is the identifier every
  // conforming issuer shares.
  it('states the protocol version it computed under', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    expect(receipt.computation.protocol_version).toBe(PROTOCOL_VERSION);
  });

  it('treats an absent protocol_version as unstated, not as a failure', async () => {
    // A receipt issued before the field existed cannot retroactively claim a
    // version. Verification must not punish it for that — otherwise adding the
    // field would have retroactively invalidated every receipt in the wild.
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    const legacy = clone(receipt);
    delete (legacy.computation as { protocol_version?: string }).protocol_version;

    const verdict = await verifyReceipt(legacy, await parkview(), { filename: PARKVIEW });
    expect(verdict.verdict).toBe('verified');
    expect(verdict.issues).toHaveLength(0);
  });

  it('reproduces results_digest bit-for-bit across issuances', async () => {
    const a = await issueReceipt(await parkview(), { filename: PARKVIEW, issued_at: ISSUED_AT });
    const b = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: '2099-01-01T00:00:00Z',
    });
    expect(b.computation.results_digest).toBe(a.computation.results_digest);
    expect(await computeResultsDigest(a.computation.results))
      .toBe(a.computation.results_digest);
  });
});

describe('receiptSigningPayload', () => {
  it('covers the receipt with signature nulled, so signing is order-independent', async () => {
    const receipt = await issueReceipt(await parkview(), {
      filename: PARKVIEW,
      issued_at: ISSUED_AT,
    });
    const unsigned = receiptSigningPayload(receipt);
    const signed = clone(receipt);
    signed.signature = { algorithm: 'ed25519', key_id: 'k1', value: 'AAAA' };
    expect(receiptSigningPayload(signed)).toBe(unsigned);
  });
});


describe('JCS Unicode admission at receipt boundaries', () => {
  const pack = { ...MULTIFAMILY_PACK, id: 'research.unicode-regression', calculations: [
    { id: 'constant', label: 'Source commitment control', formula: '1', deterministic: true },
  ] };
  const source = (text: string, key: boolean): string => `---\nuw_version: "3.0"\ndeal_id: "unicode-control"\ndeal_name: "Unicode control"\n---\n\n\`\`\`json uw:section=x_unicode\n${JSON.stringify({
    _meta: { section: 'x_unicode', lifecycle: { revision: 1, superseded: false } },
    ...(key ? { [text]: 'kept' } : { value: text }),
  })}\n\`\`\`\n`;

  it.each([
    { text: '\ud800', key: false }, { text: '\ud801', key: false }, { text: '\udc00', key: false },
    { text: '\ud800', key: true }, { text: '\ud801', key: true }, { text: '\udc00', key: true },
  ])('refuses invalid Unicode before receipt identity or signature checks (%#)', async ({ text, key }) => {
    const invalid = source(text, key);
    const receipt = await issueReceipt(source('\ufffd', key), { pack, filename: 'unicode.uwx.md', issued_at: ISSUED_AT });
    // The former serializer gave these invalid strings the replacement character's
    // digest. Keep the existing receipt immutable; never repair its old subject.
    const before = JSON.stringify(receipt);
    let calls = 0;
    const result = await verifyReceipt({ ...receipt, signature: { algorithm: 'ed25519', key_id: 'stub', value: 'AAAA' } }, invalid, {
      filename: 'unicode.uwx.md', packs: [pack],
      signatureVerifier: { verify: async () => { calls++; return true; } },
    });
    expect(result.verdict).toBe('unverifiable');
    expect(result.issues.map(issue => issue.code)).toEqual(['RCP-09']);
    expect(calls).toBe(0);
    expect(JSON.stringify(receipt)).toBe(before);
    // RFC 0106: the Reader refuses the unpaired surrogate before canonicalization.
    await expect(resolveReceiptSubject(invalid, { filename: 'unicode.uwx.md' })).rejects.toThrow(/SOURCE_BLOCK_MALFORMED/);
  });

  it('preserves the existing valid receipt subject and results without rebaselining', async () => {
    const fixture = resolve(__dirname, '../../../conformance/receipts/issue/01-uwx-multifamily');
    const raw = await readFile(resolve(fixture, 'deal.uwx.md'), 'utf8');
    const expected = JSON.parse(await readFile(resolve(fixture, 'expected-receipt.json'), 'utf8')) as UWReceipt;
    expect((await resolveReceiptSubject(raw, { filename: 'control.uwx.md' })).subject).toEqual(expected.subject);
    expect((await verifyReceipt(expected, raw, { filename: 'control.uwx.md' })).verdict).toBe('verified');
  });
});


describe('JCS receipt artifact error boundaries', () => {
  const source = '---\nuw_version: "3.0"\ndeal_id: "jcs-boundary"\n---\n\n```json uw:section=x_control\n{"_meta":{"section":"x_control","lifecycle":{"revision":1,"superseded":false}},"value":1}\n```\n';
  const pack = { ...MULTIFAMILY_PACK, id: 'test.jcs-boundary', calculations: [
    { id: 'constant', label: 'Boundary control', formula: '1', deterministic: true },
  ] };
  const options = { pack, filename: 'boundary.uwx.md', issued_at: ISSUED_AT };
  const signature = { algorithm: 'ed25519', key_id: 'stub', value: 'AAAA' };

  it.each([
    ['issuer', (receipt: UWReceipt) => { receipt.issuer = '\ud800'; }],
    ['issued_at', (receipt: UWReceipt) => { receipt.issued_at = '\ud800'; }],
    ['engine', (receipt: UWReceipt) => { receipt.computation.engine = '\ud800'; }],
    ['engine_version', (receipt: UWReceipt) => { receipt.computation.engine_version = '\ud800'; }],
    ['policy_set', (receipt: UWReceipt) => { receipt.policy.policy_set = '\ud800'; }],
  ] as const)('maps unencodable signed %s to RCP-01 without changing unsigned admission', async (_field, mutate) => {
    const receipt = await issueReceipt(source, options);
    mutate(receipt);
    let calls = 0;
    const verifyOptions = { filename: options.filename, packs: [pack],
      signatureVerifier: { verify: async () => { calls++; return true; } } };
    expect((await verifyReceipt(receipt, source, verifyOptions)).verdict).toBe('verified');
    receipt.signature = signature;
    const before = JSON.stringify(receipt);
    expect((await verifyReceipt(receipt, source, verifyOptions)).issues.map(issue => issue.code)).toEqual(['RCP-01']);
    expect(calls).toBe(0);
    expect(JSON.stringify(receipt)).toBe(before);
    expect((await verifyReceipt(receipt, source, { filename: options.filename, packs: [pack] })).issues.map(issue => issue.code)).toEqual(['RCP-08']);
    expect(() => receiptSigningPayload(receipt)).toThrow(InvalidUnicodeError);
  });

  it.each(['id', 'version'] as const)('maps matching unencodable pack %s to signature refusal rather than pack absence', async field => {
    const receipt = await issueReceipt(source, options);
    const namedPack = { ...pack, [field]: '\ud800' };
    if (field === 'id') receipt.computation.pack = namedPack.id;
    else receipt.computation.pack_version = namedPack.version;
    receipt.signature = signature;
    let calls = 0;
    const result = await verifyReceipt(receipt, source, { filename: options.filename, packs: [namedPack],
      signatureVerifier: { verify: async () => { calls++; return true; } } });
    expect(result.issues.map(issue => issue.code)).toEqual(['RCP-01']);
    expect(calls).toBe(0);
  });

  it.each(['key_id', 'algorithm', 'value'] as const)('leaves excluded signature %s to the backend', async field => {
    const receipt = await issueReceipt(source, options);
    const payload = receiptSigningPayload(receipt);
    receipt.signature = { ...signature, [field]: '\ud800' };
    expect(receiptSigningPayload(receipt)).toBe(payload);
    let calls = 0;
    expect((await verifyReceipt(receipt, source, { filename: options.filename, packs: [pack],
      signatureVerifier: { verify: async () => { calls++; return true; } } })).verdict).toBe('verified');
    expect(calls).toBe(1); // Control flow only: this stub makes no cryptographic claim.
  });

  it('returns a typed issuance refusal when computed results cannot be canonicalized', async () => {
    const invalidPack = { ...pack, calculations: [{ ...pack.calculations[0]!, formula: "'\ud800'" }] };
    await expect(issueReceipt(source, { ...options, pack: invalidPack })).rejects.toMatchObject({
      name: 'ReceiptError', code: 'RCP_COMPUTATION_FAILED',
    });
  });

  it('maps an agreed but unencodable stated result to late RCP-04, preserving engine disagreement precedence', async () => {
    const receipt = await issueReceipt(source, options);
    const invalidPack = { ...pack, calculations: [{ ...pack.calculations[0]!, formula: "'\ud800'" }] };
    receipt.computation.results[0]!.value = '\ud800';
    const before = JSON.stringify(receipt);
    const result = await verifyReceipt(receipt, source, { filename: options.filename, packs: [invalidPack] });
    expect(result).toMatchObject({ verdict: 'failed', issues: [{ code: 'RCP-04' }], recomputed: [{ value: '\ud800' }] });
    expect(result.issues[0]!.expected).toBeUndefined();
    expect(JSON.stringify(receipt)).toBe(before);
    await expect(computeResultsDigest(receipt.computation.results)).rejects.toBeInstanceOf(InvalidUnicodeError);
    receipt.computation.engine = 'another-engine';
    expect((await verifyReceipt(receipt, source, { filename: options.filename, packs: [pack] })).issues[0]!.code).toBe('RCP-07');
    receipt.computation.engine = VERIFY_PACKAGE_NAME;
    expect((await verifyReceipt(receipt, source, { filename: options.filename, packs: [pack] })).issues[0]!.code).toBe('RCP-03');
  });

  it('preserves earlier subject mismatch and pack absence ahead of signing-input refusal', async () => {
    const receipt = await issueReceipt(source, options);
    receipt.issuer = '\ud800';
    receipt.signature = signature;
    let calls = 0;
    const verifyOptions = { filename: options.filename, packs: [pack],
      signatureVerifier: { verify: async () => { calls++; return true; } } };
    receipt.subject.digest = `sha256:${'0'.repeat(64)}`;
    expect((await verifyReceipt(receipt, source, verifyOptions)).issues[0]).toMatchObject({ code: 'RCP-01', expected: receipt.subject.digest });
    receipt.subject.digest = (await resolveReceiptSubject(source, { filename: options.filename })).subject.digest;
    expect((await verifyReceipt(receipt, source, { ...verifyOptions, packs: [] })).issues.map(issue => issue.code)).toEqual(['RCP-05']);
    expect(calls).toBe(0);
  });

  it('does not relabel arbitrary backend exceptions as malformed input', async () => {
    const receipt = await issueReceipt(source, options);
    receipt.signature = signature;
    const error = new TypeError('backend failure');
    await expect(verifyReceipt(receipt, source, { filename: options.filename, packs: [pack],
      signatureVerifier: { verify: async () => { throw error; } } })).rejects.toBe(error);
  });
});

describe('RFC 0088 authenticate-first receipt precedence', () => {
  it('authenticates real signatures before a typed refusal, including a different engine', async () => {
    const content = await parkview();
    const pack = { ...MULTIFAMILY_PACK, id: 'org.uwmd.test.authenticate-first', version: '1.0.0',
      calculations: [{ id: 'scalar', label: 'Stage control', formula: '1+1', deterministic: true as const, round_to: 12 }] };
    const refusing = { ...pack, calculations: [{ ...pack.calculations[0]!, formula: 'irr(1,1)' }] };
    const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),
      Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f','hex')]), format: 'der', type: 'pkcs8' });
    const publicKey = createPublicKey(key);
    const issued = await issueReceipt(content, { pack, issued_at: ISSUED_AT, issuer: 'public-test-key' });
    const signed = (otherEngine = false, invalid = false): UWReceipt => {
      const receipt = structuredClone(issued);
      if (otherEngine) receipt.computation.engine = 'other-engine';
      receipt.signature = { algorithm: 'ed25519', key_id: 'public-test-key',
        value: sign(null, Buffer.from(receiptSigningPayload(receipt)), key).toString('base64') };
      if (invalid) {
        const bytes = Buffer.from(receipt.signature.value, 'base64');
        bytes[0] = bytes[0]! ^ 1;
        receipt.signature.value = bytes.toString('base64');
      }
      return receipt;
    };
    for (const otherEngine of [false, true]) {
      for (const invalid of [false, true]) {
        const receipt = signed(otherEngine, invalid);
        const original = JSON.stringify(receipt);
        let calls = 0;
        const result = await verifyReceipt(receipt, content, { packs: [refusing], signatureVerifier: {
          verify: async (actual, payload) => {
            calls++;
            expect(payload).toBe(receiptSigningPayload(actual));
            return verifyEd25519(null, Buffer.from(payload), publicKey, Buffer.from(actual.signature!.value, 'base64'));
          },
        } });
        expect(calls).toBe(1);
        expect(result.verdict).toBe('failed');
        expect(result.issues.map(issue => issue.code)).toEqual([invalid ? 'RCP-01' : 'RCP-03']);
        if (invalid) expect(Object.hasOwn(result, 'recomputed')).toBe(false);
        else expect(result.recomputed).toEqual([]);
        expect(JSON.stringify(receipt)).toBe(original);
      }
    }
    const unavailable = await verifyReceipt(signed(), content, { packs: [refusing] });
    expect(unavailable.issues.map(issue => issue.code)).toEqual(['RCP-08']);
    expect(Object.hasOwn(unavailable, 'recomputed')).toBe(false);
    const unsigned = await verifyReceipt(issued, content, { packs: [refusing] });
    expect(unsigned.issues.map(issue => issue.code)).toEqual(['RCP-03']);
    expect(unsigned.recomputed).toEqual([]);
    const backendFailure = new Error('backend transport control');
    await expect(verifyReceipt(signed(), content, { packs: [refusing], signatureVerifier: {
      verify: async () => { throw backendFailure; },
    } })).rejects.toBe(backendFailure);
    const malformed = signed();
    malformed.issuer = '\ud800';
    let malformedCalls = 0;
    const malformedResult = await verifyReceipt(malformed, content, { packs: [refusing], signatureVerifier: {
      verify: async () => { malformedCalls++; return true; },
    } });
    expect(malformedCalls).toBe(0);
    expect(malformedResult.issues.map(issue => issue.code)).toEqual(['RCP-01']);
    expect(Object.hasOwn(malformedResult, 'recomputed')).toBe(false);
    expect(await parkview()).toBe(content);
  });
});
