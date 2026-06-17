# 13 — Build status (living document)

**Last verified:** 2026-06-16 (report renderer + @uwmd/report PDF pipeline +
React web-editor rebuild landed; web-editor 0.5.0 footed-model surfaces —
rent-roll, operating statement, debt, sources & uses, valuation — landed on a
deterministic core footing layer; against working tree).
**Maintainer action:** this is a *living* doc — update it when a status changes (see
[How to keep this current](#how-to-keep-this-current) at the bottom). It is a
*synthesis*, not a source of truth; the authoritative sources are
[`ROADMAP.md`](../../ROADMAP.md) (forward plan), [`CHANGELOG.md`](../../CHANGELOG.md)
(what landed), and the code itself.

## Snapshot

UW Markdown is **v1 feature-complete**, and the entire **v1.1 architectural-review
train (phases 1–6)** has landed (integrity/hashes, cascade+defaults, `gaps`,
incomplete-data policies, context profiles, refinement/VOI, L0a/L0b agents, the
`scope` stage). What remains is mostly **breadth** (more asset classes), **a few
stubs**, **explicitly-deferred v2 RFC work**, and **operational launch tasks** —
not core gaps.

## Status legend

- ✅ **Built** — present, wired, tested
- 🟡 **Partial** — works but thin / narrow / under-tested
- 🔴 **Stub / missing** — declared or contracted but not implemented
- 🧊 **Deferred (v2)** — has an RFC draft; intentionally not built for v1
- ⚙️ **Operational** — non-code launch/process task

---

## ✅ Built and solid

- **Specs:** format (`spec/UW_FORMAT_SPEC_v1.md`, 23 subsections, CC-NN, YAML
  subset Appendix D) + protocol (`spec/UW_PROTOCOL_v1.md`, tiers, calc EBNF,
  cascade §IX, context profiles §X) + 8 JSON Schemas. See [02](02-uwmd-format.md).
- **Core Tiers 1–3:** parser, validator (CC/FV/DQ/INT/POL families wired to
  `BUILTIN_REMEDIATIONS`), editor (`applyEdit`/`applyEditAsync`, byte-preserving),
  renderer (`json`/`csv`/`chat`/`summary`). See [03](03-core-library.md).
- **Calc engine:** sandboxed parser+evaluator, 17 builtins incl.
  `pmt/fv/pv/nper/irr/npv`, full error taxonomy, property tests. See [04](04-calc-engine.md).
- **Multifamily + office + retail + industrial + self-storage packs:**
  `MULTIFAMILY_PACK` (8 metrics), `OFFICE_PACK` (11), `RETAIL_PACK` (12),
  `INDUSTRIAL_PACK` (12), `SELF_STORAGE_PACK` (12), selectable via
  `getPackForAssetClass`. The Excel converter has a `WorkbookLayout`
  per class (selected via `getLayoutForAssetClass`); its `toWorkbook.test.ts`
  computes parity for all five (operating statement foots; metrics == evaluateCalc
  to 6 decimals). Pack-level parity also pinned in each `packs/*.test.ts`. See
  [05](05-calc-packs.md), [08](08-tools.md).
- **v1.1 train:** integrity (`integrity.ts`, `uwmd verify`), `cascade.ts` +
  `defaults.ts`, `gaps.ts`, `INCOMPLETE_DATA_POLICIES`, `context-profiles.ts`,
  `refinement.ts`, L0a/L0b layers, `scope` stage.
- **CLI:** 15 commands (incl. `export` → `.uw.json`). See [08](08-tools.md).
- **`.uw.json` sibling form:** `uwjson.ts` exports a lossless JSON projection of a
  `.uw.md` file (provenance + prose + supersede history) and re-hydrates it into a
  `ParsedUWFile`. Library/export feature only — a *normative* `.uw.json` (own JSON
  Schema + conformance tier) is deferred to a future RFC. See [03](03-core-library.md).
- **Conformance:** 29 fixtures, 4 tiers, CI gates tiers 1–3. See [09](09-conformance-testing.md).
- **Report renderer + PDF pipeline:** `report.ts` in core renders the spec's
  §7.1 Lender Package / §7.2 Credit Memo as deterministic print-ready HTML
  (`renderReportHtml`, browser-safe, `uwmd report` CLI); `@uwmd/report`
  (`uwmd-report`) prints it to PDF via playwright-core + system Chrome/Edge.
  See [03](03-core-library.md), [08](08-tools.md).
- **Tools:** CLI, Excel converter, report PDF pipeline, web-viewer, web-editor
  (React + Tailwind, with live report preview; rent-roll, operating-statement,
  debt, sources-&-uses, and valuation are **footed-model surfaces** — line items
  in, section totals derived by core's `derive*` functions, hand-overrides via
  `_meta.field_overrides`), VS Code ext, docs-site (all preview).
- **OSS scaffolding:** governance, RFC pipeline, CI+release, CHANGELOG, VERSIONS,
  GLOSSARY, ARCHITECTURE, first-file tutorial.

## 🟡 Partial — works but needs improvement

- **Asset-class coverage = 5 of 10 classes.** `AssetClass` lists 10 classes;
  multifamily, office, retail, industrial, and self-storage each have a pack +
  defaults table + worked example + Excel layout, and `scope`/`refine`/Excel
  resolve all five off `frontmatter.asset_class`. Hospitality/senior_housing/
  student_housing/mixed_use/land remain unbuilt — the next packs to add. **A
  shrinking limiter, but the long tail of classes is still uncovered.**
- **Module system is declarative-only.** `modules.ts` validates and registers
  in-process `ModuleManifest` objects (shape, formulas, dependency load order,
  tier/protocol/format compatibility), but there is no dynamic import, signing,
  or custom asset-class declaration support.
- **Refinement VOI is approximate.** Perturbation-only, marginal (not joint) VOI;
  non-monotonic outputs only warn; `refinement.ts` carries an empty v1 placeholder
  for the L0b loop.
- **Test coverage uneven.** No dedicated unit test for `compactor.ts`, `init.ts`,
  `format.ts`, `context.ts`, or core `cli.ts`; validator
  has only `validator.dq.test.ts` (CC/FV mainly via conformance). CI coverage gate
  is a soft floor (`continue-on-error`).
- **Examples = 5 deals** (multifamily, office, retail, industrial, self-storage);
  other classes/loan types undemonstrated.
- **Docs on-ramps partial.** Tutorial/glossary/tools-comparison exist; cookbook,
  FAQ/troubleshooting, and a calc "calling-convention" guide are still missing.

## 🔴 Stubs / not implemented

- **DOCX rendering** — `render()` still returns empty content for `docx`
  (`renderer.ts`); the Word credit-memo target has no pipeline. (PDF is now
  built — see `report.ts` + `@uwmd/report` above; `render({format:'pdf'})`
  remains a stub enum pointing at that pipeline.)
- **Reverse Excel (`.xlsx → .uw.md`)** — not built; converter is one-way.
- **Provider-neutral agent host** — `agents/bancroft.ts` is hard-coupled to
  `@anthropic-ai/sdk`; no second backend despite the provider-neutral §IX claim.
- **Tier-4 conformance** — shape/lint-only; no live-LLM or recorded-replay gate.
- **Market-data / investor-profile** — interface-only; no reference implementation.
- **L3 / L9 / L10 layers** — L3 reserved; portfolio/relationship layers absent.

## 🧊 Deferred to v2 (RFC drafts exist, none implemented)

Range/stochastic calcs (0005), sensitivity-table builtin (0007), lease-up modeling
(0008), custom asset-class declarations from modules (0003), module signing (0002),
locale/multi-currency (0001), conformance runner v2 (0004), `_meta` v2 reorg
(0009), signed blocks (0010), capability tokens (0011), corpus retrieval (0013).
See [`docs/rfcs/`](../rfcs/) and [11 — Governance](11-build-release-governance.md).

## ⚙️ Operational — gates the public launch

From the ROADMAP pre-public-flip checklist (all pending): repo rename to
`uw-markdown`, register `@uwmd` npm org, add `NPM_TOKEN`, tag/publish `v1.0.0`,
flip public. Review-flagged: single-maintainer bus factor, personal security email,
no public RFC venue.

## Suggested priority order

1. **More asset-class packs + defaults + Excel layouts** (hospitality next) —
   five classes have landed end-to-end (pack +
   defaults + worked example + Excel layout). Keep widening coverage. Each is a
   library-only change (no RFC); add a worked example whose operating statement
   foots, and a `WorkbookLayout`. See [05 recipe](05-calc-packs.md), [08](08-tools.md).
2. **Module loader hardening** — the v1 in-process loader exists; next steps are
   richer schema validation, recorded fixtures, and host UX for loading manifests
   from files (module signing/custom asset-class identifiers stay v2/RFC work).
3. **Unit tests for validator CC/FV plus untested core helpers** (`compactor.ts`,
   `init.ts`, `format.ts`, `context.ts`, core `cli.ts`) — largest remaining
   under-tested surfaces; then ratchet the CI coverage floor.
4. **DOCX path** (or formally scope it out) — PDF landed via `report.ts` +
   `@uwmd/report`; Word remains the gap for institutions that edit memos.
5. **Recorded-replay Tier-4 + a second agent backend** — proves the agent contract
   is actually provider-neutral.

---

## How to keep this current

- **When you finish a feature:** flip its line from 🟡/🔴 to ✅ here, and log the
  detail in `CHANGELOG.md` (that's the authoritative record — keep this doc to
  one-liners).
- **When you start deferred/v2 work:** move the item out of 🧊 into 🟡/🔴 with a
  pointer to the relevant module.
- **When an operational task lands:** strike it from ⚙️ and update `ROADMAP.md`.
- **Re-verify periodically:** update the "Last verified" date + commit at the top
  after a pass through the code. Don't let this doc assert state you haven't
  checked — when in doubt, trust `CHANGELOG.md` and the source over this summary.
- **Avoid line numbers** here (they rot); cite file/symbol names instead.
