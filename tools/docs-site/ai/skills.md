# Bounded underwriting agent skills

UW Markdown ships five project-owned Codex skills in `.codex/skills`. Each returns only structured `EditOperation` proposals for a host to validate and apply. No skill performs financial math; `@uwmd/core` remains the sole calculator.

| Skill | Job boundary |
|---|---|
| `uwmd-intake-scope` | intake facts, scope, and missing-input triage |
| `uwmd-document-extraction` | attributable source-document extraction |
| `uwmd-validation-triage` | evidence-backed validation remediation |
| `uwmd-batch-exceptions` | collection-index exception triage |
| `uwmd-portfolio-rollup` | relationship-aware portfolio review |

All skills preserve provenance, never write directly, and return `[]` when no safe edit is supported.