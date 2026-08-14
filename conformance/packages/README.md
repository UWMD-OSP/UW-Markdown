# UW Deal Package conformance fixtures

Manifest-level fixtures for RFC 0018 §3–§5, plus invariants asserted without
baselines. Run with:

```bash
npm run conformance -- --tier=packages
```

Runs by default alongside the other suites. No network, no API key, nothing
written to disk.

## What is asserted

**Manifest verdicts.** `accept/` manifests must validate; `reject/` manifests
must be refused and emit every `PKG-` code listed in the sibling
`.expected.json`. Codes are matched, not messages, so wording can improve
without touching fixtures.

**Schema parity, in one direction.** Every accepted manifest is also validated
against
[`uw-deal-package-manifest.schema.json`](../../spec/schemas/uw-deal-package-manifest.schema.json).
The invariant is *anything the validator accepts, the schema must accept* — not
full agreement, because the schema is deliberately more permissive. JSON Schema
cannot express a dangling-link check (it requires cross-referencing `members`
from `links`) or the wrong-layer edge rule (it requires the edge registry). Those
live only in code, and the one-directional check is the honest thing to assert
rather than pretending to a parity that cannot exist.

This differs from the `modules` suite, where two-way parity *is* achievable and
is therefore enforced.

**Invariants** (no baselines, so they bind any implementation):

| Invariant | Why it matters |
|---|---|
| `deterministic-encoding` | Two encodings of one package are byte-identical. ZIP entry order and timestamps must not leak into the artifact. |
| `binary-roundtrip` | A member with bytes above 0x7F survives exactly. Packages carry PDFs, and a UTF-8 round trip would silently corrupt them. |
| `verify-clean` / `verify-tampered` | A clean package verifies; a mutated member fails. |
| `context-omits-source-bytes` | **The boundary the JSON context exists for.** Source evidence is described by identity and digest; its bytes never appear, even when a caller explicitly passes them in. |
| `context-valid` | A projected context passes its own validator. |
| `no-member-only-projection` | `abstracts` does not project to the entity layer — it describes documents and has no entity-layer meaning. |

## What is not covered here

Archive-level negative cases (traversal, symlinks, encryption, ZIP64, ratio
bombs) are covered by the shared safe-ZIP inspector's own tests, since both this
codec and the CSV bundle route through `zip-safety.ts` and testing them twice
would test one implementation twice. The manifest-level traversal case *is* here,
because rejecting an unsafe path before any archive is opened is a separate rule.

Package signing and encryption are out of scope — RFC 0018 defers both.

Nothing in this suite resolves a reference handle. Resolution is an explicit host
action that never happens during validation or projection, and asserting that
would require the network access the design forbids.
