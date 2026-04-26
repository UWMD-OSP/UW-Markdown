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

## v1 release blockers

Everything required to call the public release of v1 *credible* — i.e.
every claim in the README is backed by a passing conformance fixture
and a normative schema.

| Status | Item | Tracking |
|---|---|---|
| ✅ | Tier-2 Editor — `applyEdit()` dispatcher + `BUILTIN_EDIT_POLICIES` enforcement | commit `e947e2d` |
| ✅ | Tier-3 Calc Host — safe-expression parser + evaluator + built-ins (`sum`, `pmt`, `npv`, `irr`, …) | commit `137a858` |
| ✅ | Validator wired to `BUILTIN_REMEDIATIONS` registry (no inline strings) | commit `137a858` |
| ✅ | Conformance corpus filled (Tiers 1-4 fixtures) + runner gating tiers 1-3 in CI | commit `0536c67` |
| ✅ | JSON Schemas for the 6 boundary-crossing types + spec ordering / cross-ref fixes | commit `ae8ab6d` |
| ✅ | Governance / OSS scaffolding (SECURITY/GOVERNANCE/MAINTAINERS/CODEOWNERS, RFC template) | commit `b8c97b8` |
| ✅ | npm publish workflow on `v*` tag with provenance | commit `b8c97b8` |
| 📋 | Repo rename to `uw-markdown` (matches `@uwmd` package scope and reads cleanly) | pre-flip |
| 📋 | Public flip — switch repo from private to public + register `@uwmd` org on npm + add `NPM_TOKEN` secret | pre-flip |

## v1 follow-on tools

These ship after the public flip. README already promises them — order
reflects effort vs. devex value.

| Status | Item | Notes |
|---|---|---|
| ✅ | VS Code extension (preview 0.1.0) | `tools/vscode-uwmd/` — syntax highlight + section folding + document outline + on-save validation via `@uwmd/core`. |
| ✅ | Documentation site (preview 0.1.0) | `tools/docs-site/` — VitePress build of spec / protocol / schemas / conformance / project docs. Interactive playground deferred to 0.2. |
| ✅ | Standalone CLI installer (preview 1.0.0) | `packages/uwmd-cli/` — publishes as `uwmd` on npm. `npx uwmd init` / `validate` / `parse` / `render` / `edit` / `calc` / `run` for non-developers who don't want to clone. Thin wrapper over `@uwmd/core` (depends on it via the new `./cli` subpath export). No calc-drift risk. |
| ✅ | Calc-aware web editor (preview 0.1.0) | `tools/web-editor/` — Vite + plain TS bundle on `@uwmd/core/browser`. Embeds the Tier-2 dispatcher and Tier-3 calc engine in the browser. Frontmatter editing + numeric section editing on five calc-bearing sections (property, valuation, noi_model, debt_structure, sources_uses) dispatch through `applyEdit()`; multifamily calc starter pack (cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash) re-evaluates every render so derived values can never drift from inputs. Validation footer surfaces every `ValidationMessage` with `BUILTIN_REMEDIATIONS` copy. Replaces the originally-planned narrative-only Tier-2 web editor — that design was rejected because separating "safe" narrative edits from "unsafe" numeric edits creates two paths into the same file and a wrong incentive to use the easier one. |
| 💭 | Excel ↔ `.uw.md` converter | Same calc-integrity rule applies: the converter must own both sides of the round-trip (cell formulas ↔ section content + calc declarations) so a workbook saved-then-opened in either tool produces identical numbers. Define a "lossy converter" boundary explicitly. |
| 💭 | `docs/CONFORMING_TOOLS.md` | Once adopters arrive — keeps the README from becoming a giant list. |

## v2 spec exploration

Each item below opens as an RFC under `docs/rfcs/` once that process is
in place. None are required for v1 conformance — they would constitute
v2 of the protocol, the format, or both.

Mirrored in `spec/UW_PROTOCOL_v1.md` §XIII so spec readers see them in
context. This list is the maintainable copy.

| Item | Why it matters | Anchor |
|---|---|---|
| Locale negotiation | v1 freezes formatting to `en-US`. International adopters need other locales. | `SupportedLocale` hook in `protocol.ts` |
| Module signing | Sigstore-style signature on module manifests, verified by host policy. | Protocol §VII (Module System) |
| Custom asset-class declarations from modules | `AssetClass` enum is hard-coded in `types.ts`; modules can't extend it without a spec bump. | `types.ts` — `AssetClass` |
| Conformance test runner v2 | Language-agnostic driver and reporter format so non-TS implementers don't write their own. | `scripts/run-conformance.mjs` is TS-only |
| Stochastic calculations | `deterministic: false` calc declarations (Monte Carlo, sensitivity sweeps). | Protocol §VIII |
| Hospitality module | Reference module for the module system. Worked example sketched in protocol Appendix E. | `packages/uwmd-module-hospitality/` (planned) |

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
