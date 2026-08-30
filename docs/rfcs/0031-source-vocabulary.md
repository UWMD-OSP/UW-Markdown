---
rfc: 0031
title: Reconcile the source vocabularies and close the unpoliced-write path
status: draft
author: jaredmaxey
created: 2026-08-30
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0031: Reconcile the source vocabularies and close the unpoliced-write path

## Summary

`_meta.source` is asked to carry two unrelated facts at once — *who wrote this
block* and *how its value was resolved* — and the specification answers that
question six different times, in six different vocabularies, of which only one
is executable. The result is not a documentation problem: 43% of the blocks in
our own corpus resolve to no edit policy at all, and because `checkAuthority`
treats "no policy" as "permitted", those blocks can be replaced rather than
superseded, silently destroying prior versions.

This RFC separates the two facts into two fields, keeps the one vocabulary that
already has runtime behavior attached, retires the rest, and makes an unmatched
source fail toward preservation instead of toward permission.

## Motivation

### Six vocabularies for one field

| Where | Shape | Sample |
|---|---|---|
| Format §2.6, table 1 | colon-prefixed actors | `agent:L0-01`, `engine:calculations.ts`, `import:om.pdf` |
| Format §2.6, table 2 | short-form cascade tags (11) | `ai_extracted`, `asset_class_default` |
| Format §3.1 | a mixed hierarchy | `user:override`, `agent:computed`, `ai_extracted` |
| Format §4.16 | an enum (7) | `wizard_input`, `scenario_default` |
| Protocol §V.7 | the cascade table (8) | `inherited_assumption`, `investor_profile` |
| `BUILTIN_EDIT_POLICIES` | slash-namespaced patterns (5) | `agent/*`, `document/*`, `system/*` |

Only `manual` means the same thing in all six.

They disagree on more than spelling. §4.16 requires `wizard_input`, a token that
appears in no other vocabulary and in no line of code, while §2.6 calls the same
concept `user_input`. §2.6's table 2 claims to be "normative for cascade
resolution (see Protocol §IX)" — but §IX is the AI Host Contract; the cascade is
§V.7, and §V.7's table lists `inherited_assumption` and `market_data_accepted`,
which §2.6 omits, while omitting four tags §2.6 declares normative.

Worst, **§3.1 and §V.7 rank the same two sources in opposite order.** §3.1 puts
market data above investor profile; §V.7's `CASCADE_ORDER` puts investor profile
at step 4 and market data at step 5. Two producers, each following a normative
section, resolve the same field to different values.

### The root cause: one field, two orthogonal facts

The vocabularies never reconciled because they are not describing the same
thing. `agent:L0-01` and `document/rent_roll` name **an actor**. `ai_extracted`
and `asset_class_default` name **a resolution method**. Both are legitimate
provenance; neither is a substitute for the other. An L6 agent that filled a
field from the asset-class default table has an actor *and* a method, and today
must discard one of them to write a single string.

That is why `BUILTIN_EDIT_POLICIES` keys on actors (only an actor can be granted
or denied authority) while §4.16's registry aggregates by method (only a method
answers "how much of this underwriting is assumed?"). Both are right about their
own question.

### The consequence is a live defect, not an inconsistency

`resolvePolicy` returns `null` for a source matching no pattern, and
[`editor.ts`](../../packages/uwmd-core/src/editor.ts) then does two things with
that `null`:

```ts
if (!policy) return { ok: true };          // checkAuthority — unmatched is permitted
if (policy?.supersede_on_edit) { … }       // dispatchEdit  — unmatched never supersedes
```

So a source outside the executable vocabulary is *both* unconditionally
authorized *and* exempt from `supersede_on_edit`. `POL-01` cannot fire, `POL-02`
cannot fire, and `verifyChain` stays silent. A producer following format §2.6
literally — writing `agent:L0-01` — gets unpoliced writes that replace prior
blocks in place. That breaks append-only provenance, which is invariant 5.

Authority classification compounds it: `isHuman` is computed as
`!source.startsWith('system/') && !source.startsWith('agent/')`, so the colon
form `agent:L0-01` is classified as a **human** edit.

