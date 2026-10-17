// UNACCEPTED current-policy observation adapter, not a new normative contract.
// Does NOT run inside a financial primitive and is not imported by kernel.mjs.
import * as raw from './kernel.mjs';
const refusal = (reason) => ({ status: 'refused', reason, observed_code: 'CALC-TYPE-001' });
export function currentPolicy(op, args) {
  if (!['pow', 'sqrt', 'log', 'exp'].includes(op)) throw new RangeError('Unknown wrapper');
  if (!Array.isArray(args) || args.length !== (op === 'pow' ? 2 : 1)) return refusal('arity');
  // The current asNumberOrNull accepts null, then checks typeof, NOT finite.
  for (const input of args) if (input !== null && typeof input !== 'number') return refusal('type');
  if (args.some((x) => x === null)) return { status: 'returned', value: null };
  if (op === 'sqrt' && args[0] < 0 || op === 'log' && args[0] <= 0) return refusal('domain');
  const value = raw[op](...args);
  if ((op === 'pow' || op === 'exp') && !Number.isFinite(value)) return refusal('nonfinite_result');
  return { status: 'returned', value };
}
