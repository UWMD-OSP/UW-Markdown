# Tier-4 recorded-replay scenarios

Deterministic Tier-4 conformance. Each scenario replays a recorded cassette
through the real agent runner and compares the resulting document **byte for
byte** against a frozen baseline. No network, no API key, no cost — so unlike
the shape-only fixtures in `../fixtures/`, these run in CI by default.

## Why this exists

Tier-4 conformance used to be lint-only: the fixture and its expected-shape JSON
were parsed, and nothing else happened. Nothing checked that a host actually
writes what the protocol says it writes.

That gap was larger than it looked. The shape-only `l6-risk-rating` fixture was
not merely un-run — it was **un-runnable**: it carries only a `property`
section, while the L6 layer requires `noi_model`, `valuation`, and
`debt_structure` before its context check will pass. A fixture that can never
execute cannot fail, which is the worst property a conformance fixture can have.

## Layout

```
<scenario>/
  scenario.json             which agent to run, and what it should write
  before.uwx.md             input document
  cassette.json             the model's side of the conversation
  after.uwx.md              frozen expected output — compared byte for byte
  scripted-completion.json  input to the regeneration script (see below)
```

## What a scenario proves

Replaying the cassette exercises the entire Tier-4 write path at once:

- context assembly and the readiness check,
- tool-call extraction,
- supersede semantics on an existing block,
- `_meta` ownership — the host stamps provenance, the model cannot,
- the pipeline-log append,
- `last_modified` and `pipeline_state` frontmatter updates.

Because the comparison is byte-exact rather than shape-based, a regression in
any of those surfaces as a line-level diff.

## Determinism

A run is reproducible only because the clock is injected. `runBancroftAgent`
accepts `now`, and a constant clock freezes `_meta.timestamp`, collapses
`duration_ms` to 0, and makes the pipeline-log entry id derivable rather than
random. The runner uses `2026-08-13T00:00:00.000Z`.

Real runs leave `now` unset and keep their random log-entry suffix, which is
what stops two runs in the same millisecond from colliding.

## Replay is strict, on purpose

Each exchange records the request it answered. On replay the request is compared
canonically, and a mismatch is a typed `AgentProviderError` naming the field that
changed:

```
Cassette is stale at exchange 1: the request no longer matches what was
recorded (changed: system). Re-record the cassette.
```

So a cassette does double duty as a **prompt-drift detector**. Change
`buildAgentPrompt` or a layer's declared reads and the cassettes say so, instead
of a stale recording quietly answering a question nobody asked.

Matching is sequential rather than keyed: a keyed cassette would happily serve a
*reordered* run, hiding a change in how many calls a layer makes or in what
order — exactly what this suite exists to catch.

`max_tokens` and `temperature` are excluded from the comparison. They change the
sampling budget, not the question, and pinning them would force a re-record for
a knob with no bearing on the exchange.

## Honest limits

**The committed cassettes are synthetic.** They were produced by the real
`createRecordingProvider` wrapping a *scripted* backend, not by a live model —
CI has no API key, and a recording made from one machine's live call is not
reproducible evidence anyway.

What these scenarios prove is that **the host writes the protocol-mandated
document given a model's answer**. What they do not prove is that any particular
model produces that answer. Model quality is not conformance, and this suite
does not pretend to measure it.

To record against a live backend, wrap the real provider:

```ts
const recorder = createRecordingProvider(createAnthropicProvider({ apiKey }));
await runBancroftAgent(before, 'L6-01', { provider: recorder, now: () => FROZEN });
writeFileSync('cassette.json', JSON.stringify(recorder.cassette(), null, 2));
```

## Regenerating a baseline

`npm run conformance -- --tier=4-replay --update` refreshes `after.uwx.md` from
current library output, the same way every other suite handles baselines. Review
that diff carefully — it is the assertion.
