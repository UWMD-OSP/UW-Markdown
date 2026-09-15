# Specification: Waterfall dual-hurdle `any` mode (RFC 0051)

Status: **draft implementation scope** · Opened 2026-09-13 · RFC 0051

This milestone lifts the deferred `hurdle_mode: "any"` representation into the
normative contract for distribution waterfalls (§4.27, §VIII.10). When both
`until_lp_em` and `until_lp_irr` are stated on a `split` tier, `hurdle_mode: "any"`
caps the tier when either hurdle is met (the smaller capacity governs). The
default `hurdle_mode: "both"` retains existing behavior (the larger capacity
governs).

Stating `hurdle_mode` without both hurdles is rejected as a grammar error (`WF-01`).
Clawback, crystallization, and GP-side hurdles remain outside this scope.

The complete contract is [RFC 0051](../../docs/rfcs/0051-waterfall-dual-hurdle-any-mode.md).
