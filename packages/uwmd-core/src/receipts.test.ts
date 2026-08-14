// Receipts — RFC 0016 / `spec/UW_RECEIPT_v1.md`.
//
// The behaviours worth pinning: issuance is total (a receipt or a typed error,
// never something in between), re-issuance over an unmodified record is stable,
// and the verifier keeps `unverifiable` genuinely distinct from `failed`.

import { describe, expect, it } from 'vitest';
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
  type UWReceipt,
} from './receipts.js';
import { quantizeDecimal, resolveRoundTo } from './calc/quantize.js';
import { MULTIFAMILY_PACK } from './packs/multifamily.js';
import { OFFICE_PACK } from './packs/office.js';
import { CORE_VERSION } from './version.js';
import { parseUWFile } from './parser.js';

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

    expect(receipt.receipt_version).toBe('1.0');
    expect(receipt.computation.pack).toBe(MULTIFAMILY_PACK.id);
    expect(receipt.computation.pack_version).toBe(MULTIFAMILY_PACK.version);
    expect(receipt.computation.engine_version).toBe(CORE_VERSION);
    expect(receipt.issued_at).toBe(ISSUED_AT);
    expect(receipt.signature).toBeNull();

    const ids = receipt.computation.results.map((r) => r.calc_id).sort();
    expect(ids).toEqual((MULTIFAMILY_PACK.calculations ?? []).map((c) => c.id).sort());
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
  // numbers: `RECEIPT_RESULT_TOLERANCE` compares stated against recomputed at
  // 1e-6, while `results_digest` hashes them bit-exactly. Before quantization
  // those could disagree — a last-ULP difference passed the tolerant check and
  // failed the exact one, and the verdict said *corruption*. Quantized results
  // carry no tail for the two to disagree about.
  it('states only quantized values, so the tolerant and exact checks cannot disagree', async () => {
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
