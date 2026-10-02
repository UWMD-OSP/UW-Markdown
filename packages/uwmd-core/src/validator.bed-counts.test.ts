// BED-01…BED-06 — student-housing bed counts and pre-leasing dates (RFC 0069, §4.3).
//
// The reference roll is the RFC's consistent one: 600 beds, 567 occupied on
// the roll's 2026-03-15 as_of_date, 573 pre-leased as of 2026-03-15 for the
// term starting 2026-08-15. Each test changes one fact and pins exactly the
// codes that fact owes.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { evaluateCalc } from './calc/index.js';
import { STUDENT_HOUSING_PACK } from './packs/student-housing.js';

const ROLL: Record<string, unknown> = {
  as_of_date: '2026-03-15',
  occupied_beds: 567,
  preleased_beds: 573,
  preleased_as_of: '2026-03-15',
  preleased_term_start: '2026-08-15',
};

function doc(
  roll: Record<string, unknown>,
  opts: { assetClass?: string; totalBeds?: unknown; envelope?: boolean; extra?: string } = {},
): string {
  const { assetClass = 'student_housing', envelope = false, extra = '' } = opts;
  // An explicit `totalBeds: undefined` means the property states no total.
  const totalBeds = 'totalBeds' in opts ? opts.totalBeds : 600;
  const property = totalBeds === undefined ? {} : { total_beds: totalBeds };
  const rollBody = envelope ? { content: roll } : roll;
  return `---
uw_version: "1.1"
deal_id: TEST-BED
asset_class: ${assetClass}
---

\`\`\`json uw:section=property source=manual ts=2026-09-28T00:00:00Z v=1
${JSON.stringify(property, null, 2)}
\`\`\`

\`\`\`json uw:section=rent_roll source=manual ts=2026-09-28T00:00:00Z v=1
${JSON.stringify(rollBody, null, 2)}
\`\`\`
${extra}`;
}

const bedIssues = (source: string) =>
  validateUWFile(parseUWFile(source)).issues.filter((i) => i.code.startsWith('BED-'));
const codes = (source: string) => bedIssues(source).map((i) => `${i.code}:${i.field}`).sort();

function roll(overrides: Record<string, unknown>, drop: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = { ...ROLL, ...overrides };
  for (const key of drop) delete out[key];
  return out;
}

describe('RFC 0069 — a complete, consistent roll', () => {
  it('draws no BED issue', () => {
    expect(codes(doc(ROLL))).toEqual([]);
  });

  it('reads a v2 content envelope exactly like a flat roll (§VIII.2)', () => {
    expect(codes(doc(ROLL, { envelope: true }))).toEqual([]);
    expect(codes(doc(roll({ preleased_beds: 620 }), { envelope: true }))).toEqual(['BED-02:preleased_beds']);
  });

  it('reports every BED code as an error in the rent_roll section', () => {
    const issues = bedIssues(doc(roll({ occupied_beds: -1, preleased_as_of: '2026-13-01' }, ['as_of_date'])));
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.severity).toBe('error');
      expect(issue.section).toBe('rent_roll');
    }
  });
});

describe('RFC 0069 — BED-01, a stated count is a nonnegative integer', () => {
  it.each([
    ['a string', '567'],
    ['a fraction', 566.5],
    ['a negative', -1],
    ['a ratio', 0.945],
  ])('%s errors', (_label, value) => {
    expect(codes(doc(roll({ occupied_beds: value })))).toEqual(['BED-01:occupied_beds']);
    expect(codes(doc(roll({ preleased_beds: value })))).toEqual(['BED-01:preleased_beds']);
  });

  it('a non-finite count errors (JSON cannot spell one, so the parsed value is set directly)', () => {
    const parsed = parseUWFile(doc(ROLL));
    const block = parsed.sections['rent_roll'] as { content: Record<string, unknown> };
    block.content['occupied_beds'] = Number.POSITIVE_INFINITY;
    block.content['preleased_beds'] = Number.NaN;
    const found = validateUWFile(parsed).issues.filter((i) => i.code.startsWith('BED-')).map((i) => `${i.code}:${i.field}`).sort();
    expect(found).toEqual(['BED-01:occupied_beds', 'BED-01:preleased_beds']);
  });

  it('is checked when property.total_beds is absent, which skips only BED-02', () => {
    expect(codes(doc(roll({ occupied_beds: -3 }), { totalBeds: undefined }))).toEqual(['BED-01:occupied_beds']);
  });

  it('zero is a valid count', () => {
    expect(codes(doc(roll({ occupied_beds: 0, preleased_beds: 0 })))).toEqual([]);
  });
});

