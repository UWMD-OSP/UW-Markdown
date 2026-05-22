// uwmd-excel CLI — convert a .uw.md file to an underwriting workbook.
//
// Usage:
//   uwmd-excel <input.uw.md> [-o output.xlsx]
//
// Supports multifamily, office, retail, and industrial deals (the asset classes
// with a registered workbook layout). Defaults output to <input>.xlsx alongside
// the input file. Errors are reported to stderr with a non-zero exit code;
// success prints the absolute output path.

import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { parseUWFile } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

interface ParsedArgs {
  input: string;
  output: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
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
      '  (multifamily, office, retail, industrial)',
      '',
      'Usage:',
      '  uwmd-excel <input.uw.md> [-o output.xlsx]',
      '',
      'Options:',
      '  -o, --output <path>   Output .xlsx path (defaults next to input)',
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
