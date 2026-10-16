<span id="bounded-underwriting-agent-skills"></span>

# Legacy underwriting skill assets

These five existing repository assets are retained for 4.x compatibility.
New skills and underwriting workflows belong to adopter applications; UWMD's
supported integration boundary is its documented contracts and verification APIs.
Their eventual retirement requires the reviewed migration plan. These are business
workflow assets, distinct from repository coding-agent `AGENTS.md` instructions.

Each currently returns structured `EditOperation` proposals for a host to
validate and apply. Financial calculations must use deterministic code consistent
with the standard; adopters need not use UWMD's starter engine.

| Skill | Job boundary |
|---|---|
| `uwmd-intake-scope` | intake facts, scope, and missing-input triage |
| `uwmd-document-extraction` | attributable source-document extraction |
| `uwmd-validation-triage` | evidence-backed validation remediation |
| `uwmd-batch-exceptions` | collection-index exception triage |
| `uwmd-portfolio-rollup` | relationship-aware portfolio review |

All skills preserve provenance, never write directly, and return `[]` when no safe edit is supported.