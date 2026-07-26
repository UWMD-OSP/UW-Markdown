# `uwmd` — UW Markdown CLI

The standalone command-line installer for [UW Markdown](https://github.com/jaredmaxey/uw-markdown) — an open standard for commercial real-estate underwriting documents.

This package is a thin wrapper around [`@uwmd/core`](https://www.npmjs.com/package/@uwmd/core) so that anyone can use the tooling without cloning the monorepo.

## Install

No install needed — run via `npx`:

```bash
npx uwmd <command> [args]
```

Or install globally:

```bash
npm install -g uwmd
uwmd <command> [args]
```

## Commands

| Command | What it does |
|---|---|
| `uwmd init <file>` | Scaffold a blank `.uw.md` deal file |
| `uwmd parse <file>` | Parse and emit canonical JSON |
| `uwmd validate <file>` | Run the full Tier-1 validator and print issues |
| `uwmd render <file>` | Render to `chat`, `summary`, or full markdown |
| `uwmd edit <file> <op.json>` | Apply a Tier-2 `EditOperation` and write back |
| `uwmd calc <file> <calc.json>` | Evaluate a Tier-3 calc declaration |
| `uwmd run <file>` | Invoke the Tier-4 Bancroft agent host |
| `uwmd compact <file>` | Strip narrative; emit the canonical JSON-only form |
| `uwmd diff <a> <b>` | Diff two `.uw.md` files at the section level |
| `uwmd summary <file>` | One-screen deal summary |
| `uwmd layers <file>` | Show the agent-context layer breakdown |

Run any command without arguments for usage help.

## Library use

If you're writing TypeScript / JavaScript and need programmatic access to the parser, validator, renderer, or calc engine, depend on [`@uwmd/core`](https://www.npmjs.com/package/@uwmd/core) directly:

```bash
npm install @uwmd/core
```

```js
import { parseUWFile, validateUWFile, evaluateCalc } from '@uwmd/core';
```

## Conformance

This CLI is the reference implementation of the UW Markdown protocol's Tier-1 (Reader), Tier-2 (Editor), Tier-3 (Calc Host), and Tier-4 (Agent Host) conformance levels. See the [protocol spec](https://github.com/jaredmaxey/uw-markdown/blob/main/spec/UW_PROTOCOL_v1.md) for what each tier guarantees.

## License

[MIT](https://github.com/jaredmaxey/uw-markdown/blob/main/LICENSE) © UW Markdown contributors.
