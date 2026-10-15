# Verification examples

Four small programs that show what verifying a `.uw.md` document catches, using
only the published packages. Each runs on its own, prints what it checked, and
exits 0 when the verifier reports what the scenario expects.

| Script | Scenario | Expected result |
|---|---|---|
| [`01-valid-document.mjs`](01-valid-document.mjs) | [`deal.uwx.md`](deal.uwx.md) as published | Validation clean; 8 stated metrics `verified` |
| [`02-incorrect-stated-metric.mjs`](02-incorrect-stated-metric.mjs) | [`deal.wrong-cap-rate.uwx.md`](deal.wrong-cap-rate.uwx.md): stated cap rate 0.0600 where the record gives 0.0542 | `quick_metrics.cap_rate` `failed` (Protocol §II.2 item 2) |
| [`03-tampered-receipt.mjs`](03-tampered-receipt.mjs) | A receipt issued for `deal.uwx.md`, then a result edited, then the record changed | `verified`; `failed` with `RCP-03`; `failed` with `RCP-01` ([UW Receipt](../../spec/UW_RECEIPT.md) §5.1) |
| [`04-document-signature-failure.mjs`](04-document-signature-failure.mjs) | A detached document signature over `deal.uwx.md` (RFC 0084) | `verified`; a changed document `failed` (`subject_mismatch`, `INT-11`); an untrusted key `unverifiable` (`unknown_kid`, `INT-13`) |

`deal.uwx.md` is a copy of
[`Agave-Court-Apts-Scottsdale-AZ.uwx.md`](../Agave-Court-Apts-Scottsdale-AZ.uwx.md);
`deal.wrong-cap-rate.uwx.md` differs from it in that one line. Receipts and
signing keys are created when a script runs, so no private key or
engine-specific receipt is stored here.

Each script also takes document paths as arguments, so you can point it at
your own files:

```bash
node 01-valid-document.mjs my-deal.uwx.md
```

## Run them from a clean directory

Node 20 or later. Copy this folder anywhere, then:

```bash
npm init -y
npm install @uwmd/verify @uwmd/signing
node 01-valid-document.mjs
node 02-incorrect-stated-metric.mjs
node 03-tampered-receipt.mjs
node 04-document-signature-failure.mjs
```

Scenarios 1 to 3 need only `@uwmd/verify`. `@uwmd/signing` supplies the
cryptography for scenario 4. `@uwmd/verify` itself carries none.

## Run them from this repository

After `npm install` and `npm run build` at the repository root, the same
scripts resolve the workspace packages:

```bash
node examples/verification/01-valid-document.mjs
npm run examples:verification   # runs all four and checks their exit codes
```

## What each verdict means

- **Stated metrics** (scenarios 1 and 2) are recomputed from the document's own
  inputs under the [metric dictionary](../../spec/metrics/README.md) and
  compared at the stated precision. A metric whose inputs are absent is
  `unverifiable`, not `failed`.
- **A receipt** (scenario 3) attests that its stated outputs follow from the
  record it names. It does not attest that the inputs are true.
- **A document signature** (scenario 4) authenticates the snapshot a signer
  assembled. It does not establish that the figures are correct, so it is
  checked separately from scenarios 1 to 3. Required authentication accepts
  only `verified`.

The CLI equivalents are `uwmd verify` (scenarios 1 and 2: `uwmd verify
deal.wrong-cap-rate.uwx.md` reports the failed cap rate and exits 1),
`uwmd receipt issue` and `uwmd receipt verify` (scenario 3), and
`uwmd sign-document` with `uwmd verify --document-signature` (scenario 4)
([CLI reference](../../docs/wiki/08-tools.md)). The CLI checks stated metrics
from CLI 5.0.0; `@uwmd/cli` 4.2.0 prints `OK` for scenario 2.
