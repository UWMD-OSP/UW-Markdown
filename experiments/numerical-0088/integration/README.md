# Accepted-main integration accounting (research only)

Accepted main `afcc615897aca301c7b5ec070bba7c0bd253e4ef` merged RFC 0090 /
PR #376. Existing observations remain historical at their recorded checkout;
merging accepted main does not make them new observations of main.

The original Astra `integration-identities.json` remains byte-exact at SHA-256
`37da9779bb4c08708aae8bc6d2db87b6d87c0a226d96de130d06cf061b5da325`.
Its separate successor `../astra-review/integration-identities-afcc.json` pins
that predecessor plus the independently read accepted-main six-file Git-blob
map. Only the Protocol and corpus index differ from its prior current map;
builtins, quantizer, receipt source and Receipt spec are unchanged. The actual
Astra API replay still compares **every behavioral field exactly** against the
original byte-pinned observations. No wildcard, automatic hash refresh, old
production loading or expected-answer overwrite is used.

The frozen trajectory manifest remains byte-exact at SHA-256
`53a79745035278e22f01322d7f851293762a41f1e1e7dad1cb1a9efd11d22c08`.
Within that manifest's full source closure, only `spec/UW_PROTOCOL.md` differs:

| Identity | SHA-256 |
| --- | --- |
| Historical Protocol | `a3de7d6053865aa8a1c7e42ca694fcefe02bf392a960cf4b0d2ef98cc9bcb61b` |
| Accepted afcc Protocol | `80a59032f436ccf85ad1476d35a1251234955354f99f5e9da89ee701d6946a86` |

The exact frozen manifest/hash, original checkout/tree and both Protocol
identities are explicit in `accepted-main-afcc.json`. `verify_trajectory.py`
requires that exact transition and requires every other current source,
helper, numerical graph, input and reused reference to equal the old map. It
verifies all 21 compressed/raw artifacts without executing financial graphs.
The self-pinned original `financial-trajectories/capture.py` remains unchanged;
its old `--check` deliberately rejects a changed current Protocol. Use this
separate verifier for this reviewed integration instead of weakening that
historical check or regenerating its manifest.

```sh
node experiments/numerical-0088/astra-review/reproduce.mjs
node --test experiments/numerical-0088/astra-review/reproduce.test.mjs
python -B experiments/numerical-0088/integration/verify_trajectory.py
python -B -m unittest discover -s experiments/numerical-0088/integration -p "test_*.py" -v
```

Seven Astra guards cover current identity changes/omission, frozen bytes,
historical metadata, behavior words/outcomes/backend counts/extra fields,
no-overwrite and predecessor replacement. Three trajectory tests cover the
exact current map, a mutation of **each** protected source and unapproved
historical/extra-transition metadata. The first guard run caught only a changed
assertion diagnostic string; retaining the established diagnostic corrected
that test, without changing a production outcome or loosening its assertion.

New `../composed-receipts/` observations record current-afcc receipt execution
under a separate full source/dist map and the accepted real backend/signature
precedence. They neither relabel old evidence nor claim all old financial
trajectories were re-executed after actor admission. No kernel/native/full
corpus or 4730-row study is repeated here. Workflow changes and publication
remain integrator-owned. This is not a legacy support layer or RFC acceptance.
