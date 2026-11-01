---
title: "Quickstart"
description: Take one synthetic UWX record through summary, validation, receipt verification and conversion with a pinned published CLI.
---

# Quickstart

Use one synthetic record from download to conversion. You need
[Node.js](https://nodejs.org/) 20 or later and an empty working folder. No account
or repository clone is required.

This walkthrough is tested with **published `@uwmd/cli@4.3.0`**, whose npm source
revision is `80c68c3d0950948c85a1d3a90c02cd05f3a650a4`. The teaching record is
pinned to fixture revision `05929d21a8020c488ffa55385ce0dac5f10df183`. Every command
below uses that CLI version and the same `quickstart.uwx.md` file. CI downloads
the pinned bytes and executes this walkthrough with both the published CLI and
the current source CLI.

## 1. Download the synthetic record

The record describes ten invented units at $1,000 monthly rent, a stated annual
vacancy allowance of $6,000 and $40,000 of annual operating expenses. Existing
deterministic helpers and the multifamily pack produce its totals and metrics.
It contains no real property, borrower or transaction.

<!-- quickstart:start -->

```bash
node --input-type=module -e "import { writeFile } from 'node:fs/promises'; const r = await fetch('https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/05929d21a8020c488ffa55385ce0dac5f10df183/docs/downloads/tutorials/quickstart.uwx.md'); if (!r.ok) throw new Error('HTTP ' + r.status); await writeFile('quickstart.uwx.md', await r.text());"
```

You can also [download those exact fixture bytes](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/05929d21a8020c488ffa55385ce0dac5f10df183/docs/downloads/tutorials/quickstart.uwx.md).
Keep this file as the record throughout the walkthrough.

## 2. Read its summary

```bash
npx --yes @uwmd/cli@4.3.0 summary quickstart.uwx.md
```

The summary includes a $1,000,000 purchase price, $600,000 loan, $74,000 NOI,
1.85x DSCR and 60.00% LTV. The record explicitly declares purchase-price LTV.
Open the same downloaded file in the [viewer](/viewer/) or
[editor](/editor/){target="_self"} to inspect its sections.

## 3. Validate it

```bash
npx --yes @uwmd/cli@4.3.0 validate quickstart.uwx.md
```

**Exit 0 means no validation errors under the selected policy.** Check warnings,
stage requirements and computation coverage separately before treating the
record as complete or investment-ready. See [validation policy](/starter/cli)
and [deal stages](/spec/format).
A clean structural result does not establish that skipped cross-checks agree.
Current source also reports the deliberately absent validation section as a
stage-gap info note. The tutorial does not claim full underwriting completeness.

## 4. Issue and verify a receipt

```bash
npx --yes @uwmd/cli@4.3.0 receipt issue quickstart.uwx.md
npx --yes @uwmd/cli@4.3.0 receipt verify quickstart.uwx.md quickstart.receipt.json
```

Issuance reports **Computed: 8/8**, **Uncomputed: none**. Verification reports
**VERIFIED**, exit `0`. Other receipt-verification exits are `1` for failed and
`3` for unverifiable. Inspect coverage as well as the verdict: matching
uncomputed statuses can verify in other records.

A [receipt](/guide/receipts) checks the committed record and its covered result
values and statuses. It does not establish that the inputs are true or complete.
Editing the record after issuance makes that receipt stale; a later comparison
fails with `RCP-01` because its committed content changed.

## 5. Convert the same record

```bash
npx --yes @uwmd/cli@4.3.0 convert quickstart.uwx.md --to uw-json
npx --yes @uwmd/cli@4.3.0 convert quickstart.uwx.md --to lite --projection-report lite-omissions.json
```

This creates `quickstart.uw.json` and the smaller `quickstart.uw.md` Lite summary.
The teaching record has schema-admitted metadata and no abbreviated hash
placeholders, so both conversions use the same record as the preceding steps.

Lite export warns about omitted advanced paths. Read `lite-omissions.json`,
and keep `quickstart.uwx.md` as the full record. JSON is a full-model encoding;
Lite is a smaller summary profile. See [Lite and UWX](/guide/lite-and-uwx).

```bash
npx --yes @uwmd/cli@4.3.0 formats
```

<!-- quickstart:end -->

Other conversion targets include `uw-xml` and `uw-csv-bundle`.

## Deliberate incomplete-data exercise

Start a separate blank record to explore missing inputs:

```bash
npx --yes @uwmd/cli@4.3.0 init --name "Synthetic incomplete exercise" --output incomplete.uwx.md
npx --yes @uwmd/cli@4.3.0 validate incomplete.uwx.md
```

The scaffold is intentionally incomplete. Compare its warnings, stage gaps and
receipt coverage with the teaching record. Exit `0` alone is not a completeness
claim. The larger [Parkview illustration](/viewer/) is another
reading example; it is separate from this reproducible walkthrough.

## Install instead of using `npx`

```bash
npm install --save-dev --save-exact @uwmd/cli@4.3.0
```

A project install also offers `npx uwmd`; a global install of that exact version
offers `uwmd`. Keep the fixture revision and CLI version together when sharing
this exercise. For programmatic work, see [tools and packages](/guide/tools).

## Next

- [Your first record, by hand](/tutorials/your-first-uwmd-file): build a small record line by line.
- [Building with AI](/ai/): instruction files and the deterministic calculation boundary.
- [Format](/spec/format), [protocol](/spec/protocol) and [metric dictionary](/spec/metrics/): the normative contracts behind the starter tools.
