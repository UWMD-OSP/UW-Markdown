# Roadmap

The single source of truth for what's planned for UW Markdown. Work in
the README "Planned" list and the protocol spec's §XIII "Future work"
both feed back to this document.

This roadmap is **directional**, not contractual. Items move, get cut,
or get reordered as we learn from adopters.

## Status legend

- ✅ **Shipped** — landed and documented
- 🚧 **In progress** — actively being worked on
- 📋 **Next** — committed for the upcoming release
- 💭 **Considered** — would be valuable; not yet committed
- ❄ **Frozen** — explicitly deferred to a later major version

---

## v1 release readiness

> **Status update (2026-07-25):** The repository is already public. The historical
> pre-public-flip checklist below is superseded; the remaining launch work is the
> npm organization registration, `NPM_TOKEN`, and the first
> `v1.0.0` package publication.

Everything required to call the v1 release *credible* is shipped: README claims
are backed by conformance fixtures and normative schemas. The repository is now
public and renamed to `uw-markdown`; the remaining v1 work is npm account setup
and the first package publication.

| Status | Item | Tracking |
|---|---|---|
| ✅ | Tier-2 Editor — `applyEdit()` dispatcher + `BUILTIN_EDIT_POLICIES` enforcement | commit `e947e2d` |
| ✅ | Tier-3 Calc Host — safe-expression parser + evaluator + built-ins (`sum`, `pmt`, `npv`, `irr`, …) | commit `137a858` |
| ✅ | Validator wired to `BUILTIN_REMEDIATIONS` registry (no inline strings) | commit `137a858` |
| ✅ | Conformance corpus filled (Tiers 1-4 fixtures) + runner gating tiers 1-3 in CI | commit `0536c67` |
| ✅ | JSON Schemas for the 6 boundary-crossing types + spec ordering / cross-ref fixes | commit `ae8ab6d` |
| ✅ | Governance / OSS scaffolding (SECURITY/GOVERNANCE/MAINTAINERS/CODEOWNERS, RFC template) | commit `b8c97b8` |
| ✅ | npm publish workflow on `v*` tag with provenance | commit `b8c97b8` |

## v1 follow-on tools

Tool surface to grow before the public flip. None of these are blocked
on going public — they ship into the private repo and wait. Order
reflects effort vs. devex value.

| Status | Item | Notes |
|---|---|---|
| ✅ | VS Code extension (preview 0.1.0) | `tools/vscode-uwmd/` — syntax highlight + section folding + document outline + on-save validation via `@uwmd/core`. |
| ✅ | Documentation site (preview 0.1.0) | `tools/docs-site/` — VitePress build of spec / protocol / schemas / conformance / project docs. Interactive playground deferred to 0.2. |
| ✅ | Standalone CLI installer (preview 1.0.0) | `packages/uwmd-cli/` — publishes as `@uwmd/cli` on npm (executable: `uwmd`). `npx @uwmd/cli init` / `validate` / `parse` / `render` / `edit` / `calc` / `run` for non-developers who don't want to clone. Thin wrapper over `@uwmd/core` (depends on it via the new `./cli` subpath export). No calc-drift risk. |
| ✅ | Calc-aware web editor (preview 0.1.0) | `tools/web-editor/` — Vite + plain TS bundle on `@uwmd/core/browser`. Embeds the Tier-2 dispatcher and Tier-3 calc engine in the browser. Frontmatter editing + numeric section editing on five calc-bearing sections (property, valuation, noi_model, debt_structure, sources_uses) dispatch through `applyEdit()`; multifamily calc starter pack (cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash) re-evaluates every render so derived values can never drift from inputs. Validation footer surfaces every `ValidationMessage` with `BUILTIN_REMEDIATIONS` copy. Replaces the originally-planned narrative-only Tier-2 web editor — that design was rejected because separating "safe" narrative edits from "unsafe" numeric edits creates two paths into the same file and a wrong incentive to use the easier one. |
| ✅ | Excel converter (preview 0.1.0) | `packages/uwmd-excel/` — `.uw.md` → `.xlsx` for multifamily. Two-sheet workbook (Underwriting + Operating Statement) with named-range inputs and derived-metric formulas mirroring `MULTIFAMILY_STARTER_PACK`, plus a flat Pipeline Log audit sheet. NOI is itself a formula on the Operating Statement sheet, so editing any line item ripples through to every metric. Reverse direction (`.xlsx` → `.uw.md`) deferred — calc-aware web editor remains the Tier-2 chokepoint for now. |
| 💭 | `docs/CONFORMING_TOOLS.md` | Once adopters arrive — keeps the README from becoming a giant list. |

## v1.1+ machine interchange

Accepted RFC [0014](./docs/rfcs/0014-multi-format-interchange.md) defines the
post-v1.0 machine-interchange train. It keeps the `.uw.md` format at 1.1,
targets additive representation discovery for protocol 1.2, and stages
`@uwmd/core` / `uwmd` 1.1 releases for the document envelope and codecs.

