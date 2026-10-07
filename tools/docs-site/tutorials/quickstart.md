---
title: "Quickstart"
description: Create, validate, verify, and convert a UWX underwriting record with the published UW Markdown CLI.
---

# Quickstart

This page takes you from nothing to a validated `.uwx.md` record, then shows a
complete deal being recomputed and verified. You need
[Node.js](https://nodejs.org/) 18 or later. You don't need to clone anything or
create an account.

Every command below uses the published [`@uwmd/cli`](https://www.npmjs.com/package/@uwmd/cli)
package through `npx`.

## 1. Create a record

```bash
npx @uwmd/cli init --output deal.uwx.md
```

This writes a Format 2.0 UWX record with every standard section stubbed out:
property, rent roll, operating statement, debt structure, valuation, and the
rest. Pass the file name with `--output`. Without it the file is named
`new-deal.uwx.md`.

Useful options:

| Option | Effect |
|---|---|
| `--asset-class office` | Start from another asset class (default `multifamily`) |
| `--tier analyst` | Mark the record for full underwriting rather than screening |
| `--name "Parkview Apartments"` | Fill in the deal name |

## 2. Validate it

```bash
npx @uwmd/cli validate deal.uwx.md
```

You'll get a stage-readiness checklist and a list of issues. A fresh record
passes with one warning:

```text
Issues (1):
  [WARN]  [property.total_units] CC-13: the property section does not state
          multifamily's primary size field "total_units" (Protocol §XIII.1)
```

Warnings and info notes leave the exit code at `0`. Any error exits `1`, so the
same command works as a CI gate. Each code links to a remediation in the
[validator code taxonomy](/spec/protocol#iii-6a-validator-code-taxonomy).

## 3. Open a complete deal

Download the multifamily example,
[`Parkview-Apts-Glendale-AZ.uwx.md`](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Parkview-Apts-Glendale-AZ.uwx.md),
into the same folder, then print its summary:

```bash
npx @uwmd/cli summary Parkview-Apts-Glendale-AZ.uwx.md
```

```text
  Parkview Apartments — Glendale, AZ
  multifamily · full_underwrite
  Purchase Price:   $7,200,000
  UW NOI:           $396,635
  DSCR:             1.109x
  LTV:              70.00%
  Debt Yield:       7.87%
```

To look through the rent roll, operating statement, and narrative without a
terminal, open the same file in the [viewer](/viewer/) or the
[reference editor](https://www.uwmd.org/editor/?sample=/viewer/samples/Parkview-Apts-Glendale-AZ.uwx.md){target="_self"}.

## 4. Verify the arithmetic

A [verification receipt](/guide/receipts) lets someone who did not build the
model check that its numbers follow from the record.

```bash
npx @uwmd/cli receipt issue Parkview-Apts-Glendale-AZ.uwx.md
npx @uwmd/cli receipt verify Parkview-Apts-Glendale-AZ.uwx.md Parkview-Apts-Glendale-AZ.receipt.json
```

```text
Receipt issued for Parkview-Apts-Glendale-AZ.uwx.md → Parkview-Apts-Glendale-AZ.receipt.json (org.uwmd.pack.multifamily@…)
Metric completeness: complete
Computed: 8/8
Uncomputed: none
…
A receipt attests that these outputs follow from this record. It does not attest that the inputs are true.

Receipt verification verdict: VERIFIED
```

The multifamily calculation pack recomputed all eight metrics from the record's
inputs and matched them. If you change an input after issuing, verification
fails with `RCP-01`: the record's financial content no longer matches the receipt.
`receipt verify` exits `0` for verified, `1` for failed, and `3` for
unverifiable.

A receipt says nothing about whether the rent roll or T-12 is accurate. It
covers the arithmetic only. Receipts are issued when you ask for one; editing a
record never creates one automatically.

## 5. Convert it

The same record converts to the machine representations and to a compact
[UW Lite](/guide/lite-and-uwx) summary:

```bash
npx @uwmd/cli convert Parkview-Apts-Glendale-AZ.uwx.md --to uw-json
npx @uwmd/cli convert Parkview-Apts-Glendale-AZ.uwx.md --to lite --projection-report lite-omissions.json
```

The Lite conversion warns that it omitted advanced paths. That is deliberate:
UW Lite is a smaller summary profile, and `lite-omissions.json` lists every
path it left out. Keep the `.uwx.md` file as the complete record. Other targets
are `uw-xml` and `uw-csv-bundle`. Run `npx @uwmd/cli formats` to list them.

## Install instead of `npx`

```bash
npm install --save-dev @uwmd/cli
```

After a local install, the command is `npx uwmd <command>`. With a global install
(`npm install -g @uwmd/cli`) it is `uwmd <command>`. Run it with no arguments for
the full command list.

To work with records from code, install the library:

```bash
npm install @uwmd/core
```

```js
import { readFileSync } from 'node:fs';
import { parseUWFile, validateUWFile } from '@uwmd/core';

const deal = parseUWFile(readFileSync('Parkview-Apts-Glendale-AZ.uwx.md', 'utf8'));
const result = validateUWFile(deal);

console.log(deal.frontmatter.deal_name);   // Parkview Apartments — Glendale, AZ
console.log(result.overall_status);        // "warnings"
for (const issue of result.issues) console.log(issue.severity, issue.code, issue.message);
```

## Next

- [Your first record, by hand](/tutorials/your-first-uwmd-file): build a small
  record line by line to see what each piece is for.
- [Tools and packages](/guide/tools): the CLI command catalog, the library,
  batch indexing, Excel export, and editors.
- [Building with AI](/ai/): instruction files and the rules an agent must follow.
- [Format specification](/spec/format-v2) and [protocol](/spec/protocol): the
  normative contract.
