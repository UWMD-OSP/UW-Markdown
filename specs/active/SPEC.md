# Specification: RFC 0064 reserve-account roll-forward (draft owner review)

[RFC 0064](../../docs/rfcs/0064-property-reserve-account-roll-forward.md) adds
the optional `reserve_accounts` section (format §4.28), the `RSV-NN` validation
family and `verifyReserveAccounts` (protocol §VIII.9.7), preparing Protocol
**2.19.0** on top of the unreleased 2.18.0. The RFC, its reference
implementation, schema, conformance suite and record updates are proposed
together on PR #219. They remain a draft until the owner resolves the
standard-section choice; green gates do not accept or merge the RFC.

Boundary, pinned by fixture: a draw never nets against the gross expenditure it
funded, and a verifying statement does not cure RFC 0045's
`reserve_spending_excluded` refusal
(`conformance/property-cash-flow-assembly/reserve-statement-does-not-cure`).

Previous milestone: RFC 0063 implementation, integrated on `main` at `413a645`
and archived in [the completed task record](../archive/rfc-0063-exclusive-boundary.md).
RFCs 0062 and 0063 remain `accepted` until a tagged release ships them;
RFC 0064 remains `draft` pending owner review;
see the [release plan](../../docs/releases/2.14.0-candidate.md).
