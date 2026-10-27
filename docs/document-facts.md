# Source-fact documents

RFC0129 provides three descriptive profiles in current source. They carry
attributable statements, not adopted underwriting or financial assurance:

| Profile | Allowed contribution |
|---|---|
| `loan-quote-v1` |16 existing `debt_structure` facts, including quoted amount/rate/terms; no selected or funded loan |
| `offering-memorandum-v1` | Six property/appraisal facts; asking price, NOI, rent and occupancy schedules stay unmapped |
| `appraisal-abstract-v1` | Five appraisal opinion/date/approach fields in `valuation`; never underwritten value or a selected opinion |

The exact allowlists and native units are in [RFC0129](rfcs/0129-document-fact-profiles.md)
and the [Format](../spec/UW_FORMAT_SPEC.md#attributable-source-fact-profiles-rfc0129).
The optional conformance claim is `document-facts`, distinct from the three
purpose ids. The [catalog](document-types.md) counts document families, not claims.
This is current repository source; older registry packages sharing a version
may not contain these APIs. No release or publication is implied.

## Run the synthetic examples

From a current source checkout:

```sh
npm ci
npm run build
node examples/document-facts/check.mjs
node scripts/run-conformance.mjs --profile=document-facts
```

[The example directory](../examples/document-facts/README.md) contains the three
original RFC transcriptions as logical JSON and UWX, complete Lite views, source
notes and an explicit synthetic projection target. The check script validates
and reports candidates; it changes no file or underwriting input.

## Validate attribution

```js
import { validateDocumentFacts } from '@uwmd/verify';
const sourceInventory = {
  source_ids: ['source:qa-quote'],
  conflicting_source_ids: [], // an explicit host declaration, not inferred truth
};
const errors = validateDocumentFacts('loan-quote-v1', quote, sourceInventory);
```

The payload has required identity, effective date, currency, governing ids and
facts. A non-null term states `{value, source_ref:{source,locator}}`. Null instead
states exactly `not_stated`, `ambiguous` or `not_reviewed`; a supplied locator
still resolves. Absence is outside coverage. No null means zero or no obligation.
Both the root and term envelopes are closed. A duplicate decoded JSON key must
be refused before a caller turns text into an object: use `parseDocumentFactsJSON`
or `parseDocumentFactsUWX` for raw input. An already collapsed JavaScript object
cannot reveal a key its caller erased.

The explicit inventory supplies immutable source/member identities. For a
package, `readDocumentFactsPackage(decoded, memberId, conflictingSourceIds)`
checks every byte digest, checks declared semantic digests, snapshots bytes
before asynchronous work and resolves governing members/history. A declared
semantic digest that cannot be checked refuses; it is never silently ignored.
Standalone inventory membership establishes attribution structure, not source
truth or identity authentication. Institution labels remain descriptive.

## Request candidates explicitly

```js
import { projectDocumentFacts } from '@uwmd/verify';
const result = projectDocumentFacts('loan-quote-v1', quote, parsedTarget, {
  source_inventory: sourceInventory,
  destinations: [{
    fact: 'debt_structure.loan_amount',
    deal_id: 'qa-document-facts-target',
    section: 'debt_structure',
    variant: 'senior',
    currency_code: 'USD',
  }],
});
```

The exact existing target block must resolve. Use an explicit `null` variant
only for an unkeyed singleton; no first-variant or senior fallback occurs.
Source, target and requested currencies must agree. Each candidate copies the
stated value and locator unchanged. The `record-facts-v1` report lists omissions,
conflicts, no-ops and source findings in canonical fact-key order. Existing
matching values are no-ops; differing values refuse. Invalid source structure
or attribution yields no edits and reported refusals. Candidate application is
a separate host action through normal provenance APIs. Neither input mutates.

Asking price never maps to purchase price. Quoted LTV/DSCR constraints never
map to computed sizing. Appraised value never maps to underwritten value.
No annualization, FX, netting, amortization or opinion selection happens.

## Preserve disagreements and history

Amendments and conflicting governing sources do not project automatically.
A reviewer can author a separately attributed resolution; source order grants
no legal precedence. A `supersedes` id retains the prior document and its source
history in the package through existing `supersedes` links. `abstracts` and
`contributes_to` retain their existing member meanings. The reference uses the
existing `source_note` member role for these descriptive abstracts; it adds no
new role or parallel edge registry.

## Binding scope

The public library, including browser exports, supports logical JSON/UWX
admission, explicit candidates, package integrity/history and a complete Lite
source view (`renderDocumentFactsLite`). That view shows every fact, null
status, source locator, finding and unmapped statement. It is not the Lite deal
summary. Compilation reports `LITE_COMPILE_DOCUMENT_PROFILE_UNSUPPORTED`.

CLI/MCP/HTTP **fact validation and projection bindings are unsupported**.
The connector and shared MCP validation helper refuse a known fact purpose;
generic Reader preservation/transport does not establish profile-operation
support. `DOCUMENT_FACTS_BINDINGS` exposes this scope. Existing underwriting CLI
commands and RFC0092 pro-forma bindings retain their own separate contracts.