### Measured against our own corpus

Parsing all 206 `.uw.md` / `.uwx.md` files in the repository — 613 blocks
carrying `_meta.source`, 32 distinct values:

| | Blocks | Share |
|---|---:|---:|
| Resolve to an edit policy | 350 | 57% |
| **Resolve to no policy (fail open)** | **263** | **43%** |

Of the 263, **33 use canonical `SOURCE_TAGS`** — `market_data` (16),
`user_input` (10), `asset_class_default` (3), `ai_extracted` (2),
`system_default` (1), `market_data_accepted` (1). The spec's own canonical tags
are unpoliced. Another 20 use the `agent:` colon form and are therefore
classified as human writes. The remainder are values in no vocabulary at all:
`engine`, `extractor`, `wizard`, `system`, `L6`, `L6-01`, `engine:uwmd`.

The reference corpus cannot satisfy the reference implementation's policy
engine. That is the strongest available argument that the vocabulary was never
actually decided.

### This blocks RFC 0009

RFC 0009 (`_meta` v2 reorganization, draft) types the nested field as
`source: SourceTag; // user_input | ai_extracted | …` — it picks the *method*
reading and would bake it into `provenance.source` for format v2.0, permanently
orphaning the actor vocabulary that the edit engine runs on. 0031 must resolve
before 0009 is accepted.

## Proposed change

### 1. Split the field

`_meta.source` becomes **actor-only**, with a closed namespace set and `/` as
the sole delimiter:

```
manual | agent/<id> | document/<id> | system/<id> | institution/<id>
```

This is exactly what `BUILTIN_EDIT_POLICIES` already matches; no runtime
behavior changes.

`_meta.resolution` is **new and optional**, holding one canonical tag from
`SOURCE_TAGS`:

```
user_input | user_override | manual | inherited_assumption | investor_profile
| market_data | market_data_accepted | ai_extracted | agent_computed
| asset_class_default | scenario_default | global_default | system_default
```

Both may be present; they answer different questions. A block written by agent
L6-01 from the asset-class default table is:

```jsonc
"_meta": { "source": "agent/L6-01", "resolution": "asset_class_default", … }
```

`field_overrides[].source` is likewise split into `source` / `resolution`, since
§V.7 permits stamping the cascade step at leaf level.

### 2. Every source resolves to a policy

`BUILTIN_EDIT_POLICIES` gains a terminal catch-all:

```ts
{ source_pattern: '*', authority: 'either', supersede_on_edit: true },
```

`matchSource` scores by pattern length, so `*` (length 1) loses to every
specific pattern; it only applies where nothing else matched. An unrecognized
source therefore gets the **conservative** treatment — the prior block is
preserved — rather than the permissive one. No write that succeeds today starts
failing; writes that today destroy history start superseding instead.

`checkAuthority`'s `if (!policy) return { ok: true }` inverts to a refusal, for
the case where a caller supplies a custom policy list with no catch-all. Passing
policies that do not cover a source should be an error, not a grant.

Authority classification stops guessing from string prefixes and reads the
parsed actor namespace, so a malformed source cannot be classified as human by
accident.

### 3. Two new validator codes

| Code | Severity | Trigger |
|---|---|---|
| `SRC-01` | warning | `_meta.source` is not `manual` or a `<namespace>/<id>` pair with a registered namespace. |
| `SRC-02` | warning (error at format 2.0) | `_meta.source` holds a `SOURCE_TAGS` value — a resolution tag in the actor field. |

The `SRC-NN` family registers under §III.6a with owning capability `validate`,
using the registry RFC 0030 introduces. **RFC 0030 should land first**; if it
does not, `SRC-NN` needs the family table repaired anyway, and the two RFCs
collide in §III.6a.

### 4. Read-time interpretation during migration

A reader encountering a `SOURCE_TAGS` value in `_meta.source` MUST interpret it
as `resolution`, and MUST treat `source` as absent rather than inventing an
actor. This makes every existing file readable with correct semantics on day
one; `SRC-02` tells the producer to write it properly.

