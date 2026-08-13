---
title: Downloads
description: Blank UW Markdown templates, programs, examples, and AI instruction files.
---

# Downloads

Start with the canonical underwriting record. No account, connector, or preferred editor is required: compatible agents, services, systems, editors, and viewers can all load it.

## Choose a format

Start with [UW Lite and UWX](/guide/lite-and-uwx): `.uw.md` Lite is a lean, readable summary; `.uwx.md` is the complete structured underwriting record. The reference editor opens either one and makes lossy UWX-to-Lite exports explicit.

## Blank templates

- <a href="/downloads/templates/blank-screener.uw.md" download="blank-screener.uw.md">Download the blank screener template (<code>.uw.md</code>)</a>
  — a lightweight first-pass underwriting file.
- <a href="/downloads/templates/blank-analyst.uw.md" download="blank-analyst.uw.md">Download the blank analyst template (<code>.uw.md</code>)</a>
  — the same open structure marked for full underwriting.

Both templates default to multifamily. Change `asset_class` to `office`,
`retail`, `industrial`, or `self_storage` when appropriate. The CLI can also
create a file with its identifying information filled in:

```bash
npx uwmd init my-deal.uw.md --asset-class office --tier analyst
```

## Programs

- <a href="/downloads/programs/uwmd-viewer.html" download="uwmd-viewer.html">Download the browser viewer (<code>.html</code>)</a>
  — save it, open it in a browser, and drop a `.uw.md` file onto the page.
- [Download all source code (`.zip`)](https://github.com/UWMD-OSP/UW-Markdown/archive/refs/heads/main.zip)
  — includes the CLI, core library, Excel exporter, report renderer, web tools,
  VS Code extension, schemas, and tests.
- [GitHub releases](https://github.com/UWMD-OSP/UW-Markdown/releases) — packaged
  release assets appear here as they are published.
- [Browse the programs on GitHub](https://github.com/UWMD-OSP/UW-Markdown#repository-layout)
  — use this while the first public npm and extension packages are being published.

## Example deals

- [Multifamily](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Parkview-Apts-Glendale-AZ.uwx.md)
- [Office](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Riverside-Office-Phoenix-AZ.uwx.md)
- [Retail](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Cactus-Crossing-Retail-Mesa-AZ.uwx.md)
- [Industrial](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md)
- [Self-storage](https://raw.githubusercontent.com/UWMD-OSP/UW-Markdown/main/examples/Sonoran-Self-Storage-Peoria-AZ.uwx.md)

## AI instruction files

Add the relevant file to an AI project or paste its contents into the platform's
project instructions.

- <a href="/downloads/ai/uwmd-skill/SKILL.md" download="SKILL.md">Codex / agent skill (<code>SKILL.md</code>)</a>
- <a href="/downloads/ai/CLAUDE.md" download="CLAUDE.md">Claude project instructions (<code>CLAUDE.md</code>)</a>
- <a href="/downloads/ai/chatgpt-project-instructions.txt" download="chatgpt-project-instructions.txt">ChatGPT project instructions (<code>.txt</code>)</a>
- <a href="/downloads/ai/GEMINI.md" download="GEMINI.md">Gemini project instructions (<code>GEMINI.md</code>)</a>
- <a href="/downloads/ai/UWMD-AI-GUIDE.md" download="UWMD-AI-GUIDE.md">Platform-neutral AI guide (<code>.md</code>)</a>

For automated discovery, use [`llms.txt`](/llms.txt), the expanded
[`llms-full.txt`](/llms-full.txt), or the [AI information page](/ai/).
