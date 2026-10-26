# Pro-forma profile controls

Synthetic library-operation controls for RFC 0092 and registry `uwmd.pro-forma.l1.1`.
`expected.json` contains independently authored report subsets; the runner checks
all listed members. These are implementation regression controls. They do not
claim independent-implementation or actual cross-runtime CLI proof (#551/#552).

Run after building: `node scripts/run-conformance.mjs --profile=pro-forma`.
The public implementation manifest deliberately omits this profile until both
separate support gates pass. The portable driver remains unchanged.

The `d1-*` and `d2-*` cases copy ten synthetic regression repro documents
byte-for-byte. D1 checks unresolved declared inputs without laundering unavailable
computed targets or invalid LTV selections. D2 checks the actual final-row source,
including a separately failed summary alongside a verified rate. Other source
controls preserve current fallback dependency and malformed-declaration handling.
These cases do not decide the separate RFC0092 text questions or close either
support gate.

The `rfc0128-*` cases copy nineteen synthetic comparison documents byte-for-byte
and pin the accepted currency, basis, registry, event/role, fallback and public
loan-selection clarification. Report-only controls retain the current output
rules. These reference regressions do not run the independent implementation or
establish either support gate.