### 5. Spec repairs

- **§2.6** — table 1 is deleted; the colon forms are retired. Table 2 is
  replaced by a pointer to `SOURCE_TAGS`, and the broken "see Protocol §IX"
  cross-reference is corrected to §V.7.
- **§3.1** — the hierarchy becomes non-normative narrative pointing at
  `CASCADE_ORDER`. Where §3.1 and §V.7 disagree, **§V.7 wins**: a standing
  investor profile is a declared decision, a market lookup is an observation,
  and a declared decision should outrank a scraped comp. §3.1 also ranks
  `ai_extracted` and `agent_computed`, which are not cascade steps at all;
  those rankings are removed rather than reinterpreted.
- **§4.16** — the `source` enum is replaced by `SOURCE_TAGS`. `wizard_input`
  becomes `user_input`. `summary.by_source` keys follow.
- **§V.4** — "`_meta.source` — derived from the actor (agent ID, "manual",
  etc.)" gains the actual grammar, which is where a producer looks first and
  currently finds nothing binding.

### 6. Schema

`uwmd-block.schema.json` constrains `source` to
`^(manual|(agent|document|system|institution)/[a-z0-9][a-z0-9._-]*)$` and adds
`resolution` as an enum over `SOURCE_TAGS`. Both apply to `field_overrides[]`
entries too. (Note for the implementer: write the pattern's literal dot as a
`[.]` character class — an escaped `\.` has repeatedly failed to survive the
generation path into these schema files.)

## Compatibility analysis

**Existing `.uw.md` / `.uwx.md` files** — remain parseable, and every one of the
613 blocks measured above keeps a correct reading via §4's read-time
interpretation. 263 of them begin warning under `SRC-01`/`SRC-02`. None become
invalid at format 1.x.

**Tier-1 Reader** — must apply the read-time interpretation. Additive.

**Tier-2 Editor** — behavior changes for exactly the blocks that are broken
today: an edit to a block whose source matched no policy now supersedes instead
of replacing. This is a **behavior change that can surface as `POL-02`** for a
producer that was previously replacing in place. That is the bug being fixed,
and it fails toward preserving data.

**Tier-3 / Tier-4** — unaffected.

**Modules** — unaffected. Modules contributing edit policies (§V.3) keep
working; a module policy is more specific than `*` and still wins.

**Receipts** — unaffected; no receipt field carries a source tag.

**Deprecation path.** `SRC-02` is a warning for all of format 1.x and becomes an
error at 2.0, which is also when RFC 0009's nested `_meta` lands — one break,
one migration, at a boundary that already exists. `uwmd migrate --source-tags`
rewrites a file in place, and because the mapping is total and mechanical, the
migration is scriptable rather than editorial.

## Conformance impact

**Migrated:** the 263 offending blocks across `conformance/` and `examples/`,
via the codemod. Their `_meta.source` moves to `_meta.resolution` where it is a
canonical tag, becomes `agent/<id>` where it is `agent:<id>`, and is assigned an
actor where it is one of the unclassifiable values (`extractor`, `wizard`,
`engine`, `L6`).

**Regenerated:** every `expected/*.parsed.json` touched by those blocks, plus
`conformance/tier-2-editor/` baselines where a previously-replacing edit now
supersedes.

**New fixtures:**

- `conformance/source/01-actor-and-resolution/` — both fields present and
  distinct; asserts they round-trip independently.
- `conformance/source/02-legacy-tag-in-source/` — a canonical tag in
  `_meta.source`; asserts the read-time interpretation and `SRC-02`.
- `conformance/source/03-unmatched-supersedes/` — the regression test for this
  RFC: an edit to a block whose source matches only `*` must supersede, and a
  `section_replace` against it must be refused with `POL-02`. This is the case
  that silently destroyed data before.
- `conformance/source/04-colon-form-rejected/` — `agent:L0-01` raises `SRC-01`
  and is *not* classified as a human write.
- `conformance/source/05-custom-policies-no-catchall/` — a caller-supplied
  policy list that does not cover the source is refused, not granted.

