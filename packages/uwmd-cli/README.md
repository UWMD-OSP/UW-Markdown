# `uwmd` — UW Markdown CLI

The standalone command-line installer for [UW Markdown](https://github.com/UWMD-OSP/UW-Markdown) — an open standard for commercial real-estate underwriting documents.

This package is a thin wrapper around [`@uwmd/core`](https://www.npmjs.com/package/@uwmd/core) so that anyone can use the tooling without cloning the monorepo.

## Install

No install needed — run via `npx`:

```bash
npx @uwmd/cli <command> [args]
```

Or install globally:

```bash
npm install -g @uwmd/cli
uwmd <command> [args]
```

## Commands

| Command | What it does |
|---|---|
| `uwmd init <file>` | Scaffold a blank `.uwx.md` deal file |
| `uwmd parse <file>` | Parse and emit canonical JSON |
| `uwmd validate <file>` | Run the full Tier-1 validator and print issues |
| `uwmd render <file>` | Render to `chat`, `summary`, or full markdown |
| `uwmd edit <file> <op.json>` | Apply a Tier-2 `EditOperation` and write back |
| `uwmd calc <file> <calc.json>` | Evaluate a Tier-3 calc declaration |
| `uwmd run <file>` | Invoke UWMD optional Claude-backed Bancroft reference agent suite |
| `uwmd compact <file>` | Strip narrative; emit the canonical JSON-only form |
| `uwmd diff <a> <b>` | Diff two `.uw.md` files at the section level |
| `uwmd summary <file>` | One-screen deal summary |
| `uwmd export <file.uw.md>` | Write a digested, model-lossless `.uw.json` sibling |
| `uwmd formats` | List registered machine representations |
| `uwmd convert <file> --to uw-json\|uw-xml\|uw-csv-bundle` | Convert Markdown, verified JSON/XML, or normalized CSV ZIP bundles |
| `uwmd layers <file>` | Show the agent-context layer breakdown |

Run any command without arguments for usage help.

## Calculation context files (source implementation)

The source checkout adds `--calc-context <JSON file>` to `calc` and `refine`.
This flag is not included in the published 2.7.0 package. After building the
checkout, run from the repository root:

```sh
npm run cli -- calc deal.uwx.md "dcf.annual_cash_flows@Y3.noi" --calc-context context.json --json
npm run cli -- refine deal.uwx.md --targets year_three_noi_per_unit --calc-context context.json --json
```

`year_three_noi_per_unit` must be a calculation declared in the deal. A context
file can contain `{"sectionVariants":{"dcf":"base"},"overrides":{}}`.
Variants select period references only. Overrides use exact paths and JSON
scalars, preserving zero and null. `calc` supports ordinary and period overrides;
`refine` rejects ordinary scalar overrides and requires canonical period keys.
Inspect refinement's `diagnostics.period_inputs` for excluded outputs.

See the [complete source guide](../../docs/CALCULATION_CONTEXT.md)
for context validation, missing inputs, Excel export and library usage.

## Library use

If you're writing TypeScript / JavaScript and need programmatic access to the parser, validator, renderer, or calc engine, depend on [`@uwmd/core`](https://www.npmjs.com/package/@uwmd/core) directly:

```bash
npm install @uwmd/core
```

```js
import { parseUWFile, validateUWFile, evaluateCalc } from '@uwmd/core';
```

## Conformance

This CLI is the reference implementation of the UW Markdown protocol's Tier-1 (Reader), Tier-2 (Editor), Tier-3 (Calc Host), and Tier-4 (Agent Host) conformance levels. See the [protocol spec](https://github.com/UWMD-OSP/UW-Markdown/blob/main/spec/UW_PROTOCOL_v1.md) for what each tier guarantees.

## License

[MIT](https://github.com/UWMD-OSP/UW-Markdown/blob/main/LICENSE) © UW Markdown contributors.
