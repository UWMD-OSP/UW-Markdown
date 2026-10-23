# Starter products: renderer reference

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved from the [Format specification](../../spec/UW_FORMAT_SPEC.md)
> Part VII under [RFC 0112](../rfcs/0112-remove-bancroft-vocabulary.md) (D6).
> Section numbers are kept so existing references (`§7.1`, `§7.2`) still find
> the text. It describes the outputs of the reference renderers:
> `renderReportHtml` in `@uwmd/core`, the `@uwmd/report` PDF pipeline and
> `uwmd render --format chat` ([CLI reference](cli.md) §6.4). A conforming
> Reader or Verifier owes none of it.

## VII. Rendering Targets

### 7.1 Lender Package PDF (Tier 1)

Sections rendered, in order:
1. Cover page (property photo, address, date, preparer)
2. Executive Summary (key metrics table from `quick_metrics`)
3. Property Overview → `property` section prose + formatted data
4. Proforma / Cash Flow → `noi_model` formatted table
5. Rent Roll Summary → `rent_roll` unit_mix_summary table
6. Debt Structure → `debt_structure` terms table
7. Sources & Uses → `sources_uses` capital stack
8. Borrower Summary → `borrower_sponsor.sponsor_narrative` + financial summary
9. Exit Analysis → `dcf.exit_analysis` + returns table
10. Assumptions & Disclosures → `assumptions` table with source badges; standard disclaimer

### 7.2 Credit Memo (Tier 2 Analyst)

All Tier 1 sections plus:
- Market Analysis → `market_analysis` full narrative + comp tables
- Financial Analysis → Full DCF table + `stress_tests` matrix
- Due Diligence Summary → `due_diligence` checklist and findings
- Risk Assessment → `risk_assessment` component scores + narrative
- Compliance Summary → `compliance` key findings
- Covenants → `debt_structure.covenants` formatted table
- Appendices → Raw agent outputs, full rent roll

### 7.3 AI Chat Context (`--format chat`)

A compressed representation of the deal for dropping into an AI assistant. Includes:
- Full frontmatter
- Prose sections (not data blocks — AI reads narrative faster)
- Key metrics table from `quick_metrics`
- Active flags from `validation`
- Assumptions summary (by source category counts)

Omits: full unit-level rent roll data, full operating statement line items, pipeline log (included as a one-line summary instead).

Target token count: < 8,000 tokens for Tier 1 deal, < 16,000 for full Tier 2 deal.

Chat Sources & Uses reads the Format 4.8 stated scalar homes: sources.total,
uses.total, sources.senior_loan, equity_metrics.equity_total,
uses.closing_costs.total and uses.other_reserves. Other reserves are labelled
explicitly and do not imply an escrow total. Display does not sum missing totals.
Numeric displays use the missing marker for objects, arrays and other nonnumeric
carriers, including the null-prototype objects reconstructed by CSV decoding.