describe('RFC 0069 — BED-02, a count does not exceed property.total_beds', () => {
  it.each([
    ['occupied_beds', 599, []],
    ['occupied_beds', 600, []],
    ['occupied_beds', 601, ['BED-02:occupied_beds']],
    ['preleased_beds', 599, []],
    ['preleased_beds', 600, []],
    ['preleased_beds', 620, ['BED-02:preleased_beds']],
  ])('%s = %i', (field, value, expected) => {
    expect(codes(doc(roll({ [field]: value })))).toEqual(expected);
  });

  it('is skipped when total_beds is absent or not a number; CC-13 owns that', () => {
    expect(codes(doc(roll({ preleased_beds: 9999 }), { totalBeds: undefined }))).toEqual([]);
    expect(codes(doc(roll({ preleased_beds: 9999 }), { totalBeds: '600' }))).toEqual([]);
  });

  it('is not raised for an invalid count, which BED-01 already reports', () => {
    expect(codes(doc(roll({ occupied_beds: 700.5 })))).toEqual(['BED-01:occupied_beds']);
  });

  it('allows no future-capacity exception: a pre-leased count above today\'s beds is an error', () => {
    expect(codes(doc(roll({ preleased_beds: 601 })))).toEqual(['BED-02:preleased_beds']);
  });
});

describe('RFC 0069 — BED-03, occupied_beds needs the roll\'s as_of_date', () => {
  it('errors when as_of_date is absent', () => {
    expect(codes(doc(roll({}, ['as_of_date'])))).toEqual(['BED-03:as_of_date']);
  });

  it.each(['2026-02-30', '03/15/2026', '2026-3-15', 20260315])('errors when as_of_date is %s', (value) => {
    expect(codes(doc(roll({ as_of_date: value })))).toEqual(['BED-03:as_of_date']);
  });

  it('says nothing about a malformed as_of_date when occupied_beds is absent', () => {
    expect(codes(doc(roll({ as_of_date: 'soon' }, ['occupied_beds'])))).toEqual([]);
  });

  it('applies to a stated but invalid occupied_beds too', () => {
    expect(codes(doc(roll({ occupied_beds: 'many' }, ['as_of_date'])))).toEqual(['BED-01:occupied_beds', 'BED-03:as_of_date']);
  });
});

describe('RFC 0069 — BED-04, preleased_beds needs both pre-leasing dates', () => {
  it('errors for each missing date', () => {
    expect(codes(doc(roll({}, ['preleased_as_of'])))).toEqual(['BED-04:preleased_as_of']);
    expect(codes(doc(roll({}, ['preleased_term_start'])))).toEqual(['BED-04:preleased_term_start']);
    expect(codes(doc(roll({}, ['preleased_as_of', 'preleased_term_start']))))
      .toEqual(['BED-04:preleased_as_of', 'BED-04:preleased_term_start']);
  });

  it('treats a null date as absent', () => {
    expect(codes(doc(roll({ preleased_term_start: null })))).toEqual(['BED-04:preleased_term_start']);
  });
});

