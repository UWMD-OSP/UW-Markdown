# Source vocabulary suite (RFC 0031)

`_meta.source` is **actor-only** — `manual` or `<namespace>/<id>` with a
registered namespace (format spec §2.6) — and resolution methods live in
`_meta.resolution`. This suite pins the split and, most importantly, the
regression that motivated it: a block whose source matches only the terminal
`*` catch-all used to be *replaceable in place*, destroying its predecessor
with `POL-01` and `POL-02` both unable to fire.

| Scenario | Pins |
|---|---|
| `01-actor-and-resolution` | Both fields present and distinct round-trip independently, including a leaf-level `field_overrides[].resolution`; no `SRC-*` warning. |
| `02-legacy-tag-in-source` | A canonical tag in `_meta.source` is interpreted as `resolution` at read time, warns `SRC-02`, and the raw block bytes (`content._meta`) are never rewritten — they feed digests. |
| `03-unmatched-supersedes` | An edit against a catch-all-governed block supersedes; `section_replace` is refused (`PROTO-EDIT-004`); a v2 block with no superseded prior reports `POL-02`. The data-loss regression test. |
| `04-colon-form-rejected` | `agent:L0-01` warns `SRC-01` and is **not** classified as a human write — the prefix test's negative space used to grant it `human_only` authority. |
| `05-custom-policies-no-catchall` | A caller-supplied policy list that covers no matching pattern refuses the write rather than granting it. |

Run with `node scripts/run-conformance.mjs --tier=source` (included in the
default suite list).
