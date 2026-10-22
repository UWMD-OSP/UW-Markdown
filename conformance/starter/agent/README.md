# Layer-profile starter check

Every case here is a starter-product check, owned by docs/starter, not a
Protocol tier. Directories describe content;
[corpus-index.json](../../corpus-index.json) determines each case’s single owner.

The reference toolkit hosts no agents. It keeps the Bancroft layer registry
(`BANCROFT_LAYERS`) and its context and prompt builders, and any host that runs
its own agents writes their records through the generic writers
(`writeAgentBlock`, `writeErrorEntry`) or the edit API. There are no shape or
replay checks of agent output here; a host tests its own writes.

## Profile contract

`profile/` asserts that every entry in `BANCROFT_LAYERS` declares the right
`consumed_profile`. It reads the registry directly, needs no model and runs no
agent, and catches accidental profile-policy drift introduced by a layer change.

```
profile/<scenario-id>/
└── expected-layer-profiles.json   { layer_id: consumed_profile, … }
```

| Scenario | Validates |
|---|---|
| `profile/consumer-profile-contract` | Sorted `(layer_id → consumed_profile)` map matches the recorded baseline. Update only when intentionally changing a layer's profile. |

## Running

The reference runner executes this check by default:

```bash
node scripts/run-conformance.mjs --suite=starter-agent-profile
```
