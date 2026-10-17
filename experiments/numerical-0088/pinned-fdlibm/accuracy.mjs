// Candidate observations vs independent mathematical certificates, NOT oracle
// generation and NOT an assertion that fdlibm must be correctly rounded.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { run } from './run.mjs';
const file = (name) => new URL(name, import.meta.url);
const digest = (name) => createHash('sha256').update(readFileSync(file(name))).digest('hex');
const ordered = (text) => {
  const word = BigInt(`0x${text}`);
  const sign = 1n << 63n;
  return (word & sign) !== 0n ? (~word & ((1n << 64n) - 1n)) : word | sign;
};
export function document() {
  const inputs = JSON.parse(readFileSync(file('./math-inputs.json'))).cases;
  const evidence = JSON.parse(readFileSync(file('./math-evidence.json')));
  const cases = inputs.map((input, i) => {
    const expected = evidence.cases[i];
    if (input.id !== expected.id || !expected.reference.bits) throw new RangeError('Incomplete accuracy evidence');
    const candidate = run(input);
    const distance = ordered(candidate.bits) - ordered(expected.reference.bits);
    return { id: input.id, candidate, reference_word: expected.reference.bits,
      signed_ordered_word_distance: distance.toString(), matches_reference_word: candidate.bits === expected.reference.bits };
  });
  return { status: 'UNACCEPTED candidate observations, not independent expected answers or universal accuracy proof',
    inputs_sha256: digest('./math-inputs.json'), mathematics_sha256: digest('./math-evidence.json'),
    candidate_sources: Object.fromEntries(['kernel.mjs', 'words.mjs', 'constants.mjs', 'run.mjs'].map((p) => [p, digest(p)])),
    cases, exact_word_agreements: cases.filter((c) => c.matches_reference_word).length,
    mathematical_word_disagreements: cases.filter((c) => !c.matches_reference_word).map((c) => c.id) };
}
const mode = process.argv[2];
if (mode === '--freeze' || mode === '--check') {
  const data = `${JSON.stringify(document(), null, 2)}\n`;
  const output = file('./accuracy-observations.json');
  if (mode === '--freeze') {
    if (existsSync(output)) throw new RangeError('Refusing to overwrite candidate observations');
    writeFileSync(output, data);
    console.log('Wrote first candidate accuracy observations');
  } else {
    if (readFileSync(output, 'utf8') !== data) throw new RangeError('Candidate accuracy observations differ; inspect rather than rebaseline');
    const observed = document();
    console.log(`Candidate observations match: ${observed.exact_word_agreements}/${observed.cases.length} exact mathematical words; ${observed.mathematical_word_disagreements.length} retained disagreements`);
  }
}
