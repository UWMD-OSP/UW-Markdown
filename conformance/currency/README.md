# conformance/currency

Fixtures for document-level currency identity (RFC 0046, Protocol §III.1b).
The code controls denomination display while the locale controls numeric
separators. Missing identity preserves the legacy symbol path; malformed
identity emits `CUR-01` and refuses display renders.