| Status | Item | Notes |
|---|---|---|
| ✅ | RFC 0014 architecture | Accepted by the project owner on 2026-07-26 under owner-led governance. |
| ✅ | Envelope + UW JSON | Envelope 1.0 schema, JSON 1.0 codec, semantic digest, registry, CLI export, and tests implemented. |
| ✅ | Registry + discovery | Protocol 1.2 descriptors, manifest schema, negotiation, `uwmd formats`, and optional HTTP/MCP companion profiles implemented. |
| ✅ | UW XML | Deterministic XML 1.0 mapping, XSD, secure codec, digest checks, and `uwmd convert` implemented. |
| ✅ | UW CSV bundle | Normalized directory/ZIP codec, deterministic packaging, bounded safe extraction, semantic digests, and all six views implemented. |
| ✅ | HTTP + MCP bindings | Stable `uwmd.org` deal identities, OpenAPI 3.1, semantic ETags, content negotiation, text/blob resources, resource links, five MCP tool result profiles, and reference adapters implemented. |

Detailed sequencing and release gates:
[`docs/releases/1.1-plus-interchange-plan.md`](./docs/releases/1.1-plus-interchange-plan.md).

## v2 spec exploration

Each item below has an opening RFC under [`docs/rfcs/`](./docs/rfcs/).
None are required for v1 conformance — they constitute v2 of the
protocol, the format, or both. RFCs are `draft` until the project owner accepts.
The 14-day comment window applies after collaborative governance activates; see
[`GOVERNANCE.md`](./GOVERNANCE.md).

Mirrored in `spec/UW_PROTOCOL_v1.md` §XIII so spec readers see them in
context. This list is the maintainable copy.

| RFC | Item | Why it matters |
|---|---|---|
| [0001](./docs/rfcs/0001-locale-negotiation.md)    | Locale negotiation                            | v1 freezes formatting to `en-US`. International adopters need other locales. |
| [0002](./docs/rfcs/0002-module-signing.md)        | Module signing                                | Sigstore-style signature on module manifests, verified by host policy. |
| [0003](./docs/rfcs/0003-module-asset-classes.md)  | Custom asset-class declarations from modules  | `AssetClass` enum is hard-coded in `types.ts`; modules can't extend it without a spec bump. |
| [0004](./docs/rfcs/0004-conformance-runner-v2.md) | Conformance test runner v2 (language-agnostic) | `scripts/run-conformance.mjs` is TS-only — non-TS implementers can't self-certify against the same runner. |
| [0005](./docs/rfcs/0005-stochastic-calculations.md) | Stochastic calculations                      | `deterministic: false` calc declarations (Monte Carlo, sensitivity sweeps), determinism preserved via seeded PRNG. |
| [0006](./docs/rfcs/0006-hospitality-module.md)    | Hospitality reference module                  | First real consumer of the module system. ADR/RevPAR/occupancy + STR-comp validations. |
| [0015](./docs/rfcs/0015-portfolio-relationships.md) | Portfolio and relationship profiles          | Portable, provenance-backed cross-deal entity and edge sidecars; no storage or aggregate-math contract. |


## Pre-public-flip checklist

> **Superseded:** the public flip is complete. Retained for launch-history context;
> unchecked rows remain prerequisites for the first npm release.

The last thing that happens before the repo flips from private to
public. Held until the tool surface (above) is broad enough to be
worth shipping. Nothing else in the project is blocked on this — every
preceding section can land in private.

| Status | Item | Notes |
|---|---|---|
| ✅ | Repo rename to `uw-markdown` | Completed 2026-07-25; repository, package metadata, documentation links, and local remote updated. |
| ✅ | Register `@uwmd` org on npm | Completed; `@uwmd/core` is published from the organization. |
| ✅ | Add `NPM_TOKEN` repo secret | Configured for release automation. |
| ✅ | Publish `@uwmd/cli` | Published as `@uwmd/cli@1.1.3`; its executable remains `uwmd`. |
| ✅ | Flip repo private → public | Completed before the 2026-07-25 release-readiness review. |

## Permanently out of scope (v1)

Listed so we don't keep re-litigating these:

- ❄ Network protocols. The `.uw.md` file is the protocol surface; how it's transported is out of scope (protocol §I.2).
- ❄ Persistence / storage. How implementations cache, version, or back up the file is out of scope.
- ❄ UI design beyond display conventions. Implementations may render any way they wish provided values format identically.
- ❄ License change. MIT is a permanent commitment for v1 (governance §License changes).

## How to propose a roadmap change

- **Editorial reorder / status update**: open a PR directly.
- **New roadmap item**: open an issue with the *Feature* template
  describing the user need; if accepted, it gets added here with the
  appropriate status.
- **New v2 RFC**: copy `docs/rfcs/0000-template.md` and submit per
  `GOVERNANCE.md` rules.
