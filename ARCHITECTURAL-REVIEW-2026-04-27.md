# UW Markdown — Architectural Review: Integrity, Partial Data, and AI Efficiency

**Authored:** 2026-04-27
**Scope:** three architectural questions that cut across the format spec, protocol, reference library, and tooling — and the downstream consequences each choice has on modules and tools.

---

## How to read this document

You said you wanted guidance, not a verdict. So this review is structured the same way for each of the three areas:

1. **What problem are we actually solving?** — framing the question precisely so the answer can be precise.
2. **Where the current architecture stands.** — what `.uw.md`, `@uwmd/core`, and the protocol already do, including weaknesses.
3. **The option space.** — three to six concrete approaches, with trade-offs.
4. **Recommendation.** — what I'd ship, in what order, and why.
5. **Downstream impact.** — which modules, tools, validators, or specs change as a result.

The three areas are interconnected, but they have distinct primitives, so I'm treating them separately and then tying them together at the end.

---

## Area 1 — Edits made by the wrong actor or the wrong tool

### 1.1 What problem are we actually solving?

Two related but distinct failure modes:

- **Authorization failure.** A writer modifies a section it shouldn't be modifying. Examples: a screening agent (L1) writes to `risk_assessment` (which belongs to L6); a user-facing CLI overwrites a block whose authority belongs to an automated pipeline; a Tier-2 editor mutates `uw_version`.
- **Tool-class failure.** A tool that doesn't actually conform to Tier-N pretends to. Examples: a "Tier-2 editor" that drops fields it doesn't recognize on round-trip; a "Tier-3 calc host" whose evaluator silently disagrees with the spec; a hand-edit in vim that bypasses `applyEdit()` entirely.

These aren't the same problem. The first is *policy enforcement* (which actor is allowed to write what). The second is *integrity verification* (was this file mutated correctly, regardless of who did it).

### 1.2 Where the current architecture stands

What's already in place:

- `applyEdit()` (`packages/uwmd-core/src/editor.ts`) is the single Tier-2 write entry point. Every conforming editor *should* go through it.
- `BUILTIN_EDIT_POLICIES` in `protocol.ts` maps each section to an `EditAuthority` and a `supersede_on_edit` flag — i.e. who is allowed to write here, and whether a write must supersede the prior block rather than replace it.
- Three frontmatter fields (`uw_version`, `deal_id`, `created`) are immutable post-init.
- `_meta.actor`, `_meta.source`, `_meta.agent_id`, and `_meta.confidence` are stamped on every block, so even an unauthorized write leaves a trail.
- The append-only supersede model means the prior version is preserved, not overwritten — so a wrong write is recoverable.

What this architecture *doesn't* defend against:

1. **Direct file-system edits.** Anyone with a text editor can edit the file outside `applyEdit()`. The dispatcher has no way to know.
2. **Forged provenance.** A bad actor can write `_meta.actor: "agent/L6"` whether or not they are L6. Provenance is currently *recorded*, not *verified*.
3. **Concurrent writes.** Two processes editing the same file at once → last-write-wins, lost edits, no detection.
4. **Bypass via section_replace.** The protocol allows `section_replace` for some sections; if a writer should have used `section_supersede` (preserving history) and chose `section_replace` instead, the audit trail is destroyed silently.
5. **Wrong-tool round-trip drift.** A Tier-1 reader that does its own (broken) parsing and round-trips a file can drop or mangle data. The conformance corpus checks this for the reference implementations but can't police third-party tools at runtime.

### 1.3 The option space

**Option A — Trust + provenance + post-hoc detection (current).**
File is plain text. The dispatcher is the only sanctioned writer. `_meta` records who did what. Detection happens via a validator that re-runs after writes.
*Pros:* zero key management, file is plain markdown, works in any editor, low complexity.
*Cons:* trust assumes good-faith tools; no defense against adversarial or buggy writers.

**Option B — Signed blocks (`_meta.signature`).**
Each block carries a cryptographic signature over its content + meta, signed by the writer's private key. A verifier checks that the signature matches a known public key for the declared actor.
*Pros:* tamper-evident; forged provenance is detectable.
*Cons:* key distribution, signing infrastructure, breaks "any text editor can write" — the moment you hand-edit a block, its signature is invalid. Probably overkill outside regulated lender environments.

**Option C — Content-addressed history (Merkle chain).**
Each block has a `_meta.parent_hash` pointing at the hash of the prior version (or null for the original). Tampering with any historical block breaks the chain visibly. This is how `git` works under the hood.
*Pros:* tamper detection without keys; concurrent-write detection (two writers with the same parent → conflict, like git); works with hand-edits as long as the hand-editor recomputes hashes.
*Cons:* hashes are computed-not-handwritten — if a human edits a block they have to rerun a tool to fix the hash, or accept that the chain shows "broken here." That said, "broken here" is exactly the signal you want.

**Option D — Validation gate at the file-system boundary.**
After every write, a guard process runs `validate` and rejects the write if it fails. Implemented as a CLI watcher, a git pre-commit hook, or a write-through wrapper around `applyEdit()`.
*Pros:* catches accidents (wrong section, wrong actor, broken supersede chain) immediately. Cheap.
*Cons:* defends against accidents, not adversaries. Doesn't help if the writer never runs the gate.

**Option E — Capability tokens.**
Writers obtain a short-lived token from a coordinator that names which sections they can edit. Like a JWT for `.uw.md`. The dispatcher enforces.
*Pros:* fine-grained, revocable.
*Cons:* requires a coordinator service, kills offline workflows, contradicts the "the file is the protocol" design.

**Option F — Concurrency control via parent-hash.**
Every write must declare the hash of the file (or the section) it's writing against. If the file has changed since, the write is rejected with a `STALE_PARENT` error.
*Pros:* solves the concurrent-write problem cleanly. Pairs naturally with Option C.
*Cons:* tools have to track parent hashes; manual edits need a refresh step.

### 1.4 Recommendation

Keep the current trust-and-provenance model as the baseline (Option A) — it matches the design philosophy of the format. But layer in three non-disruptive additions:

1. **Content-addressed history (Option C), opt-in.** Add `_meta.parent_hash` as an optional field in the format spec. When present, validators verify the chain. Hand-edited files without hashes still parse; signed/chained files have stronger guarantees. The compactor and editor learn to compute and propagate hashes when they're present.
2. **Validation gate as a documented pattern (Option D).** Ship a `uwmd verify` CLI subcommand that runs validator + chain integrity + provenance plausibility (does `_meta.actor` match the policy table?) and returns non-zero on failure. Document its use in CI hooks, pre-commit hooks, and editor save handlers.
3. **Concurrency control via parent-hash (Option F).** When `parent_hash` is present, writes through `applyEdit()` must include the parent hash and fail with a typed error if stale. This catches the concurrent-edit case cheaply.

I'd defer signed blocks (Option B) and capability tokens (Option E). They're the right answer for "production lender deployment" but not for "the open standard." If a regulated environment wants signing, they can build a `packages/uwmd-signing` extension on top of the `_meta.signature` hook (RFC-pinned for forward-compat).

### 1.5 Downstream impact

What changes if you adopt the recommendation:

- **Format spec.** Add `parent_hash` and `signature` to the optional `_meta` fields. Both are reserved-for-forward-compat in v1.1; chain-verification becomes normative in v1.2 (or v2).
- **Protocol.** New error codes: `INT-01` (chain broken), `INT-02` (stale parent), `POL-01` (actor not authorized for section), `POL-02` (replace used where supersede required). New validator severity class `INT-NN` and `POL-NN`.
- **`@uwmd/core`.** New module `integrity.ts` with `computeBlockHash`, `verifyChain`, `verifyProvenance`. Editor learns to stamp `parent_hash` when present in upstream blocks.
- **CLI.** New `uwmd verify` subcommand. Existing `validate` adds an `--integrity` flag.
- **Tools.** Web editor and VS Code extension surface integrity warnings inline; web viewer shows a "broken chain" banner when verification fails.
- **Conformance.** New tier-2 fixtures: a file with a broken chain (verifier must surface `INT-01`), a stale-parent edit (must surface `INT-02`), a wrong-actor write (must surface `POL-01`).

This is a v1.1 / v2 RFC — not a pre-public-flip blocker.

---

## Area 2 — Incomplete or limited data

### 2.1 What problem are we actually solving?

A `.uw.md` file evolves over time. At any given moment, parts of it are present and reliable, parts are present and uncertain, parts are missing entirely, and parts are missing-but-derivable. Examples:

