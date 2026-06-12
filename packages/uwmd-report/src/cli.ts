// uwmd-report CLI — render a .uw.md file to a lender package / credit memo.
//
// Usage:
//   uwmd-report <input.uw.md> [-o output.pdf] [--tier screener|analyst]
//                             [--format pdf|html] [--prepared-by <name>]
//
// Defaults output to <input>.pdf (or .html) alongside the input file. Errors
// go to stderr with a non-zero exit code; success prints the output path.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { parseUWFile } from '@uwmd/core';
import type { RenderTier } from '@uwmd/core';
import { generateReport, BrowserNotFoundError } from './index.js';

interface ParsedArgs {
  input: string;
  output: string;
  tier?: RenderTier;
  format: 'pdf' | 'html';
  preparedBy?: string;
  executablePath?: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
  let input: string | undefined;
  let output: string | undefined;
  let tier: RenderTier | undefined;
  let format: 'pdf' | 'html' = 'pdf';
  let preparedBy: string | undefined;
  let executablePath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--output') {
      output = argv[++i];
      if (!output) return { error: `${a} requires a path` };
    } else if (a === '--tier') {
      const t = argv[++i];
      if (t !== 'screener' && t !== 'analyst') return { error: '--tier must be screener or analyst' };
      tier = t;
    } else if (a === '--format') {
      const f = argv[++i];
      if (f !== 'pdf' && f !== 'html') return { error: '--format must be pdf or html' };
      format = f;
    } else if (a === '--prepared-by') {
      preparedBy = argv[++i];
      if (!preparedBy) return { error: '--prepared-by requires a name' };
    } else if (a === '--browser') {
      executablePath = argv[++i];
      if (!executablePath) return { error: '--browser requires an executable path' };
    } else if (a === '-h' || a === '--help') {
      return { error: 'help' };
    } else if (a && !a.startsWith('-')) {
      if (input) return { error: `unexpected argument: ${a}` };
      input = a;
    } else {
      return { error: `unknown flag: ${a}` };
    }
  }
  if (!input) return { error: 'missing input file' };

  const inputAbs = resolve(input);
  const outputAbs = output
    ? resolve(output)
    : join(dirname(inputAbs), defaultOutputName(inputAbs, format));
  return { input: inputAbs, output: outputAbs, tier, format, preparedBy, executablePath };
}

export function defaultOutputName(inputPath: string, format: 'pdf' | 'html'): string {
  const base = basename(inputPath);
  const stripped = base.endsWith('.uw.md')
    ? base.slice(0, -'.uw.md'.length)
    : base.slice(0, -extname(base).length);
  return `${stripped}.${format === 'html' ? 'report.html' : 'pdf'}`;
}

function printHelp(): void {
  process.stdout.write(
    [
      'uwmd-report — render a .uw.md file to a lender package / credit memo',
      '',
      'Usage:',
      '  uwmd-report <input.uw.md> [-o output.pdf]',
      '',
      'Options:',
      '  -o, --output <path>     Output path (defaults next to input)',
      '  --tier <t>              screener (lender package) | analyst (credit memo);',
      '                          defaults to the file frontmatter tier',
      '  --format <f>            pdf (default) | html (no browser required)',
      '  --prepared-by <name>    Cover-page preparer line',
      '  --browser <path>        Chromium executable (or set UWMD_REPORT_BROWSER);',
      '                          otherwise system Chrome/Edge is used',
      '  -h, --help              Show this help',
      '',
    ].join('\n'),
  );
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if ('error' in args) {
    if (args.error === 'help') {
      printHelp();
      return 0;
    }
    process.stderr.write(`uwmd-report: ${args.error}\n`);
    printHelp();
    return 2;
  }

  const raw = await readFile(args.input, 'utf8');
  const parsed = parseUWFile(raw);

  try {
    const result = await generateReport(parsed, {
      format: args.format,
      tier: args.tier,
      preparedBy: args.preparedBy,
      pdf: args.executablePath ? { executablePath: args.executablePath } : undefined,
    });
    await writeFile(args.output, result.bytes);
    const label = result.report.tier === 'analyst' ? 'credit memo' : 'lender package';
    process.stdout.write(`${args.output}\n`);
    process.stderr.write(
      `Rendered ${label} (${result.report.sectionsRendered.length} sections` +
        `${result.report.sectionsSkipped.length ? `, skipped: ${result.report.sectionsSkipped.join(', ')}` : ''})\n`,
    );
    return 0;
  } catch (err) {
    if (err instanceof BrowserNotFoundError) {
      process.stderr.write(`uwmd-report: ${err.message}\n`);
      process.stderr.write('Tip: use --format html for browser-free output.\n');
      return 1;
    }
    throw err;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`uwmd-report: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
