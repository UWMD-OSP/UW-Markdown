# Frontmatter YAML subset: quoted scalars and the reader pre-pass

Review date: **2026-10-04** (America/Phoenix). Status: **investigation only.**
No Format, Protocol, schema, conformance, parser or version change is made
here. Reconciled against `main` at `f6eb3e7` (Format 2.0, Protocol 2.21.0,
core/CLI 2.17.0).

**Resolution (2026-10-04).** The owner confirmed that admitted frontmatter
constructs keep their YAML 1.2 semantics, and follow-ups 1–4 below landed
together on branch `claude/frontmatter-yaml-reconcile`, as one contract and
evidence commit and one reader commit. The repro script records the state
before that repair. Against a build that includes it, the script exits 1 by
design, because no finding reproduces any longer.

This follows up three items PR #260 recorded while fixing `uwmd init`'s
frontmatter writer. Every finding below reproduces with
[`2026-10-04-frontmatter-yaml-subset.repro.mjs`](2026-10-04-frontmatter-yaml-subset.repro.mjs)
(run from the repository root after `npm run build`). It exits 1 once any
finding stops reproducing.

## Summary

| # | Question | Classification |
|---|---|---|
| 1 | What Appendix D requires for quoted scalars | **Documentation ambiguity**: it lists them as supported YAML constructs and says nothing more |
| 2 | Whether standard YAML escaping is intended or excluded | **Existing specified behavior**, by reference to YAML: nothing excludes it, and the reference writers already depend on it |
| 3 | The readers keep quoted content verbatim | **Implementation drift**, and it corrupts data inside `@uwmd/core` |
| 4 | The pre-pass flags anchors, aliases and tags inside quotes | **Implementation drift**, plus two adjacent drifts (flow style accepted, comments kept) |
| 5 | The "Appendix A" citation | **Implementation drift** in code text |

**Recommendation: no RFC.** Conforming reader behavior is not genuinely
undefined. Appendix D defines the frontmatter as a YAML subset and admits
quoted scalars without restriction. The reference implementation's own writers
assume YAML quoted-scalar semantics, and only its readers depart from them.
Repairing the readers is restoring the specified behavior, not choosing new
semantics; the precedents are #252 (early-year day counts) and #254
(ProtocolError categories).

The repair does change what the readers return for quoted values that
contain `\` or `''`, and it makes flow-style frontmatter fail as Appendix D.2
requires. The owner should confirm that reading before the reader changes
ship (decision below).

## 1. What Appendix D requires

Format v1 Appendix D ("YAML Subset (Frontmatter)") says the frontmatter "is
parsed against a strict YAML **subset**, not full YAML 1.2", and conforming
readers MUST reject anything outside the subset with `UNSUPPORTED_YAML_FEATURE`.

- **D.1 (supported)** lists "Scalar — single-quoted string" and "Scalar —
  double-quoted string", each with one example, plus comments "`#` comment to
  end of line".
- **D.2 (rejected)** lists anchors and aliases, explicit tags, block scalars,
  flow-style mappings and non-empty sequences, complex keys and directives,
  each with a reason. Escape sequences and `''` are not on it.
- **D.3 (rationale)**: the subset exists so a reader can be small "without
  depending on a full YAML parser", and to keep "cross-implementation behavior
  identical" and prevent "round-trip bugs in editors that re-emit
  frontmatter".

Format v2 and the Protocol add nothing. The Lite spec (§3) has the same
silence: strings are allowed, and quoting is not described.

**Classification: documentation ambiguity.** Appendix D never states the
interpretation of a quoted scalar. It does not define a different one either.

## 2. Is standard YAML escaping intended or excluded?

| Evidence | Points to |
|---|---|
| Appendix D calls the format a *subset* of YAML. D.2 restricts which constructs may appear, with a reason for each exclusion. | Supported constructs keep their YAML meaning |
| D.2 does not exclude escapes or `''`, and gives no reason to | Not excluded |
| D.3 aims at identical behavior across implementations. Any implementation built on a YAML library unescapes. | YAML semantics |
| The Tier-2 editor's `serializeYamlScalar` (`editor.ts`) writes strings with `JSON.stringify`, commented "double-quoted". A JSON string is a valid YAML double-quoted scalar *only* under YAML's escape rules. | Implementers assumed YAML semantics |
| The Lite bridge's `serializeYamlScalar` (`lite-bridge.ts`, used by `stringifyUWX` and `uwmd convert --to uwx`) does the same for any value containing a quote, space or other indicator | Same |
| No conformance fixture contains an escape in a frontmatter scalar, and no RFC discusses one | No contrary decision exists |