Corpus: current count → approximately +14 assertions. (The published 274 figure
predates PR #106 and should be re-measured, not carried forward.)

## Reference implementation

**Files affected:**

- `spec/UW_FORMAT_SPEC_v1.md` — §2.6, §3.1, §4.16.
- `spec/UW_PROTOCOL_v1.md` — §V.3, §V.4, §V.7, §III.6a (`SRC-NN` registration).
- `spec/schemas/uwmd-block.schema.json` — `source` pattern, `resolution` enum.
- `packages/uwmd-core/src/types.ts` — `UWMeta.resolution`.
- `packages/uwmd-core/src/protocol.ts` — catch-all policy, `SRC-01`/`SRC-02`
  remediations, actor-namespace registry.
- `packages/uwmd-core/src/editor.ts` — `checkAuthority` inversion, namespace
  parsing instead of prefix tests.
- `packages/uwmd-core/src/validator.ts` — the two new checks.
- `packages/uwmd-core/src/parser.ts` — read-time interpretation.
- `scripts/migrate-source-tags.mjs` — new codemod.

**API surface:** `UWMeta.resolution` (optional, additive); `ACTOR_NAMESPACES`
exported; `SOURCE_TAGS` and `CASCADE_ORDER` unchanged. No removals at 1.x.

**Test plan:** the five fixtures above, plus a property test asserting
`resolvePolicy` is total — that no string resolves to `null` under
`BUILTIN_EDIT_POLICIES`. That single assertion is what makes the class of bug
this RFC fixes unrepresentable.

## Alternatives considered

**Pick one existing vocabulary and map the others onto it.** The obvious move,
and the one the upstream report suggested. Rejected: no single vocabulary can
express both facts, so any choice discards information that some consumer needs.
Choosing the actor form loses §4.16's registry; choosing the method form loses
edit authority — which is precisely the choice RFC 0009 was about to make by
accident.

**Keep one field, allow both shapes, define a total mapping to policies.**
Cheaper, and it closes the fail-open. Rejected: it preserves the conflation, so
a block written by an agent from a market lookup still cannot say both, and the
next reader to need the missing half re-opens this RFC.

**Fail closed on an unmatched source immediately.** Rejected as the default: it
converts 263 blocks in our own corpus from silently-wrong to hard-failing, and
an adopter mid-re-vendor would see the corpus refuse its files. The catch-all
gets the same safety property — history is preserved — without refusing writes.

**Leave the colon forms valid as an alias.** Rejected: aliases are how this
started. `agent:L0-01` and `agent/L0-01` differing only in a delimiter is a
trap, and the classification bug shows it is one people fall into.

## Unresolved questions

**Does `manual` belong in both fields?** It is a legal actor and a legal
`SOURCE_TAGS` member, which is either a useful shorthand (a human typed it, and
the method was "a human typed it") or the same conflation in miniature. Left as
a duplicate for now; resolving it means removing `manual` from `SOURCE_TAGS`,
which touches every consumer of that constant.

**Should `institution/*` keep `system_only` authority?** Unchanged here, but a
policy an institution sets and a value the system computed are not obviously the
same authority class. Out of scope; noted because the catch-all makes the
question visible for the first time.

**How does `resolution` interact with `field_overrides` granularity?** §V.7
already permits leaf-level stamping. When a block carries both a block-level
`resolution` and per-field ones, the leaf presumably wins — but "presumably" is
not a specification, and the answer should be written down before the first
consumer depends on it.

## Prior art

**Git's author/committer split** is the same distinction: who wrote the change
and who applied it are different facts, and collapsing them loses information
every rebase would otherwise destroy.

**W3C PROV** separates `Agent` (who), `Activity` (what happened), and
`Entity` (the thing produced), specifically so provenance questions about
responsibility and about derivation can be asked independently. `source` and
`resolution` are the same cut, narrowed to what a block needs.

**HTTP's `Authorization` versus `From`** is the cautionary case: one header
carries an identity used for access control, the other an identity used for
contact, and the specifications are explicit that the second must never be used
for the first — a rule that exists because implementations tried.
