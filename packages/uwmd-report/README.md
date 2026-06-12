# @uwmd/report

PDF pipeline for the `.uw.md` **lender package** (spec §7.1) and **credit memo**
(spec §7.2). The HTML itself is rendered deterministically by `@uwmd/core`'s
`renderReportHtml` — this package only adds the headless-Chromium print step.

```bash
uwmd-report deal.uw.md                       # → deal.pdf (tier from frontmatter)
uwmd-report deal.uw.md --tier screener       # lender package
uwmd-report deal.uw.md --tier analyst        # credit memo
uwmd-report deal.uw.md --format html         # browser-free HTML output
```

## Browser resolution

`playwright-core` is used **without** a bundled browser download. At runtime the
pipeline tries, in order:

1. `--browser <path>` or the `UWMD_REPORT_BROWSER` env var
2. system **Chrome**
3. system **Edge** (always present on Windows 10/11)
4. a Playwright-managed Chromium (if you ran `npx playwright install chromium`)

If none is found you get a `BrowserNotFoundError` with instructions —
`--format html` always works without a browser (print it from any browser for
an identical PDF; the print stylesheet is embedded).

## Library use

```ts
import { parseUWFile } from '@uwmd/core';
import { generateReport } from '@uwmd/report';

const parsed = parseUWFile(source);
const { bytes, report } = await generateReport(parsed, { tier: 'analyst' });
// bytes = PDF; report.sectionsRendered / sectionsSkipped tell you what's in it
```

All financial numbers in the report are read from the file (calc-engine
outputs); nothing is recomputed at render time.