**Classification: existing specified behavior**, by reference to YAML 1.2:
`\"`, `\\`, `\n` and the other escapes in double quotes, and `''` in single
quotes. Nothing in the contract excludes them, and the reference writers
already rely on them.

## 3. The readers keep quoted content verbatim

`parseScalar` in `parser.ts` and its twin in `lite.ts` strip the outer quotes
and return the rest unchanged.

| Probe | Written | Reference reader | `yaml` library |
|---|---|---|---|
| F3a: Tier-2 `frontmatter_set` of `He said "hi"` | `deal_name: "He said \"hi\""` | `He said \"hi\"` | `He said "hi"` |
| F3b: UW JSON → UWX of `C:\deals` | `deal_name: "C:\\deals"` | `C:\\deals` | `C:\deals` |
| F3c: hand-written `"a \"b\" c"` | — | `a \"b\" c` (Lite reader: the same) | `a "b" c` |
| F3c: hand-written `'O''Brien'` | — | `O''Brien` | `O'Brien` |

So an edit or a conversion inside `@uwmd/core`, read back by `@uwmd/core`,
returns a different string than was written. That breaks the round trip D.3
names, and Tier-2 edits are meant to preserve values.

**Classification: implementation drift**, in both the UWX and Lite readers.

## 4. The pre-pass and adjacent reader behavior

`rejectUnsupportedYaml` strips a trailing comment while respecting quotes, then
matches its patterns against the whole remaining line, quoted content included.

| Probe | Result | Classification |
|---|---|---|
| F4a: `"Smith: &Co"`, `"Note: *starred"`, `"Status: !Important"`, `'Smith: &Co'` | Rejected as an anchor, alias or tag | **Drift.** Inside a quoted scalar these characters are content, not YAML features, so D.1 admits the value. |
| F4b: `deal_name: {a: 1}`, `deal_name: [1, 2, 3]` | **Accepted**, returned as strings | **Drift.** D.2 says flow-style mappings and non-empty sequences MUST be rejected. No pre-pass pattern covers them. |
| F4c: `state: AZ # trailing comment` | Returns `AZ # trailing comment` | **Drift.** D.1 supports comments to end of line. `parseYamlFrontmatter` never strips them; only the pre-pass does, for its own matching. |

No conformance fixture exercises Appendix D at all, which is how all three
survived.

## 5. The "Appendix A" citation

`parser.ts` cites "Appendix A" for the YAML subset in its header comment and in
the `UNSUPPORTED_YAML_FEATURE` message users see. Appendix A is the file
naming convention; the subset is Appendix D. Separately, the Protocol's error
table describes `UNSUPPORTED_YAML_FEATURE` as a "Frontmatter YAML subset
violation (§2.2)". §2.2 is the frontmatter schema, so Appendix D is the more
exact reference there too.

**Classification: implementation drift** (code text), plus a minor
documentation imprecision in the Protocol table.

## Owner decision needed before reader changes

**Confirm that frontmatter quoted scalars carry YAML 1.2 quoted-scalar
semantics.** If confirmed, everything below is drift repair under the existing
contract. If the owner instead wants quoted content to stay verbatim, that
*would* need an RFC: the reference writers, every YAML-library reader and
Appendix D's "subset of YAML" framing would all have to change.

## Proposed bounded follow-ups (not started)

Each is its own PR, with conformance fixtures, which the corpus lacks today.

1. **Appendix D clarification (editorial).** State that quoted scalars have
   YAML 1.2 semantics, and correct the Protocol table reference. No version
   change; the meaning is already specified by reference.
2. **Quoted-scalar decoding.** Decode YAML double-quoted escapes and
   single-quoted `''` in both `parser.ts` and `lite.ts`. Pin the F3 round
   trips, and decide whether a decoded line break is allowed in a frontmatter
   value or refused.
3. **Pre-pass and comments.** Mask quoted content before matching (F4a), add
   the missing flow-style rejection (F4b), and strip trailing comments from
   unquoted values (F4c). F4b changes accepted documents into
   `UNSUPPORTED_YAML_FEATURE` errors, as D.2 requires, so the CHANGELOG must
   say so plainly.
4. **Citation.** Fix the "Appendix A" text in `parser.ts` (can ride with 3).

After item 2 ships, `uwmd init` (PR #260) can stop refusing values that
contain both quote kinds, because it could then emit escapes. Its current
output stays correct either way.