describe('RFC 0069 — BED-05, a stated pre-leasing date is a real date', () => {
  it('errors with preleased_beds stated', () => {
    expect(codes(doc(roll({ preleased_as_of: '2026-02-30' })))).toEqual(['BED-05:preleased_as_of']);
    expect(codes(doc(roll({ preleased_term_start: 'fall 2026' })))).toEqual(['BED-05:preleased_term_start']);
  });

  it('errors without preleased_beds too', () => {
    expect(codes(doc(roll({ preleased_term_start: '2026/08/15' }, ['preleased_beds'])))).toEqual(['BED-05:preleased_term_start']);
  });
});

describe('RFC 0069 — BED-06, preleased_as_of is before preleased_term_start', () => {
  it('errors on equality and on a later as-of date', () => {
    expect(codes(doc(roll({ preleased_as_of: '2026-08-15' })))).toEqual(['BED-06:preleased_as_of']);
    expect(codes(doc(roll({ preleased_as_of: '2026-09-01' })))).toEqual(['BED-06:preleased_as_of']);
  });

  it('applies without preleased_beds', () => {
    expect(codes(doc(roll({ preleased_as_of: '2026-09-01' }, ['preleased_beds'])))).toEqual(['BED-06:preleased_as_of']);
  });

  it('is not raised when either date is invalid; BED-05 covers that', () => {
    expect(codes(doc(roll({ preleased_as_of: '2026-99-01', preleased_term_start: '2026-01-01' }))))
      .toEqual(['BED-05:preleased_as_of']);
  });
});

describe('RFC 0069 — what the family never does', () => {
  it('draws nothing for a roll stating none of the fields, and the pack metrics are null', () => {
    const source = doc({ as_of_date: '2026-03-15' });
    expect(codes(source)).toEqual([]);
    const parsed = parseUWFile(source);
    for (const id of ['occupancy', 'pre_lease_rate']) {
      const decl = STUDENT_HOUSING_PACK.calculations.find((c) => c.id === id);
      expect(decl).toBeDefined();
      const result = evaluateCalc(decl!, { parsed, prior_results: {}, locale: 'en-US' });
      expect(result.ok).toBe(true);
      expect(result.value).toBeNull();
    }
  });

  it('treats valid, ordered pre-leasing dates without a count as inert', () => {
    expect(codes(doc(roll({}, ['preleased_beds'])))).toEqual([]);
  });

  it('never compares the two counts with each other', () => {
    expect(codes(doc(roll({ occupied_beds: 600, preleased_beds: 0 })))).toEqual([]);
    expect(codes(doc(roll({ occupied_beds: 0, preleased_beds: 600 })))).toEqual([]);
  });

  it('never compares a date with the clock', () => {
    expect(codes(doc(roll({
      as_of_date: '1999-01-01', preleased_as_of: '2099-01-01', preleased_term_start: '2099-08-15',
    })))).toEqual([]);
  });

  it('adds no issue for another class that states nothing, or states valid dated counts', () => {
    expect(codes(doc({ as_of_date: '2026-03-15' }, { assetClass: 'multifamily' }))).toEqual([]);
    expect(codes(doc(ROLL, { assetClass: 'senior_housing' }))).toEqual([]);
  });

  it('still applies the typed rules when another class states the fields', () => {
    expect(codes(doc(roll({ occupied_beds: -1 }, ['as_of_date']), { assetClass: 'multifamily' })))
      .toEqual(['BED-01:occupied_beds', 'BED-03:as_of_date']);
  });

  it('does not read a component block as the roll', () => {
    const component = `
\`\`\`json uw:section=rent_roll variant=dorm source=manual ts=2026-09-28T00:00:00Z v=1
{ "_role": "component", "occupied_beds": -5 }
\`\`\`
`;
    const source = `---
uw_version: "1.1"
deal_id: TEST-BED
asset_class: student_housing
---

\`\`\`json uw:section=property source=manual ts=2026-09-28T00:00:00Z v=1
{ "total_beds": 600 }
\`\`\`

\`\`\`json uw:section=rent_roll variant=total source=manual ts=2026-09-28T00:00:00Z v=1
${JSON.stringify({ _role: 'primary', ...ROLL })}
\`\`\`
${component}`;
    expect(codes(source)).toEqual([]);
  });
});
