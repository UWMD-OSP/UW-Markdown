---
rfc: 0115
title: Portable conformance subcommands for every Verifier obligation
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - protocol-spec
  - conformance-corpus
  - core-library
---

# RFC 0115: Portable conformance subcommands for every Verifier obligation

> **Accepted by the owner, 2026-10-22, as drafted** (owner: "RFC 0115 (#483) accepted as drafted, including D2 and D4.").
> Origin: the issue #354 inventory of what an
> independent implementation needs for the Verifier tier. It adds subcommands
> and capability flags to the conformance CLI protocol (Protocol §II.6a), so it
> is normative.

## Summary

Protocol §II.2 lists the Verifier's obligations, but the shared conformance
driver can check only some of them. Portable cases exist for `validate`,
`calc` and the two reserve verifiers (§VIII.11, §VIII.12). Metric reproduction,
calendar cash flows, property cash-flow assembly, waterfalls, the capital-stack
and lease-up verifiers, and receipts have none. §II.6a.4 therefore says that
passing the portable subset "is not a claim about omitted checks". A second
implementation can pass every portable Verifier case (the Python implementation
passes 345 of 345) and still lack most of the tier. This RFC gives each
remaining obligation one CLI subcommand, one capability flag and generated
portable cases. Then "passes the Verifier tier" means the same thing for every
implementation.

## Motivation

- **A tier claim the driver cannot check.** §II.6 asks that self-certification
  be run, not believed (§II.5). Today a Verifier claim is believed for six of
  its nine obligations.
- **The reference already has the results.** `@uwmd/verify` exports the result of
  each verifier: `StatedMetricsReport`, `CashFlowVerification`,
  `WaterfallVerification`, `CapitalStackVerification`, `LeaseUpVerification`,
  `UWReceiptVerification`, and the property-assembly result. The reference CLI
  already exposes several of them (`verify`, `verify-cash-flows`,
  `assemble-property`, `receipt verify`). What is missing is the protocol
  contract and the generated cases.
- **Partial claims should skip honestly.** An implementation that has built
  some verifiers should report the others as skipped by capability (§II.6a.5).
  It should not fail them, and it should not have to withhold `calc-evaluate`.

## Proposed change

1. **Subcommands (§II.6a.1).** Each returns the named result as one JSON document
   and follows the §II.6a.2 exit contract. A failed verification exits 1; an
   absent or unverifiable subject exits 0.

   | Invocation | stdout | Obligation |
   |---|---|---|
   | `<bin> verify-metrics <file> --json` | `StatedMetricsReport` | §II.2.2, RFC 0099 |
   | `<bin> verify-cash-flows <file> --json` | `CashFlowVerification` | §VIII.9 |
   | `<bin> verify-property-cash-flows <file> --json` | the property cash-flow assembly verification | §VIII.9.6 |
   | `<bin> verify-waterfall <file> --json` | `WaterfallVerification` | §VIII.10 |
   | `<bin> verify-capital-stack <file> --json` | `CapitalStackVerification` | Format §4.24 |
   | `<bin> verify-lease-up <file> --json` | `LeaseUpVerification` | Format §4.25 |
   | `<bin> verify-receipt <receipt.json> <file> --json` | `UWReceiptVerification` | §II.2.4, Receipt §5 |

   The two reserve subcommands keep their names and §VIII.11/§VIII.12
   definitions, and the table lists them for completeness.
2. **§II.2 item 3** names the capital-stack and lease-up verifiers, which the
   corpus already assigns to the Verifier (D3).
3. **Capability flags (§II.6a.5, D2).** One `ViewerCapability` per subcommand:
   `verify-metrics`, `verify-cash-flows`, `verify-property-cash-flows`,
   `verify-waterfall`, `verify-capital-stack`, `verify-lease-up`,
   `verify-receipts`, and, for the existing reserve cases, `verify-reserve-accounts`
   and `verify-reserve-draws`. A generated case requires its flag plus `parse`. A
   Verifier tier claim requires every flag; a manifest that omits one is a
   partial claim (§II.5) and publishes capabilities without a tier.
