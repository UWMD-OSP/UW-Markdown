# Completed implementation scope: RFC 0051

RFC 0051's waterfall dual-hurdle `any` mode was implemented in commit `9a77ee4`
and released in 2.10.0.

The completed slice lifts `hurdle_mode: "any" | "both"` into the normative
contract for `split` tiers stating both `until_lp_em` and `until_lp_irr`: `any`
caps the tier at the smaller capacity, and the default `both` retains the larger.
`WF-01` rejects `hurdle_mode` without both hurdles. Clawback, crystallization and
GP-side hurdles remain outside this scope. The accepted contract is at
[`docs/rfcs/0051-waterfall-dual-hurdle-any-mode.md`](../../docs/rfcs/0051-waterfall-dual-hurdle-any-mode.md).
