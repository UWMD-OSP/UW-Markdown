# Completed implementation scope: RFC 0053

RFC 0053's typed tax abatements and reassessment basis were implemented in
commit `148851d` and released in 2.10.0.

The completed slice types the `noi_model` reassessment basis (`TAX-01` through
`TAX-04`, including a `round_to_decimals` that may be negative so a deliberate
rounding is declared), adds an RFC 0041 period-addressed abatement schedule
(`TAX-05` through `TAX-07`), and names the terminal tax in
`dcf.exit_analysis.terminal_tax` with `TAX-08` tying a sale-triggered basis to
`exit_value_gross`. The `TAX-NN` family is registered in the protocol code table.
Nineteen fixtures in a new `tax` conformance tier and 48 unit tests cover it.

The exit-value/terminal-tax circularity is deliberately not solved: the calc
engine has no iteration, and the contract verifies stated figures rather than
converging them. The accepted contract is at
[`docs/rfcs/0053-tax-abatements-and-reassessment-basis.md`](../../docs/rfcs/0053-tax-abatements-and-reassessment-basis.md).
