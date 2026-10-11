# conformance/currency

Fixtures for document-level currency identity (RFC 0046, Protocol §III.1b).
The code controls denomination display while the locale controls numeric
separators. Missing identity preserves the legacy symbol path; malformed
identity emits `CUR-01` and refuses display renders.

Both cases render, so they are starter-product checks. `malformed [validate]`
is the Verifier check for `CUR-01` alone (§III.1b identity stays normative):
it compares the validator verdict to `malformed/expected-validation.json`.
