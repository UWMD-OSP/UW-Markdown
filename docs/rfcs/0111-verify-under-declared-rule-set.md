---
rfc: 0111
title: Verify each record under the rule set of the version it declares
status: draft
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - conformance-corpus
  - core-library
---

# RFC 0111: Verify each record under the rule set of the version it declares

> **Draft for owner acceptance.** Origin: owner ruling of 2026-10-21 on the
> release rules after launch, rule (1): "a record is always verified under the
> rule set of the version it declares, and every 5.x verifier keeps every
> earlier 5.x rule set; a fix applies to new records only." It binds every
> Verifier, so it is normative. It takes effect at the 5.0.0 launch; nothing
> changes for prelaunch 4.x, which has one rule set.

## Summary

After launch, the rules a verifier applies change over time: a metric formula is
corrected, a rounding procedure is pinned, a validation band moves. Today a
verifier applies only its own current rules, so the same record can pass under
one release and fail under the next with no change to the record. This RFC makes
the outcome a property of the record: the record's declared version selects a
**rule set**, every 5.x Verifier keeps every rule set issued in 5.x, and a fix
creates a new rule set instead of rewriting an old one.

## Motivation

- **A lender's verdict must not drift.** A record verified at closing must verify
  the same way at a later audit. If a later release changes a computed result,
  the old record would fail although nothing in it changed.
- **Fixes still have to ship.** Release rule (2) makes any result-changing fix a
  minor release. Without this RFC, that minor would silently change the verdict
  on every existing record.
- **The release rules already name the selector.** Release rule (5): each record
  keeps declaring its Format version, while people see "UWMD 5.x".

## Proposed change

1. **Rule set.** A rule set is everything normative that decides a verification
   outcome for a record: the Format's parse and validation rules (including the
   §5.2 bands and the registered validation codes), the Protocol's verification
   procedures (including §VIII.5 quantization and the pinned numerical
   procedures), the receipt rules and the metric dictionary
   (`spec/metrics/`). Starter-product code (packs, defaults, the editor, the
   Excel exporter) is not part of a rule set.
2. **Selector (D1).** A record's declared Format version (`uw_version`, Format
   §2.2) names its rule set. Any change to a rule set's outcome for some record
   (a result-changing fix, a new refusal, a moved band) issues a new Format minor
   version. VERSIONS.md maps every Format version to the UWMD release that issued
   it and the Protocol version it pairs with.
3. **Retention.** A Verifier that claims a UWMD 5.x release MUST verify a record
   declaring any Format version issued in 5.x up to that release, under that
   version's rule set. A declared version newer than the Verifier knows is
   refused with `UNSUPPORTED_FORMAT_VERSION`, as today. Prelaunch versions are
   not 5.x rule sets and need not be kept.
4. **Fixes apply forward.** A fix lands in a new rule set. An earlier rule set is
   never edited, except under D4.
5. **Reporting (D5).** A verification result and a receipt name the rule set
   applied.
6. **Conformance (D6).** Each conformance case names the Format version it was
   written for. A Verifier claiming a 5.x release passes the cases of every rule
   set it is required to keep.

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). The RFC adds an obligation
from 5.0.0: before it, there is one rule set, Format 3.0. Implementations must
then be able to carry more than one rule set; the reference implementation would
select the dictionary, bands and procedures by the declared version.

## Conformance impact

The corpus gains a rule-set key per case (D6), and the conformance runner runs a
Verifier against every rule set its claimed release must keep. No expected
output changes at adoption, since 5.0 starts with one rule set.

## Reference implementation

Not part of this draft. After acceptance: `@uwmd/verify` selects the rule set
from `uw_version`, the dictionary and band tables become per-rule-set data, the
receipt and verification result carry the applied rule set, and the conformance
runner keys cases by Format version.

## Alternatives considered

- **A separate declared rule-set field** (for example `uwmd_rules: "5.1"` in
  frontmatter, naming the UWMD release). Lets a verification fix ship without
  moving the Format version, at the cost of a second version every record
  declares. Release rule (5) says a record declares its Format version; this
  alternative would add another. Not proposed; see D1.
- **Select by the receipt's engine or Protocol version.** A record without a
  receipt would have no rule set, and engine versions are one implementation's
  history (Receipt spec, engine identity). Rejected.
- **Apply every fix to every record.** The current behavior. It makes verdicts
  drift, which the ruling exists to prevent. Rejected.

## Unresolved questions

- **Security and soundness fixes (D4).** "A fix applies to new records only"
  would let a forger declare an old version to reach a rule set with a known
  verification flaw (for example a signature malleability bug like #321/#322).
  This draft proposes that a fix which makes verification *stricter* to close a
  soundness or security flaw applies to every kept rule set, stated in the
  CHANGELOG and SECURITY advisory. That exception is the owner's call.
- **Format version churn.** Under D1 every result-changing fix moves the Format
  minor, so a monthly minor train may move the Format monthly. Readers already
  key on `uw_version`; the cost is the version count, not new parsing.

## Decisions proposed for owner review

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | What selects a record's rule set | The declared Format version; a rule-set change issues a Format minor | Release rule (5): a record declares its Format version. Alternative: a separate `uwmd_rules` field |
| D2 | What a rule set contains | Format rules, §5.2 bands and codes, Protocol verification procedures, receipt rules, the metric dictionary | Everything normative that decides an outcome; starter products excluded (RFC 0078) |
| D3 | Which rule sets a Verifier keeps | Every Format version issued in 5.x up to its claimed release; none prelaunch | The ruling ("every earlier 5.x rule set"); the owner rule's zero prelaunch retention |
| D4 | Security and soundness fixes | Apply to every kept rule set when they make verification stricter | Otherwise an old declaration reaches a known flaw. Alternative: no exception |
| D5 | Reporting | Verification results and receipts name the applied rule set | A verdict is only reproducible if its rule set is known |
| D6 | Conformance | Cases keyed by Format version; a Verifier passes every kept rule set's cases | Proves retention rather than claiming it |
| D7 | Versions | None allocated; effective at 5.0.0 | Owner rule: 5.0.0 needs separate approval |

## Prior art

- Release rules after launch (`docs/playbooks/RELEASE_RULES.md`), rules (1),
  (2) and (5).
- RFC 0081 (one Format version admitted, `UNSUPPORTED_FORMAT_VERSION`).
- RFC 0088 (pinned numerical procedures, which a rule set includes).
- Receipt spec, engine identity and `RCP-07` `unverifiable`.
