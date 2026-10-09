# Business-plan and BTR identity (RFC 0072)

Run `npm run conformance -- --tier=scenario` (also in the default corpus).
The v2 CLI driver runs the same warning-only validation expectations.

- 01–08: all eight standard plans, including stabilized multifamily BTR with
  matching frontmatter/property subtype and its plan on a separate axis.
- 09–10: absent/null scenario.
- 11–18: unlisted Sundance vocabulary, every retired value, reverse-DNS
  extension without modules, malformed namespace and non-string scenario.
- 19–23: BTR property fallback, both directions of carrier disagreement,
  BTR class scope, and unchanged open free subtypes.

Fixtures span 1.1 and 2.0. Expectations freeze the complete code/severity set
and overall verdict: no case may gain an error. The runner also compares
stage readiness, coverage and non-identity findings with the same document
without identity labels, and verifies validation leaves parsed/source bytes
intact. Core tests compare pack/default results separately.
