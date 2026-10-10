# Reserve draw binding conformance — RFC 0065

All sources, accounts and invoices are invented. Each case carries a full source document, an optional external plan and an independently authored state/code expectation. The complete Envelope source digest pins source content, exact variants, metadata and history. The default suite checks read-only behavior and the portable driver invokes `verify-reserve-draws --json`.

Valid cases cover source-shaped gross TI/LC, capital/operating invoices, split draws, many-to-many edges, explicit partial shares, same-day identities and an authored final-boundary date. All RDB codes have negative controls; no boundary or binding admits reserve-dependent RFC 0045 assembly. Supplemental gross/category declarations are attributable producer assertions, not source authenticity proof.

`cent-split-draw` and `cent-multiple-draws` expose binary64 sum residues that need shared quantizer fix #291. Focused tests restore the pre-fix integral shortcut, assert failure, then assert verification with the corrected shared quantizer. Both large-balance one-cent controls still fail. Nonfinite aggregate allocation retains every finite edge while refusing a verdict.
