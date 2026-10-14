// LOC-01 and CUR-01 — the validation half of the RFC 0001 locale negotiation
// surfaces (and RFC 0046 currency identity). The display-only boundary — an
// unregistered locale refuses display renders and nothing else — is tested with
// the renderer in @uwmd/core (renderer.locale.test.ts).

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { SUPPORTED_LOCALES } from './protocol.js';

function doc(localeLine: string): string {
  return `---
uw_version: "3.0"
deal_id: TEST-LOC
deal_name: "Locale Deal"
created: "2026-09-01T00:00:00Z"
last_modified: "2026-09-01T00:00:00Z"
asset_class: office
${localeLine}
---

\`\`\`json uw:section=property source=manual ts=2026-09-01T00:00:00Z v=1
{ "rentable_square_feet": 42500, "year_built": 1998 }
\`\`\`
`;
}

function locIssues(content: string) {
  return validateUWFile(parseUWFile(content)).issues.filter((i) => i.code.startsWith('LOC-'));
}

function curIssues(content: string) {
  return validateUWFile(parseUWFile(content)).issues.filter((i) => i.code.startsWith('CUR-'));
}

describe('LOC-01', () => {
  it('stays silent when locale is absent (= en-US)', () => {
    expect(locIssues(doc('status: draft'))).toEqual([]);
  });

  it('stays silent for every registered locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(locIssues(doc(`locale: ${locale}`)), locale).toEqual([]);
    }
  });

  it('errors on an unregistered tag', () => {
    const issues = locIssues(doc('locale: xx-XX'));
    expect(issues.map((i) => i.code)).toEqual(['LOC-01']);
    expect(issues[0]!.severity).toBe('error');
  });
});

describe('CUR-01', () => {
  it('accepts an explicit document currency identity', () => {
    expect(curIssues(doc('currency_code: MXN'))).toEqual([]);
  });

  it('reports malformed identity', () => {
    expect(curIssues(doc('currency_code: usd')).map((i) => i.code)).toEqual(['CUR-01']);
  });
});

// The render refusal and the locale-threaded display renders are the starter
// renderer's; they live in @uwmd/core's renderer.locale.test.ts (RFC 0083).