- L0 ingests a rent roll PDF; 8 of 48 units have illegible current rent. Block exists, partial.
- Market analysis needs comparable-sales data; the data source is offline. No block at all.
- The user types a deal_context with a property address but no purchase price yet. Required field missing for `screening` stage.
- An AI extracts NOI from a T-3 statement but the user wanted T-12. Field has a value, but the value is not what downstream calcs assume.
- An override is applied that contradicts the underlying source (user knows something the document doesn't show).

But there's a second, equally important case the current architecture barely acknowledges: **the back-of-napkin scope.** A broker forwards an OM. An LP investor sees a listing on LoopNet. A sponsor mentions a deal on a call. The user wants to drop a property address, an asking price, and maybe a unit count into the tool and get back something like:

> *"48-unit garden multifamily in Glendale AZ at $7.2M asking. Submarket cap rates 5.0-5.6%, suggested loan $4.7-5.2M at 6.5-7.0%, implied DSCR 1.10-1.35x with assumed expense ratio 38-44%. Likely passes screening if rent growth holds; fails on debt yield if rates move 50bps. Time to decision: 30 seconds."*

That output is **mostly assumed values** — scenario defaults, market-data lookups, and asset-class heuristics — with a tiny sliver of user input. It's not a full underwrite; it's a triage tool. The user wants to know "is this worth two more hours of work?" before they spend the two hours.

The current `STAGE_REQUIREMENTS` in `validator.ts` makes this awkward. The minimum stage, `screening`, requires `property + debt_structure + validation`. There is no formal stage *below* screening for "I have an address and a price, give me a range." A user trying to run a napkin scope today either has to manufacture stub `debt_structure` and `rent_roll` blocks (with what data? the system rejects unknowns) or work outside the format entirely — which defeats the whole point of having one.

So the architectural question is actually two questions:

1. **How does a `.uw.md` file represent uncertainty when data is partial?** (the original framing)
2. **How does a `.uw.md` file represent a deal whose data is mostly assumed, and produce useful output anyway?** (the napkin case)

Both are about limited information, but they have different operating points. Partial-data handling is about preserving signal as data degrades. Napkin scope is about producing useful signal from almost no input by leaning on priors.

### 2.2 Where the current architecture stands

Already present:

- `_meta.confidence: 'high' | 'medium' | 'low'` per block.
- `_meta.source` enum: `scenario_default | market_data | ai_extracted | user_override | investor_profile | agent_computed`. So the reader knows whether a number came from a person or a model.
- `_meta.human_review_required: boolean`.
- `STAGE_REQUIREMENTS` in `validator.ts` — each pipeline stage has a list of sections that must be present before it can advance.
- The cross-section consistency checks (`CC-01` … `CC-10`) catch conflicts between sections.
- The file is append-only with supersede, so a partial first pass can be replaced by a more complete second pass without losing the first.

Where this is thin:

1. **Confidence is per-block, not per-field.** A rent roll with 40 of 48 units extracted at high confidence and 8 at low confidence has to choose one tag for the whole block. Information loss.
2. **No "missing because" structure.** A field can be `null` or absent, but the file doesn't explain *why*. A downstream agent looking at `current_rent: null` doesn't know whether the analyst hasn't gotten there yet, the document was illegible, or the unit is genuinely vacant.
3. **No standardized fallback policy.** When a stage-required section is missing, the validator says "required." There's no formal table of "if section X has gap Y, do Z (halt | degrade | substitute | defer)." Every adopter implements this differently.
4. **No `provisional` flag.** The difference between "we have data, but it's preliminary" and "we have data, we trust it" is currently encoded in the soft `confidence: low` signal, which agents can ignore.
5. **Calc engine doesn't propagate uncertainty.** `dscr = noi / debt_service` returns a number whether or not `noi` was high-confidence. The result has no associated confidence.
6. **`confidence` and `human_review_required` overlap ambiguously.** What does `confidence: high` + `human_review_required: true` mean? The spec doesn't say (also flagged in REVIEW-2026-04-26.md §7).
7. **No napkin-scope stage.** `STAGE_REQUIREMENTS` starts at `screening`, which already demands real `property` + `debt_structure` + `validation` blocks. There's no formal pipeline state for "I have three fields of input; produce a range."
8. **No range-typed outputs.** The calc engine returns scalars. There's no native way to express "DSCR is somewhere between 1.10 and 1.35 given submarket priors." Adopters who want ranges have to compute multiple scalars and stitch them together in prose.
9. **`source` enum doesn't distinguish "asset-class default" from "scenario default."** The fallback hierarchy (user → investor profile → market data → asset class → global) is implicit, not specified. So a value tagged `scenario_default` could mean "we used the global multifamily 40% expense ratio" or "we used the user's investor-profile expense ratio of 42%" and a downstream reader can't tell.

### 2.3 The option space

**Option A — Per-field confidence/source (heavyweight provenance).**
Replace each scalar value in JSON blocks with `{ value, confidence, source, source_doc, source_line }`. Now every field carries its own provenance.
*Pros:* maximum information; agents can reason about each field independently.
*Cons:* massive bloat in the wire format; breaks JSON Schema simplicity; humans hate reading it; partially defeats the dual-readability principle.

**Option B — Sidecar quality envelope.**
Keep the main JSON blocks clean. Add an optional `data_quality` sub-block (or a new top-level section) that carries per-field overrides only where needed: "rent_roll.unit_07.current_rent: confidence=low, reason=illegible." Defaults for fields not in the envelope are inherited from `_meta.confidence`.
*Pros:* keeps the common case clean; explicit where it matters; no per-field bloat unless quality varies.
*Cons:* two places to look for confidence (block meta vs. quality envelope); needs a precedence rule.

**Option C — Gap inventory section.**
Add a `gaps` section that lists known missing data: `[{section, field_path, reason, blocks_stage}]`. This is what the user/UI/agents read to know what's outstanding.
*Pros:* agents and UI have one place to look for "what's still missing"; drives both the input wizard and the agent backlog; naturally integrates with stage readiness.
*Cons:* must be kept in sync with reality (validator can help); doesn't itself fix the field-level uncertainty problem.

**Option D — Provisional flag on blocks.**
`_meta.provisional: true` means "this block exists, but it's a placeholder; downstream calcs should treat results as conditional." Stronger than `confidence: low`.
*Pros:* clear signal; cheap; agents can branch on it.
*Cons:* one more flag to define and document.

**Option E — Formal incomplete-data policy table.**
A table in `protocol.ts` (`INCOMPLETE_DATA_POLICIES`) keyed by `(section, field, stage)` → `halt | degrade | substitute | defer`. Validator and agents consult it. Substitute mode names the fallback source (market data, scenario default).
*Pros:* turns "what should I do?" from a per-implementer judgment into a normative table; agents become deterministic in the face of gaps; downstream tools agree.
*Cons:* the table will grow; needs to be maintained.

**Option F — Confidence propagation in the calc engine.**
Calc results carry derived confidence — `min(confidence_of_inputs)` or similar. `dscr` of high-conf NOI / low-conf debt_service inherits low.
*Pros:* end-users see stress test outputs labeled "low confidence" automatically.
*Cons:* slippery — combining low and high in one formula doesn't always yield a meaningful aggregate. May over-flag.

**Option G — Reject and ask.**
Pure halt mode: if any required field is missing, the file is in error and the next agent refuses to run. Force-fix-up-front.
*Pros:* simple; no garbage-in-garbage-out.
*Cons:* unrealistic for real workflows where partial data is normal — it's like saying "no flying until every gauge passes self-test."

**Option H — Scope mode / napkin pipeline stage.**
Add a new pipeline state below `screening` — call it `scope` (or `napkin`). It accepts a near-empty `.uw.md` (frontmatter + property address + asking price + asset_class is enough) and runs a *scope agent* that fills in defaulted blocks tagged `_meta.provisional: true`, `_meta.source: "scenario_default"` (or `"market_data"` / `"asset_class_default"` — see Option I), and returns a structured range output. The file is a real `.uw.md`; it just has mostly-assumed blocks. As real data arrives, those blocks get superseded — the supersede model already supports the upgrade path.
*Pros:* makes the napkin case first-class; produces a real `.uw.md` from minimal input, which can then be iteratively enriched; reuses existing supersede semantics; agent ergonomics are clean ("here's a scope, here's the assumption set, here's what would change the answer").
*Cons:* needs a new stage in `STAGE_REQUIREMENTS`; needs a documented "scope agent" contract (probably a new Bancroft layer, e.g. L−1 or "L0a"); needs a way to express ranges (see Option J).

**Option I — Documented fallback cascade.**
Formalize the value-resolution order: `user_input → user_override → investor_profile → market_data → asset_class_default → global_default`. Extend `_meta.source` to record which step in the cascade produced the value. Document the cascade normatively in the protocol. Each step has a registered table (the asset-class defaults are part of the spec; market-data lookups have a defined contract).
*Pros:* removes the implicit-defaults problem; a reader of any block can trace exactly where a value came from; napkin mode and full-underwrite mode use the same machinery; the user can audit what's "real" vs. "assumed" by filtering on source.
*Cons:* the asset-class default tables become spec material — requires careful curation; market-data lookups need a defined contract (URL? function signature? cache?).

**Option J — First-class range types.**
Allow numeric fields to be either a scalar or a `{ low, high, central?, distribution? }` object. Calc engine evaluates ranges by interval arithmetic for simple ops and by Monte Carlo for complex ones. Renderers display ranges with appropriate formatting (e.g. "$4.7M – $5.2M").
*Pros:* napkin mode can emit ranges natively; sensitivity analysis becomes a primitive instead of a separate framework; aligns with how brokers and LPs actually think ("DSCR around 1.1-1.3" is more honest than "DSCR = 1.18").
*Cons:* substantially expands the calc engine; existing scalar-only validators need to handle ranges; backward-compatible only if scalars are accepted as a degenerate range. RFC 0005 (stochastic calcs) is the natural home for this — already drafted.

### 2.4 Recommendation

Combine six pieces. The first four are the partial-data foundation; the last two unlock the napkin-scope use case. None of them are big individually:

1. **Add `_meta.provisional` (Option D) and `_meta.partial` flags.** `provisional` means the whole block is a placeholder; `partial` means some fields inside are missing. Both are simple booleans.
2. **Add a sidecar quality envelope (Option B), optional, used only when needed.** Format: `_meta.field_overrides: [{path, confidence, source, reason}]`. Common case: don't include it. Edge case (per-unit confidence in a rent roll): include it just for the affected fields.
3. **Add a `gaps` section (Option C).** A formal section in the spec, written by L0/L1 agents and maintained by editors, that lists outstanding items. Drives both UI prompts and agent backlogs.
4. **Add an incomplete-data policy table (Option E).** `INCOMPLETE_DATA_POLICIES` in `protocol.ts`, keyed by `(section, field?, stage)` → `{ action, fallback_source? }`. The validator consults it. Agents respect it.
5. **Add a `scope` pipeline stage (Option H) and a documented fallback cascade (Option I).** Together these make the napkin workflow first-class. A `.uw.md` in `scope` stage is allowed to consist almost entirely of provisional blocks, every value tagged with the cascade step that produced it. The validator's stage-readiness check for `scope` requires only `property.address`, `property.asset_class`, and one of `property.asking_price` or `property.units` — everything else may be defaulted.
6. **Defer first-class range types (Option J) to RFC 0005.** Ranges are the natural output of napkin mode, but they're a substantial calc-engine change. In v1.1, scope-mode agents can emit narrative ranges in prose blocks plus point-estimate JSON tagged provisional, with the central value as the JSON value and `_meta.notes` carrying the range. Not elegant, but it ships now and forward-migrates cleanly when J lands.

I'd defer Option A (per-field provenance everywhere) — too heavyweight — and Option F (calc-engine confidence propagation) — interesting but the math is murky and it can wait for v2.

Also: while you're in this code, fix the `confidence` vs. `human_review_required` ambiguity. Define them as orthogonal: `confidence` is a quality estimate of the data; `human_review_required` is a workflow gate ("must be reviewed before this stage advances"). High-confidence data can still require review (compliance reasons); low-confidence data may not require review (placeholder while drafting).

### 2.4a What back-of-napkin actually looks like

Concretely, the napkin workflow with the recommendation in place:

**User input** (a chat message, a form, a CLI arg — doesn't matter):

> *"48-unit garden multifamily at 4521 W Northern Ave, Glendale AZ. Asking $7.2M."*

**Scope agent runs.** It writes (or `applyEdit`s) a `.uw.md` with:

- `frontmatter.deal_id`, `created`, `pipeline_state.stage = "scope"`.
- `property` block with the address, asset class, unit count, asking price. `_meta.source = "user_input"`, `confidence = "high"` for what the user gave.
- `market_analysis` block with submarket cap rate range, vacancy, rent growth — all `_meta.source = "market_data"`, `_meta.provisional = true`.
- `noi_model` block with assumed expense ratio (asset-class default for garden multifamily), implied gross rent (back-solved from cap rate × asking price). `_meta.source = "asset_class_default"` and `"agent_computed"` respectively, `_meta.provisional = true`.
- `debt_structure` block with assumed loan terms from the user's investor profile (or global defaults if none). `_meta.source = "investor_profile"` or `"global_default"`, `_meta.provisional = true`.
- `quick_metrics` (the deal-summary block at the top) with point estimates and ranges in prose: "DSCR ~1.18 (range 1.10-1.35 across cap-rate scenarios)."
- `gaps` section listing every block flagged provisional and what would convert it to real data: "rent roll", "T-12 operating statement", "appraisal".

**The file is a real `.uw.md`.** A Tier-1 reader opens it. A Tier-2 editor can supersede any block as real data arrives. A Tier-3 calc host evaluates the same custom_calculations it always would, just on assumed inputs. A Tier-4 agent can run an L1 screening pass on it — the screening agent reads the provisional flags and either (a) runs anyway with a "based on assumed inputs" disclaimer or (b) refuses, depending on how the user's `INCOMPLETE_DATA_POLICIES` table is configured.

**The output the user sees** (whatever the rendering surface is) leans on this structure: a one-paragraph scope, a sensitivity table across the few dimensions that move the answer (cap rate, expense ratio, rate), and a "what would change this" line driven directly by the `gaps` section.

**Upgrade path.** The user uploads a real T-12. L0 ingestion writes a real `noi_model` block. The new block supersedes the provisional one. Pipeline state advances from `scope` to `screening`. The original assumed values stay in the file as superseded history — which is exactly the kind of "what was the napkin compared to what we know now" comparison brokers and LPs ask for constantly.

This is the workflow `.uw.md` should make easy. The format already has every primitive needed (supersede, source, confidence, agent layers); what's missing is the formal `scope` stage, the documented cascade, and the asset-class default tables to back it.

### 2.4b What this means for the Bancroft agent layer

The current Bancroft layer numbering starts at L0 (ingestion). The scope agent fits naturally as either **L−1 (a new layer below ingestion)** or, more cleanly, **L0a — a sibling to L0 that runs when L0 has no documents to ingest**. I'd lean toward L0a: it preserves the integer-numbered backbone and signals that scope and ingestion are both "fill the file from external priors," they just differ in whether the priors are documents or defaults.

The scope agent's contract:

- **Reads:** frontmatter (asset class, address), `property` (whatever fields are present), `investor_profile` (if attached), the asset-class default tables, market-data sources.
- **Writes:** `market_analysis`, `noi_model`, `debt_structure`, `valuation`, `quick_metrics`, `gaps` — all with `_meta.provisional: true` for any value not directly user-provided.
- **Never writes:** anything sourced from a document (that's L0's job); anything that requires real comparable sales, real rent rolls, or real T-12s.
- **Output schema:** identical to the existing layer outputs, with the addition that range-bearing fields use the v1.1 prose-plus-central-value pattern (and migrate to first-class ranges when RFC 0005 lands).

### 2.4c Interactive scope refinement — the "what should you tell me next?" loop

The scope agent is one half of the napkin workflow. The other half — and this is the tool you described — is the *companion* that takes a scoped `.uw.md` and asks the user the **smallest set of questions** that would meaningfully tighten the answer.

This isn't a new format primitive. It's a tool that sits on top of `gaps`, the cascade, and the calc engine and turns them into a conversation.

**The decision-theoretic framing.** Every provisional value in the file currently comes from somewhere in the cascade — `asset_class_default`, `market_data`, etc. Each one has an implicit prior range. If the user replaces a defaulted value with their own input, the prior collapses to a point (or a tighter range). That collapse propagates through the calc engine into outputs (DSCR, debt yield, IRR). The size of the propagated change is the **value of information** of that question. Pick the questions with the highest VOI; ignore the ones whose answers wouldn't move the outputs.

**The dependency graph is the static substrate.** Today it's implicit — buried in `multifamily.ts`, the custom_calculations, and the cross-section consistency rules. Making it explicit is the unlock: extract a directed graph where nodes are fields and edges are "this calc reads that field." Each output (DSCR, LTV, debt yield, IRR) becomes a subtree rooted at a calc result; each input (rent, expense ratio, vacancy, rate) becomes a leaf. The calc-engine AST already has everything you need to build this — `getDependencies(expr)` is a one-page recursion over the existing AST.

**The sensitivity computation is the runtime substrate.** Given the graph and the current scoped values, you need a number per gap: "by how much would this output range tighten if I knew this input?" Three computational approaches, increasing in rigor and cost:

1. **Perturbation.** For each gap, evaluate the output at the prior's low end, central, and high end. Range of outputs = sensitivity. Cheap. Works for monotonic dependencies (most of them).
2. **Range arithmetic.** Push the input prior through the calc engine using interval arithmetic (low/high carry through `+`, `*`, `/`, `−`). Output is a range; gap's VOI is `output_range_with_prior − output_range_if_user_supplied`. Slightly more rigorous; needs Option J (range types) ideally.
3. **Monte Carlo.** Sample 1,000 draws from each prior, evaluate, measure variance reduction per input. Most rigorous, most expensive. RFC 0005 territory.

For v1.1, ship perturbation. It's good enough to rank gaps and bad questions become obvious from the rankings.

**The prompt generation surface.** Once you have ranked gaps, turn the top 3-5 into natural-language questions. The framing the user described — *"if you gave us market assumptions for X, Y, and Z I could tell you what that implies for [calculation]"* — is exactly right. Two ways to render it:

- **Conversational, single question per turn.** *"Right now I'm assuming a 40% expense ratio (asset-class default for garden multifamily). If you tell me your assumed ratio, DSCR tightens from 1.10–1.35 to within ±0.05. Do you have a number?"* Good for chat surfaces.
- **Tabular, ranked.** A panel listing the top gaps with their VOI: "Expense ratio: would tighten DSCR by ±0.13. Loan rate: would tighten DSCR by ±0.08. Vacancy: would tighten NOI by ±$45K." Good for forms / dashboards.

Both render from the same data — `RankedGap[]` from the refinement engine.

**The conversation loop.** User answers → tool calls `applyEdit()` to write a `user_override` block (or update the relevant field via the field_overrides envelope) → tool re-runs scope → tool re-ranks gaps → tool asks the next question. Stops when:

- Top remaining gap has VOI below a threshold ("nothing left to ask materially changes the answer"), or
- User explicitly says "that's enough, give me the scope," or
- A target output's range has tightened below a configurable target (e.g., DSCR within ±0.05).

Diminishing returns is real. In practice for a scoped multifamily deal, 3-4 well-chosen questions move the answer from "1.10-1.35 DSCR" to "1.18-1.24 DSCR." Past that, you need real documents (T-12, rent roll), at which point the loop hands off to L0 ingestion.

**Why this is a valuable product surface.** The brokers and LPs who would use the napkin mode aren't underwriters. They don't know which 5 of the 40 fields actually matter for the question they're trying to answer. The tool's job is to do that ranking *for* them — turning "fill out this form" into "answer these three questions and I'll tell you whether to keep going." That's a meaningful UX win, and it's only possible because every value in the file is tagged with where it came from in the cascade.

**Non-numeric gaps.** Some fields don't drive numeric outputs — borrower name, property photos, notes. The refinement engine should ignore these for ranking purposes (their VOI is zero on numeric outputs) but flag them separately as "completeness gaps" for stages that require them downstream. So the tool actually maintains two ranked lists: by-VOI for "tighten the answer" and by-stage-blocking for "advance the pipeline."

**Soft answers.** Users will give imprecise inputs: *"vacancy is probably around 5%."* The tool should accept these as `user_override` with `confidence: medium` and `_meta.notes: "user estimate"`, not high-confidence point values. The cascade still records that step 1 (user_input) provided a value, but the quality envelope reflects that it's a guess. The next loop iteration may still prompt for a tighter answer if VOI warrants it.

**Module boundaries.** This tool spans:

- A new `@uwmd/core` module — `refinement.ts` — exporting `extractDependencyGraph(parsed)`, `rankGaps(parsed, options)`, and `RankedGap` types.
- A new CLI subcommand — `uwmd refine` — wraps the engine for headless / scripted use.
- A new agent — Bancroft layer **L0b**, "scope refinement" — wraps the engine in a prompt that turns ranked gaps into natural-language questions. Reads the ranked-gaps output; emits chat turns; calls `applyEdit()` on user answers.
- A web-editor surface — the right-hand panel — that renders the ranked-gaps view live as the user types.

**What it does NOT need.**

- No new format primitives. Everything it consumes (`gaps`, `_meta.source`, `_meta.provisional`, the cascade, the calc engine) already exists in the v1.1 recommendation above.
- No new pipeline stage. Refinement happens *within* the `scope` stage; advancing past `scope` requires real documents, not better assumptions.
- No new normative behavior. Two implementations could rank the same gaps in slightly different orders (different sensitivity approaches) and still both be conformant. The output is informational, not normative.

**Where this gets hard.** Three honest difficulties:

1. **Asset-class default ranges have to be priors, not points.** Today the defaults table is implicit and probably scalar. To compute VOI you need the *range* a default could plausibly take. So the asset-class table from 2.4 needs to carry low/high/central per field, not just a single number. This is more curation work — but it's also more honest, since "40% expense ratio for multifamily" has always been a range pretending to be a point.
2. **The dependency graph crosses sections.** A gap in `noi_model.expense_ratio` affects `quick_metrics.dscr` through the multifamily pack. The graph extraction has to walk the calc-pack expressions, not just per-section schemas. Tractable, but real engineering.
3. **VOI on circular / coupled outputs is murky.** If both expense ratio and vacancy are unknown, ranking them independently double-counts their joint variance. For v1.1 just compute marginal VOI ("holding everything else at its prior, how much does this one move things?") and accept the approximation. RFC 0005 (stochastic calcs) makes the joint case rigorous.

This is a genuinely strong product idea sitting on top of architecture you already need to build for the napkin case. The cost is one new module (`refinement.ts`), one CLI command, one agent layer, and the discipline of carrying ranges (not points) in the asset-class default tables. Everything else falls out of pieces that the rest of Section 2 already requires.

### 2.5 Downstream impact

- **Format spec.** Three new optional fields (`partial`, `provisional`, `field_overrides`) in `_meta`. New `gaps` section (registered, schema'd, optional). Clarification of `confidence` × `human_review_required` semantics. New `scope` value in the `pipeline_state.stage` enum (currently `screening | term_sheet | full_underwrite | credit_approval | closing | monitoring`). Extended `_meta.source` enum to distinguish `asset_class_default` from `scenario_default` and `global_default`.
- **Protocol.** New error code class `DQ-NN` (data quality) for partial-data warnings, distinct from `CC-NN` consistency. Definition of `INCOMPLETE_DATA_POLICIES` table and how validators must consult it. Normative documentation of the fallback cascade and the contract for asset-class default tables. Scope-stage readiness check (much weaker than `screening`).
- **`@uwmd/core`.** New module `gaps.ts` with `inferGaps(parsed)`, `applyGapPolicy(gap, policy)`. New module `defaults.ts` housing the asset-class default tables (multifamily, retail, office, industrial — at least the first ones to be filled in), with each entry carrying `{low, central, high}` rather than a scalar. New module `cascade.ts` exposing `resolveValue(field, parsed, profile, marketData)` which walks the documented order and returns `{value, source, step}`. New module `refinement.ts` exposing `extractDependencyGraph(parsed)`, `rankGaps(parsed, options)`, and `RankedGap[]` for the interactive-refinement tool. Validator extended with DQ checks and scope-stage readiness. Editor learns to update the `gaps` section atomically when a block is replaced or superseded. Compactor preserves the `gaps` section.
- **Renderers.** Both HTML and Markdown render partial and provisional blocks with a visual indicator (e.g. a faint badge: "Assumed — based on asset-class default"). Web viewer surfaces a "gaps" panel and a "what would change this" panel driven directly from `rankGaps()` — answering questions live tightens the displayed ranges. CLI `uwmd validate` emits a "gap report" alongside CC errors. New `uwmd scope` subcommand wraps the scope agent. New `uwmd refine` subcommand runs the refinement loop in headless / scripted mode.
- **Bancroft / agent runtime.** Each layer consumes the `INCOMPLETE_DATA_POLICIES` table and applies the right action. New L0a (scope) layer that produces the initial scoped file. New L0b (scope refinement) layer that wraps `refinement.ts` in a Claude prompt — turns ranked gaps into conversational questions, applies user answers via `applyEdit()`, re-ranks. L0 (ingestion) is the primary writer of `gaps`; L7 (assembly) consumes them to format the lender package. Screening (L1) reads provisional flags and either runs with a disclaimer or halts based on policy.
- **Conformance.** Tier-2 fixtures: a file with a `partial` block, with a `provisional` block, with a populated `gaps` section, and a fully-provisional scope-stage file. Tier-3 fixtures: calc engine handles `null` propagation through fields whose source block is `provisional`. Tier-4 fixtures: a "scope-only" deal that the scope agent must produce a deterministic-shape output for given a fixed seed (the existing recorded-fixture pattern from the prior review's recommendation).
- **Asset-class default tables.** Curating these is a real, ongoing piece of work — they're the priors the napkin mode actually leans on. Multifamily first (since Parkview is the canonical example). Office, retail, industrial follow. Hospitality lands with RFC 0006. These tables are normative spec material because adopters need to produce comparable scope outputs.
- **Market-data contract.** The scope agent reads market data; the protocol needs to define a `MarketDataSource` interface (function signature, cache semantics, staleness) so adopters can plug in CoStar, Yardi Matrix, or their own internal data without rewriting the agent.

This is naturally split across three RFCs: one for the `_meta`/`gaps` extensions (smaller, ships with v1.1), one for `INCOMPLETE_DATA_POLICIES` and the fallback cascade (larger, may want a v2 RFC), and one for the `scope` stage and the L0a contract — likely paired with the asset-class default tables, since they're useless apart. RFC 0005 (stochastic calcs) absorbs the range-types work in v2.

---

## Area 3 — AI-readable, AI-efficient representation

This is the area you said you want guidance on most, so I'll spend longer here. There are two things to separate:

- **Readability** — can an LLM make sense of the file? Today: yes. The file is plain text with named JSON blocks; modern frontier models read it accurately.
- **Efficiency** — how many tokens does an LLM consume per unit of useful information about the deal? Today: more than necessary, because the file has prose duplication, repeated `_meta` overhead, and verbose JSON property names.

I want to gently push back on one specific framing in your question: **a compiled / binary format is almost certainly not the right answer for AI efficiency.** I'll explain why, then walk through what is.

### 3.1 What problem are we actually solving?

We need to feed `.uw.md` to LLMs. Concretely, LLMs cost tokens (input + output), respond more reliably to clean inputs, and have finite context windows. So the question is: **what view of the deal do we feed an LLM, for which task, and how do we minimize tokens without losing information the LLM needs?**

Note: the answer to that is **task-dependent**. An L1 screening agent does not need full rent-roll detail. An L7 assembly agent needs almost everything. A "summarize this deal in two sentences" prompt needs ~5% of the file.

### 3.2 Where the current architecture stands

Already present:

- `compactor.ts` strips superseded blocks for a "live view."
- `buildAgentContext()` in `context.ts` builds an agent-specific subset of the file based on `BANCROFT_LAYERS` definitions.
- The `browser.ts` subpath export means the parser/calc/validator runs in a browser without dragging in the LLM SDK.
- The file separates prose (human) from JSON (machine) — so a "machine view" is in principle just the JSON.

Where this is thin:

1. **No formal "compact" rendering.** `buildAgentContext` exists but is one specific use case. There's no general `render(parsed, profile)` API where `profile` chooses what to include and what shape.
2. **Prose and JSON duplicate the same data.** A 48-unit rent roll has the unit data in both a prose table and a JSON block. Today, you feed both to the LLM. ~2× tokens for the same information.
3. **No section-level digests.** An agent host can't ask "did `rent_roll` change since hash X?" — so it can't cache or skip.
4. **Pretty-printed JSON is the norm.** Nice for humans, ~30% extra tokens for indentation and whitespace.
5. **No documented "feed-this-to-Claude" pattern.** Adopters figure out for themselves what to pass.

### 3.3 The option space

I'm going to lay out six options, then explicitly debunk one ("compile to binary") because it sounds like the right answer but isn't.

**Option A — Status quo: ship the markdown file as-is.**
Simplest. Works. ~12-15K tokens for a typical 300-line deal. Token-heavy at scale but trivially debuggable: when the LLM gets something wrong, you read what it saw.

**Option B — Strip prose for agent calls.**
Build a renderer mode that emits *only* the JSON blocks (no prose, no headers, no tables). Roughly 40-50% reduction in tokens for typical files. Lossless if all data really lives in JSON (which the format philosophy says it does).

**Option C — Compact JSON.**
Minified, no indentation, deduplicated property names via a header-defined schema. ~25% additional reduction on top of B. Becomes harder to debug (LLMs do fine with minified JSON; humans don't).

**Option D — Tiered context profiles.**
Formalize `summary | live | relevant(sections) | full` as a public API. Most agent calls use `summary` (frontmatter + quick_metrics + pipeline_state, ~500 tokens) or `relevant(['rent_roll', 'noi_model'])`. Only L7 assembly uses `full`. This is structural, not encoding-level — and probably the highest-leverage move.

**Option E — Stable section digests + cache-friendly layout.**
Each section gets a content hash. Agent hosts pass deals to the LLM in a layout that maximizes prompt-cache hits: stable header → property data (rarely changes) → rent roll → operating data → narrative. The Anthropic prompt cache has a 5-minute TTL and works on prefix matches; if you put the volatile stuff last, you cache the rest.

**Option F — Embedding-based retrieval (corpus level).**
For "find similar deals in our portfolio" queries, embed each block, retrieve only relevant ones at query time. Out of scope for single-deal flows; relevant for portfolio analytics. Probably v3 territory.

**The misleading option — compile to binary (`.uwc`).**
Convert the file to MessagePack, CBOR, or protobuf. Roughly 5-10× smaller on disk than JSON.

This sounds right but does not help the AI use case. **LLMs read tokens, not bytes.** Feeding a binary blob to Claude either base64-encodes it (which is *more* tokens than the JSON) or simply doesn't work. The binary savings are at the wire/disk level, not the model level.

There is a separate argument for a binary format — fast parsing on cold-start, smaller artifact storage in a portfolio of 50,000 deals — but that's an infrastructure concern, not an AI-efficiency concern, and it directly contradicts the human-readability premise of the format. CommonMark, OpenAPI, JSON Schema all stayed text. Don't go binary unless there's a measured infrastructure problem text doesn't solve.

If you want fast parsing, the answer is to ship a parsed-AST cache (`*.uw.md.cache.json` next to the file) — a pure performance optimization, not a format change.

### 3.4 Recommendation

The single highest-leverage move is **Option D — tiered context profiles** — and it costs surprisingly little to ship. Layer in B, C, and E as supporting refinements:

1. **Formalize a `ContextProfile` API in `@uwmd/core`.**
   ```ts
   type ContextProfile = 'summary' | 'live' | 'compact' | 'full';
   buildContext(parsed, profile: ContextProfile, options?: { sections?: string[] }): string;
   ```
   - `summary` — frontmatter + quick_metrics + pipeline_state + gaps. ~500 tokens. Use for routing/screening.
   - `live` — compactor output (no superseded blocks), all sections included, prose retained. The default for "show this to a human."
   - `compact` — `live` minus prose, with minified JSON. The default for "feed this to an LLM."
   - `full` — every byte. The default for archival, audit, and reproduction.
   - `relevant(sections)` — `live` filtered to specific sections. Agent layers consume this.

2. **Document it.** A docs-site page titled "Feeding `.uw.md` to an LLM" with worked examples and token-cost tables. This is what adopters will copy-paste.

3. **Add stable section digests.** `_meta.content_hash` on each block. Hosts can ask "has section X changed since hash Y?" Enables prompt-cache-friendly orchestration.

4. **Order sections in `compact` mode for cache friendliness.** Stable property data first, volatile narrative last. Pair with the prompt-cache TTL of 5 minutes documented in the AI-host docs.

5. **Don't go binary.** If parsing speed becomes a measured problem, ship a `.uw.md.cache.json` AST cache as an internal optimization. Don't promote it to a normative format.

A note on the "lossless compression" framing in your question: the most useful kind of "compression" for AI here is *semantic*, not *bitwise*. Removing prose that duplicates JSON, removing superseded blocks, removing `_meta` fields the agent doesn't need — those are all lossless from the LLM's perspective because the LLM doesn't need them to answer the question. That's exactly what tiered profiles do. They're a form of lossless-for-this-task compression.

### 3.5 Downstream impact

- **Format spec.** Optional `_meta.content_hash` on blocks. Otherwise unchanged — the format itself doesn't compile or compress; the rendering does.
- **Protocol.** A new section: "Context Profiles" defining the four profiles normatively. Agent host contract is updated to reference them.
- **`@uwmd/core`.** New module `context-profiles.ts` exposing `buildContext`. `compactor.ts` is reused for the `live` view. `buildAgentContext` is rewritten as `buildContext(parsed, 'relevant', { sections: layer.reads })`.
- **Bancroft agents.** Each layer's manifest declares which profile it consumes. L0/L1 → `summary`; L2/L4 → `relevant`; L7 → `full` or `live`.
- **Web editor.** "Copy as LLM context" button that emits `compact`.
- **CLI.** `uwmd render --profile=compact` subcommand.
- **Conformance.** New tier-4 fixtures: agent-host contract verifies that the tool requests the right profile per layer.
- **Docs site.** New "AI integration" page with token-cost tables for each profile against the Parkview example.

This is genuinely a v1.1 feature, and it's where most adopter pain will end up if you don't ship it.

---

## Area 4 — Cross-cutting observations

The three areas above share three architectural primitives that deserve to be treated as first-class.

### 4.1 `_meta` is doing more work than its current schema admits

`_meta` already carries `actor`, `source`, `confidence`, `human_review_required`, `superseded`, `supersedes`, etc. The recommendations above add `parent_hash`, `signature`, `partial`, `provisional`, `field_overrides`, `content_hash`. That's a lot of fields on one object.

I'd recommend an RFC ("Meta v2") that re-organizes `_meta` into named sub-objects:

```jsonc
"_meta": {
  "provenance": { "actor": "...", "source": "...", "agent_id": "..." },
  "quality":    { "confidence": "high", "partial": false, "provisional": false, "field_overrides": [] },
  "lifecycle":  { "superseded": false, "supersedes": null },
  "integrity":  { "content_hash": "...", "parent_hash": "...", "signature": null }
}
```

Forward-compatible: readers that don't recognize a sub-object ignore it. This also makes documentation straightforward — each sub-object has its own subsection in the format spec.

### 4.2 The validator should grow severity classes

Currently issues are coded `CC-NN` (consistency) and various uncoded financial-validity messages. With the recommendations above, you have at least four classes:

- `CC-NN` — cross-section consistency (existing).
- `DQ-NN` — data quality (partial, provisional, gap-driven).
- `INT-NN` — integrity (chain broken, stale parent, signature mismatch).
- `POL-NN` — policy (wrong actor, wrong edit operation kind).

Plus the unscoded financial checks, which should be folded into `FV-NN` (financial validity) so every check has a code.

Implementers and UIs benefit from a stable, namespaced taxonomy. This was already flagged in the prior review.

### 4.3 The protocol needs a "consumer profile" surface

Right now the protocol describes what a *producer* must do (writing edits, computing calcs, hosting agents). It says less about what a *consumer* should ask for. The Context Profiles work in Area 3 starts to fill this — but the broader pattern is: every consumer of a `.uw.md` file should declare what view of the file it wants. That declaration drives:

- Which sections are included.
- Which `_meta` sub-objects are stripped.
- Whether superseded blocks are visible.
- Whether prose is included.
- Whether the calc engine is run to produce derived values.

This might fold naturally into the existing `ImplementationManifest` — extend it with `consumed_profile`. Or it might be a separate `ConsumerProfile` type. Either way, surfacing it makes the protocol symmetric: producers and consumers both declare contracts.

---

## Area 5 — A suggested ordering

If I had to rank these by leverage-per-day-of-work:

1. **Context Profiles (Area 3).** Highest user-visible payoff; opens the door to credible AI integration. ~1-2 weeks. Ship as v1.1.
2. **`gaps` section + `partial`/`provisional` flags (Area 2, partial).** Solves the most common operator pain: "what's missing, and what should I do about it?" ~1 week. Ship as v1.1.
3. **`INCOMPLETE_DATA_POLICIES` table (Area 2, finishing).** Normatively defines fallback behavior. ~1-2 weeks plus an RFC. Ship as v1.2 / v2.
4. **`uwmd verify` + content hashes (Area 1, Options C+D+F).** Catches accidents and concurrent-write bugs. ~1 week. Ship as v1.2.
5. **`_meta` v2 reorganization (Area 4.1).** Cleanup work that pays off long-term. RFC track. Ship as v2 with a graceful migration.
6. **Validator severity classes (Area 4.2).** Mostly mechanical; do alongside any of the above.
7. **Signed blocks, capability tokens, embedding retrieval.** Defer indefinitely; right answers for narrow use cases.

None of these block the public flip. All of them make the format meaningfully more useful for the actual workflows it claims to support.

---

## Area 6 — What I'd not do

It's also worth being explicit about the tempting things that look like the right answer but aren't.

- **Don't ship a compiled binary format.** It does not help LLM efficiency (LLMs read tokens, not bytes), it contradicts the human-readability premise that distinguishes `.uw.md` from `.xlsx`, and it doubles the maintenance burden by giving you two formats to keep in sync. If you measure a parsing-speed problem, ship an AST cache as an internal optimization.
- **Don't go to per-field provenance everywhere.** It's seductive — full traceability of every value — but it breaks readability and bloats the wire format. Use the sidecar envelope only where it matters.
- **Don't introduce capability tokens for a self-hosted text format.** It would force a coordinator service, kill offline workflows, and contradict "the file is the protocol."
- **Don't add a write lock to the file format itself.** Concurrency control belongs in the editor layer (parent-hash) and the file system (advisory locks), not in the spec. Spec-level locks are the kind of complexity that kills standards.
- **Don't make `_meta.signature` mandatory in v1.** Optional now, normative later if the regulated-deployment use case actually materializes. Premature crypto is its own kind of debt.

---

## Closing thought

The three areas you raised — unauthorized edits, partial data, AI efficiency — aren't unrelated quality concerns. They're the three places where the format meets the world: who's allowed to write to it, what to do when reality is incomplete, and how to hand it to the consumer who actually uses it. A good v1.1 cycle answers all three with small, composable additions to `_meta`, the validator taxonomy, and the rendering surface. None of them require breaking changes. None of them require giving up the human-readability that makes `.uw.md` worth standardizing in the first place.

The format is in a good place to absorb these additions. The single dispatcher in `applyEdit()`, the policy table in `protocol.ts`, the compactor, and the conformance ladder all give you the seams you need to evolve cleanly. Use them.
