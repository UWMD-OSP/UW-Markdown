# Source vocabulary suite (RFC 0031)

`_meta.provenance.source` is **actor-only** — `manual` or `<namespace>/<id>`
with a registered namespace (format spec §2.6) — and resolution methods live
in `_meta.provenance.resolution`. This suite pins the split and, most importantly, the
regression that motivated it: a block whose source matches only the terminal
`*` catch-all used to be *replaceable in place*, destroying its predecessor
with `POL-01` and `POL-02` both unable to fire.

| Scenario | Pins |
|---|---|
| `01-actor-and-resolution` | Both fields present and distinct round-trip independently, including a leaf-level `_overrides[].resolution`; no `SRC-*` finding. |
| `02-legacy-tag-in-source` | A resolution tag in `_meta.provenance.source` is an `SRC-02` error and is read as stated — never reinterpreted as a resolution (RFC 0081 §3). |
| `03-unmatched-supersedes` | An edit against a catch-all-governed block supersedes; `section_replace` is refused (`PROTO-EDIT-004`); a v2 block with no superseded prior reports `POL-02`. The data-loss regression test. |
| `04-colon-form-rejected` | `agent:rent-roll-extractor` is an `SRC-01` error and is **not** classified as a human write — the prefix test's negative space used to grant it `human_only` authority. |
| `05-custom-policies-no-catchall` | A caller-supplied policy list that covers no matching pattern refuses the write rather than granting it. |

`03`–`05` also assert edit behavior, so they are starter-product checks.
`04-colon-form-rejected [validate]` is the Verifier check for `SRC-01` alone,
against `04-colon-form-rejected/expected-validation.json`.

Run with `node scripts/run-conformance.mjs --suite=source` (included in the
default suite list).
