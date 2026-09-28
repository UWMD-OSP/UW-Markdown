# Task matrix

Active milestone: **RFC 0064 reserve-account roll-forward** — implemented on
the `feat/rfc-0064-reserve-accounts` branch, awaiting the owner's merge (which
is the acceptance record). See [SPEC.md](SPEC.md).

| Task | State | Evidence |
|---|---|---|
| Core module `reserve-accounts.ts` (types, identity, verifier) | done | `reserve-accounts.test.ts` |
| Validator family `RSV-01`–`RSV-07` | done | `validator.reserve-accounts.test.ts`; `verify-codes` 228 codes |
| Section registry, view model, exports (index + browser) | done | `market-data.test.ts` section-ID parity |
| Format §4.28, protocol §VIII.9.7, §XI row, Protocol 2.19.0 labels | done | `verify-versions` |
| Schema `section-reserve-accounts.schema.json` + README row | done | `validate-schemas` 47; `verify-indexes` |
| Conformance suite `reserves` (15) + `reserve-statement-does-not-cure` | done | `npm run conformance` 666/666 |
| Records: CHANGELOG, VERSIONS, ROADMAP, wiki 13, workflow doc, RFC index | done | this branch |
| Owner merge → RFC `accepted` on `main` | **owner** | pull request |
| Release: tag `v2.14.0` after trusted-publisher check | **owner** | `npm run release:check` |

Next contracts on the Priority-1 path (each needs its own RFC; none started):

1. **Draw-to-expenditure binding** — tie a `reserve_accounts` draw to the gross
   row it funded, so an RFC 0045 successor can relax
   `reserve_spending_excluded` with one auditable owner-cash treatment.
2. **Financing assembly** — debt service, fees and payoff generated from stated
   `debt_structure` / `capital_stack` terms into a dated levered stream; the
   bounded first scope is one fixed-rate senior tranche with stated IO and
   amortization, refusing floating, hedged and multi-tranche structures.
3. **Speculative leasing** — pinned against a concrete adopter example
   (renewal probability, cohorts, downtime, market resets, TI/LC timing).

RFC 0063's completed record: [archive](../archive/rfc-0063-exclusive-boundary.md).
