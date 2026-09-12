# Period consumers — implementation and remaining scope

Status: **refinement and numeric Excel export implemented for owner review** in
[RFC 0042](../rfcs/0042-period-refinement.md) and
[RFC 0043](../rfcs/0043-contextual-excel-period-bindings.md), 2026-09-12.
Source Protocol is 2.11.0. Published core/CLI 2.7.0 still pairs with Protocol
2.8.0; no new package publication is included in these development PRs.

## Implemented outcome

Formulas retain explicit year, quarter, month or date identity in refinement and
in requested workbook calculations. Both use the existing five-series registry
and variant selection. Neither infers a default for a missing period.

| Consumer | Implementation | Remaining scope |
|---|---|---|
| Refinement | Stated numeric period values remain fixed while ordinary scalar gaps are ranked. Structured per-output issues are visible in JSON and CLI text. | Period ranges/defaults, stochastic VOI and improved interval algorithms. |
| Excel emitter | Trusted periodBindings produce exact identity lookups with whole-series validation. Static named ranges alone still refuse. | Non-arithmetic custom expression parity and general result chaining. |
| Workbook builder | Explicit calculation IDs export result/input sheets and selected series tables, with exact variants/overrides. | Structural period-set changes inside a workbook and reverse import of additional inputs. |
| Verification | Native Excel 16.0 build 20326: 14 scenarios, 48 checks, exact supported-case parity and save/reopen. | Other spreadsheet engines and application versions. |

## Workbook decisions resolved by RFC 0043

- Whole-row reordering is supported by canonical identity lookup; fixed positions
  never substitute for a period. Source identities form a closed snapshot.
- Missing inputs are #N/A, invalid identities/nonnumeric inputs are #VALUE!, and
  a true zero remains numeric. Guards validate the entire selected series.
- The caller explicitly chooses calculation IDs. Context applies to those extra
  calculations; existing pack sheets and their metric dictionary are unchanged.
- Excel 2016-compatible functions are used; native tests identify the actual
  application version tested. Formula snapshots alone are not the parity proof.
- Additional workbook edits are export-only. Import refuses them explicitly,
  rather than silently discarding new period or scalar input edits.

See the [native verification record](../../docs/reviews/2026-09-12-excel-period-bindings.md)
and the RFCs for the complete acceptance contracts. Before expanding any scope,
pin input/period identity, missing-value behavior and actual recalculation checks.

## Next development decisions

[RFC 0044](../rfcs/0044-explicit-lease-up-cash-flow-projection.md) now proposes
an explicit-date projection, supported by an [executable example](../../docs/LEASE_UP_CASH_FLOW_WORKFLOW.md).
The adapter is not implemented; full DCF coupling still needs complete economic
coverage and valuation-anchor rules. Lease-up net_cash_flow covers receipts,
concessions and TI/LC, not complete property/equity cash flow.
Speculative leasing still needs renewal, vacancy, market-reset and TI/LC rules.
These consumers select stated data; they do not create those economic models.
Relative Qn/Mn, currency conversion, bps precision and module-defined period
series remain separate contracts.
