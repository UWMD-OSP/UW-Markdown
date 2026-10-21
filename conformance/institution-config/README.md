# Selected institution configuration (RFC0097)

These33 authored document/config operation controls belong to Verifier/validate.
They allocate no document issue or financial procedure. The original111 portable
validation cases, their sources and their expectations remain unchanged.

Controls pair with unchanged frozen minimal/full sources.
Location-dependent cases copy those source bytes solely to isolate
the lexical source directory; they do not repair metadata or author a new model.
The original records are not edited. Config inputs use `.input` so intentionally
malformed JSON/UTF8 remains test data, rather than repository JSON configuration.

`case.json` supplies real CLI arguments and the existing portable comparison.
Errors require category/code/message and exact pointer presence/absence. The
native runner additionally enforces the error-only outer object, ProtocolError
schema, ordinary-result exclusion, expected exits and byte preservation.
Positive projections pin only the existing code/severity set and status; they
are not full financial/receipt verification claims. All three warning limits
change together only after whole-config admission. Existing error bands remain.

Portable cases cover explicit selection, automatic absence/adjacency, no fallback,
strict UTF8/BOM/JSON/decoded duplicate/Unicode rules, opaque overflow/paired
scalars, root/carrier/leaf types, atomicity and fixed pointer precedence. Permission,
symlink/race, internal-error exit2, pure API, aggregate and receipt boundaries are
also required independent runtime/subprocess controls; these33 are not the whole
capability gate. Discovery is not promoted by passing them.

Cases 30–33 (RFC 0109) pin financial-validity findings as deal flags: a weak
deal is clean and exits 0, `validation_overrides.financial_validity_errors` raises
a listed code's error band (never its warning band) to an error, and a list naming
an unregistered code is refused.
