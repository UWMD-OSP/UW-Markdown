# Bounded underwriting agent skills

UW Markdown ships five starter workflow skills as local agent configuration files.
Each returns structured `EditOperation` proposals for a host to
validate and apply. No skill performs financial math. A producer uses its own
deterministic modeling tools; a receiver can verify stated results with
`@uwmd/verify` independently of that producer.

These optional starter skills are separate from the format instructions on
the [AI guide](/ai/), and no conforming implementation needs them.

| Skill | Job boundary |
|---|---|
| `uwmd-intake-scope` | intake facts, scope, and missing-input triage |
| `uwmd-document-extraction` | attributable source-document extraction |
| `uwmd-validation-triage` | evidence-backed validation remediation |
| `uwmd-batch-exceptions` | collection-index exception triage |
| `uwmd-portfolio-rollup` | relationship-aware portfolio review |

All skills preserve provenance, never write directly, and return `[]` when no safe edit is supported.
