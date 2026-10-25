// Portable CLI request syntax only; actual cross-runtime support proof is #552.
import { CalcError } from '@uwmd/verify';
export function parseProFormaArgs(args: readonly string[]): { file: string; json: boolean } {
  let file: string | undefined; let json = false;
  for (const arg of args) {
    if (arg === '--json' && !json) json = true;
    else if (arg.startsWith('-') || file !== undefined) throw new CalcError('CALC-PRO-FORMA', 'Expected one source file and optional --json.', 'arguments');
    else file = arg;
  }
  if (!file) throw new CalcError('CALC-PRO-FORMA', 'A source file is required.', 'arguments');
  return { file, json };
}

