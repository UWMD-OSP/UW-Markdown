# UW Markdown — Schemas

Normative JSON Schemas for protocol types and a structural XSD for UW XML that
cross integration boundaries. Tools written in any language can validate these
contracts without reverse-engineering the reference TypeScript implementation.

The JSON schemas use [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema)
and publish under the `https://uwmd.org/schemas/` `$id` prefix. The XSD targets
the UW XML 1.0 namespace `https://uwmd.org/ns/document/1`. The current canonical
files live in this directory pending publication on `uwmd.org`.

| Schema | Mirrors | Spec section |
|---|---|---|
| [`uwmd-block.schema.json`](uwmd-block.schema.json) | Bare payload + nested `_meta` (Format 3.0) | Format §2.4–§2.6 |
| [uw-document-envelope.schema.json](uw-document-envelope.schema.json) | UWDocumentEnvelope | RFC 0014 / Envelope 1.0 |
| [uw-document-envelope.xsd](uw-document-envelope.xsd) | Structural UW XML 1.0 tooling schema | [UW XML Mapping 1.0](../UW_XML_MAPPING.md) |
| [`edit-operation.schema.json`](edit-operation.schema.json) | `EditOperation` (discriminated union) | Protocol §V |
| [`protocol-error.schema.json`](protocol-error.schema.json) | `ProtocolError` | Protocol §XI |
| [institution-config.schema.json](institution-config.schema.json) | Canonical institution config wire object | Format C.6 / Protocol VI.3 / RFC0097 |
| [`implementation-manifest.schema.json`](implementation-manifest.schema.json) | `ImplementationManifest` | Protocol §I.4 |
| [`metric-dictionary.schema.json`](metric-dictionary.schema.json) | `MetricDictionary` | [Metric dictionary](../metrics/README.md) / RFC 0078 |
| [`conformance-case.schema.json`](conformance-case.schema.json) | Portable case with one `ConformanceTarget` | Protocol §II.6a.4 / RFC 0078 |
| [`conformance-corpus.schema.json`](conformance-corpus.schema.json) | Exhaustive corpus ownership index | Protocol §II.6 / RFC 0078 |
| [`calc-result.schema.json`](calc-result.schema.json) | `CalcResult` | Protocol §VIII |
| [`issue-remediation.schema.json`](issue-remediation.schema.json) | `IssueRemediation` | Protocol §III.6a |
| [`module-manifest.schema.json`](module-manifest.schema.json) | `ModuleManifest` | Protocol §X |
| [`module-signature.schema.json`](module-signature.schema.json) | `ModuleSignature` | Protocol §X.1 |
| [uw-document-signature.schema.json](uw-document-signature.schema.json) | UWDocumentSignature | RFC 0084 / Signing 1 |
| [`uw-receipt.schema.json`](uw-receipt.schema.json) | `UWReceipt` | [UW Receipt 1.1](../UW_RECEIPT.md) / RFC 0016 |
| [`section-gaps.schema.json`](section-gaps.schema.json) | `SectionGaps` | Protocol §VII |
| [`section-components.schema.json`](section-components.schema.json) | `components` section (mixed-use) | Format §4.23 / RFC 0019 |
| [`section-capital-stack.schema.json`](section-capital-stack.schema.json) | `capital_stack` section (tranches + sizing) | Format §4.24 / RFC 0026 |
| [`section-lease-up-schedule.schema.json`](section-lease-up-schedule.schema.json) | `lease_up_schedule` section (trajectory + stabilized summary) | Format §4.25 / RFC 0008 |
| [`section-cash-flow-series.schema.json`](section-cash-flow-series.schema.json) | `cash_flow_series` section (dated flows + stated metrics) | Format §4.26 / RFC 0034 |
| [`section-reserve-accounts.schema.json`](section-reserve-accounts.schema.json) | ReserveAccounts | Format §4.28 / RFC 0064 |
| [reserve-accounts-verification.schema.json](reserve-accounts-verification.schema.json) | ReserveAccountsVerification | Protocol §VIII.11 / RFC 0064 |
| [`stated-metrics-report.schema.json`](stated-metrics-report.schema.json) | `StatedMetricsReport` (`verify-metrics`) | Protocol §II.2 item 2, §II.6a.1 / RFC 0115 |
| [`section-verification-report.schema.json`](section-verification-report.schema.json) | `SectionVerificationReport` with `CashFlowVerification`, `WaterfallVerification`, `CapitalStackVerification`, `LeaseUpVerification` | Protocol §II.6a.1 / RFC 0115 |
| [`receipt-verification.schema.json`](receipt-verification.schema.json) | `UWReceiptVerification` (`verify-receipt`) | [UW Receipt](../UW_RECEIPT.md) §5, Protocol §II.6a.1 / RFC 0115 |
| [`section-distribution-waterfall.schema.json`](section-distribution-waterfall.schema.json) | `distribution_waterfall` section (tier ladder + stated outcomes) | Format §4.27 / RFC 0035 |
| [`rent-roll-hospitality.schema.json`](rent-roll-hospitality.schema.json) | hospitality `rent_roll` class contract (room nights, ADR, occupancy; no `keys`) | Format §4.3 / RFC 0081 G3 |
| [`lease-escalation-schedule.schema.json`](lease-escalation-schedule.schema.json) | commercial tenant rent-step schedule | Format §4.3 / RFC 0055 |
| [`lease-recovery-terms.schema.json`](lease-recovery-terms.schema.json) | commercial tenant expense-recovery terms | Format §4.3 / RFC 0058 |
| [`lease-recovery-true-up.schema.json`](lease-recovery-true-up.schema.json) | closed-period CAM reconciliation rows | Format §4.3 / RFC 0058 |
| [`lease-termination-option.schema.json`](lease-termination-option.schema.json) | commercial tenant break option | Format §4.3 / RFC 0055 |
| [`lease-co-tenancy.schema.json`](lease-co-tenancy.schema.json) | commercial tenant co-tenancy trigger and remedy | Format §4.3 / RFC 0055 |
| [`tax-reassessment.schema.json`](tax-reassessment.schema.json) | `noi_model` reassessment basis (going-in) | Format §4.5 / RFC 0053 |
| [`tax-abatement.schema.json`](tax-abatement.schema.json) | `noi_model` abatement schedule | Format §4.5 / RFC 0053 |
| [`tax-terminal.schema.json`](tax-terminal.schema.json) | `dcf.exit_analysis.terminal_tax` (the next buyer's) | Format §4.9 / RFC 0053 |
| [`debt-rate-hedge.schema.json`](debt-rate-hedge.schema.json) | `debt_structure.rate_hedge` (cap strike, notional, term) | Format §4.7 / RFC 0056 |
| [`sources-uses-escrow.schema.json`](sources-uses-escrow.schema.json) | one entry of `sources_uses.uses.escrows` | Format §4.8 / RFC 0056 |
| [`renovation-draw.schema.json`](renovation-draw.schema.json) | `sources_uses.uses.renovation` (budget, contingency, draw) | Format §4.8 / RFC 0057 |
| [`expense-targeted-capex.schema.json`](expense-targeted-capex.schema.json) | capex bought to reduce a named operating expense | Format §4.8 / RFC 0057 |
| [`uw-deal-package-manifest.schema.json`](uw-deal-package-manifest.schema.json) | `UWDealPackageManifest` | RFC 0018 |
| [`uw-portfolio-profile.schema.json`](uw-portfolio-profile.schema.json) | `.uwportfolio.json` sidecar (`PortfolioProfile`) | Protocol §XV / RFC 0015 |
| [`uw-market-data.schema.json`](uw-market-data.schema.json) | `market-data-v1` documents | RFC 0022 |
| [`uwpart.schema.json`](uwpart.schema.json) | `.uwpart.md` frontmatter | [UW Composition 1.0](../UW_COMPOSITION.md) §2 / RFC 0021 |
| [`uw-external-section.schema.json`](uw-external-section.schema.json) | `external` section directive | [UW Composition 1.0](../UW_COMPOSITION.md) §3 / RFC 0021 |
| [`uw-rollup.schema.json`](uw-rollup.schema.json) | `portfolio_rollup` payload | [UW Receipt 1.1](../UW_RECEIPT.md) §11 / RFC 0021 §6 |
| [`period-key.schema.json`](period-key.schema.json) | `PeriodKey` | Protocol §VIII.2a / RFC 0041 |
| [`period-series-entry.schema.json`](period-series-entry.schema.json) | `PeriodSeriesEntry` | Protocol §VIII.2a / RFC 0041 |
| [`period-refinement-issue.schema.json`](period-refinement-issue.schema.json) | `PeriodRefinementIssue` | [Starter guide §VIII.2b](../../docs/starter/refinement-and-workbooks.md#viii2b-stated-period-inputs-in-refinement-rfc-0042) / RFC 0042 |
| [`section-refinement-issue.schema.json`](section-refinement-issue.schema.json) | `SectionRefinementIssue` | [Starter guide §VIII.2b](../../docs/starter/refinement-and-workbooks.md#viii2b-stated-period-inputs-in-refinement-rfc-0042) / RFC 0066 |
| [`period-excel-binding.schema.json`](period-excel-binding.schema.json) | `PeriodExcelBinding` | [Starter guide §VIII.2c](../../docs/starter/refinement-and-workbooks.md#viii2c-contextual-workbook-bindings-rfc-0043) / RFC 0043 |
| [`period-column-snapshot.schema.json`](period-column-snapshot.schema.json) | `PeriodColumnSnapshot` | [Starter guide §VIII.2c](../../docs/starter/refinement-and-workbooks.md#viii2c-contextual-workbook-bindings-rfc-0043) / RFC 0043 |

| [`section-dc-capacity.schema.json`](section-dc-capacity.schema.json) | RFC 0080 standard `dc_capacity` payload | RFC 0080 |
| [`section-dc-power.schema.json`](section-dc-power.schema.json) | RFC 0080 standard `dc_power` payload | RFC 0080 |
| [`section-dc-revenue.schema.json`](section-dc-revenue.schema.json) | RFC 0080 standard `dc_revenue` payload | RFC 0080 |
| [`section-hotel-metrics.schema.json`](section-hotel-metrics.schema.json) | RFC 0080 standard `hotel_metrics` payload | RFC 0080 |
| [`section-hotel-brand.schema.json`](section-hotel-brand.schema.json) | RFC 0080 standard `hotel_brand` payload | RFC 0080 |
| [`section-hotel-food-beverage.schema.json`](section-hotel-food-beverage.schema.json) | RFC 0080 standard `hotel_food_beverage` payload | RFC 0080 |
| [`section-mhc-sites.schema.json`](section-mhc-sites.schema.json) | RFC 0080 standard `mhc_sites` payload | RFC 0080 |

## Validating a schema

```bash
npx --yes ajv-cli compile -s spec/schemas/<name>.schema.json
```

CI runs JSON Schema validation on every PR. The UW XML codec tests and docs-site build cover the XML mapping; the XSD is also compiled during release verification.

## Updating a schema

The TypeScript types in `@uwmd/verify`'s `src/protocol.ts` and `types.ts` are
the canonical definition. When you change one of those types, update
the matching schema here in the **same PR**. Drift between the two is
a normative protocol bug.


If you add a new schema:
1. Place it next to the existing schemas, named `<thing>.schema.json`.
2. Use the `https://uwmd.org/schemas/<thing>.schema.json` `$id`.
3. Add a row to the table above.
4. CI picks it up automatically — no workflow change needed.

Step 3 is enforced: `npm run verify-indexes` fails when a schema is on disk
without a row, or a row links a file that is not. Three schemas had drifted out
of this table before that check existed, which is why it does now.

## Lease-up projection (RFC 0044)

- [Plan](lease-up-cash-flow-plan.schema.json): explicit variant, day count and cash dates.
- [Projection](lease-up-cash-flow-projection.schema.json): candidate stream, source digest and bindings.
- [Refusal](lease-up-cash-flow-projection-issue.schema.json): CALC-LU-PROJECTION with nested evidence.

Schemas check shape. Implementations additionally check exact period coverage,
real calendar dates, source-order timing, verified amounts and digest agreement.

## Property cash-flow assembly (RFC 0045)

- [Plan](property-cash-flow-plan.schema.json): explicit sources, hold dates, basis and coverage.
- [Assembly](property-cash-flow-assembly.schema.json): copied cash rows and complete declared coverage evidence.
- [Refusal](property-cash-flow-assembly-issue.schema.json): typed stage reason and nested diagnostics.

Schemas check shape; source identity, complete coverage and economic assertions
need semantic validation. Declared completeness is not verified economics.

## Reserve draw bindings (RFC 0065)

- [Plan](reserve-draw-binding-plan.schema.json): optional digested selected-draw/expenditure inventories and explicit allocation edges.
- [Verification](reserve-draw-binding-verification.schema.json): independent state, digest, finite source evidence and RDB findings.

Shapes alone do not establish exact references, producer gross meaning, complete draw allocation or currency-quantum agreement. No assembly admission changes.
