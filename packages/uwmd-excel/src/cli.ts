// uwmd-excel CLI — convert a .uw.md file to an underwriting workbook.
//
// Usage:
//   uwmd-excel <input.uw.md> [-o output.xlsx]
//
// Supports every asset class with a registered workbook layout. Defaults output to
// <input>.xlsx alongside
// the input file. Errors are reported to stderr with a non-zero exit code;
// success prints the absolute output path.

import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { parseUWFile } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import { fromWorkbook } from './fromWorkbook.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

interface ParsedArgs {
  input: string;
  output: string;
}

interface ImportArgs {
  import: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs | ImportArgs | { error: string } {
  if (argv[0] === '--import') {
    const input = argv[1];
    if (!input || input.startsWith('-')) return { error: '--import requires a workbook path' };
    if (argv.length > 2) return { error: `unexpected argument: ${argv[2]}` };
    return { import: resolve(input) };
  }
  let input: string | undefined;
  let output: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--output') {
      output = argv[++i];
      if (!output) return { error: `${a} requires a path` };
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
    : join(dirname(inputAbs), defaultOutputName(inputAbs));
  return { input: inputAbs, output: outputAbs };
}

function defaultOutputName(inputPath: string): string {
  const base = basename(inputPath);
  // Strip .uw.md or .md, leave the rest.
  const stripped = base.endsWith('.uw.md')
    ? base.slice(0, -'.uw.md'.length)
    : base.slice(0, -extname(base).length);
  return `${stripped}.xlsx`;
}

function printHelp(): void {
  process.stdout.write(
    [
      'uwmd-excel — convert a .uw.md file to an underwriting workbook',
      `  (${SUPPORTED_ASSET_CLASSES.join(', ')})`,
      '',
      'Usage:',
      '  uwmd-excel <input.uw.md> [-o output.xlsx]',
      '  uwmd-excel --import <input.xlsx>',
      '',
      'Options:',
      '  -o, --output <path>   Output .xlsx path (defaults next to input)',
      '  --import <path>       Print editable section payloads from a converter workbook',
      '  -h, --help            Show this help',
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
    process.stderr.write(`uwmd-excel: ${args.error}\n`);
    printHelp();
    return 2;
  }

  if ('import' in args) {
    const wb = new ExcelJS.Workbook();
    // exceljs's Buffer declaration is pinned to an older @types/node shape.
    const bytes = Buffer.from(await readFile(args.import));
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
    process.stdout.write(`${JSON.stringify(fromWorkbook(wb), null, 2)}\n`);
    return 0;
  }

  const raw = await readFile(args.input, 'utf8');
  const parsed = parseUWFile(raw);

  const assetClass = String(parsed.frontmatter.asset_class ?? '');
  if (!getLayoutForAssetClass(assetClass)) {
    process.stderr.write(
      `uwmd-excel: unsupported asset_class "${assetClass}". Supported: ${SUPPORTED_ASSET_CLASSES.join(', ')}.\n`,
    );
    return 1;
  }

  const wb = await toWorkbook(parsed);
  await wb.xlsx.writeFile(args.output);
  process.stdout.write(`${args.output}\n`);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`uwmd-excel: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