4. **Result shapes.** Each result type is defined in `protocol.ts` and
   `spec/schemas/` (invariant 7) before cases compare against it. Where the
   reference type lives only in its module today, it moves into the protocol
   surface unchanged. The comparison stays a subset per §II.6a.3.
5. **Generated cases.** `scripts/gen-conformance-cases.mjs` emits portable cases,
   target `verifier`, from the reference suites that already hold these checks:
   - `conformance/metrics/` statement-home cases;
   - `cash-flow/`;
   - `property-cash-flow-assembly/`;
   - `waterfall/`;
   - `capital-stack/`;
   - `lease-up/`;
   - `receipts/verify`.

   No expected result changes. The ownership index stays as it is, because these
   checks are already Verifier-owned.
6. **Receipts (D4).** Some receipt cases expect values recomputed with a
   multifamily calculation pack, and RFC 0078 classes packs as starter products.
   A portable receipt case expects what a pack-less Verifier can determine: the
   subject, integrity and signature checks, and every value the metric
   dictionary defines. A value only a pack computes is reported `unverifiable`
   (RCP-05). The reference runner keeps its pack-based receipt cases as starter
   checks.

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). The reference implementation
claims every capability, so its results do not change. The Python
implementation's manifest gains flags only as it implements each verifier.

## Conformance impact

New portable cases, roughly 200 across the seven families, are generated from
existing fixtures. The reference CLI gains or renames subcommands to match:
`verify-metrics` is `verify` today, and `verify-property-cash-flows` is
`assemble-property`. No fixture or expected value changes, except the receipt
expectations split under D4.

## Reference implementation

The protocol text, the `protocol.ts` and schema result types, the new
`ViewerCapability` values, the CLI subcommands, the generator and the
regenerated `conformance/runner/cases/`, the runner's command table, and the
Python implementation's manifest (which claims none of the new flags yet).

## Alternatives considered

- **Keep the reserve precedent of `parse` + `calc-evaluate` as the required
  capabilities.** This is simpler, but an implementation that evaluates
  expressions and has not built the waterfall verifier would fail those cases
  instead of skipping them, and so could not publish an honest partial claim.
  Not proposed; see D2.
- **One `verify <file> --json` that runs every verifier.** This means fewer
  subcommands, but one result mixes nine obligations, and a partial
  implementation cannot skip the parts it lacks. Rejected.
- **Leave these obligations to the reference runner only.** That is the status
  quo, and it is the problem. Rejected.

## Decisions (accepted 2026-10-22)

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Subcommand names | `verify-<obligation>` as tabled; the reference CLI renames `verify` and `assemble-property` to match | One naming pattern, as the reserve verifiers already use. Alternative: protocol names alias the reference CLI's existing names |
| D2 | Required capabilities | **Ruled:** A flag per verifier, reserve cases included | Honest partial claims (§II.5). Alternative: `parse` + `calc-evaluate`, as the reserve cases use today |
| D3 | Capital-stack and lease-up verifiers | Named in §II.2 item 3 | The corpus already assigns them to the Verifier |
| D4 | Pack-dependent receipt values | **Ruled:** Portable cases expect what the dictionary defines; pack-only values are RCP-05 `unverifiable`; pack-based expectations stay starter checks | RFC 0078: packs are starter products. Alternative: Verifiers must carry the multifamily pack |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0004 (the conformance CLI protocol); RFC 0078 (Reader and Verifier tiers,
  starter products); RFC 0099 (statement homes).
- §VIII.11 and §VIII.12, which define `verify-reserve-accounts` and
  `verify-reserve-draws` as portable subcommands.
- Issue #354 and its 2026-10-21 inventory comment.
