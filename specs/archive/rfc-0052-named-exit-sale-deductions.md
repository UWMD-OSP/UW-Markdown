# Completed implementation scope: RFC 0052

RFC 0052's named exit sale deductions were implemented in commit `ec05564` and
released in 2.10.0.

The completed slice adds an optional closed `sale_deductions` vocabulary naming
every row covering `(disposition, transaction_costs)`, with `other` requiring a
label and `prepayment_penalty` / `defeasance` / `loan_payoff` reserved and
refused by the unlevered assembler. An optional `net_sale_proceeds` figure is
verified against gross sale less exit costs at the currency quantum, spanning the
whole cell so it cannot be satisfied by leaving a deduction unnamed. Ten
conformance fixtures and 25 unit tests cover the positive paths and every
refusal. The accepted contract is at
[`docs/rfcs/0052-named-exit-sale-deductions.md`](../../docs/rfcs/0052-named-exit-sale-deductions.md).
