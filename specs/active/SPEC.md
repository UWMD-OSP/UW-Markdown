# Specification: RFC 0064 reserve-account roll-forward (accepted, unreleased)

[RFC 0064](../../docs/rfcs/0064-property-reserve-account-roll-forward.md) adds
the optional `reserve_accounts` section (format §4.28), the `RSV-NN` validation
family and `verifyReserveAccounts` (protocol §VIII.9.7), preparing Protocol
**2.19.0** on top of the unreleased 2.18.0. The RFC, its reference
implementation, schema, conformance suite and record updates land together;
the owner's merge of that pull request is the acceptance record.

Boundary, pinned by fixture: a draw never nets against the gross expenditure it
funded, and a verifying statement does not cure RFC 0045's
`reserve_spending_excluded` refusal
(`conformance/property-cash-flow-assembly/reserve-statement-does-not-cure`).

Previous milestone: RFC 0063 implementation, integrated on `main` at `413a645`
and archived in [the completed task record](../archive/rfc-0063-exclusive-boundary.md).
RFCs 0062, 0063 and 0064 remain `accepted` until a tagged release ships them;
see the [release plan](../../docs/releases/2.14.0-candidate.md).
