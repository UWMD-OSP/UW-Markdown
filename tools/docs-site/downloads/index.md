---
title: Downloads
description: Blank UW Markdown templates, programs, examples, and AI instruction files.
---

# Downloads

Start with a plain-text file. No account, connector, or special editor is required.

## Blank templates

- [Blank screener template (`.uw.md`)](/downloads/templates/blank-screener.uw.md)
  — a lightweight first-pass underwriting file.
- [Blank analyst template (`.uw.md`)](/downloads/templates/blank-analyst.uw.md)
  — the same open structure marked for full underwriting.

Both templates default to multifamily. Change `asset_class` to `office`,
`retail`, `industrial`, or `self_storage` when appropriate. The CLI can also
create a file with its identifying information filled in:

```bash
npx uwmd init my-deal.uw.md --asset-class office --tier analyst
```

## Programs

- [Download the browser viewer (`.html`)](/downloads/programs/uwmd-viewer.html)
  — save it, open it in a browser, and drop a `.uw.md` file onto the page.
- [Download all source code (`.zip`)](https://github.com/jaredmaxey/uw-markdown/archive/refs/heads/main.zip)
  — includes the CLI, core library, Excel exporter, report renderer, web tools,
  VS Code extension, schemas, and tests.
- [GitHub releases](https://github.com/jaredmaxey/uw-markdown/releases) — packaged
  release assets appear here as they are published.
- [Browse the programs on GitHub](https://github.com/jaredmaxey/uw-markdown#repository-layout)
  — use this while the first public npm and extension packages are being published.

## Example deals

- [Multifamily](https://raw.githubusercontent.com/jaredmaxey/uw-markdown/main/examples/Parkview-Apts-Glendale-AZ.uw.md)
- [Office](https://raw.githubusercontent.com/jaredmaxey/uw-markdown/main/examples/Riverside-Office-Phoenix-AZ.uw.md)
- [Retail](https://raw.githubusercontent.com/jaredmaxey/uw-markdown/main/examples/Cactus-Crossing-Retail-Mesa-AZ.uw.md)
- [Industrial](https://raw.githubusercontent.com/jaredmaxey/uw-markdown/main/examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uw.md)
- [Self-storage](https://raw.githubusercontent.com/jaredmaxey/uw-markdown/main/examples/Sonoran-Self-Storage-Peoria-AZ.uw.md)

## AI instruction files

Add the relevant file to an AI project or paste its contents into the platform's
project instructions.

- [Codex / agent skill (`SKILL.md`)](/downloads/ai/uwmd-skill/SKILL.md)
- [Claude project instructions (`CLAUDE.md`)](/downloads/ai/CLAUDE.md)
- [ChatGPT project instructions (`.txt`)](/downloads/ai/chatgpt-project-instructions.txt)
- [Gemini project instructions (`GEMINI.md`)](/downloads/ai/GEMINI.md)
- [Platform-neutral AI guide (`.md`)](/downloads/ai/UWMD-AI-GUIDE.md)

For automated discovery, use [`llms.txt`](/llms.txt), the expanded
[`llms-full.txt`](/llms-full.txt), or the [AI information page](/ai/).
