# Verification receipts

A **verification receipt** is a small JSON file that sits beside a deal and lets
someone who did not run the numbers confirm, offline, that those numbers follow
from that record.

It answers exactly one question: *do these outputs follow from these inputs?*

It does **not** answer: *are these inputs true?*

That distinction is the whole point, so it is worth stating plainly before
anything else.

## What a receipt does and does not tell you

A receipt that verifies tells you two things:

1. The deal's financial content is **unchanged** since the receipt was issued.
2. The stated metrics — DSCR, LTV, cap rate, and the rest — **follow
   deterministically** from that content under a named calculation pack.

It tells you **nothing** about whether the inputs are true, complete, sourced
from genuine documents, or reasonable. A deal asserting a fabricated NOI can
carry a perfectly valid receipt. The arithmetic on a lie is still arithmetic.

So a receipt replaces this conversation:

> "Where did this 1.28x DSCR come from?"
> "Our model."
> "Can I see the model?"

with this one:

> "Where did this 1.28x DSCR come from?"
> "This record, under the multifamily pack v1.0.0. Here's the receipt — check it
> yourself."

What still needs human diligence is unchanged: whether the rent roll is real,
whether the T-12 was doctored, whether the exit cap is defensible. A receipt
moves *arithmetic* out of the trust budget so more of that budget is left for
the questions that actually require judgment.

## Why this is possible

UW Markdown has a rule that AI never does financial math. Extraction and
narrative are model work; every NOI, DSCR, LTV, and IRR is computed
deterministically by a calculation pack, with parity to six decimals against the
Excel export.

That determinism is what makes a receipt meaningful. The same pack over the same
canonical inputs produces the same outputs on any conforming implementation — so
a third party can recompute and compare rather than take your word for it.

## Issuing one

```bash
uwmd receipt issue deal.uwx.md
```

That writes `deal.receipt.json` beside the deal. The receipt is **detached** — it
is never embedded in the record. Embedding would change the record's own digest,
and it would make it impossible for an auditor to attest to a file they must not
modify.

In the [reference editor](https://www.uwmd.org/editor/), the **Receipt** tab does
the same thing in the browser. Nothing is uploaded: issuance and verification run
entirely client-side.

Issuance either produces a complete receipt or refuses with a reason. It will not
emit a partial or hedged one. It refuses when the document has parse errors, when
the asset class has no registered pack, or when the pack cannot evaluate.

## Verifying one

```bash
uwmd receipt verify deal.uwx.md deal.receipt.json
```

The editor's **Receipt** tab and the VS Code extension's **Verify Receipt for
This Deal** command do the same check. The extension only verifies — issuing
while you are still editing produces a receipt that is stale on the next
keystroke.

Verification always recomputes. It never trusts the digest recorded inside the
receipt as a shortcut.

## Three answers, not two

Verification reports one of three states, and deliberately never collapses the
third into either of the others.

| Verdict | Exit code | Meaning |
|---|---|---|
| **verified** | 0 | The record is unchanged and every stated result recomputes. |
| **failed** | 1 | The digest, a result, or the signature disagrees. |
| **unverifiable** | 3 | This verifier *cannot decide*. |

`unverifiable` is the one people are most likely to get wrong, so it has its own
exit code. You get it when the verifier lacks the named calculation pack, holds a
different version of it, cannot parse the record, or encounters a signature it
has no key for.

**Unverifiable is not a failure.** It is the absence of evidence, not evidence of
absence. Reporting it as a failure would cry wolf every time a verifier is
missing a pack, and users who see false alarms learn to ignore real ones.
Reporting it as success would be straightforwardly dangerous.

If you are scripting a gate, treat exit 1 as a stop and exit 3 as "get a verifier
that has the pack" — not as a pass and not as a rejection.

## Receipts go stale, and that is normal

A receipt describes one exact version of a deal. Edit the deal and the receipt no
longer applies — its digest was computed over the old content.

That is expected, not alarming. The reference editor distinguishes the two cases
so an ordinary edit never looks like tampering: a receipt you issued yourself,
against a deal you have since edited, shows as **stale** with a prompt to
re-issue. A mismatch on a receipt that arrived from somewhere else shows as
**failed**, because there you genuinely do not know why the content differs.

Issue the receipt when you are finished editing, and send it with the file.

## What is inside

Abridged from the conformance corpus — the values are real, the results list is
trimmed to two of the pack's eight outputs:

```json
{
  "receipt_version": "1.0",
  "subject": {
    "representation": "uwx-markdown",
    "canonicalization": "uw-envelope-semantic",
    "digest": "sha256:caa73f0e1dc38cf536149ff5dbdfbd72e21fad6263f6574adeea99f8803822f2"
  },
  "computation": {
    "pack": "org.uwmd.pack.multifamily",
    "pack_version": "1.0.0",
    "engine": "@uwmd/core",
    "engine_version": "1.1.2",
    "results": [
      { "calc_id": "dscr", "value": 1.2637362637362637, "unit": "x", "computed": true },
      { "calc_id": "ltv", "value": 0.65, "unit": "%", "computed": true }
    ]
  },
  "policy": { "policy_set": "builtin", "validation": { "errors": 0, "warnings": 5 } },
  "issued_at": "2026-08-09T00:00:00Z",
  "issuer": "conformance",
  "signature": null
}
```

Three details worth understanding:

**The digest covers meaning, not bytes.** It is computed over a canonical form of
the deal's financial content, so reflowing a label, changing comma grouping, or
switching line endings does not break a receipt. Changing a number does.

**`computed: false` is not the same as a value of zero or null.** A pack declares
a fixed set of outputs, and the receipt lists all of them. When the deal lacks
the inputs for one, it is recorded as `{"value": null, "computed": false}` rather
than as a number nobody calculated — the deal above supports all eight of its
pack's outputs, but a leaner record often will not. A receipt never carries a
hand-entered figure.

**Validation counts are recorded, not enforced.** A receipt notes how many errors
and warnings the policy set found at issuance. A deal that trips a DSCR threshold
can still carry a valid receipt — the receipt attests the arithmetic, and the
warning is part of what it attests, not a reason to withhold it.

## Signing

Receipts have a `signature` field, and it is currently always `null`.

Unsigned receipts already do the useful work: anyone can recompute and compare.
Signing adds *who issued this*, which requires key distribution and is specified
separately. Until a signing implementation exists, a verifier that meets a signed
receipt reports `unverifiable` rather than quietly ignoring the signature — which
is precisely the situation that third state exists for.

## Reading further

- [Verification receipt specification (v1.0)](../spec/UW_RECEIPT_v1.md) — the
  normative document: canonicalizations, issue codes, verifier precedence.
- [RFC 0016](rfcs/0016-verification-receipts.md) — the design rationale and the
  alternatives that were rejected.
- [UW Lite and UWX](UW_LITE_AND_UWX.md) — receipts work over both representations.
