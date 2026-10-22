// RFC 0112 D4: frontmatter `pipeline_state` left the Format. A record that still
// carries it is not refused: the member reads as an ordinary unknown
// frontmatter key, and nothing reads it (RFC 0108 D5 precedent).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';

const root = resolve(__dirname, '../../..');
const RETIRED_BLOCK = 'pipeline_state:\n  L0_ingestion: complete\n  L6_risk: pending\n';

/** The Parkview example without, and then with, a retired `pipeline_state` member. */
function variants(): { plain: string; retired: string } {
  const source = readFileSync(resolve(root, 'examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8').replaceAll('\r\n', '\n');
  const plain = source.replace(/^pipeline_state:\n(?: {2}\S[^\n]*\n)+/m, '');
  expect(plain).not.toMatch(/^pipeline_state:/m);
  const retired = plain.replace(/^status:/m, `${RETIRED_BLOCK}status:`);
  expect(retired).not.toBe(plain);
  return { plain, retired };
}

describe('a retired pipeline_state frontmatter member (RFC 0112 D4)', () => {
  it('reads as an ordinary unknown frontmatter key', () => {
    const { retired } = variants();
    const parsed = parseUWFile(retired);
    expect(parsed.frontmatter['pipeline_state']).toEqual({ L0_ingestion: 'complete', L6_risk: 'pending' });
  });

  it('changes no validation finding, status or readiness', () => {
    const { plain, retired } = variants();
    const withMember = validateUWFile(retired);
    expect(withMember).toEqual(validateUWFile(plain));
    expect(JSON.stringify(withMember.issues)).not.toContain('pipeline_state');
  });
});
